use crate::models::agent_types::*;
use base64::{engine::general_purpose, Engine as _};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tokio::time::{interval, Duration};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type WsStream = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

/// Gemini Live WebSocket session
/// Manages real-time bidirectional communication with Vertex AI Gemini Live API
pub struct GeminiLiveSession {
    ws_stream: Arc<Mutex<WsStream>>,
    message_tx: mpsc::UnboundedSender<GeminiMessage>,
    message_rx: Arc<Mutex<mpsc::UnboundedReceiver<GeminiMessage>>>,
    keep_alive_handle: Option<tokio::task::JoinHandle<()>>,
    session_id: String,
}

impl GeminiLiveSession {
    /// Connect to Vertex AI Gemini Live API
    ///
    /// # Arguments
    /// * `project_id` - Google Cloud project ID
    /// * `location` - Google Cloud region (e.g., "us-central1")
    /// * `model_id` - Model identifier (e.g., "gemini-2.0-flash-live-preview-04-09")
    /// * `access_token` - Google Cloud access token (from ADC or API key)
    /// * `session_id` - Unique session identifier
    pub async fn connect(
        project_id: &str,
        location: &str,
        model_id: &str,
        access_token: &str,
        session_id: String,
    ) -> Result<Self, String> {
        // Build WebSocket URL for Vertex AI
        let url = format!(
            "wss://{}-aiplatform.googleapis.com/v1beta1/projects/{}/locations/{}/publishers/google/models/{}:streamGenerateContent?alt=sse",
            location, project_id, location, model_id
        );

        println!("[GeminiLiveSession] Connecting to {}", url);

        // Add authentication header
        let request = http::Request::builder()
            .uri(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .body(())
            .map_err(|e| format!("Failed to build request: {}", e))?;

        // Connect to WebSocket
        let (ws_stream, _) = connect_async(request)
            .await
            .map_err(|e| format!("WebSocket connection failed: {}", e))?;

        println!("[GeminiLiveSession] Connected successfully");

        // Create message channels
        let (message_tx, message_rx) = mpsc::unbounded_channel();

        let session = Self {
            ws_stream: Arc::new(Mutex::new(ws_stream)),
            message_tx,
            message_rx: Arc::new(Mutex::new(message_rx)),
            keep_alive_handle: None,
            session_id,
        };

        Ok(session)
    }

    /// Send setup configuration to initialize the session
    pub async fn send_setup(&mut self, config: SetupConfig) -> Result<(), String> {
        let setup_message = GeminiMessage::Setup { setup: config };
        self.send_message(&setup_message).await
    }

    /// Send audio chunk to Gemini
    ///
    /// # Arguments
    /// * `audio_data` - PCM16 audio bytes (16kHz, mono, 16-bit)
    pub async fn send_audio_chunk(&self, audio_data: &[u8]) -> Result<(), String> {
        // Encode audio to base64
        let base64_audio = general_purpose::STANDARD.encode(audio_data);

        let message = GeminiMessage::RealtimeInput {
            realtime_input: RealtimeInput {
                media_chunks: vec![MediaChunk {
                    mime_type: "audio/pcm".to_string(),
                    data: base64_audio,
                }],
            },
        };

        self.send_message(&message).await
    }

    /// Send function response back to Gemini
    pub async fn send_function_response(
        &self,
        function_responses: Vec<FunctionResponse>,
    ) -> Result<(), String> {
        let message = GeminiMessage::ToolResponse {
            tool_response: ToolResponse { function_responses },
        };

        self.send_message(&message).await
    }

    /// Send a generic message to Gemini
    async fn send_message(&self, message: &GeminiMessage) -> Result<(), String> {
        let json = serde_json::to_string(message)
            .map_err(|e| format!("Failed to serialize message: {}", e))?;

        let mut ws = self.ws_stream.lock().await;
        ws.send(Message::Text(json))
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        Ok(())
    }

    /// Receive a message from Gemini (non-blocking)
    pub async fn receive_message(&self) -> Option<GeminiMessage> {
        let mut rx = self.message_rx.lock().await;
        rx.recv().await
    }

    /// Start keep-alive mechanism
    /// Sends empty audio chunks every 25 seconds to prevent timeout
    pub fn start_keep_alive(&mut self) {
        let ws_stream = Arc::clone(&self.ws_stream);
        let session_id = self.session_id.clone();

        let handle = tokio::spawn(async move {
            let mut timer = interval(Duration::from_secs(25));

            loop {
                timer.tick().await;

                // Send empty realtime input
                let keep_alive = GeminiMessage::RealtimeInput {
                    realtime_input: RealtimeInput {
                        media_chunks: vec![],
                    },
                };

                let json = match serde_json::to_string(&keep_alive) {
                    Ok(j) => j,
                    Err(e) => {
                        eprintln!("[GeminiLiveSession {}] Keep-alive serialize error: {}", session_id, e);
                        continue;
                    }
                };

                let mut ws = ws_stream.lock().await;
                if let Err(e) = ws.send(Message::Text(json)).await {
                    eprintln!("[GeminiLiveSession {}] Keep-alive send error: {}", session_id, e);
                    break;
                }

                println!("[GeminiLiveSession {}] Keep-alive sent", session_id);
            }
        });

        self.keep_alive_handle = Some(handle);
    }

    /// Start receiving messages from WebSocket
    /// Runs in background and forwards messages to the channel
    pub fn start_receiving(&self) {
        let ws_stream = Arc::clone(&self.ws_stream);
        let message_tx = self.message_tx.clone();
        let session_id = self.session_id.clone();

        tokio::spawn(async move {
            loop {
                let message = {
                    let mut ws = ws_stream.lock().await;
                    ws.next().await
                };

                match message {
                    Some(Ok(Message::Text(text))) => {
                        // Parse JSON message
                        match serde_json::from_str::<GeminiMessage>(&text) {
                            Ok(gemini_msg) => {
                                if message_tx.send(gemini_msg).is_err() {
                                    eprintln!("[GeminiLiveSession {}] Message receiver dropped", session_id);
                                    break;
                                }
                            }
                            Err(e) => {
                                eprintln!("[GeminiLiveSession {}] Failed to parse message: {}", session_id, e);
                                eprintln!("Raw message: {}", text);
                            }
                        }
                    }
                    Some(Ok(Message::Close(frame))) => {
                        println!("[GeminiLiveSession {}] WebSocket closed: {:?}", session_id, frame);
                        break;
                    }
                    Some(Ok(Message::Ping(_))) => {
                        // Ping will be auto-responded by tungstenite
                    }
                    Some(Ok(Message::Pong(_))) => {
                        // Pong received
                    }
                    Some(Ok(_)) => {
                        // Other message types (binary, frame)
                    }
                    Some(Err(e)) => {
                        eprintln!("[GeminiLiveSession {}] WebSocket error: {}", session_id, e);
                        break;
                    }
                    None => {
                        println!("[GeminiLiveSession {}] WebSocket stream ended", session_id);
                        break;
                    }
                }
            }
        });
    }

    /// Close the WebSocket connection
    pub async fn close(&mut self) -> Result<(), String> {
        // Stop keep-alive
        if let Some(handle) = self.keep_alive_handle.take() {
            handle.abort();
        }

        // Close WebSocket
        let mut ws = self.ws_stream.lock().await;
        ws.close(None)
            .await
            .map_err(|e| format!("Failed to close WebSocket: {}", e))?;

        println!("[GeminiLiveSession {}] Closed", self.session_id);
        Ok(())
    }

    /// Get session ID
    pub fn session_id(&self) -> &str {
        &self.session_id
    }
}

impl Drop for GeminiLiveSession {
    fn drop(&mut self) {
        // Abort keep-alive task if still running
        if let Some(handle) = self.keep_alive_handle.take() {
            handle.abort();
        }
    }
}

// ============================================================================
// Google Cloud Authentication Helper
// ============================================================================

/// Get Google Cloud access token using Application Default Credentials (ADC)
pub async fn get_vertex_ai_access_token() -> Result<String, String> {
    let auth_manager = gcp_auth::provider()
        .await
        .map_err(|e| format!("Failed to create auth provider: {}", e))?;

    let token = auth_manager
        .token(&["https://www.googleapis.com/auth/cloud-platform"])
        .await
        .map_err(|e| format!("Failed to get access token: {}", e))?;

    Ok(token.as_str().to_string())
}

/// Alternative: Get access token using Gemini API key directly
/// (Simpler but less secure for production)
pub fn use_gemini_api_key(api_key: String) -> String {
    // For Gemini API, we use the API key directly instead of Vertex AI
    api_key
}

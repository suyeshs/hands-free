use crate::models::agent_types::*;
use crate::services::gemini_live_session::{get_vertex_ai_access_token, GeminiLiveSession};
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

/// Main Handsfree Setup Agent service
/// Manages Gemini Live sessions for conversational settings management
pub struct HandsfreeSetupAgent {
    pub session_id: String,
    pub tenant_id: String,
    pub language: String,
    pub db_path: String,
    gemini_session: Option<Arc<Mutex<GeminiLiveSession>>>,
    context: Option<TenantContext>,
    state: AgentState,
}

impl HandsfreeSetupAgent {
    /// Create a new agent instance
    pub async fn new(
        tenant_id: String,
        language: String,
        db_path: String,
    ) -> Result<Self, String> {
        let session_id = Uuid::new_v4().to_string();

        println!("[HandsfreeSetupAgent] Creating new agent for tenant: {}", tenant_id);

        Ok(Self {
            session_id,
            tenant_id,
            language,
            db_path,
            gemini_session: None,
            context: None,
            state: AgentState::Idle,
        })
    }

    /// Initialize and start the agent session
    pub async fn start(&mut self) -> Result<SessionInfo, String> {
        self.state = AgentState::Initializing;

        // 1. Build tenant context
        println!("[HandsfreeSetupAgent] Building tenant context...");
        self.context = Some(self.build_tenant_context().await?);

        // 2. Get access token
        println!("[HandsfreeSetupAgent] Getting access token...");
        let access_token = self.get_access_token().await?;

        // 3. Get configuration
        let (project_id, location, model_id) = self.get_vertex_config()?;

        // 4. Connect to Gemini Live
        println!("[HandsfreeSetupAgent] Connecting to Gemini Live...");
        let mut session = GeminiLiveSession::connect(
            &project_id,
            &location,
            &model_id,
            &access_token,
            self.session_id.clone(),
        )
        .await?;

        // 5. Build and send setup configuration
        println!("[HandsfreeSetupAgent] Sending setup configuration...");
        let setup_config = self.build_setup_config()?;
        session.send_setup(setup_config).await?;

        // 6. Start keep-alive and message receiving
        session.start_keep_alive();
        session.start_receiving();

        self.gemini_session = Some(Arc::new(Mutex::new(session)));
        self.state = AgentState::Connected;

        println!("[HandsfreeSetupAgent] Session started successfully");

        Ok(SessionInfo {
            session_id: self.session_id.clone(),
            tenant_id: self.tenant_id.clone(),
            language: self.language.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Send audio chunk to Gemini
    pub async fn send_audio(&self, audio_data: Vec<u8>) -> Result<(), String> {
        let session = self
            .gemini_session
            .as_ref()
            .ok_or("Session not initialized")?;

        let session_lock = session.lock().await;
        session_lock.send_audio_chunk(&audio_data).await
    }

    /// Receive a message from Gemini
    pub async fn receive_message(&self) -> Option<GeminiMessage> {
        let session = self.gemini_session.as_ref()?;
        let session_lock = session.lock().await;
        session_lock.receive_message().await
    }

    /// Send function response back to Gemini
    pub async fn send_function_response(
        &self,
        responses: Vec<FunctionResponse>,
    ) -> Result<(), String> {
        let session = self
            .gemini_session
            .as_ref()
            .ok_or("Session not initialized")?;

        let session_lock = session.lock().await;
        session_lock.send_function_response(responses).await
    }

    /// Shutdown the agent session
    pub async fn shutdown(&mut self) -> Result<(), String> {
        if let Some(session) = self.gemini_session.take() {
            let mut session_lock = session.lock().await;
            session_lock.close().await?;
        }

        self.state = AgentState::Idle;
        println!("[HandsfreeSetupAgent] Session shutdown complete");
        Ok(())
    }

    /// Get current agent state
    pub fn get_state(&self) -> AgentState {
        self.state.clone()
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    /// Get access token (Vertex AI or Gemini API)
    async fn get_access_token(&self) -> Result<String, String> {
        // Try GEMINI_API_KEY first (simpler for development)
        if let Ok(api_key) = env::var("GEMINI_API_KEY") {
            if !api_key.is_empty() {
                println!("[HandsfreeSetupAgent] Using GEMINI_API_KEY");
                return Ok(api_key);
            }
        }

        // Fall back to Vertex AI ADC (production)
        println!("[HandsfreeSetupAgent] Using Vertex AI ADC");
        get_vertex_ai_access_token().await
    }

    /// Get Vertex AI configuration from environment
    fn get_vertex_config(&self) -> Result<(String, String, String), String> {
        let project_id = env::var("VERTEX_PROJECT_ID")
            .unwrap_or_else(|_| "sahamati-labs".to_string());

        let location = env::var("VERTEX_LOCATION")
            .unwrap_or_else(|_| "us-central1".to_string());

        let model_id = env::var("VERTEX_MODEL_ID")
            .unwrap_or_else(|_| "gemini-2.0-flash-live-preview-04-09".to_string());

        Ok((project_id, location, model_id))
    }

    /// Build setup configuration for Gemini
    fn build_setup_config(&self) -> Result<SetupConfig, String> {
        let context = self.context.as_ref().ok_or("Context not built")?;

        // Get voice settings from environment
        let voice_name = env::var("VERTEX_AI_VOICE_NAME")
            .unwrap_or_else(|_| "Aoede".to_string());

        let temperature = env::var("VERTEX_TEMPERATURE")
            .unwrap_or_else(|_| "0.3".to_string())
            .parse::<f32>()
            .unwrap_or(0.3);

        let max_tokens = env::var("VERTEX_MAX_TOKENS")
            .unwrap_or_else(|_| "1024".to_string())
            .parse::<u32>()
            .unwrap_or(1024);

        let model = format!(
            "projects/{}/locations/{}/publishers/google/models/{}",
            env::var("VERTEX_PROJECT_ID").unwrap_or_else(|_| "sahamati-labs".to_string()),
            env::var("VERTEX_LOCATION").unwrap_or_else(|_| "us-central1".to_string()),
            env::var("VERTEX_MODEL_ID")
                .unwrap_or_else(|_| "gemini-2.0-flash-live-preview-04-09".to_string())
        );

        Ok(SetupConfig {
            model,
            generation_config: GenerationConfig {
                temperature,
                max_output_tokens: max_tokens,
                response_modalities: vec!["AUDIO".to_string()],
                speech_config: SpeechConfig {
                    voice_config: VoiceConfig { voice_name },
                    language_code: self.language.clone(),
                },
            },
            system_instruction: SystemInstruction {
                parts: vec![Part::Text {
                    text: self.build_system_prompt(context),
                }],
            },
            tools: vec![Tool {
                function_declarations: self.build_function_declarations(),
            }],
            tool_config: ToolConfig {
                function_calling_config: FunctionCallingConfig {
                    mode: "AUTO".to_string(),
                },
            },
        })
    }

    /// Build system prompt with context
    fn build_system_prompt(&self, context: &TenantContext) -> String {
        format!(
            r#"You are a helpful POS setup assistant for {}. You help staff manage settings, navigate the system, and answer questions about the POS.

**Current Context:**
- Restaurant: {} ({})
- Mode: {}
- User: {} ({})

**Capabilities:**
1. Answer questions: "What is my current GST rate?", "How do I enable service charge?"
2. Navigate: "Show me printer settings", "Take me to menu management"
3. Update settings: "Change GST to 12%", "Enable staff PIN"
4. Search: "Find settings related to tax"

**Response Style:**
- Conversational and helpful
- Ask for confirmation before critical changes (tax rates, going live, etc.)
- Provide context when showing settings (current values, constraints)
- Multilingual: Respond in the language the user speaks (auto-detect)

**Important:**
- ALWAYS show the relevant form/page when user asks "where is X" or "how do I change X"
- Use the show_settings_form function to display settings pages
- Provide current values when discussing settings
- Warn about implications of changes (e.g., "Changing GST will affect all future invoices")
- For bulk operations, summarize and ask for confirmation

**Available Settings Categories:**
- restaurant: Restaurant details (name, phone, address, GST, FSSAI)
- menu: Menu management, categories, items, pricing
- staff: Staff management, roles, permissions
- printer: Printer configuration, paper width, receipt settings
- tax: Tax settings, GST, service charge, round-off
- pos_workflow: POS behavior, staff PIN, table filtering

**Current Settings:**
{}"#,
            context.restaurant.name,
            context.restaurant.name,
            context.restaurant.restaurant_type,
            context.restaurant.current_mode,
            context.user.name,
            context.user.role,
            self.format_current_settings_summary(context)
        )
    }

    /// Format current settings summary
    fn format_current_settings_summary(&self, context: &TenantContext) -> String {
        crate::utils::context_builder::format_settings_summary(context)
    }

    /// Build function declarations for Gemini
    fn build_function_declarations(&self) -> Vec<FunctionDeclaration> {
        vec![
            FunctionDeclaration {
                name: "show_settings_form".to_string(),
                description: "Display a settings form/page and optionally highlight a specific field. Use this when user asks 'where is' or 'how do I change' something.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["restaurant", "menu", "staff", "printer", "tax", "pos_workflow"],
                            "description": "Settings category to display"
                        },
                        "field": {
                            "type": "string",
                            "description": "Optional specific field to highlight (e.g., 'gst_rate', 'service_charge_enabled')"
                        },
                        "action": {
                            "type": "string",
                            "enum": ["view", "edit"],
                            "description": "View or edit mode (default: edit)"
                        }
                    },
                    "required": ["category"]
                }),
            },
            FunctionDeclaration {
                name: "navigate_to_page".to_string(),
                description: "Navigate to a specific page in the POS system".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "page": {
                            "type": "string",
                            "enum": ["pos", "kitchen", "inventory", "settings", "hub", "menu", "staff"],
                            "description": "Page to navigate to"
                        },
                        "subpage": {
                            "type": "string",
                            "description": "Optional sub-page or tab"
                        }
                    },
                    "required": ["page"]
                }),
            },
            FunctionDeclaration {
                name: "get_current_setting".to_string(),
                description: "Retrieve the current value of a specific setting".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "field": {
                            "type": "string",
                            "description": "Setting field name (e.g., 'gst_rate', 'service_charge_enabled')"
                        }
                    },
                    "required": ["field"]
                }),
            },
            FunctionDeclaration {
                name: "update_setting".to_string(),
                description: "Update a restaurant setting value. Always ask for confirmation for critical changes.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "field": {
                            "type": "string",
                            "description": "Setting field to update"
                        },
                        "value": {
                            "description": "New value (string, number, or boolean)"
                        },
                        "confirm": {
                            "type": "boolean",
                            "description": "Whether user has confirmed this change"
                        }
                    },
                    "required": ["field", "value"]
                }),
            },
            FunctionDeclaration {
                name: "toggle_feature".to_string(),
                description: "Enable or disable a POS feature".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "feature": {
                            "type": "string",
                            "enum": ["tax", "service_charge", "staff_pin", "online_features", "inventory", "training_mode"],
                            "description": "Feature to toggle"
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Enable (true) or disable (false)"
                        }
                    },
                    "required": ["feature", "enabled"]
                }),
            },
            FunctionDeclaration {
                name: "search_settings".to_string(),
                description: "Search for settings by keyword".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (e.g., 'gst', 'tax', 'invoice')"
                        }
                    },
                    "required": ["query"]
                }),
            },
            FunctionDeclaration {
                name: "save_all_settings".to_string(),
                description: "Save all pending settings changes".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {}
                }),
            },
        ]
    }

    /// Build tenant context from database
    async fn build_tenant_context(&self) -> Result<TenantContext, String> {
        // Use context builder to load from SQLite
        crate::utils::context_builder::build_tenant_context(&self.tenant_id, &self.db_path).await
    }
}

// ============================================================================
// Global Session Manager (for Tauri commands)
// ============================================================================

lazy_static::lazy_static! {
    static ref AGENT_SESSIONS: Arc<Mutex<HashMap<String, Arc<Mutex<HandsfreeSetupAgent>>>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

/// Create a new agent session
pub async fn create_agent_session(
    tenant_id: String,
    language: String,
    db_path: String,
) -> Result<SessionInfo, String> {
    let mut agent = HandsfreeSetupAgent::new(tenant_id, language, db_path).await?;
    let session_info = agent.start().await?;
    let session_id = session_info.session_id.clone();

    // Store in global map
    let mut sessions = AGENT_SESSIONS.lock().await;
    sessions.insert(session_id, Arc::new(Mutex::new(agent)));

    Ok(session_info)
}

/// Get an existing agent session
pub async fn get_agent_session(
    session_id: &str,
) -> Result<Arc<Mutex<HandsfreeSetupAgent>>, String> {
    let sessions = AGENT_SESSIONS.lock().await;
    sessions
        .get(session_id)
        .cloned()
        .ok_or_else(|| format!("Session not found: {}", session_id))
}

/// Remove an agent session
pub async fn remove_agent_session(session_id: &str) -> Result<(), String> {
    let mut sessions = AGENT_SESSIONS.lock().await;
    sessions
        .remove(session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    Ok(())
}

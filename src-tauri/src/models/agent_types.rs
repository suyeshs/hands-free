use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Session & Configuration Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub tenant_id: String,
    pub language: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupConfig {
    pub model: String,
    pub generation_config: GenerationConfig,
    pub system_instruction: SystemInstruction,
    pub tools: Vec<Tool>,
    pub tool_config: ToolConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationConfig {
    pub temperature: f32,
    #[serde(rename = "maxOutputTokens")]
    pub max_output_tokens: u32,
    #[serde(rename = "responseModalities")]
    pub response_modalities: Vec<String>,
    #[serde(rename = "speechConfig")]
    pub speech_config: SpeechConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechConfig {
    #[serde(rename = "voiceConfig")]
    pub voice_config: VoiceConfig,
    #[serde(rename = "languageCode")]
    pub language_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    #[serde(rename = "voiceName")]
    pub voice_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInstruction {
    pub parts: Vec<Part>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    #[serde(rename = "functionDeclarations")]
    pub function_declarations: Vec<FunctionDeclaration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDeclaration {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value, // JSON Schema object
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    #[serde(rename = "functionCallingConfig")]
    pub function_calling_config: FunctionCallingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCallingConfig {
    pub mode: String, // "AUTO", "ANY", "NONE"
}

// ============================================================================
// Message Types (Gemini Live Protocol)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum GeminiMessage {
    Setup {
        setup: SetupConfig,
    },
    SetupComplete {
        #[serde(rename = "setupComplete")]
        setup_complete: serde_json::Value,
    },
    RealtimeInput {
        #[serde(rename = "realtimeInput")]
        realtime_input: RealtimeInput,
    },
    ServerContent {
        #[serde(rename = "serverContent")]
        server_content: ServerContent,
    },
    ToolCall {
        #[serde(rename = "toolCall")]
        tool_call: ToolCall,
    },
    ToolResponse {
        #[serde(rename = "toolResponse")]
        tool_response: ToolResponse,
    },
    Error {
        error: GeminiError,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeInput {
    #[serde(rename = "mediaChunks")]
    pub media_chunks: Vec<MediaChunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaChunk {
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub data: String, // Base64-encoded audio data
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerContent {
    #[serde(rename = "modelTurn")]
    pub model_turn: ModelTurn,
    #[serde(rename = "turnComplete")]
    pub turn_complete: bool,
    #[serde(rename = "thought_signature", skip_serializing_if = "Option::is_none")]
    pub thought_signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTurn {
    pub parts: Vec<Part>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Part {
    Text {
        text: String,
    },
    InlineData {
        #[serde(rename = "inlineData")]
        inline_data: InlineData,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlineData {
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub data: String, // Base64-encoded data
}

// ============================================================================
// Function Calling Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    #[serde(rename = "functionCalls")]
    pub function_calls: Vec<FunctionCall>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub id: String,
    pub args: serde_json::Value, // Function arguments as JSON
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResponse {
    #[serde(rename = "functionResponses")]
    pub function_responses: Vec<FunctionResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionResponse {
    pub name: String,
    pub id: String,
    pub response: serde_json::Value, // Function result
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiError {
    pub code: i32,
    pub message: String,
    pub status: Option<String>,
}

// ============================================================================
// Tenant Context Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantContext {
    pub restaurant: RestaurantInfo,
    pub settings_schema: Vec<SettingFieldSchema>,
    pub current_values: serde_json::Value,
    pub menu_stats: MenuStats,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestaurantInfo {
    pub name: String,
    pub restaurant_type: String,
    pub current_mode: String, // "training" or "live"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingFieldSchema {
    pub field: String,
    pub field_type: String, // "string", "number", "boolean"
    pub description: String,
    pub category: String,
    pub editable: bool,
    pub constraints: Option<FieldConstraints>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldConstraints {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub options: Option<Vec<String>>,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuStats {
    pub total_items: u32,
    pub total_categories: u32,
    pub has_specials: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub name: String,
    pub role: String,
    pub is_admin: bool,
}

// ============================================================================
// UI Action Types (for frontend)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UIAction {
    Navigate {
        page: String,
        subpage: Option<String>,
    },
    ShowForm {
        category: String,
        field: Option<String>,
    },
    HighlightField {
        field: String,
    },
    UpdateSetting {
        field: String,
        value: serde_json::Value,
    },
    ShowToast {
        message: String,
        level: String, // "info", "success", "error", "warning"
    },
}

// ============================================================================
// Agent State Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentState {
    Idle,
    Initializing,
    Connected,
    Listening,
    Processing,
    Speaking,
    Error { message: String },
}

// ============================================================================
// Audio Types
// ============================================================================

#[derive(Debug, Clone)]
pub struct AudioChunk {
    pub data: Vec<u8>, // PCM16 audio bytes
    pub timestamp: i64,
}

// ============================================================================
// Helper Functions
// ============================================================================

impl GeminiMessage {
    pub fn is_setup_complete(&self) -> bool {
        matches!(self, GeminiMessage::SetupComplete { .. })
    }

    pub fn is_server_content(&self) -> bool {
        matches!(self, GeminiMessage::ServerContent { .. })
    }

    pub fn is_tool_call(&self) -> bool {
        matches!(self, GeminiMessage::ToolCall { .. })
    }

    pub fn is_error(&self) -> bool {
        matches!(self, GeminiMessage::Error { .. })
    }
}

impl Part {
    pub fn is_text(&self) -> bool {
        matches!(self, Part::Text { .. })
    }

    pub fn is_audio(&self) -> bool {
        match self {
            Part::InlineData { inline_data } => inline_data.mime_type == "audio/pcm",
            _ => false,
        }
    }

    pub fn get_text(&self) -> Option<&str> {
        match self {
            Part::Text { text } => Some(text),
            _ => None,
        }
    }

    pub fn get_audio_data(&self) -> Option<&str> {
        match self {
            Part::InlineData { inline_data } if inline_data.mime_type == "audio/pcm" => {
                Some(&inline_data.data)
            }
            _ => None,
        }
    }
}

// ============================================================================
// Function Call Argument Schemas (for type safety)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowSettingsFormArgs {
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigateToPageArgs {
    pub page: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subpage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCurrentSettingArgs {
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingArgs {
    pub field: String,
    pub value: serde_json::Value,
    #[serde(default)]
    pub confirm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToggleFeatureArgs {
    pub feature: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSettingsArgs {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMenuItemsArgs {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateItemPriceArgs {
    pub item_name: String,
    pub new_price: f64,
    #[serde(default)]
    pub confirm: bool,
}

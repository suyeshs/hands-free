// Vision AI Plugin - Client Side
// Multi-camera support: Webcam, IP/RTSP, reCamera, Airtel Xsafe
// Edge AI processing with TensorFlow.js integration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CameraType {
    Webcam,
    IpCamera,
    ReCamera,
    AirtelXsafe,
    Onvif,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CameraLocation {
    Dining,
    Kitchen,
    Entrance,
    Bar,
    Parking,
    Storage,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    // Webcam
    pub device_id: Option<String>,

    // IP/RTSP Camera
    pub rtsp_url: Option<String>,
    pub http_url: Option<String>,
    pub ip_address: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,

    // reCamera specific
    pub recamera_edge_ai: Option<bool>,
    pub recamera_ws_port: Option<u16>,

    // Airtel Xsafe
    pub xsafe_device_id: Option<String>,
    pub xsafe_api_key: Option<String>,

    // ONVIF
    pub onvif_profile: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraFeatures {
    pub people_counting: bool,
    pub table_occupancy: bool,
    pub motion_detection: bool,
    pub face_detection: bool,
    pub safety_monitoring: bool,
    pub cloud_analysis: bool,
    pub cloud_interval: u32, // seconds
}

impl Default for CameraFeatures {
    fn default() -> Self {
        Self {
            people_counting: true,
            table_occupancy: false,
            motion_detection: true,
            face_detection: false,
            safety_monitoring: false,
            cloud_analysis: false,
            cloud_interval: 300,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessingMode {
    Edge,      // Local browser AI only
    Cloud,     // Cloud AI only (Gemini/Worker AI)
    Hybrid,    // Both edge + periodic cloud
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraConfig {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub camera_type: CameraType,
    pub location: CameraLocation,
    pub enabled: bool,
    pub connection: ConnectionConfig,
    pub features: CameraFeatures,
    pub processing_mode: ProcessingMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Detection {
    pub id: u32,
    pub class_id: u32,
    pub class_name: String,
    pub confidence: f32,
    pub bbox: BoundingBox,
    pub tracking_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResult {
    pub camera_id: String,
    pub timestamp: i64,
    pub detections: Vec<Detection>,
    pub people_count: u32,
    pub processing_source: String,
    pub inference_time_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionEvent {
    pub id: String,
    pub camera_id: String,
    pub event_type: String,
    pub severity: String,
    pub title: String,
    pub description: Option<String>,
    pub timestamp: i64,
}

// Plugin State
pub struct VisionAIPlugin {
    pub cameras: HashMap<String, CameraConfig>,
    pub active_streams: HashMap<String, bool>,
}

impl VisionAIPlugin {
    pub fn new() -> Self {
        Self {
            cameras: HashMap::new(),
            active_streams: HashMap::new(),
        }
    }

    pub fn add_camera(&mut self, config: CameraConfig) {
        self.cameras.insert(config.id.clone(), config);
    }

    pub fn remove_camera(&mut self, camera_id: &str) {
        self.cameras.remove(camera_id);
        self.active_streams.remove(camera_id);
    }

    pub fn get_camera(&self, camera_id: &str) -> Option<&CameraConfig> {
        self.cameras.get(camera_id)
    }

    pub fn list_cameras(&self) -> Vec<&CameraConfig> {
        self.cameras.values().collect()
    }

    pub fn is_stream_active(&self, camera_id: &str) -> bool {
        self.active_streams.get(camera_id).copied().unwrap_or(false)
    }
}

// WASM exports
#[no_mangle]
pub extern "C" fn init() {
    // Initialize plugin
}

#[no_mangle]
pub extern "C" fn add_camera(_config_json: &str) -> bool {
    // Add camera configuration
    true
}

#[no_mangle]
pub extern "C" fn remove_camera(_camera_id: &str) -> bool {
    // Remove camera
    true
}

#[no_mangle]
pub extern "C" fn start_stream(_camera_id: &str) -> bool {
    // Start camera stream
    true
}

#[no_mangle]
pub extern "C" fn stop_stream(_camera_id: &str) -> bool {
    // Stop camera stream
    true
}

#[no_mangle]
pub extern "C" fn process_frame(_camera_id: &str, _frame_data: &[u8]) -> String {
    // Process video frame with edge AI
    // Returns JSON with detection results
    "{}".to_string()
}

#[no_mangle]
pub extern "C" fn get_camera_list() -> String {
    // Return list of cameras as JSON
    "[]".to_string()
}

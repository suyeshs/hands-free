//! Types for LAN sync messages
//!
//! These match the cloud OrderNotificationDO message format for compatibility

use serde::{Deserialize, Serialize};
use obfstr::obfstr;

/// Device types that can connect to LAN sync
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DeviceType {
    Pos,
    Kds,
    Bds,
    Manager,
}

impl std::fmt::Display for DeviceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DeviceType::Pos => write!(f, "pos"),
            DeviceType::Kds => write!(f, "kds"),
            DeviceType::Bds => write!(f, "bds"),
            DeviceType::Manager => write!(f, "manager"),
        }
    }
}

/// Information about a connected client
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInfo {
    pub client_id: String,
    pub device_type: DeviceType,
    pub connected_at: String,
    pub ip_address: String,
}

/// LAN sync message types (compatible with cloud OrderNotificationDO)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LanMessage {
    /// New order created
    OrderCreated {
        order: serde_json::Value,
        kitchen_order: serde_json::Value,
    },
    /// Order status updated
    OrderStatusUpdate {
        order_id: String,
        status: String,
        updated_at: String,
    },
    /// Full state sync (sent on connection)
    SyncState {
        orders: Vec<serde_json::Value>,
    },
    /// Ping for keep-alive
    Ping,
    /// Pong response
    Pong,
    /// Client registration
    Register {
        device_type: DeviceType,
        tenant_id: String,
    },
    /// Registration acknowledgment
    Registered {
        client_id: String,
        server_info: ServerInfo,
    },
    /// Error message
    Error {
        message: String,
        code: String,
    },
}

/// Server information sent to clients on registration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub server_id: String,
    pub tenant_id: String,
    pub connected_clients: usize,
    pub server_time: String,
}

/// LAN server status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanServerStatus {
    pub is_running: bool,
    pub port: u16,
    pub ip_address: Option<String>,
    pub mdns_registered: bool,
    pub connected_clients: Vec<ClientInfo>,
    pub started_at: Option<String>,
}

/// LAN client status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanClientStatus {
    pub is_connected: bool,
    pub server_address: Option<String>,
    pub server_info: Option<ServerInfo>,
    pub connected_at: Option<String>,
    pub device_type: DeviceType,
}

/// Discovered LAN server via mDNS
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredServer {
    pub name: String,
    pub ip_address: String,
    pub port: u16,
    pub tenant_id: Option<String>,
}

/// LAN sync port
pub const LAN_SYNC_PORT: u16 = 3847;

/// Get mDNS service type (encrypted at compile time)
pub fn get_mdns_service_type() -> String {
    obfstr!("_handsfree._tcp.local.").to_string()
}

/// Get mDNS service name (encrypted at compile time)
pub fn get_mdns_service_name() -> String {
    obfstr!("Handsfree POS").to_string()
}

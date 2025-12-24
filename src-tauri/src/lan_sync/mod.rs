//! LAN Sync Module
//!
//! Provides local network synchronization between POS, KDS, and BDS devices.
//! - POS runs as the server (leader)
//! - KDS/BDS connect as clients
//! - Uses mDNS for service discovery
//! - WebSocket for real-time order sync

pub mod server;
pub mod client;
pub mod types;

pub use server::*;
pub use client::*;
pub use types::*;

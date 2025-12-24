#[cfg(not(target_os = "android"))]
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::error::Error;

/// Service name for keyring storage
const SERVICE_NAME: &str = "restaurant-pos-ai";

/// Device registration data stored securely in platform keychain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRegistration {
    pub device_id: String,
    pub device_name: String,
    pub tenant_id: String,
    pub tenant_name: String,
    pub registered_at: i64,
}

/// Manager session data stored securely
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagerSession {
    pub user_id: String,
    pub tenant_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

/// Secure storage interface using platform keychains
/// - macOS: Keychain Access
/// - Windows: Credential Manager
/// - Linux: Secret Service API
/// - Android: File-based storage (app-private directory)
pub struct SecureStorage;

// Desktop implementation using keyring
#[cfg(not(target_os = "android"))]
impl SecureStorage {
    /// Store device registration in platform keychain
    pub fn store_device_registration(registration: &DeviceRegistration) -> Result<(), Box<dyn Error>> {
        let entry = Entry::new(SERVICE_NAME, "device_registration")?;
        let json = serde_json::to_string(registration)?;
        entry.set_password(&json)?;
        Ok(())
    }

    /// Retrieve device registration from platform keychain
    pub fn get_device_registration() -> Result<Option<DeviceRegistration>, Box<dyn Error>> {
        let entry = Entry::new(SERVICE_NAME, "device_registration")?;
        match entry.get_password() {
            Ok(json) => {
                let registration: DeviceRegistration = serde_json::from_str(&json)?;
                Ok(Some(registration))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    /// Delete device registration (for device reset)
    pub fn delete_device_registration() -> Result<(), Box<dyn Error>> {
        let entry = Entry::new(SERVICE_NAME, "device_registration")?;
        match entry.delete_password() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(Box::new(e)),
        }
    }

    /// Store manager session securely
    pub fn store_manager_session(session: &ManagerSession) -> Result<(), Box<dyn Error>> {
        let entry = Entry::new(SERVICE_NAME, "manager_session")?;
        let json = serde_json::to_string(session)?;
        entry.set_password(&json)?;
        Ok(())
    }

    /// Retrieve manager session
    pub fn get_manager_session() -> Result<Option<ManagerSession>, Box<dyn Error>> {
        let entry = Entry::new(SERVICE_NAME, "manager_session")?;
        match entry.get_password() {
            Ok(json) => {
                let session: ManagerSession = serde_json::from_str(&json)?;
                Ok(Some(session))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    /// Delete manager session (logout)
    pub fn delete_manager_session() -> Result<(), Box<dyn Error>> {
        let entry = Entry::new(SERVICE_NAME, "manager_session")?;
        match entry.delete_password() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(Box::new(e)),
        }
    }

    /// Check if device is registered
    pub fn is_device_registered() -> bool {
        match Self::get_device_registration() {
            Ok(Some(_)) => true,
            _ => false,
        }
    }

    /// Check if manager session exists and is valid
    pub fn has_valid_manager_session() -> bool {
        match Self::get_manager_session() {
            Ok(Some(session)) => {
                let now = chrono::Utc::now().timestamp();
                session.expires_at > now
            }
            _ => false,
        }
    }
}

// Android implementation using file-based storage
#[cfg(target_os = "android")]
impl SecureStorage {
    fn get_storage_path(key: &str) -> std::path::PathBuf {
        // On Android, use app's internal storage directory
        let data_dir = std::env::var("TAURI_DATA_DIR")
            .unwrap_or_else(|_| "/data/data/com.stonepot_tech.handsfree_pos/files".to_string());
        std::path::PathBuf::from(data_dir).join(format!("{}.json", key))
    }

    /// Store device registration in file
    pub fn store_device_registration(registration: &DeviceRegistration) -> Result<(), Box<dyn Error>> {
        let path = Self::get_storage_path("device_registration");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string(registration)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Retrieve device registration from file
    pub fn get_device_registration() -> Result<Option<DeviceRegistration>, Box<dyn Error>> {
        let path = Self::get_storage_path("device_registration");
        if !path.exists() {
            return Ok(None);
        }
        let json = std::fs::read_to_string(path)?;
        let registration: DeviceRegistration = serde_json::from_str(&json)?;
        Ok(Some(registration))
    }

    /// Delete device registration
    pub fn delete_device_registration() -> Result<(), Box<dyn Error>> {
        let path = Self::get_storage_path("device_registration");
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }

    /// Store manager session in file
    pub fn store_manager_session(session: &ManagerSession) -> Result<(), Box<dyn Error>> {
        let path = Self::get_storage_path("manager_session");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string(session)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Retrieve manager session from file
    pub fn get_manager_session() -> Result<Option<ManagerSession>, Box<dyn Error>> {
        let path = Self::get_storage_path("manager_session");
        if !path.exists() {
            return Ok(None);
        }
        let json = std::fs::read_to_string(path)?;
        let session: ManagerSession = serde_json::from_str(&json)?;
        Ok(Some(session))
    }

    /// Delete manager session
    pub fn delete_manager_session() -> Result<(), Box<dyn Error>> {
        let path = Self::get_storage_path("manager_session");
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }

    /// Check if device is registered
    pub fn is_device_registered() -> bool {
        match Self::get_device_registration() {
            Ok(Some(_)) => true,
            _ => false,
        }
    }

    /// Check if manager session exists and is valid
    pub fn has_valid_manager_session() -> bool {
        match Self::get_manager_session() {
            Ok(Some(session)) => {
                let now = chrono::Utc::now().timestamp();
                session.expires_at > now
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_registration_storage() {
        let registration = DeviceRegistration {
            device_id: "test-device-123".to_string(),
            device_name: "Test POS Terminal".to_string(),
            tenant_id: "test-tenant".to_string(),
            tenant_name: "Test Restaurant".to_string(),
            registered_at: chrono::Utc::now().timestamp(),
        };

        // Store
        SecureStorage::store_device_registration(&registration).unwrap();

        // Retrieve
        let retrieved = SecureStorage::get_device_registration().unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().device_id, "test-device-123");

        // Cleanup
        SecureStorage::delete_device_registration().unwrap();
    }
}

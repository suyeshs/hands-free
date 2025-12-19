use crate::network::AuthWorkerClient;
use crate::storage::{DeviceRegistration, ManagerSession, SecureStorage};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Response for device registration check
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceStatusResponse {
    pub is_registered: bool,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub tenant_id: Option<String>,
    pub tenant_name: Option<String>,
}

/// Response for login start
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartLoginResponse {
    pub success: bool,
    pub verification_sid: Option<String>,
    pub error: Option<String>,
}

/// Response for login verify
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerifyLoginResponse {
    pub success: bool,
    pub requires_totp: bool,
    pub temp_token: Option<String>,
    pub user_id: Option<String>,
    pub tenants: Option<Vec<TenantInfo>>,
    pub error: Option<String>,
}

/// Tenant information
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TenantInfo {
    pub tenant_id: String,
    pub company_name: String,
    pub role: String,
}

/// Response for TOTP verify
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyTotpResponse {
    pub success: bool,
    pub user_id: Option<String>,
    pub tenants: Option<Vec<TenantInfo>>,
    pub error: Option<String>,
}

/// Response for device registration
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterDeviceResponse {
    pub success: bool,
    pub device_id: String,
    pub error: Option<String>,
}

/// Check device registration status
#[tauri::command]
pub async fn check_device_registration() -> Result<DeviceStatusResponse, String> {
    match SecureStorage::get_device_registration() {
        Ok(Some(reg)) => Ok(DeviceStatusResponse {
            is_registered: true,
            device_id: Some(reg.device_id),
            device_name: Some(reg.device_name),
            tenant_id: Some(reg.tenant_id),
            tenant_name: Some(reg.tenant_name),
        }),
        Ok(None) => Ok(DeviceStatusResponse {
            is_registered: false,
            device_id: None,
            device_name: None,
            tenant_id: None,
            tenant_name: None,
        }),
        Err(e) => Err(format!("Failed to check device registration: {}", e)),
    }
}

/// Start manager login (phone verification)
#[tauri::command]
pub async fn manager_login_start(phone: String) -> Result<StartLoginResponse, String> {
    // Get tenant ID from device registration
    let registration = SecureStorage::get_device_registration()
        .map_err(|e| format!("Failed to get device registration: {}", e))?
        .ok_or_else(|| "Device not registered".to_string())?;

    let client = AuthWorkerClient::new();
    match client.login_start(&phone, &registration.tenant_id).await {
        Ok(response) => Ok(StartLoginResponse {
            success: response.success,
            verification_sid: response.verification_sid,
            error: response.error,
        }),
        Err(e) => Err(format!("Login start failed: {}", e)),
    }
}

/// Verify phone code
#[tauri::command]
pub async fn manager_login_verify(
    phone: String,
    code: String,
    verification_sid: String,
) -> Result<VerifyLoginResponse, String> {
    // Get tenant ID from device registration
    let registration = SecureStorage::get_device_registration()
        .map_err(|e| format!("Failed to get device registration: {}", e))?
        .ok_or_else(|| "Device not registered".to_string())?;

    println!("[Auth] Verifying login: phone={}, code={}, sid={}, tenant={}",
             phone, code, verification_sid, registration.tenant_id);

    let client = AuthWorkerClient::new();
    match client.login_verify(&phone, &code, &verification_sid, &registration.tenant_id).await {
        Ok(response) => {
            println!("[Auth] Auth worker response - success: {}, totp_required: {:?}, error: {:?}",
                     response.success, response.totp_required, response.error);

            if response.success {
                // Check if TOTP is required
                if response.totp_required.unwrap_or(false) {
                    return Ok(VerifyLoginResponse {
                        success: true,
                        requires_totp: true,
                        temp_token: response.temp_access_token,
                        user_id: None,
                        tenants: None,
                        error: None,
                    });
                }

                // Check if we have all required fields
                let has_user = response.user.is_some();
                let has_access_token = response.access_token.is_some();
                let has_refresh_token = response.refresh_token.is_some();

                println!("[Auth] Has user: {}, Has access_token: {}, Has refresh_token: {}",
                         has_user, has_access_token, has_refresh_token);

                if let (Some(user), Some(access_token), Some(refresh_token)) =
                    (response.user, response.access_token, response.refresh_token) {

                    // Calculate expiration (24 hours from now, matching ACCESS_TOKEN_TTL)
                    let expires_at = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64 + 86400; // 24 hours

                    let session = ManagerSession {
                        user_id: user.id.clone(),
                        tenant_id: registration.tenant_id.clone(),
                        access_token,
                        refresh_token,
                        expires_at,
                    };

                    SecureStorage::store_manager_session(&session)
                        .map_err(|e| format!("Failed to store session: {}", e))?;

                    let tenants: Vec<TenantInfo> = user
                        .tenants
                        .into_iter()
                        .map(|t| TenantInfo {
                            tenant_id: t.tenant_id,
                            company_name: t.company_name,
                            role: t.role,
                        })
                        .collect();

                    println!("[Auth] Session stored successfully for user: {}", user.id);

                    Ok(VerifyLoginResponse {
                        success: true,
                        requires_totp: false,
                        temp_token: None,
                        user_id: Some(user.id),
                        tenants: Some(tenants),
                        error: None,
                    })
                } else {
                    println!("[Auth] Missing required fields - user: {}, access_token: {}, refresh_token: {}",
                             has_user, has_access_token, has_refresh_token);
                    Err("Invalid response from auth worker - missing user or tokens".to_string())
                }
            } else {
                Ok(VerifyLoginResponse {
                    success: false,
                    requires_totp: false,
                    temp_token: None,
                    user_id: None,
                    tenants: None,
                    error: response.error,
                })
            }
        }
        Err(e) => Err(format!("Login verify failed: {}", e)),
    }
}

/// Verify TOTP code
#[tauri::command]
pub async fn manager_totp_verify(
    totp_code: String,
    temp_token: String,
) -> Result<VerifyTotpResponse, String> {
    let registration = SecureStorage::get_device_registration()
        .map_err(|e| format!("Failed to get device registration: {}", e))?
        .ok_or_else(|| "Device not registered".to_string())?;

    let client = AuthWorkerClient::new();
    match client.totp_verify(&totp_code, &temp_token).await {
        Ok(response) => {
            if response.success {
                if let (Some(user), Some(access_token), Some(refresh_token)) =
                    (response.user, response.access_token, response.refresh_token) {

                    // Calculate expiration (24 hours from now)
                    let expires_at = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64 + 86400;

                    let session = ManagerSession {
                        user_id: user.id.clone(),
                        tenant_id: registration.tenant_id.clone(),
                        access_token,
                        refresh_token,
                        expires_at,
                    };

                    SecureStorage::store_manager_session(&session)
                        .map_err(|e| format!("Failed to store session: {}", e))?;

                    let tenants: Vec<TenantInfo> = user
                        .tenants
                        .into_iter()
                        .map(|t| TenantInfo {
                            tenant_id: t.tenant_id,
                            company_name: t.company_name,
                            role: t.role,
                        })
                        .collect();

                    Ok(VerifyTotpResponse {
                        success: true,
                        user_id: Some(user.id),
                        tenants: Some(tenants),
                        error: None,
                    })
                } else {
                    Err("Invalid response from auth worker - missing user or tokens".to_string())
                }
            } else {
                Ok(VerifyTotpResponse {
                    success: false,
                    user_id: None,
                    tenants: None,
                    error: response.error,
                })
            }
        }
        Err(e) => Err(format!("TOTP verify failed: {}", e)),
    }
}

/// Register device (setup wizard completion)
#[tauri::command]
pub async fn register_device(
    device_name: String,
    tenant_id: String,
    tenant_name: String,
) -> Result<RegisterDeviceResponse, String> {
    let device_id = Uuid::new_v4().to_string();
    let registered_at = chrono::Utc::now().timestamp();

    let registration = DeviceRegistration {
        device_id: device_id.clone(),
        device_name,
        tenant_id,
        tenant_name,
        registered_at,
    };

    match SecureStorage::store_device_registration(&registration) {
        Ok(_) => Ok(RegisterDeviceResponse {
            success: true,
            device_id,
            error: None,
        }),
        Err(e) => Err(format!("Failed to register device: {}", e)),
    }
}

/// Manager logout
#[tauri::command]
pub async fn manager_logout() -> Result<(), String> {
    SecureStorage::delete_manager_session()
        .map_err(|e| format!("Failed to logout: {}", e))?;
    Ok(())
}

/// Check if manager is authenticated
#[tauri::command]
pub async fn check_manager_auth() -> Result<bool, String> {
    Ok(SecureStorage::has_valid_manager_session())
}

/// Get current manager session info
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagerSessionInfo {
    pub user_id: String,
    pub tenant_id: String,
    pub expires_at: i64,
}

#[tauri::command]
pub async fn get_manager_session() -> Result<Option<ManagerSessionInfo>, String> {
    match SecureStorage::get_manager_session() {
        Ok(Some(session)) => Ok(Some(ManagerSessionInfo {
            user_id: session.user_id,
            tenant_id: session.tenant_id,
            expires_at: session.expires_at,
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to get session: {}", e)),
    }
}

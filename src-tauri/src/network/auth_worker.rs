use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use obfstr::obfstr;

/// Get the auth worker URL (encrypted at compile time)
fn get_auth_worker_url() -> String {
    obfstr!("https://auth.handsfree.tech").to_string()
}

/// Login start request
#[derive(Debug, Serialize)]
struct LoginStartRequest {
    #[serde(rename = "phoneNumber")]
    phone_number: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
}

/// Login start response
#[derive(Debug, Deserialize)]
pub struct LoginStartResponse {
    pub success: bool,
    #[serde(rename = "verificationSid")]
    pub verification_sid: Option<String>,
    pub error: Option<String>,
}

/// Login verify request
#[derive(Debug, Serialize)]
struct LoginVerifyRequest {
    #[serde(rename = "phoneNumber")]
    phone_number: String,
    code: String,
    #[serde(rename = "verificationSid")]
    verification_sid: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
}

/// User data from auth worker
#[derive(Debug, Deserialize, Clone)]
pub struct AuthUser {
    pub id: String,
    #[serde(rename = "currentTenantId")]
    pub current_tenant_id: String,
    #[serde(rename = "currentRole")]
    pub current_role: Option<String>,
    pub tenants: Vec<TenantAccess>,
}

/// Tenant access info
#[derive(Debug, Deserialize, Clone)]
pub struct TenantAccess {
    #[serde(rename = "tenantId")]
    pub tenant_id: String,
    #[serde(rename = "companyName")]
    pub company_name: String,
    pub role: String,
}

/// Login verify response
#[derive(Debug, Deserialize)]
pub struct LoginVerifyResponse {
    pub success: bool,
    pub user: Option<AuthUser>,
    // Tokens are returned as top-level fields, not nested
    #[serde(rename = "accessToken")]
    pub access_token: Option<String>,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
    // TOTP-related fields
    #[serde(rename = "totpRequired")]
    pub totp_required: Option<bool>,
    #[serde(rename = "tempAccessToken")]
    pub temp_access_token: Option<String>,
    pub error: Option<String>,
}

/// Auth tokens from login
#[derive(Debug, Deserialize, Clone)]
pub struct AuthTokens {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
}

/// TOTP verify request
#[derive(Debug, Serialize)]
struct TotpVerifyRequest {
    token: String, // Auth worker expects "token", not "code"
    #[serde(rename = "tempAccessToken")]
    temp_access_token: String,
}

/// TOTP verify response
#[derive(Debug, Deserialize)]
pub struct TotpVerifyResponse {
    pub success: bool,
    pub user: Option<AuthUser>,
    // Tokens are returned as top-level fields, not nested
    #[serde(rename = "accessToken")]
    pub access_token: Option<String>,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
    pub error: Option<String>,
}

/// Session check response
#[derive(Debug, Deserialize)]
pub struct SessionResponse {
    pub authenticated: bool,
    pub user: Option<AuthUser>,
}

/// Auth worker client
pub struct AuthWorkerClient {
    client: Client,
    base_url: String,
}

impl AuthWorkerClient {
    /// Create a new auth worker client
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: get_auth_worker_url(),
        }
    }

    /// Start phone verification
    pub async fn login_start(
        &self,
        phone_number: &str,
        tenant_id: &str,
    ) -> Result<LoginStartResponse, Box<dyn Error>> {
        let url = format!("{}/auth/login/start", self.base_url);
        let request = LoginStartRequest {
            phone_number: phone_number.to_string(),
            tenant_id: tenant_id.to_string(),
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Login start failed: {}", error_text).into());
        }

        let result: LoginStartResponse = response.json().await?;
        Ok(result)
    }

    /// Verify phone code
    pub async fn login_verify(
        &self,
        phone_number: &str,
        code: &str,
        verification_sid: &str,
        tenant_id: &str,
    ) -> Result<LoginVerifyResponse, Box<dyn Error>> {
        let url = format!("{}/auth/login/verify", self.base_url);
        let request = LoginVerifyRequest {
            phone_number: phone_number.to_string(),
            code: code.to_string(),
            verification_sid: verification_sid.to_string(),
            tenant_id: tenant_id.to_string(),
        };

        println!("[AuthWorker] POST {}", url);
        println!("[AuthWorker] Request: phone={}, code={}, sid={}, tenant={}",
                 phone_number, code, verification_sid, tenant_id);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        println!("[AuthWorker] Response status: {}", status);

        if !status.is_success() {
            let error_text = response.text().await?;
            println!("[AuthWorker] Error response: {}", error_text);
            return Err(format!("Login verify failed ({}): {}", status, error_text).into());
        }

        let result: LoginVerifyResponse = response.json().await?;
        println!("[AuthWorker] Success response");
        Ok(result)
    }

    /// Verify TOTP code
    pub async fn totp_verify(
        &self,
        code: &str,
        temp_token: &str,
    ) -> Result<TotpVerifyResponse, Box<dyn Error>> {
        let url = format!("{}/auth/totp/verify", self.base_url);
        let request = TotpVerifyRequest {
            token: code.to_string(),
            temp_access_token: temp_token.to_string(),
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("TOTP verify failed: {}", error_text).into());
        }

        let result: TotpVerifyResponse = response.json().await?;
        Ok(result)
    }

    /// Check session with access token
    pub async fn check_session(&self, access_token: &str) -> Result<SessionResponse, Box<dyn Error>> {
        let url = format!("{}/auth/session", self.base_url);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(SessionResponse {
                authenticated: false,
                user: None,
            });
        }

        let result: SessionResponse = response.json().await?;
        Ok(result)
    }

    /// Logout (invalidate session)
    pub async fn logout(&self, access_token: &str) -> Result<(), Box<dyn Error>> {
        let url = format!("{}/auth/logout", self.base_url);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Logout failed: {}", error_text).into());
        }

        Ok(())
    }
}

impl Default for AuthWorkerClient {
    fn default() -> Self {
        Self::new()
    }
}

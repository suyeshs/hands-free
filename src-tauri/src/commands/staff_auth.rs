use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use password_hash::rand_core::OsRng;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Staff user model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StaffUser {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub role: String,
    pub is_active: bool,
    pub permissions: Vec<String>,
    pub created_at: i64,
    pub last_login_at: Option<i64>,
}

/// Staff session (in-memory only, not persisted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffSession {
    pub staff_id: String,
    pub tenant_id: String,
    pub name: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub logged_in_at: i64,
}

/// Global staff session state (in-memory)
pub struct StaffSessionState {
    pub current_session: Option<StaffSession>,
    pub failed_attempts: HashMap<String, (u32, i64)>, // (attempts, lockout_until)
}

impl StaffSessionState {
    pub fn new() -> Self {
        Self {
            current_session: None,
            failed_attempts: HashMap::new(),
        }
    }
}

/// Get current timestamp
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Hash PIN using Argon2id
#[tauri::command]
pub fn hash_staff_pin(pin: String) -> Result<String, String> {
    if !is_valid_pin(&pin) {
        return Err("Invalid PIN. Must be 4-6 digits".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash PIN: {}", e))?;

    Ok(password_hash.to_string())
}

/// Verify PIN against stored hash (constant-time comparison)
#[tauri::command]
pub fn verify_staff_pin(pin: String, pin_hash: String) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(&pin_hash)
        .map_err(|e| format!("Invalid PIN hash format: {}", e))?;

    let argon2 = Argon2::default();
    Ok(argon2.verify_password(pin.as_bytes(), &parsed_hash).is_ok())
}

/// Validate PIN format (4-6 digits)
#[tauri::command]
pub fn is_valid_pin(pin: &str) -> bool {
    pin.len() >= 4 && pin.len() <= 6 && pin.chars().all(|c| c.is_ascii_digit())
}

/// Check rate limiting for staff login
#[tauri::command]
pub fn check_staff_login_rate_limit(
    staff_name: String,
    session_state: State<'_, Mutex<StaffSessionState>>,
) -> Result<(), String> {
    let state = session_state.lock().unwrap();
    let current_time = now();

    if let Some((attempts, lockout_until)) = state.failed_attempts.get(&staff_name) {
        if *lockout_until > current_time {
            let remaining = *lockout_until - current_time;
            return Err(format!("Too many failed attempts. Try again in {} seconds", remaining));
        }
    }

    Ok(())
}

/// Record failed login attempt
#[tauri::command]
pub fn record_failed_login_attempt(
    staff_name: String,
    session_state: State<'_, Mutex<StaffSessionState>>,
) -> Result<(), String> {
    let mut state = session_state.lock().unwrap();
    let current_time = now();

    let entry = state.failed_attempts.entry(staff_name).or_insert((0, 0));
    entry.0 += 1;
    if entry.0 >= 3 {
        entry.1 = current_time + 30; // 30 second lockout
    }

    Ok(())
}

/// Clear failed login attempts (after successful login)
#[tauri::command]
pub fn clear_failed_login_attempts(
    staff_name: String,
    session_state: State<'_, Mutex<StaffSessionState>>,
) -> Result<(), String> {
    let mut state = session_state.lock().unwrap();
    state.failed_attempts.remove(&staff_name);
    Ok(())
}

/// Set staff session (after successful login)
#[tauri::command]
pub fn set_staff_session(
    staff_user: StaffUser,
    session_state: State<'_, Mutex<StaffSessionState>>,
) -> Result<(), String> {
    let mut state = session_state.lock().unwrap();
    let current_time = now();

    let session = StaffSession {
        staff_id: staff_user.id,
        tenant_id: staff_user.tenant_id,
        name: staff_user.name,
        role: staff_user.role,
        permissions: staff_user.permissions,
        logged_in_at: current_time,
    };

    state.current_session = Some(session);
    Ok(())
}

/// Staff logout
#[tauri::command]
pub fn staff_logout(session_state: State<'_, Mutex<StaffSessionState>>) -> Result<(), String> {
    let mut state = session_state.lock().unwrap();
    state.current_session = None;
    Ok(())
}

/// Get current staff session
#[tauri::command]
pub fn get_staff_session(session_state: State<'_, Mutex<StaffSessionState>>) -> Result<Option<StaffSession>, String> {
    let state = session_state.lock().unwrap();
    Ok(state.current_session.clone())
}

/// Check if staff is authenticated
#[tauri::command]
pub fn is_staff_authenticated(session_state: State<'_, Mutex<StaffSessionState>>) -> Result<bool, String> {
    let state = session_state.lock().unwrap();
    Ok(state.current_session.is_some())
}

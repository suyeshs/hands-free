/**
 * Cloudflare Tunnel Management
 *
 * Commands for starting/stopping cloudflared tunnels
 * to expose local ordering server to the internet
 */

use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter};
use std::io::{BufRead, BufReader};
use std::thread;

// Global state for tunnel process
static TUNNEL_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static TUNNEL_URL: Mutex<Option<String>> = Mutex::new(None);
static TUNNEL_TYPE: Mutex<Option<String>> = Mutex::new(None); // "quick" or "named"

/// Start named cloudflared tunnel with credentials
#[tauri::command]
pub async fn start_named_tunnel(
    app_handle: AppHandle,
    tunnel_name: String,
    credentials_json: String,
    tunnel_url: String,
) -> Result<String, String> {
    println!("[Tunnel] Starting named tunnel: {}", tunnel_name);

    // Check if tunnel is already running
    {
        let process_guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;
        if process_guard.is_some() {
            return Err("Tunnel is already running".to_string());
        }
    }

    #[cfg(target_os = "android")]
    return Err("Tunnels are not supported on Android".to_string());

    #[cfg(not(target_os = "android"))]
    {
    // Get cloudflared binary path
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let binary_name = "cloudflared-darwin-arm64";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let binary_name = "cloudflared-darwin-amd64";
    #[cfg(target_os = "windows")]
    let binary_name = "cloudflared-windows-amd64.exe";
    #[cfg(target_os = "linux")]
    let binary_name = "cloudflared-linux-amd64";

    let cloudflared_path = resource_dir.join("cloudflared").join(binary_name);

    if !cloudflared_path.exists() {
        return Err(format!("Cloudflared binary not found at: {:?}", cloudflared_path));
    }

    // Make executable (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&cloudflared_path)
            .map_err(|e| format!("Failed to read binary metadata: {}", e))?;
        let mut perms = metadata.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&cloudflared_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    // Save credentials to temporary file
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let credentials_path = app_data_dir.join("tunnel_credentials.json");
    std::fs::write(&credentials_path, credentials_json)
        .map_err(|e| format!("Failed to write credentials: {}", e))?;

    // Start named tunnel
    let mut child = Command::new(&cloudflared_path)
        .args(&[
            "tunnel",
            "--credentials-file", &credentials_path.to_string_lossy(),
            "run",
            &tunnel_name
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start tunnel: {}", e))?;

    // Capture stdout for logging
    let stdout = child.stdout.take();
    if let Some(stdout) = stdout {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    println!("[Tunnel] {}", line);
                }
            }
        });
    }

    // Store process handle
    {
        let mut process_guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;
        *process_guard = Some(child);
    }

    // Store URL (it's deterministic for named tunnels)
    {
        let mut url_guard = TUNNEL_URL.lock().map_err(|e| e.to_string())?;
        *url_guard = Some(tunnel_url.clone());
    }

    // Store type
    {
        let mut type_guard = TUNNEL_TYPE.lock().map_err(|e| e.to_string())?;
        *type_guard = Some("named".to_string());
    }

    println!("[Tunnel] ✅ Named tunnel started: {}", tunnel_url);

    // Emit event to frontend
    let _ = app_handle.emit("tunnel-url-ready", tunnel_url.clone());

    Ok(tunnel_url)
    }
}

/// Start cloudflared tunnel (Quick Tunnel mode - no auth needed - FALLBACK)
#[tauri::command]
pub async fn start_cloudflare_tunnel(app_handle: AppHandle) -> Result<String, String> {
    println!("[Tunnel] Starting cloudflared tunnel...");

    // Check if tunnel is already running
    {
        let process_guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;
        if process_guard.is_some() {
            return Err("Tunnel is already running".to_string());
        }
    }

    // Android doesn't support cloudflared tunnels
    #[cfg(target_os = "android")]
    return Err("Tunnels are not supported on Android".to_string());

    #[cfg(not(target_os = "android"))]
    {
    // Get cloudflared binary path
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    // Select binary based on platform and architecture
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let binary_name = "cloudflared-darwin-arm64";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let binary_name = "cloudflared-darwin-amd64";

    #[cfg(target_os = "windows")]
    let binary_name = "cloudflared-windows-amd64.exe";

    #[cfg(target_os = "linux")]
    let binary_name = "cloudflared-linux-amd64";

    let cloudflared_path = resource_dir.join("cloudflared").join(binary_name);

    println!("[Tunnel] Using binary: {:?}", cloudflared_path);

    // Verify binary exists
    if !cloudflared_path.exists() {
        return Err(format!(
            "Cloudflared binary not found at: {:?}",
            cloudflared_path
        ));
    }

    // Make executable (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&cloudflared_path)
            .map_err(|e| format!("Failed to read binary metadata: {}", e))?;
        let mut perms = metadata.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&cloudflared_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    // Start tunnel with Quick Tunnels (no account needed!)
    let mut child = Command::new(&cloudflared_path)
        .args(&[
            "tunnel",
            "--url", "http://localhost:3000",
            "--loglevel", "info"
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start tunnel: {}", e))?;

    // Capture stdout to extract tunnel URL
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture stdout".to_string())?;

    let app_handle_clone = app_handle.clone();

    // Spawn thread to read output and extract URL
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                println!("[Tunnel] {}", line);

                // Look for tunnel URL in output
                // cloudflared prints: "Your quick Tunnel: https://random-name.trycloudflare.com"
                if line.contains("https://") && line.contains("trycloudflare.com") {
                    if let Some(url_start) = line.find("https://") {
                        let url = line[url_start..]
                            .split_whitespace()
                            .next()
                            .unwrap_or("")
                            .to_string();

                        if !url.is_empty() {
                            println!("[Tunnel] ✅ Tunnel URL extracted: {}", url);

                            // Store URL in global state
                            if let Ok(mut tunnel_url) = TUNNEL_URL.lock() {
                                *tunnel_url = Some(url.clone());
                            }

                            // Store type as quick
                            if let Ok(mut type_guard) = TUNNEL_TYPE.lock() {
                                *type_guard = Some("quick".to_string());
                            }

                            // Emit event to frontend
                            let _ = app_handle_clone.emit("tunnel-url-ready", url);
                        }
                    }
                }
            }
        }
    });

    // Store process handle
    {
        let mut process_guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;
        *process_guard = Some(child);
    }

    println!("[Tunnel] Tunnel process started, waiting for URL...");

    Ok("Tunnel starting... URL will be available soon".to_string())
    }
}

/// Get current tunnel URL (if available)
#[tauri::command]
pub async fn get_tunnel_url() -> Result<String, String> {
    let tunnel_url = TUNNEL_URL.lock().map_err(|e| e.to_string())?;

    tunnel_url
        .clone()
        .ok_or_else(|| "Tunnel URL not available yet".to_string())
}

/// Stop cloudflared tunnel
#[tauri::command]
pub async fn stop_cloudflare_tunnel() -> Result<(), String> {
    println!("[Tunnel] Stopping cloudflared tunnel...");

    let mut process_guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = process_guard.take() {
        child.kill().map_err(|e| format!("Failed to kill tunnel process: {}", e))?;
        println!("[Tunnel] ✅ Tunnel stopped");

        // Clear URL
        if let Ok(mut tunnel_url) = TUNNEL_URL.lock() {
            *tunnel_url = None;
        }

        Ok(())
    } else {
        Err("No tunnel is running".to_string())
    }
}

/// Check if tunnel is running
#[tauri::command]
pub async fn is_tunnel_running() -> Result<bool, String> {
    let process_guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;
    Ok(process_guard.is_some())
}

/// Restart tunnel (stop then start)
#[tauri::command]
pub async fn restart_tunnel(app_handle: AppHandle) -> Result<String, String> {
    println!("[Tunnel] Restarting tunnel...");

    // Stop existing tunnel (ignore errors)
    let _ = stop_cloudflare_tunnel().await;

    // Wait a bit for cleanup
    std::thread::sleep(std::time::Duration::from_secs(1));

    // Start new tunnel
    start_cloudflare_tunnel(app_handle).await
}

/// Enhanced tunnel health check with actual connectivity test
#[tauri::command]
pub async fn check_tunnel_health() -> Result<TunnelHealthStatus, String> {
    // 1. Check if process is running
    let process_running = {
        let guard = TUNNEL_PROCESS.lock().map_err(|e| e.to_string())?;
        guard.is_some()
    };

    if !process_running {
        return Ok(TunnelHealthStatus {
            status: "offline".to_string(),
            message: "Tunnel process not running".to_string(),
            uptime_seconds: 0,
        });
    }

    // 2. Check if we have a URL
    let url = {
        let guard = TUNNEL_URL.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let Some(tunnel_url) = url else {
        return Ok(TunnelHealthStatus {
            status: "starting".to_string(),
            message: "Waiting for tunnel URL...".to_string(),
            uptime_seconds: 0,
        });
    };

    // 3. Try to reach the tunnel endpoint
    let health_url = format!("{}/health", tunnel_url);
    match reqwest::get(&health_url).await {
        Ok(response) if response.status().is_success() => {
            Ok(TunnelHealthStatus {
                status: "healthy".to_string(),
                message: format!("Tunnel active: {}", tunnel_url),
                uptime_seconds: 0,
            })
        },
        Ok(response) => {
            Ok(TunnelHealthStatus {
                status: "degraded".to_string(),
                message: format!("Tunnel responding with status: {}", response.status()),
                uptime_seconds: 0,
            })
        },
        Err(e) => {
            Ok(TunnelHealthStatus {
                status: "unhealthy".to_string(),
                message: format!("Cannot reach tunnel: {}", e),
                uptime_seconds: 0,
            })
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct TunnelHealthStatus {
    pub status: String,
    pub message: String,
    pub uptime_seconds: u64,
}

/// Watchdog that monitors tunnel health and auto-restarts
pub async fn start_tunnel_watchdog(app_handle: AppHandle) {
    use tokio::time::{interval, Duration};

    let mut check_interval = interval(Duration::from_secs(30));
    let mut consecutive_failures = 0;
    const MAX_FAILURES: u32 = 3;

    println!("[Watchdog] Starting tunnel health monitor...");

    loop {
        check_interval.tick().await;

        // Check if process is still alive
        let is_alive = {
            let guard = TUNNEL_PROCESS.lock().unwrap();
            guard.is_some()
        };

        if !is_alive {
            consecutive_failures += 1;
            println!("[Watchdog] Tunnel process died! Failure count: {}/{}", consecutive_failures, MAX_FAILURES);

            if consecutive_failures < MAX_FAILURES {
                println!("[Watchdog] Attempting restart...");

                tokio::time::sleep(Duration::from_secs(2)).await;

                // Attempt restart
                match start_cloudflare_tunnel(app_handle.clone()).await {
                    Ok(_) => {
                        println!("[Watchdog] ✅ Tunnel restarted successfully");
                        consecutive_failures = 0;

                        // Notify frontend
                        let _ = app_handle.emit("tunnel-restarted", ());
                    },
                    Err(e) => {
                        eprintln!("[Watchdog] ❌ Failed to restart: {}", e);
                        let _ = app_handle.emit("tunnel-failed", format!("Restart failed: {}", e));
                    }
                }
            } else {
                eprintln!("[Watchdog] ❌ Max restart attempts reached. Manual intervention needed.");
                let _ = app_handle.emit("tunnel-critical-failure",
                    "Tunnel has failed multiple times. Please check your internet connection.");

                // Reset counter after 5 minutes
                tokio::time::sleep(Duration::from_secs(300)).await;
                consecutive_failures = 0;
            }
        } else if consecutive_failures > 0 {
            consecutive_failures = 0;
        }
    }
}

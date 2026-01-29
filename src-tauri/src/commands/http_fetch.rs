use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

/// Fetch HTTP request and return full response with body
/// This bypasses the Tauri HTTP plugin's buggy Response object
#[command]
pub async fn http_fetch(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<Vec<u8>>,
) -> Result<HttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let method = method.unwrap_or_else(|| "GET".to_string());
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("Invalid HTTP method: {}", e))?;

    let mut request = client.request(method, &url);

    // Add headers
    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }

    // Add body if present
    if let Some(body) = body {
        request = request.body(body);
    }

    // Execute request
    let response = request
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    // Extract status
    let status = response.status().as_u16();

    // Extract headers
    let mut response_headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(value_str) = value.to_str() {
            response_headers.insert(key.to_string(), value_str.to_string());
        }
    }

    // Extract body
    let body = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?
        .to_vec();

    Ok(HttpResponse {
        status,
        headers: response_headers,
        body,
    })
}

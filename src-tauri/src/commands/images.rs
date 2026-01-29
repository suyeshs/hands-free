use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudflareUploadResponse {
    pub success: bool,
    pub cloudflare_id: Option<String>,
    pub image_url: Option<String>,
    pub error: Option<String>,
}

// Cloudflare Images configuration
const CLOUDFLARE_ACCOUNT_ID: &str = "0f3287b287060e3215662501ee96292e";
const CLOUDFLARE_API_TOKEN: &str = "PEjPQStb94cuLh-Wor0yG59NCLE5WS6Js5DrBsfi";
const CLOUDFLARE_IMAGE_BASE_URL: &str = "https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A";

/// Upload an image file to Cloudflare Images
#[tauri::command]
pub async fn upload_image_to_cloudflare(
    file_path: String,
    filename: String,
) -> Result<CloudflareUploadResponse, String> {
    println!("[Cloudflare Upload] Uploading file: {}", filename);

    // Read the file
    let file_data = std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Create multipart form
    let file_part = Part::bytes(file_data)
        .file_name(filename.clone())
        .mime_str("image/jpeg")
        .map_err(|e| format!("Failed to create file part: {}", e))?;

    let form = Form::new().part("file", file_part);

    // Create reqwest client
    let client = reqwest::Client::new();

    // Upload to Cloudflare Images API
    let upload_url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/images/v1",
        CLOUDFLARE_ACCOUNT_ID
    );

    let response = client
        .post(&upload_url)
        .header("Authorization", format!("Bearer {}", CLOUDFLARE_API_TOKEN))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Failed to send upload request: {}", e))?;

    let status = response.status();
    println!("[Cloudflare Upload] Response status: {}", status);

    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        println!("[Cloudflare Upload] Error response: {}", error_text);
        return Ok(CloudflareUploadResponse {
            success: false,
            cloudflare_id: None,
            image_url: None,
            error: Some(format!("Upload failed: {} - {}", status, error_text)),
        });
    }

    // Parse response
    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    println!("[Cloudflare Upload] Response: {:?}", result);

    // Extract image ID from response
    let cloudflare_id = result["result"]["id"]
        .as_str()
        .ok_or_else(|| "No image ID in response".to_string())?
        .to_string();

    let image_url = format!("{}/{}/public", CLOUDFLARE_IMAGE_BASE_URL, cloudflare_id);

    println!(
        "[Cloudflare Upload] Successfully uploaded: {}",
        cloudflare_id
    );

    Ok(CloudflareUploadResponse {
        success: true,
        cloudflare_id: Some(cloudflare_id),
        image_url: Some(image_url),
        error: None,
    })
}

/// Upload multiple images to Cloudflare Images
#[tauri::command]
pub async fn upload_images_bulk(
    file_paths: Vec<String>,
    filenames: Vec<String>,
) -> Result<Vec<CloudflareUploadResponse>, String> {
    if file_paths.len() != filenames.len() {
        return Err("File paths and filenames length mismatch".to_string());
    }

    let mut results = Vec::new();

    for (file_path, filename) in file_paths.iter().zip(filenames.iter()) {
        match upload_image_to_cloudflare(file_path.clone(), filename.clone()).await {
            Ok(response) => results.push(response),
            Err(e) => results.push(CloudflareUploadResponse {
                success: false,
                cloudflare_id: None,
                image_url: None,
                error: Some(e),
            }),
        }
    }

    Ok(results)
}

use std::env;
use std::fs;
use std::path::Path;

/// Simple XOR encryption with a compile-time key
/// This provides obfuscation against casual reverse engineering
fn xor_encrypt(data: &[u8], key: &[u8]) -> Vec<u8> {
    data.iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % key.len()])
        .collect()
}

fn main() {
    // Standard Tauri build
    tauri_build::build();

    // Only encrypt in release builds
    let profile = env::var("PROFILE").unwrap_or_default();

    if profile == "release" {
        println!("cargo:warning=Encrypting aggregator selectors for release build...");

        // Read the selectors config
        let config_path = Path::new("configs/aggregator_selectors.json");
        if config_path.exists() {
            let config_content = fs::read_to_string(config_path)
                .expect("Failed to read aggregator_selectors.json");

            // Use a compile-time encryption key (obfuscated)
            // In production, this should be derived from build environment
            let key = b"H4ndsF733P0S_S3l3ct0r_K3y_2025!";

            // Encrypt the config
            let encrypted = xor_encrypt(config_content.as_bytes(), key);

            // Write encrypted config to OUT_DIR
            let out_dir = env::var("OUT_DIR").expect("OUT_DIR not set");
            let encrypted_path = Path::new(&out_dir).join("selectors.enc");
            fs::write(&encrypted_path, &encrypted)
                .expect("Failed to write encrypted selectors");

            println!("cargo:warning=Encrypted selectors written to {:?}", encrypted_path);
        }
    }

    // Rebuild if config changes
    println!("cargo:rerun-if-changed=configs/aggregator_selectors.json");
}

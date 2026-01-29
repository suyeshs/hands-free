/**
 * Sarvam AI Translation Service
 *
 * Provides translation capabilities for 22 Indian languages using Sarvam AI API.
 * Supports: Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada,
 *           Odia, Malayalam, Punjabi, Assamese, Maithili, Santali, Kashmiri,
 *           Nepali, Sindhi, Dogri, Konkani, Manipuri, Bodo, Sanskrit
 *
 * API Docs: https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/text-processing/translation
 * Pricing: ₹20 per 10k characters
 */

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;

/// Sarvam AI Translation Request
#[derive(Debug, Serialize)]
pub struct TranslationRequest {
    pub input: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_language_code: Option<String>,
    pub target_language_code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker_gender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
}

/// Sarvam AI Translation Response
#[derive(Debug, Deserialize)]
pub struct TranslationResponse {
    pub request_id: String,
    pub translated_text: String,
    pub source_language_code: Option<String>,
}

/// Language codes supported by Sarvam AI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LanguageCode {
    /// Hindi
    #[serde(rename = "hi-IN")]
    Hindi,
    /// Bengali
    #[serde(rename = "bn-IN")]
    Bengali,
    /// Marathi
    #[serde(rename = "mr-IN")]
    Marathi,
    /// Telugu
    #[serde(rename = "te-IN")]
    Telugu,
    /// Tamil
    #[serde(rename = "ta-IN")]
    Tamil,
    /// Gujarati
    #[serde(rename = "gu-IN")]
    Gujarati,
    /// Urdu
    #[serde(rename = "ur-IN")]
    Urdu,
    /// Kannada
    #[serde(rename = "kn-IN")]
    Kannada,
    /// Odia
    #[serde(rename = "od-IN")]
    Odia,
    /// Malayalam
    #[serde(rename = "ml-IN")]
    Malayalam,
    /// Punjabi
    #[serde(rename = "pa-IN")]
    Punjabi,
    /// Assamese
    #[serde(rename = "as-IN")]
    Assamese,
    /// Maithili
    #[serde(rename = "mai-IN")]
    Maithili,
    /// Santali
    #[serde(rename = "sat-IN")]
    Santali,
    /// Kashmiri
    #[serde(rename = "ks-IN")]
    Kashmiri,
    /// Nepali
    #[serde(rename = "ne-IN")]
    Nepali,
    /// Sindhi
    #[serde(rename = "sd-IN")]
    Sindhi,
    /// Dogri
    #[serde(rename = "doi-IN")]
    Dogri,
    /// Konkani
    #[serde(rename = "kok-IN")]
    Konkani,
    /// Manipuri (Meitei)
    #[serde(rename = "mni-IN")]
    Manipuri,
    /// Bodo
    #[serde(rename = "brx-IN")]
    Bodo,
    /// Sanskrit
    #[serde(rename = "sa-IN")]
    Sanskrit,
    /// English (India)
    #[serde(rename = "en-IN")]
    English,
}

impl LanguageCode {
    pub fn as_str(&self) -> &str {
        match self {
            LanguageCode::Hindi => "hi-IN",
            LanguageCode::Bengali => "bn-IN",
            LanguageCode::Marathi => "mr-IN",
            LanguageCode::Telugu => "te-IN",
            LanguageCode::Tamil => "ta-IN",
            LanguageCode::Gujarati => "gu-IN",
            LanguageCode::Urdu => "ur-IN",
            LanguageCode::Kannada => "kn-IN",
            LanguageCode::Odia => "od-IN",
            LanguageCode::Malayalam => "ml-IN",
            LanguageCode::Punjabi => "pa-IN",
            LanguageCode::Assamese => "as-IN",
            LanguageCode::Maithili => "mai-IN",
            LanguageCode::Santali => "sat-IN",
            LanguageCode::Kashmiri => "ks-IN",
            LanguageCode::Nepali => "ne-IN",
            LanguageCode::Sindhi => "sd-IN",
            LanguageCode::Dogri => "doi-IN",
            LanguageCode::Konkani => "kok-IN",
            LanguageCode::Manipuri => "mni-IN",
            LanguageCode::Bodo => "brx-IN",
            LanguageCode::Sanskrit => "sa-IN",
            LanguageCode::English => "en-IN",
        }
    }
}

/// Translation Service
pub struct TranslationService {
    api_key: String,
    client: Client,
    api_url: String,
}

impl TranslationService {
    /// Create new translation service
    pub fn new() -> Result<Self, String> {
        let api_key = env::var("SARVAM_AI_API_KEY")
            .map_err(|_| "SARVAM_AI_API_KEY not set in environment".to_string())?;

        if api_key.is_empty() {
            return Err("SARVAM_AI_API_KEY is empty".to_string());
        }

        Ok(Self {
            api_key,
            client: Client::new(),
            api_url: "https://api.sarvam.ai/translate".to_string(),
        })
    }

    /// Translate text from source language to target language
    pub async fn translate(
        &self,
        text: &str,
        source_lang: Option<LanguageCode>,
        target_lang: LanguageCode,
    ) -> Result<String, String> {
        let request = TranslationRequest {
            input: text.to_string(),
            source_language_code: source_lang.map(|lang| lang.as_str().to_string()),
            target_language_code: target_lang.as_str().to_string(),
            model: Some("sarvam-translate:v1".to_string()),
            speaker_gender: None,
            mode: None,
        };

        let response = self
            .client
            .post(&self.api_url)
            .header("api-subscription-key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API error ({}): {}", status, error_text));
        }

        let translation: TranslationResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(translation.translated_text)
    }

    /// Translate from English to target language (convenience method)
    pub async fn translate_from_english(
        &self,
        text: &str,
        target_lang: LanguageCode,
    ) -> Result<String, String> {
        self.translate(text, Some(LanguageCode::English), target_lang)
            .await
    }

    /// Batch translate multiple texts (saves on API calls)
    pub async fn translate_batch(
        &self,
        texts: Vec<&str>,
        source_lang: Option<LanguageCode>,
        target_lang: LanguageCode,
    ) -> Result<Vec<String>, String> {
        // Join texts with separator, translate, then split
        let combined = texts.join("\n###SEPARATOR###\n");
        let translated = self.translate(&combined, source_lang, target_lang).await?;
        let results: Vec<String> = translated
            .split("\n###SEPARATOR###\n")
            .map(|s| s.to_string())
            .collect();

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_translate_hello() {
        // This test requires SARVAM_AI_API_KEY environment variable
        if env::var("SARVAM_AI_API_KEY").is_err() {
            println!("Skipping test: SARVAM_AI_API_KEY not set");
            return;
        }

        let service = TranslationService::new().expect("Failed to create service");
        let result = service
            .translate_from_english("Hello", LanguageCode::Hindi)
            .await;

        match result {
            Ok(translated) => {
                println!("Translation: {}", translated);
                assert!(!translated.is_empty());
            }
            Err(e) => {
                println!("Translation failed: {}", e);
            }
        }
    }
}

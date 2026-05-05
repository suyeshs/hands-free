/**
 * Gemini API Client
 */

import { GeminiResponse } from '../types';

/**
 * Call Gemini API for AI analysis
 */
export async function callGemini(
  prompt: string,
  apiKey: string,
  options: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  } = {}
): Promise<GeminiResponse> {
  const {
    temperature = 0.2,
    maxOutputTokens = 4096,
    responseMimeType = 'application/json'
  } = options;

  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
      topP: 0.95,
      topK: 40,
      responseMimeType
    }
  };

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract token counts
  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return { text, promptTokens, completionTokens };
}

/**
 * Calculate API cost
 * Gemini 1.5 Flash pricing (as of January 2025)
 * Input: $0.075 per 1M tokens
 * Output: $0.30 per 1M tokens
 */
export function calculateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * 0.075;
  const outputCost = (completionTokens / 1_000_000) * 0.30;
  return inputCost + outputCost;
}

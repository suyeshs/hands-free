/**
 * Cloudflare Workers AI Client
 * Uses on-platform Llama models for free, fast inference
 */

export interface WorkersAIBinding {
  run(model: string, options: any): Promise<any>;
}

export class WorkersAIClient {
  private ai: WorkersAIBinding;

  constructor(aiBinding: WorkersAIBinding) {
    this.ai = aiBinding;
  }

  /**
   * Generate text with Llama 3.1 8B Instruct Fast
   */
  async complete(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    return response.response || '';
  }

  /**
   * Generate structured JSON output with Llama
   */
  async completeJSON<T = any>(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<T> {
    const systemPrompt = `${options?.systemPrompt || ''}\n\nIMPORTANT: Your response must be valid JSON only. Do not include any text before or after the JSON.`;

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    try {
      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      });

      // Workers AI returns { response: string } format
      const responseText = result.response || JSON.stringify(result);

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to find JSON in the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from Workers AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate JSON with schema (Workers AI JSON Mode)
   */
  async completeJSONWithSchema<T = any>(
    prompt: string,
    schema: Record<string, any>,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<T> {
    const messages: Array<{ role: string; content: string }> = [];

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    try {
      // Use Workers AI JSON Mode with schema
      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        response_format: {
          type: 'json_object',
          schema,
        },
      });

      const result = response.response || '{}';

      // Parse the JSON response
      try {
        return typeof result === 'string' ? JSON.parse(result) : result;
      } catch (error) {
        // Fallback: try to extract JSON from text
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw error;
      }
    } catch (error) {
      throw new Error(
        `Workers AI JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Helper to create Workers AI client from environment
 */
export function createWorkersAIClient(env: { AI: WorkersAIBinding }): WorkersAIClient {
  if (!env.AI) {
    throw new Error('Workers AI binding not configured');
  }
  return new WorkersAIClient(env.AI);
}

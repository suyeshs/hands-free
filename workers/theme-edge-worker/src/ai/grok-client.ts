/**
 * Grok AI API Client
 * Handles communication with xAI's Grok API
 */

import type {
  GrokChatCompletionRequest,
  GrokChatCompletionResponse,
  GrokAPIError,
  GrokMessage,
  GrokTool,
} from './grok-types';

export class GrokClient {
  private apiKey: string;
  private baseURL = 'https://api.x.ai/v1';
  private defaultModel: 'grok-4' | 'grok-3' | 'grok-code-fast-1' = 'grok-4';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a chat completion with Grok
   */
  async createChatCompletion(
    request: GrokChatCompletionRequest
  ): Promise<GrokChatCompletionResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.defaultModel,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4096,
        top_p: request.top_p ?? 1,
        stream: request.stream ?? false,
        tools: request.tools,
        tool_choice: request.tool_choice,
        response_format: request.response_format,
      }),
    });

    if (!response.ok) {
      const error: GrokAPIError = await response.json();
      throw new Error(
        `Grok API error: ${error.error.message} (${response.status})`
      );
    }

    return response.json();
  }

  /**
   * Simple text completion (convenience method)
   */
  async complete(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      model?: 'grok-4' | 'grok-3' | 'grok-code-fast-1';
    }
  ): Promise<string> {
    const messages: GrokMessage[] = [];

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

    const response = await this.createChatCompletion({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const message = response.choices[0]?.message;
    if (!message?.content) {
      throw new Error('No response from Grok API');
    }

    return message.content;
  }

  /**
   * Complete with structured JSON output using JSON schema
   */
  async completeJSONWithSchema<T = any>(
    prompt: string,
    schema: {
      name: string;
      description?: string;
      schema: Record<string, any>;
    },
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      model?: 'grok-4' | 'grok-3' | 'grok-code-fast-1';
    }
  ): Promise<T> {
    const messages: GrokMessage[] = [];

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

    const response = await this.createChatCompletion({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          ...schema,
          strict: true,
        },
      },
    });

    const message = response.choices[0]?.message;
    if (!message?.content) {
      throw new Error('No response from Grok API');
    }

    try {
      return JSON.parse(message.content);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from Grok structured response: ${error instanceof Error ? error.message : 'Unknown error'}\nResponse: ${message.content}`
      );
    }
  }

  /**
   * Complete with structured JSON output (legacy method, uses basic JSON mode)
   */
  async completeJSON<T = any>(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      model?: 'grok-4' | 'grok-3' | 'grok-code-fast-1';
    }
  ): Promise<T> {
    const systemPrompt = `${options?.systemPrompt || ''}\n\nIMPORTANT: Your response must be valid JSON only. Do not include any text before or after the JSON.`;

    const responseText = await this.complete(prompt, {
      ...options,
      systemPrompt,
    });

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from Grok response: ${error instanceof Error ? error.message : 'Unknown error'}\nResponse: ${responseText}`
      );
    }
  }

  /**
   * Complete with tool calling support
   */
  async completeWithTools(
    messages: GrokMessage[],
    tools: GrokTool[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: 'grok-4' | 'grok-3' | 'grok-code-fast-1';
    }
  ): Promise<GrokChatCompletionResponse> {
    return this.createChatCompletion({
      model: options?.model || this.defaultModel,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });
  }

  /**
   * Multi-turn conversation with context
   */
  async conversationTurn(
    conversationHistory: GrokMessage[],
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: 'grok-4' | 'grok-3' | 'grok-code-fast-1';
    }
  ): Promise<{ response: string; updatedHistory: GrokMessage[] }> {
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage },
    ];

    const completion = await this.createChatCompletion({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage?.content) {
      throw new Error('No response from Grok API');
    }

    return {
      response: assistantMessage.content,
      updatedHistory: [
        ...messages,
        {
          role: 'assistant',
          content: assistantMessage.content,
        },
      ],
    };
  }

  /**
   * Validate API key
   */
  async validateAPIKey(): Promise<boolean> {
    try {
      await this.complete('Hello', {
        maxTokens: 10,
        temperature: 0,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set default model
   */
  setDefaultModel(model: 'grok-4' | 'grok-3' | 'grok-code-fast-1') {
    this.defaultModel = model;
  }

  /**
   * Get usage statistics from last response
   */
  getUsageFromResponse(response: GrokChatCompletionResponse): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    return {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }
}

/**
 * Helper to create Grok client from environment
 */
export function createGrokClient(env: { GROK_API_KEY: string }): GrokClient {
  if (!env.GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }
  return new GrokClient(env.GROK_API_KEY);
}

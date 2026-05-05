/**
 * AI Theme Generator
 * Uses Grok AI to generate complete design systems
 */

import { GrokClient } from './grok-client';
import type {
  AIThemeGenerationRequest,
  AIThemeGenerationResponse,
  AIDesignRefinementRequest,
  AIDesignRefinementResponse,
  AIAccessibilityAuditRequest,
  AIAccessibilityAuditResponse,
  AIStyleSuggestionRequest,
  AIStyleSuggestionResponse,
  AIComponentGenerationRequest,
  AIComponentGenerationResponse,
} from './grok-types';
import {
  THEME_GENERATION_SYSTEM_PROMPT,
  generateThemePrompt,
  generateRefinementPrompt,
  generateAccessibilityAuditPrompt,
  generateStyleSuggestionPrompt,
  generateComponentPrompt,
  generateColorExpansionPrompt,
} from './prompt-templates';

export class AIThemeGenerator {
  private grokClient: GrokClient;

  constructor(grokClient: GrokClient) {
    this.grokClient = grokClient;
  }

  /**
   * Generate a complete theme from natural language prompt
   */
  async generateTheme(
    request: AIThemeGenerationRequest
  ): Promise<AIThemeGenerationResponse> {
    const prompt = generateThemePrompt(request);

    try {
      // Use Grok to generate theme
      const response = await this.grokClient.complete(prompt, {
        systemPrompt: THEME_GENERATION_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 6000,
        model: 'grok-4', // Use Grok-4 for best quality
      });

      // Parse response - expecting JSON + reasoning
      const parts = response.split('\n\n');
      let themeJSON = '';
      let reasoning = '';

      // Try to extract JSON
      for (const part of parts) {
        if (part.trim().startsWith('{')) {
          themeJSON = part.trim();
          break;
        }
      }

      // Extract reasoning (everything after JSON)
      const jsonEndIndex = response.indexOf(themeJSON) + themeJSON.length;
      reasoning = response.substring(jsonEndIndex).trim();

      if (!themeJSON) {
        throw new Error('No valid JSON found in response');
      }

      // Parse and validate theme
      let theme: any;
      try {
        theme = JSON.parse(themeJSON);
      } catch (error) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          theme = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error(`Failed to parse theme JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Apply baseMeta if provided
      if (request.baseMeta) {
        theme.meta = {
          ...theme.meta,
          ...request.baseMeta,
        };
      }

      // Extract suggestions from reasoning
      const suggestions = this.extractSuggestions(reasoning);

      return {
        theme,
        reasoning: reasoning || 'Theme generated successfully.',
        suggestions,
        tokensUsed: 0, // TODO: Track token usage from response
      };
    } catch (error) {
      throw new Error(
        `Theme generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refine an existing theme based on user feedback
   */
  async refineTheme(
    request: AIDesignRefinementRequest
  ): Promise<AIDesignRefinementResponse> {
    const prompt = generateRefinementPrompt(request);

    try {
      const response = await this.grokClient.complete(prompt, {
        systemPrompt: THEME_GENERATION_SYSTEM_PROMPT,
        temperature: 0.6,
        maxTokens: 6000,
        model: 'grok-4',
      });

      // Parse response
      const parts = response.split('\n\n');
      let themeJSON = '';
      let changesText = '';
      let reasoning = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.startsWith('{') && !themeJSON) {
          themeJSON = part;
        } else if (part.toLowerCase().includes('changes:')) {
          changesText = parts.slice(i).join('\n\n');
          break;
        } else if (themeJSON && !reasoning) {
          reasoning = part;
        }
      }

      const updatedTheme = JSON.parse(themeJSON);

      // Extract changes
      const changes = this.detectChanges(request.currentTheme, updatedTheme);

      return {
        updatedTheme,
        changes,
        reasoning: reasoning || changesText || 'Theme refined successfully.',
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Theme refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Perform accessibility audit on theme
   */
  async auditAccessibility(
    request: AIAccessibilityAuditRequest
  ): Promise<AIAccessibilityAuditResponse> {
    const prompt = generateAccessibilityAuditPrompt(
      request.theme,
      request.platform,
      request.targetLevel || 'wcag-aa'
    );

    try {
      const result = await this.grokClient.completeJSON<AIAccessibilityAuditResponse>(prompt, {
        systemPrompt:
          'You are an accessibility expert. Provide detailed, actionable accessibility analysis.',
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 4000,
        model: 'grok-4',
      });

      return {
        ...result,
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Accessibility audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get style suggestions based on brand info
   */
  async suggestStyles(
    request: AIStyleSuggestionRequest
  ): Promise<AIStyleSuggestionResponse> {
    const prompt = generateStyleSuggestionPrompt(
      request.brandInfo,
      request.platform,
      request.currentTheme
    );

    try {
      const result = await this.grokClient.completeJSON<AIStyleSuggestionResponse>(prompt, {
        systemPrompt: 'You are a brand and design consultant with deep expertise in visual identity.',
        temperature: 0.8, // Higher temperature for creative suggestions
        maxTokens: 3000,
        model: 'grok-4',
      });

      return {
        ...result,
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Style suggestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate component configuration
   */
  async generateComponent(
    request: AIComponentGenerationRequest
  ): Promise<AIComponentGenerationResponse> {
    const prompt = generateComponentPrompt(
      request.componentType,
      request.description,
      request.platform,
      request.existingTheme
    );

    try {
      const result = await this.grokClient.completeJSON<{ component: any; reasoning: string }>(
        prompt,
        {
          systemPrompt: 'You are a component design expert. Create accessible, beautiful components.',
          temperature: 0.7,
          maxTokens: 3000,
          model: 'grok-4',
        }
      );

      return {
        component: result.component,
        reasoning: result.reasoning || 'Component generated successfully.',
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Component generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate color scale from single color
   */
  async generateColorScale(
    baseColor: string,
    colorName: string
  ): Promise<{ scale: Record<string, string>; reasoning: string }> {
    const prompt = generateColorExpansionPrompt(baseColor, colorName);

    try {
      const result = await this.grokClient.completeJSON<{
        scale: Record<string, string>;
        reasoning: string;
      }>(prompt, {
        systemPrompt: 'You are a color theory expert. Generate beautiful, accessible color scales.',
        temperature: 0.5,
        maxTokens: 1000,
        model: 'grok-4',
      });

      return result;
    } catch (error) {
      throw new Error(
        `Color scale generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Conversational theme refinement (multi-turn)
   */
  async conversationalRefinement(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    currentTheme: any,
    platform: string
  ): Promise<{
    response: string;
    updatedTheme?: any;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  }> {
    // Add context about current theme
    const contextMessage = `Current theme context:\n${JSON.stringify(currentTheme, null, 2)}\n\nUser message: ${userMessage}`;

    const messages = [
      {
        role: 'system' as const,
        content: `${THEME_GENERATION_SYSTEM_PROMPT}\n\nYou are having a conversation with a designer about their ${platform} theme. Help them refine and improve it based on their feedback.`,
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    try {
      const result = await this.grokClient.conversationTurn(messages, contextMessage, {
        temperature: 0.7,
        maxTokens: 2000,
        model: 'grok-4',
      });

      // Try to extract updated theme from response
      let updatedTheme: any | undefined;
      const jsonMatch = result.response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          updatedTheme = JSON.parse(jsonMatch[1]);
        } catch {
          // No theme update in this message
        }
      }

      return {
        response: result.response,
        updatedTheme,
        conversationHistory: result.updatedHistory.filter(
          (msg): msg is { role: 'user' | 'assistant'; content: string } =>
            msg.role === 'user' || msg.role === 'assistant'
        ),
      };
    } catch (error) {
      throw new Error(
        `Conversational refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Helper: Extract suggestions from reasoning text
   */
  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];

    // Look for bullet points or numbered lists
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.match(/^[-•*]\s/) ||
        trimmed.match(/^\d+\.\s/) ||
        trimmed.toLowerCase().startsWith('suggestion:') ||
        trimmed.toLowerCase().startsWith('consider:')
      ) {
        const suggestion = trimmed.replace(/^[-•*\d.]\s*/, '').replace(/^(suggestion|consider):\s*/i, '');
        if (suggestion.length > 10) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Helper: Detect changes between old and new theme
   */
  private detectChanges(oldTheme: any, newTheme: any, path = ''): Array<{
    path: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }> {
    const changes: Array<{ path: string; oldValue: any; newValue: any; reason: string }> = [];

    const compare = (old: any, updated: any, currentPath: string) => {
      if (typeof old !== typeof updated) {
        changes.push({
          path: currentPath,
          oldValue: old,
          newValue: updated,
          reason: 'Type changed',
        });
        return;
      }

      if (typeof old === 'object' && old !== null && updated !== null) {
        const allKeys = new Set([...Object.keys(old), ...Object.keys(updated)]);
        for (const key of allKeys) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          if (!(key in old)) {
            changes.push({
              path: newPath,
              oldValue: undefined,
              newValue: updated[key],
              reason: 'Added',
            });
          } else if (!(key in updated)) {
            changes.push({
              path: newPath,
              oldValue: old[key],
              newValue: undefined,
              reason: 'Removed',
            });
          } else {
            compare(old[key], updated[key], newPath);
          }
        }
      } else if (old !== updated) {
        changes.push({
          path: currentPath,
          oldValue: old,
          newValue: updated,
          reason: 'Value changed',
        });
      }
    };

    compare(oldTheme, newTheme, path);
    return changes;
  }

  /**
   * Validate API key by making a test request
   */
  async validateAPIKey(): Promise<boolean> {
    return await this.grokClient.validateAPIKey();
  }
}

/**
 * Helper to create theme generator from environment
 */
export function createThemeGenerator(env: { GROK_API_KEY: string }): AIThemeGenerator {
  const grokClient = new GrokClient(env.GROK_API_KEY);
  return new AIThemeGenerator(grokClient);
}

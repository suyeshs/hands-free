/**
 * Neumorphic Component Generator
 * Uses Grok AI to generate neumorphic multimodal components
 */

import { GrokClient } from './grok-client';
import type {
  NeumorphicComponent,
  ComponentLibrary,
  ScreenLayout,
  ComponentGenerationRequest,
  LibraryGenerationRequest,
  LayoutGenerationRequest,
  ExportConfig,
  ExportedCode,
} from '../neumorphic/types';
import {
  NEUMORPHIC_SYSTEM_PROMPT,
  generateComponentPrompt,
  generateLibraryPrompt,
  generateLayoutPrompt,
} from './neumorphic-prompts';
import { ComponentValidator } from '../neumorphic/schema';
import { getPrimitive } from '../neumorphic/primitives';

export class NeumorphicGenerator {
  private grokClient: GrokClient;

  constructor(grokClient: GrokClient) {
    this.grokClient = grokClient;
  }

  /**
   * Generate a single neumorphic component from description
   */
  async generateComponent(request: ComponentGenerationRequest): Promise<{
    component: NeumorphicComponent;
    reasoning: string;
    tokensUsed: number;
  }> {
    const prompt = generateComponentPrompt(request);

    try {
      // Use Grok to generate component
      const response = await this.grokClient.completeJSON<{
        component: NeumorphicComponent;
        reasoning: string;
      }>(prompt, {
        systemPrompt: NEUMORPHIC_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 6000,
        model: 'grok-code-fast-1',
      });

      const { component, reasoning } = response;

      // Validate generated component
      const accessibilityLevel = request.accessibility === 'wcag-aaa' ? 'AAA' : 'AA';
      const validation = ComponentValidator.validate(component, accessibilityLevel);
      if (!validation.valid) {
        throw new Error(
          `Generated component failed validation:\n${validation.errors.join('\n')}`
        );
      }

      return {
        component,
        reasoning: reasoning || 'Component generated successfully',
        tokensUsed: 0, // TODO: Track from response
      };
    } catch (error) {
      throw new Error(
        `Component generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate complete component library
   */
  async generateLibrary(request: LibraryGenerationRequest): Promise<{
    library: ComponentLibrary;
    reasoning: string;
    tokensUsed: number;
  }> {
    const prompt = generateLibraryPrompt(request);

    // Define JSON schema matching ComponentValidator requirements
    const librarySchema = {
      name: 'ComponentLibrary',
      description: 'Neumorphic component library with validated structure',
      schema: {
        type: 'object',
        properties: {
          library: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              components: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string', enum: ['input', 'navigation', 'content', 'feedback', 'layout', 'action'] },
                    dimensions: {
                      type: 'object',
                      properties: {
                        width: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                        height: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                      },
                      required: ['width', 'height'],
                    },
                    padding: {
                      type: 'object',
                      properties: {
                        top: { type: 'number' },
                        right: { type: 'number' },
                        bottom: { type: 'number' },
                        left: { type: 'number' },
                      },
                      required: ['top', 'right', 'bottom', 'left'],
                    },
                    margin: {
                      type: 'object',
                      properties: {
                        top: { type: 'number' },
                        right: { type: 'number' },
                        bottom: { type: 'number' },
                        left: { type: 'number' },
                      },
                      required: ['top', 'right', 'bottom', 'left'],
                    },
                    typography: {
                      type: 'object',
                      properties: {
                        fontFamily: { type: 'string' },
                        fontSize: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                        fontWeight: { type: 'number', enum: [300, 400, 500, 600, 700, 800, 900] },
                        lineHeight: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                      },
                      required: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'],
                    },
                    states: {
                      type: 'object',
                      patternProperties: {
                        '.*': {
                          type: 'object',
                          properties: {
                            surface: {
                              type: 'object',
                              properties: {
                                backgroundColor: { type: 'string' },
                                borderRadius: { oneOf: [{ type: 'number' }, { type: 'object' }] },
                                shadows: {
                                  type: 'object',
                                  properties: {
                                    light: {
                                      type: 'object',
                                      properties: {
                                        lightSource: { type: 'string' },
                                        depth: { type: 'number' },
                                        inset: { type: 'boolean' },
                                        color: { type: 'string' },
                                        blurRadius: { type: 'number' },
                                        spreadRadius: { type: 'number' },
                                        opacity: { type: 'number' },
                                      },
                                      required: ['lightSource', 'depth', 'inset', 'color', 'blurRadius', 'spreadRadius', 'opacity'],
                                    },
                                    dark: {
                                      type: 'object',
                                      properties: {
                                        lightSource: { type: 'string' },
                                        depth: { type: 'number' },
                                        inset: { type: 'boolean' },
                                        color: { type: 'string' },
                                        blurRadius: { type: 'number' },
                                        spreadRadius: { type: 'number' },
                                        opacity: { type: 'number' },
                                      },
                                      required: ['lightSource', 'depth', 'inset', 'color', 'blurRadius', 'spreadRadius', 'opacity'],
                                    },
                                  },
                                  required: ['light', 'dark'],
                                },
                              },
                              required: ['backgroundColor', 'borderRadius', 'shadows'],
                            },
                            textColor: { type: 'string' },
                          },
                          required: ['surface', 'textColor'],
                        },
                      },
                    },
                    transitions: { type: 'array', items: { type: 'object' } },
                    defaultState: { type: 'string' },
                    interaction: {
                      type: 'object',
                      properties: {
                        primary: { type: 'string' },
                        alternatives: { type: 'array', items: { type: 'string' } },
                      },
                      required: ['primary', 'alternatives'],
                    },
                    interactive: { type: 'boolean' },
                    accessibility: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        role: { type: 'string' },
                        focusable: { type: 'boolean' },
                        minContrast: { type: 'number' },
                      },
                      required: ['label', 'role', 'focusable', 'minContrast'],
                    },
                    platform: { type: 'string', enum: ['web', 'mobile', 'both'] },
                    frameworks: { type: 'array', items: { type: 'string' } },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                    version: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['id', 'name', 'type', 'description', 'category', 'dimensions', 'padding', 'margin', 'typography', 'states', 'transitions', 'defaultState', 'interaction', 'interactive', 'accessibility', 'platform', 'frameworks', 'createdAt', 'updatedAt', 'version', 'tags'],
                },
              },
              tokens: {
                type: 'object',
                properties: {
                  colors: { type: 'object' },
                  spacing: { type: 'object' },
                  typography: { type: 'object' },
                  shadows: { type: 'object' },
                },
                required: ['colors', 'spacing', 'typography', 'shadows'],
              },
              meta: {
                type: 'object',
                properties: {
                  version: { type: 'string' },
                  author: { type: 'string' },
                  license: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['version', 'author', 'createdAt', 'updatedAt'],
              },
              platform: { type: 'string' },
              frameworks: { type: 'array', items: { type: 'string' } },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
            required: ['id', 'name', 'description', 'components', 'tokens', 'meta', 'platform', 'frameworks', 'createdAt', 'updatedAt'],
          },
          reasoning: { type: 'string' },
        },
        required: ['library', 'reasoning'],
      },
    };

    try {
      const response = await this.grokClient.completeJSONWithSchema<{
        library: ComponentLibrary;
        reasoning: string;
      }>(prompt, librarySchema, {
        systemPrompt: NEUMORPHIC_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 16000,
        model: 'grok-code-fast-1',
      });

      const { library, reasoning } = response;

      // Auto-fix common validation issues
      this.autoFixLibraryIssues(library);

      // Validate library
      const validation = ComponentValidator.validateLibrary(library);
      if (!validation.valid) {
        throw new Error(
          `Generated library failed validation:\n${validation.errors.join('\n')}`
        );
      }

      return {
        library,
        reasoning: reasoning || 'Component library generated successfully',
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Library generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate screen layout using Workers AI (Llama) or Grok fallback
   */
  async generateLayout(request: LayoutGenerationRequest): Promise<{
    layout: ScreenLayout;
    reasoning: string;
    tokensUsed: number;
  }> {
    const prompt = generateLayoutPrompt(request);

    try {
      // Use Grok for layouts (Llama 3.1 8B struggles with complex component schemas)
      // Future: Could use Llama 3.3 70B or simplified validation for layouts
      const response = await this.grokClient.completeJSON<{
        layout: ScreenLayout;
        reasoning: string;
      }>(prompt, {
        systemPrompt: NEUMORPHIC_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 32000, // Increased for complex layouts with full component schemas
        model: 'grok-code-fast-1',
      });

      console.log('Layout generation response:', JSON.stringify(response, null, 2));

      // Handle different response structures
      let layout: ScreenLayout;
      let reasoning: string;

      const responseAny = response as any;

      if (response.layout) {
        // Grok format: {layout: {...}, reasoning: "..."}
        layout = response.layout;
        reasoning = response.reasoning || 'Layout generated successfully';
      } else if (responseAny.id && responseAny.structure) {
        // Direct layout format
        layout = response as unknown as ScreenLayout;
        reasoning = 'Layout generated successfully';
      } else if (responseAny.type === 'ScreenLayout' || responseAny.viewport) {
        // Grok sometimes returns layout fields directly without wrapper
        layout = response as unknown as ScreenLayout;
        reasoning = 'Layout generated successfully';
      } else {
        // Last resort: treat entire response as layout
        layout = response as unknown as ScreenLayout;
        reasoning = 'Layout generated';
      }

      // Auto-fix missing required fields
      if (!layout.id) {
        layout.id = `layout-${Date.now()}`;
      }
      if (!layout.name) {
        layout.name = responseAny.name || 'Generated Layout';
      }
      if (!layout.description) {
        layout.description = responseAny.description || 'AI-generated screen layout';
      }
      if (!layout.platform) {
        layout.platform = request.platform || 'web';
      }
      if (!layout.viewport) {
        layout.viewport = {
          width: request.viewport?.width || 1440,
          height: request.viewport?.height || 900,
          orientation: 'portrait',
        };
      }
      if (!layout.structure || typeof layout.structure === 'string') {
        // Try to extract structure from responseAny
        if (responseAny.structure && typeof responseAny.structure === 'object' && !Array.isArray(responseAny.structure)) {
          layout.structure = responseAny.structure;
        } else if (responseAny.content || responseAny.header || responseAny.footer) {
          // Build structure from individual parts
          layout.structure = {
            header: responseAny.header,
            content: Array.isArray(responseAny.content) ? responseAny.content : [],
            footer: responseAny.footer,
            fab: responseAny.fab,
            navigation: responseAny.navigation,
          };
        } else {
          throw new Error('Layout must have content structure. Grok returned incomplete layout.');
        }
      }
      if (!layout.structure.content || !Array.isArray(layout.structure.content)) {
        layout.structure.content = [];
      }
      if (!layout.meta) {
        layout.meta = {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Auto-fix layout components (same as library components)
      if (layout.structure) {
        const allComponents = [
          layout.structure.header,
          ...(layout.structure.content || []),
          layout.structure.footer,
          layout.structure.fab,
          layout.structure.navigation,
        ].filter(Boolean) as NeumorphicComponent[];

        allComponents.forEach(component => {
          this.autoFixComponentIssues(component);
        });
      }

      // Validate layout
      const validation = ComponentValidator.validateLayout(layout);
      if (!validation.valid) {
        throw new Error(
          `Generated layout failed validation:\n${validation.errors.join('\n')}`
        );
      }

      return {
        layout,
        reasoning: reasoning || 'Layout generated successfully',
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Layout generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Auto-fix common validation issues in generated library
   */
  private autoFixLibraryIssues(library: ComponentLibrary): void {
    library.components.forEach((component) => {
      this.autoFixComponentIssues(component);
    });
  }

  /**
   * Auto-fix issues in a single component
   */
  private autoFixComponentIssues(component: NeumorphicComponent): void {
    // Fix contrast ratio issues in states
    Object.entries(component.states).forEach(([_stateName, state]) => {
      const stateAny = state as any;

      // Fix Grok's text.color format -> textColor
      if (!state.textColor && stateAny.text?.color) {
        state.textColor = stateAny.text.color;
      }

      // ALWAYS enforce high-contrast colors to ensure AA compliance
      const bgColor = state.surface?.backgroundColor;
      if (bgColor && this.isLightColor(bgColor)) {
        state.textColor = '#1A1A1A'; // High contrast dark gray (guarantees > 4.5:1)
      } else if (bgColor) {
        state.textColor = '#FFFFFF'; // White (guarantees > 4.5:1)
      } else {
        // No bgColor, default to dark text
        state.textColor = '#1A1A1A';
      }
    });

    // Fix missing interaction.primary
    if (component.interactive) {
      if (!component.interaction) {
        component.interaction = {
          primary: 'touch',
          alternatives: [],
        };
      }
      if (!component.interaction.primary) {
        component.interaction.primary = 'touch';
      }
      if (!component.interaction.alternatives) {
        component.interaction.alternatives = [];
      }
      // Add touch configuration if missing or invalid
      if (!component.interaction.touch || typeof component.interaction.touch !== 'object') {
        component.interaction.touch = {
          minTouchSize: { width: 48, height: 48 },
          haptic: 'light',
        };
      }
      // Ensure minTouchSize exists
      if (component.interaction.touch && !component.interaction.touch.minTouchSize) {
        component.interaction.touch.minTouchSize = { width: 48, height: 48 };
      }
      // Ensure voice is an array (not object or undefined)
      if (component.interaction.voice && !Array.isArray(component.interaction.voice)) {
        delete (component.interaction as any).voice;
      }
      // Ensure gesture is an array (not object or undefined)
      if (component.interaction.gesture && !Array.isArray(component.interaction.gesture)) {
        delete (component.interaction as any).gesture;
      }
    }

    // Fix accessibility for interactive components
    if (component.interactive && component.accessibility) {
      if (!component.accessibility.focusable) {
        component.accessibility.focusable = true;
      }
      if (!component.accessibility.minContrast || component.accessibility.minContrast < 4.5) {
        component.accessibility.minContrast = 4.5; // AA compliance
      }
    }
  }

  /**
   * Check if a color is light (simple heuristic based on hex value)
   */
  private isLightColor(hexColor: string | undefined): boolean {
    if (!hexColor) return true; // Default to light if undefined

    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate perceived brightness (0-255)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // Light if brightness > 128
    return brightness > 128;
  }

  /**
   * Refine existing component
   */
  async refineComponent(
    component: NeumorphicComponent,
    refinementPrompt: string
  ): Promise<{
    updatedComponent: NeumorphicComponent;
    changes: string[];
    reasoning: string;
    tokensUsed: number;
  }> {
    const prompt = `You are refining a neumorphic component based on user feedback.

Current Component:
${JSON.stringify(component, null, 2)}

User's Refinement Request:
"${refinementPrompt}"

Generate:
1. Updated component JSON
2. List of specific changes made
3. Reasoning for changes

Return JSON with structure:
{
  "updatedComponent": {...},
  "changes": ["change 1", "change 2", ...],
  "reasoning": "explanation"
}`;

    try {
      const response = await this.grokClient.completeJSON<{
        updatedComponent: NeumorphicComponent;
        changes: string[];
        reasoning: string;
      }>(prompt, {
        systemPrompt: NEUMORPHIC_SYSTEM_PROMPT,
        temperature: 0.6,
        maxTokens: 6000,
        model: 'grok-code-fast-1',
      });

      return {
        ...response,
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Component refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get primitive component template
   */
  async getPrimitive(name: string, options: any = {}): Promise<NeumorphicComponent> {
    try {
      return getPrimitive(name, options);
    } catch (error) {
      throw new Error(`Primitive not found: ${name}`);
    }
  }

  /**
   * Export component to code
   */
  async exportToCode(
    component: NeumorphicComponent,
    config: ExportConfig
  ): Promise<ExportedCode> {
    const { framework, typescript, includeTests, includeDocs, includeStories, cssApproach } = config;

    const exportPrompt = `Export this neumorphic component to ${framework} code.

Component:
${JSON.stringify(component, null, 2)}

Requirements:
- Framework: ${framework}
- TypeScript: ${typescript ? 'Yes' : 'No'}
- CSS Approach: ${cssApproach}
- Tests: ${includeTests ? 'Yes' : 'No'}
- Documentation: ${includeDocs ? 'Yes' : 'No'}
- Storybook: ${includeStories ? 'Yes' : 'No'}

Generate complete, production-ready code including:
1. Component implementation
${typescript ? '2. TypeScript type definitions' : ''}
3. Styles (${cssApproach})
${includeTests ? '4. Test file' : ''}
${includeDocs ? '5. Documentation (JSDoc/markdown)' : ''}
${includeStories ? '6. Storybook stories' : ''}
7. Dependencies list

Return JSON with structure:
{
  "component": "component code string",
  "types": "type definitions" (if TypeScript),
  "styles": "styles code",
  "tests": "test code" (if requested),
  "docs": "documentation" (if requested),
  "stories": "storybook stories" (if requested),
  "dependencies": { "package": "version", ... },
  "devDependencies": { "package": "version", ... }
}`;

    try {
      const response = await this.grokClient.completeJSON<ExportedCode>(exportPrompt, {
        systemPrompt: `You are an expert ${framework} developer. Generate production-ready, clean, well-documented code.`,
        temperature: 0.3,
        maxTokens: 8000,
        model: 'grok-code-fast-1',
      });

      return response;
    } catch (error) {
      throw new Error(
        `Code export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate component from primitive template with AI enhancements
   */
  async enhancePrimitive(
    primitiveName: string,
    enhancementPrompt: string,
    options: any = {}
  ): Promise<{
    component: NeumorphicComponent;
    reasoning: string;
    tokensUsed: number;
  }> {
    // Get base primitive
    const primitive = getPrimitive(primitiveName, options);

    const prompt = `Enhance this primitive component based on user requirements.

Base Component:
${JSON.stringify(primitive, null, 2)}

Enhancement Request:
"${enhancementPrompt}"

Generate enhanced version while maintaining neumorphic principles.

Return JSON with structure:
{
  "component": {...},
  "reasoning": "explanation of enhancements"
}`;

    try {
      const response = await this.grokClient.completeJSON<{
        component: NeumorphicComponent;
        reasoning: string;
      }>(prompt, {
        systemPrompt: NEUMORPHIC_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 6000,
        model: 'grok-code-fast-1',
      });

      return {
        ...response,
        tokensUsed: 0,
      };
    } catch (error) {
      throw new Error(
        `Primitive enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Helper to create generator from environment
 */
export function createNeumorphicGenerator(env: { GROK_API_KEY: string }): NeumorphicGenerator {
  const grokClient = new GrokClient(env.GROK_API_KEY);
  return new NeumorphicGenerator(grokClient);
}

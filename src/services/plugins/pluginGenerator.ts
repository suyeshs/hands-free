/**
 * Plugin Generator Service
 *
 * Uses Claude API with MCP to generate WASM plugins from natural language descriptions
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PluginManifest } from '@/types/plugin';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true, // For development - move to backend in production
});

export interface PluginGenerationRequest {
  description: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  pluginType?: 'client' | 'worker' | 'hybrid';
  permissions?: string[];
}

export interface GeneratedPlugin {
  manifest: Partial<PluginManifest>;
  clientCode?: string;
  workerCode?: string;
  explanation: string;
  suggestions?: string[];
}

/**
 * System prompt for plugin generation
 */
const SYSTEM_PROMPT = `You are an expert Rust and WebAssembly developer specializing in creating plugins for the HandsFree POS system.

Your role is to help users generate WASM plugins from natural language descriptions. You should:
1. Understand the user's requirements
2. Determine if a client-side, worker-side, or hybrid plugin is needed
3. Generate clean, efficient Rust code that compiles to WASM
4. Create appropriate plugin manifests
5. Follow best practices for WASM plugins

## Plugin Types

**Client Plugin (Browser WASM)**:
- Runs in the browser
- Offline-capable
- Use for: UI logic, calculations, validations, offline features
- Technologies: wasm-bindgen, serde, web-sys

**Worker Plugin (Cloudflare Workers WASM)**:
- Runs on serverless edge
- Use for: API endpoints, database operations, heavy computations
- Technologies: Pure Rust, serde, no wasm-bindgen

**Hybrid Plugin**:
- Both client and worker components
- Use for: Full-stack features with optimal client/server split

## Code Generation Guidelines

1. **Client Plugin Structure**:
   - Use wasm-bindgen for JS interop
   - Export functions with #[wasm_bindgen]
   - Handle JSON serialization with serde
   - Include init() and destroy() functions
   - Use console logging for debugging

2. **Worker Plugin Structure**:
   - Use extern "C" functions
   - No wasm-bindgen
   - Communicate via host bindings
   - Include init(), handle_request(), destroy()
   - Handle errors gracefully

3. **Manifest Requirements**:
   - Unique plugin ID (lowercase, hyphens)
   - Semantic versioning
   - Clear description
   - Required permissions
   - Entry points

## Example Patterns

See the hello-world plugin for reference patterns.

Always explain your code generation choices and suggest improvements or additional features.`;

/**
 * Generate plugin code using Claude API
 */
export async function generatePluginWithClaude(
  request: PluginGenerationRequest
): Promise<GeneratedPlugin> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(request.conversationHistory || []),
    {
      role: 'user',
      content: `Generate a WASM plugin for HandsFree POS with the following requirements:

${request.description}

${request.pluginType ? `Plugin type: ${request.pluginType}` : 'Determine the best plugin type based on requirements'}
${request.permissions ? `Permissions: ${request.permissions.join(', ')}` : 'Suggest appropriate permissions'}

Please provide:
1. Plugin manifest (JSON)
2. Rust code for client plugin (if applicable)
3. Rust code for worker plugin (if applicable)
4. Explanation of design choices
5. Suggestions for enhancements

Format your response as JSON:
{
  "manifest": { ... },
  "clientCode": "...",
  "workerCode": "...",
  "explanation": "...",
  "suggestions": [...]
}`,
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse plugin from response');
    }

    const result = JSON.parse(jsonMatch[0]) as GeneratedPlugin;

    return result;
  } catch (error) {
    console.error('Plugin generation error:', error);
    throw new Error(`Failed to generate plugin: ${(error as Error).message}`);
  }
}

/**
 * Refine existing plugin based on feedback
 */
export async function refinePlugin(
  currentPlugin: GeneratedPlugin,
  feedback: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<GeneratedPlugin> {
  const messages = [
    ...conversationHistory,
    {
      role: 'user' as const,
      content: `Here's the current plugin:

**Manifest:**
\`\`\`json
${JSON.stringify(currentPlugin.manifest, null, 2)}
\`\`\`

${currentPlugin.clientCode ? `**Client Code:**
\`\`\`rust
${currentPlugin.clientCode}
\`\`\`
` : ''}

${currentPlugin.workerCode ? `**Worker Code:**
\`\`\`rust
${currentPlugin.workerCode}
\`\`\`
` : ''}

**Feedback:**
${feedback}

Please update the plugin based on this feedback. Provide the complete updated plugin in JSON format.`,
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse refined plugin');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Plugin refinement error:', error);
    throw new Error(`Failed to refine plugin: ${(error as Error).message}`);
  }
}

/**
 * Validate generated Rust code syntax
 */
export async function validateRustCode(code: string): Promise<{
  valid: boolean;
  errors?: string[];
}> {
  // TODO: Integrate with Rust analyzer or build service
  // For now, basic checks
  const hasMainFunction = code.includes('fn ') || code.includes('pub fn ') || code.includes('pub extern');

  if (!hasMainFunction) {
    return {
      valid: false,
      errors: ['Code must contain at least one function'],
    };
  }

  return { valid: true };
}

/**
 * Generate plugin ID from description
 */
export function generatePluginId(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
}

/**
 * Suggest permissions based on plugin code
 */
export function suggestPermissions(clientCode?: string, workerCode?: string): string[] {
  const permissions: string[] = [];

  const code = `${clientCode || ''} ${workerCode || ''}`;

  if (code.includes('db_query') || code.includes('database')) {
    permissions.push('database.read.*');
  }

  if (code.includes('db_execute') || code.includes('INSERT') || code.includes('UPDATE')) {
    permissions.push('database.write.*');
  }

  if (code.includes('storage_get') || code.includes('storage_set')) {
    permissions.push('storage.*');
  }

  if (code.includes('fetch') || code.includes('http_fetch')) {
    permissions.push('network.fetch.*');
  }

  if (code.includes('registerRoute') || code.includes('registerMenuItem')) {
    permissions.push('ui.mount.*');
  }

  return permissions.length > 0 ? permissions : ['storage.*']; // Default minimal permission
}

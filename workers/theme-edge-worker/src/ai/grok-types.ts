/**
 * Type definitions for Grok AI API
 * Reference: https://docs.x.ai/docs/models
 */

// Grok API Request/Response Types
export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GrokChatCompletionRequest {
  model: 'grok-4' | 'grok-3' | 'grok-code-fast-1';
  messages: GrokMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: GrokTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  response_format?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      description?: string;
      schema: Record<string, any>;
      strict?: boolean;
    };
  };
}

export interface GrokTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface GrokChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: GrokToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Theme Generation Request Types
export interface AIThemeGenerationRequest {
  prompt: string;
  platform: 'web' | 'shiptrack';
  constraints?: {
    primaryColor?: string;
    secondaryColor?: string;
    style?: 'modern' | 'luxury' | 'minimal' | 'vibrant' | 'professional' | 'playful';
    mood?: 'dark' | 'light' | 'elegant' | 'energetic' | 'calm';
    industry?: string;
    accessibility?: 'wcag-aa' | 'wcag-aaa';
  };
  baseTheme?: any; // Existing theme to iterate on
  baseMeta?: {
    name?: string;
    description?: string;
    author?: string;
  };
}

export interface AIThemeGenerationResponse {
  theme: any; // WebTheme or ShipTrackTheme
  reasoning: string;
  suggestions: string[];
  tokensUsed: number;
}

// Component Generation Types
export interface AIComponentGenerationRequest {
  componentType: string;
  description: string;
  platform: 'web' | 'shiptrack';
  existingTheme?: any;
}

export interface AIComponentGenerationResponse {
  component: any;
  reasoning: string;
  tokensUsed: number;
}

// Design Refinement Types
export interface AIDesignRefinementRequest {
  currentTheme: any;
  refinementPrompt: string;
  platform: 'web' | 'shiptrack';
  focus?: 'colors' | 'typography' | 'spacing' | 'components' | 'all';
}

export interface AIDesignRefinementResponse {
  updatedTheme: any;
  changes: Array<{
    path: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }>;
  reasoning: string;
  tokensUsed: number;
}

// Accessibility Audit Types
export interface AIAccessibilityAuditRequest {
  theme: any;
  platform: 'web' | 'shiptrack';
  targetLevel?: 'wcag-aa' | 'wcag-aaa';
}

export interface AIAccessibilityAuditResponse {
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: 'contrast' | 'color-blindness' | 'typography' | 'spacing';
    description: string;
    location: string;
    suggestion: string;
  }>;
  score: number; // 0-100
  fixedTheme?: any; // Auto-fixed theme if requested
  tokensUsed: number;
}

// Style Suggestions Types
export interface AIStyleSuggestionRequest {
  brandInfo?: {
    name: string;
    industry: string;
    values?: string[];
    targetAudience?: string;
  };
  platform: 'web' | 'shiptrack';
  currentTheme?: any;
}

export interface AIStyleSuggestionResponse {
  suggestions: Array<{
    name: string;
    description: string;
    reasoning: string;
    preview: {
      primaryColor: string;
      secondaryColor: string;
      style: string;
      mood: string;
    };
  }>;
  tokensUsed: number;
}

// Error Types
export interface GrokAPIError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

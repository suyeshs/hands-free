/**
 * Code Block Primitive
 * Syntax-highlighted code display with copy functionality
 */

import { HandsfreeDesignTokens } from '../design-tokens';
import type { CodeBlockConfig, CodeSnippet } from '../types';

const tokens = HandsfreeDesignTokens;

export function createCodeBlock(overrides?: Partial<CodeBlockConfig>): CodeBlockConfig {
  return {
    id: overrides?.id || 'code-block',
    name: overrides?.name || 'Code Block',
    language: overrides?.language || 'javascript',
    theme: overrides?.theme || 'dark',
    showLineNumbers: overrides?.showLineNumbers ?? true,
    showCopyButton: overrides?.showCopyButton ?? true,
    highlightLines: overrides?.highlightLines || [],
    maxHeight: overrides?.maxHeight,
    wrapLines: overrides?.wrapLines ?? false,
  };
}

export function renderCodeBlock(snippet: CodeSnippet, config: CodeBlockConfig): string {
  return `
    <div class="code-block" style="
      background: ${tokens.tech.terminal.bg};
      border-radius: ${tokens.borderRadius.lg};
      overflow: hidden;
      border: 1px solid ${tokens.colors.border.default};
      ${config.maxHeight ? `max-height: ${config.maxHeight};` : ''}
    ">
      <div class="code-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: ${tokens.spacing[3]} ${tokens.spacing[4]};
        background: ${tokens.colors.background.darker};
        border-bottom: 1px solid ${tokens.colors.border.default};
      ">
        <span style="
          font-family: ${tokens.typography.fontFamily.mono};
          font-size: ${tokens.typography.fontSize.sm};
          color: ${tokens.colors.text.secondary};
        ">${snippet.filename || config.language}</span>

        ${config.showCopyButton ? `
          <button class="copy-btn" style="
            padding: ${tokens.spacing[1]} ${tokens.spacing[3]};
            background: ${tokens.colors.background.light};
            color: ${tokens.colors.text.secondary};
            border: 1px solid ${tokens.colors.border.default};
            border-radius: ${tokens.borderRadius.base};
            font-size: ${tokens.typography.fontSize.xs};
            cursor: pointer;
            font-family: ${tokens.typography.fontFamily.mono};
            transition: all ${tokens.animation.fast} ${tokens.easing.standard};
          ">Copy</button>
        ` : ''}
      </div>

      <pre style="
        margin: 0;
        padding: ${tokens.spacing[4]};
        overflow-x: auto;
        ${config.wrapLines ? 'white-space: pre-wrap;' : ''}
        font-family: ${tokens.typography.fontFamily.mono};
        font-size: ${tokens.typography.fontSize.sm};
        line-height: ${tokens.typography.lineHeight.relaxed};
      "><code style="
        color: ${tokens.tech.terminal.text};
      ">${snippet.code}</code></pre>
    </div>
  `;
}

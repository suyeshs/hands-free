/**
 * Handsfree Setup Agent Service
 * Main orchestration service for voice-based setup assistance using Gemini Live
 *
 * Architecture:
 * - Integrates with Rust backend via Tauri commands
 * - Uses AudioStreamService for microphone/speaker I/O
 * - Handles Gemini Live messages (setup, serverContent, toolCall, error)
 * - Executes UI actions (navigate, show form, highlight)
 * - Manages session lifecycle and state
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getAudioStreamService, AudioChunk, AudioStreamService } from './AudioStreamService';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SessionInfo {
  session_id: string;
  tenant_id: string;
  language: string;
  created_at: string;
}

export interface GeminiMessage {
  type: 'setupComplete' | 'serverContent' | 'toolCall' | 'toolCallCancellation' | 'error' | 'interrupted';
  data?: any;
}

export interface ServerContent {
  model_turn: {
    parts: Array<{
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string; // base64 audio
      };
    }>;
  };
  turn_complete: boolean;
}

export interface ToolCall {
  function_calls: Array<{
    name: string;
    id: string;
    args: Record<string, any>;
  }>;
}

export interface UIAction {
  type: 'ShowForm' | 'Navigate' | 'HighlightField' | 'UpdateValue';
  category?: string;
  page?: string;
  field?: string;
  value?: any;
}

export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ============================================================================
// Main Agent Service
// ============================================================================

export class HandsfreeSetupAgent {
  private audioService: AudioStreamService;
  private sessionId: string | null = null;
  // @ts-ignore - Reserved for future use
  private _tenantId: string | null = null;
  // @ts-ignore - Reserved for future use
  private _language: string = 'en-IN';
  private status: AgentStatus = 'idle';

  private isInitialized: boolean = false;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;

  private transcript: TranscriptEntry[] = [];
  private currentUserSpeech: string = '';
  private audioLevel: number = 0;

  // Callbacks for UI updates
  private onStatusChange: ((status: AgentStatus) => void) | null = null;
  private onTranscriptUpdate: ((transcript: TranscriptEntry[]) => void) | null = null;
  private onAudioLevelUpdate: ((level: number) => void) | null = null;
  private onUIAction: ((action: UIAction) => void) | null = null;

  // Message listener cleanup
  private unlistenSetup: (() => void) | null = null;
  private unlistenMessage: (() => void) | null = null;

  constructor() {
    this.audioService = getAudioStreamService();
  }

  // ==========================================================================
  // Public API - Lifecycle Management
  // ==========================================================================

  /**
   * Initialize the agent session
   * @param tenantId - Restaurant tenant ID
   * @param language - Language code (e.g., 'en-IN', 'hi-IN')
   */
  async initialize(tenantId: string, language: string = 'en-IN'): Promise<void> {
    if (this.isInitialized) {
      console.warn('[HandsfreeAgent] Already initialized');
      return;
    }

    console.log('[HandsfreeAgent] Initializing...', { tenantId, language });
    this.setStatus('initializing');

    try {
      this._tenantId = tenantId;
      this._language = language;

      // Initialize audio service
      await this.audioService.initialize();
      console.log('[HandsfreeAgent] Audio service initialized');

      // Create Gemini Live session via Tauri
      const sessionInfo = await invoke<SessionInfo>('setup_agent_create_session', {
        tenantId,
        language,
      });

      this.sessionId = sessionInfo.session_id;
      console.log('[HandsfreeAgent] Session created:', sessionInfo);

      // Set up event listeners for Gemini messages
      await this.setupEventListeners();

      this.isInitialized = true;
      this.setStatus('connected');

      console.log('[HandsfreeAgent] Initialization complete');
    } catch (error) {
      console.error('[HandsfreeAgent] Initialization failed:', error);
      this.setStatus('error');
      throw error;
    }
  }

  /**
   * Start listening to user's voice
   */
  async startListening(): Promise<void> {
    if (!this.isInitialized || !this.sessionId) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    if (this.isListening) {
      console.warn('[HandsfreeAgent] Already listening');
      return;
    }

    console.log('[HandsfreeAgent] Starting to listen...');
    this.setStatus('listening');
    this.isListening = true;
    this.currentUserSpeech = '';

    // Start audio capture with callback
    this.audioService.startCapture(
      (chunk: AudioChunk) => this.handleAudioChunk(chunk),
      (level: number) => this.handleAudioLevel(level)
    );
  }

  /**
   * Stop listening to user's voice
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    console.log('[HandsfreeAgent] Stopping listening');
    this.isListening = false;
    this.audioService.stopCapture();

    // If we captured speech, add to transcript
    if (this.currentUserSpeech) {
      this.addToTranscript('user', this.currentUserSpeech);
      this.currentUserSpeech = '';
    }

    this.setStatus('connected');
  }

  /**
   * Shutdown the agent session
   */
  async shutdown(): Promise<void> {
    console.log('[HandsfreeAgent] Shutting down...');

    // Stop listening if active
    if (this.isListening) {
      this.stopListening();
    }

    // Clean up event listeners
    if (this.unlistenSetup) {
      this.unlistenSetup();
      this.unlistenSetup = null;
    }
    if (this.unlistenMessage) {
      this.unlistenMessage();
      this.unlistenMessage = null;
    }

    // Stop session on Rust side
    if (this.sessionId) {
      try {
        await invoke('setup_agent_stop_session', { sessionId: this.sessionId });
      } catch (error) {
        console.error('[HandsfreeAgent] Error stopping session:', error);
      }
    }

    // Dispose audio service
    await this.audioService.dispose();

    // Reset state
    this.isInitialized = false;
    this.sessionId = null;
    this._tenantId = null;
    this.transcript = [];
    this.setStatus('idle');

    console.log('[HandsfreeAgent] Shutdown complete');
  }

  // ==========================================================================
  // Public API - State Getters
  // ==========================================================================

  getStatus(): AgentStatus {
    return this.status;
  }

  isActive(): boolean {
    return this.isInitialized;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  getAudioLevel(): number {
    return this.audioLevel;
  }

  // ==========================================================================
  // Public API - Event Handlers Registration
  // ==========================================================================

  onStatus(callback: (status: AgentStatus) => void): void {
    this.onStatusChange = callback;
  }

  onTranscript(callback: (transcript: TranscriptEntry[]) => void): void {
    this.onTranscriptUpdate = callback;
  }

  onLevel(callback: (level: number) => void): void {
    this.onAudioLevelUpdate = callback;
  }

  onAction(callback: (action: UIAction) => void): void {
    this.onUIAction = callback;
  }

  // ==========================================================================
  // Private Methods - Audio Handling
  // ==========================================================================

  /**
   * Handle incoming audio chunks from microphone
   */
  private async handleAudioChunk(chunk: AudioChunk): Promise<void> {
    if (!this.sessionId || !this.isListening) {
      return;
    }

    try {
      // Convert Float32Array to PCM16 ArrayBuffer
      const pcm16Buffer = AudioStreamService.float32ToPCM16(chunk.data);

      // Convert to byte array for Tauri
      const bytes = Array.from(new Uint8Array(pcm16Buffer));

      // Send to Rust backend
      await invoke('setup_agent_send_audio', {
        sessionId: this.sessionId,
        audioData: bytes,
      });

      // Note: Transcription comes from Gemini via serverContent messages
    } catch (error) {
      console.error('[HandsfreeAgent] Error sending audio:', error);
    }
  }

  /**
   * Handle audio level updates for visualization
   */
  private handleAudioLevel(level: number): void {
    this.audioLevel = level;

    if (this.onAudioLevelUpdate) {
      this.onAudioLevelUpdate(level);
    }
  }

  // ==========================================================================
  // Private Methods - Event Listeners
  // ==========================================================================

  /**
   * Set up listeners for Gemini messages from Rust backend
   */
  private async setupEventListeners(): Promise<void> {
    // Listen for setup complete
    this.unlistenSetup = await listen<void>('gemini_setup_complete', () => {
      console.log('[HandsfreeAgent] Gemini setup complete');
    });

    // Listen for all Gemini messages
    this.unlistenMessage = await listen<GeminiMessage>('gemini_message', (event) => {
      this.handleGeminiMessage(event.payload);
    });
  }

  /**
   * Handle messages from Gemini Live
   */
  private async handleGeminiMessage(message: GeminiMessage): Promise<void> {
    console.log('[HandsfreeAgent] Gemini message:', message.type);

    switch (message.type) {
      case 'setupComplete':
        await this.handleSetupComplete();
        break;

      case 'serverContent':
        await this.handleServerContent(message.data as ServerContent);
        break;

      case 'toolCall':
        await this.handleToolCall(message.data as ToolCall);
        break;

      case 'error':
        this.handleError(message.data);
        break;

      case 'interrupted':
        console.log('[HandsfreeAgent] Turn interrupted');
        this.setStatus('listening');
        break;

      default:
        console.warn('[HandsfreeAgent] Unknown message type:', message.type);
    }
  }

  /**
   * Handle setup complete
   */
  private async handleSetupComplete(): Promise<void> {
    console.log('[HandsfreeAgent] Setup complete, ready for interaction');
    this.setStatus('connected');
  }

  /**
   * Handle server content (text + audio from Gemini)
   */
  private async handleServerContent(content: ServerContent): Promise<void> {
    console.log('[HandsfreeAgent] Server content received');

    if (!content.model_turn || !content.model_turn.parts) {
      return;
    }

    this.setStatus('speaking');
    this.isSpeaking = true;

    let responseText = '';

    // Process all parts
    for (const part of content.model_turn.parts) {
      // Handle text
      if (part.text) {
        responseText += part.text;
      }

      // Handle audio (base64 PCM16)
      if (part.inline_data && part.inline_data.mime_type === 'audio/pcm') {
        try {
          await this.audioService.playBase64Audio(part.inline_data.data, 24000);
        } catch (error) {
          console.error('[HandsfreeAgent] Error playing audio:', error);
        }
      }
    }

    // Add to transcript if text present
    if (responseText) {
      this.addToTranscript('assistant', responseText);
    }

    // If turn complete, return to listening
    if (content.turn_complete) {
      this.isSpeaking = false;
      this.setStatus(this.isListening ? 'listening' : 'connected');
    }
  }

  /**
   * Handle tool/function calls from Gemini
   */
  private async handleToolCall(toolCall: ToolCall): Promise<void> {
    console.log('[HandsfreeAgent] Tool call:', toolCall);
    this.setStatus('processing');

    // Function calls are handled on the Rust side, but we can execute UI actions
    if (toolCall.function_calls) {
      for (const call of toolCall.function_calls) {
        const action = this.mapFunctionCallToUIAction(call);
        if (action && this.onUIAction) {
          this.onUIAction(action);
        }
      }
    }
  }

  /**
   * Handle errors from Gemini
   */
  private handleError(error: any): void {
    console.error('[HandsfreeAgent] Gemini error:', error);
    this.setStatus('error');

    // Add error to transcript
    this.addToTranscript('assistant', `Error: ${error.message || 'Unknown error occurred'}`);
  }

  // ==========================================================================
  // Private Methods - UI Actions
  // ==========================================================================

  /**
   * Map function call to UI action
   */
  private mapFunctionCallToUIAction(call: any): UIAction | null {
    switch (call.name) {
      case 'show_settings_form':
        return {
          type: 'ShowForm',
          category: call.args.category,
          field: call.args.field,
        };

      case 'navigate_to_page':
        return {
          type: 'Navigate',
          page: call.args.page,
        };

      case 'update_setting':
        return {
          type: 'UpdateValue',
          field: call.args.field,
          value: call.args.value,
        };

      default:
        // Other functions handled by Rust backend
        return null;
    }
  }

  // ==========================================================================
  // Private Methods - State Management
  // ==========================================================================

  /**
   * Update agent status and notify listeners
   */
  private setStatus(status: AgentStatus): void {
    if (this.status === status) {
      return;
    }

    console.log(`[HandsfreeAgent] Status: ${this.status} → ${status}`);
    this.status = status;

    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Add entry to transcript and notify listeners
   */
  private addToTranscript(role: 'user' | 'assistant', content: string): void {
    const entry: TranscriptEntry = {
      role,
      content,
      timestamp: Date.now(),
    };

    this.transcript.push(entry);
    console.log(`[HandsfreeAgent] Transcript [${role}]:`, content);

    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate([...this.transcript]);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let handsfreeAgentInstance: HandsfreeSetupAgent | null = null;

export function getHandsfreeSetupAgent(): HandsfreeSetupAgent {
  if (!handsfreeAgentInstance) {
    handsfreeAgentInstance = new HandsfreeSetupAgent();
  }
  return handsfreeAgentInstance;
}

export async function disposeHandsfreeSetupAgent(): Promise<void> {
  if (handsfreeAgentInstance) {
    await handsfreeAgentInstance.shutdown();
    handsfreeAgentInstance = null;
  }
}

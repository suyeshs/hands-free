/**
 * Training Assistant Context
 * Manages WebSocket connection to Vertex AI Live API for voice-guided training
 */

import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react';
import { useTrainingStore } from '../stores/trainingStore';
import { useTenantStore } from '../stores/tenantStore';
import {
  AudioStreamService,
  getAudioStreamService,
  disposeAudioStreamService,
  AudioChunk,
} from '../services/AudioStreamService';

/**
 * Function call from AI
 */
interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Message types from WebSocket
 */
interface WSMessage {
  type:
    | 'connected'
    | 'audio'
    | 'text'
    | 'function_call'
    | 'turn_complete'
    | 'error'
    | 'interrupted';
  data?: string;
  text?: string;
  function?: FunctionCall;
  error?: string;
}

/**
 * Context value interface
 */
interface TrainingAssistantContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Audio state
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  sendTextMessage: (text: string) => void;
  interruptSpeech: () => void;

  // Function call handlers (set by parent components)
  registerFunctionHandler: (name: string, handler: (args: Record<string, unknown>) => void) => void;
  unregisterFunctionHandler: (name: string) => void;
}

const TrainingAssistantContext = createContext<TrainingAssistantContextValue | null>(null);

/**
 * WebSocket URL for training API
 */
function getTrainingWSUrl(tenantId: string, sessionId: string): string {
  // Use the backend WebSocket endpoint
  const baseUrl = import.meta.env.VITE_WS_URL || 'wss://api.handsfree.tech';
  return `${baseUrl}/ws/pos-training/${tenantId}/${sessionId}`;
}

/**
 * Training Assistant Provider
 */
export function TrainingAssistantProvider({ children }: { children: React.ReactNode }) {
  const { session, voicePreset, voiceEnabled, setAssistantState, setInstruction, setLastResponse } =
    useTrainingStore();
  const { tenant } = useTenantStore();

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const audioServiceRef = useRef<AudioStreamService | null>(null);
  const functionHandlersRef = useRef<Map<string, (args: Record<string, unknown>) => void>>(
    new Map()
  );

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Audio buffer for playback
  const audioBufferRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  /**
   * Play buffered audio
   */
  const playBufferedAudio = useCallback(async () => {
    if (isPlayingRef.current || audioBufferRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsSpeaking(true);
    setAssistantState('speaking');

    while (audioBufferRef.current.length > 0) {
      const audioData = audioBufferRef.current.shift();
      if (audioData && audioServiceRef.current) {
        await audioServiceRef.current.playBase64Audio(audioData);
      }
    }

    isPlayingRef.current = false;
    setIsSpeaking(false);
    setAssistantState('idle');
  }, [setAssistantState]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('[TrainingAssistant] Received:', message.type);

        switch (message.type) {
          case 'connected':
            console.log('[TrainingAssistant] Session connected');
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
            break;

          case 'audio':
            // Buffer audio for playback
            if (message.data) {
              audioBufferRef.current.push(message.data);
              playBufferedAudio();
            }
            break;

          case 'text':
            // AI text response (for display)
            if (message.text) {
              setLastResponse(message.text);
              setInstruction(message.text);
            }
            break;

          case 'function_call':
            // Handle AI function calls
            if (message.function) {
              const { name, args } = message.function;
              console.log('[TrainingAssistant] Function call:', name, args);

              const handler = functionHandlersRef.current.get(name);
              if (handler) {
                handler(args);
              } else {
                console.warn('[TrainingAssistant] No handler for function:', name);
              }
            }
            break;

          case 'turn_complete':
            // AI finished speaking
            setAssistantState('idle');
            break;

          case 'interrupted':
            // User interrupted AI
            audioBufferRef.current = [];
            isPlayingRef.current = false;
            setIsSpeaking(false);
            setAssistantState('idle');
            break;

          case 'error':
            console.error('[TrainingAssistant] Error:', message.error);
            setError(message.error || 'Unknown error');
            break;
        }
      } catch (err) {
        console.error('[TrainingAssistant] Failed to parse message:', err);
      }
    },
    [playBufferedAudio, setAssistantState, setInstruction, setLastResponse]
  );

  /**
   * Connect to training WebSocket
   */
  const connect = useCallback(async () => {
    if (!session || !tenant) {
      setError('No active session or tenant');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[TrainingAssistant] Already connected');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Initialize audio service
      audioServiceRef.current = getAudioStreamService();
      await audioServiceRef.current.initialize();

      // Calibrate VAD with ambient noise
      await audioServiceRef.current.calibrate(1000);

      // Connect WebSocket
      const wsUrl = getTrainingWSUrl(tenant.tenantId, session.sessionId);
      console.log('[TrainingAssistant] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[TrainingAssistant] WebSocket opened');

        // Send initialization message
        ws.send(
          JSON.stringify({
            type: 'init',
            voicePreset,
            module: session.currentModule,
            tenantId: tenant.tenantId,
            restaurantName: tenant.companyName || 'Restaurant',
          })
        );
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('[TrainingAssistant] WebSocket error:', event);
        setError('Connection error');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('[TrainingAssistant] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[TrainingAssistant] Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
    }
  }, [session, tenant, voicePreset, handleMessage]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioServiceRef.current) {
      audioServiceRef.current.stopCapture();
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[TrainingAssistant] Not connected');
      return;
    }

    if (!audioServiceRef.current) {
      console.warn('[TrainingAssistant] Audio service not initialized');
      return;
    }

    if (!voiceEnabled) {
      console.log('[TrainingAssistant] Voice disabled');
      return;
    }

    setIsListening(true);
    setAssistantState('listening');

    // Handle audio chunks
    const handleAudioChunk = (chunk: AudioChunk) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      // Only send speech audio
      if (chunk.isSpeech) {
        const base64Audio = AudioStreamService.float32ToBase64PCM16(chunk.data);
        wsRef.current.send(
          JSON.stringify({
            type: 'audio',
            data: base64Audio,
          })
        );
      }
    };

    // Handle audio level updates
    const handleAudioLevel = (level: number) => {
      setAudioLevel(level);
    };

    audioServiceRef.current.startCapture(handleAudioChunk, handleAudioLevel);
  }, [voiceEnabled, setAssistantState]);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stopCapture();
    }

    setIsListening(false);
    setAudioLevel(0);

    // Tell backend we're done speaking
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_of_turn' }));
    }

    setAssistantState('processing');
  }, [setAssistantState]);

  /**
   * Send text message (for text input fallback)
   */
  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[TrainingAssistant] Not connected');
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'text',
        text,
      })
    );
  }, []);

  /**
   * Interrupt AI speech
   */
  const interruptSpeech = useCallback(() => {
    audioBufferRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  }, []);

  /**
   * Register function handler
   */
  const registerFunctionHandler = useCallback(
    (name: string, handler: (args: Record<string, unknown>) => void) => {
      functionHandlersRef.current.set(name, handler);
    },
    []
  );

  /**
   * Unregister function handler
   */
  const unregisterFunctionHandler = useCallback((name: string) => {
    functionHandlersRef.current.delete(name);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
      disposeAudioStreamService();
    };
  }, [disconnect]);

  /**
   * Auto-connect when session starts
   */
  useEffect(() => {
    if (session && !isConnected && !isConnecting) {
      connect();
    }

    if (!session && isConnected) {
      disconnect();
    }
  }, [session, isConnected, isConnecting, connect, disconnect]);

  const value: TrainingAssistantContextValue = {
    isConnected,
    isConnecting,
    error,
    isListening,
    isSpeaking,
    audioLevel,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendTextMessage,
    interruptSpeech,
    registerFunctionHandler,
    unregisterFunctionHandler,
  };

  return (
    <TrainingAssistantContext.Provider value={value}>{children}</TrainingAssistantContext.Provider>
  );
}

/**
 * Hook to use training assistant context
 */
export function useTrainingAssistant() {
  const context = useContext(TrainingAssistantContext);
  if (!context) {
    throw new Error('useTrainingAssistant must be used within a TrainingAssistantProvider');
  }
  return context;
}

/**
 * Hook for registering function handlers
 */
export function useTrainingFunctionHandler(
  name: string,
  handler: (args: Record<string, unknown>) => void,
  deps: React.DependencyList = []
) {
  const { registerFunctionHandler, unregisterFunctionHandler } = useTrainingAssistant();

  useEffect(() => {
    registerFunctionHandler(name, handler);
    return () => unregisterFunctionHandler(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, registerFunctionHandler, unregisterFunctionHandler, ...deps]);
}

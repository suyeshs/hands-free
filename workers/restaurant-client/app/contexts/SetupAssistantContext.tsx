'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';

// Types
export interface SetupProgress {
  menu: number;
  theme: number;
  pos: number;
}

export interface MenuItem {
  name: string;
  description?: string;
  price: number;
  category: string;
  isVegetarian?: boolean;
  spiceLevel?: number;
}

export interface Theme {
  preset?: string;
  primaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  darkMode?: boolean;
}

export interface RestaurantInfo {
  name?: string;
  cuisineType?: string;
  address?: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  description?: string;
}

export interface FormData {
  restaurantInfo?: RestaurantInfo;
  menuItems?: MenuItem[];
  theme?: Theme;
  [key: string]: any;
}

export interface SetupState {
  progress: SetupProgress;
  currentStep: 'menu' | 'theme' | 'pos' | 'customers' | 'overview' | null;
  formData: FormData;
  restaurantName: string;
  isAssistantConnected: boolean;
  isAssistantListening: boolean;
  assistantTranscript: string;
  lastFunctionCall: { name: string; args: any; result: any } | null;
  showUploadDialog: { fileType: string; instructions: string } | null;
}

type SetupAction =
  | { type: 'SET_PROGRESS'; payload: SetupProgress }
  | { type: 'SET_CURRENT_STEP'; payload: SetupState['currentStep'] }
  | { type: 'SET_FORM_DATA'; payload: FormData }
  | { type: 'UPDATE_FORM_FIELD'; payload: { field: string; value: any } }
  | { type: 'ADD_MENU_ITEM'; payload: MenuItem }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_RESTAURANT_INFO'; payload: RestaurantInfo }
  | { type: 'SET_ASSISTANT_CONNECTED'; payload: boolean }
  | { type: 'SET_ASSISTANT_LISTENING'; payload: boolean }
  | { type: 'SET_ASSISTANT_TRANSCRIPT'; payload: string }
  | { type: 'SET_FUNCTION_CALL'; payload: SetupState['lastFunctionCall'] }
  | { type: 'SHOW_UPLOAD_DIALOG'; payload: SetupState['showUploadDialog'] }
  | { type: 'SYNC_STATE'; payload: Partial<SetupState> };

const initialState: SetupState = {
  progress: { menu: 0, theme: 0, pos: 0 },
  currentStep: null,
  formData: {},
  restaurantName: '',
  isAssistantConnected: false,
  isAssistantListening: false,
  assistantTranscript: '',
  lastFunctionCall: null,
  showUploadDialog: null,
};

function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };

    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_FORM_DATA':
      return { ...state, formData: action.payload };

    case 'UPDATE_FORM_FIELD': {
      const { field, value } = action.payload;
      const newFormData = { ...state.formData };

      // Support nested fields like "menuItem.name"
      const parts = field.split('.');
      let current: any = newFormData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;

      return { ...state, formData: newFormData };
    }

    case 'ADD_MENU_ITEM': {
      const menuItems = [...(state.formData.menuItems || []), action.payload];
      const menuProgress = Math.min(100, menuItems.length * 10);
      return {
        ...state,
        formData: { ...state.formData, menuItems },
        progress: { ...state.progress, menu: menuProgress },
      };
    }

    case 'SET_THEME':
      return {
        ...state,
        formData: { ...state.formData, theme: action.payload },
        progress: { ...state.progress, theme: 100 },
      };

    case 'SET_RESTAURANT_INFO':
      return {
        ...state,
        formData: { ...state.formData, restaurantInfo: action.payload },
        restaurantName: action.payload.name || state.restaurantName,
      };

    case 'SET_ASSISTANT_CONNECTED':
      return { ...state, isAssistantConnected: action.payload };

    case 'SET_ASSISTANT_LISTENING':
      return { ...state, isAssistantListening: action.payload };

    case 'SET_ASSISTANT_TRANSCRIPT':
      return { ...state, assistantTranscript: action.payload };

    case 'SET_FUNCTION_CALL':
      return { ...state, lastFunctionCall: action.payload };

    case 'SHOW_UPLOAD_DIALOG':
      return { ...state, showUploadDialog: action.payload };

    case 'SYNC_STATE': {
      const { progress, currentStep, formData, restaurantName } = action.payload;
      return {
        ...state,
        ...(progress && { progress }),
        ...(currentStep !== undefined && { currentStep }),
        ...(formData && { formData }),
        ...(restaurantName && { restaurantName }),
      };
    }

    default:
      return state;
  }
}

// Extended state for external access
export interface SetupAssistantState extends SetupState {
  isConnected: boolean;
  lastAssistantMessage: string;
  lastFunctionResult: { name: string; result: any } | null;
}

// Context
interface SetupAssistantContextValue {
  state: SetupAssistantState;
  setProgress: (progress: SetupProgress) => void;
  setCurrentStep: (step: SetupState['currentStep']) => void;
  updateFormField: (field: string, value: any) => void;
  addMenuItem: (item: MenuItem) => void;
  setTheme: (theme: Theme) => void;
  setRestaurantInfo: (info: RestaurantInfo) => void;
  connect: () => void;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
  sendText: (text: string) => void;
  navigateToStep: (step: SetupState['currentStep']) => void;
  closeUploadDialog: () => void;
}

const SetupAssistantContext = createContext<SetupAssistantContextValue | null>(null);

// Provider
interface SetupAssistantProviderProps {
  children: React.ReactNode;
  tenantId?: string;
  restaurantName?: string;
}

export function SetupAssistantProvider({
  children,
  tenantId: initialTenantId,
  restaurantName: initialRestaurantName,
}: SetupAssistantProviderProps) {
  const [state, dispatch] = useReducer(setupReducer, {
    ...initialState,
    restaurantName: initialRestaurantName || '',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(`setup-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const audioContextRef = useRef<AudioContext | null>(null);
  const tenantIdRef = useRef(initialTenantId);
  const restaurantNameRef = useRef(initialRestaurantName);
  const [lastAssistantMessage, setLastAssistantMessage] = React.useState('');
  const [lastFunctionResult, setLastFunctionResult] = React.useState<{ name: string; result: any } | null>(null);

  // Update refs when props change
  useEffect(() => {
    tenantIdRef.current = initialTenantId;
    restaurantNameRef.current = initialRestaurantName;
  }, [initialTenantId, initialRestaurantName]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const connect = useCallback(() => {
    const tenantId = tenantIdRef.current || 'demo-restaurant';
    const restaurantName = restaurantNameRef.current;

    connectAssistant(tenantId, restaurantName);
  }, []);

  const connectAssistant = useCallback((tenantId: string, restaurantName?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[SetupContext] Already connected');
      return;
    }

    // Use environment variable or default to Cloud Run backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ||
                       process.env.NEXT_PUBLIC_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://') ||
                       'wss://stonepot-restaurant-api-qdrant-143946997045.us-central1.run.app';

    const sessionId = sessionIdRef.current;
    const params = new URLSearchParams({
      tenantId,
      ...(restaurantName && { restaurantName }),
    });

    const fullUrl = `${backendUrl}/ws/setup-assistant/${sessionId}?${params}`;
    console.log('[SetupContext] Connecting to:', fullUrl);

    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[SetupContext] WebSocket connected');
      dispatch({ type: 'SET_ASSISTANT_CONNECTED', payload: true });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch {
        // Binary audio data
        if (event.data instanceof Blob) {
          playAudio(event.data);
        }
      }
    };

    ws.onclose = () => {
      console.log('[SetupContext] WebSocket disconnected');
      dispatch({ type: 'SET_ASSISTANT_CONNECTED', payload: false });
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('[SetupContext] WebSocket error:', error);
    };
  }, []);

  const handleServerMessage = useCallback((message: any) => {
    console.log('[SetupContext] Server message:', message.type);

    switch (message.type) {
      case 'connection_established':
      case 'session_started':
        if (message.setupState) {
          dispatch({ type: 'SYNC_STATE', payload: message.setupState });
        }
        break;

      case 'STATE_UPDATE':
        if (message.state) {
          dispatch({ type: 'SYNC_STATE', payload: message.state });
        }
        break;

      case 'TEXT':
        dispatch({ type: 'SET_ASSISTANT_TRANSCRIPT', payload: message.text });
        setLastAssistantMessage(message.text);
        break;

      case 'AUDIO':
        if (message.data) {
          playBase64Audio(message.data, message.mimeType);
        }
        break;

      case 'FUNCTION_CALL':
        dispatch({
          type: 'SET_FUNCTION_CALL',
          payload: {
            name: message.functionName,
            args: message.args,
            result: message.result,
          },
        });
        setLastFunctionResult({ name: message.functionName, result: message.result });
        handleFunctionResult(message.functionName, message.args, message.result);
        break;

      case 'TURN_COMPLETE':
        dispatch({ type: 'SET_ASSISTANT_LISTENING', payload: false });
        break;

      case 'error':
        console.error('[SetupContext] Server error:', message.error);
        break;
    }
  }, []);

  const handleFunctionResult = useCallback((name: string, args: any, result: any) => {
    switch (result?.action) {
      case 'SHOW_UPLOAD_DIALOG':
        dispatch({
          type: 'SHOW_UPLOAD_DIALOG',
          payload: { fileType: result.fileType, instructions: result.instructions },
        });
        break;

      case 'NAVIGATE':
        dispatch({ type: 'SET_CURRENT_STEP', payload: result.step });
        break;

      case 'UPDATE_FIELD':
        dispatch({
          type: 'UPDATE_FORM_FIELD',
          payload: { field: result.field, value: result.value },
        });
        break;

      case 'ADD_MENU_ITEM':
        if (result.item) {
          dispatch({ type: 'ADD_MENU_ITEM', payload: result.item });
        }
        break;

      case 'GENERATE_MENU':
        if (result.items) {
          result.items.forEach((item: MenuItem) => {
            dispatch({ type: 'ADD_MENU_ITEM', payload: item });
          });
        }
        break;

      case 'APPLY_THEME':
        if (result.theme) {
          dispatch({ type: 'SET_THEME', payload: result.theme });
        }
        break;

      case 'UPDATE_RESTAURANT_INFO':
        if (result.info) {
          dispatch({ type: 'SET_RESTAURANT_INFO', payload: result.info });
        }
        break;
    }
  }, []);

  const playBase64Audio = useCallback(async (base64Data: string, mimeType: string = 'audio/pcm') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const audioContext = audioContextRef.current;
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      if (mimeType.includes('pcm')) {
        const samples = new Float32Array(binaryData.length / 2);
        const dataView = new DataView(binaryData.buffer);

        for (let i = 0; i < samples.length; i++) {
          const int16 = dataView.getInt16(i * 2, true);
          samples[i] = int16 / 32768;
        }

        const audioBuffer = audioContext.createBuffer(1, samples.length, 24000);
        audioBuffer.copyToChannel(samples, 0);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error) {
      console.error('[SetupContext] Audio playback error:', error);
    }
  }, []);

  const playAudio = useCallback(async (blob: Blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (error) {
      console.error('[SetupContext] Audio playback error:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: 'SET_ASSISTANT_CONNECTED', payload: false });
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
      dispatch({ type: 'SET_ASSISTANT_LISTENING', payload: true });
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
      dispatch({ type: 'SET_ASSISTANT_LISTENING', payload: true });
    }
  }, []);

  const navigateToStep = useCallback((step: SetupState['currentStep']) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'navigate', step }));
    }
  }, []);

  const setProgress = useCallback((progress: SetupProgress) => {
    dispatch({ type: 'SET_PROGRESS', payload: progress });
  }, []);

  const setCurrentStep = useCallback((step: SetupState['currentStep']) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
  }, []);

  const updateFormField = useCallback((field: string, value: any) => {
    dispatch({ type: 'UPDATE_FORM_FIELD', payload: { field, value } });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STATE_UPDATE',
        state: { formData: { [field]: value } },
      }));
    }
  }, []);

  const addMenuItem = useCallback((item: MenuItem) => {
    dispatch({ type: 'ADD_MENU_ITEM', payload: item });
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const setRestaurantInfo = useCallback((info: RestaurantInfo) => {
    dispatch({ type: 'SET_RESTAURANT_INFO', payload: info });
  }, []);

  const closeUploadDialog = useCallback(() => {
    dispatch({ type: 'SHOW_UPLOAD_DIALOG', payload: null });
  }, []);

  // Create extended state with additional properties
  const extendedState: SetupAssistantState = {
    ...state,
    isConnected: state.isAssistantConnected,
    lastAssistantMessage,
    lastFunctionResult,
  };

  const value: SetupAssistantContextValue = {
    state: extendedState,
    setProgress,
    setCurrentStep,
    updateFormField,
    addMenuItem,
    setTheme,
    setRestaurantInfo,
    connect,
    disconnect,
    sendAudio,
    sendText,
    navigateToStep,
    closeUploadDialog,
  };

  return (
    <SetupAssistantContext.Provider value={value}>
      {children}
    </SetupAssistantContext.Provider>
  );
}

export function useSetupAssistant() {
  const context = useContext(SetupAssistantContext);
  if (!context) {
    throw new Error('useSetupAssistant must be used within a SetupAssistantProvider');
  }
  return context;
}

export default SetupAssistantContext;

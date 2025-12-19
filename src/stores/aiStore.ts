import { create } from "zustand";
import { AIRecommendation } from "../types";

interface AIStore {
  recommendations: AIRecommendation[];
  isListening: boolean;
  voiceTranscript: string;
  lastCommand: string;
  isProcessing: boolean;

  // Actions
  setRecommendations: (recommendations: AIRecommendation[]) => void;
  addRecommendation: (recommendation: AIRecommendation) => void;
  clearRecommendations: () => void;
  setIsListening: (listening: boolean) => void;
  setVoiceTranscript: (transcript: string) => void;
  setLastCommand: (command: string) => void;
  setIsProcessing: (processing: boolean) => void;
}

export const useAIStore = create<AIStore>((set) => ({
  recommendations: [],
  isListening: false,
  voiceTranscript: "",
  lastCommand: "",
  isProcessing: false,

  setRecommendations: (recommendations: AIRecommendation[]) =>
    set({ recommendations }),
  
  addRecommendation: (recommendation: AIRecommendation) =>
    set((state) => ({
      recommendations: [...state.recommendations, recommendation],
    })),
  
  clearRecommendations: () => set({ recommendations: [] }),
  
  setIsListening: (listening: boolean) => set({ isListening: listening }),
  
  setVoiceTranscript: (transcript: string) =>
    set({ voiceTranscript: transcript }),
  
  setLastCommand: (command: string) => set({ lastCommand: command }),
  
  setIsProcessing: (processing: boolean) => set({ isProcessing: processing }),
}));


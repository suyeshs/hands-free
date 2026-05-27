import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PosStore {
  posUrl: string | null;   // e.g. "http://192.168.1.10:8090"
  isConnected: boolean;
  setPosUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  clearPosUrl: () => void;
}

export const usePosStore = create<PosStore>()(
  persist(
    (set) => ({
      posUrl: null,
      isConnected: false,

      setPosUrl: (url) => {
        // Normalise: strip trailing slash
        set({ posUrl: url.replace(/\/$/, ''), isConnected: false });
      },

      setConnected: (connected) => set({ isConnected: connected }),

      clearPosUrl: () => set({ posUrl: null, isConnected: false }),
    }),
    { name: 'pos-connection' }
  )
);

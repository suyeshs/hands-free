/**
 * Notification Store
 * Manages sound alerts and notification preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationSound =
  | 'new_order'
  | 'order_ready'
  | 'order_urgent'
  | 'order_completed'
  | 'error'
  | 'qr_order'
  | 'service_request'
  | 'item_ready';

export interface NotificationPreferences {
  enabled: boolean;
  volume: number; // 0-100
  sounds: {
    newOrder: boolean;
    orderReady: boolean;
    orderUrgent: boolean;
    orderCompleted: boolean;
    error: boolean;
    qrOrder: boolean;
    serviceRequest: boolean;
    itemReady: boolean;
  };
}

interface NotificationStore {
  // State
  preferences: NotificationPreferences;
  isPlaying: boolean;
  lastPlayedSound: NotificationSound | null;
  audioContext: AudioContext | null;

  // Actions
  playSound: (sound: NotificationSound) => Promise<void>;
  stopSound: () => void;
  setVolume: (volume: number) => void;
  toggleNotifications: (enabled: boolean) => void;
  toggleSound: (sound: keyof NotificationPreferences['sounds'], enabled: boolean) => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;

  // Helpers
  initializeAudioContext: () => void;
  getSoundPath: (sound: NotificationSound) => string;
}

// Sound file mappings
const SOUND_PATHS: Record<NotificationSound, string> = {
  new_order: '/sounds/new-order.mp3',
  order_ready: '/sounds/order-ready.mp3',
  order_urgent: '/sounds/urgent.mp3',
  order_completed: '/sounds/completed.mp3',
  error: '/sounds/error.mp3',
  qr_order: '/sounds/new-order.mp3', // Reuse new order sound for QR orders
  service_request: '/sounds/urgent.mp3', // Reuse urgent sound for service requests
  item_ready: '/sounds/order-ready.mp3', // Short bell for item ready notification
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      preferences: {
        enabled: true,
        volume: 75,
        sounds: {
          newOrder: true,
          orderReady: true,
          orderUrgent: true,
          orderCompleted: true,
          error: true,
          qrOrder: true,
          serviceRequest: true,
          itemReady: true,
        },
      },
      isPlaying: false,
      lastPlayedSound: null,
      audioContext: null,

      // Initialize audio context
      initializeAudioContext: () => {
        if (typeof window === 'undefined') return;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        set({ audioContext: ctx });
      },

      // Get sound file path
      getSoundPath: (sound) => {
        return SOUND_PATHS[sound];
      },

      // Play notification sound
      playSound: async (sound) => {
        const { preferences, audioContext } = get();

        // Check if notifications are enabled
        if (!preferences.enabled) {
          console.log('[Notification] Notifications disabled');
          return;
        }

        // Check if specific sound is enabled
        const soundKey = sound.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        ) as keyof NotificationPreferences['sounds'];

        if (!preferences.sounds[soundKey]) {
          console.log(`[Notification] ${sound} sound disabled`);
          return;
        }

        try {
          // Initialize audio context if not available
          if (!audioContext) {
            get().initializeAudioContext();
          }

          const soundPath = get().getSoundPath(sound);
          const audio = new Audio(soundPath);
          audio.volume = preferences.volume / 100;

          set({ isPlaying: true, lastPlayedSound: sound });

          await audio.play();

          audio.onended = () => {
            set({ isPlaying: false });
          };

          console.log(`[Notification] Playing sound: ${sound}`);
        } catch (error) {
          console.error('[Notification] Failed to play sound:', error);
          set({ isPlaying: false });
        }
      },

      // Stop currently playing sound
      stopSound: () => {
        // Note: HTML5 Audio doesn't have a direct reference to stop
        // This is a placeholder for future implementation with AudioContext
        set({ isPlaying: false });
      },

      // Set volume (0-100)
      setVolume: (volume) => {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        set((state) => ({
          preferences: {
            ...state.preferences,
            volume: clampedVolume,
          },
        }));
      },

      // Toggle all notifications
      toggleNotifications: (enabled) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            enabled,
          },
        }));
      },

      // Toggle specific sound
      toggleSound: (sound, enabled) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            sounds: {
              ...state.preferences.sounds,
              [sound]: enabled,
            },
          },
        }));
      },

      // Update preferences
      updatePreferences: (preferences) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...preferences,
          },
        }));
      },
    }),
    {
      name: 'notification-preferences',
      // Only persist preferences, not runtime state
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

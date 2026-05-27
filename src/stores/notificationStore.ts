/**
 * Notification Store
 * Manages sound alerts and notification preferences
 */

import { create } from 'zustand';

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
  activeNodes: AudioBufferSourceNode[];

  // Actions
  playSound: (sound: NotificationSound) => Promise<void>;
  stopSound: () => void;
  setVolume: (volume: number) => void;
  toggleNotifications: (enabled: boolean) => void;
  toggleSound: (sound: keyof NotificationPreferences['sounds'], enabled: boolean) => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;

  // Helpers
  initializeAudioContext: () => AudioContext | null;
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

// Gain amplification for new order alerts — boosts beyond the 1.0 HTML5 Audio ceiling
const NEW_ORDER_GAIN = 3.0;
const NEW_ORDER_REPEAT = 3;
const NEW_ORDER_REPEAT_GAP = 0.4; // seconds between repeats

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
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
      activeNodes: [],

      // Initialize audio context
      initializeAudioContext: () => {
        if (typeof window === 'undefined') return null;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        set({ audioContext: ctx });
        return ctx;
      },

      // Get sound file path
      getSoundPath: (sound) => {
        return SOUND_PATHS[sound];
      },

      // Play notification sound
      playSound: async (sound) => {
        const { preferences } = get();

        if (!preferences.enabled) return;

        const soundKey = sound.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        ) as keyof NotificationPreferences['sounds'];

        if (!preferences.sounds[soundKey]) return;

        try {
          let ctx = get().audioContext;
          if (!ctx) ctx = get().initializeAudioContext();
          if (!ctx) return;

          // Resume context if suspended (browser autoplay policy)
          if (ctx.state === 'suspended') await ctx.resume();

          const soundPath = get().getSoundPath(sound);
          const response = await fetch(soundPath);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          const isNewOrder = sound === 'new_order' || sound === 'qr_order';
          const gain = isNewOrder
            ? NEW_ORDER_GAIN * (preferences.volume / 100)
            : preferences.volume / 100;
          const repeatCount = isNewOrder ? NEW_ORDER_REPEAT : 1;

          // Stop any currently playing sounds
          get().stopSound();

          const nodes: AudioBufferSourceNode[] = [];
          for (let i = 0; i < repeatCount; i++) {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = ctx.createGain();
            gainNode.gain.value = gain;

            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            const startAt = ctx.currentTime + i * (audioBuffer.duration + NEW_ORDER_REPEAT_GAP);
            source.start(startAt);
            nodes.push(source);

            if (i === repeatCount - 1) {
              source.onended = () => set({ isPlaying: false, activeNodes: [] });
            }
          }

          set({ isPlaying: true, lastPlayedSound: sound, activeNodes: nodes });
          console.log(`[Notification] Playing ${sound} — gain: ${gain.toFixed(2)}, repeats: ${repeatCount}`);
        } catch (error) {
          console.error('[Notification] Failed to play sound:', error);
          set({ isPlaying: false });
        }
      },

      // Stop currently playing sound
      stopSound: () => {
        const { activeNodes } = get();
        activeNodes.forEach((node) => {
          try { node.stop(); } catch (_) { /* already ended */ }
        });
        set({ isPlaying: false, activeNodes: [] });
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
    }));

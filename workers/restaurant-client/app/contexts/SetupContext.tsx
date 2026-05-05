'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Menu item type for setup flow
 */
export interface MenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
}

/**
 * Setup state interface - collects all information needed for tenant provisioning
 */
export interface SetupState {
  // Step 1: Restaurant Info
  restaurantName: string;
  cuisine: string;
  address: string;
  phone: string;
  hours: string;
  about: string;

  // Step 2: Voice AI
  voicePresetId: string;
  voiceName: string;
  tone: string;
  responseLength: string;
  allowedLanguages: string[];

  // Step 3: Theme & Branding
  themePreset: string;
  primaryColor: string;
  logo: string | null;
  tagline: string;

  // Step 4: Menu
  menuFile: File | null;
  menuItems: MenuItem[];

  // Validation flags
  step1Complete: boolean;
  step2Complete: boolean;
  step3Complete: boolean;
  canActivate: boolean;
}

/**
 * Setup context type
 */
interface SetupContextType {
  setupState: SetupState;
  canActivate: boolean;
  updateSetupState: (updates: Partial<SetupState>) => void;
  resetSetup: () => void;
}

/**
 * Default setup state
 */
const defaultSetupState: SetupState = {
  // Step 1
  restaurantName: '',
  cuisine: '',
  address: '',
  phone: '',
  hours: '',
  about: '',

  // Step 2
  voicePresetId: '',
  voiceName: '',
  tone: 'Friendly',
  responseLength: 'Balanced',
  allowedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'bn', 'ta', 'te', 'kn', 'zh', 'ja', 'ko'],

  // Step 3
  themePreset: '',
  primaryColor: '#ff9500',
  logo: null,
  tagline: '',

  // Step 4
  menuFile: null,
  menuItems: [],

  // Validation
  step1Complete: false,
  step2Complete: false,
  step3Complete: false,
  canActivate: false,
};

/**
 * Setup Context
 */
const SetupContext = createContext<SetupContextType | undefined>(undefined);

/**
 * Setup Provider Component
 */
export function SetupProvider({ children }: { children: React.ReactNode }) {
  const [setupState, setSetupState] = useState<SetupState>(defaultSetupState);

  /**
   * Update setup state with validation
   */
  const updateSetupState = (updates: Partial<SetupState>) => {
    setSetupState((prev) => {
      const newState = { ...prev, ...updates };

      // Validate Step 1: Restaurant Info (all required fields)
      newState.step1Complete = Boolean(
        newState.restaurantName.trim() &&
        newState.cuisine.trim() &&
        newState.address.trim() &&
        newState.phone.trim() &&
        newState.hours.trim()
      );

      // Validate Step 2: Voice AI (voice must be selected)
      newState.step2Complete = Boolean(
        newState.voicePresetId.trim() &&
        newState.voiceName.trim() &&
        newState.allowedLanguages.length > 0
      );

      // Validate Step 3: Theme & Branding (theme must be selected)
      newState.step3Complete = Boolean(
        newState.themePreset.trim() &&
        newState.primaryColor.trim()
      );

      // Step 4 is optional, so no validation needed

      // Can activate if steps 1-3 are complete
      newState.canActivate =
        newState.step1Complete &&
        newState.step2Complete &&
        newState.step3Complete;

      return newState;
    });
  };

  /**
   * Reset setup state
   */
  const resetSetup = () => {
    setSetupState(defaultSetupState);
  };

  return (
    <SetupContext.Provider
      value={{
        setupState,
        canActivate: setupState.canActivate,
        updateSetupState,
        resetSetup,
      }}
    >
      {children}
    </SetupContext.Provider>
  );
}

/**
 * Hook to use Setup Context
 */
export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within SetupProvider');
  }
  return context;
}

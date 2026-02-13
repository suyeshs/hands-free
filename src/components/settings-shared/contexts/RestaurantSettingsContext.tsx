/**
 * Restaurant Settings Context
 * Provides shared state management for all settings plugins
 * Handles form data, updates, save operations, and unsaved changes tracking
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRestaurantSettingsStore, RestaurantDetails } from '@/stores/restaurantSettingsStore';

export interface RestaurantSettingsContextValue {
  settings: RestaurantDetails;
  formData: RestaurantDetails;
  updateField: (field: string, value: any) => void;
  handleSave: () => Promise<void>;
  isSaving: boolean;
  saveSuccess: boolean;
  hasUnsavedChanges: boolean;
}

const RestaurantSettingsContext = createContext<RestaurantSettingsContextValue | null>(null);

export interface RestaurantSettingsProviderProps {
  children: ReactNode;
}

export function RestaurantSettingsProvider({ children }: RestaurantSettingsProviderProps) {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const [formData, setFormData] = useState<RestaurantDetails>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update form data when settings change (e.g., after cloud sync)
  useEffect(() => {
    console.log('[RestaurantSettingsContext] Settings changed, syncing formData');
    setFormData(settings);
    setHasUnsavedChanges(false);
  }, [settings]);

  /**
   * Update a field in the form data
   * Supports nested fields using dot notation (e.g., 'address.city')
   */
  const updateField = useCallback((field: string, value: any) => {
    setFormData((prev) => {
      const keys = field.split('.');

      if (keys.length === 1) {
        // Top-level field
        return { ...prev, [field]: value };
      }

      // Nested field
      const [parent, child] = keys;
      return {
        ...prev,
        [parent]: {
          ...(prev[parent as keyof RestaurantDetails] as object),
          [child]: value,
        },
      };
    });

    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  }, []);

  /**
   * Save form data to store
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateSettings(formData);
      console.log('[RestaurantSettingsContext] Settings saved successfully');

      setHasUnsavedChanges(false);
      setSaveSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('[RestaurantSettingsContext] Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [formData, updateSettings]);

  const value: RestaurantSettingsContextValue = {
    settings,
    formData,
    updateField,
    handleSave,
    isSaving,
    saveSuccess,
    hasUnsavedChanges,
  };

  return (
    <RestaurantSettingsContext.Provider value={value}>
      {children}
    </RestaurantSettingsContext.Provider>
  );
}

/**
 * Hook to access restaurant settings context
 */
export function useRestaurantSettings() {
  const context = useContext(RestaurantSettingsContext);

  if (!context) {
    throw new Error(
      'useRestaurantSettings must be used within a RestaurantSettingsProvider'
    );
  }

  return context;
}

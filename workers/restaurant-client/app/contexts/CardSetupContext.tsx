'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Building2,
  Utensils,
  Palette,
  Mic,
  Monitor,
} from 'lucide-react';
import {
  SetupCardId,
  CardStatus,
  CardSetupState,
  CardSetupContextValue,
  SetupCardData,
  PaymentConfig,
  RestaurantData,
  MenuItem,
  ThemeConfig,
  AIConfig,
  STORAGE_KEYS,
  API_ENDPOINTS,
} from '../components/admin/card-setup/types/setup-cards';

/**
 * Initial Card Configuration
 */
const INITIAL_CARDS: Record<SetupCardId, SetupCardData> = {
  [SetupCardId.RESTAURANT]: {
    id: SetupCardId.RESTAURANT,
    title: 'Restaurant Setup',
    description: 'Basic details and payment configuration',
    icon: Building2,
    status: CardStatus.INCOMPLETE,
    required: true,
  },
  [SetupCardId.MENU]: {
    id: SetupCardId.MENU,
    title: 'Menu Setup',
    description: 'Upload or create your menu items',
    icon: Utensils,
    status: CardStatus.INCOMPLETE,
    required: true,
  },
  [SetupCardId.THEME]: {
    id: SetupCardId.THEME,
    title: 'Theme & Template',
    description: 'Customize colors and branding',
    icon: Palette,
    status: CardStatus.INCOMPLETE,
    required: true,
  },
  [SetupCardId.AI]: {
    id: SetupCardId.AI,
    title: 'Conversational AI',
    description: 'Configure voice assistant settings',
    icon: Mic,
    status: CardStatus.INCOMPLETE,
    required: true,
  },
  [SetupCardId.POS]: {
    id: SetupCardId.POS,
    title: 'POS Setup',
    description: 'Download and configure point of sale',
    icon: Monitor,
    status: CardStatus.INCOMPLETE,
    required: false,
  },
};

/**
 * Initial State
 */
const INITIAL_STATE: CardSetupState = {
  activeCardId: null,
  cards: INITIAL_CARDS,
  paymentConfig: {
    useHandsfreeAccount: true,
  },
  restaurantData: null,
  menuItems: [],
  themeConfig: null,
  aiConfig: null,
  completionStatus: {
    [SetupCardId.RESTAURANT]: false,
    [SetupCardId.MENU]: false,
    [SetupCardId.THEME]: false,
    [SetupCardId.AI]: false,
    [SetupCardId.POS]: false,
  },
};

/**
 * Card Setup Context
 */
const CardSetupContext = createContext<CardSetupContextValue | undefined>(undefined);

/**
 * Card Setup Provider
 */
export function CardSetupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CardSetupState>(INITIAL_STATE);

  // Load state from localStorage on mount
  useEffect(() => {
    loadFromLocalStorage();
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToLocalStorage();
  }, [state]);

  /**
   * Load state from localStorage
   */
  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEYS.CARD_SETUP_STATE);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Merge with initial cards to ensure we have icon references
        const cards = { ...INITIAL_CARDS };
        Object.keys(parsed.cards || {}).forEach((key) => {
          const cardId = key as SetupCardId;
          if (cards[cardId]) {
            cards[cardId] = {
              ...cards[cardId],
              status: parsed.cards[cardId]?.status || CardStatus.INCOMPLETE,
            };
          }
        });

        setState({
          ...INITIAL_STATE,
          ...parsed,
          cards,
          activeCardId: null, // Don't restore active card
        });
      }
    } catch (error) {
      console.error('[CardSetupContext] Failed to load from localStorage:', error);
    }
  }, []);

  /**
   * Save state to localStorage
   */
  const saveToLocalStorage = useCallback(() => {
    try {
      // Don't save icon references to localStorage
      const stateToSave = {
        ...state,
        cards: Object.fromEntries(
          Object.entries(state.cards).map(([key, card]) => [
            key,
            {
              id: card.id,
              title: card.title,
              description: card.description,
              status: card.status,
              required: card.required,
            },
          ])
        ),
      };
      localStorage.setItem(STORAGE_KEYS.CARD_SETUP_STATE, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[CardSetupContext] Failed to save to localStorage:', error);
    }
  }, [state]);

  /**
   * Open a card
   */
  const openCard = useCallback((cardId: SetupCardId) => {
    setState((prev) => ({
      ...prev,
      activeCardId: cardId,
    }));
  }, []);

  /**
   * Close active card
   */
  const closeCard = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeCardId: null,
    }));
  }, []);

  /**
   * Mark card as complete
   */
  const markCardComplete = useCallback((cardId: SetupCardId) => {
    setState((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          status: CardStatus.COMPLETE,
        },
      },
      completionStatus: {
        ...prev.completionStatus,
        [cardId]: true,
      },
    }));
  }, []);

  /**
   * Mark card as in progress
   */
  const markCardInProgress = useCallback((cardId: SetupCardId) => {
    setState((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          status: CardStatus.IN_PROGRESS,
        },
      },
    }));
  }, []);

  /**
   * Mark card as incomplete
   */
  const markCardIncomplete = useCallback((cardId: SetupCardId) => {
    setState((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          status: CardStatus.INCOMPLETE,
        },
      },
      completionStatus: {
        ...prev.completionStatus,
        [cardId]: false,
      },
    }));
  }, []);

  /**
   * Save restaurant data
   */
  const saveRestaurantData = useCallback(async (data: RestaurantData) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      restaurantData: data,
    }));

    try {
      // Call backend API to save to D1 and sync to Firestore
      const response = await fetch(API_ENDPOINTS.RESTAURANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to save restaurant data');
      }

      const result = await response.json();
      console.log('[CardSetupContext] Restaurant data saved:', result);

      markCardComplete(SetupCardId.RESTAURANT);
    } catch (error) {
      console.error('[CardSetupContext] Failed to save restaurant data:', error);
      markCardIncomplete(SetupCardId.RESTAURANT);
      throw error;
    }
  }, [markCardComplete, markCardIncomplete]);

  /**
   * Save payment configuration
   */
  const savePaymentConfig = useCallback(async (config: PaymentConfig) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      paymentConfig: config,
    }));

    try {
      // Call backend API to save to D1
      const response = await fetch('/api/restaurant/setup/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to save payment config');
      }

      const result = await response.json();
      console.log('[CardSetupContext] Payment config saved:', result);
    } catch (error) {
      console.error('[CardSetupContext] Failed to save payment config:', error);
      throw error;
    }
  }, []);

  /**
   * Save menu items
   */
  const saveMenuItems = useCallback(async (items: MenuItem[]) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      menuItems: items,
    }));

    try {
      // TODO: Implement backend API call
      // await fetch(API_ENDPOINTS.MENU, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ items }),
      // });

      markCardComplete(SetupCardId.MENU);
    } catch (error) {
      console.error('[CardSetupContext] Failed to save menu items:', error);
      markCardIncomplete(SetupCardId.MENU);
      throw error;
    }
  }, [markCardComplete, markCardIncomplete]);

  /**
   * Save theme configuration
   */
  const saveThemeConfig = useCallback(async (config: ThemeConfig) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      themeConfig: config,
    }));

    try {
      // Call backend API to save to D1
      const response = await fetch(API_ENDPOINTS.THEME, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to save theme configuration');
      }

      const result = await response.json();
      console.log('[CardSetupContext] Theme config saved:', result);

      markCardComplete(SetupCardId.THEME);
    } catch (error) {
      console.error('[CardSetupContext] Failed to save theme config:', error);
      markCardIncomplete(SetupCardId.THEME);
      throw error;
    }
  }, [markCardComplete, markCardIncomplete]);

  /**
   * Save AI configuration
   */
  const saveAIConfig = useCallback(async (config: AIConfig) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      aiConfig: config,
    }));

    try {
      // TODO: Implement backend API call
      // await fetch(API_ENDPOINTS.AI, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(config),
      // });

      markCardComplete(SetupCardId.AI);
    } catch (error) {
      console.error('[CardSetupContext] Failed to save AI config:', error);
      markCardIncomplete(SetupCardId.AI);
      throw error;
    }
  }, [markCardComplete, markCardIncomplete]);

  /**
   * Check if restaurant can go live
   */
  const canGoLive = useCallback(() => {
    return (
      state.completionStatus[SetupCardId.RESTAURANT] &&
      state.completionStatus[SetupCardId.MENU] &&
      state.completionStatus[SetupCardId.THEME] &&
      state.completionStatus[SetupCardId.AI]
    );
  }, [state.completionStatus]);

  /**
   * Get completion percentage
   */
  const getCompletionPercentage = useCallback(() => {
    const requiredCards = Object.values(state.cards).filter((card) => card.required);
    const completedRequired = requiredCards.filter(
      (card) => state.completionStatus[card.id]
    ).length;
    return Math.round((completedRequired / requiredCards.length) * 100);
  }, [state.cards, state.completionStatus]);

  /**
   * Sync with backend
   */
  const syncWithBackend = useCallback(async () => {
    try {
      // TODO: Implement backend sync
      console.log('[CardSetupContext] Syncing with backend...');
    } catch (error) {
      console.error('[CardSetupContext] Failed to sync with backend:', error);
      throw error;
    }
  }, []);

  const contextValue: CardSetupContextValue = {
    state,
    openCard,
    closeCard,
    markCardComplete,
    markCardInProgress,
    markCardIncomplete,
    saveRestaurantData,
    savePaymentConfig,
    saveMenuItems,
    saveThemeConfig,
    saveAIConfig,
    canGoLive,
    getCompletionPercentage,
    syncWithBackend,
    saveToLocalStorage,
    loadFromLocalStorage,
  };

  return (
    <CardSetupContext.Provider value={contextValue}>
      {children}
    </CardSetupContext.Provider>
  );
}

/**
 * Hook to use Card Setup Context
 */
export function useCardSetup(): CardSetupContextValue {
  const context = useContext(CardSetupContext);
  if (!context) {
    throw new Error('useCardSetup must be used within CardSetupProvider');
  }
  return context;
}

/**
 * Subscription Store - Zustand State Management
 *
 * Manages all state and actions for the subscription meals plugin
 * including plans, customers, menus, deliveries, and orders.
 */

import { create } from 'zustand';
import {
  SubscriptionPlan,
  SubscriptionCustomer,
  SubscriptionCustomerWithPlan,
  WeeklyMenu,
  WeeklyMenuWithItems,
  SubscriptionDelivery,
  DeliveryWithDetails,
  MealPreference,
  CuisineType,
  SubscriptionStats,
  CustomerFilters,
  DeliveryFilters,
  CreateSubscriptionPlanInput,
  SubscribeInput,
  SelectMealsInput,
  UpdateDeliveryStatusInput,
  WeekInfo,
  PaginatedResponse,
} from '../types/subscription';
import { MenuItem } from '../types';

/**
 * Subscription Store State Interface
 */
interface SubscriptionStore {
  // ========================================
  // Admin State
  // ========================================
  plans: SubscriptionPlan[];
  cuisineTypes: CuisineType[];
  customers: SubscriptionCustomerWithPlan[];
  deliveries: DeliveryWithDetails[];
  weeklyMenus: Map<string, WeeklyMenuWithItems>; // key: weekId
  stats: SubscriptionStats | null;

  // ========================================
  // Customer State
  // ========================================
  activeSubscription: SubscriptionCustomer | null;
  currentWeekMenu: WeeklyMenuWithItems | null;
  availableWeeks: WeekInfo[]; // Next 4 weeks
  selectedMeals: Map<string, number>; // menuItemId -> quantity
  customerPreferences: MealPreference[];

  // ========================================
  // UI State
  // ========================================
  isLoading: boolean;
  error: string | null;
  selectedWeekId: string | null;
  selectedCuisineType: string | null;

  // ========================================
  // Admin Actions
  // ========================================

  /**
   * Load subscription plans for tenant
   */
  loadPlans: (tenantId: string) => Promise<void>;

  /**
   * Create new subscription plan
   */
  createPlan: (tenantId: string, input: CreateSubscriptionPlanInput) => Promise<SubscriptionPlan>;

  /**
   * Update existing plan
   */
  updatePlan: (planId: string, updates: Partial<CreateSubscriptionPlanInput>) => Promise<void>;

  /**
   * Delete plan
   */
  deletePlan: (planId: string) => Promise<void>;

  /**
   * Toggle plan active status
   */
  togglePlanActive: (planId: string) => Promise<void>;

  /**
   * Load cuisine types
   */
  loadCuisineTypes: (tenantId: string) => Promise<void>;

  /**
   * Load subscription customers with filters
   */
  loadCustomers: (tenantId: string, filters?: CustomerFilters) => Promise<void>;

  /**
   * Load deliveries with filters
   */
  loadDeliveries: (tenantId: string, filters?: DeliveryFilters) => Promise<void>;

  /**
   * Load weekly menu by ID
   */
  loadWeeklyMenu: (weekId: string) => Promise<void>;

  /**
   * Load available weeks (next 4 weeks)
   */
  loadAvailableWeeks: (tenantId: string, cuisineType: string) => Promise<void>;

  /**
   * Create new weekly menu
   */
  createWeeklyMenu: (
    tenantId: string,
    weekNumber: number,
    year: number,
    cuisineType: string
  ) => Promise<WeeklyMenu>;

  /**
   * Add menu items to weekly menu
   */
  addItemsToWeeklyMenu: (weekId: string, menuItemIds: string[]) => Promise<void>;

  /**
   * Remove menu item from weekly menu
   */
  removeItemFromWeeklyMenu: (weekId: string, menuItemId: string) => Promise<void>;

  /**
   * Publish weekly menu (make visible to customers)
   */
  publishWeeklyMenu: (weekId: string) => Promise<void>;

  /**
   * Upload menu from Excel
   */
  uploadMenuExcel: (
    weekId: string,
    file: File
  ) => Promise<{ success: number; failed: number; errors: string[] }>;

  /**
   * Update delivery status
   */
  updateDeliveryStatus: (input: UpdateDeliveryStatusInput) => Promise<void>;

  /**
   * Assign driver to delivery
   */
  assignDriver: (deliveryId: string, driverName: string) => Promise<void>;

  /**
   * Load subscription statistics
   */
  loadStats: (tenantId: string) => Promise<void>;

  // ========================================
  // Customer Actions
  // ========================================

  /**
   * Subscribe customer to plan
   */
  subscribe: (input: SubscribeInput) => Promise<SubscriptionCustomer>;

  /**
   * Load customer subscription by phone
   */
  loadCustomerSubscription: (phone: string) => Promise<void>;

  /**
   * Select meals for a week
   */
  selectMeals: (input: SelectMealsInput) => Promise<void>;

  /**
   * Toggle meal selection (add/remove from cart)
   */
  toggleMealSelection: (menuItemId: string) => void;

  /**
   * Update meal quantity
   */
  updateMealQuantity: (menuItemId: string, quantity: number) => void;

  /**
   * Clear selected meals
   */
  clearMealSelection: () => void;

  /**
   * Load customer preferences (meal selections)
   */
  loadCustomerPreferences: (subscriptionId: string) => Promise<void>;

  /**
   * Pause subscription
   */
  pauseSubscription: (subscriptionId: string) => Promise<void>;

  /**
   * Resume subscription
   */
  resumeSubscription: (subscriptionId: string) => Promise<void>;

  /**
   * Cancel subscription
   */
  cancelSubscription: (subscriptionId: string) => Promise<void>;

  /**
   * Update delivery address
   */
  updateDeliveryAddress: (
    subscriptionId: string,
    towerNumber: string,
    apartmentNumber: string
  ) => Promise<void>;

  // ========================================
  // Utility Actions
  // ========================================

  /**
   * Set selected week
   */
  setSelectedWeek: (weekId: string | null) => void;

  /**
   * Set selected cuisine type
   */
  setSelectedCuisineType: (cuisineType: string | null) => void;

  /**
   * Clear error
   */
  clearError: () => void;

  /**
   * Reset store
   */
  reset: () => void;
}

/**
 * Default state values
 */
const initialState = {
  plans: [],
  cuisineTypes: [],
  customers: [],
  deliveries: [],
  weeklyMenus: new Map(),
  stats: null,

  activeSubscription: null,
  currentWeekMenu: null,
  availableWeeks: [],
  selectedMeals: new Map(),
  customerPreferences: [],

  isLoading: false,
  error: null,
  selectedWeekId: null,
  selectedCuisineType: null,
};

/**
 * Create Subscription Store
 */
export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  ...initialState,

  // ========================================
  // Admin Actions Implementation
  // ========================================

  loadPlans: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/plans/${tenantId}`);
      if (!response.ok) throw new Error('Failed to load plans');
      const data = await response.json();
      set({ plans: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createPlan: async (tenantId: string, input: CreateSubscriptionPlanInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/subscriptions/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...input }),
      });
      if (!response.ok) throw new Error('Failed to create plan');
      const data = await response.json();
      const newPlan = data.data;
      set((state) => ({
        plans: [...state.plans, newPlan],
        isLoading: false,
      }));
      return newPlan;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updatePlan: async (planId: string, updates: Partial<CreateSubscriptionPlanInput>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update plan');
      const data = await response.json();
      const updatedPlan = data.data;
      set((state) => ({
        plans: state.plans.map((p) => (p.id === planId ? updatedPlan : p)),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  deletePlan: async (planId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/plans/${planId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete plan');
      set((state) => ({
        plans: state.plans.filter((p) => p.id !== planId),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  togglePlanActive: async (planId: string) => {
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) return;
    await get().updatePlan(planId, { ...plan, active: !plan.active } as any);
  },

  loadCuisineTypes: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/cuisines/${tenantId}`);
      if (!response.ok) throw new Error('Failed to load cuisine types');
      const data = await response.json();
      set({ cuisineTypes: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadCustomers: async (tenantId: string, filters?: CustomerFilters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.towerNumber) params.append('tower', filters.towerNumber);
      if (filters?.searchQuery) params.append('search', filters.searchQuery);
      if (filters?.offset) params.append('offset', filters.offset.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/subscriptions/customers/${tenantId}?${params}`);
      if (!response.ok) throw new Error('Failed to load customers');
      const data = await response.json();
      set({ customers: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadDeliveries: async (tenantId: string, filters?: DeliveryFilters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.date) params.append('date', filters.date);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.towerNumber) params.append('tower', filters.towerNumber);
      if (filters?.timeSlot) params.append('timeSlot', filters.timeSlot);

      const response = await fetch(`/api/subscriptions/deliveries/${tenantId}?${params}`);
      if (!response.ok) throw new Error('Failed to load deliveries');
      const data = await response.json();
      set({ deliveries: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadWeeklyMenu: async (weekId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/menu/week/${weekId}`);
      if (!response.ok) throw new Error('Failed to load weekly menu');
      const data = await response.json();
      const menu = data.data;
      set((state) => {
        const newMenus = new Map(state.weeklyMenus);
        newMenus.set(weekId, menu);
        return { weeklyMenus: newMenus, currentWeekMenu: menu, isLoading: false };
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAvailableWeeks: async (tenantId: string, cuisineType: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `/api/subscriptions/menu/available-weeks/${tenantId}?cuisine=${cuisineType}`
      );
      if (!response.ok) throw new Error('Failed to load available weeks');
      const data = await response.json();
      set({ availableWeeks: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createWeeklyMenu: async (
    tenantId: string,
    weekNumber: number,
    year: number,
    cuisineType: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/subscriptions/menu/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, weekNumber, year, cuisineType }),
      });
      if (!response.ok) throw new Error('Failed to create weekly menu');
      const data = await response.json();
      set({ isLoading: false });
      return data.data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  addItemsToWeeklyMenu: async (weekId: string, menuItemIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/menu/week/${weekId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemIds }),
      });
      if (!response.ok) throw new Error('Failed to add items');
      await get().loadWeeklyMenu(weekId);
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  removeItemFromWeeklyMenu: async (weekId: string, menuItemId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/menu/week/${weekId}/items/${menuItemId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove item');
      await get().loadWeeklyMenu(weekId);
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  publishWeeklyMenu: async (weekId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/menu/week/${weekId}/publish`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to publish menu');
      await get().loadWeeklyMenu(weekId);
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  uploadMenuExcel: async (weekId: string, file: File) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('weekId', weekId);

      const response = await fetch('/api/subscriptions/menu/upload-excel', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload Excel');
      const data = await response.json();
      await get().loadWeeklyMenu(weekId);
      set({ isLoading: false });
      return data.data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateDeliveryStatus: async (input: UpdateDeliveryStatusInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/delivery/${input.deliveryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to update delivery status');
      set((state) => ({
        deliveries: state.deliveries.map((d) =>
          d.id === input.deliveryId ? { ...d, status: input.status } : d
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  assignDriver: async (deliveryId: string, driverName: string) => {
    await get().updateDeliveryStatus({ deliveryId, status: 'out_for_delivery', assignedDriver: driverName });
  },

  loadStats: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/stats/${tenantId}`);
      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();
      set({ stats: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // ========================================
  // Customer Actions Implementation
  // ========================================

  subscribe: async (input: SubscribeInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to subscribe');
      const data = await response.json();
      set({ activeSubscription: data.data, isLoading: false });
      return data.data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  loadCustomerSubscription: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/customer/${phone}`);
      if (!response.ok) throw new Error('Failed to load subscription');
      const data = await response.json();
      set({ activeSubscription: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  selectMeals: async (input: SelectMealsInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/${input.subscriptionId}/select-meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to select meals');
      set({ isLoading: false });
      get().clearMealSelection();
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  toggleMealSelection: (menuItemId: string) => {
    set((state) => {
      const newSelection = new Map(state.selectedMeals);
      if (newSelection.has(menuItemId)) {
        newSelection.delete(menuItemId);
      } else {
        newSelection.set(menuItemId, 1);
      }
      return { selectedMeals: newSelection };
    });
  },

  updateMealQuantity: (menuItemId: string, quantity: number) => {
    set((state) => {
      const newSelection = new Map(state.selectedMeals);
      if (quantity <= 0) {
        newSelection.delete(menuItemId);
      } else {
        newSelection.set(menuItemId, quantity);
      }
      return { selectedMeals: newSelection };
    });
  },

  clearMealSelection: () => {
    set({ selectedMeals: new Map() });
  },

  loadCustomerPreferences: async (subscriptionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/preferences`);
      if (!response.ok) throw new Error('Failed to load preferences');
      const data = await response.json();
      set({ customerPreferences: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  pauseSubscription: async (subscriptionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/pause`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error('Failed to pause subscription');
      set((state) => ({
        activeSubscription: state.activeSubscription
          ? { ...state.activeSubscription, status: 'paused' }
          : null,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  resumeSubscription: async (subscriptionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/resume`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error('Failed to resume subscription');
      set((state) => ({
        activeSubscription: state.activeSubscription
          ? { ...state.activeSubscription, status: 'active' }
          : null,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  cancelSubscription: async (subscriptionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error('Failed to cancel subscription');
      set((state) => ({
        activeSubscription: state.activeSubscription
          ? { ...state.activeSubscription, status: 'cancelled' }
          : null,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateDeliveryAddress: async (
    subscriptionId: string,
    towerNumber: string,
    apartmentNumber: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/address`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ towerNumber, apartmentNumber }),
      });
      if (!response.ok) throw new Error('Failed to update address');
      const data = await response.json();
      set({ activeSubscription: data.data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // ========================================
  // Utility Actions Implementation
  // ========================================

  setSelectedWeek: (weekId: string | null) => {
    set({ selectedWeekId: weekId });
    if (weekId) {
      get().loadWeeklyMenu(weekId);
    }
  },

  setSelectedCuisineType: (cuisineType: string | null) => {
    set({ selectedCuisineType: cuisineType });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));

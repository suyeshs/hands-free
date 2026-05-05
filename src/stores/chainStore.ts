/**
 * Chain Management Store
 * Manages restaurant chains, locations, and consolidated reporting
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useRestaurantSettingsStore } from './restaurantSettingsStore';
import type { LocationFormData } from '../components/admin/LocationCreationModal';

export interface RestaurantChain {
  id: string;
  chainName: string;
  masterTenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChainLocation {
  id: string;
  chainId: string;
  locationTenantId: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string | null;
  email: string | null;
  status: 'active' | 'inactive';
  joinedAt: string;
  // Additional metadata
  activationCode?: string;
  subdomain?: string;
  googleRating?: number;
  googleTotalReviews?: number;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface MenuOverride {
  id: string;
  locationTenantId: string;
  menuItemId: string;
  priceOverride: number | null;
  availabilityOverride: boolean | null;
  descriptionOverride: string | null;
  photoOverride: string | null;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationTenantMetadata {
  locationId: string;
  locationTenantId: string;
  locationName: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  country: string;
  phone?: string;
  email?: string;
  activationCode: string;
  subdomain: string;
  provisioningStatus: 'pending' | 'provisioning' | 'completed' | 'failed';
  cloudflareResources?: {
    d1DatabaseId: string;
    kvNamespaceId: string;
    r2BucketName: string;
    workerUrl: string;
  };
  googlePlaceId?: string;
  googleMapsUrl?: string;
  googleRating?: number;
  googleTotalReviews?: number;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

interface ChainState {
  // State
  currentChain: RestaurantChain | null;
  locations: ChainLocation[];
  menuOverrides: MenuOverride[];
  masterTenantId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  createChain: (chainData: any) => Promise<string>;
  loadChain: (chainId: string) => Promise<void>;
  loadLocations: (chainId: string) => Promise<void>;
  addLocation: (chainId: string, locationData: any) => Promise<string>;
  provisionLocationTenant: (
    chainId: string,
    locationData: LocationFormData,
    onProgress?: (step: string, progress: number) => void
  ) => Promise<LocationTenantMetadata>;
  ensureChainExists: () => Promise<string>;
  pullMasterMenu: (tenantId: string, chainId: string) => Promise<void>;
  loadMenuOverrides: (tenantId: string) => Promise<void>;
  setMenuOverride: (tenantId: string, itemId: string, overrideData: any) => Promise<void>;
  removeMenuOverride: (tenantId: string, itemId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  currentChain: null,
  locations: [],
  menuOverrides: [],
  masterTenantId: null,
  isLoading: false,
  error: null,
};

// Helper function to generate unique subdomain for location
function generateLocationSubdomain(
  masterRestaurantName: string,
  locationName: string
): string {
  const masterSlug = masterRestaurantName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 20);

  const locationSlug = locationName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 15);

  const random = Math.floor(1000 + Math.random() * 9000); // 4 digits

  return `${masterSlug}-${locationSlug}-${random}`;
}

// Helper function to poll chain location provisioning status
async function pollChainLocationProvisioningStatus(
  provisioningId: string,
  provisioningUrl: string,
  onProgress?: (step: string, progress: number) => void
): Promise<any> {
  const maxAttempts = 120; // 10 minutes max (5 second intervals)
  let attempts = 0;

  console.log('[ChainStore] Starting to poll provisioning status:', provisioningId);

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `${provisioningUrl}/api/provision/chain-location/status/${provisioningId}`
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[ChainStore] Polling attempt ${attempts + 1}: Status = ${data.status}`);

      if (data.status === 'completed') {
        console.log('[ChainStore] Provisioning completed successfully');
        return data.result || data;
      } else if (data.status === 'failed') {
        throw new Error(data.message || data.error || 'Provisioning failed');
      }

      // Update progress based on status
      if (onProgress) {
        let progress = 50; // Start at 50% (after initial request)
        if (data.status === 'provisioning') {
          progress = Math.min(50 + (attempts / maxAttempts) * 35, 85);
        }
        const message = data.message || 'Provisioning infrastructure...';
        onProgress(message, progress);
      }

      // Wait 5 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      console.error('[ChainStore] Polling error:', error);

      // If it's a network error, retry
      if (attempts >= 3) {
        // After 3 failed attempts, throw the error
        throw error;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Provisioning timeout - exceeded maximum wait time of 10 minutes');
}

export const useChainStore = create<ChainState>((set, get) => ({
  ...initialState,

  createChain: async (chainData: any) => {
    set({ isLoading: true, error: null });
    try {
      const chainId = chainData.id || crypto.randomUUID();
      await invoke('create_chain', {
        chainId,
        chainName: chainData.chainName,
        masterTenantId: chainData.masterTenantId,
      });

      // Load the newly created chain
      await get().loadChain(chainId);

      set({ isLoading: false });
      return chainId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create chain';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  loadChain: async (chainId: string) => {
    set({ isLoading: true, error: null });
    try {
      const chain = await invoke<RestaurantChain>('get_chain', { chainId });
      set({ currentChain: chain, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chain';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  loadLocations: async (chainId: string) => {
    set({ isLoading: true, error: null });
    try {
      const locationTenants = await invoke<any[]>('get_chain_locations', { chainId });

      // Convert LocationTenantMetadata to ChainLocation format
      const locations: ChainLocation[] = locationTenants.map(loc => ({
        id: loc.location_id,
        chainId: chainId,
        locationTenantId: loc.location_tenant_id,
        locationName: loc.location_name,
        address: `${loc.address_line1}, ${loc.city}`,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        phone: loc.phone || null,
        email: loc.email || null,
        status: 'active',
        joinedAt: loc.created_at || new Date().toISOString(),
        activationCode: loc.activation_code,
        subdomain: loc.subdomain,
        googleRating: loc.google_rating,
        googleTotalReviews: loc.google_total_reviews,
        googleMapsUrl: loc.google_maps_url,
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));

      set({ locations, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load locations';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  addLocation: async (_chainId: string, _locationData: any) => {
    set({ isLoading: true, error: null });
    try {
      // Note: Use provisionLocationTenant instead for full tenant creation
      // This is a simple metadata-only addition
      throw new Error('Use provisionLocationTenant for creating new locations with full tenant infrastructure');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add location';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  pullMasterMenu: async (locationTenantId: string, _chainId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Note: Menu sync happens automatically when location device activates
      // This manual trigger is for re-syncing after menu updates

      // For manual re-sync, location devices should use the same fetch_and_load_master_menu command
      // In the future, this could trigger a notification via WebSocket to location devices

      console.log(`[ChainStore] Manual menu sync trigger for location: ${locationTenantId}`);
      console.log('[ChainStore] Note: Location will automatically sync menu on next activation or app restart');

      // Get master tenant ID (current device is master)
      const masterTenantId = await invoke<string>('get_current_tenant_id');
      console.log(`[ChainStore] Master tenant ID: ${masterTenantId}`);

      // In a future implementation, we could:
      // 1. Send a WebSocket notification to the location device
      // 2. Or implement a "push sync" endpoint that notifies the location
      // For now, location will sync on their next app startup or manual trigger

      set({ isLoading: false });

      // Note: Menu sync happens automatically, no return value needed
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger menu sync';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  loadMenuOverrides: async (_tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Implement menu overrides loading from SQLite
      set({ menuOverrides: [], isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load menu overrides';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  setMenuOverride: async (_tenantId: string, _itemId: string, _overrideData: any) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Implement menu override storage in SQLite
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set menu override';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  removeMenuOverride: async (_tenantId: string, itemId: string) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Implement menu override removal from SQLite
      // Remove from local state
      set((state) => ({
        menuOverrides: state.menuOverrides.filter((override) => override.menuItemId !== itemId),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove menu override';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  provisionLocationTenant: async (
    chainId: string,
    locationData: LocationFormData,
    onProgress?: (step: string, progress: number) => void
  ) => {
    const state = get();
    const masterTenant = useRestaurantSettingsStore.getState().settings;

    console.log('[ChainStore] Starting provisioning - chainId:', chainId);
    console.log('[ChainStore] Master tenant ID from state:', state.masterTenantId);
    console.log('[ChainStore] Master tenant settings:', { name: masterTenant.name, ownerName: masterTenant.ownerName });

    // Validate that we have a masterTenantId
    if (!state.masterTenantId) {
      throw new Error('Master tenant ID not found. Please ensure the chain is created first.');
    }

    // Validate master tenant settings
    if (!masterTenant.name) {
      throw new Error('Master restaurant name is missing. Please complete restaurant setup first.');
    }

    if (!masterTenant.ownerName) {
      throw new Error('Owner name is missing. Please complete restaurant setup first.');
    }

    // Validate email is available
    const email = locationData.email || masterTenant.email;
    if (!email) {
      throw new Error('Email is required. Please provide an email for this location or set one in restaurant settings.');
    }

    try {
      // Verify provisioning URL is configured
      const provisioningUrl = import.meta.env.VITE_PROVISIONING_URL;
      if (!provisioningUrl) {
        throw new Error('Provisioning service URL is not configured. Please check your environment variables.');
      }
      console.log('[ChainStore] Using provisioning URL:', provisioningUrl);

      // Step 1: Generate subdomain
      onProgress?.('Generating subdomain...', 10);
      const subdomain = generateLocationSubdomain(
        masterTenant.name,
        locationData.locationName
      );

      // Step 2: Check provisioning service health
      onProgress?.('Checking provisioning service...', 20);
      try {
        const healthController = new AbortController();
        const healthTimeoutId = setTimeout(() => healthController.abort(), 10000);
        const healthResponse = await fetch(
          `${import.meta.env.VITE_PROVISIONING_URL}/health`,
          { signal: healthController.signal }
        );
        clearTimeout(healthTimeoutId);

        if (!healthResponse.ok) {
          throw new Error('Provisioning service is not available');
        }
        console.log('[ChainStore] Provisioning service health check passed');
      } catch (error) {
        throw new Error('Provisioning service is not available. Please try again later or contact support.');
      }

      // Step 3: Call full chain-location provisioning API
      // Creates complete infrastructure (D1, KV, R2, Worker) with parent tenant tagging
      onProgress?.('Creating location infrastructure...', 30);

      const requestBody = {
        masterTenantId: state.masterTenantId, // Parent tenant ID for chain linking
        restaurantName: locationData.locationName,
        companyName: masterTenant.name, // Restaurant/company name
        ownerName: masterTenant.ownerName,
        email: locationData.email || masterTenant.email || '',
        phone: locationData.phone || masterTenant.phone || '',
        city: locationData.address.city,
        pincode: locationData.address.pincode,
        restaurantType: locationData.restaurantType,
        subdomain: subdomain,
      };

      console.log('[ChainStore] Chain location provisioning request body:', requestBody);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for initial request

      let response: Response;
      try {
        // Use full chain-location provisioning endpoint
        response = await fetch(
          `${import.meta.env.VITE_PROVISIONING_URL}/api/provision/chain-location`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Location provisioning request timed out. Please try again.');
        }
        throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      if (!response.ok) {
        let errorMessage = 'Chain location provisioning failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('[ChainStore] Provisioning error response:', errorData);
        } catch {
          const errorText = await response.text();
          console.error('[ChainStore] Provisioning error text:', errorText);
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const provisioningResult = await response.json();
      console.log('[ChainStore] Chain location provisioning started:', provisioningResult);

      // Step 4: Poll for completion (async provisioning via Durable Object)
      onProgress?.('Provisioning infrastructure...', 50);
      const completedResult = await pollChainLocationProvisioningStatus(
        provisioningResult.provisioningId,
        provisioningUrl,
        onProgress
      );

      // Step 5: Register location in chain
      onProgress?.('Registering location...', 90);
      const locationMetadata: LocationTenantMetadata = {
        locationId: crypto.randomUUID(),
        locationTenantId: completedResult.tenantId,
        locationName: locationData.locationName,
        address: locationData.address,
        country: locationData.country,
        phone: locationData.phone,
        email: locationData.email,
        activationCode: completedResult.activationCode,
        subdomain: subdomain,
        provisioningStatus: 'completed',
        cloudflareResources: completedResult.cloudflareResources,
        googlePlaceId: locationData.googlePlaceId,
        googleMapsUrl: locationData.googleMapsUrl,
        googleRating: locationData.googleRating,
        googleTotalReviews: locationData.googleTotalReviews,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        createdAt: new Date().toISOString(),
      };

      // Save to SQLite via Tauri command
      await invoke('store_location_tenant', {
        chainId,
        locationMetadata: {
          location_id: locationMetadata.locationId,
          location_tenant_id: locationMetadata.locationTenantId,
          location_name: locationMetadata.locationName,
          address_line1: locationMetadata.address.line1,
          address_line2: locationMetadata.address.line2 || null,
          city: locationMetadata.address.city,
          state: locationMetadata.address.state,
          pincode: locationMetadata.address.pincode,
          country: locationMetadata.country,
          phone: locationMetadata.phone || null,
          email: locationMetadata.email || null,
          activation_code: locationMetadata.activationCode,
          subdomain: locationMetadata.subdomain,
          provisioning_status: locationMetadata.provisioningStatus,
          d1_database_id: locationMetadata.cloudflareResources?.d1DatabaseId || null,
          kv_namespace_id: locationMetadata.cloudflareResources?.kvNamespaceId || null,
          r2_bucket_name: locationMetadata.cloudflareResources?.r2BucketName || null,
          worker_url: locationMetadata.cloudflareResources?.workerUrl || null,
          google_place_id: locationMetadata.googlePlaceId || null,
          google_maps_url: locationMetadata.googleMapsUrl || null,
          google_rating: locationMetadata.googleRating || null,
          google_total_reviews: locationMetadata.googleTotalReviews || null,
          latitude: locationMetadata.latitude || null,
          longitude: locationMetadata.longitude || null,
        },
      });

      // Update Zustand state
      set({
        locations: [
          ...state.locations,
          {
            id: locationMetadata.locationId,
            chainId: chainId,
            locationTenantId: locationMetadata.locationTenantId,
            locationName: locationData.locationName,
            address: `${locationData.address.line1}, ${locationData.address.city}`,
            city: locationData.address.city,
            state: locationData.address.state,
            country: locationData.country,
            phone: locationData.phone || null,
            email: locationData.email || null,
            status: 'active',
            joinedAt: new Date().toISOString(),
            activationCode: locationMetadata.activationCode,
            subdomain: locationMetadata.subdomain,
            googleRating: locationMetadata.googleRating,
            googleTotalReviews: locationMetadata.googleTotalReviews,
            googleMapsUrl: locationMetadata.googleMapsUrl,
            latitude: locationMetadata.latitude,
            longitude: locationMetadata.longitude,
          },
        ],
      });

      onProgress?.('Location created successfully!', 100);
      return locationMetadata;
    } catch (error) {
      console.error('Failed to provision location tenant:', error);
      throw error;
    }
  },

  ensureChainExists: async () => {
    const state = get();

    console.log('[ChainStore] ensureChainExists - current state:', {
      hasChain: !!state.currentChain,
      chainId: state.currentChain?.id,
      masterTenantId: state.masterTenantId,
    });

    if (state.currentChain && state.masterTenantId) {
      console.log('[ChainStore] Chain already exists, using existing:', state.currentChain.id);
      return state.currentChain.id;
    }

    // Auto-create chain using current restaurant as master
    const masterTenant = useRestaurantSettingsStore.getState().settings;
    const masterTenantId = await invoke<string>('get_current_tenant_id');

    console.log('[ChainStore] Creating new chain - masterTenantId:', masterTenantId);

    // Use company_name if available, otherwise fall back to name for backward compatibility
    const chainBaseName = masterTenant.companyName || masterTenant.name;

    const chain: RestaurantChain = {
      id: crypto.randomUUID(),
      chainName: `${chainBaseName} Chain`,
      masterTenantId: masterTenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to SQLite
    await invoke('create_chain', {
      chainId: chain.id,
      chainName: chain.chainName,
      masterTenantId: chain.masterTenantId,
    });

    console.log('[ChainStore] Chain created in DB, updating Zustand state');

    set({
      currentChain: chain,
      masterTenantId: masterTenantId,
    });

    console.log('[ChainStore] State updated with masterTenantId:', masterTenantId);

    return chain.id;
  },

  reset: () => set(initialState),
}));

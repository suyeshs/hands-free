/**
 * Restaurant Activation Handler
 * Provisions tenant by calling backend provisioning endpoint
 */

import { SetupState } from '../contexts/SetupContext';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://handsfree-domain-service-prod.suyesh.workers.dev';

/**
 * Payload structure for backend provisioning endpoint
 */
interface ProvisionPayload {
  tenantId: string;
  companyName: string;
  restaurantProfile: {
    cuisine: string;
    address: string;
    phone: string;
    hours: string;
    about: string;
  };
  aiConfig?: {
    voicePresetId: string;
    voiceName: string;
    tone: string;
    responseLength: string;
    allowedLanguages: string[];
  };
  brandIdentity?: {
    primaryColor: string;
    logo: string | null;
    tagline: string;
    companyName: string;
  };
  menuItems?: Array<{
    name: string;
    description?: string;
    price?: number;
    category?: string;
  }>;
}

/**
 * Activate restaurant by provisioning tenant
 *
 * @param setupData - Setup state containing all configuration
 * @param tenantId - Tenant ID to provision
 * @returns Promise with provisioning result
 */
export async function activateRestaurant(
  setupData: SetupState,
  tenantId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[Activation] Starting provisioning for tenant:', tenantId);

    // Prepare payload for backend
    const payload: ProvisionPayload = {
      tenantId,
      companyName: setupData.restaurantName,
      restaurantProfile: {
        cuisine: setupData.cuisine,
        address: setupData.address,
        phone: setupData.phone,
        hours: setupData.hours,
        about: setupData.about,
      },
      aiConfig: {
        voicePresetId: setupData.voicePresetId,
        voiceName: setupData.voiceName,
        tone: setupData.tone,
        responseLength: setupData.responseLength,
        allowedLanguages: setupData.allowedLanguages,
      },
      brandIdentity: {
        primaryColor: setupData.primaryColor,
        logo: setupData.logo,
        tagline: setupData.tagline,
        companyName: setupData.restaurantName,
      },
      menuItems: setupData.menuItems,
    };

    // Call backend provision endpoint
    const url = `${BACKEND_URL}/api/restaurant/tenants/provision`;
    console.log('[Activation] Calling provision endpoint:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Activation] Provisioning failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      throw new Error(
        `Provisioning failed: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log('[Activation] Provisioning successful:', result);

    return {
      success: true,
      message: 'Restaurant activated successfully!',
    };
  } catch (error) {
    console.error('[Activation] Error during provisioning:', error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during activation',
    };
  }
}

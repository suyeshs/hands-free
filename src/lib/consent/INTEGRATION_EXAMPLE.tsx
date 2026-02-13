/**
 * Integration Example: Restaurant POS + Consent Management
 *
 * This file shows how to integrate the consent management library
 * into your existing restaurant POS application.
 */

import React, { useEffect, useState } from 'react';
import { initializeConsentManager, getConsentManager } from './ConsentManager';
import { ConsentDialog } from '@/components/consent/ConsentDialog';
import { ConsentPurpose, PrivacyRegulation, ConsentMethod } from './types';

// ============================================================================
// 1. Initialize Consent Manager at App Startup
// ============================================================================

export async function initializeConsent() {
  await initializeConsentManager({
    app_name: 'Guanix Restaurant POS',
    app_version: '1.0.0',
    organization: {
      name: 'Guanix',
      legal_name: 'Guanix Technologies Pvt Ltd',
      contact_email: 'privacy@guanix.com',
      dpo_email: 'dpo@guanix.com',
      address: 'Your business address for GDPR/DPDP compliance',
    },
    regulations: [
      PrivacyRegulation.GDPR,    // EU customers
      PrivacyRegulation.DPDP,    // India customers
      PrivacyRegulation.CCPA,    // California customers
    ],
    default_regulation: PrivacyRegulation.DPDP, // Default for India
    consent_configs: [],
    default_language: 'en',
    supported_languages: ['en', 'hi'], // English + Hindi for DPDP
    storage_backend: 'sqlite',
    encrypt_records: true,
    ui_theme: 'auto',
    ui_position: 'modal',

    // Callbacks
    on_consent_change: async (event) => {
      console.log('Consent changed:', event);

      // Example: Update analytics when consent changes
      if (event.purpose === ConsentPurpose.ANALYTICS) {
        if (event.new_status === 'granted') {
          // Enable analytics
          window.posthog?.opt_in_capturing();
        } else {
          // Disable analytics
          window.posthog?.opt_out_capturing();
        }
      }

      // Example: Update email marketing list
      if (event.purpose === ConsentPurpose.MARKETING_EMAIL) {
        if (event.new_status === 'granted') {
          await addToEmailList(event.user_id);
        } else {
          await removeFromEmailList(event.user_id);
        }
      }
    },

    on_withdrawal: async (consent) => {
      console.log('Consent withdrawn:', consent);
      // Stop processing immediately
      await stopProcessing(consent.purpose, consent.user_id);
    },

    on_expiry: async (consent) => {
      console.log('Consent expired:', consent);
      // Send renewal reminder
      await sendRenewalReminder(consent.user_id, consent.purpose);
    },
  }, 'sqlite:consent.db');
}

// ============================================================================
// 2. Show Consent Dialog on First Launch
// ============================================================================

export function FirstLaunchConsentFlow() {
  const [showConsent, setShowConsent] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  async function checkFirstLaunch() {
    const device = await getDeviceId(); // Your existing device ID logic
    setDeviceId(device);

    const manager = getConsentManager();
    const hasConsented = await manager.hasConsent(
      null, // No user ID yet (not logged in)
      device,
      ConsentPurpose.ESSENTIAL_SERVICES
    );

    if (!hasConsented) {
      setShowConsent(true);
    }
  }

  return (
    <ConsentDialog
      open={showConsent}
      onClose={() => setShowConsent(false)}
      request={{
        purposes: [
          ConsentPurpose.ESSENTIAL_SERVICES,
          ConsentPurpose.ANALYTICS,
          ConsentPurpose.LOCATION_BASED, // For restaurant location
        ],
        regulation: PrivacyRegulation.DPDP,
        device_id: deviceId,
        allow_granular: true,
        blocking: true, // Can't close until responded
      }}
      blocking={true}
      onResponse={async (response) => {
        console.log('User consented:', response);
        // Proceed with app initialization
      }}
    />
  );
}

// ============================================================================
// 3. Request Consent When Needed (Just-in-Time)
// ============================================================================

export function useConsentGuard(purpose: ConsentPurpose) {
  const [hasConsent, setHasConsent] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    checkConsent();
  }, [purpose]);

  async function checkConsent() {
    const manager = getConsentManager();
    const userId = await getCurrentUserId(); // Your auth logic
    const deviceId = await getDeviceId();

    const granted = await manager.hasConsent(userId, deviceId, purpose);
    setHasConsent(granted);

    if (!granted) {
      setShowDialog(true);
    }
  }

  return {
    hasConsent,
    showDialog,
    setShowDialog,
  };
}

// Example usage:
export function MarketingFeature() {
  const { hasConsent, showDialog, setShowDialog } = useConsentGuard(
    ConsentPurpose.MARKETING_EMAIL
  );

  if (!hasConsent) {
    return (
      <>
        <ConsentDialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
          request={{
            purposes: [ConsentPurpose.MARKETING_EMAIL],
            regulation: PrivacyRegulation.DPDP,
            device_id: 'device-123',
            allow_granular: false,
          }}
        />
        <div>Please consent to marketing emails to access this feature</div>
      </>
    );
  }

  return <div>Marketing content here...</div>;
}

// ============================================================================
// 4. Integrate with Restaurant Features
// ============================================================================

// Example: Check consent before sending order notifications
export async function sendOrderNotification(orderId: string, customerId: string) {
  const manager = getConsentManager();
  const deviceId = await getCustomerDeviceId(customerId);

  // Check if customer consented to push notifications
  const canSendPush = await manager.hasConsent(
    customerId,
    deviceId,
    ConsentPurpose.MARKETING_PUSH
  );

  if (canSendPush) {
    await sendPushNotification({
      title: 'Order Update',
      body: `Your order #${orderId} is ready!`,
      userId: customerId,
    });
  } else {
    // Fallback: Show in-app only
    console.log('Cannot send push - no consent');
  }
}

// Example: Check consent before using location
export async function getNearbyRestaurants(userId: string) {
  const manager = getConsentManager();
  const deviceId = await getDeviceId();

  const canUseLocation = await manager.hasConsent(
    userId,
    deviceId,
    ConsentPurpose.LOCATION_BASED
  );

  if (canUseLocation) {
    const location = await getCurrentLocation();
    return await searchRestaurantsByLocation(location);
  } else {
    // Fallback: Show all restaurants or ask for consent
    return await searchRestaurantsNearby('default-city');
  }
}

// Example: Check consent before analytics
export async function trackUserAction(userId: string, action: string, data: any) {
  const manager = getConsentManager();
  const deviceId = await getDeviceId();

  const canTrack = await manager.hasConsent(
    userId,
    deviceId,
    ConsentPurpose.ANALYTICS
  );

  if (canTrack) {
    // Send to your analytics service
    window.posthog?.capture(action, data);
  } else {
    console.log('Analytics tracking disabled - no consent');
  }
}

// ============================================================================
// 5. Show Privacy Settings in App
// ============================================================================

import { PrivacySettings } from '@/components/consent/PrivacySettings';

export function SettingsPage() {
  const [userId, setUserId] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  async function loadUserInfo() {
    const user = await getCurrentUserId();
    const device = await getDeviceId();
    setUserId(user);
    setDeviceId(device);
  }

  return (
    <div>
      <h1>Settings</h1>

      {/* Your existing settings */}
      <YourExistingSettings />

      {/* Add Privacy & Consent section */}
      <PrivacySettings userId={userId} deviceId={deviceId} />
    </div>
  );
}

// ============================================================================
// 6. Generate Compliance Reports (Admin Only)
// ============================================================================

import { ComplianceReport } from '@/components/consent/ComplianceReport';

export function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>

      {/* Your existing admin features */}
      <YourExistingAdmin />

      {/* Add Compliance Reporting */}
      <ComplianceReport />
    </div>
  );
}

// ============================================================================
// 7. Handle Data Subject Requests
// ============================================================================

// Customer requests data export (GDPR Article 15)
export async function handleDataAccessRequest(userId: string) {
  const manager = getConsentManager();

  // Create formal request
  const requestId = await manager.createDataSubjectRequest('access', userId, {
    source: 'customer_support',
    ticket_id: 'TICKET-123',
  });

  // Export all data
  const data = await manager.exportUserData(userId);

  // Include POS-specific data
  const posData = {
    consent_data: data,
    orders: await getCustomerOrders(userId),
    preferences: await getCustomerPreferences(userId),
    loyalty_points: await getLoyaltyPoints(userId),
  };

  // Send to customer
  await emailDataExport(userId, posData);

  console.log('Data access request completed:', requestId);
}

// Customer requests account deletion (GDPR Article 17)
export async function handleDataErasureRequest(userId: string) {
  const manager = getConsentManager();

  // Create formal request
  const requestId = await manager.createDataSubjectRequest('erasure', userId, {
    source: 'customer_support',
    reason: 'Customer requested account deletion',
  });

  // Erase consent data
  await manager.eraseUserData(userId, 'GDPR Article 17 - Right to Erasure');

  // Erase POS-specific data
  await anonymizeCustomerOrders(userId);
  await deleteCustomerAccount(userId);
  await removeFromLoyaltyProgram(userId);

  console.log('Data erasure request completed:', requestId);
}

// ============================================================================
// 8. Sync Consents with Cloud (D1)
// ============================================================================

export async function syncConsentsToCloud() {
  const manager = getConsentManager();

  // Get all consents (they're already encrypted if encrypt_records: true)
  const deviceId = await getDeviceId();
  const consents = await manager.getActiveConsents(null, deviceId);

  // Sync to your D1 database via worker
  await fetch('https://your-worker.com/sync/consents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': await getTenantId(),
    },
    body: JSON.stringify({
      consents: Array.from(consents.values()),
      device_id: deviceId,
      synced_at: Date.now(),
    }),
  });

  console.log('Consents synced to cloud');
}

// ============================================================================
// Helper functions (implement these based on your app)
// ============================================================================

async function getDeviceId(): Promise<string> {
  // Your existing device ID logic
  return 'device-123';
}

async function getCurrentUserId(): Promise<string> {
  // Your existing auth logic
  return 'user-456';
}

async function addToEmailList(userId?: string) {
  // Add to your email marketing service
  console.log('Added to email list:', userId);
}

async function removeFromEmailList(userId?: string) {
  // Remove from your email marketing service
  console.log('Removed from email list:', userId);
}

async function stopProcessing(purpose: ConsentPurpose, userId?: string) {
  // Stop processing for this purpose
  console.log('Stopped processing:', purpose, userId);
}

async function sendRenewalReminder(userId?: string, purpose?: ConsentPurpose) {
  // Send renewal reminder
  console.log('Renewal reminder:', userId, purpose);
}

async function getCustomerDeviceId(customerId: string): Promise<string> {
  // Get device ID for customer
  return 'device-123';
}

async function searchRestaurantsByLocation(location: any) {
  // Your location search logic
  return [];
}

async function searchRestaurantsNearby(city: string) {
  // Your search logic
  return [];
}

async function getCurrentLocation() {
  // Your location logic
  return { lat: 0, lng: 0 };
}

async function getCustomerOrders(userId: string) {
  // Your orders logic
  return [];
}

async function getCustomerPreferences(userId: string) {
  // Your preferences logic
  return {};
}

async function getLoyaltyPoints(userId: string) {
  // Your loyalty logic
  return 0;
}

async function emailDataExport(userId: string, data: any) {
  // Email the data export
  console.log('Emailing data export to:', userId);
}

async function anonymizeCustomerOrders(userId: string) {
  // Anonymize orders
  console.log('Anonymizing orders for:', userId);
}

async function deleteCustomerAccount(userId: string) {
  // Delete account
  console.log('Deleting account:', userId);
}

async function removeFromLoyaltyProgram(userId: string) {
  // Remove from loyalty
  console.log('Removing from loyalty:', userId);
}

async function getTenantId(): Promise<string> {
  // Your tenant ID logic
  return 'tenant-123';
}

async function sendPushNotification(notification: any) {
  // Your push notification logic
  console.log('Sending push:', notification);
}

function YourExistingSettings() {
  return <div>Your existing settings...</div>;
}

function YourExistingAdmin() {
  return <div>Your existing admin...</div>;
}

// ============================================================================
// That's it! You now have a fully compliant consent management system
// integrated with your restaurant POS.
// ============================================================================

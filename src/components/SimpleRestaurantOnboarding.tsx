/**
 * Simple Restaurant Onboarding
 * Matches the admin panel's UI for creating a restaurant
 * Now with multilingual support
 */

import { useState, useEffect } from 'react';
import { StoreCreationModal } from './StoreCreationModal';
import { useLanguageStore, SUPPORTED_LANGUAGES, type SupportedLanguage, type LanguageInfo } from '../stores/languageStore';
import { useTranslations } from '../hooks/useTranslations';
import { useSetupWizardStore } from '../stores/setupWizardStore';

// Country to languages mapping
const COUNTRY_LANGUAGES: Record<string, SupportedLanguage[]> = {
  // North America
  US: ['en', 'es'], // English, Spanish
  CA: ['en', 'fr'], // English, French
  MX: ['es', 'en'], // Spanish, English

  // Europe
  FR: ['fr', 'en'], // French, English
  DE: ['de', 'en'], // German, English
  ES: ['es', 'en'], // Spanish, English
  IT: ['it', 'en'], // Italian, English
  GB: ['en'], // English
  IE: ['en'], // English

  // Southeast Asia
  TH: ['th', 'en'], // Thai, English
  VN: ['vi', 'en'], // Vietnamese, English
  ID: ['id', 'en'], // Indonesian, English
  MY: ['ms', 'en'], // Malay, English
  SG: ['en', 'ms'], // English, Malay

  // India
  IN: ['en', 'hi', 'ta', 'te', 'bn', 'mr'], // English + Indian languages

  // Default (always show English)
  DEFAULT: ['en'],
};

interface FormData {
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  pincode: string;
  restaurantType: string; // Casual Dining, Fine Dining, etc.
  subdomain: string;
}

interface FormErrors {
  restaurantName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  city?: string;
  pincode?: string;
  restaurantType?: string;
  subdomain?: string;
}

interface SimpleRestaurantOnboardingProps {
  onComplete: (activationCode: string) => void;
  onCancel: () => void;
}

export function SimpleRestaurantOnboarding({ onComplete, onCancel }: SimpleRestaurantOnboardingProps) {
  const { currentLanguage, setLanguage } = useLanguageStore();
  const { t } = useTranslations('onboarding');

  const [formData, setFormData] = useState<FormData>({
    restaurantName: '',
    ownerName: '',
    email: '',
    phone: '',
    city: '',
    pincode: '',
    restaurantType: 'CASUAL_DINING', // Default restaurant type
    subdomain: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([]);
  const [detectingCountry, setDetectingCountry] = useState(true);

  // Detect country and set available languages
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Use ipapi.co for free geo-location
        const response = await fetch('https://ipapi.co/json/', {
          signal: AbortSignal.timeout(3000), // 3 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          const countryCode = data.country_code as string;

          console.log('[Onboarding] Detected country:', countryCode);

          // Get languages for this country (or default)
          const langCodes = COUNTRY_LANGUAGES[countryCode] || COUNTRY_LANGUAGES.DEFAULT;

          // Map to LanguageInfo objects
          const langs = langCodes
            .map(code => SUPPORTED_LANGUAGES.find(l => l.code === code))
            .filter((l): l is LanguageInfo => l !== undefined);

          setAvailableLanguages(langs);

          // Set default language to first in list if current language not available
          if (langs.length > 0 && !langCodes.includes(currentLanguage)) {
            await setLanguage(langs[0].code);
          }
        } else {
          throw new Error('Geo-location API failed');
        }
      } catch (error) {
        console.warn('[Onboarding] Country detection failed, defaulting to English:', error);
        // Default to English only
        const english = SUPPORTED_LANGUAGES.find(l => l.code === 'en');
        if (english) {
          setAvailableLanguages([english]);
        }
      } finally {
        setDetectingCountry(false);
      }
    };

    detectCountry();
  }, []);

  // Generate subdomain from restaurant name with random number
  const generateSubdomain = (name: string): string => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20); // Limit to 20 chars

    // Add random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${slug}-${randomNum}`;
  };

  // Debounced subdomain availability check
  useEffect(() => {
    if (!formData.subdomain || formData.subdomain.length < 3) {
      setSubdomainStatus('idle');
      return;
    }

    setSubdomainStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const platformApiUrl = import.meta.env.VITE_PLATFORM_API_URL || 'https://handsfree-admin.pages.dev';
        const response = await fetch(
          `${platformApiUrl}/api/tenants/check-subdomain?subdomain=${formData.subdomain}`,
          { timeout: 5000 } as any
        );
        const data = await response.json();
        setSubdomainStatus(data.available ? 'available' : 'unavailable');

        if (!data.available) {
          setErrors((prev) => ({
            ...prev,
            subdomain: 'This subdomain is already taken',
          }));
        } else {
          setErrors((prev) => {
            const { subdomain, ...rest } = prev;
            return rest;
          });
        }
      } catch (error) {
        console.error('Subdomain check failed:', error);
        setSubdomainStatus('available'); // Assume available if check fails
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.subdomain]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Restaurant name
    if (!formData.restaurantName.trim()) {
      newErrors.restaurantName = 'Restaurant name is required';
    }

    // Owner Name
    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner Name is required';
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    // City
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    // Pincode
    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (formData.pincode.length !== 6) {
      newErrors.pincode = 'Pincode must be 6 digits';
    }

    // Restaurant Type
    if (!formData.restaurantType) {
      newErrors.restaurantType = 'Restaurant type is required';
    }

    // Subdomain
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = 'Subdomain is required';
    } else if (!subdomainRegex.test(formData.subdomain)) {
      newErrors.subdomain = 'Subdomain must contain only lowercase letters, numbers, and hyphens';
    } else if (subdomainStatus === 'unavailable') {
      newErrors.subdomain = 'This subdomain is already taken';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.log('[Restaurant Onboarding] Submission already in progress, ignoring duplicate');
      return;
    }

    if (validateForm()) {
      setIsSubmitting(true);
      setShowCreationModal(true);
    }
  };

  const createRestaurant = async () => {
    // Use the new dedicated provisioning worker
    const provisioningUrl = import.meta.env.VITE_PROVISIONING_URL ||
      'https://handsfree-restaurant-provisioning.suyesh.workers.dev';

    const requestData = {
      companyName: formData.restaurantName,
      ownerName: formData.ownerName,
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      pincode: formData.pincode,
      tenantId: formData.subdomain,
      businessCategory: 'RESTAURANT', // Fixed value for multi-industry platform
      restaurantType: formData.restaurantType, // Specific restaurant type (Casual Dining, Fine Dining, etc.)
    };

    console.log('='.repeat(80));
    console.log('[Restaurant Onboarding] 🚀 PROVISIONING REQUEST');
    console.log('[Restaurant Onboarding] Timestamp:', new Date().toISOString());
    console.log('[Restaurant Onboarding] Tenant ID:', requestData.tenantId);
    console.log('[Restaurant Onboarding] Company Name:', requestData.companyName);
    console.log('[Restaurant Onboarding] Full Payload:', JSON.stringify(requestData, null, 2));
    console.log('[Restaurant Onboarding] API URL:', `${provisioningUrl}/api/provision`);
    console.log('='.repeat(80));

    // Create AbortController with 3-minute timeout
    // NOTE: Provisioning takes 2-3 minutes (creating D1, KV, R2, DNS, etc.)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[Restaurant Onboarding] ⚠️ Request timeout after 3 minutes');
      controller.abort();
    }, 180000); // 3 minutes - provisioning typically takes 2-3 minutes

    try {
      const response = await fetch(`${provisioningUrl}/api/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      console.log('='.repeat(80));
      console.log('[Restaurant Onboarding] 📥 PROVISIONING RESPONSE');
      console.log('[Restaurant Onboarding] Status:', response.status, response.statusText);
      console.log('[Restaurant Onboarding] Headers:', Object.fromEntries(response.headers.entries()));
      console.log('='.repeat(80));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Restaurant Onboarding] ===== API ERROR =====');
        console.error('[Restaurant Onboarding] Status:', response.status);
        console.error('[Restaurant Onboarding] Status Text:', response.statusText);
        console.error('[Restaurant Onboarding] Error response body:', errorText);
        console.error('[Restaurant Onboarding] ===============================');
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to create restaurant');
        } catch (e) {
          throw new Error(`Failed to create restaurant (${response.status}): ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('[Restaurant Onboarding] Success response:', result);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);

      console.error('[Restaurant Onboarding] ❌ Provisioning request failed');
      console.error('[Restaurant Onboarding] Error:', error);

      if (error.name === 'AbortError') {
        throw new Error(
          '⏱️ PROVISIONING TIMEOUT\n\n' +
          'Restaurant provisioning took longer than expected (>3 minutes).\n\n' +
          'This usually means the provisioning worker is overloaded or experiencing issues.\n\n' +
          'Your restaurant may still be created - please check:\n' +
          '• Cloudflare Dashboard → Workers & Pages\n' +
          '• Worker logs for errors\n' +
          '• Try again in a few minutes\n\n' +
          'If this persists, contact support with the timestamp:\n' +
          new Date().toISOString()
        );
      }

      // Check for common fetch errors
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Load failed')) {
        throw new Error(
          '🔌 NETWORK ERROR\n\n' +
          'Unable to connect to the provisioning server.\n\n' +
          'Please check:\n' +
          '• Your internet connection\n' +
          '• Firewall or proxy settings\n' +
          '• VPN configuration\n\n' +
          `Target server: ${provisioningUrl}`
        );
      }

      throw error;
    }
  };

  const handleCreationComplete = async (activationCode: string, tenantData?: any) => {
    console.log('[Restaurant Onboarding] Creation complete, auto-activating with code:', activationCode);
    console.log('[Restaurant Onboarding] Tenant data from backend:', tenantData);
    console.log('[Restaurant Onboarding] Tenant object:', tenantData?.tenant);
    console.log('[Restaurant Onboarding] Database ID (d1DatabaseId):', tenantData?.tenant?.database_id);
    console.log('[Restaurant Onboarding] Status:', tenantData?.status);
    console.log('[Restaurant Onboarding] Closing creation modal and form');

    // Store activation code and WebSocket URL in SQLite
    const { setActivationCode, setProvisioningWebSocketUrl } = useSetupWizardStore.getState();

    await setActivationCode(activationCode);
    console.log('[Restaurant Onboarding] Stored activation code in SQLite:', activationCode);

    if (tenantData?.provisioningWebSocket) {
      await setProvisioningWebSocketUrl(tenantData.provisioningWebSocket);
      console.log('[Restaurant Onboarding] Stored provisioning WebSocket URL in SQLite:', tenantData.provisioningWebSocket);
    }

    setIsSubmitting(false); // Reset submission state on success

    // CRITICAL: Save restaurant settings to SQLite FIRST
    // This prevents routing loop when app reloads
    try {
      console.log('[Restaurant Onboarding] 💾 Saving restaurant settings to SQLite...');
      const { useRestaurantSettingsStore } = await import('../stores/restaurantSettingsStore');
      const restaurantSettingsStore = useRestaurantSettingsStore.getState();

      const settings: any = {
        name: formData.restaurantName,
        ownerName: formData.ownerName,
        tagline: '',
        address: {
          line1: '',
          line2: '',
          city: formData.city,
          state: '',
          pincode: formData.pincode,
        },
        phone: formData.phone,
        email: formData.email,
        website: '',
      };

      await restaurantSettingsStore.updateSettings(settings);
      console.log('[Restaurant Onboarding] ✅ Settings saved to SQLite');

      // Also mark wizard as complete
      const { useSetupWizardStore } = await import('../stores/setupWizardStore');
      useSetupWizardStore.setState({
        isComplete: true,
        completedAt: new Date().toISOString(),
        awaitingActivation: false,
      });
      await useSetupWizardStore.getState().saveToSQLite();
      console.log('[Restaurant Onboarding] ✅ Wizard marked complete in SQLite');
    } catch (error) {
      console.error('[Restaurant Onboarding] ❌ Failed to save settings:', error);
    }

    // Store tenant metadata locally including Cloudflare resources
    try {
      // Extract tenant data from response
      // New async provisioning returns flat structure, old sync had nested .tenant
      const tenant = tenantData?.tenant || tenantData;
      const storage = tenantData?.storage || {};

      console.log('[Restaurant Onboarding] ===== STORING TENANT METADATA =====');
      console.log('[Restaurant Onboarding] Extracting from tenantData:', {
        hasTenant: !!tenantData?.tenant,
        hasStorage: !!storage,
        tenantId: tenant?.tenantId,
        subdomain: tenant?.subdomain,
      });

      const cloudflareResources = {
        kvNamespaceId: storage.kvNamespaceData || tenant.kv_namespace_id,
        kvCacheId: storage.kvNamespaceCache,
        kvSessionsId: storage.kvNamespaceSessions,
        r2BucketName: tenant.r2_bucket_name || storage.r2BucketName,
        d1DatabaseId: tenant.database_id || storage.d1DatabaseId,
        d1DatabaseName: tenant.d1_database_name || storage.d1DatabaseName,
      };

      console.log('[Restaurant Onboarding] Cloudflare resources to store:');
      console.log('[Restaurant Onboarding]   KV Namespace:', cloudflareResources.kvNamespaceId);
      console.log('[Restaurant Onboarding]   KV Cache:', cloudflareResources.kvCacheId);
      console.log('[Restaurant Onboarding]   KV Sessions:', cloudflareResources.kvSessionsId);
      console.log('[Restaurant Onboarding]   R2 Bucket:', cloudflareResources.r2BucketName);
      console.log('[Restaurant Onboarding]   D1 Database:', cloudflareResources.d1DatabaseId);
      console.log('[Restaurant Onboarding]   D1 DB Name:', cloudflareResources.d1DatabaseName);
      console.log('[Restaurant Onboarding] ===============================================');

      const { storeTenantMetadata } = await import('../services/tenantProvisioning');
      await storeTenantMetadata({
        tenantId: formData.subdomain,
        companyName: formData.restaurantName,
        email: formData.email,
        phone: formData.phone,
        businessCategory: 'CASUAL_DINING', // Use as fallback for old tenantProvisioning system
        subdomain: tenant.subdomain || formData.subdomain,
        activationCode,
        status: 'PROVISIONED',

        // Extract Cloudflare resources from actual backend response structure
        cloudflareResources,

        setupProgress: {
          provisioned: true,
          menuUploaded: false,
          photosUploaded: false,
          detailsCompleted: false,
          staffAdded: false,
          testOrderCompleted: false,
        },

        createdAt: tenant.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('[Restaurant Onboarding] ✅ Stored tenant metadata with Cloudflare resources locally');
    } catch (error) {
      console.error('[Restaurant Onboarding] Failed to store tenant metadata:', error);
    }

    // Close the creation modal
    setShowCreationModal(false);

    // Auto-activate the tenant and redirect to hub as restaurant owner
    // The activation code is already stored in localStorage by StoreCreationModal
    // Just trigger completion which will activate the tenant
    console.log('[Restaurant Onboarding] Calling parent onComplete to start activation');
    onComplete(activationCode);
  };

  const handleCreationError = (error: string) => {
    console.error('Restaurant creation error:', error);
    setShowCreationModal(false);
    setIsSubmitting(false); // Reset submission state
    alert(`Failed to create restaurant: ${error}`);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-0 z-50">
      <div className="w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] flex flex-col">
        {/* Main Content Card - Flat, No Rounded Corners */}
        <div className="bg-zinc-900 border border-white/5 shadow-2xl flex flex-col md:flex-row h-full overflow-hidden">

          {/* Header Section (Left Side) */}
          <div className="md:w-1/3 bg-zinc-950 p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5">
            <div>
              <button
                type="button"
                onClick={onCancel}
                className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-orange-500 transition-colors group uppercase tracking-widest text-xs font-bold"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                Create Your<br />Restaurant
              </h1>
              <p className="text-zinc-400 text-lg font-light leading-relaxed">
                {t('getStarted') || 'Get started with voice-powered ordering in minutes.'}
              </p>
            </div>

            {/* Language Selector */}
            {!detectingCountry && availableLanguages.length > 1 && (
              <div className="mt-8">
                <label className="block text-xs uppercase tracking-widest text-zinc-600 mb-2 font-bold">Language</label>
                <div className="relative inline-block w-full">
                  <select
                    value={currentLanguage}
                    onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                    className="w-full appearance-none bg-zinc-900 border border-zinc-800 px-4 py-3 text-zinc-300 focus:outline-none focus:border-orange-500/50 focus:bg-zinc-900 transition-colors cursor-pointer"
                  >
                    {availableLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.nativeName}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Section (Right Side) */}
          <div className="flex-1 bg-zinc-900 p-8 md:p-12 overflow-y-auto">
            <form onSubmit={handleSubmit} className="h-full flex flex-col justify-center max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                {/* Restaurant Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    {t('restaurantName') || 'Restaurant Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.restaurantName}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        restaurantName: name,
                        subdomain: name ? generateSubdomain(name) : '',
                      }));
                    }}
                    placeholder={t('restaurantNamePlaceholder') || 'Your Restaurant/ Chain Name'}
                    className={`w-full px-4 py-3 bg-black/20 border ${errors.restaurantName ? 'border-red-500/50' : 'border-white/10'
                      } text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all`}
                  />
                  {errors.restaurantName && (
                    <p className="text-red-500 text-xs mt-1">{errors.restaurantName}</p>
                  )}
                </div>

                {/* Owner Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    {t('ownerName') || 'Owner Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ownerName: e.target.value }))
                    }
                    placeholder={t('ownerNamePlaceholder') || 'John Doe'}
                    className={`w-full px-4 py-3 bg-black/20 border ${errors.ownerName ? 'border-red-500/50' : 'border-white/10'
                      } text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all`}
                  />
                  {errors.ownerName && (
                    <p className="text-red-500 text-xs mt-1">{errors.ownerName}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    {t('email') || 'Email'}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder={t('emailPlaceholder') || 'owner@restaurant.com'}
                    className={`w-full px-4 py-3 bg-black/20 border ${errors.email ? 'border-red-500/50' : 'border-white/10'
                      } text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all`}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    {t('phone') || 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder={t('phonePlaceholder') || '+1234567890'}
                    className={`w-full px-4 py-3 bg-black/20 border ${errors.phone ? 'border-red-500/50' : 'border-white/10'
                      } text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all`}
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    City <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, city: e.target.value }))
                    }
                    placeholder="Mumbai"
                    className={`w-full px-4 py-3 bg-black/20 border ${errors.city ? 'border-red-500/50' : 'border-white/10'
                      } text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all`}
                  />
                  {errors.city && (
                    <p className="text-red-500 text-xs mt-1">{errors.city}</p>
                  )}
                </div>

                {/* Pincode */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    Pincode <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, pincode: e.target.value }))
                    }
                    placeholder="400001"
                    maxLength={6}
                    className={`w-full px-4 py-3 bg-black/20 border ${errors.pincode ? 'border-red-500/50' : 'border-white/10'
                      } text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all`}
                  />
                  {errors.pincode && (
                    <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>
                  )}
                </div>

                {/* Restaurant Type */}
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    Restaurant Type <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.restaurantType}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, restaurantType: e.target.value }))
                      }
                      className={`w-full appearance-none px-4 py-3 bg-black/20 border ${errors.restaurantType ? 'border-red-500/50' : 'border-white/10'
                        } text-white focus:outline-none focus:border-orange-500 focus:bg-black/40 transition-all cursor-pointer`}
                    >
                      <option value="CASUAL_DINING">Casual Dining Restaurant</option>
                      <option value="FINE_DINING">Fine Dining Restaurant</option>
                      <option value="CAFE">Cafe / Coffee Shop</option>
                      <option value="QUICK_SERVICE">Quick Service / Fast Food</option>
                      <option value="CLOUD_KITCHEN">Cloud Kitchen / Ghost Kitchen</option>
                      <option value="BAR_PUB">Bar / Pub</option>
                      <option value="BAKERY">Bakery / Patisserie</option>
                      <option value="FOOD_TRUCK">Food Truck / Mobile</option>
                      <option value="CATERING">Catering Service</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {errors.restaurantType && (
                    <p className="text-red-500 text-xs mt-1">{errors.restaurantType}</p>
                  )}
                </div>

                {/* Subdomain */}
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                    {t('subdomain') || 'Subdomain (Auto-generated)'}
                  </label>
                  <div className="flex gap-0">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={formData.subdomain}
                        readOnly
                        placeholder={t('subdomainPlaceholder') || 'Will be generated from restaurant name'}
                        className={`w-full px-4 py-3 pr-12 bg-black/20 border-y border-l ${errors.subdomain ? 'border-red-500/50' : 'border-white/10'
                          } text-zinc-400 placeholder:text-zinc-700 cursor-not-allowed`}
                      />
                      {subdomainStatus === 'checking' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                      )}
                      {subdomainStatus === 'available' && (
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {subdomainStatus === 'unavailable' && (
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    {formData.restaurantName && (
                      <button
                        type="button"
                        onClick={() => {
                          const newSubdomain = generateSubdomain(formData.restaurantName);
                          console.log('[Restaurant Onboarding] 🔄 Regenerating subdomain:', newSubdomain);
                          setFormData((prev) => ({
                            ...prev,
                            subdomain: newSubdomain,
                          }));
                        }}
                        className="px-6 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap text-sm font-medium border-l-0"
                        title="Generate a new random subdomain"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                  {errors.subdomain && (
                    <p className="text-red-500 text-xs mt-1">{errors.subdomain}</p>
                  )}
                  <p className="text-zinc-600 text-xs mt-2 font-mono">
                    {formData.subdomain || 'your-subdomain'}.handsfree.tech
                  </p>
                </div>

              </div>

              {/* Submit Button */}
              <div className="mt-12">
                <button
                  type="submit"
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold tracking-wider uppercase shadow-lg shadow-orange-900/20 hover:shadow-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  disabled={isSubmitting || subdomainStatus === 'checking' || subdomainStatus === 'unavailable'}
                >
                  {isSubmitting ? 'Creating...' : (t('createButton') || 'Create Restaurant')}
                </button>
                <p className="text-center text-zinc-600 text-xs mt-6">
                  {t('termsAgreement') || 'By creating a restaurant, you agree to our Terms of Service.'}
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Store Creation Modal */}
      {showCreationModal && (
        <StoreCreationModal
          isOpen={showCreationModal}
          onClose={() => setShowCreationModal(false)}
          onComplete={handleCreationComplete}
          onError={handleCreationError}
          createStoreFn={createRestaurant}
        />
      )}
    </div>
  );
}

export default SimpleRestaurantOnboarding;

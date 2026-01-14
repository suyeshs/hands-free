/**
 * Simple Restaurant Onboarding
 * Matches the admin panel's UI for creating a restaurant
 */

import { useState, useEffect } from 'react';
import { StoreCreationModal } from './StoreCreationModal';

interface FormData {
  restaurantName: string;
  email: string;
  phone: string;
  subdomain: string;
}

interface FormErrors {
  restaurantName?: string;
  email?: string;
  phone?: string;
  subdomain?: string;
}

interface SimpleRestaurantOnboardingProps {
  onComplete: (activationCode: string) => void;
  onCancel: () => void;
}

export function SimpleRestaurantOnboarding({ onComplete, onCancel }: SimpleRestaurantOnboardingProps) {
  const [formData, setFormData] = useState<FormData>({
    restaurantName: '',
    email: '',
    phone: '',
    subdomain: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');

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
    if (validateForm()) {
      setShowCreationModal(true);
    }
  };

  const createRestaurant = async () => {
    const platformApiUrl = import.meta.env.VITE_PLATFORM_API_URL || 'https://handsfree-admin.pages.dev';

    const response = await fetch(`${platformApiUrl}/api/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: formData.restaurantName,
        email: formData.email,
        phone: formData.phone,
        tenantId: formData.subdomain,
        businessCategory: 'RESTAURANT',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create restaurant');
    }

    const result = await response.json();
    return result;
  };

  const handleCreationComplete = (activationCode: string) => {
    console.log('[Restaurant Onboarding] Creation complete, activation code:', activationCode);
    onComplete(activationCode);
  };

  const handleCreationError = (error: string) => {
    console.error('Restaurant creation error:', error);
    setShowCreationModal(false);
    alert(`Failed to create restaurant: ${error}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-panel rounded-2xl border border-border p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏪</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-wider mb-2">
              Create Your Restaurant
            </h1>
            <p className="text-muted-foreground text-sm">
              Get started with HandsFree POS in minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Restaurant Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Restaurant Name
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
                placeholder="The Coorg Food Company"
                className={`w-full p-4 rounded-xl bg-white/5 border ${
                  errors.restaurantName ? 'border-red-500' : 'border-white/10'
                } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
              />
              {errors.restaurantName && (
                <p className="text-red-400 text-xs mt-1">{errors.restaurantName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="owner@restaurant.com"
                className={`w-full p-4 rounded-xl bg-white/5 border ${
                  errors.email ? 'border-red-500' : 'border-white/10'
                } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+91 98765 43210"
                className={`w-full p-4 rounded-xl bg-white/5 border ${
                  errors.phone ? 'border-red-500' : 'border-white/10'
                } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
              />
              {errors.phone && (
                <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Subdomain */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Subdomain (Auto-generated)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.subdomain}
                  readOnly
                  placeholder="Will be generated from restaurant name"
                  className={`w-full p-4 pr-12 rounded-xl bg-white/5 border ${
                    errors.subdomain ? 'border-red-500' : 'border-white/10'
                  } text-foreground/80 cursor-not-allowed`}
                />
                {subdomainStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
                )}
                {subdomainStatus === 'available' && (
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {subdomainStatus === 'unavailable' && (
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              {errors.subdomain && (
                <p className="text-red-400 text-xs mt-1">{errors.subdomain}</p>
              )}
              <p className="text-muted-foreground/50 text-xs mt-1">
                Your restaurant will be at: {formData.subdomain || 'your-subdomain'}.handsfree.tech
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={subdomainStatus === 'checking' || subdomainStatus === 'unavailable'}
                className="flex-1 py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all"
              >
                Create Restaurant
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-muted-foreground/60 text-sm mt-6">
          By creating a restaurant, you agree to our Terms of Service
        </p>
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

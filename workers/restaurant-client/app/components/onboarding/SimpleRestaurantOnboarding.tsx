'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { GlassCard } from '../ui/GlassCard';
import { StoreCreationModal } from './StoreCreationModal';
import { validatePhone } from '../../lib/validation/phone';
import { fetchWithTimeout } from '../../lib/api/fetchWithTimeout';
import { Loader2, Check, X } from 'lucide-react';

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

export function SimpleRestaurantOnboarding() {
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
      .substring(0, 20); // Limit to 20 chars to leave room for number

    // Add random 4-digit number to ensure uniqueness
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
        const response = await fetchWithTimeout(
          `/api/tenants/check-subdomain?subdomain=${formData.subdomain}`,
          {},
          5000
        );
        const data = await response.json() as { available: boolean };
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
        setSubdomainStatus('idle');
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
    const phoneValidation = validatePhone(formData.phone);
    if (!phoneValidation.valid) {
      newErrors.phone = phoneValidation.error;
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
    const phoneValidation = validatePhone(formData.phone);

    const response = await fetchWithTimeout(
      '/api/tenants',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.restaurantName,
          email: formData.email,
          phone: phoneValidation.formatted,
          tenantId: formData.subdomain,
          businessCategory: 'RESTAURANT',
          isActive: false, // Will be activated after setup
          provisionWithDemoData: true, // Provision with demo menu, theme, and AI config
        }),
      },
      30000 // 30 second timeout for provisioning
    );

    if (!response.ok) {
      const errorData = await response.json() as { error?: string };
      throw new Error(errorData.error || 'Failed to create restaurant');
    }

    const result = await response.json() as any;
    // Restaurant created successfully - result.tenant contains tenant info
    return result;
  };

  const handleCreationComplete = () => {
    // Redirect to the restaurant's own admin interface on their subdomain
    const subdomain = formData.subdomain;
    const redirectUrl = `https://${subdomain}.handsfree.tech/admin`;
    console.log('[Restaurant Onboarding] Redirecting to restaurant admin:', redirectUrl);
    window.location.href = redirectUrl;
  };

  const handleCreationError = (error: string) => {
    console.error('Restaurant creation error:', error);
    setShowCreationModal(false);
    alert(`Failed to create restaurant: ${error}`);
  };

  return (
    <div className="min-h-screen bg-warm-charcoal bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <GlassCard variant="panel" className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold font-display text-saffron mb-2">
              Create Your Restaurant
            </h1>
            <p className="text-warm-white/70">
              Get started with voice-powered ordering in minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Restaurant Name */}
            <div>
              <Label htmlFor="restaurantName" className="text-warm-white/90">Restaurant Name</Label>
              <Input
                id="restaurantName"
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
                className={`bg-white/[0.03] border-white/[0.08] text-warm-white placeholder:text-warm-white/50 focus:border-saffron focus:shadow-warm-glow ${errors.restaurantName ? 'border-paprika-light' : ''}`}
              />
              {errors.restaurantName && (
                <p className="text-paprika-light text-sm mt-1">
                  {errors.restaurantName}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-warm-white/90">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="owner@restaurant.com"
                className={`bg-white/[0.03] border-white/[0.08] text-warm-white placeholder:text-warm-white/50 focus:border-saffron focus:shadow-warm-glow ${errors.email ? 'border-paprika-light' : ''}`}
              />
              {errors.email && (
                <p className="text-paprika-light text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone" className="text-warm-white/90">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+1234567890"
                className={`bg-white/[0.03] border-white/[0.08] text-warm-white placeholder:text-warm-white/50 focus:border-saffron focus:shadow-warm-glow ${errors.phone ? 'border-paprika-light' : ''}`}
              />
              {errors.phone && (
                <p className="text-paprika-light text-sm mt-1">{errors.phone}</p>
              )}
              <p className="text-warm-white/50 text-xs mt-1">
                International format (e.g., +1234567890)
              </p>
            </div>

            {/* Subdomain */}
            <div>
              <Label htmlFor="subdomain" className="text-warm-white/90">Subdomain (Auto-generated)</Label>
              <div className="relative">
                <Input
                  id="subdomain"
                  type="text"
                  value={formData.subdomain}
                  readOnly
                  placeholder="Will be generated from restaurant name"
                  className={`pr-10 bg-white/[0.02] border-white/[0.08] text-warm-white/80 placeholder:text-warm-white/40 cursor-not-allowed ${errors.subdomain ? 'border-paprika-light' : ''}`}
                />
                {subdomainStatus === 'checking' && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
                {subdomainStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-honey" />
                )}
                {subdomainStatus === 'unavailable' && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-paprika" />
                )}
              </div>
              {errors.subdomain && (
                <p className="text-paprika-light text-sm mt-1">{errors.subdomain}</p>
              )}
              <p className="text-warm-white/50 text-xs mt-1">
                Your restaurant will be at: {formData.subdomain || 'your-subdomain'}.handsfree.tech
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-warm hover:shadow-warm-glow hover:-translate-y-1 transition-all duration-300 text-warm-white shadow-warm-glass"
              disabled={subdomainStatus === 'checking' || subdomainStatus === 'unavailable'}
            >
              Create Restaurant
            </Button>
          </form>
        </GlassCard>

        <p className="text-center text-warm-white/60 text-sm mt-6">
          By creating a restaurant, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      <StoreCreationModal
        isOpen={showCreationModal}
        onClose={() => setShowCreationModal(false)}
        onComplete={handleCreationComplete}
        onError={handleCreationError}
        createStoreFn={createRestaurant}
      />
    </div>
  );
}

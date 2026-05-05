'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { User, Phone, Mail, Loader2, Shield } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { useCustomerVerification } from '@/app/hooks/useCustomerVerification';
import { PhoneOTPStep } from './PhoneOTPStep';
import { formatToE164 } from '@/lib/phone-verification';
import { RESTAURANT_WORKER_URL } from '@/app/config/api';

interface CustomerInfoProps {
  onComplete: () => void;
  backendUrl: string;
  sessionId: string;
  isVoiceSession?: boolean;
  tenantId?: string;
  enableOTPVerification?: boolean;
  isTableOrder?: boolean;
  tableId?: string;
}

interface ReturningCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export const CustomerInfo = observer(function CustomerInfo({
  onComplete,
  backendUrl,
  sessionId,
  isVoiceSession = false,
  tenantId = 'khao-piyo-7766',
  enableOTPVerification = true,
  isTableOrder = false,
  tableId
}: CustomerInfoProps) {
  const verification = useCustomerVerification(tenantId, backendUrl);

  const [name, setName] = useState(orderStore.customer?.name || '');
  const [phone, setPhone] = useState(orderStore.customer?.phone || '');
  const [email, setEmail] = useState(orderStore.customer?.email || '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [isSearching, setIsSearching] = useState(false);
  const [returningCustomer, setReturningCustomer] = useState<ReturningCustomer | null>(null);
  const [showEmailField, setShowEmailField] = useState(false);

  const validatePhone = (p: string): boolean => /^[6-9]\d{9}$/.test(p);
  const phoneValid = phone.length === 10 && validatePhone(phone);

  // Handle auto-verification for returning customers (OTP flow)
  useEffect(() => {
    if (enableOTPVerification && verification.state === 'verified' && verification.customer) {
      console.log('[CustomerInfo] Returning customer identified:', verification.customer);
      orderStore.setCustomer({
        id: verification.customer.id,
        name: verification.customer.name || '',
        phone: verification.customer.phone,
        email: verification.customer.email
      });
      onComplete();
    }
  }, [enableOTPVerification, verification.state, verification.customer, onComplete]);

  // Sync phone input with verification hook
  useEffect(() => {
    if (enableOTPVerification) {
      verification.setPhone(phone);
    }
  }, [phone, enableOTPVerification]);

  // Auto-lookup customer when phone number is entered (voice sessions only)
  useEffect(() => {
    if (!isVoiceSession) return;
    if (!phoneValid) return;

    const lookupCustomer = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `${backendUrl}/api/restaurant/sessions/${sessionId}/customer-profile?phone=${phone}`
        );
        if (response.ok) {
          const data = await response.json() as any;
          if (data.success && data.exists) {
            console.log('[CustomerInfo] Found existing customer:', data.name);
            if (data.name && !name) setName(data.name);
            if (data.email && !email) setEmail(data.email);
            if (data.defaultAddress) {
              orderStore.setDeliveryAddress({
                formatted: data.defaultAddress.formatted,
                coordinates: data.defaultAddress.coordinates,
                placeId: data.defaultAddress.placeId,
                pincode: data.defaultAddress.pincode,
                city: data.defaultAddress.city,
                state: data.defaultAddress.state,
                apartment: data.defaultAddress.apartment,
                landmark: data.defaultAddress.landmark,
                instructions: data.defaultAddress.instructions,
              });
            }
          }
        }
      } catch (error) {
        console.error('[CustomerInfo] Failed to lookup customer:', error);
      } finally {
        setIsSearching(false);
      }
    };

    lookupCustomer();
  }, [phone, sessionId, backendUrl, isVoiceSession]);

  // Auto-lookup returning customer by phone for manual (non-voice) sessions
  useEffect(() => {
    if (isVoiceSession) return;
    if (!phoneValid) {
      setReturningCustomer(null);
      return;
    }

    let cancelled = false;
    const lookup = async () => {
      setIsSearching(true);
      try {
        const encoded = encodeURIComponent(`+91${phone}`);
        const res = await fetch(
          `${RESTAURANT_WORKER_URL}/api/customers/phone/${encoded}?tenantId=${tenantId}`
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json() as { id?: string; phone?: string; name?: string; email?: string };
          if (data.id && data.name) {
            setReturningCustomer({
              id: data.id,
              name: data.name,
              phone: data.phone || `+91${phone}`,
              email: data.email,
            });
            setName(data.name);
            if (data.email) setEmail(data.email);
            orderStore.setCustomer({
              id: data.id,
              phone: data.phone || `+91${phone}`,
              name: data.name,
              email: data.email,
            });
          } else {
            setReturningCustomer(null);
          }
        } else {
          setReturningCustomer(null);
        }
      } catch (err) {
        console.error('[CustomerInfo] Returning customer lookup failed:', err);
        if (!cancelled) setReturningCustomer(null);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    lookup();
    return () => { cancelled = true; };
  }, [phone, tenantId, isVoiceSession, phoneValid]);

  const createOrFindCustomer = async () => {
    try {
      const response = await fetch(
        `${RESTAURANT_WORKER_URL}/api/customers?tenantId=${tenantId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone.trim(),
            name: name.trim(),
            email: email.trim() || undefined
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create/find customer');
      }

      const data = await response.json() as { success?: boolean; customer?: { id: string; phone: string; name?: string; email?: string }; id?: string; phone?: string; name?: string; email?: string; customerId?: string };
      const customer = data.customer ?? { id: data.id!, phone: data.phone!, name: data.name, email: data.email };

      orderStore.setCustomer({
        id: customer.id,
        phone: customer.phone,
        name: customer.name || '',
        email: customer.email
      });

      console.log('[CustomerInfo] Customer created/found:', customer.id);
      return customer;
    } catch (error) {
      console.error('[CustomerInfo] Failed to create customer:', error);
      orderStore.setCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined
      });
      return null;
    }
  };

  const handleContinueAsReturning = () => {
    // Customer already set in orderStore during lookup
    onComplete();
  };

  const handleNotMe = () => {
    setReturningCustomer(null);
    setPhone('');
    setName('');
    setEmail('');
    setShowEmailField(false);
  };

  const handleContinue = async () => {
    const newErrors: { name?: string; phone?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await createOrFindCustomer();
    onComplete();
  };

  const _completeWithoutOTP = async () => {
    if (isVoiceSession && sessionId && backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/restaurant/sessions/${sessionId}/customer-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined
          })
        });

        if (!response.ok) {
          throw new Error('Failed to sync customer info');
        }

        console.log('[CustomerInfo] Customer synced to backend - WebSocket will update orderStore');
      } catch (error) {
        console.error('[CustomerInfo] Failed to sync customer info:', error);
        orderStore.setCustomer({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined
        });
      }
    } else {
      orderStore.setCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined
      });
    }

    onComplete();
  };

  const handleOTPVerified = async (code: string): Promise<boolean> => {
    const success = await verification.verifyOTP(code);
    if (success && verification.customer) {
      orderStore.setCustomer({
        id: verification.customer.id,
        name: verification.customer.name || name.trim(),
        phone: verification.customer.phone,
        email: verification.customer.email || email.trim() || undefined
      });

      if (isVoiceSession && sessionId && backendUrl) {
        try {
          await fetch(`${backendUrl}/api/restaurant/sessions/${sessionId}/customer-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: verification.customer.name || name.trim(),
              phone: verification.customer.phone,
              email: verification.customer.email || email.trim() || undefined
            })
          });
        } catch (error) {
          console.error('[CustomerInfo] Failed to sync verified customer:', error);
        }
      }

      onComplete();
    }
    return success;
  };

  const handleResendOTP = async () => {
    await verification.startOTP('sms');
  };

  // Show loading state while checking for returning customer (OTP flow)
  if (enableOTPVerification && verification.state === 'loading') {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-orange-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-light neu-text tracking-tight mb-2">Checking your device...</h2>
          <p className="text-sm neu-text-secondary opacity-60">
            This will only take a moment
          </p>
        </div>
      </div>
    );
  }

  // Show OTP verification step
  if (enableOTPVerification && verification.state === 'needs_otp') {
    return (
      <PhoneOTPStep
        phone={formatToE164(phone, '+91')}
        onVerify={handleOTPVerified}
        onBack={() => verification.reset()}
        onResend={handleResendOTP}
        isLoading={verification.isLoading}
        error={verification.error}
      />
    );
  }

  // Welcome Back card for returning customers (OTP disabled, non-voice)
  if (!enableOTPVerification && !isVoiceSession && returningCustomer) {
    const initial = returningCustomer.name.charAt(0).toUpperCase();
    const rawPhone = returningCustomer.phone.replace('+91', '');
    const displayPhone = rawPhone.replace(/(\d{5})(\d{5})/, '$1 $2');

    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
        {/* Header */}
        <div className="p-6 pb-4">
          <h2 className="text-2xl font-light neu-text tracking-tight">Welcome back</h2>
          <p className="text-sm neu-text-secondary opacity-60 mt-1">
            We found your account
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-white">{initial}</span>
          </div>

          {/* Name & Phone */}
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-1">
              {returningCustomer.name}
            </h3>
            <p className="text-sm text-gray-400">+91 {displayPhone}</p>
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <button
              onClick={handleContinueAsReturning}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              Continue as {returningCustomer.name.split(' ')[0]}
            </button>
            <button
              onClick={handleNotMe}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
            >
              Not {returningCustomer.name.split(' ')[0]}? Use a different number
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main form (new customer or voice session)
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <h2 className="text-2xl font-light neu-text tracking-tight">Your Details</h2>
        <p className="text-sm neu-text-secondary opacity-60 mt-1">
          {enableOTPVerification
            ? "We'll verify your phone to keep your orders secure"
            : "We need a few details to confirm your order"}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4">
        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className={`absolute left-3 top-3 w-5 h-5 ${isSearching ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPhone(value);
                if (errors.phone) setErrors({ ...errors, phone: undefined });
              }}
              placeholder="9876543210"
              maxLength={10}
              className={`w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border ${errors.phone ? 'border-red-300' : 'border-gray-200'
                } focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none`}
            />
            {isSearching && (
              <div className="absolute right-3 top-3.5">
                <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
          {errors.phone && (
            <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Name — slides in after phone is valid (progressive disclosure) */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: (phoneValid || isVoiceSession) ? '8rem' : '0', opacity: (phoneValid || isVoiceSession) ? 1 : 0 }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="John Doe"
                className={`w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border ${errors.name ? 'border-red-300' : 'border-gray-200'
                  } focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none`}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>
        </div>

        {/* Email — hidden by default, revealed via link */}
        {(isVoiceSession || showEmailField) ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email (Optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
              />
            </div>
          </div>
        ) : (
          phoneValid && (
            <button
              onClick={() => setShowEmailField(true)}
              className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
            >
              + Add email for receipt (optional)
            </button>
          )
        )}

        {/* Table Context Banner */}
        {isTableOrder && tableId && (
          <div className="bg-green-50/60 backdrop-blur-sm rounded-xl p-4 border border-green-200/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍽️</span>
              <div>
                <p className="text-sm font-medium text-green-800">
                  Ordering for Table {tableId.replace('tab-', '#')}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  Your order will be delivered to your table
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        {!phoneValid && (
          <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50">
            <p className="text-sm text-blue-700">
              We'll use this information to update you about your order status
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200/50">
        <button
          onClick={handleContinue}
          disabled={verification.isLoading}
          className={`w-full font-semibold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
            verification.isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:shadow-xl'
          }`}
        >
          {verification.isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending OTP...
            </>
          ) : enableOTPVerification ? (
            <>
              <Shield className="w-5 h-5" />
              Verify & Continue
            </>
          ) : (
            'Continue'
          )}
        </button>

        {/* Skip verification link (for testing) */}
        {enableOTPVerification && process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => {
              verification.skipVerification({
                phone: phone,
                name: name,
                email: email
              });
            }}
            className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Skip verification (dev only)
          </button>
        )}
      </div>
    </div>
  );
});

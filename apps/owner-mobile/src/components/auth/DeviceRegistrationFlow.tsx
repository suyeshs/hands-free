import { useState } from 'react';
import { PinLoginScreen } from './PinLoginScreen';
import { useAuthStore } from '../../stores/authStore';
import { Loader2, CheckCircle } from 'lucide-react';

export function DeviceRegistrationFlow() {
  const [step, setStep] = useState<'login' | 'registering' | 'complete'>('login');
  const { setAuth } = useAuthStore();

  const handlePinSuccess = async (tenantId: string) => {
    setStep('registering');

    try {
      // Mock tenant data (in production, fetch from backend)
      const tenantData = {
        'coorg-food-company-6163': {
          tenantId: 'coorg-food-company-6163',
          tenantName: 'Coorg Food Company',
          subdomain: 'coorg-food-company-6163',
          apiUrl: 'https://coorg-food-company-6163.handsfree.tech'
        },
        'test-7492': {
          tenantId: 'test-7492',
          tenantName: 'Test Restaurant',
          subdomain: 'test-7492',
          apiUrl: 'https://test-7492.handsfree.tech'
        }
      };

      const tenant = tenantData[tenantId as keyof typeof tenantData];

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Mock authentication (in production, call backend API)
      const mockSessionToken = `session_${Date.now()}`;
      const mockDeviceToken = `device_${Date.now()}`;

      // Store device token
      localStorage.setItem('deviceToken', mockDeviceToken);

      // Update auth store
      setAuth(
        mockSessionToken,
        mockDeviceToken,
        {
          id: 'owner-1',
          phone: '',
          email: '',
          role: 'owner',
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          subdomain: tenant.subdomain,
        },
        {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          subdomain: tenant.subdomain,
          apiUrl: tenant.apiUrl,
        }
      );

      setStep('complete');

      // Navigate to dashboard after brief success message
      setTimeout(() => {
        // Auth store will trigger App.tsx to show dashboard
      }, 1500);

    } catch (err: any) {
      console.error('Login error:', err);
      setStep('login');
    }
  };

  if (step === 'login') {
    return <PinLoginScreen onSuccess={handlePinSuccess} />;
  }

  if (step === 'registering') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
          <Loader2 className="w-16 h-16 animate-spin text-orange-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Registering Device
          </h2>
          <p className="text-gray-600">
            Please wait while we set up your device...
          </p>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Device Registered!
          </h2>
          <p className="text-gray-600 mb-6">
            Your device has been successfully registered
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

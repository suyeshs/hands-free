import { useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';

interface PinLoginScreenProps {
  onSuccess: (tenantId: string) => void;
}

// PIN to tenant mapping
const PIN_TO_TENANT: Record<string, { id: string; name: string }> = {
  '6163': {
    id: 'coorg-food-company-6163',
    name: 'Coorg Food Company'
  },
  '1234': {
    id: 'test-7492',
    name: 'Test Restaurant'
  }
};

export function PinLoginScreen({ onSuccess }: PinLoginScreenProps) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 4) {
      setPin(value);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    const tenant = PIN_TO_TENANT[pin];
    if (!tenant) {
      setError('Invalid PIN. Please try again.');
      setPin('');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate authentication delay
    setTimeout(() => {
      onSuccess(tenant.id);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            HandsFree Owner
          </h1>
          <p className="text-gray-600">
            Enter your PIN to access your restaurant
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Restaurant PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={handlePinChange}
                placeholder="Enter 4-digit PIN"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                disabled={isLoading}
                autoFocus
              />
              <div className="flex justify-center gap-2 mt-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all ${
                      pin.length > i ? 'bg-orange-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4 || isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg shadow-lg hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Demo PINs */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-2">Demo PINs:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded">
                <span>Coorg Food Company</span>
                <code className="font-mono font-semibold text-orange-600">6163</code>
              </div>
              <div className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded">
                <span>Test Restaurant</span>
                <code className="font-mono font-semibold text-orange-600">1234</code>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Powered by AI • HandsFree POS System
        </p>
      </div>
    </div>
  );
}

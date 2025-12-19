/**
 * Login Page Component
 * Provides email/password and PIN login options
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [mode, setMode] = useState<'email' | 'pin'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [tenantId, setTenantId] = useState(
    import.meta.env.VITE_DEFAULT_TENANT_ID || 'stonepot-main'
  );

  const navigate = useNavigate();
  const { login, loginWithPin, isLoading, error } = useAuthStore();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login({ email, password });
      // Navigate based on role will be handled by router
      navigate('/');
    } catch (err) {
      // Error is handled by store
      console.error('Login failed:', err);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await loginWithPin({ pin, tenantId });
      // Navigate based on role will be handled by router
      navigate('/');
    } catch (err) {
      // Error is handled by store
      console.error('PIN login failed:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Restaurant POS</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              mode === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Email Login
          </button>
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              mode === 'pin'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            PIN Login
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Email Login Form */}
        {mode === 'email' && (
          <form onSubmit={handleEmailLogin} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in with Email'}
            </button>
          </form>
        )}

        {/* PIN Login Form */}
        {mode === 'pin' && (
          <form onSubmit={handlePinLogin} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="tenantId"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tenant ID
                </label>
                <input
                  id="tenantId"
                  name="tenantId"
                  type="text"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="stonepot-main"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="block text-sm font-medium text-gray-700"
                >
                  PIN Code
                </label>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest"
                  placeholder="••••"
                  maxLength={4}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in with PIN'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>For assistance, contact your restaurant manager</p>
        </div>
      </div>
    </div>
  );
}

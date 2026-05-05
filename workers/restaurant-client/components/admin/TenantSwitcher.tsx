'use client';

import { useState, useRef, useEffect } from 'react';
import { useAdminAuth } from '@/components/auth/AuthProvider';

/**
 * Tenant Switcher Component
 * Allows admins to switch between multiple restaurants they have access to
 */
export default function TenantSwitcher() {
  const { user, switchTenant } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user || user.tenants.length <= 1) {
    // Don't show switcher if user has access to only one tenant
    return null;
  }

  const currentTenant = user.tenants.find(t => t.tenantId === user.currentTenantId);

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === user.currentTenantId) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      await switchTenant(tenantId);
      // switchTenant will redirect to new tenant subdomain
    } catch (error) {
      console.error('[TenantSwitcher] Switch failed:', error);
      alert('Failed to switch restaurant. Please try again.');
      setIsSwitching(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-blue-100 text-blue-700';
      case 'staff':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center space-x-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center space-x-2">
          {/* Restaurant Icon */}
          <div className="h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>

          {/* Current Restaurant Name */}
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">
              {currentTenant?.companyName || 'Select Restaurant'}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {currentTenant?.role}
            </div>
          </div>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase">Switch Restaurant</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {user.tenants.map((tenant) => (
              <button
                key={tenant.tenantId}
                onClick={() => handleSwitch(tenant.tenantId)}
                disabled={isSwitching}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  tenant.tenantId === user.currentTenantId ? 'bg-orange-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tenant.companyName}
                      </p>
                      {tenant.tenantId === user.currentTenantId && (
                        <svg className="h-4 w-4 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tenant.tenantId}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full capitalize flex-shrink-0 ${getRoleBadgeColor(tenant.role)}`}>
                    {tenant.role}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {isSwitching && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs text-gray-600">Switching restaurant...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

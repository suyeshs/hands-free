'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '../contexts/RestaurantContext';
import { CardBasedSetupFlow } from '../components/admin/card-setup/CardBasedSetupFlow';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAdminAuth } from '../../components/auth/AuthProvider';
import { SetupAssistantProvider } from '../contexts/SetupAssistantContext';
import { VoiceAssistantPanel } from '../components/setup-assistant/VoiceAssistantPanel';
import { SetupCardsGrid } from '../components/setup-assistant/SetupCardsGrid';

/**
 * Admin Landing Page
 * For restaurant owners who have already created their restaurant via handsfree-admin
 * Features:
 * - Card-based setup flow or dashboard based on completion status
 * - Voice-based agentic setup assistant in side panel
 * - Bidirectional sync between UI and voice assistant
 */
export default function AdminPage() {
  const { profile, refetch } = useRestaurant();
  const { user } = useAdminAuth();
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(true);

  // Force refetch profile on mount or when user changes
  useEffect(() => {
    console.log('[AdminPage] useEffect triggered - user:', user?.id, 'currentTenantId:', user?.currentTenantId);

    // If we have a user with a tenantId, we should ensure the profile matches
    if (user?.currentTenantId) {
      console.log('[AdminPage] Refetching profile for tenant:', user.currentTenantId);
      refetch().then(() => {
        console.log('[AdminPage] refetch() completed');
      }).catch((err) => {
        console.error('[AdminPage] refetch() failed:', err);
      });
    } else {
      refetch();
    }
  }, [user?.currentTenantId]); // Run when tenant changes

  // Determine if restaurant is fully set up
  // Check if profile exists and has a non-default name
  const isFullySetUp = profile && profile.name && profile.name.trim() !== '' && profile.name !== 'Restaurant';

  console.log('[AdminPage] Profile:', profile);
  console.log('[AdminPage] Profile name:', profile?.name);
  console.log('[AdminPage] Is Fully Set Up:', isFullySetUp);

  return (
    <ProtectedRoute>
      <SetupAssistantProvider
        tenantId={user?.currentTenantId || 'demo-restaurant'}
        restaurantName={profile?.name || 'Your Restaurant'}
      >
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Main Content Area - adjusted for side panel */}
          <div className={`transition-all duration-300 ${showVoiceAssistant ? 'mr-80' : ''}`}>
            {isFullySetUp ? (
              // Restaurant is fully configured - show admin dashboard with setup cards
              <div className="p-6">
                <AdminDashboard />
                {/* Show setup cards for quick access even when fully set up */}
                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Setup Access
                  </h2>
                  <SetupCardsGrid />
                </div>
              </div>
            ) : (
              // Restaurant was just created - show card-based setup flow
              <div className="p-6">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome to {profile?.name || 'Your Restaurant'}!
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Let&apos;s get your restaurant set up. Use the cards below or talk to our voice assistant.
                  </p>
                </div>
                <SetupCardsGrid />
                <div className="mt-8">
                  <CardBasedSetupFlow />
                </div>
              </div>
            )}
          </div>

          {/* Voice Assistant Side Panel */}
          {showVoiceAssistant && <VoiceAssistantPanel />}

          {/* Toggle Voice Assistant Button (when collapsed) */}
          {!showVoiceAssistant && (
            <button
              onClick={() => setShowVoiceAssistant(true)}
              className="fixed right-4 bottom-4 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all z-40"
              title="Open Voice Assistant"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
      </SetupAssistantProvider>
    </ProtectedRoute>
  );
}

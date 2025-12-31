/**
 * Web App Entry Point
 * This is the main component for the web version (browser/Cloudflare Pages)
 * Uses React Router for role-based navigation
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { UserRole } from './types/auth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ManagerDashboard from './pages/ManagerDashboard';
import AggregatorDashboard from './pages-v2/AggregatorDashboard';
import KitchenDashboard from './pages-v2/KitchenDashboard';
import POSDashboard from './pages-v2/POSDashboard';
import HubPage from './pages-v2/HubPage';
import { WebSocketManager } from './components/WebSocketManager';
import { AppLayout } from './components/layout-v2/AppLayout';

/**
 * Role-based default route redirect
 */
function DefaultRoute() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // All authenticated users go to the hub
  return <Navigate to="/hub" replace />;
}

function AppWeb() {
  const autoLogin = useAuthStore((state) => state.autoLogin);

  // Auto-login on mount if VITE_SKIP_AUTH is enabled
  useEffect(() => {
    autoLogin();
  }, [autoLogin]);

  return (
    <BrowserRouter>
      {/* WebSocket connection manager (active when user is authenticated) */}
      <WebSocketManager />

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Hub Page - Unified Home (all authenticated users) */}
        <Route
          path="/hub"
          element={
            <ProtectedRoute allowedRoles={[UserRole.SERVER, UserRole.KITCHEN, UserRole.AGGREGATOR, UserRole.MANAGER]}>
              <AppLayout>
                <HubPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - Manager */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
              <AppLayout>
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - Aggregator */}
        <Route
          path="/aggregator"
          element={
            <ProtectedRoute
              allowedRoles={[UserRole.AGGREGATOR, UserRole.MANAGER]}
              requiredPermission="canViewAggregators"
            >
              <AppLayout>
                <AggregatorDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - Kitchen */}
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute
              allowedRoles={[UserRole.KITCHEN, UserRole.MANAGER]}
              requiredPermission="canViewKDS"
            >
              <AppLayout>
                <KitchenDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - POS (has its own cart, no floating cart) */}
        <Route
          path="/pos"
          element={
            <ProtectedRoute
              allowedRoles={[UserRole.SERVER, UserRole.MANAGER]}
              requiredPermission="canViewPOS"
            >
              <AppLayout hideCart>
                <POSDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Default Route - Redirects to hub */}
        <Route path="/" element={<DefaultRoute />} />

        {/* 404 - Not Found */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-600">Page not found</p>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppWeb;

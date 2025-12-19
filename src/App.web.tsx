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
import AggregatorDashboard from './pages-v2/AggregatorDashboard'; // Redesigned - Neomorphic
import KitchenDashboard from './pages-v2/KitchenDashboard'; // Redesigned - Industrial POS
import POSDashboard from './pages-v2/POSDashboard'; // Redesigned - Neomorphic POS
import { WebSocketManager } from './components/WebSocketManager';

/**
 * Role-based default route redirect
 */
function DefaultRoute() {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  switch (role) {
    case UserRole.MANAGER:
      return <Navigate to="/manager" replace />;
    case UserRole.AGGREGATOR:
      return <Navigate to="/aggregator" replace />;
    case UserRole.KITCHEN:
      return <Navigate to="/kitchen" replace />;
    case UserRole.SERVER:
      return <Navigate to="/pos" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
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

        {/* Protected Routes - Manager */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
              <ManagerDashboard />
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
              <AggregatorDashboard />
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
              <KitchenDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - POS */}
        <Route
          path="/pos"
          element={
            <ProtectedRoute
              allowedRoles={[UserRole.SERVER, UserRole.MANAGER]}
              requiredPermission="canViewPOS"
            >
              <POSDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default Route - Redirects based on role */}
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

/**
 * Protected Route Component
 * Handles authentication and role-based authorization
 */

import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { UserRole, RolePermissions } from '../../types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: keyof RolePermissions;
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredPermission,
  allowedRoles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const location = useLocation();
  const {
    isAuthenticated,
    user,
    role,
    hasPermission,
    isTokenValid,
    refreshToken,
  } = useAuthStore();

  // Check if token needs refresh
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      if (isAuthenticated && !isTokenValid()) {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Failed to refresh token:', error);
          // Logout will be handled by the refreshToken function
        }
      }
    };

    checkAndRefreshToken();
  }, [isAuthenticated, isTokenValid, refreshToken]);

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if token is still valid
  if (!isTokenValid()) {
    // Token expired and refresh failed
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // User doesn't have the required role
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Your role: <span className="font-medium">{role}</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Required roles:{' '}
            <span className="font-medium">{allowedRoles.join(', ')}</span>
          </p>
        </div>
      </div>
    );
  }

  // Check permission-based access
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // User doesn't have the required permission
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required permission:{' '}
            <span className="font-medium">{requiredPermission}</span>
          </p>
        </div>
      </div>
    );
  }

  // All checks passed - render the protected content
  return <>{children}</>;
}

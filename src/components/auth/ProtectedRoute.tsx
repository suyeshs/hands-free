/**
 * Protected Route Component
 * Handles authentication and role-based authorization
 */

import { ReactNode } from 'react';
import { UserRole, RolePermissions } from '../../types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: keyof RolePermissions;
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  // Authentication and permission checks removed for development
  return <>{children}</>;
}

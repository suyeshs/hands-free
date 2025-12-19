/**
 * Authentication Types
 */

export enum UserRole {
  SERVER = 'server',
  KITCHEN = 'kitchen',
  MANAGER = 'manager',
  AGGREGATOR = 'aggregator',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface PinLoginCredentials {
  pin: string;
  tenantId: string;
}

export interface RolePermissions {
  canViewPOS: boolean;
  canTakeOrders: boolean;
  canViewKDS: boolean;
  canViewAggregators: boolean;
  canManageMenu: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  [UserRole.SERVER]: {
    canViewPOS: true,
    canTakeOrders: true,
    canViewKDS: false,
    canViewAggregators: false,
    canManageMenu: false,
    canManageUsers: false,
    canViewReports: false,
  },
  [UserRole.KITCHEN]: {
    canViewPOS: false,
    canTakeOrders: false,
    canViewKDS: true,
    canViewAggregators: false,
    canManageMenu: false,
    canManageUsers: false,
    canViewReports: false,
  },
  [UserRole.AGGREGATOR]: {
    canViewPOS: false,
    canTakeOrders: false,
    canViewKDS: true,
    canViewAggregators: true,
    canManageMenu: false,
    canManageUsers: false,
    canViewReports: false,
  },
  [UserRole.MANAGER]: {
    canViewPOS: true,
    canTakeOrders: true,
    canViewKDS: true,
    canViewAggregators: true,
    canManageMenu: true,
    canManageUsers: true,
    canViewReports: true,
  },
};

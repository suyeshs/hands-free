/**
 * Authentication types for Staff Mobile App
 */

export enum UserRole {
  MANAGER = 'manager',
  SERVER = 'server',
  KITCHEN = 'kitchen',
  AGGREGATOR = 'aggregator',
}

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  tenantId: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  photoUrl?: string;
}

export interface AuthState {
  currentUser: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

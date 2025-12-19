import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

export interface DeviceStatus {
  isRegistered: boolean;
  deviceId?: string;
  deviceName?: string;
  tenantId?: string;
  tenantName?: string;
}

export interface RegisterDeviceResponse {
  success: boolean;
  deviceId: string;
  error?: string;
}

export interface StartLoginResponse {
  success: boolean;
  verificationSid?: string;
  error?: string;
}

export interface TenantInfo {
  tenantId: string;
  companyName: string;
  role: string;
}

export interface VerifyLoginResponse {
  success: boolean;
  requiresTotp: boolean;
  tempToken?: string;
  userId?: string;
  tenants?: TenantInfo[];
  error?: string;
}

export interface VerifyTotpResponse {
  success: boolean;
  userId?: string;
  tenants?: TenantInfo[];
  error?: string;
}

export interface ManagerSessionInfo {
  userId: string;
  tenantId: string;
  expiresAt: number;
}

export interface StaffUser {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  createdAt: number;
  lastLoginAt?: number;
}

export interface StaffSession {
  staffId: string;
  tenantId: string;
  name: string;
  role: string;
  permissions: string[];
  loggedInAt: number;
}

// ============================================================================
// Device Registration
// ============================================================================

export async function checkDeviceRegistration(): Promise<DeviceStatus> {
  return invoke<DeviceStatus>('check_device_registration');
}

export async function registerDevice(
  deviceName: string,
  tenantId: string,
  tenantName: string
): Promise<RegisterDeviceResponse> {
  return invoke<RegisterDeviceResponse>('register_device', {
    deviceName,
    tenantId,
    tenantName,
  });
}

// ============================================================================
// Manager Authentication
// ============================================================================

export async function managerLoginStart(phone: string): Promise<StartLoginResponse> {
  return invoke<StartLoginResponse>('manager_login_start', { phone });
}

export async function managerLoginVerify(
  phone: string,
  code: string,
  verificationSid: string
): Promise<VerifyLoginResponse> {
  return invoke<VerifyLoginResponse>('manager_login_verify', {
    phone,
    code,
    verificationSid,
  });
}

export async function managerTotpVerify(
  totpCode: string,
  tempToken: string
): Promise<VerifyTotpResponse> {
  return invoke<VerifyTotpResponse>('manager_totp_verify', {
    totpCode,
    tempToken,
  });
}

export async function managerLogout(): Promise<void> {
  return invoke<void>('manager_logout');
}

export async function checkManagerAuth(): Promise<boolean> {
  return invoke<boolean>('check_manager_auth');
}

export async function getManagerSession(): Promise<ManagerSessionInfo | null> {
  return invoke<ManagerSessionInfo | null>('get_manager_session');
}

// ============================================================================
// Staff Authentication
// ============================================================================

export async function hashStaffPin(pin: string): Promise<string> {
  return invoke<string>('hash_staff_pin', { pin });
}

export async function verifyStaffPin(pin: string, pinHash: string): Promise<boolean> {
  return invoke<boolean>('verify_staff_pin', { pin, pinHash });
}

export async function isValidPin(pin: string): Promise<boolean> {
  return invoke<boolean>('is_valid_pin', { pin });
}

export async function checkStaffLoginRateLimit(staffName: string): Promise<void> {
  return invoke<void>('check_staff_login_rate_limit', { staffName });
}

export async function recordFailedLoginAttempt(staffName: string): Promise<void> {
  return invoke<void>('record_failed_login_attempt', { staffName });
}

export async function clearFailedLoginAttempts(staffName: string): Promise<void> {
  return invoke<void>('clear_failed_login_attempts', { staffName });
}

export async function setStaffSession(staffUser: StaffUser): Promise<void> {
  return invoke<void>('set_staff_session', { staffUser });
}

export async function staffLogout(): Promise<void> {
  return invoke<void>('staff_logout');
}

export async function getStaffSession(): Promise<StaffSession | null> {
  return invoke<StaffSession | null>('get_staff_session');
}

export async function isStaffAuthenticated(): Promise<boolean> {
  return invoke<boolean>('is_staff_authenticated');
}

// ============================================================================
// Combined Auth Helpers
// ============================================================================

export async function getCurrentTenantId(): Promise<string | null> {
  const deviceStatus = await checkDeviceRegistration();
  return deviceStatus.tenantId || null;
}

export async function isAuthenticated(): Promise<boolean> {
  const [managerAuth, staffAuth] = await Promise.all([
    checkManagerAuth(),
    isStaffAuthenticated(),
  ]);
  return managerAuth || staffAuth;
}

export async function logout(): Promise<void> {
  const [managerAuth, staffAuth] = await Promise.all([
    checkManagerAuth(),
    isStaffAuthenticated(),
  ]);

  if (managerAuth) {
    await managerLogout();
  }
  if (staffAuth) {
    await staffLogout();
  }
}

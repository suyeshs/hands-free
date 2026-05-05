/**
 * Verified Customer Storage
 *
 * Manages localStorage persistence for verified customers.
 * This enables returning customer identification via device fingerprint.
 */

const STORAGE_KEY = 'handsfree_verified_customer';
const EXPIRY_DAYS = 90; // Device trust expires after 90 days

export interface VerifiedCustomer {
  fingerprintHash: string;
  phone: string;
  name?: string;
  email?: string;
  tenantId: string;
  verifiedAt: number;
}

/**
 * Get verified customer from localStorage
 * Returns null if not found, expired, or for different tenant
 */
export function getVerifiedCustomer(tenantId: string): VerifiedCustomer | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const customer = JSON.parse(stored) as VerifiedCustomer;

    // Check tenant match
    if (customer.tenantId !== tenantId) {
      return null;
    }

    // Check expiry (90 days)
    const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - customer.verifiedAt > expiryMs) {
      clearVerifiedCustomer();
      return null;
    }

    return customer;
  } catch (error) {
    console.error('[VerifiedCustomer] Failed to parse stored customer:', error);
    clearVerifiedCustomer();
    return null;
  }
}

/**
 * Store verified customer in localStorage
 */
export function setVerifiedCustomer(customer: VerifiedCustomer): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
  } catch (error) {
    console.error('[VerifiedCustomer] Failed to store customer:', error);
  }
}

/**
 * Update verified customer info (e.g., after they edit their name)
 */
export function updateVerifiedCustomer(updates: Partial<Omit<VerifiedCustomer, 'fingerprintHash' | 'tenantId' | 'verifiedAt'>>): void {
  if (typeof window === 'undefined') return;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  try {
    const customer = JSON.parse(stored) as VerifiedCustomer;
    const updated = { ...customer, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[VerifiedCustomer] Failed to update customer:', error);
  }
}

/**
 * Clear verified customer from localStorage
 */
export function clearVerifiedCustomer(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[VerifiedCustomer] Failed to clear customer:', error);
  }
}

/**
 * Check if the current fingerprint hash matches stored customer
 */
export function isVerifiedDevice(fingerprintHash: string, tenantId: string): boolean {
  const customer = getVerifiedCustomer(tenantId);
  return customer !== null && customer.fingerprintHash === fingerprintHash;
}

/**
 * PIN Authentication Service
 * Handles PIN hashing and verification
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Hash a PIN using Tauri's secure hashing
 * Falls back to simple hash for development
 */
export async function hashPin(pin: string): Promise<string> {
  try {
    // Try Tauri's secure hashing (Argon2)
    const hash = await invoke<string>('hash_staff_pin', { pin });
    return hash;
  } catch (error) {
    console.warn('[PinAuth] Tauri hashing not available, using fallback');
    // Fallback for development (NOT secure for production)
    return await fallbackHash(pin);
  }
}

/**
 * Verify a PIN against its hash using Tauri's secure verification
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    // Try Tauri's secure verification
    const isValid = await invoke<boolean>('verify_staff_pin', { pin, hash });
    return isValid;
  } catch (error) {
    console.warn('[PinAuth] Tauri verification not available, using fallback');
    // Fallback for development
    const testHash = await fallbackHash(pin);
    return testHash === hash;
  }
}

/**
 * Fallback hash for development (NOT secure)
 */
async function fallbackHash(str: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'dev_' + Math.abs(hash).toString(36);
}

/**
 * Validate PIN format
 * - Must be 4-6 digits
 * - Cannot be sequential (1234, 4321)
 * - Cannot be repeated (1111, 2222)
 */
export function isValidPinFormat(pin: string): { valid: boolean; message?: string } {
  // Check length
  if (pin.length < 4 || pin.length > 6) {
    return { valid: false, message: 'PIN must be 4-6 digits' };
  }

  // Check if all digits
  if (!/^\d+$/.test(pin)) {
    return { valid: false, message: 'PIN must contain only digits' };
  }

  // Check for repeated digits
  if (/^(\d)\1+$/.test(pin)) {
    return { valid: false, message: 'PIN cannot be all same digits (e.g., 1111)' };
  }

  // Check for sequential digits
  const isSequential = (s: string) => {
    for (let i = 0; i < s.length - 1; i++) {
      if (parseInt(s[i+1]) !== parseInt(s[i]) + 1 && parseInt(s[i+1]) !== parseInt(s[i]) - 1) {
        return false;
      }
    }
    return true;
  };

  if (isSequential(pin)) {
    return { valid: false, message: 'PIN cannot be sequential (e.g., 1234)' };
  }

  return { valid: true };
}

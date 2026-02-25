/**
 * Phone number validation for E.164 international format
 * Supports formats like +1234567890, +1 234 567 8900, +44 (20) 7123 4567
 */

export interface PhoneValidationResult {
  valid: boolean;
  error?: string;
  formatted?: string;
}

export function validatePhone(phone: string): PhoneValidationResult {
  // Remove formatting characters (spaces, dashes, parentheses)
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+?[1-9]\d{1,14}$/;

  if (!cleaned) {
    return {
      valid: false,
      error: 'Phone number is required',
    };
  }

  if (!e164Regex.test(cleaned)) {
    return {
      valid: false,
      error: 'Please enter a valid international phone number (e.g., +1234567890)',
    };
  }

  return {
    valid: true,
    formatted: cleaned.startsWith('+') ? cleaned : `+${cleaned}`,
  };
}

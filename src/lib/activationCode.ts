/**
 * Activation Code Utility
 * Generates and validates activation codes for location tenant setup
 */

/**
 * Generate an activation code for a location
 * Format: PREFIX-LOCATION-RANDOM
 * Example: CAFE-INDR-8472
 *
 * @param chainName - Name of the chain
 * @param locationName - Name of the location
 * @returns Activation code string
 */
export function generateActivationCode(chainName: string, locationName: string): string {
  // Extract and sanitize prefix from chain name (first 4 alphanumeric chars)
  const prefix = chainName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 4)
    .padEnd(4, 'X');

  // Extract and sanitize location code (first 4 alphanumeric chars)
  const location = locationName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 4)
    .padEnd(4, 'X');

  // Generate 4-digit random number
  const random = Math.floor(1000 + Math.random() * 9000);

  return `${prefix}-${location}-${random}`;
}

/**
 * Validate activation code format
 * @param code - Activation code to validate
 * @returns true if valid format
 */
export function isValidActivationCodeFormat(code: string): boolean {
  // Format: XXXX-XXXX-9999
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-\d{4}$/;
  return pattern.test(code);
}

/**
 * Format activation code (remove spaces, convert to uppercase, add hyphens)
 * @param input - User input
 * @returns Formatted code
 */
export function formatActivationCode(input: string): string {
  // Remove all non-alphanumeric characters
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Split into groups: 4-4-4
  const parts = [];
  for (let i = 0; i < cleaned.length && i < 12; i += 4) {
    parts.push(cleaned.substring(i, i + 4));
  }

  return parts.join('-');
}

/**
 * Parse activation code components
 * @param code - Activation code
 * @returns Object with prefix, location, and random components
 */
export function parseActivationCode(code: string) {
  const parts = code.split('-');
  if (parts.length !== 3) {
    throw new Error('Invalid activation code format');
  }

  return {
    prefix: parts[0],
    location: parts[1],
    random: parts[2],
  };
}

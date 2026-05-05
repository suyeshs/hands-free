/**
 * URL Customer Context
 *
 * Handles URL-based customer identification for:
 * - QR code referrals
 * - Marketing links with customer context
 * - Reorder links
 *
 * URL format: /menu?ref={base64(phoneHash)}
 * Example: /menu?ref=dGVzdGhhc2gxMjM=
 */

const REF_PARAM = 'ref';

/**
 * Get customer phone hash from URL if present
 * Returns null if not present or invalid
 */
export function getCustomerHashFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get(REF_PARAM);
    if (!ref) return null;

    // Decode base64
    const decoded = atob(ref);

    // Validate it looks like a hash (64 hex chars for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(decoded)) {
      console.warn('[UrlCustomerContext] Invalid hash format in URL');
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[UrlCustomerContext] Failed to parse customer hash from URL:', error);
    return null;
  }
}

/**
 * Generate a referral URL with customer phone hash
 */
export function generateReferralUrl(phoneHash: string, baseUrl: string): string {
  const encoded = btoa(phoneHash);
  const url = new URL(baseUrl);
  url.searchParams.set(REF_PARAM, encoded);
  return url.toString();
}

/**
 * Remove the ref parameter from current URL
 * Used after customer is identified to clean up URL
 */
export function clearRefFromUrl(): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(REF_PARAM)) {
      url.searchParams.delete(REF_PARAM);
      window.history.replaceState({}, '', url.toString());
    }
  } catch (error) {
    console.error('[UrlCustomerContext] Failed to clear ref from URL:', error);
  }
}

/**
 * Check if current URL has customer context
 */
export function hasCustomerContext(): boolean {
  return getCustomerHashFromUrl() !== null;
}

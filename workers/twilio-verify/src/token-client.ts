/**
 * Token Manager client for Twilio Worker
 * Fetches Twilio credentials from centralized Token Manager
 */

const TOKEN_MANAGER_URL = 'https://handsfree-token-manager.suyesh.workers.dev';
const WORKER_NAME = 'handsfree-twilio-verify-prod';

interface TokenResponse {
  success: boolean;
  data: {
    value: string;
    expires?: string;
  };
  timestamp: string;
}

export class TwilioTokenClient {
  private cache: Map<string, { value: string; expires: number }> = new Map();

  /**
   * Fetch a token from Token Manager
   */
  private async getToken(key: string): Promise<string> {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Fetch from Token Manager
    const response = await fetch(`${TOKEN_MANAGER_URL}/api/tokens/${encodeURIComponent(key)}`, {
      headers: {
        'X-Worker-Name': WORKER_NAME,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch token ${key}: ${response.statusText} - ${error}`);
    }

    const data: TokenResponse = await response.json();

    if (!data.success) {
      throw new Error(`Failed to fetch token ${key}: Invalid response`);
    }

    // Cache for 5 minutes
    this.cache.set(key, {
      value: data.data.value,
      expires: Date.now() + 5 * 60 * 1000,
    });

    return data.data.value;
  }

  /**
   * Get Twilio Verify Service SID
   */
  async getVerifyServiceSid(): Promise<string> {
    return this.getToken('twilio:verify_service_sid');
  }

  /**
   * Get Twilio Account SID
   */
  async getAccountSid(): Promise<string> {
    return this.getToken('twilio:account_sid');
  }

  /**
   * Get Twilio API Key SID
   */
  async getApiKeySid(): Promise<string> {
    return this.getToken('twilio:api_key_sid');
  }

  /**
   * Get Twilio API Key Secret
   */
  async getApiKeySecret(): Promise<string> {
    return this.getToken('twilio:api_key_secret');
  }

  /**
   * Get Twilio Auth Token (fallback)
   */
  async getAuthToken(): Promise<string> {
    return this.getToken('twilio:auth_token');
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

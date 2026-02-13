/**
 * Meta WhatsApp Business API Client
 * Handles sending authentication messages via WhatsApp
 */

import type { Env, MetaMessageResponse, MetaErrorResponse } from './types';

export class WhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private templateName: string;

  constructor(env: Env) {
    this.accessToken = env.META_ACCESS_TOKEN;
    this.phoneNumberId = env.META_PHONE_NUMBER_ID;
    this.apiVersion = env.META_API_VERSION || 'v21.0';
    this.templateName = env.AUTH_TEMPLATE_NAME || 'handsfreeauth';
  }

  /**
   * Get the base URL for Meta Graph API
   */
  private getBaseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Send authentication OTP via WhatsApp
   * Uses the copy-code button template
   */
  async sendOTP(
    to: string,
    code: string,
    locale: string = 'en'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const url = this.getBaseUrl();

    // Format phone number (remove + if present, Meta expects without +)
    const formattedPhone = to.replace(/^\+/, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: this.templateName,
        language: {
          code: this.mapLocale(locale),
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: code,
              },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: code,
              },
            ],
          },
        ],
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as MetaErrorResponse;
        console.error('[WhatsApp Client] API error:', errorData);
        return {
          success: false,
          error: errorData.error?.message || 'Failed to send WhatsApp message',
        };
      }

      const successData = data as MetaMessageResponse;
      console.log('[WhatsApp Client] Message sent:', successData.messages?.[0]?.id);

      return {
        success: true,
        messageId: successData.messages?.[0]?.id,
      };
    } catch (error) {
      console.error('[WhatsApp Client] Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Map locale to WhatsApp supported language codes
   */
  private mapLocale(locale: string): string {
    // Map common locales to WhatsApp supported codes
    const localeMap: Record<string, string> = {
      'en': 'en',
      'en-US': 'en_US',
      'en-GB': 'en_GB',
      'hi': 'hi',
      'hi-IN': 'hi',
      'kn': 'kn',
      'kn-IN': 'kn',
      'ta': 'ta',
      'ta-IN': 'ta',
      'te': 'te',
      'te-IN': 'te',
      'mr': 'mr',
      'mr-IN': 'mr',
      'bn': 'bn',
      'bn-IN': 'bn',
      'gu': 'gu',
      'gu-IN': 'gu',
      'ml': 'ml',
      'ml-IN': 'ml',
      'pa': 'pa',
      'pa-IN': 'pa',
    };

    return localeMap[locale] || 'en';
  }

  /**
   * Check if the access token is valid
   */
  async checkHealth(): Promise<{ valid: boolean; error?: string }> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json() as MetaErrorResponse;
        return {
          valid: false,
          error: data.error?.message || 'Invalid credentials',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}

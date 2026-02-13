/**
 * Cloudflare API Utilities
 * Helper functions for interacting with Cloudflare APIs
 */

export interface CloudflareAPIConfig {
  accountId: string;
  apiToken: string;
  zoneId: string;
}

export class CloudflareAPI {
  private config: CloudflareAPIConfig;

  constructor(config: CloudflareAPIConfig) {
    this.config = config;
  }

  /**
   * Create DNS record
   */
  async createDNSRecord(params: {
    type: string;
    name: string;
    content: string;
    proxied?: boolean;
  }): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );

    return await response.json();
  }

  /**
   * Delete DNS record
   */
  async deleteDNSRecord(recordId: string): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records/${recordId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    return await response.json();
  }

  /**
   * Get DNS record by name
   */
  async getDNSRecordByName(name: string): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records?name=${name}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    return await response.json();
  }

  /**
   * List all DNS records
   */
  async listDNSRecords(): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    return await response.json();
  }
}

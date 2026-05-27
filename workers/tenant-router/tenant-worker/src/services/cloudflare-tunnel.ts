/**
 * Cloudflare Tunnel Management Service
 *
 * Manages named tunnels for restaurants via Cloudflare API
 * Each restaurant gets a persistent subdomain: {slug}.menu.handsfree.com
 */

interface CloudflareTunnelConfig {
  accountId: string;
  apiToken: string;
  zoneId: string; // For DNS management
}

interface TunnelCredentials {
  AccountTag: string;
  TunnelSecret: string;
  TunnelID: string;
}

interface CreateTunnelResponse {
  success: boolean;
  tunnelId: string;
  tunnelName: string;
  credentials: TunnelCredentials;
  url: string;
}

export class CloudflareTunnelService {
  private config: CloudflareTunnelConfig;

  constructor(config: CloudflareTunnelConfig) {
    this.config = config;
  }

  /**
   * Generate a random tunnel secret (32 bytes, base64)
   */
  private generateTunnelSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    // Convert to string without spread operator
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Create a named tunnel for a restaurant
   */
  async createTunnel(restaurantSlug: string): Promise<CreateTunnelResponse> {
    const tunnelSecret = this.generateTunnelSecret();

    // Step 1: Create tunnel via Cloudflare API
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/cfd_tunnel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: restaurantSlug,
          tunnel_secret: tunnelSecret,
          config_src: 'local', // Configuration stored locally, not in Cloudflare
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create tunnel: ${error}`);
    }

    const tunnelData = await createResponse.json();
    const tunnelId = tunnelData.result.id;

    console.log(`[Tunnel] Created tunnel: ${restaurantSlug} (${tunnelId})`);

    // Step 2: Create DNS CNAME record
    await this.createDNSRecord(restaurantSlug, tunnelId);

    // Step 3: Configure tunnel routing
    await this.configureTunnelRouting(tunnelId, restaurantSlug);

    // Step 4: Build credentials object
    const credentials: TunnelCredentials = {
      AccountTag: this.config.accountId,
      TunnelSecret: tunnelSecret,
      TunnelID: tunnelId,
    };

    const url = `https://${restaurantSlug}.menu.handsfree.com`;

    console.log(`[Tunnel] ✅ Tunnel ready: ${url}`);

    return {
      success: true,
      tunnelId,
      tunnelName: restaurantSlug,
      credentials,
      url,
    };
  }

  /**
   * Create DNS CNAME record for tunnel
   */
  private async createDNSRecord(restaurantSlug: string, tunnelId: string): Promise<void> {
    const dnsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: `${restaurantSlug}.menu`,
          content: `${tunnelId}.cfargotunnel.com`,
          ttl: 1, // Automatic TTL
          proxied: true, // Enable Cloudflare proxy
        }),
      }
    );

    if (!dnsResponse.ok) {
      const error = await dnsResponse.text();
      throw new Error(`Failed to create DNS record: ${error}`);
    }

    console.log(`[Tunnel] Created DNS: ${restaurantSlug}.menu.handsfree.com → ${tunnelId}.cfargotunnel.com`);
  }

  /**
   * Configure tunnel routing (ingress rules)
   */
  private async configureTunnelRouting(tunnelId: string, restaurantSlug: string): Promise<void> {
    const configResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            ingress: [
              {
                hostname: `${restaurantSlug}.menu.handsfree.com`,
                service: 'http://localhost:3000',
              },
              {
                service: 'http_status:404', // Catch-all rule (required)
              },
            ],
          },
        }),
      }
    );

    if (!configResponse.ok) {
      const error = await configResponse.text();
      throw new Error(`Failed to configure tunnel routing: ${error}`);
    }

    console.log(`[Tunnel] Configured routing: ${restaurantSlug}.menu.handsfree.com → localhost:3000`);
  }

  /**
   * Delete a tunnel (when restaurant is deleted)
   */
  async deleteTunnel(tunnelId: string, restaurantSlug: string): Promise<void> {
    // Step 1: Delete tunnel
    const deleteResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/cfd_tunnel/${tunnelId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.error(`Failed to delete tunnel: ${error}`);
      // Don't throw - continue with DNS cleanup
    }

    // Step 2: Delete DNS record
    await this.deleteDNSRecord(restaurantSlug);

    console.log(`[Tunnel] Deleted tunnel: ${restaurantSlug} (${tunnelId})`);
  }

  /**
   * Delete DNS record
   */
  private async deleteDNSRecord(restaurantSlug: string): Promise<void> {
    // First, find the DNS record ID
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records?name=${restaurantSlug}.menu.handsfree.com`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      console.error('Failed to list DNS records');
      return;
    }

    const listData = await listResponse.json();
    const record = listData.result?.[0];

    if (!record) {
      console.log(`[Tunnel] DNS record not found: ${restaurantSlug}.menu.handsfree.com`);
      return;
    }

    // Delete the record
    const deleteResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records/${record.id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    if (deleteResponse.ok) {
      console.log(`[Tunnel] Deleted DNS: ${restaurantSlug}.menu.handsfree.com`);
    }
  }

  /**
   * List all tunnels for account
   */
  async listTunnels(): Promise<any[]> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/cfd_tunnel`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to list tunnels');
    }

    const data = await response.json();
    return data.result || [];
  }

  /**
   * Check if tunnel exists for a restaurant
   */
  async tunnelExists(restaurantSlug: string): Promise<boolean> {
    const tunnels = await this.listTunnels();
    return tunnels.some((t) => t.name === restaurantSlug);
  }
}

/**
 * Initialize tunnel service from environment variables
 */
export function createTunnelService(env: any): CloudflareTunnelService {
  const config: CloudflareTunnelConfig = {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    zoneId: env.CLOUDFLARE_ZONE_ID,
  };

  return new CloudflareTunnelService(config);
}

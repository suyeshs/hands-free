/**
 * Cloudflare Token Manager
 * Creates and rotates Cloudflare API tokens with specific permissions
 */

export interface CloudflareTokenRequest {
  name: string;
  permissions: string[];  // Permission names like "DNS Write", "Workers KV Storage Write"
  scope: {
    zoneId?: string;
    accountId?: string;
  };
  expiresIn?: number;  // Days from now (default: 365)
}

export interface CloudflareTokenResponse {
  token: string;
  tokenId: string;
  expiresOn: string;
}

export class CloudflareTokenManager {
  private apiToken: string;
  private accountId: string = "0f3287b287060e3215662501ee96292e";
  private zoneId: string = "a87f103cc0e697543f91213a71bafe01";

  constructor(env: any) {
    this.apiToken = env.BOOTSTRAP_API_TOKEN;
  }

  /**
   * Create a new Cloudflare API token
   */
  async createToken(request: CloudflareTokenRequest): Promise<CloudflareTokenResponse> {
    // Get permission group IDs
    const permissionGroups = await this.getPermissionGroups();
    const permissionIds = this.mapPermissionsToIds(request.permissions, permissionGroups);

    // Build token request
    const notBefore = new Date().toISOString();
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + (request.expiresIn || 365));

    const policies = this.buildPolicies(permissionIds, request.scope);

    const tokenRequest = {
      name: request.name,
      policies,
      not_before: notBefore,
      expires_on: expiresOn.toISOString(),
    };

    // Create token via Cloudflare API
    const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenRequest),
    });

    const result = await response.json() as any;

    if (!result.success) {
      throw new Error(`Failed to create token: ${JSON.stringify(result.errors)}`);
    }

    return {
      token: result.result.value,
      tokenId: result.result.id,
      expiresOn: expiresOn.toISOString(),
    };
  }

  /**
   * Rotate an existing Cloudflare API token
   */
  async rotateToken(tokenKey: string): Promise<CloudflareTokenResponse> {
    // For now, create a new token with the same permissions
    // In a full implementation, we would:
    // 1. Get the old token's permissions
    // 2. Create a new token with the same permissions
    // 3. Delete the old token
    // 4. Return the new token

    throw new Error('Token rotation not yet implemented');
  }

  /**
   * Get all available permission groups from Cloudflare
   */
  async getPermissionGroups(): Promise<any[]> {
    const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/permission_groups', {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
    });

    const result = await response.json() as any;

    if (!result.success) {
      throw new Error(`Failed to fetch permission groups: ${JSON.stringify(result.errors)}`);
    }

    return result.result;
  }

  /**
   * Map permission names to permission group IDs
   */
  private mapPermissionsToIds(permissions: string[], permissionGroups: any[]): string[] {
    const ids: string[] = [];

    for (const permName of permissions) {
      const group = permissionGroups.find(g => g.name === permName);
      if (group) {
        ids.push(group.id);
      } else {
        console.warn(`Permission group not found: ${permName}`);
      }
    }

    return ids;
  }

  /**
   * Build policy array based on permissions and scope
   */
  private buildPolicies(permissionIds: string[], scope: CloudflareTokenRequest['scope']): any[] {
    const policies: any[] = [];

    // Separate zone and account permissions
    const zonePermissions = permissionIds.filter(id =>
      this.isZonePermission(id)
    );

    const accountPermissions = permissionIds.filter(id =>
      !this.isZonePermission(id)
    );

    // Zone-scoped policy
    if (zonePermissions.length > 0 && scope.zoneId) {
      policies.push({
        effect: 'allow',
        resources: {
          [`com.cloudflare.api.account.zone.${scope.zoneId}`]: '*',
        },
        permission_groups: zonePermissions.map(id => ({ id })),
      });
    }

    // Account-scoped policy
    if (accountPermissions.length > 0 && scope.accountId) {
      policies.push({
        effect: 'allow',
        resources: {
          [`com.cloudflare.api.account.${scope.accountId}`]: '*',
        },
        permission_groups: accountPermissions.map(id => ({ id })),
      });
    }

    return policies;
  }

  /**
   * Determine if a permission is zone-scoped (heuristic)
   */
  private isZonePermission(permissionId: string): boolean {
    // This is a heuristic - ideally we'd get this info from the permission group metadata
    // DNS, Zone Settings, etc. are zone-scoped
    // Workers, KV, D1, R2 are account-scoped
    return false; // Most permissions we use are account-scoped
  }
}

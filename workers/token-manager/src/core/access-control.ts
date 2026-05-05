/**
 * Access Control - Manages which workers can access which tokens
 */

export interface AccessPolicy {
  workerName: string;
  allowedTokens: string[];
  ipWhitelist?: string[];
  createdAt: string;
  updatedAt: string;
}

export class AccessControl {
  private kv: KVNamespace;

  constructor(env: any) {
    this.kv = env.ACCESS_POLICIES;
  }

  /**
   * Create or update an access policy for a worker
   */
  async createPolicy(
    workerName: string,
    allowedTokens: string[],
    ipWhitelist?: string[]
  ): Promise<void> {
    const policy: AccessPolicy = {
      workerName,
      allowedTokens,
      ipWhitelist,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(`policy:${workerName}`, JSON.stringify(policy));
  }

  /**
   * Check if a worker has access to a token
   */
  async checkAccess(workerName: string, tokenKey: string): Promise<boolean> {
    const policy = await this.getPolicy(workerName);

    if (!policy) {
      return false;
    }

    return policy.allowedTokens.includes(tokenKey);
  }

  /**
   * Get policy for a worker
   */
  async getPolicy(workerName: string): Promise<AccessPolicy | null> {
    const stored = await this.kv.get(`policy:${workerName}`, 'text');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * List all policies
   */
  async listPolicies(): Promise<AccessPolicy[]> {
    const list = await this.kv.list({ prefix: 'policy:' });
    const policies: AccessPolicy[] = [];

    for (const item of list.keys) {
      const stored = await this.kv.get(item.name, 'text');
      if (stored) {
        policies.push(JSON.parse(stored));
      }
    }

    return policies;
  }

  /**
   * Delete a policy
   */
  async deletePolicy(workerName: string): Promise<void> {
    await this.kv.delete(`policy:${workerName}`);
  }
}

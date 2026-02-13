import type { DomainStatus, DomainRequest, AuditLog } from '../../types/domain';
import { DomainValidator } from '../../utils/validation';
import { CloudflareAPI } from '../../utils/cloudflare-api';
import { SSLManager } from '../../utils/ssl-manager';

export class DomainManagerDO {
  private state: DurableObjectState;
  private env: CloudflareEnv;
  private cloudflareApi: CloudflareAPI;
  private sslManager: SSLManager;

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    this.state = state;
    this.env = env;
    this.cloudflareApi = new CloudflareAPI({
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      zoneId: env.CLOUDFLARE_ZONE_ID,
    });
    this.sslManager = new SSLManager(this.cloudflareApi, env.LETSENCRYPT_ACCOUNT_EMAIL);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    try {
      switch (true) {
        case method === 'POST' && path.endsWith('/add'):
          return await this.addDomain(request);
        case method === 'PUT' && path.endsWith('/update'):
          return await this.updateDomain(request);
        case method === 'DELETE' && path.endsWith('/delete'):
          return await this.deleteDomain(request);
        case method === 'GET' && path.endsWith('/status'):
          return await this.getDomainStatus(request);
        case method === 'POST' && path.endsWith('/validate'):
          return await this.validateDomain(request);
        case method === 'POST' && path.endsWith('/activate'):
          return await this.activateDomain(request);
        case method === 'POST' && path.endsWith('/suspend'):
          return await this.suspendDomain(request);
        case method === 'GET' && path.endsWith('/list'):
          return await this.listDomains(request);
        case method === 'POST' && path.endsWith('/health-check'):
          return await this.performHealthCheck(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('DomainManager error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async addDomain(request: Request): Promise<Response> {
    const domainRequest: DomainRequest = await request.json();
    
    // Validate domain format
    if (!DomainValidator.isValidDomain(domainRequest.domain)) {
      throw new Error('Invalid domain format');
    }

    // Check tenant limits
    await this.checkTenantLimits(domainRequest.tenantId);

    // Check if domain already exists
    const existingDomain = await this.env.DOMAIN_METADATA.get(
      `domain:${domainRequest.domain}`
    );
    if (existingDomain) {
      throw new Error('Domain already exists');
    }

    // Create domain status
    const domainStatus: DomainStatus = {
      domain: DomainValidator.sanitizeDomain(domainRequest.domain),
      tenantId: domainRequest.tenantId,
      status: 'pending',
      validationMethod: domainRequest.validationMethod,
      sslStatus: 'pending',
      dnsStatus: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      metadata: domainRequest.metadata || {},
    };

    // Store domain metadata
    await this.env.DOMAIN_METADATA.put(
      `domain:${domainStatus.domain}`,
      JSON.stringify(domainStatus)
    );

    // Add to tenant's domain list
    await this.addToTenantDomainList(domainRequest.tenantId, domainStatus.domain);

    // Create audit log
    await this.createAuditLog({
      tenantId: domainRequest.tenantId,
      domain: domainStatus.domain,
      action: 'domain.added',
      status: 'success',
      details: { domainRequest },
    });

    // Initiate validation process
    this.state.waitUntil(this.initiateValidation(domainStatus, domainRequest));

    return new Response(
      JSON.stringify({ success: true, domain: domainStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async updateDomain(request: Request): Promise<Response> {
    const { domain, updates } = await request.json() as { domain: string; updates: Partial<DomainStatus> };
    
    const domainStatus = await this.getDomainStatusData(domain);
    if (!domainStatus) {
      throw new Error('Domain not found');
    }

    // Update domain status
    const updatedStatus = {
      ...domainStatus,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.env.DOMAIN_METADATA.put(
      `domain:${domain}`,
      JSON.stringify(updatedStatus)
    );

    // Create audit log
    await this.createAuditLog({
      tenantId: domainStatus.tenantId,
      domain,
      action: 'domain.updated',
      status: 'success',
      details: { updates },
    });

    return new Response(
      JSON.stringify({ success: true, domain: updatedStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async deleteDomain(request: Request): Promise<Response> {
    const { domain } = await request.json() as { domain: string };
    
    const domainStatus = await this.getDomainStatusData(domain);
    if (!domainStatus) {
      throw new Error('Domain not found');
    }

    // Revoke SSL certificate if exists
    if (domainStatus.sslStatus === 'active') {
      try {
        await this.sslManager.revokeSSLCertificate(domainStatus as any);
      } catch (error) {
        console.error('Failed to revoke SSL certificate:', error);
      }
    }

    // Remove DNS records
    try {
      await this.cleanupDNSRecords(domain);
    } catch (error) {
      console.error('Failed to cleanup DNS records:', error);
    }

    // Remove from storage
    await this.env.DOMAIN_METADATA.delete(`domain:${domain}`);
    await this.removeFromTenantDomainList(domainStatus.tenantId, domain);

    // Create audit log
    await this.createAuditLog({
      tenantId: domainStatus.tenantId,
      domain,
      action: 'domain.deleted',
      status: 'success',
      details: {},
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async validateDomain(request: Request): Promise<Response> {
    const { domain } = await request.json() as { domain: string };
    
    const domainStatus = await this.getDomainStatusData(domain);
    if (!domainStatus) {
      throw new Error('Domain not found');
    }

    const isValid = await this.performDomainValidation(domain, domainStatus.validationMethod);
    
    if (isValid) {
      domainStatus.status = 'validated';
      domainStatus.validatedAt = new Date().toISOString();
      
      await this.env.DOMAIN_METADATA.put(
        `domain:${domain}`,
        JSON.stringify(domainStatus)
      );

      // Initiate SSL provisioning
      this.state.waitUntil(this.provisionSSL(domain, domainStatus));
    } else {
      domainStatus.retryCount++;
      if (domainStatus.retryCount >= 10) {
        domainStatus.status = 'failed';
        domainStatus.failedAt = new Date().toISOString();
        domainStatus.error = 'Maximum validation attempts exceeded';
      }
      
      await this.env.DOMAIN_METADATA.put(
        `domain:${domain}`,
        JSON.stringify(domainStatus)
      );
    }

    return new Response(
      JSON.stringify({ valid: isValid, domain: domainStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async activateDomain(request: Request): Promise<Response> {
    const { domain } = await request.json() as { domain: string };
    
    const domainStatus = await this.getDomainStatusData(domain);
    if (!domainStatus) {
      throw new Error('Domain not found');
    }

    if (domainStatus.status !== 'validated') {
      throw new Error('Domain must be validated before activation');
    }

    // Setup routing
    await this.setupDomainRouting(domain, domainStatus.tenantId);

    domainStatus.status = 'active';
    domainStatus.activatedAt = new Date().toISOString();

    await this.env.DOMAIN_METADATA.put(
      `domain:${domain}`,
      JSON.stringify(domainStatus)
    );

    // Create audit log
    await this.createAuditLog({
      tenantId: domainStatus.tenantId,
      domain,
      action: 'domain.activated',
      status: 'success',
      details: {},
    });

    // Send webhook notification
    this.state.waitUntil(this.sendWebhookNotification('domain.activated', domainStatus));

    return new Response(
      JSON.stringify({ success: true, domain: domainStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async suspendDomain(request: Request): Promise<Response> {
    const { domain, reason } = await request.json() as { domain: string; reason?: string };
    
    const domainStatus = await this.getDomainStatusData(domain);
    if (!domainStatus) {
      throw new Error('Domain not found');
    }

    domainStatus.status = 'suspended';
    domainStatus.error = reason || 'Domain suspended by administrator';
    domainStatus.suspendedAt = new Date().toISOString();

    await this.env.DOMAIN_METADATA.put(
      `domain:${domain}`,
      JSON.stringify(domainStatus)
    );

    // Create audit log
    await this.createAuditLog({
      tenantId: domainStatus.tenantId,
      domain,
      action: 'domain.suspended',
      status: 'success',
      details: { reason },
    });

    return new Response(
      JSON.stringify({ success: true, domain: domainStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async getDomainStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');
    
    if (!domain) {
      throw new Error('Domain parameter is required');
    }

    const domainStatus = await this.getDomainStatusData(domain);
    if (!domainStatus) {
      throw new Error('Domain not found');
    }

    return new Response(
      JSON.stringify({ domain: domainStatus }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async listDomains(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const domains = await this.getTenantDomains(tenantId, status, page, limit);

    return new Response(
      JSON.stringify({ domains }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async performHealthCheck(request: Request): Promise<Response> {
    const { domain } = await request.json() as { domain: string };
    
    const healthCheck = await this.checkDomainHealth(domain);

    return new Response(
      JSON.stringify({ healthCheck }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Helper methods
  private async getDomainStatusData(domain: string): Promise<DomainStatus | null> {
    const data = await this.env.DOMAIN_METADATA.get(`domain:${domain}`);
    return data ? JSON.parse(data) : null;
  }

  private async checkTenantLimits(tenantId: string): Promise<void> {
    const limits = await this.env.TENANT_CONFIG.get(`limits:${tenantId}`, 'json') as any || {
      maxDomains: parseInt(this.env.MAX_DOMAINS_PER_TENANT),
    };

    const currentDomains = await this.getTenantDomainCount(tenantId);
    
    if (currentDomains >= limits.maxDomains) {
      throw new Error(`Tenant domain limit exceeded (${limits.maxDomains})`);
    }
  }

  private async getTenantDomainCount(tenantId: string): Promise<number> {
    const domainList = await this.env.DOMAIN_METADATA.get(`tenant:${tenantId}:domains`, 'json') as any[] || [];
    return domainList.length;
  }

  private async addToTenantDomainList(tenantId: string, domain: string): Promise<void> {
    const domainList = await this.env.DOMAIN_METADATA.get(`tenant:${tenantId}:domains`, 'json') as any[] || [];
    domainList.push(domain);
    
    await this.env.DOMAIN_METADATA.put(
      `tenant:${tenantId}:domains`,
      JSON.stringify(domainList)
    );
  }

  private async removeFromTenantDomainList(tenantId: string, domain: string): Promise<void> {
    const domainList = await this.env.DOMAIN_METADATA.get(`tenant:${tenantId}:domains`, 'json') as any[] || [];
    const updatedList = domainList.filter((d: string) => d !== domain);
    
    await this.env.DOMAIN_METADATA.put(
      `tenant:${tenantId}:domains`,
      JSON.stringify(updatedList)
    );
  }

  private async initiateValidation(domainStatus: DomainStatus, domainRequest: DomainRequest): Promise<void> {
    try {
      const validationData = DomainValidator.createValidationData(
        domainStatus.domain,
        domainRequest.validationMethod
      );

      await this.env.VALIDATION_TOKENS.put(
        `validation:${domainStatus.domain}`,
        JSON.stringify(validationData)
      );

      // Update domain status
      domainStatus.status = 'validating';
      await this.env.DOMAIN_METADATA.put(
        `domain:${domainStatus.domain}`,
        JSON.stringify(domainStatus)
      );

      // Schedule validation check
      await this.scheduleValidationCheck(domainStatus.domain);
    } catch (error) {
      console.error('Failed to initiate validation:', error);
      
      domainStatus.status = 'failed';
      domainStatus.error = error instanceof Error ? error.message : 'Validation failed';
      domainStatus.failedAt = new Date().toISOString();
      
      await this.env.DOMAIN_METADATA.put(
        `domain:${domainStatus.domain}`,
        JSON.stringify(domainStatus)
      );
    }
  }

  private async scheduleValidationCheck(domain: string): Promise<void> {
    // This would integrate with your scheduling system
    // For now, we'll use a simple timeout
    setTimeout(async () => {
      await this.validateDomain({ json: async () => ({ domain }) } as Request);
    }, 60000); // Check in 1 minute
  }

  private async performDomainValidation(domain: string, method: string): Promise<boolean> {
    const validationData = await this.env.VALIDATION_TOKENS.get(
      `validation:${domain}`,
      'json'
    );

    if (!validationData) {
      return false;
    }

    switch (method) {
      case 'dns':
        return await this.validateDNSRecord(validationData);
      case 'http':
        return await this.validateHTTPFile(validationData);
      case 'https':
        return await this.validateHTTPSFile(validationData);
      case 'email':
        return await this.validateEmail(validationData);
      default:
        return false;
    }
  }

  private async validateDNSRecord(validationData: any): Promise<boolean> {
    try {
      const records = await this.cloudflareApi.getDNSRecords(
        validationData.domain,
        'TXT'
      );

      return records.result.some((record: any) =>
        record.content.includes(validationData.token)
      );
    } catch {
      return false;
    }
  }

  private async validateHTTPFile(validationData: any): Promise<boolean> {
    try {
      const response = await fetch(`http://${validationData.domain}${validationData.path}`);
      const content = await response.text();
      return content.trim() === validationData.expectedContent;
    } catch {
      return false;
    }
  }

  private async validateHTTPSFile(validationData: any): Promise<boolean> {
    try {
      const response = await fetch(`https://${validationData.domain}${validationData.path}`);
      const content = await response.text();
      return content.trim() === validationData.expectedContent;
    } catch {
      return false;
    }
  }

  private async validateEmail(validationData: any): Promise<boolean> {
    // Email validation would require checking email for validation token
    // This is a simplified implementation
    return false;
  }

  private async provisionSSL(domain: string, domainStatus: DomainStatus): Promise<void> {
    try {
      const sslData = await this.sslManager.provisionSSLCertificate(
        domain,
        'cloudflare', // Default to Cloudflare for now
        {}
      );

      domainStatus.sslStatus = sslData.status;
      await this.env.DOMAIN_METADATA.put(
        `domain:${domain}`,
        JSON.stringify(domainStatus)
      );

      // Store SSL data
      await this.env.SSL_CERTIFICATES.put(
        `ssl:${domain}`,
        JSON.stringify(sslData)
      );
    } catch (error) {
      console.error('SSL provisioning failed:', error);
      domainStatus.sslStatus = 'failed';
      domainStatus.error = error instanceof Error ? error.message : 'SSL provisioning failed';
      
      await this.env.DOMAIN_METADATA.put(
        `domain:${domain}`,
        JSON.stringify(domainStatus)
      );
    }
  }

  private async setupDomainRouting(domain: string, tenantId: string): Promise<void> {
    // Create CNAME record pointing to platform
    await this.cloudflareApi.createDNSRecord({
      name: domain,
      type: 'CNAME',
      content: this.env.PLATFORM_DOMAIN,
      ttl: 1,
      proxied: true,
    });
  }

  private async cleanupDNSRecords(domain: string): Promise<void> {
    const records = await this.cloudflareApi.getDNSRecords(domain);
    
    for (const record of records.result) {
      await this.cloudflareApi.deleteDNSRecord(record.id);
    }
  }

  private async checkDomainHealth(domain: string): Promise<any> {
    const checks = {
      dns: false,
      ssl: false,
      http: false,
      https: false,
    };

    try {
      // DNS check
      const records = await this.cloudflareApi.getDNSRecords(domain);
      checks.dns = records.result.length > 0;

      // SSL check
      const sslData = await this.env.SSL_CERTIFICATES.get(`ssl:${domain}`, 'json') as any;
      checks.ssl = sslData?.status === 'active';

      // HTTP check
      try {
        const httpResponse = await fetch(`http://${domain}`);
        checks.http = httpResponse.ok;
      } catch {}

      // HTTPS check
      try {
        const httpsResponse = await fetch(`https://${domain}`);
        checks.https = httpsResponse.ok;
      } catch {}
    } catch (error) {
      console.error('Health check failed:', error);
    }

    return {
      domain,
      timestamp: new Date().toISOString(),
      status: Object.values(checks).every(Boolean) ? 'healthy' : 'warning',
      checks,
    };
  }

  private async getTenantDomains(tenantId: string | null, status: string | null, page: number = 1, limit: number = 10): Promise<any[]> {
    const offset = (page - 1) * limit;
    
    if (tenantId) {
      const domainList = await this.env.DOMAIN_METADATA.get(`tenant:${tenantId}:domains`, 'json') as any[] || [];
      const domains = await Promise.all(
        domainList.slice(offset, offset + limit).map(async (domain: string) => {
          return await this.getDomainStatusData(domain);
        })
      );
      
      return domains.filter(domain => !status || domain?.status === status);
    }

    // Get all domains (admin view)
    const allDomains = await this.env.DOMAIN_METADATA.list({ prefix: 'domain:' });
    const domains = await Promise.all(
      allDomains.keys.slice(offset, offset + limit).map(async (key: any) => {
        return await this.getDomainStatusData(key.name.replace('domain:', ''));
      })
    );

    return domains.filter(domain => !status || domain?.status === status);
  }

  private async createAuditLog(logData: Partial<AuditLog>): Promise<void> {
    const auditLog: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...logData,
    } as AuditLog;

    await this.env.DOMAIN_DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, domain, action, status, timestamp, 
        user_id, ip_address, user_agent, details, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      auditLog.id,
      auditLog.tenantId,
      auditLog.domain,
      auditLog.action,
      auditLog.status,
      auditLog.timestamp,
      auditLog.userId || null,
      auditLog.ipAddress || null,
      auditLog.userAgent || null,
      JSON.stringify(auditLog.details),
      auditLog.error || null
    ).run();
  }

  private async sendWebhookNotification(event: string, domainStatus: DomainStatus): Promise<void> {
    // Implement webhook notification logic
    console.log(`Sending webhook notification: ${event} for domain ${domainStatus.domain}`);
  }
}


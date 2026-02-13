/**
 * Domain Validation Utilities
 */

export class DomainValidator {
  /**
   * Validate subdomain format
   */
  static isValidSubdomain(subdomain: string): boolean {
    // Must be lowercase alphanumeric with hyphens
    // Must start and end with alphanumeric
    // 3-63 characters
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
    return subdomainRegex.test(subdomain);
  }

  /**
   * Validate full domain format
   */
  static isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    return domainRegex.test(domain);
  }

  /**
   * Sanitize subdomain input
   */
  static sanitizeSubdomain(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 63);
  }

  /**
   * Check if subdomain is reserved
   */
  static isReservedSubdomain(subdomain: string): boolean {
    const reserved = [
      'www',
      'api',
      'admin',
      'mail',
      'ftp',
      'localhost',
      'webmail',
      'smtp',
      'pop',
      'ns1',
      'ns2',
      'test',
      'staging',
      'dev',
      'development',
      'prod',
      'production',
    ];

    return reserved.includes(subdomain.toLowerCase());
  }

  /**
   * Validate tenant slug
   */
  static isValidTenantSlug(slug: string): boolean {
    // 3-30 characters, lowercase alphanumeric with hyphens
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;
    return slugRegex.test(slug) && !this.isReservedSubdomain(slug);
  }
}

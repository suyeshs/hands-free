import { useState, useEffect } from 'react';

/**
 * Tax nomenclature data structure returned by the tax worker
 */
export interface TaxNomenclature {
  country: string;
  countryCode: string;
  taxSystemName: string;
  taxRate: {
    standard: number;
    reduced?: number[];
    description: string;
  };
  taxIdFields: Array<{
    id: string;
    label: string;
    required: boolean;
    format: string;
    example: string;
    description: string;
    validation?: string;
    maxLength?: number;
  }>;
  invoiceRequirements: string[];
  complianceNotes: string[];
  lastUpdated: string;
  verified?: boolean;
}

/**
 * Hook to fetch country-specific tax nomenclature from Cloudflare Worker
 *
 * Uses a three-tier priority system:
 * 1. KV Cache (~50ms) - Fastest
 * 2. Verified Rules (~100ms) - Compliance-ready for IN, US, GB, DE, AE, AU
 * 3. AI Generation (~2-3s) - Dynamic for all other countries
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "IN", "US", "GB")
 * @param enabled - Whether to fetch tax info (default: true)
 * @returns Tax nomenclature data, loading state, and error
 *
 * @example
 * ```tsx
 * const { taxInfo, loading, error } = useTaxNomenclature('IN');
 *
 * if (loading) return <div>Loading tax info...</div>;
 * if (error) return <div>Error: {error}</div>;
 *
 * return (
 *   <div>
 *     <h2>{taxInfo?.taxSystemName}</h2>
 *     {taxInfo?.taxIdFields.map(field => (
 *       <input key={field.id} placeholder={field.example} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useTaxNomenclature(countryCode?: string, enabled: boolean = true) {
  const [taxInfo, setTaxInfo] = useState<TaxNomenclature | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if no country code or disabled
    if (!countryCode || !enabled) {
      setTaxInfo(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchTaxInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://handsfree-tax-nomenclature.suyesh.workers.dev/tax/${countryCode.toUpperCase()}`
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? `Tax information not available for country code: ${countryCode}`
              : `Failed to fetch tax info: ${response.statusText}`
          );
        }

        const data: TaxNomenclature = await response.json();
        setTaxInfo(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('[useTaxNomenclature] Error fetching tax info:', err);
        setError(errorMessage);
        setTaxInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxInfo();
  }, [countryCode, enabled]);

  return { taxInfo, loading, error };
}

/**
 * Hook to fetch list of all cached countries in the tax worker KV
 *
 * @returns Array of cached country codes, loading state, and error
 *
 * @example
 * ```tsx
 * const { countries, loading } = useCachedCountries();
 *
 * return (
 *   <select>
 *     {countries.map(code => (
 *       <option key={code} value={code}>{code}</option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useCachedCountries() {
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          'https://handsfree-tax-nomenclature.suyesh.workers.dev/tax'
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch cached countries: ${response.statusText}`);
        }

        const data: { countries: string[]; count: number } = await response.json();
        setCountries(data.countries);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('[useCachedCountries] Error:', err);
        setError(errorMessage);
        setCountries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, []);

  return { countries, count: countries.length, loading, error };
}

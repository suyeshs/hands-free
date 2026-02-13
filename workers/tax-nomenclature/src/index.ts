/**
 * Tax Nomenclature Worker
 * Uses Cloudflare Workers AI to generate country-specific tax nomenclature
 * Prioritizes verified compliance data for key countries
 * Caches results in KV for fast retrieval (30-day TTL)
 *
 * Endpoints:
 * - GET /tax/:countryCode - Get tax nomenclature for a country (e.g., /tax/IN, /tax/US)
 * - GET /tax - List all cached countries
 */

import { getVerifiedTaxRules, hasVerifiedRules } from './taxationRules';

export interface Env {
  TAX_NOMENCLATURE_KV: KVNamespace;
  AI: Ai;
}

interface TaxField {
  id: string;
  label: string;
  required: boolean;
  format: string;
  example: string;
  description: string;
  validation?: string; // Regex pattern
  maxLength?: number;
}

interface TaxNomenclature {
  country: string;
  countryCode: string;
  taxSystemName: string;
  taxRate: {
    standard: number;
    reduced?: number[];
    description: string;
  };
  taxIdFields: TaxField[];
  invoiceRequirements: string[];
  complianceNotes: string[];
  lastUpdated: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /tax/:countryCode - Get tax nomenclature for a country
      if (path.startsWith('/tax/')) {
        const countryCode = path.split('/')[2]?.toUpperCase();

        if (!countryCode || countryCode.length !== 2) {
          return new Response(
            JSON.stringify({ error: 'Invalid country code. Use ISO 3166-1 alpha-2 format (e.g., IN, US, GB)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const taxInfo = await getTaxNomenclature(countryCode, env);

        return new Response(JSON.stringify(taxInfo), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /tax - List all cached countries
      if (path === '/tax' || path === '/tax/') {
        const list = await env.TAX_NOMENCLATURE_KV.list();
        const countries = list.keys.map(k => k.name);

        return new Response(JSON.stringify({ countries, count: countries.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Root - Health check
      if (path === '/' || path === '') {
        return new Response(
          JSON.stringify({
            service: 'Tax Nomenclature Worker',
            version: '1.0.0',
            status: 'healthy',
            endpoints: {
              '/tax/:countryCode': 'Get tax nomenclature for a country',
              '/tax': 'List all cached countries'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[TaxNomenclature] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },

  /**
   * Scheduled handler - Pre-populate KV cache with common countries
   * Runs daily to ensure cache is always fresh
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[TaxNomenclature] Cron job started at:', new Date(event.scheduledTime).toISOString());

    // List of common countries to pre-populate
    const commonCountries = [
      'IN', // India
      'US', // United States
      'GB', // United Kingdom
      'CA', // Canada
      'AU', // Australia
      'DE', // Germany
      'FR', // France
      'ES', // Spain
      'IT', // Italy
      'NL', // Netherlands
      'BE', // Belgium
      'CH', // Switzerland
      'SE', // Sweden
      'NO', // Norway
      'DK', // Denmark
      'FI', // Finland
      'IE', // Ireland
      'PT', // Portugal
      'GR', // Greece
      'PL', // Poland
      'CZ', // Czech Republic
      'AE', // UAE
      'SA', // Saudi Arabia
      'SG', // Singapore
      'MY', // Malaysia
      'TH', // Thailand
      'JP', // Japan
      'KR', // South Korea
      'CN', // China
      'BR', // Brazil
      'MX', // Mexico
      'AR', // Argentina
      'ZA', // South Africa
      'NG', // Nigeria
      'KE', // Kenya
      'EG', // Egypt
      'NZ', // New Zealand
    ];

    let processed = 0;
    let errors = 0;

    // Process countries concurrently in batches of 5
    const batchSize = 5;
    for (let i = 0; i < commonCountries.length; i += batchSize) {
      const batch = commonCountries.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (countryCode) => {
          try {
            await getTaxNomenclature(countryCode, env);
            processed++;
            console.log(`[TaxNomenclature] ✅ Processed ${countryCode}`);
          } catch (error) {
            errors++;
            console.error(`[TaxNomenclature] ❌ Failed ${countryCode}:`, error);
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[TaxNomenclature] Cron job completed. Processed: ${processed}, Errors: ${errors}`);
  },
};

/**
 * Get tax nomenclature for a country
 * Priority: 1) KV Cache, 2) Verified rules, 3) AI generation
 */
async function getTaxNomenclature(countryCode: string, env: Env): Promise<TaxNomenclature> {
  // Check KV cache first (30-day TTL)
  const cached = await env.TAX_NOMENCLATURE_KV.get(countryCode);

  if (cached) {
    console.log(`[TaxNomenclature] Cache hit for ${countryCode}`);
    return JSON.parse(cached);
  }

  // Check if we have verified tax rules for this country
  const verifiedRules = getVerifiedTaxRules(countryCode);

  if (verifiedRules) {
    console.log(`[TaxNomenclature] Using verified compliance data for ${countryCode}`);
    const taxInfo = verifiedRules;

    // Cache verified rules in KV
    await env.TAX_NOMENCLATURE_KV.put(
      countryCode,
      JSON.stringify(taxInfo),
      { expirationTtl: 60 * 60 * 24 * 30 }
    );

    return taxInfo;
  }

  console.log(`[TaxNomenclature] No verified rules for ${countryCode}, generating with AI...`);

  // Generate using Workers AI
  const taxInfo = await generateTaxNomenclature(countryCode, env);

  // Cache for 30 days
  await env.TAX_NOMENCLATURE_KV.put(
    countryCode,
    JSON.stringify(taxInfo),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );

  return taxInfo;
}

/**
 * Generate tax nomenclature using Cloudflare Workers AI
 */
async function generateTaxNomenclature(countryCode: string, env: Env): Promise<TaxNomenclature> {
  const prompt = `You are a tax compliance expert. Generate detailed tax nomenclature information for restaurants in country code: ${countryCode}

IMPORTANT: Return ONLY valid JSON, no markdown formatting or explanations.

Generate a JSON object with this exact structure:
{
  "country": "Full country name",
  "countryCode": "${countryCode}",
  "taxSystemName": "Name of the tax system (e.g., GST, VAT, Sales Tax)",
  "taxRate": {
    "standard": 5,
    "reduced": [0, 5],
    "description": "Brief description of tax rates for restaurants"
  },
  "taxIdFields": [
    {
      "id": "unique_field_id",
      "label": "Field label as shown to users",
      "required": true,
      "format": "Format description",
      "example": "Example value",
      "description": "What this field represents",
      "validation": "^regex$",
      "maxLength": 15
    }
  ],
  "invoiceRequirements": ["Requirement 1", "Requirement 2"],
  "complianceNotes": ["Note 1", "Note 2"]
}

For restaurants and food service businesses in ${countryCode}, provide:
1. Tax ID numbers required (GST, VAT, EIN, etc.)
2. Food safety/health licenses (FSSAI in India, FDA in US, FSA in UK, etc.)
3. Business registration numbers
4. Invoice requirements specific to restaurants
5. Key compliance notes for restaurant operations

Be accurate and specific. Include regex validation patterns where applicable.`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens: 2048,
      temperature: 0.1, // Very low temperature for factual accuracy
    });

    // Parse AI response
    const aiText = (response as any).response || '';
    console.log(`[TaxNomenclature] AI response for ${countryCode}:`, aiText.substring(0, 200));

    // Extract JSON from response (AI might wrap it in markdown)
    let jsonText = aiText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[TaxNomenclature] AI did not return valid JSON for ${countryCode}`);
      throw new Error('AI did not return valid JSON');
    }

    const taxInfo: TaxNomenclature = JSON.parse(jsonMatch[0]);
    taxInfo.lastUpdated = new Date().toISOString();
    taxInfo.countryCode = countryCode; // Ensure country code is correct

    console.log(`[TaxNomenclature] Successfully generated tax info for ${countryCode}`);
    return taxInfo;
  } catch (error) {
    console.error(`[TaxNomenclature] AI generation failed for ${countryCode}:`, error);

    // Fallback to hardcoded structure for common countries
    return getFallbackTaxNomenclature(countryCode);
  }
}

/**
 * Fallback tax nomenclature if AI fails
 * Provides basic structure for common countries
 */
function getFallbackTaxNomenclature(countryCode: string): TaxNomenclature {
  const fallbacks: Record<string, Partial<TaxNomenclature>> = {
    'IN': {
      country: 'India',
      taxSystemName: 'GST (Goods and Services Tax)',
      taxRate: {
        standard: 5,
        reduced: [0, 5, 12, 18, 28],
        description: 'GST for restaurants: 5% (non-AC) or 18% (AC with alcohol)',
      },
      taxIdFields: [
        {
          id: 'gst_number',
          label: 'GSTIN (GST Number)',
          required: true,
          format: '15 characters alphanumeric',
          example: '29AABCU9603R1ZM',
          description: 'Goods and Services Tax Identification Number',
          validation: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
          maxLength: 15,
        },
        {
          id: 'fssai_number',
          label: 'FSSAI License Number',
          required: true,
          format: '14 digits',
          example: '12345678901234',
          description: 'Food Safety and Standards Authority of India license',
          validation: '^[0-9]{14}$',
          maxLength: 14,
        },
        {
          id: 'pan_number',
          label: 'PAN Number',
          required: true,
          format: '10 characters alphanumeric',
          example: 'ABCDE1234F',
          description: 'Permanent Account Number for tax purposes',
          validation: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
          maxLength: 10,
        },
      ],
      invoiceRequirements: [
        'GSTIN must be displayed on invoice',
        'HSN/SAC codes for items',
        'Tax breakdown (CGST + SGST or IGST)',
        'Invoice serial number with prefix',
        'FSSAI license number on invoice',
      ],
      complianceNotes: [
        'GST registration mandatory if turnover exceeds ₹40 lakhs',
        'FSSAI license mandatory for all food businesses',
        'File GST returns monthly (GSTR-1, GSTR-3B)',
        '5% GST for non-AC restaurants without alcohol',
        '18% GST for AC restaurants serving alcohol',
      ],
    },
    'US': {
      country: 'United States',
      taxSystemName: 'Sales Tax',
      taxRate: {
        standard: 0,
        description: 'Sales tax varies by state (0-10%)',
      },
      taxIdFields: [
        {
          id: 'ein',
          label: 'EIN (Employer Identification Number)',
          required: true,
          format: '9 digits (XX-XXXXXXX)',
          example: '12-3456789',
          description: 'Federal tax identification number',
          validation: '^[0-9]{2}-[0-9]{7}$',
          maxLength: 10,
        },
        {
          id: 'sales_tax_permit',
          label: 'Sales Tax Permit Number',
          required: false,
          format: 'Varies by state',
          example: 'Varies',
          description: 'State-issued sales tax permit',
        },
        {
          id: 'food_service_license',
          label: 'Food Service License',
          required: true,
          format: 'Varies by state/county',
          example: 'Varies',
          description: 'State/county food service establishment license',
        },
      ],
      invoiceRequirements: [
        'Business name and address',
        'State sales tax breakdown if applicable',
        'Invoice number',
        'Itemized list with prices',
      ],
      complianceNotes: [
        'Sales tax requirements vary by state',
        'Food may be exempt from sales tax in some states',
        'FDA food safety requirements apply',
        'Local health department inspections required',
        'Some states require separate permits for alcohol service',
      ],
    },
    'GB': {
      country: 'United Kingdom',
      taxSystemName: 'VAT (Value Added Tax)',
      taxRate: {
        standard: 20,
        reduced: [0, 5],
        description: 'Standard 20%, reduced 5% for hospitality, 0% for cold takeaway',
      },
      taxIdFields: [
        {
          id: 'vat_number',
          label: 'VAT Registration Number',
          required: true,
          format: '9 digits (GB XXXXXXXXX)',
          example: 'GB123456789',
          description: 'Value Added Tax registration number',
          validation: '^GB[0-9]{9}$',
          maxLength: 11,
        },
        {
          id: 'company_number',
          label: 'Company Registration Number',
          required: false,
          format: '8 characters',
          example: '12345678',
          description: 'Companies House registration number',
          maxLength: 8,
        },
        {
          id: 'food_hygiene_rating',
          label: 'Food Hygiene Rating',
          required: true,
          format: '0-5 rating',
          example: '5',
          description: 'Food Standards Agency hygiene rating',
        },
      ],
      invoiceRequirements: [
        'VAT number must be displayed',
        'VAT breakdown for each rate',
        'Invoice serial number',
        'Tax point (date of supply)',
        'Full VAT invoice required for sales over £250',
      ],
      complianceNotes: [
        'VAT registration mandatory if turnover exceeds £85,000',
        'Reduced rate (5%) for hot takeaway food and restaurant service',
        'Cold takeaway food is zero-rated',
        'Making Tax Digital (MTD) compliance required',
        'Food hygiene rating must be displayed at entrance',
      ],
    },
  };

  const fallback = fallbacks[countryCode] || {
    country: `Country ${countryCode}`,
    taxSystemName: 'Tax System',
    taxRate: { standard: 0, description: 'Varies by country' },
    taxIdFields: [],
    invoiceRequirements: ['Contact local tax authority for requirements'],
    complianceNotes: ['Please consult local tax advisor for compliance requirements'],
  };

  return {
    ...fallback,
    countryCode,
    lastUpdated: new Date().toISOString(),
  } as TaxNomenclature;
}

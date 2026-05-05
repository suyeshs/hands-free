# Tax Nomenclature Worker

A Cloudflare Worker that uses **Workers AI** to dynamically generate country-specific tax nomenclature for restaurants. Results are cached in KV for 30 days.

## Features

- 🤖 **AI-Powered**: Uses Cloudflare Workers AI (Llama 3.1) to generate accurate tax information
- 🚀 **Fast**: Results cached in KV with 30-day TTL
- 🌍 **Global**: Supports any country (ISO 3166-1 alpha-2 codes)
- 📋 **Comprehensive**: Returns tax fields, validation rules, invoice requirements, and compliance notes
- 💰 **Cost-Effective**: Free tier includes 10,000 AI requests/day

## What It Returns

For each country, the worker generates:

```typescript
{
  country: string;              // Full country name
  countryCode: string;          // ISO 3166-1 alpha-2 (e.g., "IN", "US", "GB")
  taxSystemName: string;        // e.g., "GST", "VAT", "Sales Tax"
  taxRate: {
    standard: number;           // Standard tax rate
    reduced?: number[];         // Reduced rates if applicable
    description: string;        // Description of rates
  };
  taxIdFields: [                // Required tax ID fields
    {
      id: string;               // Field ID (e.g., "gst_number")
      label: string;            // User-facing label
      required: boolean;        // Is this field mandatory?
      format: string;           // Format description
      example: string;          // Example value
      description: string;      // What this field is
      validation?: string;      // Regex pattern for validation
      maxLength?: number;       // Maximum length
    }
  ];
  invoiceRequirements: string[]; // Invoice requirements
  complianceNotes: string[];     // Key compliance notes
  lastUpdated: string;           // ISO timestamp
}
```

## Setup

### 1. Install Dependencies

```bash
cd platform/workers/tax-nomenclature
npm install
```

### 2. Create KV Namespace

```bash
npm run setup-kv
```

This creates two KV namespaces:
- `TAX_NOMENCLATURE_KV` (development)
- `TAX_NOMENCLATURE_KV` (production)

Copy the namespace IDs to `wrangler.jsonc`.

### 3. Update wrangler.jsonc

Replace `YOUR_KV_NAMESPACE_ID` and `YOUR_PROD_KV_NAMESPACE_ID` with the IDs from step 2.

### 4. Deploy

```bash
# Development
npm run deploy

# Production
npm run deploy:prod
```

## API Endpoints

### GET /tax/:countryCode

Get tax nomenclature for a specific country.

**Example:**
```bash
curl https://handsfree-tax-nomenclature.your-subdomain.workers.dev/tax/IN
```

**Response:**
```json
{
  "country": "India",
  "countryCode": "IN",
  "taxSystemName": "GST (Goods and Services Tax)",
  "taxRate": {
    "standard": 5,
    "reduced": [0, 5, 12, 18, 28],
    "description": "GST for restaurants: 5% (non-AC) or 18% (AC with alcohol)"
  },
  "taxIdFields": [
    {
      "id": "gst_number",
      "label": "GSTIN (GST Number)",
      "required": true,
      "format": "15 characters alphanumeric",
      "example": "29AABCU9603R1ZM",
      "description": "Goods and Services Tax Identification Number",
      "validation": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$",
      "maxLength": 15
    },
    {
      "id": "fssai_number",
      "label": "FSSAI License Number",
      "required": true,
      "format": "14 digits",
      "example": "12345678901234",
      "description": "Food Safety and Standards Authority of India license",
      "validation": "^[0-9]{14}$",
      "maxLength": 14
    }
  ],
  "invoiceRequirements": [
    "GSTIN must be displayed on invoice",
    "HSN/SAC codes for items",
    "Tax breakdown (CGST + SGST or IGST)"
  ],
  "complianceNotes": [
    "GST registration mandatory if turnover exceeds ₹40 lakhs",
    "FSSAI license mandatory for all food businesses"
  ],
  "lastUpdated": "2026-02-06T10:30:00.000Z"
}
```

### GET /tax

List all cached countries.

**Example:**
```bash
curl https://handsfree-tax-nomenclature.your-subdomain.workers.dev/tax
```

**Response:**
```json
{
  "countries": ["IN", "US", "GB", "DE", "FR"],
  "count": 5
}
```

### GET /

Health check.

**Response:**
```json
{
  "service": "Tax Nomenclature Worker",
  "version": "1.0.0",
  "status": "healthy",
  "endpoints": {
    "/tax/:countryCode": "Get tax nomenclature for a country",
    "/tax": "List all cached countries"
  }
}
```

## Integration with Frontend

### React Hook

```typescript
// src/hooks/useTaxNomenclature.ts
import { useState, useEffect } from 'react';

interface TaxNomenclature {
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
}

export function useTaxNomenclature(countryCode?: string) {
  const [taxInfo, setTaxInfo] = useState<TaxNomenclature | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCode) return;

    const fetchTaxInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://handsfree-tax-nomenclature.your-subdomain.workers.dev/tax/${countryCode}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch tax info: ${response.statusText}`);
        }

        const data = await response.json();
        setTaxInfo(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxInfo();
  }, [countryCode]);

  return { taxInfo, loading, error };
}
```

### Usage in Restaurant Settings

```typescript
import { useTaxNomenclature } from '@/hooks/useTaxNomenclature';

export function RestaurantSettings() {
  const { settings } = useRestaurantSettingsStore();
  const [countryCode, setCountryCode] = useState('IN');

  // Fetch tax info based on detected region
  const { taxInfo, loading } = useTaxNomenclature(countryCode);

  if (loading) return <div>Loading tax information...</div>;

  return (
    <div>
      <h2>{taxInfo?.taxSystemName}</h2>

      {/* Dynamically render tax fields */}
      {taxInfo?.taxIdFields.map((field) => (
        <div key={field.id}>
          <label>
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            placeholder={field.example}
            maxLength={field.maxLength}
            pattern={field.validation}
            required={field.required}
          />
          <p className="text-sm text-gray-500">{field.description}</p>
        </div>
      ))}

      {/* Show compliance notes */}
      <div>
        <h3>Compliance Notes</h3>
        <ul>
          {taxInfo?.complianceNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## Caching Strategy

- **KV TTL**: 30 days
- **First Request**: Generates using AI (~2-3 seconds)
- **Subsequent Requests**: Served from KV cache (~50ms)
- **Cache Key**: Country code (e.g., "IN", "US", "GB")
- **Cron Job**: Runs daily at 2 AM UTC to pre-populate common countries

## Cron Job

The worker includes a scheduled handler that runs **daily at 2 AM UTC** to pre-populate the KV cache with 35+ common countries.

**Benefits:**
- ✅ No cold starts for common countries
- ✅ Always fresh data (refreshed every 24 hours)
- ✅ Reduces AI API usage
- ✅ Instant responses for popular countries

**Countries pre-populated:**
India, USA, UK, Canada, Australia, Germany, France, Spain, Italy, Netherlands, Belgium, Switzerland, Sweden, Norway, Denmark, Finland, Ireland, Portugal, Greece, Poland, Czech Republic, UAE, Saudi Arabia, Singapore, Malaysia, Thailand, Japan, South Korea, China, Brazil, Mexico, Argentina, South Africa, Nigeria, Kenya, Egypt, New Zealand

**Cron Schedule:**
```
0 2 * * *  (Daily at 2 AM UTC)
```

**Manual trigger:**
```bash
# Trigger cron manually for testing
npx wrangler dev --test-scheduled
```

## Verified Tax Rules (Compliance-Ready)

The worker uses a **three-tier priority system** to ensure accuracy and speed:

### Priority Order

1. **KV Cache** (~50ms) - Fastest, serves previously generated results
2. **Verified Rules** (~100ms) - Compliance-ready data for key countries
3. **AI Generation** (~2-3s) - Dynamic generation for all other countries

### Countries with Verified Compliance Rules

The following countries have **verified, compliance-ready** tax rules that have been validated for legal accuracy:

- 🇮🇳 **India (IN)** - GST, FSSAI, PAN
  - Complete GST compliance (CGST, SGST, IGST)
  - FSSAI food license requirements
  - PAN card validation
  - Restaurant-specific tax rates (5% non-AC, 18% AC with alcohol)

- 🇺🇸 **United States (US)** - Sales Tax, EIN, Food Service License
  - State-level sales tax system
  - Federal EIN requirements
  - Food service licensing by state
  - Health department permits

- 🇬🇧 **United Kingdom (GB)** - VAT, Food Hygiene Rating
  - Standard 20% VAT
  - Food Hygiene Rating Scheme (FHRS)
  - VAT registration requirements

- 🇩🇪 **Germany (DE)** - Umsatzsteuer (VAT)
  - 19% standard VAT (7% reduced for food)
  - Steuernummer (Tax Number)
  - Finanzamt registration

- 🇦🇪 **United Arab Emirates (AE)** - VAT
  - 5% VAT system
  - TRN (Tax Registration Number)
  - Food safety permits

- 🇦🇺 **Australia (AU)** - GST
  - 10% GST
  - ABN (Australian Business Number)
  - Food business registration

- 🇫🇷 **France (FR)** - TVA (Taxe sur la Valeur Ajoutée)
  - 20% standard TVA, 10% restaurant services, 5.5% takeaway
  - SIREN, SIRET, VAT number
  - KBIS registration, Food safety approval (Agrément Sanitaire)
  - Restaurant & Alcohol licenses (Licence III/IV)

### All Other Countries

For countries not listed above, the worker uses **AI generation** powered by Cloudflare Workers AI (Llama 3.1). The AI generates accurate tax information based on the latest data available, but it's recommended to verify with local authorities for compliance-critical applications.

**Supported:** Any country using ISO 3166-1 alpha-2 codes

## Cost Estimation

Based on Cloudflare Workers AI pricing:

- **Free Tier**: 10,000 requests/day
- **Paid**: $0.011 per 1,000 requests
- **With Caching**: Most requests served from KV (free)

**Example**: 1,000 unique countries × 1 AI request each = **Free**

## Development

```bash
# Run locally
npm run dev

# Watch logs
npm run tail

# Deploy to production
npm run deploy:prod
```

## Environment Variables

Set in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "ENVIRONMENT": "production",
    "SERVICE_VERSION": "1.0.0"
  }
}
```

## License

MIT

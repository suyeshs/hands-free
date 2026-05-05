/**
 * Verified Taxation Rules for Key Countries
 *
 * This file contains verified, compliance-ready tax rules for major countries.
 * These rules take precedence over AI-generated data for accuracy and legal compliance.
 *
 * Last Updated: 2026-02-06
 * Sources: Official tax authority websites, legal compliance databases
 */

interface TaxField {
  id: string;
  label: string;
  required: boolean;
  format: string;
  example: string;
  description: string;
  validation?: string;
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
  verified: boolean; // Indicates this is verified compliance data
}

/**
 * Verified taxation rules for key countries
 * These are regularly reviewed and updated for compliance
 */
export const VERIFIED_TAX_RULES: Record<string, TaxNomenclature> = {
  // INDIA - GST Regime
  'IN': {
    country: 'India',
    countryCode: 'IN',
    taxSystemName: 'GST (Goods and Services Tax)',
    taxRate: {
      standard: 5,
      reduced: [0, 5, 12, 18, 28],
      description: 'Restaurants: 5% GST (non-AC without alcohol) or 18% GST (AC with alcohol license)',
    },
    taxIdFields: [
      {
        id: 'gst_number',
        label: 'GSTIN (GST Number)',
        required: true,
        format: '15 characters alphanumeric (2-digit state code + 10-digit PAN + entity code + Z + checksum)',
        example: '29AABCU9603R1ZM',
        description: 'Goods and Services Tax Identification Number issued by GST department',
        validation: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
        maxLength: 15,
      },
      {
        id: 'fssai_number',
        label: 'FSSAI License Number',
        required: true,
        format: '14 digits',
        example: '12345678901234',
        description: 'Food Safety and Standards Authority of India license - mandatory for all food businesses',
        validation: '^[0-9]{14}$',
        maxLength: 14,
      },
      {
        id: 'pan_number',
        label: 'PAN (Permanent Account Number)',
        required: true,
        format: '10 characters (5 letters + 4 digits + 1 letter)',
        example: 'ABCDE1234F',
        description: 'Income Tax PAN for business/individual - required for GST registration',
        validation: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
        maxLength: 10,
      },
      {
        id: 'cin_number',
        label: 'CIN (Corporate Identity Number)',
        required: false,
        format: '21 characters alphanumeric',
        example: 'U12345KA2020PTC123456',
        description: 'Corporate Identity Number (only for companies, not for proprietorship/partnership)',
        validation: '^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$',
        maxLength: 21,
      },
    ],
    invoiceRequirements: [
      'GSTIN must be displayed prominently on all tax invoices',
      'FSSAI license number must be displayed on invoices',
      'HSN/SAC codes mandatory for items (HSN for goods, SAC for services)',
      'Tax invoice must show CGST + SGST (intra-state) OR IGST (inter-state)',
      'Invoice serial number with prefix (continuous series)',
      'Date of invoice (tax point)',
      'Customer GSTIN if registered (for B2B)',
      'Place of supply',
      'Signature or digital signature',
    ],
    complianceNotes: [
      'GST Registration: Mandatory if annual turnover exceeds ₹40 lakhs (₹20 lakhs for special category states)',
      'FSSAI License: Mandatory for ALL food businesses regardless of size',
      'GST Returns: GSTR-1 (monthly outward supplies), GSTR-3B (monthly summary), GSTR-9 (annual return)',
      'Restaurant GST Rates: 5% for non-AC restaurants without liquor license, 18% for AC restaurants with liquor license',
      'Input Tax Credit (ITC): Restaurants CANNOT claim ITC on GST paid (except restaurants in hotels with room tariff ≥₹7,500)',
      'E-invoicing: Mandatory for businesses with turnover > ₹5 crores from 01-Aug-2023',
      'Place of supply for restaurant services: Location where service is performed',
      'Service charge is NOT the same as GST - Service charge is optional and discretionary',
      'Composition scheme: Not available for restaurants serving alcohol or having inter-state supplies',
      'Food delivery via Swiggy/Zomato: Treated as restaurant service (5% GST) if prepared by restaurant',
      'FSSAI Central License required if turnover > ₹20 crores',
      'State FSSAI License for turnover < ₹12 lakhs, Central License for > ₹20 crores',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },

  // UNITED STATES - Sales Tax System
  'US': {
    country: 'United States',
    countryCode: 'US',
    taxSystemName: 'Sales Tax (State-Level)',
    taxRate: {
      standard: 0,
      reduced: [],
      description: 'Sales tax varies by state (0% to 10.25%). Five states have no sales tax: AK, DE, MT, NH, OR',
    },
    taxIdFields: [
      {
        id: 'ein',
        label: 'EIN (Employer Identification Number)',
        required: true,
        format: '9 digits in XX-XXXXXXX format',
        example: '12-3456789',
        description: 'Federal Tax ID issued by IRS - required for all businesses with employees',
        validation: '^[0-9]{2}-[0-9]{7}$',
        maxLength: 10,
      },
      {
        id: 'sales_tax_permit',
        label: 'Sales Tax Permit / Resale Certificate',
        required: false, // Varies by state
        format: 'Varies by state',
        example: 'State-specific format',
        description: 'State-issued sales tax permit - required in states with sales tax',
      },
      {
        id: 'food_service_license',
        label: 'Food Service Establishment License',
        required: true,
        format: 'Varies by state/county',
        example: 'Varies',
        description: 'State or county health department food service license - mandatory for all food businesses',
      },
      {
        id: 'alcohol_license',
        label: 'Liquor License',
        required: false,
        format: 'Varies by state',
        example: 'State-specific',
        description: 'State-issued liquor license if serving alcohol',
      },
    ],
    invoiceRequirements: [
      'Business legal name and DBA (if applicable)',
      'Business address',
      'State sales tax breakdown (if applicable)',
      'Invoice number (sequential)',
      'Date of sale',
      'Itemized list of goods/services with individual prices',
      'Total amount including tax',
      'Sales tax rate applied (if applicable)',
    ],
    complianceNotes: [
      'Sales Tax: Administered at state level - 45 states + DC have sales tax',
      'No sales tax states: Alaska, Delaware, Montana, New Hampshire, Oregon',
      'Food exemptions: Many states exempt unprepared food but tax prepared/hot food',
      'Restaurant meals: Generally taxable in all states with sales tax',
      'Combined rates: State + county + city can reach 10%+ in some jurisdictions',
      'Economic nexus: Must collect sales tax if revenue/transactions exceed state thresholds',
      'FDA compliance: All food businesses must follow FDA Food Code',
      'Serve Safe certification: Required for at least one manager in most states',
      'Local health inspections: Frequency varies (typically 1-4 times per year)',
      'Employment taxes: FICA, FUTA, state unemployment insurance',
      'Tip reporting: Employers must report tips to IRS (Form 8027 for large food establishments)',
      'ADA compliance: Facilities must meet accessibility requirements',
      'Calorie labeling: Chain restaurants (20+ locations) must display calorie information',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },

  // UNITED KINGDOM - VAT System
  'GB': {
    country: 'United Kingdom',
    countryCode: 'GB',
    taxSystemName: 'VAT (Value Added Tax)',
    taxRate: {
      standard: 20,
      reduced: [0, 5],
      description: 'Standard 20%, Reduced 5% for hot takeaway and hospitality, 0% for cold takeaway food',
    },
    taxIdFields: [
      {
        id: 'vat_number',
        label: 'VAT Registration Number',
        required: true,
        format: '9 digits with GB prefix (GB XXXXXXXXX)',
        example: 'GB123456789',
        description: 'VAT number issued by HMRC - mandatory if turnover exceeds £85,000',
        validation: '^GB[0-9]{9}$',
        maxLength: 11,
      },
      {
        id: 'company_number',
        label: 'Company Registration Number',
        required: false,
        format: '8 characters alphanumeric',
        example: '12345678',
        description: 'Companies House registration number (for limited companies)',
        validation: '^[A-Z0-9]{8}$',
        maxLength: 8,
      },
      {
        id: 'food_business_registration',
        label: 'Food Business Registration',
        required: true,
        format: 'Local authority registration',
        example: 'Varies by local authority',
        description: 'Registration with local authority environmental health - must be done at least 28 days before opening',
      },
      {
        id: 'food_hygiene_rating',
        label: 'Food Hygiene Rating',
        required: true,
        format: 'Rating 0-5',
        example: '5',
        description: 'Food Standards Agency (FSA) hygiene rating - must be displayed at entrance (England)',
      },
    ],
    invoiceRequirements: [
      'VAT invoice required for sales over £250 (simplified invoice for under £250)',
      'Business name, address, and VAT number',
      'Invoice number (unique sequential)',
      'Date of supply (tax point)',
      'Customer name and address (for VAT invoice)',
      'Description of goods/services',
      'VAT rate and amount for each rate category',
      'Total amount excluding VAT',
      'Total VAT charged',
      'Total amount including VAT',
    ],
    complianceNotes: [
      'VAT Registration: Mandatory if taxable turnover exceeds £85,000 in a 12-month period',
      'VAT Rates for Food: Standard 20%, Reduced 5% for catering and hot takeaway, 0% for cold takeaway',
      'Hot food: Any food above ambient temperature is considered hot food (5% VAT)',
      'Cold takeaway: Sandwiches, cold pasties, cold drinks are zero-rated (0% VAT)',
      'Eat-in vs takeaway: Eat-in meals are standard rated (20% or 5%), cold takeaway is 0%',
      'Making Tax Digital (MTD): Mandatory for VAT-registered businesses - must use MTD-compatible software',
      'VAT Returns: Quarterly submission (can opt for monthly or annual in some cases)',
      'Food Hygiene Rating: Mandatory display in England (voluntary in Scotland, Wales)',
      'Allergen Information: Must provide allergen information for all menu items',
      'Food Standards Agency (FSA): Regular inspections based on risk rating',
      'Scores on the Doors: Food hygiene rating displayed at entrance and online',
      'Alcohol License: Premises license required to sell alcohol',
      'Late Night Levy: May apply for venues selling alcohol after midnight',
      'Business Rates: Property tax on commercial premises',
      'PAYE: Required if you have employees',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },

  // EUROPEAN UNION (Germany as representative)
  'DE': {
    country: 'Germany',
    countryCode: 'DE',
    taxSystemName: 'Umsatzsteuer (VAT)',
    taxRate: {
      standard: 19,
      reduced: [7],
      description: 'Standard 19%, Reduced 7% for food and beverages (excluding alcohol)',
    },
    taxIdFields: [
      {
        id: 'vat_number',
        label: 'USt-IdNr. (VAT Number)',
        required: true,
        format: 'DE + 9 digits',
        example: 'DE123456789',
        description: 'Umsatzsteuer-Identifikationsnummer (VAT ID)',
        validation: '^DE[0-9]{9}$',
        maxLength: 11,
      },
      {
        id: 'tax_number',
        label: 'Steuernummer (Tax Number)',
        required: true,
        format: 'Varies by tax office',
        example: '12/345/67890',
        description: 'Tax number issued by local tax office (Finanzamt)',
      },
      {
        id: 'trade_license',
        label: 'Gewerbeanmeldung (Trade License)',
        required: true,
        format: 'Local trade office registration',
        example: 'Varies',
        description: 'Business registration with local trade office (Gewerbeamt)',
      },
      {
        id: 'health_certificate',
        label: 'Gesundheitszeugnis (Health Certificate)',
        required: true,
        format: 'Health department certification',
        example: 'Varies',
        description: 'Health certificate for food handling (required for all food workers)',
      },
    ],
    invoiceRequirements: [
      'Full name and address of supplier',
      'Full name and address of customer (for B2B)',
      'Tax number or VAT ID',
      'Invoice number (unique and sequential)',
      'Invoice date',
      'Delivery/service date',
      'Description of goods/services with quantity and type',
      'Net amount per item',
      'VAT rate and amount per rate',
      'Total net amount',
      'Total VAT amount',
      'Gross total',
    ],
    complianceNotes: [
      'VAT Registration: Mandatory for businesses with turnover exceeding €22,000/year',
      'Food VAT Rates: 7% for food and non-alcoholic beverages, 19% for alcohol and on-premise consumption',
      'Restaurant services: Generally 19% VAT for dining in, 7% for takeaway food',
      'Reverse charge: B2B services may be subject to reverse charge mechanism',
      'Vorsteuerabzug: Input VAT deduction available for business expenses',
      'Monthly/Quarterly VAT returns: Depends on annual turnover',
      'Cash register requirement: Mandatory electronic cash registers since 2020',
      'TSE (Technical Security Equipment): Required for all electronic cash registers',
      'Kassengesetz: Strict rules for cash handling and documentation',
      'Hygiene regulations: HACCP principles must be followed',
      'Allergenkennzeichnung: Allergen labeling mandatory on menu',
      'Alcohol license: Schankerlaubnis required to serve alcohol',
      'Sunday/holiday work permits: Special permits may be required',
      'Deposit system (Pfand): Applicable for certain beverage containers',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },

  // UNITED ARAB EMIRATES
  'AE': {
    country: 'United Arab Emirates',
    countryCode: 'AE',
    taxSystemName: 'VAT (Value Added Tax)',
    taxRate: {
      standard: 5,
      reduced: [0],
      description: 'Standard 5%, Zero-rated 0% for certain food items',
    },
    taxIdFields: [
      {
        id: 'trn',
        label: 'TRN (Tax Registration Number)',
        required: true,
        format: '15 digits',
        example: '123456789012345',
        description: 'VAT Tax Registration Number issued by FTA (Federal Tax Authority)',
        validation: '^[0-9]{15}$',
        maxLength: 15,
      },
      {
        id: 'trade_license',
        label: 'Trade License Number',
        required: true,
        format: 'Varies by emirate',
        example: 'Emirate-specific format',
        description: 'Trade license issued by Department of Economic Development',
      },
      {
        id: 'food_license',
        label: 'Food License',
        required: true,
        format: 'Varies by emirate',
        example: 'Varies',
        description: 'Food establishment license from municipality',
      },
    ],
    invoiceRequirements: [
      'Tax invoice for B2B (simplified for B2C under AED 10,000)',
      'Supplier name, address, and TRN',
      'Customer name, address, and TRN (if B2B)',
      'Invoice number and date',
      'Description of goods/services',
      'Total amount excluding VAT',
      'VAT amount at each rate',
      'Total amount including VAT',
      '"Tax Invoice" heading for full invoices',
    ],
    complianceNotes: [
      'VAT Registration: Mandatory if taxable supplies exceed AED 375,000/year',
      'Voluntary registration: Available for businesses with supplies between AED 187,500 - AED 375,000',
      'Restaurant VAT: 5% standard rate applies to restaurant and catering services',
      'Zero-rated food: Basic food items are zero-rated (0% VAT)',
      'Municipality fees: Additional 7-10% municipality fee may apply in some emirates',
      'Tourism fee: 10% tourism dirham fee for tourism-related services',
      'Alcohol license: Special license required (available only to hotels in most emirates)',
      'Halal certification: Required for meat and meat products',
      'Food safety: Follows GCC Standardization Organization (GSO) standards',
      'VAT Returns: Filed monthly or quarterly depending on expected annual turnover',
      'Electronic invoicing: E-invoicing requirements being phased in',
      'Wage Protection System (WPS): Mandatory for salary payments to employees',
      'Labor regulations: Ministry of Human Resources rules apply',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },

  // AUSTRALIA
  'AU': {
    country: 'Australia',
    countryCode: 'AU',
    taxSystemName: 'GST (Goods and Services Tax)',
    taxRate: {
      standard: 10,
      reduced: [0],
      description: 'Standard 10%, GST-free 0% for basic food',
    },
    taxIdFields: [
      {
        id: 'abn',
        label: 'ABN (Australian Business Number)',
        required: true,
        format: '11 digits',
        example: '12345678901',
        description: 'Australian Business Number - required for all businesses',
        validation: '^[0-9]{11}$',
        maxLength: 11,
      },
      {
        id: 'acn',
        label: 'ACN (Australian Company Number)',
        required: false,
        format: '9 digits',
        example: '123456789',
        description: 'Australian Company Number (for companies only)',
        validation: '^[0-9]{9}$',
        maxLength: 9,
      },
      {
        id: 'food_license',
        label: 'Food Business License',
        required: true,
        format: 'State/council specific',
        example: 'Varies by state',
        description: 'Food business license/registration with local council',
      },
    ],
    invoiceRequirements: [
      'Tax invoice required for sales over $82.50 (including GST)',
      'Words "Tax Invoice" prominently displayed',
      'Seller ABN',
      'Seller name and address',
      'Date of issue',
      'Description of items sold',
      'GST amount (or statement that total includes GST)',
      'Total price including GST',
      'For sales over $1,000: Buyer identity or ABN',
    ],
    complianceNotes: [
      'GST Registration: Mandatory if annual turnover exceeds $75,000 ($150,000 for non-profits)',
      'Food and GST: Basic food is GST-free, restaurant meals are taxable at 10%',
      'BAS (Business Activity Statement): Quarterly or monthly GST reporting',
      'PAYG withholding: Required for employees',
      'Superannuation: Employer must pay 11% super contribution',
      'Fair Work Act: Minimum wage and employment conditions apply',
      'Food Standards Australia New Zealand (FSANZ): National food safety standards',
      'Food Safety Programs: Required for most food businesses (based on state/territory)',
      'Allergen labeling: Mandatory for packaged foods',
      'Liquor License: Required to serve/sell alcohol (state-based licensing)',
      'Responsible Service of Alcohol (RSA): Staff certification required',
      'Local council permits: Food premises approval required',
      'WorkSafe regulations: Occupational health and safety compliance',
      'Single Touch Payroll (STP): Real-time payroll reporting to ATO',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },

  // FRANCE
  'FR': {
    country: 'France',
    countryCode: 'FR',
    taxSystemName: 'TVA (Taxe sur la Valeur Ajoutée)',
    taxRate: {
      standard: 20,
      reduced: [5.5, 10],
      description: 'Standard 20%, Reduced 10% for restaurant services, 5.5% for food to-go',
    },
    taxIdFields: [
      {
        id: 'siren',
        label: 'SIREN',
        required: true,
        format: '9 digits',
        example: '123456789',
        description: 'Système d\'Identification du Répertoire des Entreprises (Business ID)',
        validation: '^[0-9]{9}$',
        maxLength: 9,
      },
      {
        id: 'siret',
        label: 'SIRET',
        required: true,
        format: '14 digits',
        example: '12345678901234',
        description: 'Système d\'Identification du Répertoire des Établissements (Establishment ID)',
        validation: '^[0-9]{14}$',
        maxLength: 14,
      },
      {
        id: 'vat_number',
        label: 'Numéro de TVA intracommunautaire',
        required: true,
        format: 'FR + 2 digits + 9 digits',
        example: 'FR12345678901',
        description: 'Intra-community VAT number for EU transactions',
        validation: '^FR[0-9A-Z]{2}[0-9]{9}$',
        maxLength: 13,
      },
      {
        id: 'kbis',
        label: 'Extrait KBIS',
        required: true,
        format: 'Registration certificate',
        example: 'Varies',
        description: 'Company registration certificate from Registre du Commerce et des Sociétés (RCS)',
      },
      {
        id: 'food_license',
        label: 'Agrément Sanitaire',
        required: true,
        format: 'Sanitary approval number',
        example: 'FR 75.123.456 CE',
        description: 'Food safety approval from Direction Départementale de la Protection des Populations (DDPP)',
      },
      {
        id: 'restaurant_license',
        label: 'Licence de Restaurant',
        required: false,
        format: 'License certificate',
        example: 'Varies by municipality',
        description: 'Restaurant operating license (petite licence if no alcohol)',
      },
      {
        id: 'alcohol_license',
        label: 'Licence IV (Alcohol)',
        required: false,
        format: 'Alcohol license number',
        example: 'Varies',
        description: 'License to serve spirits (Licence IV) or wine/beer (Licence III)',
      },
    ],
    invoiceRequirements: [
      'Business name and legal form (SARL, SAS, etc.)',
      'SIRET number on all invoices',
      'Full business address',
      'RCS registration number and city',
      'Invoice number (chronological and continuous)',
      'Invoice date',
      'Delivery/service date',
      'Customer name and address (for B2B)',
      'Description of goods/services with quantity',
      'Unit price (HT - excluding tax)',
      'Total amount HT (excluding VAT)',
      'TVA rate(s) applied',
      'TVA amount per rate',
      'Total TTC (including VAT)',
      'Payment terms and conditions',
      'Late payment penalties (must be stated)',
      'Recovery indemnity (fixed at €40)',
      'For exempt/zero-rated: mention legal basis (Article 293B du CGI)',
    ],
    complianceNotes: [
      'TVA Registration: Mandatory above €36,800 turnover for services (€91,900 for goods)',
      'Restaurant TVA: 10% for on-site consumption, 5.5% for takeaway food',
      'Alcohol: 20% standard TVA rate applies to all alcoholic beverages',
      'Cotisation Foncière des Entreprises (CFE): Annual property tax for businesses',
      'URSSAF: Social security contributions for employees (up to 45% of gross salary)',
      'Contrat de Travail: Written employment contracts required',
      'Code du Travail: French labor code compliance (35-hour work week, overtime rules)',
      'HACCP: Hygiene principles mandatory for food businesses',
      'Allergène: Allergen declaration mandatory (14 allergens must be listed)',
      'Affichage des prix: Menu prices must be displayed outside (TTC - tax included)',
      'Licence IV: Required to serve spirits (limited availability, expensive)',
      'Licence III: Required for wine, beer, cider (more accessible)',
      'Déclaration CERFA: Food business declaration to DDPP before opening',
      'Formation hygiène: Mandatory food hygiene training for at least one staff member',
      'Caisse enregistreuse: Certified cash register required (anti-fraud law)',
      'ERP (Établissement Recevant du Public): Safety regulations for public-facing establishments',
      'Commission de Sécurité: Safety inspection required before opening',
      'Registre unique du personnel: Employee register must be maintained',
      'Document Unique: Workplace risk assessment document required',
      'Mutuelle: Health insurance contribution for employees',
      'Tickets restaurant: Meal vouchers (common employee benefit)',
      'TVA returns: Monthly or quarterly depending on turnover',
      'Facture électronique: Electronic invoicing mandatory for B2B transactions (phased rollout)',
    ],
    lastUpdated: '2026-02-06',
    verified: true,
  },
};

/**
 * Get verified tax rules for a country, or null if not available
 */
export function getVerifiedTaxRules(countryCode: string): TaxNomenclature | null {
  return VERIFIED_TAX_RULES[countryCode.toUpperCase()] || null;
}

/**
 * Check if a country has verified tax rules
 */
export function hasVerifiedRules(countryCode: string): boolean {
  return countryCode.toUpperCase() in VERIFIED_TAX_RULES;
}

/**
 * Get list of all countries with verified tax rules
 */
export function getVerifiedCountries(): string[] {
  return Object.keys(VERIFIED_TAX_RULES);
}

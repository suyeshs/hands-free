# Restaurant Settings (USA - Full Service)

Complete restaurant configuration plugin for US full-service restaurants with sales tax, tip management, and regulatory compliance.

## Features

- **Sales Tax System**: State + Local tax configuration
- **Tip Management**: Suggested tip percentages on receipts
- **Full 7-Tab Layout**: Comprehensive settings for all aspects
- **Health Permits**: Compliance tracking for inspections
- **Liquor Licensing**: Alcohol service documentation
- **Staff Management**: PIN-based access and table assignments
- **Split Checks**: Support for separate billing

## Target Restaurants

- Full-Service Restaurants
- Fine Dining Establishments
- Casual Dining Chains
- Steakhouses
- Seafood Restaurants
- Hotel Restaurants

## Tabs Overview

### 1. Restaurant Basics (🏪)
- Restaurant type and name
- Complete address and contact info
- Online presence and reservations
- Restaurant logo

### 2. Tax & Pricing (💰)
- Sales tax (state + local)
- Tip suggestion percentages
- Tax-inclusive vs exclusive pricing
- Automatic gratuity rules

### 3. Legal & Permits (📋)
- EIN (Employer Identification Number)
- State Tax ID
- Health Permit Number
- Liquor License Number (if applicable)

### 4. Invoice & Billing (🧾)
- Invoice prefix and numbering
- Terms and conditions
- Payment disclaimers
- Receipt footer messages

### 5. Printing (🖨️)
- Thermal printer configuration
- Tip line on receipts
- Logo printing
- Split check formatting

### 6. Staff & Access (👥)
- Staff PIN requirements
- Table assignment filtering
- Server sales tracking
- Manager override codes

### 7. Appearance (🎨)
- Brightness control
- Day/night modes
- Interface styling

## US Tax System

### Sales Tax Calculation
Unlike GST (India) or VAT (Europe), US sales tax:
- **Not split**: Single rate combining state + local
- **Varies by location**: Different rates per city/county
- **Applied at checkout**: Added to menu prices
- **Not included in menu**: Prices shown before tax

### Example Tax Rates
| Location | State Tax | Local Tax | Total |
|----------|-----------|-----------|-------|
| New York, NY | 4.0% | 4.875% | 8.875% |
| Los Angeles, CA | 7.25% | 2.25% | 9.5% |
| Chicago, IL | 6.25% | 4.75% | 11.0% |
| Miami, FL | 6.0% | 1.0% | 7.0% |
| Dallas, TX | 6.25% | 2.0% | 8.25% |

### Tip Culture
- **Standard Tips**: 15-20% of pre-tax amount
- **Excellent Service**: 20-25%
- **Large Parties**: Auto-gratuity (18-20%) for 6+ guests
- **Tip Line**: Printed on credit card receipts
- **Tip Pooling**: May be enabled for team distribution

## Compliance Requirements

### Federal Requirements
- **EIN**: Required for all businesses with employees
- **OSHA**: Workplace safety compliance
- **ADA**: Accessibility requirements
- **Fair Labor Standards Act**: Wage and hour laws

### State Requirements
- **Sales Tax Permit**: Required in most states
- **Health Permit**: Food service license
- **Liquor License**: If serving alcohol
  - Beer & Wine License
  - Full Bar License
  - Catering Permit
- **Business License**: General operation permit

### Local Requirements
- **Certificate of Occupancy**: Building approval
- **Fire Inspection**: Safety clearance
- **Signage Permit**: Exterior advertising
- **Music License**: ASCAP/BMI if playing music

## Regional Defaults

- **Currency**: USD ($)
- **Timezone**: America/New_York (adjustable per location)
- **Tax System**: Sales Tax (state + local)
- **Invoice Prefix**: INV-
- **Date Format**: MM/DD/YYYY
- **Time Format**: 12-hour (AM/PM)
- **Paper Width**: 80mm (3 inch)

## Best Practices

1. **Tax Accuracy**: Verify tax rates with state/local authorities annually
2. **Tip Compliance**: Follow DOL guidelines for tip pooling and reporting
3. **Health Inspections**: Keep permit numbers current and visible
4. **Liquor Compliance**: Train staff on responsible service laws
5. **Staff Training**: Regular PIN updates and access audits
6. **Receipt Clarity**: Clear tax breakdown for customer transparency

## Support

For US restaurant setup:
- Visit Settings → Help & Support
- Email: support@guanix.com
- US Compliance Guide: https://docs.guanix.com/usa/compliance

## Version History

### 1.0.0 (2026-02-09)
- Initial release
- Full 7-tab comprehensive layout
- Sales tax system support
- Tip management integration
- US compliance fields

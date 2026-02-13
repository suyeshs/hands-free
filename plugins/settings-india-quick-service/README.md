# Restaurant Settings (India - Quick Service)

Simplified restaurant configuration plugin designed for Indian quick-service restaurants (QSR) and fast food establishments.

## Features

- **Simplified Layout**: Streamlined 4-tab interface focused on essentials
- **GST Compliance**: CGST/SGST tax configuration with compliance tracking
- **FSSAI Registration**: Food license number display on receipts
- **No Service Charge**: Optimized for quick-service pricing model
- **Takeaway Focus**: Designed for counter service and delivery
- **Fast Operations**: Minimal setup for quick onboarding

## Target Restaurants

- Quick Service Restaurants (QSR)
- Fast Food Chains
- Food Courts
- Counter Service Cafes
- Takeaway & Delivery Kitchens

## Tabs Overview

### 1. Essentials
- Restaurant type and basic details
- Address and contact information
- Online features (cloud sync, ordering)
- Logo upload

### 2. Tax & Compliance
- GST configuration (CGST/SGST)
- GSTIN and FSSAI registration numbers
- Tax-inclusive pricing options

### 3. Operations
- Invoice numbering and branding
- Thermal printer settings (58mm/80mm)
- Receipt customization

### 4. Appearance
- Adaptive brightness control
- Border style preferences
- Day/night mode optimization

## Key Differences from Full Service

| Feature | Full Service | Quick Service |
|---------|--------------|---------------|
| Service Charge | ✅ Enabled by default | ❌ Disabled |
| Table Management | ✅ Required | ❌ Not needed |
| Bar Features | ✅ Available | ❌ Hidden |
| Staff PIN | ⚠️ Recommended | ⚙️ Optional |
| PAN Number | ✅ Required | ⚙️ Optional |
| Default Invoice Prefix | `INV-` | `QSR-` |

## Installation

This plugin is automatically available for Indian quick-service restaurants. It activates when:

1. Region is set to India
2. Restaurant type is set to Quick Service
3. User navigates to Settings → Business Setup → Restaurant Information

## Usage

1. **First Setup**:
   - Complete Essentials tab (restaurant name, address, contact)
   - Configure Tax & Compliance (GST rates, FSSAI number)
   - Set invoice prefix and printing options

2. **Daily Operations**:
   - Adjust brightness based on ambient lighting
   - Update online features as needed
   - Modify receipt branding

3. **Compliance**:
   - Keep GSTIN and FSSAI numbers up to date
   - Ensure tax rates match current regulations
   - Review invoice terms periodically

## Regional Defaults

- **Currency**: INR (₹)
- **Timezone**: Asia/Kolkata
- **Tax System**: GST (CGST + SGST)
- **Date Format**: DD/MM/YYYY
- **Time Format**: 12-hour
- **Paper Width**: 80mm (standard)

## Support

For help with restaurant settings:
- Visit Settings → Help & Support
- Email: support@guanix.com
- Documentation: https://docs.guanix.com/settings/qsr-india

## Version History

### 1.0.0 (2026-02-09)
- Initial release
- Simplified 4-tab interface
- GST and FSSAI compliance
- Shared components architecture
- Theme integration

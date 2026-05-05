# Restaurant Settings (India - Cloud Kitchen)

Delivery-focused restaurant configuration plugin designed for Indian cloud kitchens and virtual brands.

## Features

- **Delivery-First Design**: Optimized for online ordering and aggregator platforms
- **GST Compliance**: CGST/SGST tax configuration
- **FSSAI Critical**: Food license verification mandatory for cloud kitchens
- **Packaging Charges**: Built-in support for container and packaging costs
- **No Dine-In**: Table management and bar features hidden
- **Aggregator Ready**: Integration-friendly for Zomato, Swiggy, etc.

## Target Restaurants

- Cloud Kitchens
- Virtual Brands
- Delivery-Only Restaurants
- Ghost Kitchens
- Dark Kitchens
- Multi-brand Cloud Kitchens

## Tabs Overview

### 1. Essentials (🏭)
- Restaurant type and business details
- Delivery address (critical for operations)
- Online features and aggregator sync
- Brand logo for packaging

### 2. Tax & Compliance (💰)
- GST configuration
- FSSAI license (mandatory display)
- Tax and packaging charge settings

### 3. Operations (📦)
- Invoice prefix (defaults to "CK-")
- Packaging slip customization
- Thermal printer for order tickets
- Delivery note configuration

### 4. Appearance (🎨)
- Kitchen display brightness
- Interface style for prep areas

## Key Features for Cloud Kitchens

| Feature | Status | Notes |
|---------|--------|-------|
| FSSAI License | ✅ Mandatory | Must be displayed on all packaging |
| Packaging Charges | ✅ Enabled | Default ₹20 per order |
| Delivery Integration | ✅ Built-in | Sync with aggregators |
| Table Management | ❌ Hidden | Not applicable |
| Dine-in Features | ❌ Hidden | Delivery-only focus |
| Service Charge | ❌ Disabled | Not used in delivery |
| Online Ordering | ✅ Required | Core to business model |

## Regional Defaults

- **Currency**: INR (₹)
- **Timezone**: Asia/Kolkata
- **Tax System**: GST (CGST + SGST)
- **Invoice Prefix**: CK- (Cloud Kitchen)
- **Packaging Charge**: ₹20 per order
- **Paper Width**: 80mm
- **Date Format**: DD/MM/YYYY

## Compliance Requirements

### FSSAI Registration
Cloud kitchens MUST have valid FSSAI license:
- **Basic FSSAI**: Turnover < ₹12 lakhs/year
- **State FSSAI**: Turnover ₹12 lakhs - ₹20 crores/year
- **Central FSSAI**: Turnover > ₹20 crores/year

License number must be printed on:
- All packaging
- Delivery receipts
- Online menu listings

### GST Compliance
- GSTIN required for turnover > ₹40 lakhs/year
- CGST + SGST applicable on all orders
- Tax invoice mandatory for B2B orders

## Best Practices

1. **Address Accuracy**: Double-check delivery address for aggregator integration
2. **Logo Quality**: High-resolution logo for packaging and aggregator listings
3. **FSSAI Display**: Ensure license number is visible on all touchpoints
4. **Packaging Charges**: Adjust based on actual container costs
5. **Online Features**: Keep enabled for order sync and menu updates
6. **Kitchen Display**: Set high brightness for well-lit kitchen environments

## Integration with Aggregators

This plugin is optimized for:
- **Zomato**: Menu sync, order management, delivery tracking
- **Swiggy**: Outlet details, pricing, availability updates
- **Uber Eats**: Business profile, menu integration
- **Dunzo**: Hyperlocal delivery integration

## Support

For cloud kitchen setup assistance:
- Visit Settings → Help & Support
- Email: support@guanix.com
- Cloud Kitchen Guide: https://docs.guanix.com/cloud-kitchen

## Version History

### 1.0.0 (2026-02-09)
- Initial release
- Delivery-focused 4-tab interface
- Packaging charge support
- FSSAI compliance emphasis
- Aggregator integration ready

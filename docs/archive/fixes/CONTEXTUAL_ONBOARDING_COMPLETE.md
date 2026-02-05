# Contextual Onboarding & Setup Flow - Complete

## Overview

The restaurant onboarding has been completely refactored to match the handsfree-admin.pages.dev pattern with a focus on **contextual, intelligent setup guidance** that prioritizes the most magical experiences first.

## Key Changes

### 1. Simplified Provisioning Form ✅

**File**: `src/components/SimpleRestaurantOnboarding.tsx`

**Changes**:
- Matches handsfree-admin pattern exactly
- 4 fields only: Restaurant Name, Email, Phone, Subdomain
- Address and details come LATER in the flow
- Auto-generates subdomain from restaurant name
- Stores tenant metadata locally after provisioning
- Redirects directly to Hub page after activation

**Pattern**:
```
Restaurant Name → Email → Phone → Subdomain (auto) → Create Restaurant → Hub Page
```

### 2. Local Tenant Metadata Storage ✅

**File**: `src/services/tenantProvisioning.ts`

**Features**:
- Mirrors Cloudflare Tenant KV metadata structure
- Stores in local SQLite database
- Tracks setup progress for all steps:
  - ✅ Provisioned
  - 📋 Menu Uploaded
  - 📸 Photos Uploaded
  - 📍 Details Completed
  - 👥 Staff Added
  - 🛒 Test Order Completed

**API**:
```typescript
// Store tenant data after provisioning
await storeTenantMetadata({
  tenantId, companyName, email, phone, subdomain,
  activationCode, status: 'PROVISIONED',
  setupProgress: { provisioned: true, ... }
});

// Get tenant metadata
const metadata = await getTenantMetadata();

// Update setup progress
await updateSetupProgress({ menuUploaded: true });

// Update restaurant details
await updateRestaurantDetails({
  address, city, state, googleMapsUrl, ...
});

// Get next recommended action
const nextAction = getNextAction(metadata);

// Calculate completion %
const completion = calculateSetupCompletion(metadata);
```

### 3. Contextual Setup Guide (Hub Page) ✅

**File**: `src/components/setup/ContextualSetupGuide.tsx`

**Features**:
- **Dynamic** - Shows next most important action based on progress
- **Prominent** - Large, beautiful card highlighting the next step
- **Contextual tips** - Shows relevant pro tips for each stage
- **Progress tracking** - Visual progress bar showing % complete
- **Minimizable** - Can hide when not needed
- **Sparkle animations** - Magical UI to highlight importance

**Priority Flow**:
1. **🎯 Menu Upload** (Highest Priority)
   - "The most magical experience!"
   - Pro Tip: Upload PDF, Excel, or photos - AI extracts everything

2. **📸 Photo Upload** (High Priority)
   - Pro Tip: Bulk upload all photos - AI matches by name

3. **📍 Restaurant Details** (Medium Priority)
   - Can paste Google Maps URL for auto-fill

4. **👥 Staff Management** (Medium Priority)

5. **🛒 Test Order** (Low Priority)

**UI Highlights**:
- Gradient background with animated sparkles
- Large next action card (orange-pink gradient)
- Compact checklist showing all steps
- Context-aware pro tips
- Completion percentage

### 4. Google Places API Integration ✅

**File**: `src/services/googlePlaces.ts`

**Features**:
- Extract Place ID from Google Maps URL
- Fetch full restaurant details from Google Places API
- Supports multiple URL formats:
  - `https://maps.google.com/?cid=123`
  - `https://www.google.com/maps/place/...`
  - `https://goo.gl/maps/shortcode`
- Extracts:
  - Name, address, phone, website
  - City, state, country, postal code
  - Cuisine types
  - Photos, ratings
- Fallback to basic URL parsing if API not configured

**Setup Google Places API**:
```bash
# 1. Enable Google Places API in Google Cloud Console
# 2. Get API key
# 3. Add to .env
echo "VITE_GOOGLE_PLACES_API_KEY=your_api_key_here" >> .env
```

### 5. Restaurant Details Form ✅

**File**: `src/components/settings/RestaurantDetailsForm.tsx`

**Features**:
- **Google Maps URL input** - Paste URL, click Extract, done!
- **Auto-fill** - Extracts all details from Google Maps
- **Manual entry fallback** - Can fill in manually if needed
- **Beautiful UI** - Gradient header, success animations
- **API key notice** - Shows how to configure API if needed

**Usage**:
```tsx
import { RestaurantDetailsForm } from '../components/settings/RestaurantDetailsForm';

// In your settings page
<RestaurantDetailsForm />
```

### 6. Hub Page Integration ✅

**File**: `src/pages-v2/HubPage.tsx`

**Changes**:
- Replaced `SetupChecklistCard` with `ContextualSetupGuide`
- Guide appears prominently at top of page
- Hides automatically when setup is 100% complete
- Can be minimized by user

## User Flow

### Fresh Installation

1. **User opens app** → Sees onboarding form
2. **Enters details**:
   - Restaurant Name: "The Coorg Food Company"
   - Email: owner@restaurant.com
   - Phone: +91 98765 43210
   - Subdomain: auto-generated `coorg-food-company-1234`
3. **Clicks "Create Restaurant"** → Provision modal shows progress
4. **Provisioning complete** → Tenant metadata stored locally
5. **Auto-redirects to Hub** → Contextual Setup Guide shows

### Hub Page Experience

**First Login** (0% complete):
```
╔════════════════════════════════════════╗
║  🌟 Get Started with HandsFree         ║
║  0% Complete                            ║
║  ────────────────────────────────      ║
║                                         ║
║  📋 Upload Your Menu                    ║
║  The most magical experience!           ║
║  Upload as PDF, Excel, or photos.       ║
║  AI extracts everything automatically.  ║
║  [ Let's do this → ]                    ║
║                                         ║
║  ☐ Menu  ☐ Photos  ☐ Details           ║
║  ☐ Staff  ☐ Test                        ║
║                                         ║
║  💡 Pro Tip: Upload your menu as PDF!   ║
║     AI will extract items, prices, etc. ║
╚════════════════════════════════════════╝
```

**After Menu Upload** (33% complete):
```
╔════════════════════════════════════════╗
║  🌟 Get Started with HandsFree         ║
║  33% Complete                           ║
║  ████████────────────────────────      ║
║                                         ║
║  📸 Add Menu Photos                     ║
║  Bulk upload all your photos!           ║
║  AI will match them to items by name.   ║
║  [ Let's do this → ]                    ║
║                                         ║
║  ✓ Menu  ☐ Photos  ☐ Details           ║
║  ☐ Staff  ☐ Test                        ║
║                                         ║
║  📸 Pro Tip: Upload all photos at once! ║
║     AI matches them automatically.      ║
╚════════════════════════════════════════╝
```

**Setup Complete** (100%):
```
(Guide disappears - user sees normal dashboard)
```

### Restaurant Details Entry

**Option 1: Google Maps URL** (Easiest)
1. Navigate to Settings → Restaurant Details
2. Paste Google Maps URL: `https://maps.google.com/...`
3. Click "Extract"
4. ✨ All fields auto-filled
5. Click "Save Details"

**Option 2: Manual Entry**
1. Navigate to Settings → Restaurant Details
2. Fill in fields manually:
   - Address, City, State, Country
   - Postal Code, Website
   - Description
3. Click "Save Details"

## Integration Points

### Menu Upload Page

When menu is uploaded:
```typescript
import { updateSetupProgress } from '../services/tenantProvisioning';

// After successful menu upload
await updateSetupProgress({ menuUploaded: true });
```

### Image Upload Page

When photos are uploaded:
```typescript
await updateSetupProgress({ photosUploaded: true });
```

### Settings Page

Add the RestaurantDetailsForm component:
```typescript
import { RestaurantDetailsForm } from '../components/settings/RestaurantDetailsForm';

// In your settings page
<RestaurantDetailsForm />
```

### Staff Page

When staff is added:
```typescript
await updateSetupProgress({ staffAdded: true });
```

### POS Page

When first order is completed:
```typescript
await updateSetupProgress({ testOrderCompleted: true });
```

## Technical Details

### Database Schema

Tenant metadata stored in `restaurant_settings` table:
```sql
INSERT INTO restaurant_settings (key, value)
VALUES ('tenant_metadata', '{
  "tenantId": "coorg-food-company-1234",
  "companyName": "The Coorg Food Company",
  "email": "owner@restaurant.com",
  "phone": "+91 98765 43210",
  "subdomain": "coorg-food-company-1234",
  "status": "ACTIVE",
  "setupProgress": {
    "provisioned": true,
    "menuUploaded": true,
    "photosUploaded": false,
    "detailsCompleted": false,
    "staffAdded": false,
    "testOrderCompleted": false
  },
  "address": "123 Main St",
  "city": "Bengaluru",
  ...
}');
```

### Google Places API

**Requirements**:
- Google Cloud Project
- Places API enabled
- API key with Places API access
- Billing account (free tier: 20,000 requests/month)

**Cost**: ~$17/1000 requests (but first 20,000/month free)

**Setup**:
1. Go to https://console.cloud.google.com
2. Create project or select existing
3. Enable "Places API (New)"
4. Create API key
5. Add to `.env`: `VITE_GOOGLE_PLACES_API_KEY=...`

### Priority Logic

The setup guide uses intelligent priority:
1. **Menu upload** is ALWAYS first (most magical)
2. **Photos** come immediately after menu (visual appeal)
3. **Details** are medium priority (operational, not critical)
4. **Staff** is medium priority (can add later)
5. **Test order** is lowest priority (validation step)

## Testing

### Reset and Test Fresh Onboarding

```bash
# 1. Reset all data
./reset-all-data.sh

# 2. Restart app
bun run dev

# 3. Go through onboarding flow
# 4. See contextual guide on Hub
# 5. Upload menu → See guide update
# 6. Upload photos → See guide update
# 7. Add details → See guide disappear
```

### Test Google Places Integration

```bash
# 1. Get API key from Google Cloud Console
# 2. Add to .env
echo "VITE_GOOGLE_PLACES_API_KEY=..." >> .env

# 3. Restart app
# 4. Go to Settings → Restaurant Details
# 5. Paste Google Maps URL
# 6. Click Extract
# 7. See auto-filled form
```

## Benefits

✅ **Simpler onboarding** - Just 4 fields to start
✅ **Contextual guidance** - Shows what's important NOW
✅ **Magical experience** - AI menu extraction highlighted
✅ **Progress tracking** - Visual progress bar
✅ **Flexible details entry** - Google Maps or manual
✅ **Beautiful UI** - Animated, engaging design
✅ **Smart prioritization** - Most impactful features first
✅ **Local-first** - All data stored in SQLite
✅ **No backend dependency** - Works completely offline

## Next Steps

1. ✅ Provisioning form simplified
2. ✅ Contextual setup guide created
3. ✅ Google Places integration added
4. ✅ Hub page updated
5. ⏭️ Connect menu upload to update progress
6. ⏭️ Connect photo upload to update progress
7. ⏭️ Add RestaurantDetailsForm to Settings page
8. ⏭️ Connect staff/order completion to progress
9. ⏭️ Test complete flow end-to-end

## Files Changed

**New Files**:
- `src/services/tenantProvisioning.ts`
- `src/services/googlePlaces.ts`
- `src/components/setup/ContextualSetupGuide.tsx`
- `src/components/settings/RestaurantDetailsForm.tsx`
- `reset-tenant.html`
- `reset-all-data.sh`

**Modified Files**:
- `src/components/SimpleRestaurantOnboarding.tsx`
- `src/pages-v2/HubPage.tsx`

## Questions Answered

**Q: Does Google have an API for Places?**
✅ Yes! Google Places API provides:
- Restaurant name, address, phone
- Website, photos, reviews
- Cuisine types, price level
- Opening hours
- And more!

**Cost**: Free for first 20,000 requests/month
**Pricing**: ~$17/1000 requests after free tier

**Alternative**: We also provide fallback URL parsing if API is not configured.

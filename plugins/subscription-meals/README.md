# Subscription Meals Plugin - Implementation Complete ✅

Weekly subscription meal service for gated communities with rotating menus, delivery scheduling, and tower-based routing.

## Overview

This plugin enables restaurants to offer weekly meal subscriptions with rotating menus, allowing customers to subscribe, select meals from weekly menus, and receive regular deliveries.

**Theme**: `coorg-subscription` (voice features disabled)
**Status**: Ready for deployment
**Components**: 10 React components + 1 KDS interface

## Features

### For Administrators

- **Subscription Plans Management**: Create and manage multiple subscription plans (5-day, 10-day, 20-day)
- **Weekly Menu Management**: Upload menus via Excel, assign items to specific weeks
- **Cuisine Types**: Support for multiple cuisine categories (North Indian, South Indian, Chinese, etc.)
- **Subscription KDS**: Consolidated kitchen display showing aggregated order counts
- **Parcel Dispatch**: Assign delivery personnel and track delivery status
- **Tower-Based Routing**: Optimize delivery routes by distance from kitchen

### For Customers

- **Browse Plans**: View available subscription plans with pricing
- **Select Meals**: Choose meals from rotating weekly menus
- **Advance Ordering**: Order up to 4 weeks in advance
- **Delivery Scheduling**: Select preferred delivery days and time slots
- **Order Cutoff**: Sunday 12:00 PM deadline for next week's orders

## Database Schema

Creates 8 tables automatically on installation:

1. **subscription_plans** - Subscription plan configurations
2. **subscription_cuisine_types** - Available cuisine categories
3. **subscription_customers** - Customer subscriptions with gated community address
4. **subscription_menu_weeks** - Weekly rotating menus by cuisine
5. **subscription_menu_items** - Menu items assigned to weekly menus
6. **subscription_preferences** - Customer meal selections per week
7. **subscription_deliveries** - Individual delivery schedule
8. **subscription_orders** - Links deliveries to actual orders

## Theme Integration

### Coorg Subscription Theme
The plugin uses a custom theme with voice features disabled:

**Location**: `/handsfree-restaurant-new/platform/workers/theme-edge-worker/src/multimodal-restaurant/presets/coorg-subscription.ts`

**Features**:
- Glassmorphism panels with blur effects
- Purple accent color for subscription branding
- Warm white text on dark backgrounds
- Framer Motion animations
- Voice features completely disabled

## Installation

### Step 1: Install Plugin
1. Open POS system
2. Navigate to **Plugins**
3. Search for "Subscription Meals"
4. Click **Install**
5. Database tables will be created automatically
6. Plugin routes will be available at `/subscriptions/*`

### Step 2: Import Menu Items (One-Time Setup)
After installation, import the 150+ menu items:

1. Navigate to `/subscriptions/import` or click "Import Menu" from the dashboard
2. Review what will be imported:
   - 3 subscription plans (5-day, 10-day, 20-day weekday plans)
   - 5 cuisine types (North Indian, South Indian, Chinese, Continental, Children's)
   - 150+ menu items across all categories
3. Click **Import Complete Menu**
4. Wait for the import to complete (should take 10-15 seconds)

**Import Source**: The menu data is embedded in `/src/scripts/importSubscriptionMenuFromMd.ts` based on the structure defined in `/subscription_menu_structure.md`

### Step 3: Configure Plans (Optional)
1. Navigate to `/subscriptions/plans`
2. Review imported plans or create custom plans
3. Activate the plans you want to offer

### Step 4: Create Weekly Menus
1. Navigate to `/subscriptions/menu`
2. Select a week (current week or up to 4 weeks ahead)
3. Add menu items from the available catalog (shared with a la carte menu)
4. Click **Publish Week** to make it visible to customers

## Core Menu Management

### Important: Menu Conflict Resolution
When the subscription plugin is activated, it **takes over menu management** to prevent conflicts with the core menu system.

**How it works**:
- Plugin emits `subscription:activated` event
- Core app receives `core:disable-menu-management` event
- Standard menu management UI is hidden
- Users are redirected to `/subscriptions/menu` instead

**To disable subscription menu and restore core menu**:
1. Uninstall or deactivate the subscription plugin
2. Plugin emits `subscription:deactivated` event
3. Core menu management is automatically restored

**Check activation status**:
```typescript
import { isSubscriptionPluginActive } from '@/components/subscriptions';

if (isSubscriptionPluginActive()) {
  // Subscription plugin is managing menus
} else {
  // Core menu management is active
}
```

## Usage Guide

### For Restaurant Owners/Managers

#### Daily Operations
1. **Check Dashboard** (`/subscriptions`):
   - View active subscriber count
   - See today's deliveries grouped by time slot
   - Track weekly revenue and churn rate
   - Access quick actions

2. **Manage Weekly Menus** (`/subscriptions/menu`):
   - Create menus for upcoming weeks
   - Add/remove items from the menu catalog
   - Publish menus to make them visible to customers
   - Items are shared with the main POS menu

3. **Monitor Kitchen** (`/subscriptions/kds`):
   - View consolidated orders by category
   - Track preparation progress
   - Mark items as ready
   - See priority and delivery dates

4. **Manage Dispatch** (`/subscriptions/dispatch`):
   - View deliveries grouped by time slot and tower
   - Assign drivers based on capacity and distance
   - Track delivery status
   - Optimize routes

### For Customers

#### Subscribe (Public - No Login Required)
1. Navigate to `/subscriptions/browse`
2. Choose a subscription plan
3. Enter:
   - Phone number
   - Name
   - Tower number (A, B, C, etc.)
   - Apartment number
4. Select delivery time slot
5. Complete subscription

#### Select Meals Each Week
1. Navigate to `/subscriptions/portal` (or receive link via SMS)
2. View next 4 weeks of published menus
3. Select meals (up to plan limit)
4. Must complete selection by **Sunday 12:00 PM** for next week
5. Receive confirmation

## Scheduled Tasks

The plugin runs 6 automated tasks:

1. **rotate_weekly_menu** (Every Monday at 00:00)
   - Activates current week's menu
   - Archives previous week's menu
   - Sends notifications to customers

2. **check_order_cutoffs** (Every Sunday at 12:00)
   - Locks ordering for next week
   - Marks cutoff as passed in database
   - Sends reminder notifications to customers who haven't ordered

3. **create_subscription_orders** (Daily at 02:00)
   - Creates POS orders 24 hours before delivery
   - Links subscription deliveries to POS orders
   - Sends orders to KDS automatically

4. **send_order_reminders** (Every Thursday at 18:00)
   - Reminds customers to order for next week
   - Sends SMS/email notifications
   - Lists available menu items

5. **process_renewals** (Daily at 01:00)
   - Checks for subscription renewals
   - Processes payments
   - Updates subscription status

6. **cleanup_old_data** (Every Sunday at 03:00)
   - Archives deliveries older than 90 days
   - Cleans up expired preferences
   - Maintains database performance

## Troubleshooting

### Import Fails
**Problem**: Menu import throws an error or completes with errors

**Solutions**:
- Check that tenant ID is correctly configured in settings
- Verify database migrations have run successfully
- Ensure `menu_items` table exists and is accessible
- Check console logs for specific error messages

### Orders Not Created
**Problem**: Orders don't appear in KDS 24 hours before delivery

**Solutions**:
- Verify the scheduled task `create_subscription_orders` is running (check logs at 02:00)
- Check that customers have selected meals before Sunday 12:00 PM cutoff
- Ensure weekly menu is published (`published = 1` in database)
- Verify delivery schedule exists in `subscription_deliveries` table

### Menu Items Not Showing
**Problem**: Customers can't see menu items when ordering

**Solutions**:
- Check that weekly menu is published for the target week
- Verify items are marked as `available = 1` in `subscription_menu_items`
- Ensure current week's menu is active (`active = 1`)
- Confirm cuisine type matches customer's subscription plan

### Core Menu Still Visible
**Problem**: Core menu management UI is still showing after plugin installation

**Solutions**:
- Verify plugin is properly installed and activated
- Check browser localStorage: `subscription-plugin-active` should be `'true'`
- Reload the page to trigger event listeners
- Check browser console for event emission errors

### Deliveries Not Grouping by Tower
**Problem**: Deliveries aren't being grouped efficiently

**Solutions**:
- Ensure tower numbers are entered consistently (uppercase)
- Verify `distance_from_kitchen` is populated in `subscription_customers`
- Check that tower mapping is configured in admin settings
- Re-calculate distances if tower layout changes

## File Structure

```
plugins/subscription-meals/
├── manifest.json                           # Plugin configuration
├── README.md                               # This file
├── migrations/
│   └── 001_initial_schema.sql             # Database schema
├── worker/                                 # Backend WASM
│   └── src/
│       └── index.ts                       # API endpoints + scheduled tasks
└── dist/                                   # Built WASM files

src/components/subscriptions/
├── index.tsx                               # Plugin entry point
├── SubscriptionDashboard.tsx              # Main dashboard
├── SubscriptionPlans.tsx                  # Plans management
├── SubscriptionMenuManager.tsx            # Menu CRUD
├── SubscriptionMenuImporter.tsx           # Import UI
└── SubscriptionKDS.tsx                    # Kitchen display

src/stores/
└── subscriptionStore.ts                   # State management

src/scripts/
└── importSubscriptionMenuFromMd.ts        # Import logic
```

## API Endpoints

The plugin backend (worker) provides these REST endpoints:

- `GET /api/subscriptions/stats` - Dashboard statistics
- `GET /api/subscriptions/plans/:tenant_id` - List subscription plans
- `POST /api/subscriptions/plans` - Create new plan
- `PUT /api/subscriptions/plans/:plan_id` - Update plan
- `DELETE /api/subscriptions/plans/:plan_id` - Delete plan
- `POST /api/subscriptions/subscribe` - Create customer subscription
- `GET /api/subscriptions/customer/:phone` - Get customer subscription
- `GET /api/subscriptions/menu/week/:week_id` - Get weekly menu
- `POST /api/subscriptions/menu/week` - Create weekly menu
- `POST /api/subscriptions/:id/select-meals` - Customer meal selection
- `GET /api/subscriptions/deliveries/:tenant_id` - List deliveries
- `PUT /api/subscriptions/delivery/:id/status` - Update delivery status

## Version History

### 1.0.0 (2026-02-09) - Current
- ✅ Complete implementation with all components
- ✅ Theme integration (coorg-subscription with voice disabled)
- ✅ Menu import functionality (150+ items)
- ✅ Core menu conflict resolution
- ✅ 8-table database schema
- ✅ Admin dashboard and management UI
- ✅ Subscription KDS with consolidated orders
- ✅ Parcel dispatch with tower-based routing
- ✅ Menu import via embedded data
- ✅ Order cutoff automation
- ✅ Advance ordering (4 weeks)
- ✅ Scheduled tasks for automation

## License

Proprietary - Handsfree Restaurant POS

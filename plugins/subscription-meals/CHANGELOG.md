# Subscription Meals Plugin - Changelog

All notable changes to the Subscription Meals plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-02-09

### 🎉 Major Update: Theme Integration & Import System

This release brings significant improvements to the subscription plugin with complete theme integration, one-click menu import, and automatic core menu conflict resolution.

### ✨ Added

#### Theme Integration
- **Coorg Subscription Theme Integration** - Complete integration with custom theme
  - Voice features completely disabled for streamlined experience
  - Glassmorphism design with purple accent color
  - Optimized for subscription management workflows
  - Dark theme with warm color palette
  - Theme location: `/handsfree-restaurant-new/platform/workers/theme-edge-worker/src/multimodal-restaurant/presets/coorg-subscription.ts`

#### Menu Import System
- **One-Click Menu Import** - Import 150+ menu items instantly
  - 3 subscription plans (5-day, 10-day, 20-day weekday plans)
  - 5 cuisine types (North Indian, South Indian, Chinese, Continental, Children's)
  - 150+ menu items across all categories:
    - Breakfast (Daily, South Indian, Weekend Special)
    - Chinese (Starters, Main Course, Soups)
    - Indian (Biryani, Rice, Breads, Gravys, Seafood)
    - Continental (Starters, Steaks, Pasta, Sizzlers)
    - Evening Snacks (Pizza, Burgers, Desserts)
    - Daily Lunch Combos
  - Import UI at `/subscriptions/import`
  - Import script: `/src/scripts/importSubscriptionMenuFromMd.ts`

#### Core Menu Conflict Resolution
- **Automatic Menu Management Conflict Detection**
  - Plugin emits `subscription:activated` event on activation
  - Core app receives `core:disable-menu-management` event
  - Standard menu management UI automatically hidden
  - Users redirected to `/subscriptions/menu` instead
  - Automatic restoration when plugin deactivated
  - Check activation status via `isSubscriptionPluginActive()`

#### Hub Card Integration
- **Enhanced Hub Card** with quick actions
  - Direct access to Weekly Menus
  - Quick link to Import Menu
  - Access to Subscription Plans
  - Jump to Kitchen Display
  - Rich description: "Manage weekly meal subscriptions, rotating menus, plans, deliveries & KDS"

#### What's New Display
- **Version Changelog Component** (`/subscriptions/changelog`)
  - Displays version history
  - Shows update information to users
  - Collapsible version entries
  - Change type indicators (feature, improvement, bugfix, documentation)
  - Update banner with dismissible notification

### 🔧 Improved

#### Plugin Architecture
- **Self-Contained WASM Plugin**
  - No core app modifications required for installation
  - Routes loaded dynamically from manifest
  - Components registered via plugin system
  - Event-based integration with core app

#### Event System
- **Plugin Lifecycle Events**
  - `subscription:activated` - Emitted when plugin activated
  - `subscription:deactivated` - Emitted when plugin deactivated
  - `core:disable-menu-management` - Core app event to hide menu management
  - `core:enable-menu-management` - Core app event to restore menu management
  - Implemented in `/src/components/subscriptions/index.tsx`

### 📚 Documentation

#### Comprehensive Documentation Added
- **Updated README.md** - Complete installation and usage guide
  - Step-by-step installation instructions
  - Menu import guide
  - Usage examples for owners, managers, kitchen staff, and customers
  - Scheduled tasks documentation
  - Troubleshooting section
  - API endpoints reference
  - File structure overview

- **Created SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md**
  - Complete implementation overview
  - Technical architecture documentation
  - Data flow diagrams
  - Plugin system flow explanation
  - Core menu conflict resolution details

- **Created CHANGELOG.md** (this file)
  - Version history tracking
  - Detailed change documentation

### 🗂️ Files Added/Modified

#### New Files
- `/src/components/subscriptions/index.tsx` - Plugin entry point
- `/src/components/subscriptions/SubscriptionChangelog.tsx` - Changelog viewer
- `/plugins/subscription-meals/CHANGELOG.md` - This file
- `/SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md` - Implementation docs

#### Modified Files
- `/plugins/subscription-meals/manifest.json`
  - Version bumped to 1.1.0
  - Added changelog section
  - Added update_banner configuration
  - Updated description with new features
  - Added quick_actions to hub_card
  - Added `/subscriptions/changelog` route
  - Added `/subscriptions/import` route
  - Updated checksum and timestamps
- `/plugins/subscription-meals/README.md`
  - Complete rewrite with comprehensive documentation

### 🔄 Migration Notes

This is a **feature update** with **no breaking changes**.

- Existing installations will automatically benefit from new features
- No database migrations required
- No configuration changes needed
- Plugin can be updated without downtime

### 📦 Installation

For new installations:
```bash
1. Install plugin via Plugin Manager
2. Navigate to /subscriptions/import
3. Click "Import Complete Menu"
4. Start creating weekly menus at /subscriptions/menu
```

For existing installations:
```bash
# Plugin will auto-update
# New features available immediately
# Check /subscriptions/changelog for details
```

### 🐛 Known Issues

None reported for this version.

### 🔮 Coming in Future Versions

- Customer portal implementation (`/subscriptions/portal`)
- Public subscription browser (`/subscriptions/browse`)
- Parcel dispatch screen (`/subscriptions/dispatch`)
- Customer management UI (`/subscriptions/customers`)
- Delivery schedule calendar (`/subscriptions/deliveries`)
- Payment gateway integration
- SMS/Email notification system
- Mobile app for drivers

---

## [1.0.0] - 2026-02-06

### 🎉 Initial Release

Complete subscription meal service for gated communities with rotating menus and delivery scheduling.

### ✨ Added

#### Database Schema
- 8-table database schema
  - `subscription_plans` - Plan configurations
  - `subscription_cuisine_types` - Cuisine categories
  - `subscription_customers` - Customer subscriptions with tower/apartment
  - `subscription_menu_weeks` - Weekly rotating menus
  - `subscription_menu_items` - Menu items linked to weeks
  - `subscription_preferences` - Customer meal selections
  - `subscription_deliveries` - Scheduled deliveries with routing
  - `subscription_orders` - Links to POS orders

#### Admin Features
- **Subscription Dashboard** (`/subscriptions`)
  - Real-time statistics
  - Today's deliveries grouped by time slot
  - Revenue metrics and churn rate
  - Quick actions for common tasks

- **Subscription Plans** (`/subscriptions/plans`)
  - Create and manage subscription plans
  - Configure meals per week, pricing, delivery days
  - Toggle active/inactive status
  - Multi-cuisine support

- **Subscription Menu Manager** (`/subscriptions/menu`)
  - Create weekly rotating menus
  - Add items from main menu catalog
  - Publish menus for customer visibility
  - Up to 4 weeks advance planning

- **Subscription KDS** (`/subscriptions/kds`)
  - Consolidated kitchen display
  - Category-wise order grouping
  - Preparation progress tracking
  - Real-time status updates

#### Customer Features
- Weekly meal subscription service
- Rotating menu selection
- Advance ordering (up to 4 weeks)
- Tower/apartment-specific delivery routing
- Order cutoff automation (Sunday 12:00 PM)

#### Backend
- Cloudflare Worker backend
- REST API endpoints for all operations
- 6 scheduled tasks for automation:
  - `rotate_weekly_menu` (Mon 00:00)
  - `check_order_cutoffs` (Sun 12:00)
  - `create_subscription_orders` (Daily 02:00)
  - `send_order_reminders` (Thu 18:00)
  - `process_renewals` (Daily 01:00)
  - `cleanup_old_data` (Sun 03:00)

#### Integration
- POS system integration
- Dual menu system (shared `menu_items` table)
- Order orchestration with KDS
- Customer data synchronization

### 📚 Documentation
- Initial README.md
- Database schema documentation
- API endpoint reference

---

## Version Legend

- **Major (x.0.0)**: Breaking changes, major new features
- **Minor (0.x.0)**: New features, improvements (backward compatible)
- **Patch (0.0.x)**: Bug fixes, small improvements

## Change Types

- ✨ **Added**: New features
- 🔧 **Improved**: Enhancements to existing features
- 🐛 **Fixed**: Bug fixes
- 📚 **Documentation**: Documentation changes
- ⚠️ **Breaking**: Breaking changes
- 🔒 **Security**: Security improvements

---

**Plugin Homepage**: https://plugins.handsfree.com/subscription-meals
**Support**: https://github.com/anthropics/handsfree-pos/issues
**Documentation**: [README.md](README.md)

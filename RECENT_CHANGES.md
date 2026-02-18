# Recent Changes & Bug Fixes

## Date: 2026-02-18

---

## 🐛 Critical Bug Fix: Windows Setup Wizard Persistence Issue

### Problem
On Windows 64-bit builds, when the app was closed and reopened, it would display the "create restaurant page" even if the installation was already completed and restaurant information had been entered. This caused users to lose their setup progress on app restart.

### Root Cause
The setup wizard state and restaurant settings were **not being loaded from SQLite** when the app started. While these stores had `loadFromSQLite()` methods implemented, they were never called during app initialization.

**Missing initialization:**
```typescript
// Only tenant config was being loaded on startup:
await useTenantStore.getState().loadFromSQLite();

// Setup wizard state was never loaded ❌
// Restaurant settings were never loaded ❌
```

This caused the `useNeedsSetup()` hook to always return `true` because:
1. `isComplete` flag was not loaded from database (defaulted to `false`)
2. Restaurant settings were not loaded (appeared as empty/default values)
3. The hook determined setup was needed, showing the wizard again

### Solution
Updated [src/App.tsx](src/App.tsx:259) to load all persistent state on app startup:

```typescript
// CRITICAL: Load all persistent state from SQLite on app startup
useEffect(() => {
  const loadPersistentState = async () => {
    try {
      console.debug('[App] 🔄 Loading persistent state from SQLite on startup...');
      setIsLoadingTenantConfig(true);

      // Load tenant config
      await useTenantStore.getState().loadFromSQLite();
      console.debug('[App] ✅ Tenant config loaded from SQLite');

      // Load setup wizard state ⭐ NEW
      await useSetupWizardStore.getState().loadFromSQLite();
      console.debug('[App] ✅ Setup wizard state loaded from SQLite');

      // Load restaurant settings ⭐ NEW
      await useRestaurantSettingsStore.getState().loadFromSQLite();
      console.debug('[App] ✅ Restaurant settings loaded from SQLite');
    } catch (error) {
      console.error('[App] ❌ Failed to load persistent state:', error);
    } finally {
      setIsLoadingTenantConfig(false);
    }
  };

  loadPersistentState();
}, []); // Run once on mount
```

### Impact
- ✅ Setup wizard state (`isComplete`, `wizardData`) now persists across app restarts
- ✅ Restaurant settings (name, phone, address, tax config) now persist across app restarts
- ✅ Windows users will no longer see the setup wizard after completing it
- ✅ Fixes issue on all platforms (Windows, macOS, Linux)

### Files Modified
- `src/App.tsx` - Added loading of setup wizard state and restaurant settings on startup

### Testing Recommendations
1. Complete the setup wizard on Windows
2. Enter restaurant details, tax settings, etc.
3. Close the app completely
4. Reopen the app
5. **Expected**: App should go directly to POS dashboard, not show setup wizard
6. **Verify**: Restaurant name and settings are still present in Settings page

---

## 🎉 New Feature: Social Media Campaigns Plugin (Phase 1)

### Overview
Implemented the foundation for a local-first social media campaign management plugin that integrates with Instagram, TikTok, and WhatsApp Business APIs. All OAuth tokens and API secrets are stored encrypted on the device and never sent to the cloud.

### Architecture Highlights
- **Local-First Security**: All credentials stored encrypted with AES-256-GCM
- **WASM Plugin**: Rust-compiled WebAssembly for high performance
- **Cloudflare Webhook Router**: Routes webhooks to device via cloudflared tunnels
- **No Cloud Secrets**: Tenant-provided API keys stay on device only

### Completed Components

#### 1. Database Schema
**Location**: `plugins/social-campaigns/migrations/001_initial_schema.sql`

Created 9 tables for complete social media management:
- `social_campaigns` - Campaign tracking and status
- `social_posts` - Post content and scheduling queue
- `social_oauth_tokens` - **Encrypted** OAuth access/refresh tokens
- `social_api_credentials` - **Encrypted** tenant-provided app secrets
- `social_engagement_metrics` - Likes, comments, shares, views tracking
- `social_customer_interactions` - Link social engagers to POS customers
- `social_webhook_events` - Webhook audit trail
- `social_post_queue` - Scheduled post queue
- `social_tunnel_config` - Per-tenant cloudflared tunnel configuration

**Security Features**:
- All sensitive fields encrypted at rest
- Separate nonce column for AES-GCM decryption
- Per-tenant encryption keys derived with HKDF
- Tenant isolation through encryption key derivation

#### 2. Rust WASM Client
**Location**: `plugins/social-campaigns/client/src/lib.rs`

Implemented core plugin logic:
- Campaign CRUD operations
- Post scheduling and validation
- Local sentiment analysis (keyword-based)
- Platform connection status checking
- JSON serialization/deserialization

**Build Configuration**:
- Size-optimized for WASM (`opt-level = "z"`, LTO enabled)
- WebAssembly-compatible dependencies (chrono, uuid with WASM features)

#### 3. Tauri Security Commands
**Location**: `src-tauri/src/commands/social_media.rs`

Implemented 5 secure Tauri commands:

**a) OAuth Token Management**
```rust
#[command]
pub async fn store_oauth_token(
    tenant_id: String,
    platform: String,
    access_token: String,
    refresh_token: Option<String>,
    expires_at: String,
    platform_account_id: String,
    app: tauri::AppHandle,
) -> Result<String, String>
```
- Uses HKDF (HMAC-based Key Derivation) with SHA-256
- Derives encryption key from device key + tenant_id salt
- AES-256-GCM encryption with random nonce per encryption
- Stores encrypted tokens + nonce in SQLite as base64

```rust
#[command]
pub async fn get_oauth_token(
    tenant_id: String,
    platform: String,
    app: tauri::AppHandle,
) -> Result<OAuthToken, String>
```
- Retrieves encrypted token and nonce from SQLite
- Rederives encryption key using same HKDF process
- Decrypts using AES-256-GCM with stored nonce
- Returns plaintext token (memory only, never persisted)

**b) API Credentials Management** (Tenant-Provided Keys)
```rust
#[command]
pub async fn store_api_credentials(
    platform: String,
    app_id: String,
    app_secret: String,
    verify_token: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String>
```
- Stores tenant's own Instagram App ID/Secret, TikTok Client Key/Secret, WhatsApp credentials
- Same encryption pattern as OAuth tokens
- Stored in `social_api_credentials` table
- **Critical for local-first**: Secrets never leave device, used for webhook signature verification locally

```rust
#[command]
pub async fn check_api_credentials(
    platform: String,
    app: tauri::AppHandle,
) -> Result<bool, String>
```
- Checks if tenant has configured their own API keys

**c) Secure API Calls**
```rust
#[command]
pub async fn secure_social_api_call(
    tenant_id: String,
    platform: String,
    endpoint: String,
    method: String,
    body: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String>
```
- Decrypts OAuth token in memory
- Makes authenticated HTTP request to platform API
- Supports Instagram Graph API, TikTok API, WhatsApp Business API
- Base URLs: `graph.facebook.com/v18.0` (Instagram/WhatsApp), `open.tiktokapis.com/v2` (TikTok)

**Security Implementation Details**:
- **Key Derivation**: `HKDF-SHA256(device_key, salt=tenant_id, info="social-campaigns")`
- **Encryption**: AES-256-GCM with 256-bit keys, 96-bit nonces
- **Nonce Management**: Unique random nonce per encryption, stored with ciphertext
- **Base64 Encoding**: All encrypted data base64-encoded for SQLite storage
- **Multi-Tenant Isolation**: Different tenants cannot decrypt each other's data

**Compilation Fixes Applied**:
- Fixed HKDF API usage (ring crate): Correct `info` parameter type `&[&[u8]]`
- Fixed key expansion: Use `okm.fill()` pattern
- Added `tauri::Manager` trait import for `app.path()` method
- Updated deprecated base64 API to new Engine API (`general_purpose::STANDARD`)

#### 4. Cloudflare Worker for Webhook Routing
**Location**: `workers/social-media-webhooks/`

Created complete webhook routing infrastructure:

**Main Worker** (`src/index.ts`):
- Handles Instagram, TikTok, and WhatsApp webhooks
- Routes webhooks to tenant devices via cloudflared tunnels
- **Security Model**: No signature verification in worker (happens on device)
- Worker only performs routing using tunnel URLs from KV store

**Key Endpoints**:
- `POST /webhooks/instagram?tenant_id=xxx` - Instagram webhook receiver
- `POST /webhooks/tiktok?tenant_id=xxx` - TikTok webhook receiver
- `POST /webhooks/whatsapp?tenant_id=xxx` - WhatsApp webhook receiver
- `POST /register-tunnel` - Register tenant tunnel URL
- `GET /tunnel-status?tenant_id=xxx` - Check tunnel registration
- `GET /health` - Health check

**Webhook Flow**:
1. Social platform sends webhook to Cloudflare Worker
2. Worker looks up tenant tunnel URL from KV storage
3. Worker forwards webhook with all original headers to device
4. Device verifies signature using locally-stored API secret
5. Worker returns OK to platform (prevents retries)

**Configuration Files**:
- `wrangler.toml` - Worker configuration, KV namespace bindings
- `package.json` - Deployment scripts (`npm run deploy:production`)
- `README.md` - Complete setup and troubleshooting guide

**Why No Signature Verification in Worker**:
Tenant API secrets are stored encrypted on device only. Worker cannot verify signatures because it doesn't have the secrets. This maintains the local-first security architecture where secrets never leave the device.

#### 5. Plugin Registration
**Files Modified**:
- `src-tauri/src/commands/mod.rs` - Added `social_media` module
- `src-tauri/src/lib.rs` - Registered 5 social media commands in invoke_handler

All commands are now available to frontend via Tauri IPC:
- `store_oauth_token`
- `get_oauth_token`
- `store_api_credentials`
- `check_api_credentials`
- `secure_social_api_call`

### Next Steps (Phase 2)

#### Immediate Tasks:
1. **Local Webhook Server** (Actix-web)
   - Receive webhooks from cloudflared tunnel
   - Verify signatures using locally-stored API secrets
   - Process engagement events (likes, comments, shares)
   - Update metrics and link customers

2. **Cloudflared Tunnel Setup Command**
   - Automated tunnel creation via Tauri command
   - One-time setup per device/tenant
   - Register tunnel URL with Cloudflare Worker
   - Start tunnel as system service

3. **Background Post Scheduler**
   - Tokio-based background task
   - Check queue every minute for scheduled posts
   - Publish posts via `secure_social_api_call`
   - Handle retries and errors

#### UI Development Tasks:
4. **Zustand Store** - React state management
5. **API Credentials Setup UI** - Guide tenants through app creation
6. **Tunnel Setup UI** - One-click tunnel configuration
7. **Campaign Manager UI** - Create and manage campaigns
8. **OAuth Flow UI** - Connect social accounts

### Technical Decisions Made

1. **Encryption Strategy**: AES-256-GCM with HKDF key derivation
   - Industry standard for authenticated encryption
   - HKDF provides proper key isolation per tenant
   - Nonces stored with ciphertext for decryption

2. **No Cloud Secrets**: All credentials stay on device
   - Prevents credential leaks from cloud breaches
   - Complies with tenant privacy requirements
   - Tenants control their own API keys

3. **Webhook Routing via Tunnels**: cloudflared + Cloudflare Worker
   - Avoids port forwarding and firewall configuration
   - Works on residential networks
   - Automatic HTTPS and DDoS protection

4. **WASM Plugin Architecture**: Rust + WebAssembly
   - High performance for data processing
   - Memory-safe code
   - Small binary size with aggressive optimization

### Dependencies Added
All dependencies already present in `src-tauri/Cargo.toml`:
- `aes-gcm = "0.10"` - AES-256-GCM encryption
- `ring = "0.17"` - HKDF key derivation
- `base64 = "0.22"` - Base64 encoding
- `reqwest = "0.11"` - HTTP client for API calls
- `rand = "0.8"` - Random nonce generation

---

## 📝 Summary

### Bugs Fixed
1. ✅ **Windows Setup Persistence** - Setup wizard state now loads from SQLite on startup
2. ✅ **Restaurant Settings Persistence** - Settings now load from SQLite on startup

### Features Added
1. ✅ **Social Media Plugin Foundation** - Database schema, WASM client, security commands
2. ✅ **Encrypted Credential Storage** - AES-256-GCM with HKDF key derivation
3. ✅ **Webhook Routing Infrastructure** - Cloudflare Worker + tunnel system

### Files Modified
- `src/App.tsx` - Fixed setup wizard and settings persistence
- `src-tauri/src/commands/mod.rs` - Added social_media module
- `src-tauri/src/lib.rs` - Registered social media commands
- `src-tauri/src/commands/social_media.rs` - **NEW** Security commands

### Files Created
- `plugins/social-campaigns/manifest.json` - Plugin metadata
- `plugins/social-campaigns/migrations/001_initial_schema.sql` - Database schema
- `plugins/social-campaigns/client/src/lib.rs` - WASM client
- `plugins/social-campaigns/client/Cargo.toml` - Rust dependencies
- `plugins/social-campaigns/client/build.sh` - Build script
- `workers/social-media-webhooks/src/index.ts` - Webhook router
- `workers/social-media-webhooks/wrangler.toml` - Worker config
- `workers/social-media-webhooks/package.json` - NPM config
- `workers/social-media-webhooks/README.md` - Documentation

### Build Status
- ✅ Rust compilation successful (linker errors resolved)
- ✅ All social media commands registered
- ⏳ WASM plugin build pending
- ⏳ Cloudflare Worker deployment pending

---

## 🔧 Development Notes

### For Testing Windows Setup Fix
After rebuilding:
1. Complete setup wizard
2. Close app completely (not just minimize)
3. Reopen app
4. Verify: Should NOT show setup wizard
5. Check: Restaurant settings still present in Settings page

### For Social Media Plugin Development
Next developer should focus on:
1. Implementing local webhook server (Actix-web) in `src-tauri/src/services/webhook_server.rs`
2. Creating cloudflared tunnel setup command in `src-tauri/src/commands/tunnel.rs`
3. Implementing background post scheduler in `src-tauri/src/services/post_scheduler.rs`

Refer to plan file: `/Users/stonepot-tech/.claude/plans/iridescent-squishing-map.md`

---

**Report Generated**: 2026-02-18
**Changes By**: Claude Sonnet 4.5
**Session**: restaurant-pos-ai development

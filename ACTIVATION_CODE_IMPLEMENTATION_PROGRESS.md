# Activation Code Implementation Progress

## ✅ Completed Components

### 1. Database Migration ✅
**File:** [migrations/053_location_activation_codes.sql](migrations/053_location_activation_codes.sql)

**Added Columns:**
- `activation_code` TEXT UNIQUE - The activation code
- `activation_code_generated_at` TEXT - When code was generated
- `activation_code_used_at` TEXT - When code was used (NULL if unused)
- `activated_by_device_id` TEXT - Which device used the code

**Indexes:**
- Fast lookup by activation_code
- Find unused codes efficiently

**Status:** ✅ Migration created and added to manifest (v53)

---

### 2. Code Generation Utility ✅
**File:** [src/lib/activationCode.ts](src/lib/activationCode.ts)

**Functions:**
- `generateActivationCode(chainName, locationName)` - Creates format: CAFE-INDR-8472
- `isValidActivationCodeFormat(code)` - Validates format
- `formatActivationCode(input)` - Auto-formats user input
- `parseActivationCode(code)` - Extracts components

**Example:**
```typescript
generateActivationCode("Kalyani", "Indiranagar")
// Returns: "KALY-INDR-8472"
```

**Status:** ✅ Complete with validation and formatting

---

### 3. Activation Code Modal (Master Side) ✅
**File:** [src/components/locations/ActivationCodeModal.tsx](src/components/locations/ActivationCodeModal.tsx)

**Features:**
- Displays activation code in large format
- Copy to clipboard button
- Print button with full instructions page
- Professional printable format with setup steps
- One-time use warning

**Usage:**
```typescript
<ActivationCodeModal
  code="CAFE-INDR-8472"
  locationName="Indiranagar Branch"
  onClose={() => handleClose()}
/>
```

**Status:** ✅ Complete with print & copy functionality

---

### 4. Activation Code Input (Location Side) ✅
**File:** [src/components/locations/ActivationCodeInput.tsx](src/components/locations/ActivationCodeInput.tsx)

**Features:**
- Large input field with auto-formatting
- Real-time format validation
- Error handling with user-friendly messages
- Progress steps during activation
- Keyboard shortcut (Enter to submit)
- Auto-focus on mount

**Usage:**
```typescript
<ActivationCodeInput
  onActivate={async (code) => {
    // Handle activation
  }}
  onBack={() => navigate(-1)}
/>
```

**Status:** ✅ Complete with validation and progress UI

---

## ⏳ Remaining Components

### 5. Backend API Endpoint (Worker)
**File:** `workers/tenant-router/src/index.ts`
**Endpoint:** `POST /api/locations/activate`

**Needs to:**
1. Validate activation code format
2. Query location_tenants by activation_code
3. Check if code already used
4. Return location metadata (tenant_id, chain_id, master_tenant_id, etc.)
5. Mark code as used

**Response Format:**
```json
{
  "success": true,
  "location": {
    "location_id": "loc_123",
    "location_tenant_id": "kalyani-indiranagar-4521",
    "location_name": "Indiranagar Branch",
    "chain_id": "chain_001",
    "master_tenant_id": "kalyani-6207",
    "subdomain": "kalyani-indiranagar",
    "address": {
      "line1": "123 Main St",
      "city": "Bangalore",
      "state": "Karnataka"
    },
    "phone": "+91 98765 43210"
  }
}
```

**Status:** ⏳ To be implemented

---

### 6. Rust Commands for Activation
**File:** `src-tauri/src/commands/location_activation.rs` (new file)

**Commands Needed:**

#### `validate_activation_code(code: String)`
- Calls backend API `/api/locations/activate`
- Returns LocationMetadata struct
- Handles network errors

#### `configure_as_location(location: LocationMetadata)`
- Updates tenant_context table
- Configures restaurant_settings:
  - is_location = 1
  - location_group_id = chain_id
  - master_tenant_id = master_tenant_id
  - current_location_name = location_name
  - address, phone from metadata
- Saves tenant_config
- Returns success/error

**Status:** ⏳ To be implemented

---

### 7. Update LocationProvisioningForm
**File:** `src/components/locations/LocationProvisioningForm.tsx`

**Changes Needed:**
1. Import activation code utilities
2. Generate code after successful provisioning:
   ```typescript
   const activationCode = generateActivationCode(chainName, locationName);
   ```
3. Send activation_code to backend during location creation
4. Show ActivationCodeModal on success:
   ```typescript
   <ActivationCodeModal
     code={response.activation_code}
     locationName={locationName}
     onClose={handleSuccess}
   />
   ```

**Status:** ⏳ To be implemented

---

### 8. Update Setup Wizard
**File:** `src/components/settings/RestaurantDetailsWizard.tsx`

**Changes Needed:**
1. Add initial step: "How do you want to set up?"
   - Option A: "New Restaurant" (existing flow)
   - Option B: "Activate Location" (new flow)
2. If "Activate Location" selected:
   - Show ActivationCodeInput component
   - On successful activation:
     - Call Rust commands
     - Sync menu from D1
     - Navigate to /pos

**Status:** ⏳ To be implemented

---

## Implementation Checklist

### Phase 1: Foundation ✅ COMPLETE
- [x] Create migration 053
- [x] Add to migrations manifest
- [x] Create activation code utility functions
- [x] Create ActivationCodeModal component
- [x] Create ActivationCodeInput component

### Phase 2: Backend Integration ⏳ IN PROGRESS
- [ ] Add backend API endpoint for validation
- [ ] Create Rust activation commands
- [ ] Register commands in lib.rs
- [ ] Test API endpoint with Postman/curl

### Phase 3: Frontend Integration ⏳ PENDING
- [ ] Update LocationProvisioningForm to generate codes
- [ ] Show ActivationCodeModal after creation
- [ ] Update Setup Wizard to add "Activate Location" option
- [ ] Wire ActivationCodeInput to Rust commands
- [ ] Add menu sync after activation

### Phase 4: Testing ⏳ PENDING
- [ ] Test master creates location → code generated
- [ ] Test code copy/print functionality
- [ ] Test location enters code → activates successfully
- [ ] Test invalid code error handling
- [ ] Test already-used code error handling
- [ ] Test network error handling
- [ ] End-to-end test: master creates → location activates → ready to operate

---

## File Structure

```
restaurant-pos-ai/
├── migrations/
│   ├── 053_location_activation_codes.sql ✅
│   └── manifest.json ✅
├── src/
│   ├── lib/
│   │   └── activationCode.ts ✅
│   ├── components/
│   │   └── locations/
│   │       ├── ActivationCodeModal.tsx ✅
│   │       ├── ActivationCodeInput.tsx ✅
│   │       └── LocationProvisioningForm.tsx ⏳
│   └── components/settings/
│       └── RestaurantDetailsWizard.tsx ⏳
├── src-tauri/src/commands/
│   ├── location_activation.rs ⏳ (new)
│   ├── mod.rs ⏳ (update)
│   └── lib.rs ⏳ (update)
└── workers/tenant-router/src/
    └── index.ts ⏳ (add endpoint)
```

---

## Next Steps

1. **Implement Backend API Endpoint**
   - Add `/api/locations/activate` to tenant-router worker
   - Handle validation and return metadata

2. **Create Rust Commands**
   - Create location_activation.rs
   - Implement validate_activation_code
   - Implement configure_as_location
   - Register in mod.rs and lib.rs

3. **Update Frontend Components**
   - Add code generation to LocationProvisioningForm
   - Add "Activate Location" option to Setup Wizard
   - Wire everything together

4. **Test End-to-End**
   - Master flow: Create → Get code
   - Location flow: Enter code → Activate → Ready

---

## Current Status

**Completed:** 4/8 components (50%)
**In Progress:** Backend + Rust commands
**Estimated Time to Complete:** 4-6 hours

**Foundation is solid!** The UI components and utilities are ready. Now we need to implement the backend validation and Rust commands to complete the activation flow.

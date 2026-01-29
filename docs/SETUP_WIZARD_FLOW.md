# Setup Wizard Flow Documentation

This document outlines the multi-stage setup workflow implemented in `src/pages/SetupWizard.tsx` and managed by `src/stores/setupWizardStore.ts`.

## Overview
The Setup Wizard provides an OS-style first-time onboarding experience for the Restaurant POS AI application. It persists state to SQLite, allowing users to resume setup if interrupted.

## State Management
- **Store**: `useSetupWizardStore` (Zustand)
- **Persistence**: SQLite (via `tauriSetupWizard` service)
- **Data Transfer**: Upon completion, data is transferred to `restaurantSettingsStore`, `menuStore`, `floorPlanStore`, etc., and synced to the cloud (if not in Training Mode).

## Workflow Stages

The workflow consists of **Required** and **Optional** stages.

### 1. Welcome (`welcome`)
- Introduction screen.
- Entry point for the wizard.

### 2. Restaurant Info (`restaurant_basics`)
- **Primary Data Collection**:
    - Restaurant Name
    - Tagline
    - Address (Line 1, Line 2, City, State, Pincode)
    - Contact (Phone, Email, Website)
- **Missing Field**: The "Owner Name" field (recently added to Settings) is currently **missing** from this screen.

### 3. Legal & Tax IDs (`legal_info`)
- **Optional Step** (can be skipped)
- Collects:
    - GSTIN
    - FSSAI License
    - PAN Number
    - CIN Number

### 4. Tax Settings (`tax_config`)
- **Configuration Modes**:
    - **Simple**: No tax calculation.
    - **GST**: Configure CGST, SGST, Service Charge.
- **Preview**: Real-time calculation preview.

### 5. Optional Setup Selector (`optional_selector`)
- Users choose which additional modules to configure now vs later:
    - Menu Setup
    - Floor Plan
    - Staff Setup
    - Printers
    - Invoicing

### 6. Module Setup (Conditional)
- **Menu Setup** (`menu_setup`): Upload Excel/CSV or manual entry.
- **Floor Plan** (`floor_plan`): Define sections and tables.
- **Staff Setup** (`staff_setup`): Add initial staff members.
- **Printer Setup** (`printer_setup`): Configure receipt/KOT printers.
- **Invoice Config** (`invoice_config`): Prefix, terms, footer (Placeholder implementation).

### 7. Training Mode (`training_mode`)
- **Critical Decision**:
    - **Training Mode**: Sandbox environment, no cloud sync, data is local only.
    - **Live Mode**: Production environment, fully synced.

### 8. System Check (`system_check`)
- Validates system readiness before final commit.

### 9. Completion (`completion`)
- **Final Actions**:
    - Saves all data to SQLite stores.
    - Syncs to Cloud (D1/KV) if in Live Mode.
    - Marks provisioning as complete.
    - Transitions user to the main Dashboard.

## Navigation Logic
- **Validation**: Each step has `canProceed()` logic ensuring required fields are present.
- **Skipping**: Optional steps can be skipped.
- **Resumption**: App startup checks for incomplete wizard state and resumes automatically.

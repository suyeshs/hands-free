# POS Menu Upload Alignment with Web Client

## Overview
Updated the POS app menu management interface to align with the web client's menu upload functionality. The POS app now supports the same R2-based multipart upload with AI processing as the web client.

## Changes Made

### 1. New File: `src/lib/r2Uploader.ts`
- Implements R2 multipart upload matching web client implementation
- Supports large files with 10MB chunk size
- Includes retry logic (max 3 retries with exponential backoff)
- Progress tracking for upload operations
- Platform-aware fetch (Tauri vs Web)
- `R2Uploader` class for file upload
- `processFileFromR2()` function to trigger AI processing and D1 save

**Key Features**:
- Uploads files to Cloudflare R2 in chunks
- Reports progress via callback
- Calls Restaurant Client API for AI processing
- Auto-saves extracted menu items to D1 database

### 2. Modified: `src/lib/backendApi.ts`
Added new methods to support R2 upload workflow:

#### New Methods:
- `uploadViaR2()` - Upload file via R2 with AI processing and D1 auto-save
- `getMenuItemsFromD1()` - Fetch menu items from D1 database
- `getCategoriesFromD1()` - Fetch categories from D1 database
- `createCategoryInD1()` - Create new category in D1
- `createMenuItemInD1()` - Create new menu item in D1
- `updateMenuItemInD1()` - Update existing menu item in D1
- `deleteMenuItemFromD1()` - Delete menu item from D1

**Architecture**:
- Uses Restaurant Worker API (`https://handsfree-restaurant.suyesh.workers.dev`)
- Sends `X-Tenant-ID` header for tenant-specific operations
- Returns data in POS-compatible format

### 3. Modified: `src/components/admin/ExcelUploader.tsx`
Major refactor to support three upload modes:

#### Upload Modes:
1. **R2 Upload** (Recommended) - NEW
   - Aligns with web client implementation
   - Supports large files (up to 100MB)
   - AI-powered extraction with Gemini
   - Auto-saves to D1 database
   - Progress tracking with percentage display

2. **Smart Upload** (Legacy)
   - Existing AI-powered upload
   - Direct file upload to backend
   - Supports PDF, Excel, Word, images (max 10MB)

3. **Template Upload** (Legacy)
   - Template-based Excel upload
   - Download template → Fill data → Upload

#### UI Changes:
- Radio buttons for mode selection
- Progress bar for R2 uploads
- Mode-specific badges (AI-Powered, R2 Storage)
- Dynamic help text based on selected mode
- Error handling with mode-specific suggestions

#### Technical Changes:
- Replaced `useSmartUpload: boolean` with `uploadMode: 'smart' | 'template' | 'r2'`
- Added `uploadProgress: number` state for R2 upload tracking
- Added `isAIPowered` helper variable for conditional UI
- D1 to POS format conversion for menu items:
  ```typescript
  {
    id: item.id,
    name: item.name,
    category: item.categoryId || 'Uncategorized',
    isVeg: item.isVegetarian || false,
    dietaryTags: [
      ...(item.isVegetarian ? ['vegetarian'] : []),
      ...(item.isVegan ? ['vegan'] : []),
      ...(item.isGlutenFree ? ['gluten-free'] : []),
    ],
    // ... more mappings
  }
  ```

## API Endpoints Used

### R2 Upload Endpoints (Restaurant Client)
- `POST /api/r2` - Initiate multipart upload
- `PUT /api/r2?key={r2Key}&uploadId={uploadId}&partNumber={partNumber}` - Upload chunk
- `PATCH /api/r2` - Complete multipart upload

### AI Processing Endpoint (Restaurant Client)
- `POST /api/admin/menu/process-from-r2`
  - Downloads file from R2
  - Parses with Gemini AI
  - Saves to D1 database
  - Uploads to File Search (for voice ordering)
  - Returns item count and store name

### Restaurant Worker Endpoints
- `GET /api/admin/menu/items` - List menu items
- `POST /api/admin/menu/items` - Create menu item
- `PATCH /api/admin/menu/items/{id}` - Update menu item
- `DELETE /api/admin/menu/items/{id}` - Delete menu item
- `GET /api/admin/menu/categories` - List categories
- `POST /api/admin/menu/categories` - Create category

## Environment Variables Required

Add these to POS app `.env` file:

```bash
# Restaurant Client URL (for R2 upload and menu processing)
VITE_RESTAURANT_CLIENT_URL=https://handsfree-restaurant-client.suyesh.workers.dev

# Restaurant Worker URL (for D1 database operations)
VITE_RESTAURANT_WORKER_URL=https://handsfree-restaurant.suyesh.workers.dev
```

For production tenant-specific access:
```bash
# Use tenant subdomain
VITE_RESTAURANT_CLIENT_URL=https://{tenantId}.handsfree.tech
```

## Upload Flow Comparison

### Web Client Flow:
1. User uploads file → R2 multipart upload
2. File stored in R2 bucket
3. AI processing (Gemini) extracts menu items
4. Items saved to D1 database
5. File uploaded to Google File Search (for voice ordering)
6. Items displayed in admin panel

### POS App Flow (R2 Mode):
1. User uploads file → R2 multipart upload (via Restaurant Client API)
2. File stored in R2 bucket
3. AI processing (Gemini) extracts menu items
4. Items saved to D1 database
5. File uploaded to Google File Search (for voice ordering)
6. **POS fetches items from D1** → Converts to POS format → Displays in admin panel
7. User can sync to local SQLite for offline access

## Testing

### Manual Test Steps:
1. Launch POS app: `npm run tauri:dev`
2. Navigate to Menu Management → Upload Menu
3. Select "R2 Upload (Recommended)" mode
4. Upload a menu file (PDF, Excel, or image)
5. Verify progress bar shows upload progress
6. Wait for AI processing to complete
7. Verify menu items appear in the list
8. Check that items have correct categories, prices, dietary tags

### Test Files:
Use existing test files from web client:
- `/Users/stonepot-tech/projects/handsfree-restaurant-new/client/restaurant-client/hole-in-the-wall.pdf`
- `/Users/stonepot-tech/projects/handsfree-restaurant-new/client/restaurant-client/hole-in teh wall-2.jpeg`

## Architecture Alignment

### Before:
- POS: Direct upload to Backend (Cloud Run) → FormData
- Web: R2 upload → AI processing → D1 save
- **MISALIGNMENT**: Different upload methods, different data flows

### After:
- POS: R2 upload → AI processing → D1 save → Fetch from D1
- Web: R2 upload → AI processing → D1 save
- **ALIGNED**: Same upload method, same API endpoints, same data flow

## Benefits

1. **Consistency**: Both POS and web client use identical upload workflow
2. **Large File Support**: R2 supports files up to 100MB vs 10MB limit on direct upload
3. **Progress Tracking**: Users see real-time upload progress
4. **Reliability**: Chunked upload with automatic retry on failure
5. **Future-Proof**: Easier to maintain and extend both systems together
6. **Offline Support**: POS can still sync to local SQLite after D1 save

## Backward Compatibility

- Legacy upload modes (Smart, Template) remain functional
- Existing menu data in SQLite is unaffected
- Users can choose their preferred upload method
- Default mode is R2 for new users

## Next Steps

1. Test R2 upload in production environment
2. Monitor upload success rates and processing times
3. Collect user feedback on new upload experience
4. Consider deprecating legacy upload modes after stabilization
5. Add batch upload support for multiple files
6. Implement automatic menu sync schedule

## Security Notes

- All endpoints require admin authentication (`admin_access_token` cookie)
- Tenant isolation enforced via `X-Tenant-ID` header
- R2 keys validated to match tenant ID
- File size limits enforced at API level
- Gemini API key protected in environment variables

## Known Issues

- Minor TypeScript warning: `CompleteUploadResponse` type unused in `r2Uploader.ts` (non-critical)
- Pre-existing TypeScript errors in other parts of codebase (unrelated to this feature)

## Files Modified

### New Files:
- `src/lib/r2Uploader.ts` (265 lines)

### Modified Files:
- `src/lib/backendApi.ts` (added 150+ lines of D1 integration)
- `src/components/admin/ExcelUploader.tsx` (refactored upload mode logic)

### Reference Files (Not Modified):
- `/Users/stonepot-tech/projects/handsfree-restaurant-new/client/restaurant-client/app/api/admin/menu/process-from-r2/route.ts`
- `/Users/stonepot-tech/projects/handsfree-restaurant-new/test-menu-upload.js`

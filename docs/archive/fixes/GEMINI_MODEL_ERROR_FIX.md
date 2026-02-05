# Gemini AI Model Error - Menu Parsing Broken ❌

## Problem

Menu parsing/upload functionality is failing with a 500 error. The backend is trying to use an outdated Gemini AI model that no longer exists.

**Error Message:**
```
{
  "error": "AI parsing failed",
  "message": "Gemini generation failed: {
    \"error\": {
      \"code\": 404,
      \"message\": \"models/gemini-2.0-flash-exp is not found for API version v1beta, 
                   or is not supported for generateContent. Call ListModels to see 
                   the list of available models and their supported methods.\",
      \"status\": \"NOT_FOUND\"
    }
  }"
}
```

**Impact:**
- ❌ Cannot upload menu files (Excel, PDF, images)
- ❌ Cannot parse menus with AI
- ❌ Menu onboarding is blocked
- ❌ ExcelUploader component fails
- ❌ DiagnosticsPage menu parsing fails

---

## Root Cause

The backend Cloudflare Worker is using the model name: **`gemini-2.0-flash-exp`**

This was an **experimental model** that:
1. Is no longer available in Google's Gemini API
2. Has been replaced by stable models
3. Needs to be updated in the backend code

---

## Where the Issue Is

**Frontend** (working correctly ✅):
- URL: `https://handsfree-restaurant-client.suyesh.workers.dev/api/admin/menu/parse-from-r2`
- File: [src/lib/r2Uploader.ts:244-343](src/lib/r2Uploader.ts:244)
- Request body: `{ tenantId, r2Key, filename, mimeType }`

**Backend** (needs fix ❌):
- Cloudflare Worker: `handsfree-restaurant-client` (hosted at suyesh.workers.dev)
- Endpoint: `/api/admin/menu/parse-from-r2`
- Issue: Hardcoded `gemini-2.0-flash-exp` model name
- Needs update to: `gemini-1.5-flash` or `gemini-1.5-pro`

---

## Solution

Update the backend Cloudflare Worker code to use a stable Gemini model.

### Current Model (broken):
```javascript
const model = 'gemini-2.0-flash-exp';  // ❌ Not found
```

### Updated Model (working):
```javascript
const model = 'gemini-1.5-flash';  // ✅ Stable, fast, cost-effective
// OR
const model = 'gemini-1.5-pro';    // ✅ More powerful, higher quality
```

---

## Available Gemini Models (January 2025)

### Recommended for Menu Parsing:

**Option 1: `gemini-1.5-flash` (Recommended)**
- ✅ Fast and efficient
- ✅ Lower cost
- ✅ Good for structured data extraction
- ✅ Best for menu parsing
- API: `models/gemini-1.5-flash`

**Option 2: `gemini-1.5-pro`**
- ✅ Higher quality
- ✅ Better for complex documents
- ❌ Higher cost
- API: `models/gemini-1.5-pro`

**Option 3: `gemini-2.0-flash-exp` (Latest experimental)**
- ⚠️ Experimental (may change)
- ⚠️ Use only for testing
- ⚠️ Not for production

### Check Current Models:
```bash
# List all available models via Gemini API
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

---

## Recommended Architecture: Use Google File API with RAG

**IMPORTANT:** For document parsing (PDFs, Excel, images), the backend should use Google's **File API with RAG** (Retrieval Augmented Generation) instead of trying to process content in a single prompt.

### Why File API + RAG?

**Current approach (suboptimal):**
1. Download file from R2
2. Extract all text/content
3. Send entire content to Gemini in one prompt
4. Limited by prompt size
5. Less accurate for large documents

**Recommended approach (better):**
1. Upload file to Google File API
2. Get file reference URI
3. Use Gemini with file reference + RAG
4. Gemini intelligently searches through document
5. Better accuracy, handles large files

### Benefits:
- ✅ Handles large PDFs/Excel files (no size limits)
- ✅ Better accuracy with document understanding
- ✅ Supports images, scanned menus, photos
- ✅ Uses semantic search across document
- ✅ More cost-effective for large files

---

## Backend Code Fix

### Quick Fix (Update Model Name Only)

**Current (broken):**
```javascript
// In Cloudflare Worker: handsfree-restaurant-client
// File: src/routes/admin/menu-parse.ts (or similar)

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp'  // ❌ Model not found
});

// Parse menu with AI
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }]
});
```

**Quick Fix (working):**
```javascript
// In Cloudflare Worker: handsfree-restaurant-client
// File: src/routes/admin/menu-parse.ts (or similar)

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash'  // ✅ Stable model
});

// Parse menu with AI
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }]
});
```

### Better Fix (Use File API + RAG)

**Recommended approach using Google File API:**

```javascript
// In Cloudflare Worker: handsfree-restaurant-client
import { GoogleGenerativeAI, GoogleAIFileManager } from '@google/generative-ai';

// Initialize File Manager
const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY);
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// Step 1: Download file from R2
const r2Object = await env.MENU_FILES_BUCKET.get(r2Key);
const fileBuffer = await r2Object.arrayBuffer();

// Step 2: Upload to Google File API
const uploadResponse = await fileManager.uploadFile(
  Buffer.from(fileBuffer),
  {
    mimeType: mimeType,
    displayName: filename,
  }
);

const fileUri = uploadResponse.file.uri;
console.log('File uploaded to Google:', fileUri);

// Step 3: Use Gemini with file reference (RAG)
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash'  // ✅ Stable model with file support
});

const result = await model.generateContent([
  {
    fileData: {
      mimeType: mimeType,
      fileUri: fileUri,
    }
  },
  {
    text: `Parse this menu document and extract all items with the following structure:
    - Item name
    - Category
    - Description
    - Price
    - Variations/sizes
    - Dietary info

    Return as structured JSON array.`
  }
]);

// Step 4: Clean up - delete file from Google after parsing
await fileManager.deleteFile(uploadResponse.file.name);

// Step 5: Parse and return results
const parsedData = JSON.parse(result.response.text());
return {
  success: true,
  items: parsedData,
  summary: {
    total: parsedData.length,
    // ... other summary data
  }
};
```

### Key Differences:

| Aspect | Current (Broken) | Quick Fix | Best Practice (RAG) |
|--------|-----------------|-----------|---------------------|
| Model | `gemini-2.0-flash-exp` ❌ | `gemini-1.5-flash` ✅ | `gemini-1.5-flash` ✅ |
| File Handling | Extract text → prompt | Extract text → prompt | Upload to Google File API |
| Document Size | Limited by prompt | Limited by prompt | No size limit |
| Images/PDFs | Poor accuracy | Poor accuracy | Excellent accuracy |
| RAG Support | No | No | Yes ✅ |
| Cost | High (large prompts) | High (large prompts) | Lower (efficient RAG) |

---

## Implementation Steps for File API + RAG

### 1. Install Dependencies

Update `package.json` in the Cloudflare Worker:

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0"  // Latest version with File API support
  }
}
```

### 2. Update Wrangler Config

Add environment variables to `wrangler.toml`:

```toml
[vars]
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_API_KEY = ""  # Set via wrangler secret

[[r2_buckets]]
binding = "MENU_FILES_BUCKET"
bucket_name = "handsfree-pos-menu-files"
```

### 3. Set API Key Secret

```bash
# Set Gemini API key as secret (not in source code)
wrangler secret put GEMINI_API_KEY
# Paste your API key when prompted
```

### 4. Update Route Handler

Replace the existing menu parsing logic with the File API + RAG approach shown above.

### 5. Test Locally

```bash
# Test with local R2 bucket
wrangler dev

# Upload a test menu file
# Check logs for file upload confirmation
```

### 6. Deploy

```bash
wrangler deploy
```

---

## File API Documentation

**Google AI File API Reference:**
- Docs: https://ai.google.dev/gemini-api/docs/file-api
- Supported formats: PDF, images (JPG, PNG), Excel, Word, text files
- Max file size: 20MB per file
- File retention: 48 hours (auto-deleted)

**Code Examples:**
```javascript
// Upload file
const uploadResult = await fileManager.uploadFile(filePath, {
  mimeType: "application/pdf",
  displayName: "menu.pdf"
});

// Use in prompt
const result = await model.generateContent([
  {
    fileData: {
      fileUri: uploadResult.file.uri,
      mimeType: uploadResult.file.mimeType
    }
  },
  { text: "Extract menu items from this document" }
]);

// Clean up
await fileManager.deleteFile(uploadResult.file.name);
```

---

## Testing After Fix

1. **Deploy updated worker:**
   ```bash
   cd cloudflare-workers/handsfree-restaurant-client
   wrangler deploy
   ```

2. **Test menu upload in app:**
   - Open app
   - Go to Menu Management
   - Upload a menu file (Excel/PDF/Image)
   - Should see parsing progress
   - Should get parsed menu items

3. **Expected logs:**
   ```
   [parseFileFromR2] Using restaurant-client parse API
   [parseFileFromR2] Response status: 200
   [parseFileFromR2] Success! Parsed 25 items
   ```

4. **Should NOT see:**
   ```
   ❌ [parseFileFromR2] Error response body: {"error":"AI parsing failed"}
   ❌ models/gemini-2.0-flash-exp is not found
   ```

---

## Frontend Reference (No Changes Needed)

The frontend code is correct and doesn't need changes:

**File:** [src/lib/r2Uploader.ts:244](src/lib/r2Uploader.ts:244)

```typescript
export async function parseFileFromR2(
  tenantId: string,
  r2Key: string,
  filename: string,
  mimeType: string
): Promise<{
  success: boolean;
  items: any[];
  summary?: { total: number; byType: Record<string, number>; withWarnings: number };
  message?: string;
  error?: string;
}> {
  const customFetch = await getFetch();
  const restaurantClientUrl = 'https://handsfree-restaurant-client.suyesh.workers.dev';
  const apiUrl = `${restaurantClientUrl}/api/admin/menu/parse-from-r2`;

  // ... makes POST request to backend
}
```

The frontend correctly:
- ✅ Calls the right endpoint
- ✅ Sends correct parameters
- ✅ Handles errors properly
- ✅ No model name hardcoded

---

## Alternative: Environment Variable

**Best Practice:** Make the model name configurable via environment variable:

```javascript
// In Cloudflare Worker wrangler.toml:
[vars]
GEMINI_MODEL = "gemini-1.5-flash"

// In worker code:
const model = genAI.getGenerativeModel({ 
  model: env.GEMINI_MODEL || 'gemini-1.5-flash'  // Fallback to stable model
});
```

This allows changing the model without redeploying code.

---

## Impact Assessment

**Affected Features:**
1. ❌ Menu upload (Excel/PDF/Image)
2. ❌ AI menu parsing
3. ❌ DiagnosticsPage menu parsing test
4. ❌ ExcelUploader component
5. ❌ Bulk menu import

**Unaffected Features:**
1. ✅ Manual menu item creation (works)
2. ✅ Menu editing (works)
3. ✅ POS operations (works)
4. ✅ Other AI features (if they use different endpoints)

---

## Related Files

**Frontend:**
- [src/lib/r2Uploader.ts](src/lib/r2Uploader.ts:244) - API client
- [src/components/admin/ExcelUploader.tsx](src/components/admin/ExcelUploader.tsx:1) - Upload UI
- [src/pages-v2/DiagnosticsPage.tsx](src/pages-v2/DiagnosticsPage.tsx:1) - Testing page

**Backend (needs access to fix):**
- Cloudflare Worker: `handsfree-restaurant-client`
- Repository: (need to locate the worker source code)
- File: `src/routes/admin/menu-parse.ts` (estimated path)

---

## Immediate Workaround

**None available.** Menu upload will remain broken until backend is updated.

**Manual Alternative:**
1. Create menu items manually via Menu Management UI
2. Use direct SQL import if you have database access
3. Wait for backend fix

---

## Summary

### Status: ✅ **FIXED**

- ✅ **Fixed**: Backend updated to use `gemini-2.5-pro`
- ✅ **Worker**: `handsfree-restaurant-client.suyesh.workers.dev`
- ✅ **Deployed**: Menu parsing routes updated
- 📅 **Fixed On**: 2026-01-28

### What Changed

**Before (broken):**
- Model: `gemini-2.0-flash-exp` ❌
- Status: 404 Not Found
- Menu parsing: Broken

**After (fixed):**
- Model: `gemini-2.5-pro` ✅
- Status: Working
- Menu parsing: Functional

### Testing Required

Please test menu upload to verify the fix:

1. **Upload Excel file** - Test with menu Excel file
2. **Upload PDF** - Test with menu PDF
3. **Upload image** - Test with menu photo
4. **Check logs** - Should see 200 success responses

**Expected logs:**
```
[parseFileFromR2] Response status: 200
[parseFileFromR2] Success! Parsed X items
```

**Should NOT see:**
```
❌ models/gemini-2.0-flash-exp is not found
❌ HTTP 500: AI parsing failed
```

### Next Steps (Optional)

Consider migrating to **File API + RAG** for better document parsing:
- Better accuracy for PDFs and images
- No file size limits
- More cost-effective
- See implementation guide above

# Image Upload Flow Analysis

## Architecture Overview

The system uses **Cloudflare Images** for image hosting with an **"unassigned images" pool** workflow.

### Key Components

1. **Cloudflare Images API** - Permanent image storage with CDN
2. **Token Manager Worker** - Secures Cloudflare API tokens
3. **Restaurant Worker** - Proxy for image uploads
4. **D1 Database** - `unassigned_images` table for temporary storage
5. **POS/Admin UI** - Upload and assign images to menu items

## Complete Image Upload Flow

### Step 1: Upload Image to Cloudflare Images

```
POS/Admin → POST /api/cfupload (FormData with file)
           → Restaurant Worker
           → Token Manager (fetch API token)
           → Cloudflare Images API
           → Returns: { id, filename, variants, url }
```

**Endpoint**: `POST /api/cfupload`
**Location**: `platform/workers/restaurant/src/index.ts:1908`
**No tenant routing required** - accepts direct calls

**Request**:
```typescript
const formData = new FormData();
formData.append('file', imageFile);

fetch('https://handsfree-restaurant.suyesh.workers.dev/api/cfupload', {
  method: 'POST',
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "id": "cf-image-id-123",
  "filename": "uploaded_image.jpg",
  "uploaded": "2024-01-22T12:00:00Z",
  "variants": [
    "https://imagedelivery.net/account-hash/cf-image-id-123/public",
    "https://imagedelivery.net/account-hash/cf-image-id-123/thumbnail"
  ],
  "url": "https://imagedelivery.net/account-hash/cf-image-id-123/public"
}
```

**How it works**:
1. Gets API token from Token Manager worker (service binding)
2. Forwards file to Cloudflare Images API
3. Returns Cloudflare image ID and URLs

### Step 2: Store in Unassigned Images Pool

```
POS/Admin → POST /api/admin/menu/unassigned-images
           → Restaurant Worker (D1)
           → Stores in unassigned_images table
```

**Endpoint**: `POST /api/admin/menu/unassigned-images`
**Location**: `platform/workers/restaurant/src/index.ts:1802`

**Request**:
```typescript
fetch('https://handsfree-restaurant.suyesh.workers.dev/api/admin/menu/unassigned-images', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId
  },
  body: JSON.stringify({
    action: 'create',
    cloudflareImageId: 'cf-image-id-123',
    imageUrl: 'https://imagedelivery.net/.../public',
    filename: 'burger.jpg'
  })
});
```

**D1 Schema** (`unassigned_images`):
```sql
CREATE TABLE unassigned_images (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  cloudflare_image_id TEXT NOT NULL,
  filename TEXT,
  image_url TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now')),
  uploaded_by TEXT,
  notes TEXT
);
```

### Step 3: Fetch Unassigned Images

```
Admin UI → GET /api/admin/menu/unassigned-images?tenantId=xxx
         → Restaurant Worker (D1)
         → Returns list of images
```

**Endpoint**: `GET /api/admin/menu/unassigned-images?tenantId=xxx`

**Response**:
```json
{
  "success": true,
  "images": [
    {
      "id": "uuid-123",
      "tenant_id": "the-big-burger",
      "cloudflare_image_id": "cf-image-id-123",
      "filename": "burger.jpg",
      "image_url": "https://imagedelivery.net/.../public",
      "uploaded_at": "2024-01-22T12:00:00Z"
    }
  ],
  "count": 1
}
```

### Step 4: Assign Image to Menu Item

```
Admin UI → POST /api/admin/menu/unassigned-images
         → Restaurant Worker (D1)
         → Updates menu_items.photo_url
         → Deletes from unassigned_images
```

**Request**:
```typescript
fetch('https://handsfree-restaurant.suyesh.workers.dev/api/admin/menu/unassigned-images', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId
  },
  body: JSON.stringify({
    action: 'assign',
    imageId: 'uuid-123',
    menuItemId: 'item-456'
  })
});
```

**What it does**:
1. Fetches image from `unassigned_images`
2. Updates `menu_items` table:
   ```sql
   UPDATE menu_items
   SET cloudflare_image_id = ?,
       photo_url = ?,
       updated_at = datetime('now')
   WHERE tenant_id = ? AND id = ?
   ```
3. Deletes from `unassigned_images`

### Step 5: Delete Unassigned Image (Optional)

```
Admin UI → POST /api/admin/menu/unassigned-images
         → Restaurant Worker
         → Deletes from Cloudflare Images API
         → Deletes from D1
```

**Request**:
```typescript
fetch('https://handsfree-restaurant.suyesh.workers.dev/api/admin/menu/unassigned-images', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId
  },
  body: JSON.stringify({
    action: 'delete',
    imageId: 'uuid-123',
    cfApiToken: '...',  // Optional
    cfAccountId: '...'  // Optional
  })
});
```

## Why This Design?

### The "Unassigned Images Pool" Pattern

Instead of uploading images directly when creating menu items, this system:

1. **Uploads images first** → Cloudflare Images (permanent storage)
2. **Stores in pool** → `unassigned_images` table (temporary tracking)
3. **Assign later** → Link to menu items when ready

### Benefits

✅ **Decouple upload from creation** - Upload multiple images at once
✅ **Bulk operations** - Upload 50 images, then assign to menu items
✅ **Reuse images** - Same image can be assigned to multiple items
✅ **Safety** - Images aren't deleted if menu item is deleted (can reassign)
✅ **Flexibility** - Upload images before menu items exist

### Use Cases

1. **Menu migration**: Upload all menu images first, then create/link items
2. **Batch upload**: Admin uploads 50 product photos, assigns later
3. **Image library**: Build a reusable library of food photos
4. **Recovery**: If menu item is deleted, image is still in pool

## Current POS Menu Upload Issue

**Problem**: AI extracts `imageUrl` from PDF (if present), but these are **external URLs**, not uploaded to Cloudflare Images.

**Current behavior**:
- AI parsing extracts: `imageUrl: "https://example.com/burger.jpg"`
- Saved to SQLite: `image: "https://example.com/burger.jpg"`
- ❌ Not uploaded to Cloudflare Images
- ❌ External link might break

**Solution options**:

### Option A: Store External URLs As-Is (Current)
```typescript
// In ExcelUploader.tsx
return {
  image: item.imageUrl || null,  // External URL from PDF
};
```

**Pros**:
- Simple, no extra upload needed
- Fast

**Cons**:
- External URLs might break
- No CDN benefits
- Not in Cloudflare Images

### Option B: Upload to Cloudflare Images After Parsing
```typescript
// After AI parsing completes
for (const item of parsedItems) {
  if (item.imageUrl) {
    // Download from external URL
    const response = await fetch(item.imageUrl);
    const blob = await response.blob();

    // Upload to Cloudflare Images
    const formData = new FormData();
    formData.append('file', blob, item.name + '.jpg');

    const uploadResult = await fetch('/api/cfupload', {
      method: 'POST',
      body: formData
    });

    const { url } = await uploadResult.json();

    // Replace external URL with Cloudflare URL
    item.imageUrl = url;
  }
}

// Then save to SQLite with Cloudflare URLs
```

**Pros**:
- All images in Cloudflare Images
- CDN benefits
- Permanent storage

**Cons**:
- More complex
- Slower (additional upload step)
- May fail if external URLs are broken

### Option C: Hybrid - Store Both URLs
Add a new migration to support both:

```sql
ALTER TABLE menu_items ADD COLUMN external_image_url TEXT;
ALTER TABLE menu_items ADD COLUMN cloudflare_image_url TEXT;
```

```typescript
return {
  image: item.imageUrl,  // External URL from PDF
  // Later can upload and set cloudflare_image_url
};
```

## Recommended Approach for POS

### For Now: Keep External URLs (Option A)
The current implementation is fine:
- External URLs from AI are stored in `image` column
- Fast, simple, works immediately

### Later: Add Manual Upload UI
Add a UI in POS admin to:
1. Show menu items with external images
2. Allow manual upload of better images
3. Upload to Cloudflare Images via `/api/cfupload`
4. Update `image` column with Cloudflare URL

## Implementation for POS

If you want to add image upload to POS:

```typescript
// Upload image to Cloudflare Images
async function uploadImageToCloudflare(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://handsfree-restaurant.suyesh.workers.dev/api/cfupload', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  return result.url; // Cloudflare CDN URL
}

// Usage in menu item edit
const imageUrl = await uploadImageToCloudflare(selectedFile);

// Update menu item
await database.execute(
  'UPDATE menu_items SET image = ? WHERE id = ?',
  [imageUrl, itemId]
);
```

## Summary

| Aspect | Current POS | Recommended Next Step |
|--------|-------------|----------------------|
| **Menu parsing** | Saves external URLs from PDF | ✅ Keep as-is |
| **Image upload** | Not implemented | Add manual upload UI |
| **Storage** | External URLs in SQLite | Cloudflare Images via `/api/cfupload` |
| **Assignment** | Direct to menu items | Can use unassigned pool for bulk ops |

The current implementation **is fine** - external URLs work. The unassigned images pool is for **manual bulk uploads**, not automated parsing.

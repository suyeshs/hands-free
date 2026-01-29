# Menu Review Workflow - POS Implementation

## Overview
Enhanced menu upload workflow with **interactive review step** before saving to local SQLite database. Handles complex menu structures including combos, specials, variants, and add-ons with AI-powered classification.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         POS MENU UPLOAD FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

1. User uploads file (PDF, Excel, Image)
          ↓
2. Upload to R2 (chunked multipart upload)
          ↓
3. AI parsing with Gemini (NO D1 save)
   - Extract menu items
   - Classify item types (regular, combo, special, variant, addon)
   - Detect warnings (missing data, low confidence, etc.)
   - Suggest combo items, validity periods, etc.
          ↓
4. REVIEW MODAL (User interaction)
   - View all parsed items
   - Edit item details
   - Confirm/reject items
   - Configure combos (items included, savings)
   - Configure specials (validity period, days available)
   - Configure variants (parent item, variant name)
   - Filter by type, search, warnings-only view
          ↓
5. Save to LOCAL SQLite
   - Create/update categories
   - Save menu items with `needs_sync = 1` flag
   - Store type-specific metadata (combo_items, valid_from, etc.)
          ↓
6. Background sync to D1
   - Sync engine picks up items with `needs_sync = 1`
   - Uploads to D1 database
   - Marks items as synced (`needs_sync = 0`)
          ↓
7. Upload to File Search (for voice ordering)
   - Uploads original file to backend
   - Enables voice ordering capabilities
```

## Key Features

### 1. **AI-Powered Classification**
Items are automatically classified into 5 types:

- **Regular**: Standard single dish
- **Combo**: Meals with multiple items
  - Keywords: combo, meal, bundle, set, platter, thali, family pack
  - Captures: Items included, combo savings

- **Special**: Limited-time or daily specials
  - Keywords: special, today, daily, chef, seasonal, limited
  - Captures: Valid from/until dates, days available

- **Variant**: Size or customization options
  - Keywords: small, medium, large, regular, mini, jumbo, half, full
  - Captures: Parent item ID, variant name

- **Addon**: Extra items or toppings
  - Keywords: extra, add-on, addon, side, topping
  - Captures: Addon category, default selection

### 2. **Warning Detection**
AI identifies potential issues:
- `missing_description` - No or vague description
- `price_zero` - Price is 0
- `ambiguous_category` - Category unclear
- `possible_combo` - Might be a combo but not clearly stated
- `missing_dietary_info` - No dietary tags found
- Low AI confidence scores (<70%)

### 3. **Interactive Review Modal**

#### Statistics Dashboard
- Total items
- Confirmed items count
- Items with warnings
- Breakdown by type (regular, combo, special, variant, addon)

#### Filtering & Search
- Search by name or description
- Filter by item type
- Show warnings-only view
- Real-time filtering

#### Item Card Features
- Checkbox to confirm/unconfirm items
- Inline editing (name, price, description)
- Type selection with visual badges
- Expand/collapse for detailed configuration
- Delete unwanted items

#### Type-Specific Configuration

**Combo Configuration:**
```typescript
{
  comboItems: string[],        // Items included (e.g., ["Burger", "Fries", "Drink"])
  comboSavings: number          // Savings amount in ₹
}
```

**Special Configuration:**
```typescript
{
  validFrom: string,            // Start date (YYYY-MM-DD)
  validUntil: string,           // End date (YYYY-MM-DD)
  daysAvailable: string[]       // ["Mon", "Tue", "Wed", ...]
}
```

**Variant Configuration:**
```typescript
{
  parentItemId: string,         // ID of base item
  variantName: string           // e.g., "Large", "Extra Spicy"
}
```

## Database Schema Updates

### New fields in `menu_items` table:

```sql
-- Type-specific metadata
combo_items TEXT,              -- JSON array of item names
combo_savings REAL,            -- Savings amount

valid_from TEXT,               -- Special validity start date
valid_until TEXT,              -- Special validity end date
days_available TEXT,           -- JSON array of days

variant_name TEXT,             -- Variant descriptor
parent_item_id TEXT,           -- Parent item reference

-- Sync tracking
needs_sync INTEGER DEFAULT 1,  -- 1 = needs sync to D1, 0 = synced
created_at TEXT,
updated_at TEXT
```

## API Endpoints

### New Endpoint: `POST /api/admin/menu/parse-from-r2`
**Purpose**: Parse menu with AI without saving to D1

**Request**:
```json
{
  "tenantId": "coorg-food-company-6163",
  "r2Key": "coorg-food-company-6163/uploads/menu-2024-01-22.pdf",
  "filename": "menu.pdf",
  "mimeType": "application/pdf"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Parsed 45 items successfully",
  "items": [
    {
      "name": "Chicken Biryani",
      "description": "Aromatic rice with spiced chicken",
      "category": "Main Course",
      "price": 350,
      "dietary": ["non-veg"],
      "type": "non-veg",
      "spiceLevel": "medium",
      "preparationTime": 25,
      "allergens": ["dairy"],
      "tags": ["popular"],

      "aiConfidence": 0.95,
      "suggestedType": "regular",
      "warnings": []
    },
    {
      "name": "Lunch Combo",
      "description": "Dal, Rice, 2 Rotis, Salad",
      "category": "Combos",
      "price": 200,
      "dietary": ["vegetarian"],
      "type": "veg",

      "aiConfidence": 0.88,
      "suggestedType": "combo",
      "suggestedComboItems": ["Dal", "Rice", "Roti (2 pcs)", "Salad"],
      "warnings": []
    }
  ],
  "summary": {
    "total": 45,
    "byType": {
      "regular": 35,
      "combo": 5,
      "special": 3,
      "variant": 2,
      "addon": 0
    },
    "withWarnings": 8
  }
}
```

## Local Database Functions

### New Functions in `database.ts`:

```typescript
// Save category to SQLite
async function saveMenuCategory(category: {
  id?: string;
  name: string;
  description?: string;
  sort_order?: number;
  active?: boolean;
}): Promise<string>

// Save single item to SQLite
async function saveMenuItem(
  item: Partial<MenuItem> & { name: string; price: number }
): Promise<string>

// Batch save items (more efficient)
async function batchSaveMenuItems(
  items: (Partial<MenuItem> & { name: string; price: number })[]
): Promise<string[]>

// Get items that need D1 sync
async function getItemsNeedingSync(): Promise<MenuItem[]>

// Mark items as synced
async function markItemsAsSynced(itemIds: string[]): Promise<void>
```

## Gemini AI Prompt Enhancement

The AI prompt now includes:

1. **Structured Analysis Requirements**:
   - Basic information (name, price, category, etc.)
   - Dietary & allergen tags
   - **AI confidence scoring** (0.0 to 1.0)
   - **Item type classification** (regular, combo, special, variant, addon)
   - **Contextual suggestions** (combo items, validity periods)
   - **Warning detection** (missing data, ambiguities)

2. **Classification Keywords**:
   - Combo: combo, meal, bundle, set, platter, thali, family pack
   - Special: special, today, daily, chef, seasonal, limited
   - Variant: small, medium, large, regular, mini, jumbo, half, full
   - Addon: extra, add-on, side, topping

3. **Response Format**:
   ```json
   {
     "aiConfidence": 0.95,
     "suggestedType": "combo",
     "suggestedComboItems": ["Item 1", "Item 2"],
     "suggestedValidityPeriod": "Weekdays only",
     "warnings": ["missing_dietary_info"]
   }
   ```

## Files Created/Modified

### New Files:
1. **`src/components/admin/MenuItemReview.tsx`** (550+ lines)
   - Interactive review modal component
   - Item classification and editing
   - Type-specific configuration forms
   - Search, filter, and statistics

2. **`client/restaurant-client/app/api/admin/menu/parse-from-r2/route.ts`** (280+ lines)
   - Parse-only endpoint (no D1 save)
   - Enhanced Gemini AI prompting
   - AI confidence and classification

### Modified Files:
1. **`src/lib/database.ts`**
   - Added `saveMenuCategory()`
   - Added `saveMenuItem()`
   - Added `batchSaveMenuItems()`
   - Added `getItemsNeedingSync()`
   - Added `markItemsAsSynced()`

2. **`src/lib/r2Uploader.ts`**
   - Changed `processFileFromR2()` to `parseFileFromR2()`
   - Returns parsed items without D1 save

3. **`src/lib/backendApi.ts`**
   - Added `uploadToR2Only()` - upload without parsing
   - Added `parseFromR2()` - parse without D1 save
   - Modified `uploadViaR2()` - marked as legacy for web client

4. **`src/components/admin/ExcelUploader.tsx`**
   - Integrated review modal
   - Changed flow: upload → parse → review → save to SQLite
   - Added confirmation handler
   - Added SQLite save with type-specific metadata

## Usage Example

### 1. User uploads menu PDF:
```typescript
// ExcelUploader automatically:
// - Uploads to R2 with progress tracking
// - Calls AI parsing (Gemini)
// - Opens review modal
```

### 2. User reviews items in modal:
```typescript
// User can:
// - Search for "biryani"
// - Filter by "combo" type only
// - Edit item name, price, description
// - Configure combo items: ["Rice", "Curry", "Raita"]
// - Set combo savings: ₹50
// - Mark special as valid Mon-Fri only
// - Delete unwanted items
// - Confirm items one-by-one or all at once
```

### 3. User confirms 40 items:
```typescript
// System automatically:
// - Saves to local SQLite with needs_sync=1
// - Uploads to File Search for voice ordering
// - Triggers background sync to D1
// - Shows items in POS menu immediately
```

## Benefits

1. **Quality Control**: Users review and correct AI extractions before saving
2. **Flexibility**: Handle complex menu structures (combos, specials, variants)
3. **Offline-First**: Save to SQLite immediately for offline POS operation
4. **Sync Later**: Background sync to D1 when connection available
5. **Voice Ordering**: File Search upload enables voice-based ordering
6. **Error Prevention**: Warnings help catch missing or incorrect data
7. **Bulk Efficiency**: Process and review many items at once
8. **Type Safety**: Proper classification ensures correct menu behavior

## Future Enhancements

1. **Auto-linking variants** to parent items by name similarity
2. **Duplicate detection** across existing menu items
3. **Price validation** against historical data or category averages
4. **Image AI** to suggest item images from uploaded photos
5. **Combo price optimization** to suggest ideal pricing with savings
6. **Special scheduling** with automatic enable/disable based on dates
7. **Bulk operations** (confirm all, edit multiple, apply tags to group)
8. **Sync status indicator** showing which items are synced to D1

## Testing Checklist

- [ ] Upload PDF menu → verify parsing quality
- [ ] Upload Excel menu → verify all fields extracted
- [ ] Upload image menu → verify OCR + AI extraction
- [ ] Review modal → search functionality
- [ ] Review modal → filter by type
- [ ] Review modal → warnings-only view
- [ ] Edit item → name, price, description
- [ ] Configure combo → items + savings
- [ ] Configure special → dates + days
- [ ] Configure variant → parent + variant name
- [ ] Confirm single item → saves to SQLite
- [ ] Confirm all items → batch save to SQLite
- [ ] Delete item → removes from list
- [ ] Cancel review → clears state
- [ ] Verify SQLite save → check `needs_sync = 1`
- [ ] Verify D1 sync → check sync engine picks up items
- [ ] Verify File Search upload → voice ordering works
- [ ] Offline mode → items available without internet

## Performance Considerations

- **Batch saves**: Use `batchSaveMenuItems()` for 100+ items
- **Large files**: R2 chunked upload supports up to 100MB
- **AI parsing**: ~2-5 seconds per page (PDF)
- **Review rendering**: Virtualized list for 500+ items
- **SQLite writes**: Transaction-based for consistency
- **Background sync**: Non-blocking, retry on failure

## Error Handling

1. **Upload failure**: Retry with exponential backoff
2. **AI parsing failure**: Fallback to template-based upload
3. **SQLite save failure**: Roll back transaction, show error
4. **D1 sync failure**: Queue for retry, show sync status
5. **File Search failure**: Non-critical, log warning

## Security

- Admin authentication required (`admin_access_token` cookie)
- Tenant isolation (R2 keys include tenant ID)
- File size limits (100MB for R2, 10MB for direct upload)
- Gemini API key protected in environment variables
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize user inputs)

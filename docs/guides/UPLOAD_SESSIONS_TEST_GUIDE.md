# Upload Sessions Test Guide

## Overview
The Upload Sessions feature enables multi-page menu uploads with staging and review before committing to the database. This prevents destructive uploads when handling multiple menu pages.

## What Was Implemented

### 1. Database Schema (`025_menu_upload_sessions.sql`)
Three new tables for session management:
- `menu_upload_sessions` - Tracks upload session metadata
- `menu_items_staging` - Temporary storage for uploaded items
- `menu_upload_pages` - Individual page tracking with status

### 2. Database Functions ([src/lib/database.ts](src/lib/database.ts))
Session management functions:
- `startUploadSession(menuType)` - Initialize new upload session
- `addUploadPage(sessionId, pageNumber, fileName)` - Add page to session
- `addStagingItems(sessionId, pageNumber, items)` - Store parsed items
- `commitUploadSession(sessionId)` - Atomic commit with transaction
- `cancelUploadSession(sessionId)` - Clean up cancelled sessions
- `deleteSessionPage(pageId)` - Remove individual pages

### 3. UI Components
- [MenuUploadSession.tsx](src/components/admin/MenuUploadSession.tsx) - Session upload interface
- Updated [MenuOnboarding.tsx](src/components/admin/MenuOnboarding.tsx) - Menu type selection and routing

## Testing Workflow

### Prerequisites
1. Ensure database migration 025 is applied (it will auto-apply from R2 on next app start)
2. Have multiple menu images/PDFs ready for testing
3. Tenant ID should be auto-detected (check with `diagnose-stores.html`)

### Test Steps

#### 1. Start Fresh Upload Session
1. Open the app and navigate to Menu Management
2. Click **"Create New Menu"** button
3. You should see a new screen: **"Choose Menu Type"**
4. Two cards should appear:
   - 🍴 **Food Menu** (orange)
   - 🍷 **Bar Menu** (purple)

#### 2. Select Menu Type
1. Click on **"Food Menu"**
2. You should be taken to the Upload Session screen
3. Verify header shows: "Upload Food Menu"
4. Verify subtitle: "Upload multiple pages, then review and commit all at once"

#### 3. Upload Multiple Pages
1. **Upload Page 1:**
   - Drag and drop or click to upload first menu image/PDF
   - Wait for parsing to complete
   - Verify page appears in "Uploaded Pages" list
   - Check: "Page 1 • [filename] • X items ✓ Parsed"

2. **Upload Page 2:**
   - Upload second menu image/PDF
   - Verify it appears as "Page 2"
   - Check item count increases

3. **Upload Page 3:**
   - Upload third menu image/PDF
   - Verify session summary shows "3 Pages Uploaded"

#### 4. Delete a Page (Optional)
1. Click the trash icon on Page 2
2. Confirm deletion
3. Verify:
   - Page 2 is removed
   - Total pages count decreases
   - Total items count updates

#### 5. Review Items
1. Click **"Review All X Items"** button
2. Verify review screen shows:
   - Header: "Review Food Menu"
   - Summary: "X items from 3 pages"
   - Items grouped by category
   - Each item shows: name, price, description, page number

3. Check categories are properly organized
4. Verify all uploaded items are present

#### 6. Commit Upload
1. Click **"Commit X Items"** button
2. Wait for commit transaction to complete
3. Verify success message: "Successfully uploaded X items!"
4. Should return to Menu Management main screen
5. Verify menu items appear in the Items tab

#### 7. Verify Database
1. Check that staging tables are cleaned up:
   ```sql
   SELECT * FROM menu_upload_sessions WHERE status = 'committed';
   SELECT * FROM menu_items_staging; -- Should be empty
   SELECT * FROM menu_upload_pages; -- Should be empty
   ```

2. Check production tables have the data:
   ```sql
   SELECT COUNT(*) FROM menu_items;
   SELECT COUNT(*) FROM menu_categories;
   ```

#### 8. Test Cancellation
1. Start a new upload session
2. Upload 1-2 pages
3. Click **"Cancel"** button
4. Confirm cancellation
5. Verify:
   - Returns to menu type selection
   - Session is cancelled in database
   - Staging tables are cleaned up

#### 9. Test Bar Menu Upload
1. Click "Create New Menu" again
2. Select **"Bar Menu"** (purple card)
3. Upload bar menu images
4. Verify the flow works identically
5. Check that `menu_type = 'bar'` in session

## Key Features to Verify

### ✅ Multi-Page Support
- Multiple uploads don't delete previous pages
- All pages accumulate in the session
- Page numbers are sequential

### ✅ Staging Before Commit
- Items are stored in `menu_items_staging` table
- Not visible in POS until commit
- Can review all items before finalizing

### ✅ Atomic Commits
- All items committed in single transaction
- Either all succeed or all rollback
- No partial uploads

### ✅ Category Handling
- Creates categories if they don't exist
- Deletes old items in matching categories
- Preserves categories from different menu types (food vs bar)

### ✅ Session Cleanup
- Staging tables cleared after commit
- Cancelled sessions clean up properly
- No orphaned data

## Error Scenarios to Test

### Network Failures
1. Disconnect network during upload
2. Verify error message appears
3. Session should remain in "in_progress" state
4. Can retry upload

### Invalid Files
1. Upload a non-menu file (random image)
2. Verify parsing fails gracefully
3. Page status should show "error"
4. Can delete the error page and continue

### Duplicate Uploads
1. Upload same menu page twice
2. Verify both pages are added (no deduplication at session level)
3. Commit should handle duplicates via UPSERT

## Database Migration Deployment

The migration `025_menu_upload_sessions.sql` is loaded dynamically from R2. To deploy:

```bash
# Deploy migration to R2
./deploy-migration.sh 025_menu_upload_sessions.sql

# Or deploy all migrations
./deploy-all-migrations.sh
```

The app will automatically fetch and apply the migration on next startup.

## Troubleshooting

### Migration Not Applied
```bash
# Check migration history
SELECT * FROM migration_history ORDER BY applied_at DESC;

# Manually apply if needed
./deploy-migration.sh 025_menu_upload_sessions.sql
```

### Tenant ID Not Found
```bash
# Open diagnostic page
open diagnose-stores.html

# Or check auto-detect
open auto-detect-tenant.html
```

### Staging Tables Not Cleaned
```sql
-- Manually clean up if needed
DELETE FROM menu_items_staging;
DELETE FROM menu_upload_pages;
UPDATE menu_upload_sessions SET status = 'cancelled' WHERE status = 'in_progress';
```

## Architecture Benefits

1. **Non-Destructive Uploads** - Multiple pages accumulate instead of replacing
2. **Review Before Commit** - See all items before finalizing
3. **Transaction Safety** - Atomic commits prevent partial uploads
4. **Type Separation** - Food and bar menus managed separately
5. **Page Tracking** - Know which items came from which page
6. **Cancellation Support** - Abort without database changes

## Next Steps

After successful testing:
1. Test with real restaurant menu images
2. Test with different file formats (Excel, PDF, images)
3. Test with 10+ pages to verify performance
4. Test concurrent sessions (if applicable)
5. Test sync to cloud after commit

## Success Criteria

- ✅ Can upload multiple pages in one session
- ✅ Review screen shows all items grouped by category
- ✅ Commit adds all items to production tables
- ✅ Staging tables are cleaned up after commit
- ✅ Can cancel session without affecting database
- ✅ Food and bar menus are separate
- ✅ No data loss during upload process

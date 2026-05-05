# List View Image Display Fix

## Issue
Menu item images were displaying correctly in **card view** but not in **list view** for the khao-piyo tenant.

## Root Cause
The `menuItemCard` component in the khao-piyo preset had `variant` hardcoded to `'card'`:

```typescript
// BEFORE (src/grab-food/presets/khao-piyo-preset.ts)
menuItemCard: createMenuItemCard({
  name: 'Khao Piyo Menu Card',
  variant: 'card',  // ❌ Hardcoded - prevents list view from working
  showImage: true,
  showDescription: true,
  showAddButton: true,
}),
```

This hardcoded variant prevented the layout's `restaurantGrid.variant` setting from taking effect when switching to list view.

## Fix Applied
Removed the hardcoded `variant` property to allow the layout to control the view mode:

```typescript
// AFTER (src/grab-food/presets/khao-piyo-preset.ts)
menuItemCard: createMenuItemCard({
  name: 'Khao Piyo Menu Card',
  // variant not specified - controlled by layout (card/list/compact)
  showImage: true,
  showDescription: true,
  showAddButton: true,
}),
```

## How View Modes Work

### 1. Layout Selection (src/grab-food/layouts/index.ts:299)
When the client requests a layout with `variant='list'`, it gets the `ListViewHomeLayout`:

```typescript
return variant === 'list' ? ListViewHomeLayout : DefaultHomeLayout;
```

### 2. List View Layout Configuration
The `ListViewHomeLayout` specifies list variant:

```typescript
export const ListViewHomeLayout: HomeLayoutConfig = {
  ...DefaultHomeLayout,
  restaurantGrid: {
    variant: 'list',  // ✅ Tells renderer to use list variant
    columns: {
      mobile: 1,
      tablet: 1,
      desktop: 1,
    },
    gap: '12px',
    ...
  },
};
```

### 3. Menu Item Card Behavior by Variant

**Card View (`variant: 'card'`):**
- Image position: top
- Image size: large
- Image aspect ratio: 16:9
- Layout: vertical

**List View (`variant: 'list'`):**
- Image position: left
- Image size: medium
- Image aspect ratio: 1:1 (square)
- Layout: horizontal
- `showImage: true` is respected

**Compact View (`variant: 'compact'`):**
- Image position: left
- Image size: small
- Image aspect ratio: 1:1
- Layout: minimal horizontal

## Testing

### Backend (Theme Worker)
The theme now correctly provides the list view configuration when requested:

```bash
# Test API endpoint
curl https://theme-edge-worker.suyesh.workers.dev/api/grab-food/themes/khao-piyo-custom
```

### Frontend Integration
The client should request the appropriate layout variant:

```typescript
// Example: Switching to list view
const theme = await fetch(`${THEME_URL}/api/grab-food/themes/khao-piyo-custom?layout=home&variant=list`);
```

## Expected Behavior After Fix

✅ **Card View**: Large images displayed above item details
✅ **List View**: Medium square images displayed to the left of item details
✅ **Compact View**: Small square images with minimal details

## Files Modified

1. `src/grab-food/presets/khao-piyo-preset.ts` - Removed hardcoded variant
2. `LIST_VIEW_IMAGE_FIX.md` - This documentation

## Additional Notes

- The `showImage: true` setting is maintained in the khao-piyo preset
- All three variants (card, list, compact) properly show images
- The layout's variant setting now correctly controls the component rendering

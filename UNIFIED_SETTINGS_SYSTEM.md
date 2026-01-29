# Unified Settings System

## Overview

The restaurant POS app now features a unified settings interface inspired by modern OS settings apps (macOS System Settings, Windows Settings). This replaces the previous modal-based settings approach with a full-screen, categorized navigation system.

## Architecture

### Components

#### **SettingsApp.tsx** (Main Component)
**Location:** `src/pages-v2/SettingsApp.tsx`

**Structure:**
- **Left Sidebar (280px)**: Category navigation with collapsible nested lists
- **Right Panel**: Active setting content displayed inline

**Features:**
- URL-based routing (`/settings?setting=restaurant-details`)
- Smooth animations using Framer Motion
- Categorized settings with icons and descriptions
- Search-ready (search terms defined for each setting)
- Back to Hub navigation
- Logout button in sidebar footer

### Settings Categories

The app organizes settings into **8 main categories**:

#### 1. **Business Setup** 🏪
- Restaurant Details (name, address, GST, FSSAI)
- Chain Management (multi-location, franchises)

#### 2. **Menu & Products** 🍽️
- Menu Management (categories, items, pricing)
- Specials & Promotions
- Dine-in Pricing
- Menu Images (photo uploads)

#### 3. **Operations** 📐
- Floor Plan & Tables
- QR Code Ordering (customer self-service)

#### 4. **Inventory** 📦
- Stock Management (inventory, suppliers, purchase orders)
- Bar Inventory (liquor, recipes, bar closing)

#### 5. **People & Payroll** 👥
- Staff Management (add staff, roles, PINs)
- Attendance Tracking (clock in/out)
- Weekly Roster (shift planning)
- Leave Management
- Payroll & Advances (salary, payslips)
- Customer Management (CRM, loyalty)

#### 6. **Hardware & Printing** 🖨️
- Printer Configuration (KOT, bill, receipt printers)
- Device Settings (POS terminals)

#### 7. **System & Cloud** ☁️
- Cloud Sync (Cloudflare D1, R2, KV)
- Database Migrations (schema updates)
- D1 Provisioning
- Training Mode (demo/sandbox)

#### 8. **Billing & Support** 💳
- Billing History (subscription, payments)
- Help & Support (FAQs, contact)

---

## File Changes

### New Files Created

1. **`src/pages-v2/SettingsApp.tsx`** (700+ lines)
   - Main unified settings component
   - Left sidebar navigation
   - Right panel content area
   - URL-based routing
   - Categorized settings with nested lists

### Modified Files

1. **`src/App.tsx`**
   - Added import: `import SettingsApp from './pages-v2/SettingsApp';`
   - Updated route `/settings` to use `SettingsApp` instead of `SettingsPage`
   - Kept legacy route `/settings-old` for migration period
   - Added OWNER role to allowed roles for settings

2. **`src/pages-v2/HubPage.tsx`**
   - Updated "Restaurant Setup" card path from `/restaurant-setup` to `/settings?setting=restaurant-details`
   - Now directly opens restaurant details in unified settings app

---

## Usage

### Navigation

**From Hub Page:**
1. Click "Settings" card → Opens unified settings app
2. Click "Restaurant Setup" card → Opens restaurant details directly

**From Settings App:**
1. Click category to expand/collapse
2. Click setting item to view in right panel
3. Changes to URL params automatically (`?setting=<id>`)
4. Back button returns to hub

**URL Structure:**
```
/settings?setting=restaurant-details
/settings?setting=menu-onboarding
/settings?setting=staff-management
```

### Deep Linking

You can link directly to any setting from anywhere in the app:

```tsx
// Navigate to staff management
navigate('/settings?setting=staff-management');

// Navigate to chain management
navigate('/settings?setting=chain-management');

// Navigate to menu
navigate('/settings?setting=menu-onboarding');
```

### Expanding Categories Programmatically

The left sidebar automatically expands categories that contain the active setting. You can also pre-expand categories by modifying the initial state in `SettingsApp.tsx`:

```tsx
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
  new Set(['business', 'menu-products']) // Expand multiple categories
);
```

---

## Benefits

### 1. **Consistent UX**
- Familiar OS-like settings interface
- No modal interruptions
- Smooth navigation between settings
- URL-based routing (shareable links, bookmarkable)

### 2. **Better Organization**
- Logical categorization
- Visual hierarchy with icons
- Descriptions for each setting
- Nested navigation for related settings

### 3. **Scalability**
- Easy to add new settings
- Simple category structure
- Component-based architecture
- Search-ready (search terms defined)

### 4. **Developer Experience**
- Clean component separation
- No modal prop drilling
- Easy to maintain
- TypeScript typed interfaces

---

## Migration from Old System

### Before (Modal-Based)
```tsx
// Old approach - Modal dialogs
<RestaurantSettings isOpen={isOpen} onClose={onClose} />

// Opened from various places with state management
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
<button onClick={() => setIsSettingsOpen(true)}>Settings</button>
```

### After (Unified Settings)
```tsx
// New approach - Navigate to settings app
navigate('/settings?setting=restaurant-details');

// Or use direct link
<Link to="/settings?setting=restaurant-details">Restaurant Details</Link>
```

### Legacy Support

The old `SettingsPage` is still available at `/settings-old` for backward compatibility. This will be removed in a future release after full migration testing.

---

## Adding New Settings

To add a new setting to the unified settings app:

### 1. Create the Setting Component (if needed)

```tsx
// src/components/admin/MyNewSetting.tsx
export function MyNewSetting() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-4">My New Setting</h2>
      {/* Your setting UI */}
    </div>
  );
}
```

### 2. Import in SettingsApp.tsx

```tsx
import { MyNewSetting } from '../components/admin/MyNewSetting';
```

### 3. Add to Settings Categories

```tsx
{
  id: 'my-category',
  label: 'My Category',
  icon: Wrench,
  description: 'Category description',
  items: [
    {
      id: 'my-new-setting',
      label: 'My New Setting',
      description: 'What this setting does',
      icon: Settings,
      component: MyNewSetting,
      searchTerms: ['my', 'new', 'setting', 'keywords'],
    },
  ],
}
```

### 4. Link to It

```tsx
navigate('/settings?setting=my-new-setting');
```

---

## Component Props

### SettingsApp

**Props:** None (reads from URL params)

**Internal State:**
- `activeSetting`: Current setting ID from URL
- `expandedCategories`: Set of expanded category IDs
- `searchParams`: React Router search params

### Setting Components

All setting components should accept minimal or no props. They should:
- Use Zustand stores for data
- Handle their own state management
- Provide inline save/cancel actions
- Display in the right panel (full height, scrollable)

**Example:**
```tsx
export function MySetting() {
  const { settings, updateSettings } = useMyStore();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">
        My Setting Title
      </h2>
      <div className="max-w-4xl">
        {/* Setting UI */}
      </div>
    </div>
  );
}
```

---

## Styling Guidelines

### Colors
- Background: `bg-zinc-950` (main background)
- Sidebar: `bg-zinc-900` (darker)
- Borders: `border-white/10`
- Active: `bg-orange-500` (accent)
- Text: `text-white`, `text-zinc-400`, `text-zinc-500`

### Layout
- Left sidebar: Fixed `280px` width
- Right panel: `flex-1` (remaining space)
- Setting content: Padding `p-8`, max-width `max-w-4xl` for forms

### Animations
- Category expand/collapse: Framer Motion with `height: 'auto'`
- Setting switch: Fade in/out with `opacity` and `y` translation
- Duration: `0.2s` for quick, responsive feel

---

## Known Limitations

1. **Search Not Implemented Yet**
   - Search terms are defined but search UI is not built
   - Planned for future enhancement

2. **Mobile Responsive Improvements Needed**
   - Current design optimized for desktop/tablet
   - Mobile view may need collapsible sidebar

3. **Settings State Persistence**
   - Active setting and expanded categories reset on page reload
   - Consider localStorage for persistence

---

## Future Enhancements

1. **Search Functionality**
   - Search bar in sidebar header
   - Filter settings by search terms
   - Highlight matching categories

2. **Keyboard Shortcuts**
   - Cmd+K / Ctrl+K for search
   - Arrow keys for navigation
   - Escape to return to hub

3. **Settings Sync Indicator**
   - Show sync status for cloud settings
   - Loading states during save
   - Error handling with retry

4. **Recent Settings**
   - Track recently viewed settings
   - Quick access section in sidebar

5. **Favorites/Pinned Settings**
   - Allow users to pin frequently used settings
   - Show pinned section at top of sidebar

---

## Testing

### Manual Testing Checklist

- [ ] Navigate to `/settings` from hub
- [ ] Click each category to expand/collapse
- [ ] Click each setting item to view in right panel
- [ ] Verify URL updates with setting ID
- [ ] Test back button navigation
- [ ] Test direct URL access (e.g., `/settings?setting=menu-onboarding`)
- [ ] Test logout button
- [ ] Verify all setting components render correctly
- [ ] Test on different screen sizes
- [ ] Check TypeScript compilation (`bunx tsc --noEmit`)

### Automated Testing (TODO)

```tsx
// Example test for SettingsApp
describe('SettingsApp', () => {
  it('should render categories and items', () => {
    render(<SettingsApp />);
    expect(screen.getByText('Business Setup')).toBeInTheDocument();
    expect(screen.getByText('Menu & Products')).toBeInTheDocument();
  });

  it('should update URL when setting is selected', () => {
    const { navigate } = render(<SettingsApp />);
    fireEvent.click(screen.getByText('Restaurant Details'));
    expect(navigate).toHaveBeenCalledWith('/settings?setting=restaurant-details');
  });
});
```

---

## Troubleshooting

### Issue: Setting component not rendering

**Solution:**
1. Check import statement in `SettingsApp.tsx`
2. Verify component export (default vs named export)
3. Check TypeScript errors with `bunx tsc --noEmit`

### Issue: Category not expanding

**Solution:**
1. Verify category ID matches in `expandedCategories` state
2. Check `AnimatePresence` is not blocking animation
3. Ensure `isExpanded` boolean is calculated correctly

### Issue: URL not updating

**Solution:**
1. Check `useSearchParams` hook is imported from `react-router-dom`
2. Verify `setSearchParams` is called in `useEffect`
3. Ensure `activeSetting` state is updated correctly

---

## Support

For issues or questions about the unified settings system:

1. Check this documentation first
2. Review the code in `src/pages-v2/SettingsApp.tsx`
3. Test with TypeScript compiler: `bunx tsc --noEmit`
4. Check browser console for React warnings

---

## Summary

The unified settings system provides a modern, scalable, and user-friendly interface for managing all restaurant POS settings. It replaces fragmented modal dialogs with a centralized, OS-like settings app that users will find familiar and intuitive.

**Key Files:**
- `src/pages-v2/SettingsApp.tsx` - Main settings app
- `src/App.tsx` - Route configuration
- `src/pages-v2/HubPage.tsx` - Entry points from hub

**Routes:**
- `/settings` - Unified settings app (new)
- `/settings-old` - Legacy settings page (deprecated)
- `/restaurant-setup` - Redirects to restaurant details

**Benefits:**
✅ No more modal interruptions
✅ Organized categorization
✅ URL-based deep linking
✅ Scalable architecture
✅ Modern UX patterns

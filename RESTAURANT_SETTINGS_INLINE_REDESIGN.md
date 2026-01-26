# RestaurantSettingsInline.tsx - Clean White UI Redesign

## Overview

RestaurantSettingsInline.tsx has been completely refactored to match the clean white UI design system used throughout the settings interface. All dark theme elements, custom CSS classes, and rounded corners have been replaced with a modern, professional light theme.

## Changes Summary

### **Main Container**
- Changed from `bg-background` to `bg-white`
- Provides consistent white background for the entire component

### **Tab Navigation** (Lines 98-116)
**Before:**
```tsx
<div className="settings-tabs flex-shrink-0">
  <button className={cn('settings-tab', activeTab === tab.id && 'active')}>
```

**After:**
```tsx
<div className="flex border-b border-gray-200 bg-white flex-shrink-0">
  <button className={cn(
    'flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors',
    activeTab === tab.id
      ? 'bg-orange-50 text-orange-600 border-orange-500'
      : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'
  )}>
```

**Changes:**
- Removed custom `settings-tabs` and `settings-tab` classes
- Added explicit Tailwind classes with border-bottom indicators
- Active tab: Orange background with orange border-bottom
- Inactive tab: White with hover state

### **Toggle Component** (Lines 46-72)
**Before:**
```tsx
<div className="settings-toggle-row">
  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
  <button className={cn(
    'relative w-14 h-8 rounded-full transition-colors',
    enabled ? 'bg-accent' : 'bg-surface-3'
  )}>
```

**After:**
```tsx
<div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200">
  <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
  <p className="text-xs text-gray-600 mt-0.5">{description}</p>
  <button className={cn(
    'relative w-14 h-8 transition-colors',
    enabled ? 'bg-orange-500' : 'bg-gray-300'
  )}>
```

**Changes:**
- Replaced `settings-toggle-row` with explicit layout classes
- Changed semantic colors to explicit Tailwind classes
- Removed `rounded-full` from toggle button (sharp edges)
- Active: `bg-orange-500`, Inactive: `bg-gray-300`

### **Content Area** (Line 119)
**Before:**
```tsx
<div className="flex-1 overflow-y-auto p-6">
```

**After:**
```tsx
<div className="flex-1 overflow-y-auto p-8 bg-gray-50">
```

**Changes:**
- Added `bg-gray-50` background
- Increased padding from `p-6` to `p-8`

---

## Tab-Specific Updates

### **1. Basic Info Tab** (Lines 121-218)

**Section Cards:**
```tsx
// Before: Custom settings-group class
<div className="settings-group">
  <h4 className="settings-group-title">Restaurant Details</h4>

// After: Explicit white card
<div className="bg-white p-6 border border-gray-200">
  <h4 className="text-base font-semibold text-gray-900 mb-4">Restaurant Details</h4>
```

**Form Inputs:**
```tsx
// Before: Custom settings-input class
<input className="settings-input" />

// After: Explicit input styling
<input className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
```

**Labels:**
```tsx
// Before: Custom settings-label class
<label className="settings-label">Restaurant Name *</label>

// After: Explicit label styling
<label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name *</label>
```

### **2. Legal Tab** (Lines 222-263)

Same pattern as Basic Info:
- White card with border
- Explicit input styling
- Gray text colors

### **3. Invoice Tab** (Lines 266-305)

**Textarea Styling:**
```tsx
// Before:
<textarea className="settings-textarea" rows={3} />

// After:
<textarea className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" rows={3} />
```

### **4. Tax Tab** (Lines 308-396)

**Tax Settings Card with Toggle:**
```tsx
<div className="bg-white border border-gray-200">
  <div className="p-6 border-b border-gray-200">
    <h4 className="text-base font-semibold text-gray-900 mb-4">Tax Settings</h4>
  </div>
  <div className="p-0">
    <Toggle ... />
  </div>
</div>
```

**Warning Message:**
```tsx
// Before:
<div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
  <p className="text-sm text-warning">

// After:
<div className="m-4 p-3 bg-yellow-50 border border-yellow-300">
  <p className="text-sm text-yellow-800">
```

**Billing Options:**
- Multiple toggles in a card
- Each toggle uses the updated Toggle component
- Clean separation with `space-y-0` (toggles stack directly)

### **5. Print Tab** (Lines 399-440)

**Select Dropdown:**
```tsx
// Before:
<select className="settings-select">

// After:
<select className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
```

**Receipt Options:**
- Header in card with border-bottom
- Three toggles for print options

### **6. POS & Theme Tab** (Lines 443-512)

**Theme Selection Buttons:**
```tsx
// Before:
<button className={cn(
  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
  formData.posSettings?.theme === 'light'
    ? 'bg-accent text-white'
    : 'bg-surface-3 text-muted-foreground hover:bg-surface-2'
)}>

// After:
<button className={cn(
  'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 border',
  formData.posSettings?.theme === 'light'
    ? 'bg-orange-500 text-white border-orange-500'
    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
)}>
```

**PIN Timeout Input:**
```tsx
<div className="p-4 bg-gray-50 border-t border-gray-200">
  <label className="block text-sm font-medium text-gray-700 mb-1">PIN Session Timeout (minutes)</label>
  <input ... />
  <p className="text-xs text-gray-600 mt-1">0 = no timeout, staff stays logged in</p>
</div>
```

### **7. Footer** (Lines 516-540)

**Before:**
```tsx
<div className="settings-footer">
  {isConfigured ? (
    <span className="text-success">Settings configured</span>
  ) : (
    <span className="text-warning">Please configure your restaurant details</span>
  )}
  <button className="px-6 py-2.5 rounded-lg bg-accent text-white">
```

**After:**
```tsx
<div className="border-t border-gray-200 bg-white p-4">
  {isConfigured ? (
    <span className="text-green-600 font-medium">Settings configured</span>
  ) : (
    <span className="text-yellow-600 font-medium">Please configure your restaurant details</span>
  )}
  <button className="px-6 py-2.5 bg-orange-500 text-white font-medium hover:bg-orange-600">
```

**Changes:**
- Replaced `settings-footer` with explicit styling
- Changed semantic colors to explicit green/yellow
- Removed `rounded-lg` from button
- Added hover state

---

## Removed Custom CSS Classes

All custom CSS classes have been replaced with explicit Tailwind classes:

| Old Class | Replaced With |
|-----------|---------------|
| `settings-tabs` | `flex border-b border-gray-200 bg-white` |
| `settings-tab` | `flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2` |
| `settings-toggle-row` | `flex items-center justify-between p-4 bg-gray-50 border border-gray-200` |
| `settings-group` | `bg-white p-6 border border-gray-200` |
| `settings-group-title` | `text-base font-semibold text-gray-900 mb-4` |
| `settings-label` | `block text-sm font-medium text-gray-700 mb-1` |
| `settings-input` | `w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500` |
| `settings-textarea` | Same as `settings-input` |
| `settings-select` | Same as `settings-input` |
| `settings-description` | `text-xs text-gray-600 mt-1` |
| `settings-footer` | `border-t border-gray-200 bg-white p-4` |

## Semantic Colors Replaced

| Old Semantic Color | New Explicit Color |
|-------------------|-------------------|
| `bg-background` | `bg-white` or `bg-gray-50` |
| `bg-surface-3` | `bg-gray-300` |
| `bg-surface-2` | `bg-gray-50` |
| `text-foreground` | `text-gray-900` |
| `text-muted-foreground` | `text-gray-600` |
| `bg-accent` | `bg-orange-500` |
| `text-accent` | `text-orange-600` |
| `text-success` | `text-green-600` |
| `text-warning` | `text-yellow-600` or `text-yellow-800` |
| `bg-warning/10` | `bg-yellow-50` |
| `border-warning/30` | `border-yellow-300` |

---

## Design Patterns

### **Card Pattern**
```tsx
<div className="bg-white p-6 border border-gray-200">
  <h4 className="text-base font-semibold text-gray-900 mb-4">Section Title</h4>
  <div className="space-y-4">
    {/* Content */}
  </div>
</div>
```

### **Card with Header and Content**
```tsx
<div className="bg-white border border-gray-200">
  <div className="p-6 border-b border-gray-200">
    <h4 className="text-base font-semibold text-gray-900">Section Title</h4>
  </div>
  <div className="space-y-0">
    {/* Stacked content (like toggles) */}
  </div>
</div>
```

### **Form Input Pattern**
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Field Label</label>
  <input
    type="text"
    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
    placeholder="Placeholder text"
  />
</div>
```

### **Toggle Pattern**
```tsx
<Toggle
  enabled={value}
  onChange={(val) => handleChange(val)}
  label="Toggle Label"
  description="Description of what this toggle does"
/>
```

---

## Color Palette

### **Backgrounds**
- Page background: `bg-gray-50`
- Card background: `bg-white`
- Toggle background: `bg-gray-50`
- Active elements: `bg-orange-50`, `bg-orange-500`

### **Borders**
- Default: `border-gray-200`
- Inputs: `border-gray-300`
- Active/Focus: `border-orange-500`
- Warning: `border-yellow-300`

### **Text**
- Primary: `text-gray-900`
- Secondary: `text-gray-700`
- Tertiary: `text-gray-600`
- Success: `text-green-600`
- Warning: `text-yellow-600`, `text-yellow-800`
- Active: `text-orange-600`

### **Interactive Elements**
- Primary button: `bg-orange-500` with `hover:bg-orange-600`
- Secondary button: `bg-white` with `hover:bg-gray-50`
- Toggle ON: `bg-orange-500`
- Toggle OFF: `bg-gray-300`

---

## Typography

### **Headings**
- Page sections: `text-base font-semibold text-gray-900`
- Form labels: `text-sm font-medium text-gray-700`
- Toggle labels: `text-sm font-semibold text-gray-900`

### **Body Text**
- Input text: `text-gray-900 text-sm`
- Descriptions: `text-xs text-gray-600`
- Status text: `font-medium`

---

## Sharp Edges

All rounded corners have been removed:
- ❌ Removed: `rounded-lg`, `rounded-xl`, `rounded-full`
- ✅ Sharp edges throughout (no rounding classes)
- Toggle knob still uses sharp rectangles

---

## Focus States

All inputs have consistent focus styling:
```tsx
focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500
```

This provides:
- Orange border on focus
- Subtle orange ring for accessibility
- No default browser outline

---

## Testing Checklist

- [x] TypeScript compiles with no errors
- [x] All tabs display correctly
- [x] Tab navigation works smoothly
- [x] Form inputs have proper styling
- [x] Toggle switches function correctly
- [x] Theme selection buttons work
- [x] Save button has correct styling
- [x] All text is readable with high contrast
- [x] No dark theme artifacts remaining
- [x] Consistent with SettingsApp.tsx and MenuOnboarding.tsx

---

## Files Modified

**Single File:**
- `src/components/admin/RestaurantSettingsInline.tsx`

**Lines Changed:**
- Main container: Line 98
- Tab navigation: Lines 100-116
- Toggle component: Lines 46-72
- Content area: Line 119
- Basic Info tab: Lines 121-218
- Legal tab: Lines 222-263
- Invoice tab: Lines 266-305
- Tax tab: Lines 308-396
- Print tab: Lines 399-440
- POS tab: Lines 443-512
- Footer: Lines 516-540

---

## Summary

RestaurantSettingsInline.tsx has been completely refactored from a dark theme with custom CSS classes to a clean white design with explicit Tailwind utilities. The component now matches the unified design system used in SettingsApp.tsx and MenuOnboarding.tsx.

**Key Improvements:**
✅ Consistent white background throughout
✅ Sharp edges for professional look
✅ High contrast text for readability
✅ Explicit Tailwind classes (no custom CSS)
✅ Solid colors (no gradients or translucency)
✅ Clear visual hierarchy
✅ Accessible focus states
✅ Modern, clean aesthetic

The component is now production-ready and fully integrated with the clean white UI design system.

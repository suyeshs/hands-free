# Settings Hub UI Refactor - Card-Based Expandable Design

## Overview
Refactored the setup cards in the ContextualOnboarding component to start collapsed by default. Cards now expand smoothly when clicked and automatically scroll into view, keeping the form visible in the viewport.

## Changes Made

### File: `src/components/setup/SetupCardBase.tsx`

#### Key Improvements

1. **Cards Start Collapsed**
   - Changed initial state from `useState(!completed)` to `useState(false)`
   - All cards now start in collapsed state, showing only title and description
   - Creates a cleaner, more scannable interface

2. **Smooth Expansion Animation**
   - Cards expand to reveal the form when clicked
   - Existing animation preserved using framer-motion
   - Clear visual feedback with chevron rotation

3. **Auto-Scroll to Viewport**
   - Added `useRef` to track card element
   - Added `useEffect` to scroll card into view when expanded
   - Smooth scroll behavior with 100ms delay for animation completion
   - Uses `block: 'nearest'` to avoid unnecessary jumps

4. **Enhanced Visual Feedback**
   - Added "group" class to button for hover effects
   - Icon scales on hover (`group-hover:scale-110`)
   - "Click to expand" hint text below description (visible when collapsed)
   - Saffron-colored chevron for better visibility
   - Larger chevron icon (w-6 h-6) for better clickability

5. **Accessibility Improvements**
   - Added `aria-expanded` attribute
   - Added descriptive `aria-label` for screen readers
   - Rounded button corners for better touch targets

## User Experience Flow

### Before (Old Behavior)
- All incomplete cards shown expanded simultaneously
- Forms all visible at once, creating information overload
- User has to scroll past all forms to see what's needed

### After (New Behavior)
1. User sees clean list of collapsed cards showing:
   - Card title
   - Brief description
   - Status icon (amber alert for required, check for completed)
   - "Click to expand" hint

2. User clicks a card they want to complete:
   - Card smoothly expands
   - Form slides into view
   - Card automatically scrolls into optimal viewport position
   - User can focus on one task at a time

3. After completing a task:
   - Card collapses and shows green checkmark
   - Next incomplete card remains collapsed until clicked
   - Progress bar updates at the top

## Visual States

### Collapsed Card
```
┌─────────────────────────────────────────────────┐
│ [Icon] Complete Restaurant Information      ▼  │
│        Essential details for billing            │
│        Click to expand                          │
└─────────────────────────────────────────────────┘
```

### Expanded Card
```
┌─────────────────────────────────────────────────┐
│ [Icon] Complete Restaurant Information      ▲  │
│        Essential details for billing            │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Form Fields]                                  │
│  - Restaurant Name *                            │
│  - Phone Number *                               │
│  - Street Address *                             │
│  - City / State / Pincode                       │
│                                                 │
│  [Complete Setup] [Skip for Now]               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Completed Card (Collapsed & Dimmed)
```
┌─────────────────────────────────────────────────┐
│ [✓] Complete Restaurant Information            │
│     Restaurant details configured ✓             │
└─────────────────────────────────────────────────┘
```

## Technical Details

### Scroll Behavior
```typescript
useEffect(() => {
  if (isExpanded && cardRef.current) {
    // Wait for expand animation to complete before scrolling
    setTimeout(() => {
      cardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 100);
  }
}, [isExpanded]);
```

### Hover Effects
- Icon scales up 110% on hover
- Background lightens slightly (`hover:bg-white/5`)
- Chevron remains saffron-colored for consistency

## Benefits

1. **Less Overwhelming**: Users see a clean list instead of multiple open forms
2. **Better Focus**: Users complete one task at a time without distraction
3. **Improved Navigation**: Auto-scroll keeps the current task in view
4. **Clearer Progress**: Easy to see which tasks are done vs. remaining
5. **Mobile Friendly**: Less scrolling needed, easier to tap/click individual cards
6. **Reduced Cognitive Load**: Progressive disclosure pattern

## No Breaking Changes

- All existing props and functionality preserved
- Card completion logic unchanged
- Validation logic unchanged
- Parent components (ContextualOnboarding) require no modifications
- All setup cards (RestaurantBasicsCard, TaxBillingCard, etc.) work unchanged

## Testing Checklist

- [ ] Cards start collapsed on page load
- [ ] Clicking a card expands it smoothly
- [ ] Expanded card scrolls into viewport
- [ ] Form fields are accessible when expanded
- [ ] "Complete Setup" button works correctly
- [ ] Card collapses after completion
- [ ] Completed cards show green checkmark
- [ ] Hover effects work on incomplete cards
- [ ] Chevron rotates correctly
- [ ] Keyboard navigation works (tab, enter)
- [ ] Screen readers announce state changes
- [ ] Mobile touch interaction works smoothly

## Files Modified

1. `src/components/setup/SetupCardBase.tsx` - Main refactor
   - Added useState for collapsed state
   - Added useRef for DOM element tracking
   - Added useEffect for auto-scroll
   - Enhanced button styling and interactions
   - Added accessibility attributes

## Future Enhancements (Optional)

1. Add animation to "Click to expand" text (subtle pulse)
2. Remember last expanded card in session storage
3. Add keyboard shortcut to expand/collapse (e.g., Space key)
4. Add "Expand All" / "Collapse All" button in ContextualOnboarding
5. Add card-to-card navigation (Previous/Next buttons)
6. Add estimated time to complete per card

---

**Status**: ✅ Complete and ready for testing
**Impact**: UX improvement - no API or data changes
**Compatibility**: Full backward compatibility maintained

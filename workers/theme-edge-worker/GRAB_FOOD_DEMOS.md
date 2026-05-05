# Grab Food Theme - Demo Files

Interactive HTML demos for the Grab Food delivery theme, showcasing mobile-first design with menu items, order tracking, and restaurant details.

## 📱 Demo Files

### 1. [Home Screen](demo-grab-food-home.html)
**Mobile-first menu display with search and categories**

**Features:**
- 📍 Location-based header with delivery address
- 🔍 Search bar with voice activation
- 🎉 Promo carousel with auto-scroll
- 🏷️ Sticky category pills for filtering
- 🍽️ Menu item cards in grid layout (2 columns mobile, 3 tablet, 4 desktop)
- 🟢 Dietary indicators (vegetarian, vegan, gluten-free, spicy)
- ➕ Quick add-to-cart buttons
- 📊 Item metadata (prep time, calories)
- 🎤 Floating voice FAB
- 🏠 Fixed bottom navigation

**Use Cases:**
- Browse restaurant menu
- Filter by category
- Quick add items to cart
- Voice search activation

**How to Use:**
1. Open `demo-grab-food-home.html` in your browser
2. Click category pills to filter menu
3. Click + buttons to add items to cart
4. Try voice buttons for demo interaction
5. Hover over cards to see Grab green border effect

---

### 2. [Order Tracking](demo-grab-food-tracking.html)
**Real-time delivery tracking with driver info**

**Features:**
- 🗺️ Map view with driver location
- ⏱️ Live ETA countdown (updates every 5 seconds)
- 🏍️ Driver card with photo, rating, and contact options
- 📞 Call/chat buttons
- 📦 Stepped progress tracker with status updates
- ✅ Animated progress indicators
- 💰 Order summary with expandable details
- 🆘 Help button for support

**Use Cases:**
- Track active delivery
- Contact driver
- View order details
- Monitor delivery progress

**How to Use:**
1. Open `demo-grab-food-tracking.html` in your browser
2. Watch the ETA countdown (simulated, updates every 5s)
3. Click driver's call/chat buttons
4. Expand/collapse order details
5. Observe step transitions as delivery progresses

---

### 3. [Restaurant Menu](demo-grab-food-menu.html)
**Full menu display with categories and cart**

**Features:**
- 🖼️ Hero image header with overlay
- ⭐ Restaurant info with ratings and delivery time
- 🏷️ Sticky menu categories
- 📋 List-style menu items with images
- 🔥 Popular item badges
- ➕ Overlay add buttons on images
- 🎨 Customization modal (size, add-ons)
- 🛒 Floating cart with item count and total
- 💚 Grab green pulse animation on add

**Use Cases:**
- View full restaurant menu
- Customize orders
- Add items to cart
- Navigate categories
- Track order total

**How to Use:**
1. Open `demo-grab-food-menu.html` in your browser
2. Scroll through menu sections
3. Click + buttons on item images
4. Customize items in the modal (size, add-ons)
5. See cart update with totals
6. Click cart to view summary

---

## 🎨 Design System

### Colors
```css
--grab-green: #00B14F;        /* Primary brand color */
--grab-green-hover: #00983F;  /* Hover state */
--grab-orange: #ff6c31;       /* Accent/promos */
--grab-charcoal: #1f2937;     /* Text/dark elements */
--grab-light-gray: #f3f4f6;   /* Backgrounds */
```

### Typography
- **Font Family:** Inter, -apple-system, BlinkMacSystemFont
- **Sizes:** 12px (meta) → 32px (hero)
- **Weights:** 400 (normal), 600 (semibold), 700 (bold), 800 (extrabold)

### Spacing
- **Base Unit:** 8px
- **Touch Targets:** Minimum 44px (buttons, nav items)
- **Card Padding:** 12-20px
- **Section Spacing:** 16-24px

### Border Radius
- **Small:** 8-12px (buttons, badges)
- **Medium:** 16px (cards)
- **Large:** 24px (modals)
- **Circular:** 50% (icons, FABs)

### Shadows
```css
/* Subtle elevation */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

/* Prominent elevation */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

/* Floating elements */
box-shadow: 0 4px 16px rgba(0, 177, 79, 0.3);
```

---

## 🚀 Key Features

### Mobile-First Design
- Max container width: 428px (iPhone 14 Pro size)
- Optimized for touch interactions
- Responsive grid layouts
- Bottom navigation for thumb-friendly access

### Grab-Inspired UX
- **Flat design** with subtle shadows (not neumorphic)
- **Green primary color** throughout
- **App-like interface** with bottom nav
- **Quick actions** via FABs and overlay buttons
- **Real-time updates** with animations

### Dietary Indicators
- 🟢 Vegetarian
- 🌱 Vegan
- 🌾 Gluten-Free
- 🌶️ Spicy

### Interactive Elements
- Hover effects with scale/translate
- Active states with color changes
- Pulse animations on add-to-cart
- Smooth transitions (0.2s ease)
- Live countdown timers

### Accessibility
- WCAG AA contrast ratios
- Keyboard navigation support
- Touch targets ≥44px
- Screen reader friendly labels

---

## 📊 Component Showcase

### Menu Item Card
**Variants:** Card (grid), List (horizontal), Compact
```html
<div class="menu-item-card">
  <img class="menu-item-image" />
  <div class="menu-item-content">
    <div class="menu-item-name">Item Name</div>
    <div class="dietary-indicators">🟢 🌱</div>
    <div class="menu-item-description">Description</div>
    <div class="menu-item-meta">⏱️ 15 min • 🔥 450 cal</div>
    <div class="menu-item-footer">
      <div class="menu-item-price">$12.99</div>
      <div class="add-button">+</div>
    </div>
  </div>
</div>
```

### Order Tracker
**States:** Completed, In-Progress, Pending
```html
<div class="order-step in-progress">
  <div class="step-icon">🏍️</div>
  <div class="step-content">
    <div class="step-label">On the way</div>
    <div class="step-time">Arriving in 8 mins</div>
  </div>
</div>
```

### Bottom Navigation
**Items:** Home, Orders, Account, More
```html
<div class="bottom-nav">
  <div class="nav-item active">
    <div class="nav-icon">🏠</div>
    <div class="nav-label">Home</div>
  </div>
</div>
```

---

## 🔧 Customization Guide

### Changing Colors
Edit CSS custom properties in each demo:
```css
:root {
  --grab-green: #YOUR_PRIMARY_COLOR;
  --grab-orange: #YOUR_ACCENT_COLOR;
}
```

### Adjusting Layout
Modify grid columns for menu items:
```css
.menu-items {
  grid-template-columns: repeat(2, 1fr); /* 2 columns */
  /* Change to 3 for denser layout */
}
```

### Container Size
Change mobile container width:
```css
.mobile-container {
  max-width: 428px; /* iPhone 14 Pro */
  /* Try 390px for iPhone 12/13 */
  /* Try 393px for Pixel 5 */
}
```

---

## 📱 Testing Recommendations

### Devices to Test
- **iPhone 14 Pro:** 428x926px (primary target)
- **iPhone SE:** 375x667px (small screen)
- **Pixel 5:** 393x851px (Android)
- **iPad Mini:** 744x1133px (tablet)

### Browsers
- Safari (iOS)
- Chrome (Android)
- Chrome (Desktop)
- Firefox (Desktop)

### Test Cases
1. **Touch Targets:** Verify all buttons ≥44px
2. **Scroll Performance:** Test category pills, promo carousel
3. **Animations:** Ensure smooth 60fps transitions
4. **Cart Updates:** Test add/remove items
5. **Modal Interactions:** Test customization flow
6. **Timer Accuracy:** Verify ETA countdown

---

## 🎯 Integration Guide

### Using with API
Fetch menu data from the theme API:
```javascript
fetch('/api/grab-food/themes/grab-food-default')
  .then(res => res.json())
  .then(theme => {
    // Apply theme to your app
    applyTheme(theme.designTokens);
    renderComponents(theme.components);
  });
```

### React Example
```jsx
import { GrabFoodDefaultTheme } from './grab-food';

function MenuScreen() {
  const { designTokens, components } = GrabFoodDefaultTheme;

  return (
    <ThemeProvider theme={designTokens}>
      <MenuItemCard {...components.menuItemCard} />
    </ThemeProvider>
  );
}
```

### CSS Variables Integration
```javascript
// Apply Grab Food colors to your app
const tokens = GrabFoodDefaultTheme.designTokens;
document.documentElement.style.setProperty(
  '--primary-color',
  tokens.colors.primary['500']
);
```

---

## 📝 Notes

### Performance
- All demos use inline images (via Unsplash)
- No external dependencies (pure HTML/CSS/JS)
- Optimized for mobile (< 100KB total)
- Smooth 60fps animations

### Accessibility
- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast ratios (WCAG AA)

### Browser Support
- Modern browsers (Chrome 90+, Safari 14+, Firefox 88+)
- CSS Grid and Flexbox
- CSS Custom Properties
- ES6+ JavaScript

---

## 🚢 Deployment

These demos are static HTML files and can be:
1. **Served directly** from Cloudflare Pages
2. **Embedded in documentation** as iframes
3. **Used as templates** for React/Vue components
4. **Tested locally** by opening in browser

---

## 📚 Additional Resources

- [Grab Food Theme Documentation](../docs/GRAB_FOOD_THEME.md)
- [API Reference](../docs/API_REFERENCE.md)
- [Component Library](../docs/COMPONENTS.md)
- [Design System](../docs/DESIGN_TOKENS.md)

---

## 🤝 Feedback

To fine-tune the demos:
1. Open demos in your browser
2. Test on different devices
3. Note any UI/UX issues
4. Adjust CSS/JavaScript as needed
5. Share feedback with the team

---

**Version:** 1.0.0
**Last Updated:** 2025-12-08
**Author:** Stonepot Platform

# Aggregator Dashboard Embedding - Quick Start Guide

## ✅ What's Been Implemented

Your POS app can now:
- **Embed Swiggy & Zomato dashboards** directly in the app
- **Automatically extract orders** using configurable selectors
- **Update selectors** without rebuilding the app
- **Works offline** - extraction continues in background

## 📁 Files Created

### Backend (Rust)
- `src-tauri/src/config.rs` - Configuration loader
- `src-tauri/src/dashboard_manager.rs` - Dashboard window manager
- `src-tauri/scripts/universal_extractor.js` - Generic order extractor
- `src-tauri/configs/aggregator_selectors.json` - **Selector configuration (editable!)**

### Frontend (TypeScript/React)
- `src/components/aggregator/DashboardManager.tsx` - Dashboard control panel

### Updated
- `src-tauri/src/lib.rs` - Registered new commands

## 🚀 How to Use

### Step 1: Build the App

```bash
npm run tauri build
```

The app will build with default selectors (best guesses for common patterns).

### Step 2: Launch and Test

1. Open the built app
2. Navigate to Aggregator Dashboard
3. Click "Open Swiggy Dashboard" or "Open Zomato Dashboard"
4. Log in to your partner account
5. Watch the console for extraction logs

### Step 3: Update Selectors (if needed)

If orders aren't being extracted:

1. **Inspect the dashboard in browser**:
   ```bash
   # Open in regular Chrome/Firefox
   https://partner.swiggy.com/
   # or
   https://www.zomato.com/partners/login
   ```

2. **Find the right selectors**:
   - Right-click an order → Inspect
   - Note the CSS classes: `.order-card`, `.order-id`, etc.
   - Note data attributes: `[data-order-id]`, etc.

3. **Update the config file**:
   ```bash
   # Edit this file:
   src-tauri/configs/aggregator_selectors.json
   ```

   Example update:
   ```json
   {
     "platforms": {
       "swiggy": {
         "selectors": {
           "orderContainer": ".actual-class-name",
           "orderId": "[data-actual-attribute]",
           "customerName": ".real-customer-selector"
         }
       }
     }
   }
   ```

4. **Reload the dashboard**:
   - Click "Reload" button in the app
   - OR restart the app

### Step 4: Verify Extraction

Check browser console (in the embedded webview):
- `[UniversalExtractor] Found X order containers`
- `[UniversalExtractor] Extracted order: ORDER_NUMBER`
- `[UniversalExtractor] Sent X orders to app`

## 🔧 Selector Configuration

### Default Selectors (included)

The config file has **multiple selectors per field** (comma-separated):

```json
"orderContainer": ".order-card, [class*='order-container'], [data-testid*='order']"
```

The extractor tries each selector until one works.

### Key Selectors to Update

Most important selectors to verify:

1. **orderContainer** - The main order element
2. **orderId** - Unique order identifier
3. **customerName** - Customer name field
4. **itemsList** - Container for order items
5. **itemRow** - Individual item element
6. **orderTotal** - Total amount

### Testing Selectors in Browser

```javascript
// Open partner dashboard in browser
// Open DevTools Console (F12)

// Test order container selector
document.querySelectorAll('.order-card')  // Should return order elements

// Test order ID extraction
document.querySelector('.order-card .order-id')?.textContent

// Test items list
document.querySelector('.order-card .items-list')

// Find all possible selectors
document.querySelectorAll('[class*="order"]')  // All elements with "order" in class
document.querySelectorAll('[data-*]')  // All data attributes
```

## 📊 Configuration Options

### Polling Settings

```json
"polling": {
  "enabled": true,              // Enable periodic scanning
  "intervalMs": 5000,           // Scan every 5 seconds
  "useObserver": true           // Watch for DOM changes
}
```

### Extraction Settings

```json
"extraction": {
  "skipProcessedOrders": true,      // Don't extract same order twice
  "maxOrdersPerScan": 50,           // Limit orders per scan
  "parseNumericValues": true        // Parse prices as numbers
}
```

### Global Settings

```json
"global": {
  "debugMode": false,              // Detailed console logs
  "logExtractions": true,          // Log each extraction
  "notifyOnNewOrder": true,        // System notifications
  "autoAcceptOrders": false        // Auto-accept (not recommended)
}
```

## 🐛 Troubleshooting

### Orders not being extracted

**Symptom**: No console logs, no orders appearing

**Solution**:
1. Open embedded dashboard
2. Check if you're logged in
3. Open browser DevTools in the webview
4. Look for errors in console
5. Verify selectors are correct

### Wrong data being extracted

**Symptom**: Customer names are prices, items are addresses, etc.

**Solution**:
1. Inspect actual dashboard HTML
2. Update selectors to match real structure
3. Test selectors in browser console first
4. Reload dashboard after config change

### Dashboard won't open

**Symptom**: Error when clicking "Open Dashboard"

**Solution**:
1. Check `aggregator_selectors.json` exists
2. Verify JSON is valid (no syntax errors)
3. Check console for config loading errors
4. Ensure `dashboardUrl` is correct

### Tauri API not available

**Symptom**: `window.__TAURI__ is undefined`

**Solution**:
1. Check `tauri.conf.json` has correct CSP
2. Verify domain in `dangerousRemoteDomainIpcAccess`
3. Rebuild the app

## 📝 Example: Finding Swiggy Selectors

```javascript
// 1. Open https://partner.swiggy.com/ in Chrome
// 2. Log in to your account
// 3. Open DevTools Console

// Find order containers
let orders = document.querySelectorAll('.order-card')
console.log('Found', orders.length, 'orders')

// Inspect first order
let order = orders[0]
console.log({
  orderId: order.querySelector('.order-id')?.textContent,
  customer: order.querySelector('.customer-name')?.textContent,
  items: order.querySelectorAll('.item').length,
  total: order.querySelector('.total')?.textContent
})

// Test specific selectors
let selectors = {
  orderContainer: '.order-card',
  orderId: '.order-id',
  customerName: '.customer-name',
  itemsList: '.items',
  itemRow: '.item',
  orderTotal: '.total'
}

// Verify each selector works
Object.entries(selectors).forEach(([key, selector]) => {
  let found = key.includes('All')
    ? document.querySelectorAll(selector)
    : document.querySelector(selector)
  console.log(key, ':', found ? '✓' : '✗', selector)
})
```

## 🔄 Workflow

1. **Build app** with default selectors
2. **Open dashboard** in the app
3. **Check if orders extract** (watch console)
4. **If not**, inspect dashboard in browser
5. **Find correct selectors**
6. **Update config** file
7. **Reload dashboard** in app
8. **Verify extraction** works

## 📚 Next Steps

- Add selector discovery tool (auto-find selectors)
- Implement auto-login if APIs available
- Add extraction health monitoring
- Create backup manual import flow

## 🎯 Success Criteria

✅ Dashboard opens in app window
✅ User can log in
✅ Orders are detected and extracted
✅ Extracted data appears in aggregator store
✅ Orders flow to KDS automatically
✅ Selectors can be updated without rebuild

## 💡 Pro Tips

1. **Keep dashboards minimized** - extraction works in background
2. **Enable debug mode** for detailed logs while tuning selectors
3. **Use mutation observer** for instant detection of new orders
4. **Test selectors in browser first** before updating config
5. **Keep polling interval ≥ 5000ms** to avoid rate limiting

## 📞 Support

If selectors change frequently:
- Create a backup config file
- Document the selector discovery process
- Consider building a selector discovery UI tool

The config-based approach means you can ship the app now and fine-tune selectors in production without rebuilding!

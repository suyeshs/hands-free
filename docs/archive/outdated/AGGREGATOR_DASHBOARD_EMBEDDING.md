# Aggregator Dashboard Embedding - Implementation Guide

## Overview

Embed Swiggy and Zomato partner dashboards directly into the POS app using Tauri webviews, with automatic order extraction via JavaScript injection. Orders are automatically pulled from the dashboards and fed into the order management system without manual intervention.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri POS App                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Main POS     │  │   Swiggy     │  │   Zomato     │ │
│  │   Window     │  │  Dashboard   │  │  Dashboard   │ │
│  │              │  │  (Webview)   │  │  (Webview)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                          │                              │
│                          ▼                              │
│             ┌──────────────────────────┐                │
│             │  Order Extraction Layer  │                │
│             │  (JS Injection)          │                │
│             └──────────────────────────┘                │
│                          │                              │
│                          ▼                              │
│             ┌──────────────────────────┐                │
│             │  Aggregator Order Store  │                │
│             │  (State Management)      │                │
│             └──────────────────────────┘                │
│                          │                              │
│                          ▼                              │
│             ┌──────────────────────────┐                │
│             │   KDS Integration        │                │
│             │   (Kitchen Display)      │                │
│             └──────────────────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Tauri Configuration

**File**: `src-tauri/tauri.conf.json`

Add configuration for external URLs and CSP:

```json
{
  "tauri": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "frame-src": [
          "https://partner.swiggy.com",
          "https://www.zomato.com"
        ],
        "connect-src": [
          "'self'",
          "https://partner.swiggy.com",
          "https://www.zomato.com",
          "ws://localhost:*",
          "wss://*"
        ]
      },
      "dangerousRemoteDomainIpcAccess": [
        {
          "domain": "partner.swiggy.com",
          "windows": ["swiggy-dashboard"],
          "enableTauriAPI": true
        },
        {
          "domain": "www.zomato.com",
          "windows": ["zomato-dashboard"],
          "enableTauriAPI": true
        }
      ]
    },
    "allowlist": {
      "all": false,
      "window": {
        "create": true,
        "close": true,
        "hide": true,
        "show": true,
        "maximize": true,
        "minimize": true
      },
      "shell": {
        "open": true
      }
    },
    "windows": [
      {
        "label": "main",
        "title": "Restaurant POS",
        "width": 1280,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

### 2. Rust Backend - Dashboard Manager

**File**: `src-tauri/src/dashboard_manager.rs` (new file)

```rust
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedOrder {
    pub platform: String,
    pub order_id: String,
    pub order_number: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub items: Vec<OrderItem>,
    pub total: f64,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub name: String,
    pub quantity: u32,
    pub price: f64,
    pub modifiers: Option<Vec<String>>,
    pub special_instructions: Option<String>,
}

/// Open Swiggy dashboard in a new webview window
#[tauri::command]
pub async fn open_swiggy_dashboard(app: AppHandle) -> Result<(), String> {
    let url = "https://partner.swiggy.com/";

    // Check if window already exists
    if let Some(window) = app.get_webview_window("swiggy-dashboard") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new window
    WebviewWindowBuilder::new(
        &app,
        "swiggy-dashboard",
        WebviewUrl::External(url.parse().unwrap())
    )
    .title("Swiggy Partner Dashboard")
    .inner_size(1024.0, 768.0)
    .resizable(true)
    .initialization_script(include_str!("../scripts/swiggy_extractor.js"))
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Open Zomato dashboard in a new webview window
#[tauri::command]
pub async fn open_zomato_dashboard(app: AppHandle) -> Result<(), String> {
    let url = "https://www.zomato.com/partners/login";

    // Check if window already exists
    if let Some(window) = app.get_webview_window("zomato-dashboard") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new window
    WebviewWindowBuilder::new(
        &app,
        "zomato-dashboard",
        WebviewUrl::External(url.parse().unwrap())
    )
    .title("Zomato Partner Dashboard")
    .inner_size(1024.0, 768.0)
    .resizable(true)
    .initialization_script(include_str!("../scripts/zomato_extractor.js"))
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Close aggregator dashboard
#[tauri::command]
pub async fn close_dashboard(app: AppHandle, platform: String) -> Result<(), String> {
    let label = format!("{}-dashboard", platform.to_lowercase());

    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Process extracted orders from dashboard
#[tauri::command]
pub async fn process_extracted_orders(
    app: AppHandle,
    orders: Vec<ExtractedOrder>
) -> Result<(), String> {
    println!("[DashboardManager] Processing {} extracted orders", orders.len());

    // Emit event to frontend with extracted orders
    app.emit("aggregator-orders-extracted", orders)
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**File**: `src-tauri/src/main.rs` (update)

```rust
mod dashboard_manager;

use dashboard_manager::{
    open_swiggy_dashboard,
    open_zomato_dashboard,
    close_dashboard,
    process_extracted_orders,
};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_swiggy_dashboard,
            open_zomato_dashboard,
            close_dashboard,
            process_extracted_orders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
```

### 3. JavaScript Extractors

**File**: `src-tauri/scripts/swiggy_extractor.js`

```javascript
/**
 * Swiggy Partner Dashboard Order Extractor
 * Injects into Swiggy partner dashboard to extract order data automatically
 */

(function() {
    console.log('[SwiggyExtractor] Initializing...');

    // Configuration
    const POLL_INTERVAL = 5000; // Check for new orders every 5 seconds
    const SELECTORS = {
        // These need to be updated based on actual Swiggy dashboard DOM structure
        orderCard: '.order-card',
        orderId: '.order-id',
        orderNumber: '[data-order-number]',
        customerName: '.customer-name',
        customerPhone: '.customer-phone',
        items: '.item-list .item',
        itemName: '.item-name',
        itemQuantity: '.item-quantity',
        itemPrice: '.item-price',
        total: '.order-total',
        status: '[data-order-status]',
        timestamp: '.order-time'
    };

    let processedOrderIds = new Set();

    /**
     * Extract order data from DOM element
     */
    function extractOrderFromElement(orderElement) {
        try {
            const orderId = orderElement.querySelector(SELECTORS.orderId)?.textContent?.trim();

            // Skip if already processed
            if (!orderId || processedOrderIds.has(orderId)) {
                return null;
            }

            const order = {
                platform: 'swiggy',
                order_id: orderId,
                order_number: orderElement.querySelector(SELECTORS.orderNumber)?.getAttribute('data-order-number') || orderId,
                customer_name: orderElement.querySelector(SELECTORS.customerName)?.textContent?.trim() || 'Swiggy Customer',
                customer_phone: orderElement.querySelector(SELECTORS.customerPhone)?.textContent?.trim() || '',
                items: [],
                total: 0,
                status: orderElement.querySelector(SELECTORS.status)?.getAttribute('data-order-status') || 'pending',
                created_at: orderElement.querySelector(SELECTORS.timestamp)?.textContent?.trim() || new Date().toISOString()
            };

            // Extract items
            const itemElements = orderElement.querySelectorAll(SELECTORS.items);
            itemElements.forEach(item => {
                const itemData = {
                    name: item.querySelector(SELECTORS.itemName)?.textContent?.trim() || '',
                    quantity: parseInt(item.querySelector(SELECTORS.itemQuantity)?.textContent?.trim()) || 1,
                    price: parseFloat(item.querySelector(SELECTORS.itemPrice)?.textContent?.replace(/[^0-9.]/g, '')) || 0,
                    modifiers: null,
                    special_instructions: null
                };
                order.items.push(itemData);
            });

            // Extract total
            const totalText = orderElement.querySelector(SELECTORS.total)?.textContent?.trim();
            order.total = parseFloat(totalText?.replace(/[^0-9.]/g, '')) || 0;

            // Mark as processed
            processedOrderIds.add(orderId);

            return order;
        } catch (error) {
            console.error('[SwiggyExtractor] Error extracting order:', error);
            return null;
        }
    }

    /**
     * Scan page for new orders
     */
    function scanForOrders() {
        const orderElements = document.querySelectorAll(SELECTORS.orderCard);
        const newOrders = [];

        orderElements.forEach(element => {
            const order = extractOrderFromElement(element);
            if (order) {
                newOrders.push(order);
                console.log('[SwiggyExtractor] New order found:', order.order_number);
            }
        });

        // Send to Tauri app
        if (newOrders.length > 0 && window.__TAURI__) {
            window.__TAURI__.core.invoke('process_extracted_orders', {
                orders: newOrders
            }).then(() => {
                console.log('[SwiggyExtractor] Sent', newOrders.length, 'orders to app');
            }).catch(err => {
                console.error('[SwiggyExtractor] Failed to send orders:', err);
            });
        }
    }

    /**
     * Watch for DOM changes (new orders appearing)
     */
    function setupMutationObserver() {
        const targetNode = document.body;

        const observer = new MutationObserver((mutations) => {
            const hasNewOrders = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    return node.nodeType === 1 && (
                        node.classList?.contains('order-card') ||
                        node.querySelector?.('.order-card')
                    );
                });
            });

            if (hasNewOrders) {
                console.log('[SwiggyExtractor] New orders detected via mutation');
                scanForOrders();
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });

        console.log('[SwiggyExtractor] Mutation observer setup complete');
    }

    /**
     * Initialize extractor
     */
    function init() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('[SwiggyExtractor] Page loaded, starting extraction');

        // Initial scan
        setTimeout(scanForOrders, 2000);

        // Setup polling
        setInterval(scanForOrders, POLL_INTERVAL);

        // Setup mutation observer
        setupMutationObserver();

        console.log('[SwiggyExtractor] Initialization complete');
    }

    // Start
    init();
})();
```

**File**: `src-tauri/scripts/zomato_extractor.js`

Similar to Swiggy extractor but with Zomato-specific selectors. Copy the structure above and adjust SELECTORS based on Zomato's DOM.

### 4. Frontend Integration

**File**: `src/hooks/useAggregatorDashboards.ts`

```typescript
/**
 * Hook to manage embedded aggregator dashboards
 */

import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAggregatorStore } from '../stores/aggregatorStore';

export function useAggregatorDashboards() {
  const addOrder = useAggregatorStore(state => state.addOrder);

  // Open Swiggy dashboard
  const openSwiggyDashboard = useCallback(async () => {
    try {
      await invoke('open_swiggy_dashboard');
      console.log('[AggregatorDashboards] Swiggy dashboard opened');
    } catch (error) {
      console.error('[AggregatorDashboards] Failed to open Swiggy dashboard:', error);
    }
  }, []);

  // Open Zomato dashboard
  const openZomatoDashboard = useCallback(async () => {
    try {
      await invoke('open_zomato_dashboard');
      console.log('[AggregatorDashboards] Zomato dashboard opened');
    } catch (error) {
      console.error('[AggregatorDashboards] Failed to open Zomato dashboard:', error);
    }
  }, []);

  // Close dashboard
  const closeDashboard = useCallback(async (platform: 'swiggy' | 'zomato') => {
    try {
      await invoke('close_dashboard', { platform });
      console.log('[AggregatorDashboards] Dashboard closed:', platform);
    } catch (error) {
      console.error('[AggregatorDashboards] Failed to close dashboard:', error);
    }
  }, []);

  // Listen for extracted orders
  useEffect(() => {
    const unlisten = listen('aggregator-orders-extracted', (event) => {
      const orders = event.payload as any[];
      console.log('[AggregatorDashboards] Received extracted orders:', orders.length);

      orders.forEach(order => {
        // Transform to AggregatorOrder format and add to store
        addOrder(transformExtractedOrder(order));
      });
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [addOrder]);

  return {
    openSwiggyDashboard,
    openZomatoDashboard,
    closeDashboard
  };
}

function transformExtractedOrder(extracted: any): AggregatorOrder {
  // Transform extracted order to AggregatorOrder type
  return {
    // ... transformation logic
  };
}
```

### 5. UI Component

**File**: `src/components/aggregator/DashboardManager.tsx`

```typescript
/**
 * Aggregator Dashboard Manager Component
 * Controls for opening/closing embedded dashboards
 */

import { useAggregatorDashboards } from '../../hooks/useAggregatorDashboards';
import { NeoButton } from '../ui-v2/NeoButton';

export function DashboardManager() {
  const {
    openSwiggyDashboard,
    openZomatoDashboard,
    closeDashboard
  } = useAggregatorDashboards();

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Aggregator Dashboards</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Swiggy */}
        <div className="space-y-2">
          <NeoButton
            onClick={openSwiggyDashboard}
            variant="primary"
            className="w-full"
          >
            🟠 Open Swiggy Dashboard
          </NeoButton>
          <NeoButton
            onClick={() => closeDashboard('swiggy')}
            variant="secondary"
            className="w-full"
          >
            Close
          </NeoButton>
        </div>

        {/* Zomato */}
        <div className="space-y-2">
          <NeoButton
            onClick={openZomatoDashboard}
            variant="primary"
            className="w-full"
          >
            🔴 Open Zomato Dashboard
          </NeoButton>
          <NeoButton
            onClick={() => closeDashboard('zomato')}
            variant="secondary"
            className="w-full"
          >
            Close
          </NeoButton>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>• Dashboards will open in separate windows</p>
        <p>• Orders are automatically extracted and added to your system</p>
        <p>• Log in once, then minimize the windows</p>
      </div>
    </div>
  );
}
```

## DOM Selector Discovery

To find the correct selectors for Swiggy and Zomato:

1. **Open Partner Dashboard** in browser
2. **Right-click** on an order element → Inspect
3. **Note the classes/IDs** used for:
   - Order container
   - Order ID
   - Customer info
   - Items list
   - Total amount
   - Status
4. **Update extractors** with correct selectors

Example inspection workflow:

```javascript
// In browser console on Swiggy/Zomato partner dashboard:
document.querySelectorAll('[class*="order"]')  // Find order elements
document.querySelectorAll('[class*="item"]')   // Find item elements
document.querySelectorAll('[data-*]')          // Find data attributes
```

## Testing

1. **Build Tauri app**: `npm run tauri build`
2. **Run app**: Launch the built executable
3. **Click "Open Swiggy Dashboard"**
4. **Log in** to your partner account
5. **Check console** for extraction logs
6. **Verify orders** appear in aggregator dashboard

## Troubleshooting

### Orders not extracting

- **Check selectors**: DOM structure may have changed
- **Inspect console**: Look for error messages
- **Test manually**: Run extraction code in browser console first

### Tauri API not available

- **Check CSP**: Ensure domain is in `dangerousRemoteDomainIpcAccess`
- **Check initialization**: Script should run after page load
- **Use iframe wrapper**: If needed, wrap dashboard in local HTML

### Authentication issues

- **Login manually**: User logs in once in the webview
- **Persist cookies**: Tauri handles this automatically
- **Check session**: Ensure partner account is active

## Security Considerations

1. **ToS Compliance**: Review Swiggy/Zomato partner terms
2. **Rate Limiting**: Don't poll too frequently (5s minimum)
3. **Error Handling**: Gracefully handle DOM changes
4. **User Control**: Allow disabling auto-extraction

## Next Steps

1. Implement selector discovery tool
2. Add auto-login capability (if APIs available)
3. Sync extraction state across app restarts
4. Add dashboard health monitoring
5. Create backup manual import flow

## Files to Create

- `src-tauri/src/dashboard_manager.rs`
- `src-tauri/scripts/swiggy_extractor.js`
- `src-tauri/scripts/zomato_extractor.js`
- `src/hooks/useAggregatorDashboards.ts`
- `src/components/aggregator/DashboardManager.tsx`

## Files to Modify

- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`
- `src/pages-v2/AggregatorDashboard.tsx` (add DashboardManager component)

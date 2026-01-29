/**
 * Universal Aggregator Order Extractor
 * Works with any aggregator dashboard using configurable selectors
 *
 * This script is injected into dashboard webviews and uses
 * selector configuration passed from Rust backend.
 *
 * Modes:
 * - 'live': Default mode - monitors for new orders in real-time
 * - 'history': Navigates to Past Orders tab and extracts historical orders
 */

(function(CONFIG) {
    'use strict';

    console.log('[UniversalExtractor] Initializing for platform:', CONFIG.platform);
    console.log('[UniversalExtractor] Config:', CONFIG);

    // Track processed orders
    const processedOrderIds = new Set();
    let isInitialized = false;
    let isHistoryMode = false;
    let historyDaysToFetch = 2; // Default: fetch last 2 days

    /**
     * Try multiple selectors (comma-separated) until one works
     */
    function querySelector(element, selectorString) {
        const selectors = selectorString.split(',').map(s => s.trim());

        for (const selector of selectors) {
            try {
                const result = element.querySelector(selector);
                if (result) {
                    return result;
                }
            } catch (e) {
                // Invalid selector, try next
                continue;
            }
        }

        return null;
    }

    /**
     * Try multiple selectors for querySelectorAll
     */
    function querySelectorAll(element, selectorString) {
        const selectors = selectorString.split(',').map(s => s.trim());

        for (const selector of selectors) {
            try {
                const results = element.querySelectorAll(selector);
                if (results && results.length > 0) {
                    return results;
                }
            } catch (e) {
                continue;
            }
        }

        return [];
    }

    /**
     * Extract text content with fallback
     */
    function getTextContent(element, selectorString, fallback = '') {
        if (!element) return fallback;

        const el = querySelector(element, selectorString);
        return el?.textContent?.trim() || fallback;
    }

    /**
     * Clean customer name by removing trailing dashes, separators, and other noise
     */
    function cleanCustomerName(name) {
        if (!name) return name;

        // Remove trailing dashes (common separator in Swiggy)
        let cleaned = name.replace(/-+\s*$/, '').trim();

        // Remove leading dashes
        cleaned = cleaned.replace(/^-+\s*/, '').trim();

        // Remove multiple consecutive dashes in the middle (replace with single space)
        cleaned = cleaned.replace(/-{2,}/g, ' ').trim();

        // Remove "Order from" prefix if present
        cleaned = cleaned.replace(/^Order from\s+/i, '').trim();

        // Clean up multiple spaces
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

        return cleaned;
    }

    /**
     * Extract attribute value
     */
    function getAttribute(element, selectorString, attrName, fallback = '') {
        if (!element) return fallback;

        const el = querySelector(element, selectorString);
        return el?.getAttribute(attrName) || fallback;
    }

    /**
     * Parse numeric value from string
     */
    function parseNumeric(value) {
        if (!CONFIG.extraction.parseNumericValues) {
            return value;
        }

        // Remove currency symbols, commas, etc.
        const cleaned = String(value).replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);

        return isNaN(num) ? 0 : num;
    }

    /**
     * Parse time string (e.g., "02:11 PM", "6:39 PM") to full ISO timestamp
     * Uses today's date with the extracted time
     */
    function parseOrderTime(timeStr) {
        if (!timeStr) return new Date().toISOString();

        try {
            // Handle formats like "02:11 PM", "6:39 PM", "14:30"
            const cleanTime = timeStr.trim().toUpperCase();

            // Match 12-hour format: "02:11 PM" or "2:11 PM"
            const match12h = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (match12h) {
                let hours = parseInt(match12h[1], 10);
                const minutes = parseInt(match12h[2], 10);
                const period = match12h[3].toUpperCase();

                // Convert to 24-hour
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;

                const now = new Date();
                now.setHours(hours, minutes, 0, 0);
                return now.toISOString();
            }

            // Match 24-hour format: "14:30"
            const match24h = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
            if (match24h) {
                const hours = parseInt(match24h[1], 10);
                const minutes = parseInt(match24h[2], 10);

                const now = new Date();
                now.setHours(hours, minutes, 0, 0);
                return now.toISOString();
            }

            // If already ISO format or can be parsed by Date
            const parsed = new Date(timeStr);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }

            // Fallback
            return new Date().toISOString();
        } catch (e) {
            console.warn('[UniversalExtractor] Failed to parse time:', timeStr, e);
            return new Date().toISOString();
        }
    }

    /**
     * Parse Swiggy order details text format
     * Format: "02:11 PM | ₹437.9 | Otti ( Rice Roti) 2 Piece x 1, Pepper Chicken Fry [Kodava Koli Bharthad] x 1"
     * Also handles: "06:49 PM  |  ₹1419.6  |  4 items, ₹1419.6"
     * Returns ISO timestamp for time
     *
     * Note: Swiggy list view doesn't show individual item prices, only the total.
     * We estimate per-item prices by dividing total by quantity.
     */
    function parseSwiggyOrderDetails(detailsText) {
        if (!detailsText) return { time: null, total: 0, items: [], itemCount: 0 };

        const parts = detailsText.split('|').map(p => p.trim());

        let time = null;
        let total = 0;
        let items = [];
        let itemCount = 0;

        if (parts.length >= 2) {
            // First part is time - parse it to ISO timestamp
            const rawTime = parts[0];
            time = parseOrderTime(rawTime);

            // Second part is total (₹437.9) or could be "4 items, ₹1419.6"
            const totalMatch = parts[1].match(/₹?\s*([\d,]+\.?\d*)/);
            if (totalMatch) {
                total = parseFloat(totalMatch[1].replace(',', ''));
            }

            // Third part onwards is items (if present)
            if (parts.length >= 3) {
                const itemsText = parts.slice(2).join('|');

                // Parse items: "Otti ( Rice Roti) 2 Piece x 1, Pepper Chicken Fry [Kodava Koli Bharthad] x 1"
                const itemParts = itemsText.split(',').map(i => i.trim());

                itemParts.forEach(itemStr => {
                    // Match pattern: "Item Name x Quantity"
                    const match = itemStr.match(/^(.+?)\s*x\s*(\d+)\s*$/i);
                    if (match) {
                        const qty = parseInt(match[2], 10);
                        items.push({
                            name: match[1].trim(),
                            quantity: qty,
                            price: 0,  // Will be estimated below
                            modifiers: null,
                            special_instructions: null
                        });
                        itemCount += qty;
                    } else if (itemStr.trim() && !itemStr.match(/^\d+\s*items?/i)) {
                        // Fallback: assume quantity 1 (but skip "4 items" text)
                        items.push({
                            name: itemStr.trim(),
                            quantity: 1,
                            price: 0,
                            modifiers: null,
                            special_instructions: null
                        });
                        itemCount += 1;
                    }
                });

                // Estimate per-item prices from total
                // This gives each item a proportional share based on quantity
                if (items.length > 0 && total > 0) {
                    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                    if (totalQuantity > 0) {
                        // Distribute total across items proportionally by quantity
                        items.forEach(item => {
                            // Each unit gets an equal share of the total
                            const unitPrice = total / totalQuantity;
                            item.price = Math.round(unitPrice * 100) / 100;
                        });
                    }
                }
            }
        }

        return { time, total, items, itemCount };
    }

    /**
     * Extract Zomato order from DOM element
     * Zomato has a different structure than Swiggy
     */
    function extractZomatoOrder(orderElement) {
        try {
            // The order container has the order ID in its id attribute (e.g., id="7633003265")
            let orderId = orderElement.id || '';

            // If no id, try to find order number from "ID: 3265" text
            if (!orderId) {
                const idEl = orderElement.querySelector('.css-16jdd3h span span, .css-1q76sun span');
                if (idEl) {
                    orderId = idEl.textContent?.trim() || '';
                }
            }

            // Extract the 4-digit order number
            let orderNumber = orderId;
            const idTextEl = orderElement.querySelector('.css-16jdd3h');
            if (idTextEl) {
                const text = idTextEl.textContent || '';
                const match = text.match(/ID:\s*(\d{4})/i);
                if (match) {
                    orderNumber = match[1];
                }
            }

            // Create a consistent order ID
            const fullOrderId = `zomato_${orderNumber}`;

            // Skip if no order number
            if (!orderNumber) {
                if (CONFIG.global.debugMode) {
                    console.log('[UniversalExtractor] No Zomato order number found');
                }
                return null;
            }

            // Check if already processed
            if (CONFIG.extraction.skipProcessedOrders && processedOrderIds.has(orderNumber)) {
                return null;
            }

            // Extract customer name
            const customerNameEl = orderElement.querySelector('.sc-jzJRlG.sc-feJyhm, .css-1g27dnw span');
            const rawCustomerName = customerNameEl?.textContent?.trim() || 'Zomato Customer';
            const customerName = cleanCustomerName(rawCustomerName);

            // Extract customer address (second .css-1d0eedk contains address)
            const addressEls = orderElement.querySelectorAll('.css-1d0eedk');
            let customerAddress = null;
            if (addressEls.length >= 2) {
                customerAddress = addressEls[1]?.textContent?.trim() || null;
            }

            // Extract customer location/coordinates if available
            // Aggregator dashboards sometimes include map links or data attributes with coordinates
            let customerLocation = null;
            const locationEl = querySelector(orderElement, CONFIG.selectors.customerLocation || '[class*="location"], [data-lat]');
            if (locationEl) {
                // Try to get coordinates from data attributes
                const lat = locationEl.getAttribute('data-lat') || locationEl.getAttribute('data-latitude');
                const lng = locationEl.getAttribute('data-lng') || locationEl.getAttribute('data-longitude');
                if (lat && lng) {
                    customerLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
                } else {
                    // Try to extract from href (Google Maps link format)
                    const href = locationEl.getAttribute('href') || '';
                    const coordMatch = href.match(/[@=](-?\d+\.?\d*),(-?\d+\.?\d*)/);
                    if (coordMatch) {
                        customerLocation = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
                    }
                }
            }
            // Also check for map links in the address area
            if (!customerLocation) {
                const mapLink = orderElement.querySelector('a[href*="maps"], a[href*="geo:"]');
                if (mapLink) {
                    const href = mapLink.getAttribute('href') || '';
                    const coordMatch = href.match(/[@=](-?\d+\.?\d*),(-?\d+\.?\d*)/);
                    if (coordMatch) {
                        customerLocation = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
                    }
                }
            }

            // Extract total from ₹405 format
            const totalEl = orderElement.querySelector('.css-16d7kup');
            let total = 0;
            if (totalEl) {
                const totalText = totalEl.textContent || '';
                const totalMatch = totalText.match(/₹?\s*([\d,]+)/);
                if (totalMatch) {
                    total = parseFloat(totalMatch[1].replace(',', ''));
                }
            }

            // Extract items
            const items = [];
            const itemRows = orderElement.querySelectorAll('.css-p5jpjm');

            itemRows.forEach((row, idx) => {
                // Item format: "1 x  Item Name" with price on the right
                const quantityEl = row.querySelector('.css-11wxfyl');
                const nameEl = row.querySelector('.css-1mcri0u');
                const priceEl = row.querySelector('.css-1rz04kj');

                let quantity = 1;
                if (quantityEl) {
                    const qtyText = quantityEl.textContent || '';
                    const qtyMatch = qtyText.match(/(\d+)\s*x/);
                    if (qtyMatch) {
                        quantity = parseInt(qtyMatch[1], 10);
                    }
                }

                const name = nameEl?.textContent?.trim() || '';

                let price = 0;
                if (priceEl) {
                    const priceText = priceEl.textContent || '';
                    const priceMatch = priceText.match(/₹?\s*([\d,]+)/);
                    if (priceMatch) {
                        price = parseFloat(priceMatch[1].replace(',', ''));
                    }
                }

                if (name) {
                    items.push({
                        name,
                        quantity,
                        price,
                        modifiers: null,
                        special_instructions: null
                    });
                }
            });

            // Extract order time (e.g., "6:39 PM") and convert to ISO timestamp
            const timeEl = orderElement.querySelector('.bbNJyY, .css-19er1ul b');
            const rawOrderTime = timeEl?.textContent?.trim() || null;
            const orderTime = parseOrderTime(rawOrderTime);

            // Extract status from the header (ZOMATO - DELIVERY or tab state)
            let status = 'pending';
            const statusEl = orderElement.querySelector('.css-1jggyuf');
            if (statusEl) {
                const statusText = statusEl.textContent?.toLowerCase() || '';
                if (statusText.includes('preparing')) status = 'preparing';
                else if (statusText.includes('ready')) status = 'ready';
                else if (statusText.includes('picked')) status = 'picked_up';
                else if (statusText.includes('delivery')) status = 'pending'; // New order
            }

            // Build order object
            const order = {
                platform: 'zomato',
                order_id: fullOrderId,
                order_number: orderNumber,
                customer_name: customerName,
                customer_phone: '',
                customer_address: customerAddress,
                customer_location: customerLocation,
                items,
                total,
                status,
                created_at: orderTime
            };

            // Mark as processed
            if (CONFIG.extraction.skipProcessedOrders) {
                processedOrderIds.add(orderNumber);
            }

            if (CONFIG.global.logExtractions) {
                console.log('[UniversalExtractor] Extracted Zomato order:', order.order_number, 'Items:', items.length, 'Total:', total);
            }

            return order;

        } catch (error) {
            console.error('[UniversalExtractor] Error extracting Zomato order:', error);
            return null;
        }
    }

    /**
     * Extract single order from DOM element
     * Routes to platform-specific extractor based on config
     */
    function extractOrder(orderElement) {
        // Route to platform-specific extractor
        if (CONFIG.platform === 'zomato') {
            return extractZomatoOrder(orderElement);
        }

        // Default: Swiggy extraction
        return extractSwiggyOrder(orderElement);
    }

    /**
     * Try to extract detailed item info from Swiggy order detail panel
     * This is visible when an order is selected/expanded
     * Returns items with actual prices if found
     */
    function extractSwiggyDetailedItems(orderContainer) {
        const items = [];

        // Look for the item detail rows in the expanded order view
        // These have structure: Item Name, Category, x Qty, ₹ Price
        const itemRows = orderContainer.querySelectorAll('[class*="item-row"], [class*="order-item"], [data-testid*="item"]');

        itemRows.forEach(row => {
            const nameEl = row.querySelector('[class*="item-name"], [class*="dish-name"]');
            const qtyEl = row.querySelector('[class*="quantity"], [class*="qty"]');
            const priceEl = row.querySelector('[class*="price"]');

            if (nameEl) {
                const name = nameEl.textContent?.trim() || '';
                let quantity = 1;
                let price = 0;

                if (qtyEl) {
                    const qtyText = qtyEl.textContent || '';
                    const qtyMatch = qtyText.match(/x?\s*(\d+)/i);
                    if (qtyMatch) {
                        quantity = parseInt(qtyMatch[1], 10);
                    }
                }

                if (priceEl) {
                    const priceText = priceEl.textContent || '';
                    const priceMatch = priceText.match(/₹?\s*([\d,]+\.?\d*)/);
                    if (priceMatch) {
                        price = parseFloat(priceMatch[1].replace(',', ''));
                    }
                }

                if (name) {
                    items.push({
                        name,
                        quantity,
                        price,
                        modifiers: null,
                        special_instructions: null
                    });
                }
            }
        });

        return items;
    }

    /**
     * Extract Swiggy order from DOM element
     */
    function extractSwiggyOrder(orderElement) {
        try {
            // For Swiggy, the orderElement IS the order number element itself
            // We need to find the parent container that has all order info
            let orderContainer = orderElement;

            // Navigate up to find the full order card container (look for parent with order details)
            let parent = orderElement.parentElement;
            for (let i = 0; i < 10 && parent; i++) {
                // Look for larger containers that might have detail view
                if (parent.querySelector && (
                    parent.querySelector('[data-testid="ordertime_amount_items_text"]') ||
                    parent.querySelector('[data-testid="delivered_card_button"]')
                )) {
                    orderContainer = parent;
                    // Don't break - keep going up to find the full container
                }
                parent = parent.parentElement;
            }

            // Get order number from the element text (e.g., "#3880")
            let orderNumber = orderElement.textContent?.trim() || '';
            orderNumber = orderNumber.replace('#', '');

            // Create a consistent order ID (no timestamp to avoid duplicates)
            const orderId = `swiggy_${orderNumber}`;

            // Skip if no order number
            if (!orderNumber) {
                if (CONFIG.global.debugMode) {
                    console.log('[UniversalExtractor] No order number found in element:', orderElement);
                }
                return null;
            }

            // Check if already processed (by order number, not full ID)
            if (CONFIG.extraction.skipProcessedOrders && processedOrderIds.has(orderNumber)) {
                return null;
            }

            // Extract order details text for Swiggy
            const detailsEl = orderContainer.querySelector('[data-testid="ordertime_amount_items_text"]');
            const detailsText = detailsEl?.textContent?.trim() || '';

            // Parse Swiggy-specific format from list view
            let { time, total, items } = parseSwiggyOrderDetails(detailsText);

            // Try to get detailed item info with actual prices from expanded view
            const detailedItems = extractSwiggyDetailedItems(orderContainer);
            if (detailedItems.length > 0) {
                // Use detailed items if we found them (they have actual prices)
                items = detailedItems;
                if (CONFIG.global.debugMode) {
                    console.log('[UniversalExtractor] Found detailed items:', detailedItems.length);
                }
            }

            // Extract status from the status badge
            let status = 'pending';
            const statusBadges = orderContainer.querySelectorAll('.sc-gtLWhw');
            statusBadges.forEach(badge => {
                const badgeText = badge.textContent?.trim().toUpperCase();
                if (badgeText && badgeText !== 'SWIGGY' && badgeText !== 'VEG' && badgeText !== 'NON-VEG') {
                    status = badgeText.toLowerCase();
                }
            });

            const rawCustomerName = getTextContent(
                orderContainer,
                CONFIG.selectors.customerName,
                `Swiggy Customer`
            );
            const customerName = cleanCustomerName(rawCustomerName);

            const customerPhone = getTextContent(
                orderContainer,
                CONFIG.selectors.customerPhone,
                ''
            );

            const customerAddress = getTextContent(
                orderContainer,
                CONFIG.selectors.customerAddress,
                null
            );

            // Extract customer location/coordinates if available
            let customerLocation = null;
            const locationEl = querySelector(orderContainer, CONFIG.selectors.customerLocation || '[class*="location"], [data-lat]');
            if (locationEl) {
                // Try to get coordinates from data attributes
                const lat = locationEl.getAttribute('data-lat') || locationEl.getAttribute('data-latitude');
                const lng = locationEl.getAttribute('data-lng') || locationEl.getAttribute('data-longitude');
                if (lat && lng) {
                    customerLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
                } else {
                    // Try to extract from href (Google Maps link format)
                    const href = locationEl.getAttribute('href') || '';
                    const coordMatch = href.match(/[@=](-?\d+\.?\d*),(-?\d+\.?\d*)/);
                    if (coordMatch) {
                        customerLocation = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
                    }
                }
            }
            // Also check for map links in the order container
            if (!customerLocation) {
                const mapLink = orderContainer.querySelector('a[href*="maps"], a[href*="geo:"]');
                if (mapLink) {
                    const href = mapLink.getAttribute('href') || '';
                    const coordMatch = href.match(/[@=](-?\d+\.?\d*),(-?\d+\.?\d*)/);
                    if (coordMatch) {
                        customerLocation = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
                    }
                }
            }

            // Build order object
            const order = {
                platform: CONFIG.platform,
                order_id: orderId,
                order_number: orderNumber,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: customerAddress,
                customer_location: customerLocation,
                items,
                total,
                status,
                created_at: time || new Date().toISOString()
            };

            // Mark as processed by order number
            if (CONFIG.extraction.skipProcessedOrders) {
                processedOrderIds.add(orderNumber);
            }

            if (CONFIG.global.logExtractions) {
                console.log('[UniversalExtractor] Extracted order:', order.order_number, 'Items:', items.length, 'Total:', total);
            }

            return order;

        } catch (error) {
            console.error('[UniversalExtractor] Error extracting order:', error);
            return null;
        }
    }

    /**
     * Scan page for orders
     */
    function scanForOrders() {
        let orderElements = [];

        // Platform-specific order finding
        if (CONFIG.platform === 'zomato') {
            // For Zomato, find order cards by their structure
            // Order cards have id starting with digits and contain order info
            const allDivs = document.querySelectorAll('div[id]');
            allDivs.forEach(div => {
                // Order IDs are 10-digit numbers (e.g., 7633003265)
                if (/^\d{10}$/.test(div.id)) {
                    orderElements.push(div);
                }
            });

            // Also try CSS class selectors if no ID-based orders found
            if (orderElements.length === 0) {
                orderElements = Array.from(querySelectorAll(document, CONFIG.selectors.orderContainer));
            }
        } else {
            // Swiggy and other platforms
            orderElements = Array.from(querySelectorAll(document, CONFIG.selectors.orderContainer));
        }

        if (CONFIG.global.debugMode) {
            console.log('[UniversalExtractor] Found', orderElements.length, 'order containers');
        }

        const newOrders = [];
        let processed = 0;

        orderElements.forEach(element => {
            if (CONFIG.extraction.maxOrdersPerScan && processed >= CONFIG.extraction.maxOrdersPerScan) {
                return;
            }

            const order = extractOrder(element);
            if (order) {
                newOrders.push(order);
                processed++;
            }
        });

        // Send to Tauri app
        if (newOrders.length > 0) {
            sendOrdersToApp(newOrders);
        }

        return newOrders.length;
    }

    /**
     * Send extracted orders to Tauri app
     */
    function sendOrdersToApp(orders) {
        if (!window.__TAURI__ || !window.__TAURI__.core) {
            console.error('[UniversalExtractor] Tauri API not available');
            return;
        }

        window.__TAURI__.core.invoke('process_extracted_orders', { orders })
            .then(() => {
                if (CONFIG.global.logExtractions) {
                    console.log('[UniversalExtractor] Sent', orders.length, 'orders to app');
                }

                // Notify if configured
                if (CONFIG.global.notifyOnNewOrder) {
                    window.__TAURI__.core.invoke('notify_new_orders', {
                        platform: CONFIG.platform,
                        count: orders.length
                    }).catch(e => console.error('Notification failed:', e));
                }
            })
            .catch(err => {
                console.error('[UniversalExtractor] Failed to send orders:', err);
            });
    }

    // ==================== HISTORY MODE ====================

    /**
     * Navigate to Past Orders tab/page
     * Returns true if navigation was successful
     */
    async function navigateToPastOrders() {
        console.log('[UniversalExtractor] Navigating to Past Orders...');

        // Swiggy-specific: The past orders page is accessed via a tab or URL
        // Based on screenshot: Has "Delivered" and "Spillage Issue" filter buttons
        if (CONFIG.platform === 'swiggy') {
            // Try clicking the Past Orders tab
            const pastOrdersTab = document.querySelector(CONFIG.selectors.tabPastOrders || '[data-testid="tabName-Past Orders"]');
            if (pastOrdersTab) {
                pastOrdersTab.click();
                console.log('[UniversalExtractor] Clicked Past Orders tab');
                await sleep(2000);
                return true;
            }

            // Try navigating directly via URL if on partner.swiggy.com
            if (window.location.href.includes('partner.swiggy.com')) {
                // Look for any link that might lead to order history
                const historyLinks = document.querySelectorAll('a[href*="history"], a[href*="past"], a[href*="orders"]');
                for (const link of historyLinks) {
                    if (link.textContent?.toLowerCase().includes('past') ||
                        link.textContent?.toLowerCase().includes('history') ||
                        link.textContent?.toLowerCase().includes('delivered')) {
                        link.click();
                        console.log('[UniversalExtractor] Clicked Swiggy history link');
                        await sleep(2000);
                        return true;
                    }
                }
            }
            console.warn('[UniversalExtractor] Past Orders tab not found for Swiggy');
        }

        // Zomato-specific: "Order history" is in the left sidebar navigation
        // Based on screenshot: Shows as menu item with icon
        if (CONFIG.platform === 'zomato') {
            // Look for "Order history" in the sidebar
            const allLinks = document.querySelectorAll('a, div[role="button"], span');
            for (const el of allLinks) {
                const text = el.textContent?.trim().toLowerCase() || '';
                if (text === 'order history' || text.includes('order history')) {
                    el.click();
                    console.log('[UniversalExtractor] Clicked Zomato Order history link');
                    await sleep(2000);
                    return true;
                }
            }

            // Try href-based navigation
            const historyLinks = document.querySelectorAll('a[href*="history"], a[href*="order-history"]');
            for (const link of historyLinks) {
                link.click();
                console.log('[UniversalExtractor] Clicked Zomato history link via href');
                await sleep(2000);
                return true;
            }
            console.warn('[UniversalExtractor] Order history not found for Zomato');
        }

        return false;
    }

    /**
     * Sleep helper
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if an order date is within the specified days range
     */
    function isWithinDaysRange(dateStr, days) {
        if (!dateStr) return false;

        try {
            const orderDate = new Date(dateStr);
            const now = new Date();
            const diffMs = now - orderDate;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            return diffDays <= days;
        } catch (e) {
            console.warn('[UniversalExtractor] Failed to parse date:', dateStr);
            return true; // Include if we can't parse
        }
    }

    /**
     * Extract orders from the Past Orders view
     * This handles the different UI for historical orders
     *
     * Swiggy Past Orders UI (from screenshot):
     * - Left sidebar shows order list: order number (7254), items summary, total (₹2125.20), date
     * - Right panel shows expanded details when clicked
     *
     * Zomato Order History UI (from screenshot):
     * - Cards with DELIVERED badge, time, date
     * - Order ID like "ID: 7651050106", customer name
     * - Items list, total amount
     */
    function extractHistoricalOrders() {
        console.log('[UniversalExtractor] Extracting historical orders...');

        const orders = [];

        if (CONFIG.platform === 'swiggy') {
            // Swiggy past orders: Look for order rows in the left sidebar
            // Each row has: order number, items summary, total, date/time
            // Format: "7254\nPork Chudals,Pork Curry...\n₹2125.20\n02-Jan-2026 09:50 pm"

            // Try multiple container patterns
            const orderRows = document.querySelectorAll('[class*="order-row"], [class*="order-card"], [class*="order-item"], [class*="sc-"]');

            orderRows.forEach(row => {
                try {
                    const textContent = row.textContent || '';

                    // Look for 4-digit order number pattern
                    const orderNumMatch = textContent.match(/^(\d{4})\s/m) || textContent.match(/\b(\d{4})\b/);
                    if (!orderNumMatch) return;

                    const orderNumber = orderNumMatch[1];

                    // Skip if already processed
                    if (processedOrderIds.has(orderNumber)) return;

                    // Extract total (₹ followed by numbers)
                    const totalMatch = textContent.match(/₹\s*([\d,]+\.?\d*)/);
                    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : 0;

                    // Extract date (formats like "02-Jan-2026 09:50 pm")
                    const dateMatch = textContent.match(/(\d{1,2}[-\/]\w{3}[-\/]\d{4}\s*\d{1,2}:\d{2}\s*[ap]m)/i);
                    let createdAt = new Date().toISOString();
                    if (dateMatch) {
                        try {
                            const parsed = new Date(dateMatch[1].replace(/-/g, ' '));
                            if (!isNaN(parsed.getTime())) {
                                createdAt = parsed.toISOString();
                            }
                        } catch (e) { /* use default */ }
                    }

                    // Check if within date range
                    if (!isWithinDaysRange(createdAt, historyDaysToFetch)) return;

                    // Extract items (text between order number and total)
                    const itemsMatch = textContent.match(/\d{4}\s*\n?([^₹]+)₹/);
                    const itemsSummary = itemsMatch ? itemsMatch[1].trim() : '';

                    const order = {
                        platform: 'swiggy',
                        order_id: `swiggy_${orderNumber}`,
                        order_number: orderNumber,
                        customer_name: 'Swiggy Customer',
                        customer_phone: '',
                        customer_address: null,
                        items: [{
                            name: itemsSummary || 'Items',
                            quantity: 1,
                            price: total,
                            modifiers: null,
                            special_instructions: null
                        }],
                        total: total,
                        status: 'delivered',
                        is_historical: true,
                        created_at: createdAt
                    };

                    processedOrderIds.add(orderNumber);
                    orders.push(order);

                    if (CONFIG.global.logExtractions) {
                        console.log('[UniversalExtractor] Swiggy history order:', orderNumber, total);
                    }
                } catch (e) {
                    console.warn('[UniversalExtractor] Error extracting Swiggy history order:', e);
                }
            });
        } else if (CONFIG.platform === 'zomato') {
            // Zomato Order History: Cards with DELIVERED badge
            // Format: "DELIVERED 10:18 PM | 2 January\nID: 7651050106\nBy Customer Name\n1 x Item\n₹383.25"

            // Find all potential order cards
            const orderCards = document.querySelectorAll('[class*="order"], [class*="card"]');

            orderCards.forEach(card => {
                try {
                    const textContent = card.textContent || '';

                    // Must have DELIVERED badge
                    if (!textContent.includes('DELIVERED')) return;

                    // Extract order ID (10-digit number after "ID:")
                    const idMatch = textContent.match(/ID:\s*(\d{10})/);
                    if (!idMatch) return;

                    const orderId = idMatch[1];
                    const orderNumber = orderId.slice(-4); // Last 4 digits

                    // Skip if already processed
                    if (processedOrderIds.has(orderId)) return;

                    // Extract total
                    const totalMatch = textContent.match(/₹\s*([\d,]+\.?\d*)/g);
                    let total = 0;
                    if (totalMatch && totalMatch.length > 0) {
                        // Take the last ₹ amount (usually the total)
                        const lastAmount = totalMatch[totalMatch.length - 1];
                        total = parseFloat(lastAmount.replace(/[₹,\s]/g, ''));
                    }

                    // Extract date/time (format: "10:18 PM | 2 January")
                    const timeMatch = textContent.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*\|\s*(\d{1,2}\s+\w+)/i);
                    let createdAt = new Date().toISOString();
                    if (timeMatch) {
                        try {
                            const dateStr = `${timeMatch[2]} 2026 ${timeMatch[1]}`;
                            const parsed = new Date(dateStr);
                            if (!isNaN(parsed.getTime())) {
                                createdAt = parsed.toISOString();
                            }
                        } catch (e) { /* use default */ }
                    }

                    // Check if within date range
                    if (!isWithinDaysRange(createdAt, historyDaysToFetch)) return;

                    // Extract customer name (after "By ")
                    const customerMatch = textContent.match(/By\s+([^\n]+)/);
                    const customerName = customerMatch ? customerMatch[1].trim() : 'Zomato Customer';

                    // Extract items
                    const itemMatches = textContent.match(/(\d+)\s*x\s*([^\n₹]+)/g) || [];
                    const items = itemMatches.map(match => {
                        const itemMatch = match.match(/(\d+)\s*x\s*(.+)/);
                        return {
                            name: itemMatch ? itemMatch[2].trim() : match,
                            quantity: itemMatch ? parseInt(itemMatch[1]) : 1,
                            price: 0,
                            modifiers: null,
                            special_instructions: null
                        };
                    });

                    const order = {
                        platform: 'zomato',
                        order_id: `zomato_${orderId}`,
                        order_number: orderNumber,
                        customer_name: customerName,
                        customer_phone: '',
                        customer_address: null,
                        items: items.length > 0 ? items : [{
                            name: 'Items',
                            quantity: 1,
                            price: total,
                            modifiers: null,
                            special_instructions: null
                        }],
                        total: total,
                        status: 'delivered',
                        is_historical: true,
                        created_at: createdAt
                    };

                    processedOrderIds.add(orderId);
                    orders.push(order);

                    if (CONFIG.global.logExtractions) {
                        console.log('[UniversalExtractor] Zomato history order:', orderId, total);
                    }
                } catch (e) {
                    console.warn('[UniversalExtractor] Error extracting Zomato history order:', e);
                }
            });
        }

        console.log('[UniversalExtractor] Found', orders.length, 'historical orders within', historyDaysToFetch, 'days');
        return orders;
    }

    /**
     * Scroll to load more historical orders
     * Many aggregator dashboards use infinite scroll
     */
    async function loadMoreHistoricalOrders() {
        const scrollContainer = document.querySelector('[class*="scroll"], [class*="orders-list"], main, .main-content') || document.body;
        const initialHeight = scrollContainer.scrollHeight;

        // Scroll to bottom
        scrollContainer.scrollTo(0, scrollContainer.scrollHeight);
        await sleep(1500);

        // Check if more content loaded
        return scrollContainer.scrollHeight > initialHeight;
    }

    /**
     * Main history extraction function
     * Navigates to past orders and extracts all orders within date range
     */
    async function fetchHistoricalOrders(days = 2) {
        console.log('[UniversalExtractor] Starting historical order fetch for', days, 'days');
        isHistoryMode = true;
        historyDaysToFetch = days;

        // Clear processed IDs so we can re-extract in history mode
        processedOrderIds.clear();

        // Navigate to past orders
        const navigated = await navigateToPastOrders();
        if (!navigated) {
            console.warn('[UniversalExtractor] Could not navigate to past orders');
            // Still try to extract from current view
        }

        await sleep(2000); // Wait for initial load

        let allOrders = [];
        let maxScrollAttempts = 10;
        let scrollAttempts = 0;

        // Extract and scroll until we have enough or no more orders
        while (scrollAttempts < maxScrollAttempts) {
            const orders = extractHistoricalOrders();

            // Merge new orders (avoid duplicates)
            const existingIds = new Set(allOrders.map(o => o.order_id));
            const newOrders = orders.filter(o => !existingIds.has(o.order_id));
            allOrders = allOrders.concat(newOrders);

            console.log('[UniversalExtractor] Total historical orders so far:', allOrders.length);

            // Try to load more
            const loadedMore = await loadMoreHistoricalOrders();
            if (!loadedMore) {
                console.log('[UniversalExtractor] No more orders to load');
                break;
            }

            scrollAttempts++;
        }

        // Send all historical orders to app
        if (allOrders.length > 0) {
            sendOrdersToApp(allOrders);
            console.log('[UniversalExtractor] Sent', allOrders.length, 'historical orders to app');
        }

        // Notify completion
        if (window.__TAURI__?.core) {
            window.__TAURI__.core.invoke('history_extraction_complete', {
                platform: CONFIG.platform,
                count: allOrders.length,
                days: days
            }).catch(e => console.error('History notification failed:', e));
        }

        isHistoryMode = false;
        return allOrders;
    }

    /**
     * Expose global function for triggering history fetch from Rust/JS
     */
    window.fetchAggregatorHistory = function(days) {
        return fetchHistoricalOrders(days || 2);
    };

    // ==================== END HISTORY MODE ====================

    // ==================== DEBUG/TESTING FUNCTIONS ====================

    /**
     * Scan DOM for all actionable buttons and return their status
     * @returns {Object} Object containing arrays of identified buttons by type
     */
    window.identifyButtons = function() {
        console.log('[UniversalExtractor] Identifying buttons...');

        const results = {
            platform: CONFIG.platform,
            timestamp: Date.now(),
            buttons: {
                accept: [],
                reject: [],
                ready: [],
                tabs: []
            },
            summary: {
                totalFound: 0,
                acceptCount: 0,
                rejectCount: 0,
                readyCount: 0,
                tabCount: 0
            },
            selectorStatus: {}
        };

        // Define button types and their selector keys
        const buttonTypes = [
            { type: 'accept', selectorKey: 'acceptButton' },
            { type: 'reject', selectorKey: 'rejectButton' },
            { type: 'ready', selectorKey: 'readyButton' }
        ];

        // Scan each button type
        buttonTypes.forEach(({ type, selectorKey }) => {
            const selectorString = CONFIG.selectors[selectorKey];
            if (!selectorString) {
                results.selectorStatus[type] = { configured: false, selector: null };
                return;
            }

            results.selectorStatus[type] = {
                configured: true,
                selector: selectorString,
                found: false
            };

            const selectors = selectorString.split(',').map(s => s.trim());

            selectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((el, idx) => {
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0;

                        // Try to find associated order ID
                        let orderId = null;
                        let orderEl = el.closest('[id]');
                        if (orderEl && /^\d+$/.test(orderEl.id)) {
                            orderId = orderEl.id;
                        }

                        results.buttons[type].push({
                            type,
                            selector,
                            index: idx,
                            found: true,
                            visible: isVisible,
                            text: el.textContent?.trim().substring(0, 50) || null,
                            orderId,
                            rect: isVisible ? {
                                x: Math.round(rect.x),
                                y: Math.round(rect.y),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height)
                            } : null,
                            tagName: el.tagName,
                            className: el.className?.toString().substring(0, 100) || ''
                        });

                        results.selectorStatus[type].found = true;
                    });
                } catch (e) {
                    console.warn(`[UniversalExtractor] Invalid selector: ${selector}`, e);
                }
            });

            results.summary[`${type}Count`] = results.buttons[type].length;
            results.summary.totalFound += results.buttons[type].length;
        });

        // Scan tabs
        const tabSelectors = [
            { name: 'New', key: 'tabNew' },
            { name: 'Preparing', key: 'tabPreparing' },
            { name: 'Ready', key: 'tabReady' },
            { name: 'Picked Up', key: 'tabPickedUp' },
            { name: 'Past Orders', key: 'tabPastOrders' }
        ];

        tabSelectors.forEach(({ name, key }) => {
            const selector = CONFIG.selectors[key];
            if (selector) {
                const el = querySelector(document, selector);
                results.buttons.tabs.push({
                    type: 'tab',
                    name,
                    selectorKey: key,
                    selector,
                    found: !!el,
                    text: el?.textContent?.trim() || null,
                    isActive: el?.classList.contains('active') ||
                             el?.getAttribute('aria-selected') === 'true' ||
                             el?.getAttribute('data-active') === 'true'
                });
                if (el) results.summary.tabCount++;
            }
        });

        results.summary.totalFound += results.summary.tabCount;

        console.log('[UniversalExtractor] Button identification complete:', results.summary);

        // Send results to Tauri
        if (window.__TAURI__?.core) {
            window.__TAURI__.core.invoke('dashboard_debug_result', {
                resultType: 'identifyButtons',
                platform: CONFIG.platform,
                data: results
            }).catch(e => console.error('Failed to send button identification results:', e));
        }

        return results;
    };

    /**
     * Test clicking a specific button type
     * @param {string} buttonType - 'accept', 'reject', 'ready', or tab name
     * @param {string|null} orderId - Optional order ID to target specific order
     * @param {boolean} dryRun - If true, don't actually click, just verify element exists
     * @returns {Promise<Object>} Click test result
     */
    window.testClick = async function(buttonType, orderId = null, dryRun = false) {
        console.log(`[UniversalExtractor] Testing click: ${buttonType}, orderId: ${orderId}, dryRun: ${dryRun}`);

        const result = {
            success: false,
            buttonType,
            orderId,
            dryRun,
            message: '',
            timestamp: Date.now(),
            elementInfo: null
        };

        try {
            let element = null;
            let selector = '';

            // Handle tab clicks
            const tabNames = ['new', 'preparing', 'ready', 'picked up', 'past orders'];
            if (buttonType.toLowerCase().includes('tab') ||
                tabNames.includes(buttonType.toLowerCase())) {
                const tabKey = `tab${buttonType.replace(/\s+/g, '').replace(/tab/i, '')}`;
                selector = CONFIG.selectors[tabKey] || CONFIG.selectors[`tabName-${buttonType}`];
                if (selector) {
                    element = querySelector(document, selector);
                }
            } else {
                // Handle action buttons (accept, reject, ready)
                const selectorKey = `${buttonType}Button`;
                selector = CONFIG.selectors[selectorKey];

                if (!selector) {
                    result.message = `No selector configured for button type: ${buttonType}`;
                    sendDebugResult('testClick', result);
                    return result;
                }

                // If orderId provided, find button within that order
                if (orderId) {
                    const orderContainer = document.getElementById(orderId) ||
                                          document.querySelector(`[data-order-id="${orderId}"]`);
                    if (orderContainer) {
                        element = querySelector(orderContainer, selector);
                    } else {
                        result.message = `Order container not found for ID: ${orderId}`;
                        sendDebugResult('testClick', result);
                        return result;
                    }
                } else {
                    // Find first available button
                    element = querySelector(document, selector);
                }
            }

            if (!element) {
                result.message = `Element not found for selector: ${selector}`;
                sendDebugResult('testClick', result);
                return result;
            }

            // Get element info
            const rect = element.getBoundingClientRect();
            result.elementInfo = {
                tagName: element.tagName,
                text: element.textContent?.trim().substring(0, 50),
                className: element.className?.toString().substring(0, 100),
                visible: rect.width > 0 && rect.height > 0,
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
            };

            if (dryRun) {
                result.success = true;
                result.message = `Dry run: Element found and clickable`;
                sendDebugResult('testClick', result);
                return result;
            }

            // Perform the click
            element.click();

            // Wait a bit to see if anything happens
            await sleep(500);

            result.success = true;
            result.message = `Successfully clicked ${buttonType} button`;

        } catch (error) {
            result.message = `Error during click test: ${error.message}`;
            console.error('[UniversalExtractor] Click test error:', error);
        }

        sendDebugResult('testClick', result);
        return result;
    };

    /**
     * Get current page state including active tab, visible orders, and detected elements
     * @returns {Object} Page state object
     */
    window.getPageState = function() {
        console.log('[UniversalExtractor] Getting page state...');

        const state = {
            platform: CONFIG.platform,
            timestamp: Date.now(),
            currentUrl: window.location.href,
            activeTab: null,
            visibleOrders: 0,
            detectedTabs: [],
            orderIds: [],
            buttonCounts: {
                accept: 0,
                reject: 0,
                ready: 0
            },
            pageReady: document.readyState === 'complete',
            loginRequired: false
        };

        // Detect active tab
        const tabSelectors = ['tabNew', 'tabPreparing', 'tabReady', 'tabPickedUp', 'tabPastOrders'];
        tabSelectors.forEach(key => {
            const selector = CONFIG.selectors[key];
            if (selector) {
                const el = querySelector(document, selector);
                if (el) {
                    const tabName = key.replace('tab', '').replace(/([A-Z])/g, ' $1').trim();
                    state.detectedTabs.push(tabName);

                    // Check if this tab is active
                    const isActive = el.classList.contains('active') ||
                                   el.getAttribute('aria-selected') === 'true' ||
                                   el.getAttribute('data-active') === 'true' ||
                                   el.closest('[class*="active"]') !== null;
                    if (isActive) {
                        state.activeTab = tabName;
                    }
                }
            }
        });

        // Count visible orders
        if (CONFIG.platform === 'zomato') {
            const orderDivs = document.querySelectorAll('div[id]');
            orderDivs.forEach(div => {
                if (/^\d{10}$/.test(div.id)) {
                    state.visibleOrders++;
                    state.orderIds.push(div.id);
                }
            });
        } else {
            const orders = querySelectorAll(document, CONFIG.selectors.orderContainer);
            state.visibleOrders = orders.length;
            orders.forEach(order => {
                const numEl = querySelector(order, CONFIG.selectors.orderNumber);
                if (numEl) {
                    const num = numEl.textContent?.replace('#', '').trim();
                    if (num) state.orderIds.push(num);
                }
            });
        }

        // Count buttons
        ['accept', 'reject', 'ready'].forEach(type => {
            const selector = CONFIG.selectors[`${type}Button`];
            if (selector) {
                const elements = querySelectorAll(document, selector);
                state.buttonCounts[type] = elements.length;
            }
        });

        // Check for login page indicators
        state.loginRequired = !!(
            document.querySelector('input[type="password"]') ||
            document.querySelector('[class*="login"]') ||
            document.querySelector('form[action*="login"]') ||
            window.location.href.includes('login')
        );

        console.log('[UniversalExtractor] Page state:', state);

        sendDebugResult('pageState', state);
        return state;
    };

    /**
     * Navigate to a specific tab
     * @param {string} tabName - 'New', 'Preparing', 'Ready', 'Picked Up', 'Past Orders'
     * @returns {Promise<Object>} Navigation result
     */
    window.navigateToTab = async function(tabName) {
        console.log(`[UniversalExtractor] Navigating to tab: ${tabName}`);

        const result = { success: false, message: '', tabName };

        // Map tab names to selector keys
        const tabMap = {
            'new': 'tabNew',
            'preparing': 'tabPreparing',
            'ready': 'tabReady',
            'picked up': 'tabPickedUp',
            'pickedup': 'tabPickedUp',
            'past orders': 'tabPastOrders',
            'pastorders': 'tabPastOrders',
            'past': 'tabPastOrders'
        };

        const selectorKey = tabMap[tabName.toLowerCase()];
        if (!selectorKey) {
            result.message = `Unknown tab name: ${tabName}`;
            sendDebugResult('navigateToTab', result);
            return result;
        }

        const selector = CONFIG.selectors[selectorKey];
        if (!selector) {
            result.message = `No selector configured for tab: ${tabName}`;
            sendDebugResult('navigateToTab', result);
            return result;
        }

        const tabElement = querySelector(document, selector);
        if (!tabElement) {
            result.message = `Tab element not found: ${selector}`;
            sendDebugResult('navigateToTab', result);
            return result;
        }

        tabElement.click();
        await sleep(1500); // Wait for tab content to load

        result.success = true;
        result.message = `Successfully navigated to ${tabName} tab`;

        sendDebugResult('navigateToTab', result);
        return result;
    };

    /**
     * Verify all configured selectors against current DOM
     * @returns {Object} Selector verification results
     */
    window.verifySelectorConfig = function() {
        console.log('[UniversalExtractor] Verifying selector configuration...');

        const results = {
            platform: CONFIG.platform,
            timestamp: Date.now(),
            selectors: {},
            summary: {
                total: 0,
                found: 0,
                missing: 0
            }
        };

        // Check all selectors in config
        Object.entries(CONFIG.selectors).forEach(([key, selectorString]) => {
            results.summary.total++;

            const selectorParts = selectorString.split(',').map(s => s.trim());
            let found = false;
            let matchedSelector = null;
            let elementCount = 0;

            for (const selector of selectorParts) {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        found = true;
                        matchedSelector = selector;
                        elementCount = elements.length;
                        break;
                    }
                } catch (e) {
                    // Invalid selector
                }
            }

            results.selectors[key] = {
                configured: selectorString,
                found,
                matchedSelector,
                elementCount,
                status: found ? 'ok' : 'missing'
            };

            if (found) {
                results.summary.found++;
            } else {
                results.summary.missing++;
            }
        });

        console.log('[UniversalExtractor] Selector verification:', results.summary);

        sendDebugResult('verifySelectors', results);
        return results;
    };

    /**
     * Helper to send debug results to Tauri
     */
    function sendDebugResult(resultType, data) {
        if (window.__TAURI__?.core) {
            window.__TAURI__.core.invoke('dashboard_debug_result', {
                resultType,
                platform: CONFIG.platform,
                data
            }).catch(e => console.error(`Failed to send ${resultType} result:`, e));
        }
    }

    // ==================== END DEBUG/TESTING FUNCTIONS ====================

    // ==================== CONTINUOUS EXTRACTION SERVICE ====================

    /**
     * Store for tracked order states (with buttons and customer details)
     */
    const orderStates = new Map();
    let extractionServiceActive = false;
    let extractionInterval = null;

    /**
     * Extract all action buttons for an order element
     * @param {HTMLElement} orderElement - The order container element
     * @param {string} orderId - The order ID
     * @returns {Array} Array of button states
     */
    function extractOrderButtons(orderElement, orderId) {
        const buttons = [];
        const buttonTypes = [
            { type: 'accept', selectorKey: 'acceptButton', textPatterns: ['accept', 'confirm', 'start'] },
            { type: 'reject', selectorKey: 'rejectButton', textPatterns: ['reject', 'decline', 'cancel'] },
            { type: 'ready', selectorKey: 'readyButton', textPatterns: ['ready', 'food ready', 'prepared', 'mark ready'] },
            { type: 'print', selectorKey: 'printButton', textPatterns: ['print', 'kot'] },
            { type: 'delay', selectorKey: 'delayButton', textPatterns: ['delay', 'more time', 'extra time'] },
            { type: 'callCustomer', selectorKey: 'callCustomerButton', textPatterns: ['call customer', 'call'] },
            { type: 'callDriver', selectorKey: 'callDriverButton', textPatterns: ['call driver', 'call de'] }
        ];

        buttonTypes.forEach(({ type, selectorKey, textPatterns }) => {
            const selector = CONFIG.selectors[selectorKey];
            if (!selector) return;

            const selectors = selector.split(',').map(s => s.trim());

            selectors.forEach(sel => {
                try {
                    const elements = orderElement.querySelectorAll(sel);
                    elements.forEach((el, index) => {
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0;
                        const text = el.textContent?.trim().toLowerCase() || '';

                        // Verify button type by text pattern
                        const matchesPattern = textPatterns.some(p => text.includes(p));

                        buttons.push({
                            type,
                            selector: sel,
                            index,
                            visible: isVisible,
                            enabled: !el.disabled && !el.classList.contains('disabled'),
                            text: el.textContent?.trim().substring(0, 50) || '',
                            matchesPattern,
                            orderId,
                            rect: isVisible ? {
                                x: Math.round(rect.x),
                                y: Math.round(rect.y),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height)
                            } : null,
                            tagName: el.tagName,
                            className: el.className?.toString().substring(0, 100) || '',
                            dataAttributes: extractDataAttributes(el)
                        });
                    });
                } catch (e) {
                    // Invalid selector, skip
                }
            });
        });

        // Also scan for any button-like elements we might have missed
        const allButtons = orderElement.querySelectorAll('button, [role="button"], [class*="btn"], [class*="button"]');
        allButtons.forEach((el, index) => {
            const text = el.textContent?.trim().toLowerCase() || '';
            const existingMatch = buttons.find(b => b.text.toLowerCase() === text);

            if (!existingMatch && text.length > 0 && text.length < 30) {
                const rect = el.getBoundingClientRect();
                buttons.push({
                    type: 'unknown',
                    selector: 'button, [role="button"]',
                    index,
                    visible: rect.width > 0 && rect.height > 0,
                    enabled: !el.disabled,
                    text: el.textContent?.trim().substring(0, 50) || '',
                    matchesPattern: false,
                    orderId,
                    rect: rect.width > 0 ? {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    } : null,
                    tagName: el.tagName,
                    className: el.className?.toString().substring(0, 100) || ''
                });
            }
        });

        return buttons;
    }

    /**
     * Extract data attributes from an element
     */
    function extractDataAttributes(el) {
        const attrs = {};
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                attrs[attr.name] = attr.value;
            }
        });
        return Object.keys(attrs).length > 0 ? attrs : null;
    }

    /**
     * Extract customer details from order element (especially for Zomato)
     * @param {HTMLElement} orderElement - The order container
     * @returns {Object} Customer details
     */
    function extractCustomerDetails(orderElement) {
        const customer = {
            name: null,
            phone: null,
            address: null,
            landmark: null,
            flatNumber: null,
            building: null,
            orderCount: null
        };

        if (CONFIG.platform === 'zomato') {
            // Zomato-specific extraction
            // Customer name
            const nameSelectors = CONFIG.selectors.customerName || '.sc-jzJRlG.sc-feJyhm, .css-1g27dnw span, [class*="customer-name"]';
            const nameEl = querySelector(orderElement, nameSelectors);
            if (nameEl) {
                customer.name = cleanCustomerName(nameEl.textContent?.trim()) || null;
            }

            // Phone number - Zomato often shows masked phone like XXX-XXX-1234
            const phoneSelectors = CONFIG.selectors.customerPhone || '[class*="phone"], [class*="mobile"], [href^="tel:"], a[class*="call"]';
            const phoneEl = querySelector(orderElement, phoneSelectors);
            if (phoneEl) {
                let phoneText = phoneEl.textContent?.trim() || phoneEl.getAttribute('href')?.replace('tel:', '') || '';
                // Clean up phone number
                phoneText = phoneText.replace(/[^\d\-\s\+X]/g, '').trim();
                if (phoneText.length >= 10) {
                    customer.phone = phoneText;
                }
            }

            // Also look for phone in click-to-call buttons
            if (!customer.phone) {
                const callButtons = orderElement.querySelectorAll('button, [role="button"]');
                callButtons.forEach(btn => {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('call') && !text.includes('driver')) {
                        // Try to find phone in onclick or data attribute
                        const onclick = btn.getAttribute('onclick') || '';
                        const phoneMatch = onclick.match(/(\d{10})/);
                        if (phoneMatch) {
                            customer.phone = phoneMatch[1];
                        }
                    }
                });
            }

            // Address - Zomato shows detailed address with building, flat, landmark
            const addressSelectors = CONFIG.selectors.customerAddress || '.css-1d0eedk, [class*="address"], [class*="delivery-location"]';
            const addressEls = orderElement.querySelectorAll(addressSelectors);
            const addressParts = [];

            addressEls.forEach((el, idx) => {
                const text = el.textContent?.trim();
                if (text && text.length > 5 && idx > 0) { // Skip first one (usually location header)
                    addressParts.push(text);

                    // Try to extract structured address parts
                    if (text.toLowerCase().includes('flat') || text.match(/^#?\d+/)) {
                        customer.flatNumber = text;
                    } else if (text.toLowerCase().includes('tower') || text.toLowerCase().includes('building')) {
                        customer.building = text;
                    } else if (text.toLowerCase().includes('near') || text.toLowerCase().includes('landmark')) {
                        customer.landmark = text;
                    }
                }
            });

            if (addressParts.length > 0) {
                customer.address = addressParts.join(', ');
            }

            // Order count for repeat customers
            const orderCountEl = orderElement.querySelector('[class*="order-count"], [class*="repeat"]');
            if (orderCountEl) {
                const countMatch = orderCountEl.textContent?.match(/(\d+)/);
                if (countMatch) {
                    customer.orderCount = parseInt(countMatch[1], 10);
                }
            }

        } else {
            // Swiggy extraction
            const nameEl = querySelector(orderElement, CONFIG.selectors.customerName || '[data-testid*="customer"]');
            if (nameEl) {
                customer.name = cleanCustomerName(nameEl.textContent?.trim()) || null;
            }

            const phoneEl = querySelector(orderElement, CONFIG.selectors.customerPhone || '[data-testid*="phone"]');
            if (phoneEl) {
                customer.phone = phoneEl.textContent?.trim() || null;
            }

            const addressEl = querySelector(orderElement, CONFIG.selectors.customerAddress || '[data-testid*="address"]');
            if (addressEl) {
                customer.address = addressEl.textContent?.trim() || null;
            }
        }

        return customer;
    }

    /**
     * Extract delivery partner info if assigned
     */
    function extractDeliveryPartner(orderElement) {
        const partner = {
            name: null,
            phone: null,
            vehicleNumber: null,
            eta: null,
            status: null
        };

        const partnerSelectors = CONFIG.selectors.deliveryPartner || '[class*="rider"], [class*="driver"], [class*="delivery-executive"], [class*="de-"]';
        const partnerEl = querySelector(orderElement, partnerSelectors);

        if (partnerEl) {
            // Try to extract name
            const nameEl = partnerEl.querySelector('[class*="name"]') || partnerEl;
            if (nameEl) {
                const text = nameEl.textContent?.trim() || '';
                // Filter out common non-name text
                if (text.length > 2 && !text.toLowerCase().includes('assign') && !text.toLowerCase().includes('finding')) {
                    partner.name = text.substring(0, 50);
                }
            }

            // Phone
            const phoneEl = partnerEl.querySelector('[href^="tel:"], [class*="phone"]');
            if (phoneEl) {
                partner.phone = phoneEl.textContent?.trim() || phoneEl.getAttribute('href')?.replace('tel:', '') || null;
            }

            // Vehicle number
            const vehicleEl = partnerEl.querySelector('[class*="vehicle"], [class*="bike"], [class*="number"]');
            if (vehicleEl) {
                const vehicleText = vehicleEl.textContent?.trim() || '';
                if (vehicleText.match(/^[A-Z]{2}\d/i)) { // Vehicle number format
                    partner.vehicleNumber = vehicleText;
                }
            }

            // ETA
            const etaEl = partnerEl.querySelector('[class*="eta"], [class*="time"], [class*="arriving"]');
            if (etaEl) {
                partner.eta = etaEl.textContent?.trim() || null;
            }
        }

        // Check for "finding rider" or "rider assigned" status
        const statusSelectors = '[class*="rider-status"], [class*="de-status"], [class*="delivery-status"]';
        const statusEl = querySelector(orderElement, statusSelectors);
        if (statusEl) {
            partner.status = statusEl.textContent?.trim() || null;
        }

        return partner.name || partner.status ? partner : null;
    }

    /**
     * Extract prep time remaining if shown
     */
    function extractPrepTime(orderElement) {
        const prepTimeSelectors = CONFIG.selectors.prepTimeRemaining || '[class*="prep-time"], [class*="timer"], [class*="countdown"], [class*="time-remaining"]';
        const prepTimeEl = querySelector(orderElement, prepTimeSelectors);

        if (prepTimeEl) {
            const text = prepTimeEl.textContent?.trim() || '';
            // Try to extract minutes
            const match = text.match(/(\d+)\s*(?:min|m|mins)/i);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        return null;
    }

    /**
     * Extract complete order state including buttons and customer
     * @param {HTMLElement} orderElement - Order container
     * @returns {Object|null} Complete order state
     */
    function extractOrderState(orderElement) {
        try {
            let orderId, orderNumber;

            if (CONFIG.platform === 'zomato') {
                orderId = orderElement.id || '';
                const idEl = orderElement.querySelector('.css-16jdd3h span span, .css-1q76sun span');
                if (idEl) {
                    orderId = orderId || idEl.textContent?.trim();
                }
                const idText = orderElement.querySelector('.css-16jdd3h')?.textContent || '';
                const match = idText.match(/ID:\s*(\d{4})/i);
                orderNumber = match ? match[1] : orderId.slice(-4);
            } else {
                // Swiggy
                const orderNumEl = querySelector(orderElement, CONFIG.selectors.orderNumber);
                orderNumber = orderNumEl?.textContent?.trim().replace('#', '') || '';
                orderId = `swiggy_${orderNumber}`;
            }

            if (!orderId || !orderNumber) {
                return null;
            }

            // Extract status from dashboard
            let dashboardStatus = 'unknown';
            const statusEl = querySelector(orderElement, CONFIG.selectors.orderStatus || '[class*="status"]');
            if (statusEl) {
                dashboardStatus = statusEl.textContent?.trim().toLowerCase() || 'unknown';
            }

            // Check for status badges or pills
            const statusBadges = orderElement.querySelectorAll('[class*="badge"], [class*="pill"], [class*="tag"]');
            statusBadges.forEach(badge => {
                const text = badge.textContent?.trim().toLowerCase();
                if (text && ['new', 'preparing', 'ready', 'picked', 'delivered', 'accepted'].some(s => text.includes(s))) {
                    dashboardStatus = text;
                }
            });

            // Extract total
            let total = 0;
            const totalEl = querySelector(orderElement, CONFIG.selectors.orderTotal || '[class*="total"], [class*="amount"]');
            if (totalEl) {
                const totalMatch = totalEl.textContent?.match(/₹?\s*([\d,]+\.?\d*)/);
                if (totalMatch) {
                    total = parseFloat(totalMatch[1].replace(',', ''));
                }
            }

            const state = {
                platform: CONFIG.platform,
                orderId: CONFIG.platform === 'zomato' ? `zomato_${orderNumber}` : orderId,
                orderNumber,
                dashboardStatus,
                buttons: extractOrderButtons(orderElement, orderId),
                customer: extractCustomerDetails(orderElement),
                deliveryPartner: extractDeliveryPartner(orderElement),
                prepTimeRemaining: extractPrepTime(orderElement),
                total,
                isSelected: orderElement.classList.contains('selected') || orderElement.matches(':focus-within'),
                isExpanded: orderElement.classList.contains('expanded') || orderElement.querySelector('[class*="expanded"]') !== null,
                extractedAt: Date.now()
            };

            return state;

        } catch (error) {
            console.error('[UniversalExtractor] Error extracting order state:', error);
            return null;
        }
    }

    /**
     * Scan all orders and extract their states
     */
    function extractAllOrderStates() {
        const states = [];
        let orderElements = [];

        if (CONFIG.platform === 'zomato') {
            const allDivs = document.querySelectorAll('div[id]');
            allDivs.forEach(div => {
                if (/^\d{10}$/.test(div.id)) {
                    orderElements.push(div);
                }
            });
            if (orderElements.length === 0) {
                orderElements = Array.from(querySelectorAll(document, CONFIG.selectors.orderContainer));
            }
        } else {
            orderElements = Array.from(querySelectorAll(document, CONFIG.selectors.orderContainer));
        }

        orderElements.forEach(element => {
            const state = extractOrderState(element);
            if (state) {
                states.push(state);
                orderStates.set(state.orderId, state);
            }
        });

        return states;
    }

    /**
     * Send extracted states to Tauri app
     */
    function sendStatesToApp(states) {
        if (!window.__TAURI__ || !window.__TAURI__.core) {
            console.error('[UniversalExtractor] Tauri API not available');
            return;
        }

        window.__TAURI__.core.invoke('process_extracted_states', {
            platform: CONFIG.platform,
            states,
            timestamp: Date.now()
        })
        .then(() => {
            if (CONFIG.global.logExtractions) {
                console.log('[UniversalExtractor] Sent', states.length, 'order states to app');
            }
        })
        .catch(err => {
            console.error('[UniversalExtractor] Failed to send states:', err);
        });
    }

    /**
     * Execute an action (click a button) on an order
     * @param {string} orderId - The order ID
     * @param {string} actionType - Type of action (accept, reject, ready, etc.)
     * @returns {Promise<Object>} Result of the action
     */
    window.executeOrderAction = async function(orderId, actionType) {
        console.log(`[UniversalExtractor] Executing action: ${actionType} for order ${orderId}`);

        const result = {
            success: false,
            actionType,
            orderId,
            platform: CONFIG.platform,
            message: '',
            timestamp: Date.now()
        };

        try {
            // Find the order element
            let orderElement = null;

            if (CONFIG.platform === 'zomato') {
                // For Zomato, try to find by full ID or last 4 digits
                const shortId = orderId.replace('zomato_', '');
                orderElement = document.getElementById(shortId) ||
                              document.querySelector(`[id$="${shortId}"]`) ||
                              document.querySelector(`div[id*="${shortId}"]`);
            } else {
                // For Swiggy
                const shortId = orderId.replace('swiggy_', '');
                const orderContainers = querySelectorAll(document, CONFIG.selectors.orderContainer);
                for (const container of orderContainers) {
                    const numEl = querySelector(container, CONFIG.selectors.orderNumber);
                    if (numEl?.textContent?.includes(shortId)) {
                        orderElement = container;
                        break;
                    }
                }
            }

            if (!orderElement) {
                result.message = `Order element not found for ID: ${orderId}`;
                sendActionResult(result);
                return result;
            }

            // Find the button
            const buttonMap = {
                'accept': CONFIG.selectors.acceptButton,
                'reject': CONFIG.selectors.rejectButton,
                'ready': CONFIG.selectors.readyButton,
                'print': CONFIG.selectors.printButton,
                'delay': CONFIG.selectors.delayButton,
                'callCustomer': CONFIG.selectors.callCustomerButton,
                'callDriver': CONFIG.selectors.callDriverButton
            };

            const selector = buttonMap[actionType];
            if (!selector) {
                result.message = `No selector configured for action: ${actionType}`;
                sendActionResult(result);
                return result;
            }

            const button = querySelector(orderElement, selector);
            if (!button) {
                // Try to find button by text content
                const allButtons = orderElement.querySelectorAll('button, [role="button"]');
                let foundButton = null;

                const textPatterns = {
                    'accept': ['accept', 'confirm'],
                    'reject': ['reject', 'decline'],
                    'ready': ['ready', 'food ready', 'mark ready'],
                    'print': ['print'],
                    'delay': ['delay', 'more time']
                };

                const patterns = textPatterns[actionType] || [];
                for (const btn of allButtons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (patterns.some(p => text.includes(p))) {
                        foundButton = btn;
                        break;
                    }
                }

                if (!foundButton) {
                    result.message = `Button not found for action: ${actionType}`;
                    sendActionResult(result);
                    return result;
                }

                // Click the found button
                foundButton.click();
                result.success = true;
                result.message = `Clicked ${actionType} button (by text match)`;

            } else {
                // Click the button found by selector
                button.click();
                result.success = true;
                result.message = `Clicked ${actionType} button`;
            }

            // Wait a bit and re-extract state
            await sleep(1000);
            const newState = extractOrderState(orderElement);
            if (newState) {
                result.newState = newState;
            }

        } catch (error) {
            result.message = `Error executing action: ${error.message}`;
            console.error('[UniversalExtractor] Action execution error:', error);
        }

        sendActionResult(result);
        return result;
    };

    /**
     * Send action result to Tauri
     */
    function sendActionResult(result) {
        if (window.__TAURI__?.core) {
            window.__TAURI__.core.invoke('order_action_result', {
                result
            }).catch(e => console.error('Failed to send action result:', e));
        }
    }

    /**
     * Start continuous extraction service
     */
    window.startExtractionService = function(intervalMs = 3000) {
        if (extractionServiceActive) {
            console.log('[UniversalExtractor] Extraction service already running');
            return;
        }

        console.log('[UniversalExtractor] Starting extraction service, interval:', intervalMs);
        extractionServiceActive = true;

        // Initial extraction
        const states = extractAllOrderStates();
        sendStatesToApp(states);

        // Setup interval
        extractionInterval = setInterval(() => {
            const states = extractAllOrderStates();
            if (states.length > 0) {
                sendStatesToApp(states);
            }
        }, intervalMs);

        return { active: true, interval: intervalMs };
    };

    /**
     * Stop continuous extraction service
     */
    window.stopExtractionService = function() {
        if (!extractionServiceActive) {
            console.log('[UniversalExtractor] Extraction service not running');
            return;
        }

        console.log('[UniversalExtractor] Stopping extraction service');
        extractionServiceActive = false;

        if (extractionInterval) {
            clearInterval(extractionInterval);
            extractionInterval = null;
        }

        return { active: false };
    };

    /**
     * Get current extraction service status
     */
    window.getExtractionServiceStatus = function() {
        return {
            active: extractionServiceActive,
            orderCount: orderStates.size,
            platform: CONFIG.platform
        };
    };

    /**
     * Get all currently tracked order states
     */
    window.getAllOrderStates = function() {
        return Array.from(orderStates.values());
    };

    /**
     * Get single order state
     */
    window.getOrderState = function(orderId) {
        return orderStates.get(orderId) || null;
    };

    // ==================== END CONTINUOUS EXTRACTION SERVICE ====================

    /**
     * Setup MutationObserver to watch for new orders
     */
    function setupMutationObserver() {
        if (!CONFIG.polling.useObserver) {
            return;
        }

        const targetNode = document.body;

        const observer = new MutationObserver((mutations) => {
            const hasNewOrders = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== 1) return false;

                    // Check if it's an order container or contains one
                    const selectors = CONFIG.selectors.orderContainer.split(',').map(s => s.trim());
                    return selectors.some(selector => {
                        try {
                            return node.matches?.(selector) || node.querySelector?.(selector);
                        } catch (e) {
                            return false;
                        }
                    });
                });
            });

            if (hasNewOrders) {
                if (CONFIG.global.debugMode) {
                    console.log('[UniversalExtractor] New orders detected via mutation');
                }
                scanForOrders();
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });

        if (CONFIG.global.debugMode) {
            console.log('[UniversalExtractor] Mutation observer active');
        }
    }

    /**
     * Initialize extractor
     */
    function initialize() {
        if (isInitialized) {
            console.warn('[UniversalExtractor] Already initialized');
            return;
        }

        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }

        console.log('[UniversalExtractor] Initializing...');

        // Initial scan after delay to let page load
        setTimeout(() => {
            const count = scanForOrders();
            console.log('[UniversalExtractor] Initial scan found', count, 'orders');
        }, 2000);

        // Setup polling if enabled
        if (CONFIG.polling.enabled) {
            setInterval(scanForOrders, CONFIG.polling.intervalMs);
            console.log('[UniversalExtractor] Polling every', CONFIG.polling.intervalMs, 'ms');
        }

        // Setup mutation observer
        setupMutationObserver();

        isInitialized = true;
        console.log('[UniversalExtractor] Initialization complete');
    }

    // Start extraction
    initialize();

})(EXTRACTOR_CONFIG);

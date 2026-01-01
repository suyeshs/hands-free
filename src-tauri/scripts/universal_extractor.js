/**
 * Universal Aggregator Order Extractor
 * Works with any aggregator dashboard using configurable selectors
 *
 * This script is injected into dashboard webviews and uses
 * selector configuration passed from Rust backend.
 */

(function(CONFIG) {
    'use strict';

    console.log('[UniversalExtractor] Initializing for platform:', CONFIG.platform);
    console.log('[UniversalExtractor] Config:', CONFIG);

    // Track processed orders
    const processedOrderIds = new Set();
    let isInitialized = false;

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
     * Parse Swiggy order details text format
     * Format: "02:11 PM | ₹437.9 | Otti ( Rice Roti) 2 Piece x 1, Pepper Chicken Fry [Kodava Koli Bharthad] x 1"
     */
    function parseSwiggyOrderDetails(detailsText) {
        if (!detailsText) return { time: null, total: 0, items: [] };

        const parts = detailsText.split('|').map(p => p.trim());

        let time = null;
        let total = 0;
        let items = [];

        if (parts.length >= 3) {
            // First part is time
            time = parts[0];

            // Second part is total (₹437.9)
            const totalMatch = parts[1].match(/₹?\s*([\d,]+\.?\d*)/);
            if (totalMatch) {
                total = parseFloat(totalMatch[1].replace(',', ''));
            }

            // Third part onwards is items
            const itemsText = parts.slice(2).join('|');

            // Parse items: "Otti ( Rice Roti) 2 Piece x 1, Pepper Chicken Fry [Kodava Koli Bharthad] x 1"
            const itemParts = itemsText.split(',').map(i => i.trim());

            itemParts.forEach(itemStr => {
                // Match pattern: "Item Name x Quantity"
                const match = itemStr.match(/^(.+?)\s*x\s*(\d+)\s*$/i);
                if (match) {
                    items.push({
                        name: match[1].trim(),
                        quantity: parseInt(match[2], 10),
                        price: 0,  // Price not available in list view
                        modifiers: null,
                        special_instructions: null
                    });
                } else if (itemStr.trim()) {
                    // Fallback: assume quantity 1
                    items.push({
                        name: itemStr.trim(),
                        quantity: 1,
                        price: 0,
                        modifiers: null,
                        special_instructions: null
                    });
                }
            });
        }

        return { time, total, items };
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
            const customerName = customerNameEl?.textContent?.trim() || 'Zomato Customer';

            // Extract customer address (second .css-1d0eedk contains address)
            const addressEls = orderElement.querySelectorAll('.css-1d0eedk');
            let customerAddress = null;
            if (addressEls.length >= 2) {
                customerAddress = addressEls[1]?.textContent?.trim() || null;
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

            // Extract order time (e.g., "6:39 PM")
            const timeEl = orderElement.querySelector('.bbNJyY, .css-19er1ul b');
            const orderTime = timeEl?.textContent?.trim() || new Date().toISOString();

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
     * Extract Swiggy order from DOM element
     */
    function extractSwiggyOrder(orderElement) {
        try {
            // For Swiggy, the orderElement IS the order number element itself
            // We need to find the parent container that has all order info
            let orderContainer = orderElement;

            // Navigate up to find the full order card container (look for parent with order details)
            let parent = orderElement.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                if (parent.querySelector && parent.querySelector('[data-testid="ordertime_amount_items_text"]')) {
                    orderContainer = parent;
                    break;
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

            // Parse Swiggy-specific format
            const { time, total, items } = parseSwiggyOrderDetails(detailsText);

            // Extract status from the status badge
            let status = 'pending';
            const statusBadges = orderContainer.querySelectorAll('.sc-gtLWhw');
            statusBadges.forEach(badge => {
                const badgeText = badge.textContent?.trim().toUpperCase();
                if (badgeText && badgeText !== 'SWIGGY' && badgeText !== 'VEG' && badgeText !== 'NON-VEG') {
                    status = badgeText.toLowerCase();
                }
            });

            const customerName = getTextContent(
                orderContainer,
                CONFIG.selectors.customerName,
                `Swiggy Customer`
            );

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

            // Build order object
            const order = {
                platform: CONFIG.platform,
                order_id: orderId,
                order_number: orderNumber,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: customerAddress,
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

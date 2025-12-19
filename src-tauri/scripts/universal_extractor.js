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
     * Extract single order from DOM element
     */
    function extractOrder(orderElement) {
        try {
            // Get order ID (try attribute first, then text)
            let orderId = getAttribute(
                orderElement,
                CONFIG.selectors.orderId,
                CONFIG.attributes.orderId
            );

            if (!orderId) {
                orderId = getTextContent(orderElement, CONFIG.selectors.orderId);
            }

            // Skip if no order ID or already processed
            if (!orderId) {
                if (CONFIG.global.debugMode) {
                    console.log('[UniversalExtractor] No order ID found in element:', orderElement);
                }
                return null;
            }

            if (CONFIG.extraction.skipProcessedOrders && processedOrderIds.has(orderId)) {
                return null;
            }

            // Extract basic order info
            const orderNumber = getAttribute(
                orderElement,
                CONFIG.selectors.orderNumber,
                CONFIG.attributes.orderNumber
            ) || getTextContent(orderElement, CONFIG.selectors.orderNumber) || orderId;

            const customerName = getTextContent(
                orderElement,
                CONFIG.selectors.customerName,
                `${CONFIG.platform} Customer`
            );

            const customerPhone = getTextContent(
                orderElement,
                CONFIG.selectors.customerPhone,
                ''
            );

            const customerAddress = getTextContent(
                orderElement,
                CONFIG.selectors.customerAddress,
                null
            );

            // Extract order status
            const status = getAttribute(
                orderElement,
                CONFIG.selectors.orderStatus,
                CONFIG.attributes.orderStatus
            ) || getTextContent(orderElement, CONFIG.selectors.orderStatus, 'pending');

            // Extract timestamp
            const createdAt = getTextContent(
                orderElement,
                CONFIG.selectors.orderTime,
                new Date().toISOString()
            );

            // Extract items
            const items = [];
            const itemsContainer = querySelector(orderElement, CONFIG.selectors.itemsList);

            if (itemsContainer) {
                const itemElements = querySelectorAll(itemsContainer, CONFIG.selectors.itemRow);

                itemElements.forEach(itemEl => {
                    const name = getTextContent(itemEl, CONFIG.selectors.itemName);

                    if (!name) return; // Skip if no name

                    const quantity = parseNumeric(
                        getAttribute(itemEl, CONFIG.selectors.itemQuantity, CONFIG.attributes.itemQuantity) ||
                        getTextContent(itemEl, CONFIG.selectors.itemQuantity, '1')
                    );

                    const price = parseNumeric(
                        getTextContent(itemEl, CONFIG.selectors.itemPrice, '0')
                    );

                    const modifiers = getTextContent(itemEl, CONFIG.selectors.itemModifiers, null);
                    const specialInstructions = getTextContent(itemEl, CONFIG.selectors.specialInstructions, null);

                    items.push({
                        name,
                        quantity,
                        price,
                        modifiers: modifiers ? modifiers.split(',').map(m => m.trim()) : null,
                        special_instructions: specialInstructions
                    });
                });
            }

            // Extract total
            const totalText = getTextContent(orderElement, CONFIG.selectors.orderTotal, '0');
            const total = parseNumeric(totalText);

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
                created_at: createdAt
            };

            // Mark as processed
            if (CONFIG.extraction.skipProcessedOrders) {
                processedOrderIds.add(orderId);
            }

            if (CONFIG.global.logExtractions) {
                console.log('[UniversalExtractor] Extracted order:', order.order_number);
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
        const orderElements = querySelectorAll(document, CONFIG.selectors.orderContainer);

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

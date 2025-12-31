/**
 * Point of Sale Store
 * Manages menu, cart, and order state
 */

import { create } from 'zustand';
import {
  MenuItem,
  CartItem,
  Order,
  OrderType,
  PaymentMethod,
  CartModifier,
  TableSession,
  KOTRecord,
  ComboSelection,
  TodaysSpecialItem,
} from '../types/pos';
import { handsfreeApi, HandsfreeOrderPayload, getTodaysSpecials } from '../lib/handsfreeApi';
import { tableSessionService } from '../lib/tableSessionService';
import { useKDSStore } from './kdsStore';
import { useMenuStore } from './menuStore';
import { printerService } from '../lib/printerService';
import { usePrinterStore } from './printerStore';

interface POSStore {
  // Menu state
  menuItems: MenuItem[];
  selectedCategory: string; // Dynamic category ID or 'all' or 'todays-special'
  searchQuery: string;

  // Today's Specials (quick access items from admin panel)
  todaysSpecials: TodaysSpecialItem[];
  specialsLoaded: boolean;

  // Cart state
  cart: CartItem[];
  orderType: OrderType;
  tableNumber: number | null;
  notes: string;

  // Table Management (Open Tabs)
  activeTables: Record<number, TableSession>; // Table Number -> Open Session with Order

  // Order state
  currentOrder: Order | null;
  recentOrders: Order[];
  isLoading: boolean;
  error: string | null;

  // Menu actions
  setMenuItems: (items: MenuItem[]) => void;
  setSelectedCategory: (category: string) => void; // Dynamic category ID or 'all' or 'todays-special'
  setSearchQuery: (query: string) => void;
  fetchMenu: (tenantId: string) => Promise<void>;

  // Today's Specials actions
  loadTodaysSpecials: (tenantId: string) => Promise<void>;

  // Cart actions
  addToCart: (menuItem: MenuItem, quantity: number, modifiers: CartModifier[], specialInstructions?: string, comboSelections?: ComboSelection[]) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateModifiers: (cartItemId: string, modifiers: CartModifier[]) => void;
  clearCart: () => void;

  // Table actions
  setTableNumber: (tableNumber: number | null) => void;
  sendToKitchen: (tenantId: string) => Promise<void>;
  getTableOrder: (tableNumber: number) => Order | null;
  getTableSession: (tableNumber: number) => TableSession | null;
  setGuestCount: (tableNumber: number, guestCount: number, tenantId?: string) => void;
  openTable: (tableNumber: number, guestCount: number, tenantId?: string) => void;
  clearTable: (tableNumber: number, tenantId?: string) => void;
  clearAllTables: (tenantId?: string) => Promise<void>;
  clearAllTableSessions: () => void; // Clear in-memory state only (for diagnostics)
  loadTableSessions: (tenantId: string) => Promise<void>;

  // Order actions
  setOrderType: (type: OrderType) => void;
  setNotes: (notes: string) => void;
  submitOrder: (tenantId: string, paymentMethod: PaymentMethod) => Promise<Order>;
  updateLastOrderNumber: (orderNumber: string) => void;

  // KOT tracking
  isKotPrintedForTable: (tableNumber: number) => boolean;
  getKotRecordsForTable: (tableNumber: number) => KOTRecord[];

  // Computed
  getCartTotal: () => { subtotal: number; tax: number; total: number };
  getFilteredMenu: () => MenuItem[];
}

// NOTE: Menu items are now loaded from menuStore (synced from HandsFree API)
// No longer using mock data

export const usePOSStore = create<POSStore>((set, get) => ({
  // Initial state
  menuItems: [], // Menu is loaded from menuStore
  selectedCategory: 'all',
  searchQuery: '',
  todaysSpecials: [],
  specialsLoaded: false,
  cart: [],
  orderType: 'dine-in',
  tableNumber: null,
  notes: '',
  activeTables: {},
  currentOrder: null,
  recentOrders: [],
  isLoading: false,
  error: null,

  // Menu actions
  setMenuItems: (items) => set({ menuItems: items }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchMenu: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });
      // Menu is now loaded from menuStore (synced from HandsFree API)
      set({ isLoading: false });
    } catch (error) {
      console.error('[POSStore] Failed to fetch menu:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch menu',
        isLoading: false,
      });
    }
  },

  // Today's Specials - load from admin panel API
  loadTodaysSpecials: async (tenantId) => {
    try {
      console.log('[POSStore] Loading today\'s specials for tenant:', tenantId);
      const specials = await getTodaysSpecials(tenantId);
      set({ todaysSpecials: specials, specialsLoaded: true });
      console.log(`[POSStore] Loaded ${specials.length} today's specials`);
    } catch (error) {
      console.error('[POSStore] Failed to load specials:', error);
      // Don't block POS - just mark as loaded with empty array
      set({ todaysSpecials: [], specialsLoaded: true });
    }
  },

  // Cart actions
  addToCart: (menuItem, quantity, modifiers, specialInstructions, comboSelections) => {
    const modifiersTotal = modifiers.reduce((sum, mod) => sum + mod.price, 0);

    // Calculate combo price adjustments (upgrades/downgrades)
    const comboAdjustment = comboSelections
      ? comboSelections.reduce((sum, group) =>
          sum + group.selectedItems.reduce((itemSum, item) => itemSum + item.priceAdjustment, 0), 0)
      : 0;

    // Helper to check if two items are identical (same menu item, modifiers, combos, and instructions)
    const areItemsIdentical = (existing: CartItem): boolean => {
      // Check menu item
      if (existing.menuItem.id !== menuItem.id) return false;

      // Check special instructions
      if ((existing.specialInstructions || '') !== (specialInstructions || '')) return false;

      // Check modifiers (same count and same items)
      const existingModIds = existing.modifiers.map(m => m.id).sort();
      const newModIds = modifiers.map(m => m.id).sort();
      if (existingModIds.length !== newModIds.length) return false;
      if (!existingModIds.every((id, i) => id === newModIds[i])) return false;

      // Check combo selections
      const existingCombo = existing.comboSelections || [];
      const newCombo = comboSelections || [];
      if (existingCombo.length !== newCombo.length) return false;

      // Check each combo group has same selections
      for (const newGroup of newCombo) {
        const existingGroup = existingCombo.find(g => g.groupId === newGroup.groupId);
        if (!existingGroup) return false;
        const existingItemIds = existingGroup.selectedItems.map(i => i.id).sort();
        const newItemIds = newGroup.selectedItems.map(i => i.id).sort();
        if (existingItemIds.length !== newItemIds.length) return false;
        if (!existingItemIds.every((id, i) => id === newItemIds[i])) return false;
      }

      return true;
    };

    set((state) => {
      // Check if an identical item already exists in the cart
      const existingItemIndex = state.cart.findIndex(areItemsIdentical);

      if (existingItemIndex !== -1) {
        // Update quantity of existing item
        const updatedCart = [...state.cart];
        const existingItem = updatedCart[existingItemIndex];
        const newQuantity = existingItem.quantity + quantity;
        const newSubtotal = (menuItem.price + modifiersTotal + comboAdjustment) * newQuantity;

        updatedCart[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          subtotal: newSubtotal,
        };

        return { cart: updatedCart };
      }

      // Create new cart item
      const cartItemId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const subtotal = (menuItem.price + modifiersTotal + comboAdjustment) * quantity;

      const newCartItem: CartItem = {
        id: cartItemId,
        menuItem,
        quantity,
        modifiers,
        specialInstructions,
        subtotal,
        comboSelections,
      };

      return { cart: [...state.cart, newCartItem] };
    });
  },

  removeFromCart: (cartItemId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== cartItemId),
    }));
  },

  updateQuantity: (cartItemId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(cartItemId);
      return;
    }

    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.id === cartItemId) {
          const modifiersTotal = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
          const comboAdjustment = item.comboSelections
            ? item.comboSelections.reduce((sum, group) =>
                sum + group.selectedItems.reduce((itemSum, selItem) => itemSum + selItem.priceAdjustment, 0), 0)
            : 0;
          const subtotal = (item.menuItem.price + modifiersTotal + comboAdjustment) * quantity;
          return { ...item, quantity, subtotal };
        }
        return item;
      }),
    }));
  },

  updateModifiers: (cartItemId, modifiers) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.id === cartItemId) {
          const modifiersTotal = modifiers.reduce((sum, mod) => sum + mod.price, 0);
          const subtotal = (item.menuItem.price + modifiersTotal) * item.quantity;
          return { ...item, modifiers, subtotal };
        }
        return item;
      }),
    }));
  },

  clearCart: () => {
    set({
      cart: [],
      notes: '',
    });
  },

  // Table actions
  setTableNumber: (tableNumber) => {
    console.log('[POSStore] setTableNumber called with:', tableNumber);
    set({ tableNumber });
  },

  getTableOrder: (tableNumber) => {
    const session = get().activeTables[tableNumber];
    return session?.order || null;
  },

  getTableSession: (tableNumber) => {
    return get().activeTables[tableNumber] || null;
  },

  setGuestCount: (tableNumber, guestCount, tenantId) => {
    set((state) => {
      const existingSession = state.activeTables[tableNumber];
      let updatedSession: TableSession;

      if (existingSession) {
        updatedSession = {
          ...existingSession,
          guestCount,
        };
      } else {
        // Create new session if none exists
        updatedSession = {
          tableNumber,
          guestCount,
          order: {
            orderType: 'dine-in',
            tableNumber,
            items: [],
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            status: 'draft',
            createdAt: new Date().toISOString(),
          },
          startedAt: new Date().toISOString(),
        };
      }

      // Persist to SQLite if tenantId provided
      if (tenantId) {
        tableSessionService.saveSession(tenantId, updatedSession).catch((err) => {
          console.error('[POSStore] Failed to persist table session:', err);
        });
      }

      return {
        activeTables: {
          ...state.activeTables,
          [tableNumber]: updatedSession,
        },
      };
    });
  },

  openTable: (tableNumber, guestCount, tenantId) => {
    set((state) => {
      // Don't overwrite existing session
      if (state.activeTables[tableNumber]) {
        return state;
      }

      const newSession: TableSession = {
        tableNumber,
        guestCount,
        order: {
          orderType: 'dine-in',
          tableNumber,
          items: [],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          status: 'draft',
          createdAt: new Date().toISOString(),
        },
        startedAt: new Date().toISOString(),
      };

      // Persist to SQLite if tenantId provided
      if (tenantId) {
        tableSessionService.saveSession(tenantId, newSession).catch((err) => {
          console.error('[POSStore] Failed to persist table session:', err);
        });
      }

      return {
        activeTables: {
          ...state.activeTables,
          [tableNumber]: newSession,
        },
        tableNumber, // Also set as active table
      };
    });
  },

  clearTable: (tableNumber, tenantId) => {
    // Close session in SQLite if tenantId provided
    if (tenantId) {
      tableSessionService.closeSession(tenantId, tableNumber).catch((err) => {
        console.error('[POSStore] Failed to close table session:', err);
      });
    }

    set((state) => {
      const newActiveTables = { ...state.activeTables };
      delete newActiveTables[tableNumber];
      return { activeTables: newActiveTables };
    });
  },

  clearAllTables: async (tenantId) => {
    console.log('[POSStore] Clearing all table sessions');
    const { activeTables } = get();

    // Close all sessions in SQLite if tenantId provided
    if (tenantId) {
      const closePromises = Object.keys(activeTables).map((tableNum) =>
        tableSessionService.closeSession(tenantId, parseInt(tableNum, 10)).catch((err) => {
          console.error(`[POSStore] Failed to close table ${tableNum}:`, err);
        })
      );
      await Promise.all(closePromises);
    }

    set({ activeTables: {}, cart: [], tableNumber: null });
  },

  clearAllTableSessions: () => {
    console.log('[POSStore] Clearing all table sessions (in-memory only)');
    set({ activeTables: {}, cart: [], tableNumber: null });
  },

  loadTableSessions: async (tenantId) => {
    try {
      console.log('[POSStore] Loading table sessions from SQLite for tenant:', tenantId);
      const sessions = await tableSessionService.getActiveSessions(tenantId);
      const tableNumbers = Object.keys(sessions);
      console.log('[POSStore] Loaded sessions for tables:', tableNumbers.join(', ') || '(none)');
      if (tableNumbers.length > 0) {
        tableNumbers.forEach((tableNum) => {
          const session = sessions[parseInt(tableNum, 10)];
          const itemNames = session.order?.items?.map(i => i.menuItem?.name).filter(Boolean).join(', ') || 'none';
          console.log(`[POSStore] Table ${tableNum}: ${session.order?.items?.length || 0} items (${itemNames}), ₹${session.order?.total || 0}, status: ${session.order?.status || 'unknown'}`);
        });
      }
      set({ activeTables: sessions });
    } catch (err) {
      console.error('[POSStore] Failed to load table sessions:', err);
    }
  },

  sendToKitchen: async (tenantId) => {
    const { cart, tableNumber, orderType, notes, activeTables } = get();
    if (cart.length === 0) return;
    if (orderType === 'dine-in' && !tableNumber) {
      throw new Error('Table number is required for dine-in');
    }

    const totals = get().getCartTotal();

    // Create a KOT (Kitchen Order Ticket)
    const kotOrder: Order = {
      id: `kot-${Date.now()}`,
      orderNumber: `KOT-${Math.floor(100 + Math.random() * 899)}`,
      orderType,
      tableNumber,
      items: [...cart],
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: 0,
      total: totals.total,
      status: 'confirmed',
      notes,
      createdAt: new Date().toISOString(),
    };

    // Update active table tab
    if (orderType === 'dine-in' && tableNumber) {
      const existingSession = activeTables[tableNumber];
      const existingOrder = existingSession?.order;
      // Prepend new cart items to the beginning so newest items appear first
      const updatedItems = existingOrder ? [...cart, ...existingOrder.items] : [...cart];

      // Recalculate totals for the whole table
      const subtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const tax = subtotal * 0.05;
      const total = subtotal + tax;

      const updatedOrder: Order = {
        ...(existingOrder || kotOrder),
        items: updatedItems,
        subtotal,
        tax,
        total,
        status: 'pending', // Open tab status
      };

      // Create KOT record for tracking
      const newKotRecord: KOTRecord = {
        kotNumber: kotOrder.orderNumber || `KOT-${Date.now()}`,
        printedAt: new Date().toISOString(),
        itemIds: cart.map(item => item.id),
        sentToKitchen: true,
      };

      const existingKotRecords = existingSession?.kotRecords || [];

      const updatedSession: TableSession = existingSession
        ? {
            ...existingSession,
            order: updatedOrder,
            kotRecords: [...existingKotRecords, newKotRecord],
            lastKotPrintedAt: new Date().toISOString(),
          }
        : {
            tableNumber,
            guestCount: 1, // Default if session wasn't created via openTable
            order: updatedOrder,
            startedAt: new Date().toISOString(),
            kotRecords: [newKotRecord],
            lastKotPrintedAt: new Date().toISOString(),
          };

      // Persist to SQLite FIRST, then update state
      // This ensures data is saved before user can navigate away
      try {
        const itemCount = updatedSession.order?.items?.length || 0;
        const itemNames = updatedSession.order?.items?.map(i => i.menuItem?.name).filter(Boolean).join(', ') || 'none';
        console.log(`[POSStore] Saving table ${tableNumber} session: ${itemCount} items (${itemNames}), ₹${updatedSession.order?.total || 0}`);
        await tableSessionService.saveSession(tenantId, updatedSession);
        console.log('[POSStore] ✓ Table session persisted to SQLite');
      } catch (err) {
        console.error('[POSStore] Failed to persist table session:', err);
      }

      // Update activeTables AND clear cart in single atomic update
      set((state) => ({
        activeTables: {
          ...state.activeTables,
          [tableNumber]: updatedSession,
        },
        cart: [],
        notes: '',
      }));
    } else {
      // Non-dine-in: just clear cart
      set({ cart: [], notes: '' });
    }

    // Send to KDS (local and all connected devices via cloud + LAN)
    try {
      const { transformPOSToKitchenOrder, createKitchenOrderWithId } = await import('../lib/orderTransformations');

      // Determine if this is a running order (additional KOT for existing table)
      // For dine-in: check if there were already KOTs in the session BEFORE we added this one
      // (activeTables was updated above, so we need to check the current state minus 1)
      const currentSession = orderType === 'dine-in' && tableNumber
        ? get().activeTables[tableNumber]
        : null;
      // Since we already added the new KOT record above, subtract 1 to get the count before
      const previousKotCount = currentSession?.kotRecords
        ? currentSession.kotRecords.length - 1
        : 0;
      const isRunningOrder = previousKotCount > 0; // Had at least 1 KOT before this one
      const kotSequence = previousKotCount + 1; // 1-indexed: first KOT is 1, second is 2

      const kitchenOrder = createKitchenOrderWithId(transformPOSToKitchenOrder(kotOrder, tenantId, {
        isRunningOrder,
        kotSequence,
      }));

      if (isRunningOrder) {
        console.log(`[POSStore] 🏃 Running order detected - Table ${tableNumber}, KOT #${kotSequence}`);
      }

      // Add to local KDS store
      useKDSStore.getState().addOrder(kitchenOrder);

      // Broadcast to all connected devices (cloud Durable Object + LAN mesh)
      try {
        const { orderSyncService } = await import('../lib/orderSyncService');
        const result = await orderSyncService.broadcastOrder(kotOrder, kitchenOrder);
        const paths = [];
        if (result.cloud) paths.push('cloud');
        if (result.lan > 0) paths.push(`${result.lan} LAN client(s)`);
        if (paths.length > 0) {
          console.log(`[POSStore] KOT broadcast via: ${paths.join(', ')}`);
        }
      } catch (syncError) {
        // Sync broadcast is best-effort - don't fail the KOT if it doesn't work
        console.warn('[POSStore] Sync broadcast failed (non-critical):', syncError);
      }

      // Print KOT
      const printerConfig = usePrinterStore.getState().config;
      if (printerConfig.autoPrintOnAccept) {
        await printerService.print(kitchenOrder);
      }
    } catch (e) {
      console.error('Failed to send to KDS/Printer:', e);
    }
  },

  // Order actions
  setOrderType: (type) => set({ orderType: type }),
  setNotes: (notes) => set({ notes }),

  submitOrder: async (tenantId, paymentMethod) => {
    const { cart, orderType, tableNumber, notes, activeTables } = get();

    // If it's a dine-in checkout, we might be checking out the whole table
    let itemsToCheckout = [...cart];
    let finalTableNumber = tableNumber;

    if (orderType === 'dine-in' && tableNumber && activeTables[tableNumber]) {
      const tableSession = activeTables[tableNumber];
      // If cart is empty, we are checking out the existing table order
      if (itemsToCheckout.length === 0) {
        itemsToCheckout = tableSession.order.items;
      } else {
        // If cart has items, we add them to the table order first
        itemsToCheckout = [...tableSession.order.items, ...cart];
      }
    }

    if (itemsToCheckout.length === 0) {
      throw new Error('No items to checkout');
    }

    // Calculate final totals
    const subtotal = itemsToCheckout.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    const order: Order = {
      orderType,
      tableNumber: finalTableNumber,
      items: itemsToCheckout,
      subtotal,
      tax,
      discount: 0,
      total,
      paymentMethod,
      status: 'completed',
      notes,
      createdAt: new Date().toISOString(),
    };

    try {
      set({ isLoading: true, error: null });

      // Transform order to HandsFree Platform format
      const handsfreeOrder: HandsfreeOrderPayload = {
        orderType: orderType === 'dine-in' ? 'dine_in' : orderType === 'takeout' ? 'takeaway' : 'delivery',
        tableNumber: finalTableNumber,
        items: itemsToCheckout.map(item => ({
          menuItemId: item.menuItem.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          price: item.menuItem.price,
          modifiers: item.modifiers?.map(m => ({ name: m.name, price_adjustment: m.price })),
          specialInstructions: item.specialInstructions,
        })),
        subtotal,
        tax,
        total,
        paymentMethod: paymentMethod || 'cash',
        notes,
        status: 'completed',
      };

      let orderId: string;
      let orderNumber: string;

      try {
        // Try to submit to HandsFree Platform
        const result = await handsfreeApi.submitOrder(tenantId, handsfreeOrder);
        orderId = result.orderId;
        orderNumber = result.orderNumber;
      } catch (apiError) {
        // Fallback to local order generation (for offline mode or CORS issues during dev)
        console.warn('[POSStore] API unavailable, using local order generation:', apiError);
        orderId = `local-${Date.now()}`;
        orderNumber = `ORD-${Math.floor(1000 + Math.random() * 8999)}`;
      }

      const completedOrder = { ...order, id: orderId, orderNumber };

      // Clear table if it was a dine-in order
      if (orderType === 'dine-in' && finalTableNumber) {
        get().clearTable(finalTableNumber, tenantId);
      }

      set((state) => ({
        currentOrder: completedOrder,
        recentOrders: [completedOrder, ...state.recentOrders].slice(0, 10),
        isLoading: false,
      }));

      get().clearCart();
      set({ tableNumber: null });

      return completedOrder;
    } catch (error) {
      console.error('[POSStore] Failed to submit order:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to submit order',
        isLoading: false,
      });
      throw error;
    }
  },

  updateLastOrderNumber: (orderNumber) => {
    set((state) => {
      const lastOrder = state.recentOrders[0];
      if (lastOrder && !lastOrder.orderNumber) {
        const updatedRecentOrders = state.recentOrders.map((order, index) =>
          index === 0 ? { ...order, orderNumber } : order
        );
        return { recentOrders: updatedRecentOrders };
      }
      return state;
    });
  },

  // Computed
  getCartTotal: () => {
    const { cart } = get();
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  },

  getFilteredMenu: () => {
    const { selectedCategory, searchQuery, todaysSpecials } = get();
    const menuStoreItems = useMenuStore.getState().items;

    // Handle "Today's Special" category - return specials converted to MenuItem format
    if (selectedCategory === 'todays-special') {
      const specialsAsMenuItems: MenuItem[] = todaysSpecials.map((special) => ({
        id: special.id,
        name: special.name,
        description: special.description,
        category: 'todays-special',
        price: special.price,
        available: true,
        preparationTime: 15,
        tags: special.tags || [],
        modifiers: [],
        image: special.image,
        // Special items are not combos (simple quick-add items)
        isCombo: false,
        comboGroups: [],
      }));

      // Apply search filter if present
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return specialsAsMenuItems.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.tags?.some((tag) => tag.toLowerCase().includes(query))
        );
      }

      return specialsAsMenuItems;
    }

    // Regular menu items
    const menuItems: MenuItem[] = menuStoreItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category_id, // Keep original category_id for filtering
      price: item.price,
      available: item.active !== false,
      preparationTime: item.preparation_time,
      tags: item.dietary_tags || [],
      modifiers: [],
      imageUrl: item.image,
      // Map combo fields from menuStore format to POS format
      isCombo: item.is_combo,
      comboGroups: item.combo_groups?.map((group) => ({
        id: group.id,
        name: group.name,
        required: group.required,
        minSelections: group.min_selections,
        maxSelections: group.max_selections,
        items: group.items.map((groupItem) => ({
          id: groupItem.id,
          name: groupItem.name,
          description: groupItem.description,
          image: groupItem.image,
          priceAdjustment: groupItem.price_adjustment,
          available: groupItem.available,
          tags: groupItem.tags,
        })),
      })),
    }));

    let filtered = menuItems;
    if (selectedCategory !== 'all') {
      // Filter by category_id (dynamic category from backend)
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  },

  // KOT tracking methods
  isKotPrintedForTable: (tableNumber) => {
    const session = get().activeTables[tableNumber];
    if (!session) return false;
    // KOT is considered printed if there's at least one KOT record
    // and all order items have been sent to kitchen
    const kotRecords = session.kotRecords || [];
    if (kotRecords.length === 0) return false;

    // Check if all items in the order have been included in a KOT
    const allKotItemIds = kotRecords.flatMap(kot => kot.itemIds);
    const orderItemIds = session.order.items.map(item => item.id);

    // All order items should be in at least one KOT
    return orderItemIds.every(itemId => allKotItemIds.includes(itemId));
  },

  getKotRecordsForTable: (tableNumber) => {
    const session = get().activeTables[tableNumber];
    return session?.kotRecords || [];
  },
}));

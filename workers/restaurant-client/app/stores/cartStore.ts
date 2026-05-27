import { makeAutoObservable, reaction } from 'mobx';
import { CartItem, MenuItem, ComboMenuItem } from '../types/types';
import { VertexAILiveService } from '../services/VertexAILiveService';

class CartStore {
  items: CartItem[] = [];
  isLocked: boolean = false;
  private currentCustomerPhone: string | null = null;
  private currentTenantId: string | null = null;
  private currentTableId: string | null = null;
  private voiceService: VertexAILiveService | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private pendingSyncOperations: Array<{
    action: 'add' | 'update' | 'remove';
    item: { dishName: string; quantity: number; customization?: string; itemId?: string };
  }> = [];

  constructor() {
    makeAutoObservable(this);

    // Auto-save cart to localStorage whenever items change (skip empty — clearCart handles removal)
    reaction(
      () => this.items,
      (items) => {
        if (this.currentTenantId && items.length > 0) {
          this.saveCart();
        }
      },
      { delay: 500 } // Debounce saves by 500ms
    );
  }

  // Key for an identified customer's cart (phone-specific)
  private getCartKey(): string {
    return `handsfree_cart_${this.currentTenantId}_${this.currentCustomerPhone}`;
  }

  // Key for an anonymous browsing session (no phone required)
  private getAnonCartKey(): string {
    return `handsfree_cart_${this.currentTenantId}`;
  }

  // Prevent any further cart mutations (e.g. after bill is requested at the table)
  lock() {
    this.isLocked = true;
  }

  unlock() {
    this.isLocked = false;
  }

  // Set voice service for backend sync
  setVoiceService(service: VertexAILiveService | null) {
    this.voiceService = service;
    console.log('[CartStore] Voice service', service ? 'connected' : 'disconnected');
  }

  // Set table ID for QR code table ordering
  setTableId(tableId: string) {
    this.currentTableId = tableId;
    console.log('[CartStore] Table ID set:', tableId);
  }

  // Get current table ID
  get tableId(): string | null {
    return this.currentTableId;
  }

  // Load cart from localStorage for a specific customer
  loadCart(customerPhone: string, tenantId: string) {
    this.currentCustomerPhone = customerPhone;
    this.currentTenantId = tenantId;

    // If user already has items in the current session, keep them — don't overwrite with saved cart.
    // This prevents a race where the user adds items, opens checkout quickly, and loadCart
    // (called async from setCustomer) wipes the current items with a stale saved cart.
    if (this.items.length > 0) {
      console.log('[CartStore] Skipping load — cart already has', this.items.length, 'in-session items');
      return;
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const tryLoad = (key: string): boolean => {
      const saved = localStorage.getItem(key);
      if (!saved) return false;
      try {
        const cartData = JSON.parse(saved) as { items: CartItem[]; savedAt: number };
        if (cartData.savedAt && cartData.savedAt > sevenDaysAgo && cartData.items.length > 0) {
          this.items = cartData.items;
          console.log('[CartStore] Loaded', this.items.length, 'items from', key);
          return true;
        } else {
          localStorage.removeItem(key);
          return false;
        }
      } catch {
        return false;
      }
    };

    try {
      // Try the phone-specific key first (returning customer)
      const loaded = tryLoad(this.getCartKey());
      if (!loaded) {
        // Fall back to the anonymous browsing cart and migrate it to the phone key
        const anonKey = this.getAnonCartKey();
        if (tryLoad(anonKey)) {
          localStorage.removeItem(anonKey); // consumed — now saved under phone key on next reaction
        }
      }
    } catch (err) {
      console.error('[CartStore] Failed to load cart:', err);
    }
  }

  // Initialise the store for an anonymous browsing session (no phone available).
  // Call this on app mount when no saved phone is found.
  initForTenant(tenantId: string) {
    if (this.items.length > 0) return; // session already has items
    this.currentTenantId = tenantId;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    try {
      const key = this.getAnonCartKey();
      const saved = localStorage.getItem(key);
      if (!saved) return;
      const cartData = JSON.parse(saved) as { items: CartItem[]; savedAt: number };
      if (cartData.savedAt && cartData.savedAt > sevenDaysAgo && cartData.items.length > 0) {
        this.items = cartData.items;
        console.log('[CartStore] Restored', this.items.length, 'anonymous cart items');
      } else {
        localStorage.removeItem(key);
      }
    } catch (err) {
      console.error('[CartStore] Failed to restore anonymous cart:', err);
    }
  }

  // Save cart to localStorage
  private saveCart() {
    try {
      const key = this.currentCustomerPhone ? this.getCartKey() : this.getAnonCartKey();
      const cartData = {
        items: this.items,
        savedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cartData));
      console.log('[CartStore] Saved', this.items.length, 'items to cart');
    } catch (err) {
      console.error('[CartStore] Failed to save cart:', err);
    }
  }

  addMenuItem(item: MenuItem) {
    if (this.isLocked) return;
    const existingItem = this.items.find(
      i => i.name === item.name && i.type === item.type && !i.customization
    );

    if (existingItem) {
      existingItem.quantity += 1;
      // Sync update to backend
      this.syncToBackend('update', {
        dishName: item.name,
        quantity: existingItem.quantity,
        itemId: existingItem.id
      });
    } else {
      const newItem = {
        name: item.name,
        price: item.price,
        quantity: 1,
        type: item.type,
        imageUrl: item.imageUrl
      };
      this.items.push(newItem);
      // Sync add to backend (backend will assign ID)
      this.syncToBackend('add', { dishName: item.name, quantity: 1 });
    }
  }

  addComboItem(item: ComboMenuItem, selectedChoice: string) {
    if (this.isLocked) return;
    const existingItem = this.items.find(
      i => i.name === item.name && i.customization === selectedChoice
    );

    if (existingItem) {
      existingItem.quantity += 1;
      // Sync update to backend
      this.syncToBackend('update', {
        dishName: item.name,
        quantity: existingItem.quantity,
        customization: selectedChoice,
        itemId: existingItem.id
      });
    } else {
      const newItem = {
        name: item.name,
        price: item.price,
        quantity: 1,
        type: item.type,
        customization: selectedChoice,
        imageUrl: item.imageUrl
      };
      this.items.push(newItem);
      // Sync add to backend (backend will assign ID)
      this.syncToBackend('add', {
        dishName: item.name,
        quantity: 1,
        customization: selectedChoice
      });
    }
  }

  updateQuantity(name: string, type: 'veg' | 'non-veg', newQuantity: number) {
    if (this.isLocked) return;
    const item = this.items.find(i => i.name === name && i.type === type);
    if (item) {
      item.quantity = newQuantity;
      // Sync update to backend
      this.syncToBackend('update', {
        dishName: name,
        quantity: newQuantity,
        customization: item.customization,
        itemId: item.id
      });
    }
  }

  removeItem(name: string, type: 'veg' | 'non-veg') {
    if (this.isLocked) return;
    const item = this.items.find(i => i.name === name && i.type === type);
    this.items = this.items.filter(i => !(i.name === name && i.type === type));
    // Sync remove to backend
    if (item) {
      this.syncToBackend('remove', {
        dishName: name,
        quantity: 0,
        customization: item.customization,
        itemId: item.id
      });
    }
  }

  get total() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Debounced sync cart changes to backend via voice service
  // Batches rapid operations (300ms delay) to reduce network chatter
  private syncToBackend(
    action: 'add' | 'update' | 'remove',
    item: { dishName: string; quantity: number; customization?: string; itemId?: string }
  ) {
    if (!this.voiceService || !this.voiceService.isActive()) {
      console.log('[CartStore] Voice service not active, skipping backend sync');
      return;
    }

    // Add to pending operations (latest operation for same item wins)
    const existingOpIndex = this.pendingSyncOperations.findIndex(
      op => op.item.itemId === item.itemId ||
            (op.item.dishName === item.dishName && op.item.customization === item.customization)
    );

    if (existingOpIndex >= 0) {
      // Replace with latest operation
      this.pendingSyncOperations[existingOpIndex] = { action, item };
    } else {
      this.pendingSyncOperations.push({ action, item });
    }

    // Clear existing timer
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Set new timer to batch operations
    this.syncTimer = setTimeout(() => {
      this.flushPendingSync();
    }, 300); // 300ms debounce
  }

  // Flush all pending sync operations to backend
  private flushPendingSync() {
    if (this.pendingSyncOperations.length === 0) {
      return;
    }

    console.log('[CartStore] Flushing', this.pendingSyncOperations.length, 'pending sync operations');

    // Send all pending operations
    this.pendingSyncOperations.forEach(({ action, item }) => {
      this.voiceService!.syncCartUpdate(action, item);
    });

    // Clear pending operations
    this.pendingSyncOperations = [];
    this.syncTimer = null;
  }

  // Reconcile frontend cart with backend cart updates
  // Instead of clearing and rebuilding, we merge changes intelligently
  reconcileWithBackend(backendCart: any, source: string) {
    // Ignore cart_updated messages that originated from manual operations
    if (source === 'manual') {
      console.log('[CartStore] Ignoring cart_updated from manual operation (echo prevention)');
      return;
    }

    console.log('[CartStore] Reconciling with backend cart', {
      backendItems: backendCart.items?.length || 0,
      frontendItems: this.items.length,
      source
    });

    if (!backendCart.items || backendCart.items.length === 0) {
      // Backend cart is empty
      this.items = [];
      return;
    }

    // Build map of backend items by ID
    const backendItemsById = new Map<string, any>();
    backendCart.items.forEach((backendItem: any) => {
      backendItemsById.set(backendItem.id, backendItem);
    });

    // Update existing items and add IDs if missing
    this.items.forEach((frontendItem) => {
      // Try to find matching backend item by ID or name
      let backendItem = frontendItem.id ? backendItemsById.get(frontendItem.id) : null;

      if (!backendItem) {
        // Fallback to name matching
        backendItem = backendCart.items.find((bi: any) =>
          bi.dishName.toLowerCase() === frontendItem.name.toLowerCase() &&
          (bi.choices?.[0] || '') === (frontendItem.customization || '')
        );
      }

      if (backendItem) {
        // Update from backend
        frontendItem.id = backendItem.id; // Assign ID from backend
        frontendItem.quantity = backendItem.quantity;
        frontendItem.price = backendItem.price;
        // Mark as processed
        backendItemsById.delete(backendItem.id);
      }
    });

    // Add new items from backend that don't exist in frontend
    backendItemsById.forEach((backendItem) => {
      this.items.push({
        id: backendItem.id,
        name: backendItem.dishName,
        price: backendItem.price,
        quantity: backendItem.quantity,
        type: backendItem.type || 'veg', // Default to veg if not specified
        customization: backendItem.choices?.[0],
        imageUrl: backendItem.imageUrl
      });
    });

    // Remove items from frontend that no longer exist in backend
    const backendItemIds = new Set(backendCart.items.map((bi: any) => bi.id));
    this.items = this.items.filter(item => {
      if (!item.id) return true; // Keep items without IDs (just added)
      return backendItemIds.has(item.id);
    });

    console.log('[CartStore] Reconciliation complete', {
      finalItemCount: this.items.length
    });
  }

  clearCart() {
    this.isLocked = false;
    this.items = [];

    // Flush any pending syncs
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.pendingSyncOperations = [];

    // Clear both phone-keyed and anon carts from localStorage
    if (this.currentTenantId) {
      try {
        if (this.currentCustomerPhone) localStorage.removeItem(this.getCartKey());
        localStorage.removeItem(this.getAnonCartKey());
        console.log('[CartStore] Cleared cart from localStorage');
      } catch (err) {
        console.error('[CartStore] Failed to clear cart from localStorage:', err);
      }
    }
  }
}

export const cartStore = new CartStore();

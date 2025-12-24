import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
import { useMenuStore } from '../stores/menuStore';
import { useNotificationStore } from '../stores/notificationStore';
import { MenuItem, OrderType } from '../types/pos';
import { billService } from '../lib/billService';
import { PremiumMenuItemCard } from '../components/pos/PremiumMenuItemCard';
import { PremiumCartItemCard } from '../components/pos/PremiumCartItemCard';
import { IndustrialModifierModal } from '../components/pos/IndustrialModifierModal';
import { IndustrialCheckoutModal } from '../components/pos/IndustrialCheckoutModal';
import { BillPreviewModal } from '../components/pos/BillPreviewModal';
import { OnScreenKeyboard } from '../components/ui-v2/OnScreenKeyboard';
import { TableSelectorModal } from '../components/pos/TableSelectorModal';
import { BillData } from '../components/print/BillPrint';
import { cn } from '../lib/utils';

// Hook to detect screen size
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Helper to get category icon based on name
function getCategoryIcon(categoryName: string): string {
  const name = categoryName.toLowerCase();
  if (name.includes('appetizer') || name.includes('starter')) return '🥟';
  if (name.includes('main') || name.includes('entree') || name.includes('curry')) return '🍛';
  if (name.includes('side')) return '🍚';
  if (name.includes('dessert') || name.includes('sweet')) return '🍰';
  if (name.includes('beverage') || name.includes('drink')) return '🥤';
  if (name.includes('special')) return '⭐';
  if (name.includes('breakfast')) return '🍳';
  if (name.includes('lunch')) return '🍱';
  if (name.includes('dinner')) return '🍽️';
  if (name.includes('snack')) return '🍿';
  if (name.includes('soup')) return '🍜';
  if (name.includes('salad')) return '🥗';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('burger')) return '🍔';
  if (name.includes('sandwich')) return '🥪';
  return '🍽️';
}

export default function POSDashboard() {
  const { user } = useAuthStore();
  const {
    cart,
    selectedCategory,
    searchQuery,
    orderType,
    tableNumber,
    setSelectedCategory,
    setSearchQuery,
    setOrderType,
    setTableNumber,
    addToCart,
    removeFromCart,
    updateQuantity,
    submitOrder,
    sendToKitchen,
    getCartTotal,
    getFilteredMenu,
    getTableSession,
    setGuestCount,
    loadTableSessions,
    isKotPrintedForTable,
  } = usePOSStore();

  // Get dynamic categories from menuStore
  const { categories: menuCategories } = useMenuStore();

  // Load saved table sessions on mount
  useEffect(() => {
    if (user?.tenantId) {
      loadTableSessions(user.tenantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId]);

  const { playSound } = useNotificationStore();

  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isSearchFocused, _setIsSearchFocused] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [generatedBillData, setGeneratedBillData] = useState<BillData | null>(null);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');

  // Mobile/tablet responsive state
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Close cart drawer when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setIsCartDrawerOpen(false);
    }
  }, [isDesktop]);

  // Toggle cart drawer (for mobile/tablet)
  const toggleCartDrawer = useCallback(() => {
    setIsCartDrawerOpen(prev => !prev);
  }, []);

  // On-screen keyboard state
  const [keyboardConfig, setKeyboardConfig] = useState<{
    isOpen: boolean;
    type: 'text' | 'number';
    value: string;
    title: string;
    onSave: (val: string) => void;
  }>({
    isOpen: false,
    type: 'text',
    value: '',
    title: '',
    onSave: () => { },
  });

  const filteredMenu = getFilteredMenu();
  const cartTotals = getCartTotal();
  const activeTableSession = tableNumber ? getTableSession(tableNumber) : null;
  const activeTableOrder = activeTableSession?.order || null;

  // Check if billing is allowed (KOT must be printed for dine-in tables)
  const canGenerateBill = (() => {
    // Must have items to bill
    if (!activeTableOrder && cart.length === 0) return false;

    // For dine-in with a table, KOT must be printed
    if (orderType === 'dine-in' && tableNumber) {
      return isKotPrintedForTable(tableNumber);
    }

    // For takeout/delivery or no table, just need items
    return true;
  })();

  // Build categories dynamically from menuStore
  const categories: { id: string; label: string; icon: string }[] = [
    { id: 'all', label: 'All Items', icon: '📋' },
    ...menuCategories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      icon: cat.icon || getCategoryIcon(cat.name),
    })),
  ];

  const orderTypes: { id: OrderType; label: string; icon: string }[] = [
    { id: 'dine-in', label: 'Dine-in', icon: '🪑' },
    { id: 'takeout', label: 'Takeaway', icon: '🥡' },
    { id: 'delivery', label: 'Delivery', icon: '🛵' },
  ];

  // Check if items can be added (for dine-in, table must be selected)
  const canAddItems = orderType !== 'dine-in' || tableNumber !== null;

  const handleMenuItemClick = (item: MenuItem) => {
    // For dine-in orders, require table selection first
    // Use explicit null check since tableNumber could be 0 (which is falsy)
    if (orderType === 'dine-in' && tableNumber === null) {
      setIsTableModalOpen(true);
      return;
    }

    if (item.modifiers && item.modifiers.length > 0) {
      setSelectedMenuItem(item);
      setIsModifierModalOpen(true);
    } else {
      addToCart(item, 1, []);
      playSound('order_ready');
    }
  };

  const handleAddToCart = (
    menuItem: MenuItem,
    quantity: number,
    modifiers: any[],
    specialInstructions?: string
  ) => {
    addToCart(menuItem, quantity, modifiers, specialInstructions);
    playSound('order_ready');
  };

  const handleSendToKitchen = async () => {
    if (!user?.tenantId) return;
    try {
      await sendToKitchen(user.tenantId);
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to send to kitchen:', error);
      alert(error instanceof Error ? error.message : 'Failed to send to kitchen');
    }
  };

  const handleGenerateBill = async () => {
    if (!user?.tenantId) return;

    // For dine-in orders, ensure KOT was printed before generating bill
    if (orderType === 'dine-in' && tableNumber) {
      if (!isKotPrintedForTable(tableNumber)) {
        alert('Cannot generate bill: KOT has not been printed for this table.\n\nPlease send the order to kitchen first.');
        return;
      }
    }

    try {
      // Submit order without payment method (payment collected separately on terminal)
      const order = await submitOrder(user.tenantId, 'pending');
      playSound('order_ready');

      // Generate bill and show preview
      const bill = billService.generateBill(order, user.name || 'Staff');
      setGeneratedBillData(bill.billData);
      setGeneratedInvoiceNumber(bill.invoiceNumber);
      setIsBillPreviewOpen(true);
    } catch (error) {
      console.error('Failed to generate bill:', error);
      alert('Failed to generate bill.');
    }
  };

  const openKeyboard = (type: 'text' | 'number', currentVal: string, title: string, onSave: (val: string) => void) => {
    setKeyboardConfig({
      isOpen: true,
      type,
      value: currentVal,
      title,
      onSave,
    });
  };

  // Cart item count for badge
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = cartTotals.total + (activeTableOrder?.total || 0);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans select-none text-foreground">
      {/* Main Content: Header + Grid */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 bg-background/50 relative",
        // On mobile/tablet, take full width; on desktop, leave room for sidebar
        !isDesktop && "w-full"
      )}>
        {/* ==================== MOBILE HEADER ==================== */}
        {(isMobile || isTablet) && (
          <header className="h-16 flex items-center justify-between px-4 border-b border-border/50 glass-panel z-40 shrink-0 gap-3 safe-area-top">
            {/* Logo / Table indicator */}
            <div className="flex items-center gap-3">
              {orderType === 'dine-in' && tableNumber !== null ? (
                <button
                  onClick={() => setIsTableModalOpen(true)}
                  className="w-12 h-12 bg-accent-gradient rounded-xl flex flex-col items-center justify-center text-white shadow-lg shadow-accent/20 touch-target"
                >
                  <span className="text-[8px] font-black uppercase leading-none">Table</span>
                  <span className="text-lg font-black leading-none">{tableNumber}</span>
                </button>
              ) : (
                <div className="w-10 h-10 bg-accent-gradient rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg shadow-accent/20">
                  KP
                </div>
              )}
            </div>

            {/* Order Type Selector (compact for mobile) */}
            <div className="flex gap-1 neo-inset-sm p-1 rounded-xl">
              {orderTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setOrderType(type.id)}
                  className={cn(
                    "touch-target px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    orderType === type.id
                      ? "bg-accent-gradient text-white shadow-lg shadow-accent/20"
                      : "text-muted-foreground"
                  )}
                >
                  <span className="md:hidden">{type.icon}</span>
                  <span className="hidden md:inline">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Search Button (opens modal on mobile) */}
            <button
              onClick={() => isMobile ? setIsMobileSearchOpen(true) : openKeyboard('text', searchQuery, 'Search Menu', setSearchQuery)}
              className="w-12 h-12 neo-raised-sm rounded-xl flex items-center justify-center touch-target"
            >
              <span className="text-xl">🔍</span>
            </button>
          </header>
        )}

        {/* ==================== DESKTOP HEADER ==================== */}
        {isDesktop && (
          <header className="h-20 flex items-center justify-between px-6 border-b border-border/50 glass-panel z-40 shrink-0 gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-accent-gradient rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg shadow-accent/20">
                KP
              </div>
            </div>

            <div className="flex-1 max-w-2xl relative">
              <div
                onClick={() => openKeyboard('text', searchQuery, 'Search Menu', setSearchQuery)}
                className={cn(
                  "relative flex items-center transition-all duration-300 cursor-pointer group",
                  isSearchFocused ? "scale-[1.02]" : ""
                )}
              >
                <span className="absolute left-4 text-xl opacity-50 group-hover:opacity-100 transition-opacity">🔍</span>
                <div className="w-full neo-inset pl-12 pr-4 py-4 text-lg font-bold text-muted-foreground group-hover:shadow-lg transition-all">
                  {searchQuery || "Search Menu..."}
                </div>
                {searchQuery && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                    className="absolute right-4 w-8 h-8 rounded-full neo-raised-sm flex items-center justify-center hover:scale-105 transition-all"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Search Results Overlay */}
              {searchQuery && filteredMenu.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                    {filteredMenu.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleMenuItemClick(item)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-accent hover:text-white transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{item.category === 'beverages' ? '🥤' : '🍽️'}</span>
                          <div className="text-left">
                            <div className="font-bold text-sm">{item.name}</div>
                            <div className="text-[10px] opacity-60 uppercase font-black tracking-tighter">{item.category}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm">₹{item.price}</span>
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20">
                            <span className="text-lg font-bold">+</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-1 neo-inset-sm p-1 rounded-xl">
                {orderTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setOrderType(type.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      orderType === type.id
                        ? "bg-accent-gradient text-white shadow-lg shadow-accent/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </header>
        )}

        {/* ==================== CATEGORIES BAR ==================== */}
        <nav
          className={cn(
            "flex items-center gap-2 border-b border-border/50 glass-panel overflow-x-auto shrink-0",
            isMobile ? "h-12 px-3" : "h-14 px-4"
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "flex items-center gap-2 rounded-full whitespace-nowrap transition-all touch-target",
                isMobile ? "px-3 py-1.5" : "px-4 py-1.5",
                selectedCategory === category.id
                  ? "pill-nav-active"
                  : "pill-nav"
              )}
            >
              <span className={cn(isMobile ? "text-base" : "text-lg")}>{category.icon}</span>
              <span className={cn(
                "font-bold uppercase tracking-widest",
                isMobile ? "text-[9px]" : "text-[10px]"
              )}>{category.label}</span>
            </button>
          ))}
        </nav>

        {/* ==================== MENU GRID ==================== */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          isMobile ? "p-3 pb-32" : isTablet ? "p-4 pb-28" : "p-6"
        )}>
          {/* Table selection prompt for dine-in */}
          {!canAddItems && (
            <button
              onClick={() => setIsTableModalOpen(true)}
              className={cn(
                "w-full mb-4 bg-amber-500/20 border-2 border-amber-500/40 rounded-xl flex items-center justify-center gap-3 hover:bg-amber-500/30 transition-colors touch-target",
                isMobile ? "p-3" : "p-4"
              )}
            >
              <span className="text-2xl">🪑</span>
              <span className={cn(
                "font-bold text-amber-200",
                isMobile ? "text-sm" : ""
              )}>Select a table to start</span>
              <span className="text-amber-300">→</span>
            </button>
          )}

          {filteredMenu.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <span className="text-4xl mb-4">🍽️</span>
              <p className="font-bold uppercase tracking-widest text-sm">No items found</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-3",
              // Mobile: 2 columns
              // Tablet: 3-4 columns
              // Desktop: 4-6 columns
              isMobile ? "grid-cols-2" :
              isTablet ? "grid-cols-3 md:grid-cols-4" :
              "grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            )}>
              {filteredMenu.map((item) => (
                <PremiumMenuItemCard
                  key={item.id}
                  item={item}
                  onAddToCart={handleMenuItemClick}
                  disabled={!canAddItems}
                  disabledMessage="Select a table first for dine-in orders"
                />
              ))}
            </div>
          )}
        </div>

        {/* ==================== MOBILE/TABLET BOTTOM ACTION BAR ==================== */}
        {!isDesktop && (
          <div className="mobile-action-bar px-4 py-3 flex items-center gap-3 border-t border-border/50 glass-panel">
            {/* Cart Summary */}
            <button
              onClick={toggleCartDrawer}
              className="flex-1 flex items-center gap-3 neo-raised-sm p-3 rounded-xl touch-target"
            >
              <div className="relative">
                <span className="text-2xl">🛒</span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Cart</div>
                <div className="text-lg font-black">₹{grandTotal.toFixed(0)}</div>
              </div>
              <span className="text-muted-foreground">{isCartDrawerOpen ? '▼' : '▲'}</span>
            </button>

            {/* Quick Actions */}
            <button
              disabled={cart.length === 0}
              onClick={handleSendToKitchen}
              className="quick-action neo-raised-sm bg-surface-2 text-foreground disabled:opacity-30"
            >
              <span className="text-lg">📋</span>
              <span className="hidden sm:inline text-xs font-black uppercase">KOT</span>
            </button>

            <button
              disabled={!canGenerateBill}
              onClick={() => setIsPlaceOrderModalOpen(true)}
              className="quick-action btn-primary disabled:opacity-50"
            >
              <span className="text-lg">💵</span>
              <span className="hidden sm:inline text-xs font-black uppercase">Bill</span>
            </button>
          </div>
        )}
      </main>

      {/* ==================== MOBILE/TABLET CART DRAWER ==================== */}
      {!isDesktop && (
        <>
          {/* Backdrop */}
          {isCartDrawerOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
              onClick={() => setIsCartDrawerOpen(false)}
            />
          )}

          {/* Drawer */}
          <div className={cn(
            "mobile-drawer",
            isCartDrawerOpen && "open"
          )}>
            {/* Drawer Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-border rounded-full" />
            </div>

            {/* Drawer Header */}
            <div className="px-4 pb-3 flex items-center justify-between border-b border-border/50">
              <h2 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Order Summary
              </h2>
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-10 h-10 neo-raised-sm rounded-lg flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Table Info (for dine-in) */}
            {orderType === 'dine-in' && (
              <div className="px-4 py-3 border-b border-border/50 bg-surface-2">
                <div
                  onClick={() => setIsTableModalOpen(true)}
                  className="flex items-center gap-3 glass-card p-3 cursor-pointer"
                >
                  <div className="w-10 h-10 bg-accent-gradient rounded-lg flex flex-col items-center justify-center text-white shadow-lg shadow-accent/20">
                    <span className="text-[7px] font-black uppercase leading-none">Table</span>
                    <span className="text-base font-black leading-none">{tableNumber || '--'}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-foreground">
                      {tableNumber ? `Table ${tableNumber}` : 'Select Table'}
                    </div>
                    {tableNumber && (
                      <div className="text-[10px] text-muted-foreground">
                        {activeTableSession?.guestCount || 1} guest{(activeTableSession?.guestCount || 1) !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {activeTableOrder && (
                    <div className="status-success text-[8px] font-black px-2 py-1 rounded-full">Occupied</div>
                  )}
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[40vh]">
              {/* Active Table Items */}
              {activeTableOrder && activeTableOrder.items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Tab</span>
                    <span className="text-[10px] font-black text-accent">₹{activeTableOrder.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2 opacity-60">
                    {activeTableOrder.items.map((item, idx) => (
                      <div key={`active-${idx}`} className="neo-inset-sm p-2 flex justify-between items-center rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{item.menuItem.name}</div>
                          <div className="text-[10px] text-muted-foreground">Qty: {item.quantity}</div>
                        </div>
                        <div className="text-xs font-black">₹{item.subtotal.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase text-accent tracking-widest">New Items</span>
                  {cart.length > 0 && (
                    <button
                      onClick={() => usePOSStore.getState().clearCart()}
                      className="text-[10px] font-bold text-destructive uppercase"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {cart.length === 0 ? (
                  <div className="py-6 flex flex-col items-center justify-center text-muted-foreground neo-inset rounded-xl">
                    <span className="text-3xl mb-2 opacity-50">🛒</span>
                    <p className="font-black uppercase tracking-widest text-[9px]">Add items to cart</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <PremiumCartItemCard
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border/50 glass-panel space-y-3 safe-area-bottom">
              {/* Total */}
              <div className="neo-inset-sm p-3 rounded-xl flex justify-between items-center">
                <span className="font-bold text-muted-foreground">Grand Total</span>
                <span className="text-2xl font-black">₹{grandTotal.toFixed(2)}</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={cart.length === 0}
                  onClick={handleSendToKitchen}
                  className="py-4 rounded-xl neo-raised-sm text-foreground font-black text-xs uppercase tracking-widest disabled:opacity-30 touch-target"
                >
                  Send KOT
                </button>
                <button
                  disabled={!canGenerateBill}
                  onClick={() => setIsPlaceOrderModalOpen(true)}
                  className="btn-primary py-4 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 touch-target"
                >
                  Generate Bill
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== MOBILE SEARCH MODAL ==================== */}
      {isMobile && isMobileSearchOpen && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col safe-area-top">
          {/* Search Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border/50">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="w-10 h-10 neo-raised-sm rounded-lg flex items-center justify-center touch-target"
            >
              ←
            </button>
            <div
              onClick={() => openKeyboard('text', searchQuery, 'Search Menu', (val) => {
                setSearchQuery(val);
              })}
              className="flex-1 neo-inset p-3 rounded-xl flex items-center gap-2"
            >
              <span className="text-lg opacity-50">🔍</span>
              <span className={cn(
                "font-bold",
                searchQuery ? "text-foreground" : "text-muted-foreground"
              )}>
                {searchQuery || "Search menu..."}
              </span>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="w-10 h-10 neo-raised-sm rounded-lg flex items-center justify-center touch-target"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {searchQuery ? (
              filteredMenu.length > 0 ? (
                <div className="space-y-2">
                  {filteredMenu.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleMenuItemClick(item);
                        setIsMobileSearchOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl neo-raised-sm touch-target"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.category === 'beverages' ? '🥤' : '🍽️'}</span>
                        <div className="text-left">
                          <div className="font-bold">{item.name}</div>
                          <div className="text-[10px] opacity-60 uppercase font-black">{item.category}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black">₹{item.price}</span>
                        <div className="w-10 h-10 rounded-lg bg-accent text-white flex items-center justify-center">
                          <span className="text-lg font-bold">+</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <span className="text-4xl mb-4">🔍</span>
                  <p className="font-bold">No items found</p>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <span className="text-4xl mb-4">🔍</span>
                <p className="font-bold">Type to search menu items</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== DESKTOP SIDEBAR ==================== */}
      {isDesktop && (
        <aside className="w-[420px] flex flex-col neo-raised z-30">
          {/* Table Assignment */}
          <div className="p-6 border-b border-border/50 bg-surface-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Table Management
              </h2>
            </div>

            {orderType === 'dine-in' && (
              <div className="space-y-3">
                <div
                  onClick={() => setIsTableModalOpen(true)}
                  className="flex items-center gap-3 glass-card p-4 cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-accent-gradient rounded-xl flex flex-col items-center justify-center text-white shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
                    <span className="text-[8px] font-black uppercase leading-none mb-1">Table</span>
                    <span className="text-xl font-black leading-none">{tableNumber || '--'}</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-accent mb-1">Active Table</label>
                    <div className="text-2xl font-black text-foreground">
                      {tableNumber ? `Table ${tableNumber}` : <span className="text-muted-foreground/50">Select Table</span>}
                    </div>
                  </div>
                  {activeTableOrder && (
                    <div className="status-success text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest">Occupied</div>
                  )}
                </div>

                {/* Guest Count Input */}
                {tableNumber && (
                  <div
                    onClick={() => openKeyboard(
                      'number',
                      String(activeTableSession?.guestCount || 1),
                      'Number of Guests',
                      (val) => setGuestCount(tableNumber, parseInt(val) || 1, user?.tenantId)
                    )}
                    className="flex items-center gap-3 neo-raised-sm p-3 cursor-pointer neo-hover"
                  >
                    <div className="w-10 h-10 bg-info-light rounded-lg flex items-center justify-center text-info">
                      <span className="text-lg">👥</span>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black uppercase text-muted-foreground mb-0.5">Guests</label>
                      <div className="text-xl font-black text-foreground">
                        {activeTableSession?.guestCount || 1} {(activeTableSession?.guestCount || 1) === 1 ? 'Person' : 'People'}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-xs">Tap to edit</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Itemized List: Active Tab vs New Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Active Table Items (Already in Kitchen) */}
            {activeTableOrder && activeTableOrder.items.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Tab (KOT)</span>
                  <span className="text-[10px] font-black text-accent">₹{activeTableOrder.total.toFixed(2)}</span>
                </div>
                <div className="space-y-2 opacity-60">
                  {activeTableOrder.items.map((item, idx) => (
                    <div key={`active-${idx}`} className="neo-inset-sm p-3 flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{item.menuItem.name}</div>
                        <div className="text-[10px] text-muted-foreground">Qty: {item.quantity}</div>
                      </div>
                      <div className="text-xs font-black">₹{item.subtotal.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Items (Current Cart) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase text-accent tracking-widest">New Items</span>
                <button
                  onClick={() => usePOSStore.getState().clearCart()}
                  className="text-[10px] font-bold text-muted-foreground hover:text-destructive uppercase tracking-tighter transition-colors"
                >
                  Clear
                </button>
              </div>
              {cart.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground neo-inset rounded-2xl">
                  <span className="text-4xl mb-2 opacity-50">🛒</span>
                  <p className="font-black uppercase tracking-widest text-[8px]">Add items to cart</p>
                </div>
              ) : (
                cart.map((item) => (
                  <PremiumCartItemCard
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeFromCart}
                  />
                ))
              )}
            </div>
          </div>

          {/* Footer: KOT & Bill Generation */}
          <div className="p-6 border-t border-border/50 glass-panel space-y-4">
            {/* Totals Summary */}
            <div className="neo-inset-sm p-3 rounded-xl">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-muted-foreground">Grand Total</span>
                <span className="text-foreground text-xl">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={cart.length === 0}
                onClick={handleSendToKitchen}
                className="py-4 rounded-xl neo-raised-sm text-foreground font-black text-xs uppercase tracking-widest neo-hover active:neo-pressed disabled:opacity-30 transition-all"
              >
                Send KOT
              </button>
              <button
                disabled={!canGenerateBill}
                onClick={() => setIsPlaceOrderModalOpen(true)}
                className="btn-primary py-4 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                title={!canGenerateBill && orderType === 'dine-in' && tableNumber ? 'Send KOT first before generating bill' : ''}
              >
                Generate Bill
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modals */}
      <IndustrialModifierModal
        isOpen={isModifierModalOpen}
        onClose={() => {
          setIsModifierModalOpen(false);
          setSelectedMenuItem(null);
        }}
        menuItem={selectedMenuItem}
        onAddToCart={handleAddToCart}
      />

      <IndustrialCheckoutModal
        isOpen={isPlaceOrderModalOpen}
        onClose={() => setIsPlaceOrderModalOpen(false)}
        subtotal={cartTotals.subtotal + (activeTableOrder?.subtotal || 0)}
        tax={cartTotals.tax + (activeTableOrder?.tax || 0)}
        total={cartTotals.total + (activeTableOrder?.total || 0)}
        orderType={orderType}
        tableNumber={tableNumber}
        cartItems={cart}
        onGenerateBill={handleGenerateBill}
      />

      {/* Table Selector Modal */}
      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onSelect={setTableNumber}
        currentTableNumber={tableNumber}
      />

      {/* On-Screen Keyboard Dashboard */}
      <OnScreenKeyboard
        isOpen={keyboardConfig.isOpen}
        onClose={() => setKeyboardConfig({ ...keyboardConfig, isOpen: false })}
        type={keyboardConfig.type}
        value={keyboardConfig.value}
        title={keyboardConfig.title}
        onChange={(val) => {
          setKeyboardConfig({ ...keyboardConfig, value: val });
          keyboardConfig.onSave(val);
        }}
      />

      {/* Bill Preview Modal */}
      <BillPreviewModal
        isOpen={isBillPreviewOpen}
        onClose={() => setIsBillPreviewOpen(false)}
        billData={generatedBillData}
        invoiceNumber={generatedInvoiceNumber}
      />
    </div>
  );
}

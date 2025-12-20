import { useState, useEffect } from 'react';
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
  }, [user?.tenantId, loadTableSessions]);

  const { playSound } = useNotificationStore();

  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isSearchFocused, _setIsSearchFocused] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [generatedBillData, setGeneratedBillData] = useState<BillData | null>(null);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');

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
    if (orderType === 'dine-in' && !tableNumber) {
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

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans select-none text-foreground">
      {/* Main Content: Header + Grid */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
        {/* Top Bar: Powerful Search */}
        <header className="h-20 flex items-center justify-between px-6 border-b border-border glass-panel z-40 shrink-0 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg shadow-accent/20">
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
              <div className="w-full bg-white/5 border-2 border-white/10 rounded-2xl pl-12 pr-4 py-4 text-lg font-bold text-muted-foreground/50 group-hover:border-accent/30 transition-all">
                {searchQuery || "Search Menu..."}
              </div>
              {searchQuery && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                  className="absolute right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
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
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {orderTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setOrderType(type.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    orderType === type.id
                      ? "bg-accent text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Categories Bar */}
        <nav className="h-14 flex items-center px-4 gap-2 border-b border-border bg-card/30 overflow-x-auto scrollbar-hide shrink-0">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap transition-all border",
                selectedCategory === category.id
                  ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                  : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              )}
            >
              <span className="text-lg">{category.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">{category.label}</span>
            </button>
          ))}
        </nav>

        {/* Grid: Compact No-Image Cards */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Table selection prompt for dine-in */}
          {!canAddItems && (
            <button
              onClick={() => setIsTableModalOpen(true)}
              className="w-full mb-4 p-4 bg-amber-500/20 border-2 border-amber-500/40 rounded-xl flex items-center justify-center gap-3 hover:bg-amber-500/30 transition-colors"
            >
              <span className="text-2xl">🪑</span>
              <span className="font-bold text-amber-200">Select a table to start adding items</span>
              <span className="text-amber-300">→</span>
            </button>
          )}

          {filteredMenu.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <span className="text-4xl mb-4">🍽️</span>
              <p className="font-bold uppercase tracking-widest text-sm">No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-10">
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
      </main>

      {/* Right Sidebar: Order Summary (Open Tab Workflow) */}
      <aside className="w-[420px] flex flex-col bg-card border-l border-border z-30 shadow-2xl">
        {/* Table Assignment */}
        <div className="p-6 border-b border-border bg-white/5 space-y-4">
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
                className="flex items-center gap-3 bg-accent/10 p-4 rounded-2xl border border-accent/20 shadow-inner cursor-pointer hover:bg-accent/20 transition-all group"
              >
                <div className="w-12 h-12 bg-accent rounded-xl flex flex-col items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
                  <span className="text-[8px] font-black uppercase leading-none mb-1">Table</span>
                  <span className="text-xl font-black leading-none">{tableNumber || '--'}</span>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-accent mb-1">Active Table</label>
                  <div className="text-2xl font-black text-foreground">
                    {tableNumber ? `Table ${tableNumber}` : <span className="text-accent/20">Select Table</span>}
                  </div>
                </div>
                {activeTableOrder && (
                  <div className="bg-green-500/20 text-green-500 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest">Occupied</div>
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
                  className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all"
                >
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background/30">
          {/* Active Table Items (Already in Kitchen) */}
          {activeTableOrder && activeTableOrder.items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Tab (KOT)</span>
                <span className="text-[10px] font-black text-accent">₹{activeTableOrder.total.toFixed(2)}</span>
              </div>
              <div className="space-y-2 opacity-60">
                {activeTableOrder.items.map((item, idx) => (
                  <div key={`active-${idx}`} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
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
              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground opacity-20 border-2 border-dashed border-white/5 rounded-2xl">
                <span className="text-4xl mb-2">🛒</span>
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
        <div className="p-6 border-t border-border bg-card space-y-4">
          {/* Totals Summary */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase">
              <span>Grand Total</span>
              <span className="text-foreground">₹{(cartTotals.total + (activeTableOrder?.total || 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={cart.length === 0}
              onClick={handleSendToKitchen}
              className="py-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-black text-xs uppercase tracking-widest shadow-lg hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30"
            >
              Send KOT
            </button>
            <button
              disabled={!canGenerateBill}
              onClick={() => setIsPlaceOrderModalOpen(true)}
              className="py-4 rounded-xl bg-accent-gradient text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              title={!canGenerateBill && orderType === 'dine-in' && tableNumber ? 'Send KOT first before generating bill' : ''}
            >
              Generate Bill
            </button>
          </div>
        </div>
      </aside>

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

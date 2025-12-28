/**
 * Industrial POS Dashboard
 * Optimized for service staff - no scrolling for categories, large touch targets
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
import { useMenuStore } from '../stores/menuStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import { usePOSSessionStore } from '../stores/posSessionStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { useKDSStore } from '../stores/kdsStore';
import { MenuItem, OrderType, ComboSelection } from '../types/pos';
import { billService } from '../lib/billService';
import { IndustrialModifierModal } from '../components/pos/IndustrialModifierModal';
import { IndustrialCheckoutModal } from '../components/pos/IndustrialCheckoutModal';
import { ComboSelectionModal } from '../components/pos/ComboSelectionModal';
import { BillPreviewModal } from '../components/pos/BillPreviewModal';
import { OnScreenKeyboard } from '../components/ui-v2/OnScreenKeyboard';
import { TableSelectorModal } from '../components/pos/TableSelectorModal';
import { StaffPinEntryModal } from '../components/pos/StaffPinEntryModal';
import { BillData } from '../components/print/BillPrint';
import { cn } from '../lib/utils';

// Category icon helper
function getCategoryIcon(categoryName: string): string {
  const name = categoryName.toLowerCase();
  if (name.includes('appetizer') || name.includes('starter')) return '🥟';
  if (name.includes('main') || name.includes('entree') || name.includes('curry')) return '🍛';
  if (name.includes('combo')) return '🍱';
  if (name.includes('side')) return '🍚';
  if (name.includes('dessert') || name.includes('sweet')) return '🍰';
  if (name.includes('beverage') || name.includes('drink')) return '🥤';
  if (name.includes('rice')) return '🍚';
  if (name.includes('bread') || name.includes('roti')) return '🫓';
  if (name.includes('special')) return '⭐';
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
    todaysSpecials,
    specialsLoaded,
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
    loadTableSessions,
    loadTodaysSpecials,
    isKotPrintedForTable,
  } = usePOSStore();

  const { categories: menuCategories } = useMenuStore();
  const { sections, tables, loadFloorPlan, isLoaded: floorPlanLoaded, isLoading: floorPlanLoading } = useFloorPlanStore();
  const { activeStaff, isSessionValid } = usePOSSessionStore();
  const { settings } = useRestaurantSettingsStore();
  const { playSound } = useNotificationStore();
  const { areAllKotsCompletedForTable } = useKDSStore();

  // Settings
  const requireStaffPin = settings.posSettings?.requireStaffPinForPOS || false;
  const sessionTimeout = settings.posSettings?.pinSessionTimeoutMinutes || 0;
  const hasValidSession = !requireStaffPin || (activeStaff && isSessionValid(sessionTimeout));

  // Modal states
  const [isStaffPinModalOpen, setIsStaffPinModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [generatedBillData, setGeneratedBillData] = useState<BillData | null>(null);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');

  // Keyboard state
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
    onSave: () => {},
  });

  // Load data on mount
  useEffect(() => {
    if (user?.tenantId) {
      loadTableSessions(user.tenantId);
      if (!floorPlanLoaded && !floorPlanLoading) {
        loadFloorPlan(user.tenantId);
      }
      // Load today's specials for quick billing
      if (!specialsLoaded) {
        loadTodaysSpecials(user.tenantId);
      }
    }
  }, [user?.tenantId]);

  // Show staff PIN modal if required
  useEffect(() => {
    if (requireStaffPin && !hasValidSession) {
      setIsStaffPinModalOpen(true);
    }
  }, [requireStaffPin, hasValidSession]);

  // Current table info
  const currentTableInfo = useMemo(() => {
    if (tableNumber === null) return null;
    const table = tables.find(t => parseInt(t.tableNumber, 10) === tableNumber);
    if (!table) return { tableNumber, sectionName: null, capacity: null };
    const section = sections.find(s => s.id === table.sectionId);
    return {
      tableNumber,
      sectionName: section?.name || null,
      capacity: table.capacity,
    };
  }, [tableNumber, tables, sections]);

  const filteredMenu = getFilteredMenu();
  const cartTotals = getCartTotal();
  const activeTableSession = tableNumber ? getTableSession(tableNumber) : null;
  const activeTableOrder = activeTableSession?.order || null;

  // Billing check - requires KOT printed AND all KOTs completed in KDS
  const canGenerateBill = (() => {
    if (!activeTableOrder && cart.length === 0) return false;
    if (orderType === 'dine-in' && tableNumber) {
      // Must have sent at least one KOT
      if (!isKotPrintedForTable(tableNumber)) return false;
      // All KOTs for this table must be completed in KDS (bumped)
      if (!areAllKotsCompletedForTable(tableNumber)) return false;
      return true;
    }
    return true;
  })();

  // Build categories with "All" first, then "Today's Special" if specials exist
  const categories = useMemo(() => {
    const baseCategories = [
      { id: 'all', label: 'All', icon: '📋', isSpecial: false },
    ];

    // Add "Today's Special" category only if there are specials loaded
    if (todaysSpecials.length > 0) {
      baseCategories.push({
        id: 'todays-special',
        label: "TODAY'S",
        icon: '⭐',
        isSpecial: true,
      });
    }

    // Add regular menu categories
    const regularCategories = menuCategories.map((cat) => ({
      id: cat.id,
      label: cat.name.length > 12 ? cat.name.substring(0, 10) + '...' : cat.name,
      fullLabel: cat.name,
      icon: cat.icon || getCategoryIcon(cat.name),
      isSpecial: false,
    }));

    return [...baseCategories, ...regularCategories];
  }, [menuCategories, todaysSpecials]);

  const orderTypes: { id: OrderType; label: string; icon: string }[] = [
    { id: 'dine-in', label: 'DINE', icon: '🪑' },
    { id: 'takeout', label: 'TAKE', icon: '🥡' },
    { id: 'delivery', label: 'DLVR', icon: '🛵' },
  ];

  const canAddItems = orderType !== 'dine-in' || tableNumber !== null;

  const handleMenuItemClick = (item: MenuItem) => {
    if (orderType === 'dine-in' && tableNumber === null) {
      setIsTableModalOpen(true);
      return;
    }

    if (item.isCombo && item.comboGroups && item.comboGroups.length > 0) {
      setSelectedMenuItem(item);
      setIsComboModalOpen(true);
    } else if (item.modifiers && item.modifiers.length > 0) {
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
    specialInstructions?: string,
    comboSelections?: ComboSelection[]
  ) => {
    addToCart(menuItem, quantity, modifiers, specialInstructions, comboSelections);
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
    if (orderType === 'dine-in' && tableNumber) {
      if (!isKotPrintedForTable(tableNumber)) {
        alert('Send KOT first before generating bill.');
        return;
      }
      if (!areAllKotsCompletedForTable(tableNumber)) {
        alert('All KOTs must be completed in kitchen before generating bill. Please wait for kitchen to finish preparing the order.');
        return;
      }
    }
    try {
      const order = await submitOrder(user.tenantId, 'pending');
      playSound('order_ready');
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
    setKeyboardConfig({ isOpen: true, type, value: currentVal, title, onSave });
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = cartTotals.total + (activeTableOrder?.total || 0);

  return (
    <div className="h-screen w-screen bg-[#0d0d0d] flex flex-col overflow-hidden select-none">
      {/* ========== TOP BAR - Fixed 80px ========== */}
      <header className="h-20 flex-shrink-0 bg-gradient-to-b from-zinc-800 to-zinc-900 border-b-2 border-zinc-700 px-4 flex items-center gap-4">
        {/* Table/Order Type Selector */}
        <div className="flex items-center gap-2">
          {/* Table Button */}
          <button
            onClick={() => setIsTableModalOpen(true)}
            className={cn(
              "h-14 px-4 rounded-xl border-2 flex items-center gap-3 transition-all",
              tableNumber !== null
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400"
            )}
          >
            <span className="text-2xl">🪑</span>
            <div className="text-left">
              <div className="text-[10px] font-mono uppercase tracking-wider opacity-60">TABLE</div>
              <div className="text-xl font-black font-mono">{tableNumber ?? '--'}</div>
            </div>
          </button>

          {/* Order Type Pills */}
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl border-2 border-zinc-700">
            {orderTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className={cn(
                  "h-12 px-4 rounded-lg font-black text-xs uppercase tracking-wide transition-all flex items-center gap-2",
                  orderType === type.id
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                )}
              >
                <span className="text-lg">{type.icon}</span>
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <button
            onClick={() => {
              openKeyboard('text', searchQuery, 'Search Menu', (val) => {
                setSearchQuery(val);
              });
            }}
            className={cn(
              "w-full h-14 px-5 rounded-xl border-2 flex items-center gap-3 transition-all text-left",
              searchQuery
                ? "bg-amber-500/20 border-amber-500"
                : "bg-zinc-800 border-zinc-600 hover:border-zinc-400"
            )}
          >
            <span className="text-xl">🔍</span>
            <span className={cn(
              "flex-1 font-bold text-sm uppercase truncate",
              searchQuery ? "text-amber-400" : "text-zinc-500"
            )}>
              {searchQuery || 'SEARCH MENU...'}
            </span>
            {searchQuery && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                }}
                className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </button>
        </div>

        {/* Staff Info (if PIN required) */}
        {activeStaff && (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-xl border-2 border-zinc-700">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
              {activeStaff.name.charAt(0)}
            </div>
            <div className="text-left">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">STAFF</div>
              <div className="text-sm font-bold text-white">{activeStaff.name}</div>
            </div>
          </div>
        )}

        {/* Cart Summary - Quick View */}
        <div className="flex items-center gap-3 px-5 py-2 bg-zinc-800 rounded-xl border-2 border-zinc-700">
          <div className="relative">
            <span className="text-3xl">🛒</span>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-black">
                {cartItemCount}
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">TOTAL</div>
            <div className="text-2xl font-black text-white font-mono">₹{grandTotal.toFixed(0)}</div>
          </div>
        </div>
      </header>

      {/* ========== CATEGORY GRID - 2 Rows, No Scroll ========== */}
      <nav className="flex-shrink-0 bg-zinc-900 border-b-2 border-zinc-700 p-3">
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {categories.slice(0, 20).map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              title={(category as any).fullLabel || category.label}
              className={cn(
                "h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
                // Special amber styling for Today's Special category
                category.isSpecial && selectedCategory === category.id
                  ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20"
                  : category.isSpecial && selectedCategory !== category.id
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-400/70 hover:border-amber-500 hover:text-amber-400"
                  : selectedCategory === category.id
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className="text-xl">{category.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-tight truncate w-full px-1 text-center">
                {category.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* ========== MAIN CONTENT - Menu Grid + Cart Sidebar ========== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu Items Grid */}
        <main className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a]">
          {/* Table selection prompt */}
          {!canAddItems && (
            <button
              onClick={() => setIsTableModalOpen(true)}
              className="w-full mb-4 h-16 bg-amber-500/20 border-2 border-amber-500 rounded-xl flex items-center justify-center gap-3 hover:bg-amber-500/30 transition-colors"
            >
              <span className="text-3xl">🪑</span>
              <span className="font-black text-amber-400 uppercase tracking-wide">SELECT TABLE TO START</span>
              <span className="text-2xl">→</span>
            </button>
          )}

          {filteredMenu.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <span className="text-6xl mb-4 opacity-50">🍽️</span>
              <p className="font-black uppercase tracking-widest">No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMenuItemClick(item)}
                  disabled={!canAddItems}
                  className={cn(
                    "relative p-4 rounded-xl border-2 text-left transition-all group",
                    "min-h-[120px] flex flex-col justify-between",
                    canAddItems
                      ? "bg-zinc-800/80 border-zinc-600 hover:border-emerald-500 hover:bg-zinc-700 active:scale-[0.98] shadow-lg"
                      : "bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed"
                  )}
                >
                  {/* Veg/Non-veg indicator - top left */}
                  <div className="absolute top-3 left-3">
                    {item.tags?.includes('veg') && (
                      <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                    )}
                    {item.tags?.includes('non-veg') && (
                      <div className="w-5 h-5 rounded border-2 border-red-500 bg-red-500/20 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      </div>
                    )}
                  </div>

                  {/* Combo Badge - top right */}
                  {item.isCombo && (
                    <span className="absolute top-2 right-2 px-2 py-1 bg-purple-500/30 border border-purple-500 rounded-lg text-[9px] font-black text-purple-300 uppercase tracking-wide">
                      COMBO
                    </span>
                  )}

                  {/* Item Name - prominent, larger text */}
                  <div className="flex-1 pt-6">
                    <h3 className="font-bold text-base text-white leading-snug line-clamp-2 group-hover:text-emerald-300 transition-colors">
                      {item.name}
                    </h3>
                  </div>

                  {/* Price - larger, more prominent */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-black text-lg text-emerald-400 font-mono">₹{item.price}</span>
                    <div className="w-9 h-9 rounded-xl bg-zinc-600 border-2 border-zinc-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:border-emerald-400 transition-all">
                      <span className="text-xl font-bold text-zinc-300 group-hover:text-white">+</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        {/* ========== RIGHT SIDEBAR - Order ========== */}
        <aside className="w-80 lg:w-96 flex-shrink-0 bg-zinc-900 border-l-2 border-zinc-700 flex flex-col">
          {/* Order Header */}
          <div className="flex-shrink-0 p-4 border-b-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-widest text-sm text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ORDER
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => usePOSStore.getState().clearCart()}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wide px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-all"
                >
                  CLEAR
                </button>
              )}
            </div>

            {/* Table Info for Dine-in */}
            {orderType === 'dine-in' && tableNumber !== null && (
              <div className="mt-3 p-3 bg-zinc-800 rounded-xl border border-zinc-700 flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-500 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-[8px] font-mono text-emerald-400">TBL</span>
                  <span className="text-lg font-black text-emerald-400">{tableNumber}</span>
                </div>
                <div className="flex-1">
                  {currentTableInfo?.sectionName && (
                    <div className="text-[10px] font-mono text-emerald-400 uppercase">{currentTableInfo.sectionName}</div>
                  )}
                  <div className="text-xs text-zinc-400">
                    {activeTableSession?.guestCount || 1} guest{(activeTableSession?.guestCount || 1) !== 1 ? 's' : ''}
                    {currentTableInfo?.capacity && ` • ${currentTableInfo.capacity} seats`}
                  </div>
                </div>
                {activeTableOrder && (
                  <span className="px-2 py-1 bg-amber-500/20 border border-amber-500 rounded text-[10px] font-black text-amber-400 uppercase">
                    ACTIVE
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Order Items - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* NEW ITEMS - Show at top (editable, not yet sent to kitchen) */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  NEW ITEMS
                </div>
                {cart.map((item) => (
                  <div key={item.id} className="p-3 bg-zinc-800 rounded-xl border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white truncate">{item.menuItem.name}</div>
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">
                          ₹{item.menuItem.price} × {item.quantity}
                        </div>
                        {/* Combo Selections */}
                        {item.comboSelections && item.comboSelections.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.comboSelections.map((group) => (
                              <div key={group.groupId} className="flex flex-wrap items-center gap-1">
                                <span className="text-[9px] font-bold text-purple-400 uppercase">
                                  {group.groupName}:
                                </span>
                                {group.selectedItems.map((sel, idx) => (
                                  <span key={idx} className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                                    {sel.name}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 hover:bg-red-500/30"
                      >
                        ×
                      </button>
                    </div>

                    {/* Quantity Controls */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-zinc-900 rounded-lg border border-zinc-700 p-1">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center text-white font-bold hover:bg-zinc-700"
                        >
                          −
                        </button>
                        <span className="w-10 text-center font-black text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center text-white font-bold hover:bg-zinc-700"
                        >
                          +
                        </button>
                      </div>
                      <div className="font-black text-emerald-400 font-mono text-lg">
                        ₹{item.subtotal.toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SENT TO KITCHEN - Items already sent (non-editable, shown with orange indicator) */}
            {activeTableOrder && activeTableOrder.items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 py-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-lg shadow-amber-500/50" />
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                    RUNNING ORDER ({activeTableOrder.items.length} items)
                  </span>
                </div>
                {activeTableOrder.items.map((item, idx) => (
                  <div key={`active-${idx}`} className="p-3 bg-amber-500/5 rounded-xl border-2 border-amber-500/40 flex justify-between items-center">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full bg-amber-500/50" />
                      <div>
                        <div className="text-sm font-bold text-white truncate">{item.menuItem.name}</div>
                        <div className="text-xs text-amber-400/70 font-mono">× {item.quantity} • In Kitchen</div>
                      </div>
                    </div>
                    <div className="text-base font-black text-amber-400 font-mono">₹{item.subtotal.toFixed(0)}</div>
                  </div>
                ))}
                {/* Running Order Total */}
                <div className="flex justify-between items-center px-3 py-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <span className="text-xs font-bold text-amber-400/70 uppercase">Running Total</span>
                  <span className="text-base font-black text-amber-400 font-mono">₹{activeTableOrder.total.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Empty state - only show if both new items and active order are empty */}
            {cart.length === 0 && (!activeTableOrder || activeTableOrder.items.length === 0) && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                <span className="text-5xl mb-3 opacity-30">📋</span>
                <p className="font-black uppercase tracking-widest text-xs">Add items</p>
              </div>
            )}
          </div>

          {/* Order Footer - Actions */}
          <div className="flex-shrink-0 p-4 border-t-2 border-zinc-700 bg-gradient-to-t from-zinc-800 to-zinc-900 space-y-3">
            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-xl border-2 border-zinc-700">
              <span className="font-bold text-zinc-400 uppercase text-sm">Grand Total</span>
              <span className="text-3xl font-black text-white font-mono">₹{grandTotal.toFixed(0)}</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={cart.length === 0}
                onClick={handleSendToKitchen}
                className={cn(
                  "h-14 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                  cart.length === 0
                    ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                    : "bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30 active:scale-95"
                )}
              >
                📋 SEND KOT
              </button>
              <button
                disabled={!canGenerateBill}
                onClick={() => setIsPlaceOrderModalOpen(true)}
                className={cn(
                  "h-14 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                  canGenerateBill
                    ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/30"
                    : "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                )}
              >
                💵 BILL
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ========== MODALS ========== */}
      <IndustrialModifierModal
        isOpen={isModifierModalOpen}
        onClose={() => {
          setIsModifierModalOpen(false);
          setSelectedMenuItem(null);
        }}
        menuItem={selectedMenuItem}
        onAddToCart={handleAddToCart}
      />

      <ComboSelectionModal
        isOpen={isComboModalOpen}
        onClose={() => {
          setIsComboModalOpen(false);
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

      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onSelect={setTableNumber}
        currentTableNumber={tableNumber}
      />

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

      <BillPreviewModal
        isOpen={isBillPreviewOpen}
        onClose={() => setIsBillPreviewOpen(false)}
        billData={generatedBillData}
        invoiceNumber={generatedInvoiceNumber}
      />

      <StaffPinEntryModal
        isOpen={isStaffPinModalOpen}
        onClose={() => {
          if (hasValidSession || !requireStaffPin) {
            setIsStaffPinModalOpen(false);
          }
        }}
        onSuccess={() => setIsStaffPinModalOpen(false)}
      />
    </div>
  );
}

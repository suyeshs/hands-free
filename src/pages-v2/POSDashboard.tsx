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
import { MenuItem, OrderType, ComboSelection, Order, PaymentMethod } from '../types/pos';
import { billService } from '../lib/billService';
import { salesTransactionService } from '../lib/salesTransactionService';
import { IndustrialModifierModal } from '../components/pos/IndustrialModifierModal';
import { IndustrialCheckoutModal } from '../components/pos/IndustrialCheckoutModal';
import { ComboSelectionModal } from '../components/pos/ComboSelectionModal';
import { PortionSelectionModal, needsPortionSelection } from '../components/pos/PortionSelectionModal';
import { BillPreviewModal } from '../components/pos/BillPreviewModal';
import { PaymentSelectionModal } from '../components/pos/PaymentSelectionModal';
import { OnScreenKeyboard } from '../components/ui-v2/OnScreenKeyboard';
import { TableSelectorModal } from '../components/pos/TableSelectorModal';
import { StaffPinEntryModal } from '../components/pos/StaffPinEntryModal';
import { BillData } from '../components/print/BillPrint';
import { cn } from '../lib/utils';
import { useOutOfStockStore } from '../stores/outOfStockStore';
import { OutOfStockAlertModal } from '../components/alerts/OutOfStockAlertModal';
import type { OutOfStockAlert } from '../types/stock';
import { OrderBottomSheet } from '../components/pos/OrderBottomSheet';
import { useScreenSize } from '../hooks/useScreenSize';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { CustomItemModal } from '../components/pos/CustomItemModal';
import { AggregatorOrdersDrawer } from '../components/pos/AggregatorOrdersDrawer';
import { Search, Package, PlusCircle, ChefHat, Clock, Sun, Moon } from 'lucide-react';

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
    selectedCategory,
    searchQuery,
    orderType,
    tableNumber,
    todaysSpecials,
    specialsLoaded,
    cart,
    activeTables,
    activePickupOrders,
    currentPickupOrderId,
    setSelectedCategory,
    setSearchQuery,
    setOrderType,
    setTableNumber,
    openTable,
    addToCart,
    removeFromCart,
    submitOrder,
    sendToKitchen,
    getCartTotal,
    getFilteredMenu,
    getTableSession,
    loadTableSessions,
    loadTodaysSpecials,
    isKotPrintedForTable,
    createPickupOrder,
    selectPickupOrder,
    closePickupOrder,
    markTableBillPrinted,
    closeTableWithPayment,
    isTableBillPrinted,
    getTableInvoiceNumber,
    markPickupBillPrinted,
    closePickupWithPayment,
    getPickupInvoiceNumber,
  } = usePOSStore();

  const { categories: menuCategories } = useMenuStore();
  const { sections, tables, loadFloorPlan, isLoaded: floorPlanLoaded, isLoading: floorPlanLoading } = useFloorPlanStore();
  const { activeStaff, isSessionValid } = usePOSSessionStore();
  const { settings } = useRestaurantSettingsStore();
  const { playSound } = useNotificationStore();
  // Subscribe to activeOrders/completedOrders to trigger re-renders when KDS state changes
  // The functions below use this state internally, but selecting it makes the component reactive
  const { activeOrders: _activeOrders, completedOrders: _completedOrders, areAllKotsCompletedForTable, hasAnyCompletedKotForTable, getItemStatusesForTable, getOrderStatusForTable, loadOrdersFromDb } = useKDSStore();
  // Mark as used to silence TS error (they trigger re-renders when KDS state changes)
  void _activeOrders; void _completedOrders;

  // Screen size for responsive layout
  const { isCompact } = useScreenSize();

  // Aggregator orders
  const { orders: aggregatorOrders, getStats: getAggregatorStats } = useAggregatorStore();
  const [showAggregatorPanel, setShowAggregatorPanel] = useState(false);
  const aggregatorStats = getAggregatorStats();

  // Custom item modal
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false);

  // Out of Stock alerts
  const { pendingAlerts, acknowledgeAlert } = useOutOfStockStore();
  const [currentOosAlert, setCurrentOosAlert] = useState<OutOfStockAlert | null>(null);

  // Settings
  const requireStaffPin = settings.posSettings?.requireStaffPinForPOS || false;
  const sessionTimeout = settings.posSettings?.pinSessionTimeoutMinutes || 0;
  const hasValidSession = !requireStaffPin || (activeStaff && isSessionValid(sessionTimeout));

  // Theme state - synced with settings
  const [theme, setTheme] = useState<'dark' | 'light'>(settings.posSettings?.theme || 'dark');
  const { updateSettings } = useRestaurantSettingsStore();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    updateSettings({
      posSettings: {
        ...settings.posSettings,
        theme: newTheme,
      },
    });
  };

  // Theme-based classes - Light mode optimized for legibility on lower-res screens
  const isDark = theme === 'dark';
  const themeClasses = {
    // Main backgrounds - light mode uses off-white for better contrast
    screenBg: isDark ? 'bg-[#0d0d0d]' : 'bg-stone-100',
    headerBg: isDark ? 'bg-gradient-to-b from-zinc-800 to-zinc-900' : 'bg-gradient-to-b from-white to-stone-50',
    headerBorder: isDark ? 'border-zinc-700' : 'border-stone-300',
    // Category bar
    navBg: isDark ? 'bg-zinc-900' : 'bg-white',
    navBorder: isDark ? 'border-zinc-700' : 'border-stone-300',
    // Main content
    mainBg: isDark ? 'bg-[#0a0a0a]' : 'bg-stone-50',
    // Sidebar
    sidebarBg: isDark ? 'bg-zinc-900' : 'bg-white',
    sidebarBorder: isDark ? 'border-zinc-700' : 'border-stone-300',
    // Cards - stronger borders in light mode for definition
    cardBg: isDark ? 'bg-zinc-800' : 'bg-white',
    cardBorder: isDark ? 'border-zinc-600' : 'border-stone-300',
    cardHover: isDark ? 'hover:border-emerald-500 hover:bg-zinc-700' : 'hover:border-emerald-600 hover:bg-emerald-50',
    // Text - darker text for legibility
    textPrimary: isDark ? 'text-white' : 'text-stone-900',
    textSecondary: isDark ? 'text-zinc-400' : 'text-stone-600',
    textMuted: isDark ? 'text-zinc-500' : 'text-stone-500',
    // Buttons
    buttonBg: isDark ? 'bg-zinc-800' : 'bg-white',
    buttonBorder: isDark ? 'border-zinc-700' : 'border-stone-400',
    buttonHover: isDark ? 'hover:bg-zinc-700' : 'hover:bg-stone-100',
    // Input fields
    inputBg: isDark ? 'bg-zinc-800' : 'bg-stone-50',
    inputBorder: isDark ? 'border-zinc-700' : 'border-stone-400',
    // Pills/Tags
    pillBg: isDark ? 'bg-zinc-700' : 'bg-stone-200',
    // Accent colors stay consistent
  };

  // Modal states
  const [isStaffPinModalOpen, setIsStaffPinModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [isPortionModalOpen, setIsPortionModalOpen] = useState(false);
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [generatedBillData, setGeneratedBillData] = useState<BillData | null>(null);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');

  // Payment selection modal state (for billed tables/pickups)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalTableNumber, setPaymentModalTableNumber] = useState<number | null>(null);
  const [paymentModalPickupId, setPaymentModalPickupId] = useState<string | null>(null);
  const [paymentModalBillTotal, setPaymentModalBillTotal] = useState(0);
  const [paymentModalInvoiceNumber, setPaymentModalInvoiceNumber] = useState<string | undefined>(undefined);

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

  // Load data on mount - ALWAYS reload table sessions and KDS orders
  // This ensures data is fresh after navigation away and back
  useEffect(() => {
    const loadData = async () => {
      if (user?.tenantId) {
        console.log('[POSDashboard] Component mounted, loading data for tenant:', user.tenantId);
        // Always reload table sessions from SQLite on mount
        await loadTableSessions(user.tenantId);
        // Always reload KDS orders from SQLite (needed for billing eligibility check)
        await loadOrdersFromDb(user.tenantId);
        if (!floorPlanLoaded && !floorPlanLoading) {
          loadFloorPlan(user.tenantId);
        }
        // Load today's specials for quick billing
        if (!specialsLoaded) {
          loadTodaysSpecials(user.tenantId);
        }
      }
    };
    loadData();
  }, [user?.tenantId, loadTableSessions, loadOrdersFromDb]);

  // Show staff PIN modal if required
  useEffect(() => {
    if (requireStaffPin && !hasValidSession) {
      setIsStaffPinModalOpen(true);
    }
  }, [requireStaffPin, hasValidSession]);

  // Watch for new OOS alerts and show modal
  useEffect(() => {
    const unacknowledged = pendingAlerts.filter((a) => !a.acknowledged);
    if (unacknowledged.length > 0 && !currentOosAlert) {
      setCurrentOosAlert(unacknowledged[0]);
      playSound('order_urgent');
    }
  }, [pendingAlerts, currentOosAlert, playSound]);

  // Handle OOS alert acknowledgment
  const handleOosAcknowledge = () => {
    if (currentOosAlert) {
      acknowledgeAlert(currentOosAlert.id, activeStaff?.name);
      setCurrentOosAlert(null);
    }
  };

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

  // Get the active cart based on order type (pickupCart for takeout, cart for dine-in)
  // Computed directly from subscribed state to ensure re-renders
  const activeCart = useMemo(() => {
    const isPickup = orderType === 'takeout';
    const currentPickupSession = isPickup && currentPickupOrderId
      ? activePickupOrders[currentPickupOrderId]
      : null;
    return isPickup ? (currentPickupSession?.items || []) : cart;
  }, [orderType, cart, activePickupOrders, currentPickupOrderId]);

  // Check if current table/pickup has bill printed (awaiting payment)
  const isCurrentOrderBilled = (() => {
    if (orderType === 'dine-in' && tableNumber) {
      return isTableBillPrinted(tableNumber);
    }
    if (orderType === 'takeout' && currentPickupOrderId) {
      const pickup = activePickupOrders[currentPickupOrderId];
      return pickup?.billPrinted === true;
    }
    return false;
  })();

  // Billing check
  // For dine-in: requires KOT printed AND ALL KOTs completed (bumped) in KDS
  // For pickup: requires KOT sent first (same workflow as dine-in)
  const canGenerateBill = (() => {
    // If already billed, cannot generate bill again
    if (isCurrentOrderBilled) return false;

    // For pickup orders, require KOT sent first (status !== 'staging')
    if (orderType === 'takeout') {
      if (!currentPickupOrderId) return false;
      const pickup = activePickupOrders[currentPickupOrderId];
      // Must have sent KOT (status changes from 'staging' to 'sent' after sendToKitchen)
      if (!pickup || pickup.status === 'staging') return false;
      // Must have an order (created when KOT is sent)
      if (!pickup.order) return false;
      // Must have items in the order
      if (!pickup.order.items || pickup.order.items.length === 0) return false;
      return true;
    }
    // For dine-in, require table and KOT workflow
    if (!activeTableOrder && activeCart.length === 0) return false;
    if (orderType === 'dine-in' && tableNumber) {
      // Must have sent at least one KOT
      if (!isKotPrintedForTable(tableNumber)) return false;
      // ALL KOTs must be completed (bumped) - no active orders in KDS for this table
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
    { id: 'dine-in', label: 'DINE-IN', icon: '🪑' },
    { id: 'takeout', label: 'PICKUP', icon: '🥡' },
  ];

  // Can add items: dine-in requires table, pickup doesn't need table
  const canAddItems = orderType === 'takeout' || (orderType === 'dine-in' && tableNumber !== null);

  const handleMenuItemClick = (item: MenuItem) => {
    // For dine-in, require table selection first
    if (orderType === 'dine-in' && tableNumber === null) {
      setIsTableModalOpen(true);
      return;
    }
    // Pickup orders don't need table selection - proceed directly

    // Debug: Log item properties to check combo detection
    console.log('[POSDashboard] Item clicked:', item.name, {
      isCombo: item.isCombo,
      comboGroups: item.comboGroups,
      comboGroupsLength: item.comboGroups?.length,
      hasModifiers: item.modifiers?.length,
    });

    if (item.isCombo && item.comboGroups && item.comboGroups.length > 0) {
      console.log('[POSDashboard] Opening combo modal for:', item.name);
      setSelectedMenuItem(item);
      setIsComboModalOpen(true);
    } else if (needsPortionSelection(item)) {
      // Rice items (Ney Kullu, Steamed Rice) - show portion selection
      setSelectedMenuItem(item);
      setIsPortionModalOpen(true);
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

  const handleGenerateBill = async (cashDiscount?: number) => {
    if (!user?.tenantId) return;

    const isPickupOrder = orderType === 'takeout';

    // Validation: KOT must be sent first
    if (orderType === 'dine-in' && tableNumber) {
      if (!isKotPrintedForTable(tableNumber)) {
        alert('Send KOT first before generating bill.');
        return;
      }
      // Either all KOTs completed OR at least one KOT completed
      if (!areAllKotsCompletedForTable(tableNumber) && !hasAnyCompletedKotForTable(tableNumber)) {
        alert('At least one KOT must be completed in kitchen before generating bill. Please wait for kitchen to finish preparing some items.');
        return;
      }
    }

    if (isPickupOrder) {
      // For pickup orders, KOT must have been sent first (canGenerateBill already checks this)
      if (!currentPickupOrderId) {
        alert('No pickup order selected.');
        return;
      }
      const pickup = activePickupOrders[currentPickupOrderId];
      if (!pickup || !pickup.order) {
        alert('Send KOT first before generating bill.');
        return;
      }
    }

    try {
      let order: Order;

      if (isPickupOrder && currentPickupOrderId) {
        // For pickup: use the order created when KOT was sent
        const pickup = activePickupOrders[currentPickupOrderId];
        const existingOrder = pickup.order!;

        // Recalculate with discount and packing charges
        const restaurantSettings = useRestaurantSettingsStore.getState();
        const taxes = restaurantSettings.calculateTaxes(existingOrder.subtotal);
        const packingChargesResult = restaurantSettings.calculatePackingCharges(
          existingOrder.items.map(item => ({
            name: item.menuItem.name,
            category: item.menuItem.category || '',
            quantity: item.quantity,
          })),
          'takeout'
        );
        const discountAmount = cashDiscount || 0;
        const total = Math.max(0, taxes.grandTotal + packingChargesResult.totalCharge - discountAmount);

        order = {
          ...existingOrder,
          orderNumber: pickup.orderNumber, // Use the pickup order number (P1, P2, etc.)
          discount: discountAmount,
          packingCharges: packingChargesResult.totalCharge > 0 ? packingChargesResult.totalCharge : undefined,
          total,
          paymentMethod: 'pending' as const,
          status: 'completed' as const,
        };
      } else if (orderType === 'dine-in' && tableNumber) {
        // For dine-in: generate bill from table session WITHOUT closing the table
        // The table stays open until payment is selected
        const tableSession = activeTables[tableNumber];
        if (!tableSession || !tableSession.order) {
          throw new Error('No order found for this table');
        }

        const existingOrder = tableSession.order;
        const discountAmount = cashDiscount || 0;
        const restaurantSettings = useRestaurantSettingsStore.getState();
        const taxes = restaurantSettings.calculateTaxes(existingOrder.subtotal);
        const total = Math.max(0, taxes.grandTotal - discountAmount);

        order = {
          ...existingOrder,
          discount: discountAmount,
          total,
          paymentMethod: 'pending' as const,
          status: 'completed' as const,
        };
      } else {
        // Fallback for other order types
        order = await submitOrder(user.tenantId, 'pending', cashDiscount);
      }
      playSound('order_ready');
      const bill = billService.generateBill(order, user.name || 'Staff');

      // Record the sale immediately with 'pending' payment method
      // This ensures the sale is recorded even if the user closes the modal
      // Payment method can be updated later when selected
      try {
        await salesTransactionService.recordSale(
          user.tenantId,
          bill,
          'pending',
          activeStaff?.id,
          'pos'
        );
        console.log('[POSDashboard] Sale recorded with pending payment:', bill.invoiceNumber, 'discount:', cashDiscount || 0);
      } catch (saleError) {
        console.error('[POSDashboard] Failed to record sale:', saleError);
        // Don't block bill display if sale recording fails
      }

      setGeneratedBillData(bill.billData);
      setGeneratedInvoiceNumber(bill.invoiceNumber);
      setIsBillPreviewOpen(true);
    } catch (error) {
      console.error('Failed to generate bill:', error);
      alert('Failed to generate bill.');
    }
  };

  // Called when bill is printed - marks table/pickup as billed
  // Note: invoiceNumber is passed from the modal to avoid stale closure issues
  const handleBillPrinted = (invoiceNumber: string) => {
    if (orderType === 'dine-in' && tableNumber && invoiceNumber) {
      markTableBillPrinted(tableNumber, invoiceNumber, user?.tenantId);
      console.log(`[POSDashboard] Table ${tableNumber} marked as bill printed with invoice ${invoiceNumber}`);
    } else if (orderType === 'takeout' && currentPickupOrderId && invoiceNumber) {
      markPickupBillPrinted(currentPickupOrderId, invoiceNumber);
      console.log(`[POSDashboard] Pickup order ${currentPickupOrderId} marked as bill printed with invoice ${invoiceNumber}`);
    } else {
      console.warn(`[POSDashboard] handleBillPrinted called but conditions not met: orderType=${orderType}, tableNumber=${tableNumber}, currentPickupOrderId=${currentPickupOrderId}, invoiceNumber=${invoiceNumber}`);
    }
  };

  // Called when clicking a table that has bill printed
  const handleBilledTableClick = (tbl: number) => {
    const session = activeTables[tbl];
    if (session) {
      setPaymentModalTableNumber(tbl);
      setPaymentModalPickupId(null);
      setPaymentModalBillTotal(session.order?.total || 0);
      // Get invoice number from table session
      setPaymentModalInvoiceNumber(getTableInvoiceNumber(tbl));
      setIsPaymentModalOpen(true);
    }
  };

  // Called when clicking a pickup order that has bill printed
  const handleBilledPickupClick = (pickupId: string) => {
    const session = activePickupOrders[pickupId];
    if (session) {
      setPaymentModalTableNumber(null);
      setPaymentModalPickupId(pickupId);
      setPaymentModalBillTotal(session.order?.total || 0);
      // Get invoice number from pickup session
      setPaymentModalInvoiceNumber(getPickupInvoiceNumber(pickupId));
      setIsPaymentModalOpen(true);
    }
  };

  // Called when payment is selected - closes the table or pickup
  const handlePaymentSelected = async (paymentMethod: PaymentMethod) => {
    if (paymentModalTableNumber) {
      await closeTableWithPayment(paymentModalTableNumber, paymentMethod, user?.tenantId);
      console.log(`[POSDashboard] Table ${paymentModalTableNumber} closed with payment: ${paymentMethod}`);
      playSound('order_ready');
    } else if (paymentModalPickupId) {
      closePickupWithPayment(paymentModalPickupId, paymentMethod);
      console.log(`[POSDashboard] Pickup order ${paymentModalPickupId} closed with payment: ${paymentMethod}`);
      playSound('order_ready');
    }
    setIsPaymentModalOpen(false);
    setPaymentModalTableNumber(null);
    setPaymentModalPickupId(null);
  };

  // Called when clicking the Payment button (for billed orders)
  const handlePaymentButtonClick = () => {
    if (orderType === 'dine-in' && tableNumber) {
      handleBilledTableClick(tableNumber);
    } else if (orderType === 'takeout' && currentPickupOrderId) {
      handleBilledPickupClick(currentPickupOrderId);
    }
  };

  const openKeyboard = (type: 'text' | 'number', currentVal: string, title: string, onSave: (val: string) => void) => {
    setKeyboardConfig({ isOpen: true, type, value: currentVal, title, onSave });
  };

  const cartItemCount = activeCart.reduce((sum, item) => sum + item.quantity, 0);
  // For pickup: cart total + sent order total (if KOT sent)
  // For dine-in: cart total + active table order total
  const grandTotal = (() => {
    if (orderType === 'takeout') {
      // Include pickup session order total if KOT was sent
      const pickupSession = currentPickupOrderId ? activePickupOrders[currentPickupOrderId] : null;
      const pickupOrderTotal = pickupSession?.order?.total || 0;
      return cartTotals.total + pickupOrderTotal;
    }
    return cartTotals.total + (activeTableOrder?.total || 0);
  })();

  return (
    <div className={cn("h-screen w-screen flex flex-col overflow-hidden select-none", themeClasses.screenBg)}>
      {/* ========== TOP BAR - Fixed 80px ========== */}
      <header className={cn("h-20 flex-shrink-0 border-b-2 px-4 pr-16 flex items-center gap-4 overflow-visible", themeClasses.headerBg, themeClasses.headerBorder)}>
        {/* Table/Order Type Selector */}
        <div className="flex items-center gap-2">
          {/* Table Button - Only show for dine-in */}
          {orderType === 'dine-in' && (
            <button
              onClick={() => setIsTableModalOpen(true)}
              className={cn(
                "h-14 px-4 rounded-xl border-2 flex items-center gap-3 transition-all shadow-sm",
                tableNumber !== null
                  ? isDark
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-emerald-50 border-emerald-600 text-emerald-700"
                  : isDark
                    ? "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400"
                    : "bg-white border-stone-400 text-stone-700 hover:border-stone-500 hover:bg-stone-50"
              )}
            >
              <span className="text-2xl">🪑</span>
              <div className="text-left">
                <div className={cn("text-[10px] font-mono uppercase tracking-wider", tableNumber !== null ? (isDark ? "text-emerald-400/70" : "text-emerald-700/70") : themeClasses.textSecondary)}>TABLE</div>
                <div className={cn("text-xl font-black font-mono", tableNumber !== null ? (isDark ? "text-emerald-400" : "text-emerald-700") : themeClasses.textPrimary)}>{tableNumber ?? '--'}</div>
              </div>
            </button>
          )}

          {/* Pickup Orders Pills - Only show for takeout */}
          {orderType === 'takeout' && (
            <div className={cn(
              "flex items-center gap-1 px-3 py-2 rounded-xl border-2 shadow-sm",
              isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-stone-400"
            )}>
              <span className="text-lg mr-1">🥡</span>
              {/* New Pickup Order Button */}
              <button
                onClick={() => createPickupOrder()}
                className={cn(
                  "w-9 h-9 rounded-lg font-black text-lg flex items-center justify-center transition-all border-2 border-dashed",
                  isDark
                    ? "bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500/40"
                    : "bg-orange-50 border-orange-500 text-orange-600 hover:bg-orange-100"
                )}
                title="New Pickup Order"
              >
                +
              </button>
              {/* Active Pickup Orders */}
              {Object.values(activePickupOrders).map((pickup) => {
                const isSelected = currentPickupOrderId === pickup.id;
                const hasItems = pickup.items.length > 0;
                const isSent = pickup.status === 'sent';
                const isBilled = pickup.status === 'billed' || pickup.billPrinted;
                return (
                  <button
                    key={pickup.id}
                    onClick={() => {
                      // If pickup is billed, show payment selection modal
                      if (isBilled) {
                        handleBilledPickupClick(pickup.id);
                      } else {
                        selectPickupOrder(pickup.id);
                      }
                    }}
                    className={cn(
                      "relative min-w-9 h-9 px-2 rounded-lg font-black text-sm flex items-center justify-center transition-all",
                      isSelected
                        ? isBilled
                          ? "bg-pink-500 text-white ring-2 ring-pink-300"
                          : isSent
                          ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                          : hasItems
                          ? "bg-orange-500 text-white ring-2 ring-orange-300"
                          : "bg-blue-500 text-white ring-2 ring-blue-300"
                        : isBilled
                        ? isDark
                          ? "bg-pink-500/30 text-pink-300 border-2 border-pink-500 hover:bg-pink-500/50"
                          : "bg-pink-100 text-pink-700 border-2 border-pink-500 hover:bg-pink-200"
                        : isSent
                        ? isDark
                          ? "bg-emerald-500/30 text-emerald-300 border-2 border-emerald-500 hover:bg-emerald-500/50"
                          : "bg-emerald-100 text-emerald-700 border-2 border-emerald-500 hover:bg-emerald-200"
                        : hasItems
                        ? isDark
                          ? "bg-orange-500/30 text-orange-300 border-2 border-orange-500 hover:bg-orange-500/50"
                          : "bg-orange-100 text-orange-700 border-2 border-orange-500 hover:bg-orange-200"
                        : isDark
                          ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                          : "bg-stone-200 text-stone-700 border-2 border-stone-400 hover:bg-stone-300"
                    )}
                    title={
                      isBilled ? `${pickup.orderNumber} - Awaiting Payment`
                      : `${pickup.orderNumber}${pickup.customerName ? ` - ${pickup.customerName}` : ''} (${pickup.items.length} items)`
                    }
                  >
                    {pickup.orderNumber}
                    {/* Item count badge */}
                    {hasItems && !isBilled && (
                      <span className={cn(
                        "absolute -top-1 -right-1 min-w-4 h-4 px-1 text-[10px] font-black rounded-full flex items-center justify-center",
                        isSelected ? "bg-white text-orange-600" : isDark ? "bg-orange-500 text-white" : "bg-orange-600 text-white"
                      )}>
                        {pickup.items.length}
                      </span>
                    )}
                    {/* Status indicator */}
                    {isBilled && (
                      <span className={cn("absolute -top-1 -right-1 w-3 h-3 bg-pink-400 rounded-full border-2", isDark ? "border-zinc-800" : "border-white")} />
                    )}
                    {isSent && !isBilled && (
                      <span className={cn("absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 animate-pulse", isDark ? "border-zinc-800" : "border-white")} />
                    )}
                  </button>
                );
              })}
              {/* Empty state */}
              {Object.keys(activePickupOrders).length === 0 && (
                <span className={cn("text-xs font-medium ml-1", themeClasses.textMuted)}>No orders</span>
              )}
            </div>
          )}

          {/* Order Type Pills */}
          <div className={cn("flex gap-1 p-1 rounded-xl border-2 shadow-sm", themeClasses.cardBg, themeClasses.cardBorder)}>
            {orderTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className={cn(
                  "h-12 px-4 rounded-lg font-black text-xs uppercase tracking-wide transition-all flex items-center gap-2",
                  orderType === type.id
                    ? isDark
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-emerald-600 text-white shadow-md"
                    : isDark
                      ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                )}
              >
                <span className="text-lg">{type.icon}</span>
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Staff Info (if PIN required) */}
        {activeStaff && (
          <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border-2", themeClasses.cardBg, themeClasses.cardBorder)}>
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
              {activeStaff.name.charAt(0)}
            </div>
            <div className="text-left">
              <div className={cn("text-[10px] font-mono uppercase", themeClasses.textMuted)}>STAFF</div>
              <div className={cn("text-sm font-bold", themeClasses.textPrimary)}>{activeStaff.name}</div>
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "p-2.5 rounded-xl border-2 transition-all",
            isDark
              ? "bg-zinc-800 border-zinc-700 text-amber-400 hover:bg-zinc-700 hover:border-amber-500"
              : "bg-white border-gray-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-500"
          )}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Active Tables Quick View with Status */}
        {(() => {
          // Show ALL active tables (tables with a session, even without items)
          const activeTableNumbers = Object.keys(activeTables)
            .filter(key => {
              const session = activeTables[parseInt(key)];
              return session !== undefined;
            })
            .map(key => parseInt(key))
            .sort((a, b) => a - b);
          const activeCount = activeTableNumbers.length;

          // Debug logging
          console.log('[POSDashboard Header] activeTables:', activeTables);
          console.log('[POSDashboard Header] activeTableNumbers:', activeTableNumbers);
          console.log('[POSDashboard Header] activeCount:', activeCount);

          // Get status for each table
          const getTableStatus = (tbl: number): 'new' | 'preparing' | 'ready' | 'billed' => {
            // Check if bill is already printed (awaiting payment)
            if (isTableBillPrinted(tbl)) return 'billed';
            const hasKot = isKotPrintedForTable(tbl);
            if (!hasKot) return 'new'; // No KOT sent yet
            const allCompleted = areAllKotsCompletedForTable(tbl);
            if (allCompleted) return 'ready'; // Ready for billing
            return 'preparing'; // In kitchen
          };

          return (
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Active Tables Pills with Status */}
              {activeCount > 0 ? (
                <div className={cn(
                  "flex items-center gap-1 px-3 py-2 rounded-xl border-2 shadow-sm",
                  isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-stone-400"
                )}>
                  <span className={cn("text-xs font-bold uppercase", isDark ? "text-zinc-400" : "text-stone-600")}>Open ({activeCount}):</span>
                  <div className="flex gap-1">
                    {activeTableNumbers.slice(0, 8).map((tbl) => {
                      const status = getTableStatus(tbl);
                      const isSelected = tableNumber === tbl;
                      return (
                        <button
                          key={tbl}
                          onClick={() => {
                            // If table is billed, show payment selection modal
                            if (status === 'billed') {
                              handleBilledTableClick(tbl);
                            } else {
                              setTableNumber(tbl);
                              setOrderType('dine-in');
                            }
                          }}
                          className={cn(
                            "relative w-9 h-9 rounded-lg font-black text-sm flex items-center justify-center transition-all",
                            isSelected
                              ? status === 'billed'
                                ? "bg-pink-500 text-white ring-2 ring-pink-300"
                                : status === 'ready'
                                ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                                : status === 'preparing'
                                ? "bg-amber-500 text-white ring-2 ring-amber-300"
                                : "bg-blue-500 text-white ring-2 ring-blue-300"
                              : status === 'billed'
                              ? isDark
                                ? "bg-pink-500/30 text-pink-300 border-2 border-pink-500 hover:bg-pink-500/50"
                                : "bg-pink-100 text-pink-700 border-2 border-pink-500 hover:bg-pink-200"
                              : status === 'ready'
                              ? isDark
                                ? "bg-emerald-500/30 text-emerald-300 border-2 border-emerald-500 hover:bg-emerald-500/50"
                                : "bg-emerald-100 text-emerald-700 border-2 border-emerald-500 hover:bg-emerald-200"
                              : status === 'preparing'
                              ? isDark
                                ? "bg-amber-500/30 text-amber-300 border-2 border-amber-500 hover:bg-amber-500/50"
                                : "bg-amber-100 text-amber-700 border-2 border-amber-500 hover:bg-amber-200"
                              : isDark
                                ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                                : "bg-stone-200 text-stone-700 border-2 border-stone-400 hover:bg-stone-300"
                          )}
                          title={
                            status === 'billed' ? `Table ${tbl} - Awaiting Payment`
                            : status === 'ready' ? `Table ${tbl} - Ready for Bill`
                            : status === 'preparing' ? `Table ${tbl} - Preparing`
                            : `Table ${tbl} - New Order`
                          }
                        >
                          {tbl}
                          {/* Status dot indicator */}
                          {status === 'billed' && (
                            <span className={cn("absolute -top-1 -right-1 w-3 h-3 bg-pink-400 rounded-full border-2", isDark ? "border-zinc-800" : "border-white")} />
                          )}
                          {status === 'ready' && (
                            <span className={cn("absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 animate-pulse", isDark ? "border-zinc-800" : "border-white")} />
                          )}
                          {status === 'preparing' && (
                            <span className={cn("absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 animate-pulse", isDark ? "border-zinc-800" : "border-white")} />
                          )}
                        </button>
                      );
                    })}
                    {activeCount > 8 && (
                      <span className={cn(
                        "w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center",
                        isDark ? "bg-zinc-700 text-zinc-400" : "bg-stone-200 text-stone-600"
                      )}>
                        +{activeCount - 8}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "px-3 py-2 rounded-xl border text-xs",
                  isDark ? "bg-zinc-800/50 border-zinc-700 text-zinc-500" : "bg-stone-100 border-stone-400 text-stone-500"
                )}>
                  No open tables (keys: {Object.keys(activeTables).join(',') || 'none'})
                </div>
              )}

              {/* New items indicator (compact) */}
              {cartItemCount > 0 && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border-2 shadow-sm",
                  isDark ? "bg-emerald-500/20 border-emerald-500" : "bg-emerald-100 border-emerald-600"
                )}>
                  <span className="text-lg">📝</span>
                  <span className={cn("font-black text-sm", isDark ? "text-emerald-400" : "text-emerald-700")}>{cartItemCount} new</span>
                </div>
              )}

              {/* Aggregator Orders Status Indicator */}
              {aggregatorOrders.length > 0 && (
                <button
                  onClick={() => setShowAggregatorPanel(!showAggregatorPanel)}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all",
                    aggregatorStats.ready > 0
                      ? "bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 animate-pulse"
                      : aggregatorStats.preparing > 0
                      ? "bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30"
                      : aggregatorStats.new > 0
                      ? "bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30 animate-pulse"
                      : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                  )}
                >
                  {/* Status icon based on priority */}
                  {aggregatorStats.ready > 0 ? (
                    <Clock size={18} className="text-emerald-400" />
                  ) : aggregatorStats.preparing > 0 ? (
                    <ChefHat size={18} className="text-orange-400" />
                  ) : (
                    <Package size={18} className="text-amber-400" />
                  )}

                  {/* Order count */}
                  <span className={cn(
                    "font-black text-sm",
                    aggregatorStats.ready > 0
                      ? "text-emerald-400"
                      : aggregatorStats.preparing > 0
                      ? "text-orange-400"
                      : "text-amber-400"
                  )}>
                    {aggregatorOrders.filter(o => !['delivered', 'completed', 'cancelled'].includes(o.status)).length}
                  </span>

                  {/* Status badges */}
                  <div className="hidden sm:flex items-center gap-1">
                    {aggregatorStats.new > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-400 text-[10px] font-bold">
                        {aggregatorStats.new} NEW
                      </span>
                    )}
                    {aggregatorStats.preparing > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-400 text-[10px] font-bold">
                        {aggregatorStats.preparing} 🍳
                      </span>
                    )}
                    {aggregatorStats.ready > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-400 text-[10px] font-bold animate-pulse">
                        {aggregatorStats.ready} READY
                      </span>
                    )}
                  </div>
                </button>
              )}

              {/* Search Button */}
              <button
                onClick={() => {
                  openKeyboard('text', searchQuery, 'Search Menu', (val) => {
                    setSearchQuery(val);
                  });
                }}
                className={cn(
                  "relative p-2 rounded-lg transition-all border-2",
                  searchQuery
                    ? isDark
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "bg-emerald-100 border-emerald-600 text-emerald-700"
                    : isDark
                      ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      : "bg-white border-stone-400 text-stone-600 hover:bg-stone-100 hover:text-stone-800"
                )}
                title={searchQuery || "Search menu"}
              >
                <Search size={20} />
                {searchQuery && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>
          );
        })()}
      </header>

      {/* ========== CATEGORY BAR - Square full-width buttons ========== */}
      <nav className={cn("flex-shrink-0 border-b-2", themeClasses.navBg, themeClasses.navBorder)}>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
          {categories.slice(0, 24).map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              title={(category as any).fullLabel || category.label}
              className={cn(
                "h-12 border-r border-b flex items-center justify-center transition-all",
                themeClasses.navBorder,
                // Special amber styling for Today's Special category
                category.isSpecial && selectedCategory === category.id
                  ? isDark
                    ? "bg-amber-500/30 text-amber-300 font-black"
                    : "bg-amber-100 text-amber-800 font-black border-amber-400"
                  : category.isSpecial && selectedCategory !== category.id
                  ? isDark
                    ? "bg-amber-500/10 text-amber-400/80 hover:bg-amber-500/20 hover:text-amber-300"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                  : selectedCategory === category.id
                  ? isDark
                    ? "bg-emerald-500/30 text-emerald-300 font-black"
                    : "bg-emerald-100 text-emerald-800 font-black"
                  : isDark
                    ? "bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    : "bg-white text-stone-700 hover:bg-stone-100 hover:text-stone-900"
              )}
            >
              <span className="text-sm font-bold uppercase tracking-wide text-center px-1">
                {category.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* ========== MAIN CONTENT - Menu Grid + Cart Sidebar ========== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Menu Items Grid */}
        <main className={cn("flex-1 overflow-y-auto p-4", themeClasses.mainBg)}>
          {/* Table selection prompt - Only for dine-in when no table selected */}
          {orderType === 'dine-in' && tableNumber === null && (
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
          ) : (() => {
            // Categorize items into Veg and Non-Veg
            const isVegItem = (item: MenuItem) => {
              // Check tags for veg/vegetarian
              if (item.tags?.includes('veg') || item.tags?.includes('vegetarian')) return true;
              if (item.tags?.includes('non-veg')) return false;
              // Check item properties for veg indicators
              if ((item as any).is_veg || (item as any).isVeg) return true;
              // Check dietary_tags (from database)
              const dietaryTags = (item as any).dietary_tags;
              if (Array.isArray(dietaryTags) && (dietaryTags.includes('veg') || dietaryTags.includes('vegetarian'))) return true;
              // Check item name for (V) suffix which indicates vegetarian
              if (item.name.includes('(V)')) return true;
              return false;
            };

            const isNonVegItem = (item: MenuItem) => {
              if (item.tags?.includes('non-veg')) return true;
              // Check name for meat keywords (including Kodava/local terms)
              const name = item.name.toLowerCase();
              return name.includes('chicken') || name.includes('mutton') || name.includes('pork') ||
                     name.includes('fish') || name.includes('prawn') || name.includes('egg') ||
                     name.includes('lamb') || name.includes('beef') || name.includes('meat') ||
                     name.includes('keema') || name.includes('kheema') || name.includes('gosht') ||
                     name.includes('murgh') || name.includes('macchi') || name.includes('jhinga') ||
                     // Kodava/local terms
                     name.includes('koli') ||      // Chicken in Kodava
                     name.includes('pandi') ||     // Pork in Kodava
                     name.includes('erachi') ||    // Meat in Malayalam/Kodava
                     name.includes('kaima') ||     // Keema/minced meat
                     name.includes('mutte');       // Egg in Kannada/Kodava
            };

            // Get non-veg subcategory (only chicken, mutton, pork - rest goes to other)
            const getNonVegCategory = (item: MenuItem): 'chicken' | 'mutton' | 'pork' | 'other' => {
              const name = item.name.toLowerCase();
              // Chicken (including Kodava term 'koli')
              if (name.includes('chicken') || name.includes('murgh') || name.includes('murg') || name.includes('koli')) return 'chicken';
              // Mutton (including keema, erachi for general meat)
              if (name.includes('mutton') || name.includes('lamb') || name.includes('gosht') ||
                  name.includes('keema') || name.includes('kheema') || name.includes('kaima') ||
                  name.includes('erachi')) return 'mutton';
              // Pork (including Kodava term 'pandi')
              if (name.includes('pork') || name.includes('bacon') || name.includes('ham') ||
                  name.includes('sausage') || name.includes('pandi')) return 'pork';
              return 'other';
            };

            const vegItems = filteredMenu.filter(isVegItem);
            const nonVegItems = filteredMenu.filter(item => !isVegItem(item) && isNonVegItem(item));
            const uncategorizedItems = filteredMenu.filter(item => !isVegItem(item) && !isNonVegItem(item));

            // Group non-veg by subcategory (chicken, mutton, pork only)
            const chickenItems = nonVegItems.filter(item => getNonVegCategory(item) === 'chicken');
            const muttonItems = nonVegItems.filter(item => getNonVegCategory(item) === 'mutton');
            const porkItems = nonVegItems.filter(item => getNonVegCategory(item) === 'pork');
            const otherNonVegItems = nonVegItems.filter(item => getNonVegCategory(item) === 'other');

            // Render menu item card
            const renderMenuCard = (item: MenuItem) => (
              <button
                key={item.id}
                onClick={() => handleMenuItemClick(item)}
                disabled={!canAddItems}
                className={cn(
                  "relative p-3 rounded-xl text-left transition-all group",
                  "min-h-[100px] flex flex-col justify-between",
                  canAddItems
                    ? isDark
                      ? "bg-zinc-800/80 border-2 border-zinc-600 hover:border-emerald-500 hover:bg-zinc-700 active:scale-[0.98] shadow-lg"
                      : "bg-white border-[3px] border-stone-500 hover:border-emerald-600 hover:bg-emerald-50 active:scale-[0.98] shadow-lg hover:shadow-xl"
                    : isDark
                      ? "bg-zinc-900 border-2 border-zinc-800 opacity-50 cursor-not-allowed"
                      : "bg-stone-100 border-[3px] border-stone-400 opacity-50 cursor-not-allowed"
                )}
              >
                {/* Veg/Non-veg indicator - top left */}
                <div className="absolute top-2 left-2">
                  {isVegItem(item) && (
                    <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  )}
                  {!isVegItem(item) && isNonVegItem(item) && (
                    <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>

                {/* Combo Badge - top right */}
                {item.isCombo && (
                  <span className={cn(
                    "absolute top-2 right-2 px-1.5 py-0.5 border rounded text-[8px] font-black uppercase",
                    isDark
                      ? "bg-purple-500/30 border-purple-500 text-purple-300"
                      : "bg-purple-100 border-purple-500 text-purple-700"
                  )}>
                    COMBO
                  </span>
                )}

                {/* Item Name */}
                <div className="flex-1 pt-5">
                  <h3
                    className={cn(
                      "font-bold text-base leading-snug line-clamp-2 transition-colors",
                      isDark
                        ? "text-white group-hover:text-emerald-400"
                        : "group-hover:text-emerald-700"
                    )}
                    style={isDark ? undefined : { color: '#3d2314' }}
                  >
                    {item.name}
                  </h3>
                </div>

                {/* Price */}
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn("font-black text-lg font-mono", isDark ? "text-emerald-400" : "text-emerald-700")}>₹{item.price}</span>
                  <div className={cn(
                    "w-8 h-8 rounded-lg border-2 flex items-center justify-center group-hover:bg-emerald-500 group-hover:border-emerald-400 transition-all",
                    isDark ? "bg-zinc-600 border-zinc-500" : "bg-stone-300 border-stone-500"
                  )}>
                    <span className={cn("text-xl font-black group-hover:text-white", isDark ? "text-zinc-300" : "text-stone-700")}>+</span>
                  </div>
                </div>
              </button>
            );

            // Render a subcategory section
            const renderSubcategory = (title: string, items: MenuItem[], icon: string, borderColor: string) => {
              if (items.length === 0) return null;
              return (
                <div key={title} className="mb-3">
                  <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2 shadow-sm", borderColor)}>
                    <span className="text-sm">{icon}</span>
                    <span className={cn("text-[10px] font-black uppercase tracking-wider", isDark ? "text-zinc-300" : "text-stone-700")}>{title}</span>
                    <span className={cn("text-[10px] font-mono", isDark ? "text-zinc-500" : "text-stone-500")}>({items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map(renderMenuCard)}
                  </div>
                </div>
              );
            };

            const hasVeg = vegItems.length > 0;
            const hasNonVeg = nonVegItems.length > 0;
            const hasUncategorized = uncategorizedItems.length > 0;

            // If only one type exists, show single column with full width
            if (!hasNonVeg && hasVeg) {
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="font-black text-emerald-400 uppercase tracking-widest text-xs">Vegetarian</span>
                    <span className="text-xs font-mono text-emerald-400/60">({vegItems.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {vegItems.map(renderMenuCard)}
                  </div>
                  {hasUncategorized && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-500/10 border border-zinc-500/30 rounded-xl mt-4">
                        <span className="font-black text-zinc-400 uppercase tracking-widest text-xs">Other Items</span>
                        <span className="text-xs font-mono text-zinc-400/60">({uncategorizedItems.length})</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {uncategorizedItems.map(renderMenuCard)}
                      </div>
                    </>
                  )}
                </div>
              );
            }

            if (!hasVeg && hasNonVeg) {
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="w-5 h-5 rounded border-2 border-red-500 bg-red-500/20 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    </div>
                    <span className="font-black text-red-400 uppercase tracking-widest text-xs">Non-Vegetarian</span>
                    <span className="text-xs font-mono text-red-400/60">({nonVegItems.length})</span>
                  </div>
                  <div className="space-y-4">
                    {renderSubcategory('Chicken', chickenItems, '🍗', 'bg-orange-500/10 border border-orange-500/20')}
                    {renderSubcategory('Mutton', muttonItems, '🍖', 'bg-rose-500/10 border border-rose-500/20')}
                    {renderSubcategory('Pork', porkItems, '🥓', 'bg-pink-500/10 border border-pink-500/20')}
                    {renderSubcategory('Other', otherNonVegItems, '🍽️', 'bg-zinc-500/10 border border-zinc-500/20')}
                  </div>
                  {hasUncategorized && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-500/10 border border-zinc-500/30 rounded-xl mt-4">
                        <span className="font-black text-zinc-400 uppercase tracking-widest text-xs">Other Items</span>
                        <span className="text-xs font-mono text-zinc-400/60">({uncategorizedItems.length})</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {uncategorizedItems.map(renderMenuCard)}
                      </div>
                    </>
                  )}
                </div>
              );
            }

            // Two column layout: Veg on left, Non-Veg on right (stacks on small screens < 900px)
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* VEG COLUMN */}
                <div className="space-y-3">
                  <div className={cn("sticky top-0 z-10 pb-2", themeClasses.mainBg)}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <span className="font-black text-emerald-400 uppercase tracking-widest text-xs">VEG</span>
                      <span className="text-xs font-mono text-emerald-400/60">({vegItems.length})</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                    {vegItems.map(renderMenuCard)}
                  </div>
                </div>

                {/* NON-VEG COLUMN */}
                <div className={cn("space-y-3 lg:border-l lg:pl-4", isDark ? "lg:border-zinc-700" : "lg:border-gray-200")}>
                  <div className={cn("sticky top-0 z-10 pb-2", themeClasses.mainBg)}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="w-5 h-5 rounded border-2 border-red-500 bg-red-500/20 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      </div>
                      <span className="font-black text-red-400 uppercase tracking-widest text-xs">NON-VEG</span>
                      <span className="text-xs font-mono text-red-400/60">({nonVegItems.length})</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {renderSubcategory('Chicken', chickenItems, '🍗', 'bg-orange-500/10 border border-orange-500/20')}
                    {renderSubcategory('Mutton', muttonItems, '🍖', 'bg-rose-500/10 border border-rose-500/20')}
                    {renderSubcategory('Pork', porkItems, '🥓', 'bg-pink-500/10 border border-pink-500/20')}
                    {renderSubcategory('Other', otherNonVegItems, '🍽️', 'bg-zinc-500/10 border border-zinc-500/20')}
                  </div>
                </div>

                {/* Uncategorized items below spanning both columns */}
                {hasUncategorized && (
                  <div className="col-span-1 lg:col-span-2 mt-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-500/10 border border-zinc-500/30 rounded-xl">
                      <span className="font-black text-zinc-400 uppercase tracking-widest text-xs">Other Items</span>
                      <span className="text-xs font-mono text-zinc-400/60">({uncategorizedItems.length})</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                      {uncategorizedItems.map(renderMenuCard)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </main>

        {/* ========== RIGHT SIDEBAR - Order ========== */}
        <aside className={cn("hidden md:flex w-72 lg:w-80 xl:w-96 2xl:w-[420px] flex-shrink-0 border-l-2 flex-col", themeClasses.sidebarBg, themeClasses.sidebarBorder)}>
          {/* Order Header */}
          <div className={cn("flex-shrink-0 p-4 border-b-2", themeClasses.sidebarBorder, themeClasses.headerBg)}>
            <div className="flex items-center justify-between">
              <h2 className={cn("font-black uppercase tracking-widest text-sm flex items-center gap-2", themeClasses.textPrimary)}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ORDER
              </h2>
              <div className="flex items-center gap-2">
                {/* Custom Item Button - Show when items can be added */}
                {canAddItems && (
                  <button
                    onClick={() => setIsCustomItemModalOpen(true)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all",
                      isDark
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30"
                        : "bg-purple-100 border-purple-500 text-purple-700 hover:bg-purple-200"
                    )}
                    title="Add custom item"
                  >
                    <PlusCircle size={14} />
                    <span className="text-[10px] font-bold uppercase">Custom</span>
                  </button>
                )}
                {activeCart.length > 0 && (
                  <button
                    onClick={() => usePOSStore.getState().clearCart()}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wide px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-all"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {/* Table Info for Dine-in */}
            {orderType === 'dine-in' && tableNumber !== null && (
              <div className={cn("mt-3 p-3 rounded-xl border flex items-center gap-3", themeClasses.cardBg, themeClasses.cardBorder)}>
                <div className="w-12 h-12 bg-emerald-500/20 border-2 border-emerald-500 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-[8px] font-mono text-emerald-400">TBL</span>
                  <span className="text-lg font-black text-emerald-400">{tableNumber}</span>
                </div>
                <div className="flex-1">
                  {currentTableInfo?.sectionName && (
                    <div className="text-[10px] font-mono text-emerald-400 uppercase">{currentTableInfo.sectionName}</div>
                  )}
                  <div className={cn("text-xs", themeClasses.textSecondary)}>
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

            {/* Pickup Order Info */}
            {orderType === 'takeout' && (
              <div className={cn("mt-3 p-3 rounded-xl border flex items-center gap-3", themeClasses.cardBg, themeClasses.cardBorder)}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex flex-col items-center justify-center border-2",
                  activeCart.length > 0
                    ? "bg-orange-500/20 border-orange-500"
                    : isDark ? "bg-zinc-700 border-zinc-600" : "bg-stone-200 border-stone-400"
                )}>
                  <span className="text-2xl">🥡</span>
                </div>
                <div className="flex-1">
                  {currentPickupOrderId && activePickupOrders[currentPickupOrderId] ? (
                    <>
                      <div className={cn("text-sm font-bold", activeCart.length > 0 ? (isDark ? "text-orange-400" : "text-orange-700") : themeClasses.textPrimary)}>
                        {activePickupOrders[currentPickupOrderId].orderNumber}
                        {activePickupOrders[currentPickupOrderId].customerName && (
                          <span className={cn("ml-2 font-normal text-xs", themeClasses.textSecondary)}>
                            ({activePickupOrders[currentPickupOrderId].customerName})
                          </span>
                        )}
                      </div>
                      <div className={cn("text-xs", themeClasses.textSecondary)}>
                        {activeCart.length > 0 ? `${cartItemCount} item${cartItemCount !== 1 ? 's' : ''} • ₹${cartTotals.total.toFixed(0)}` : 'Add items to start'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={cn("text-sm font-bold", themeClasses.textPrimary)}>
                        No Pickup Selected
                      </div>
                      <div className={cn("text-xs", themeClasses.textSecondary)}>
                        Click + to create a new pickup order
                      </div>
                    </>
                  )}
                </div>
                {/* Close pickup order button */}
                {currentPickupOrderId && activePickupOrders[currentPickupOrderId]?.status === 'sent' && (
                  <button
                    onClick={() => closePickupOrder(currentPickupOrderId)}
                    className={cn(
                      "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                      isDark
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/40"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    )}
                    title="Close this pickup order"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Order Items - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* NEW ITEMS - Show at top (editable, not yet sent to kitchen) */}
            {activeCart.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  NEW ITEMS
                </div>
                {activeCart.map((item) => (
                  <div key={item.id} className={cn(
                    "relative px-3 py-2 rounded-xl border-2 shadow-sm",
                    isDark
                      ? "bg-zinc-800 border-emerald-500/50"
                      : "bg-emerald-50 border-emerald-500 shadow-emerald-100"
                  )}>
                    {/* Close button - centered on right edge */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold hover:bg-red-600 shadow-md z-10"
                    >
                      ×
                    </button>

                    {/* Item row: Qty, Name, Price */}
                    <div className="flex items-center gap-2 pr-4">
                      {/* Quantity badge */}
                      <span className={cn(
                        "w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-black",
                        isDark
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                          : "bg-emerald-100 border-emerald-600 text-emerald-700"
                      )}>
                        {item.quantity}
                      </span>
                      {/* Name */}
                      <span className={cn("flex-1 font-bold text-sm truncate", themeClasses.textPrimary)}>{item.menuItem.name}</span>
                      {/* Price */}
                      <span className={cn("font-black font-mono text-sm", isDark ? "text-emerald-400" : "text-emerald-700")}>₹{item.subtotal.toFixed(0)}</span>
                    </div>

                    {/* Combo Selections - compact */}
                    {item.comboSelections && item.comboSelections.length > 0 && (
                      <div className="mt-1.5 pl-8 flex flex-wrap gap-1">
                        {item.comboSelections.flatMap((group) =>
                          group.selectedItems.map((sel, idx) => (
                            <span key={`${group.groupId}-${idx}`} className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded border",
                              isDark
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : "bg-purple-100 text-purple-700 border-purple-400"
                            )}>
                              {sel.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* SENT TO KITCHEN - Items already sent (non-editable, shown with status from KDS) */}
            {/* Only show when table has active KOTs in kitchen (not all completed) */}
            {activeTableOrder && activeTableOrder.items.length > 0 && tableNumber && !areAllKotsCompletedForTable(tableNumber) && (() => {
              // Get item statuses from KDS
              const itemStatuses = getItemStatusesForTable(tableNumber);
              const orderStatus = getOrderStatusForTable(tableNumber);

              // Status config for display
              const getStatusDisplay = (itemName: string) => {
                const status = itemStatuses.get(itemName) || 'pending';
                switch (status) {
                  case 'ready':
                    return { text: 'READY', color: 'text-emerald-400', bgColor: 'bg-emerald-500', animate: true };
                  case 'in_progress':
                    return { text: 'PREPARING', color: 'text-blue-400', bgColor: 'bg-blue-500', animate: true };
                  case 'pending':
                  default:
                    return { text: 'WAITING', color: 'text-amber-400/70', bgColor: 'bg-amber-500/50', animate: false };
                }
              };

              // Header status badge
              const getHeaderStatus = () => {
                if (orderStatus.status === 'ready') return { text: 'ALL READY', color: 'bg-emerald-500', animate: true };
                if (orderStatus.status === 'in_progress') return { text: 'PREPARING', color: 'bg-blue-500', animate: true };
                return { text: 'IN KITCHEN', color: 'bg-amber-500', animate: true };
              };

              const headerStatus = getHeaderStatus();

              return (
                <div className="space-y-2">
                  <div className={cn(
                    "flex items-center gap-2 px-1 py-2 rounded-lg border shadow-sm",
                    orderStatus.status === 'ready'
                      ? isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-100 border-emerald-500"
                      : orderStatus.status === 'in_progress'
                        ? isDark ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-100 border-blue-500"
                        : isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-100 border-amber-500"
                  )}>
                    <span className={cn(
                      "w-3 h-3 rounded-full shadow-lg",
                      headerStatus.color,
                      headerStatus.animate && "animate-pulse"
                    )} />
                    <span className={cn(
                      "text-xs font-black uppercase tracking-widest",
                      orderStatus.status === 'ready'
                        ? isDark ? "text-emerald-400" : "text-emerald-700"
                        : orderStatus.status === 'in_progress'
                          ? isDark ? "text-blue-400" : "text-blue-700"
                          : isDark ? "text-amber-400" : "text-amber-700"
                    )}>
                      {headerStatus.text} ({orderStatus.readyItemCount}/{orderStatus.totalItemCount})
                    </span>
                  </div>
                  {activeTableOrder.items.map((item, idx) => {
                    const statusDisplay = getStatusDisplay(item.menuItem.name);
                    return (
                      <div key={`active-${idx}`} className={cn(
                        "p-3 rounded-xl border-2 flex justify-between items-center shadow-sm",
                        statusDisplay.text === 'READY'
                          ? isDark ? "bg-emerald-500/5 border-emerald-500/40" : "bg-emerald-50 border-emerald-500"
                          : statusDisplay.text === 'PREPARING'
                            ? isDark ? "bg-blue-500/5 border-blue-500/40" : "bg-blue-50 border-blue-500"
                            : isDark ? "bg-amber-500/5 border-amber-500/40" : "bg-amber-50 border-amber-500"
                      )}>
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-8 rounded-full",
                            statusDisplay.bgColor,
                            statusDisplay.animate && "animate-pulse"
                          )} />
                          <div>
                            <div className={cn("text-sm font-bold truncate", themeClasses.textPrimary)}>{item.menuItem.name}</div>
                            <div className={cn(
                              "text-xs font-mono",
                              statusDisplay.text === 'READY'
                                ? isDark ? "text-emerald-400" : "text-emerald-700"
                                : statusDisplay.text === 'PREPARING'
                                  ? isDark ? "text-blue-400" : "text-blue-700"
                                  : isDark ? "text-amber-400" : "text-amber-700"
                            )}>
                              × {item.quantity} • {statusDisplay.text}
                            </div>
                          </div>
                        </div>
                        <div className={cn(
                          "text-base font-black font-mono",
                          statusDisplay.text === 'READY'
                            ? isDark ? "text-emerald-400" : "text-emerald-700"
                            : statusDisplay.text === 'PREPARING'
                              ? isDark ? "text-blue-400" : "text-blue-700"
                              : isDark ? "text-amber-400" : "text-amber-700"
                        )}>
                          ₹{item.subtotal.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                  {/* Running Order Total */}
                  <div className={cn(
                    "flex justify-between items-center px-3 py-2 rounded-lg border shadow-sm",
                    orderStatus.status === 'ready'
                      ? isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-100 border-emerald-500"
                      : orderStatus.status === 'in_progress'
                        ? isDark ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-100 border-blue-500"
                        : isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-100 border-amber-500"
                  )}>
                    <span className={cn(
                      "text-xs font-bold uppercase",
                      orderStatus.status === 'ready'
                        ? isDark ? "text-emerald-400/70" : "text-emerald-700"
                        : orderStatus.status === 'in_progress'
                          ? isDark ? "text-blue-400/70" : "text-blue-700"
                          : isDark ? "text-amber-400/70" : "text-amber-700"
                    )}>Running Total</span>
                    <span className={cn(
                      "text-base font-black font-mono",
                      orderStatus.status === 'ready'
                        ? isDark ? "text-emerald-400" : "text-emerald-700"
                        : orderStatus.status === 'in_progress'
                          ? isDark ? "text-blue-400" : "text-blue-700"
                          : isDark ? "text-amber-400" : "text-amber-700"
                    )}>₹{activeTableOrder.total.toFixed(0)}</span>
                  </div>
                </div>
              );
            })()}

            {/* SENT TO KITCHEN - Pickup Orders */}
            {orderType === 'takeout' && currentPickupOrderId && (() => {
              const pickup = activePickupOrders[currentPickupOrderId];
              if (!pickup || !pickup.order || !pickup.order.items || pickup.order.items.length === 0) {
                return null;
              }

              return (
                <div className="space-y-2">
                  <div className={cn(
                    "flex items-center gap-2 px-1 py-2 rounded-lg border shadow-sm",
                    isDark ? "bg-orange-500/10 border-orange-500/30" : "bg-orange-100 border-orange-500"
                  )}>
                    <span className={cn(
                      "w-3 h-3 rounded-full shadow-lg bg-orange-500 animate-pulse"
                    )} />
                    <span className={cn(
                      "text-xs font-black uppercase tracking-widest",
                      isDark ? "text-orange-400" : "text-orange-700"
                    )}>
                      SENT TO KITCHEN ({pickup.order.items.length} items)
                    </span>
                  </div>
                  {pickup.order.items.map((item, idx) => {
                    return (
                      <div key={`pickup-sent-${idx}`} className={cn(
                        "p-3 rounded-xl border-2 flex justify-between items-center shadow-sm",
                        isDark ? "bg-orange-500/5 border-orange-500/40" : "bg-orange-50 border-orange-500"
                      )}>
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-8 rounded-full bg-orange-500"
                          )} />
                          <div>
                            <div className={cn("text-sm font-bold truncate", themeClasses.textPrimary)}>{item.menuItem.name}</div>
                            <div className={cn(
                              "text-xs font-mono",
                              isDark ? "text-orange-400" : "text-orange-700"
                            )}>
                              × {item.quantity}
                            </div>
                          </div>
                        </div>
                        <div className={cn(
                          "text-base font-black font-mono",
                          isDark ? "text-orange-400" : "text-orange-700"
                        )}>
                          ₹{item.subtotal.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                  {/* Running Order Total */}
                  <div className={cn(
                    "flex justify-between items-center px-3 py-2 rounded-lg border shadow-sm",
                    isDark ? "bg-orange-500/10 border-orange-500/30" : "bg-orange-100 border-orange-500"
                  )}>
                    <span className={cn(
                      "text-xs font-bold uppercase",
                      isDark ? "text-orange-400/70" : "text-orange-700"
                    )}>Order Total</span>
                    <span className={cn(
                      "text-base font-black font-mono",
                      isDark ? "text-orange-400" : "text-orange-700"
                    )}>₹{pickup.order.total.toFixed(0)}</span>
                  </div>
                </div>
              );
            })()}

            {/* READY FOR BILLING / AWAITING PAYMENT - Show when all KOTs completed (items served) */}
            {activeTableOrder && activeTableOrder.items.length > 0 && tableNumber && areAllKotsCompletedForTable(tableNumber) && (
              <div className="space-y-2">
                <div className={cn(
                  "flex items-center gap-2 px-1 py-2 rounded-lg border shadow-sm",
                  isCurrentOrderBilled
                    ? isDark ? "bg-pink-500/10 border-pink-500/30" : "bg-pink-100 border-pink-500"
                    : isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-100 border-emerald-500"
                )}>
                  <span className={cn(
                    "w-3 h-3 rounded-full shadow-lg",
                    isCurrentOrderBilled ? "bg-pink-500 shadow-pink-500/50" : "bg-emerald-500 shadow-emerald-500/50"
                  )} />
                  <span className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    isCurrentOrderBilled
                      ? isDark ? "text-pink-400" : "text-pink-700"
                      : isDark ? "text-emerald-400" : "text-emerald-700"
                  )}>
                    {isCurrentOrderBilled ? `AWAITING PAYMENT (${activeTableOrder.items.length} items)` : `READY FOR BILLING (${activeTableOrder.items.length} items)`}
                  </span>
                </div>
                {activeTableOrder.items.map((item, idx) => (
                  <div key={`billed-${idx}`} className={cn(
                    "p-3 rounded-xl border-2 flex justify-between items-center shadow-sm",
                    isCurrentOrderBilled
                      ? isDark ? "bg-pink-500/5 border-pink-500/40" : "bg-pink-50 border-pink-500"
                      : isDark ? "bg-emerald-500/5 border-emerald-500/40" : "bg-emerald-50 border-emerald-500"
                  )}>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className={cn("w-2 h-8 rounded-full", isCurrentOrderBilled ? "bg-pink-500" : "bg-emerald-500")} />
                      <div>
                        <div className={cn("text-sm font-bold truncate", themeClasses.textPrimary)}>{item.menuItem.name}</div>
                        <div className={cn(
                          "text-xs font-mono",
                          isCurrentOrderBilled
                            ? isDark ? "text-pink-400/70" : "text-pink-700"
                            : isDark ? "text-emerald-400/70" : "text-emerald-700"
                        )}>× {item.quantity} • {isCurrentOrderBilled ? 'BILLED' : 'SERVED'}</div>
                      </div>
                    </div>
                    <div className={cn(
                      "text-base font-black font-mono",
                      isCurrentOrderBilled
                        ? isDark ? "text-pink-400" : "text-pink-700"
                        : isDark ? "text-emerald-400" : "text-emerald-700"
                    )}>₹{item.subtotal.toFixed(0)}</div>
                  </div>
                ))}
                {/* Billing Total */}
                <div className={cn(
                  "flex justify-between items-center px-3 py-2 rounded-lg border shadow-sm",
                  isCurrentOrderBilled
                    ? isDark ? "bg-pink-500/10 border-pink-500/30" : "bg-pink-100 border-pink-500"
                    : isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-100 border-emerald-500"
                )}>
                  <span className={cn(
                    "text-xs font-bold uppercase",
                    isCurrentOrderBilled
                      ? isDark ? "text-pink-400/70" : "text-pink-700"
                      : isDark ? "text-emerald-400/70" : "text-emerald-700"
                  )}>{isCurrentOrderBilled ? 'Bill Printed' : 'Bill Total'}</span>
                  <span className={cn(
                    "text-base font-black font-mono",
                    isCurrentOrderBilled
                      ? isDark ? "text-pink-400" : "text-pink-700"
                      : isDark ? "text-emerald-400" : "text-emerald-700"
                  )}>₹{activeTableOrder.total.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Empty state - only show if both new items and active order are empty */}
            {activeCart.length === 0 && (!activeTableOrder || activeTableOrder.items.length === 0) && (
              <div className={cn("h-full flex flex-col items-center justify-center", themeClasses.textMuted)}>
                <span className="text-5xl mb-3 opacity-30">📋</span>
                <p className="font-black uppercase tracking-widest text-xs">Add items</p>
              </div>
            )}
          </div>

          {/* Order Footer - Actions */}
          <div className={cn("flex-shrink-0 p-4 border-t-2 space-y-3", themeClasses.sidebarBorder, themeClasses.headerBg)}>
            {/* Total */}
            <div className={cn("flex items-center justify-between p-4 rounded-xl border-2", themeClasses.cardBg, themeClasses.cardBorder)}>
              <span className={cn("font-bold uppercase text-sm", themeClasses.textSecondary)}>Grand Total</span>
              <span className={cn("text-3xl font-black font-mono", themeClasses.textPrimary)}>₹{grandTotal.toFixed(0)}</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={activeCart.length === 0}
                onClick={handleSendToKitchen}
                className={cn(
                  "h-14 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                  activeCart.length === 0
                    ? isDark
                      ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                      : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                    : "bg-amber-500/20 border-amber-500 text-amber-500 hover:bg-amber-500/30 active:scale-95"
                )}
              >
                📋 SEND KOT
              </button>
              {isCurrentOrderBilled ? (
                // Show PAYMENT button when bill is already printed
                <button
                  onClick={handlePaymentButtonClick}
                  className={cn(
                    "h-14 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                    "bg-pink-500 border-pink-400 text-white hover:bg-pink-400 active:scale-95 shadow-lg shadow-pink-500/30"
                  )}
                >
                  💳 PAYMENT
                </button>
              ) : (
                // Show BILL button when bill not yet printed
                <button
                  disabled={!canGenerateBill}
                  onClick={() => setIsPlaceOrderModalOpen(true)}
                  className={cn(
                    "h-14 rounded-xl font-black uppercase tracking-wide text-sm transition-all border-2",
                    canGenerateBill
                      ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/30"
                      : isDark
                        ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                        : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                  )}
                >
                  💵 BILL
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ========== MOBILE BOTTOM SHEET (shown on compact screens) ========== */}
        {isCompact && (
          <OrderBottomSheet
            cart={activeCart}
            grandTotal={grandTotal}
            activeTableOrder={activeTableOrder}
            tableNumber={tableNumber}
            orderType={orderType}
            canGenerateBill={canGenerateBill}
            isOrderBilled={isCurrentOrderBilled}
            onSendToKitchen={handleSendToKitchen}
            onBill={() => setIsPlaceOrderModalOpen(true)}
            onPayment={handlePaymentButtonClick}
            itemStatuses={tableNumber ? getItemStatusesForTable(tableNumber) : undefined}
            orderStatus={tableNumber ? getOrderStatusForTable(tableNumber) : undefined}
            areAllKotsCompleted={tableNumber ? areAllKotsCompletedForTable(tableNumber) : false}
          />
        )}
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

      <PortionSelectionModal
        isOpen={isPortionModalOpen}
        onClose={() => {
          setIsPortionModalOpen(false);
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
        cartItems={activeCart}
        onGenerateBill={handleGenerateBill}
      />

      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onSelect={(tableNum, guestCount) => {
          if (guestCount) {
            // New table with guest count - use openTable
            openTable(tableNum, guestCount, user?.tenantId);
          } else {
            // Existing active table - just select it
            setTableNumber(tableNum);
          }
          setOrderType('dine-in');
        }}
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
        onBillPrinted={handleBillPrinted}
      />

      {/* Payment Selection Modal - shown when clicking a billed table or pickup */}
      {(paymentModalTableNumber !== null || paymentModalPickupId !== null) && (
        <PaymentSelectionModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPaymentModalTableNumber(null);
            setPaymentModalPickupId(null);
          }}
          tableNumber={paymentModalTableNumber}
          pickupOrderNumber={paymentModalPickupId ? activePickupOrders[paymentModalPickupId]?.orderNumber : undefined}
          billTotal={paymentModalBillTotal}
          invoiceNumber={paymentModalInvoiceNumber}
          onPaymentSelect={handlePaymentSelected}
        />
      )}

      <StaffPinEntryModal
        isOpen={isStaffPinModalOpen}
        onClose={() => {
          if (hasValidSession || !requireStaffPin) {
            setIsStaffPinModalOpen(false);
          }
        }}
        onSuccess={() => setIsStaffPinModalOpen(false)}
      />

      {/* Out of Stock Alert Modal */}
      <OutOfStockAlertModal
        alert={currentOosAlert}
        onAcknowledge={handleOosAcknowledge}
      />

      {/* Custom Item Modal */}
      <CustomItemModal
        isOpen={isCustomItemModalOpen}
        onClose={() => setIsCustomItemModalOpen(false)}
        onAdd={(menuItem, quantity) => {
          addToCart(menuItem, quantity, []);
          playSound('order_ready');
        }}
      />

      {/* Aggregator Orders Drawer */}
      <AggregatorOrdersDrawer
        isOpen={showAggregatorPanel}
        onClose={() => setShowAggregatorPanel(false)}
      />
    </div>
  );
}

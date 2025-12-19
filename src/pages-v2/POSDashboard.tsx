/**
 * POS Dashboard V2 - Industrial Redesign
 * "Idiot Proof" Industrial Point of Sale interface
 */

import { useState } from 'react';

import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
import { lanClient } from '../lib/lanClient';
import { splitAndPrintTickets } from '../utils/kotPrinter';
import { useNotificationStore } from '../stores/notificationStore';
import { MenuItem, MenuCategory, OrderType } from '../types/pos';

import { IndustrialButton } from '../components/ui-industrial/IndustrialButton';
import { IndustrialCard } from '../components/ui-industrial/IndustrialCard';
import { IndustrialInput } from '../components/ui-industrial/IndustrialInput';
import { IndustrialMenuItemCard } from '../components/pos/IndustrialMenuItemCard';
import { IndustrialCartItemCard } from '../components/pos/IndustrialCartItemCard';
import { IndustrialModifierModal } from '../components/pos/IndustrialModifierModal';
import { IndustrialCheckoutModal } from '../components/pos/IndustrialCheckoutModal';
import { DashboardManager } from '../components/aggregator/DashboardManager';
import { cn } from '../lib/utils';

export default function POSDashboard() {

  const { user, logout } = useAuthStore();
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
    clearCart,
    submitOrder,
    getCartTotal,
    getFilteredMenu,
  } = usePOSStore();
  const { playSound } = useNotificationStore();

  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [showDashboardManager, setShowDashboardManager] = useState(false);

  const filteredMenu = getFilteredMenu();
  const totals = getCartTotal();

  const categories: { id: MenuCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '🍽️' },
    { id: 'appetizers', label: 'Appetizers', icon: '🥟' },
    { id: 'mains', label: 'Mains', icon: '🍛' },
    { id: 'sides', label: 'Sides', icon: '🍚' },
    { id: 'desserts', label: 'Desserts', icon: '🍰' },
    { id: 'beverages', label: 'Beverages', icon: '🥤' },
  ];

  const orderTypes: { id: OrderType; label: string; icon: string }[] = [
    { id: 'dine-in', label: 'Dine-in', icon: '🪑' },
    { id: 'takeout', label: 'Takeout', icon: '🥡' },
    { id: 'delivery', label: 'Delivery', icon: '🛵' },
  ];

  // Handle menu item click
  const handleMenuItemClick = (item: MenuItem) => {
    setSelectedMenuItem(item);
    setIsModifierModalOpen(true);
  };

  // Handle add to cart
  const handleAddToCart = (
    menuItem: MenuItem,
    quantity: number,
    modifiers: any[],
    specialInstructions?: string
  ) => {
    addToCart(menuItem, quantity, modifiers, specialInstructions);
    playSound('order_ready');
  };

  // Handle place order
  const handlePlaceOrder = async (paymentMethod: any) => {
    if (!user?.tenantId) return;

    try {
      const order = await submitOrder(user.tenantId, paymentMethod);
      console.log('Order submitted:', order);
      playSound('order_ready');
      // Show success message
      alert(`Order ${order.orderNumber} placed successfully!`);
    } catch (error) {
      console.error('Failed to submit order:', error);
      alert('Failed to submit order. Please try again.');
    }
  };

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;

    const orderId = `ORD-${Date.now()}`;
    const serverName = user?.name || 'Staff';

    // 1. Send to LAN Server (KDS)
    const orderData = {
      tableId: orderType === 'dine-in' && tableNumber ? `Table ${tableNumber}` : orderType, // Use table number if dine-in, otherwise order type
      items: cart,
      total: totals.total, // Use totals.total instead of cartTotal
      timestamp: new Date().toISOString()
    };

    // Broadcast via LAN Client
    lanClient.broadcastOrder(orderData);

    // 2. Local Print (KOT/BOT)
    splitAndPrintTickets(cart, orderId, '01', serverName);

    // 3. Optional: Clear cart or mark as sent
    // For now we keep it to allow checkout
    alert("Sent to Kitchen & KOT Printed");
  };

  const handlePrintKOT = () => {
    if (cart.length === 0) return;
    splitAndPrintTickets(cart, `PROT-${Date.now()}`, '01', user?.name || 'Staff');
  };

  return (
    <div className="flex h-screen bg-[#F0F0F0] overflow-hidden font-industrial select-none">
      {/* Top Header - Industrial Style */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-500 text-black font-black px-3 py-1 text-xl border-2 border-yellow-600">
            POS
          </div>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider">{user?.name || 'Server'}</h1>
            <div className="text-xs text-gray-400 font-mono">{new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <IndustrialButton
            variant={showDashboardManager ? 'primary' : 'ghost'}
            size="sm"
            className="text-white hover:text-white hover:bg-slate-700"
            onClick={() => setShowDashboardManager(!showDashboardManager)}
          >
            Partner Dashboards
          </IndustrialButton>
          <IndustrialButton variant="danger" size="sm" onClick={logout}>
            LOGOUT
          </IndustrialButton>
        </div>
      </header>

      {/* Partner Dashboards Section Overlay */}
      {showDashboardManager && (
        <div className="absolute top-20 right-4 z-50 w-96 shadow-2xl">
          <IndustrialCard variant="raised" padding="md" className="bg-white">
            <div className="flex items-center justify-between mb-3 border-b-2 border-slate-200 pb-2">
              <h3 className="text-sm font-black uppercase text-slate-800">Aggregator Dashboards</h3>
              <button
                onClick={() => setShowDashboardManager(false)}
                className="text-red-500 font-bold hover:text-red-700 text-xs uppercase"
              >
                Close
              </button>
            </div>
            <DashboardManager />
          </IndustrialCard>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Navigation & Menu */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-200 p-4 gap-4">
          {/* Search & Categories */}
          <div className="flex gap-4">
            <div className="flex-1">
              <IndustrialInput
                placeholder="SEARCH ITEM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xl uppercase"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'flex-1 px-4 py-4 font-black uppercase tracking-wider border-b-4 transition-all whitespace-nowrap text-lg min-w-[140px]',
                  selectedCategory === category.id
                    ? 'bg-slate-800 text-white border-slate-900 transform -translate-y-1'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                )}
              >
                <span className="mr-2">{category.icon}</span>
                {category.label}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto pr-2">
            {filteredMenu.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="text-6xl mb-4">🔍</div>
                <div className="text-2xl font-black uppercase">No Items Found</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                {filteredMenu.map((item) => (
                  <div key={item.id} className="h-full">
                    <IndustrialMenuItemCard
                      item={item}
                      onAddToCart={handleMenuItemClick}
                      className="h-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Order Panel */}
        <div className="w-[350px] lg:w-[400px] xl:w-[450px] bg-white border-l-4 border-slate-300 flex flex-col z-20 shadow-xl">
          <div className="p-4 bg-slate-50 border-b-2 border-slate-200">
            <h2 className="text-xl font-black uppercase text-slate-800 mb-4 flex items-center gap-2">
              <span>📝</span> Current Order
            </h2>

            {/* Order Type Selectors */}
            <div className="flex gap-2 mb-4">
              {orderTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setOrderType(type.id)}
                  className={cn(
                    'flex-1 py-3 font-bold uppercase text-sm border-2 transition-all',
                    orderType === type.id
                      ? 'bg-slate-800 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-300'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Table Input */}
            {orderType === 'dine-in' && (
              <div className="flex items-center gap-2 bg-yellow-50 p-2 border border-yellow-200">
                <span className="font-bold uppercase text-sm whitespace-nowrap">Table #:</span>
                <input
                  type="number"
                  value={tableNumber || ''}
                  onChange={(e) => setTableNumber(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-white border-2 border-gray-300 px-2 py-1 font-bold text-lg focus:border-slate-800 focus:outline-none"
                  placeholder="0"
                />
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                <div className="text-6xl mb-2">🛒</div>
                <div className="font-black uppercase text-xl">Order Empty</div>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <IndustrialCartItemCard
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeFromCart}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer Totals & Actions */}
          <div className="p-4 bg-white border-t-4 border-slate-300">
            <div className="space-y-2 mb-4 text-sm font-bold text-gray-600">
              <div className="flex justify-between">
                <span>SUBTOTAL</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>TAX (5%)</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-2xl font-black text-slate-900 border-t-2 border-slate-900 pt-2 mt-2">
                <span>TOTAL</span>
                <span>₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <IndustrialButton
                variant="secondary"
                size="md"
                className="bg-orange-100 border-orange-300 text-orange-900"
                onClick={handlePrintKOT}
              >
                PRINT KOT
              </IndustrialButton>
              <IndustrialButton
                variant="secondary"
                size="md"
                onClick={handleSendToKitchen}
              >
                KITCHEN
              </IndustrialButton>
            </div>
            <IndustrialButton
              fullWidth
              variant="success"
              size="xl"
              className="py-6 text-2xl font-black italic shadow-[0_6px_0_0_#166534] active:translate-y-[2px] active:shadow-[0_4px_0_0_#166534]"
              onClick={() => setIsPlaceOrderModalOpen(true)}
            >
              CASH OUT (₹{totals.total.toFixed(2)})
            </IndustrialButton>
          </div>
        </div>
      </div>

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
        subtotal={totals.subtotal}
        tax={totals.tax}
        total={totals.total}
        orderType={orderType}
        tableNumber={tableNumber}
        onSubmit={handlePlaceOrder}
      />
    </div>
  );
}

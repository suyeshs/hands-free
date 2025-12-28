/**
 * Guest Order Page
 * Main page for QR code-based guest ordering
 * Accessed via /table/:tableId route
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { GuestHeader } from '../components/guest/GuestHeader';
import { GuestMenuBrowser } from '../components/guest/GuestMenuBrowser';
import { GuestCart } from '../components/guest/GuestCart';
import { GuestCheckout } from '../components/guest/GuestCheckout';
import { CallWaiterButton } from '../components/guest/CallWaiterButton';
import { useGuestSessionStore } from '../stores/guestSessionStore';
import { getTableInfo, getGuestMenu } from '../lib/guestOrderApi';
import type { GuestTableInfo } from '../types/guest-order';

// CSS for slide-up animation
const styles = `
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

export default function GuestOrderPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<GuestTableInfo | null>(null);
  const [menu, setMenu] = useState<{ categories: any[]; items: any[] } | null>(null);

  // UI state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Session store
  const initSession = useGuestSessionStore((state) => state.initSession);
  const cartItemCount = useGuestSessionStore((state) => state.getCartItemCount());

  // Load table info and menu on mount
  useEffect(() => {
    if (!tableId) {
      setError('Invalid table link');
      setIsLoading(false);
      return;
    }

    loadData();
  }, [tableId]);

  const loadData = async () => {
    if (!tableId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get table info to find tenant ID
      const info = await getTableInfo('default', tableId);
      setTableInfo(info);

      // Initialize or resume guest session
      initSession(info.restaurantName, tableId);

      // Load menu
      const menuData = await getGuestMenu(info.restaurantName);
      setMenu({
        categories: menuData.categories || [],
        items: menuData.items || [],
      });
    } catch (err) {
      console.error('[GuestOrderPage] Failed to load data:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load menu. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderSuccess = (orderId: string, _orderNumber: string) => {
    setIsCheckoutOpen(false);
    navigate(`/table/${tableId}/confirmed/${orderId}`);
  };

  // Inject styles
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tableInfo || !menu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to Load Menu
          </h1>
          <p className="text-gray-600 mb-6">
            {error || 'Something went wrong. Please try scanning the QR code again.'}
          </p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <GuestHeader
        restaurantName={tableInfo.restaurantName}
        restaurantLogo={tableInfo.restaurantLogo}
        tableNumber={tableInfo.tableNumber}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Menu browser */}
      <GuestMenuBrowser
        categories={menu.categories}
        items={menu.items}
      />

      {/* Call waiter button */}
      <CallWaiterButton
        tenantId={tableInfo.restaurantName}
        tableId={tableId!}
      />

      {/* Floating cart button (when cart has items) */}
      {cartItemCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between px-6 py-4 bg-orange-600 text-white rounded-xl shadow-lg hover:bg-orange-700 transition-colors"
          >
            <span className="font-semibold">
              View Cart ({cartItemCount} item{cartItemCount !== 1 ? 's' : ''})
            </span>
            <span className="font-semibold">
              Rs. {useGuestSessionStore.getState().getCartTotal().toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      <GuestCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout sheet */}
      <GuestCheckout
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        tableId={tableId!}
        tenantId={tableInfo.restaurantName}
        onOrderSuccess={handleOrderSuccess}
      />
    </div>
  );
}

/**
 * Guest Header Component
 * Shows restaurant branding, table number, and cart icon
 */

import { ShoppingCart } from 'lucide-react';
import { useGuestSessionStore } from '../../stores/guestSessionStore';

interface GuestHeaderProps {
  restaurantName: string;
  restaurantLogo?: string;
  tableNumber: number;
  onCartClick: () => void;
}

export function GuestHeader({
  restaurantName,
  restaurantLogo,
  tableNumber,
  onCartClick,
}: GuestHeaderProps) {
  const cartItemCount = useGuestSessionStore((state) => state.getCartItemCount());

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Restaurant branding */}
        <div className="flex items-center gap-3">
          {restaurantLogo ? (
            <img
              src={restaurantLogo}
              alt={restaurantName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <span className="text-orange-600 font-bold text-lg">
                {restaurantName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {restaurantName}
            </h1>
            <p className="text-sm text-gray-500">Table {tableNumber}</p>
          </div>
        </div>

        {/* Cart button */}
        <button
          onClick={onCartClick}
          className="relative p-2 rounded-full bg-orange-50 hover:bg-orange-100 transition-colors"
          aria-label="View cart"
        >
          <ShoppingCart className="w-6 h-6 text-orange-600" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

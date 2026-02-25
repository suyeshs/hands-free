'use client';

import { observer } from 'mobx-react-lite';
import { ChevronDown, MapPin } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';

interface GrabHeaderProps {
  onAddressClick?: () => void;
  onSearchChange?: (query: string) => void;
}

function GrabHeaderComponent({ onAddressClick, onSearchChange }: GrabHeaderProps) {
  const deliveryAddress = orderStore.deliveryAddress;

  // Get display text for address
  const getAddressDisplay = () => {
    if (!deliveryAddress) {
      return {
        label: 'Deliver to',
        address: 'Select address',
        hasAddress: false,
      };
    }

    // Try to get a short version of the address
    const parts = [];
    if (deliveryAddress.apartment) parts.push(deliveryAddress.apartment);
    if (deliveryAddress.pincode) parts.push(deliveryAddress.pincode);
    const shortAddress = parts.length > 0 ? parts.join(' • ') : deliveryAddress.formatted;

    // Truncate if too long
    const truncated = shortAddress.length > 30
      ? shortAddress.substring(0, 30) + '...'
      : shortAddress;

    return {
      label: 'Deliver to',
      address: truncated,
      hasAddress: true,
    };
  };

  const addressInfo = getAddressDisplay();

  return (
    <div className="grab-header">
      <div className="header-top">
        <button
          onClick={onAddressClick}
          className="location"
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
        >
          <span className="location-icon">
            {addressInfo.hasAddress ? (
              <MapPin className="w-5 h-5 text-orange-500" />
            ) : (
              '📍'
            )}
          </span>
          <div style={{ flex: 1 }}>
            <div className="location-label">{addressInfo.label}</div>
            <div
              className="location-address"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: addressInfo.hasAddress ? '#1f2937' : '#9ca3af',
              }}
            >
              <span>{addressInfo.address}</span>
              <ChevronDown className="w-4 h-4" style={{ opacity: 0.6 }} />
            </div>
          </div>
        </button>
        <div className="notification-bell">
          <span>🔔</span>
          <span className="notification-badge"></span>
        </div>
      </div>
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search for dishes"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}

const GrabHeader = observer(GrabHeaderComponent);
export default GrabHeader;

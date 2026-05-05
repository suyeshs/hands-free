# Address Verification Integration Guide

## Overview

The Google Places Worker provides centralized address verification services for all apps in the Handsfree platform. This guide shows how to integrate address verification into your application.

## Worker Endpoint

```
https://handsfree-google-places.workers.dev
```

Or use the environment variable in production:
```typescript
const GOOGLE_PLACES_WORKER = process.env.NEXT_PUBLIC_GOOGLE_PLACES_WORKER || 'https://handsfree-google-places.workers.dev';
```

## Quick Start

### 1. Basic Address Verification

```typescript
async function verifyAddress(address: string) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });

  const result = await response.json();

  if (result.success) {
    return {
      verified: true,
      address: result.data.address,
      coordinates: result.data.coordinates,
      placeId: result.data.placeId,
      city: result.data.city,
      state: result.data.state,
      pincode: result.data.pincode
    };
  } else {
    throw new Error(result.message || 'Address verification failed');
  }
}
```

### 2. Quick Lookup with PlaceId

For returning customers with saved addresses containing placeId:

```typescript
async function quickAddressLookup(placeId: string) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/place-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId })
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  } else if (result.error === 'PLACEID_NOT_FOUND' || result.error === 'PLACEID_INVALID') {
    // PlaceId is stale - prompt user to re-enter address
    throw new Error('PLACEID_STALE');
  } else {
    throw new Error(result.message || 'Failed to lookup address');
  }
}
```

### 3. Reverse Geocoding (GPS to Address)

Convert user's GPS coordinates to address:

```typescript
async function getAddressFromGPS(lat: number, lng: number) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/reverse-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.message || 'Failed to reverse geocode');
  }
}
```

## Complete Integration Example: React Component

### AddressVerificationService.ts

```typescript
/**
 * Centralized address verification service
 * Uses Google Places Worker for all address operations
 */

const GOOGLE_PLACES_WORKER = process.env.NEXT_PUBLIC_GOOGLE_PLACES_WORKER ||
  'https://handsfree-google-places.workers.dev';

export interface AddressData {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export class AddressVerificationService {
  /**
   * Verify an address string and get coordinates + placeId
   */
  static async verifyAddress(address: string, region: string = 'IN'): Promise<AddressData> {
    const response = await fetch(`${GOOGLE_PLACES_WORKER}/api/address/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, region })
    });

    const result = await response.json();

    if (!result.success) {
      const error = new Error(result.message || 'Address verification failed');
      (error as any).code = result.error;
      throw error;
    }

    return {
      address: result.data.address,
      coordinates: result.data.coordinates,
      placeId: result.data.placeId,
      city: result.data.city,
      state: result.data.state,
      pincode: result.data.pincode
    };
  }

  /**
   * Quick lookup using saved placeId (40% cheaper, 50% faster)
   */
  static async getAddressFromPlaceId(placeId: string): Promise<AddressData & { placeIdChanged: boolean }> {
    const response = await fetch(`${GOOGLE_PLACES_WORKER}/api/address/place-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId })
    });

    const result = await response.json();

    if (!result.success) {
      const error = new Error(result.message || 'PlaceId lookup failed');
      (error as any).code = result.error;
      throw error;
    }

    return {
      address: result.data.address,
      coordinates: result.data.coordinates,
      placeId: result.data.placeId,
      city: result.data.city,
      state: result.data.state,
      pincode: result.data.pincode,
      placeIdChanged: result.data.placeIdChanged
    };
  }

  /**
   * Reverse geocode GPS coordinates to address
   */
  static async reverseGeocode(lat: number, lng: number): Promise<AddressData> {
    const response = await fetch(`${GOOGLE_PLACES_WORKER}/api/address/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Reverse geocoding failed');
    }

    return {
      address: result.data.address,
      coordinates: result.data.coordinates,
      placeId: result.data.placeId,
      city: result.data.city,
      state: result.data.state,
      pincode: result.data.pincode
    };
  }

  /**
   * Check if we deliver to this address
   * (Custom business logic - not part of worker)
   */
  static async checkDeliveryEligibility(
    coordinates: { lat: number; lng: number },
    restaurantCoordinates: { lat: number; lng: number },
    maxDeliveryRadius: number = 10
  ): Promise<{
    eligible: boolean;
    distance: number;
    estimatedTime: number;
    fee: number;
  }> {
    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(
      coordinates,
      restaurantCoordinates
    );

    const eligible = distance <= maxDeliveryRadius;
    const estimatedTime = eligible ? Math.ceil(distance * 5) : 0; // 5 min per km
    const fee = eligible ? this.calculateDeliveryFee(distance) : 0;

    return {
      eligible,
      distance,
      estimatedTime,
      fee
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private static calculateDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Radius of Earth in km
    const dLat = this.deg2rad(coord2.lat - coord1.lat);
    const dLon = this.deg2rad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(coord1.lat)) *
        Math.cos(this.deg2rad(coord2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate delivery fee based on distance
   */
  private static calculateDeliveryFee(distance: number): number {
    if (distance <= 3) return 0; // Free delivery within 3km
    if (distance <= 5) return 20;
    if (distance <= 10) return 40;
    return 60;
  }
}
```

### Updated AddressEntry Component

```typescript
'use client';

import { useState } from 'react';
import { AddressVerificationService } from '../services/AddressVerificationService';

export function AddressEntry({ onAddressVerified }) {
  const [address, setAddress] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Step 1: Verify address and get coordinates + placeId
      const addressData = await AddressVerificationService.verifyAddress(address);

      // Step 2: Check delivery eligibility (custom business logic)
      const restaurantCoords = { lat: 12.9716, lng: 77.5946 }; // Your restaurant
      const delivery = await AddressVerificationService.checkDeliveryEligibility(
        addressData.coordinates,
        restaurantCoords
      );

      if (!delivery.eligible) {
        setError(`Sorry, we don't deliver to this location (${delivery.distance.toFixed(1)} km away). Maximum delivery radius is 10 km.`);
        return;
      }

      // Success! Pass verified address to parent
      onAddressVerified({
        ...addressData,
        delivery: {
          eligible: true,
          distance: delivery.distance,
          estimatedTime: delivery.estimatedTime,
          fee: delivery.fee
        }
      });

    } catch (err: any) {
      console.error('Address verification failed:', err);

      if (err.code === 'ADDRESS_NOT_FOUND') {
        setError('Address not found. Please enter a more specific address.');
      } else {
        setError(err.message || 'Failed to verify address');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Delivery Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your full address (e.g., Flat 501, Prestige Towers, 5th Cross, Koramangala, Bangalore, 560034)"
          rows={3}
          className="w-full p-3 border rounded-lg"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={isVerifying || !address.trim()}
        className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {isVerifying ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Verifying Address...
          </span>
        ) : (
          'Verify Address'
        )}
      </button>
    </div>
  );
}
```

### Quick Address Selection with PlaceId

```typescript
'use client';

import { useState, useEffect } from 'react';
import { AddressVerificationService } from '../services/AddressVerificationService';

interface SavedAddress {
  placeId: string;
  formatted: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
}

export function SavedAddresses({
  customerPhone,
  onAddressSelected
}: {
  customerPhone: string;
  onAddressSelected: (address: any) => void;
}) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedAddresses();
  }, [customerPhone]);

  const loadSavedAddresses = async () => {
    // Fetch saved addresses from your database
    const addresses = await fetchCustomerAddresses(customerPhone);
    setSavedAddresses(addresses);
  };

  const handleSelectAddress = async (savedAddress: SavedAddress) => {
    setLoading(true);

    try {
      // Quick lookup using placeId (40% cheaper than full geocoding)
      const addressData = await AddressVerificationService.getAddressFromPlaceId(
        savedAddress.placeId
      );

      // If placeId changed, update database
      if (addressData.placeIdChanged) {
        console.log('PlaceId was auto-refreshed:', addressData.placeId);
        await updateAddressPlaceId(customerPhone, savedAddress.placeId, addressData.placeId);
      }

      // Check delivery eligibility
      const restaurantCoords = { lat: 12.9716, lng: 77.5946 };
      const delivery = await AddressVerificationService.checkDeliveryEligibility(
        addressData.coordinates,
        restaurantCoords
      );

      if (!delivery.eligible) {
        alert('Sorry, we no longer deliver to this location.');
        return;
      }

      onAddressSelected({
        ...addressData,
        delivery
      });

    } catch (err: any) {
      console.error('Address lookup failed:', err);

      if (err.code === 'PLACEID_NOT_FOUND' || err.code === 'PLACEID_INVALID') {
        alert('This saved address is no longer valid. Please re-enter your address.');
        // Optionally remove this address from database
      } else {
        alert('Failed to load address. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium mb-2">Quick Select</h3>
      {savedAddresses.map((addr, idx) => (
        <button
          key={idx}
          onClick={() => handleSelectAddress(addr)}
          disabled={loading}
          className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium capitalize">{addr.label}</p>
              <p className="text-xs text-gray-600">{addr.formatted}</p>
            </div>
            {addr.isDefault && (
              <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                Default
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
```

## Migration Checklist

### ✅ Step 1: Update Environment Variables

Add to `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_PLACES_WORKER=https://handsfree-google-places.workers.dev
```

### ✅ Step 2: Create Address Service

Create `/app/services/AddressVerificationService.ts` with the code above.

### ✅ Step 3: Update Address Entry Component

Replace backend geocoding calls with `AddressVerificationService.verifyAddress()`.

### ✅ Step 4: Update Saved Address Loading

Replace backend placeId lookups with `AddressVerificationService.getAddressFromPlaceId()`.

### ✅ Step 5: Remove Backend Dependencies

Remove Google Maps SDK from backend if no longer needed:
```bash
npm uninstall @googlemaps/google-maps-services-js
```

### ✅ Step 6: Update Database Schema

Ensure customer addresses table has `place_id` column:
```sql
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS place_id TEXT;
```

### ✅ Step 7: Test End-to-End

1. Test new address entry
2. Test saved address selection
3. Test stale placeId handling
4. Test delivery radius validation

## Benefits of Migration

1. **Reduced Backend Load**: No Google API calls from backend
2. **Shared Caching**: All apps benefit from worker's cache
3. **Cost Savings**: Automatic placeId optimization (40% cheaper)
4. **Centralized Updates**: Update Google API logic in one place
5. **Better Performance**: Edge workers are faster than backend servers
6. **Simplified Maintenance**: Less code in backend and frontend

## Support

For issues or questions, check:
- [Worker Documentation](./README.md)
- [API Reference](./README.md#api-endpoints)
- [GitHub Issues](https://github.com/your-org/handsfree-platform/issues)

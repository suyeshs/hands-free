/**
 * Restaurant configuration types
 * Matches backend Firestore schema (organizations collection)
 */

export interface BrandIdentity {
  primaryColor: string;
  logo: string | null;
  tagline: string | null;
}

export interface RestaurantProfile {
  tenantId: string;
  name: string;
  cuisine: string;
  address: string;
  phone: string;
  hours: string;
  about: string;
  brandIdentity?: BrandIdentity;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantConfig {
  profile: RestaurantProfile | null;
  isLoading: boolean;
  error: string | null;
}

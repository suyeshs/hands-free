/**
 * Multimodal Travel Theme - Type Definitions
 * Complete TypeScript types for travel booking components
 */

import type { TravelDesignTokens } from './design-tokens';
import type { NeumorphicComponent, MultimodalInteraction } from '../neumorphic/types';

// ===========================
// Core Travel Data Types
// ===========================

export type TravelCategory = 'flights' | 'hotels' | 'experiences' | 'packages';

export type FlightClass = 'economy' | 'premiumEconomy' | 'business' | 'first';

export type CabinBaggage = {
  weight: number;
  unit: 'kg' | 'lbs';
  dimensions?: string;
};

export type CheckedBaggage = {
  pieces: number;
  weight: number;
  unit: 'kg' | 'lbs';
};

export type Airport = {
  code: string; // IATA code (e.g., "JFK")
  name: string;
  city: string;
  country: string;
  terminal?: string;
};

export type Airline = {
  code: string; // IATA code (e.g., "AA")
  name: string;
  logo?: string;
};

export type FlightSegment = {
  id: string;
  airline: Airline;
  flightNumber: string;
  departure: {
    airport: Airport;
    time: string; // ISO 8601
    terminal?: string;
  };
  arrival: {
    airport: Airport;
    time: string; // ISO 8601
    terminal?: string;
  };
  duration: string; // e.g., "2h 30m"
  aircraft?: string;
  class: FlightClass;
};

export type Flight = {
  id: string;
  type: 'outbound' | 'return' | 'oneway';
  segments: FlightSegment[];
  totalDuration: string;
  stops: number;
  price: {
    amount: number;
    currency: string;
  };
  cabinBaggage: CabinBaggage;
  checkedBaggage: CheckedBaggage;
  amenities: string[];
  refundable: boolean;
  seatsAvailable: number;
};

export type HotelAmenity =
  | 'wifi'
  | 'parking'
  | 'pool'
  | 'breakfast'
  | 'petFriendly'
  | 'gym'
  | 'spa'
  | 'airConditioning'
  | 'restaurant'
  | 'bar'
  | 'roomService'
  | 'concierge'
  | 'laundry';

export type Hotel = {
  id: string;
  name: string;
  description: string;
  images: string[];
  rating: number; // 1-5 stars
  reviewCount: number;
  reviewScore?: number; // 0-10
  location: {
    address: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    distanceFromCenter?: string;
  };
  price: {
    amount: number;
    currency: string;
    per: 'night' | 'stay';
  };
  amenities: HotelAmenity[];
  roomType?: string;
  bedType?: string;
  maxGuests: number;
  cancellationPolicy: 'free' | 'partial' | 'non-refundable';
  checkIn: string; // Time, e.g., "15:00"
  checkOut: string; // Time, e.g., "11:00"
};

export type Experience = {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string; // e.g., "Tours", "Activities", "Food & Drink"
  duration: string;
  rating: number;
  reviewCount: number;
  price: {
    amount: number;
    currency: string;
    per: 'person' | 'group';
  };
  location: {
    city: string;
    country: string;
  };
  included: string[];
  languages: string[];
  maxGroupSize?: number;
  cancellationPolicy: 'free' | 'partial' | 'non-refundable';
};

export type Package = {
  id: string;
  name: string;
  description: string;
  images: string[];
  destination: {
    city: string;
    country: string;
  };
  duration: {
    nights: number;
    days: number;
  };
  flight: Flight;
  hotel: Hotel;
  experiences?: Experience[];
  totalPrice: {
    amount: number;
    currency: string;
  };
  savings?: {
    amount: number;
    percentage: number;
  };
  included: string[];
  rating?: number;
  reviewCount?: number;
};

export type ItineraryItem = {
  id: string;
  type: TravelCategory;
  data: Flight | Hotel | Experience | Package;
  startDate: string; // ISO 8601
  endDate?: string; // ISO 8601
  status: 'planned' | 'booked' | 'completed' | 'cancelled';
  notes?: string;
};

export type Itinerary = {
  id: string;
  title: string;
  description?: string;
  destination: {
    city: string;
    country: string;
  };
  dates: {
    start: string; // ISO 8601
    end: string; // ISO 8601
  };
  travelers: {
    adults: number;
    children: number;
    infants: number;
  };
  items: ItineraryItem[];
  totalPrice: {
    amount: number;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
};

// ===========================
// Component Types
// ===========================

export type FlightCardDisplayMode = 'compact' | 'standard' | 'detailed';

export type FlightCardConfig = NeumorphicComponent & {
  componentType: 'flight-card';
  displayMode: FlightCardDisplayMode;
  showAirlineLogo: boolean;
  showAircraft: boolean;
  showBaggage: boolean;
  showAmenities: boolean;
  highlightBestValue: boolean;
  pricePosition: 'right' | 'bottom';
  classNames?: {
    container?: string;
    header?: string;
    segment?: string;
    price?: string;
  };
};

export type HotelCardDisplayMode = 'compact' | 'standard' | 'detailed';

export type HotelCardConfig = NeumorphicComponent & {
  componentType: 'hotel-card';
  displayMode: HotelCardDisplayMode;
  imageHeight: string;
  showRating: boolean;
  showReviewScore: boolean;
  showAmenities: boolean;
  amenityLimit: number;
  showDistance: boolean;
  showCancellationPolicy: boolean;
  pricePosition: 'overlay' | 'bottom';
  classNames?: {
    container?: string;
    image?: string;
    content?: string;
    amenities?: string;
    price?: string;
  };
};

export type PackageCardConfig = NeumorphicComponent & {
  componentType: 'package-card';
  displayMode: 'compact' | 'standard' | 'detailed';
  imageHeight: string;
  showSavings: boolean;
  showInclusions: boolean;
  inclusionLimit: number;
  showRating: boolean;
  highlightDeal: boolean;
  classNames?: {
    container?: string;
    image?: string;
    content?: string;
    savings?: string;
    price?: string;
  };
};

export type ItineraryBuilderConfig = NeumorphicComponent & {
  componentType: 'itinerary-builder';
  layout: 'timeline' | 'grid' | 'list';
  allowDragDrop: boolean;
  showDatePicker: boolean;
  showTravelerSelector: boolean;
  showBudgetTracker: boolean;
  showMap: boolean;
  classNames?: {
    container?: string;
    timeline?: string;
    item?: string;
    summary?: string;
  };
};

export type VoiceOrbConfig = NeumorphicComponent & {
  componentType: 'voice-orb';
  size: 'small' | 'medium' | 'large';
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'floating';
  showVisualizer: boolean;
  visualizerStyle: 'bars' | 'wave' | 'circular';
  visualizerBars?: number;
  showTranscript: boolean;
  showSuggestions: boolean;
  glowEffect: 'none' | 'subtle' | 'medium' | 'strong';
  pulseOnListening: boolean;
  classNames?: {
    container?: string;
    orb?: string;
    visualizer?: string;
    transcript?: string;
  };
};

export type BookingIslandConfig = NeumorphicComponent & {
  componentType: 'booking-island';
  position: 'bottom-left' | 'bottom-right' | 'top-right';
  size: 'small' | 'medium' | 'large';
  showItemCount: boolean;
  showTotalPrice: boolean;
  expandable: boolean;
  pulseOnAdd: boolean;
  classNames?: {
    container?: string;
    badge?: string;
    summary?: string;
  };
};

export type DestinationCarouselConfig = NeumorphicComponent & {
  componentType: 'destination-carousel';
  layout: 'horizontal' | 'grid';
  itemsPerView: number | 'auto';
  showNavigation: boolean;
  showPagination: boolean;
  autoplay: boolean;
  autoplayDelay?: number;
  loop: boolean;
  cardStyle: 'image-overlay' | 'image-top';
  showPrice: boolean;
  classNames?: {
    container?: string;
    item?: string;
    navigation?: string;
  };
};

export type TravelComponents = {
  flightCard: FlightCardConfig;
  hotelCard: HotelCardConfig;
  packageCard: PackageCardConfig;
  itineraryBuilder: ItineraryBuilderConfig;
  voiceOrb: VoiceOrbConfig;
  bookingIsland: BookingIslandConfig;
  destinationCarousel: DestinationCarouselConfig;
};

// ===========================
// Layout Types
// ===========================

export type LandingLayout = {
  type: 'landing';
  hero: {
    title: string;
    subtitle: string;
    backgroundImage?: string;
    backgroundVideo?: string;
    searchBar: boolean;
    quickLinks: Array<{
      label: string;
      category: TravelCategory;
      icon: string;
    }>;
  };
  sections: Array<{
    id: string;
    title: string;
    type: 'voice-booking' | 'browse' | 'featured-destinations' | 'popular-packages';
    content?: any;
  }>;
};

export type VoiceAssistedLayout = {
  type: 'voice-assisted';
  voicePanel: {
    position: 'left' | 'right';
    width: string;
    showTranscript: boolean;
    showBookingSummary: boolean;
    showSuggestions: boolean;
  };
  visualFeed: {
    columns: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
    itemsPerPage: number;
    showFilters: boolean;
  };
  voiceOrb: VoiceOrbConfig;
  detailModal: {
    size: 'small' | 'medium' | 'large' | 'fullscreen';
    backdropBlur: boolean;
  };
};

export type StandardBrowseLayout = {
  type: 'standard-browse';
  header: {
    showSearch: boolean;
    showFilters: boolean;
    showSort: boolean;
    showCategoryTabs: boolean;
  };
  sidebar: {
    position: 'left' | 'right' | 'none';
    width: string;
    collapsible: boolean;
    filters: Array<{
      type: 'price-range' | 'date-range' | 'rating' | 'amenities' | 'stops' | 'class' | 'custom';
      label: string;
      options?: any[];
    }>;
  };
  grid: {
    columns: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
    gap: string;
    cardStyle: 'compact' | 'standard' | 'detailed';
  };
  pagination: {
    type: 'pages' | 'infinite-scroll' | 'load-more';
    itemsPerPage: number;
  };
};

export type TravelLayouts = {
  landing: LandingLayout;
  voiceAssisted: VoiceAssistedLayout;
  standardBrowse: StandardBrowseLayout;
};

// ===========================
// Voice Command Types
// ===========================

export type TravelVoiceCommand = {
  intent: string;
  patterns: string[];
  action: string;
  parameters?: Record<string, any>;
  feedback: {
    visual: string;
    audio?: string;
    haptic?: boolean;
  };
  examples: string[];
};

export type TravelVoiceCommands = {
  search: TravelVoiceCommand[];
  book: TravelVoiceCommand[];
  navigate: TravelVoiceCommand[];
  filter: TravelVoiceCommand[];
  itinerary: TravelVoiceCommand[];
};

// ===========================
// Main Theme Type
// ===========================

export type MultimodalTravelTheme = {
  id: string;
  name: string;
  description: string;
  version: string;
  designTokens: TravelDesignTokens;
  components: TravelComponents;
  layouts: TravelLayouts;
  interactions: MultimodalInteraction & {
    voiceCommands: TravelVoiceCommands;
  };
  accessibility: {
    level: 'A' | 'AA' | 'AAA';
    features: string[];
    keyboardShortcuts: Record<string, string>;
  };
  animations: {
    enabled: boolean;
    presets: Record<string, any>;
  };
  customStyles?: {
    css?: string;
    tailwindClasses?: Record<string, string>;
  };
};

// ===========================
// Search & Filter Types
// ===========================

export type FlightSearchParams = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  class: FlightClass;
  directOnly?: boolean;
  maxStops?: number;
  airlines?: string[];
  maxPrice?: number;
};

export type HotelSearchParams = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  rooms?: number;
  minRating?: number;
  maxPrice?: number;
  amenities?: HotelAmenity[];
  sortBy?: 'price' | 'rating' | 'distance' | 'popularity';
};

export type ExperienceSearchParams = {
  destination: string;
  date?: string;
  category?: string;
  minRating?: number;
  maxPrice?: number;
  languages?: string[];
  sortBy?: 'price' | 'rating' | 'popularity';
};

export type PackageSearchParams = {
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children?: number;
  maxPrice?: number;
  minRating?: number;
  includeExperiences?: boolean;
};

// ===========================
// Type Guards
// ===========================

// Type guards
export function isFlight(item: any): item is Flight {
  return item && typeof item === 'object' && 'segments' in item && Array.isArray(item.segments);
}

export function isHotel(item: any): item is Hotel {
  return item && typeof item === 'object' && 'amenities' in item && 'location' in item;
}

export function isExperience(item: any): item is Experience {
  return item && typeof item === 'object' && 'duration' in item && 'included' in item;
}

export function isPackage(item: any): item is Package {
  return item && typeof item === 'object' && 'flight' in item && 'hotel' in item;
}

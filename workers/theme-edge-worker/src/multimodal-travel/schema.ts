/**
 * Multimodal Travel Theme - Validation Schemas
 * Zod schemas for runtime validation and type safety
 */

import { z } from 'zod';

// ===========================
// Core Travel Data Schemas
// ===========================

export const travelCategorySchema = z.enum(['flights', 'hotels', 'experiences', 'packages']);

export const flightClassSchema = z.enum(['economy', 'premiumEconomy', 'business', 'first']);

export const cabinBaggageSchema = z.object({
  weight: z.number().positive(),
  unit: z.enum(['kg', 'lbs']),
  dimensions: z.string().optional(),
});

export const checkedBaggageSchema = z.object({
  pieces: z.number().int().positive(),
  weight: z.number().positive(),
  unit: z.enum(['kg', 'lbs']),
});

export const airportSchema = z.object({
  code: z.string().length(3), // IATA code
  name: z.string(),
  city: z.string(),
  country: z.string(),
  terminal: z.string().optional(),
});

export const airlineSchema = z.object({
  code: z.string().min(2).max(3), // IATA code
  name: z.string(),
  logo: z.string().url().optional(),
});

export const flightSegmentSchema = z.object({
  id: z.string(),
  airline: airlineSchema,
  flightNumber: z.string(),
  departure: z.object({
    airport: airportSchema,
    time: z.string().datetime(),
    terminal: z.string().optional(),
  }),
  arrival: z.object({
    airport: airportSchema,
    time: z.string().datetime(),
    terminal: z.string().optional(),
  }),
  duration: z.string(),
  aircraft: z.string().optional(),
  class: flightClassSchema,
});

export const flightSchema = z.object({
  id: z.string(),
  type: z.enum(['outbound', 'return', 'oneway']),
  segments: z.array(flightSegmentSchema).min(1),
  totalDuration: z.string(),
  stops: z.number().int().min(0),
  price: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3), // ISO 4217
  }),
  cabinBaggage: cabinBaggageSchema,
  checkedBaggage: checkedBaggageSchema,
  amenities: z.array(z.string()),
  refundable: z.boolean(),
  seatsAvailable: z.number().int().positive(),
});

export const hotelAmenitySchema = z.enum([
  'wifi',
  'parking',
  'pool',
  'breakfast',
  'petFriendly',
  'gym',
  'spa',
  'airConditioning',
  'restaurant',
  'bar',
  'roomService',
  'concierge',
  'laundry',
]);

export const hotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  images: z.array(z.string().url()).min(1),
  rating: z.number().min(1).max(5),
  reviewCount: z.number().int().min(0),
  reviewScore: z.number().min(0).max(10).optional(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    country: z.string(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
    distanceFromCenter: z.string().optional(),
  }),
  price: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
    per: z.enum(['night', 'stay']),
  }),
  amenities: z.array(hotelAmenitySchema),
  roomType: z.string().optional(),
  bedType: z.string().optional(),
  maxGuests: z.number().int().positive(),
  cancellationPolicy: z.enum(['free', 'partial', 'non-refundable']),
  checkIn: z.string(),
  checkOut: z.string(),
});

export const experienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  images: z.array(z.string().url()).min(1),
  category: z.string(),
  duration: z.string(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  price: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
    per: z.enum(['person', 'group']),
  }),
  location: z.object({
    city: z.string(),
    country: z.string(),
  }),
  included: z.array(z.string()),
  languages: z.array(z.string()),
  maxGroupSize: z.number().int().positive().optional(),
  cancellationPolicy: z.enum(['free', 'partial', 'non-refundable']),
});

export const packageSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  images: z.array(z.string().url()).min(1),
  destination: z.object({
    city: z.string(),
    country: z.string(),
  }),
  duration: z.object({
    nights: z.number().int().positive(),
    days: z.number().int().positive(),
  }),
  flight: flightSchema,
  hotel: hotelSchema,
  experiences: z.array(experienceSchema).optional(),
  totalPrice: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
  }),
  savings: z
    .object({
      amount: z.number().positive(),
      percentage: z.number().min(0).max(100),
    })
    .optional(),
  included: z.array(z.string()),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
});

// ===========================
// Component Configuration Schemas
// ===========================

export const flightCardConfigSchema = z.object({
  componentType: z.literal('flight-card'),
  displayMode: z.enum(['compact', 'standard', 'detailed']),
  showAirlineLogo: z.boolean(),
  showAircraft: z.boolean(),
  showBaggage: z.boolean(),
  showAmenities: z.boolean(),
  highlightBestValue: z.boolean(),
  pricePosition: z.enum(['right', 'bottom']),
  classNames: z
    .object({
      container: z.string().optional(),
      header: z.string().optional(),
      segment: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
});

export const hotelCardConfigSchema = z.object({
  componentType: z.literal('hotel-card'),
  displayMode: z.enum(['compact', 'standard', 'detailed']),
  imageHeight: z.string(),
  showRating: z.boolean(),
  showReviewScore: z.boolean(),
  showAmenities: z.boolean(),
  amenityLimit: z.number().int().positive(),
  showDistance: z.boolean(),
  showCancellationPolicy: z.boolean(),
  pricePosition: z.enum(['overlay', 'bottom']),
  classNames: z
    .object({
      container: z.string().optional(),
      image: z.string().optional(),
      content: z.string().optional(),
      amenities: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
});

export const packageCardConfigSchema = z.object({
  componentType: z.literal('package-card'),
  displayMode: z.enum(['compact', 'standard', 'detailed']),
  imageHeight: z.string(),
  showSavings: z.boolean(),
  showInclusions: z.boolean(),
  inclusionLimit: z.number().int().positive(),
  showRating: z.boolean(),
  highlightDeal: z.boolean(),
  classNames: z
    .object({
      container: z.string().optional(),
      image: z.string().optional(),
      content: z.string().optional(),
      savings: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
});

export const voiceOrbConfigSchema = z.object({
  componentType: z.literal('voice-orb'),
  size: z.enum(['small', 'medium', 'large']),
  position: z.enum(['bottom-left', 'bottom-center', 'bottom-right', 'floating']),
  showVisualizer: z.boolean(),
  visualizerStyle: z.enum(['bars', 'wave', 'circular']),
  visualizerBars: z.number().int().positive().optional(),
  showTranscript: z.boolean(),
  showSuggestions: z.boolean(),
  glowEffect: z.enum(['none', 'subtle', 'medium', 'strong']),
  pulseOnListening: z.boolean(),
  classNames: z
    .object({
      container: z.string().optional(),
      orb: z.string().optional(),
      visualizer: z.string().optional(),
      transcript: z.string().optional(),
    })
    .optional(),
});

export const bookingIslandConfigSchema = z.object({
  componentType: z.literal('booking-island'),
  position: z.enum(['bottom-left', 'bottom-right', 'top-right']),
  size: z.enum(['small', 'medium', 'large']),
  showItemCount: z.boolean(),
  showTotalPrice: z.boolean(),
  expandable: z.boolean(),
  pulseOnAdd: z.boolean(),
  classNames: z
    .object({
      container: z.string().optional(),
      badge: z.string().optional(),
      summary: z.string().optional(),
    })
    .optional(),
});

export const destinationCarouselConfigSchema = z.object({
  componentType: z.literal('destination-carousel'),
  layout: z.enum(['horizontal', 'grid']),
  itemsPerView: z.union([z.number().int().positive(), z.literal('auto')]),
  showNavigation: z.boolean(),
  showPagination: z.boolean(),
  autoplay: z.boolean(),
  autoplayDelay: z.number().positive().optional(),
  loop: z.boolean(),
  cardStyle: z.enum(['image-overlay', 'image-top']),
  showPrice: z.boolean(),
  classNames: z
    .object({
      container: z.string().optional(),
      item: z.string().optional(),
      navigation: z.string().optional(),
    })
    .optional(),
});

export const travelComponentsSchema = z.object({
  flightCard: flightCardConfigSchema,
  hotelCard: hotelCardConfigSchema,
  packageCard: packageCardConfigSchema,
  voiceOrb: voiceOrbConfigSchema,
  bookingIsland: bookingIslandConfigSchema,
  destinationCarousel: destinationCarouselConfigSchema,
});

// ===========================
// Layout Schemas
// ===========================

export const landingLayoutSchema = z.object({
  type: z.literal('landing'),
  hero: z.object({
    title: z.string(),
    subtitle: z.string(),
    backgroundImage: z.string().url().optional(),
    backgroundVideo: z.string().url().optional(),
    searchBar: z.boolean(),
    quickLinks: z.array(
      z.object({
        label: z.string(),
        category: travelCategorySchema,
        icon: z.string(),
      })
    ),
  }),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.enum(['voice-booking', 'browse', 'featured-destinations', 'popular-packages']),
      content: z.any().optional(),
    })
  ),
});

export const voiceAssistedLayoutSchema = z.object({
  type: z.literal('voice-assisted'),
  voicePanel: z.object({
    position: z.enum(['left', 'right']),
    width: z.string(),
    showTranscript: z.boolean(),
    showBookingSummary: z.boolean(),
    showSuggestions: z.boolean(),
  }),
  visualFeed: z.object({
    columns: z.object({
      mobile: z.number().int().positive(),
      tablet: z.number().int().positive(),
      desktop: z.number().int().positive(),
    }),
    itemsPerPage: z.number().int().positive(),
    showFilters: z.boolean(),
  }),
  voiceOrb: voiceOrbConfigSchema,
  detailModal: z.object({
    size: z.enum(['small', 'medium', 'large', 'fullscreen']),
    backdropBlur: z.boolean(),
  }),
});

export const standardBrowseLayoutSchema = z.object({
  type: z.literal('standard-browse'),
  header: z.object({
    showSearch: z.boolean(),
    showFilters: z.boolean(),
    showSort: z.boolean(),
    showCategoryTabs: z.boolean(),
  }),
  sidebar: z.object({
    position: z.enum(['left', 'right', 'none']),
    width: z.string(),
    collapsible: z.boolean(),
    filters: z.array(
      z.object({
        type: z.enum(['price-range', 'date-range', 'rating', 'amenities', 'stops', 'class', 'custom']),
        label: z.string(),
        options: z.array(z.any()).optional(),
      })
    ),
  }),
  grid: z.object({
    columns: z.object({
      mobile: z.number().int().positive(),
      tablet: z.number().int().positive(),
      desktop: z.number().int().positive(),
    }),
    gap: z.string(),
    cardStyle: z.enum(['compact', 'standard', 'detailed']),
  }),
  pagination: z.object({
    type: z.enum(['pages', 'infinite-scroll', 'load-more']),
    itemsPerPage: z.number().int().positive(),
  }),
});

export const travelLayoutsSchema = z.object({
  landing: landingLayoutSchema,
  voiceAssisted: voiceAssistedLayoutSchema,
  standardBrowse: standardBrowseLayoutSchema,
});

// ===========================
// Main Theme Schema
// ===========================

export const multimodalTravelThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  designTokens: z.any(), // TravelDesignTokens - complex object, validated separately
  components: travelComponentsSchema,
  layouts: travelLayoutsSchema,
  interactions: z.object({
    voiceCommands: z.any(), // Complex nested structure
    gestures: z.any().optional(),
    haptics: z.any().optional(),
    keyboardShortcuts: z.record(z.string()).optional(),
  }),
  accessibility: z.object({
    level: z.enum(['A', 'AA', 'AAA']),
    features: z.array(z.string()),
    keyboardShortcuts: z.record(z.string()),
  }),
  animations: z.object({
    enabled: z.boolean(),
    presets: z.record(z.any()),
  }),
  customStyles: z
    .object({
      css: z.string().optional(),
      tailwindClasses: z.record(z.string()).optional(),
    })
    .optional(),
});

// ===========================
// Type Exports
// ===========================

export type MultimodalTravelThemeInput = z.infer<typeof multimodalTravelThemeSchema>;
export type FlightInput = z.infer<typeof flightSchema>;
export type HotelInput = z.infer<typeof hotelSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type PackageInput = z.infer<typeof packageSchema>;

// ===========================
// Validation Functions
// ===========================

export function validateTravelTheme(theme: unknown): MultimodalTravelThemeInput {
  return multimodalTravelThemeSchema.parse(theme);
}

export function isValidTravelTheme(theme: unknown): theme is MultimodalTravelThemeInput {
  return multimodalTravelThemeSchema.safeParse(theme).success;
}

export function validateFlight(flight: unknown): FlightInput {
  return flightSchema.parse(flight);
}

export function validateHotel(hotel: unknown): HotelInput {
  return hotelSchema.parse(hotel);
}

export function validateExperience(experience: unknown): ExperienceInput {
  return experienceSchema.parse(experience);
}

export function validatePackage(pkg: unknown): PackageInput {
  return packageSchema.parse(pkg);
}

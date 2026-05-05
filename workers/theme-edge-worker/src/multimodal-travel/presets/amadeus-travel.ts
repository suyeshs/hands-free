/**
 * Amadeus Travel Theme Preset
 * Complete multimodal travel booking theme with Airbnb-style design
 */

import type { MultimodalTravelTheme, TravelVoiceCommands } from '../types';
import { TravelDesignTokens } from '../design-tokens';
import { TravelAnimationPresets } from '../animation-templates';
import { layouts } from '../layouts';
import {
  createFlightCard,
  createHotelCard,
  createPackageCard,
  createVoiceOrb,
  createBookingIsland,
  createDestinationCarousel,
  createItineraryBuilder,
} from '../primitives';

/**
 * Voice Commands Configuration
 */
const voiceCommands: TravelVoiceCommands = {
  search: [
    {
      intent: 'search-flights',
      patterns: [
        'search flights to {destination}',
        'find flights to {destination}',
        'show me flights to {destination}',
        'flights to {destination}',
      ],
      action: 'SEARCH_FLIGHTS',
      parameters: { type: 'flights' },
      feedback: {
        visual: 'Searching for flights...',
        audio: 'Searching for available flights',
        haptic: true,
      },
      examples: [
        'Search flights to Paris',
        'Find flights to Tokyo from New York',
        'Show me flights to London next week',
      ],
    },
    {
      intent: 'search-hotels',
      patterns: [
        'search hotels in {destination}',
        'find hotels in {destination}',
        'show me hotels in {destination}',
        'hotels in {destination}',
      ],
      action: 'SEARCH_HOTELS',
      parameters: { type: 'hotels' },
      feedback: {
        visual: 'Searching for hotels...',
        audio: 'Finding available accommodations',
        haptic: true,
      },
      examples: [
        'Search hotels in Paris',
        'Find hotels in Bali with pool',
        'Show me 5-star hotels in Dubai',
      ],
    },
    {
      intent: 'search-packages',
      patterns: [
        'search packages to {destination}',
        'find packages to {destination}',
        'show me packages to {destination}',
        'vacation packages to {destination}',
      ],
      action: 'SEARCH_PACKAGES',
      parameters: { type: 'packages' },
      feedback: {
        visual: 'Finding travel packages...',
        audio: 'Searching for package deals',
        haptic: true,
      },
      examples: [
        'Search packages to Maldives',
        'Find vacation packages to Hawaii',
        'Show me all-inclusive packages',
      ],
    },
  ],
  book: [
    {
      intent: 'add-to-booking',
      patterns: [
        'book this',
        'add to booking',
        'select this one',
        'I want this',
      ],
      action: 'ADD_TO_BOOKING',
      feedback: {
        visual: 'Added to your booking',
        audio: 'Item added to your booking',
        haptic: true,
      },
      examples: [
        'Book this flight',
        'Add this hotel to my booking',
        'I want this package',
      ],
    },
    {
      intent: 'checkout',
      patterns: [
        'checkout',
        'book now',
        'confirm booking',
        'proceed to payment',
      ],
      action: 'PROCEED_TO_CHECKOUT',
      feedback: {
        visual: 'Proceeding to checkout...',
        audio: 'Taking you to checkout',
        haptic: true,
      },
      examples: [
        'Checkout',
        'Book everything now',
        'Proceed to payment',
      ],
    },
  ],
  navigate: [
    {
      intent: 'show-booking',
      patterns: [
        'show my booking',
        'view booking',
        'what did I book',
        'my bookings',
      ],
      action: 'SHOW_BOOKING_SUMMARY',
      feedback: {
        visual: 'Opening your bookings...',
        audio: 'Here are your bookings',
        haptic: false,
      },
      examples: [
        'Show my booking',
        'What have I booked so far',
        'View my itinerary',
      ],
    },
    {
      intent: 'go-back',
      patterns: [
        'go back',
        'previous',
        'back',
        'return',
      ],
      action: 'NAVIGATE_BACK',
      feedback: {
        visual: 'Going back...',
        audio: 'Going back',
        haptic: false,
      },
      examples: [
        'Go back',
        'Return to previous page',
      ],
    },
  ],
  filter: [
    {
      intent: 'filter-direct-flights',
      patterns: [
        'show only direct flights',
        'direct flights only',
        'no stops',
        'non-stop flights',
      ],
      action: 'FILTER_DIRECT_FLIGHTS',
      parameters: { stops: 0 },
      feedback: {
        visual: 'Showing direct flights only',
        audio: 'Filtering for direct flights',
        haptic: false,
      },
      examples: [
        'Show only direct flights',
        'Filter non-stop flights',
      ],
    },
    {
      intent: 'filter-price',
      patterns: [
        'under {amount}',
        'less than {amount}',
        'cheaper than {amount}',
        'max {amount}',
      ],
      action: 'FILTER_BY_PRICE',
      feedback: {
        visual: 'Filtering by price...',
        audio: 'Applying price filter',
        haptic: false,
      },
      examples: [
        'Show flights under $500',
        'Hotels less than $200 per night',
      ],
    },
  ],
  itinerary: [
    {
      intent: 'create-itinerary',
      patterns: [
        'create itinerary',
        'plan my trip',
        'make a plan',
        'build itinerary',
      ],
      action: 'CREATE_ITINERARY',
      feedback: {
        visual: 'Creating your itinerary...',
        audio: 'Building your travel plan',
        haptic: true,
      },
      examples: [
        'Create itinerary for Paris',
        'Plan my 5-day trip to Japan',
      ],
    },
  ],
};

/**
 * Complete Amadeus Travel Theme
 */
export const AmadeusTravelTheme: MultimodalTravelTheme = {
  id: 'amadeus-travel',
  name: 'Amadeus Travel',
  description: 'Multimodal travel booking theme with Airbnb-inspired design and voice-first interaction',
  version: '1.0.0',

  // Design System
  designTokens: TravelDesignTokens,

  // Component Configurations
  components: {
    flightCard: createFlightCard({
      displayMode: 'standard',
      showAirlineLogo: true,
      showAircraft: true,
      showBaggage: true,
      showAmenities: true,
      highlightBestValue: true,
      pricePosition: 'right',
    }),
    hotelCard: createHotelCard({
      displayMode: 'standard',
      imageHeight: '240px',
      showRating: true,
      showReviewScore: true,
      showAmenities: true,
      amenityLimit: 6,
      showDistance: true,
      showCancellationPolicy: true,
      pricePosition: 'bottom',
    }),
    packageCard: createPackageCard({
      displayMode: 'standard',
      imageHeight: '280px',
      showSavings: true,
      showInclusions: true,
      inclusionLimit: 5,
      showRating: true,
      highlightDeal: true,
    }),
    itineraryBuilder: createItineraryBuilder({
      layout: 'timeline',
      allowDragDrop: true,
      showDatePicker: true,
      showTravelerSelector: true,
      showBudgetTracker: true,
      showMap: false,
    }),
    voiceOrb: createVoiceOrb({
      size: 'large',
      position: 'bottom-center',
      showVisualizer: true,
      visualizerStyle: 'circular',
      visualizerBars: 16,
      showTranscript: true,
      showSuggestions: true,
      glowEffect: 'medium',
      pulseOnListening: true,
    }),
    bookingIsland: createBookingIsland({
      position: 'bottom-right',
      size: 'medium',
      showItemCount: true,
      showTotalPrice: true,
      expandable: true,
      pulseOnAdd: true,
    }),
    destinationCarousel: createDestinationCarousel({
      layout: 'horizontal',
      itemsPerView: 3,
      showNavigation: true,
      showPagination: false,
      autoplay: false,
      loop: true,
      cardStyle: 'image-overlay',
      showPrice: true,
    }),
  },

  // Layout Configurations
  layouts: {
    landing: layouts.landing,
    voiceAssisted: layouts.voiceAssisted,
    standardBrowse: layouts.standardBrowse,
  },

  // Multimodal Interactions
  interactions: {
    voiceCommands,
    gestures: {
      enabled: true,
      swipeToRemove: true,
      longPressForDetails: true,
      pullToRefresh: false,
      pinchToZoom: false,
    },
    haptics: {
      enabled: true,
      intensity: 'medium',
      patterns: {
        addToBooking: { duration: 100, intensity: 0.7 },
        removeFromBooking: { duration: 50, intensity: 0.5 },
        voiceActivation: { duration: 150, intensity: 0.8 },
        error: { duration: 200, intensity: 1.0 },
        success: { duration: 100, intensity: 0.6 },
      },
    },
    keyboardShortcuts: {
      '/': 'Focus search',
      'b': 'Open booking summary',
      'v': 'Activate voice',
      'f': 'Toggle filters',
      'ArrowLeft': 'Previous item',
      'ArrowRight': 'Next item',
      'Enter': 'Select item',
      'Escape': 'Close modal',
    },
  },

  // Accessibility
  accessibility: {
    level: 'AA',
    features: [
      'WCAG 2.1 Level AA compliant',
      'Keyboard navigation',
      'Screen reader optimized',
      'High contrast mode',
      'Focus indicators',
      'ARIA labels and landmarks',
      'Voice command accessibility',
      'Reduced motion support',
    ],
    keyboardShortcuts: {
      '/': 'Focus search',
      'b': 'Open booking summary',
      'v': 'Activate voice',
      'f': 'Toggle filters',
      '?': 'Show keyboard shortcuts',
    },
  },

  // Animations
  animations: {
    enabled: true,
    presets: TravelAnimationPresets,
  },

  // Custom Styles
  customStyles: {
    css: `
      /* Airbnb-inspired custom styles */
      .travel-theme {
        font-family: ${TravelDesignTokens.typography.fontFamily.primary};
        color: ${TravelDesignTokens.colors.neutral[900]};
        background-color: ${TravelDesignTokens.colors.neutral[50]};
      }

      .travel-theme button {
        transition: all ${TravelDesignTokens.animation.normal} ease;
      }

      .travel-theme button:hover {
        transform: translateY(-2px);
        box-shadow: ${TravelDesignTokens.shadows.hover};
      }

      .travel-theme .card:hover {
        transform: translateY(-4px);
        box-shadow: ${TravelDesignTokens.shadows.hover};
      }

      /* Smooth scrolling */
      .travel-theme {
        scroll-behavior: smooth;
      }

      /* Custom scrollbar */
      .travel-theme ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .travel-theme ::-webkit-scrollbar-track {
        background: ${TravelDesignTokens.colors.neutral[100]};
      }

      .travel-theme ::-webkit-scrollbar-thumb {
        background: ${TravelDesignTokens.colors.neutral[400]};
        border-radius: ${TravelDesignTokens.borderRadius.full};
      }

      .travel-theme ::-webkit-scrollbar-thumb:hover {
        background: ${TravelDesignTokens.colors.neutral[500]};
      }

      /* Focus styles */
      .travel-theme *:focus-visible {
        outline: 2px solid ${TravelDesignTokens.colors.primary[500]};
        outline-offset: 2px;
      }

      /* Selection styles */
      .travel-theme ::selection {
        background-color: ${TravelDesignTokens.colors.primary[100]};
        color: ${TravelDesignTokens.colors.primary[900]};
      }
    `,
    tailwindClasses: {
      container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
      section: 'py-12 md:py-16 lg:py-20',
      heading: 'text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900',
      subheading: 'text-xl md:text-2xl text-gray-600',
      button: 'px-6 py-3 bg-rausch-pink-500 text-white rounded-lg font-semibold hover:bg-rausch-pink-600 transition-all',
      card: 'bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow',
    },
  },
};

export default AmadeusTravelTheme;

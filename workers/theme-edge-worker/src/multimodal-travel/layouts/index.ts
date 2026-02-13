/**
 * Multimodal Travel Theme - Layouts
 * Pre-configured layout templates for different user flows
 */

import type { LandingLayout, VoiceAssistedLayout, StandardBrowseLayout } from '../types';
import { createVoiceOrb } from '../primitives/voice-orb';
import { TravelDesignTokens } from '../design-tokens';

/**
 * Landing Layout
 * Hero section with choice between voice booking or browsing
 */
export const landingLayout: LandingLayout = {
  type: 'landing',
  hero: {
    title: 'Your Next Adventure Awaits',
    subtitle: 'Book flights, hotels, and experiences with voice or browse our curated travel packages',
    backgroundImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
    searchBar: true,
    quickLinks: [
      { label: 'Flights', category: 'flights', icon: 'flight' },
      { label: 'Hotels', category: 'hotels', icon: 'hotel' },
      { label: 'Experiences', category: 'experiences', icon: 'explore' },
      { label: 'Packages', category: 'packages', icon: 'package' },
    ],
  },
  sections: [
    {
      id: 'booking-modes',
      title: 'How would you like to travel?',
      type: 'voice-booking',
      content: {
        modes: [
          {
            id: 'voice-booking',
            title: 'Voice Booking',
            description: 'Tell us where you want to go and let AI handle the rest',
            features: [
              'Natural conversation',
              'Hands-free booking',
              'Personalized recommendations',
              'Real-time price comparison',
            ],
          },
          {
            id: 'browse',
            title: 'Browse & Explore',
            description: 'Discover amazing destinations and deals at your own pace',
            features: [
              'Visual exploration',
              'Advanced filters',
              'Detailed comparisons',
              'Curated collections',
            ],
          },
        ],
      },
    },
    {
      id: 'featured-destinations',
      title: 'Popular Destinations',
      type: 'featured-destinations',
      content: {
        destinations: [
          { name: 'Bali, Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4', price: '$899' },
          { name: 'Paris, France', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34', price: '$1,299' },
          { name: 'Tokyo, Japan', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf', price: '$1,599' },
          { name: 'Santorini, Greece', image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e', price: '$1,099' },
        ],
      },
    },
    {
      id: 'popular-packages',
      title: 'Best Value Packages',
      type: 'popular-packages',
      content: {},
    },
  ],
};

/**
 * Voice-Assisted Layout
 * Split view with voice panel and visual results feed
 */
export const voiceAssistedLayout: VoiceAssistedLayout = {
  type: 'voice-assisted',
  voicePanel: {
    position: 'left',
    width: '380px',
    showTranscript: true,
    showBookingSummary: true,
    showSuggestions: true,
  },
  visualFeed: {
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 2,
    },
    itemsPerPage: 20,
    showFilters: true,
  },
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
  detailModal: {
    size: 'large',
    backdropBlur: true,
  },
};

/**
 * Standard Browse Layout
 * Traditional grid view with filters and search
 */
export const standardBrowseLayout: StandardBrowseLayout = {
  type: 'standard-browse',
  header: {
    showSearch: true,
    showFilters: true,
    showSort: true,
    showCategoryTabs: true,
  },
  sidebar: {
    position: 'left',
    width: '280px',
    collapsible: true,
    filters: [
      {
        type: 'price-range',
        label: 'Price Range',
        options: [
          { min: 0, max: 500, label: 'Under $500' },
          { min: 500, max: 1000, label: '$500 - $1,000' },
          { min: 1000, max: 2000, label: '$1,000 - $2,000' },
          { min: 2000, max: 999999, label: 'Over $2,000' },
        ],
      },
      {
        type: 'stops',
        label: 'Stops',
        options: [
          { value: 0, label: 'Direct' },
          { value: 1, label: '1 Stop' },
          { value: 2, label: '2+ Stops' },
        ],
      },
      {
        type: 'class',
        label: 'Travel Class',
        options: [
          { value: 'economy', label: 'Economy' },
          { value: 'premiumEconomy', label: 'Premium Economy' },
          { value: 'business', label: 'Business' },
          { value: 'first', label: 'First Class' },
        ],
      },
      {
        type: 'rating',
        label: 'Hotel Rating',
        options: [
          { value: 5, label: '5 Stars' },
          { value: 4, label: '4+ Stars' },
          { value: 3, label: '3+ Stars' },
        ],
      },
      {
        type: 'amenities',
        label: 'Amenities',
        options: [
          { value: 'wifi', label: 'Free WiFi' },
          { value: 'parking', label: 'Free Parking' },
          { value: 'pool', label: 'Pool' },
          { value: 'breakfast', label: 'Breakfast Included' },
          { value: 'gym', label: 'Gym' },
          { value: 'spa', label: 'Spa' },
        ],
      },
    ],
  },
  grid: {
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    },
    gap: TravelDesignTokens.spacing.lg,
    cardStyle: 'standard',
  },
  pagination: {
    type: 'infinite-scroll',
    itemsPerPage: 30,
  },
};

/**
 * Get layout by type
 */
export function getLayout(type: 'landing' | 'voice-assisted' | 'standard-browse') {
  switch (type) {
    case 'landing':
      return landingLayout;
    case 'voice-assisted':
      return voiceAssistedLayout;
    case 'standard-browse':
      return standardBrowseLayout;
    default:
      return landingLayout;
  }
}

/**
 * Layout registry
 */
export const layouts = {
  landing: landingLayout,
  voiceAssisted: voiceAssistedLayout,
  standardBrowse: standardBrowseLayout,
};

export type LayoutRegistry = typeof layouts;

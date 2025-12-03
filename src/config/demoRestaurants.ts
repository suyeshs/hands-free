export interface DemoRestaurant {
  region: string;
  url: string;
  name: { local: string; en: string };
  cuisine: string;
  currency: string;
  defaultLocale: string;
  countries: string[]; // ISO country codes that map to this restaurant
}

export const demoRestaurants: Record<string, DemoRestaurant> = {
  // South Asia (current demo - the only working one)
  'south-asia': {
    region: 'South Asia',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev',
    name: { local: 'द कूर्ग फ्लेवर्स कंपनी', en: 'The Coorg Flavours Company' },
    cuisine: 'Coorgi',
    currency: '₹',
    defaultLocale: 'hi',
    countries: ['IN', 'LK', 'NP', 'BD', 'PK']
  },

  // Japan (placeholder - uses south-asia demo for now)
  'japan': {
    region: 'Japan',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev', // Will be replaced with Japan demo
    name: { local: '東京ラーメン', en: 'Tokyo Ramen' },
    cuisine: 'Japanese Ramen',
    currency: '¥',
    defaultLocale: 'ja',
    countries: ['JP']
  },

  // Southeast Asia (placeholder - uses south-asia demo for now)
  'southeast-asia': {
    region: 'Southeast Asia',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev', // Will be replaced with Thai demo
    name: { local: 'ครัวไทย', en: 'Thai Kitchen' },
    cuisine: 'Thai',
    currency: '฿',
    defaultLocale: 'th',
    countries: ['TH', 'VN', 'ID', 'MY', 'PH', 'SG']
  },

  // Latin America (placeholder - uses south-asia demo for now)
  'latin-america': {
    region: 'Latin America',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev', // Will be replaced with Mexican demo
    name: { local: 'Taquería El Sol', en: 'El Sol Taqueria' },
    cuisine: 'Mexican',
    currency: '$',
    defaultLocale: 'es',
    countries: ['MX', 'AR', 'CO', 'CL', 'PE', 'BR']
  },

  // Europe (German) (placeholder - uses south-asia demo for now)
  'europe-de': {
    region: 'Central Europe',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev', // Will be replaced with German demo
    name: { local: 'Berliner Bratwurst Haus', en: 'Berlin Bratwurst House' },
    cuisine: 'German',
    currency: '€',
    defaultLocale: 'de',
    countries: ['DE', 'AT', 'CH']
  },

  // Europe (French) (placeholder - uses south-asia demo for now)
  'europe-fr': {
    region: 'Western Europe',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev', // Will be replaced with French demo
    name: { local: 'Bistro Parisien', en: 'Parisian Bistro' },
    cuisine: 'French',
    currency: '€',
    defaultLocale: 'fr',
    countries: ['FR', 'BE']
  },

  // Europe (Italian) (placeholder)
  'europe-it': {
    region: 'Southern Europe',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev',
    name: { local: 'Trattoria Bella', en: 'Bella Trattoria' },
    cuisine: 'Italian',
    currency: '€',
    defaultLocale: 'it',
    countries: ['IT']
  },

  // Europe (Dutch) (placeholder)
  'europe-nl': {
    region: 'Benelux',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev',
    name: { local: 'De Nederlandse Keuken', en: 'The Dutch Kitchen' },
    cuisine: 'Dutch',
    currency: '€',
    defaultLocale: 'nl',
    countries: ['NL']
  },

  // Europe (Polish) (placeholder)
  'europe-pl': {
    region: 'Eastern Europe',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev',
    name: { local: 'Polska Restauracja', en: 'Polish Restaurant' },
    cuisine: 'Polish',
    currency: 'zł',
    defaultLocale: 'pl',
    countries: ['PL']
  },

  // USA/UK (default)
  'north-america': {
    region: 'North America',
    url: 'https://stonepot-restaurant-client.suyesh.workers.dev', // Will be replaced with US demo
    name: { local: "Joe's Burger Joint", en: "Joe's Burger Joint" },
    cuisine: 'American',
    currency: '$',
    defaultLocale: 'en',
    countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE']
  }
};

// Map country code to region
export function getRegionForCountry(country: string): string {
  for (const [regionKey, restaurant] of Object.entries(demoRestaurants)) {
    if (restaurant.countries.includes(country)) {
      return regionKey;
    }
  }
  return 'north-america'; // Default
}

export function getDemoRestaurant(country: string): DemoRestaurant {
  const region = getRegionForCountry(country);
  return demoRestaurants[region];
}

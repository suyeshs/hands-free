/**
 * City to State/Country Mapping
 * Automatically fills state and country based on city name
 * Supports fuzzy matching and major cities worldwide
 */

export interface CityInfo {
  state: string;
  country: string;
}

// Comprehensive city database with fuzzy matching support
const CITY_DATABASE: Record<string, CityInfo> = {
  // India - Major Cities (A-Z)
  'agra': { state: 'Uttar Pradesh', country: 'India' },
  'ahmedabad': { state: 'Gujarat', country: 'India' },
  'ahmednagar': { state: 'Maharashtra', country: 'India' },
  'ajmer': { state: 'Rajasthan', country: 'India' },
  'aligarh': { state: 'Uttar Pradesh', country: 'India' },
  'allahabad': { state: 'Uttar Pradesh', country: 'India' },
  'prayagraj': { state: 'Uttar Pradesh', country: 'India' },
  'amravati': { state: 'Maharashtra', country: 'India' },
  'amritsar': { state: 'Punjab', country: 'India' },
  'aurangabad': { state: 'Maharashtra', country: 'India' },
  'bangalore': { state: 'Karnataka', country: 'India' },
  'bengaluru': { state: 'Karnataka', country: 'India' },
  'bengalooru': { state: 'Karnataka', country: 'India' },
  'baroda': { state: 'Gujarat', country: 'India' },
  'vadodara': { state: 'Gujarat', country: 'India' },
  'belgaum': { state: 'Karnataka', country: 'India' },
  'belagavi': { state: 'Karnataka', country: 'India' },
  'bhavnagar': { state: 'Gujarat', country: 'India' },
  'bhopal': { state: 'Madhya Pradesh', country: 'India' },
  'bhubaneswar': { state: 'Odisha', country: 'India' },
  'bikaner': { state: 'Rajasthan', country: 'India' },
  'bilaspur': { state: 'Chhattisgarh', country: 'India' },
  'bombay': { state: 'Maharashtra', country: 'India' },
  'calcutta': { state: 'West Bengal', country: 'India' },
  'calicut': { state: 'Kerala', country: 'India' },
  'kozhikode': { state: 'Kerala', country: 'India' },
  'chandigarh': { state: 'Chandigarh', country: 'India' },
  'chennai': { state: 'Tamil Nadu', country: 'India' },
  'madras': { state: 'Tamil Nadu', country: 'India' },
  'coimbatore': { state: 'Tamil Nadu', country: 'India' },
  'cuttack': { state: 'Odisha', country: 'India' },
  'dehradun': { state: 'Uttarakhand', country: 'India' },
  'delhi': { state: 'Delhi', country: 'India' },
  'new delhi': { state: 'Delhi', country: 'India' },
  'dhanbad': { state: 'Jharkhand', country: 'India' },
  'dharwad': { state: 'Karnataka', country: 'India' },
  'erode': { state: 'Tamil Nadu', country: 'India' },
  'faridabad': { state: 'Haryana', country: 'India' },
  'gandhinagar': { state: 'Gujarat', country: 'India' },
  'ghaziabad': { state: 'Uttar Pradesh', country: 'India' },
  'goa': { state: 'Goa', country: 'India' },
  'panaji': { state: 'Goa', country: 'India' },
  'gorakhpur': { state: 'Uttar Pradesh', country: 'India' },
  'gulbarga': { state: 'Karnataka', country: 'India' },
  'kalaburagi': { state: 'Karnataka', country: 'India' },
  'guntur': { state: 'Andhra Pradesh', country: 'India' },
  'gurgaon': { state: 'Haryana', country: 'India' },
  'gurugram': { state: 'Haryana', country: 'India' },
  'guwahati': { state: 'Assam', country: 'India' },
  'gwalior': { state: 'Madhya Pradesh', country: 'India' },
  'hubli': { state: 'Karnataka', country: 'India' },
  'hubballi': { state: 'Karnataka', country: 'India' },
  'hyderabad': { state: 'Telangana', country: 'India' },
  'indore': { state: 'Madhya Pradesh', country: 'India' },
  'jabalpur': { state: 'Madhya Pradesh', country: 'India' },
  'jaipur': { state: 'Rajasthan', country: 'India' },
  'jalandhar': { state: 'Punjab', country: 'India' },
  'jammu': { state: 'Jammu and Kashmir', country: 'India' },
  'jamnagar': { state: 'Gujarat', country: 'India' },
  'jamshedpur': { state: 'Jharkhand', country: 'India' },
  'jhansi': { state: 'Uttar Pradesh', country: 'India' },
  'jodhpur': { state: 'Rajasthan', country: 'India' },
  'kakinada': { state: 'Andhra Pradesh', country: 'India' },
  'kannur': { state: 'Kerala', country: 'India' },
  'kanpur': { state: 'Uttar Pradesh', country: 'India' },
  'kochi': { state: 'Kerala', country: 'India' },
  'cochin': { state: 'Kerala', country: 'India' },
  'kohima': { state: 'Nagaland', country: 'India' },
  'kolar': { state: 'Karnataka', country: 'India' },
  'kolhapur': { state: 'Maharashtra', country: 'India' },
  'kolkata': { state: 'West Bengal', country: 'India' },
  'kollam': { state: 'Kerala', country: 'India' },
  'kota': { state: 'Rajasthan', country: 'India' },
  'kottayam': { state: 'Kerala', country: 'India' },
  'lucknow': { state: 'Uttar Pradesh', country: 'India' },
  'ludhiana': { state: 'Punjab', country: 'India' },
  'madurai': { state: 'Tamil Nadu', country: 'India' },
  'mangalore': { state: 'Karnataka', country: 'India' },
  'mangaluru': { state: 'Karnataka', country: 'India' },
  'meerut': { state: 'Uttar Pradesh', country: 'India' },
  'moradabad': { state: 'Uttar Pradesh', country: 'India' },
  'mumbai': { state: 'Maharashtra', country: 'India' },
  'mysore': { state: 'Karnataka', country: 'India' },
  'mysuru': { state: 'Karnataka', country: 'India' },
  'nagpur': { state: 'Maharashtra', country: 'India' },
  'nanded': { state: 'Maharashtra', country: 'India' },
  'nashik': { state: 'Maharashtra', country: 'India' },
  'navi mumbai': { state: 'Maharashtra', country: 'India' },
  'nellore': { state: 'Andhra Pradesh', country: 'India' },
  'noida': { state: 'Uttar Pradesh', country: 'India' },
  'panipat': { state: 'Haryana', country: 'India' },
  'patna': { state: 'Bihar', country: 'India' },
  'pondicherry': { state: 'Puducherry', country: 'India' },
  'puducherry': { state: 'Puducherry', country: 'India' },
  'pune': { state: 'Maharashtra', country: 'India' },
  'raipur': { state: 'Chhattisgarh', country: 'India' },
  'rajahmundry': { state: 'Andhra Pradesh', country: 'India' },
  'rajkot': { state: 'Gujarat', country: 'India' },
  'ranchi': { state: 'Jharkhand', country: 'India' },
  'rourkela': { state: 'Odisha', country: 'India' },
  'salem': { state: 'Tamil Nadu', country: 'India' },
  'sangli': { state: 'Maharashtra', country: 'India' },
  'shimla': { state: 'Himachal Pradesh', country: 'India' },
  'siliguri': { state: 'West Bengal', country: 'India' },
  'solapur': { state: 'Maharashtra', country: 'India' },
  'srinagar': { state: 'Jammu and Kashmir', country: 'India' },
  'surat': { state: 'Gujarat', country: 'India' },
  'thane': { state: 'Maharashtra', country: 'India' },
  'thiruvananthapuram': { state: 'Kerala', country: 'India' },
  'trivandrum': { state: 'Kerala', country: 'India' },
  'thrissur': { state: 'Kerala', country: 'India' },
  'trichur': { state: 'Kerala', country: 'India' },
  'tirupati': { state: 'Andhra Pradesh', country: 'India' },
  'tirunelveli': { state: 'Tamil Nadu', country: 'India' },
  'tiruppur': { state: 'Tamil Nadu', country: 'India' },
  'udaipur': { state: 'Rajasthan', country: 'India' },
  'ujjain': { state: 'Madhya Pradesh', country: 'India' },
  'varanasi': { state: 'Uttar Pradesh', country: 'India' },
  'banaras': { state: 'Uttar Pradesh', country: 'India' },
  'vellore': { state: 'Tamil Nadu', country: 'India' },
  'vijayawada': { state: 'Andhra Pradesh', country: 'India' },
  'visakhapatnam': { state: 'Andhra Pradesh', country: 'India' },
  'vizag': { state: 'Andhra Pradesh', country: 'India' },
  'warangal': { state: 'Telangana', country: 'India' },

  // International Cities (Major)
  // Singapore
  'singapore': { state: 'Singapore', country: 'Singapore' },

  // United Arab Emirates
  'dubai': { state: 'Dubai', country: 'United Arab Emirates' },
  'abu dhabi': { state: 'Abu Dhabi', country: 'United Arab Emirates' },
  'sharjah': { state: 'Sharjah', country: 'United Arab Emirates' },

  // United States
  'new york': { state: 'New York', country: 'United States' },
  'los angeles': { state: 'California', country: 'United States' },
  'san francisco': { state: 'California', country: 'United States' },
  'chicago': { state: 'Illinois', country: 'United States' },
  'houston': { state: 'Texas', country: 'United States' },
  'miami': { state: 'Florida', country: 'United States' },
  'boston': { state: 'Massachusetts', country: 'United States' },
  'seattle': { state: 'Washington', country: 'United States' },

  // United Kingdom
  'london': { state: 'England', country: 'United Kingdom' },
  'manchester': { state: 'England', country: 'United Kingdom' },
  'birmingham': { state: 'England', country: 'United Kingdom' },
  'glasgow': { state: 'Scotland', country: 'United Kingdom' },

  // Australia
  'sydney': { state: 'New South Wales', country: 'Australia' },
  'melbourne': { state: 'Victoria', country: 'Australia' },
  'brisbane': { state: 'Queensland', country: 'Australia' },
  'perth': { state: 'Western Australia', country: 'Australia' },

  // Canada
  'toronto': { state: 'Ontario', country: 'Canada' },
  'vancouver': { state: 'British Columbia', country: 'Canada' },
  'montreal': { state: 'Quebec', country: 'Canada' },

  // Malaysia
  'kuala lumpur': { state: 'Federal Territory of Kuala Lumpur', country: 'Malaysia' },

  // Thailand
  'bangkok': { state: 'Bangkok', country: 'Thailand' },

  // Indonesia
  'jakarta': { state: 'Jakarta', country: 'Indonesia' },
  'bali': { state: 'Bali', country: 'Indonesia' },
};

/**
 * Lookup city information with fuzzy matching
 * Returns state and country if found, null otherwise
 */
export function lookupCityInfo(cityInput: string): CityInfo | null {
  if (!cityInput || typeof cityInput !== 'string') {
    return null;
  }

  // Normalize input: lowercase and trim
  const normalizedInput = cityInput.toLowerCase().trim();

  // Direct match
  if (CITY_DATABASE[normalizedInput]) {
    return CITY_DATABASE[normalizedInput];
  }

  // Fuzzy match: Check if input is part of a city name or vice versa
  // Example: "bang" matches "bangalore", "new york city" matches "new york"
  for (const [cityKey, cityInfo] of Object.entries(CITY_DATABASE)) {
    if (cityKey.includes(normalizedInput) || normalizedInput.includes(cityKey)) {
      return cityInfo;
    }
  }

  return null;
}

/**
 * Auto-fill state and country based on city
 * Returns updated address object with state and country populated
 */
export function autoFillFromCity(city: string, currentAddress: any): any {
  const cityInfo = lookupCityInfo(city);

  if (cityInfo) {
    return {
      ...currentAddress,
      city,
      state: cityInfo.state,
      // Optionally add country field if your address structure supports it
      // country: cityInfo.country,
    };
  }

  // If no match found, just update city and keep existing state
  return {
    ...currentAddress,
    city,
  };
}

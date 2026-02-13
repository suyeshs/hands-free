# Multimodal Travel Theme

A sophisticated, minimalist UI theme for travel booking applications with Airbnb-inspired design.

## 🎨 What This Theme Contains

**UI Components Only** - This theme is purely presentational:

- ✅ Design tokens (colors, typography, spacing)
- ✅ UI primitives (flight cards, hotel cards, package cards)
- ✅ Layouts (landing, voice-assisted, browse)
- ✅ Animation presets
- ✅ Type definitions for data structures
- ✅ Accessibility patterns

**NOT Included** - These belong in your main application:

- ❌ API clients (Amadeus, etc.)
- ❌ Business logic
- ❌ Data fetching
- ❌ State management
- ❌ Authentication

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│   Your Main Application                     │
│   /Users/.../stonepot-travel                │
│                                              │
│   ├── Amadeus API Client ⬅️ PUT HERE       │
│   ├── Business Logic                        │
│   ├── State Management                      │
│   ├── Authentication                        │
│   └── UI (uses theme below)                 │
│       └── import { AmadeusTravelTheme }     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Theme Worker (this repo)                  │
│   /Users/.../theme-edge-worker              │
│                                              │
│   ├── Design Tokens                         │
│   ├── UI Components                         │
│   ├── Layouts                               │
│   └── Type Definitions                      │
│       (NO API CALLS)                        │
└─────────────────────────────────────────────┘
```

## 🚀 Usage Example

### In Your Main Application

```typescript
// /Users/stonepot-tech/projects/stonepot/stonepot-travel

// 1. Import the theme
import {
  AmadeusTravelTheme,
  renderFlightCard,
  renderHotelCard,
  type Flight,
  type Hotel
} from '@stonepot/theme-edge-worker/multimodal-travel';

// 2. Create your own API client (Amadeus)
class AmadeusClient {
  constructor(private apiKey: string, private apiSecret: string) {}

  async searchFlights(params: FlightSearchParams): Promise<Flight[]> {
    const response = await fetch('https://api.amadeus.com/v2/shopping/flight-offers', {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      // ... your API logic here
    });

    const data = await response.json();
    return this.transformToThemeFormat(data);
  }

  private transformToThemeFormat(apiData: any): Flight[] {
    // Transform Amadeus API response to match theme's Flight type
    return apiData.map(offer => ({
      id: offer.id,
      segments: offer.itineraries[0].segments.map(seg => ({
        airline: { code: seg.carrierCode, name: seg.airline },
        // ... etc
      })),
      // ... match the Flight type from theme
    }));
  }
}

// 3. Use theme with your data
const amadeus = new AmadeusClient(API_KEY, API_SECRET);
const flights = await amadeus.searchFlights({ origin: 'JFK', destination: 'LAX' });

// 4. Render using theme components
flights.forEach(flight => {
  const html = renderFlightCard(flight, AmadeusTravelTheme.components.flightCard);
  // Display in your UI
});
```

## 📦 Amadeus API Integration

### Credentials
- **API Key**: `Hv4GZz3NMD8JWmsVTUIEPl9xOHA36AHa`
- **API Secret**: `RwpUtDWNM3w9vGc7`
- **Environment**: Test
- **Documentation**: [Amadeus for Developers](https://developers.amadeus.com/)

### Recommended Implementation Location

Place your Amadeus integration in:
```
/Users/stonepot-tech/projects/stonepot/stonepot-travel/
├── src/
│   ├── api/
│   │   ├── amadeus/
│   │   │   ├── client.ts           ⬅️ API client
│   │   │   ├── auth.ts             ⬅️ OAuth2 token management
│   │   │   ├── flights.ts          ⬅️ Flight search/booking
│   │   │   ├── hotels.ts           ⬅️ Hotel search/booking
│   │   │   ├── experiences.ts      ⬅️ Activities/experiences
│   │   │   └── transformers.ts     ⬅️ Transform API → Theme types
│   │   └── index.ts
│   └── components/
│       └── travel/
│           └── FlightList.tsx      ⬅️ Use theme components here
```

## 🎯 Key Endpoints

### Amadeus API Endpoints You'll Need:

1. **Flight Offers Search**
   - `POST /v2/shopping/flight-offers`
   - Search for flight offers

2. **Hotel Search**
   - `GET /v1/reference-data/locations/hotels/by-city`
   - `GET /v3/shopping/hotel-offers`

3. **Activities**
   - `GET /v1/shopping/activities`

4. **Booking**
   - `POST /v1/booking/flight-orders`
   - `POST /v1/booking/hotel-bookings`

## 🔄 Data Flow

```
User Action
    ↓
Your App (stonepot-travel)
    ↓
Amadeus API Client
    ↓
Amadeus API (external)
    ↓
Transform Response → Theme Types (Flight, Hotel, etc.)
    ↓
Theme Components (renderFlightCard, etc.)
    ↓
Rendered UI
```

## 📘 Type Safety

The theme provides TypeScript types for all data structures:

```typescript
import type {
  Flight,
  Hotel,
  Experience,
  Package,
  FlightSearchParams,
  HotelSearchParams,
} from '@stonepot/theme-edge-worker/multimodal-travel';
```

Your API client should transform responses to match these types.

## 🎨 Design Features

- **Airbnb-inspired**: Rausch Pink (#FF5A5F) primary color
- **Minimalist**: No emojis, clean typography, SVG icons
- **Accessible**: WCAG AA compliant
- **Responsive**: Mobile-first design
- **Multimodal**: Voice, touch, keyboard, gesture support

## 📚 Further Reading

- [Amadeus API Documentation](https://developers.amadeus.com/self-service)
- [Theme Component API](./types.ts)
- [Design Tokens](./design-tokens.ts)
- [Animation Presets](./animation-templates.ts)

---

**Remember**: This theme is UI-only. All API logic belongs in your main application at `/Users/stonepot-tech/projects/stonepot/stonepot-travel`

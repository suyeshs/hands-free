# Theme Edge Worker - System Overview

**Last Updated:** 2025-12-03

## Quick Reference

This document provides an overview of the theme-edge-worker system and its key modules.

---

## Architecture Overview

The theme-edge-worker is a Cloudflare Workers-based edge service that serves themes with multi-tier caching, real-time collaboration, AI-powered generation, and multimodal restaurant experiences.

### Key Components

```
theme-edge-worker/
├── src/
│   ├── index.ts                      # Main worker entry point
│   ├── types.ts                      # Core type definitions
│   ├── schema.ts                     # Zod validation schemas
│   ├── utils.ts                      # Utility functions
│   ├── durable-objects/              # Real-time collaboration
│   │   ├── ThemeSession.ts           # Theme collaboration sessions
│   │   ├── ThemeCollabSession.ts     # Multi-user collaboration
│   │   ├── ConversationSession.ts    # Voice conversation sessions
│   │   └── ActiveOrderSession.ts     # Restaurant ordering sessions
│   ├── ai/                           # AI-powered theme generation
│   │   ├── theme-generator.ts        # Grok-powered generation
│   │   ├── neumorphic-generator.ts   # Neumorphic component gen
│   │   └── prompt-templates.ts       # AI prompts
│   ├── figma/                        # Figma design import
│   │   ├── figma-client.ts           # Figma API client
│   │   ├── figma-extractor.ts        # Token extraction
│   │   └── figma-mapper.ts           # Theme mapping
│   ├── neumorphic/                   # Neumorphic design system
│   │   ├── types.ts                  # Component types
│   │   ├── primitives/               # UI primitives
│   │   └── design-tokens.ts          # Design tokens
│   ├── handsfree-tech/               # Handsfree Tech theme
│   │   ├── index.ts                  # Main exports
│   │   ├── design-tokens.ts          # Tech brand tokens
│   │   └── primitives/               # Tech components
│   ├── multimodal-travel/            # Travel booking theme
│   │   ├── index.ts                  # Main exports
│   │   ├── design-tokens.ts          # Travel brand tokens
│   │   └── primitives/               # Travel components
│   └── multimodal-restaurant/        # Restaurant ordering theme ⭐
│       ├── index.ts                  # Main exports
│       ├── types.ts                  # Type definitions
│       ├── schema.ts                 # Validation schemas
│       ├── design-tokens.ts          # Food-optimized tokens
│       ├── animation-templates.ts    # Framer Motion variants
│       ├── api-handlers.ts           # Edge API handlers
│       ├── layouts/                  # Layout configs
│       ├── primitives/               # Restaurant components
│       ├── presets/                  # Preset themes
│       ├── ANIMATION_GUIDE.md        # Animation reference
│       └── IMPLEMENTATION_REFERENCE.md  # Complete reference ⭐
└── wrangler.toml                     # Cloudflare Workers config
```

---

## Module Deep Dives

### 1. Multimodal Restaurant Theme ⭐

**Complete Documentation:** [src/multimodal-restaurant/IMPLEMENTATION_REFERENCE.md](src/multimodal-restaurant/IMPLEMENTATION_REFERENCE.md)

Voice-assisted and standard browsing for restaurant ordering.

**Key Features:**
- Voice-assisted ordering with audio visualization
- Standard browse mode (grid/magazine/tabbed layouts)
- Neumorphic design with soft shadows
- Food-optimized color palettes
- Dietary indicators (veg/non-veg/vegan)
- Tailwind CSS integration
- Framer Motion animations
- WCAG AA accessibility
- TypeScript + Zod validation

**Quick Start:**
```typescript
import { CoorgFoodCompanyTheme } from '@/multimodal-restaurant';
const theme = CoorgFoodCompanyTheme;
```

**API Endpoints:**
- `GET /api/multimodal-restaurant/themes` - List presets
- `GET /api/multimodal-restaurant/themes/:preset` - Get preset
- `POST /api/multimodal-restaurant/themes/validate` - Validate theme
- `GET /api/multimodal-restaurant/design-tokens` - Get tokens
- `GET /api/multimodal-restaurant/animations` - Get animations

---

### 2. Handsfree Tech Theme

Professional tech company theme with product focus.

**Key Features:**
- Modern tech aesthetics
- Product showcase components
- Code block styling
- Voice orb for product demos
- Blue/cyan color scheme

**Location:** [src/handsfree-tech/](src/handsfree-tech/)

---

### 3. Multimodal Travel Theme

Travel booking and itinerary management theme.

**Key Features:**
- Flight and hotel cards
- Booking island component
- Destination carousel
- Itinerary builder
- Travel-optimized colors

**Location:** [src/multimodal-travel/](src/multimodal-travel/)

---

### 4. AI Theme Generation

Grok-powered intelligent theme generation.

**Capabilities:**
- Natural language theme generation
- Design refinement based on feedback
- Accessibility auditing
- Style suggestions
- Component generation

**API Endpoints:**
- `POST /api/ai/generate` - Generate theme from prompt
- `POST /api/ai/refine` - Refine existing theme
- `POST /api/ai/audit` - Accessibility audit
- `POST /api/ai/suggest` - Style suggestions
- `POST /api/ai/component` - Generate component

**Location:** [src/ai/](src/ai/)

---

### 5. Figma Integration

Import design tokens from Figma files.

**Capabilities:**
- Token extraction (colors, typography, spacing)
- Auto-mapping to theme format
- Caching for performance
- Support for web and ShipTrack platforms

**API Endpoints:**
- `POST /api/figma/validate` - Validate Figma token
- `POST /api/figma/extract` - Extract design tokens
- `POST /api/figma/import` - Import and generate theme

**Location:** [src/figma-client.ts](src/figma-client.ts), [src/figma-extractor.ts](src/figma-extractor.ts), [src/figma-mapper.ts](src/figma-mapper.ts)

---

### 6. Neumorphic Design System

Component generation with soft UI aesthetics.

**Capabilities:**
- Single component generation
- Component library generation
- Screen layout generation
- Component refinement
- Code export (React, React Native, Tailwind)

**API Endpoints:**
- `POST /api/neumorphic/generate` - Generate component
- `POST /api/neumorphic/library` - Generate library
- `POST /api/neumorphic/layout` - Generate layout
- `POST /api/neumorphic/refine` - Refine component
- `POST /api/neumorphic/export` - Export to code
- `GET /api/neumorphic/primitives` - List primitives

**Location:** [src/neumorphic/](src/neumorphic/)

---

### 7. Real-Time Collaboration (Durable Objects)

WebSocket-based real-time collaboration for theme editing.

**Durable Objects:**
- `ThemeSession` - Basic theme collaboration
- `ThemeCollabSession` - Multi-user collaboration
- `ConversationSession` - Voice conversation sessions
- `ActiveOrderSession` - Restaurant ordering sessions

**WebSocket Endpoints:**
- `WS /session/:id` - Theme collaboration
- `WS /conversation/:id` - Voice conversation
- `WS /session/:id/display` - Display-only mode

**Location:** [src/durable-objects/](src/durable-objects/)

---

### 8. Voice Configuration API

Voice AI configuration for restaurant ordering.

**API Endpoints:**
- `GET /api/voice-config/:tenantId` - Get voice config
- `PUT /api/voice-config/:tenantId` - Update voice config
- `POST /api/voice-config/validate` - Validate config

**Location:** [src/voice-config-api.ts](src/voice-config-api.ts)

---

## Edge Serving & Caching

### Multi-Tier Cache Strategy

**L0 - Cloudflare CDN Cache**
- Fastest: ~10ms latency
- Global edge locations
- 24-hour TTL

**L1 - KV Namespace**
- Fast: ~20-50ms latency
- Eventually consistent
- 24-hour TTL

**L2 - Durable Objects**
- Consistent: ~50-100ms latency
- Coordinated state
- Real-time updates

**L3 - D1 Database**
- Source of truth: ~100-200ms latency
- Relational queries
- Permanent storage

### Cache Invalidation

```typescript
// Invalidate all caches for a tenant
DELETE /api/themes/:tenantId/cache

// Automatic invalidation on update
PUT /api/themes/:tenantId
```

---

## API Overview

### Theme Management

```
GET    /cdn/themes/{tenantId}.json     - Serve theme (cached)
GET    /api/themes/:tenantId           - Get theme
PUT    /api/themes/:tenantId           - Update theme
DELETE /api/themes/:tenantId/cache     - Purge cache
GET    /api/themes/templates           - List templates
```

### ShipTrack Theme

```
GET    /api/shiptrack/theme/:orgId           - Get theme
PUT    /api/shiptrack/theme/:orgId           - Update theme
DELETE /api/shiptrack/theme/:orgId/cache     - Purge cache
```

### Multimodal Restaurant

```
GET    /api/multimodal-restaurant/themes              - List presets
GET    /api/multimodal-restaurant/themes/:preset      - Get preset
POST   /api/multimodal-restaurant/themes/validate     - Validate
GET    /api/multimodal-restaurant/design-tokens       - Get tokens
GET    /api/multimodal-restaurant/animations          - Get animations
GET    /api/multimodal-restaurant/layouts/:type       - Get layout
```

### AI Generation

```
POST   /api/ai/generate        - Generate theme
POST   /api/ai/refine          - Refine theme
POST   /api/ai/audit           - Accessibility audit
POST   /api/ai/suggest         - Style suggestions
POST   /api/ai/component       - Generate component
POST   /api/ai/validate        - Validate API key
```

### Figma Integration

```
POST   /api/figma/validate     - Validate token
POST   /api/figma/extract      - Extract tokens
POST   /api/figma/import       - Import theme
```

### Neumorphic Components

```
POST   /api/neumorphic/generate     - Generate component
POST   /api/neumorphic/library      - Generate library
POST   /api/neumorphic/layout       - Generate layout
POST   /api/neumorphic/refine       - Refine component
POST   /api/neumorphic/export       - Export to code
GET    /api/neumorphic/primitives   - List primitives
POST   /api/neumorphic/primitive    - Get primitive
```

### Voice Configuration

```
GET    /api/voice-config/:tenantId       - Get config
PUT    /api/voice-config/:tenantId       - Update config
POST   /api/voice-config/validate        - Validate config
```

### Real-Time Collaboration

```
WS     /session/:id                      - Theme session
WS     /session/:id/display              - Display mode
WS     /conversation/:id                 - Conversation session
GET    /ui/conversation                  - Themed UI
```

---

## Environment Variables

Required for full functionality:

```bash
# Required
THEME_KV=<KV Namespace binding>
THEME_DB=<D1 Database binding>
THEME_DO=<Durable Object binding>
THEME_SESSION=<Durable Object binding>
CONVERSATION_SESSION=<Durable Object binding>
THEME_QUEUE=<Queue binding>

# Optional (AI features)
GROK_API_KEY=<xAI Grok API key>
WORKERS_AI=<Workers AI binding>

# Optional (Cloudflare Access)
CF_ACCESS_AUDIENCE=<Access audience>
CF_ACCESS_ISSUER=<Access issuer>

# Optional (CDN purging)
ZONE_ID=<Cloudflare Zone ID>
CACHE_PURGE_TOKEN=<API token>

# Optional (Theme signing)
SIGNING_KEY=<WebCrypto signing key>
```

---

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run locally
npx wrangler dev

# Run with bindings
npx wrangler dev --local

# Tail logs
npx wrangler tail
```

### Deployment

```bash
# Deploy to production
npx wrangler deploy

# Deploy to staging
npx wrangler deploy --env staging
```

### Testing

```bash
# Test restaurant theme
node test-restaurant-theme.ts

# Test handsfree theme
node test-handsfree-theme.ts

# Test travel theme
node test-travel-theme.ts
```

---

## Key Files

### Entry Point
- [src/index.ts](src/index.ts) - Main worker with all route handlers

### Core Types
- [src/types.ts](src/types.ts) - Core type definitions
- [src/schema.ts](src/schema.ts) - Zod validation schemas

### Utilities
- [src/utils.ts](src/utils.ts) - Helper functions

### Durable Objects
- [src/durable-objects/ThemeSession.ts](src/durable-objects/ThemeSession.ts)
- [src/durable-objects/ConversationSession.ts](src/durable-objects/ConversationSession.ts)
- [src/durable-objects/ActiveOrderSession.ts](src/durable-objects/ActiveOrderSession.ts)

---

## Theme Presets

### Restaurant Themes
- **Coorg Food Company** - South Indian cuisine
  - File: [src/multimodal-restaurant/presets/coorg-food-company.ts](src/multimodal-restaurant/presets/coorg-food-company.ts)
  - Colors: Warm orange (#f97316), rich brown
  - Features: Voice ordering, bilingual support

- **Generic Restaurant** - Universal template
  - File: [src/multimodal-restaurant/presets/generic-restaurant.ts](src/multimodal-restaurant/presets/generic-restaurant.ts)
  - Customizable base theme

### Tech Themes
- **Handsfree Tech** - Modern tech company
  - File: [src/handsfree-tech/presets/default.ts](src/handsfree-tech/presets/default.ts)
  - Colors: Blue/cyan tech palette
  - Features: Product showcase, code blocks

### Travel Themes
- **Amadeus Travel** - Travel booking platform
  - File: [src/multimodal-travel/presets/amadeus-travel.ts](src/multimodal-travel/presets/amadeus-travel.ts)
  - Colors: Sky blue, travel-optimized
  - Features: Flight/hotel cards, itinerary builder

---

## Performance Metrics

### Typical Latencies

| Cache Tier | Latency | Hit Rate |
|------------|---------|----------|
| CDN (L0)   | ~10ms   | ~95%     |
| KV (L1)    | ~30ms   | ~98%     |
| DO (L2)    | ~80ms   | ~99%     |
| D1 (L3)    | ~150ms  | 100%     |

### Caching Strategy

- **CDN**: 24 hours public cache
- **KV**: 24 hours with backfill
- **DO**: Real-time coordination
- **D1**: Source of truth

---

## Documentation Index

### Main Documentation
- **[Multimodal Restaurant Implementation Reference](src/multimodal-restaurant/IMPLEMENTATION_REFERENCE.md)** ⭐ - Complete reference for restaurant themes
- **[Animation Guide](src/multimodal-restaurant/ANIMATION_GUIDE.md)** - Framer Motion animation reference
- **[Handsfree Tech README](src/handsfree-tech/README.md)** - Tech theme documentation
- **[Multimodal Travel README](src/multimodal-travel/README.md)** - Travel theme documentation

### Additional Documentation
- **[All Themes Summary](ALL_THEMES_SUMMARY.md)** - Overview of all available themes
- **[Music Zajno Design Analysis](MUSIC_ZAJNO_DESIGN_ANALYSIS.md)** - Design inspiration
- **[Theme Test Summary](THEME_TEST_SUMMARY.md)** - Testing documentation

---

## Support & Resources

### Documentation
- Main docs: https://docs.stonepot.com
- API reference: https://api.stonepot.com/docs
- Examples: https://examples.stonepot.com

### GitHub
- Repository: https://github.com/stonepot-platform
- Issues: https://github.com/stonepot-platform/issues
- Discussions: https://github.com/stonepot-platform/discussions

### Contact
- Email: support@stonepot.com
- Slack: https://stonepot.slack.com
- Twitter: @stonepot_dev

---

## License

Copyright © 2025 Stonepot Platform. All rights reserved.

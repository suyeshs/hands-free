# Khao Piyo Branding Assets

## Logo Extraction Complete

### Logo File
**Path:** `/assets/logos/khao-piyo-logo-final.png`
- Format: PNG with transparent background
- Dimensions: 1348x1349px
- Size: 580KB
- Features: Complete circular design with rainbow-colored concentric circles
- Text in logo: "KHAO" (top), "MULTI CUISINE" (center), "PIYO" (bottom)

### Restaurant Name Text (Image)
**Path:** `/assets/logos/khao-piyo-text-transparent.png`
- Format: PNG with transparent background
- Dimensions: 1658x244px
- Size: 28KB
- Content: "KHAO PIYO" text with flared terminals
- Usage: Can be used as image when exact font matching is not needed

### Brand Text (Separate from Logo)
The restaurant name and tagline should be displayed separately:

**Restaurant Name:** `KHAO PIYO`
- Font Family: 'Bebas Neue' (exact match from PDF)
- Font Weight: 400 (Bebas Neue standard weight)
- Letter Spacing: 0.02em
- Style: All caps (inherent to Bebas Neue)
- Google Fonts: Available for free

**Tagline:** `THE MULTI CUISINE FAMILY RESTAURANT & BAR`
- Font Family: 'Bebas Neue' or Montserrat Bold
- Font Weight: 400 for Bebas Neue / 700 for Montserrat
- Style: All caps

### Font Matching
The PDF uses **Bebas Neue** for "KHAO PIYO" text - a bold, condensed, all-caps font.

**Exact Font:** Bebas Neue
- Free and available on Google Fonts
- Ultra-bold condensed sans-serif
- All caps only
- Perfect match for the logo text

**Web Font Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
```

**Fallbacks:** Impact, Oswald Heavy, Anton

### Color Palette (from logo)
- **Rainbow Rings:** Red, Orange, Yellow, Green, Blue, Purple
- **Background Circle:** Black (#000000)
- **Text in Logo:** White (#FFFFFF)
- **Primary Brand:** Orange (#FFA000)
- **Secondary:** Green (#4CAF50)

## Configuration Updates Needed

### 1. Theme Config JSON
File: `/scripts/khaopiyo-theme-config.json`

Update:
```json
{
  "branding": {
    "name": "KHAO PIYO",
    "tagline": "THE MULTI CUISINE FAMILY RESTAURANT & BAR",
    "logo": {
      "url": "/assets/logos/khao-piyo-logo-final.png",
      "alt": "Khao Piyo - Multi Cuisine Family Restaurant & Bar"
    },
    "typography": {
      "brandFont": {
        "family": "'Bebas Neue', Impact, 'Oswald', sans-serif",
        "weight": "400",
        "style": "normal",
        "letterSpacing": "0.02em",
        "textTransform": "uppercase"
      }
    }
  }
}
```

### 2. TypeScript Preset
File: `/src/grab-food/presets/khao-piyo-preset.ts`

The branding assets are documented in the file comments:
```typescript
meta: {
  name: 'KHAO PIYO',
  description: 'THE MULTI CUISINE FAMILY RESTAURANT & BAR - Multimodal ordering for 2000+ menu items',
  // ... rest of config
}

/**
 * Branding Assets (configured via khaopiyo-theme-config.json):
 * - Logo: /assets/logos/khao-piyo-logo-final.png (1348x1349px)
 * - Name Image: /assets/logos/khao-piyo-text-transparent.png (1658x244px)
 */
```

## Implementation Notes

1. **Logo Display:** Use the circular PNG logo (`khao-piyo-logo-final.png`) in headers, navigation, and branding areas
2. **Restaurant Name:** Use the text image (`khao-piyo-text-transparent.png`) instead of font-based text for exact brand consistency
3. **Tagline:** Display "THE MULTI CUISINE FAMILY RESTAURANT & BAR" separately using Bebas Neue or Montserrat Bold
4. **Responsive:** Both logo and text images should scale appropriately on different screen sizes
5. **Background:** Both images have transparent backgrounds and work on light or dark surfaces
6. **Configuration:** Branding is configured in `khaopiyo-theme-config.json` with `nameImage` property for the text image

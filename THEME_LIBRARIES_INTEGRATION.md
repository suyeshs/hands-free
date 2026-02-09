# Theme Libraries Integration

This document outlines the integration of open-source theme libraries into the HandsFree POS theme system.

## Integrated Libraries

### 1. **Chroma.js** (Color Manipulation)
**Purpose:** Color manipulation, palette generation, and accessibility checks

**Capabilities:**
- Generate complete color palettes from a single primary color
- Check WCAG contrast ratios for accessibility
- Lighten, darken, saturate, and desaturate colors
- Mix colors and create color scales
- Convert between color formats (hex, rgb, hsl, lab)
- Determine color temperature (warm/cool/neutral)

**Usage Example:**
```typescript
import { generateColorPalette, meetsWCAG_AA } from '@/services/themes/colorUtils';

// Generate a full palette from primary color
const palette = generateColorPalette('#ff8c00');
// Returns: { primary, accent, secondary, complementary, neutrals, status }

// Check accessibility
const isAccessible = meetsWCAG_AA('#1a1d23', '#ffffff');
// Returns: true (meets WCAG AA 4.5:1 ratio)
```

### 2. **node-vibrant** (Logo Color Extraction)
**Purpose:** Extract prominent colors from restaurant logos

**Capabilities:**
- Extract vibrant, muted, light, and dark color swatches
- Identify dominant colors by population
- Suggest theme categories based on color characteristics
- Support for URL and File inputs

**Usage Example:**
```typescript
import { extractColorsFromLogoUrl, suggestThemeCategory } from '@/services/themes/logoColorExtractor';

// Extract colors from logo
const colors = await extractColorsFromLogoUrl('https://example.com/logo.png');
// Returns: { primary, secondary, accent, background, text, palette }

// Suggest theme category
const category = await suggestThemeCategory('https://example.com/logo.png');
// Returns: 'modern' | 'dark' | 'bright' | 'colorful' | 'classic'
```

### 3. **Theme Generator** (AI-Powered)
**Purpose:** Automatically generate complete themes from brand colors

**Capabilities:**
- Generate themes from a primary color
- Generate themes from logo images
- Create theme variations (light, dark, high contrast)
- Generate KDS-optimized themes
- Export themes to JSON, CSS, SCSS formats

**Usage Example:**
```typescript
import { generateThemeFromColor, generateThemeFromLogo } from '@/services/themes/themeGenerator';

// Generate theme from color
const theme = generateThemeFromColor({
  name: 'My Brand Theme',
  primaryColor: '#ff8c00',
  category: 'modern',
});

// Generate theme from logo
const logoTheme = await generateThemeFromLogo({
  name: 'Restaurant Theme',
  logoUrl: 'https://example.com/logo.png',
});

// Export theme
import { exportTheme } from '@/services/themes/themeGenerator';
const css = exportTheme(theme, 'css');
const json = exportTheme(theme, 'json');
```

## Integration Points

### ThemeStore Methods

The `useThemeStore` has been enhanced with new methods:

```typescript
const {
  // Generate theme from primary color
  generateThemeFromColor,

  // Generate theme from logo
  generateThemeFromLogo,

  // Extract colors from logo file
  extractLogoColors,

  // Customize colors with live preview
  customizeThemeColors,
} = useThemeStore();
```

### UI Components

#### 1. ColorCustomizer Component
**Location:** `src/components/themes/ColorCustomizer.tsx`

**Features:**
- Upload logo to extract brand colors
- Customize primary, accent, background, and text colors
- Live preview of changes
- Accessibility contrast checker (WCAG AA)
- Generated color palette preview
- Export and reset options

**Usage:**
```tsx
import { ColorCustomizer } from '@/components/themes/ColorCustomizer';

<ColorCustomizer
  isOpen={showCustomizer}
  onClose={() => setShowCustomizer(false)}
/>
```

#### 2. ThemeCard Component
**Location:** `src/components/themes/ThemeCard.tsx`

**Features:**
- Visual theme preview
- Active indicator
- Category badge
- Hover effects with "Apply" button

#### 3. QuickThemeSwitcher Component
**Location:** `src/components/themes/QuickThemeSwitcher.tsx`

**Features:**
- Header dropdown for quick theme switching
- Shows recent/popular themes
- One-click theme activation
- Link to full appearance settings

#### 4. AppearancePage
**Location:** `src/pages/AppearancePage.tsx`

**Features:**
- Complete theme management
- Light/Dark/Auto mode selection
- Screen-specific customization (KDS, POS, Reports)
- Theme gallery with category filters
- Color customization button

## User Workflows

### Workflow 1: Generate Theme from Logo

```typescript
// In your component
const { generateThemeFromLogo, activateTheme } = useThemeStore();

// User uploads logo
const handleLogoUpload = async (file: File) => {
  try {
    // Generate theme from logo
    const theme = await generateThemeFromLogo(
      'My Restaurant Theme',
      URL.createObjectURL(file)
    );

    // Activate the generated theme
    await activateTheme(theme.id);
  } catch (error) {
    console.error('Failed to generate theme:', error);
  }
};
```

### Workflow 2: Customize Colors with Live Preview

```typescript
// In ColorCustomizer
const { customizeThemeColors } = useThemeStore();

// User adjusts color sliders
const handleColorChange = async (primaryColor: string) => {
  // Generate palette from primary color
  const palette = generateColorPalette(primaryColor);

  // Apply colors with live preview
  await customizeThemeColors({
    '--color-primary': primaryColor,
    '--color-accent': palette.accent.base,
    '--color-secondary': palette.secondary.base,
  });
};
```

### Workflow 3: Extract Logo Colors and Apply

```tsx
<ColorCustomizer>
  <input
    type="file"
    accept="image/*"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Extract colors from logo
      const colors = await extractLogoColors(file);

      // Apply extracted colors
      setPrimaryColor(colors.primary);
      setAccentColor(colors.accent);
      setBackgroundColor(colors.background);
    }}
  />
</ColorCustomizer>
```

## API Reference

### Color Utilities (`colorUtils.ts`)

| Function | Description | Return Type |
|----------|-------------|-------------|
| `generateColorPalette(color)` | Generate complete palette from primary color | `ColorPalette` |
| `generateForegroundColor(bg)` | Get contrasting foreground color | `string` |
| `getContrastRatio(c1, c2)` | Calculate WCAG contrast ratio | `number` |
| `meetsWCAG_AA(fg, bg)` | Check WCAG AA compliance (4.5:1) | `boolean` |
| `meetsWCAG_AAA(fg, bg)` | Check WCAG AAA compliance (7:1) | `boolean` |
| `ensureContrast(fg, bg, ratio)` | Adjust color to meet contrast ratio | `string` |
| `lighten(color, amount)` | Lighten color by amount (0-1) | `string` |
| `darken(color, amount)` | Darken color by amount (0-1) | `string` |
| `saturate(color, amount)` | Increase color saturation | `string` |
| `desaturate(color, amount)` | Decrease color saturation | `string` |
| `getColorName(color)` | Get readable color name | `string` |
| `isValidColor(color)` | Validate color string | `boolean` |

### Logo Color Extraction (`logoColorExtractor.ts`)

| Function | Description | Return Type |
|----------|-------------|-------------|
| `extractColorsFromImage(source)` | Extract colors from image | `Promise<ExtractedColors>` |
| `extractColorsFromLogoUrl(url)` | Extract from logo URL | `Promise<ExtractedColors>` |
| `extractColorsFromFile(file)` | Extract from uploaded file | `Promise<ExtractedColors>` |
| `suggestThemeCategory(source)` | Suggest theme category | `Promise<ThemeCategory>` |

### Theme Generation (`themeGenerator.ts`)

| Function | Description | Return Type |
|----------|-------------|-------------|
| `generateThemeFromColor(options)` | Generate theme from color | `ThemeConfiguration` |
| `generateThemeFromLogo(options)` | Generate theme from logo | `Promise<ThemeConfiguration>` |
| `generateThemeVariations(theme)` | Create light/dark/high-contrast variants | `ThemeVariations` |
| `generateKDSTheme(theme)` | Generate KDS-optimized theme | `ThemeConfiguration` |
| `exportTheme(theme, format)` | Export to JSON/CSS/SCSS | `string` |

## Performance Considerations

1. **Color Extraction:** Logo color extraction is async and may take 1-3 seconds
2. **Palette Generation:** Real-time, < 100ms
3. **Theme Application:** < 200ms with smooth CSS transitions
4. **Caching:** Generated themes are cached in SQLite for instant reuse

## Accessibility Features

1. **WCAG Compliance:** All generated themes meet WCAG AA standards (4.5:1 contrast)
2. **Contrast Checker:** Real-time contrast ratio display in ColorCustomizer
3. **Auto-Adjustment:** `ensureContrast()` automatically adjusts colors to meet ratios
4. **High Contrast Mode:** Generate high-contrast theme variations

## Next Steps

1. **Theme Marketplace:** Allow users to share and download community themes
2. **AI Suggestions:** Recommend themes based on business type and industry
3. **Mobile Export:** Use Style Dictionary to export themes for React Native apps
4. **Advanced Customization:** Per-component color overrides
5. **Seasonal Themes:** Auto-switch themes based on time/season

## Examples

See the following files for complete examples:

- **Color Customization:** `src/components/themes/ColorCustomizer.tsx`
- **Logo Extraction:** `src/services/themes/logoColorExtractor.ts`
- **Theme Generation:** `src/services/themes/themeGenerator.ts`
- **Appearance Page:** `src/pages/AppearancePage.tsx`

## Troubleshooting

### Issue: Color extraction fails
**Solution:** Ensure logo is a valid image format (PNG, JPG, SVG) and accessible via URL or File

### Issue: Generated colors don't meet accessibility
**Solution:** Use `ensureContrast()` to automatically adjust colors

### Issue: Theme not applying
**Solution:** Check that theme is activated via `activateTheme(themeId)`

## Credits

- **Chroma.js:** https://gka.github.io/chroma.js/
- **node-vibrant:** https://github.com/Vibrant-Colors/node-vibrant
- **Theme System Design:** HandsFree Team

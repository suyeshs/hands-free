-- Seed data for theme templates (marketplace)
-- Execute with: wrangler d1 execute facemash-themes --file=./seed.sql

-- Default/Modern Dark Theme
INSERT INTO theme_templates (name, description, category, theme_json, is_public, downloads, rating, author)
VALUES (
  'Modern Dark',
  'Sleek dark theme perfect for tech and digital products',
  'modern',
  '{
    "version": "2.0.0",
    "meta": {
      "name": "Modern Dark",
      "description": "Sleek dark theme",
      "author": "system",
      "createdAt": "2025-01-15T00:00:00Z",
      "updatedAt": "2025-01-15T00:00:00Z"
    },
    "global": {
      "colors": {
        "primary": { "500": "#0ea5e9", "600": "#0284c7", "700": "#0369a1" },
        "background": {
          "main": "#111827",
          "gradient": { "from": "#111827", "to": "#1f2937", "direction": "to-b" }
        }
      },
      "typography": {
        "fontFamily": { "sans": ["Inter", "system-ui", "sans-serif"] },
        "scale": { "base": "1rem", "lg": "1.125rem", "xl": "1.25rem" }
      },
      "spacing": { "scale": 8, "unit": "px" },
      "borderRadius": { "base": "0.5rem", "lg": "0.75rem" },
      "shadows": { "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }
    },
    "components": {
      "avatarGrid": {
        "layout": {
          "columns": { "mobile": 2, "tablet": 3, "desktop": 4, "largeDesktop": 5 },
          "gap": "1.5rem",
          "aspectRatio": "1 / 1"
        },
        "card": {},
        "header": {}
      }
    }
  }',
  1,
  1000,
  4.5,
  'system'
);

-- E-commerce Theme
INSERT INTO theme_templates (name, description, category, theme_json, is_public, downloads, rating, author)
VALUES (
  'E-commerce Clean',
  'Clean white theme optimized for online stores',
  'ecommerce',
  '{
    "version": "2.0.0",
    "meta": {
      "name": "E-commerce Clean",
      "description": "Clean theme for online stores",
      "author": "system",
      "createdAt": "2025-01-15T00:00:00Z",
      "updatedAt": "2025-01-15T00:00:00Z"
    },
    "global": {
      "colors": {
        "primary": { "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8" },
        "background": { "main": "#ffffff" }
      },
      "typography": {
        "fontFamily": { "sans": ["Inter", "system-ui", "sans-serif"] },
        "scale": { "base": "1rem", "lg": "1.125rem" }
      },
      "spacing": { "scale": 8, "unit": "px" },
      "borderRadius": { "base": "0.5rem" },
      "shadows": { "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }
    },
    "components": {
      "avatarGrid": {
        "layout": {
          "columns": { "mobile": 2, "tablet": 3, "desktop": 4, "largeDesktop": 5 },
          "gap": "1.5rem",
          "aspectRatio": "1 / 1"
        },
        "card": {},
        "header": {}
      }
    }
  }',
  1,
  850,
  4.7,
  'system'
);

-- Luxury Theme
INSERT INTO theme_templates (name, description, category, theme_json, is_public, downloads, rating, author)
VALUES (
  'Luxury Premium',
  'Premium theme with gold accents for high-end brands',
  'luxury',
  '{
    "version": "2.0.0",
    "meta": {
      "name": "Luxury Premium",
      "description": "Premium luxury theme",
      "author": "system",
      "createdAt": "2025-01-15T00:00:00Z",
      "updatedAt": "2025-01-15T00:00:00Z"
    },
    "global": {
      "colors": {
        "primary": { "500": "#d4af37", "600": "#c5a028", "700": "#b69118" },
        "background": { "main": "#0c0a09" }
      },
      "typography": {
        "fontFamily": { "sans": ["Playfair Display", "serif"] },
        "scale": { "base": "1rem", "lg": "1.125rem", "xl": "1.5rem" }
      },
      "spacing": { "scale": 8, "unit": "px" },
      "borderRadius": { "base": "0rem" },
      "shadows": { "md": "0 20px 25px -5px rgba(0, 0, 0, 0.3)" }
    },
    "components": {
      "avatarGrid": {
        "layout": {
          "columns": { "mobile": 1, "tablet": 2, "desktop": 3, "largeDesktop": 4 },
          "gap": "2rem",
          "aspectRatio": "3 / 4"
        },
        "card": {},
        "header": {}
      }
    }
  }',
  1,
  450,
  4.8,
  'system'
);


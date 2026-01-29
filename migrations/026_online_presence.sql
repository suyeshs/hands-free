-- Migration: Add online_presence_json column to restaurant_settings table
-- Stores theme configuration, subdomain, and other online presence settings as JSON

ALTER TABLE restaurant_settings ADD COLUMN online_presence_json TEXT DEFAULT '{"themePreset":"universal-restaurant","themeFamily":"multimodal-restaurant","subdomain":"","themeConfig":{"primaryColor":"#2563EB","secondaryColor":"#64748B","accentColor":"#3B82F6","backgroundColor":"#FFFFFF","textPrimaryColor":"#1F2937","textSecondaryColor":"#6B7280","backgroundType":"solid","cardBorderRadius":12,"cardShadow":"subtle","cardBorder":"none","cardOpacity":100,"cardHoverEffect":"lift","logoSize":"medium","logoPosition":"left","headingFont":"inter","bodyFont":"inter","fontScale":"normal"},"enabled":false}';

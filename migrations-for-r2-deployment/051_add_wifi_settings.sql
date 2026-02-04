-- Migration: Add WiFi SSID Settings for Network-Based Access Control
-- Purpose: Store allowed WiFi SSIDs for staff to access sensitive features (payroll, attendance, etc.)
-- Date: 2026-01-30

-- Add restaurant_wifi_ssid column to restaurant_settings table
-- Stores comma-separated list of allowed WiFi SSIDs (e.g., "RestaurantWiFi,RestaurantWiFi-5G")
ALTER TABLE restaurant_settings
ADD COLUMN restaurant_wifi_ssid TEXT DEFAULT NULL;

-- Add wifi_check_enabled flag to enable/disable WiFi-based access control
ALTER TABLE restaurant_settings
ADD COLUMN wifi_check_enabled INTEGER DEFAULT 0;

-- Add description comment
-- restaurant_wifi_ssid: Comma-separated list of allowed WiFi SSIDs (NULL = no restriction)
-- wifi_check_enabled: 1 = require WiFi for sensitive features, 0 = disabled (default)

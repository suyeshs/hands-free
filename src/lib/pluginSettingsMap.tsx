/**
 * Plugin Settings Mapping
 * Maps plugin IDs to their settings components and metadata
 * This allows dynamic rendering of settings based on installed plugins
 */

import { ComponentType } from 'react';
import {
  Smartphone,
  ChefHat,
  Package,
  Users,
  BarChart3,
  Building2,
  QrCode,
  Wifi,
  MessageCircle,
  Shield,
  Calendar,
  Upload,
  Utensils,
} from 'lucide-react';

// Import plugin settings components
import AggregatorSettings from '../pages-v2/AggregatorSettings';
import BarInventory from '../pages-v2/BarInventory';
import { InventoryDashboard } from '../pages-v2/InventoryDashboard';
import { QROrderingSettings } from '../pages-v2/QROrderingSettings';
import ChainManagementPage from '../pages-v2/ChainManagementPage';
import { WiFiAttendanceSettings } from '../components/admin/WiFiAttendanceSettings';
import { SubscriptionPlans } from '../components/subscriptions/SubscriptionPlans';
import { SubscriptionMenuManager } from '../components/subscriptions/SubscriptionMenuManager';
import { SubscriptionMenuImporter } from '../components/subscriptions/SubscriptionMenuImporter';

// Placeholder components for plugins without full implementations yet
const CustomerCRMSettings = () => (
  <div className="p-8">
    <h2 className="text-2xl font-bold text-foreground mb-4">Customer CRM</h2>
    <p className="text-muted-foreground">Customer relationship management and loyalty programs.</p>
    <div className="mt-8 p-6 bg-card rounded-lg border border">
      <p className="text-muted-foreground">Settings panel will be available in a future update.</p>
    </div>
  </div>
);

const AnalyticsSettings = () => (
  <div className="p-8">
    <h2 className="text-2xl font-bold text-foreground mb-4">Analytics & Reports</h2>
    <p className="text-muted-foreground">Business intelligence and advanced reporting.</p>
    <div className="mt-8 p-6 bg-card rounded-lg border border">
      <p className="text-muted-foreground">Settings panel will be available in a future update.</p>
    </div>
  </div>
);

const PeoplePayrollSettings = () => (
  <div className="p-8">
    <h2 className="text-2xl font-bold text-foreground mb-4">People & Payroll</h2>
    <p className="text-muted-foreground">Staff management, attendance, and payroll processing.</p>
    <div className="mt-8 p-6 bg-card rounded-lg border border">
      <p className="text-muted-foreground">
        This plugin enhances the existing People & Payroll section with additional features.
        Check the "People & Payroll" category for core settings.
      </p>
    </div>
  </div>
);

const WhatsAppBusinessSettings = () => (
  <div className="p-8">
    <h2 className="text-2xl font-bold text-foreground mb-4">WhatsApp Business</h2>
    <p className="text-muted-foreground">Connect WhatsApp Business and chat with customers directly from POS.</p>
    <div className="mt-8 p-6 bg-card rounded-lg border border">
      <p className="text-muted-foreground">Settings panel will be available in a future update.</p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>• WhatsApp messaging integration</li>
        <li>• AI-powered analytics via OpenClaw</li>
        <li>• Message templates and automation</li>
        <li>• Daily analytics reports</li>
      </ul>
    </div>
  </div>
);

const WiFiDeviceAuthSettings = () => (
  <div className="p-8">
    <h2 className="text-2xl font-bold text-foreground mb-4">WiFi Device Authentication</h2>
    <p className="text-muted-foreground">Zero-OTP device authentication with WiFi verification and biometrics.</p>
    <div className="mt-8 p-6 bg-card rounded-lg border border">
      <p className="text-muted-foreground">Settings panel will be available in a future update.</p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>• WiFi-verified device registration</li>
        <li>• Biometric authentication (Face ID/Touch ID)</li>
        <li>• Device management and token expiry</li>
        <li>• Manager bypass options</li>
      </ul>
    </div>
  </div>
);


export interface PluginSettingItem {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<any>;
  componentProps?: Record<string, any>;
  searchTerms: string[];
  category: string; // Which settings category it belongs to
}

/**
 * Map plugin IDs to their settings items
 */
export const PLUGIN_SETTINGS_MAP: Record<string, PluginSettingItem[]> = {
  // Aggregator Integration Plugin
  'aggregator-integration-india': [
    {
      id: 'aggregator-settings',
      label: 'Aggregator Integration',
      description: 'Swiggy/Zomato dashboard extraction and auto-accept',
      icon: Smartphone,
      component: AggregatorSettings,
      searchTerms: ['aggregator', 'swiggy', 'zomato', 'delivery', 'online', 'orders'],
      category: 'operations',
    },
  ],

  // Bar Management Plugin
  'bar-management-v2': [
    {
      id: 'bar-inventory',
      label: 'Bar Inventory',
      description: 'Manage bar stock, recipes, and closing reports',
      icon: ChefHat,
      component: BarInventory,
      searchTerms: ['bar', 'liquor', 'recipes', 'cocktails', 'closing', 'inventory'],
      category: 'inventory',
    },
  ],

  // Inventory Management Plugin
  'inventory-management': [
    {
      id: 'inventory-management',
      label: 'Stock Management',
      description: 'Track inventory, suppliers, and stock levels',
      icon: Package,
      component: InventoryDashboard,
      searchTerms: ['inventory', 'stock', 'suppliers', 'purchase', 'wastage'],
      category: 'inventory',
    },
  ],

  // QR Ordering Plugin
  'online-ordering-qr': [
    {
      id: 'qr-ordering',
      label: 'QR Code Ordering',
      description: 'Configure customer self-ordering via QR codes',
      icon: QrCode,
      component: QROrderingSettings,
      searchTerms: ['qr', 'code', 'ordering', 'self-service', 'customer', 'contactless'],
      category: 'operations',
    },
  ],

  // Multi-location Sync Plugin
  'multi-location-sync': [
    {
      id: 'multi-location',
      label: 'Multi Location Management',
      description: 'Manage multiple locations and franchises',
      icon: Building2,
      component: ChainManagementPage,
      searchTerms: ['chain', 'locations', 'franchise', 'multi-location', 'branches', 'central'],
      category: 'business',
    },
  ],

  // Customer CRM Plugin
  'customer-crm': [
    {
      id: 'customer-crm',
      label: 'Customer CRM',
      description: 'Advanced customer management and loyalty programs',
      icon: Users,
      component: CustomerCRMSettings,
      searchTerms: ['crm', 'customer', 'loyalty', 'rewards', 'points', 'marketing'],
      category: 'people',
    },
  ],

  // Analytics & Reports Plugin
  'analytics-reports': [
    {
      id: 'analytics-reports',
      label: 'Analytics & Reports',
      description: 'Advanced business intelligence and reporting',
      icon: BarChart3,
      component: AnalyticsSettings,
      searchTerms: ['analytics', 'reports', 'business', 'intelligence', 'insights', 'data'],
      category: 'system',
    },
  ],

  // People & Payroll Plugin (enhances existing section)
  'people-payroll': [
    {
      id: 'wifi-auto-attendance',
      label: 'WiFi & Auto-Attendance',
      description: 'WiFi access control and automatic attendance marking',
      icon: Wifi,
      component: WiFiAttendanceSettings,
      searchTerms: ['wifi', 'auto', 'attendance', 'automatic', 'network', 'ssid', 'device', 'clock-in'],
      category: 'people',
    },
    {
      id: 'people-payroll-enhanced',
      label: 'Enhanced Payroll',
      description: 'Advanced payroll features and integrations',
      icon: Users,
      component: PeoplePayrollSettings,
      searchTerms: ['payroll', 'salary', 'wages', 'attendance', 'leave', 'roster'],
      category: 'people',
    },
  ],

  // WhatsApp Business Plugin
  'whatsapp-business': [
    {
      id: 'whatsapp-settings',
      label: 'WhatsApp Business',
      description: 'Connect WhatsApp, chat with customers, AI analytics via OpenClaw',
      icon: MessageCircle,
      component: WhatsAppBusinessSettings,
      searchTerms: ['whatsapp', 'messaging', 'chat', 'openclaw', 'ai', 'customer', 'communication'],
      category: 'operations',
    },
  ],

  // WiFi Device Auth Plugin
  'wifi-device-auth': [
    {
      id: 'wifi-device-auth-settings',
      label: 'WiFi Device Authentication',
      description: 'Zero-OTP WiFi-verified device registration and biometric auth',
      icon: Shield,
      component: WiFiDeviceAuthSettings,
      searchTerms: ['wifi', 'auth', 'security', 'biometric', 'device', 'registration', 'zero-otp'],
      category: 'system',
    },
  ],

  // Subscription Meals Plugin
  // Provides complete subscription management: plans, menu import, and weekly menus
  'subscription-meals': [
    {
      id: 'subscription-settings',
      label: 'Subscription Plans',
      description: 'Manage subscription plans, pricing, and delivery schedules',
      icon: Calendar,
      component: SubscriptionPlans,
      searchTerms: ['subscription', 'meals', 'plans', 'weekly', 'delivery', 'menu'],
      category: 'operations',
    },
    {
      id: 'subscription-menu-import',
      label: 'Import Menu',
      description: 'Import 150+ menu items for subscription service in one click',
      icon: Upload,
      component: SubscriptionMenuImporter,
      searchTerms: ['subscription', 'import', 'menu', 'items', 'cuisine', 'categories'],
      category: 'operations',
    },
    {
      id: 'subscription-menu-manager',
      label: 'Weekly Menu Manager',
      description: 'Create and manage rotating weekly menus for subscriptions',
      icon: Utensils,
      component: SubscriptionMenuManager,
      searchTerms: ['subscription', 'weekly', 'menu', 'rotation', 'schedule', 'planning'],
      category: 'operations',
    },
  ],
};

/**
 * Get all settings items for installed and enabled plugins
 */
export function getPluginSettingsItems(
  installedPlugins: Array<{ manifest: { id: string }, enabled: boolean }>
): PluginSettingItem[] {
  const items: PluginSettingItem[] = [];

  for (const plugin of installedPlugins) {
    // Only include settings for enabled plugins
    if (!plugin.enabled) continue;

    const pluginSettings = PLUGIN_SETTINGS_MAP[plugin.manifest.id];
    if (pluginSettings) {
      items.push(...pluginSettings);
    }
  }

  return items;
}

/**
 * Get settings items for a specific category from installed plugins
 */
export function getPluginSettingsItemsByCategory(
  installedPlugins: Array<{ manifest: { id: string }, enabled: boolean }>,
  category: string
): PluginSettingItem[] {
  const allItems = getPluginSettingsItems(installedPlugins);
  return allItems.filter(item => item.category === category);
}

/**
 * Check if a specific plugin has settings
 */
export function pluginHasSettings(pluginId: string): boolean {
  return pluginId in PLUGIN_SETTINGS_MAP;
}

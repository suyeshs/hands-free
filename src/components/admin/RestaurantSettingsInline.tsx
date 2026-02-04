/**
 * Restaurant Settings Inline Component
 * Same as RestaurantSettings but without the modal wrapper - for use in full-page views
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantSettingsStore, RestaurantDetails } from '../../stores/restaurantSettingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { cn } from '../../lib/utils';
import { Sun, Moon, ChevronDown, ArrowLeft, Info, Eye, EyeOff, Upload, X } from 'lucide-react';
import {
  RestaurantType,
  getRestaurantTypeConfig,
  getSettingCriticality,
  SettingCriticality,
  RESTAURANT_TYPE_CONFIGS,
  getFeaturePreset,
} from '../../types/restaurantTypes';
import { BillData, generateBillHTML } from '../print/BillPrint';
import { Order, CartItem } from '../../types/pos';

// Badge components for criticality indicators
const CriticalityBadge = ({ level }: { level: SettingCriticality }) => {
  if (level === SettingCriticality.OPTIONAL || level === SettingCriticality.HIDDEN) {
    return null;
  }

  const config = {
    [SettingCriticality.CRITICAL]: {
      className: 'status-error',
      label: 'Required',
    },
    [SettingCriticality.RECOMMENDED]: {
      className: 'status-info',
      label: 'Recommended',
    },
  }[level];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${config.className}`}>
      {config.label}
    </span>
  );
};

const TabBadge = ({ level }: { level: SettingCriticality }) => {
  if (level === SettingCriticality.CRITICAL) {
    return <span className="ml-1 inline-flex w-2 h-2 bg-destructive rounded-full" />;
  }
  if (level === SettingCriticality.RECOMMENDED) {
    return <span className="ml-1 inline-flex w-2 h-2 bg-info rounded-full" />;
  }
  return null;
};

export function RestaurantSettingsInline() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { user: _user } = useAuthStore();
  const { tenant: _tenant } = useTenantStore();
  // Priority: Tenant Store (device activation) > Auth Store (user login)
  // const tenantId = tenant?.tenantId || user?.tenantId || '';

  const [activeTab, setActiveTab] = useState<'basics' | 'tax' | 'legal' | 'invoice' | 'print' | 'staff' | 'appearance'>('basics');
  const [formData, setFormData] = useState<RestaurantDetails>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [essentialExpanded, setEssentialExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Update form data when settings change (e.g., after cloud sync)
  useEffect(() => {
    console.log('[RestaurantSettingsInline] Settings changed, ownerName:', settings.ownerName);
    console.log('[RestaurantSettingsInline] 🏠 ADDRESS IN SETTINGS:', settings.address);
    console.log('[RestaurantSettingsInline] 📋 FULL SETTINGS:', settings);
    setFormData(settings);
  }, [settings]);

  // Debug: Log formData.address whenever it changes
  useEffect(() => {
    console.log('[RestaurantSettingsInline] 🔍 FORMDATA.ADDRESS CHANGED:', formData.address);
  }, [formData.address]);

  // Apply brightness level and border style to document
  useEffect(() => {
    const brightness = formData.posSettings?.brightness ?? 0;
    const borderStyle = formData.posSettings?.borderStyle ?? 'auto';

    // Set CSS variable for brightness
    document.documentElement.style.setProperty('--brightness-level', brightness.toString());

    // Set data attribute for brightness-based styling
    document.documentElement.setAttribute('data-brightness', brightness.toString());

    // Determine border style
    let effectiveBorderStyle = borderStyle;
    if (borderStyle === 'auto') {
      // Auto mode: sharp when dark (brightness >= 50), rounded when light
      effectiveBorderStyle = brightness >= 50 ? 'sharp' : 'rounded';
    }
    document.documentElement.setAttribute('data-border-style', effectiveBorderStyle);

    // Remove dark class - brightness system handles all color transitions
    // The data-brightness attribute controls adaptive colors smoothly from 0-100%
    document.documentElement.classList.remove('dark');
  }, [formData.posSettings?.brightness, formData.posSettings?.borderStyle]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      const [parent, child] = keys;
      return {
        ...prev,
        [parent]: {
          ...(prev[parent as keyof RestaurantDetails] as object),
          [child]: value,
        },
      };
    });
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const Toggle = ({ enabled, onChange, label, description }: {
    enabled: boolean;
    onChange: (val: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="settings-toggle-row">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className="settings-description">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-14 h-8 rounded-full transition-colors',
          enabled ? 'bg-accent' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-6 h-6 bg-card shadow-md rounded-full transition-transform',
            enabled ? 'translate-x-7' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  // Save locally only - does NOT sync to cloud
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Save locally only
      updateSettings(formData);
      console.log('[RestaurantSettings] Settings saved locally');
      setHasUnsavedChanges(false);
      setSaveSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const restaurantType = (formData.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;
  const typeConfig = getRestaurantTypeConfig(restaurantType);
  const Icon = typeConfig.icon;

  const handleTypeChange = (newType: RestaurantType) => {
    // Apply the feature preset for the selected type
    const featurePreset = getFeaturePreset(newType);

    // Ensure chainManagement is enabled for multi-location types
    if (newType === RestaurantType.MULTI_BRAND || newType === RestaurantType.LARGE_CHAIN) {
      featurePreset.chainManagement = true;
    }

    setFormData((prev) => ({
      ...prev,
      restaurantType: newType,
      features: featurePreset,
    }));

    setShowTypeDropdown(false);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);

    // Log the change for visibility
    const newConfig = getRestaurantTypeConfig(newType);
    console.log(`[RestaurantSettings] Restaurant type changed to: ${newConfig.label}`);
    console.log(`[RestaurantSettings] Features updated:`, featurePreset);
  };

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    setLogoUploadError(null);

    try {
      // Import ImageUploader's upload logic
      const { invoke } = await import('@tauri-apps/api/core');
      const { tempDir } = await import('@tauri-apps/api/path');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      // Convert File to ArrayBuffer, then to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Get temp directory and create temp file path
      const tempDirPath = await tempDir();
      const tempFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const fullPath = `${tempDirPath}${tempFilename}`;

      // Write the file data to temp directory
      await writeFile(fullPath, uint8Array);

      // Upload to Cloudflare Images
      const result = await invoke<{ success: boolean; cloudflare_id?: string; image_url?: string; error?: string }>('upload_image_to_cloudflare', {
        filePath: fullPath,
        filename: file.name,
      });

      if (!result.success || !result.image_url) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update logo URL in form data
      handleInputChange('logoUrl', result.image_url);
      console.log('[RestaurantSettings] Logo uploaded successfully:', result.image_url);
    } catch (error) {
      console.error('[RestaurantSettings] Logo upload failed:', error);
      setLogoUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle logo removal
  const handleLogoRemove = () => {
    handleInputChange('logoUrl', '');
  };

  // Generate sample bill data for preview
  const sampleBillData = useMemo((): BillData => {
    // Create sample cart items
    const sampleItems: CartItem[] = [
      {
        id: '1',
        menuItem: {
          id: '1',
          name: 'Paneer Butter Masala',
          price: 280,
          category: 'Main Course',
          available: true,
          tags: ['veg']
        },
        quantity: 2,
        subtotal: 560,
        modifiers: [{ id: 'm1', name: 'Extra Cheese', price: 30 }],
        specialInstructions: 'Less spicy',
      },
      {
        id: '2',
        menuItem: {
          id: '2',
          name: 'Chicken Biryani',
          price: 320,
          category: 'Main Course',
          available: true,
          tags: ['non-veg']
        },
        quantity: 1,
        subtotal: 320,
        modifiers: [],
        specialInstructions: '',
      },
      {
        id: '3',
        menuItem: {
          id: '3',
          name: 'Garlic Naan',
          price: 60,
          category: 'Breads',
          available: true,
          tags: ['veg']
        },
        quantity: 3,
        subtotal: 180,
        modifiers: [],
        specialInstructions: '',
      },
    ];

    const subtotal = sampleItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Calculate taxes based on current form data
    let cgst = 0;
    let sgst = 0;
    let serviceCharge = 0;

    if (formData.taxEnabled) {
      if (formData.taxIncludedInPrice) {
        // Reverse calculate tax from inclusive price
        const taxRate = formData.cgstRate + formData.sgstRate;
        const taxBase = subtotal / (1 + taxRate / 100);
        cgst = taxBase * (formData.cgstRate / 100);
        sgst = taxBase * (formData.sgstRate / 100);
      } else {
        // Add tax on top
        cgst = subtotal * (formData.cgstRate / 100);
        sgst = subtotal * (formData.sgstRate / 100);
      }
    }

    if (formData.serviceChargeEnabled) {
      serviceCharge = subtotal * (formData.serviceChargeRate / 100);
    }

    const totalBeforeRounding = subtotal + cgst + sgst + serviceCharge;
    const roundOff = Math.round(totalBeforeRounding) - totalBeforeRounding;
    const grandTotal = Math.round(totalBeforeRounding);
    const tax = cgst + sgst;

    const sampleOrder: Order = {
      id: 'SAMPLE-001',
      orderNumber: 'ORD-123',
      tableNumber: 5,
      orderType: 'dine-in',
      items: sampleItems,
      subtotal,
      tax,
      discount: 0,
      total: grandTotal,
      status: 'completed',
      createdAt: new Date().toISOString(),
      paymentMethod: 'cash',
    };

    return {
      order: sampleOrder,
      invoiceNumber: `${formData.invoicePrefix || 'INV'}-001`,
      restaurantSettings: formData,
      taxes: {
        cgst,
        sgst,
        serviceCharge,
        roundOff,
        grandTotal,
      },
      printedAt: new Date(),
      cashierName: 'Demo Staff',
    };
  }, [formData]);

  const essentialTabs = [
    { id: 'basics' as const, label: 'Restaurant Basics', icon: '🏪', section: 'essential' },
    { id: 'tax' as const, label: 'Tax Configuration', icon: '💰', section: 'essential' },
    { id: 'legal' as const, label: 'Legal Information', icon: '📋', section: 'essential' },
  ];

  const advancedTabs = [
    { id: 'invoice' as const, label: 'Invoice & Billing', icon: '🧾', section: 'advanced' },
    { id: 'print' as const, label: 'Printing', icon: '🖨️', section: 'advanced' },
    { id: 'staff' as const, label: 'Staff & Access', icon: '👥', section: 'advanced' },
    { id: 'appearance' as const, label: 'Appearance', icon: '🎨', section: 'advanced' },
  ];

  // Load saved expansion state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('settings-sections-expanded');
    if (savedState) {
      try {
        const { essential, advanced } = JSON.parse(savedState);
        setEssentialExpanded(essential ?? true);
        setAdvancedExpanded(advanced ?? false);
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Save expansion state on change
  useEffect(() => {
    localStorage.setItem('settings-sections-expanded', JSON.stringify({
      essential: essentialExpanded,
      advanced: advancedExpanded,
    }));
  }, [essentialExpanded, advancedExpanded]);

  // Filter tabs based on restaurant type
  const visibleEssentialTabs = essentialTabs.filter(tab => {
    const tabCriticality = getSettingCriticality(restaurantType, 'tabs', tab.id);
    return tabCriticality !== SettingCriticality.HIDDEN;
  });

  const visibleAdvancedTabs = advancedTabs.filter(tab => {
    const tabCriticality = getSettingCriticality(restaurantType, 'tabs', tab.id);
    return tabCriticality !== SettingCriticality.HIDDEN;
  });

  return (
    <>
    <div className="flex h-full bg-background">
      {/* Main Settings Panel */}
      <div className="flex flex-col h-full w-full">

      {/* Single Unified Header */}
      <div className="bg-card border-b border-border flex-shrink-0">
        {/* Top Row - Back Button and Actions */}
        <div className="px-6 py-3 flex items-center justify-between border-b border">
          <button
            onClick={() => navigate('/hub')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </button>

          <div className="flex items-center gap-3">
            {/* Status Pills */}
            {saveSuccess && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success text-xs font-medium border border-success/30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </div>
            )}
            {hasUnsavedChanges && !saveSuccess && (
              <span className="px-3 py-1.5 bg-warning/10 text-warning text-xs font-medium border border-warning/30">
                Unsaved changes
              </span>
            )}

            {/* Preview Toggle */}
            <button
              onClick={() => setShowBillPreview(!showBillPreview)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2",
                showBillPreview
                  ? "bg-accent text-white hover:bg-accent/90"
                  : "bg-surface-2 text-foreground hover:bg-surface-3 border border"
              )}
              title="Toggle bill preview"
            >
              {showBillPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              Preview
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-5 py-2 text-sm bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Save settings"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>

        {/* Restaurant Type Selector - Inline */}
        <div className="px-6 py-4 bg-surface-2/50">
          <div className="flex items-center gap-4 max-w-4xl">
            <div className="flex items-center gap-3 flex-1">
              <Icon className="w-7 h-7 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{typeConfig.label}</div>
                <div className="text-xs text-muted-foreground truncate">{typeConfig.description}</div>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent hover:text-accent/80 border border-accent transition-colors whitespace-nowrap bg-background"
              >
                Change Type
                <ChevronDown size={16} />
              </button>
              {showTypeDropdown && (
                <div className="neo-raised-lg absolute right-0 top-full mt-2 w-80 border-2 border-accent/30 shadow-xl z-50 max-h-96 overflow-y-auto">
                  <div className="p-2 bg-accent/10 border-b border-accent/20">
                    <p className="text-xs font-medium text-foreground">Select Restaurant Type</p>
                  </div>
                  {Object.values(RESTAURANT_TYPE_CONFIGS).map((config) => {
                    const TypeIcon = config.icon;
                    return (
                      <button
                        key={config.type}
                        onClick={() => {
                          handleTypeChange(config.type);
                          setShowTypeDropdown(false);
                        }}
                        className={cn(
                          'w-full text-left p-3 hover:bg-surface-2 border-b border transition-colors last:border-b-0',
                          config.type === restaurantType && 'bg-accent/15 border-accent/30'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <TypeIcon className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">{config.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{config.description}</div>
                          </div>
                          {config.type === restaurantType && (
                            <div className="text-accent text-xs font-bold">✓</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-1 px-6 overflow-x-auto scrollbar-visible">
          {/* Essential Tabs */}
          {visibleEssentialTabs.map((tab) => {
            const tabCriticality = getSettingCriticality(restaurantType, 'tabs', tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'settings-tab',
                  activeTab === tab.id && 'active'
                )}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                <TabBadge level={tabCriticality} />
              </button>
            );
          })}

          {/* Divider */}
          {visibleAdvancedTabs.length > 0 && (
            <div className="h-8 w-px bg-border mx-2" />
          )}

          {/* Advanced Tabs */}
          {visibleAdvancedTabs.map((tab) => {
            const tabCriticality = getSettingCriticality(restaurantType, 'tabs', tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'settings-tab',
                  activeTab === tab.id && 'active'
                )}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                <TabBadge level={tabCriticality} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-background">
        {/* Restaurant Basics Tab */}
        {activeTab === 'basics' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-5 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Receipt printing with your business details, Google Maps integration for delivery, customer communication via phone/email, and legal compliance for business registration.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  These details appear on every receipt and are required for legal compliance. Complete this before accepting any orders.
                </p>
              </div>
            </div>

            <div className="neo-raised p-6 transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Restaurant Details</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Restaurant Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter restaurant name"
                  />
                </div>
              </div>
            </div>

            {/* Online Features Section */}
            <div className="settings-section p-0 transition-neo">
              <div className="p-6 border-b border">
                <h4 className="text-base font-semibold text-foreground">Online Features</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Master toggle for all online features including cloud sync, online ordering, and customer-facing website.
                </p>
              </div>
              <div className="space-y-0">
                <Toggle
                  enabled={formData.posSettings?.activateOnline ?? false}
                  onChange={(val) => handleInputChange('posSettings.activateOnline', val)}
                  label="Activate Online Features"
                  description="Enable cloud sync, online ordering, and customer website (requires internet connection)"
                />
              </div>
              {formData.posSettings?.activateOnline && (
                <div className="m-4 p-3 status-success">
                  <p className="text-sm font-semibold mb-1">✓ Online Features Active</p>
                  <p className="text-xs">
                    Cloud sync enabled. Your menu, orders, and settings will sync to the cloud. Visit Settings → Operations → Online Presence to configure your customer website.
                  </p>
                </div>
              )}
              {!formData.posSettings?.activateOnline && (
                <div className="m-4 p-3 status-info">
                  <p className="text-sm font-semibold mb-1">Offline Mode</p>
                  <p className="text-xs">
                    Your POS works fully offline. Enable this to activate cloud sync, online ordering, and your customer-facing website.
                  </p>
                </div>
              )}
            </div>

            {/* Logo Upload Section */}
            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Restaurant Logo</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Upload your restaurant logo. This will appear in the header across all pages and on printed receipts (when enabled).
              </p>

              <div className="space-y-4">
                {formData.logoUrl ? (
                  /* Logo Preview */
                  <div className="neo-raised-lg p-4 flex items-center gap-4 border border-accent/20">
                    <img
                      src={formData.logoUrl}
                      alt="Restaurant Logo"
                      className="w-20 h-20 object-contain bg-surface-2 p-2"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Current Logo</p>
                      <p className="text-xs text-muted-foreground mt-1">This logo is active and will be displayed</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition-colors flex items-center gap-2"
                      title="Remove logo"
                    >
                      <X size={16} />
                      Remove
                    </button>
                  </div>
                ) : (
                  /* Upload Button */
                  <label className="card-interactive p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted hover:border-accent cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                    <div className="w-12 h-12 bg-accent/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-accent" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">
                        {uploadingLogo ? 'Uploading...' : 'Click to upload logo'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, or SVG (max 5MB)
                      </p>
                    </div>
                  </label>
                )}

                {logoUploadError && (
                  <div className="neo-raised bg-destructive/10 border border-destructive/30 p-3">
                    <p className="text-sm text-destructive">{logoUploadError}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="neo-raised p-6 transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Address & Contact</h4>
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.address.line1}
                  onChange={(e) => handleInputChange('address.line1', e.target.value)}
                  className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Address Line 1"
                />
                <input
                  type="text"
                  value={formData.address.line2 || ''}
                  onChange={(e) => handleInputChange('address.line2', e.target.value)}
                  className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Address Line 2"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.pincode}
                    onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                    className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Pincode"
                    maxLength={6}
                  />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full neo-inset px-4 py-3 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Phone"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legal Tab */}
        {activeTab === 'legal' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  GST-compliant invoice generation (GSTIN on receipt), food license verification (FSSAI display requirement), tax filing with PAN number, and company registration proof (CIN for incorporated businesses).
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Required for legal operations in India. GSTIN and FSSAI license numbers must be printed on receipts. Complete within 7 days of starting operations.
                </p>
              </div>
            </div>

            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Tax & License Numbers</h4>
              <div className="space-y-4">
                {getSettingCriticality(restaurantType, 'fields', 'gstNumber') !== SettingCriticality.HIDDEN && (
                  <div>
                    <label className="settings-label flex items-center gap-2">
                      GSTIN (GST Number)
                      {getSettingCriticality(restaurantType, 'fields', 'gstNumber') === SettingCriticality.CRITICAL && ' *'}
                      <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'gstNumber')} />
                    </label>
                    <input
                      type="text"
                      value={formData.gstNumber || ''}
                      onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                      className="settings-input"
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                    />
                  </div>
                )}

                {getSettingCriticality(restaurantType, 'fields', 'fssaiNumber') !== SettingCriticality.HIDDEN && (
                  <div>
                    <label className="settings-label flex items-center gap-2">
                      FSSAI License Number
                      {getSettingCriticality(restaurantType, 'fields', 'fssaiNumber') === SettingCriticality.CRITICAL && ' *'}
                      <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'fssaiNumber')} />
                    </label>
                    <input
                      type="text"
                      value={formData.fssaiNumber || ''}
                      onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
                      className="settings-input"
                      placeholder="12345678901234"
                      maxLength={14}
                    />
                  </div>
                )}

                {getSettingCriticality(restaurantType, 'fields', 'panNumber') !== SettingCriticality.HIDDEN && (
                  <div>
                    <label className="settings-label flex items-center gap-2">
                      PAN Number
                      {getSettingCriticality(restaurantType, 'fields', 'panNumber') === SettingCriticality.CRITICAL && ' *'}
                      <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'panNumber')} />
                    </label>
                    <input
                      type="text"
                      value={formData.panNumber || ''}
                      onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                      className="settings-input"
                      placeholder="AAAAA0000A"
                      maxLength={10}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Tab */}
        {activeTab === 'invoice' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Branded invoices with custom prefix (e.g., "REST-001"), professional terms & conditions on receipts, custom thank-you messages, and sequential invoice tracking.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Customize your invoice branding and add legal terms. Invoice prefix helps organize your billing records (e.g., use 'DL' for Delhi location).
                </p>
              </div>
            </div>

            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Invoice Configuration</h4>
              <div className="space-y-4">
                <div>
                  <label className="settings-label">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || 'INV'}
                    onChange={(e) => handleInputChange('invoicePrefix', e.target.value.toUpperCase())}
                    className="settings-input"
                    placeholder="INV"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="settings-label">Invoice Terms</label>
                  <textarea
                    value={formData.invoiceTerms || ''}
                    onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                    className="settings-textarea"
                    rows={3}
                    placeholder="Terms and conditions"
                  />
                </div>
                <div>
                  <label className="settings-label">Footer Note</label>
                  <textarea
                    value={formData.footerNote || ''}
                    onChange={(e) => handleInputChange('footerNote', e.target.value)}
                    className="settings-textarea"
                    rows={2}
                    placeholder="Thank you for dining with us!"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tax Tab */}
        {activeTab === 'tax' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Automatic GST calculation on bills, service charge application, tax-inclusive or tax-exclusive pricing, and compliance with Indian tax regulations.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Choose 'Tax Enabled' if you're GST registered. Use 'Tax Inclusive Pricing' if your menu prices already include GST. Service charge is optional and typically 5-10%.
                </p>
              </div>
            </div>

            {/* Tax Enable/Disable Toggle */}
            <div className="settings-section p-0">
              <div className="p-6 border-b border">
                <h4 className="text-base font-semibold text-foreground mb-4">Tax Settings</h4>
              </div>
              <div className="p-0">
                <Toggle
                  enabled={formData.taxEnabled ?? true}
                  onChange={(val) => handleInputChange('taxEnabled', val)}
                  label="Tax Enabled"
                  description="When disabled, menu price = billing price (no GST applied)"
                />
              </div>
              {!formData.taxEnabled && (
                <div className="m-4 p-3 status-pending">
                  <p className="text-sm">
                    Tax is disabled. Menu prices will be billed as-is without any GST calculation.
                  </p>
                </div>
              )}
            </div>

            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Tax Rates</h4>
              <div className={cn("space-y-4", !formData.taxEnabled && "opacity-50 pointer-events-none")}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="settings-label">CGST Rate (%)</label>
                    <input
                      type="number"
                      value={formData.cgstRate}
                      onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value))}
                      className="settings-input"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="settings-label">SGST Rate (%)</label>
                    <input
                      type="number"
                      value={formData.sgstRate}
                      onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value))}
                      className="settings-input"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                </div>

                {getSettingCriticality(restaurantType, 'fields', 'serviceCharge') !== SettingCriticality.HIDDEN && (
                  <div>
                    <label className="settings-label flex items-center gap-2">
                      Service Charge (%)
                      <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'serviceCharge')} />
                    </label>
                    <input
                      type="number"
                      value={formData.serviceChargeRate}
                      onChange={(e) => handleInputChange('serviceChargeRate', parseFloat(e.target.value))}
                      className="settings-input"
                      step="0.5"
                      min="0"
                      max="25"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="settings-section p-0">
              <div className="p-6 border-b border">
                <h4 className="text-base font-semibold text-foreground">Billing Options</h4>
              </div>
              <div className="space-y-0">
                {getSettingCriticality(restaurantType, 'fields', 'serviceCharge') !== SettingCriticality.HIDDEN && (
                  <Toggle
                    enabled={formData.serviceChargeEnabled}
                    onChange={(val) => handleInputChange('serviceChargeEnabled', val)}
                    label="Enable Service Charge"
                    description="Add service charge to all bills"
                  />
                )}
                <div className={cn(!formData.taxEnabled && "opacity-50 pointer-events-none")}>
                  <Toggle
                    enabled={formData.taxIncludedInPrice}
                    onChange={(val) => handleInputChange('taxIncludedInPrice', val)}
                    label="Tax Inclusive Pricing"
                    description="Menu prices already include GST"
                  />
                </div>
                <Toggle
                  enabled={formData.roundOffEnabled}
                  onChange={(val) => handleInputChange('roundOffEnabled', val)}
                  label="Round Off Total"
                  description="Round bill total to nearest rupee"
                />
              </div>
            </div>
          </div>
        )}

        {/* Print Tab */}
        {activeTab === 'print' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Receipt printing on thermal printers (58mm or 80mm), logo branding on receipts, QR code for digital payments (UPI/Paytm), and itemized tax display for transparency.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Paper width must match your thermal printer model. Enable 'Print Logo' for branded receipts. QR codes allow customers to save payment details.
                </p>
              </div>
            </div>

            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Paper Settings</h4>
              <div>
                <label className="settings-label">Paper Width</label>
                <select
                  value={formData.paperWidth}
                  onChange={(e) => handleInputChange('paperWidth', e.target.value)}
                  className="settings-select"
                >
                  <option value="58mm">58mm (2 inch)</option>
                  <option value="80mm">80mm (3 inch)</option>
                </select>
              </div>
            </div>

            <div className="settings-section p-0">
              <div className="p-6 border-b border">
                <h4 className="text-base font-semibold text-foreground">Receipt Options</h4>
              </div>
              <div className="space-y-0">
                {getSettingCriticality(restaurantType, 'fields', 'printLogo') !== SettingCriticality.HIDDEN && (
                  <div className="settings-toggle-row">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Print Logo</h3>
                        <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'printLogo')} />
                      </div>
                      <p className="settings-description">Show restaurant logo on receipts</p>
                    </div>
                    <button
                      onClick={() => handleInputChange('printLogo', !formData.printLogo)}
                      className={cn(
                        'relative w-14 h-8 rounded-full transition-colors',
                        formData.printLogo ? 'bg-accent' : 'bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-1 w-6 h-6 bg-card shadow-md rounded-full transition-transform',
                          formData.printLogo ? 'translate-x-7' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                )}

                {getSettingCriticality(restaurantType, 'fields', 'qrCode') !== SettingCriticality.HIDDEN && (
                  <div className="settings-toggle-row">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Print QR Code</h3>
                        <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'qrCode')} />
                      </div>
                      <p className="settings-description">Show payment QR code on receipts</p>
                    </div>
                    <button
                      onClick={() => handleInputChange('printQRCode', !formData.printQRCode)}
                      className={cn(
                        'relative w-14 h-8 rounded-full transition-colors',
                        formData.printQRCode ? 'bg-accent' : 'bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-1 w-6 h-6 bg-card shadow-md rounded-full transition-transform',
                          formData.printQRCode ? 'translate-x-7' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                )}

                <Toggle
                  enabled={formData.showItemwiseTax}
                  onChange={(val) => handleInputChange('showItemwiseTax', val)}
                  label="Show Itemwise Tax"
                  description="Display tax breakdown per item"
                />
              </div>
            </div>
          </div>
        )}

        {/* Staff & Access Tab */}
        {activeTab === 'staff' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Secure POS access with staff PINs (prevent unauthorized billing), table assignment filtering (waiters see only their tables), auto-logout for security (ideal for shared devices), and audit trail of who processed each order.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Enable 'Require Staff PIN' to track who processed each order. Use 'Filter Tables' to assign specific tables to waiters. Set timeout to 0 for shared tablets.
                </p>
              </div>
            </div>

            <div className="settings-section p-0">
              <div className="p-6 border-b border">
                <h4 className="text-base font-semibold text-foreground">Staff & Access Control</h4>
              </div>
              <div className="space-y-0">
                {getSettingCriticality(restaurantType, 'fields', 'staffPin') !== SettingCriticality.HIDDEN && (
                  <>
                    <div className="settings-toggle-row">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">Require Staff PIN</h3>
                          <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'staffPin')} />
                        </div>
                        <p className="settings-description">Staff must enter PIN to access POS</p>
                      </div>
                      <button
                        onClick={() => handleInputChange('posSettings.requireStaffPinForPOS', !(formData.posSettings?.requireStaffPinForPOS ?? false))}
                        className={cn(
                          'relative w-14 h-8 rounded-full transition-colors',
                          (formData.posSettings?.requireStaffPinForPOS ?? false) ? 'bg-accent' : 'bg-muted'
                        )}
                      >
                        <div
                          className={cn(
                            'absolute top-1 w-6 h-6 bg-card shadow-md rounded-full transition-transform',
                            (formData.posSettings?.requireStaffPinForPOS ?? false) ? 'translate-x-7' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </div>
                    <div className="p-4 settings-toggle-row">
                      <label className="settings-label">PIN Session Timeout (minutes)</label>
                      <input
                        type="number"
                        value={formData.posSettings?.pinSessionTimeoutMinutes ?? 0}
                        onChange={(e) => handleInputChange('posSettings.pinSessionTimeoutMinutes', parseInt(e.target.value))}
                        className="settings-input"
                        min="0"
                        placeholder="0 = no timeout"
                      />
                      <p className="settings-description">0 = no timeout, staff stays logged in</p>
                    </div>
                  </>
                )}

                {getSettingCriticality(restaurantType, 'fields', 'tableFiltering') !== SettingCriticality.HIDDEN && (
                  <div className="settings-toggle-row">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Filter Tables by Staff</h3>
                        <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'tableFiltering')} />
                      </div>
                      <p className="settings-description">Only show tables assigned to logged-in staff</p>
                    </div>
                    <button
                      onClick={() => handleInputChange('posSettings.filterTablesByStaffAssignment', !(formData.posSettings?.filterTablesByStaffAssignment ?? false))}
                      className={cn(
                        'relative w-14 h-8 rounded-full transition-colors',
                        (formData.posSettings?.filterTablesByStaffAssignment ?? false) ? 'bg-accent' : 'bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-1 w-6 h-6 bg-card shadow-md rounded-full transition-transform',
                          (formData.posSettings?.filterTablesByStaffAssignment ?? false) ? 'translate-x-7' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
            {/* Contextual Help Box */}
            <div className="neo-raised bg-info-light border border-info/30 p-4 flex gap-3">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">💡 What this enables</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Daylight-optimized UI (bright, rounded for daytime service), night-optimized UI (dark, sharp for evening/bar operations), adaptive brightness for ambient lighting conditions, and reduced eye strain for staff during long shifts.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Adjust brightness to match your environment. The interface gradually transitions from bright (0%) to dark (100%). Ideal for restaurants with varying lighting conditions.
                </p>
              </div>
            </div>

            {/* Adaptive Brightness Control */}
            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Appearance & Brightness</h4>

              {/* Brightness Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun size={18} className="text-warning" />
                    <h3 className="text-sm font-semibold text-foreground">Adaptive Brightness</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon size={18} className="text-info" />
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.posSettings?.brightness ?? 0}
                    onChange={(e) => {
                      const brightness = parseInt(e.target.value);
                      handleInputChange('posSettings.brightness', brightness);
                      // Brightness now uses gradual color transitions instead of theme switching
                    }}
                    className="brightness-slider"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Bright (Day)</span>
                    <span className="font-medium text-foreground">{formData.posSettings?.brightness ?? 0}%</span>
                    <span>Dark (Night)</span>
                  </div>
                </div>

                <p className="settings-description">
                  Adjust screen brightness to match ambient lighting. The interface gradually transitions through different shades of grey from bright (0%) to dark (100%).
                  {(formData.posSettings?.brightness ?? 0) < 30 && ' Optimal for bright daylight conditions.'}
                  {(formData.posSettings?.brightness ?? 0) >= 30 && (formData.posSettings?.brightness ?? 0) < 60 && ' Balanced for indoor lighting.'}
                  {(formData.posSettings?.brightness ?? 0) >= 60 && ' Optimized for evening and night operations.'}
                </p>
              </div>
            </div>

            {/* Border Style Control */}
            <div className="settings-section transition-neo">
              <h4 className="text-base font-semibold text-foreground mb-4">Border Style</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Corner Appearance</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleInputChange('posSettings.borderStyle', 'rounded')}
                    className={cn(
                      'px-4 py-3 text-sm font-medium transition-colors border flex flex-col items-center gap-2',
                      formData.posSettings?.borderStyle === 'rounded'
                        ? 'bg-accent text-white border-accent '
                        : 'bg-card text-foreground border hover:bg-surface-2 '
                    )}
                  >
                    <div className="w-12 h-12 border-2 border-current" />
                    <span>Rounded</span>
                  </button>
                  <button
                    onClick={() => handleInputChange('posSettings.borderStyle', 'sharp')}
                    className={cn(
                      'px-4 py-3 text-sm font-medium transition-colors border flex flex-col items-center gap-2',
                      formData.posSettings?.borderStyle === 'sharp'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-card text-foreground border hover:bg-surface-2'
                    )}
                  >
                    <div className="w-12 h-12 border-2 border-current" />
                    <span>Sharp</span>
                  </button>
                  <button
                    onClick={() => handleInputChange('posSettings.borderStyle', 'auto')}
                    className={cn(
                      'px-4 py-3 text-sm font-medium transition-colors border flex flex-col items-center gap-2',
                      formData.posSettings?.borderStyle === 'auto' || !formData.posSettings?.borderStyle
                        ? 'bg-accent text-white border-accent '
                        : 'bg-card text-foreground border hover:bg-surface-2 '
                    )}
                  >
                    <div className="w-12 h-12 border-2 border-current rounded-tl-xl rounded-br-xl" />
                    <span>Auto</span>
                  </button>
                </div>

                <p className="settings-description">
                  {formData.posSettings?.borderStyle === 'rounded' && 'Always use rounded corners for a friendly, modern look.'}
                  {formData.posSettings?.borderStyle === 'sharp' && 'Always use sharp edges for a professional, sophisticated appearance.'}
                  {(formData.posSettings?.borderStyle === 'auto' || !formData.posSettings?.borderStyle) &&
                    'Automatically adjust based on brightness: rounded when light, sharp when dark.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>
    </div>

    {/* Bill Preview Modal */}
    {showBillPreview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBillPreview(false)}
        />

        {/* Modal Content */}
        <div className="relative w-full max-w-2xl transform transition-all">
          <div className="bg-card border-2 border-border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-surface-2 p-4 border-b-2 border-border flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-foreground uppercase tracking-wide">
                  Bill Preview
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Live preview of your receipt settings</p>
              </div>
              <button
                onClick={() => setShowBillPreview(false)}
                className="text-foreground hover:text-destructive font-bold text-2xl px-2 leading-none transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[80vh] overflow-y-auto bg-background">
              <div className="flex justify-center">
                <div
                  className={cn(
                    "bg-white shadow-2xl overflow-hidden isolate",
                    // Apply border radius based on current border style setting
                    formData.posSettings?.borderStyle === 'sharp' ? '' : '',
                    (formData.posSettings?.borderStyle === 'auto' && (formData.posSettings?.brightness ?? 0) >= 50) ? '' :
                    (formData.posSettings?.borderStyle === 'auto' ? '' : '')
                  )}
                  style={{
                    width: formData.paperWidth === '80mm' ? '302px' : '220px',
                    padding: '8px',
                    fontFamily: 'inherit',
                    contain: 'layout style'
                  }}
                  dangerouslySetInnerHTML={{ __html: generateBillHTML(sampleBillData) }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

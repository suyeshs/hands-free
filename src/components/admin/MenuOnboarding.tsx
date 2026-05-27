import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItem as BackendMenuItem } from '../../lib/backendApi';
import { needsMenuSync, syncMenuFromBackend } from '../../lib/menuSync';
import { useMenuStore } from '../../stores/menuStore';
import { useIsLocationTenant } from '../../hooks/useIsLocationTenant';
import { LocationTenantBanner } from '../locations/LocationTenantBanner';
import ExcelUploader from './ExcelUploader';
import MenuConfirmationTable from './MenuConfirmationTable';
import PhotoUploader from './PhotoUploader';
import MenuItemsList from './MenuItemsList';
import { BulkComboConfigurator } from './BulkComboConfigurator';
import { MenuUploadSession } from './MenuUploadSession';
import { cn } from '../../lib/utils';
import { saveMenuCategory, deleteMenuCategory } from '../../lib/database';
import {
  Sparkles,
  FileSpreadsheet,
  Cloud,
  ArrowLeft,
  List,
  FolderTree,
  LayoutGrid,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  UtensilsCrossed,
  Wine
} from 'lucide-react';

// Returns the icon as an emoji. Lucide icon names (all-lowercase letters/hyphens)
// are not renderable as text — fall back to the default plate emoji.
const categoryIcon = (icon: string | null | undefined): string =>
  icon && /[^\x00-\x7F]/.test(icon) ? icon : '🍽️';

interface MenuOnboardingProps {
  tenantId: string;
}

type Step = 'check' | 'choose-menu-type' | 'choose-method' | 'upload' | 'upload-session' | 'confirm' | 'photos';
type Tab = 'items' | 'categories' | 'combos';
type MenuType = 'food' | 'bar';

export function MenuOnboarding({ tenantId }: MenuOnboardingProps) {
  const navigate = useNavigate();
  const { loadMenuFromDatabase, categories } = useMenuStore();
  const { isLocation, locationMetadata } = useIsLocationTenant();
  const [currentStep, setCurrentStep] = useState<Step>('check');
  const [selectedMenuType, setSelectedMenuType] = useState<MenuType>('food');
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [parsedItems, setParsedItems] = useState<BackendMenuItem[]>([]);
  const [_confirmedItems, setConfirmedItems] = useState<BackendMenuItem[]>([]);
  const [_overallConfidence, setOverallConfidence] = useState<number | undefined>();
  const [menuSynced, setMenuSynced] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Category management states
  const [editingCategory, setEditingCategory] = useState<{ id?: string; name: string; icon: string; active: boolean; sort_order: number } | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Bulk combo states
  const [showBulkCombo, setShowBulkCombo] = useState(false);

  // Check if menu needs sync on mount
  useEffect(() => {
    checkMenuStatus();
  }, []);

  const checkMenuStatus = async () => {
    try {
      // needsMenuSync returns true if DB has 0 items
      const needsSync = await needsMenuSync();
      console.log('[MenuOnboarding] needsMenuSync:', needsSync);
      setMenuSynced(!needsSync);
    } catch (error) {
      console.error('[MenuOnboarding] Failed to check menu status:', error);
      // On error, assume menu exists (better UX than blocking)
      setMenuSynced(true);
    }
  };

  const handleSyncMenu = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncMenuFromBackend(tenantId);
      // Refresh the menu store to load updated data from SQLite
      await loadMenuFromDatabase();
      setMenuSynced(true);
      alert('Menu synced successfully! You can now view it in the POS.');
    } catch (error) {
      console.error('[MenuOnboarding] Sync failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to sync menu';
      // Provide helpful message for 404 errors
      if (errorMsg.includes('404')) {
        setSyncError('Cloud menu sync is not available. Your local menu is already loaded from the database.');
        // Check if we have local menu items - if so, show as synced
        const hasLocalMenu = await needsMenuSync();
        if (!hasLocalMenu) {
          setMenuSynced(true);
        }
      } else {
        setSyncError(errorMsg);
        setMenuSynced(false);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleExcelParsed = (items: BackendMenuItem[], confidence?: number) => {
    setParsedItems(items);
    setOverallConfidence(confidence);
    setCurrentStep('confirm');
  };

  const handleMenuConfirmed = (items: BackendMenuItem[]) => {
    setConfirmedItems(items);
    setCurrentStep('photos');
  };

  const handlePhotosComplete = () => {
    // Menu onboarding complete
    alert('Menu onboarding complete! All items have been uploaded.');
  };

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('upload');
    } else if (currentStep === 'photos') {
      setCurrentStep('confirm');
    }
  };

  // Category management handlers
  const handleAddCategory = () => {
    setEditingCategory({
      name: '',
      icon: '🍽️',
      active: true,
      sort_order: categories.length,
    });
    setShowCategoryForm(true);
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      icon: category.icon,
      active: category.active,
      sort_order: category.sort_order,
    });
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !editingCategory.name) return;

    setSavingCategory(true);
    try {
      // Save to local SQLite (sync engine will update D1)
      await saveMenuCategory({
        id: editingCategory.id,
        name: editingCategory.name,
        description: editingCategory.icon, // Store icon in description field for now
        sort_order: editingCategory.sort_order,
        active: editingCategory.active,
      });

      // Reload menu from local database
      await loadMenuFromDatabase();
      setShowCategoryForm(false);
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to save category:', error);
      alert(`Failed to save category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? All items in this category will be moved to "uncategorized".')) return;

    try {
      // Delete from local SQLite (sync engine will update D1)
      await deleteMenuCategory(categoryId);
      // Reload menu from local database
      await loadMenuFromDatabase();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert(`Failed to delete category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkComboSaved = async () => {
    await loadMenuFromDatabase();
  };

  return (
    <div className="h-full flex flex-col bg-card">

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-8">
        {/* Location Tenant Banner */}
        {isLocation && currentStep === 'check' && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="rounded-xl p-4 border-2 status-info">
              <div className="flex items-start gap-3">
                <UtensilsCrossed size={24} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold mb-1">Location Menu Management</h3>
                  <p className="text-sm opacity-90 mb-2">
                    As a location tenant, your menu is managed by the master tenant.
                    Use the "Sync from Cloud" button to pull the latest menu from your master location.
                  </p>
                  <p className="text-xs opacity-75">
                    <strong>Location:</strong> {locationMetadata?.currentLocationName || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'check' && (
          <div className="h-full">
            {menuSynced === null ? (
              // Loading state
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                  </div>
                  <p className="text-muted-foreground font-medium">Checking menu status...</p>
                </div>
              </div>
            ) : menuSynced ? (
              // Menu already synced - show tabbed interface
              <div className="animate-fade-in space-y-6">
                {/* Header with sync controls */}
                <div className="flex items-center justify-between bg-card p-5 border border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Menu Synced</h2>
                      <p className="text-sm text-muted-foreground">Your menu is ready to use in the POS</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSyncMenu}
                      disabled={syncing}
                      className="px-4 py-2 bg-card border border text-sm font-medium text-foreground hover:bg-surface-2 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"></div>
                          Syncing...
                        </>
                      ) : (
                        <>↻ Re-sync</>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentStep('choose-menu-type')}
                      className="px-4 py-2 bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                    >
                      Create New Menu
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-card border border overflow-hidden">
                  <div className="flex border-b border">
                    <button
                      onClick={() => setActiveTab('items')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2",
                        activeTab === 'items'
                          ? "bg-orange-50 text-orange-600 border-orange-500"
                          : "bg-card text-muted-foreground border-transparent hover:bg-surface-2 hover:text-foreground"
                      )}
                    >
                      <List size={18} />
                      Menu Items
                    </button>
                    <button
                      onClick={() => setActiveTab('categories')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2",
                        activeTab === 'categories'
                          ? "bg-orange-50 text-orange-600 border-orange-500"
                          : "bg-card text-muted-foreground border-transparent hover:bg-surface-2 hover:text-foreground"
                      )}
                    >
                      <FolderTree size={18} />
                      Categories
                    </button>
                    <button
                      onClick={() => setActiveTab('combos')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2",
                        activeTab === 'combos'
                          ? "bg-orange-50 text-orange-600 border-orange-500"
                          : "bg-card text-muted-foreground border-transparent hover:bg-surface-2 hover:text-foreground"
                      )}
                    >
                      <LayoutGrid size={18} />
                      Bulk Combos
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6 bg-surface-2">
                    {activeTab === 'items' && (
                      <MenuItemsList
                        onRefresh={checkMenuStatus}
                        onCategoriesClick={() => setActiveTab('categories')}
                        onPhotosClick={() => navigate('/images')}
                        onAllImagesClick={() => navigate('/images')}
                      />
                    )}

                    {activeTab === 'categories' && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="bg-card p-5 border border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-purple-100 flex items-center justify-center">
                                <FolderTree className="w-6 h-6 text-purple-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-foreground">Category Management</h3>
                                <p className="text-sm text-muted-foreground">
                                  Organize your menu items into categories
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleAddCategory}
                              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
                            >
                              <Plus size={18} />
                              Add Category
                            </button>
                          </div>
                        </div>

                        {/* Categories Grid */}
                        {categories.length === 0 ? (
                          <div className="text-center py-16 bg-card border-2 border-dashed border">
                            <div className="w-16 h-16 bg-surface-3 flex items-center justify-center mx-auto mb-4">
                              <FolderTree className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">No Categories Yet</h3>
                            <p className="text-muted-foreground mb-6">
                              Get started by creating your first category
                            </p>
                            <button
                              onClick={handleAddCategory}
                              className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
                            >
                              <Plus size={18} />
                              Create First Category
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Deduplicate categories by ID to prevent duplicates from showing */}
                            {Array.from(new Map(categories.map(cat => [cat.id, cat])).values()).map((category) => (
                              <div
                                key={category.id}
                                className="bg-card p-5 border-2 border hover:border-purple-400 transition-colors"
                              >
                                {/* Category Info */}
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-12 h-12 bg-purple-100 flex items-center justify-center text-2xl flex-shrink-0">
                                      {categoryIcon(category.icon)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-base text-foreground truncate">
                                        {category.name}
                                      </h4>
                                      <span className="text-xs text-muted-foreground">
                                        Order: {category.sort_order}
                                      </span>
                                    </div>
                                  </div>
                                  <span
                                    className={cn(
                                      "px-2 py-1 text-xs font-medium uppercase flex-shrink-0",
                                      category.active
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    )}
                                  >
                                    {category.active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditCategory(category)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 text-sm font-medium transition-colors"
                                  >
                                    <Edit2 size={14} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(category.id)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-sm font-medium transition-colors"
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'combos' && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div>
                          <h3 className="text-lg font-semibold text-foreground mb-1">Bulk Combo Configuration</h3>
                          <p className="text-sm text-muted-foreground">
                            Apply the same combo options to all items in a category at once
                          </p>
                        </div>

                        {/* Info */}
                        <div className="p-5 bg-blue-50 border border-blue-200">
                          <div>
                            <h4 className="font-semibold text-foreground mb-3">How it works:</h4>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                              <li>Select a category (e.g., "Combo" or "Thali")</li>
                              <li>Create combo groups (e.g., "Choose Your Rice", "Choose Your Papad")</li>
                              <li>Add items to each group</li>
                              <li>Apply to all items in the category</li>
                            </ol>
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => setShowBulkCombo(true)}
                          className="w-full px-6 py-3 bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <LayoutGrid className="w-5 h-5" />
                          <span>Configure Bulk Combos</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Menu not synced - show method selection
              <div className="flex items-center justify-center h-full p-8">
                <div className="max-w-lg w-full bg-card border border p-8 text-center">
                  <div className="w-16 h-16 bg-orange-100 flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">📋</span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">No Menu Found</h2>
                  <p className="text-muted-foreground mb-6 text-sm">
                    Choose how you want to set up your menu
                  </p>
                  {syncError && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-200">
                      <p className="text-red-700 text-sm">{syncError}</p>
                    </div>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleSyncMenu}
                      disabled={syncing}
                      className="px-5 py-2.5 bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Syncing...
                        </>
                      ) : (
                        <>Sync from Guanix Cloud</>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentStep('choose-menu-type')}
                      className="px-5 py-2.5 bg-card border border text-foreground font-medium hover:bg-surface-2 transition-colors"
                    >
                      Create New Menu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'choose-method' && (
          <div className="flex items-center justify-center h-full p-8">
            <div className="max-w-4xl w-full">
              {/* Back Button */}
              <button
                onClick={() => setCurrentStep('check')}
                className="mb-6 flex items-center gap-2 px-4 py-2 bg-card border border hover:bg-surface-2 transition-colors text-sm font-medium text-foreground"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-2">Choose How to Build Your Menu</h2>
                <p className="text-muted-foreground">Select the method that works best for you</p>
              </div>

              {/* Method Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI-Guided Method - Coming Soon */}
                <div className="bg-card border border p-6 opacity-50 cursor-not-allowed">
                  <div className="w-16 h-16 bg-purple-100 flex items-center justify-center mb-4">
                    <Sparkles size={32} className="text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Build from Scratch</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    AI-guided menu creation with step-by-step wizard. Select your cuisine, service style, and let AI generate your menu structure.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-medium text-yellow-700 bg-yellow-100 border border-yellow-300 px-3 py-1.5 w-fit">
                    <Sparkles size={14} />
                    Coming Soon
                  </div>
                </div>

                {/* Excel Upload Method */}
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="bg-card border-2 border p-6 hover:border-green-500 transition-colors text-left group"
                >
                  <div className="w-16 h-16 bg-green-100 flex items-center justify-center mb-4">
                    <FileSpreadsheet size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Upload Excel/CSV</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Import your menu from a spreadsheet. Download our template or use your own format.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                    Get Started
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* Cloud Sync Method */}
                <button
                  onClick={handleSyncMenu}
                  disabled={syncing}
                  className="bg-card border-2 border p-6 hover:border-blue-500 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-16 h-16 bg-blue-100 flex items-center justify-center mb-4">
                    <Cloud size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Sync from Cloud</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sync your menu from the Guanix platform. Perfect if you've already set up your menu online.
                  </p>
                  {syncing ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      Syncing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      Sync Now
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'choose-menu-type' && (
          <div className="flex items-center justify-center h-full p-8">
            <div className="max-w-4xl w-full">
              {/* Back Button */}
              <button
                onClick={() => setCurrentStep('check')}
                className="mb-6 flex items-center gap-2 px-4 py-2 bg-card border border hover:bg-surface-2 transition-colors text-sm font-medium text-foreground"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-2">Choose Menu Type</h2>
                <p className="text-muted-foreground">Select which menu you want to upload</p>
              </div>

              {/* Menu Type Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Food Menu */}
                <button
                  onClick={() => {
                    setSelectedMenuType('food');
                    setCurrentStep('upload-session');
                  }}
                  className="bg-card border-2 border p-8 hover:border-orange-500 transition-colors text-left group"
                >
                  <div className="w-16 h-16 bg-orange-100 flex items-center justify-center mb-4">
                    <UtensilsCrossed size={32} className="text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Food Menu</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your main food menu items including appetizers, mains, desserts, and more.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                    Select Food Menu
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* Bar Menu */}
                <button
                  onClick={() => {
                    setSelectedMenuType('bar');
                    setCurrentStep('upload-session');
                  }}
                  className="bg-card border-2 border p-8 hover:border-purple-500 transition-colors text-left group"
                >
                  <div className="w-16 h-16 bg-purple-100 flex items-center justify-center mb-4">
                    <Wine size={32} className="text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Bar Menu</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your bar menu including cocktails, wines, beers, spirits, and beverages.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-600">
                    Select Bar Menu
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'upload-session' && (
          <MenuUploadSession
            menuType={selectedMenuType}
            onComplete={async () => {
              // Session committed successfully, reload menu and go back to check
              await loadMenuFromDatabase();
              setCurrentStep('check');
              setMenuSynced(true);
            }}
            onCancel={() => {
              // User cancelled the session, go back to menu type selection
              setCurrentStep('choose-menu-type');
            }}
          />
        )}

        {currentStep === 'upload' && (
          <div>
            {/* Back Button */}
            <button
              onClick={() => setCurrentStep('choose-method')}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-card border border hover:bg-surface-2 transition-colors text-sm font-medium text-foreground"
            >
              <ArrowLeft size={16} />
              Back to Methods
            </button>
            <ExcelUploader
              tenantId={tenantId}
              onParsed={handleExcelParsed}
            />
          </div>
        )}

        {currentStep === 'confirm' && (
          <MenuConfirmationTable
            tenantId={tenantId}
            items={parsedItems}
            onConfirmed={handleMenuConfirmed}
            onBack={handleBack}
          />
        )}

        {currentStep === 'photos' && (
          <PhotoUploader
            tenantId={tenantId}
            onComplete={handlePhotosComplete}
            onBack={handleBack}
          />
        )}
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card shadow-2xl max-w-md w-full border border">
            {/* Header */}
            <div className="bg-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 flex items-center justify-center">
                    <FolderTree className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    {editingCategory.id ? 'Edit Category' : 'Add New Category'}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                  }}
                  className="p-1.5 hover:bg-white/20 transition-colors text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 bg-card border border focus:outline-none focus:border-purple-500 transition-colors text-foreground placeholder-gray-400"
                  placeholder="e.g., Appetizers, Main Course, Desserts"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Icon (Emoji)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editingCategory.icon}
                    onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border focus:outline-none focus:border-purple-500 transition-colors text-foreground placeholder-gray-400 pl-12"
                    placeholder="🍽️"
                    maxLength={2}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl">
                    {categoryIcon(editingCategory.icon)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose an emoji that represents this category
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCategory.sort_order}
                  onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-card border border focus:outline-none focus:border-purple-500 transition-colors text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first in the menu
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCategory.active}
                    onChange={(e) => setEditingCategory({ ...editingCategory, active: e.target.checked })}
                    className="w-4 h-4 border-2 border checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      Active Category
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Inactive categories are hidden from customers
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border bg-surface-2">
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
                className="flex-1 px-4 py-2 bg-card border border text-foreground text-sm font-medium hover:bg-surface-3 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={savingCategory || !editingCategory.name}
                className="flex-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingCategory ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Category
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Combo Modal */}
      <BulkComboConfigurator
        isOpen={showBulkCombo}
        onClose={() => setShowBulkCombo(false)}
        onSaved={handleBulkComboSaved}
      />
    </div>
  );
}

export default MenuOnboarding;

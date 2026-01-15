import { useState, useEffect } from 'react';
import { MenuItem as BackendMenuItem } from '../../lib/backendApi';
import { needsMenuSync, syncMenuFromBackend } from '../../lib/menuSync';
import { useMenuStore } from '../../stores/menuStore';
import ExcelUploader from './ExcelUploader';
import MenuConfirmationTable from './MenuConfirmationTable';
import PhotoUploader from './PhotoUploader';
import MenuItemsList from './MenuItemsList';
import { BulkComboConfigurator } from './BulkComboConfigurator';
import { backendApi } from '../../lib/backendApi';
import { cn } from '../../lib/utils';
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
  X
} from 'lucide-react';

interface MenuOnboardingProps {
  tenantId: string;
}

type Step = 'check' | 'choose-method' | 'upload' | 'confirm' | 'photos';
type Tab = 'items' | 'categories' | 'combos';

export function MenuOnboarding({ tenantId }: MenuOnboardingProps) {
  const { loadMenuFromDatabase, categories } = useMenuStore();
  const [currentStep, setCurrentStep] = useState<Step>('check');
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
      if (editingCategory.id) {
        await backendApi.updateCategory(tenantId, editingCategory.id, {
          name: editingCategory.name,
          icon: editingCategory.icon,
          active: editingCategory.active,
          sort_order: editingCategory.sort_order,
        });
      } else {
        await backendApi.createCategory(tenantId, {
          name: editingCategory.name,
          icon: editingCategory.icon,
          active: editingCategory.active,
          sort_order: editingCategory.sort_order,
        });
      }

      await syncMenuFromBackend(tenantId);
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
    if (!confirm('Are you sure you want to delete this category? All items in this category will be affected.')) return;

    try {
      await backendApi.deleteCategory(tenantId, categoryId);
      await syncMenuFromBackend(tenantId);
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
    <div className="h-full flex flex-col">

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {currentStep === 'check' && (
          <div className="h-full">
            {menuSynced === null ? (
              // Loading state
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
                  </div>
                  <p className="text-muted-foreground font-bold">Checking menu status...</p>
                </div>
              </div>
            ) : menuSynced ? (
              // Menu already synced - show tabbed interface
              <div className="animate-fade-in space-y-4">
                {/* Header with sync controls */}
                <div className="flex items-center justify-between glass-panel p-4 rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Menu Synced</h2>
                      <p className="text-xs text-muted-foreground">Your menu is ready to use in the POS</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncMenu}
                      disabled={syncing}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-wider hover:bg-white/10 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                          Syncing...
                        </>
                      ) : (
                        <>↻ Re-sync</>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentStep('choose-method')}
                      className="px-3 py-2 rounded-xl bg-accent text-white text-sm font-bold uppercase tracking-wider shadow-lg shadow-accent/20 hover:scale-105 transition-all"
                    >
                      Create New Menu
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="glass-panel rounded-xl border border-border overflow-hidden">
                  <div className="flex border-b border-border">
                    <button
                      onClick={() => setActiveTab('items')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all",
                        activeTab === 'items'
                          ? "bg-accent text-white"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"
                      )}
                    >
                      <List size={18} />
                      Menu Items
                    </button>
                    <button
                      onClick={() => setActiveTab('categories')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all",
                        activeTab === 'categories'
                          ? "bg-accent text-white"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"
                      )}
                    >
                      <FolderTree size={18} />
                      Categories
                    </button>
                    <button
                      onClick={() => setActiveTab('combos')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all",
                        activeTab === 'combos'
                          ? "bg-accent text-white"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"
                      )}
                    >
                      <LayoutGrid size={18} />
                      Bulk Combos
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6">
                    {activeTab === 'items' && (
                      <MenuItemsList onRefresh={checkMenuStatus} />
                    )}

                    {activeTab === 'categories' && (
                      <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold">Category Management</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Organize your menu items into categories
                            </p>
                          </div>
                          <button
                            onClick={handleAddCategory}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white font-bold hover:bg-accent/90 transition-colors"
                          >
                            <Plus size={18} />
                            Add Category
                          </button>
                        </div>

                        {/* Categories Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categories.map((category) => (
                            <div
                              key={category.id}
                              className="glass-panel p-4 rounded-xl border border-border hover:border-accent/30 transition-all"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl">{category.icon}</span>
                                  <div>
                                    <h4 className="font-bold text-lg">{category.name}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      Sort: {category.sort_order}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-xs font-bold uppercase",
                                    category.active
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-red-500/20 text-red-400"
                                  )}
                                >
                                  {category.active ? 'Active' : 'Inactive'}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditCategory(category)}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 text-sm font-bold transition-all"
                                >
                                  <Edit2 size={14} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm font-bold transition-all"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'combos' && (
                      <div className="space-y-6">
                        {/* Header */}
                        <div>
                          <h3 className="text-xl font-bold mb-2">Bulk Combo Configuration</h3>
                          <p className="text-sm text-muted-foreground">
                            Apply the same combo options to all items in a category at once
                          </p>
                        </div>

                        {/* Info */}
                        <div className="p-6 rounded-xl bg-white/5 border border-border space-y-4">
                          <div>
                            <h4 className="font-bold mb-2">How it works:</h4>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
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
                          className="w-full px-8 py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-wider hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3"
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
                <div className="max-w-lg w-full glass-panel rounded-2xl border border-border p-8 animate-fade-in text-center">
                  <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">📋</span>
                  </div>
                  <h2 className="text-xl font-black uppercase mb-2">No Menu Found</h2>
                  <p className="text-muted-foreground mb-6 text-sm">
                    Choose how you want to set up your menu
                  </p>
                  {syncError && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-red-400 text-sm">{syncError}</p>
                    </div>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleSyncMenu}
                      disabled={syncing}
                      className="px-5 py-2.5 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Syncing...
                        </>
                      ) : (
                        <>Sync from HandsFree</>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentStep('choose-method')}
                      className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
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
            <div className="max-w-4xl w-full animate-fade-in">
              {/* Back Button */}
              <button
                onClick={() => setCurrentStep('check')}
                className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-bold"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black uppercase mb-2">Choose How to Build Your Menu</h2>
                <p className="text-muted-foreground">Select the method that works best for you</p>
              </div>

              {/* Method Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI-Guided Method - Coming Soon */}
                <div className="glass-panel rounded-2xl border border-border p-6 opacity-50 cursor-not-allowed">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles size={32} className="text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Build from Scratch</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    AI-guided menu creation with step-by-step wizard. Select your cuisine, service style, and let AI generate your menu structure.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 w-fit">
                    <Sparkles size={14} />
                    Coming Soon
                  </div>
                </div>

                {/* Excel Upload Method */}
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="glass-panel rounded-2xl border border-border p-6 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all text-left group"
                >
                  <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet size={32} className="text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Upload Excel/CSV</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Import your menu from a spreadsheet. Download our template or use your own format.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-bold text-accent">
                    Get Started
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* Cloud Sync Method */}
                <button
                  onClick={handleSyncMenu}
                  disabled={syncing}
                  className="glass-panel rounded-2xl border border-border p-6 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Cloud size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Sync from Cloud</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sync your menu from the HandsFree platform. Perfect if you've already set up your menu online.
                  </p>
                  {syncing ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-accent">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                      Syncing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-bold text-accent">
                      Sync Now
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div>
            {/* Back Button */}
            <button
              onClick={() => setCurrentStep('choose-method')}
              className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-bold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel rounded-2xl border border-border shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">
                {editingCategory.id ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
                className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Category Name *</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="e.g., Appetizers"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Icon (Emoji)</label>
                <input
                  type="text"
                  value={editingCategory.icon}
                  onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="🍽️"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={editingCategory.sort_order}
                  onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCategory.active}
                    onChange={(e) => setEditingCategory({ ...editingCategory, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold">Active</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-border">
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={savingCategory || !editingCategory.name}
                className="flex-1 px-4 py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {savingCategory ? 'Saving...' : 'Save Category'}
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

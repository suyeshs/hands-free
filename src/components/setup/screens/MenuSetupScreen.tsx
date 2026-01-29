/**
 * MenuSetupScreen Component
 * Allow users to set up menu with demo data or manually
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Sparkles, Plus } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { getDemoTemplate, RestaurantType, DEMO_TEMPLATES } from '../../../lib/demoData';
import Database from '@tauri-apps/plugin-sql';

export function MenuSetupScreen() {
  const { wizardData: _wizardData, updateWizardData } = useSetupWizardStore();

  const [useDemoData, setUseDemoData] = useState(false);
  const [selectedDemoType, setSelectedDemoType] = useState<RestaurantType>('indian');
  const [isLoading, setIsLoading] = useState(false);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  // Handle demo data toggle
  const handleDemoDataToggle = async (checked: boolean) => {
    setUseDemoData(checked);
    if (checked) {
      await loadDemoMenu(selectedDemoType);
    }
  };

  // Handle demo type change
  const handleDemoTypeChange = async (type: RestaurantType) => {
    setSelectedDemoType(type);
    if (useDemoData) {
      await loadDemoMenu(type);
    }
  };

  // Load demo menu into database
  const loadDemoMenu = async (type: RestaurantType) => {
    setIsLoading(true);
    try {
      const template = getDemoTemplate(type);
      const db = await Database.load('sqlite:pos.db');

      // Clear existing menu first
      await db.execute('DELETE FROM menu_items');
      await db.execute('DELETE FROM menu_categories');

      // Insert categories
      for (const category of template.categories) {
        await db.execute(
          `INSERT INTO menu_categories (id, name, sort_order, active) VALUES (?, ?, ?, ?)`,
          [category.id, category.name, category.sort_order, category.active ? 1 : 0]
        );
      }

      // Insert menu items
      for (const item of template.menuItems) {
        await db.execute(
          `INSERT INTO menu_items (
            id, category_id, name, description, price, active, preparation_time,
            is_veg, is_vegan, is_popular, is_chef_special, spice_level,
            contains_dairy, contains_gluten, contains_nuts
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.category_id,
            item.name,
            item.description,
            item.price,
            item.active ? 1 : 0,
            item.preparation_time,
            item.is_veg ? 1 : 0,
            item.is_vegan ? 1 : 0,
            item.is_popular ? 1 : 0,
            item.is_chef_special ? 1 : 0,
            item.spice_level || null,
            item.contains_dairy ? 1 : 0,
            item.contains_gluten ? 1 : 0,
            item.contains_nuts ? 1 : 0,
          ]
        );
      }

      setMenuLoaded(true);
      setCategoryCount(template.categories.length);
      setItemCount(template.menuItems.length);

      // Store in wizard data
      updateWizardData({
        menuSetup: {
          usedDemoData: true,
          restaurantType: type,
        },
      });

      console.log(`[MenuSetup] Loaded ${template.menuItems.length} items in ${template.categories.length} categories`);
    } catch (error) {
      console.error('[MenuSetup] Failed to load demo menu:', error);
      alert('Failed to load demo menu. Please try again or set up manually.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-paprika/20 to-saffron/10 flex items-center justify-center">
          <UtensilsCrossed className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Menu Setup</h2>
        <p className="text-muted-foreground">Add menu items or use demo data to get started quickly</p>
      </motion.div>

      {/* Demo Data Section */}
      <motion.div
        className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-saffron/10 to-paprika/5 border-2 border-saffron/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-start gap-4">
          <input
            type="checkbox"
            id="useDemoMenu"
            checked={useDemoData}
            onChange={(e) => handleDemoDataToggle(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-5 h-5 rounded border-2 border-saffron text-saffron focus:ring-2 focus:ring-saffron/20 disabled:opacity-50"
          />
          <div className="flex-1">
            <label htmlFor="useDemoMenu" className="flex items-center gap-2 font-bold text-foreground cursor-pointer">
              <Sparkles className="w-5 h-5 text-saffron" />
              Use Demo Menu
            </label>
            <p className="text-sm text-muted-foreground mt-1">
              Populate your menu with sample items based on restaurant type. You can edit or delete items later.
            </p>

            {useDemoData && (
              <motion.div
                className="mt-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-bold mb-2 text-foreground">
                  Restaurant Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(DEMO_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleDemoTypeChange(key as RestaurantType)}
                      disabled={isLoading}
                      className={`p-3 rounded-xl border-2 transition-all disabled:opacity-50 ${
                        selectedDemoType === key
                          ? 'border-saffron bg-saffron/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-saffron/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{template.icon}</div>
                      <div className="text-xs font-bold">{template.label}</div>
                    </button>
                  ))}
                </div>

                {isLoading && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-saffron">
                      <div className="w-4 h-4 border-2 border-saffron border-t-transparent rounded-full animate-spin"></div>
                      Loading menu...
                    </div>
                  </div>
                )}

                {menuLoaded && !isLoading && (
                  <motion.div
                    className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">
                      ✓ Menu Loaded Successfully
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {categoryCount} categories with {itemCount} menu items
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Manual Setup Option */}
      {!useDemoData && (
        <motion.div
          className="p-8 rounded-2xl border-2 border-dashed border-border text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Plus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-bold text-foreground mb-2">Manual Menu Setup</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You can add menu items manually after completing the setup wizard from the Menu Management page.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Or check the "Use Demo Menu" option above to get started quickly with sample data.
          </p>
        </motion.div>
      )}

      {/* Info */}
      <motion.div
        className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-sm text-blue-600 dark:text-blue-400">
          <strong>Tip:</strong> You can always add, edit, or delete menu items later from Settings → Menu Management.
        </p>
      </motion.div>
    </div>
  );
}

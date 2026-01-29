/**
 * FloorPlanSetupScreen Component
 * Allow users to set up floor plan with demo data or manually
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Sparkles, Grid3x3 } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { getDemoTemplate, RestaurantType, DEMO_TEMPLATES } from '../../../lib/demoData';
import { useTenantStore } from '../../../stores/tenantStore';
import Database from '@tauri-apps/plugin-sql';

export function FloorPlanSetupScreen() {
  const { updateWizardData } = useSetupWizardStore();

  const [useDemoData, setUseDemoData] = useState(false);
  const [selectedDemoType, setSelectedDemoType] = useState<RestaurantType>('indian');
  const [isLoading, setIsLoading] = useState(false);
  const [floorPlanLoaded, setFloorPlanLoaded] = useState(false);
  const [tableCount, setTableCount] = useState(0);
  const [sectionCount, setSectionCount] = useState(0);

  // Handle demo data toggle
  const handleDemoDataToggle = async (checked: boolean) => {
    setUseDemoData(checked);
    if (checked) {
      await loadDemoFloorPlan(selectedDemoType);
    }
  };

  // Handle demo type change
  const handleDemoTypeChange = async (type: RestaurantType) => {
    setSelectedDemoType(type);
    if (useDemoData) {
      await loadDemoFloorPlan(type);
    }
  };

  // Load demo floor plan into database
  const loadDemoFloorPlan = async (type: RestaurantType) => {
    setIsLoading(true);
    try {
      const template = getDemoTemplate(type);
      const db = await Database.load('sqlite:pos.db');
      const { tenant } = useTenantStore.getState();
      const tenantId = tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID || 'demo';

      // Clear existing floor plan
      await db.execute('DELETE FROM floor_tables');
      await db.execute('DELETE FROM floor_sections');

      // Create sections and map to IDs
      const sectionMap = new Map<string, string>();
      for (const sectionName of template.floorPlan.sections) {
        const sectionId = crypto.randomUUID();
        sectionMap.set(sectionName, sectionId);

        await db.execute(
          `INSERT INTO floor_sections (id, tenant_id, name, is_active, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [sectionId, tenantId, sectionName, 1, new Date().toISOString()]
        );
      }

      // Insert tables
      for (const table of template.floorPlan.tables) {
        const tableId = crypto.randomUUID();
        const sectionId = sectionMap.get(table.section);

        if (!sectionId) {
          console.warn(`[FloorPlanSetup] Section ${table.section} not found for table ${table.number}`);
          continue;
        }

        await db.execute(
          `INSERT INTO floor_tables (
            id, tenant_id, section_id, table_number, capacity,
            status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tableId,
            tenantId,
            sectionId,
            String(table.number),
            table.capacity,
            'available',
            new Date().toISOString(),
          ]
        );
      }

      setFloorPlanLoaded(true);
      setTableCount(template.floorPlan.tables.length);
      setSectionCount(template.floorPlan.sections.length);

      // Store in wizard data
      updateWizardData({
        floorPlanSetup: {
          usedDemoData: true,
          restaurantType: type,
        },
      });

      console.log(`[FloorPlanSetup] Loaded ${template.floorPlan.tables.length} tables in ${template.floorPlan.sections.length} sections`);
    } catch (error) {
      console.error('[FloorPlanSetup] Failed to load demo floor plan:', error);
      alert('Failed to load demo floor plan. Please try again or set up manually.');
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
          <LayoutGrid className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Floor Plan Setup</h2>
        <p className="text-muted-foreground">Configure your dining area or use demo data to get started quickly</p>
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
            id="useDemoFloorPlan"
            checked={useDemoData}
            onChange={(e) => handleDemoDataToggle(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-5 h-5 rounded border-2 border-saffron text-saffron focus:ring-2 focus:ring-saffron/20 disabled:opacity-50"
          />
          <div className="flex-1">
            <label htmlFor="useDemoFloorPlan" className="flex items-center gap-2 font-bold text-foreground cursor-pointer">
              <Sparkles className="w-5 h-5 text-saffron" />
              Use Demo Floor Plan
            </label>
            <p className="text-sm text-muted-foreground mt-1">
              Create a sample floor plan with sections and tables. You can customize it later in Floor Plan Manager.
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
                      Loading floor plan...
                    </div>
                  </div>
                )}

                {floorPlanLoaded && !isLoading && (
                  <motion.div
                    className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">
                      ✓ Floor Plan Loaded Successfully
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {sectionCount} sections with {tableCount} tables
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
          <Grid3x3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-bold text-foreground mb-2">Manual Floor Plan Setup</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You can create your floor plan manually after completing the setup wizard from the Floor Plan Manager.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Or check the "Use Demo Floor Plan" option above to get started quickly with a sample layout.
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
          <strong>Tip:</strong> You can drag and rearrange tables, add new sections, or delete tables from Settings → Floor Plan Manager.
        </p>
      </motion.div>
    </div>
  );
}

/**
 * StaffSetupScreen Component
 * Allow users to set up staff with demo data or manually
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Sparkles, UserPlus } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { getDemoTemplate, RestaurantType, DEMO_TEMPLATES } from '../../../lib/demoData';
import { useTenantStore } from '../../../stores/tenantStore';
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

export function StaffSetupScreen() {
  const { updateWizardData } = useSetupWizardStore();

  const [useDemoData, setUseDemoData] = useState(false);
  const [selectedDemoType, setSelectedDemoType] = useState<RestaurantType>('indian');
  const [isLoading, setIsLoading] = useState(false);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffCount, setStaffCount] = useState(0);

  // Handle demo data toggle
  const handleDemoDataToggle = async (checked: boolean) => {
    setUseDemoData(checked);
    if (checked) {
      await loadDemoStaff(selectedDemoType);
    }
  };

  // Handle demo type change
  const handleDemoTypeChange = async (type: RestaurantType) => {
    setSelectedDemoType(type);
    if (useDemoData) {
      await loadDemoStaff(type);
    }
  };

  // Load demo staff into database
  const loadDemoStaff = async (type: RestaurantType) => {
    setIsLoading(true);
    try {
      const template = getDemoTemplate(type);
      const db = await Database.load(DB_NAME);
      const { tenant } = useTenantStore.getState();
      const tenantId = tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID || 'demo';

      // Clear existing staff (keep demo simple - delete all)
      await db.execute('DELETE FROM staff_users');

      // Insert staff members
      for (const staff of template.staff) {
        // Hash the PIN using Tauri command
        const pinHash = await invoke<string>('hash_staff_pin', { pin: staff.pin_code });
        const id = crypto.randomUUID();

        await db.execute(
          `INSERT INTO staff_users (id, tenant_id, name, role, pin_hash, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            tenantId,
            staff.name,
            staff.role,
            pinHash,
            staff.active ? 1 : 0,
            Date.now(),
          ]
        );
      }

      setStaffLoaded(true);
      setStaffCount(template.staff.length);

      // Store in wizard data
      updateWizardData({
        staffSetup: {
          usedDemoData: true,
          restaurantType: type,
        },
      });

      console.log(`[StaffSetup] Loaded ${template.staff.length} staff members`);
    } catch (error) {
      console.error('[StaffSetup] Failed to load demo staff:', error);
      alert('Failed to load demo staff. Please try again or set up manually.');
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
          <Users className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Staff Setup</h2>
        <p className="text-muted-foreground">Add team members or use demo data to get started quickly</p>
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
            id="useDemoStaff"
            checked={useDemoData}
            onChange={(e) => handleDemoDataToggle(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-5 h-5 rounded border-2 border-saffron text-saffron focus:ring-2 focus:ring-saffron/20 disabled:opacity-50"
          />
          <div className="flex-1">
            <label htmlFor="useDemoStaff" className="flex items-center gap-2 font-bold text-foreground cursor-pointer">
              <Sparkles className="w-5 h-5 text-saffron" />
              Use Demo Staff
            </label>
            <p className="text-sm text-muted-foreground mt-1">
              Add sample staff members with typical roles (Manager, Server, Kitchen). You can edit or remove them later.
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
                      Loading staff...
                    </div>
                  </div>
                )}

                {staffLoaded && !isLoading && (
                  <motion.div
                    className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">
                      ✓ Staff Loaded Successfully
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {staffCount} staff members added
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
          <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-bold text-foreground mb-2">Manual Staff Setup</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You can add staff members manually after completing the setup wizard from the Staff Management page.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Or check the "Use Demo Staff" option above to get started quickly with sample team members.
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
          <strong>Tip:</strong> All demo staff members use simple PIN codes (1234, 2345, etc.). Make sure to change these in Settings → Staff Management for security.
        </p>
      </motion.div>
    </div>
  );
}

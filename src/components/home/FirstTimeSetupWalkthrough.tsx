/**
 * FirstTimeSetupWalkthrough Component
 * Displays a contextual walkthrough of required setup steps for new installations
 */

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Store,
  Receipt,
  Menu,
  LayoutGrid,
  Users,
  ArrowRight,
  EyeOff,
} from 'lucide-react';
import {
  useHasRestaurantBasics,
  useHasTaxBillingSetup,
  useHasMinimumMenu,
  useHasFloorPlan,
  useHasStaff,
  useGetIncompleteSetup,
  useSetupWizardStore,
} from '../../stores/setupWizardStore';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useTenantStore } from '../../stores/tenantStore';
import { cn } from '../../lib/utils';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Store;
  path: string;
  isComplete: boolean;
}

export function FirstTimeSetupWalkthrough() {
  const navigate = useNavigate();
  const { dismissChecklist } = useSetupWizardStore();

  const hasBasics = useHasRestaurantBasics();
  const hasTaxBilling = useHasTaxBillingSetup();
  const hasMenu = useHasMinimumMenu();
  const hasFloorPlan = useHasFloorPlan();
  const hasStaff = useHasStaff();
  const { completedCount, requiredCount } = useGetIncompleteSetup();

  const loadFloorPlan = useFloorPlanStore((s) => s.loadFloorPlan);

  // On a fresh install the floor plan exists in the cloud but not locally yet, so the
  // Floor Plan step shows incomplete. Load it (loadFloorPlan pulls from the cloud when local
  // is empty) so the step reflects the tenant's actual cloud data instead of forcing re-setup.
  useEffect(() => {
    const tenantId = useTenantStore.getState().getTenantId();
    if (tenantId) {
      loadFloorPlan(tenantId).catch((e) =>
        console.warn('[Setup] floor plan load/sync failed:', e)
      );
    }
  }, [loadFloorPlan]);

  const handleDismiss = async () => {
    await dismissChecklist();
  };

  const steps: SetupStep[] = [
    {
      id: 'restaurant-basics',
      title: '1. Restaurant Information',
      description: 'Add your name, address, phone - shown on bills and receipts',
      icon: Store,
      path: '/settings?setting=restaurant-details',
      isComplete: hasBasics,
    },
    {
      id: 'tax-billing',
      title: '2. Tax & Billing Setup',
      description: 'Configure GST rates and invoice numbering for legal compliance',
      icon: Receipt,
      path: '/settings?setting=tax-billing',
      isComplete: hasTaxBilling,
    },
    {
      id: 'menu',
      title: '3. Menu Items',
      description: 'Add at least 3 items - you can upload or add manually',
      icon: Menu,
      path: '/settings?setting=menu',
      isComplete: hasMenu,
    },
    {
      id: 'floor-plan',
      title: '4. Floor Plan',
      description: 'Create sections and tables for dine-in orders',
      icon: LayoutGrid,
      path: '/settings?setting=floor-plan',
      isComplete: hasFloorPlan,
    },
    {
      id: 'staff',
      title: '5. Staff Members',
      description: 'Add at least 2 team members with their roles',
      icon: Users,
      path: '/settings?setting=staff',
      isComplete: hasStaff,
    },
  ];

  const progressPercent = Math.round((completedCount / requiredCount) * 100);

  return (
    <motion.div
      className="mb-6 relative z-10"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
    >
      <div className="glass-panel-dark p-6 relative">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-4">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-2xl font-semibold text-warm-white">
                  Welcome to Guanix Restaurant OS! 👋
                </h2>
                {/* Hide Button */}
                <button
                  onClick={handleDismiss}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors group flex-shrink-0"
                  title="Hide this walkthrough (you can still access settings anytime)"
                >
                  <EyeOff className="w-3.5 h-3.5 text-gray-500 group-hover:text-warm-white transition-colors" />
                  <span className="text-xs text-gray-500 group-hover:text-warm-white transition-colors">Hide</span>
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Let's get your restaurant set up in just a few steps. We'll guide you through the essentials.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
                <span>Setup takes about 5-10 minutes</span>
              </div>
            </div>
            <div className="flex flex-col items-end ml-4 flex-shrink-0">
              <div className="text-3xl font-bold text-saffron">
                {completedCount}/{requiredCount}
              </div>
              <p className="text-xs text-gray-400">completed</p>
            </div>
          </div>

          {/* Quick Tips */}
          {completedCount === 0 && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">
                Getting Started Tips
              </h3>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Start with restaurant info - we need your basic details</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Configure taxes and billing for proper invoices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Each step is quick and can be updated later</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-warm-charcoal rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-warm"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Setup Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.button
                key={step.id}
                onClick={() => navigate(step.path)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg transition-all',
                  'hover:bg-white/5 active:scale-[0.98]',
                  step.isComplete
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-white/5 border border-white/10 hover:border-saffron/50'
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {step.isComplete ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-500" />
                  )}
                </div>

                {/* Step Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                    step.isComplete
                      ? 'bg-green-500/20'
                      : 'bg-saffron/20'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5',
                      step.isComplete ? 'text-green-400' : 'text-saffron'
                    )}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 text-left">
                  <h3 className="text-sm font-semibold text-warm-white mb-0.5">
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>

                {/* Arrow */}
                {!step.isComplete && (
                  <ArrowRight className="w-5 h-5 text-gray-500" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Footer */}
        {completedCount === requiredCount && (
          <motion.div
            className="mt-6 space-y-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-warm-white mb-1">
                    🎉 Setup Complete!
                  </h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Great job! Your restaurant is ready to start taking orders.
                  </p>
                </div>
              </div>
              <div className="ml-9 space-y-2">
                <h4 className="text-xs font-semibold text-green-400 mb-2">
                  What's next?
                </h4>
                <ul className="text-xs text-gray-400 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">1.</span>
                    <span>Click on <strong className="text-warm-white">Point of Sale</strong> to start taking orders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">2.</span>
                    <span>Use <strong className="text-warm-white">Kitchen Display</strong> to view incoming orders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">3.</span>
                    <span>Check <strong className="text-warm-white">Sales Reports</strong> to track your revenue</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="text-xs text-center text-gray-500">
              Need help? Visit Settings to update any information or explore more features.
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

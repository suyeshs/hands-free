/**
 * ContextualOnboarding Component
 * Card-based progressive onboarding that blocks POS until complete
 * Shows only incomplete cards, hides when all required setup is done
 */

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useIsReadyForPOS, useGetIncompleteSetup } from '../../stores/setupWizardStore';

// Import setup cards
import { RestaurantBasicsCard } from './cards/RestaurantBasicsCard';
import { TaxBillingCard } from './cards/TaxBillingCard';
import { MenuSetupCard } from './cards/MenuSetupCard';
import { FloorPlanCard } from './cards/FloorPlanCard';
import { StaffManagementCard } from './cards/StaffManagementCard';

export function ContextualOnboarding() {
  const isReadyForPOS = useIsReadyForPOS();
  const incompleteSetup = useGetIncompleteSetup();

  // Hide if all required setup is complete
  if (isReadyForPOS) {
    return null;
  }

  const { completedCount, requiredCount, missingDetails } = incompleteSetup;
  const progressPercentage = Math.round((completedCount / requiredCount) * 100);

  return (
    <motion.div
      className="mb-8 space-y-8"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Progress Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-purple-500/10 border-2 border-orange-500/20 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex-shrink-0">
            {completedCount === requiredCount ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              <AlertCircle className="w-6 h-6 text-white" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              {completedCount === requiredCount ? (
                <>
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  Setup Complete! 🎉
                </>
              ) : (
                "Let's finish setting up your restaurant!"
              )}
            </h3>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <span className="font-semibold">
                  Essential Steps: {completedCount} of {requiredCount} complete
                </span>
                <span className="font-bold text-white">{progressPercentage}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Missing Items or Success Message */}
            {missingDetails.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm text-orange-200 font-semibold">
                  {completedCount === 0 ? (
                    "Welcome! Complete these steps to start using the POS:"
                  ) : completedCount === requiredCount - 1 ? (
                    "🎯 Almost there! Just one more step:"
                  ) : (
                    "Still needed:"
                  )}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {missingDetails.map((detail, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-orange-200 border border-orange-300/30"
                    >
                      {detail}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-green-200 font-semibold">
                <strong>All set!</strong> Your restaurant is ready for business. The POS system is now unlocked!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Required Cards Grid - Only show incomplete ones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {incompleteSetup.missingBasics && (
            <RestaurantBasicsCard key="basics" />
          )}
          {incompleteSetup.missingTaxBilling && (
            <TaxBillingCard key="tax" />
          )}
          {incompleteSetup.missingMenu && (
            <MenuSetupCard key="menu" />
          )}
          {incompleteSetup.missingFloorPlan && (
            <FloorPlanCard key="floor" />
          )}
          {incompleteSetup.missingStaff && (
            <StaffManagementCard key="staff" />
          )}
        </AnimatePresence>
      </div>

      {/* Encouragement Message */}
      {completedCount > 0 && completedCount < requiredCount && (
        <motion.div
          className="text-center p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-indigo-200">
            {completedCount === 1 && "🎉 Great start! Keep going..."}
            {completedCount === 2 && "💪 You're making great progress!"}
            {completedCount === 3 && "🚀 More than halfway there!"}
            {completedCount === 4 && "⭐ Almost done! Just one more step!"}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * TrainingModeScreen Component
 * Choose between Setup and Training mode and Live mode (REQUIRED)
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Rocket, Check, AlertCircle } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { cn } from '../../../lib/utils';

export function TrainingModeScreen() {
  const { wizardData, updateWizardData } = useSetupWizardStore();
  const [selectedMode, setSelectedMode] = useState<boolean | null>(
    wizardData.trainingMode !== undefined ? wizardData.trainingMode : null
  );

  useEffect(() => {
    if (selectedMode !== null) {
      updateWizardData({ trainingMode: selectedMode });
    }
  }, [selectedMode, updateWizardData]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Choose Your Mode</h2>
        <p className="text-muted-foreground">You can change this anytime in Settings</p>
      </motion.div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Training Mode */}
        <motion.button
          onClick={() => setSelectedMode(true)}
          className={cn(
            'relative p-8 rounded-3xl border-2 text-left transition-all',
            selectedMode === true
              ? 'border-saffron bg-gradient-to-br from-saffron/10 to-paprika/5 shadow-2xl scale-105'
              : 'border-border hover:border-border-strong bg-card shadow-lg hover:shadow-xl'
          )}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Selection Badge */}
          {selectedMode === true && (
            <motion.div
              className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-gradient-to-br from-paprika to-saffron flex items-center justify-center shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500 }}
            >
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            </motion.div>
          )}

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center mb-6">
            <GraduationCap className="w-8 h-8 text-blue-500" />
          </div>

          {/* Content */}
          <h3 className="text-2xl font-bold mb-3">Setup and Training Mode</h3>
          <p className="text-sm font-medium text-saffron mb-4 uppercase tracking-wide">
            Recommended for New Users
          </p>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Practice without affecting live data. Perfect for getting familiar with the system and training your staff.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {[
              'No cloud sync - all data stays local',
              'Experiment freely without consequences',
              'Switch to Live mode anytime',
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </motion.button>

        {/* Live Mode */}
        <motion.button
          onClick={() => setSelectedMode(false)}
          className={cn(
            'relative p-8 rounded-3xl border-2 text-left transition-all',
            selectedMode === false
              ? 'border-saffron bg-gradient-to-br from-saffron/10 to-paprika/5 shadow-2xl scale-105'
              : 'border-border hover:border-border-strong bg-card shadow-lg hover:shadow-xl'
          )}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Selection Badge */}
          {selectedMode === false && (
            <motion.div
              className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-gradient-to-br from-paprika to-saffron flex items-center justify-center shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500 }}
            >
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            </motion.div>
          )}

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center mb-6">
            <Rocket className="w-8 h-8 text-green-500" />
          </div>

          {/* Content */}
          <h3 className="text-2xl font-bold mb-3">Live Mode</h3>
          <p className="text-sm font-medium text-green-600 mb-4 uppercase tracking-wide">
            Start Taking Real Orders
          </p>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            All orders are recorded and synced to the cloud. Use this when you're ready to operate your restaurant.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {[
              'Real-time cloud sync across devices',
              'All data is recorded and backed up',
              'Full reporting and analytics',
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/30">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-warning/90">
                Make sure your menu, staff, and settings are configured before going live.
              </p>
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}

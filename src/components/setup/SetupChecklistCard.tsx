/**
 * SetupChecklistCard Component
 * Shows incomplete setup items on Hub page with quick actions
 */

import { motion } from 'framer-motion';
import { ListChecks, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSetupWizardStore, OPTIONAL_SETUP_LABELS } from '../../stores/setupWizardStore';

export function SetupChecklistCard() {
  const navigate = useNavigate();
  const {
    hasIncompleteSetup,
    checklistDismissed,
    dismissChecklist,
    getIncompleteOptionalItems,
    skippedScreens,
  } = useSetupWizardStore();

  // Don't show if setup is complete, or checklist is dismissed
  if (!hasIncompleteSetup() || checklistDismissed) {
    return null;
  }

  // Build incomplete items list
  const incompleteItems: Array<{ id: string; title: string; path: string }> = [];

  // Check for skipped legal info
  if (skippedScreens.has('legal_info')) {
    incompleteItems.push({
      id: 'legal_info',
      title: 'Legal & Tax IDs',
      path: '/settings',
    });
  }

  // Add incomplete optional items
  const incompleteOptional = getIncompleteOptionalItems();
  incompleteOptional.forEach((item) => {
    const config = OPTIONAL_SETUP_LABELS[item];
    incompleteItems.push({
      id: item,
      title: config.title,
      path: '/settings',
    });
  });

  if (incompleteItems.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-saffron/10 to-paprika/5 border border-saffron/30"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-saffron/20 rounded-xl flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-saffron" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Complete Your Setup</h3>
            <p className="text-sm text-muted-foreground">
              {incompleteItems.length} recommended step{incompleteItems.length !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>
        <button
          onClick={dismissChecklist}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Incomplete Items List */}
      <div className="space-y-2">
        {incompleteItems.map((item, index) => (
          <motion.button
            key={item.id}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-card/50 hover:bg-card border border-border hover:border-saffron/30 transition-all text-left group"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ x: 4 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-sm font-medium text-foreground">{item.title}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-saffron transition-colors" />
          </motion.button>
        ))}
      </div>

      {/* Action Button */}
      <div className="mt-4">
        <button
          onClick={() => navigate('/settings')}
          className="text-sm font-medium text-saffron hover:text-paprika transition-colors"
        >
          Go to Settings →
        </button>
      </div>
    </motion.div>
  );
}

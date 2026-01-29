/**
 * OptionalSelectorScreen Component
 * Let users choose which optional setup items to configure now
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { useSetupWizardStore, OPTIONAL_SETUP_ITEMS, OPTIONAL_SETUP_LABELS, OptionalSetupItem } from '../../../stores/setupWizardStore';
import { SetupCard } from '../SetupCard';

export function OptionalSelectorScreen() {
  const { selectedOptionalItems, setSelectedOptionalItems } = useSetupWizardStore();
  const [selected, setSelected] = useState<OptionalSetupItem[]>(selectedOptionalItems);

  useEffect(() => {
    setSelectedOptionalItems(selected);
  }, [selected, setSelectedOptionalItems]);

  const toggleItem = (item: OptionalSetupItem) => {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-paprika/20 to-saffron/10 flex items-center justify-center">
          <Wrench className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Optional Setup</h2>
        <p className="text-muted-foreground">Choose what you'd like to set up now. You can always configure these later in Settings.</p>
      </motion.div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {OPTIONAL_SETUP_ITEMS.map((item, index) => {
          const config = OPTIONAL_SETUP_LABELS[item];
          return (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <SetupCard
                title={config.title}
                description={config.description}
                icon={config.icon}
                selected={selected.includes(item)}
                onToggle={() => toggleItem(item)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Info */}
      <motion.div
        className="mt-8 text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p>Selected {selected.length} of {OPTIONAL_SETUP_ITEMS.length} optional items</p>
      </motion.div>
    </div>
  );
}

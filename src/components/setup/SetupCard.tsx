/**
 * SetupCard Component
 * Interactive card for optional step selection in setup wizard
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SetupCardProps {
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}

export function SetupCard({
  title,
  description,
  icon,
  selected,
  onToggle,
  className = '',
}: SetupCardProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        'relative w-full p-6 rounded-2xl text-left transition-all duration-200',
        'border-2',
        selected
          ? 'border-saffron bg-gradient-to-br from-saffron/10 to-paprika/5 shadow-lg'
          : 'border-border hover:border-border-strong bg-card shadow-sm hover:shadow-md',
        className
      )}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Selection Indicator */}
      <div
        className={cn(
          'absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all',
          selected
            ? 'bg-gradient-to-br from-paprika to-saffron text-white scale-100'
            : 'bg-surface-2 border-2 border-border scale-90'
        )}
      >
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </motion.div>
        )}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-3xl transition-all',
          selected
            ? 'bg-gradient-to-br from-saffron/20 to-paprika/10'
            : 'bg-surface-2'
        )}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="pr-8">
        <h3 className="font-bold text-lg mb-1 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.button>
  );
}

/**
 * ProgressBar Component
 * Thin horizontal progress bar for setup wizard (macOS style)
 */

import { motion } from 'framer-motion';

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ current, total, className = '' }: ProgressBarProps) {
  const progress = (current / total) * 100;

  return (
    <div className={`w-full h-1 bg-surface-2 overflow-hidden ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-paprika to-saffron"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

/**
 * SetupNavigation Component
 * Back/Next/Skip navigation buttons for setup wizard
 */

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SetupNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  isNextDisabled?: boolean;
  nextLabel?: string;
  skipLabel?: string;
  backLabel?: string;
  className?: string;
}

export function SetupNavigation({
  onBack,
  onNext,
  onSkip,
  isNextDisabled = false,
  nextLabel = 'Continue',
  skipLabel = 'Skip for Now',
  backLabel = 'Back',
  className = '',
}: SetupNavigationProps) {
  return (
    <div className={cn('fixed bottom-0 left-0 right-0 z-40', className)}>
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          {/* Back Button */}
          <div className="flex-1">
            {onBack && (
              <motion.button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
                whileHover={{ x: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">{backLabel}</span>
              </motion.button>
            )}
          </div>

          {/* Skip Button */}
          <div className="flex-1 flex justify-center">
            {onSkip && (
              <motion.button
                onClick={onSkip}
                className="flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors text-sm"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <SkipForward className="w-4 h-4" />
                <span className="font-medium">{skipLabel}</span>
              </motion.button>
            )}
          </div>

          {/* Next/Continue Button */}
          <div className="flex-1 flex justify-end">
            {onNext && (
              <motion.button
                onClick={onNext}
                disabled={isNextDisabled}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white',
                  'bg-gradient-to-r from-paprika to-saffron',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'shadow-lg hover:shadow-xl transition-shadow'
                )}
                whileHover={isNextDisabled ? {} : { y: -2, scale: 1.02 }}
                whileTap={isNextDisabled ? {} : { scale: 0.98 }}
              >
                <span className="font-bold">{nextLabel}</span>
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

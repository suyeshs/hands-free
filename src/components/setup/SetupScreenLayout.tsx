/**
 * SetupScreenLayout Component
 * Common layout wrapper for all setup wizard screens
 * Provides: animated background, progress bar, content area, navigation
 */

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ProgressBar } from './ProgressBar';
import { SetupNavigation } from './SetupNavigation';
import { cn } from '../../lib/utils';

interface SetupScreenLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  isNextDisabled?: boolean;
  nextLabel?: string;
  skipLabel?: string;
  showProgress?: boolean;
  className?: string;
}

// Page transition variants
export const pageTransition = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

export function SetupScreenLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSkip,
  isNextDisabled = false,
  nextLabel,
  skipLabel,
  showProgress = true,
  className = '',
}: SetupScreenLayoutProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-surface-1 to-surface-2 overflow-hidden">
      {/* Animated Ambient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-saffron/10 to-transparent blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-paprika/10 to-transparent blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <ProgressBar current={currentStep} total={totalSteps} />
        </div>
      )}

      {/* Main Content Area */}
      <motion.div
        className={cn(
          'relative z-10 max-w-4xl mx-auto px-6 py-12 min-h-screen flex flex-col',
          className
        )}
        {...pageTransition}
      >
        {/* Content */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full">{children}</div>
        </div>

        {/* Spacer for fixed navigation */}
        <div className="h-24" />
      </motion.div>

      {/* Navigation Footer */}
      <SetupNavigation
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        isNextDisabled={isNextDisabled}
        nextLabel={nextLabel}
        skipLabel={skipLabel}
      />
    </div>
  );
}

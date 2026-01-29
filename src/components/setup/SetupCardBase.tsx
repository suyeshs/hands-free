/**
 * SetupCardBase Component
 * Reusable expandable card for setup requirements
 * Shows: incomplete state, in-progress state, completed state
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, AlertCircle, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SetupCardBaseProps {
  // Identity
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;

  // State
  completed: boolean;
  required: boolean;

  // Content
  children: React.ReactNode; // Form content when expanded

  // Actions
  onComplete?: () => void;
  onSkip?: () => void;

  // Optional
  badge?: string; // e.g., "Optional"
  completionMessage?: string;
}

export function SetupCardBase({
  id: _id, // Unused but kept for prop interface consistency
  title,
  description,
  icon: Icon,
  completed,
  required,
  children,
  onComplete,
  onSkip,
  badge,
  completionMessage,
}: SetupCardBaseProps) {
  // Start collapsed by default - cards expand on click
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Smooth scroll into view when card expands
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      // Wait for expand animation to complete before scrolling
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  }, [isExpanded]);

  const handleToggleExpand = () => {
    if (!completed) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      className={cn(
        'relative rounded-3xl overflow-hidden transition-all duration-300 backdrop-blur-lg',
        completed
          ? 'bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-teal-500/5 border border-green-500/20'
          : required
          ? 'bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10 border-2 border-amber-500/30'
          : 'bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20',
        !completed && 'hover:border-saffron/50 hover:shadow-xl hover:shadow-saffron/10',
        completed && 'opacity-70'
      )}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header - Widget Style */}
      <button
        onClick={handleToggleExpand}
        className={cn(
          "group w-full p-8 text-left relative",
          !completed && "cursor-pointer active:scale-[0.99] transition-all"
        )}
        disabled={completed}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
      >
        {/* Background gradient overlay on hover */}
        {!completed && (
          <div className="absolute inset-0 bg-gradient-to-br from-saffron/0 via-saffron/0 to-saffron/0 group-hover:from-saffron/5 group-hover:via-saffron/10 group-hover:to-saffron/5 transition-all duration-300" />
        )}

        <div className="relative z-10 flex items-start gap-6">
          {/* Large Icon Circle */}
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-lg',
              completed
                ? 'bg-gradient-to-br from-green-400 to-emerald-500 group-hover:shadow-green-500/30'
                : required
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 group-hover:shadow-saffron/40 group-hover:scale-110'
                : 'bg-gradient-to-br from-blue-400 to-indigo-500 group-hover:shadow-blue-500/30'
            )}
          >
            {completed ? (
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            ) : (
              <Icon className="w-10 h-10 text-white" strokeWidth={2} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-bold text-2xl text-white tracking-tight">
                {title}
              </h3>
              {badge && (
                <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-wider">
                  {badge}
                </span>
              )}
              {required && !completed && (
                <AlertCircle className="w-5 h-5 text-amber-300 animate-pulse" />
              )}
            </div>

            <p className="text-base text-gray-300 mb-1">
              {completed ? (completionMessage || 'Completed ✓') : description}
            </p>

            {/* Click hint when collapsed */}
            {!completed && !isExpanded && (
              <p className="text-sm text-saffron font-semibold mt-3 flex items-center gap-2 group-hover:gap-3 transition-all">
                <span>Click to configure</span>
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              </p>
            )}
          </div>

          {/* Expand Indicator - Minimal when collapsed */}
          {!completed && isExpanded && (
            <motion.div
              animate={{ rotate: 180 }}
              initial={{ rotate: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 mt-2"
            >
              <ChevronDown className="w-6 h-6 text-saffron" />
            </motion.div>
          )}
        </div>
      </button>

      {/* Expandable Form Content */}
      <AnimatePresence>
        {isExpanded && !completed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Separator line with gradient */}
            <div className="h-px bg-gradient-to-r from-transparent via-saffron/30 to-transparent mx-8" />

            <div className="px-8 pb-8 pt-6">
              {/* Form content with better spacing */}
              <div className="space-y-6">
                {children}
              </div>

              {/* Action Buttons - More prominent */}
              <div className="flex gap-4 mt-8">
                {onComplete && (
                  <button
                    onClick={onComplete}
                    className="flex-1 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:shadow-saffron/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    ✓ Complete Setup
                  </button>
                )}
                {!required && onSkip && (
                  <button
                    onClick={onSkip}
                    className="px-6 py-4 rounded-2xl border-2 border-white/20 text-gray-300 font-bold hover:bg-white/10 hover:border-white/30 transition-all"
                  >
                    Skip for Now
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

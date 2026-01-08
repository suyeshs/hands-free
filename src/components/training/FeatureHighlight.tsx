/**
 * Feature Highlight Component
 * Draws attention to specific UI elements during guided training
 */

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FeatureHighlightProps {
  selector: string;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onDismiss?: () => void;
  autoHide?: number; // ms to auto-hide
}

/**
 * Calculate tooltip position based on element and preferred position
 */
function calculateTooltipPosition(
  elementRect: DOMRect,
  position: 'top' | 'bottom' | 'left' | 'right',
  tooltipWidth: number = 250,
  tooltipHeight: number = 80
): { top: number; left: number; arrow: string } {
  const padding = 12;
  const arrowSize = 8;

  switch (position) {
    case 'top':
      return {
        top: elementRect.top - tooltipHeight - arrowSize - padding,
        left: elementRect.left + elementRect.width / 2 - tooltipWidth / 2,
        arrow: 'bottom',
      };
    case 'bottom':
      return {
        top: elementRect.bottom + arrowSize + padding,
        left: elementRect.left + elementRect.width / 2 - tooltipWidth / 2,
        arrow: 'top',
      };
    case 'left':
      return {
        top: elementRect.top + elementRect.height / 2 - tooltipHeight / 2,
        left: elementRect.left - tooltipWidth - arrowSize - padding,
        arrow: 'right',
      };
    case 'right':
      return {
        top: elementRect.top + elementRect.height / 2 - tooltipHeight / 2,
        left: elementRect.right + arrowSize + padding,
        arrow: 'left',
      };
  }
}

/**
 * Feature Highlight Component
 */
export function FeatureHighlight({
  selector,
  message,
  position = 'bottom',
  onDismiss,
  autoHide,
}: FeatureHighlightProps) {
  const [highlightPos, setHighlightPos] = useState<HighlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrow: string } | null>(
    null
  );
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Find and track element position
   */
  useEffect(() => {
    const updatePosition = () => {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightPos({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        setTooltipPos(calculateTooltipPosition(rect, position));
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Initial position update
    updatePosition();

    // Watch for DOM changes
    observerRef.current = new MutationObserver(updatePosition);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [selector, position]);

  /**
   * Auto-hide timer
   */
  useEffect(() => {
    if (autoHide && isVisible) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHide);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [autoHide, isVisible, onDismiss]);

  if (!isVisible || !highlightPos || !tooltipPos) return null;

  return createPortal(
    <AnimatePresence>
      {/* Spotlight overlay */}
      <motion.div
        className="fixed inset-0 z-[9998] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Semi-transparent background with cutout */}
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={highlightPos.left - 4}
                y={highlightPos.top - 4}
                width={highlightPos.width + 8}
                height={highlightPos.height + 8}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </motion.div>

      {/* Highlight border */}
      <motion.div
        className="fixed z-[9999] pointer-events-none"
        style={{
          top: highlightPos.top - 4,
          left: highlightPos.left - 4,
          width: highlightPos.width + 8,
          height: highlightPos.height + 8,
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-full h-full rounded-lg border-2 border-accent shadow-lg shadow-accent/30">
          {/* Animated pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-accent"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
      </motion.div>

      {/* Tooltip */}
      <motion.div
        className="fixed z-[10000] pointer-events-auto"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: 250,
        }}
        initial={{ opacity: 0, y: position === 'top' ? 10 : position === 'bottom' ? -10 : 0, x: position === 'left' ? 10 : position === 'right' ? -10 : 0 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="relative bg-card border border-border rounded-xl shadow-xl p-4">
          {/* Arrow */}
          <div
            className={`
              absolute w-3 h-3 bg-card border-border transform rotate-45
              ${tooltipPos.arrow === 'top' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t' : ''}
              ${tooltipPos.arrow === 'bottom' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b' : ''}
              ${tooltipPos.arrow === 'left' ? 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-l border-b' : ''}
              ${tooltipPos.arrow === 'right' ? 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-r border-t' : ''}
            `}
          />

          {/* Message */}
          <p className="text-sm text-foreground">{message}</p>

          {/* Dismiss button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="mt-3 w-full py-2 text-xs font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
            >
              Got it
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/**
 * Multiple highlights container
 */
interface HighlightConfig {
  id: string;
  selector: string;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface FeatureHighlightsProps {
  highlights: HighlightConfig[];
  onDismiss?: (id: string) => void;
  onDismissAll?: () => void;
}

export function FeatureHighlights({ highlights, onDismiss, onDismissAll }: FeatureHighlightsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDismiss = () => {
    const current = highlights[currentIndex];
    if (current && onDismiss) {
      onDismiss(current.id);
    }

    if (currentIndex < highlights.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onDismissAll?.();
    }
  };

  if (highlights.length === 0 || currentIndex >= highlights.length) return null;

  const current = highlights[currentIndex];

  return (
    <FeatureHighlight
      key={current.id}
      selector={current.selector}
      message={current.message}
      position={current.position}
      onDismiss={handleDismiss}
    />
  );
}

export default FeatureHighlight;

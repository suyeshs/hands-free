'use client';

import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useCardSetup } from '../../../contexts/CardSetupContext';
import { SetupCardId } from './types/setup-cards';

/**
 * Setup Card Grid
 * Manages layout transformation between grid and row modes
 *
 * Features:
 * - Grid mode: 3-column layout on desktop
 * - Row mode: Horizontal row when card is active
 * - Smooth Framer Motion transitions using LayoutGroup
 * - Spring physics animations
 */

interface SetupCardGridProps {
  children: React.ReactNode;
}

export function SetupCardGrid({ children }: SetupCardGridProps) {
  const { state } = useCardSetup();
  const isCompactMode = state.activeCardId !== null;

  return (
    <LayoutGroup>
      <motion.div
        layout
        className={`
          grid gap-6 transition-all duration-400
          ${
            isCompactMode
              ? 'grid-cols-5 gap-4'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }
        `}
        transition={{
          layout: {
            type: 'spring',
            bounce: 0.2,
            duration: 0.4,
          },
        }}
      >
        {children}
      </motion.div>
    </LayoutGroup>
  );
}

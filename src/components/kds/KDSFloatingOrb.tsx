/**
 * KDS Floating Orb Component
 * A floating action button for the Kitchen Display System
 * Replaces the bottom bar with a mobile-app-like FAB
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  Home,
  Ban,
  RefreshCw,
  BarChart2,
  X,
  History,
  ClipboardList,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { springConfig, floatingElementVariants, backdropVariants } from '../../lib/motion/variants';

interface KDSOrbMenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: number;
  variant?: 'default' | 'danger';
}

interface KDSFloatingOrbProps {
  isOpen: boolean;
  onToggle: () => void;
  activeOrderCount: number;
  urgentOrderCount: number;
  oosCount: number;
  onNavigateHome: () => void;
  onOpen86Manager: () => void;
  onRefresh: () => void;
  onToggleStats: () => void;
  showStats: boolean;
  onToggleHistory?: () => void;
  isHistoryView?: boolean;
}

// Radial menu positions (angle in degrees, distance in pixels)
const menuPositions = [
  { angle: -90, distance: 80 },   // Top - Home
  { angle: -135, distance: 80 },  // Top-Left - History
  { angle: -180, distance: 80 },  // Left - 86'd
  { angle: 135, distance: 80 },   // Bottom-Left - Refresh
  { angle: 180, distance: 80 },   // Bottom - Stats (hidden behind Left)
];

// Calculate x,y from angle and distance
const getPosition = (angle: number, distance: number) => ({
  x: Math.cos((angle * Math.PI) / 180) * distance,
  y: Math.sin((angle * Math.PI) / 180) * distance,
});

export function KDSFloatingOrb({
  isOpen,
  onToggle,
  activeOrderCount,
  urgentOrderCount,
  oosCount,
  onNavigateHome,
  onOpen86Manager,
  onRefresh,
  onToggleStats,
  showStats,
  onToggleHistory,
  isHistoryView,
}: KDSFloatingOrbProps) {
  const menuItems: KDSOrbMenuItem[] = [
    {
      id: 'home',
      icon: Home,
      label: 'Home',
      onClick: onNavigateHome,
    },
    {
      id: 'history',
      icon: isHistoryView ? ClipboardList : History,
      label: isHistoryView ? 'Active' : 'History',
      onClick: onToggleHistory || (() => {}),
    },
    {
      id: '86',
      icon: Ban,
      label: "86'd",
      onClick: onOpen86Manager,
      badge: oosCount > 0 ? oosCount : undefined,
      variant: oosCount > 0 ? 'danger' : 'default',
    },
    {
      id: 'refresh',
      icon: RefreshCw,
      label: 'Refresh',
      onClick: onRefresh,
    },
    {
      id: 'stats',
      icon: BarChart2,
      label: showStats ? 'Hide Stats' : 'Show Stats',
      onClick: onToggleStats,
    },
  ];

  const handleItemClick = (item: KDSOrbMenuItem) => {
    item.onClick();
    // Close menu after action (except for stats toggle which is instant feedback)
    if (item.id !== 'stats') {
      onToggle();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* FAB Container */}
      <div
        className="fixed z-50"
        style={{
          right: 16,
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Radial Menu Items */}
        <AnimatePresence>
          {isOpen &&
            menuItems.map((item, index) => {
              const pos = getPosition(
                menuPositions[index].angle,
                menuPositions[index].distance
              );
              const Icon = item.icon;

              return (
                <motion.button
                  key={item.id}
                  className={cn(
                    'absolute w-14 h-14 rounded-full flex items-center justify-center',
                    'shadow-lg touch-target',
                    item.variant === 'danger'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  )}
                  style={{
                    // Position from center of FAB (which is 64x64, so offset by 32)
                    right: 32 - 28, // 28 = half of menu item width (56/2)
                    bottom: 32 - 28,
                  }}
                  initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    x: pos.x,
                    y: pos.y,
                    transition: {
                      delay: index * 0.05,
                      ...springConfig.snappy,
                    },
                  }}
                  exit={{
                    scale: 0,
                    opacity: 0,
                    x: 0,
                    y: 0,
                    transition: { duration: 0.15 },
                  }}
                  onClick={() => handleItemClick(item)}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon size={24} />
                  {/* Badge */}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
        </AnimatePresence>

        {/* Main FAB Orb */}
        <motion.button
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center',
            'bg-slate-800 border-2 border-slate-600 shadow-xl touch-target-lg',
            'transition-colors',
            isOpen ? 'bg-slate-700' : 'bg-slate-800'
          )}
          style={{
            boxShadow: urgentOrderCount > 0
              ? '0 4px 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2)'
              : '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
          variants={floatingElementVariants}
          initial="hidden"
          animate="visible"
          whileTap={{ scale: 0.95 }}
          onClick={onToggle}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X size={28} className="text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="chef"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChefHat size={28} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Order Count Badge */}
          {!isOpen && activeOrderCount > 0 && (
            <motion.span
              className={cn(
                'absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full flex items-center justify-center text-xs font-black',
                urgentOrderCount > 0
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-blue-500 text-white'
              )}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={springConfig.quick}
            >
              {activeOrderCount}
            </motion.span>
          )}
        </motion.button>

        {/* Urgent Pulse Ring */}
        {urgentOrderCount > 0 && !isOpen && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-500"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>
    </>
  );
}

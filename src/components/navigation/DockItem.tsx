/**
 * DockItem Component
 * Individual dock icon with magnification effect and active state indicator
 */

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { springConfig } from '../../lib/motion/variants';

export interface DockItemProps {
  /** Unique identifier */
  id: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Display label */
  label: string;
  /** Navigation path */
  path: string;
  /** Whether this item is currently active */
  isActive: boolean;
  /** Click handler */
  onClick: () => void;
  /** Base size of the icon container */
  baseSize?: number;
  /** Maximum scale on hover */
  maxScale?: number;
}

export function DockItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  baseSize = 48,
  maxScale = 1.4,
}: DockItemProps) {
  // Calculate scale based on mouse distance
  const distance = useMotionValue(200); // Start far away

  // Transform distance to scale (closer = larger)
  const scaleValue = useTransform(
    distance,
    [-150, 0, 150],
    [1, maxScale, 1]
  );

  // Smooth the scale with spring physics
  const scale = useSpring(scaleValue, {
    damping: 30,
    stiffness: 400,
  });

  // Transform distance to Y offset (lift effect)
  const yValue = useTransform(
    distance,
    [-150, 0, 150],
    [0, -8, 0]
  );

  const y = useSpring(yValue, {
    damping: 30,
    stiffness: 400,
  });

  // Update distance when mouse moves
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    distance.set(event.clientX - centerX);
  };

  const handleMouseLeave = () => {
    distance.set(200); // Reset to far away
  };

  return (
    <motion.div
      className="dock-item relative flex flex-col items-center justify-end cursor-pointer select-none group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ scale, y }}
      whileTap={{ scale: 0.95 }}
      transition={springConfig.quick}
    >
      {/* Icon Container */}
      <motion.div
        className={cn(
          'dock-item-icon flex items-center justify-center rounded-xl transition-all duration-200',
          isActive
            ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/40'
            : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
        )}
        style={{
          width: baseSize,
          height: baseSize,
        }}
      >
        <Icon
          className={cn(
            'transition-all duration-200',
            isActive ? 'w-6 h-6' : 'w-5 h-5 group-hover:w-6 group-hover:h-6'
          )}
        />
      </motion.div>

      {/* Label - appears on hover */}
      <motion.span
        className="dock-item-label absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1
                   text-[11px] font-medium text-white bg-gray-900/90 rounded-md
                   whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity
                   pointer-events-none shadow-lg"
        initial={{ opacity: 0, y: 5 }}
        whileHover={{ opacity: 1, y: 0 }}
      >
        {label}
      </motion.span>

      {/* Active indicator dot */}
      {isActive && (
        <motion.div
          className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-orange-500"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={springConfig.quick}
        />
      )}
    </motion.div>
  );
}

/**
 * Settings Category Card
 * Large card showing a category with icon, title, description
 * Used in the main settings page to show 6 category groups
 */

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type AccentColor = 'orange' | 'green' | 'blue' | 'purple' | 'teal' | 'gray';

interface SettingsCategoryCardProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accentColor: AccentColor;
  badgeCount?: number;
  priority?: boolean;
  onClick: () => void;
}

const colorClasses: Record<AccentColor, { bg: string; border: string; text: string; icon: string }> = {
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30 group-hover:border-orange-500/50',
    text: 'text-orange-600',
    icon: 'bg-orange-500/20',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30 group-hover:border-green-500/50',
    text: 'text-green-600',
    icon: 'bg-green-500/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30 group-hover:border-blue-500/50',
    text: 'text-blue-600',
    icon: 'bg-blue-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30 group-hover:border-purple-500/50',
    text: 'text-purple-600',
    icon: 'bg-purple-500/20',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30 group-hover:border-teal-500/50',
    text: 'text-teal-600',
    icon: 'bg-teal-500/20',
  },
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30 group-hover:border-gray-500/50',
    text: 'text-gray-600',
    icon: 'bg-gray-500/20',
  },
};

export function SettingsCategoryCard({
  title,
  description,
  icon: Icon,
  accentColor,
  badgeCount,
  priority,
  onClick,
}: SettingsCategoryCardProps) {
  const colors = colorClasses[accentColor];

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'group relative w-full p-6 rounded-2xl border-2 text-left transition-all',
        'hover:scale-[1.02] hover:shadow-lg',
        colors.bg,
        colors.border
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Badge Count */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
          {badgeCount > 99 ? '99+' : badgeCount}
        </div>
      )}

      {/* Priority Indicator */}
      {priority && (
        <div className="absolute top-4 right-4">
          <div className={cn('px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider', colors.text, colors.bg)}>
            Popular
          </div>
        </div>
      )}

      {/* Icon */}
      <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110', colors.icon)}>
        <Icon size={32} className={colors.text} />
      </div>

      {/* Content */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {/* Hover Arrow */}
      <div className="mt-4 flex items-center gap-1 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={colors.text}>View settings</span>
        <svg
          className={cn('w-4 h-4 transition-transform group-hover:translate-x-1', colors.text)}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
}

/**
 * Settings Category Detail
 * Shows list of settings within a selected category
 * Displays breadcrumb navigation and individual setting cards
 */

import { LucideIcon, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface SettingItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badgeCount?: number;
}

interface SettingsCategoryDetailProps {
  categoryTitle: string;
  categoryIcon: LucideIcon;
  accentColor: 'orange' | 'green' | 'blue' | 'purple' | 'teal' | 'gray';
  settings: SettingItem[];
  onBack: () => void;
  onSelectSetting: (settingId: string) => void;
}

const colorClasses: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30 hover:border-orange-500/50',
    text: 'text-orange-600',
    icon: 'bg-orange-500/20',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30 hover:border-green-500/50',
    text: 'text-green-600',
    icon: 'bg-green-500/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30 hover:border-blue-500/50',
    text: 'text-blue-600',
    icon: 'bg-blue-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30 hover:border-purple-500/50',
    text: 'text-purple-600',
    icon: 'bg-purple-500/20',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30 hover:border-teal-500/50',
    text: 'text-teal-600',
    icon: 'bg-teal-500/20',
  },
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30 hover:border-gray-500/50',
    text: 'text-gray-600',
    icon: 'bg-gray-500/20',
  },
};

export function SettingsCategoryDetail({
  categoryTitle,
  categoryIcon: CategoryIcon,
  accentColor,
  settings,
  onBack,
  onSelectSetting,
}: SettingsCategoryDetailProps) {
  const colors = colorClasses[accentColor];

  return (
    <div className="min-h-full">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Settings
        </button>
        <ChevronRight size={16} className="text-muted-foreground" />
        <span className="text-foreground font-medium">{categoryTitle}</span>
      </div>

      {/* Category Header */}
      <div className={cn('p-6 rounded-2xl border-2 mb-6', colors.bg, colors.border)}>
        <div className="flex items-center gap-4">
          <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center', colors.icon)}>
            <CategoryIcon size={36} className={colors.text} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{categoryTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {settings.length} setting{settings.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-3">
        {settings.map((setting, index) => {
          const SettingIcon = setting.icon;
          return (
            <motion.button
              key={setting.id}
              onClick={() => onSelectSetting(setting.id)}
              className="group relative w-full p-4 rounded-xl border-2 border-border bg-card text-left transition-all hover:bg-surface-2 hover:border-accent/50 hover:shadow-md"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Badge Count */}
              {setting.badgeCount !== undefined && setting.badgeCount > 0 && (
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                  {setting.badgeCount > 99 ? '99+' : setting.badgeCount}
                </div>
              )}

              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
                  <SettingIcon size={24} className="text-accent" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-0.5">
                    {setting.label}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {setting.description}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight
                  size={20}
                  className="text-muted-foreground group-hover:text-accent transition-all group-hover:translate-x-1 flex-shrink-0"
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

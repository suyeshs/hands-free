/**
 * FloatingNavBlob Component
 * A floating navigation button in the top-right corner
 * Expands to show navigation options when clicked
 * Uses same nav items as FloatingDock with role-based visibility
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  X,
  Menu,
  CreditCard,
  ChefHat,
  Package,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types/auth';
import { isDesktop } from '../../lib/platform';

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  roles: (UserRole | '*')[];
  desktopOnly?: boolean; // Hide on mobile devices
}

// Nav items - some are desktop only
const navItems: NavItem[] = [
  {
    id: 'home',
    icon: Home,
    label: 'Home',
    path: '/hub',
    roles: ['*'],
  },
  {
    id: 'pos',
    icon: CreditCard,
    label: 'POS',
    path: '/pos',
    roles: [UserRole.SERVER, UserRole.MANAGER],
    desktopOnly: true, // POS is desktop only
  },
  {
    id: 'kitchen',
    icon: ChefHat,
    label: 'Kitchen',
    path: '/kitchen',
    roles: [UserRole.KITCHEN, UserRole.MANAGER],
  },
  {
    id: 'aggregator',
    icon: Package,
    label: 'Deliveries',
    path: '/aggregator',
    roles: [UserRole.AGGREGATOR, UserRole.MANAGER],
    desktopOnly: true, // Aggregator is desktop only
  },
  {
    id: 'service',
    icon: Users,
    label: 'Service',
    path: '/service',
    roles: [UserRole.SERVER, UserRole.MANAGER],
  },
  {
    id: 'reports',
    icon: BarChart3,
    label: 'Reports',
    path: '/sales-report',
    roles: [UserRole.MANAGER],
    desktopOnly: true, // Reports is desktop only
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    path: '/settings',
    roles: [UserRole.MANAGER],
  },
];

export interface FloatingNavBlobProps {
  className?: string;
}

export function FloatingNavBlob({ className }: FloatingNavBlobProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const isDesktopDevice = isDesktop();

  // Filter nav items based on user role and platform
  const visibleItems = navItems.filter((item) => {
    // Hide desktop-only items on mobile (regardless of user role)
    if (!isDesktopDevice && item.desktopOnly) return false;
    if (!user) return item.roles.includes('*');
    return item.roles.includes('*') || item.roles.includes(user.role);
  });

  // Get current active item based on path
  const getActiveId = () => {
    const path = location.pathname;
    // Find exact match first
    const exactMatch = visibleItems.find((item) => item.path === path);
    if (exactMatch) return exactMatch.id;
    // Find partial match (for nested routes)
    const partialMatch = visibleItems.find(
      (item) => item.path !== '/hub' && path.startsWith(item.path)
    );
    return partialMatch?.id || 'home';
  };

  const activeId = getActiveId();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div
      ref={menuRef}
      className={cn('fixed top-4 right-4 z-50', className)}
    >
      {/* Main Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors',
          'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700',
          isOpen && 'bg-zinc-700'
        )}
        whileTap={{ scale: 0.95 }}
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
              <X className="w-5 h-5 text-zinc-300" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Menu className="w-5 h-5 text-zinc-300" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Expanded Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-14 right-0 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-xl overflow-hidden min-w-[180px]"
          >
            {/* Nav items */}
            {visibleItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    'hover:bg-zinc-700',
                    isActive && 'bg-zinc-700/50',
                    index < visibleItems.length - 1 && 'border-b border-zinc-700/50'
                  )}
                >
                  <Icon className={cn(
                    'w-5 h-5',
                    isActive ? 'text-orange-400' : 'text-zinc-400'
                  )} />
                  <span className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-orange-400' : 'text-zinc-300'
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * FloatingDock Component
 * macOS-style floating dock navigation with magnification effect
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  CreditCard,
  ChefHat,
  Package,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { DockItem } from './DockItem';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types/auth';
import { floatingElementVariants } from '../../lib/motion/variants';
import { cn } from '../../lib/utils';

export interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  roles: (UserRole | '*')[];
}

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
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    path: '/manager',
    roles: [UserRole.MANAGER],
  },
];

export interface FloatingDockProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the dock */
  visible?: boolean;
}

export function FloatingDock({ className, visible = true }: FloatingDockProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // Filter nav items based on user role
  const visibleItems = navItems.filter((item) => {
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

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          className={cn(
            'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
            'flex items-end justify-center gap-2 px-5 py-3',
            'rounded-2xl',
            className
          )}
          style={{
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            // Enhanced glassmorphism
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.12),
              0 2px 8px rgba(0, 0, 0, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.6),
              inset 0 -1px 0 rgba(0, 0, 0, 0.05)
            `,
          }}
          variants={floatingElementVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {visibleItems.map((item) => (
            <DockItem
              key={item.id}
              id={item.id}
              icon={item.icon}
              label={item.label}
              path={item.path}
              isActive={activeId === item.id}
              onClick={() => handleNavigate(item.path)}
            />
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

// Named export for convenience
export { navItems as dockNavItems };

/**
 * ThemeProvider Component
 * Initializes and manages theme application within Router context
 * This component must be rendered inside a Router to access useLocation()
 */

import { useTheme } from '@/hooks/useTheme';

export function ThemeProvider() {
  // Initialize theme system
  // This hook uses useLocation() internally, so it must be inside Router
  useTheme();

  // This component doesn't render anything, it just initializes the theme
  return null;
}

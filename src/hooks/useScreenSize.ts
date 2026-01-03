/**
 * useScreenSize Hook
 * Provides responsive screen size detection for adaptive layouts
 */

import { useState, useEffect, useCallback } from 'react';

// Breakpoint definitions (matches Tailwind defaults)
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Custom breakpoint for POS layout (sidebar vs bottom sheet)
const COMPACT_BREAKPOINT = 768; // md breakpoint

export interface ScreenSize {
  width: number;
  height: number;
  isCompact: boolean;        // < 768px - show bottom sheet instead of sidebar
  isMobile: boolean;         // < 640px
  isTablet: boolean;         // 640-1023px
  isDesktop: boolean;        // >= 1024px
  isLargeDesktop: boolean;   // >= 1280px
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

function getScreenSize(): ScreenSize {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const height = typeof window !== 'undefined' ? window.innerHeight : 768;

  let breakpoint: ScreenSize['breakpoint'] = 'xs';
  if (width >= BREAKPOINTS['2xl']) breakpoint = '2xl';
  else if (width >= BREAKPOINTS.xl) breakpoint = 'xl';
  else if (width >= BREAKPOINTS.lg) breakpoint = 'lg';
  else if (width >= BREAKPOINTS.md) breakpoint = 'md';
  else if (width >= BREAKPOINTS.sm) breakpoint = 'sm';

  return {
    width,
    height,
    isCompact: width < COMPACT_BREAKPOINT,
    isMobile: width < BREAKPOINTS.sm,
    isTablet: width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isLargeDesktop: width >= BREAKPOINTS.xl,
    breakpoint,
  };
}

export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>(getScreenSize);

  const handleResize = useCallback(() => {
    const newSize = getScreenSize();
    setScreenSize((prev) => {
      // Only update if values actually changed to prevent unnecessary re-renders
      if (
        prev.width !== newSize.width ||
        prev.height !== newSize.height
      ) {
        return newSize;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    // Initial size
    handleResize();

    // Listen for window resize
    window.addEventListener('resize', handleResize);

    // Also listen for orientation change on mobile devices
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  return screenSize;
}

export default useScreenSize;

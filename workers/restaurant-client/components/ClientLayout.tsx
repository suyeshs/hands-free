'use client';

/**
 * Client Layout Wrapper
 *
 * Note: AuthProvider is NOT included here to avoid unnecessary auth checks
 * on customer-facing pages. Admin routes have their own AuthProvider in
 * app/admin/layout.tsx
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

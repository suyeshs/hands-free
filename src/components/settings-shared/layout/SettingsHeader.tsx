/**
 * Settings Header Component
 * Shared header for all settings plugin pages
 * Features: Back button, breadcrumb navigation, logout button
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export interface SettingsHeaderProps {
  title: string;
  breadcrumbs?: string[];
  onBack?: () => void;
}

export function SettingsHeader({
  title,
  breadcrumbs = ['Settings', 'Business Setup'],
  onBack,
}: SettingsHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/hub');
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('[SettingsHeader] Logout failed:', error);
      alert('Logout failed. Please try again.');
    }
  };

  return (
    <header className="flex-shrink-0 bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Back button + Breadcrumb */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-surface-2 transition-colors rounded-lg"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {breadcrumbs.join(' › ')}
              </div>
            )}

            {/* Page Title */}
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
          </div>
        </div>

        {/* Right: Logout button */}
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 status-error hover:bg-destructive/20 font-bold transition-colors rounded-lg"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
}

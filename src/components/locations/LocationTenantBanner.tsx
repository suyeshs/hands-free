/**
 * Location Tenant Banner
 * Displays a banner when viewing a location tenant to remind users this is a branch location
 */

import { Building2, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LocationTenantBannerProps {
  locationName?: string;
  masterTenantId?: string;
  className?: string;
  variant?: 'info' | 'warning';
}

export function LocationTenantBanner({
  locationName,
  masterTenantId,
  className,
  variant = 'info',
}: LocationTenantBannerProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 border-2 mb-6',
        variant === 'info' ? 'status-info' : 'status-pending',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <MapPin size={20} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold mb-1 flex items-center gap-2">
            <span>Location Settings</span>
            {locationName && (
              <span className="text-sm font-normal opacity-80">({locationName})</span>
            )}
          </h3>
          <p className="text-sm opacity-90">
            You are viewing settings for a branch location. Some settings are managed by the master tenant
            and cannot be modified at the location level.
          </p>
        </div>
        <Building2 size={18} className="flex-shrink-0 opacity-60" />
      </div>
    </div>
  );
}

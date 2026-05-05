/**
 * Tenant Switcher Component
 * Dropdown to switch between master and location tenants
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Building2, MapPin, Check, Loader2 } from 'lucide-react';
import { useTenantSwitcherStore } from '../../stores/tenantSwitcherStore';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export function TenantSwitcher() {
  const {
    currentTenant,
    availableTenants,
    isLoading,
    isSwitching,
    loadTenants,
    switchTenant,
  } = useTenantSwitcherStore();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load tenants on mount
  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSwitchTenant = async (tenantId: string, tenantType: 'master' | 'location') => {
    if (tenantId === currentTenant?.tenantId) {
      setIsOpen(false);
      return;
    }

    try {
      await switchTenant(tenantId, tenantType);
      setIsOpen(false);
      toast.success(`Switched to ${tenantType === 'master' ? 'Master' : 'Location'}`);

      // Reload the page to refresh all data
      window.location.reload();
    } catch (error) {
      toast.error('Failed to switch tenant');
    }
  };

  if (isLoading && !currentTenant) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!currentTenant) {
    return null;
  }

  // Only show switcher if there are multiple tenants
  if (availableTenants.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10">
        <Building2 className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold">{currentTenant.tenantName}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Tenant Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isOpen && "bg-white/10"
        )}
      >
        {currentTenant.tenantType === 'master' ? (
          <Building2 className="w-4 h-4 text-accent" />
        ) : (
          <MapPin className="w-4 h-4 text-blue-400" />
        )}
        <span className="text-sm font-semibold max-w-[200px] truncate">
          {currentTenant.tenantName}
        </span>
        {currentTenant.tenantType === 'location' && (
          <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold uppercase">
            Location
          </span>
        )}
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border shadow-2xl z-50 max-h-[400px] overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Switch Tenant
            </p>
          </div>

          {/* Tenant List */}
          <div className="py-2">
            {availableTenants.map((tenant) => {
              const isCurrent = tenant.tenantId === currentTenant.tenantId;

              return (
                <button
                  key={tenant.tenantId}
                  onClick={() => handleSwitchTenant(tenant.tenantId, tenant.tenantType)}
                  disabled={isSwitching || isCurrent}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isCurrent && "bg-accent/10"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "w-10 h-10 flex items-center justify-center flex-shrink-0",
                    tenant.tenantType === 'master'
                      ? "bg-accent/20"
                      : "bg-blue-500/20"
                  )}>
                    {tenant.tenantType === 'master' ? (
                      <Building2 className="w-5 h-5 text-accent" />
                    ) : (
                      <MapPin className="w-5 h-5 text-blue-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">
                        {tenant.tenantName}
                      </p>
                      {tenant.tenantType === 'master' && (
                        <span className="text-[10px] px-2 py-0.5 bg-accent/20 text-accent border border-accent/30 font-bold uppercase flex-shrink-0">
                          Master
                        </span>
                      )}
                    </div>
                    {tenant.tenantType === 'location' && tenant.subdomain && (
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {tenant.subdomain}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {tenant.tenantId}
                    </p>
                  </div>

                  {/* Current Indicator */}
                  {isCurrent && (
                    <Check className="w-5 h-5 text-accent flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-white/5">
            <p className="text-[10px] text-muted-foreground">
              Switching tenants will reload the app with the selected location's data
            </p>
          </div>
        </div>
      )}

      {/* Switching Overlay */}
      {isSwitching && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-background border border-border p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm font-semibold">Switching tenant...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantSwitcher;

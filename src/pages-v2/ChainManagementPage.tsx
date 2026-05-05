/**
 * Multi-Location Page
 * Main page for managing restaurant chains with tabbed navigation
 * IMPORTANT: This page is only accessible to master tenants, not locations
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Link2,
  MapPin,
  DollarSign,
  BarChart3,
  Smartphone,
  Store,
  TrendingUp,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useChainStore } from '../stores/chainStore';
import { useTenantStore } from '../stores/tenantStore';
import { useAuthStore } from '../stores/authStore';
import { useIsLocationTenant } from '../hooks/useIsLocationTenant';
import { MultiLocationManager } from '../components/admin/MultiLocationManager';
import { MenuOverrideManager } from '../components/admin/MenuOverrideManager';
import { ChainReportsPanel } from '../components/admin/ChainReportsPanel';
import { DeviceManagementPanel } from '../components/admin/DeviceManagementPanel';
import ChainSalesDashboard from './ChainSalesDashboard';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

type ChainTab = 'overview' | 'locations' | 'real-time-sales' | 'menu-overrides' | 'reports' | 'devices';

export default function ChainManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const { currentChain, locations, loadChain, loadLocations } = useChainStore();
  const { isLocation, locationMetadata, loading: locationCheckLoading } = useIsLocationTenant();

  const [activeTab, setActiveTab] = useState<ChainTab>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // For demo purposes, we'll use a mock chain ID
  // In production, this would come from tenant settings or URL params
  const chainId = 'demo-chain-001';
  const masterTenantId = tenant?.tenantId || user?.tenantId || '';

  // Load chain data on mount
  useEffect(() => {
    const loadChainData = async () => {
      if (!chainId) {
        toast.error('No chain ID found');
        setIsLoading(false);
        return;
      }

      try {
        await loadChain(chainId);
        await loadLocations(chainId);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load chain:', error);
        toast.error('Failed to load chain data');
        setIsLoading(false);
      }
    };

    loadChainData();
  }, [chainId, loadChain, loadLocations]);

  const tabs = [
    {
      id: 'overview' as ChainTab,
      label: 'Overview',
      icon: Store,
    },
    {
      id: 'locations' as ChainTab,
      label: 'Locations',
      icon: MapPin,
      badge: locations.length,
    },
    {
      id: 'real-time-sales' as ChainTab,
      label: 'Real-Time Sales',
      icon: TrendingUp,
    },
    {
      id: 'menu-overrides' as ChainTab,
      label: 'Menu Overrides',
      icon: DollarSign,
    },
    {
      id: 'reports' as ChainTab,
      label: 'Reports',
      icon: BarChart3,
    },
    {
      id: 'devices' as ChainTab,
      label: 'Devices',
      icon: Smartphone,
    },
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab chain={currentChain} locations={locations} />;
      case 'locations':
        return <MultiLocationManager chainId={chainId} masterTenantId={masterTenantId} />;
      case 'real-time-sales':
        return <ChainSalesDashboard />;
      case 'menu-overrides':
        return <MenuOverrideManager tenantId={masterTenantId} chainId={chainId} />;
      case 'reports':
        return <ChainReportsPanel chainId={chainId} />;
      case 'devices':
        return <DeviceManagementPanel />;
      default:
        return null;
    }
  };

  if (isLoading || locationCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Restrict access for location tenants
  if (isLocation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full">
          <div className="status-error p-6 rounded-2xl border-2">
            <div className="flex items-start gap-4">
              <AlertCircle size={32} className="flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                <p className="text-sm mb-4">
                  Chain Management is only available to master tenants. Location tenants cannot
                  create or manage chains.
                </p>
                <p className="text-sm mb-4 opacity-90">
                  <strong>Current Location:</strong> {locationMetadata?.currentLocationName || 'Unknown'}
                </p>
                <button
                  onClick={() => navigate('/hub')}
                  className="px-4 py-2 bg-surface-3 hover:bg-surface-2 text-foreground font-semibold rounded-lg transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chain-management-page min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/hub')}
                className="p-2 hover:bg-surface-2 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black uppercase tracking-tight">
                    {currentChain?.chainName || 'Multi-Location'}
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-black uppercase tracking-widest border border-accent/30">
                    Master Tenant
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Manage locations, menus, and reporting across all branches
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2  font-bold text-sm transition-all whitespace-nowrap",
                    isActive
                      ? "bg-accent text-white shadow-lg shadow-accent/20"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-black",
                      isActive ? "bg-white/20" : "bg-accent/20 text-accent"
                    )}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ chain, locations }: { chain: any; locations: any[] }) {
  const activeLocations = locations.filter(l => l.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* About Multi-Location */}
      <div className="glass-panel p-8 rounded-2xl border border-border">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-10 h-10 text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
              Multi-location management enables you to operate and monitor multiple restaurant branches from a single master device. Each location maintains its own tenant infrastructure while syncing with the master menu, allowing for centralized control with location-specific flexibility.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Master Tenant:</span>
                <span className="font-mono text-accent">{chain?.masterTenantId || 'Not configured'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Chain ID:</span>
                <span className="font-mono text-accent">{chain?.id || 'Auto-generated'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Active Locations:</span>
                <span className="font-bold text-foreground">{activeLocations} of {locations.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="glass-panel p-8 rounded-2xl border border-border">
        <div className="mb-6">
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">What You Can Do</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive tools for managing a restaurant chain with multiple locations
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-green-500/20 flex items-center justify-center flex-shrink-0 rounded-lg">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1 text-foreground">Location Provisioning</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create new locations with full cloud infrastructure (D1, KV, R2) and generate activation codes for branch devices. Each location gets its own isolated tenant.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center flex-shrink-0 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1 text-foreground">Menu Synchronization</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Push master menu updates to all locations. Locations can override pricing and availability for specific items while maintaining the core menu structure.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 bg-purple-500/20 flex items-center justify-center flex-shrink-0 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1 text-foreground">Cross-Location Analytics</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                View consolidated sales reports, performance metrics, and real-time order data across all your locations in a unified dashboard.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 bg-orange-500/20 flex items-center justify-center flex-shrink-0 rounded-lg">
              <Smartphone className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1 text-foreground">Device Fleet Management</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor and manage all POS devices across your chain. Track device status, online presence, and software versions from the master console.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Locations */}
      {locations.length > 0 && (
        <div className="glass-panel p-8 rounded-2xl border border-border">
          <div className="mb-6">
            <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">Your Locations</h3>
            <p className="text-sm text-muted-foreground">
              Recently added locations in your chain
            </p>
          </div>
          <div className="space-y-3">
            {locations.slice(0, 5).map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-accent/30 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    location.status === 'active' ? "bg-green-500/20" : "bg-red-500/20"
                  )}>
                    <Store className={cn(
                      "w-5 h-5",
                      location.status === 'active' ? "text-green-400" : "text-red-400"
                    )} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{location.locationName}</p>
                    <p className="text-xs text-muted-foreground">{location.city}, {location.state}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  location.status === 'active'
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                )}>
                  {location.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Getting Started */}
      {locations.length === 0 && (
        <div className="glass-panel p-8 rounded-2xl border border-border border-dashed">
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Ready to Add Your First Location?</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Head over to the Locations tab to create your first branch location. The system will provision all necessary cloud infrastructure and generate an activation code for the branch device.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
              <span>Click "Locations" above to get started</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

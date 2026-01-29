/**
 * Multi-Location Page
 * Main page for managing restaurant chains with tabbed navigation
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
  Award,
  TrendingUp,
} from 'lucide-react';
import { useChainStore } from '../stores/chainStore';
import { useTenantStore } from '../stores/tenantStore';
import { useAuthStore } from '../stores/authStore';
import { MultiLocationManager } from '../components/admin/MultiLocationManager';
import { MenuOverrideManager } from '../components/admin/MenuOverrideManager';
import { ChainReportsPanel } from '../components/admin/ChainReportsPanel';
import { DeviceManagementPanel } from '../components/admin/DeviceManagementPanel';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

type ChainTab = 'overview' | 'locations' | 'menu-overrides' | 'reports' | 'devices';

export default function ChainManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const { currentChain, locations, loadChain, loadLocations } = useChainStore();

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
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
      {/* Chain Info Card */}
      <div className="glass-panel p-8 rounded-2xl border border-border">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-10 h-10 text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">
              {chain?.chainName || 'Multi-Location Business'}
            </h2>
            <p className="text-muted-foreground mb-4">
              Manage all locations from a single master device
            </p>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Master Tenant:</span>
                <span className="ml-2 font-mono text-accent">{chain?.masterTenantId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Chain ID:</span>
                <span className="ml-2 font-mono text-accent">{chain?.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
            Active Locations
          </h3>
          <p className="text-4xl font-black text-foreground">{activeLocations}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {locations.length} total locations
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
            Total Sales
          </h3>
          <p className="text-4xl font-black text-foreground">₹1.2M</p>
          <p className="text-xs text-muted-foreground mt-1">
            Last 30 days
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center">
              <Award className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
            Top Location
          </h3>
          <p className="text-2xl font-bold text-foreground">Downtown</p>
          <p className="text-xs text-muted-foreground mt-1">
            ₹450K in sales
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="glass-panel p-8 rounded-2xl border border-border">
        <h3 className="text-xl font-black uppercase tracking-tight mb-6">Multi-Location Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Multi-Location Management</h4>
              <p className="text-sm text-muted-foreground">
                Add and manage multiple restaurant locations from one central dashboard
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Menu Overrides</h4>
              <p className="text-sm text-muted-foreground">
                Set location-specific pricing and availability without affecting master menu
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Consolidated Reporting</h4>
              <p className="text-sm text-muted-foreground">
                View sales, performance, and analytics across all locations
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Device Management</h4>
              <p className="text-sm text-muted-foreground">
                Monitor and control all POS devices across your chain
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Locations */}
      {locations.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-border">
          <h3 className="text-lg font-black uppercase tracking-tight mb-4">Recent Locations</h3>
          <div className="space-y-3">
            {locations.slice(0, 5).map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10  flex items-center justify-center",
                    location.status === 'active' ? "bg-green-500/20" : "bg-red-500/20"
                  )}>
                    <Store className={cn(
                      "w-5 h-5",
                      location.status === 'active' ? "text-green-400" : "text-red-400"
                    )} />
                  </div>
                  <div>
                    <p className="font-semibold">{location.locationName}</p>
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
    </div>
  );
}

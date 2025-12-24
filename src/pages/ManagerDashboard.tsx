import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useOnlineOrderStore } from '../stores/onlineOrderStore';
import { useKDSStore } from '../stores/kdsStore';
import { usePrinterStore } from '../stores/printerStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { Link } from 'react-router-dom';
import ReportsPanel from '../components/analytics/ReportsPanel';
import { MenuOnboarding } from '../components/admin/MenuOnboarding';
import { FloorPlanManager } from '../components/admin/FloorPlanManager';
import { StaffAssignmentManager } from '../components/admin/StaffAssignmentManager';
import { StaffManager } from '../components/admin/StaffManager';
import { DeviceSettings } from '../components/admin/DeviceSettings';
import { RestaurantSettings } from '../components/admin/RestaurantSettings';
import { PrinterSettings } from '../components/admin/PrinterSettings';
import { cn } from '../lib/utils';

type Tab = 'overview' | 'analytics' | 'settings' | 'menu' | 'floor-plan' | 'staff' | 'device' | 'billing';

// Hook to detect screen size
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const { getStats: getAggregatorStats } = useAggregatorStore();
  const { getStats: getWebsiteOrderStats } = useOnlineOrderStore();
  const { getStats: getKDSStats } = useKDSStore();
  const { config: printerConfig, setRestaurantName } = usePrinterStore();
  const { settings: restaurantSettings, isConfigured: isRestaurantConfigured } = useRestaurantSettingsStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [restaurantName, setRestaurantNameInput] = useState(printerConfig.restaurantName);
  const [isRestaurantSettingsOpen, setIsRestaurantSettingsOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const aggregatorStats = getAggregatorStats();
  const websiteOrderStats = getWebsiteOrderStats();
  const kdsStats = getKDSStats();

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '🏠' },
    { id: 'analytics', label: 'Reports', icon: '📈' },
    { id: 'menu', label: 'Menu', icon: '📜' },
    { id: 'floor-plan', label: 'Floor', icon: '🗺️' },
    { id: 'staff', label: 'Staff', icon: '👥' },
    { id: 'billing', label: 'Billing', icon: '🧾' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'device', label: 'Device', icon: '📱' },
  ];

  // Mobile tabs - show fewer items in bottom nav
  const mobilePrimaryTabs = tabs.filter(t => ['overview', 'menu', 'staff', 'settings'].includes(t.id));
  const mobileSecondaryTabs = tabs.filter(t => !['overview', 'menu', 'staff', 'settings'].includes(t.id));

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col lg:flex-row overflow-hidden">
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      {isDesktop && (
        <aside className="w-20 neo-raised flex flex-col items-center py-4 shrink-0">
          <div className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center text-white font-black text-sm shadow-lg shadow-accent/20">
              POS
            </div>
          </div>
          <nav className="flex-1 flex flex-col gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all",
                  activeTab === tab.id
                    ? "sidebar-nav-active text-white"
                    : "neo-raised-sm text-muted-foreground hover:text-foreground"
                )}
                title={tab.label}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[8px] font-bold uppercase tracking-tight">{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto text-[8px] text-muted-foreground font-mono">
            {user?.tenantId?.slice(0, 8)}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ==================== MOBILE/TABLET HEADER ==================== */}
        {!isDesktop && (
          <header className={cn(
            "flex items-center justify-between glass-panel border-b border-border/50 shrink-0 safe-area-top",
            isMobile ? "h-14 px-4" : "h-16 px-6"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-gradient flex items-center justify-center text-white font-black text-xs shadow-lg shadow-accent/20">
                POS
              </div>
              <h1 className={cn(
                "font-black uppercase tracking-tight",
                isMobile ? "text-sm" : "text-base"
              )}>
                {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* More menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-10 h-10 neo-raised-sm rounded-lg flex items-center justify-center touch-target"
              >
                <span className="text-lg">☰</span>
              </button>
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm">
                👤
              </div>
            </div>
          </header>
        )}

        {/* ==================== DESKTOP HEADER ==================== */}
        {isDesktop && (
          <header className="h-12 flex items-center justify-between px-6 glass-panel border-b border-border/50 shrink-0">
            <h1 className="text-sm font-black uppercase tracking-tight">
              {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{user?.name}</span>
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm">
                👤
              </div>
            </div>
          </header>
        )}

        {/* Mobile Menu Dropdown */}
        {!isDesktop && isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="absolute top-14 right-4 bg-card border border-border rounded-xl shadow-2xl z-50 w-48 overflow-hidden">
              <div className="p-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground">{user?.name}</span>
              </div>
              <nav className="p-2">
                {mobileSecondaryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg touch-target",
                      activeTab === tab.id
                        ? "bg-accent text-white"
                        : "text-foreground hover:bg-surface-2"
                    )}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span className="font-bold text-sm">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </>
        )}

        {/* Content Area - Full height minus header */}
        <main className={cn(
          "flex-1 overflow-auto",
          isMobile ? "p-3 pb-20" : isTablet ? "p-4 pb-20" : "p-4"
        )}>
          {activeTab === 'overview' && (
            <div className="h-full flex flex-col gap-4 animate-fade-in">
              {/* Stats Row - Responsive grid */}
              <div className={cn(
                "grid gap-3 shrink-0",
                isMobile ? "grid-cols-2" : isTablet ? "grid-cols-3" : "grid-cols-5"
              )}>
                <StatCard
                  label="Website Orders"
                  value={websiteOrderStats.total}
                  subtext={`${websiteOrderStats.pending} pending`}
                  icon="🌐"
                  color="purple"
                  compact={isMobile}
                />
                <StatCard
                  label="Aggregators"
                  value={aggregatorStats.total}
                  subtext={`${aggregatorStats.new} new`}
                  icon="🛵"
                  color="orange"
                  compact={isMobile}
                />
                <StatCard
                  label="Kitchen Active"
                  value={kdsStats.activeOrders}
                  subtext={`${kdsStats.pendingItems} items`}
                  icon="🍳"
                  color="blue"
                  compact={isMobile}
                />
                {!isMobile && (
                  <>
                    <StatCard
                      label="Avg Prep Time"
                      value={`${kdsStats.averagePrepTime}m`}
                      subtext="Kitchen speed"
                      icon="⏱️"
                      color="green"
                      compact={false}
                    />
                    <StatCard
                      label="Oldest Order"
                      value={`${kdsStats.oldestOrderMinutes}m`}
                      subtext={kdsStats.oldestOrderMinutes > 20 ? 'Critical' : 'On track'}
                      icon="⚠️"
                      color={kdsStats.oldestOrderMinutes > 20 ? 'red' : 'slate'}
                      compact={false}
                    />
                  </>
                )}
              </div>

              {/* Quick Access - Responsive grid */}
              <div className={cn(
                "flex-1 grid gap-3",
                isMobile ? "grid-cols-2" : isTablet ? "grid-cols-2" : "grid-cols-4"
              )}>
                <QuickLink to="/pos" title="Open POS" desc="Take new orders" icon="💰" color="accent" compact={isMobile} />
                <QuickLink to="/kitchen" title="Kitchen Display" desc="Monitor preparation" icon="🍳" color="blue" compact={isMobile} />
                <QuickLink to="/website-orders" title="Website Orders" desc="Direct online orders" icon="🌐" color="purple" compact={isMobile} />
                <QuickLink to="/aggregator" title="Aggregators" desc="Zomato & Swiggy" icon="🛵" color="orange" compact={isMobile} />
              </div>
            </div>
          )}

          {activeTab === 'analytics' && user?.tenantId && (
            <div className="h-full animate-fade-in">
              <ReportsPanel tenantId={user.tenantId} />
            </div>
          )}

          {activeTab === 'menu' && user?.tenantId && (
            <div className="h-full animate-fade-in overflow-auto">
              <MenuOnboarding tenantId={user.tenantId} />
            </div>
          )}

          {activeTab === 'floor-plan' && (
            <div className={cn(
              "h-full gap-4 animate-fade-in",
              isMobile ? "flex flex-col" : "grid grid-cols-2"
            )}>
              <div className="overflow-auto">
                <FloorPlanManager />
              </div>
              <div className="overflow-auto">
                <StaffAssignmentManager />
              </div>
            </div>
          )}

          {activeTab === 'staff' && user?.tenantId && (
            <div className="h-full animate-fade-in overflow-auto">
              <StaffManager tenantId={user.tenantId} />
            </div>
          )}

          {activeTab === 'billing' && (
            <div className={cn(
              "h-full gap-4 animate-fade-in",
              isMobile ? "flex flex-col space-y-4" : isTablet ? "grid grid-cols-2" : "grid grid-cols-3"
            )}>
              {/* Left Column - Status & Restaurant Info */}
              <div className="space-y-4">
                {/* Status Banner */}
                <div className={cn(
                  "glass-panel p-4 rounded-xl border",
                  isRestaurantConfigured
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                      isRestaurantConfigured ? "bg-green-500/20" : "bg-amber-500/20"
                    )}>
                      {isRestaurantConfigured ? "✓" : "⚠️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">
                        {isRestaurantConfigured ? "Billing Configured" : "Setup Required"}
                      </h3>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {isRestaurantConfigured
                          ? `GST: ${restaurantSettings.gstNumber || 'Not set'}`
                          : "Configure billing settings"
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsRestaurantSettingsOpen(true)}
                    className="w-full mt-3 py-2 rounded-lg bg-accent text-white font-bold uppercase tracking-widest text-[10px]"
                  >
                    {isRestaurantConfigured ? "Edit" : "Configure"}
                  </button>
                </div>

                {/* Restaurant Card */}
                <div className="glass-panel p-4 rounded-xl border border-border">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Restaurant</div>
                  <div className="text-base font-bold truncate">{restaurantSettings.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {restaurantSettings.address.city}, {restaurantSettings.address.state}
                  </div>
                </div>
              </div>

              {/* Middle Column - Tax & Invoice */}
              <div className="space-y-4">
                <div className="glass-panel p-4 rounded-xl border border-border">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Tax Rates</div>
                  <div className="text-2xl font-black">
                    GST {restaurantSettings.cgstRate + restaurantSettings.sgstRate}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    CGST: {restaurantSettings.cgstRate}% + SGST: {restaurantSettings.sgstRate}%
                  </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-border">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Invoice Format</div>
                  <div className="text-2xl font-black font-mono">{restaurantSettings.invoicePrefix}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Next: #{restaurantSettings.currentInvoiceNumber}
                  </div>
                </div>
              </div>

              {/* Right Column - Settings Grids */}
              <div className="space-y-4">
                <div className="glass-panel p-4 rounded-xl border border-border">
                  <h4 className="font-bold uppercase text-xs mb-3">Print Settings</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paper Width</span>
                      <span className="font-mono">{restaurantSettings.paperWidth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Print Logo</span>
                      <span>{restaurantSettings.printLogo ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Round Off</span>
                      <span>{restaurantSettings.roundOffEnabled ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-border">
                  <h4 className="font-bold uppercase text-xs mb-3">Service Charges</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Charge</span>
                      <span>{restaurantSettings.serviceChargeEnabled ? `${restaurantSettings.serviceChargeRate}%` : "Off"}</span>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-accent/10 rounded-lg text-center">
                    <div className="text-[10px] text-muted-foreground">Example: Rs. 1000</div>
                    <div className="font-bold text-sm">
                      Total: Rs. {(1000 * (1 + (restaurantSettings.cgstRate + restaurantSettings.sgstRate) / 100)).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={cn(
              "h-full gap-4 animate-fade-in",
              isMobile ? "flex flex-col space-y-4" : "grid grid-cols-2"
            )}>
              {/* Left - General Settings */}
              <div className="glass-panel p-5 rounded-xl border border-border">
                <h3 className="text-base font-bold uppercase mb-4">General Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">Restaurant Name (KOT)</label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantNameInput(e.target.value)}
                      className="input-neo w-full"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Used for Kitchen Order Tickets</p>
                  </div>
                  <button
                    onClick={() => {
                      setRestaurantName(restaurantName);
                      alert('Settings saved!');
                    }}
                    className="btn-primary w-full py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Right - Printer Settings */}
              <div className="glass-panel p-5 rounded-xl border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xl">
                      🖨️
                    </div>
                    <div>
                      <h3 className="font-bold uppercase text-sm">Printer Config</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {printerConfig.printerType === 'browser' && 'Browser print dialog'}
                        {printerConfig.printerType === 'network' && `Network: ${printerConfig.networkPrinterUrl || 'Not set'}`}
                        {printerConfig.printerType === 'system' && `System: ${printerConfig.systemPrinterName || 'Not set'}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPrinterSettingsOpen(true)}
                    className="px-4 py-2 rounded-lg bg-accent text-white font-bold uppercase tracking-widest text-[10px]"
                  >
                    Configure
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between p-2.5 neo-inset-sm rounded-lg">
                    <span className="text-muted-foreground">Auto Print KOT</span>
                    <span className={printerConfig.autoPrintOnAccept ? 'text-success font-bold' : 'text-muted-foreground'}>
                      {printerConfig.autoPrintOnAccept ? 'On' : 'Off'}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 neo-inset-sm rounded-lg">
                    <span className="text-muted-foreground">Print by Station</span>
                    <span className={printerConfig.printByStation ? 'text-success font-bold' : 'text-muted-foreground'}>
                      {printerConfig.printByStation ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'device' && (
            <div className="h-full animate-fade-in overflow-auto">
              <DeviceSettings />
            </div>
          )}
        </main>
      </div>

      {/* ==================== MOBILE/TABLET BOTTOM NAVIGATION ==================== */}
      {!isDesktop && (
        <nav className="bottom-nav border-t border-border/50 flex items-center justify-around px-2">
          {mobilePrimaryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 touch-target min-w-[60px]",
                activeTab === tab.id
                  ? "text-accent"
                  : "text-muted-foreground"
              )}
            >
              <span className={cn("text-xl", activeTab === tab.id && "scale-110 transition-transform")}>{tab.icon}</span>
              <span className="text-[9px] font-bold uppercase mt-0.5">{tab.label}</span>
            </button>
          ))}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-3 touch-target min-w-[60px]",
              mobileSecondaryTabs.some(t => t.id === activeTab)
                ? "text-accent"
                : "text-muted-foreground"
            )}
          >
            <span className="text-xl">•••</span>
            <span className="text-[9px] font-bold uppercase mt-0.5">More</span>
          </button>
        </nav>
      )}

      {/* Restaurant Settings Modal */}
      <RestaurantSettings
        isOpen={isRestaurantSettingsOpen}
        onClose={() => setIsRestaurantSettingsOpen(false)}
      />

      {/* Printer Settings Modal */}
      <PrinterSettings
        isOpen={isPrinterSettingsOpen}
        onClose={() => setIsPrinterSettingsOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value, subtext, icon, color, compact = false }: {
  label: string;
  value: string | number;
  subtext: string;
  icon: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "glass-panel rounded-xl border border-border relative overflow-hidden group",
      compact ? "p-3" : "p-4"
    )}>
      <div className={cn(
        "absolute top-2 right-2 opacity-20 group-hover:scale-110 transition-transform",
        compact ? "text-xl" : "text-2xl"
      )}>{icon}</div>
      <div className={cn(
        "font-black uppercase text-muted-foreground tracking-widest",
        compact ? "text-[9px]" : "text-[10px]"
      )}>{label}</div>
      <div className={cn(
        "font-black mt-1",
        compact ? "text-xl" : "text-2xl"
      )}>{value}</div>
      <div className={cn(
        "font-bold uppercase mt-1",
        compact ? "text-[9px]" : "text-[10px]",
        color === 'red' ? 'text-red-500' : 'text-muted-foreground'
      )}>
        {subtext}
      </div>
    </div>
  );
}

function QuickLink({ to, title, desc, icon, color, compact = false }: {
  to: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "glass-panel rounded-xl border border-border hover:border-accent/50 transition-all group flex flex-col items-center justify-center text-center touch-target",
        compact ? "p-4" : "p-6"
      )}
    >
      <div className={cn(
        "rounded-2xl flex items-center justify-center mb-3",
        compact ? "w-12 h-12 text-2xl" : "w-16 h-16 text-3xl",
        `bg-${color}/10`
      )}>
        {icon}
      </div>
      <div className={cn(
        "font-black uppercase group-hover:text-accent transition-colors",
        compact ? "text-sm" : "text-base"
      )}>{title}</div>
      <div className={cn(
        "text-muted-foreground font-bold uppercase tracking-tight mt-1",
        compact ? "text-[9px]" : "text-[10px]"
      )}>{desc}</div>
    </Link>
  );
}

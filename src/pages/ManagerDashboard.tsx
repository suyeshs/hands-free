import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
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

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const { getStats: getAggregatorStats } = useAggregatorStore();
  const { getStats: getKDSStats } = useKDSStore();
  const { config: printerConfig, setRestaurantName } = usePrinterStore();
  const { settings: restaurantSettings, isConfigured: isRestaurantConfigured } = useRestaurantSettingsStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [restaurantName, setRestaurantNameInput] = useState(printerConfig.restaurantName);
  const [isRestaurantSettingsOpen, setIsRestaurantSettingsOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);

  const aggregatorStats = getAggregatorStats();
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-border glass-panel z-20">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Admin Console</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            {user?.tenantId} • {user?.name}
          </p>
        </div>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                  : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Online Orders" value={aggregatorStats.total} subtext={`${aggregatorStats.new} new`} icon="🛵" color="orange" />
                <StatCard label="Kitchen Active" value={kdsStats.activeOrders} subtext={`${kdsStats.pendingItems} items`} icon="🍳" color="blue" />
                <StatCard label="Avg Prep Time" value={`${kdsStats.averagePrepTime}m`} subtext="Kitchen speed" icon="⏱️" color="green" />
                <StatCard label="Oldest Order" value={`${kdsStats.oldestOrderMinutes}m`} subtext={kdsStats.oldestOrderMinutes > 20 ? 'Critical' : 'On track'} icon="⚠️" color={kdsStats.oldestOrderMinutes > 20 ? 'red' : 'slate'} />
              </div>

              {/* Quick Access */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <QuickLink to="/pos" title="Open POS" desc="Take new orders" icon="💰" color="accent" />
                <QuickLink to="/kitchen" title="Kitchen Display" desc="Monitor preparation" icon="🍳" color="blue" />
                <QuickLink to="/aggregator" title="Online Orders" desc="Zomato & Swiggy" icon="🛵" color="orange" />
              </div>
            </div>
          )}

          {activeTab === 'analytics' && user?.tenantId && (
            <div className="animate-fade-in">
              <ReportsPanel tenantId={user.tenantId} />
            </div>
          )}

          {activeTab === 'menu' && user?.tenantId && (
            <div className="animate-fade-in">
              <MenuOnboarding tenantId={user.tenantId} />
            </div>
          )}

          {activeTab === 'floor-plan' && (
            <div className="space-y-8 animate-fade-in">
              <FloorPlanManager />
              <StaffAssignmentManager />
            </div>
          )}

          {activeTab === 'staff' && user?.tenantId && (
            <div className="animate-fade-in">
              <StaffManager tenantId={user.tenantId} />
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="max-w-4xl space-y-6 animate-fade-in">
              {/* Status Banner */}
              <div className={cn(
                "glass-panel p-6 rounded-2xl border",
                isRestaurantConfigured
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-amber-500/30 bg-amber-500/5"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                      isRestaurantConfigured ? "bg-green-500/20" : "bg-amber-500/20"
                    )}>
                      {isRestaurantConfigured ? "✓" : "⚠️"}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        {isRestaurantConfigured ? "Billing Configured" : "Billing Not Configured"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isRestaurantConfigured
                          ? `GST: ${restaurantSettings.gstNumber || 'Not set'} | FSSAI: ${restaurantSettings.fssaiNumber || 'Not set'}`
                          : "Configure GST, FSSAI, and invoice settings for proper tax invoices"
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsRestaurantSettingsOpen(true)}
                    className="px-6 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
                  >
                    {isRestaurantConfigured ? "Edit Settings" : "Configure Now"}
                  </button>
                </div>
              </div>

              {/* Billing Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-border">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Restaurant</div>
                  <div className="text-lg font-bold">{restaurantSettings.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {restaurantSettings.address.city}, {restaurantSettings.address.state}
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-border">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Tax Rates</div>
                  <div className="text-lg font-bold">
                    GST {restaurantSettings.cgstRate + restaurantSettings.sgstRate}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    CGST: {restaurantSettings.cgstRate}% + SGST: {restaurantSettings.sgstRate}%
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-border">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Invoice Format</div>
                  <div className="text-lg font-bold font-mono">{restaurantSettings.invoicePrefix}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Next: #{restaurantSettings.currentInvoiceNumber}
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-border">
                  <h4 className="font-bold uppercase text-sm mb-4">Print Settings</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paper Width</span>
                      <span className="font-mono">{restaurantSettings.paperWidth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Print Logo</span>
                      <span>{restaurantSettings.printLogo ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Print QR Code</span>
                      <span>{restaurantSettings.printQRCode ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Round Off</span>
                      <span>{restaurantSettings.roundOffEnabled ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-border">
                  <h4 className="font-bold uppercase text-sm mb-4">Service Charges</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service Charge</span>
                      <span>{restaurantSettings.serviceChargeEnabled ? `${restaurantSettings.serviceChargeRate}%` : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tax Rate</span>
                      <span>{restaurantSettings.cgstRate + restaurantSettings.sgstRate}%</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-accent/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Example on Rs. 1000</div>
                    <div className="font-bold mt-1">
                      Total: Rs. {(1000 * (1 + (restaurantSettings.cgstRate + restaurantSettings.sgstRate) / 100)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6 animate-fade-in">
              <div className="glass-panel p-6 rounded-2xl border border-border">
                <h3 className="text-lg font-bold uppercase mb-4">General Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">Restaurant Name (KOT)</label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantNameInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used for Kitchen Order Tickets. For billing details, use the Billing tab.</p>
                  </div>
                  <button
                    onClick={() => {
                      setRestaurantName(restaurantName);
                      alert('Settings saved!');
                    }}
                    className="w-full py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Printer Settings Card */}
              <div className="glass-panel p-6 rounded-2xl border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-2xl">
                      🖨️
                    </div>
                    <div>
                      <h3 className="text-lg font-bold uppercase">Printer Configuration</h3>
                      <p className="text-xs text-muted-foreground">
                        {printerConfig.printerType === 'browser' && 'Using browser print dialog'}
                        {printerConfig.printerType === 'network' && `Network: ${printerConfig.networkPrinterUrl || 'Not configured'}`}
                        {printerConfig.printerType === 'system' && `System: ${printerConfig.systemPrinterName || 'Not configured'}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPrinterSettingsOpen(true)}
                    className="px-6 py-3 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
                  >
                    Configure Printer
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-muted-foreground">Auto Print KOT</span>
                    <span className={printerConfig.autoPrintOnAccept ? 'text-green-500' : 'text-muted-foreground'}>
                      {printerConfig.autoPrintOnAccept ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-muted-foreground">Print by Station</span>
                    <span className={printerConfig.printByStation ? 'text-green-500' : 'text-muted-foreground'}>
                      {printerConfig.printByStation ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'device' && (
            <div className="animate-fade-in">
              <DeviceSettings />
            </div>
          )}
        </div>
      </main>

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

function StatCard({ label, value, subtext, icon, color }: any) {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-border relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 text-4xl opacity-10 group-hover:scale-110 transition-transform">{icon}</div>
      <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{label}</div>
      <div className="text-3xl font-black">{value}</div>
      <div className={cn("text-[10px] font-bold uppercase mt-2", color === 'red' ? 'text-red-500' : 'text-muted-foreground')}>
        {subtext}
      </div>
    </div>
  );
}

function QuickLink({ to, title, desc, icon, color }: any) {
  return (
    <Link to={to} className="glass-panel p-6 rounded-2xl border border-border hover:border-accent/50 transition-all group">
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl", `bg-${color}/10 text-${color}`)}>
          {icon}
        </div>
        <div>
          <div className="font-black uppercase text-sm group-hover:text-accent transition-colors">{title}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

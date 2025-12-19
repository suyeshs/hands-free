/**
 * Manager Dashboard
 * Comprehensive overview and management interface for restaurant managers
 */

import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useKDSStore } from '../stores/kdsStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { usePrinterStore } from '../stores/printerStore';
import { Link } from 'react-router-dom';
import ReportsPanel from '../components/analytics/ReportsPanel';
import { MenuOnboarding } from '../components/admin/MenuOnboarding';
import { FloorPlanManager } from '../components/admin/FloorPlanManager';
import { StaffAssignmentManager } from '../components/admin/StaffAssignmentManager';
import { StaffManager } from '../components/admin/StaffManager';
import { DeviceSettings } from '../components/admin/DeviceSettings';
import {
  exportSalesMetrics,
  exportPopularItems,
  exportDailySales,
  exportAllMetricsJSON,
  printReport,
} from '../utils/exportData';

type Tab = 'overview' | 'analytics' | 'settings' | 'menu' | 'floor-plan' | 'staff' | 'device';

export default function ManagerDashboard() {
  const { user, logout } = useAuthStore();
  const { getStats: getAggregatorStats } = useAggregatorStore();
  const { getStats: getKDSStats } = useKDSStore();
  const {
    salesMetrics,
    popularItems,
    dailySales,
    orderMetrics,
    performanceMetrics,
    stationPerformance,
    aggregatorPerformance,
  } = useAnalyticsStore();
  const {
    config: printerConfig,
    setRestaurantName,
    setAutoPrint,
    setPrintByStation,
  } = usePrinterStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [restaurantName, setRestaurantNameInput] = useState(printerConfig.restaurantName);

  const aggregatorStats = getAggregatorStats();
  const kdsStats = getKDSStats();

  const handleLogout = async () => {
    await logout();
  };

  const handleExportAll = () => {
    exportAllMetricsJSON({
      salesMetrics,
      orderMetrics,
      performanceMetrics,
      popularItems,
      stationPerformance,
      aggregatorPerformance,
      dailySales,
    });
  };

  const handleSaveSettings = () => {
    setRestaurantName(restaurantName);
    alert('Settings saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name} • {user?.tenantId}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'analytics' && (
                <>
                  <button
                    onClick={printReport}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Print
                  </button>
                  <button
                    onClick={handleExportAll}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Export Data
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Analytics & Reports
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('floor-plan')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'floor-plan'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Floor Plan
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'staff'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Staff
              </button>
              <button
                onClick={() => setActiveTab('device')}
                className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'device'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Device
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Aggregator Orders</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{aggregatorStats.total}</p>
                <p className="text-sm text-gray-600 mt-1">{aggregatorStats.new} new</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Kitchen Orders</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{kdsStats.activeOrders}</p>
                <p className="text-sm text-gray-600 mt-1">{kdsStats.pendingItems} pending items</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Avg Prep Time</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{kdsStats.averagePrepTime}m</p>
                <p className="text-sm text-gray-600 mt-1">Kitchen performance</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Oldest Order</h3>
                <p
                  className={`text-3xl font-bold mt-2 ${kdsStats.oldestOrderMinutes > 20 ? 'text-red-600' : 'text-gray-900'
                    }`}
                >
                  {kdsStats.oldestOrderMinutes}m
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {kdsStats.oldestOrderMinutes > 20 ? 'Needs attention' : 'On track'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                  to="/aggregator"
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-orange-500"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Aggregator Orders</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Manage Zomato and Swiggy orders
                  </p>
                  <div className="text-orange-600 text-sm font-medium">View Dashboard →</div>
                </Link>

                <Link
                  to="/kitchen"
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-blue-500"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Kitchen Display</h3>
                  <p className="text-gray-600 text-sm mb-3">View kitchen order status</p>
                  <div className="text-blue-600 text-sm font-medium">View Dashboard →</div>
                </Link>

                <Link
                  to="/pos"
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-green-500"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Point of Sale</h3>
                  <p className="text-gray-600 text-sm mb-3">Take new orders</p>
                  <div className="text-green-600 text-sm font-medium">Open POS →</div>
                </Link>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-purple-500 text-left"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Analytics & Reports</h3>
                  <p className="text-gray-600 text-sm mb-3">View sales and performance data</p>
                  <div className="text-purple-600 text-sm font-medium">View Reports →</div>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-gray-500 text-left"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Settings</h3>
                  <p className="text-gray-600 text-sm mb-3">Configure system preferences</p>
                  <div className="text-gray-600 text-sm font-medium">Manage Settings →</div>
                </button>

                <button
                  onClick={() => setActiveTab('menu')}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-orange-500 text-left"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Menu Management</h3>
                  <p className="text-gray-600 text-sm mb-3">Manage items and pricing</p>
                  <div className="text-orange-600 text-sm font-medium">Manage Menu →</div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && user?.tenantId && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Business Analytics</h2>
              <div className="flex gap-2">
                {salesMetrics && (
                  <button
                    onClick={() => exportSalesMetrics(salesMetrics)}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Export Sales
                  </button>
                )}
                {popularItems.length > 0 && (
                  <button
                    onClick={() => exportPopularItems(popularItems)}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Export Items
                  </button>
                )}
                {dailySales.length > 0 && (
                  <button
                    onClick={() => exportDailySales(dailySales)}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Export Daily Sales
                  </button>
                )}
              </div>
            </div>
            <ReportsPanel tenantId={user.tenantId} />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">System Settings</h2>

            <div className="space-y-6">
              {/* General Settings */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">General</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Restaurant Name
                    </label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantNameInput(e.target.value)}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter restaurant name"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This name will appear on KOT prints and receipts
                    </p>
                  </div>
                </div>
              </div>

              {/* Printer Settings */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                  Kitchen Printer Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Auto-Print KOT</div>
                      <div className="text-xs text-gray-500">
                        Automatically print when new orders are accepted
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoPrint(!printerConfig.autoPrintOnAccept)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${printerConfig.autoPrintOnAccept ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${printerConfig.autoPrintOnAccept ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        Print by Station
                      </div>
                      <div className="text-xs text-gray-500">
                        Print separate KOTs for each kitchen station
                      </div>
                    </div>
                    <button
                      onClick={() => setPrintByStation(!printerConfig.printByStation)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${printerConfig.printByStation ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${printerConfig.printByStation ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Printer Type
                    </label>
                    <select
                      value={printerConfig.printerType}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled
                    >
                      <option value="browser">Browser Print</option>
                      <option value="network">Network Thermal Printer</option>
                      <option value="thermal">USB Thermal Printer</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Currently using browser print dialog
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Menu Management Tab */}
        {activeTab === 'menu' && user?.tenantId && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setActiveTab('overview')}
                className="text-sm text-blue-600 hover:text-blue-700 mb-4"
              >
                ← Back to Overview
              </button>
              <h2 className="text-lg font-semibold text-gray-900">Menu Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload, edit, and manage your restaurant menu items
              </p>
            </div>
            <MenuOnboarding tenantId={user.tenantId} />
          </div>
        )}

        {/* Floor Plan Tab */}
        {activeTab === 'floor-plan' && user?.tenantId && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Floor Plan & Tables</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage sections, tables, and QR codes
              </p>
            </div>
            <FloorPlanManager />
            <StaffAssignmentManager />
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && user?.tenantId && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage employees, roles, and access credentials
              </p>
            </div>
            <StaffManager />
          </div>
        )}

        {/* Device Tab */}
        {activeTab === 'device' && user?.tenantId && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Device Configuration</h2>
              <p className="text-sm text-gray-600 mt-1">
                Lock this device to a specific operational mode
              </p>
            </div>
            <DeviceSettings />
          </div>
        )}
      </div>
    </div>
  );
}

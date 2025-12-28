/**
 * Service Dashboard
 *
 * Status screen for service staff showing:
 * - Table status grid with order progress
 * - Ready-to-serve alerts (flashing)
 * - Quick order entry button
 * - Service request queue
 *
 * Designed for industrial touch with large targets
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import { usePOSStore } from '../stores/posStore';
import { useKDSStore } from '../stores/kdsStore';
import { useServiceRequestStore } from '../stores/serviceRequestStore';
import { OrderStatusBadge } from '../components/pos/OrderStatusBadge';
import { ServiceRequest } from '../types/guest-order';
import { cn } from '../lib/utils';

type TableViewStatus = 'empty' | 'waiting' | 'preparing' | 'ready' | 'served';

interface OrderStatusResult {
  status: 'pending' | 'in_progress' | 'ready' | 'completed' | null;
  readyItemCount: number;
  totalItemCount: number;
  hasRunningOrder: boolean;
}

interface TableCardData {
  tableNumber: number;
  sectionName: string;
  status: TableViewStatus;
  orderStatus: OrderStatusResult;
  hasActiveOrder: boolean;
  hasRunningOrder: boolean;
  isFlashing: boolean;
}

export default function ServiceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { sections, tables, loadFloorPlan, isLoaded: floorPlanLoaded } = useFloorPlanStore();
  const { activeTables, loadTableSessions } = usePOSStore();
  const { getOrderStatusForTable } = useKDSStore();
  const { getPendingRequests, acknowledgeRequest } = useServiceRequestStore();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSection, setSelectedSection] = useState<string | 'all'>('all');

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Load floor plan and table sessions
  useEffect(() => {
    if (user?.tenantId) {
      if (!floorPlanLoaded) {
        loadFloorPlan(user.tenantId);
      }
      loadTableSessions(user.tenantId);
    }
  }, [user?.tenantId, floorPlanLoaded]);

  // Build table card data
  const tableCards: TableCardData[] = useMemo(() => {
    return tables
      .filter(table => selectedSection === 'all' || table.sectionId === selectedSection)
      .map(table => {
        const tableNum = parseInt(table.tableNumber, 10);
        const section = sections.find(s => s.id === table.sectionId);
        const activeSession = activeTables[tableNum];
        const orderStatus = getOrderStatusForTable(tableNum);

        // Determine view status
        let viewStatus: TableViewStatus = 'empty';
        if (activeSession?.order) {
          if (orderStatus.status === 'ready') {
            viewStatus = 'ready';
          } else if (orderStatus.status === 'in_progress') {
            viewStatus = 'preparing';
          } else if (orderStatus.status === 'pending') {
            viewStatus = 'waiting';
          } else if (orderStatus.status === 'completed') {
            viewStatus = 'served';
          }
        }

        return {
          tableNumber: tableNum,
          sectionName: section?.name || 'Unknown',
          status: viewStatus,
          orderStatus,
          hasActiveOrder: !!activeSession?.order,
          hasRunningOrder: orderStatus.hasRunningOrder,
          isFlashing: viewStatus === 'ready', // Flash when items ready
        };
      })
      .sort((a, b) => a.tableNumber - b.tableNumber);
  }, [tables, sections, selectedSection, activeTables, getOrderStatusForTable]);

  // Get tables with ready orders
  const readyTables = tableCards.filter(t => t.status === 'ready');

  // Get pending service requests
  const pendingRequests = getPendingRequests();

  // Stats
  const stats = useMemo(() => ({
    totalTables: tableCards.length,
    occupied: tableCards.filter(t => t.hasActiveOrder).length,
    preparing: tableCards.filter(t => t.status === 'preparing').length,
    ready: readyTables.length,
    pendingRequests: pendingRequests.length,
  }), [tableCards, readyTables, pendingRequests]);

  const handleTableClick = (tableNumber: number) => {
    // Navigate to POS with this table selected
    navigate(`/pos?table=${tableNumber}`);
  };

  const handleNewOrder = () => {
    navigate('/pos');
  };

  const handleAcknowledgeRequest = async (requestId: string) => {
    if (user) {
      await acknowledgeRequest(requestId, user.id, user.name);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">SERVICE DASHBOARD</h1>
          <div className="flex gap-2">
            {/* Section filters */}
            <button
              onClick={() => setSelectedSection('all')}
              className={cn(
                'px-3 py-1.5 rounded font-bold text-sm transition-colors',
                selectedSection === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
            >
              ALL
            </button>
            {sections.filter(s => s.isActive).map(section => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={cn(
                  'px-3 py-1.5 rounded font-bold text-sm transition-colors',
                  selectedSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
              >
                {section.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex gap-3 text-sm">
            <span className="text-slate-400">
              <span className="text-white font-bold">{stats.occupied}</span>/{stats.totalTables} Tables
            </span>
            <span className="text-yellow-400">
              <span className="font-bold">{stats.preparing}</span> Preparing
            </span>
            <span className="text-green-400">
              <span className="font-bold">{stats.ready}</span> Ready
            </span>
            {stats.pendingRequests > 0 && (
              <span className="text-red-400 animate-pulse">
                <span className="font-bold">{stats.pendingRequests}</span> Requests
              </span>
            )}
          </div>

          {/* Time */}
          <div className="text-lg font-mono text-slate-400">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        {/* Ready for service alerts */}
        {readyTables.length > 0 && (
          <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-3 animate-pulse">
            <h2 className="text-green-400 font-bold text-sm mb-2">READY FOR SERVICE</h2>
            <div className="flex flex-wrap gap-2">
              {readyTables.map(table => (
                <button
                  key={table.tableNumber}
                  onClick={() => handleTableClick(table.tableNumber)}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">TABLE {table.tableNumber}</span>
                  <span className="text-xs opacity-80">
                    ({table.orderStatus.readyItemCount}/{table.orderStatus.totalItemCount})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Service requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-3">
            <h2 className="text-red-400 font-bold text-sm mb-2">SERVICE REQUESTS</h2>
            <div className="flex flex-wrap gap-2">
              {pendingRequests.map((request: ServiceRequest) => (
                <button
                  key={request.id}
                  onClick={() => handleAcknowledgeRequest(request.id)}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-colors animate-pulse"
                >
                  TABLE {request.tableNumber} - {request.type === 'call_waiter' ? 'CALL WAITER' : request.type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
            {tableCards.map(table => (
              <button
                key={table.tableNumber}
                onClick={() => handleTableClick(table.tableNumber)}
                className={cn(
                  'aspect-square rounded-lg border-4 flex flex-col items-center justify-center p-2 transition-all',
                  'hover:scale-105 active:scale-95',
                  // Status-based styling
                  table.status === 'empty' && 'bg-slate-800 border-slate-700 text-slate-500',
                  table.status === 'waiting' && 'bg-slate-700 border-slate-500 text-slate-300',
                  table.status === 'preparing' && 'bg-blue-900 border-blue-500 text-blue-100',
                  table.status === 'ready' && 'bg-green-900 border-green-400 text-green-100 animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.3)]',
                  table.status === 'served' && 'bg-slate-700 border-slate-500 text-slate-400',
                  // Running order highlight
                  table.hasRunningOrder && 'ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-900'
                )}
              >
                {/* Table number */}
                <span className="text-2xl font-bold">{table.tableNumber}</span>

                {/* Status indicator */}
                {table.hasActiveOrder ? (
                  <OrderStatusBadge
                    status={table.orderStatus.status}
                    readyCount={table.orderStatus.readyItemCount}
                    totalCount={table.orderStatus.totalItemCount}
                    hasRunningOrder={table.hasRunningOrder}
                    size="sm"
                    showProgress={true}
                    className="mt-1"
                  />
                ) : (
                  <span className="text-xs mt-1 opacity-60">EMPTY</span>
                )}

                {/* Section label */}
                <span className="text-[10px] mt-1 opacity-50 truncate max-w-full">
                  {table.sectionName}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* New order button - industrial style */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleNewOrder}
            className={cn(
              'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
              'text-white text-2xl font-bold',
              'px-12 py-6 rounded-xl',
              'shadow-lg shadow-blue-900/50',
              'transition-all hover:scale-105 active:scale-95',
              'border-4 border-blue-400'
            )}
          >
            + NEW ORDER
          </button>
        </div>
      </div>
    </div>
  );
}

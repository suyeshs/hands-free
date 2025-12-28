/**
 * Service Request Queue
 * Shows pending service requests (Call Waiter) for staff
 */

import { useState, useEffect } from 'react';
import { Bell, Check, Clock, User, MapPin } from 'lucide-react';
import { useServiceRequestStore, formatRequestType, getRequestElapsedTime } from '../../stores/serviceRequestStore';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { orderSyncService } from '../../lib/orderSyncService';
import type { ServiceRequest } from '../../types/guest-order';

interface ServiceRequestQueueProps {
  staffId?: string;
  compact?: boolean;
}

export function ServiceRequestQueue({ staffId, compact = false }: ServiceRequestQueueProps) {
  const requests = useServiceRequestStore((state) => state.requests);
  const acknowledgeRequest = useServiceRequestStore((state) => state.acknowledgeRequest);
  const resolveRequest = useServiceRequestStore((state) => state.resolveRequest);
  const getTablesForStaff = useFloorPlanStore((state) => state.getTablesForStaff);

  // Force re-render every second for elapsed time display
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter requests for this staff member if staffId provided
  const filteredRequests = staffId
    ? requests.filter((r) => {
        if (r.status === 'resolved') return false;
        // Show if already assigned to this staff
        if (r.assignedStaffId === staffId) return true;
        // Show if table is in staff's assigned tables
        const staffTables = getTablesForStaff(staffId);
        return staffTables.some((t) => t.id === r.tableId);
      })
    : requests.filter((r) => r.status !== 'resolved');

  // Sort by status (pending first) then by time (oldest first)
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const handleAcknowledge = (request: ServiceRequest) => {
    if (!staffId) return;
    acknowledgeRequest(request.id, staffId, 'Staff');
    // Broadcast to other devices
    orderSyncService.broadcastServiceRequestAck(request.id, staffId, 'Staff');
  };

  const handleResolve = (requestId: string) => {
    resolveRequest(requestId);
    // Broadcast to other devices
    orderSyncService.broadcastServiceRequestResolved(requestId);
  };

  if (sortedRequests.length === 0) {
    if (compact) return null;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No pending service requests</p>
      </div>
    );
  }

  if (compact) {
    // Compact view for sidebar/header
    return (
      <div className="space-y-2">
        {sortedRequests.slice(0, 3).map((request) => (
          <div
            key={request.id}
            className={`flex items-center gap-2 p-2 rounded-lg ${
              request.status === 'pending'
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <Bell
              className={`w-4 h-4 ${
                request.status === 'pending' ? 'text-red-500' : 'text-yellow-500'
              }`}
            />
            <span className="flex-1 text-sm font-medium">
              Table {request.tableNumber}
            </span>
            <span className="text-xs text-gray-500">
              {getRequestElapsedTime(request.createdAt)}
            </span>
          </div>
        ))}
        {sortedRequests.length > 3 && (
          <p className="text-xs text-gray-500 text-center">
            +{sortedRequests.length - 3} more
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Service Requests
        </h2>
        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          {sortedRequests.filter((r) => r.status === 'pending').length} pending
        </span>
      </div>

      {sortedRequests.map((request) => (
        <div
          key={request.id}
          className={`bg-white rounded-lg border p-4 ${
            request.status === 'pending'
              ? 'border-red-300 shadow-sm'
              : 'border-yellow-300'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    request.status === 'pending'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {request.status === 'pending' ? 'New' : 'On the way'}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatRequestType(request.type)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Table {request.tableNumber}
                </span>
                {request.sectionName && (
                  <span className="text-gray-400">{request.sectionName}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              {getRequestElapsedTime(request.createdAt)}
            </div>
          </div>

          {/* Assigned staff */}
          {request.assignedStaffName && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <User className="w-4 h-4" />
              <span>Assigned to {request.assignedStaffName}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {request.status === 'pending' && (
              <button
                onClick={() => handleAcknowledge(request)}
                className="flex-1 py-2 px-4 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
              >
                I'm on my way
              </button>
            )}
            <button
              onClick={() => handleResolve(request.id)}
              className={`py-2 px-4 font-medium rounded-lg transition-colors ${
                request.status === 'pending'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'flex-1 bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Check className="w-4 h-4 inline mr-1" />
              Done
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

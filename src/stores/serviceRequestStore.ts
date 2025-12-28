/**
 * Service Request Store
 * Manages "Call Waiter" and other service requests from guests
 * Used by staff to see and respond to pending requests
 */

import { create } from 'zustand';
import type {
  ServiceRequest,
  ServiceRequestType,
  ServiceRequestStatus,
} from '../types/guest-order';

interface ServiceRequestState {
  // All pending and recent requests
  requests: ServiceRequest[];

  // Actions
  addRequest: (request: ServiceRequest) => void;
  acknowledgeRequest: (requestId: string, staffId: string, staffName: string) => void;
  resolveRequest: (requestId: string) => void;
  removeRequest: (requestId: string) => void;

  // Queries
  getPendingRequests: () => ServiceRequest[];
  getPendingForStaff: (staffId: string, assignedTableIds: string[]) => ServiceRequest[];
  getRequestsByTable: (tableId: string) => ServiceRequest[];
  getRequestById: (requestId: string) => ServiceRequest | undefined;
  getPendingCount: () => number;
  getPendingCountForStaff: (staffId: string, assignedTableIds: string[]) => number;

  // Bulk operations
  clearResolvedRequests: () => void;
  clearAllRequests: () => void;

  // Remote sync
  applyRemoteRequest: (request: ServiceRequest) => void;
  applyRemoteAcknowledge: (requestId: string, staffId: string, staffName: string) => void;
  applyRemoteResolve: (requestId: string) => void;
}

export const useServiceRequestStore = create<ServiceRequestState>((set, get) => ({
  requests: [],

  /**
   * Add a new service request
   */
  addRequest: (request: ServiceRequest) => {
    set((state) => {
      // Avoid duplicates
      if (state.requests.some((r) => r.id === request.id)) {
        return state;
      }
      return {
        requests: [request, ...state.requests],
      };
    });
  },

  /**
   * Acknowledge a service request (staff is on their way)
   */
  acknowledgeRequest: (requestId: string, staffId: string, staffName: string) => {
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'acknowledged' as ServiceRequestStatus,
              acknowledgedAt: new Date().toISOString(),
              assignedStaffId: staffId,
              assignedStaffName: staffName,
            }
          : r
      ),
    }));
  },

  /**
   * Resolve a service request (completed)
   */
  resolveRequest: (requestId: string) => {
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'resolved' as ServiceRequestStatus,
              resolvedAt: new Date().toISOString(),
            }
          : r
      ),
    }));
  },

  /**
   * Remove a request entirely
   */
  removeRequest: (requestId: string) => {
    set((state) => ({
      requests: state.requests.filter((r) => r.id !== requestId),
    }));
  },

  /**
   * Get all pending requests
   */
  getPendingRequests: () => {
    return get().requests.filter((r) => r.status === 'pending');
  },

  /**
   * Get pending requests for a specific staff member
   * Based on their assigned tables
   */
  getPendingForStaff: (staffId: string, assignedTableIds: string[]) => {
    return get().requests.filter((r) => {
      if (r.status !== 'pending' && r.status !== 'acknowledged') return false;
      // Show if assigned to this staff or if table is in their assigned list
      if (r.assignedStaffId === staffId) return true;
      if (assignedTableIds.includes(r.tableId)) return true;
      return false;
    });
  },

  /**
   * Get requests for a specific table
   */
  getRequestsByTable: (tableId: string) => {
    return get().requests.filter((r) => r.tableId === tableId);
  },

  /**
   * Get a specific request by ID
   */
  getRequestById: (requestId: string) => {
    return get().requests.find((r) => r.id === requestId);
  },

  /**
   * Get count of pending requests
   */
  getPendingCount: () => {
    return get().requests.filter((r) => r.status === 'pending').length;
  },

  /**
   * Get count of pending requests for a staff member
   */
  getPendingCountForStaff: (staffId: string, assignedTableIds: string[]) => {
    return get().getPendingForStaff(staffId, assignedTableIds).length;
  },

  /**
   * Clear all resolved requests (cleanup)
   */
  clearResolvedRequests: () => {
    set((state) => ({
      requests: state.requests.filter((r) => r.status !== 'resolved'),
    }));
  },

  /**
   * Clear all requests
   */
  clearAllRequests: () => {
    set({ requests: [] });
  },

  // Remote sync methods (called when receiving WebSocket messages)

  /**
   * Apply a service request from another device
   */
  applyRemoteRequest: (request: ServiceRequest) => {
    get().addRequest(request);
  },

  /**
   * Apply acknowledgment from another device
   */
  applyRemoteAcknowledge: (requestId: string, staffId: string, staffName: string) => {
    get().acknowledgeRequest(requestId, staffId, staffName);
  },

  /**
   * Apply resolution from another device
   */
  applyRemoteResolve: (requestId: string) => {
    get().resolveRequest(requestId);
  },
}));

/**
 * Helper to format request type for display
 */
export function formatRequestType(type: ServiceRequestType): string {
  switch (type) {
    case 'call_waiter':
      return 'Call Waiter';
    case 'bill_request':
      return 'Bill Request';
    case 'need_help':
      return 'Need Help';
    default:
      return type;
  }
}

/**
 * Helper to get time elapsed since request
 */
export function getRequestElapsedTime(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - created) / 1000);

  if (elapsed < 60) {
    return `${elapsed}s`;
  } else if (elapsed < 3600) {
    return `${Math.floor(elapsed / 60)}m`;
  } else {
    return `${Math.floor(elapsed / 3600)}h`;
  }
}

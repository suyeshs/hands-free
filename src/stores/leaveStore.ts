import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Database from '@tauri-apps/plugin-sql';

export interface LeaveRequest {
  id: string;
  tenantId: string;
  staffId: string;
  staffName?: string; // Denormalized
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  leaveType: 'vacation' | 'sick' | 'personal' | 'emergency' | 'unpaid';
  totalDays: number;
  isHalfDay: boolean;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  id: string;
  tenantId: string;
  staffId: string;
  year: number;
  vacationDaysTotal: number;
  vacationDaysUsed: number;
  sickDaysTotal: number;
  sickDaysUsed: number;
  personalDaysTotal: number;
  personalDaysUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveFilters {
  staffId?: string;
  status?: LeaveRequest['status'];
  startDate?: string;
  endDate?: string;
}

interface LeaveStore {
  // State
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  isLoaded: boolean;
  isLoading: boolean;
  isSyncing: boolean;

  // Request Management
  createLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'requestedAt' | 'createdAt' | 'updatedAt'>) => Promise<LeaveRequest>;
  updateLeaveRequest: (requestId: string, updates: Partial<LeaveRequest>) => Promise<void>;
  approveLeaveRequest: (requestId: string, reviewedBy: string, reviewNotes?: string) => Promise<void>;
  rejectLeaveRequest: (requestId: string, reviewedBy: string, reviewNotes: string) => Promise<void>;
  cancelLeaveRequest: (requestId: string) => Promise<void>;

  // Balance Management
  loadBalances: (tenantId: string, year?: number) => Promise<void>;
  updateBalance: (balance: LeaveBalance) => Promise<void>;
  initializeBalanceForStaff: (tenantId: string, staffId: string, year: number) => Promise<LeaveBalance>;
  getBalanceForStaff: (staffId: string, year?: number) => LeaveBalance | null;

  // Query Operations
  loadRequestsFromDatabase: (tenantId: string, filters?: LeaveFilters) => Promise<void>;
  getRequestsByStaff: (staffId: string) => LeaveRequest[];
  getPendingRequests: () => LeaveRequest[];

  // Cloud Sync
  syncFromCloud: (tenantId: string) => Promise<void>;
  syncToCloud: (tenantId: string) => Promise<void>;

  // Remote Sync
  applyRemoteLeaveRequestCreated: (request: LeaveRequest) => void;
  applyRemoteLeaveRequestUpdated: (requestId: string, updates: Partial<LeaveRequest>) => void;
}

export const useLeaveStore = create<LeaveStore>()(
  persist(
    (set, get) => ({
      requests: [],
      balances: [],
      isLoaded: false,
      isLoading: false,
      isSyncing: false,

      loadRequestsFromDatabase: async (tenantId: string, filters?: LeaveFilters) => {
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const db = await Database.load('sqlite:pos.db');

          let query = `
            SELECT id, tenant_id, staff_id, start_date, end_date, leave_type,
                   total_days, is_half_day, reason, status, requested_at,
                   reviewed_at, reviewed_by, review_notes, created_at, updated_at
            FROM leave_requests
            WHERE tenant_id = ?
          `;
          const params: any[] = [tenantId];

          if (filters?.staffId) {
            query += ' AND staff_id = ?';
            params.push(filters.staffId);
          }
          if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
          }
          if (filters?.startDate) {
            query += ' AND start_date >= ?';
            params.push(filters.startDate);
          }
          if (filters?.endDate) {
            query += ' AND end_date <= ?';
            params.push(filters.endDate);
          }

          query += ' ORDER BY start_date DESC';

          const result = await db.select<Array<{
            id: string;
            tenant_id: string;
            staff_id: string;
            start_date: string;
            end_date: string;
            leave_type: string;
            total_days: number;
            is_half_day: number;
            reason: string | null;
            status: string;
            requested_at: number;
            reviewed_at: number | null;
            reviewed_by: string | null;
            review_notes: string | null;
            created_at: number;
            updated_at: number;
          }>>(query, params);

          const requestsFromDb: LeaveRequest[] = result.map(row => ({
            id: row.id,
            tenantId: row.tenant_id,
            staffId: row.staff_id,
            startDate: row.start_date,
            endDate: row.end_date,
            leaveType: row.leave_type as LeaveRequest['leaveType'],
            totalDays: row.total_days,
            isHalfDay: row.is_half_day === 1,
            reason: row.reason || undefined,
            status: row.status as LeaveRequest['status'],
            requestedAt: new Date(row.requested_at).toISOString(),
            reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
            reviewedBy: row.reviewed_by || undefined,
            reviewNotes: row.review_notes || undefined,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          }));

          console.log(`[LeaveStore] Loaded ${requestsFromDb.length} leave requests from database`);

          set({ requests: requestsFromDb, isLoaded: true, isLoading: false });
        } catch (error) {
          console.error('[LeaveStore] Failed to load leave requests:', error);
          set({ isLoading: false });
        }
      },

      loadBalances: async (tenantId: string, year?: number) => {
        try {
          const db = await Database.load('sqlite:pos.db');
          const currentYear = year || new Date().getFullYear();

          const result = await db.select<Array<{
            id: string;
            tenant_id: string;
            staff_id: string;
            year: number;
            vacation_days_total: number;
            vacation_days_used: number;
            sick_days_total: number;
            sick_days_used: number;
            personal_days_total: number;
            personal_days_used: number;
            created_at: number;
            updated_at: number;
          }>>(`
            SELECT id, tenant_id, staff_id, year,
                   vacation_days_total, vacation_days_used,
                   sick_days_total, sick_days_used,
                   personal_days_total, personal_days_used,
                   created_at, updated_at
            FROM leave_balances
            WHERE tenant_id = ? AND year = ?
          `, [tenantId, currentYear]);

          const balancesFromDb: LeaveBalance[] = result.map(row => ({
            id: row.id,
            tenantId: row.tenant_id,
            staffId: row.staff_id,
            year: row.year,
            vacationDaysTotal: row.vacation_days_total,
            vacationDaysUsed: row.vacation_days_used,
            sickDaysTotal: row.sick_days_total,
            sickDaysUsed: row.sick_days_used,
            personalDaysTotal: row.personal_days_total,
            personalDaysUsed: row.personal_days_used,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          }));

          console.log(`[LeaveStore] Loaded ${balancesFromDb.length} leave balances`);

          set({ balances: balancesFromDb });
        } catch (error) {
          console.error('[LeaveStore] Failed to load leave balances:', error);
        }
      },

      createLeaveRequest: async (request) => {
        const id = `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        const requestedAt = now.toISOString();

        const newRequest: LeaveRequest = {
          ...request,
          id,
          requestedAt,
          status: 'pending',
          createdAt: requestedAt,
          updatedAt: requestedAt,
        };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            INSERT INTO leave_requests (
              id, tenant_id, staff_id, start_date, end_date, leave_type,
              total_days, is_half_day, reason, status, requested_at,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, request.tenantId, request.staffId, request.startDate, request.endDate,
            request.leaveType, request.totalDays, request.isHalfDay ? 1 : 0,
            request.reason || null, 'pending', now.getTime(),
            now.getTime(), now.getTime()
          ]);

          set((state) => ({
            requests: [newRequest, ...state.requests],
          }));

          console.log(`[LeaveStore] Created leave request: ${id}`);

          // Broadcast
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastLeaveRequestCreated(newRequest);
          } catch (syncError) {
            console.warn('[LeaveStore] Broadcast failed (non-critical):', syncError);
          }

          return newRequest;
        } catch (error) {
          console.error('[LeaveStore] Failed to create leave request:', error);
          throw error;
        }
      },

      updateLeaveRequest: async (requestId: string, updates: Partial<LeaveRequest>) => {
        const request = get().requests.find(r => r.id === requestId);
        if (!request) throw new Error('Leave request not found');

        const now = new Date().toISOString();
        const updatedRequest = { ...request, ...updates, updatedAt: now };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            UPDATE leave_requests
            SET status = ?, reviewed_at = ?, reviewed_by = ?, review_notes = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [
            updatedRequest.status,
            updatedRequest.reviewedAt ? new Date(updatedRequest.reviewedAt).getTime() : null,
            updatedRequest.reviewedBy || null,
            updatedRequest.reviewNotes || null,
            new Date(now).getTime(),
            requestId,
            request.tenantId
          ]);

          set((state) => ({
            requests: state.requests.map(r => r.id === requestId ? updatedRequest : r),
          }));

          console.log(`[LeaveStore] Updated leave request: ${requestId}`);

          // Broadcast
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastLeaveRequestUpdated(requestId, updates);
          } catch (syncError) {
            console.warn('[LeaveStore] Broadcast failed (non-critical):', syncError);
          }
        } catch (error) {
          console.error('[LeaveStore] Failed to update leave request:', error);
          throw error;
        }
      },

      approveLeaveRequest: async (requestId: string, reviewedBy: string, reviewNotes?: string) => {
        const request = get().requests.find(r => r.id === requestId);
        if (!request) throw new Error('Leave request not found');

        // Deduct from balance
        const currentYear = new Date().getFullYear();
        let balance = get().getBalanceForStaff(request.staffId, currentYear);

        if (!balance) {
          // Initialize balance if it doesn't exist
          balance = await get().initializeBalanceForStaff(request.tenantId, request.staffId, currentYear);
        }

        // Update balance based on leave type
        const daysToDeduct = request.isHalfDay ? 0.5 : request.totalDays;
        const updatedBalance = { ...balance };

        switch (request.leaveType) {
          case 'vacation':
            updatedBalance.vacationDaysUsed += daysToDeduct;
            break;
          case 'sick':
            updatedBalance.sickDaysUsed += daysToDeduct;
            break;
          case 'personal':
            updatedBalance.personalDaysUsed += daysToDeduct;
            break;
          // emergency and unpaid don't deduct from balance
        }

        await get().updateBalance(updatedBalance);
        await get().updateLeaveRequest(requestId, {
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy,
          reviewNotes,
        });

        console.log(`[LeaveStore] Approved leave request ${requestId} for ${request.staffId}`);
      },

      rejectLeaveRequest: async (requestId: string, reviewedBy: string, reviewNotes: string) => {
        await get().updateLeaveRequest(requestId, {
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
          reviewedBy,
          reviewNotes,
        });
      },

      cancelLeaveRequest: async (requestId: string) => {
        const request = get().requests.find(r => r.id === requestId);
        if (!request) throw new Error('Leave request not found');

        // If it was approved, restore the balance
        if (request.status === 'approved') {
          const currentYear = new Date().getFullYear();
          const balance = get().getBalanceForStaff(request.staffId, currentYear);

          if (balance) {
            const daysToRestore = request.isHalfDay ? 0.5 : request.totalDays;
            const updatedBalance = { ...balance };

            switch (request.leaveType) {
              case 'vacation':
                updatedBalance.vacationDaysUsed -= daysToRestore;
                break;
              case 'sick':
                updatedBalance.sickDaysUsed -= daysToRestore;
                break;
              case 'personal':
                updatedBalance.personalDaysUsed -= daysToRestore;
                break;
            }

            await get().updateBalance(updatedBalance);
          }
        }

        await get().updateLeaveRequest(requestId, { status: 'cancelled' });
      },

      updateBalance: async (balance: LeaveBalance) => {
        const now = new Date().toISOString();
        const updatedBalance = { ...balance, updatedAt: now };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            UPDATE leave_balances
            SET vacation_days_total = ?, vacation_days_used = ?,
                sick_days_total = ?, sick_days_used = ?,
                personal_days_total = ?, personal_days_used = ?,
                updated_at = ?
            WHERE id = ?
          `, [
            balance.vacationDaysTotal, balance.vacationDaysUsed,
            balance.sickDaysTotal, balance.sickDaysUsed,
            balance.personalDaysTotal, balance.personalDaysUsed,
            new Date(now).getTime(),
            balance.id
          ]);

          set((state) => ({
            balances: state.balances.map(b => b.id === balance.id ? updatedBalance : b),
          }));

          console.log(`[LeaveStore] Updated leave balance for ${balance.staffId}`);
        } catch (error) {
          console.error('[LeaveStore] Failed to update leave balance:', error);
          throw error;
        }
      },

      initializeBalanceForStaff: async (tenantId: string, staffId: string, year: number) => {
        const id = `balance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        // Default allocations (can be customized based on company policy)
        const balance: LeaveBalance = {
          id,
          tenantId,
          staffId,
          year,
          vacationDaysTotal: 15,
          vacationDaysUsed: 0,
          sickDaysTotal: 10,
          sickDaysUsed: 0,
          personalDaysTotal: 5,
          personalDaysUsed: 0,
          createdAt: now,
          updatedAt: now,
        };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            INSERT INTO leave_balances (
              id, tenant_id, staff_id, year,
              vacation_days_total, vacation_days_used,
              sick_days_total, sick_days_used,
              personal_days_total, personal_days_used,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, tenantId, staffId, year,
            balance.vacationDaysTotal, 0,
            balance.sickDaysTotal, 0,
            balance.personalDaysTotal, 0,
            new Date(now).getTime(), new Date(now).getTime()
          ]);

          set((state) => ({
            balances: [...state.balances, balance],
          }));

          console.log(`[LeaveStore] Initialized leave balance for ${staffId}`);

          return balance;
        } catch (error) {
          console.error('[LeaveStore] Failed to initialize leave balance:', error);
          throw error;
        }
      },

      getBalanceForStaff: (staffId: string, year?: number) => {
        const currentYear = year || new Date().getFullYear();
        return get().balances.find(b => b.staffId === staffId && b.year === currentYear) || null;
      },

      getRequestsByStaff: (staffId: string) => {
        return get().requests.filter(r => r.staffId === staffId);
      },

      getPendingRequests: () => {
        return get().requests.filter(r => r.status === 'pending');
      },

      syncFromCloud: async (tenantId: string) => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          const { backendApi } = await import('../lib/backendApi');
          const cloudRequests = await backendApi.getLeaveRequests(tenantId);
          const cloudBalances = await backendApi.getLeaveBalances(tenantId);

          if (cloudRequests) {
            const db = await Database.load('sqlite:pos.db');
            for (const request of cloudRequests) {
              await db.execute(`
                INSERT OR REPLACE INTO leave_requests (
                  id, tenant_id, staff_id, start_date, end_date, leave_type,
                  total_days, is_half_day, reason, status, requested_at,
                  reviewed_at, reviewed_by, review_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                request.id, tenantId, request.staffId, request.startDate, request.endDate,
                request.leaveType, request.totalDays, request.isHalfDay ? 1 : 0,
                request.reason || null, request.status, new Date(request.requestedAt).getTime(),
                request.reviewedAt ? new Date(request.reviewedAt).getTime() : null,
                request.reviewedBy || null, request.reviewNotes || null,
                new Date(request.createdAt).getTime(), new Date(request.updatedAt).getTime()
              ]);
            }
            set({ requests: cloudRequests });
          }

          if (cloudBalances) {
            const db = await Database.load('sqlite:pos.db');
            for (const balance of cloudBalances) {
              await db.execute(`
                INSERT OR REPLACE INTO leave_balances (
                  id, tenant_id, staff_id, year,
                  vacation_days_total, vacation_days_used,
                  sick_days_total, sick_days_used,
                  personal_days_total, personal_days_used,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                balance.id, tenantId, balance.staffId, balance.year,
                balance.vacationDaysTotal, balance.vacationDaysUsed,
                balance.sickDaysTotal, balance.sickDaysUsed,
                balance.personalDaysTotal, balance.personalDaysUsed,
                new Date(balance.createdAt).getTime(), new Date(balance.updatedAt).getTime()
              ]);
            }
            set({ balances: cloudBalances });
          }

          set({ isSyncing: false });

          console.log('[LeaveStore] Synced leave data from cloud');
        } catch (error) {
          console.error('[LeaveStore] Failed to sync from cloud:', error);
          set({ isSyncing: false });
        }
      },

      syncToCloud: async (tenantId: string) => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          const { backendApi } = await import('../lib/backendApi');
          const { requests, balances } = get();

          for (const request of requests) {
            await backendApi.saveLeaveRequest(tenantId, request);
          }

          for (const balance of balances) {
            await backendApi.updateLeaveBalance(tenantId, balance);
          }

          set({ isSyncing: false });

          console.log('[LeaveStore] Leave data synced to cloud');
        } catch (error) {
          console.error('[LeaveStore] Failed to sync to cloud:', error);
          set({ isSyncing: false });
        }
      },

      // Remote sync actions
      applyRemoteLeaveRequestCreated: (request) => {
        console.log(`[LeaveStore] Applying remote leave request created: ${request.id}`);
        set((state) => {
          if (state.requests.find(r => r.id === request.id)) {
            return state;
          }
          return { requests: [request, ...state.requests] };
        });
      },

      applyRemoteLeaveRequestUpdated: (requestId, updates) => {
        console.log(`[LeaveStore] Applying remote leave request updated: ${requestId}`);
        set((state) => ({
          requests: state.requests.map(r => r.id === requestId ? { ...r, ...updates } : r),
        }));
      },
    }),
    {
      name: 'leave-storage',
      partialize: (state) => ({
        requests: state.requests.slice(0, 50),
        balances: state.balances,
        isLoaded: state.isLoaded,
      }),
    }
  )
);

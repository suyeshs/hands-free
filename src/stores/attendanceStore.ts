import { create } from 'zustand';
import Database from '@tauri-apps/plugin-sql';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

export interface Break {
  id: string;
  type: 'meal' | 'rest' | 'other';
  startAt: string; // ISO timestamp
  endAt?: string;  // ISO timestamp
  durationMinutes?: number;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  staffId: string;
  staffName?: string; // Denormalized for display
  clockInAt: string;  // ISO timestamp
  clockOutAt?: string; // ISO timestamp
  scheduledStart?: string; // ISO timestamp
  scheduledEnd?: string;   // ISO timestamp
  breakDurationMinutes: number;
  breaks: Break[];
  shiftDate: string; // YYYY-MM-DD
  shiftType: 'regular' | 'overtime' | 'weekend' | 'holiday';
  rosterAssignmentId?: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  status: 'active' | 'completed' | 'missed' | 'excused';
  lateByMinutes: number;
  earlyDepartureMinutes: number;
  notes?: string;
  deviceId?: string;
  clockInMethod?: 'manual' | 'wifi-auto' | 'scheduled';
  clockInDeviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceFilters {
  staffId?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceRecord['status'];
}

interface AttendanceStore {
  // State
  records: AttendanceRecord[];
  activeRecord: AttendanceRecord | null; // Current user's active clock-in
  isLoaded: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // Actions - Clock Operations
  clockIn: (staffId: string, tenantId: string, options?: {
    scheduledStart?: string;
    method?: 'manual' | 'wifi-auto' | 'scheduled';
    deviceId?: string;
  }) => Promise<AttendanceRecord>;
  clockOut: (recordId: string) => Promise<void>;
  startBreak: (recordId: string, breakType: 'meal' | 'rest' | 'other') => Promise<void>;
  endBreak: (recordId: string, breakId: string) => Promise<void>;

  // Actions - Query Operations
  loadRecordsFromDatabase: (tenantId: string, filters?: AttendanceFilters) => Promise<void>;
  getActiveRecordForStaff: (staffId: string) => AttendanceRecord | null;
  getRecordsByStaff: (staffId: string, startDate?: string, endDate?: string) => AttendanceRecord[];
  getRecordsByDate: (date: string) => AttendanceRecord[];
  getTodayAttendance: () => AttendanceRecord[];

  // Actions - Management
  updateRecord: (recordId: string, updates: Partial<AttendanceRecord>) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
  calculateHours: (record: AttendanceRecord) => { total: number; regular: number; overtime: number };

  // Cloud Sync
  syncToDatabase: (tenantId: string) => Promise<void>;
  syncFromCloud: (tenantId: string) => Promise<void>;
  syncToCloud: (tenantId: string) => Promise<void>;

  // Remote sync (called when receiving updates from other devices)
  applyRemoteAttendanceSync: (records: AttendanceRecord[]) => void;
  applyRemoteClockIn: (record: AttendanceRecord) => void;
  applyRemoteClockOut: (recordId: string, clockOutData: any) => void;
  applyRemoteBreakUpdate: (recordId: string, breaks: Break[]) => void;
}

export const useAttendanceStore = create<AttendanceStore>()((set, get) => ({
      records: [],
      activeRecord: null,
      isLoaded: false,
      isLoading: false,
      isSyncing: false,
      lastSyncedAt: null,

      calculateHours: (record: AttendanceRecord) => {
        if (!record.clockOutAt) {
          return { total: 0, regular: 0, overtime: 0 };
        }

        const clockInTime = new Date(record.clockInAt).getTime();
        const clockOutTime = new Date(record.clockOutAt).getTime();
        const breakMinutes = record.breakDurationMinutes || 0;

        // Total hours worked (excluding breaks)
        const totalMinutes = (clockOutTime - clockInTime) / (1000 * 60) - breakMinutes;
        const totalHours = totalMinutes / 60;

        // Regular hours (up to 8 hours per day)
        const regularHours = Math.min(totalHours, 8);

        // Overtime hours (anything above 8 hours)
        const overtimeHours = Math.max(totalHours - 8, 0);

        return {
          total: Math.max(totalHours, 0),
          regular: Math.max(regularHours, 0),
          overtime: Math.max(overtimeHours, 0),
        };
      },

      loadRecordsFromDatabase: async (tenantId: string, filters?: AttendanceFilters) => {
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const db = await Database.load(DB_NAME);

          // Build query with filters
          let query = `
            SELECT id, tenant_id, staff_id, clock_in_at, clock_out_at, scheduled_start, scheduled_end,
                   break_duration_minutes, breaks_json, shift_date, shift_type, roster_assignment_id,
                   total_hours, regular_hours, overtime_hours, status, late_by_minutes, early_departure_minutes,
                   notes, device_id, clock_in_method, clock_in_device_id, created_at, updated_at
            FROM attendance_records
            WHERE tenant_id = ?
          `;
          const params: any[] = [tenantId];

          if (filters?.staffId) {
            query += ' AND staff_id = ?';
            params.push(filters.staffId);
          }
          if (filters?.startDate) {
            query += ' AND shift_date >= ?';
            params.push(filters.startDate);
          }
          if (filters?.endDate) {
            query += ' AND shift_date <= ?';
            params.push(filters.endDate);
          }
          if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
          }

          query += ' ORDER BY shift_date DESC, clock_in_at DESC';

          const result = await db.select<Array<{
            id: string;
            tenant_id: string;
            staff_id: string;
            clock_in_at: number;
            clock_out_at: number | null;
            scheduled_start: number | null;
            scheduled_end: number | null;
            break_duration_minutes: number;
            breaks_json: string | null;
            shift_date: string;
            shift_type: string;
            roster_assignment_id: string | null;
            total_hours: number | null;
            regular_hours: number | null;
            overtime_hours: number | null;
            status: string;
            late_by_minutes: number;
            early_departure_minutes: number;
            notes: string | null;
            device_id: string | null;
            clock_in_method: string | null;
            clock_in_device_id: string | null;
            created_at: number;
            updated_at: number;
          }>>(query, params);

          const recordsFromDb: AttendanceRecord[] = result.map(row => ({
            id: row.id,
            tenantId: row.tenant_id,
            staffId: row.staff_id,
            clockInAt: new Date(row.clock_in_at).toISOString(),
            clockOutAt: row.clock_out_at ? new Date(row.clock_out_at).toISOString() : undefined,
            scheduledStart: row.scheduled_start ? new Date(row.scheduled_start).toISOString() : undefined,
            scheduledEnd: row.scheduled_end ? new Date(row.scheduled_end).toISOString() : undefined,
            breakDurationMinutes: row.break_duration_minutes,
            breaks: row.breaks_json ? JSON.parse(row.breaks_json) : [],
            shiftDate: row.shift_date,
            shiftType: row.shift_type as AttendanceRecord['shiftType'],
            rosterAssignmentId: row.roster_assignment_id || undefined,
            totalHours: row.total_hours || undefined,
            regularHours: row.regular_hours || undefined,
            overtimeHours: row.overtime_hours || undefined,
            status: row.status as AttendanceRecord['status'],
            lateByMinutes: row.late_by_minutes,
            earlyDepartureMinutes: row.early_departure_minutes,
            notes: row.notes || undefined,
            deviceId: row.device_id || undefined,
            clockInMethod: row.clock_in_method as AttendanceRecord['clockInMethod'] || undefined,
            clockInDeviceId: row.clock_in_device_id || undefined,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          }));

          console.log(`[AttendanceStore] Loaded ${recordsFromDb.length} attendance records from database`);

          set({ records: recordsFromDb, isLoaded: true, isLoading: false });
        } catch (error) {
          console.error('[AttendanceStore] Failed to load records from database:', error);
          set({ isLoading: false });
        }
      },

      clockIn: async (staffId: string, tenantId: string, options?: {
        scheduledStart?: string;
        method?: 'manual' | 'wifi-auto' | 'scheduled';
        deviceId?: string;
      }) => {
        // Check for existing active record
        const existing = get().getActiveRecordForStaff(staffId);
        if (existing) {
          throw new Error('Staff member is already clocked in');
        }

        const id = `attendance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        const clockInAt = now.toISOString();
        const shiftDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

        // Extract options
        const scheduledStart = options?.scheduledStart;
        const clockInMethod = options?.method || 'manual';
        const clockInDeviceId = options?.deviceId;

        // Calculate late arrival if scheduled start provided
        let lateByMinutes = 0;
        if (scheduledStart) {
          const scheduledTime = new Date(scheduledStart).getTime();
          const actualTime = now.getTime();
          lateByMinutes = Math.max(0, Math.round((actualTime - scheduledTime) / (1000 * 60)));
        }

        const record: AttendanceRecord = {
          id,
          tenantId,
          staffId,
          clockInAt,
          scheduledStart,
          breakDurationMinutes: 0,
          breaks: [],
          shiftDate,
          shiftType: 'regular',
          status: 'active',
          lateByMinutes,
          earlyDepartureMinutes: 0,
          clockInMethod,
          clockInDeviceId,
          createdAt: clockInAt,
          updatedAt: clockInAt,
        };

        try {
          // Save to database
          const db = await Database.load(DB_NAME);
          await db.execute(`
            INSERT INTO attendance_records (
              id, tenant_id, staff_id, clock_in_at, scheduled_start,
              break_duration_minutes, breaks_json, shift_date, shift_type,
              status, late_by_minutes, early_departure_minutes,
              clock_in_method, clock_in_device_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, tenantId, staffId, now.getTime(),
            scheduledStart ? new Date(scheduledStart).getTime() : null,
            0, JSON.stringify([]), shiftDate, 'regular',
            'active', lateByMinutes, 0,
            clockInMethod, clockInDeviceId || null, now.getTime(), now.getTime(),
          ]);

          // Update local state
          set((state) => ({
            records: [record, ...state.records],
            activeRecord: record,
          }));

          console.log(`[AttendanceStore] Staff ${staffId} clocked in at ${clockInAt}`);

          // Broadcast to other devices
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastClockIn(record);
          } catch (syncError) {
            console.warn('[AttendanceStore] Broadcast failed (non-critical):', syncError);
          }

          return record;
        } catch (error) {
          console.error('[AttendanceStore] Failed to clock in:', error);
          throw error;
        }
      },

      clockOut: async (recordId: string) => {
        const record = get().records.find(r => r.id === recordId);
        if (!record) {
          throw new Error('Attendance record not found');
        }
        if (record.clockOutAt) {
          throw new Error('Staff member is already clocked out');
        }

        const now = new Date();
        const clockOutAt = now.toISOString();

        // Calculate hours
        const hours = get().calculateHours({ ...record, clockOutAt });

        // Calculate early departure if scheduled end provided
        let earlyDepartureMinutes = 0;
        if (record.scheduledEnd) {
          const scheduledTime = new Date(record.scheduledEnd).getTime();
          const actualTime = now.getTime();
          earlyDepartureMinutes = Math.max(0, Math.round((scheduledTime - actualTime) / (1000 * 60)));
        }

        try {
          // Update database
          const db = await Database.load(DB_NAME);
          await db.execute(`
            UPDATE attendance_records
            SET clock_out_at = ?, total_hours = ?, regular_hours = ?, overtime_hours = ?,
                status = ?, early_departure_minutes = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [
            now.getTime(), hours.total, hours.regular, hours.overtime,
            'completed', earlyDepartureMinutes, now.getTime(),
            recordId, record.tenantId,
          ]);

          // Update local state
          set((state) => ({
            records: state.records.map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    clockOutAt,
                    totalHours: hours.total,
                    regularHours: hours.regular,
                    overtimeHours: hours.overtime,
                    status: 'completed' as const,
                    earlyDepartureMinutes,
                    updatedAt: clockOutAt,
                  }
                : r
            ),
            activeRecord: state.activeRecord?.id === recordId ? null : state.activeRecord,
          }));

          console.log(`[AttendanceStore] Staff clocked out: ${recordId}, Hours: ${hours.total.toFixed(2)}`);

          // Broadcast to other devices
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastClockOut(recordId, { clockOutAt, hours, earlyDepartureMinutes });
          } catch (syncError) {
            console.warn('[AttendanceStore] Broadcast failed (non-critical):', syncError);
          }
        } catch (error) {
          console.error('[AttendanceStore] Failed to clock out:', error);
          throw error;
        }
      },

      startBreak: async (recordId: string, breakType: 'meal' | 'rest' | 'other') => {
        const record = get().records.find(r => r.id === recordId);
        if (!record) {
          throw new Error('Attendance record not found');
        }

        const breakId = `break-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const newBreak: Break = {
          id: breakId,
          type: breakType,
          startAt: now,
        };

        const updatedBreaks = [...record.breaks, newBreak];

        try {
          // Update database
          const db = await Database.load(DB_NAME);
          await db.execute(`
            UPDATE attendance_records
            SET breaks_json = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [JSON.stringify(updatedBreaks), Date.now(), recordId, record.tenantId]);

          // Update local state
          set((state) => ({
            records: state.records.map((r) =>
              r.id === recordId ? { ...r, breaks: updatedBreaks, updatedAt: now } : r
            ),
            activeRecord: state.activeRecord?.id === recordId
              ? { ...state.activeRecord, breaks: updatedBreaks, updatedAt: now }
              : state.activeRecord,
          }));

          console.log(`[AttendanceStore] Break started: ${breakId} (${breakType})`);

          // Broadcast to other devices
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastBreakUpdate(recordId, updatedBreaks);
          } catch (syncError) {
            console.warn('[AttendanceStore] Broadcast failed (non-critical):', syncError);
          }
        } catch (error) {
          console.error('[AttendanceStore] Failed to start break:', error);
          throw error;
        }
      },

      endBreak: async (recordId: string, breakId: string) => {
        const record = get().records.find(r => r.id === recordId);
        if (!record) {
          throw new Error('Attendance record not found');
        }

        const breakToEnd = record.breaks.find(b => b.id === breakId);
        if (!breakToEnd) {
          throw new Error('Break not found');
        }
        if (breakToEnd.endAt) {
          throw new Error('Break already ended');
        }

        const now = new Date().toISOString();
        const startTime = new Date(breakToEnd.startAt).getTime();
        const endTime = new Date(now).getTime();
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

        const updatedBreaks = record.breaks.map(b =>
          b.id === breakId ? { ...b, endAt: now, durationMinutes } : b
        );

        // Calculate total break duration
        const totalBreakMinutes = updatedBreaks.reduce(
          (sum, b) => sum + (b.durationMinutes || 0), 0
        );

        try {
          // Update database
          const db = await Database.load(DB_NAME);
          await db.execute(`
            UPDATE attendance_records
            SET breaks_json = ?, break_duration_minutes = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [
            JSON.stringify(updatedBreaks), totalBreakMinutes, Date.now(),
            recordId, record.tenantId
          ]);

          // Update local state
          set((state) => ({
            records: state.records.map((r) =>
              r.id === recordId
                ? { ...r, breaks: updatedBreaks, breakDurationMinutes: totalBreakMinutes, updatedAt: now }
                : r
            ),
            activeRecord: state.activeRecord?.id === recordId
              ? { ...state.activeRecord, breaks: updatedBreaks, breakDurationMinutes: totalBreakMinutes, updatedAt: now }
              : state.activeRecord,
          }));

          console.log(`[AttendanceStore] Break ended: ${breakId}, Duration: ${durationMinutes} min`);

          // Broadcast to other devices
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastBreakUpdate(recordId, updatedBreaks);
          } catch (syncError) {
            console.warn('[AttendanceStore] Broadcast failed (non-critical):', syncError);
          }
        } catch (error) {
          console.error('[AttendanceStore] Failed to end break:', error);
          throw error;
        }
      },

      getActiveRecordForStaff: (staffId: string) => {
        return get().records.find(r => r.staffId === staffId && r.status === 'active') || null;
      },

      getRecordsByStaff: (staffId: string, startDate?: string, endDate?: string) => {
        let filtered = get().records.filter(r => r.staffId === staffId);
        if (startDate) {
          filtered = filtered.filter(r => r.shiftDate >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter(r => r.shiftDate <= endDate);
        }
        return filtered;
      },

      getRecordsByDate: (date: string) => {
        return get().records.filter(r => r.shiftDate === date);
      },

      getTodayAttendance: () => {
        const today = new Date().toISOString().split('T')[0];
        return get().getRecordsByDate(today);
      },

      updateRecord: async (recordId: string, updates: Partial<AttendanceRecord>) => {
        const record = get().records.find(r => r.id === recordId);
        if (!record) {
          throw new Error('Attendance record not found');
        }

        const now = new Date().toISOString();
        const updatedRecord = { ...record, ...updates, updatedAt: now };

        try {
          // Update database
          const db = await Database.load(DB_NAME);
          await db.execute(`
            UPDATE attendance_records
            SET status = ?, notes = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [
            updatedRecord.status, updatedRecord.notes || null, Date.now(),
            recordId, record.tenantId
          ]);

          // Update local state
          set((state) => ({
            records: state.records.map((r) => (r.id === recordId ? updatedRecord : r)),
          }));

          console.log(`[AttendanceStore] Record updated: ${recordId}`);
        } catch (error) {
          console.error('[AttendanceStore] Failed to update record:', error);
          throw error;
        }
      },

      deleteRecord: async (recordId: string) => {
        const record = get().records.find(r => r.id === recordId);
        if (!record) return;

        try {
          // Delete from database
          const db = await Database.load(DB_NAME);
          await db.execute(`DELETE FROM attendance_records WHERE id = ? AND tenant_id = ?`,
            [recordId, record.tenantId]);

          // Update local state
          set((state) => ({
            records: state.records.filter((r) => r.id !== recordId),
          }));

          console.log(`[AttendanceStore] Record deleted: ${recordId}`);
        } catch (error) {
          console.error('[AttendanceStore] Failed to delete record:', error);
          throw error;
        }
      },

      syncToDatabase: async (tenantId: string) => {
        // This would sync from localStorage to SQLite (legacy migration)
        // For now, we primarily use SQLite as the source of truth
        console.log(`[AttendanceStore] Sync to database for tenant: ${tenantId}`);
      },

      syncFromCloud: async (tenantId: string) => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          const { backendApi } = await import('../lib/backendApi');
          const cloudRecords = await backendApi.getAttendanceRecords(tenantId);

          if (!cloudRecords || cloudRecords.length === 0) {
            console.log('[AttendanceStore] No attendance records in cloud');
            set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
            return;
          }

          // Save to SQLite
          const db = await Database.load(DB_NAME);
          for (const record of cloudRecords) {
            await db.execute(`
              INSERT OR REPLACE INTO attendance_records (
                id, tenant_id, staff_id, clock_in_at, clock_out_at, scheduled_start, scheduled_end,
                break_duration_minutes, breaks_json, shift_date, shift_type, roster_assignment_id,
                total_hours, regular_hours, overtime_hours, status, late_by_minutes, early_departure_minutes,
                notes, device_id, clock_in_method, clock_in_device_id, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              record.id, tenantId, record.staffId,
              new Date(record.clockInAt).getTime(),
              record.clockOutAt ? new Date(record.clockOutAt).getTime() : null,
              record.scheduledStart ? new Date(record.scheduledStart).getTime() : null,
              record.scheduledEnd ? new Date(record.scheduledEnd).getTime() : null,
              record.breakDurationMinutes,
              JSON.stringify(record.breaks),
              record.shiftDate,
              record.shiftType,
              record.rosterAssignmentId || null,
              record.totalHours || null,
              record.regularHours || null,
              record.overtimeHours || null,
              record.status,
              record.lateByMinutes,
              record.earlyDepartureMinutes,
              record.notes || null,
              record.deviceId || null,
              record.clockInMethod || 'manual',
              record.clockInDeviceId || null,
              new Date(record.createdAt).getTime(),
              new Date(record.updatedAt).getTime(),
            ]);
          }

          set({
            records: cloudRecords,
            isLoaded: true,
            isSyncing: false,
            lastSyncedAt: new Date().toISOString(),
          });

          console.log(`[AttendanceStore] Synced ${cloudRecords.length} records from cloud`);
        } catch (error) {
          console.error('[AttendanceStore] Failed to sync from cloud:', error);
          set({ isSyncing: false });
        }
      },

      syncToCloud: async (tenantId: string) => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          const { backendApi } = await import('../lib/backendApi');
          const { records } = get();

          await backendApi.bulkSaveAttendance(tenantId, records);

          set({
            isSyncing: false,
            lastSyncedAt: new Date().toISOString(),
          });

          console.log('[AttendanceStore] Attendance synced to cloud successfully');
        } catch (error) {
          console.error('[AttendanceStore] Failed to sync to cloud:', error);
          set({ isSyncing: false });
        }
      },

      // Remote sync actions
      applyRemoteAttendanceSync: (records) => {
        console.log(`[AttendanceStore] Applying remote attendance sync: ${records.length} records`);
        set((state) => {
          const localById = new Map(state.records.map(r => [r.id, r]));
          const merged = records.map(remote => {
            const local = localById.get(remote.id);
            if (local) {
              // Keep local if newer, otherwise use remote
              return new Date(remote.updatedAt) > new Date(local.updatedAt) ? remote : local;
            }
            return remote;
          });
          // Add any local-only records not in remote
          state.records.forEach(local => {
            if (!records.find(r => r.id === local.id)) {
              merged.push(local);
            }
          });
          return { records: merged, isLoaded: true };
        });
      },

      applyRemoteClockIn: (record) => {
        console.log(`[AttendanceStore] Applying remote clock in: ${record.staffId}`);
        set((state) => {
          if (state.records.find(r => r.id === record.id)) {
            return state;
          }
          return { records: [record, ...state.records] };
        });
      },

      applyRemoteClockOut: (recordId, clockOutData) => {
        console.log(`[AttendanceStore] Applying remote clock out: ${recordId}`);
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId ? { ...r, ...clockOutData, status: 'completed' as const } : r
          ),
          activeRecord: state.activeRecord?.id === recordId ? null : state.activeRecord,
        }));
      },

      applyRemoteBreakUpdate: (recordId, breaks) => {
        console.log(`[AttendanceStore] Applying remote break update: ${recordId}`);
        const totalBreakMinutes = breaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId ? { ...r, breaks, breakDurationMinutes: totalBreakMinutes } : r
          ),
          activeRecord: state.activeRecord?.id === recordId
            ? { ...state.activeRecord, breaks, breakDurationMinutes: totalBreakMinutes }
            : state.activeRecord,
        }));
      },
    }));

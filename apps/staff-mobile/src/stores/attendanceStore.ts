/**
 * Attendance Store for Staff Mobile App
 * Manages clock in/out and attendance tracking
 */

import { create } from 'zustand';
import { getDatabase } from '../lib/database';

export interface Break {
  id: string;
  type: 'meal' | 'rest' | 'other';
  startAt: string;
  endAt?: string;
  durationMinutes?: number;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  staffId: string;
  clockInAt: string;
  clockOutAt?: string;
  breakDurationMinutes: number;
  breaks: Break[];
  shiftDate: string;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  status: 'active' | 'completed';
  clockInMethod: 'manual' | 'wifi-auto';
  createdAt: string;
  updatedAt: string;
}

interface AttendanceStore {
  // State
  activeRecord: AttendanceRecord | null;
  todayRecords: AttendanceRecord[];
  isLoading: boolean;

  // Actions
  clockIn: (staffId: string, tenantId: string, method?: 'manual' | 'wifi-auto') => Promise<AttendanceRecord>;
  clockOut: () => Promise<void>;
  loadTodayAttendance: (staffId: string, tenantId: string) => Promise<void>;
  calculateDuration: () => string;
  getTodayStats: () => {
    hoursWorked: string;
    isActive: boolean;
  };
}

export const useAttendanceStore = create<AttendanceStore>()((set, get) => ({
  // Initial state
  activeRecord: null,
  todayRecords: [],
  isLoading: false,

  // Clock in
  clockIn: async (staffId: string, tenantId: string, method = 'manual') => {
    const now = new Date();
    const id = `attendance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const clockInAt = now.toISOString();
    const shiftDate = now.toISOString().split('T')[0];

    const record: AttendanceRecord = {
      id,
      tenantId,
      staffId,
      clockInAt,
      breakDurationMinutes: 0,
      breaks: [],
      shiftDate,
      status: 'active',
      clockInMethod: method,
      createdAt: clockInAt,
      updatedAt: clockInAt,
    };

    try {
      const db = await getDatabase();

      // Insert into database
      await db.execute(`
        INSERT INTO attendance_records (
          id, tenant_id, staff_id, clock_in_at, shift_date, break_duration_minutes,
          breaks_json, status, clock_in_method, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        tenantId,
        staffId,
        now.getTime(),
        shiftDate,
        0,
        JSON.stringify([]),
        'active',
        method,
        now.getTime(),
        now.getTime(),
      ]);

      console.log('[AttendanceStore] Clocked in:', id);

      set({ activeRecord: record });
      return record;
    } catch (error) {
      console.error('[AttendanceStore] Clock in failed:', error);
      throw error;
    }
  },

  // Clock out
  clockOut: async () => {
    const activeRecord = get().activeRecord;
    if (!activeRecord) {
      throw new Error('No active clock-in record found');
    }

    const now = new Date();
    const clockOutAt = now.toISOString();

    try {
      const db = await getDatabase();

      // Calculate hours
      const clockInTime = new Date(activeRecord.clockInAt).getTime();
      const clockOutTime = now.getTime();
      const breakMinutes = activeRecord.breakDurationMinutes || 0;

      const totalMinutes = (clockOutTime - clockInTime) / (1000 * 60) - breakMinutes;
      const totalHours = totalMinutes / 60;
      const regularHours = Math.min(totalHours, 8);
      const overtimeHours = Math.max(totalHours - 8, 0);

      // Update database
      await db.execute(`
        UPDATE attendance_records
        SET clock_out_at = ?,
            total_hours = ?,
            regular_hours = ?,
            overtime_hours = ?,
            status = 'completed',
            updated_at = ?
        WHERE id = ?
      `, [
        now.getTime(),
        totalHours,
        regularHours,
        overtimeHours,
        now.getTime(),
        activeRecord.id,
      ]);

      console.log('[AttendanceStore] Clocked out:', activeRecord.id, `(${totalHours.toFixed(2)}h)`);

      set({
        activeRecord: null,
        todayRecords: [
          ...get().todayRecords.filter(r => r.id !== activeRecord.id),
          {
            ...activeRecord,
            clockOutAt,
            totalHours,
            regularHours,
            overtimeHours,
            status: 'completed',
          },
        ],
      });
    } catch (error) {
      console.error('[AttendanceStore] Clock out failed:', error);
      throw error;
    }
  },

  // Load today's attendance
  loadTodayAttendance: async (staffId: string, tenantId: string) => {
    set({ isLoading: true });

    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];

      const records = await db.select<Array<{
        id: string;
        tenant_id: string;
        staff_id: string;
        clock_in_at: number;
        clock_out_at: number | null;
        break_duration_minutes: number;
        breaks_json: string | null;
        shift_date: string;
        total_hours: number | null;
        regular_hours: number | null;
        overtime_hours: number | null;
        status: string;
        clock_in_method: string;
        created_at: number;
        updated_at: number;
      }>>(`
        SELECT *
        FROM attendance_records
        WHERE staff_id = ? AND tenant_id = ? AND shift_date = ?
        ORDER BY clock_in_at DESC
      `, [staffId, tenantId, today]);

      const attendanceRecords: AttendanceRecord[] = records.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        staffId: row.staff_id,
        clockInAt: new Date(row.clock_in_at).toISOString(),
        clockOutAt: row.clock_out_at ? new Date(row.clock_out_at).toISOString() : undefined,
        breakDurationMinutes: row.break_duration_minutes,
        breaks: row.breaks_json ? JSON.parse(row.breaks_json) : [],
        shiftDate: row.shift_date,
        totalHours: row.total_hours || undefined,
        regularHours: row.regular_hours || undefined,
        overtimeHours: row.overtime_hours || undefined,
        status: row.status as 'active' | 'completed',
        clockInMethod: row.clock_in_method as 'manual' | 'wifi-auto',
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      }));

      // Find active record (not clocked out)
      const activeRecord = attendanceRecords.find(r => r.status === 'active' && !r.clockOutAt) || null;

      console.log(`[AttendanceStore] Loaded ${attendanceRecords.length} records, active: ${!!activeRecord}`);

      set({
        todayRecords: attendanceRecords,
        activeRecord,
        isLoading: false,
      });
    } catch (error) {
      console.error('[AttendanceStore] Load today attendance failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Calculate duration
  calculateDuration: () => {
    const activeRecord = get().activeRecord;
    if (!activeRecord) return '0h 0m';

    const now = new Date();
    const clockInTime = new Date(activeRecord.clockInAt);
    const diff = now.getTime() - clockInTime.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  },

  // Get today's stats
  getTodayStats: () => {
    const activeRecord = get().activeRecord;
    const todayRecords = get().todayRecords;

    // Calculate total hours from completed records
    const completedHours = todayRecords
      .filter(r => r.status === 'completed' && r.totalHours)
      .reduce((sum, r) => sum + (r.totalHours || 0), 0);

    // Add current active hours
    let currentHours = 0;
    if (activeRecord) {
      const now = new Date();
      const clockInTime = new Date(activeRecord.clockInAt);
      const diff = now.getTime() - clockInTime.getTime();
      currentHours = diff / (1000 * 60 * 60);
    }

    const totalHours = completedHours + currentHours;
    const hours = Math.floor(totalHours);
    const minutes = Math.floor((totalHours % 1) * 60);

    return {
      hoursWorked: `${hours}h ${minutes}m`,
      isActive: !!activeRecord,
    };
  },
}));

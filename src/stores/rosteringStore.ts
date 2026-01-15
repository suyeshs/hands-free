import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Database from '@tauri-apps/plugin-sql';

export interface WeeklyRoster {
  id: string;
  tenantId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  weekNumber: number;
  year: number;
  name?: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
  publishedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface RosterAssignment {
  id: string;
  tenantId: string;
  rosterId: string;
  staffId: string;
  staffName?: string; // Denormalized
  shiftDate: string;  // YYYY-MM-DD
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  shiftStart: string; // ISO timestamp
  shiftEnd: string;   // ISO timestamp
  shiftType: 'regular' | 'split' | 'overnight' | 'on-call';
  role?: string;
  position?: string;
  sectionId?: string;
  status: 'scheduled' | 'confirmed' | 'swapped' | 'cancelled';
  confirmedByStaff?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface RosteringStore {
  // State
  rosters: WeeklyRoster[];
  assignments: RosterAssignment[];
  currentWeekRoster: WeeklyRoster | null;
  isLoaded: boolean;
  isLoading: boolean;
  isSyncing: boolean;

  // Actions - Roster Management
  loadRostersFromDatabase: (tenantId: string) => Promise<void>;
  createWeeklyRoster: (tenantId: string, weekStartDate: string, name?: string) => Promise<WeeklyRoster>;
  updateRoster: (rosterId: string, updates: Partial<WeeklyRoster>) => Promise<void>;
  publishRoster: (rosterId: string, publishedBy: string) => Promise<void>;
  archiveRoster: (rosterId: string) => Promise<void>;
  deleteRoster: (rosterId: string) => Promise<void>;

  // Actions - Assignment Management
  addAssignment: (assignment: Omit<RosterAssignment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<RosterAssignment>;
  updateAssignment: (assignmentId: string, updates: Partial<RosterAssignment>) => Promise<void>;
  deleteAssignment: (assignmentId: string) => Promise<void>;
  bulkCreateAssignments: (assignments: Omit<RosterAssignment, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  confirmAssignment: (assignmentId: string, staffId: string) => Promise<void>;

  // Actions - Query Operations
  getRosterForWeek: (weekStartDate: string) => WeeklyRoster | null;
  getAssignmentsForRoster: (rosterId: string) => RosterAssignment[];
  getAssignmentsForStaff: (staffId: string, weekStartDate?: string) => RosterAssignment[];
  getAssignmentsForDate: (date: string) => RosterAssignment[];
  getCurrentWeekRoster: () => WeeklyRoster | null;
  getMySchedule: (staffId: string, weekStartDate?: string) => RosterAssignment[];

  // Utility
  calculateWeekDates: (date: Date) => { start: string; end: string; weekNumber: number; year: number };
  detectConflicts: (assignment: RosterAssignment) => { hasConflict: boolean; conflicts: RosterAssignment[] };

  // Cloud Sync
  syncToDatabase: (tenantId: string) => Promise<void>;
  syncFromCloud: (tenantId: string) => Promise<void>;
  syncToCloud: (tenantId: string) => Promise<void>;

  // Remote sync
  applyRemoteRosterSync: (rosters: WeeklyRoster[], assignments: RosterAssignment[]) => void;
  applyRemoteRosterUpdated: (rosterId: string, updates: Partial<WeeklyRoster>) => void;
  applyRemoteAssignmentAdded: (assignment: RosterAssignment) => void;
  applyRemoteAssignmentUpdated: (assignmentId: string, updates: Partial<RosterAssignment>) => void;
}

export const useRosteringStore = create<RosteringStore>()(
  persist(
    (set, get) => ({
      rosters: [],
      assignments: [],
      currentWeekRoster: null,
      isLoaded: false,
      isLoading: false,
      isSyncing: false,

      calculateWeekDates: (date: Date) => {
        // Get Monday of the week
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday (0)
        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);
        monday.setHours(0, 0, 0, 0);

        // Get Sunday of the week
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        // Calculate ISO week number
        const startOfYear = new Date(monday.getFullYear(), 0, 1);
        const daysSinceStartOfYear = Math.floor(
          (monday.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekNumber = Math.ceil((daysSinceStartOfYear + startOfYear.getDay() + 1) / 7);

        return {
          start: monday.toISOString().split('T')[0],
          end: sunday.toISOString().split('T')[0],
          weekNumber,
          year: monday.getFullYear(),
        };
      },

      detectConflicts: (assignment: RosterAssignment) => {
        const conflicts = get().assignments.filter(
          a =>
            a.id !== assignment.id &&
            a.staffId === assignment.staffId &&
            a.shiftDate === assignment.shiftDate &&
            a.status !== 'cancelled'
        );
        return {
          hasConflict: conflicts.length > 0,
          conflicts,
        };
      },

      loadRostersFromDatabase: async (tenantId: string) => {
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const db = await Database.load('sqlite:pos.db');

          // Load rosters
          const rostersResult = await db.select<Array<{
            id: string;
            tenant_id: string;
            week_start_date: string;
            week_end_date: string;
            week_number: number;
            year: number;
            name: string | null;
            status: string;
            published_at: number | null;
            published_by: string | null;
            created_at: number;
            updated_at: number;
            created_by: string | null;
          }>>(`
            SELECT id, tenant_id, week_start_date, week_end_date, week_number, year,
                   name, status, published_at, published_by, created_at, updated_at, created_by
            FROM weekly_rosters
            WHERE tenant_id = ?
            ORDER BY week_start_date DESC
          `, [tenantId]);

          const rosters: WeeklyRoster[] = rostersResult.map(row => ({
            id: row.id,
            tenantId: row.tenant_id,
            weekStartDate: row.week_start_date,
            weekEndDate: row.week_end_date,
            weekNumber: row.week_number,
            year: row.year,
            name: row.name || undefined,
            status: row.status as WeeklyRoster['status'],
            publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
            publishedBy: row.published_by || undefined,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
            createdBy: row.created_by || undefined,
          }));

          // Load assignments
          const assignmentsResult = await db.select<Array<{
            id: string;
            tenant_id: string;
            roster_id: string;
            staff_id: string;
            shift_date: string;
            day_of_week: string;
            shift_start: number;
            shift_end: number;
            shift_type: string;
            role: string | null;
            position: string | null;
            section_id: string | null;
            status: string;
            confirmed_by_staff: number | null;
            notes: string | null;
            created_at: number;
            updated_at: number;
          }>>(`
            SELECT id, tenant_id, roster_id, staff_id, shift_date, day_of_week,
                   shift_start, shift_end, shift_type, role, position, section_id,
                   status, confirmed_by_staff, notes, created_at, updated_at
            FROM roster_assignments
            WHERE tenant_id = ?
            ORDER BY shift_date ASC
          `, [tenantId]);

          const assignments: RosterAssignment[] = assignmentsResult.map(row => ({
            id: row.id,
            tenantId: row.tenant_id,
            rosterId: row.roster_id,
            staffId: row.staff_id,
            shiftDate: row.shift_date,
            dayOfWeek: row.day_of_week as RosterAssignment['dayOfWeek'],
            shiftStart: new Date(row.shift_start).toISOString(),
            shiftEnd: new Date(row.shift_end).toISOString(),
            shiftType: row.shift_type as RosterAssignment['shiftType'],
            role: row.role || undefined,
            position: row.position || undefined,
            sectionId: row.section_id || undefined,
            status: row.status as RosterAssignment['status'],
            confirmedByStaff: row.confirmed_by_staff ? new Date(row.confirmed_by_staff).toISOString() : undefined,
            notes: row.notes || undefined,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          }));

          // Find current week roster
          const weekDates = get().calculateWeekDates(new Date());
          const currentWeekRoster = rosters.find(r => r.weekStartDate === weekDates.start) || null;

          console.log(`[RosteringStore] Loaded ${rosters.length} rosters and ${assignments.length} assignments`);

          set({
            rosters,
            assignments,
            currentWeekRoster,
            isLoaded: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('[RosteringStore] Failed to load rosters:', error);
          set({ isLoading: false });
        }
      },

      createWeeklyRoster: async (tenantId: string, weekStartDate: string, name?: string) => {
        const id = `roster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        const weekDates = get().calculateWeekDates(new Date(weekStartDate));

        const roster: WeeklyRoster = {
          id,
          tenantId,
          weekStartDate: weekDates.start,
          weekEndDate: weekDates.end,
          weekNumber: weekDates.weekNumber,
          year: weekDates.year,
          name,
          status: 'draft',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            INSERT INTO weekly_rosters (
              id, tenant_id, week_start_date, week_end_date, week_number, year,
              name, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, tenantId, weekDates.start, weekDates.end, weekDates.weekNumber, weekDates.year,
            name || null, 'draft', now.getTime(), now.getTime()
          ]);

          set((state) => ({
            rosters: [roster, ...state.rosters],
          }));

          console.log(`[RosteringStore] Created roster: ${id} for week ${weekDates.start}`);

          // Broadcast
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastRosterUpdated(roster);
          } catch (syncError) {
            console.warn('[RosteringStore] Broadcast failed (non-critical):', syncError);
          }

          return roster;
        } catch (error) {
          console.error('[RosteringStore] Failed to create roster:', error);
          throw error;
        }
      },

      updateRoster: async (rosterId: string, updates: Partial<WeeklyRoster>) => {
        const roster = get().rosters.find(r => r.id === rosterId);
        if (!roster) throw new Error('Roster not found');

        const now = new Date();
        const updatedRoster = { ...roster, ...updates, updatedAt: now.toISOString() };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            UPDATE weekly_rosters
            SET name = ?, status = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [
            updatedRoster.name || null, updatedRoster.status, now.getTime(),
            rosterId, roster.tenantId
          ]);

          set((state) => ({
            rosters: state.rosters.map(r => r.id === rosterId ? updatedRoster : r),
          }));

          console.log(`[RosteringStore] Updated roster: ${rosterId}`);

          // Broadcast
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastRosterUpdated(updatedRoster);
          } catch (syncError) {
            console.warn('[RosteringStore] Broadcast failed (non-critical):', syncError);
          }
        } catch (error) {
          console.error('[RosteringStore] Failed to update roster:', error);
          throw error;
        }
      },

      publishRoster: async (rosterId: string, publishedBy: string) => {
        const now = new Date();
        await get().updateRoster(rosterId, {
          status: 'published',
          publishedAt: now.toISOString(),
          publishedBy,
        });
      },

      archiveRoster: async (rosterId: string) => {
        await get().updateRoster(rosterId, { status: 'archived' });
      },

      deleteRoster: async (rosterId: string) => {
        const roster = get().rosters.find(r => r.id === rosterId);
        if (!roster) return;

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`DELETE FROM weekly_rosters WHERE id = ? AND tenant_id = ?`,
            [rosterId, roster.tenantId]);

          set((state) => ({
            rosters: state.rosters.filter(r => r.id !== rosterId),
            assignments: state.assignments.filter(a => a.rosterId !== rosterId),
          }));

          console.log(`[RosteringStore] Deleted roster: ${rosterId}`);
        } catch (error) {
          console.error('[RosteringStore] Failed to delete roster:', error);
          throw error;
        }
      },

      addAssignment: async (assignment) => {
        const id = `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const newAssignment: RosterAssignment = {
          ...assignment,
          id,
          createdAt: now,
          updatedAt: now,
        };

        // Check for conflicts
        const { hasConflict } = get().detectConflicts(newAssignment);
        if (hasConflict) {
          console.warn(`[RosteringStore] Conflict detected for staff ${assignment.staffId} on ${assignment.shiftDate}`);
          // We'll allow it but log the warning - UI should handle conflict prevention
        }

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            INSERT INTO roster_assignments (
              id, tenant_id, roster_id, staff_id, shift_date, day_of_week,
              shift_start, shift_end, shift_type, role, position, section_id,
              status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, assignment.tenantId, assignment.rosterId, assignment.staffId,
            assignment.shiftDate, assignment.dayOfWeek,
            new Date(assignment.shiftStart).getTime(),
            new Date(assignment.shiftEnd).getTime(),
            assignment.shiftType,
            assignment.role || null,
            assignment.position || null,
            assignment.sectionId || null,
            assignment.status,
            assignment.notes || null,
            new Date(now).getTime(),
            new Date(now).getTime()
          ]);

          set((state) => ({
            assignments: [...state.assignments, newAssignment],
          }));

          console.log(`[RosteringStore] Added assignment: ${id}`);

          // Broadcast
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastAssignmentAdded(newAssignment);
          } catch (syncError) {
            console.warn('[RosteringStore] Broadcast failed (non-critical):', syncError);
          }

          return newAssignment;
        } catch (error) {
          console.error('[RosteringStore] Failed to add assignment:', error);
          throw error;
        }
      },

      updateAssignment: async (assignmentId: string, updates: Partial<RosterAssignment>) => {
        const assignment = get().assignments.find(a => a.id === assignmentId);
        if (!assignment) throw new Error('Assignment not found');

        const now = new Date().toISOString();
        const updatedAssignment = { ...assignment, ...updates, updatedAt: now };

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`
            UPDATE roster_assignments
            SET status = ?, notes = ?, confirmed_by_staff = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `, [
            updatedAssignment.status,
            updatedAssignment.notes || null,
            updatedAssignment.confirmedByStaff ? new Date(updatedAssignment.confirmedByStaff).getTime() : null,
            new Date(now).getTime(),
            assignmentId,
            assignment.tenantId
          ]);

          set((state) => ({
            assignments: state.assignments.map(a => a.id === assignmentId ? updatedAssignment : a),
          }));

          console.log(`[RosteringStore] Updated assignment: ${assignmentId}`);

          // Broadcast
          try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastAssignmentUpdated(assignmentId, updates);
          } catch (syncError) {
            console.warn('[RosteringStore] Broadcast failed (non-critical):', syncError);
          }
        } catch (error) {
          console.error('[RosteringStore] Failed to update assignment:', error);
          throw error;
        }
      },

      deleteAssignment: async (assignmentId: string) => {
        const assignment = get().assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        try {
          const db = await Database.load('sqlite:pos.db');
          await db.execute(`DELETE FROM roster_assignments WHERE id = ? AND tenant_id = ?`,
            [assignmentId, assignment.tenantId]);

          set((state) => ({
            assignments: state.assignments.filter(a => a.id !== assignmentId),
          }));

          console.log(`[RosteringStore] Deleted assignment: ${assignmentId}`);
        } catch (error) {
          console.error('[RosteringStore] Failed to delete assignment:', error);
          throw error;
        }
      },

      bulkCreateAssignments: async (assignments) => {
        const db = await Database.load('sqlite:pos.db');
        const newAssignments: RosterAssignment[] = [];

        for (const assignment of assignments) {
          const id = `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();

          const newAssignment: RosterAssignment = {
            ...assignment,
            id,
            createdAt: now,
            updatedAt: now,
          };

          try {
            await db.execute(`
              INSERT INTO roster_assignments (
                id, tenant_id, roster_id, staff_id, shift_date, day_of_week,
                shift_start, shift_end, shift_type, role, position, section_id,
                status, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              id, assignment.tenantId, assignment.rosterId, assignment.staffId,
              assignment.shiftDate, assignment.dayOfWeek,
              new Date(assignment.shiftStart).getTime(),
              new Date(assignment.shiftEnd).getTime(),
              assignment.shiftType,
              assignment.role || null,
              assignment.position || null,
              assignment.sectionId || null,
              assignment.status,
              assignment.notes || null,
              new Date(now).getTime(),
              new Date(now).getTime()
            ]);

            newAssignments.push(newAssignment);
          } catch (error) {
            console.error(`[RosteringStore] Failed to create assignment for ${assignment.staffId}:`, error);
          }
        }

        set((state) => ({
          assignments: [...state.assignments, ...newAssignments],
        }));

        console.log(`[RosteringStore] Bulk created ${newAssignments.length} assignments`);
      },

      confirmAssignment: async (assignmentId: string, _staffId: string) => {
        await get().updateAssignment(assignmentId, {
          status: 'confirmed',
          confirmedByStaff: new Date().toISOString(),
        });
      },

      getRosterForWeek: (weekStartDate: string) => {
        return get().rosters.find(r => r.weekStartDate === weekStartDate) || null;
      },

      getAssignmentsForRoster: (rosterId: string) => {
        return get().assignments.filter(a => a.rosterId === rosterId);
      },

      getAssignmentsForStaff: (staffId: string, weekStartDate?: string) => {
        let filtered = get().assignments.filter(a => a.staffId === staffId);
        if (weekStartDate) {
          const weekDates = get().calculateWeekDates(new Date(weekStartDate));
          filtered = filtered.filter(
            a => a.shiftDate >= weekDates.start && a.shiftDate <= weekDates.end
          );
        }
        return filtered.sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
      },

      getAssignmentsForDate: (date: string) => {
        return get().assignments.filter(a => a.shiftDate === date);
      },

      getCurrentWeekRoster: () => {
        return get().currentWeekRoster;
      },

      getMySchedule: (staffId: string, weekStartDate?: string) => {
        return get().getAssignmentsForStaff(staffId, weekStartDate);
      },

      syncToDatabase: async (tenantId: string) => {
        console.log(`[RosteringStore] Sync to database for tenant: ${tenantId}`);
      },

      syncFromCloud: async (tenantId: string) => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          const { backendApi } = await import('../lib/backendApi');
          const cloudRosters = await backendApi.getRosters(tenantId);

          if (!cloudRosters || cloudRosters.length === 0) {
            console.log('[RosteringStore] No rosters in cloud');
            set({ isSyncing: false });
            return;
          }

          // Get assignments for all rosters
          const allAssignments: RosterAssignment[] = [];
          for (const roster of cloudRosters) {
            const assignments = await backendApi.getRosterAssignments(tenantId, roster.id);
            allAssignments.push(...assignments);
          }

          // Save to SQLite
          const db = await Database.load('sqlite:pos.db');
          for (const roster of cloudRosters) {
            await db.execute(`
              INSERT OR REPLACE INTO weekly_rosters (
                id, tenant_id, week_start_date, week_end_date, week_number, year,
                name, status, published_at, published_by, created_at, updated_at, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              roster.id, tenantId, roster.weekStartDate, roster.weekEndDate,
              roster.weekNumber, roster.year, roster.name || null, roster.status,
              roster.publishedAt ? new Date(roster.publishedAt).getTime() : null,
              roster.publishedBy || null,
              new Date(roster.createdAt).getTime(),
              new Date(roster.updatedAt).getTime(),
              roster.createdBy || null
            ]);
          }

          for (const assignment of allAssignments) {
            await db.execute(`
              INSERT OR REPLACE INTO roster_assignments (
                id, tenant_id, roster_id, staff_id, shift_date, day_of_week,
                shift_start, shift_end, shift_type, role, position, section_id,
                status, confirmed_by_staff, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              assignment.id, tenantId, assignment.rosterId, assignment.staffId,
              assignment.shiftDate, assignment.dayOfWeek,
              new Date(assignment.shiftStart).getTime(),
              new Date(assignment.shiftEnd).getTime(),
              assignment.shiftType,
              assignment.role || null,
              assignment.position || null,
              assignment.sectionId || null,
              assignment.status,
              assignment.confirmedByStaff ? new Date(assignment.confirmedByStaff).getTime() : null,
              assignment.notes || null,
              new Date(assignment.createdAt).getTime(),
              new Date(assignment.updatedAt).getTime()
            ]);
          }

          set({
            rosters: cloudRosters,
            assignments: allAssignments,
            isLoaded: true,
            isSyncing: false,
          });

          console.log(`[RosteringStore] Synced ${cloudRosters.length} rosters from cloud`);
        } catch (error) {
          console.error('[RosteringStore] Failed to sync from cloud:', error);
          set({ isSyncing: false });
        }
      },

      syncToCloud: async (tenantId: string) => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          const { backendApi } = await import('../lib/backendApi');
          const { rosters, assignments } = get();

          for (const roster of rosters) {
            const rosterAssignments = assignments.filter(a => a.rosterId === roster.id);
            await backendApi.saveRoster(tenantId, roster, rosterAssignments);
          }

          set({ isSyncing: false });

          console.log('[RosteringStore] Rosters synced to cloud successfully');
        } catch (error) {
          console.error('[RosteringStore] Failed to sync to cloud:', error);
          set({ isSyncing: false });
        }
      },

      // Remote sync actions
      applyRemoteRosterSync: (rosters, assignments) => {
        console.log(`[RosteringStore] Applying remote roster sync: ${rosters.length} rosters`);
        set({ rosters, assignments, isLoaded: true });
      },

      applyRemoteRosterUpdated: (rosterId, updates) => {
        console.log(`[RosteringStore] Applying remote roster updated: ${rosterId}`);
        set((state) => ({
          rosters: state.rosters.map(r => r.id === rosterId ? { ...r, ...updates } : r),
        }));
      },

      applyRemoteAssignmentAdded: (assignment) => {
        console.log(`[RosteringStore] Applying remote assignment added`);
        set((state) => {
          if (state.assignments.find(a => a.id === assignment.id)) {
            return state;
          }
          return { assignments: [...state.assignments, assignment] };
        });
      },

      applyRemoteAssignmentUpdated: (assignmentId, updates) => {
        console.log(`[RosteringStore] Applying remote assignment updated: ${assignmentId}`);
        set((state) => ({
          assignments: state.assignments.map(a => a.id === assignmentId ? { ...a, ...updates } : a),
        }));
      },
    }),
    {
      name: 'rostering-storage',
      partialize: (state) => ({
        rosters: state.rosters.slice(0, 20),
        assignments: state.assignments.slice(0, 100),
        isLoaded: state.isLoaded,
      }),
    }
  )
);

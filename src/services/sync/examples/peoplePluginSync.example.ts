/**
 * Example: People/Payroll Plugin Sync Implementation
 *
 * People plugin has TWO types of data:
 * 1. Static staff info (profiles, roles, permissions) - Manual/On-Update sync
 * 2. Attendance data (check-ins, check-outs) - Periodic sync for analytics
 *
 * This example shows how to register BOTH sync types in one plugin
 */

import { pluginSyncRegistry } from '../PluginSyncRegistry';
import Database from '@tauri-apps/plugin-sql';

export class PeoplePluginSync {
  private tenantId: string;
  private db: Database | null = null;

  // Two separate plugin IDs for different sync behaviors
  private staffInfoPluginId = 'people-staff-info';
  private attendancePluginId = 'people-attendance';

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Initialize - registers TWO sync handlers
   */
  async initialize(): Promise<void> {
    this.db = await Database.load('sqlite:guanix.db');

    // 1. Register staff info sync (manual/on-update)
    this.registerStaffInfoSync();

    // 2. Register attendance sync (periodic for analytics)
    this.registerAttendanceSync();

    console.log('[PeoplePluginSync] Registered 2 sync handlers: staff-info (manual), attendance (periodic)');
  }

  /**
   * Register staff info sync - manual/on-update only
   * Static data: staff profiles, roles, permissions
   */
  private registerStaffInfoSync(): void {
    pluginSyncRegistry.register({
      pluginId: this.staffInfoPluginId,
      pluginName: 'People - Staff Info',
      syncTables: ['staff', 'roles', 'permissions'],
      syncInterval: 0, // Not used for on-update
      enabled: true,
      syncType: 'on-update', // ← Sync after staff changes

      syncFunction: async () => {
        return await this.syncStaffInfo();
      },

      checkDataExists: async () => {
        return await this.hasStaffData();
      },

      getStatus: async () => {
        return await this.getStaffSyncStatus();
      },
    });

    console.log('[PeoplePluginSync] Registered staff-info sync (on-update)');
  }

  /**
   * Register attendance sync - periodic for analytics
   * Dynamic data: check-ins, check-outs, hours worked
   */
  private registerAttendanceSync(): void {
    pluginSyncRegistry.register({
      pluginId: this.attendancePluginId,
      pluginName: 'People - Attendance',
      syncTables: ['attendance', 'time_entries'],
      syncInterval: 180000, // 3 minutes - for real-time analytics
      enabled: true,
      syncType: 'periodic', // ← Automatic sync for analytics

      syncFunction: async () => {
        return await this.syncAttendance();
      },

      checkDataExists: async () => {
        return await this.hasAttendanceData();
      },

      getStatus: async () => {
        return await this.getAttendanceSyncStatus();
      },
    });

    console.log('[PeoplePluginSync] Registered attendance sync (periodic, 3 min)');
  }

  /**
   * Cleanup - unregister both handlers
   */
  cleanup(): void {
    pluginSyncRegistry.unregister(this.staffInfoPluginId);
    pluginSyncRegistry.unregister(this.attendancePluginId);
    console.log('[PeoplePluginSync] Both sync handlers unregistered');
  }

  /**
   * Sync staff info (profiles, roles, permissions)
   */
  private async syncStaffInfo(): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    if (!this.db) throw new Error('Database not initialized');

    let totalSynced = 0;
    let totalFailed = 0;
    const syncedTables: string[] = [];

    try {
      // Sync staff profiles
      const staffResult = await this.syncStaffProfiles();
      totalSynced += staffResult.synced;
      totalFailed += staffResult.failed;
      if (staffResult.synced > 0) syncedTables.push('staff');

      // Sync roles
      const rolesResult = await this.syncRoles();
      totalSynced += rolesResult.synced;
      totalFailed += rolesResult.failed;
      if (rolesResult.synced > 0) syncedTables.push('roles');

      return {
        synced: totalSynced,
        failed: totalFailed,
        tables: syncedTables,
      };
    } catch (error) {
      console.error('[PeoplePluginSync] Staff info sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync attendance data (check-ins, hours)
   */
  private async syncAttendance(): Promise<{
    synced: number;
    failed: number;
    tables: string[];
  }> {
    if (!this.db) throw new Error('Database not initialized');

    let totalSynced = 0;
    let totalFailed = 0;
    const syncedTables: string[] = [];

    try {
      // Sync attendance records
      const attendanceResult = await this.syncAttendanceRecords();
      totalSynced += attendanceResult.synced;
      totalFailed += attendanceResult.failed;
      if (attendanceResult.synced > 0) syncedTables.push('attendance');

      // Sync time entries
      const timeEntriesResult = await this.syncTimeEntries();
      totalSynced += timeEntriesResult.synced;
      totalFailed += timeEntriesResult.failed;
      if (timeEntriesResult.synced > 0) syncedTables.push('time_entries');

      return {
        synced: totalSynced,
        failed: totalFailed,
        tables: syncedTables,
      };
    } catch (error) {
      console.error('[PeoplePluginSync] Attendance sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync staff profiles
   */
  private async syncStaffProfiles(): Promise<{ synced: number; failed: number }> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tableExists = await this.checkTableExists('staff');
      if (!tableExists) return { synced: 0, failed: 0 };

      const staff = await this.db.select<any[]>(
        `SELECT * FROM staff
         WHERE tenant_id = $1
         AND (synced_at IS NULL OR updated_at > synced_at)`,
        [this.tenantId]
      );

      if (staff.length === 0) return { synced: 0, failed: 0 };

      // Sync to cloud
      const response = await fetch(`https://api.example.com/people/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: this.tenantId, staff }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync staff: ${response.statusText}`);
      }

      // Mark as synced
      for (const member of staff) {
        await this.db.execute(
          `UPDATE staff SET synced_at = $1 WHERE id = $2`,
          [new Date().toISOString(), member.id]
        );
      }

      return { synced: staff.length, failed: 0 };
    } catch (error) {
      console.error('[PeoplePluginSync] Failed to sync staff profiles:', error);
      return { synced: 0, failed: 1 };
    }
  }

  /**
   * Sync roles
   */
  private async syncRoles(): Promise<{ synced: number; failed: number }> {
    // Similar to syncStaffProfiles
    return { synced: 0, failed: 0 };
  }

  /**
   * Sync attendance records
   */
  private async syncAttendanceRecords(): Promise<{ synced: number; failed: number }> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tableExists = await this.checkTableExists('attendance');
      if (!tableExists) return { synced: 0, failed: 0 };

      // Get recent attendance records (last 7 days for analytics)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const attendance = await this.db.select<any[]>(
        `SELECT * FROM attendance
         WHERE tenant_id = $1
         AND check_in >= $2
         AND (synced_at IS NULL OR updated_at > synced_at)`,
        [this.tenantId, sevenDaysAgo.toISOString()]
      );

      if (attendance.length === 0) return { synced: 0, failed: 0 };

      // Sync to analytics cloud
      const response = await fetch(`https://api.example.com/people/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: this.tenantId, attendance }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync attendance: ${response.statusText}`);
      }

      // Mark as synced
      for (const record of attendance) {
        await this.db.execute(
          `UPDATE attendance SET synced_at = $1 WHERE id = $2`,
          [new Date().toISOString(), record.id]
        );
      }

      return { synced: attendance.length, failed: 0 };
    } catch (error) {
      console.error('[PeoplePluginSync] Failed to sync attendance:', error);
      return { synced: 0, failed: 1 };
    }
  }

  /**
   * Sync time entries
   */
  private async syncTimeEntries(): Promise<{ synced: number; failed: number }> {
    // Similar to syncAttendanceRecords
    return { synced: 0, failed: 0 };
  }

  /**
   * Data existence checks
   */
  private async hasStaffData(): Promise<boolean> {
    if (!this.db) return false;
    try {
      const tableExists = await this.checkTableExists('staff');
      if (!tableExists) return false;
      const result = await this.db.select<any[]>(
        `SELECT COUNT(*) as count FROM staff WHERE tenant_id = $1`,
        [this.tenantId]
      );
      return result[0]?.count > 0;
    } catch (error) {
      return false;
    }
  }

  private async hasAttendanceData(): Promise<boolean> {
    if (!this.db) return false;
    try {
      const tableExists = await this.checkTableExists('attendance');
      if (!tableExists) return false;
      const result = await this.db.select<any[]>(
        `SELECT COUNT(*) as count FROM attendance WHERE tenant_id = $1`,
        [this.tenantId]
      );
      return result[0]?.count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sync status
   */
  private async getStaffSyncStatus(): Promise<any> {
    // Implementation similar to menu example
    return {};
  }

  private async getAttendanceSyncStatus(): Promise<any> {
    // Implementation similar to menu example
    return {};
  }

  /**
   * Helper
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      const result = await this.db.select<any[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=$1`,
        [tableName]
      );
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Usage Examples:
 *
 * 1. Initialize both sync handlers:
 *    const peopleSync = new PeoplePluginSync(tenantId);
 *    await peopleSync.initialize();
 *    // Registers: staff-info (on-update) + attendance (periodic)
 *
 * 2. Trigger staff info sync after update:
 *    const handleSaveStaff = async (staff) => {
 *      // Save to database
 *      await db.execute('UPDATE staff SET ...', [staff.id]);
 *
 *      // Trigger sync after update
 *      const syncManager = getTieredSyncManager();
 *      await syncManager.triggerPluginOnUpdateSync('people-staff-info', {
 *        tables: ['staff']
 *      });
 *    };
 *
 * 3. Attendance syncs automatically every 3 minutes:
 *    // No manual trigger needed - runs automatically for analytics
 *    // Staff checks in → saved to DB → syncs automatically within 3 minutes
 */

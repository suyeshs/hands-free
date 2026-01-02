import { create } from 'zustand';
import Database from '@tauri-apps/plugin-sql';
import { FloorPlanState, Section, Table, StaffAssignment, TableStatus } from '../types/floor-plan';
import { backendApi } from '../lib/backendApi';

interface FloorPlanStore extends FloorPlanState {
    // Loading state
    isLoading: boolean;
    isLoaded: boolean;
    isSyncing: boolean;
    lastSyncedAt: string | null;

    // Actions
    loadFloorPlan: (tenantId: string) => Promise<void>;
    addSection: (name: string, tenantId?: string) => Promise<void>;
    removeSection: (id: string, tenantId?: string) => Promise<void>;
    addTable: (sectionId: string, tableNumber: string, capacity: number, tenantId?: string) => Promise<void>;
    removeTable: (id: string, tenantId?: string) => Promise<void>;
    updateTableStatus: (id: string, status: TableStatus, tenantId?: string) => Promise<void>;
    assignStaff: (userId: string, userName: string, sectionIds: string[], tableIds: string[], tenantId?: string) => Promise<void>;
    removeStaffAssignment: (userId: string, tenantId?: string) => Promise<void>;

    // Getters
    getSections: () => Section[];
    getTablesBySection: (sectionId: string) => Table[];
    getStaffAssignments: () => StaffAssignment[];

    // Helper methods for QR ordering
    getTableById: (tableId: string) => Table | null;
    getSectionById: (sectionId: string) => Section | null;
    getAssignedStaffForTable: (tableId: string) => StaffAssignment | null;
    getTablesForStaff: (staffId: string) => Table[];

    // Remote sync actions (called when receiving updates from other devices)
    applyRemoteFloorPlanSync: (sections: Section[], tables: Table[], assignments: StaffAssignment[]) => void;
    applyRemoteSectionAdded: (section: Section) => void;
    applyRemoteSectionRemoved: (sectionId: string) => void;
    applyRemoteTableAdded: (table: Table) => void;
    applyRemoteTableRemoved: (tableId: string) => void;
    applyRemoteTableStatusUpdated: (tableId: string, status: TableStatus) => void;
    applyRemoteStaffAssigned: (assignment: StaffAssignment) => void;

    // Cloud sync actions
    syncFromCloud: (tenantId: string) => Promise<void>;
    syncToCloud: (tenantId: string) => Promise<void>;
}

export const useFloorPlanStore = create<FloorPlanStore>()((set, get) => ({
    sections: [],
    tables: [],
    assignments: [],
    isLoading: false,
    isLoaded: false,
    isSyncing: false,
    lastSyncedAt: null,

    loadFloorPlan: async (tenantId: string) => {
        if (get().isLoading) return;

        set({ isLoading: true });

        try {
            const db = await Database.load('sqlite:pos.db');

            // Create tables if they don't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS floor_sections (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await db.execute(`
                CREATE TABLE IF NOT EXISTS floor_tables (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    section_id TEXT NOT NULL,
                    table_number TEXT NOT NULL,
                    capacity INTEGER DEFAULT 4,
                    qr_code_url TEXT,
                    status TEXT DEFAULT 'available',
                    assigned_staff_id TEXT,
                    current_order_id TEXT,
                    last_active_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (section_id) REFERENCES floor_sections(id) ON DELETE CASCADE
                )
            `);

            await db.execute(`
                CREATE TABLE IF NOT EXISTS floor_staff_assignments (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    user_name TEXT NOT NULL,
                    section_ids TEXT,
                    table_ids TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_sections_tenant ON floor_sections(tenant_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_tables_tenant ON floor_tables(tenant_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_tables_section ON floor_tables(section_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_assignments_tenant ON floor_staff_assignments(tenant_id)`);

            // Load sections
            const sectionsResult = await db.select<any[]>(
                `SELECT * FROM floor_sections WHERE tenant_id = ? ORDER BY created_at`,
                [tenantId]
            );

            const sections: Section[] = sectionsResult.map(row => ({
                id: row.id,
                name: row.name,
                isActive: row.is_active === 1,
            }));

            // Load tables
            const tablesResult = await db.select<any[]>(
                `SELECT * FROM floor_tables WHERE tenant_id = ? ORDER BY table_number`,
                [tenantId]
            );

            const tables: Table[] = tablesResult.map(row => ({
                id: row.id,
                sectionId: row.section_id,
                tableNumber: row.table_number,
                capacity: row.capacity,
                qrCodeUrl: row.qr_code_url,
                status: row.status as TableStatus,
                assignedStaffId: row.assigned_staff_id,
                currentOrderId: row.current_order_id,
                lastActiveAt: row.last_active_at,
            }));

            // Load assignments
            const assignmentsResult = await db.select<any[]>(
                `SELECT * FROM floor_staff_assignments WHERE tenant_id = ?`,
                [tenantId]
            );

            const assignments: StaffAssignment[] = assignmentsResult.map(row => ({
                userId: row.user_id,
                userName: row.user_name,
                sectionIds: row.section_ids ? JSON.parse(row.section_ids) : [],
                tableIds: row.table_ids ? JSON.parse(row.table_ids) : [],
            }));

            console.log(`[FloorPlanStore] Loaded ${sections.length} sections, ${tables.length} tables from database`);

            set({ sections, tables, assignments, isLoaded: true, isLoading: false });
        } catch (error) {
            console.error('[FloorPlanStore] Failed to load floor plan from database:', error);
            set({ isLoading: false });
        }
    },

    addSection: async (name, tenantId) => {
        const id = `sec-${Date.now()}`;
        const section: Section = { id, name, isActive: true };

        // Update local state immediately
        set((state) => ({
            sections: [...state.sections, section],
        }));

        // Persist to database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                await db.execute(
                    `INSERT INTO floor_sections (id, tenant_id, name, is_active) VALUES (?, ?, ?, ?)`,
                    [id, tenantId, name, 1]
                );
                console.log(`[FloorPlanStore] Added section ${id} to database`);

                // Sync to cloud (non-blocking)
                get().syncToCloud(tenantId).catch(e => console.warn('[FloorPlanStore] Cloud sync failed:', e));
            } catch (error) {
                console.error('[FloorPlanStore] Failed to save section to database:', error);
            }
        }

        // Broadcast to other devices
        try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastSectionAdded(section);
        } catch (syncError) {
            console.warn('[FloorPlanStore] Broadcast failed (non-critical):', syncError);
        }
    },

    removeSection: async (id, tenantId) => {
        // Update local state immediately
        set((state) => ({
            sections: state.sections.filter((s) => s.id !== id),
            tables: state.tables.filter((t) => t.sectionId !== id),
        }));

        // Remove from database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                // Delete tables in this section first
                await db.execute(
                    `DELETE FROM floor_tables WHERE section_id = ? AND tenant_id = ?`,
                    [id, tenantId]
                );
                // Delete the section
                await db.execute(
                    `DELETE FROM floor_sections WHERE id = ? AND tenant_id = ?`,
                    [id, tenantId]
                );
                console.log(`[FloorPlanStore] Removed section ${id} from database`);

                // Sync to cloud (non-blocking)
                get().syncToCloud(tenantId).catch(e => console.warn('[FloorPlanStore] Cloud sync failed:', e));
            } catch (error) {
                console.error('[FloorPlanStore] Failed to remove section from database:', error);
            }
        }

        // Broadcast to other devices
        try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastSectionRemoved(id);
        } catch (syncError) {
            console.warn('[FloorPlanStore] Broadcast failed (non-critical):', syncError);
        }
    },

    addTable: async (sectionId, tableNumber, capacity, tenantId) => {
        const id = `tab-${Date.now()}`;
        const qrCodeUrl = `${window.location.origin}/table/${id}`;
        const table: Table = {
            id,
            sectionId,
            tableNumber,
            capacity,
            qrCodeUrl,
            status: 'available',
        };

        // Update local state immediately
        set((state) => ({
            tables: [...state.tables, table],
        }));

        // Persist to database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                await db.execute(
                    `INSERT INTO floor_tables (id, tenant_id, section_id, table_number, capacity, qr_code_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, tenantId, sectionId, tableNumber, capacity, qrCodeUrl, 'available']
                );
                console.log(`[FloorPlanStore] Added table ${id} to database`);

                // Sync to cloud (non-blocking)
                get().syncToCloud(tenantId).catch(e => console.warn('[FloorPlanStore] Cloud sync failed:', e));
            } catch (error) {
                console.error('[FloorPlanStore] Failed to save table to database:', error);
            }
        }

        // Broadcast to other devices
        try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastTableAdded(table);
        } catch (syncError) {
            console.warn('[FloorPlanStore] Broadcast failed (non-critical):', syncError);
        }
    },

    removeTable: async (id, tenantId) => {
        // Update local state immediately
        set((state) => ({
            tables: state.tables.filter((t) => t.id !== id),
        }));

        // Remove from database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                await db.execute(
                    `DELETE FROM floor_tables WHERE id = ? AND tenant_id = ?`,
                    [id, tenantId]
                );
                console.log(`[FloorPlanStore] Removed table ${id} from database`);

                // Sync to cloud (non-blocking)
                get().syncToCloud(tenantId).catch(e => console.warn('[FloorPlanStore] Cloud sync failed:', e));
            } catch (error) {
                console.error('[FloorPlanStore] Failed to remove table from database:', error);
            }
        }

        // Broadcast to other devices
        try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastTableRemoved(id);
        } catch (syncError) {
            console.warn('[FloorPlanStore] Broadcast failed (non-critical):', syncError);
        }
    },

    updateTableStatus: async (id, status, tenantId) => {
        // Update local state immediately
        set((state) => ({
            tables: state.tables.map((t) =>
                t.id === id ? { ...t, status, lastActiveAt: new Date().toISOString() } : t
            ),
        }));

        // Update in database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                await db.execute(
                    `UPDATE floor_tables SET status = ?, last_active_at = ? WHERE id = ? AND tenant_id = ?`,
                    [status, new Date().toISOString(), id, tenantId]
                );
            } catch (error) {
                console.error('[FloorPlanStore] Failed to update table status in database:', error);
            }
        }

        // Broadcast to other devices
        try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastTableStatusUpdated(id, status);
        } catch (syncError) {
            console.warn('[FloorPlanStore] Broadcast failed (non-critical):', syncError);
        }
    },

    assignStaff: async (userId, userName, sectionIds, tableIds, tenantId) => {
        const assignment: StaffAssignment = { userId, userName, sectionIds, tableIds };

        // Update local state immediately
        set((state) => {
            const otherAssignments = state.assignments.filter((a) => a.userId !== userId);
            return {
                assignments: [...otherAssignments, assignment],
            };
        });

        // Persist to database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                const id = `assign-${userId}-${Date.now()}`;

                // Remove existing assignment for this user
                await db.execute(
                    `DELETE FROM floor_staff_assignments WHERE user_id = ? AND tenant_id = ?`,
                    [userId, tenantId]
                );

                // Insert new assignment
                await db.execute(
                    `INSERT INTO floor_staff_assignments (id, tenant_id, user_id, user_name, section_ids, table_ids) VALUES (?, ?, ?, ?, ?, ?)`,
                    [id, tenantId, userId, userName, JSON.stringify(sectionIds), JSON.stringify(tableIds)]
                );
                console.log(`[FloorPlanStore] Saved staff assignment for ${userId} to database`);

                // Sync to cloud (non-blocking)
                get().syncToCloud(tenantId).catch(e => console.warn('[FloorPlanStore] Cloud sync failed:', e));
            } catch (error) {
                console.error('[FloorPlanStore] Failed to save staff assignment to database:', error);
            }
        }

        // Broadcast to other devices
        try {
            const { orderSyncService } = await import('../lib/orderSyncService');
            orderSyncService.broadcastStaffAssigned(assignment);
        } catch (syncError) {
            console.warn('[FloorPlanStore] Broadcast failed (non-critical):', syncError);
        }
    },

    removeStaffAssignment: async (userId, tenantId) => {
        // Update local state immediately
        set((state) => ({
            assignments: state.assignments.filter((a) => a.userId !== userId),
        }));

        // Remove from database
        if (tenantId) {
            try {
                const db = await Database.load('sqlite:pos.db');
                await db.execute(
                    `DELETE FROM floor_staff_assignments WHERE user_id = ? AND tenant_id = ?`,
                    [userId, tenantId]
                );
                console.log(`[FloorPlanStore] Removed staff assignment for ${userId} from database`);

                // Sync to cloud (non-blocking)
                get().syncToCloud(tenantId).catch(e => console.warn('[FloorPlanStore] Cloud sync failed:', e));
            } catch (error) {
                console.error('[FloorPlanStore] Failed to remove staff assignment from database:', error);
            }
        }
    },

    getSections: () => get().sections,
    getTablesBySection: (sectionId) => get().tables.filter((t) => t.sectionId === sectionId),
    getStaffAssignments: () => get().assignments,

    // Helper methods for QR ordering
    getTableById: (tableId: string) => {
        return get().tables.find((t) => t.id === tableId) || null;
    },

    getSectionById: (sectionId: string) => {
        return get().sections.find((s) => s.id === sectionId) || null;
    },

    getAssignedStaffForTable: (tableId: string) => {
        const table = get().tables.find((t) => t.id === tableId);
        if (!table) return null;

        // Check if table has a directly assigned staff member
        if (table.assignedStaffId) {
            const assignment = get().assignments.find((a) => a.userId === table.assignedStaffId);
            if (assignment) return assignment;
        }

        // Fall back to section-level assignment
        const sectionAssignment = get().assignments.find((a) =>
            a.sectionIds.includes(table.sectionId)
        );
        return sectionAssignment || null;
    },

    getTablesForStaff: (staffId: string) => {
        const { tables, assignments } = get();
        const assignment = assignments.find((a) => a.userId === staffId);
        if (!assignment) return [];

        return tables.filter((t) => {
            // Table is directly assigned to staff
            if (t.assignedStaffId === staffId) return true;
            // Table is in one of the staff's assigned sections
            if (assignment.sectionIds.includes(t.sectionId)) return true;
            // Table is specifically in the staff's table list
            if (assignment.tableIds.includes(t.id)) return true;
            return false;
        });
    },

    // Remote sync actions (called when receiving updates from other devices)
    applyRemoteFloorPlanSync: (sections, tables, assignments) => {
        console.log(`[FloorPlanStore] Applying remote floor plan sync: ${sections.length} sections, ${tables.length} tables`);
        set({ sections, tables, assignments, isLoaded: true });
    },

    applyRemoteSectionAdded: (section) => {
        console.log(`[FloorPlanStore] Applying remote section added: ${section.name}`);
        set((state) => {
            if (state.sections.find(s => s.id === section.id)) {
                console.log(`[FloorPlanStore] Section ${section.id} already exists, skipping`);
                return state;
            }
            return { sections: [...state.sections, section] };
        });
    },

    applyRemoteSectionRemoved: (sectionId) => {
        console.log(`[FloorPlanStore] Applying remote section removed: ${sectionId}`);
        set((state) => ({
            sections: state.sections.filter((s) => s.id !== sectionId),
            tables: state.tables.filter((t) => t.sectionId !== sectionId),
        }));
    },

    applyRemoteTableAdded: (table) => {
        console.log(`[FloorPlanStore] Applying remote table added: ${table.tableNumber}`);
        set((state) => {
            if (state.tables.find(t => t.id === table.id)) {
                console.log(`[FloorPlanStore] Table ${table.id} already exists, skipping`);
                return state;
            }
            return { tables: [...state.tables, table] };
        });
    },

    applyRemoteTableRemoved: (tableId) => {
        console.log(`[FloorPlanStore] Applying remote table removed: ${tableId}`);
        set((state) => ({
            tables: state.tables.filter((t) => t.id !== tableId),
        }));
    },

    applyRemoteTableStatusUpdated: (tableId, status) => {
        console.log(`[FloorPlanStore] Applying remote table status updated: ${tableId} -> ${status}`);
        set((state) => ({
            tables: state.tables.map((t) =>
                t.id === tableId ? { ...t, status, lastActiveAt: new Date().toISOString() } : t
            ),
        }));
    },

    applyRemoteStaffAssigned: (assignment) => {
        console.log(`[FloorPlanStore] Applying remote staff assigned: ${assignment.userId}`);
        set((state) => {
            const otherAssignments = state.assignments.filter((a) => a.userId !== assignment.userId);
            return { assignments: [...otherAssignments, assignment] };
        });
    },

    // Cloud Sync: Fetch floor plan from D1 cloud and merge
    syncFromCloud: async (tenantId: string) => {
        if (!tenantId) {
            console.warn('[FloorPlanStore] No tenantId provided for cloud sync');
            return;
        }

        set({ isSyncing: true });

        try {
            console.log('[FloorPlanStore] Fetching floor plan from cloud...');
            const cloudData = await backendApi.getFloorPlan(tenantId);

            if (cloudData && (cloudData.sections.length > 0 || cloudData.tables.length > 0)) {
                console.log(`[FloorPlanStore] Cloud floor plan found: ${cloudData.sections.length} sections, ${cloudData.tables.length} tables`);

                // Cloud takes precedence for floor plan structure
                // Merge with local table statuses (which may be more recent)
                const localTables = get().tables;
                const mergedTables = cloudData.tables.map((cloudTable: Table) => {
                    const localTable = localTables.find(t => t.id === cloudTable.id);
                    if (localTable) {
                        // Keep local status if it's more recent (occupied, reserved, etc.)
                        return {
                            ...cloudTable,
                            status: localTable.status,
                            currentOrderId: localTable.currentOrderId,
                            lastActiveAt: localTable.lastActiveAt,
                        };
                    }
                    return cloudTable;
                });

                set({
                    sections: cloudData.sections,
                    tables: mergedTables,
                    assignments: cloudData.assignments,
                    isLoaded: true,
                    lastSyncedAt: new Date().toISOString(),
                });

                // Also persist to local SQLite for offline access
                try {
                    const db = await Database.load('sqlite:pos.db');

                    // Clear and repopulate local tables
                    await db.execute(`DELETE FROM floor_sections WHERE tenant_id = ?`, [tenantId]);
                    await db.execute(`DELETE FROM floor_tables WHERE tenant_id = ?`, [tenantId]);
                    await db.execute(`DELETE FROM floor_staff_assignments WHERE tenant_id = ?`, [tenantId]);

                    for (const section of cloudData.sections) {
                        await db.execute(
                            `INSERT INTO floor_sections (id, tenant_id, name, is_active) VALUES (?, ?, ?, ?)`,
                            [section.id, tenantId, section.name, section.isActive ? 1 : 0]
                        );
                    }

                    for (const table of mergedTables) {
                        await db.execute(
                            `INSERT INTO floor_tables (id, tenant_id, section_id, table_number, capacity, qr_code_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [table.id, tenantId, table.sectionId, table.tableNumber, table.capacity, table.qrCodeUrl, table.status]
                        );
                    }

                    for (const assignment of cloudData.assignments) {
                        await db.execute(
                            `INSERT INTO floor_staff_assignments (id, tenant_id, user_id, user_name, section_ids, table_ids) VALUES (?, ?, ?, ?, ?, ?)`,
                            [`assign-${assignment.userId}`, tenantId, assignment.userId, assignment.userName, JSON.stringify(assignment.sectionIds), JSON.stringify(assignment.tableIds)]
                        );
                    }

                    console.log('[FloorPlanStore] Synced cloud floor plan to local SQLite');
                } catch (dbError) {
                    console.warn('[FloorPlanStore] Failed to sync to local SQLite:', dbError);
                }

                console.log('[FloorPlanStore] Merged cloud floor plan successfully');
            } else {
                console.log('[FloorPlanStore] No cloud floor plan found');
            }
        } catch (error) {
            console.error('[FloorPlanStore] Failed to sync from cloud:', error);
        } finally {
            set({ isSyncing: false });
        }
    },

    // Cloud Sync: Push floor plan to D1 cloud
    syncToCloud: async (tenantId: string) => {
        if (!tenantId) {
            console.warn('[FloorPlanStore] No tenantId provided for cloud sync');
            return;
        }

        set({ isSyncing: true });

        try {
            const { sections, tables, assignments } = get();
            console.log(`[FloorPlanStore] Pushing floor plan to cloud: ${sections.length} sections, ${tables.length} tables`);
            await backendApi.saveFloorPlan(tenantId, sections, tables, assignments);
            set({ lastSyncedAt: new Date().toISOString() });
            console.log('[FloorPlanStore] Floor plan synced to cloud successfully');
        } catch (error) {
            console.error('[FloorPlanStore] Failed to sync to cloud:', error);
            // Don't throw - local save already succeeded
        } finally {
            set({ isSyncing: false });
        }
    },
}));

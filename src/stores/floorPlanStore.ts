import { create } from 'zustand';
import Database from '@tauri-apps/plugin-sql';
import { FloorPlanState, Section, Table, StaffAssignment, TableStatus } from '../types/floor-plan';

interface FloorPlanStore extends FloorPlanState {
    // Loading state
    isLoading: boolean;
    isLoaded: boolean;

    // Actions
    loadFloorPlan: (tenantId: string) => Promise<void>;
    addSection: (name: string, tenantId?: string) => Promise<void>;
    removeSection: (id: string, tenantId?: string) => Promise<void>;
    addTable: (sectionId: string, tableNumber: string, capacity: number, tenantId?: string) => Promise<void>;
    removeTable: (id: string, tenantId?: string) => Promise<void>;
    updateTableStatus: (id: string, status: TableStatus, tenantId?: string) => Promise<void>;
    assignStaff: (userId: string, userName: string, sectionIds: string[], tenantId?: string) => Promise<void>;

    // Getters
    getSections: () => Section[];
    getTablesBySection: (sectionId: string) => Table[];
    getStaffAssignments: () => StaffAssignment[];
}

export const useFloorPlanStore = create<FloorPlanStore>()((set, get) => ({
    sections: [],
    tables: [],
    assignments: [],
    isLoading: false,
    isLoaded: false,

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
            } catch (error) {
                console.error('[FloorPlanStore] Failed to save section to database:', error);
            }
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
            } catch (error) {
                console.error('[FloorPlanStore] Failed to remove section from database:', error);
            }
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
            } catch (error) {
                console.error('[FloorPlanStore] Failed to save table to database:', error);
            }
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
            } catch (error) {
                console.error('[FloorPlanStore] Failed to remove table from database:', error);
            }
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
    },

    assignStaff: async (userId, userName, sectionIds, tenantId) => {
        const assignment: StaffAssignment = { userId, userName, sectionIds, tableIds: [] };

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
                    [id, tenantId, userId, userName, JSON.stringify(sectionIds), JSON.stringify([])]
                );
                console.log(`[FloorPlanStore] Saved staff assignment for ${userId} to database`);
            } catch (error) {
                console.error('[FloorPlanStore] Failed to save staff assignment to database:', error);
            }
        }
    },

    getSections: () => get().sections,
    getTablesBySection: (sectionId) => get().tables.filter((t) => t.sectionId === sectionId),
    getStaffAssignments: () => get().assignments,
}));

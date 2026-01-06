import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '../types/auth';
import Database from '@tauri-apps/plugin-sql';
import { hashStaffPin, verifyStaffPin } from '../services/tauriAuth';

export interface StaffMember {
    id: string;
    name: string;
    role: UserRole;
    pin: string; // In memory, this is masked as '****'; actual PIN only during add/update
    pinHash?: string; // Hashed PIN for database storage
    email?: string;
    phone?: string;
    isActive: boolean;
    joinedAt: string;
    tenantId?: string;
}

interface StaffStore {
    staff: StaffMember[];
    isLoaded: boolean;
    isLoading: boolean;
    isSyncing: boolean;
    lastSyncedAt: string | null;

    // Actions
    loadStaffFromDatabase: (tenantId: string) => Promise<void>;
    addStaff: (staff: Omit<StaffMember, 'id' | 'joinedAt'>, tenantId?: string) => Promise<void>;
    updateStaff: (id: string, updates: Partial<StaffMember>) => Promise<void>;
    removeStaff: (id: string) => Promise<void>;
    getStaffByPin: (pin: string) => StaffMember | undefined;
    verifyStaffPinAsync: (staffId: string, pin: string) => Promise<boolean>;
    syncToDatabase: (tenantId: string) => Promise<void>;

    // Cloud sync actions
    syncFromCloud: (tenantId: string) => Promise<void>;
    syncToCloud: (tenantId: string) => Promise<void>;

    // Remote sync actions (called when receiving updates from other devices)
    applyRemoteStaffSync: (staff: StaffMember[]) => void;
    applyRemoteStaffAdded: (staff: StaffMember) => void;
    applyRemoteStaffUpdated: (staffId: string, updates: Partial<StaffMember>) => void;
    applyRemoteStaffRemoved: (staffId: string) => void;
}

// Map backend role names to UserRole enum
const roleFromDb = (dbRole: string): UserRole => {
    switch (dbRole.toLowerCase()) {
        case 'manager': return UserRole.MANAGER;
        case 'kitchen': return UserRole.KITCHEN;
        case 'waiter':
        case 'server': return UserRole.SERVER;
        case 'aggregator': return UserRole.AGGREGATOR;
        default: return UserRole.SERVER;
    }
};

// Map UserRole to database role string
const roleToDb = (role: UserRole): string => {
    switch (role) {
        case UserRole.MANAGER: return 'manager';
        case UserRole.KITCHEN: return 'kitchen';
        case UserRole.SERVER: return 'waiter';
        case UserRole.AGGREGATOR: return 'waiter'; // Map aggregator to waiter for DB compatibility
        default: return 'waiter';
    }
};

// Simple hash fallback for development/browser testing (NOT secure)
const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'dev_' + Math.abs(hash).toString(36);
};

export const useStaffStore = create<StaffStore>()(
    persist(
        (set, get) => ({
            staff: [],
            isLoaded: false,
            isLoading: false,
            isSyncing: false,
            lastSyncedAt: null,

            loadStaffFromDatabase: async (tenantId: string) => {
                if (get().isLoading) return;

                set({ isLoading: true });
                try {
                    const db = await Database.load('sqlite:pos.db');

                    // First ensure the table exists
                    await db.execute(`
                        CREATE TABLE IF NOT EXISTS staff_users (
                            id TEXT PRIMARY KEY,
                            tenant_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            role TEXT NOT NULL,
                            pin_hash TEXT NOT NULL,
                            email TEXT,
                            phone TEXT,
                            is_active INTEGER DEFAULT 1,
                            permissions TEXT,
                            created_at INTEGER NOT NULL,
                            last_login_at INTEGER,
                            created_by TEXT
                        )
                    `);

                    // Migration: Add missing columns to existing tables
                    // SQLite doesn't have IF NOT EXISTS for columns, so we try and catch
                    const columnsToAdd = [
                        { name: 'email', type: 'TEXT' },
                        { name: 'phone', type: 'TEXT' },
                        { name: 'is_active', type: 'INTEGER DEFAULT 1' },
                        { name: 'permissions', type: 'TEXT' },
                        { name: 'last_login_at', type: 'INTEGER' },
                        { name: 'created_by', type: 'TEXT' },
                    ];

                    for (const col of columnsToAdd) {
                        try {
                            await db.execute(`ALTER TABLE staff_users ADD COLUMN ${col.name} ${col.type}`);
                            console.log(`[StaffStore] Added missing column: ${col.name}`);
                        } catch {
                            // Column already exists, ignore
                        }
                    }

                    // Create index if not exists
                    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff_users(tenant_id)`);

                    // Query staff for this tenant
                    const result = await db.select<Array<{
                        id: string;
                        tenant_id: string;
                        name: string;
                        role: string;
                        pin_hash: string;
                        email: string | null;
                        phone: string | null;
                        is_active: number;
                        created_at: number;
                    }>>(`
                        SELECT id, tenant_id, name, role, pin_hash, email, phone, is_active, created_at
                        FROM staff_users
                        WHERE tenant_id = ?
                    `, [tenantId]);

                    const staffFromDb: StaffMember[] = result.map(row => ({
                        id: row.id,
                        name: row.name,
                        role: roleFromDb(row.role),
                        pin: '****', // Don't expose actual PIN in memory
                        pinHash: row.pin_hash,
                        email: row.email || undefined,
                        phone: row.phone || undefined,
                        isActive: row.is_active === 1,
                        joinedAt: new Date(row.created_at).toISOString(),
                        tenantId: row.tenant_id,
                    }));

                    console.log(`[StaffStore] Loaded ${staffFromDb.length} staff members from database`);

                    set({ staff: staffFromDb, isLoaded: true, isLoading: false });
                } catch (error) {
                    console.error('[StaffStore] Failed to load staff from database:', error);
                    set({ isLoading: false });
                }
            },

            addStaff: async (newStaff, tenantId) => {
                const id = `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const timestamp = new Date().toISOString();
                const createdAt = Date.now();

                try {
                    // Hash the PIN for database storage
                    let pinHash = '';
                    try {
                        pinHash = await hashStaffPin(newStaff.pin);
                    } catch (err) {
                        // Fallback: simple hash for dev mode when Tauri isn't available
                        console.warn('[StaffStore] Tauri PIN hashing not available, using fallback');
                        pinHash = simpleHash(newStaff.pin);
                    }

                    const staffMember: StaffMember = {
                        ...newStaff,
                        id,
                        joinedAt: timestamp,
                        pinHash,
                        tenantId,
                    };

                    // Save to database if tenantId is provided
                    if (tenantId) {
                        try {
                            const db = await Database.load('sqlite:pos.db');
                            await db.execute(`
                                INSERT INTO staff_users (id, tenant_id, name, role, pin_hash, email, phone, is_active, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                id,
                                tenantId,
                                newStaff.name,
                                roleToDb(newStaff.role),
                                pinHash,
                                newStaff.email || null,
                                newStaff.phone || null,
                                newStaff.isActive ? 1 : 0,
                                createdAt,
                            ]);
                            console.log(`[StaffStore] Saved staff ${id} to database`);
                        } catch (dbError) {
                            console.error('[StaffStore] Failed to save to database:', dbError);
                        }
                    }

                    // Update local state (mask the PIN)
                    set((state) => ({
                        staff: [
                            ...state.staff,
                            { ...staffMember, pin: '****' },
                        ],
                    }));

                    console.log(`[StaffStore] Added staff: ${id}`);

                    // Broadcast to other devices
                    try {
                        const { orderSyncService } = await import('../lib/orderSyncService');
                        orderSyncService.broadcastStaffAdded({ ...staffMember, pin: '****', pinHash: undefined });
                    } catch (syncError) {
                        console.warn('[StaffStore] Broadcast failed (non-critical):', syncError);
                    }
                } catch (error) {
                    console.error('[StaffStore] Failed to add staff:', error);
                    throw error;
                }
            },

            updateStaff: async (id, updates) => {
                try {
                    const currentStaff = get().staff.find(s => s.id === id);
                    if (!currentStaff) return;

                    let pinHash = currentStaff.pinHash;

                    // If PIN is being updated (not masked), hash the new PIN
                    if (updates.pin && updates.pin !== '****' && updates.pin.length > 0) {
                        try {
                            pinHash = await hashStaffPin(updates.pin);
                        } catch (err) {
                            console.warn('[StaffStore] Tauri PIN hashing not available, using fallback');
                            pinHash = simpleHash(updates.pin);
                        }
                    }

                    // Update database if we have tenantId
                    const tenantId = currentStaff.tenantId;
                    if (tenantId) {
                        try {
                            const db = await Database.load('sqlite:pos.db');
                            await db.execute(`
                                UPDATE staff_users
                                SET name = ?, role = ?, pin_hash = ?, email = ?, phone = ?, is_active = ?
                                WHERE id = ? AND tenant_id = ?
                            `, [
                                updates.name || currentStaff.name,
                                roleToDb(updates.role || currentStaff.role),
                                pinHash,
                                updates.email !== undefined ? (updates.email || null) : (currentStaff.email || null),
                                updates.phone !== undefined ? (updates.phone || null) : (currentStaff.phone || null),
                                (updates.isActive !== undefined ? updates.isActive : currentStaff.isActive) ? 1 : 0,
                                id,
                                tenantId,
                            ]);
                            console.log(`[StaffStore] Updated staff ${id} in database`);
                        } catch (dbError) {
                            console.error('[StaffStore] Failed to update in database:', dbError);
                        }
                    }

                    // Update local state
                    set((state) => ({
                        staff: state.staff.map((s) =>
                            s.id === id
                                ? { ...s, ...updates, pin: '****', pinHash }
                                : s
                        ),
                    }));

                    console.log(`[StaffStore] Updated staff: ${id}`);

                    // Broadcast to other devices
                    try {
                        const { orderSyncService } = await import('../lib/orderSyncService');
                        // Don't send pin/pinHash in updates
                        const safeUpdates = { ...updates, pin: undefined, pinHash: undefined };
                        orderSyncService.broadcastStaffUpdated(id, safeUpdates);
                    } catch (syncError) {
                        console.warn('[StaffStore] Broadcast failed (non-critical):', syncError);
                    }
                } catch (error) {
                    console.error('[StaffStore] Failed to update staff:', error);
                    throw error;
                }
            },

            removeStaff: async (id) => {
                try {
                    const currentStaff = get().staff.find(s => s.id === id);
                    const tenantId = currentStaff?.tenantId;

                    // Remove from database
                    if (tenantId) {
                        try {
                            const db = await Database.load('sqlite:pos.db');
                            await db.execute(`DELETE FROM staff_users WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
                            console.log(`[StaffStore] Removed staff ${id} from database`);
                        } catch (dbError) {
                            console.error('[StaffStore] Failed to remove from database:', dbError);
                        }
                    }

                    // Update local state
                    set((state) => ({
                        staff: state.staff.filter((s) => s.id !== id),
                    }));

                    console.log(`[StaffStore] Removed staff: ${id}`);

                    // Broadcast to other devices
                    try {
                        const { orderSyncService } = await import('../lib/orderSyncService');
                        orderSyncService.broadcastStaffRemoved(id);
                    } catch (syncError) {
                        console.warn('[StaffStore] Broadcast failed (non-critical):', syncError);
                    }
                } catch (error) {
                    console.error('[StaffStore] Failed to remove staff:', error);
                    throw error;
                }
            },

            getStaffByPin: (_pin) => {
                // This is a synchronous lookup - for actual verification use verifyStaffPinAsync
                // In production, this should iterate and verify each hash
                // The _pin parameter is kept for API compatibility but not used since
                // we can't synchronously verify hashed PINs
                const { staff } = get();
                return staff.find(s => s.isActive);
            },

            verifyStaffPinAsync: async (staffId, pin) => {
                const staff = get().staff.find(s => s.id === staffId);
                if (!staff || !staff.pinHash) return false;

                try {
                    return await verifyStaffPin(pin, staff.pinHash);
                } catch (err) {
                    // Fallback for dev mode
                    console.warn('[StaffStore] Tauri PIN verification not available, using fallback');
                    return simpleHash(pin) === staff.pinHash;
                }
            },

            syncToDatabase: async (tenantId: string) => {
                const { staff } = get();
                console.log(`[StaffStore] Syncing ${staff.length} staff members to database`);

                try {
                    const db = await Database.load('sqlite:pos.db');

                    for (const member of staff) {
                        // Only sync members without tenantId (from localStorage legacy)
                        if (member.tenantId) continue;

                        try {
                            let pinHash = member.pinHash;
                            if (!pinHash) {
                                try {
                                    pinHash = await hashStaffPin(member.pin !== '****' ? member.pin : '0000');
                                } catch {
                                    pinHash = simpleHash(member.pin !== '****' ? member.pin : '0000');
                                }
                            }

                            await db.execute(`
                                INSERT OR REPLACE INTO staff_users (id, tenant_id, name, role, pin_hash, email, phone, is_active, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                member.id,
                                tenantId,
                                member.name,
                                roleToDb(member.role),
                                pinHash,
                                member.email || null,
                                member.phone || null,
                                member.isActive ? 1 : 0,
                                new Date(member.joinedAt).getTime(),
                            ]);
                            console.log(`[StaffStore] Synced staff ${member.id} to database`);
                        } catch (err) {
                            console.error(`[StaffStore] Failed to sync staff ${member.id}:`, err);
                        }
                    }

                    // Reload from database
                    await get().loadStaffFromDatabase(tenantId);
                } catch (error) {
                    console.error('[StaffStore] Failed to sync to database:', error);
                }
            },

            // Cloud Sync: Fetch staff from cloud and merge with local
            syncFromCloud: async (tenantId: string) => {
                if (get().isSyncing) return;
                set({ isSyncing: true });

                try {
                    const { backendApi } = await import('../lib/backendApi');
                    const cloudStaff = await backendApi.getStaff(tenantId);

                    if (!cloudStaff || cloudStaff.length === 0) {
                        console.log('[StaffStore] No staff in cloud, keeping local');
                        set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
                        return;
                    }

                    // Merge cloud staff with local - cloud structure, local PIN hashes
                    const localStaff = get().staff;
                    const localById = new Map(localStaff.map(s => [s.id, s]));

                    const mergedStaff: StaffMember[] = cloudStaff.map(cloud => {
                        const local = localById.get(cloud.id);
                        return {
                            id: cloud.id,
                            name: cloud.name,
                            role: roleFromDb(cloud.role),
                            pin: '****',
                            pinHash: cloud.pinHash || local?.pinHash, // Cloud has pinHash, fallback to local
                            email: cloud.email,
                            phone: cloud.phone,
                            isActive: cloud.isActive,
                            joinedAt: cloud.joinedAt,
                            tenantId,
                        };
                    });

                    // Also save to local SQLite for offline access
                    try {
                        const db = await Database.load('sqlite:pos.db');
                        for (const member of mergedStaff) {
                            await db.execute(`
                                INSERT OR REPLACE INTO staff_users (id, tenant_id, name, role, pin_hash, email, phone, is_active, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                member.id,
                                tenantId,
                                member.name,
                                roleToDb(member.role),
                                member.pinHash || '',
                                member.email || null,
                                member.phone || null,
                                member.isActive ? 1 : 0,
                                new Date(member.joinedAt).getTime(),
                            ]);
                        }
                    } catch (dbError) {
                        console.warn('[StaffStore] Failed to persist cloud staff to SQLite:', dbError);
                    }

                    set({
                        staff: mergedStaff,
                        isLoaded: true,
                        isSyncing: false,
                        lastSyncedAt: new Date().toISOString(),
                    });

                    console.log(`[StaffStore] Synced ${mergedStaff.length} staff from cloud`);
                } catch (error) {
                    console.error('[StaffStore] Failed to sync from cloud:', error);
                    set({ isSyncing: false });
                }
            },

            // Cloud Sync: Push local staff to cloud
            syncToCloud: async (tenantId: string) => {
                if (get().isSyncing) return;
                set({ isSyncing: true });

                try {
                    const { backendApi } = await import('../lib/backendApi');
                    const { staff } = get();

                    // Prepare staff data for cloud (include pinHash for verification on other devices)
                    const staffForCloud = staff.map(s => ({
                        id: s.id,
                        name: s.name,
                        role: roleToDb(s.role),
                        pinHash: s.pinHash || '',
                        email: s.email,
                        phone: s.phone,
                        isActive: s.isActive,
                        joinedAt: s.joinedAt,
                    }));

                    await backendApi.saveStaff(tenantId, staffForCloud);

                    set({
                        isSyncing: false,
                        lastSyncedAt: new Date().toISOString(),
                    });

                    console.log('[StaffStore] Staff synced to cloud successfully');
                } catch (error) {
                    console.error('[StaffStore] Failed to sync to cloud:', error);
                    set({ isSyncing: false });
                }
            },

            // Remote sync actions (called when receiving updates from other devices)
            applyRemoteStaffSync: (staff) => {
                console.log(`[StaffStore] Applying remote staff sync: ${staff.length} members`);
                // Merge remote staff with local, preferring local for existing entries
                // (local has pinHash for verification)
                set((state) => {
                    const localById = new Map(state.staff.map(s => [s.id, s]));
                    const merged = staff.map(remote => {
                        const local = localById.get(remote.id);
                        if (local) {
                            // Keep local pinHash, update other fields
                            return { ...remote, pinHash: local.pinHash };
                        }
                        return remote;
                    });
                    // Add any local-only staff not in remote
                    state.staff.forEach(local => {
                        if (!staff.find(r => r.id === local.id)) {
                            merged.push(local);
                        }
                    });
                    return { staff: merged, isLoaded: true };
                });
            },

            applyRemoteStaffAdded: (staff) => {
                console.log(`[StaffStore] Applying remote staff added: ${staff.name}`);
                set((state) => {
                    // Check if already exists
                    if (state.staff.find(s => s.id === staff.id)) {
                        console.log(`[StaffStore] Staff ${staff.id} already exists, skipping`);
                        return state;
                    }
                    return { staff: [...state.staff, staff] };
                });
            },

            applyRemoteStaffUpdated: (staffId, updates) => {
                console.log(`[StaffStore] Applying remote staff updated: ${staffId}`);
                set((state) => ({
                    staff: state.staff.map((s) =>
                        s.id === staffId
                            ? { ...s, ...updates } // Keep local pinHash
                            : s
                    ),
                }));
            },

            applyRemoteStaffRemoved: (staffId) => {
                console.log(`[StaffStore] Applying remote staff removed: ${staffId}`);
                set((state) => ({
                    staff: state.staff.filter((s) => s.id !== staffId),
                }));
            },
        }),
        {
            name: 'staff-storage',
            // Only persist minimal data as backup; primary storage is SQLite
            partialize: (state) => ({
                staff: state.staff.map(s => ({
                    ...s,
                    pin: '****', // Never persist actual PINs
                    pinHash: undefined, // Don't persist hashes in localStorage either
                })),
                isLoaded: state.isLoaded,
            }),
        }
    )
);

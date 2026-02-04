/**
 * Auto-detect tenant ID from database
 * This helps when user has no tenantId but database has tenant-specific data
 */

import Database from '@tauri-apps/plugin-sql';
import { useAuthStore } from '../stores/authStore';
import { UserRole } from '../types/auth';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

export async function autoDetectAndSetTenant(): Promise<string | null> {
    try {
        console.log('[AutoDetectTenant] Checking if tenant ID needs auto-detection...');

        // Check if user already has a tenant ID
        const user = useAuthStore.getState().user;
        if (user?.tenantId) {
            console.log('[AutoDetectTenant] User already has tenant ID:', user.tenantId);
            return user.tenantId;
        }

        console.log('[AutoDetectTenant] User has no tenant ID, scanning database...');

        // Try to detect tenant from database
        const db = await Database.load(DB_NAME);

        // PRIORITY 1: Check tenant_config table (most reliable)
        try {
            const tenantConfig = await db.select<Array<{ tenant_id: string }>>(`
                SELECT tenant_id
                FROM tenant_config
                LIMIT 1
            `);

            if (tenantConfig.length > 0) {
                const detectedTenant = tenantConfig[0].tenant_id;
                console.log('[AutoDetectTenant] ✅ Detected tenant from tenant_config:', detectedTenant);

                // Update user's tenant ID (or create mock user if none exists)
                if (user) {
                    const updatedUser = { ...user, tenantId: detectedTenant };
                    useAuthStore.getState().setUser(updatedUser);
                    console.log('[AutoDetectTenant] ✅ Updated user tenant ID to:', detectedTenant);
                } else {
                    // Create mock owner user for SKIP_AUTH mode
                    const mockUser = {
                        id: 'owner-auto',
                        name: 'Owner',
                        email: 'owner@restaurant.local',
                        role: UserRole.OWNER,
                        tenantId: detectedTenant,
                    };
                    useAuthStore.getState().setUser(mockUser);
                    console.log('[AutoDetectTenant] ✅ Created mock owner user with tenant ID:', detectedTenant);
                }
                return detectedTenant;
            }
        } catch (e) {
            console.log('[AutoDetectTenant] No tenant_config data to check');
        }

        // FALLBACK 1: Check staff_users table for tenant IDs
        const staffTenants = await db.select<Array<{ tenant_id: string; count: number }>>(`
            SELECT tenant_id, COUNT(*) as count
            FROM staff_users
            GROUP BY tenant_id
            ORDER BY count DESC
            LIMIT 1
        `);

        if (staffTenants.length > 0) {
            const detectedTenant = staffTenants[0].tenant_id;
            console.log('[AutoDetectTenant] ✅ Detected tenant from staff_users:', detectedTenant);
            console.log('[AutoDetectTenant] Found', staffTenants[0].count, 'staff members');

            // Update user's tenant ID
            if (user) {
                const updatedUser = { ...user, tenantId: detectedTenant };
                useAuthStore.getState().setUser(updatedUser);
                console.log('[AutoDetectTenant] ✅ Updated user tenant ID to:', detectedTenant);
                return detectedTenant;
            }
        }

        // Try floor_tables as fallback
        try {
            const tableTenants = await db.select<Array<{ tenant_id: string; count: number }>>(`
                SELECT tenant_id, COUNT(*) as count
                FROM floor_tables
                GROUP BY tenant_id
                ORDER BY count DESC
                LIMIT 1
            `);

            if (tableTenants.length > 0) {
                const detectedTenant = tableTenants[0].tenant_id;
                console.log('[AutoDetectTenant] ✅ Detected tenant from floor_tables:', detectedTenant);

                if (user) {
                    const updatedUser = { ...user, tenantId: detectedTenant };
                    useAuthStore.getState().setUser(updatedUser);
                    console.log('[AutoDetectTenant] ✅ Updated user tenant ID to:', detectedTenant);
                    return detectedTenant;
                }
            }
        } catch (e) {
            console.log('[AutoDetectTenant] No floor_tables data to check');
        }

        console.log('[AutoDetectTenant] ⚠️  Could not detect tenant ID from database');
        return null;

    } catch (error) {
        console.error('[AutoDetectTenant] Error detecting tenant:', error);
        return null;
    }
}

/**
 * Check and warn if user has no tenant ID
 */
export function checkTenantId(): boolean {
    const user = useAuthStore.getState().user;
    if (!user) {
        console.warn('[AutoDetectTenant] ⚠️  No user logged in');
        return false;
    }

    if (!user.tenantId) {
        console.warn('[AutoDetectTenant] ⚠️  User has no tenant ID!');
        console.warn('[AutoDetectTenant] This will cause issues with:');
        console.warn('[AutoDetectTenant]   - Loading staff from database');
        console.warn('[AutoDetectTenant]   - Saving floor plan assignments');
        console.warn('[AutoDetectTenant]   - Generating QR codes');
        console.warn('[AutoDetectTenant]   - Any tenant-specific data');
        console.warn('[AutoDetectTenant]');
        console.warn('[AutoDetectTenant] Fix: Open http://localhost:1420/auto-detect-tenant.html');
        return false;
    }

    console.log('[AutoDetectTenant] ✅ User has tenant ID:', user.tenantId);
    return true;
}

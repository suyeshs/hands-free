/**
 * Migration script to fix QR code URLs for existing tables
 * Adds the `#` symbol required by HashRouter
 */

import Database from '@tauri-apps/plugin-sql';

export async function fixExistingQRCodeURLs(tenantId: string): Promise<{ fixed: number; errors: string[] }> {
    const errors: string[] = [];
    let fixedCount = 0;

    console.log(`[FixQRCodes] Starting QR code fix for tenant: ${tenantId}`);

    try {
        const db = await Database.load('sqlite:pos.db');

        // Get all tables for this tenant
        const tables = await db.select<any[]>(
            `SELECT id, table_number, qr_code_url FROM floor_tables WHERE tenant_id = ?`,
            [tenantId]
        );

        console.log(`[FixQRCodes] Found ${tables.length} tables to check`);
        console.log(`[FixQRCodes] Tables:`, tables);

        for (const table of tables) {
            const currentUrl = table.qr_code_url;
            let newUrl = currentUrl;

            // Generate URL if table has no QR code URL
            if (!currentUrl) {
                console.log(`[FixQRCodes] Table ${table.id} has no QR URL, generating new one`);
                // Generate URL - use localhost for development
                const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:1420';
                const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

                if (isLocalhost) {
                    newUrl = `${origin}/#/table/${table.id}`;
                } else {
                    newUrl = `https://${tenantId}.handsfree.tech/#/table/${table.id}`;
                }
                console.log(`[FixQRCodes] Generated URL: ${newUrl}`);
            }
            // Check if URL already has the hash
            else if (currentUrl.includes('/#/')) {
                console.log(`[FixQRCodes] Table ${table.id} QR URL already correct: ${currentUrl}`);
                continue;
            }
            // Fix existing URL by adding /#/ before /table/
            else {
                // For production URLs
                if (currentUrl.includes('.handsfree.tech/table/')) {
                    newUrl = currentUrl.replace('/table/', '/#/table/');
                }
                // For local dev URLs
                else if (currentUrl.match(/https?:\/\/[^/]+\/table\//)) {
                    newUrl = currentUrl.replace(/\/table\//, '/#/table/');
                }
            }

            if (newUrl !== currentUrl) {
                console.log(`[FixQRCodes] Fixing table ${table.id}:`);
                console.log(`  Old: ${currentUrl}`);
                console.log(`  New: ${newUrl}`);

                try {
                    await db.execute(
                        `UPDATE floor_tables SET qr_code_url = ? WHERE id = ? AND tenant_id = ?`,
                        [newUrl, table.id, tenantId]
                    );
                    fixedCount++;
                } catch (error) {
                    const errorMsg = `Failed to update table ${table.id}: ${error}`;
                    console.error(`[FixQRCodes] ${errorMsg}`);
                    errors.push(errorMsg);
                }
            }
        }

        console.log(`[FixQRCodes] ✅ Fixed ${fixedCount} QR code URLs`);
        return { fixed: fixedCount, errors };
    } catch (error) {
        const errorMsg = `Database error: ${error}`;
        console.error(`[FixQRCodes] ${errorMsg}`);
        errors.push(errorMsg);
        return { fixed: fixedCount, errors };
    }
}

/**
 * Validate QR code URL format
 */
export function validateQRCodeURL(url: string): { valid: boolean; reason?: string } {
    if (!url) {
        return { valid: false, reason: 'URL is empty' };
    }

    // Check if it's a valid URL
    try {
        new URL(url);
    } catch {
        return { valid: false, reason: 'Invalid URL format' };
    }

    // Check if it has the hash router path
    if (!url.includes('/#/table/')) {
        return { valid: false, reason: 'Missing /#/table/ in URL (required for HashRouter)' };
    }

    // Check if it has a table ID
    const tableIdMatch = url.match(/\/#\/table\/(.+)/);
    if (!tableIdMatch || !tableIdMatch[1]) {
        return { valid: false, reason: 'No table ID found in URL' };
    }

    return { valid: true };
}

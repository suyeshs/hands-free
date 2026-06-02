/**
 * Report Access Key Service
 *
 * Manages the single static key that remote devices present (X-Report-Key header)
 * to read sales reports from the POS over the cloudflared tunnel. Runs on the POS
 * device only (uses the Tauri SQL plugin); the key is displayed in Settings so the
 * owner can enter it on a remote device. The local web server validates incoming
 * requests against this same row (report_access_keys, id = 1).
 */

import Database from '@tauri-apps/plugin-sql';

const DB_NAME = import.meta.env.DEV ? 'sqlite:pos-dev.db' : 'sqlite:guanix.db';

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = Database.load(DB_NAME).then((loaded) => {
      db = loaded;
      return loaded;
    });
  }
  return dbPromise;
}

/** Generate a high-entropy URL-safe key. */
function generateKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the current report access key, creating one if none exists yet.
 * Returns null only on an unexpected DB error.
 */
export async function getOrCreateReportKey(): Promise<string | null> {
  try {
    const database = await getDb();

    const rows = await database.select<{ access_key: string }[]>(
      `SELECT access_key FROM report_access_keys WHERE id = 1`
    );
    if (rows.length > 0 && rows[0].access_key) {
      return rows[0].access_key;
    }

    const key = generateKey();
    await database.execute(
      `INSERT INTO report_access_keys (id, access_key) VALUES (1, $1)
       ON CONFLICT(id) DO UPDATE SET access_key = $1`,
      [key]
    );
    return key;
  } catch (err) {
    console.error('[ReportAccessService] Failed to get/create report key:', err);
    return null;
  }
}

/** Read the current key without creating one (null if remote reports not enabled). */
export async function getReportKey(): Promise<string | null> {
  try {
    const database = await getDb();
    const rows = await database.select<{ access_key: string }[]>(
      `SELECT access_key FROM report_access_keys WHERE id = 1`
    );
    return rows[0]?.access_key ?? null;
  } catch (err) {
    console.error('[ReportAccessService] Failed to read report key:', err);
    return null;
  }
}

/** Rotate the key (invalidates the old one on all remote devices). */
export async function rotateReportKey(): Promise<string | null> {
  try {
    const database = await getDb();
    const key = generateKey();
    await database.execute(
      `INSERT INTO report_access_keys (id, access_key, rotated_at) VALUES (1, $1, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET access_key = $1, rotated_at = CURRENT_TIMESTAMP`,
      [key]
    );
    return key;
  } catch (err) {
    console.error('[ReportAccessService] Failed to rotate report key:', err);
    return null;
  }
}

/** Disable remote reports entirely by removing the key row. */
export async function disableRemoteReports(): Promise<void> {
  try {
    const database = await getDb();
    await database.execute(`DELETE FROM report_access_keys WHERE id = 1`);
  } catch (err) {
    console.error('[ReportAccessService] Failed to disable remote reports:', err);
  }
}

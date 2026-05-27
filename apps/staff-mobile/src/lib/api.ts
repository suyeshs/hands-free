/**
 * Staff Mobile API Client
 * Thin wrapper around the tenant-worker for attendance and staff data.
 * Uses Tauri HTTP plugin when available (bypasses CORS on desktop).
 */

const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ||
  'https://handsfree-orders.suyesh.workers.dev';

async function platformFetch(url: string, options?: RequestInit): Promise<Response> {
  // Use native fetch — works in Tauri WebView and avoids dynamic import issues.
  // The Tauri HTTP plugin is only needed to bypass CORS on desktop; mobile WebView
  // handles HTTPS to workers.dev fine with standard fetch.
  return fetch(url, options);
}

function staffHeaders(tenantId: string, deviceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
  };
  if (deviceId) headers['X-Device-Id'] = deviceId;
  return headers;
}

export interface CloudStaffMember {
  id: string;
  name: string;
  role: string;
  pinHash: string;
  isActive: boolean;
  joinedAt: string;
}

export async function fetchStaffFromCloud(tenantId: string): Promise<CloudStaffMember[]> {
  const res = await platformFetch(`${WORKER_URL}/api/staff/${tenantId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { success: boolean; staff?: CloudStaffMember[] };
  if (!data.success || !data.staff) throw new Error('No staff in response');
  return data.staff;
}

export async function apiClockIn(
  tenantId: string,
  staffId: string,
  deviceId?: string
): Promise<void> {
  await platformFetch(`${WORKER_URL}/api/staff/attendance/clock-in`, {
    method: 'POST',
    headers: staffHeaders(tenantId, deviceId),
    body: JSON.stringify({ staffId, deviceId }),
  });
}

export async function apiClockOut(
  tenantId: string,
  staffId: string
): Promise<void> {
  await platformFetch(`${WORKER_URL}/api/staff/attendance/clock-out`, {
    method: 'POST',
    headers: staffHeaders(tenantId),
    body: JSON.stringify({ staffId }),
  });
}

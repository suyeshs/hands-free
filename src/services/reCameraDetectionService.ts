/**
 * reCamera Detection Processing Service
 *
 * Receives detection data from reCamera via HTTP webhook/WebSocket,
 * processes detections, and stores them in the Vision AI database.
 */

import Database from '@tauri-apps/plugin-sql';

export interface ReCameraDetection {
  camera_id: string;
  timestamp: number;
  detections: DetectionObject[];
  image_url?: string;
}

export interface DetectionObject {
  class_name: string;    // e.g., "person", "chair_occupied", "chair_empty"
  confidence: number;     // 0.0 - 1.0
  bbox: BoundingBox;      // Bounding box coordinates
  zone_id?: string;       // Table zone identifier (e.g., "table_1")
}

export interface BoundingBox {
  x: number;              // Top-left X
  y: number;              // Top-left Y
  width: number;
  height: number;
}

export interface TableOccupancy {
  table_id: string;
  occupied_seats: number;
  total_seats: number;
  occupancy_rate: number;
  last_updated: number;
}

export interface OccupancySnapshot {
  camera_id: string;
  location: string;
  timestamp: number;
  tables: TableOccupancy[];
  total_occupied: number;
  total_capacity: number;
  overall_occupancy: number;
}

/**
 * Process detection data from reCamera and store in database
 */
export async function processDetection(detection: ReCameraDetection): Promise<void> {
  try {
    const db = await Database.load('sqlite:handsfree.db');

    // Store each detected object
    for (const obj of detection.detections) {
      const detectionId = `det_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db.execute(
        `INSERT INTO vision_detections (
          id, camera_id, tenant_id, object_class, confidence,
          bbox_json, metadata_json, timestamp, created_at
        ) VALUES (?, ?, 'default', ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
        [
          detectionId,
          detection.camera_id,
          obj.class_name,
          obj.confidence,
          JSON.stringify(obj.bbox),
          JSON.stringify({ zone_id: obj.zone_id }),
          detection.timestamp,
        ]
      );
    }

    console.log(`[reCameraDetection] Processed ${detection.detections.length} detections from ${detection.camera_id}`);
  } catch (error) {
    console.error('[reCameraDetection] Failed to process detection:', error);
    throw error;
  }
}

/**
 * Calculate seat occupancy from recent detections
 */
export async function calculateOccupancy(
  cameraId: string,
  tableConfig: Record<string, number> // table_id -> total_seats
): Promise<OccupancySnapshot> {
  try {
    const db = await Database.load('sqlite:handsfree.db');

    // Get recent detections (last 30 seconds)
    const recentTimestamp = Math.floor(Date.now() / 1000) - 30;

    const detections = await db.select<Array<{
      object_class: string;
      metadata_json: string;
    }>>(
      `SELECT object_class, metadata_json
       FROM vision_detections
       WHERE camera_id = ? AND timestamp >= ?
       ORDER BY timestamp DESC`,
      [cameraId, recentTimestamp]
    );

    // Count occupied seats per table
    const tableCounts: Record<string, number> = {};

    for (const det of detections) {
      if (det.object_class === 'person' || det.object_class === 'chair_occupied') {
        const metadata = JSON.parse(det.metadata_json);
        const zoneId = metadata.zone_id;

        if (zoneId) {
          tableCounts[zoneId] = (tableCounts[zoneId] || 0) + 1;
        }
      }
    }

    // Build occupancy snapshot
    const tables: TableOccupancy[] = [];
    let totalOccupied = 0;
    let totalCapacity = 0;

    for (const [tableId, totalSeats] of Object.entries(tableConfig)) {
      const occupied = Math.min(tableCounts[tableId] || 0, totalSeats);

      tables.push({
        table_id: tableId,
        occupied_seats: occupied,
        total_seats: totalSeats,
        occupancy_rate: totalSeats > 0 ? occupied / totalSeats : 0,
        last_updated: Date.now(),
      });

      totalOccupied += occupied;
      totalCapacity += totalSeats;
    }

    // Get camera location
    const cameras = await db.select<Array<{ location: string }>>(
      `SELECT location FROM vision_cameras WHERE id = ?`,
      [cameraId]
    );
    const location = cameras[0]?.location || 'unknown';

    return {
      camera_id: cameraId,
      location,
      timestamp: Date.now(),
      tables,
      total_occupied: totalOccupied,
      total_capacity: totalCapacity,
      overall_occupancy: totalCapacity > 0 ? totalOccupied / totalCapacity : 0,
    };
  } catch (error) {
    console.error('[reCameraDetection] Failed to calculate occupancy:', error);
    throw error;
  }
}

/**
 * Store occupancy snapshot in analytics table
 */
export async function storeOccupancyAnalytics(snapshot: OccupancySnapshot): Promise<void> {
  try {
    const db = await Database.load('sqlite:handsfree.db');

    const hourTimestamp = Math.floor(snapshot.timestamp / 3600000) * 3600000;
    const analyticsId = `ana_${hourTimestamp}_${snapshot.camera_id}`;

    // Update or insert hourly analytics
    await db.execute(
      `INSERT INTO vision_analytics_hourly (
        id, camera_id, tenant_id, location, hour_timestamp,
        total_detections, person_count, avg_confidence,
        metadata_json, created_at, updated_at
      ) VALUES (?, ?, 'default', ?, ?, ?, ?, 1.0, ?, strftime('%s', 'now'), strftime('%s', 'now'))
      ON CONFLICT(camera_id, hour_timestamp) DO UPDATE SET
        total_detections = total_detections + ?,
        person_count = ?,
        metadata_json = ?,
        updated_at = strftime('%s', 'now')`,
      [
        analyticsId,
        snapshot.camera_id,
        snapshot.location,
        hourTimestamp,
        snapshot.tables.length,
        snapshot.total_occupied,
        JSON.stringify(snapshot),
        snapshot.tables.length,
        snapshot.total_occupied,
        JSON.stringify(snapshot),
      ]
    );

    console.log(`[reCameraDetection] Stored occupancy analytics for ${snapshot.camera_id}`);
  } catch (error) {
    console.error('[reCameraDetection] Failed to store analytics:', error);
    throw error;
  }
}

/**
 * Get current seat occupancy for all tables
 */
export async function getCurrentOccupancy(
  tableConfig: Record<string, number>
): Promise<OccupancySnapshot[]> {
  try {
    const db = await Database.load('sqlite:handsfree.db');

    // Get all active reCamera devices
    const cameras = await db.select<Array<{ id: string; location: string }>>(
      `SELECT id, location FROM vision_cameras WHERE type = 'recamera' AND status = 'online'`
    );

    const snapshots: OccupancySnapshot[] = [];

    for (const camera of cameras) {
      const snapshot = await calculateOccupancy(camera.id, tableConfig);
      snapshots.push(snapshot);
    }

    return snapshots;
  } catch (error) {
    console.error('[reCameraDetection] Failed to get current occupancy:', error);
    throw error;
  }
}

/**
 * Create a vision event for high occupancy alert
 */
export async function createHighOccupancyEvent(
  cameraId: string,
  occupancyRate: number,
  threshold: number = 0.9
): Promise<void> {
  if (occupancyRate < threshold) return;

  try {
    const db = await Database.load('sqlite:handsfree.db');
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await db.execute(
      `INSERT INTO vision_events (
        id, camera_id, tenant_id, event_type, severity,
        description, metadata_json, acknowledged, timestamp, created_at
      ) VALUES (?, ?, 'default', 'high_occupancy', 'warning', ?, ?, 0, ?, strftime('%s', 'now'))`,
      [
        eventId,
        cameraId,
        `High occupancy detected: ${Math.round(occupancyRate * 100)}%`,
        JSON.stringify({ occupancy_rate: occupancyRate, threshold }),
        Math.floor(Date.now() / 1000),
      ]
    );

    console.log(`[reCameraDetection] Created high occupancy event for ${cameraId}`);
  } catch (error) {
    console.error('[reCameraDetection] Failed to create event:', error);
  }
}

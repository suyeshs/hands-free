/**
 * Camera Feed Panel
 *
 * Displays live camera feed from reCamera devices with real-time detection overlays
 * and seat occupancy information. Independent panel for the left side of the app.
 */

import { useState, useEffect, useRef } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { Video, Camera, RefreshCw, X, AlertCircle, Users, Maximize2 } from 'lucide-react';
import {
  getCurrentOccupancy,
  type OccupancySnapshot,
} from '@/services/reCameraDetectionService';

interface CameraDevice {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  connection_config: string;
}

export default function CameraFeedPanel() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraDevice | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  // Load cameras on mount
  useEffect(() => {
    loadCameras();
  }, []);

  // Update occupancy data every 5 seconds when camera is selected
  useEffect(() => {
    if (!selectedCamera) return;

    const interval = setInterval(() => {
      updateOccupancy();
    }, 5000);

    updateOccupancy(); // Initial load

    return () => clearInterval(interval);
  }, [selectedCamera]);

  const loadCameras = async () => {
    try {
      setIsLoading(true);
      const db = await Database.load('sqlite:handsfree.db');
      const results = await db.select<CameraDevice[]>(
        `SELECT id, name, type, location, status, connection_config
         FROM vision_cameras
         WHERE type = 'recamera' AND enabled = 1
         ORDER BY created_at DESC`
      );

      setCameras(results);

      // Auto-select first online camera
      const onlineCamera = results.find((c) => c.status === 'online');
      if (onlineCamera && !selectedCamera) {
        setSelectedCamera(onlineCamera);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to load cameras:', err);
      setError('Failed to load cameras');
    } finally {
      setIsLoading(false);
    }
  };

  const updateOccupancy = async () => {
    if (!selectedCamera) return;

    try {
      // Example table configuration - should come from settings
      const tableConfig = {
        table_1: 4,
        table_2: 2,
        table_3: 6,
        table_4: 4,
        table_5: 8,
      };

      const snapshots = await getCurrentOccupancy(tableConfig);
      const cameraSnapshot = snapshots.find((s) => s.camera_id === selectedCamera.id);

      if (cameraSnapshot) {
        setOccupancy(cameraSnapshot);
      }
    } catch (err) {
      console.error('Failed to update occupancy:', err);
    }
  };

  const getCameraStreamUrl = (camera: CameraDevice): string => {
    try {
      const config = JSON.parse(camera.connection_config);

      // Try different stream endpoints
      // 1. MJPEG stream (most common)
      if (config.ipAddress) {
        return `http://${config.ipAddress}/stream`;
      }

      // 2. Fallback to web interface
      return config.httpUrl || `http://${config.ipAddress}`;
    } catch {
      return '';
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading cameras...</p>
        </div>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-300 mb-2">No Cameras Configured</h3>
          <p className="text-gray-500 mb-4">
            Add a reCamera device in Vision AI Settings to start viewing live feeds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} bg-gray-900 flex flex-col`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-white">Camera Feed</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={updateOccupancy}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <X className="w-4 h-4 text-gray-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Camera Selector */}
        <select
          value={selectedCamera?.id || ''}
          onChange={(e) => {
            const camera = cameras.find((c) => c.id === e.target.value);
            setSelectedCamera(camera || null);
          }}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
          {cameras.map((camera) => (
            <option key={camera.id} value={camera.id}>
              {camera.name} ({camera.location}) - {camera.status}
            </option>
          ))}
        </select>
      </div>

      {/* Video Feed */}
      <div className="flex-1 relative bg-black">
        {selectedCamera ? (
          <>
            {selectedCamera.status === 'online' ? (
              <iframe
                ref={videoRef}
                src={getCameraStreamUrl(selectedCamera)}
                className="w-full h-full border-0"
                title={`${selectedCamera.name} feed`}
                allow="camera"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-gray-400">Camera Offline</p>
                  <p className="text-sm text-gray-500">Status: {selectedCamera.status}</p>
                </div>
              </div>
            )}

            {/* Detection Overlay - shown over video */}
            {occupancy && (
              <div className="absolute top-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <span className="font-bold">Seat Occupancy</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.round(occupancy.overall_occupancy * 100)}%
                  </div>
                </div>

                <div className="text-sm text-gray-300">
                  {occupancy.total_occupied} of {occupancy.total_capacity} seats occupied
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a camera to view feed</p>
          </div>
        )}
      </div>

      {/* Occupancy Details */}
      {occupancy && !isFullscreen && (
        <div className="bg-gray-800 border-t border-gray-700 p-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-300 mb-3">Table Breakdown</h3>

          <div className="space-y-2">
            {occupancy.tables.map((table) => (
              <div
                key={table.table_id}
                className="bg-gray-900/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-white capitalize">
                    {table.table_id.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-gray-400">
                    {table.occupied_seats} / {table.total_seats} seats
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        table.occupancy_rate >= 0.9
                          ? 'bg-red-500'
                          : table.occupancy_rate >= 0.7
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${table.occupancy_rate * 100}%` }}
                    />
                  </div>

                  <span className="text-sm font-bold text-white w-12 text-right">
                    {Math.round(table.occupancy_rate * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border-t border-red-500/50 p-3 text-center text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

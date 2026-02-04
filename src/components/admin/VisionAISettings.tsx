/**
 * Vision AI Settings Component
 * Manage camera devices and their purposes
 */

import { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, Eye, Download, Search, Wifi, CheckCircle } from 'lucide-react';
import Database from '@tauri-apps/plugin-sql';
import {
  scanReCameras,
  testReCameraConnection,
  buildConnectionConfig,
  type DiscoveredReCamera,
} from '@/services/reCameraDiscoveryService';

interface CameraDevice {
  id: string;
  name: string;
  purpose: 'dining' | 'kitchen' | 'entrance' | 'bar' | 'parking' | 'storage' | 'custom';
  type: 'webcam' | 'ip_camera' | 'recamera' | 'airtel_xsafe';
  enabled: boolean;
  status: 'online' | 'offline' | 'error';
}

const DEVICE_PURPOSES = [
  { value: 'dining', label: 'Dining Area', description: 'Monitor dining area, table occupancy, and customer flow' },
  { value: 'kitchen', label: 'Kitchen', description: 'Monitor kitchen operations and safety compliance' },
  { value: 'entrance', label: 'Entrance', description: 'Track customer entry, exit, and foot traffic' },
  { value: 'bar', label: 'Bar Area', description: 'Monitor bar inventory and service operations' },
  { value: 'parking', label: 'Parking Area', description: 'Monitor parking lot and vehicle traffic' },
  { value: 'storage', label: 'Storage Area', description: 'Track inventory storage and stock levels' },
  { value: 'custom', label: 'Custom Location', description: 'Other custom monitoring purposes' },
];

const CAMERA_TYPES = [
  { value: 'webcam', label: 'Webcam' },
  { value: 'ip_camera', label: 'IP/RTSP Camera' },
  { value: 'recamera', label: 'reCamera' },
  { value: 'airtel_xsafe', label: 'Airtel Xsafe' },
];

export function VisionAISettings() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pluginInstalled, setPluginInstalled] = useState<boolean | null>(null);
  const [newCamera, setNewCamera] = useState({
    name: '',
    purpose: 'dining' as CameraDevice['purpose'],
    type: 'webcam' as CameraDevice['type'],
    ipAddress: '', // For reCamera manual entry
  });

  // Discovery state
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredReCamera[]>([]);
  const [scanning, setScanning] = useState(false);
  const [testingCamera, setTestingCamera] = useState<string | null>(null);
  const [showDiscoveryResults, setShowDiscoveryResults] = useState(false);

  useEffect(() => {
    checkPluginAndLoadCameras();
  }, []);

  const checkPluginAndLoadCameras = async () => {
    try {
      const db = await Database.load('sqlite:handsfree.db');

      // Check if vision_cameras table exists
      const tables = await db.select<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='vision_cameras'"
      );

      if (tables.length === 0) {
        setPluginInstalled(false);
        return;
      }

      setPluginInstalled(true);
      loadCameras();
    } catch (error) {
      console.error('Failed to check plugin status:', error);
      setPluginInstalled(false);
    }
  };

  const loadCameras = async () => {
    try {
      const db = await Database.load('sqlite:handsfree.db');
      const result = await db.select<CameraDevice[]>(
        'SELECT id, name, type, location as purpose, enabled, status FROM vision_cameras ORDER BY created_at DESC'
      );
      setCameras(result);
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  const addCamera = async () => {
    if (!newCamera.name.trim()) return;

    try {
      const db = await Database.load('sqlite:handsfree.db');
      const id = `cam_${Date.now()}`;

      let connectionConfig = '{}';
      let status = 'offline';

      // For reCamera with IP address, test connection and configure
      if (newCamera.type === 'recamera' && newCamera.ipAddress.trim()) {
        try {
          // Strip protocol and trailing slashes from IP
          const cleanIp = newCamera.ipAddress.trim()
            .replace(/^https?:\/\//, '')  // Remove http:// or https://
            .replace(/\/$/, '');           // Remove trailing slash

          // Test connection
          const info = await testReCameraConnection(cleanIp);

          // Build connection config
          const config = buildConnectionConfig(
            {
              ip_address: cleanIp,
              model: info.model,
              firmware_version: info.firmware,
              mac_address: 'unknown',
              signal_strength: null,
              port: 80,
            },
            info
          );

          connectionConfig = JSON.stringify(config);
          status = info.status;

          alert(`Connection test passed! Features: ${info.features.join(', ')}`);
        } catch (error) {
          console.error('Connection test failed:', error);
          alert(`Connection test failed: ${error}\n\nCamera will be added but may not be accessible.`);
        }
      }

      await db.execute(
        `INSERT INTO vision_cameras (id, tenant_id, name, type, location, enabled, connection_config, status, created_at, updated_at)
         VALUES (?, 'default', ?, ?, ?, 1, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))`,
        [id, newCamera.name, newCamera.type, newCamera.purpose, connectionConfig, status]
      );

      setShowAddModal(false);
      setNewCamera({ name: '', purpose: 'dining', type: 'webcam', ipAddress: '' });
      loadCameras();
    } catch (error) {
      console.error('Failed to add camera:', error);
      alert(`Failed to add camera: ${error}`);
    }
  };

  const deleteCamera = async (id: string) => {
    if (!confirm('Are you sure you want to delete this camera?')) return;

    try {
      const db = await Database.load('sqlite:handsfree.db');
      await db.execute('DELETE FROM vision_cameras WHERE id = ?', [id]);
      loadCameras();
    } catch (error) {
      console.error('Failed to delete camera:', error);
    }
  };

  const toggleCamera = async (id: string, enabled: boolean) => {
    try {
      const db = await Database.load('sqlite:handsfree.db');
      await db.execute(
        'UPDATE vision_cameras SET enabled = ?, updated_at = strftime("%s", "now") WHERE id = ?',
        [enabled ? 1 : 0, id]
      );
      loadCameras();
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  };

  const scanForCameras = async () => {
    setScanning(true);
    setShowDiscoveryResults(true);
    try {
      const discovered = await scanReCameras();
      setDiscoveredCameras(discovered);
    } catch (error) {
      console.error('Failed to scan for cameras:', error);
      alert(`Failed to scan for cameras: ${error}`);
    } finally {
      setScanning(false);
    }
  };

  const addDiscoveredCamera = async (discovered: DiscoveredReCamera) => {
    setTestingCamera(discovered.ip_address);
    try {
      // Test connection first
      const info = await testReCameraConnection(discovered.ip_address);

      // Build connection config
      const connectionConfig = buildConnectionConfig(discovered, info);

      // Add to database
      const db = await Database.load('sqlite:handsfree.db');
      const id = `cam_${Date.now()}`;
      const name = `${discovered.model} (${discovered.ip_address})`;

      await db.execute(
        `INSERT INTO vision_cameras (id, tenant_id, name, type, location, enabled, connection_config, status, created_at, updated_at)
         VALUES (?, 'default', ?, 'recamera', 'dining', 1, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))`,
        [id, name, JSON.stringify(connectionConfig), info.status]
      );

      // Reload cameras and close discovery
      loadCameras();
      setShowDiscoveryResults(false);
      setDiscoveredCameras([]);
      alert(`Camera "${name}" added successfully!`);
    } catch (error) {
      console.error('Failed to add camera:', error);
      alert(`Failed to add camera: ${error}`);
    } finally {
      setTestingCamera(null);
    }
  };

  // Show loading state
  if (pluginInstalled === null) {
    return (
      <div className="p-8 max-w-6xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Vision AI settings...</p>
        </div>
      </div>
    );
  }

  // Show plugin not installed message
  if (!pluginInstalled) {
    return (
      <div className="p-8 max-w-6xl">
        <h2 className="text-2xl font-bold text-white mb-2">Vision AI Settings</h2>
        <p className="text-gray-400 mb-6">Manage camera devices and their purposes</p>

        <div className="bg-yellow-600/10 border-2 border-yellow-600/30 rounded-xl p-8 text-center">
          <Camera className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Vision AI Plugin Not Installed</h3>
          <p className="text-gray-300 mb-6">
            To use Vision AI features, you need to install the Vision AI plugin first.
          </p>
          <button
            onClick={() => window.location.href = '/settings?category=plugins'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Download size={20} />
            Go to Plugin Store
          </button>
        </div>

        <div className="mt-8 bg-blue-600/10 border-2 border-blue-600/30 rounded-xl p-6">
          <div className="flex gap-3">
            <Eye className="text-blue-400 flex-shrink-0" size={24} />
            <div>
              <h3 className="text-white font-bold mb-2">What is Vision AI?</h3>
              <p className="text-sm text-gray-300 mb-3">
                Vision AI enables your restaurant to use camera-based intelligence for:
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                {DEVICE_PURPOSES.map(purpose => (
                  <li key={purpose.value}>
                    <span className="font-semibold">{purpose.label}:</span> {purpose.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Vision AI Settings</h2>
          <p className="text-gray-400">Manage camera devices and their purposes</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={scanForCameras}
            disabled={scanning}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            {scanning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Scanning...
              </>
            ) : (
              <>
                <Search size={20} />
                Scan for Cameras
              </>
            )}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={20} />
            Add Manually
          </button>
        </div>
      </div>

      {/* Discovery Results */}
      {showDiscoveryResults && (
        <div className="mb-6 bg-gray-800/50 border-2 border-green-600/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wifi className="text-green-400" size={20} />
              Discovered Cameras
            </h3>
            <button
              onClick={() => {
                setShowDiscoveryResults(false);
                setDiscoveredCameras([]);
              }}
              className="text-gray-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>

          {discoveredCameras.length === 0 ? (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {scanning ? 'Scanning network...' : 'No reCamera devices found on the network'}
              </p>
              {!scanning && (
                <p className="text-sm text-gray-500 mt-2">
                  Make sure your reCamera is powered on and connected to the same WiFi network.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {discoveredCameras.map((camera) => (
                <div
                  key={camera.ip_address}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-white mb-1">{camera.model}</h4>
                    <p className="text-sm text-gray-400">IP: {camera.ip_address}</p>
                    <p className="text-xs text-gray-500">
                      Firmware: {camera.firmware_version} • MAC: {camera.mac_address}
                    </p>
                  </div>
                  <button
                    onClick={() => addDiscoveredCamera(camera)}
                    disabled={testingCamera === camera.ip_address}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {testingCamera === camera.ip_address ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        Add Camera
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Camera List */}
      <div className="space-y-4">
        {cameras.length === 0 ? (
          <div className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-8 text-center">
            <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No cameras configured yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Add Your First Camera
            </button>
          </div>
        ) : (
          cameras.map((camera) => {
            const purpose = DEVICE_PURPOSES.find(p => p.value === camera.purpose);
            const type = CAMERA_TYPES.find(t => t.value === camera.type);

            return (
              <div
                key={camera.id}
                className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${camera.enabled ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                      <Camera size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white">{camera.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          camera.status === 'online' ? 'bg-green-600/20 text-green-400' :
                          camera.status === 'error' ? 'bg-red-600/20 text-red-400' :
                          'bg-gray-600/20 text-gray-400'
                        }`}>
                          {camera.status}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-2">{purpose?.label || camera.purpose}</p>
                      <p className="text-sm text-gray-500">{type?.label || camera.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={camera.enabled}
                        onChange={(e) => toggleCamera(camera.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <button
                      onClick={() => deleteCamera(camera.id)}
                      className="p-2 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Settings Info */}
      <div className="mt-8 bg-blue-600/10 border-2 border-blue-600/30 rounded-xl p-6">
        <div className="flex gap-3">
          <Eye className="text-blue-400 flex-shrink-0" size={24} />
          <div>
            <h3 className="text-white font-bold mb-2">Device Purpose Guide</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              {DEVICE_PURPOSES.map(purpose => (
                <li key={purpose.value}>
                  <span className="font-semibold">{purpose.label}:</span> {purpose.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Add Camera Device</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Camera Name
                </label>
                <input
                  type="text"
                  value={newCamera.name}
                  onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                  placeholder="e.g., Main Dining Area"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Device Purpose
                </label>
                <select
                  value={newCamera.purpose}
                  onChange={(e) => setNewCamera({ ...newCamera, purpose: e.target.value as any })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {DEVICE_PURPOSES.map(purpose => (
                    <option key={purpose.value} value={purpose.value}>
                      {purpose.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {DEVICE_PURPOSES.find(p => p.value === newCamera.purpose)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Camera Type
                </label>
                <select
                  value={newCamera.type}
                  onChange={(e) => setNewCamera({ ...newCamera, type: e.target.value as any })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {CAMERA_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* IP Address field for reCamera */}
              {newCamera.type === 'recamera' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    IP Address
                  </label>
                  <input
                    type="text"
                    value={newCamera.ipAddress}
                    onChange={(e) => setNewCamera({ ...newCamera, ipAddress: e.target.value })}
                    placeholder="e.g., 192.168.68.100"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter the IP address of your reCamera device. Connection will be tested automatically.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCamera}
                disabled={!newCamera.name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

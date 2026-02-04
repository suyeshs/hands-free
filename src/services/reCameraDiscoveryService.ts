/**
 * reCamera Discovery Service
 *
 * Frontend service for discovering and configuring reCamera devices on the local network.
 * Wraps Tauri commands with TypeScript types and error handling.
 */

import { invoke } from '@tauri-apps/api/core';

export interface DiscoveredReCamera {
  ip_address: string;
  model: string;
  firmware_version: string;
  mac_address: string;
  signal_strength: number | null;
  port: number;
}

export interface ReCameraInfo {
  model: string;
  firmware: string;
  features: string[]; // ["rtsp", "websocket", "edge_ai"]
  status: string; // "online", "offline", "configuring"
}

export interface WiFiConfig {
  ssid: string;
  password: string;
  security: string; // "open", "wpa", "wpa2", "wpa3"
}

export interface NetworkStatus {
  connected: boolean;
  ssid: string;
  signal_strength: number;
  ip_address: string;
  mac_address: string;
}

/**
 * Scan local network for reCamera devices
 *
 * @param subnet - Optional subnet to scan (e.g., "192.168.1"). If not provided, uses local network.
 * @returns Promise resolving to array of discovered reCamera devices
 */
export async function scanReCameras(subnet?: string): Promise<DiscoveredReCamera[]> {
  try {
    console.log('[reCameraDiscovery] Scanning for reCamera devices...');
    const cameras = await invoke<DiscoveredReCamera[]>('scan_recameras', { subnet });
    console.log('[reCameraDiscovery] Found', cameras.length, 'reCamera devices');
    return cameras;
  } catch (error) {
    console.error('[reCameraDiscovery] Failed to scan for reCameras:', error);
    throw error;
  }
}

/**
 * Test connection to a specific reCamera device
 *
 * Tests HTTP, RTSP, and WebSocket connectivity.
 *
 * @param ipAddress - IP address of the reCamera device
 * @returns Promise resolving to connection info and available features
 */
export async function testReCameraConnection(ipAddress: string): Promise<ReCameraInfo> {
  try {
    console.log('[reCameraDiscovery] Testing connection to:', ipAddress);
    const info = await invoke<ReCameraInfo>('test_recamera_connection', { ipAddress });
    console.log('[reCameraDiscovery] Connection test passed:', info);
    return info;
  } catch (error) {
    console.error('[reCameraDiscovery] Connection test failed:', error);
    throw error;
  }
}

/**
 * Configure reCamera WiFi settings
 *
 * Sends WiFi configuration to reCamera. The camera will reboot and join the network.
 *
 * @param gatewayIp - IP address of the reCamera (typically 192.168.4.1 when in AP mode)
 * @param wifiConfig - WiFi credentials and security settings
 * @returns Promise resolving when configuration is sent
 */
export async function configureReCameraWiFi(
  gatewayIp: string,
  wifiConfig: WiFiConfig
): Promise<void> {
  try {
    console.log('[reCameraDiscovery] Configuring WiFi for:', gatewayIp);
    await invoke('configure_recamera_wifi', { gatewayIp, wifiConfig });
    console.log('[reCameraDiscovery] WiFi configuration sent successfully');
  } catch (error) {
    console.error('[reCameraDiscovery] WiFi configuration failed:', error);
    throw error;
  }
}

/**
 * Get network status from reCamera
 *
 * @param ipAddress - IP address of the reCamera device
 * @returns Promise resolving to current network status
 */
export async function getReCameraNetworkStatus(ipAddress: string): Promise<NetworkStatus> {
  try {
    console.log('[reCameraDiscovery] Getting network status for:', ipAddress);
    const status = await invoke<NetworkStatus>('get_recamera_network_status', { ipAddress });
    console.log('[reCameraDiscovery] Network status:', status);
    return status;
  } catch (error) {
    console.error('[reCameraDiscovery] Failed to get network status:', error);
    throw error;
  }
}

/**
 * Build connection configuration for reCamera
 *
 * Generates the connection_config JSON for storing in the database.
 *
 * @param camera - Discovered reCamera device
 * @param info - Connection test results
 * @returns Connection configuration object
 */
export function buildConnectionConfig(camera: DiscoveredReCamera, info: ReCameraInfo): object {
  return {
    ipAddress: camera.ip_address,
    rtspUrl: `rtsp://admin:admin@${camera.ip_address}:554/live`,
    httpUrl: `http://${camera.ip_address}:${camera.port}`,
    reCameraEdgeAI: info.features.includes('edge_ai'),
    reCameraWsPort: camera.port,
    features: info.features,
    model: camera.model,
    firmware: camera.firmware_version,
  };
}

/**
 * mDNS Print Service
 * Allows connected devices on the LAN to send print requests via mDNS discovery
 *
 * Features:
 * - Start/stop the local print service (advertises via mDNS)
 * - Discover print services on the network
 * - Send print requests to remote devices
 */

import { invoke } from '@tauri-apps/api/core';

// Types

export interface PrintServiceStatus {
  running: boolean;
  port: number;
  service_name: string;
  local_ip: string;
  connected_devices: string[];
}

export interface DiscoveredPrintService {
  name: string;
  host: string;
  port: number;
  ip_addresses: string[];
}

export interface PrintRequest {
  /** Type of print: "bill", "kot" */
  print_type: string;
  /** Order ID to print (POS will look up the order and format it) */
  order_id: string;
  /** Request ID for tracking */
  request_id?: string;
  /** Requesting device name */
  device_name?: string;
}

export interface PrintResponse {
  success: boolean;
  message: string;
  request_id?: string;
}

// Service class

class MDNSPrintService {
  private isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * Start the mDNS print service on this device
   * This will advertise the service on the local network
   */
  async startService(deviceName?: string): Promise<PrintServiceStatus> {
    if (!this.isTauri()) {
      console.warn('[MDNSPrintService] Not running in Tauri environment');
      throw new Error('mDNS print service only available in Tauri');
    }

    try {
      const status = await invoke<PrintServiceStatus>('start_mdns_print_service', {
        deviceName,
      });
      console.log('[MDNSPrintService] Service started:', status);
      return status;
    } catch (error) {
      console.error('[MDNSPrintService] Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Stop the mDNS print service
   */
  async stopService(): Promise<void> {
    if (!this.isTauri()) {
      return;
    }

    try {
      await invoke('stop_mdns_print_service');
      console.log('[MDNSPrintService] Service stopped');
    } catch (error) {
      console.error('[MDNSPrintService] Failed to stop service:', error);
      throw error;
    }
  }

  /**
   * Get the current status of the print service
   */
  async getStatus(): Promise<PrintServiceStatus> {
    if (!this.isTauri()) {
      return {
        running: false,
        port: 0,
        service_name: '',
        local_ip: '',
        connected_devices: [],
      };
    }

    try {
      return await invoke<PrintServiceStatus>('get_mdns_print_service_status');
    } catch (error) {
      console.error('[MDNSPrintService] Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Discover print services on the local network
   * @param timeoutSecs How long to scan (default: 5 seconds)
   */
  async discoverServices(timeoutSecs: number = 5): Promise<DiscoveredPrintService[]> {
    if (!this.isTauri()) {
      console.warn('[MDNSPrintService] Not running in Tauri environment');
      return [];
    }

    try {
      const services = await invoke<DiscoveredPrintService[]>('discover_mdns_print_services', {
        timeoutSecs,
      });
      console.log('[MDNSPrintService] Discovered services:', services);
      return services;
    } catch (error) {
      console.error('[MDNSPrintService] Failed to discover services:', error);
      throw error;
    }
  }

  /**
   * Send a print request to a remote print service
   */
  async sendPrintRequest(
    host: string,
    port: number,
    request: PrintRequest
  ): Promise<PrintResponse> {
    if (!this.isTauri()) {
      throw new Error('mDNS print service only available in Tauri');
    }

    try {
      const response = await invoke<PrintResponse>('send_remote_print_request', {
        host,
        port,
        request,
      });
      console.log('[MDNSPrintService] Print response:', response);
      return response;
    } catch (error) {
      console.error('[MDNSPrintService] Failed to send print request:', error);
      throw error;
    }
  }

  /**
   * Send a print request for an order
   * The POS device will look up the order and print using its configured printer
   */
  async sendPrintOrder(
    host: string,
    port: number,
    orderId: string,
    printType: 'bill' | 'kot',
    deviceName?: string
  ): Promise<PrintResponse> {
    const request: PrintRequest = {
      print_type: printType,
      order_id: orderId,
      request_id: `${printType}-${Date.now()}`,
      device_name: deviceName,
    };

    return this.sendPrintRequest(host, port, request);
  }

  /**
   * Send a bill print request to a remote POS
   */
  async sendBillPrint(
    host: string,
    port: number,
    orderId: string,
    deviceName?: string
  ): Promise<PrintResponse> {
    return this.sendPrintOrder(host, port, orderId, 'bill', deviceName);
  }

  /**
   * Send a KOT print request to a remote POS
   */
  async sendKOTPrint(
    host: string,
    port: number,
    orderId: string,
    deviceName?: string
  ): Promise<PrintResponse> {
    return this.sendPrintOrder(host, port, orderId, 'kot', deviceName);
  }

  /**
   * Send print via HTTP directly (fallback for non-Tauri or web clients)
   */
  async sendPrintViaHTTP(
    serviceUrl: string,
    request: PrintRequest
  ): Promise<PrintResponse> {
    try {
      const response = await fetch(`${serviceUrl}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[MDNSPrintService] HTTP request failed:', error);
      throw error;
    }
  }

  /**
   * Check if a print service is reachable via HTTP
   */
  async checkServiceHealth(serviceUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const mdnsPrintService = new MDNSPrintService();

// Export class for testing
export { MDNSPrintService };

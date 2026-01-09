/**
 * Printer Discovery Service
 * Cross-platform printer detection for USB and Network printers
 * Uses Tauri commands for native printer access
 */

import { invoke } from '@tauri-apps/api/core';

export interface DiscoveredPrinter {
  id: string;
  name: string;
  connection_type: 'usb' | 'network' | 'wifi' | 'system';
  address?: string;
  port?: number;
  model?: string;
  status: 'online' | 'offline' | 'unknown';
  is_default: boolean;
}

export interface PrinterScanProgress {
  phase: 'system' | 'network' | 'done';
  progress: number; // 0-100
  foundCount: number;
}

class PrinterDiscoveryService {
  private isScanning = false;
  private onProgressCallback?: (progress: PrinterScanProgress) => void;

  /**
   * Check if we're running in Tauri environment
   */
  private isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * Get system printers (USB and installed network printers)
   */
  async getSystemPrinters(): Promise<DiscoveredPrinter[]> {
    if (!this.isTauri()) {
      console.warn('[PrinterDiscovery] Not running in Tauri, returning empty list');
      return [];
    }

    try {
      const printers = await invoke<DiscoveredPrinter[]>('get_system_printers');
      return printers;
    } catch (error) {
      console.error('[PrinterDiscovery] Failed to get system printers:', error);
      return [];
    }
  }

  /**
   * Scan network for thermal printers
   */
  async scanNetworkPrinters(subnet?: string): Promise<DiscoveredPrinter[]> {
    if (!this.isTauri()) {
      console.warn('[PrinterDiscovery] Not running in Tauri, returning empty list');
      return [];
    }

    try {
      const printers = await invoke<DiscoveredPrinter[]>('scan_network_printers', { subnet });
      return printers;
    } catch (error) {
      console.error('[PrinterDiscovery] Failed to scan network printers:', error);
      return [];
    }
  }

  /**
   * Get local network subnet
   */
  async getLocalSubnet(): Promise<string> {
    if (!this.isTauri()) {
      return '192.168.1';
    }

    try {
      return await invoke<string>('get_local_subnet');
    } catch (error) {
      console.error('[PrinterDiscovery] Failed to get local subnet:', error);
      return '192.168.1';
    }
  }

  /**
   * Test connection to a specific printer
   */
  async testConnection(address: string, port: number): Promise<boolean> {
    if (!this.isTauri()) {
      return false;
    }

    try {
      return await invoke<boolean>('test_printer_connection', { address, port });
    } catch (error) {
      console.error('[PrinterDiscovery] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Send raw data to network printer
   */
  async sendToNetworkPrinter(address: string, port: number, data: string): Promise<boolean> {
    if (!this.isTauri()) {
      return false;
    }

    try {
      return await invoke<boolean>('send_to_network_printer', { address, port, data });
    } catch (error) {
      console.error('[PrinterDiscovery] Send to printer failed:', error);
      return false;
    }
  }

  /**
   * Print using system printer
   */
  async printToSystemPrinter(printerName: string, content: string, contentType: string = 'text'): Promise<boolean> {
    if (!this.isTauri()) {
      return false;
    }

    try {
      return await invoke<boolean>('print_to_system_printer', {
        printerName,
        content,
        contentType
      });
    } catch (error) {
      console.error('[PrinterDiscovery] Print to system printer failed:', error);
      return false;
    }
  }

  /**
   * Discover all printers (system + network)
   */
  async discoverAll(onProgress?: (progress: PrinterScanProgress) => void): Promise<DiscoveredPrinter[]> {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    this.onProgressCallback = onProgress;
    const allPrinters: DiscoveredPrinter[] = [];

    try {
      // Phase 1: Get system printers
      this.reportProgress({ phase: 'system', progress: 0, foundCount: 0 });
      const systemPrinters = await this.getSystemPrinters();
      allPrinters.push(...systemPrinters);
      this.reportProgress({ phase: 'system', progress: 50, foundCount: allPrinters.length });

      // Phase 2: Scan network printers
      this.reportProgress({ phase: 'network', progress: 50, foundCount: allPrinters.length });
      const subnet = await this.getLocalSubnet();
      const networkPrinters = await this.scanNetworkPrinters(subnet);
      allPrinters.push(...networkPrinters);
      this.reportProgress({ phase: 'network', progress: 90, foundCount: allPrinters.length });

      // Done
      this.reportProgress({ phase: 'done', progress: 100, foundCount: allPrinters.length });

      return allPrinters;
    } finally {
      this.isScanning = false;
      this.onProgressCallback = undefined;
    }
  }

  /**
   * Quick scan - only system printers (faster)
   */
  async quickScan(): Promise<DiscoveredPrinter[]> {
    return this.getSystemPrinters();
  }

  private reportProgress(progress: PrinterScanProgress): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  /**
   * Print test page to verify printer connection
   */
  async printTestPage(printer: DiscoveredPrinter): Promise<boolean> {
    const testContent = `
================================
     PRINTER TEST PAGE
================================

Printer: ${printer.name}
Type: ${printer.connection_type}
${printer.address ? `Address: ${printer.address}` : ''}
${printer.port ? `Port: ${printer.port}` : ''}

Date: ${new Date().toLocaleString()}

================================
  If you can read this,
  the printer is working!
================================




`;

    if (printer.connection_type === 'network' && printer.address && printer.port) {
      // ESC/POS commands for thermal printer
      const escPosContent = this.textToEscPos(testContent);
      return this.sendToNetworkPrinter(printer.address, printer.port, escPosContent);
    } else if (printer.connection_type === 'system') {
      return this.printToSystemPrinter(printer.name, testContent, 'text');
    }

    return false;
  }

  /**
   * Convert plain text to ESC/POS format for thermal printers
   * Optimized for dark, bold printing
   */
  private textToEscPos(text: string): string {
    const ESC = '\x1B';
    const GS = '\x1D';

    let escPos = '';

    // Initialize printer - ESC @
    escPos += ESC + '@';

    // Set maximum print density for darker output - GS | n
    escPos += GS + '|' + '\x08'; // Set print density to maximum (8)

    // Enable emphasized/bold mode for bolder text - ESC E 1
    escPos += ESC + 'E' + '\x01';

    // Set line spacing - ESC 3 n (24 dots)
    escPos += ESC + '3' + '\x18';

    // Set text alignment to center for header
    escPos += ESC + 'a' + '\x01';

    // Print content
    escPos += text;

    // Disable emphasized mode before cut
    escPos += ESC + 'E' + '\x00';

    // Feed and cut
    escPos += '\n\n\n';
    escPos += GS + 'V' + '\x00'; // Full cut

    return escPos;
  }

  /**
   * Print HTML content using native Tauri print dialog
   * Works on Windows, macOS, and Linux
   */
  async printHtmlContent(html: string): Promise<boolean> {
    if (!this.isTauri()) {
      // Fallback to iframe method for browser
      return this.printHtmlViaIframe(html);
    }

    try {
      return await invoke<boolean>('print_html_content', { html });
    } catch (error) {
      console.error('[PrinterDiscovery] Native print failed, falling back to iframe:', error);
      return this.printHtmlViaIframe(html);
    }
  }

  /**
   * Print HTML via hidden iframe (fallback method)
   */
  private printHtmlViaIframe(html: string): Promise<boolean> {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.left = '-9999px';

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        // Use setTimeout instead of onload because document.write() loads synchronously
        // and onload may not fire reliably after write/close
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            console.log('[PrinterDiscovery] Print dialog triggered via iframe');

            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
              } catch (e) {
                // Ignore cleanup errors
              }
            }, 2000);

            resolve(true);
          } catch (e) {
            console.error('[PrinterDiscovery] Iframe print failed:', e);
            document.body.removeChild(iframe);
            resolve(false);
          }
        }, 100); // Small delay to ensure content is rendered
      } else {
        console.error('[PrinterDiscovery] Could not get iframe document');
        document.body.removeChild(iframe);
        resolve(false);
      }
    });
  }

  /**
   * Get ESC/POS commands for printing bill content
   * Optimized for dark, bold printing on thermal printers (Epson TM-T82, TM-T88, etc.)
   */
  getBillEscPosCommands(htmlContent: string): string {
    const ESC = '\x1B';
    const GS = '\x1D';

    // Strip HTML tags and convert to plain text
    const plainText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    let escPos = '';

    // Initialize printer - ESC @
    escPos += ESC + '@';

    // Set maximum print density for darker output - GS ( K
    // Command: GS ( K pL pH cn m (1D 28 4B 02 00 31 n)
    // n = 0-8, where 8 is maximum density (darkest)
    escPos += GS + '|' + '\x08'; // Set print density to maximum (8)

    // Enable emphasized/bold mode for bolder text - ESC E 1
    escPos += ESC + 'E' + '\x01';

    // Set character spacing to 0 for tighter text - ESC SP n
    escPos += ESC + ' ' + '\x00';

    // Set line spacing for better readability - ESC 3 n (24 dots = tighter spacing)
    escPos += ESC + '3' + '\x18';

    // Print content
    escPos += plainText;

    // Disable emphasized mode before cut
    escPos += ESC + 'E' + '\x00';

    // Feed and cut
    escPos += '\n\n\n\n';
    escPos += GS + 'V' + '\x00'; // Full cut

    return escPos;
  }
}

export const printerDiscoveryService = new PrinterDiscoveryService();

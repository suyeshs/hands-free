/**
 * Printer Service
 * Handles KOT printing to thermal printers and standard printers
 */

import { KitchenOrder } from '../types/kds';
import { generateKOTHTML } from '../components/print/KOTPrint';
import { printerDiscoveryService } from './printerDiscoveryService';
import { invoke } from '@tauri-apps/api/core';

export interface PrinterConfig {
  restaurantName: string;
  autoPrintOnAccept: boolean;
  printByStation: boolean; // Print separate KOTs for each station

  // Bill Printer Settings
  printerType: 'browser' | 'thermal' | 'network' | 'system';
  networkPrinterUrl?: string; // For network thermal printers (IP:port)
  systemPrinterName?: string; // For system printers (CUPS/Windows)

  // KOT Printer Settings (if different from bill printer)
  kotPrinterEnabled: boolean; // Use separate KOT printer
  kotPrinterType?: 'browser' | 'thermal' | 'network' | 'system';
  kotNetworkPrinterUrl?: string;
  kotSystemPrinterName?: string;
}

class PrinterService {
  private config: PrinterConfig = {
    restaurantName: 'Restaurant',
    autoPrintOnAccept: true,
    printByStation: false,
    printerType: 'browser',
    kotPrinterEnabled: false, // By default, use same printer for KOT and bill
  };

  /**
   * Update printer configuration
   */
  setConfig(config: Partial<PrinterConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PrinterConfig {
    return { ...this.config };
  }

  /**
   * Check if running in Tauri environment
   */
  private isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * Print KOT using browser's print dialog
   * Uses native Tauri print in desktop apps, falls back to iframe for web
   */
  private async printBrowser(html: string): Promise<void> {
    // Try native Tauri print first (works better on Windows)
    if (this.isTauri()) {
      try {
        await invoke<boolean>('print_html_content', { html });
        return;
      } catch (error) {
        console.warn('[PrinterService] Native print failed, falling back to iframe:', error);
      }
    }

    // Fallback to iframe method
    return new Promise((resolve, reject) => {
      try {
        // Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.left = '-9999px';

        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          reject(new Error('Failed to access iframe document'));
          return;
        }

        // Write HTML to iframe
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        // Wait for content to load, then print
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            // Resolve immediately - don't wait for print dialog
            // Clean up happens in background to avoid blocking
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
              } catch (e) {
                // Ignore cleanup errors
              }
            }, 2000);

            // Resolve immediately so the UI doesn't get stuck
            resolve();
          } catch (error) {
            document.body.removeChild(iframe);
            reject(error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Print KOT to network thermal printer
   */
  private async printNetwork(html: string, printerUrl: string): Promise<void> {
    try {
      // Convert HTML to ESC/POS commands or send to print server
      // This is a placeholder - actual implementation depends on your thermal printer setup
      const response = await fetch(printerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/html',
        },
        body: html,
      });

      if (!response.ok) {
        throw new Error(`Network printer error: ${response.statusText}`);
      }

      console.log('[PrinterService] Network print successful');
    } catch (error) {
      console.error('[PrinterService] Network print failed:', error);
      throw error;
    }
  }

  /**
   * Print to system printer using native Tauri command
   */
  private async printSystem(html: string, printerName: string): Promise<void> {
    try {
      // Convert HTML to plain text for system printer
      const plainText = this.htmlToPlainText(html);
      const success = await printerDiscoveryService.printToSystemPrinter(printerName, plainText, 'text');

      if (!success) {
        throw new Error('System printer failed');
      }
      console.log('[PrinterService] System print successful');
    } catch (error) {
      console.error('[PrinterService] System print failed:', error);
      throw error;
    }
  }

  /**
   * Print directly to network thermal printer (ESC/POS)
   */
  private async printDirectNetwork(html: string, address: string, port: number): Promise<void> {
    try {
      const escPosContent = printerDiscoveryService.getBillEscPosCommands(html);
      const success = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);

      if (!success) {
        throw new Error('Network printer failed');
      }
      console.log('[PrinterService] Direct network print successful');
    } catch (error) {
      console.error('[PrinterService] Direct network print failed:', error);
      throw error;
    }
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Get the printer settings to use for KOT printing
   * Uses dedicated KOT printer if enabled, otherwise falls back to bill printer
   */
  private getKotPrinterSettings(): {
    printerType: 'browser' | 'thermal' | 'network' | 'system';
    networkUrl?: string;
    systemName?: string;
  } {
    if (this.config.kotPrinterEnabled && this.config.kotPrinterType) {
      return {
        printerType: this.config.kotPrinterType,
        networkUrl: this.config.kotNetworkPrinterUrl,
        systemName: this.config.kotSystemPrinterName,
      };
    }
    // Fall back to bill printer settings
    return {
      printerType: this.config.printerType,
      networkUrl: this.config.networkPrinterUrl,
      systemName: this.config.systemPrinterName,
    };
  }

  /**
   * Print a single KOT
   */
  async printKOT(order: KitchenOrder, stationFilter?: string): Promise<void> {
    try {
      console.log('[PrinterService] Printing KOT for order:', order.orderNumber);

      const html = generateKOTHTML(order, this.config.restaurantName, stationFilter);
      const kotPrinter = this.getKotPrinterSettings();

      console.log('[PrinterService] Using KOT printer:', kotPrinter.printerType);

      switch (kotPrinter.printerType) {
        case 'browser':
          await this.printBrowser(html);
          break;

        case 'system':
          if (!kotPrinter.systemName) {
            throw new Error('KOT system printer not configured');
          }
          await this.printSystem(html, kotPrinter.systemName);
          break;

        case 'network':
        case 'thermal':
          if (!kotPrinter.networkUrl) {
            throw new Error('KOT network printer URL not configured');
          }
          // Parse IP:port format
          const [address, portStr] = kotPrinter.networkUrl.replace(/^https?:\/\//, '').split(':');
          const port = parseInt(portStr) || 9100;

          // Try direct connection first, fallback to HTTP
          try {
            await this.printDirectNetwork(html, address, port);
          } catch {
            // Fallback to HTTP print server
            await this.printNetwork(html, kotPrinter.networkUrl);
          }
          break;

        default:
          throw new Error(`Unsupported printer type: ${kotPrinter.printerType}`);
      }

      console.log('[PrinterService] KOT printed successfully');
    } catch (error) {
      console.error('[PrinterService] Failed to print KOT:', error);
      throw error;
    }
  }

  /**
   * Print KOTs by station (separate ticket for each station)
   */
  async printKOTByStation(order: KitchenOrder): Promise<void> {
    try {
      // Get unique stations from order items
      const stations = new Set(
        order.items
          .map((item) => item.station)
          .filter((station): station is string => Boolean(station))
      );

      if (stations.size === 0) {
        // No stations specified, print single KOT
        await this.printKOT(order);
        return;
      }

      // Print separate KOT for each station
      const printPromises = Array.from(stations).map((station) =>
        this.printKOT(order, station)
      );

      await Promise.all(printPromises);

      console.log('[PrinterService] All station KOTs printed successfully');
    } catch (error) {
      console.error('[PrinterService] Failed to print station KOTs:', error);
      throw error;
    }
  }

  /**
   * Print order (handles auto-split by station if configured)
   */
  async print(order: KitchenOrder): Promise<void> {
    if (this.config.printByStation) {
      await this.printKOTByStation(order);
    } else {
      await this.printKOT(order);
    }
  }

  /**
   * Check if auto-print is enabled
   */
  shouldAutoPrint(): boolean {
    return this.config.autoPrintOnAccept;
  }

  /**
   * Print preview (opens in new window)
   */
  printPreview(order: KitchenOrder, stationFilter?: string): void {
    const html = generateKOTHTML(order, this.config.restaurantName, stationFilter);

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(html);
      previewWindow.document.close();
    } else {
      console.error('[PrinterService] Failed to open preview window');
    }
  }
}

// Export singleton instance
export const printerService = new PrinterService();

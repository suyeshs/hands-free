/**
 * Printer Service
 * Handles KOT printing to thermal printers and standard printers
 *
 * Print Modes:
 * - 'silent': Print directly without dialog (for network/system printers)
 * - 'modal': Show in-app print preview modal (user clicks Print)
 * - 'browser': Fall back to browser print dialog (legacy)
 */

import { KitchenOrder } from '../types/kds';
import { generateKOTHTML, generateKOTEscPos } from '../components/print/KOTPrint';
import { printerDiscoveryService } from './printerDiscoveryService';
import { invoke } from '@tauri-apps/api/core';

export type PrintMode = 'silent' | 'modal' | 'browser';

export interface PrinterConfig {
  restaurantName: string;
  autoPrintOnAccept: boolean;
  printByStation: boolean; // Print separate KOTs for each station
  printMode: PrintMode; // How to handle printing

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
    printMode: 'modal', // Default to modal for better UX
    printerType: 'browser',
    kotPrinterEnabled: false, // By default, use same printer for KOT and bill
  };

  // Callback for opening print modal (set by React component)
  private openKotModalCallback?: (
    order: KitchenOrder,
    restaurantName: string,
    stationFilter?: string
  ) => Promise<boolean>;

  /**
   * Register the modal callback (called by App component)
   */
  setKotModalCallback(callback: typeof this.openKotModalCallback) {
    this.openKotModalCallback = callback;
  }

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
   * Check if a direct printer (network or system) is configured
   */
  hasDirectPrinter(): boolean {
    const kotPrinter = this.getKotPrinterSettings();
    return (
      (kotPrinter.printerType === 'network' && !!kotPrinter.networkUrl) ||
      (kotPrinter.printerType === 'thermal' && !!kotPrinter.networkUrl) ||
      (kotPrinter.printerType === 'system' && !!kotPrinter.systemName)
    );
  }

  /**
   * Print a single KOT - handles different print modes
   */
  async printKOT(order: KitchenOrder, stationFilter?: string): Promise<void> {
    try {
      console.log('[PrinterService] Printing KOT for order:', order.orderNumber, 'mode:', this.config.printMode);

      // Determine effective print mode
      let effectiveMode = this.config.printMode;

      // If modal mode but no callback registered, fall back to silent or browser
      if (effectiveMode === 'modal' && !this.openKotModalCallback) {
        effectiveMode = this.hasDirectPrinter() ? 'silent' : 'browser';
        console.log('[PrinterService] Modal callback not registered, using:', effectiveMode);
      }

      // If silent mode but no direct printer, show modal or fall back to browser
      if (effectiveMode === 'silent' && !this.hasDirectPrinter()) {
        effectiveMode = this.openKotModalCallback ? 'modal' : 'browser';
        console.log('[PrinterService] No direct printer for silent mode, using:', effectiveMode);
      }

      switch (effectiveMode) {
        case 'modal':
          // Show in-app print modal
          if (this.openKotModalCallback) {
            const success = await this.openKotModalCallback(
              order,
              this.config.restaurantName,
              stationFilter
            );
            if (!success) {
              console.log('[PrinterService] Print cancelled from modal');
              return; // User cancelled, don't throw error
            }
          }
          break;

        case 'silent':
          // Print directly without any dialog
          await this.printKOTSilent(order, stationFilter);
          break;

        case 'browser':
        default:
          // Use browser print dialog (legacy)
          const html = generateKOTHTML(order, this.config.restaurantName, stationFilter);
          await this.printBrowser(html);
          break;
      }

      console.log('[PrinterService] KOT printed successfully');
    } catch (error) {
      console.error('[PrinterService] Failed to print KOT:', error);
      throw error;
    }
  }

  /**
   * Print KOT silently (no dialog) - for network/system printers
   */
  async printKOTSilent(order: KitchenOrder, stationFilter?: string): Promise<void> {
    const kotPrinter = this.getKotPrinterSettings();
    const escPosContent = generateKOTEscPos(order, this.config.restaurantName, stationFilter);

    console.log('[PrinterService] Silent print to:', kotPrinter.printerType);

    switch (kotPrinter.printerType) {
      case 'system':
        if (!kotPrinter.systemName) {
          throw new Error('KOT system printer not configured');
        }
        const systemSuccess = await printerDiscoveryService.printToSystemPrinter(
          kotPrinter.systemName,
          escPosContent,
          'text'
        );
        if (!systemSuccess) {
          throw new Error('Failed to print to system printer');
        }
        break;

      case 'network':
      case 'thermal':
        if (!kotPrinter.networkUrl) {
          throw new Error('KOT network printer URL not configured');
        }
        const [address, portStr] = kotPrinter.networkUrl.replace(/^https?:\/\//, '').split(':');
        const port = parseInt(portStr) || 9100;
        const networkSuccess = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
        if (!networkSuccess) {
          throw new Error('Failed to print to network printer');
        }
        break;

      default:
        throw new Error(`Unsupported printer type for silent print: ${kotPrinter.printerType}`);
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

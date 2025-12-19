/**
 * Printer Service
 * Handles KOT printing to thermal printers and standard printers
 */

import { KitchenOrder } from '../types/kds';
import { generateKOTHTML } from '../components/print/KOTPrint';

export interface PrinterConfig {
  restaurantName: string;
  autoPrintOnAccept: boolean;
  printByStation: boolean; // Print separate KOTs for each station
  printerType: 'browser' | 'thermal' | 'network';
  networkPrinterUrl?: string; // For network thermal printers
}

class PrinterService {
  private config: PrinterConfig = {
    restaurantName: 'Restaurant',
    autoPrintOnAccept: true,
    printByStation: false,
    printerType: 'browser',
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
   * Print KOT using browser's print dialog
   */
  private printBrowser(html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';

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
   * Print a single KOT
   */
  async printKOT(order: KitchenOrder, stationFilter?: string): Promise<void> {
    try {
      console.log('[PrinterService] Printing KOT for order:', order.orderNumber);

      const html = generateKOTHTML(order, this.config.restaurantName, stationFilter);

      switch (this.config.printerType) {
        case 'browser':
          await this.printBrowser(html);
          break;

        case 'network':
        case 'thermal':
          if (!this.config.networkPrinterUrl) {
            throw new Error('Network printer URL not configured');
          }
          await this.printNetwork(html, this.config.networkPrinterUrl);
          break;

        default:
          throw new Error(`Unsupported printer type: ${this.config.printerType}`);
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

/**
 * Bill Service
 * Handles bill generation, tax calculation, and printing for POS orders
 */

import { Order } from '../types/pos';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { generateBillHTML, printBill, previewBill, BillData, downloadBillPDF, openBillPDF } from '../components/print/BillPrint';
import { usePrinterStore } from '../stores/printerStore';

export interface GeneratedBill {
  invoiceNumber: string;
  order: Order;
  taxes: {
    subtotal: number;
    serviceCharge: number;
    cgst: number;
    sgst: number;
    discount: number;
    packingCharges: number;
    roundOff: number;
    grandTotal: number;
  };
  billData: BillData;
  generatedAt: Date;
}

class BillService {
  /**
   * Generate a complete bill with taxes calculated
   */
  generateBill(order: Order, cashierName?: string): GeneratedBill {
    const restaurantSettings = useRestaurantSettingsStore.getState();
    const settings = restaurantSettings.settings;

    // Get next invoice number
    const invoiceNumber = restaurantSettings.getNextInvoiceNumber();

    // Calculate taxes using the store's method
    const taxCalculation = restaurantSettings.calculateTaxes(order.subtotal);

    // Add packing charges if present (for takeout orders)
    const packingCharges = order.packingCharges || 0;

    // Apply discount if any
    let grandTotal = taxCalculation.grandTotal + packingCharges;
    if (order.discount > 0) {
      grandTotal -= order.discount;
      // Re-round if enabled
      if (settings.roundOffEnabled) {
        grandTotal = Math.round(grandTotal);
      }
    }

    const taxes = {
      subtotal: order.subtotal,
      serviceCharge: taxCalculation.serviceCharge,
      cgst: taxCalculation.cgst,
      sgst: taxCalculation.sgst,
      discount: order.discount || 0,
      packingCharges,
      roundOff: taxCalculation.roundOff,
      grandTotal,
    };

    const generatedAt = new Date();

    const billData: BillData = {
      order: {
        ...order,
        total: grandTotal,
      },
      invoiceNumber,
      restaurantSettings: settings,
      taxes: {
        cgst: taxes.cgst,
        sgst: taxes.sgst,
        serviceCharge: taxes.serviceCharge,
        packingCharges: taxes.packingCharges > 0 ? taxes.packingCharges : undefined,
        roundOff: taxes.roundOff,
        grandTotal: taxes.grandTotal,
      },
      printedAt: generatedAt,
      cashierName,
    };

    // Increment invoice number for next bill
    restaurantSettings.incrementInvoiceNumber();

    return {
      invoiceNumber,
      order,
      taxes,
      billData,
      generatedAt,
    };
  }

  /**
   * Generate and print a bill
   */
  async printBill(order: Order, cashierName?: string): Promise<GeneratedBill> {
    const bill = this.generateBill(order, cashierName);

    const printerConfig = usePrinterStore.getState().config;

    if (printerConfig.printerType === 'network' && printerConfig.networkPrinterUrl) {
      // Send to network printer
      await this.sendToNetworkPrinter(bill.billData, printerConfig.networkPrinterUrl);
    } else {
      // Use browser printing
      printBill(bill.billData);
    }

    // Add to print history
    usePrinterStore.getState().addPrintHistory(
      order.id || '',
      bill.invoiceNumber,
      true
    );

    return bill;
  }

  /**
   * Preview bill without printing
   */
  previewBill(order: Order, cashierName?: string): GeneratedBill {
    const bill = this.generateBill(order, cashierName);
    previewBill(bill.billData);
    return bill;
  }

  /**
   * Generate and download bill as PDF
   */
  async downloadBillPDF(order: Order, cashierName?: string): Promise<GeneratedBill> {
    const bill = this.generateBill(order, cashierName);

    // Download PDF
    await downloadBillPDF(bill.billData);

    // Add to print history
    usePrinterStore.getState().addPrintHistory(
      order.id || '',
      bill.invoiceNumber,
      true
    );

    return bill;
  }

  /**
   * Open bill PDF in new tab (for preview before printing)
   */
  async openBillPDF(order: Order, cashierName?: string): Promise<GeneratedBill> {
    const bill = this.generateBill(order, cashierName);
    await openBillPDF(bill.billData);
    return bill;
  }

  /**
   * Get bill HTML for custom rendering
   */
  getBillHTML(order: Order, cashierName?: string): string {
    const bill = this.generateBill(order, cashierName);
    return generateBillHTML(bill.billData);
  }

  /**
   * Send bill to network thermal printer
   */
  private async sendToNetworkPrinter(billData: BillData, printerUrl: string): Promise<void> {
    const html = generateBillHTML(billData);

    try {
      const response = await fetch(printerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/html',
        },
        body: html,
      });

      if (!response.ok) {
        throw new Error(`Printer responded with status ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send to network printer:', error);
      // Fallback to browser printing
      printBill(billData);
    }
  }

  /**
   * Calculate bill totals for preview (without generating invoice number)
   */
  calculateBillTotals(subtotal: number, discount: number = 0): {
    subtotal: number;
    serviceCharge: number;
    cgst: number;
    sgst: number;
    discount: number;
    roundOff: number;
    grandTotal: number;
    totalTax: number;
  } {
    const restaurantSettings = useRestaurantSettingsStore.getState();
    const settings = restaurantSettings.settings;
    const taxCalculation = restaurantSettings.calculateTaxes(subtotal);

    let grandTotal = taxCalculation.grandTotal - discount;
    let roundOff = 0;

    if (settings.roundOffEnabled) {
      roundOff = Math.round(grandTotal) - grandTotal;
      grandTotal = Math.round(grandTotal);
    }

    return {
      subtotal,
      serviceCharge: taxCalculation.serviceCharge,
      cgst: taxCalculation.cgst,
      sgst: taxCalculation.sgst,
      discount,
      roundOff,
      grandTotal,
      totalTax: taxCalculation.cgst + taxCalculation.sgst,
    };
  }

  /**
   * Get tax summary string for display
   */
  getTaxSummary(): string {
    const settings = useRestaurantSettingsStore.getState().settings;
    const totalGST = settings.cgstRate + settings.sgstRate;

    let summary = `GST ${totalGST}%`;
    if (settings.serviceChargeEnabled && settings.serviceChargeRate > 0) {
      summary += ` + SC ${settings.serviceChargeRate}%`;
    }

    return summary;
  }
}

// Export singleton instance
export const billService = new BillService();

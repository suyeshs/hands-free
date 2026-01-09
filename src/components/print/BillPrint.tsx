/**
 * BillPrint Component
 * Generates Indian restaurant tax invoice/bill for thermal printers
 * Supports 58mm and 80mm paper widths
 * Also generates downloadable PDF for testing
 */

import { Order, CartItem, PaymentMethod } from '../../types/pos';
import { RestaurantDetails } from '../../stores/restaurantSettingsStore';
import jsPDF from 'jspdf';

// ESC/POS Commands for thermal printers (TM-T82, TM-T88, etc.)
export const ESC_POS_BILL = {
  // Initialization
  INIT: '\x1B\x40', // Initialize printer

  // Print density - GS ( K for setting print density (makes print darker)
  DENSITY_DARK: '\x1D\x7C\x08', // Set print density to maximum (8)

  // Emphasized mode (bolder/darker text)
  EMPHASIZED_ON: '\x1B\x45\x01',
  EMPHASIZED_OFF: '\x1B\x45\x00',

  // Text formatting
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',

  // Text size - ESC ! n (combined modes)
  NORMAL: '\x1B\x21\x00',
  BOLD: '\x1B\x21\x08',
  DOUBLE_HEIGHT: '\x1B\x21\x10',
  DOUBLE_WIDTH: '\x1B\x21\x20',
  DOUBLE_SIZE: '\x1B\x21\x30', // Both double width and height
  BOLD_DOUBLE: '\x1B\x21\x38', // Bold + double size

  // Line spacing
  LINE_SPACING_DEFAULT: '\x1B\x32',
  LINE_SPACING_TIGHT: '\x1B\x33\x18', // 24 dots

  // Paper control
  FEED_LINES: (n: number) => `\x1B\x64${String.fromCharCode(n)}`,
  CUT_PAPER: '\x1D\x56\x00', // Full cut
  PARTIAL_CUT: '\x1D\x56\x01', // Partial cut

  // Cash drawer
  DRAWER_KICK: '\x1B\x70\x00\x19\xFA',

  // New line
  NEWLINE: '\n',

  // Horizontal lines
  HORIZONTAL_LINE: (width: number) => '-'.repeat(width) + '\n',
  DOUBLE_LINE: (width: number) => '='.repeat(width) + '\n',
};

// Line widths for different paper sizes
// TM-T82/TM-T88 with Font A (12×24): 42 chars at 80mm, 32 chars at 58mm
// Using slightly wider values to account for printer variations
export const LINE_WIDTH_80MM = 48; // 80mm paper - increased for better item display
export const LINE_WIDTH_58MM = 32; // 58mm paper

export interface BillData {
  order: Order;
  invoiceNumber: string;
  restaurantSettings: RestaurantDetails;
  taxes: {
    cgst: number;
    sgst: number;
    serviceCharge: number;
    packingCharges?: number;
    roundOff: number;
    grandTotal: number;
  };
  printedAt: Date;
  cashierName?: string;
}

// Format currency for Indian Rupees
function formatCurrency(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

// Format date for Indian format
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Get payment method label
function getPaymentMethodLabel(method?: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: 'CASH',
    card: 'CARD',
    upi: 'UPI',
    swiggy_coupon: 'SWIGGY COUPON',
    zomato_coupon: 'ZOMATO COUPON',
    pending: 'PENDING',
  };
  return method ? labels[method] : 'N/A';
}

// Generate HTML for thermal printer bill
export function generateBillHTML(data: BillData): string {
  const { order, invoiceNumber, restaurantSettings: settings, taxes, printedAt, cashierName } = data;
  const is80mm = settings.paperWidth === '80mm';
  const width = is80mm ? '80mm' : '58mm';

  // Build address string
  const addressLines = [
    settings.address.line1,
    settings.address.line2,
    `${settings.address.city}, ${settings.address.state} - ${settings.address.pincode}`,
  ].filter(Boolean);

  // Build items HTML
  const itemsHTML = order.items.map((item: CartItem) => {
    const itemName = item.menuItem.name.length > (is80mm ? 28 : 18)
      ? item.menuItem.name.substring(0, is80mm ? 25 : 15) + '...'
      : item.menuItem.name;

    const modifiersText = item.modifiers.length > 0
      ? item.modifiers.map(m => `  + ${m.name}`).join('\n')
      : '';

    const specialText = item.specialInstructions
      ? `  * ${item.specialInstructions.substring(0, 20)}${item.specialInstructions.length > 20 ? '...' : ''}`
      : '';

    return `
      <tr>
        <td style="text-align: left; padding: 2px 0;">${itemName}</td>
        <td style="text-align: center; padding: 2px 0;">${item.quantity}</td>
        <td style="text-align: right; padding: 2px 0;">${item.menuItem.price.toFixed(2)}</td>
        <td style="text-align: right; padding: 2px 0;">${item.subtotal.toFixed(2)}</td>
      </tr>
      ${modifiersText ? `<tr><td colspan="4" style="font-size: 10px; color: #666; padding-left: 8px;">${modifiersText.replace(/\n/g, '<br>')}</td></tr>` : ''}
      ${specialText ? `<tr><td colspan="4" style="font-size: 10px; font-style: italic; color: #666; padding-left: 8px;">${specialText}</td></tr>` : ''}
    `;
  }).join('');

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoiceNumber}</title>
  <style>
    @page {
      size: ${width} auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is80mm ? '12px' : '10px'};
      font-weight: 600; /* Semi-bold for better print visibility */
      line-height: 1.3;
      width: ${width};
      padding: 4mm;
      background: white;
      color: #000000; /* Pure black for maximum contrast */
      -webkit-font-smoothing: none; /* Disable anti-aliasing for sharper text */
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .restaurant-name {
      font-size: ${is80mm ? '18px' : '14px'};
      font-weight: bold;
      margin-bottom: 4px;
    }
    .tagline {
      font-size: ${is80mm ? '10px' : '8px'};
      font-style: italic;
      margin-bottom: 4px;
    }
    .address {
      font-size: ${is80mm ? '10px' : '8px'};
      margin-bottom: 2px;
    }
    .contact {
      font-size: ${is80mm ? '10px' : '8px'};
      margin-bottom: 8px;
    }
    .tax-invoice-title {
      font-size: ${is80mm ? '14px' : '12px'};
      font-weight: bold;
      padding: 4px 0;
      border-top: 1px dashed black;
      border-bottom: 1px dashed black;
      margin: 8px 0;
    }
    .legal-info {
      font-size: ${is80mm ? '9px' : '7px'};
      text-align: center;
      margin-bottom: 8px;
    }
    .invoice-details {
      font-size: ${is80mm ? '11px' : '9px'};
      margin-bottom: 8px;
    }
    .invoice-details table {
      width: 100%;
    }
    .invoice-details td {
      padding: 1px 0;
    }
    .separator {
      border-top: 1px dashed black;
      margin: 6px 0;
    }
    .double-separator {
      border-top: 2px solid black;
      margin: 6px 0;
    }
    .items-table {
      width: 100%;
      font-size: ${is80mm ? '11px' : '9px'};
      font-weight: 600; /* Semi-bold for item names */
      border-collapse: collapse;
      color: #000000;
    }
    .items-table th {
      text-align: left;
      padding: 4px 0;
      border-bottom: 1px solid black;
      font-weight: 700; /* Bold headers */
    }
    .items-table th:nth-child(2),
    .items-table th:nth-child(3),
    .items-table th:nth-child(4) {
      text-align: right;
    }
    .items-table td {
      font-weight: 600; /* Semi-bold for better visibility */
      color: #000000;
    }
    .totals {
      font-size: ${is80mm ? '11px' : '9px'};
      font-weight: 600;
      margin-top: 8px;
    }
    .totals table {
      width: 100%;
    }
    .totals td {
      padding: 2px 0;
      font-weight: 600;
    }
    .totals td:last-child {
      text-align: right;
    }
    .grand-total {
      font-size: ${is80mm ? '14px' : '12px'};
      font-weight: 700; /* Extra bold for grand total */
      padding: 6px 0;
      border-top: 2px solid black;
      border-bottom: 2px solid black;
      margin: 8px 0;
    }
    .grand-total table {
      width: 100%;
    }
    .grand-total td:last-child {
      text-align: right;
    }
    .payment-info {
      text-align: center;
      font-size: ${is80mm ? '12px' : '10px'};
      font-weight: bold;
      padding: 4px;
      background: #f0f0f0;
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      font-size: ${is80mm ? '10px' : '8px'};
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed black;
    }
    .thank-you {
      font-size: ${is80mm ? '12px' : '10px'};
      font-weight: bold;
      margin-bottom: 4px;
    }
    .footer-note {
      font-size: ${is80mm ? '8px' : '7px'};
      font-style: italic;
      margin-top: 8px;
    }
    .qr-section {
      text-align: center;
      margin: 12px 0;
    }
    .qr-section img {
      width: ${is80mm ? '80px' : '60px'};
      height: ${is80mm ? '80px' : '60px'};
    }
    .item-count {
      font-size: ${is80mm ? '10px' : '8px'};
      text-align: center;
      padding: 4px 0;
    }
    @media print {
      body {
        width: ${width};
        padding: 2mm;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      * {
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .items-table td,
      .totals td,
      .invoice-details td {
        font-weight: 600 !important;
        color: #000000 !important;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    ${settings.printLogo && settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-width: 60px; max-height: 60px; margin-bottom: 4px;">` : ''}
    <div class="restaurant-name">${settings.name}</div>
    ${settings.tagline ? `<div class="tagline">${settings.tagline}</div>` : ''}
    ${addressLines.map(line => `<div class="address">${line}</div>`).join('')}
    <div class="contact">Ph: ${settings.phone}${settings.email ? ` | ${settings.email}` : ''}</div>
  </div>

  <!-- Tax Invoice Title -->
  <div class="tax-invoice-title">TAX INVOICE</div>

  <!-- Legal Info -->
  <div class="legal-info">
    ${settings.gstNumber ? `GSTIN: ${settings.gstNumber}` : ''}
    ${settings.gstNumber && settings.fssaiNumber ? ' | ' : ''}
    ${settings.fssaiNumber ? `FSSAI: ${settings.fssaiNumber}` : ''}
  </div>

  <!-- Invoice Details -->
  <div class="invoice-details">
    <table>
      <tr>
        <td>Invoice No:</td>
        <td style="text-align: right; font-weight: bold;">${invoiceNumber}</td>
      </tr>
      <tr>
        <td>Date:</td>
        <td style="text-align: right;">${formatDate(printedAt)}</td>
      </tr>
      <tr>
        <td>Time:</td>
        <td style="text-align: right;">${formatTime(printedAt)}</td>
      </tr>
      ${order.tableNumber ? `
      <tr>
        <td>Table No:</td>
        <td style="text-align: right;">${order.tableNumber}</td>
      </tr>
      ` : ''}
      <tr>
        <td>Order Type:</td>
        <td style="text-align: right;">${order.orderType.toUpperCase()}</td>
      </tr>
      ${order.orderNumber ? `
      <tr>
        <td>Order No:</td>
        <td style="text-align: right;">${order.orderNumber}</td>
      </tr>
      ` : ''}
      ${cashierName ? `
      <tr>
        <td>Cashier:</td>
        <td style="text-align: right;">${cashierName}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <div class="separator"></div>

  <!-- Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: ${is80mm ? '50%' : '45%'}">Item</th>
        <th style="width: ${is80mm ? '15%' : '15%'}; text-align: center;">Qty</th>
        <th style="width: ${is80mm ? '15%' : '20%'}; text-align: right;">Rate</th>
        <th style="width: ${is80mm ? '20%' : '20%'}; text-align: right;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="separator"></div>

  <div class="item-count">Total Items: ${totalItems}</div>

  <!-- Totals -->
  <div class="totals">
    <table>
      ${!settings.taxEnabled ? `
      <!-- Tax Disabled -->
      <tr>
        <td>Sub Total:</td>
        <td>${formatCurrency(order.subtotal)}</td>
      </tr>
      ${taxes.serviceCharge > 0 ? `
      <tr>
        <td>Service Charge (${settings.serviceChargeRate}%):</td>
        <td>${formatCurrency(taxes.serviceCharge)}</td>
      </tr>
      ` : ''}
      ` : settings.taxIncludedInPrice ? `
      <tr>
        <td>Total (incl. tax):</td>
        <td>${formatCurrency(order.subtotal)}</td>
      </tr>
      <tr style="font-size: 9px; color: #666;">
        <td>&nbsp;&nbsp;├─ CGST (${settings.cgstRate}%):</td>
        <td>${formatCurrency(taxes.cgst)}</td>
      </tr>
      <tr style="font-size: 9px; color: #666;">
        <td>&nbsp;&nbsp;└─ SGST (${settings.sgstRate}%):</td>
        <td>${formatCurrency(taxes.sgst)}</td>
      </tr>
      ${taxes.serviceCharge > 0 ? `
      <tr>
        <td>Service Charge (${settings.serviceChargeRate}%):</td>
        <td>${formatCurrency(taxes.serviceCharge)}</td>
      </tr>
      ` : ''}
      ` : `
      <tr>
        <td>Sub Total:</td>
        <td>${formatCurrency(order.subtotal)}</td>
      </tr>
      ${taxes.serviceCharge > 0 ? `
      <tr>
        <td>Service Charge (${settings.serviceChargeRate}%):</td>
        <td>${formatCurrency(taxes.serviceCharge)}</td>
      </tr>
      ` : ''}
      <tr>
        <td>CGST (${settings.cgstRate}%):</td>
        <td>${formatCurrency(taxes.cgst)}</td>
      </tr>
      <tr>
        <td>SGST (${settings.sgstRate}%):</td>
        <td>${formatCurrency(taxes.sgst)}</td>
      </tr>
      `}
      ${order.discount > 0 ? `
      <tr>
        <td>Discount:</td>
        <td>- ${formatCurrency(order.discount)}</td>
      </tr>
      ` : ''}
      ${(taxes.packingCharges || order.packingCharges) && (taxes.packingCharges || order.packingCharges || 0) > 0 ? `
      <tr>
        <td>Packing Charges:</td>
        <td>+ ${formatCurrency(taxes.packingCharges || order.packingCharges || 0)}</td>
      </tr>
      ` : ''}
      ${taxes.roundOff !== 0 ? `
      <tr>
        <td>Round Off:</td>
        <td>${taxes.roundOff >= 0 ? '+' : ''}${formatCurrency(Math.abs(taxes.roundOff))}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <!-- Grand Total -->
  <div class="grand-total">
    <table>
      <tr>
        <td>GRAND TOTAL:</td>
        <td>${formatCurrency(taxes.grandTotal)}</td>
      </tr>
    </table>
  </div>

  <!-- Payment Info -->
  <div class="payment-info">
    PAID BY ${getPaymentMethodLabel(order.paymentMethod)}
  </div>

  ${settings.printQRCode && settings.qrCodeUrl ? `
  <div class="qr-section">
    <div style="font-size: 9px; margin-bottom: 4px;">Scan to Pay / Review</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(settings.qrCodeUrl)}" alt="QR Code">
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="thank-you">${settings.invoiceTerms || 'Thank you for dining with us!'}</div>
    ${settings.website ? `<div style="font-size: 9px;">Visit: ${settings.website}</div>` : ''}
    <div class="footer-note">${settings.footerNote || 'This is a computer generated invoice.'}</div>
    ${settings.gstNumber ? `<div class="footer-note">*GST included as per applicable rates</div>` : ''}
  </div>

  <!-- Cut Line -->
  <div style="text-align: center; margin-top: 16px; font-size: 8px; color: #ccc;">
    - - - - - - - - - - - - - - - - - - - - - - - - - -
  </div>
</body>
</html>
  `.trim();
}

// Print bill using iframe method (for browser printing)
export function printBill(data: BillData): void {
  const html = generateBillHTML(data);

  // Create hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to load then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Remove iframe after print dialog closes
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    };
  }
}

// Preview bill in new window
export function previewBill(data: BillData): void {
  const html = generateBillHTML(data);
  const previewWindow = window.open('', '_blank', 'width=400,height=600');
  if (previewWindow) {
    previewWindow.document.write(html);
    previewWindow.document.close();
  }
}

// React component for bill preview
export function BillPreview({ data }: { data: BillData }) {
  const html = generateBillHTML(data);

  return (
    <div
      className="bg-white text-black p-4 rounded-lg shadow-lg overflow-auto max-h-[600px]"
      style={{ width: data.restaurantSettings.paperWidth === '80mm' ? '320px' : '240px' }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Generate PDF bill using jsPDF - optimized for Epson thermal printers
export async function generateBillPDF(data: BillData): Promise<jsPDF> {
  const { order, invoiceNumber, restaurantSettings: settings, taxes, printedAt, cashierName } = data;
  const is80mm = settings.paperWidth === '80mm';

  // Epson thermal printer dimensions (exact paper width)
  // 80mm paper = 72mm printable area = ~204 points
  // 58mm paper = 48mm printable area = ~136 points
  // Using mm units for precise thermal printer sizing
  const pageWidthMM = is80mm ? 80 : 58;
  const printableWidthMM = is80mm ? 72 : 48;

  // Estimate page height based on content (in mm)
  // Each line is approximately 4mm for normal text, 6mm for headers
  const headerLines = 8; // Restaurant name, address, phone, etc.
  const invoiceDetailLines = 6; // Invoice info
  const itemLines = order.items.length * 2; // Item + possible modifier line
  const modifierLines = order.items.reduce((sum, item) => sum + item.modifiers.length, 0);
  const instructionLines = order.items.filter(i => i.specialInstructions).length;
  const totalsLines = 10; // Subtotal, taxes, grand total, payment
  const footerLines = 5;

  const totalLines = headerLines + invoiceDetailLines + itemLines + modifierLines + instructionLines + totalsLines + footerLines;
  const estimatedHeightMM = Math.max(100, totalLines * 4 + 30); // Min 100mm, 4mm per line + margin

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidthMM, estimatedHeightMM],
    putOnlyUsedFonts: true,
    compress: true,
  });

  // Set PDF properties for direct printing on Epson printers
  doc.setProperties({
    title: `Bill_${invoiceNumber}`,
    subject: 'Tax Invoice',
    creator: 'HandsFree POS',
    keywords: 'receipt, bill, invoice',
  });

  const margin = (pageWidthMM - printableWidthMM) / 2; // Center content
  const contentWidth = printableWidthMM;
  let y = 3; // Start 3mm from top

  // Helper functions - using mm units
  const centerText = (text: string, fontSize: number) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidthMM - textWidth) / 2, y);
    y += fontSize * 0.35 + 0.5; // Tighter line spacing in mm
  };

  const leftRightText = (left: string, right: string, fontSize: number) => {
    doc.setFontSize(fontSize);
    doc.text(left, margin, y);
    const rightWidth = doc.getTextWidth(right);
    doc.text(right, pageWidthMM - margin - rightWidth, y);
    y += fontSize * 0.35 + 1;
  };

  const drawDashedLine = () => {
    y += 1; // Add space before line
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidthMM - margin, y);
    doc.setLineDashPattern([], 0);
    y += 3; // Add space after line
  };

  const drawSolidLine = () => {
    y += 0.5; // Add space before line
    doc.line(margin, y, pageWidthMM - margin, y);
    y += 2; // Add space after line
  };

  // Set font
  doc.setFont('courier', 'normal');

  // Restaurant Header
  doc.setFont('courier', 'bold');
  centerText(settings.name, is80mm ? 14 : 11);
  doc.setFont('courier', 'normal');

  if (settings.tagline) {
    doc.setFontSize(is80mm ? 8 : 7);
    centerText(settings.tagline, is80mm ? 8 : 7);
  }

  // Address
  const addressLines = [
    settings.address.line1,
    settings.address.line2,
    `${settings.address.city}, ${settings.address.state} - ${settings.address.pincode}`,
  ].filter(Boolean);

  addressLines.forEach(line => {
    if (line) centerText(line, is80mm ? 8 : 7);
  });

  if (settings.phone) {
    centerText(`Ph: ${settings.phone}`, is80mm ? 8 : 7);
  }

  drawDashedLine();

  // TAX INVOICE title
  doc.setFont('courier', 'bold');
  centerText('TAX INVOICE', is80mm ? 12 : 10);
  doc.setFont('courier', 'normal');

  drawDashedLine();

  // Legal info (GST, FSSAI)
  if (settings.gstNumber || settings.fssaiNumber) {
    let legalText = '';
    if (settings.gstNumber) legalText += `GSTIN: ${settings.gstNumber}`;
    if (settings.gstNumber && settings.fssaiNumber) legalText += ' | ';
    if (settings.fssaiNumber) legalText += `FSSAI: ${settings.fssaiNumber}`;
    centerText(legalText, is80mm ? 7 : 6);
    y += 1;
  }

  // Invoice Details
  const detailsFontSize = is80mm ? 9 : 8;
  leftRightText('Invoice No:', invoiceNumber, detailsFontSize);
  leftRightText('Date:', formatDate(printedAt), detailsFontSize);
  leftRightText('Time:', formatTime(printedAt), detailsFontSize);

  if (order.tableNumber) {
    leftRightText('Table No:', order.tableNumber.toString(), detailsFontSize);
  }
  leftRightText('Order Type:', order.orderType.toUpperCase(), detailsFontSize);

  if (order.orderNumber) {
    leftRightText('Order No:', order.orderNumber, detailsFontSize);
  }
  if (cashierName) {
    leftRightText('Cashier:', cashierName, detailsFontSize);
  }

  drawDashedLine();

  // Items Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(is80mm ? 9 : 8);
  doc.text('Item', margin, y);
  doc.text('Qty', margin + contentWidth * 0.5, y);
  doc.text('Rate', margin + contentWidth * 0.65, y);
  const amtText = 'Amt';
  doc.text(amtText, pageWidthMM - margin - doc.getTextWidth(amtText), y);
  y += 3;
  drawSolidLine();
  doc.setFont('courier', 'normal');

  // Add extra space after header line before first item
  y += 1;

  // Items
  const itemFontSize = is80mm ? 9 : 8;
  let totalItems = 0;

  order.items.forEach((item: CartItem) => {
    totalItems += item.quantity;

    // Item name (truncate if needed)
    const maxNameLen = is80mm ? 20 : 14;
    let itemName = item.menuItem.name;
    if (itemName.length > maxNameLen) {
      itemName = itemName.substring(0, maxNameLen - 2) + '..';
    }

    doc.setFontSize(itemFontSize);
    doc.text(itemName, margin, y);
    doc.text(item.quantity.toString(), margin + contentWidth * 0.52, y);
    doc.text(item.menuItem.price.toFixed(0), margin + contentWidth * 0.65, y);
    const subtotalText = item.subtotal.toFixed(2);
    doc.text(subtotalText, pageWidthMM - margin - doc.getTextWidth(subtotalText), y);
    y += 3.5; // Line height in mm

    // Modifiers
    if (item.modifiers.length > 0) {
      doc.setFontSize(is80mm ? 7 : 6);
      item.modifiers.forEach(mod => {
        doc.text(`  + ${mod.name}`, margin, y);
        y += 3;
      });
    }

    // Special instructions
    if (item.specialInstructions) {
      doc.setFontSize(is80mm ? 7 : 6);
      const instruction = item.specialInstructions.length > 25
        ? item.specialInstructions.substring(0, 22) + '...'
        : item.specialInstructions;
      doc.text(`  * ${instruction}`, margin, y);
      y += 3;
    }
  });

  drawDashedLine();

  // Total items
  centerText(`Total Items: ${totalItems}`, is80mm ? 8 : 7);

  // Totals
  const totalsFontSize = is80mm ? 9 : 8;
  const smallFontSize = is80mm ? 7 : 6;

  if (!settings.taxEnabled) {
    // Tax Disabled - just show subtotal
    leftRightText('Sub Total:', `Rs. ${order.subtotal.toFixed(2)}`, totalsFontSize);
    if (taxes.serviceCharge > 0) {
      leftRightText(`Service Charge (${settings.serviceChargeRate}%):`, `Rs. ${taxes.serviceCharge.toFixed(2)}`, totalsFontSize);
    }
  } else if (settings.taxIncludedInPrice) {
    // Tax Included in Price display
    leftRightText('Total (incl. tax):', `Rs. ${order.subtotal.toFixed(2)}`, totalsFontSize);
    leftRightText(`  CGST (${settings.cgstRate}%):`, `Rs. ${taxes.cgst.toFixed(2)}`, smallFontSize);
    leftRightText(`  SGST (${settings.sgstRate}%):`, `Rs. ${taxes.sgst.toFixed(2)}`, smallFontSize);
    if (taxes.serviceCharge > 0) {
      leftRightText(`Service Charge (${settings.serviceChargeRate}%):`, `Rs. ${taxes.serviceCharge.toFixed(2)}`, totalsFontSize);
    }
  } else {
    // Tax Added display
    leftRightText('Sub Total:', `Rs. ${order.subtotal.toFixed(2)}`, totalsFontSize);
    if (taxes.serviceCharge > 0) {
      leftRightText(`Service Charge (${settings.serviceChargeRate}%):`, `Rs. ${taxes.serviceCharge.toFixed(2)}`, totalsFontSize);
    }
    leftRightText(`CGST (${settings.cgstRate}%):`, `Rs. ${taxes.cgst.toFixed(2)}`, totalsFontSize);
    leftRightText(`SGST (${settings.sgstRate}%):`, `Rs. ${taxes.sgst.toFixed(2)}`, totalsFontSize);
  }

  if (order.discount > 0) {
    leftRightText('Discount:', `- Rs. ${order.discount.toFixed(2)}`, totalsFontSize);
  }

  const packingChargesAmount = taxes.packingCharges || order.packingCharges || 0;
  if (packingChargesAmount > 0) {
    leftRightText('Packing Charges:', `+ Rs. ${packingChargesAmount.toFixed(2)}`, totalsFontSize);
  }

  if (taxes.roundOff !== 0) {
    const roundOffSign = taxes.roundOff >= 0 ? '+' : '';
    leftRightText('Round Off:', `${roundOffSign}Rs. ${Math.abs(taxes.roundOff).toFixed(2)}`, totalsFontSize);
  }

  drawSolidLine();

  // Grand Total - add padding above and below for centering between lines
  y += 1; // Space above text
  doc.setFont('courier', 'bold');
  doc.setFontSize(is80mm ? 12 : 10);
  const grandTotalLeft = 'GRAND TOTAL:';
  const grandTotalRight = `Rs. ${taxes.grandTotal.toFixed(2)}`;
  doc.text(grandTotalLeft, margin, y);
  const grandTotalRightWidth = doc.getTextWidth(grandTotalRight);
  doc.text(grandTotalRight, pageWidthMM - margin - grandTotalRightWidth, y);
  y += (is80mm ? 12 : 10) * 0.35 + 2; // Extra space below text
  doc.setFont('courier', 'normal');

  drawSolidLine();

  // Payment method - highlighted box
  const boxHeight = is80mm ? 7 : 6;
  const boxY = y;
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, boxY, contentWidth, boxHeight, 'F');

  // Center text vertically in box
  doc.setFont('courier', 'bold');
  doc.setFontSize(is80mm ? 10 : 9);
  const paymentText = `PAID BY ${getPaymentMethodLabel(order.paymentMethod)}`;
  const paymentTextWidth = doc.getTextWidth(paymentText);
  const textY = boxY + (boxHeight / 2) + 1; // Center vertically with slight adjustment
  doc.text(paymentText, (pageWidthMM - paymentTextWidth) / 2, textY);
  doc.setFont('courier', 'normal');

  y = boxY + boxHeight + 2; // Move y past the box
  drawDashedLine();

  // Footer
  if (settings.invoiceTerms) {
    doc.setFont('courier', 'bold');
    centerText(settings.invoiceTerms, is80mm ? 9 : 8);
    doc.setFont('courier', 'normal');
  }

  if (settings.website) {
    centerText(`Visit: ${settings.website}`, is80mm ? 7 : 6);
  }

  if (settings.footerNote) {
    centerText(settings.footerNote, is80mm ? 7 : 6);
  }

  if (settings.gstNumber) {
    centerText('*GST included as per applicable rates', is80mm ? 6 : 5);
  }

  y += 4;

  // Cut line indicator for thermal printer
  centerText('--------------------------------', is80mm ? 8 : 7);

  // Note: Page size is pre-calculated during PDF creation
  // PDF is optimized for Epson thermal printers (TM-T82, TM-T88, etc.)

  return doc;
}

// Download bill as PDF
export async function downloadBillPDF(data: BillData): Promise<void> {
  const doc = await generateBillPDF(data);
  const filename = `Bill_${data.invoiceNumber}_${formatDate(data.printedAt).replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

// Open bill PDF in new tab for preview/print
export async function openBillPDF(data: BillData): Promise<void> {
  const doc = await generateBillPDF(data);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

/**
 * Generate ESC/POS commands for thermal printers (TM-T82, TM-T88, etc.)
 * Compact format to ensure all items fit - optimized for 80mm (42 chars) or 58mm (32 chars) paper
 */
export function generateBillEscPos(data: BillData): string {
  const { order, invoiceNumber, restaurantSettings: settings, taxes, printedAt } = data;
  const is80mm = settings.paperWidth === '80mm';
  const LINE_WIDTH = is80mm ? LINE_WIDTH_80MM : LINE_WIDTH_58MM;

  // Helper to pad/format text for left-right alignment
  const leftRight = (left: string, right: string, width: number = LINE_WIDTH): string => {
    const maxLeft = width - right.length - 1;
    const truncLeft = left.length > maxLeft ? left.substring(0, maxLeft - 2) + '..' : left;
    return truncLeft.padEnd(width - right.length) + right + '\n';
  };

  // Helper to center text
  const center = (text: string, width: number = LINE_WIDTH): string => {
    if (text.length >= width) return text.substring(0, width) + '\n';
    const pad = Math.floor((width - text.length) / 2);
    return ' '.repeat(pad) + text + '\n';
  };

  // Helper to truncate text
  const truncate = (text: string, maxLen: number): string => {
    return text.length > maxLen ? text.substring(0, maxLen - 2) + '..' : text;
  };

  let output = '';

  // Initialize printer and set dark print density
  output += ESC_POS_BILL.INIT;
  output += ESC_POS_BILL.DENSITY_DARK; // Make print darker for TM-T82
  output += ESC_POS_BILL.EMPHASIZED_ON; // Enable emphasized mode for bolder text
  output += ESC_POS_BILL.LINE_SPACING_TIGHT; // Tighter line spacing

  // Header - Restaurant name (centered, bold but not double size to save space)
  output += ESC_POS_BILL.ALIGN_CENTER;
  output += ESC_POS_BILL.BOLD;
  output += truncate(settings.name, LINE_WIDTH) + ESC_POS_BILL.NEWLINE;

  // Compact address - combine city/state/pin on one line
  output += ESC_POS_BILL.NORMAL;
  const addressParts = [
    settings.address.line1,
    settings.address.city ? `${settings.address.city}-${settings.address.pincode}` : ''
  ].filter(Boolean);
  if (addressParts.length > 0) {
    output += truncate(addressParts.join(', '), LINE_WIDTH) + ESC_POS_BILL.NEWLINE;
  }

  // Phone and GST on same line if possible
  const contactLine = [
    settings.phone ? `Ph:${settings.phone}` : '',
    settings.gstNumber ? `GST:${settings.gstNumber}` : ''
  ].filter(Boolean).join(' | ');
  if (contactLine) {
    output += truncate(contactLine, LINE_WIDTH) + ESC_POS_BILL.NEWLINE;
  }

  output += ESC_POS_BILL.HORIZONTAL_LINE(LINE_WIDTH);

  // Compact invoice details - combine date/time on one line
  output += ESC_POS_BILL.ALIGN_LEFT;
  const dateStr = printedAt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = printedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  output += ESC_POS_BILL.BOLD;
  output += leftRight('Bill:', invoiceNumber, LINE_WIDTH);
  output += ESC_POS_BILL.NORMAL;
  output += leftRight('Date/Time:', `${dateStr} ${timeStr}`, LINE_WIDTH);

  // Combine table and order type on one line if table exists
  if (order.tableNumber) {
    output += leftRight(`Table: ${order.tableNumber}`, order.orderType.toUpperCase(), LINE_WIDTH);
  } else {
    output += leftRight('Type:', order.orderType.toUpperCase(), LINE_WIDTH);
  }

  output += ESC_POS_BILL.HORIZONTAL_LINE(LINE_WIDTH);

  // Items header - maximize item name width
  output += ESC_POS_BILL.BOLD;
  // Use minimal space for qty (2) and amount (8 for 80mm, 6 for 58mm)
  // This gives more room for item names
  const qtyColWidth = 2;
  const amtColWidth = is80mm ? 8 : 6;
  const itemColWidth = LINE_WIDTH - qtyColWidth - amtColWidth;
  // 80mm: 42 - 2 - 8 = 32 chars for item name
  // 58mm: 32 - 2 - 6 = 24 chars for item name

  let header = 'Item'.padEnd(itemColWidth);
  header += 'Q'.padStart(qtyColWidth);
  header += 'Amount'.padStart(amtColWidth);
  output += header + ESC_POS_BILL.NEWLINE;
  output += ESC_POS_BILL.NORMAL;
  output += ESC_POS_BILL.HORIZONTAL_LINE(LINE_WIDTH);

  // Items - maximize item name display
  let totalItems = 0;
  for (const item of order.items) {
    totalItems += item.quantity;

    const itemName = truncate(item.menuItem.name, itemColWidth);
    const qty = item.quantity.toString().padStart(qtyColWidth);
    const amt = item.subtotal.toFixed(2).padStart(amtColWidth);

    output += itemName.padEnd(itemColWidth) + qty + amt + ESC_POS_BILL.NEWLINE;

    // Only show modifiers if they exist (skip special instructions to save space)
    if (item.modifiers.length > 0) {
      const modStr = item.modifiers.map(m => m.name).join(', ');
      output += `  +${truncate(modStr, LINE_WIDTH - 3)}` + ESC_POS_BILL.NEWLINE;
    }
  }

  output += ESC_POS_BILL.HORIZONTAL_LINE(LINE_WIDTH);

  // Compact totals - combine on fewer lines
  output += leftRight(`Items: ${totalItems}  Subtotal:`, `Rs.${order.subtotal.toFixed(2)}`, LINE_WIDTH);

  // Compact tax display (only if tax is enabled)
  if (settings.taxEnabled) {
    const totalTax = taxes.cgst + taxes.sgst;
    if (settings.taxIncludedInPrice) {
      output += leftRight(`Tax (incl):`, `Rs.${totalTax.toFixed(2)}`, LINE_WIDTH);
    } else {
      output += leftRight(`Tax (${settings.cgstRate + settings.sgstRate}%):`, `Rs.${totalTax.toFixed(2)}`, LINE_WIDTH);
    }
  }

  if (taxes.serviceCharge > 0) {
    output += leftRight(`Svc Chg:`, `Rs.${taxes.serviceCharge.toFixed(2)}`, LINE_WIDTH);
  }

  if (order.discount > 0) {
    output += leftRight('Discount:', `-Rs.${order.discount.toFixed(2)}`, LINE_WIDTH);
  }

  const escPosPackingCharges = taxes.packingCharges || order.packingCharges || 0;
  if (escPosPackingCharges > 0) {
    output += leftRight('Packing Charges:', `+Rs.${escPosPackingCharges.toFixed(2)}`, LINE_WIDTH);
  }

  // Grand Total - make it stand out
  output += ESC_POS_BILL.HORIZONTAL_LINE(LINE_WIDTH);
  output += ESC_POS_BILL.BOLD;
  output += leftRight('TOTAL:', `Rs.${taxes.grandTotal.toFixed(2)}`, LINE_WIDTH);
  output += ESC_POS_BILL.NORMAL;
  output += ESC_POS_BILL.HORIZONTAL_LINE(LINE_WIDTH);

  // Payment method - compact
  output += ESC_POS_BILL.ALIGN_CENTER;
  const paymentLabel = order.paymentMethod ? order.paymentMethod.toUpperCase() : 'PENDING';
  output += `Paid: ${paymentLabel}` + ESC_POS_BILL.NEWLINE;

  // Compact footer - just thank you message
  output += center('Thank you!', LINE_WIDTH);

  // Feed and cut
  output += ESC_POS_BILL.FEED_LINES(3);
  output += ESC_POS_BILL.PARTIAL_CUT;

  return output;
}

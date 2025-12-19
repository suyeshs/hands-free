/**
 * KOT (Kitchen Order Ticket) Print Component
 * Formats kitchen orders for thermal printer output
 */

import { KitchenOrder } from '../../types/kds';

interface KOTPrintProps {
  order: KitchenOrder;
  restaurantName?: string;
  stationFilter?: string;
}

export default function KOTPrint({ order, restaurantName = 'Restaurant', stationFilter }: KOTPrintProps) {
  // Filter items by station if specified
  const itemsToPrint = stationFilter
    ? order.items.filter((item) => item.station?.toLowerCase() === stationFilter.toLowerCase())
    : order.items;

  const printDate = new Date().toLocaleString();

  return (
    <div className="kot-print" style={{ width: '80mm', fontFamily: 'monospace', fontSize: '12px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{restaurantName}</div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>KITCHEN ORDER TICKET</div>
        {stationFilter && (
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase' }}>
            {stationFilter} STATION
          </div>
        )}
      </div>

      {/* Order Info */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
          <span>Order #:</span>
          <span>{order.orderNumber}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span>Type:</span>
          <span style={{ textTransform: 'capitalize' }}>{order.orderType}</span>
        </div>
        {order.tableNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>Table:</span>
            <span>{order.tableNumber}</span>
          </div>
        )}
        {order.source && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>Source:</span>
            <span style={{ textTransform: 'uppercase' }}>{order.source}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span>Time:</span>
          <span>{printDate}</span>
        </div>
      </div>

      {/* Items */}
      <div style={{ borderTop: '2px dashed #000', borderBottom: '2px dashed #000', padding: '8px 0' }}>
        {itemsToPrint.map((item, index) => (
          <div key={item.id} style={{ marginBottom: index < itemsToPrint.length - 1 ? '12px' : '0' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {item.quantity}x {item.name}
            </div>

            {item.modifiers && item.modifiers.length > 0 && (
              <div style={{ marginLeft: '16px', marginTop: '4px', fontSize: '11px' }}>
                {item.modifiers.map((mod, i) => (
                  <div key={i}>
                    - {mod.name}: {mod.value}
                  </div>
                ))}
              </div>
            )}

            {item.specialInstructions && (
              <div style={{ marginLeft: '16px', marginTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                *** {item.specialInstructions} ***
              </div>
            )}

            {item.station && (
              <div style={{ marginLeft: '16px', marginTop: '4px', fontSize: '10px', textTransform: 'uppercase' }}>
                [{item.station}]
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px' }}>
        <div>Items: {itemsToPrint.reduce((sum, item) => sum + item.quantity, 0)}</div>
        {order.estimatedPrepTime && (
          <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
            Est. Prep Time: {order.estimatedPrepTime} min
          </div>
        )}
      </div>

      {/* Cut Line */}
      <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '10px' }}>
        {'- '.repeat(20)}
      </div>
    </div>
  );
}

/**
 * Generate HTML string for printing
 */
export function generateKOTHTML(order: KitchenOrder, restaurantName?: string, stationFilter?: string): string {
  const itemsToPrint = stationFilter
    ? order.items.filter((item) => item.station?.toLowerCase() === stationFilter.toLowerCase())
    : order.items;

  const printDate = new Date().toLocaleString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>KOT - ${order.orderNumber}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          margin: 0;
          padding: 8mm;
          width: 80mm;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .restaurant-name {
          font-size: 16px;
          font-weight: bold;
        }
        .title {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
        }
        .station {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
          text-transform: uppercase;
        }
        .order-info {
          margin-bottom: 8px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
        }
        .order-number {
          font-weight: bold;
          font-size: 16px;
        }
        .items {
          border-top: 2px dashed #000;
          border-bottom: 2px dashed #000;
          padding: 8px 0;
        }
        .item {
          margin-bottom: 12px;
        }
        .item:last-child {
          margin-bottom: 0;
        }
        .item-name {
          font-weight: bold;
          font-size: 14px;
        }
        .modifiers {
          margin-left: 16px;
          margin-top: 4px;
          font-size: 11px;
        }
        .special-instructions {
          margin-left: 16px;
          margin-top: 4px;
          font-weight: bold;
          font-size: 11px;
        }
        .item-station {
          margin-left: 16px;
          margin-top: 4px;
          font-size: 10px;
          text-transform: uppercase;
        }
        .footer {
          margin-top: 8px;
          text-align: center;
          font-size: 10px;
        }
        .cut-line {
          margin-top: 16px;
          text-align: center;
          font-size: 10px;
        }
        @media print {
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="restaurant-name">${restaurantName || 'Restaurant'}</div>
        <div class="title">KITCHEN ORDER TICKET</div>
        ${stationFilter ? `<div class="station">${stationFilter} STATION</div>` : ''}
      </div>

      <div class="order-info">
        <div class="info-row order-number">
          <span>Order #:</span>
          <span>${order.orderNumber}</span>
        </div>
        <div class="info-row">
          <span>Type:</span>
          <span style="text-transform: capitalize;">${order.orderType}</span>
        </div>
        ${order.tableNumber ? `
        <div class="info-row">
          <span>Table:</span>
          <span>${order.tableNumber}</span>
        </div>
        ` : ''}
        ${order.source ? `
        <div class="info-row">
          <span>Source:</span>
          <span style="text-transform: uppercase;">${order.source}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span>Time:</span>
          <span>${printDate}</span>
        </div>
      </div>

      <div class="items">
        ${itemsToPrint.map(item => `
          <div class="item">
            <div class="item-name">${item.quantity}x ${item.name}</div>
            ${item.modifiers && item.modifiers.length > 0 ? `
              <div class="modifiers">
                ${item.modifiers.map(mod => `<div>- ${mod.name}: ${mod.value}</div>`).join('')}
              </div>
            ` : ''}
            ${item.specialInstructions ? `
              <div class="special-instructions">*** ${item.specialInstructions} ***</div>
            ` : ''}
            ${item.station ? `
              <div class="item-station">[${item.station}]</div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="footer">
        <div>Items: ${itemsToPrint.reduce((sum, item) => sum + item.quantity, 0)}</div>
        ${order.estimatedPrepTime ? `
          <div style="margin-top: 4px; font-weight: bold;">
            Est. Prep Time: ${order.estimatedPrepTime} min
          </div>
        ` : ''}
      </div>

      <div class="cut-line">${'- '.repeat(20)}</div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;
}

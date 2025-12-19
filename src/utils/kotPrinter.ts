import { CartItem } from '../types/pos';

export interface KOTData {
    orderId: string;
    tableNumber?: string;
    serverName: string;
    timestamp: string;
    items: CartItem[];
    type: 'KOT' | 'BOT';
}

export const printTicket = (data: KOTData) => {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const itemsHtml = data.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed #ccc; padding-bottom: 2px;">
            <div style="font-weight: 900; font-size: 1.2rem;">${item.quantity} x ${item.menuItem.name}</div>
        </div>
        ${item.modifiers?.length ? `
            <div style="margin-left: 20px; font-size: 0.9rem; font-style: italic; margin-bottom: 8px;">
                ${item.modifiers.map((m: any) => `+ ${m.name}`).join('<br/>')}
            </div>
        ` : ''}
    `).join('');

    const html = `
        <html>
        <head>
            <style>
                @page { margin: 0; }
                body { 
                    font-family: 'Inter', 'Roboto', 'Courier New', monospace; 
                    width: 72mm; 
                    margin: 0; 
                    padding: 4mm;
                    color: black;
                }
                .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 4px; margin-bottom: 8px; }
                .title { font-size: 1.5rem; font-weight: 900; background: black; color: white; padding: 4px; margin-bottom: 4px; }
                .meta { font-size: 0.8rem; font-weight: bold; margin-bottom: 8px; }
                .footer { margin-top: 12px; border-top: 1px solid black; padding-top: 4px; font-size: 0.7rem; text-align: center; }
                .huge-table { font-size: 2rem; font-weight: 900; border: 4px solid black; display: inline-block; padding: 4px 12px; margin: 8px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">${data.type === 'KOT' ? 'KITCHEN ORDER' : 'BAR ORDER'}</div>
                <div class="meta">
                    #${data.orderId.slice(-6).toUpperCase()} | ${data.timestamp}
                </div>
            </div>
            
            <div style="text-align: center;">
                <div class="huge-table">TABLE ${data.tableNumber || 'N/A'}</div>
                <div style="font-size: 0.9rem; font-weight: bold; margin-bottom: 12px;">SERVER: ${data.serverName.toUpperCase()}</div>
            </div>

            <div class="items">
                ${itemsHtml}
            </div>

            <div class="footer">
                INDUSTRIAL POS SYSTEM v2.0<br/>
                *** END OF TICKET ***
            </div>
            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => {
                        window.parent.document.body.removeChild(window.frameElement);
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();
};

/**
 * Splits an order into KOT (Food) and BOT (Beverages) if needed
 */
export const splitAndPrintTickets = (
    items: CartItem[],
    orderId: string,
    tableNumber: string | undefined,
    serverName: string
) => {
    const timestamp = new Date().toLocaleTimeString();

    // Mock category detection - in a real app, this comes from item metadata
    const foodItems = items.filter(item => !['Drink', 'Soda', 'Wine', 'Beer', 'Beverage'].includes(String(item.menuItem.category) || ''));
    const bevItems = items.filter(item => ['Drink', 'Soda', 'Wine', 'Beer', 'Beverage'].includes(String(item.menuItem.category) || ''));

    if (foodItems.length > 0) {
        printTicket({
            orderId,
            tableNumber,
            serverName,
            timestamp,
            items: foodItems,
            type: 'KOT'
        });
    }

    if (bevItems.length > 0) {
        printTicket({
            orderId,
            tableNumber,
            serverName,
            timestamp,
            items: bevItems,
            type: 'BOT'
        });
    }
};

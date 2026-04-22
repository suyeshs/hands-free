const ROUTER_URL = 'https://handsfree-tenant-router.suyesh.workers.dev';

export interface Transaction {
  id: string;
  invoice_number: string;
  order_number?: string;
  order_type: string;
  table_number?: number;
  source: string;
  subtotal: number;
  service_charge: number;
  cgst: number;
  sgst: number;
  discount: number;
  round_off: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  items: any[];
  cashier_name?: string;
  created_at: string;
  completed_at: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export async function fetchTransactions(
  tenantId: string,
  params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
    order_type?: string;
    payment_method?: string;
  }
): Promise<TransactionsResponse> {
  const query = new URLSearchParams();
  query.set('from', params.from);
  query.set('to', params.to);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.order_type) query.set('order_type', params.order_type);
  if (params.payment_method) query.set('payment_method', params.payment_method);

  const url = `${ROUTER_URL}/api/sales/${tenantId}/transactions?${query.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.status}`);
  }
  const data = await response.json() as any;
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch transactions');
  }
  return {
    transactions: data.transactions || [],
    total: data.total || 0,
    page: data.page || 1,
    pages: data.pages || 1,
    limit: data.limit || 50,
  };
}

function formatDateDDMMYYYY(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionsToCSV(transactions: Transaction[]): string {
  const headers = [
    'Invoice',
    'Date',
    'Order Type',
    'Table',
    'Payment Method',
    'Subtotal',
    'Tax',
    'Discount',
    'Total',
    'Cashier',
    'Items',
  ];

  const rows = transactions.map((t) => {
    const itemNames = (t.items || []).map((item: any) => item.name || '').filter(Boolean).join(', ');
    const tax = (t.cgst || 0) + (t.sgst || 0);
    return [
      escapeCSVField(t.invoice_number || ''),
      escapeCSVField(formatDateDDMMYYYY(t.completed_at)),
      escapeCSVField(t.order_type || ''),
      escapeCSVField(t.table_number != null ? String(t.table_number) : ''),
      escapeCSVField(t.payment_method || ''),
      (t.subtotal || 0).toFixed(2),
      tax.toFixed(2),
      (t.discount || 0).toFixed(2),
      (t.grand_total || 0).toFixed(2),
      escapeCSVField(t.cashier_name || ''),
      escapeCSVField(itemNames),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

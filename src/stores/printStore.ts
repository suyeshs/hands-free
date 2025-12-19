/**
 * Print Store
 * Manages KOT printing and print queue
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PrintType = 'kot' | 'customer_receipt' | 'aggregator_receipt' | 'bill';

export type PrintStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  type: PrintType;
  orderId: string;
  orderNumber: string;
  station?: string | null; // For KOT - which kitchen station
  content: PrintContent;
  status: PrintStatus;
  createdAt: string;
  printedAt?: string | null;
  error?: string | null;
  retryCount: number;
}

export interface PrintContent {
  header: {
    orderNumber: string;
    orderType: string;
    timestamp: string;
    tableName?: string;
    customerName?: string;
  };
  items: PrintItem[];
  footer?: {
    specialInstructions?: string;
    total?: number;
  };
}

export interface PrintItem {
  name: string;
  quantity: number;
  variants?: string[];
  addons?: string[];
  specialInstructions?: string;
}

export interface PrinterConfig {
  enabled: boolean;
  autoPrint: boolean;
  printerName: string | null;
  paperSize: 'mm80' | 'mm58';
  fontSize: 'small' | 'medium' | 'large';
  printByStation: boolean; // Print separate KOTs per station
  stationPrinters: Record<string, string>; // station -> printer name mapping
}

interface PrintStore {
  // State
  printQueue: PrintJob[];
  printHistory: PrintJob[];
  printerConfig: PrinterConfig;
  isInitialized: boolean;

  // Actions - Queue management
  addPrintJob: (job: Omit<PrintJob, 'id' | 'status' | 'createdAt' | 'retryCount'>) => void;
  updatePrintJob: (jobId: string, updates: Partial<PrintJob>) => void;
  removePrintJob: (jobId: string) => void;
  clearQueue: () => void;

  // Actions - Printing
  printJob: (jobId: string) => Promise<void>;
  printNextInQueue: () => Promise<void>;
  retryFailedJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => void;

  // Actions - KOT specific
  printKOT: (
    orderId: string,
    orderNumber: string,
    content: PrintContent,
    station?: string
  ) => Promise<void>;

  // Actions - Configuration
  updatePrinterConfig: (config: Partial<PrinterConfig>) => void;
  setAutoPrint: (enabled: boolean) => void;
  setPrintByStation: (enabled: boolean) => void;
  setStationPrinter: (station: string, printerName: string) => void;

  // Computed
  getPendingJobs: () => PrintJob[];
  getFailedJobs: () => PrintJob[];
  getJobById: (jobId: string) => PrintJob | undefined;
}

export const usePrintStore = create<PrintStore>()(
  persist(
    (set, get) => ({
      // Initial state
      printQueue: [],
      printHistory: [],
      printerConfig: {
        enabled: true,
        autoPrint: true,
        printerName: null,
        paperSize: 'mm80',
        fontSize: 'medium',
        printByStation: false,
        stationPrinters: {},
      },
      isInitialized: false,

      // Add print job to queue
      addPrintJob: (job) => {
        const newJob: PrintJob = {
          ...job,
          id: `print-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'pending',
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };

        set((state) => ({
          printQueue: [...state.printQueue, newJob],
        }));

        console.log('[Print] Added job to queue:', newJob.id);

        // Auto-print if enabled
        if (get().printerConfig.autoPrint) {
          get().printJob(newJob.id);
        }
      },

      // Update print job
      updatePrintJob: (jobId, updates) => {
        set((state) => ({
          printQueue: state.printQueue.map((job) =>
            job.id === jobId ? { ...job, ...updates } : job
          ),
        }));
      },

      // Remove job from queue
      removePrintJob: (jobId) => {
        set((state) => ({
          printQueue: state.printQueue.filter((job) => job.id !== jobId),
        }));
      },

      // Clear entire queue
      clearQueue: () => {
        set({ printQueue: [] });
      },

      // Print a specific job
      printJob: async (jobId) => {
        const job = get().printQueue.find((j) => j.id === jobId);
        if (!job) {
          console.error('[Print] Job not found:', jobId);
          return;
        }

        // Update status to printing
        get().updatePrintJob(jobId, { status: 'printing' });

        try {
          // TODO: Phase 6 - Implement actual printing
          // For web: Use browser print API or cloud print service
          // For Tauri: Use native printer integration

          console.log('[Print] Printing job:', jobId, job);

          // Simulate printing delay
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // For now, just use browser print
          if (typeof window !== 'undefined') {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(formatPrintContent(job));
              printWindow.document.close();
              printWindow.print();
            }
          }

          // Mark as completed
          const completedJob = {
            ...job,
            status: 'completed' as PrintStatus,
            printedAt: new Date().toISOString(),
          };

          // Move to history
          set((state) => ({
            printQueue: state.printQueue.filter((j) => j.id !== jobId),
            printHistory: [completedJob, ...state.printHistory].slice(0, 100), // Keep last 100
          }));

          console.log('[Print] Job completed:', jobId);
        } catch (error) {
          console.error('[Print] Print failed:', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          get().updatePrintJob(jobId, {
            status: 'failed',
            error: errorMessage,
            retryCount: job.retryCount + 1,
          });
        }
      },

      // Print next job in queue
      printNextInQueue: async () => {
        const pendingJobs = get().getPendingJobs();
        if (pendingJobs.length > 0) {
          await get().printJob(pendingJobs[0].id);
        }
      },

      // Retry failed job
      retryFailedJob: async (jobId) => {
        const job = get().printQueue.find((j) => j.id === jobId);
        if (!job || job.status !== 'failed') {
          console.error('[Print] Cannot retry job:', jobId);
          return;
        }

        if (job.retryCount >= 3) {
          console.error('[Print] Max retries exceeded for job:', jobId);
          return;
        }

        get().updatePrintJob(jobId, { status: 'pending', error: null });
        await get().printJob(jobId);
      },

      // Cancel job
      cancelJob: (jobId) => {
        get().updatePrintJob(jobId, { status: 'cancelled' });
        get().removePrintJob(jobId);
      },

      // Print KOT
      printKOT: async (orderId, orderNumber, content, station) => {
        const { printerConfig } = get();

        // If print by station is enabled, create separate jobs per station
        if (printerConfig.printByStation && !station) {
          // Group items by station
          const itemsByStation = content.items.reduce((acc, item) => {
            const itemStation = (item as any).station || 'main';
            if (!acc[itemStation]) {
              acc[itemStation] = [];
            }
            acc[itemStation].push(item);
            return acc;
          }, {} as Record<string, PrintItem[]>);

          // Create print job for each station
          for (const [stationName, items] of Object.entries(itemsByStation)) {
            const stationContent: PrintContent = {
              ...content,
              items,
            };

            get().addPrintJob({
              type: 'kot',
              orderId,
              orderNumber,
              station: stationName,
              content: stationContent,
            });
          }
        } else {
          // Single KOT for all items
          get().addPrintJob({
            type: 'kot',
            orderId,
            orderNumber,
            station,
            content,
          });
        }
      },

      // Update printer config
      updatePrinterConfig: (config) => {
        set((state) => ({
          printerConfig: {
            ...state.printerConfig,
            ...config,
          },
        }));
      },

      // Set auto-print
      setAutoPrint: (enabled) => {
        set((state) => ({
          printerConfig: {
            ...state.printerConfig,
            autoPrint: enabled,
          },
        }));
      },

      // Set print by station
      setPrintByStation: (enabled) => {
        set((state) => ({
          printerConfig: {
            ...state.printerConfig,
            printByStation: enabled,
          },
        }));
      },

      // Set station printer
      setStationPrinter: (station, printerName) => {
        set((state) => ({
          printerConfig: {
            ...state.printerConfig,
            stationPrinters: {
              ...state.printerConfig.stationPrinters,
              [station]: printerName,
            },
          },
        }));
      },

      // Get pending jobs
      getPendingJobs: () => {
        return get().printQueue.filter((job) => job.status === 'pending');
      },

      // Get failed jobs
      getFailedJobs: () => {
        return get().printQueue.filter((job) => job.status === 'failed');
      },

      // Get job by ID
      getJobById: (jobId) => {
        return get().printQueue.find((job) => job.id === jobId);
      },
    }),
    {
      name: 'print-store',
      // Only persist config, not queue or history
      partialize: (state) => ({
        printerConfig: state.printerConfig,
      }),
    }
  )
);

// Helper function to format print content as HTML
function formatPrintContent(job: PrintJob): string {
  const { content, type, orderNumber } = job;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Print - ${orderNumber}</title>
      <style>
        body {
          font-family: monospace;
          font-size: 12px;
          margin: 0;
          padding: 10px;
          width: 80mm;
        }
        .header {
          text-align: center;
          font-weight: bold;
          margin-bottom: 10px;
          border-bottom: 1px dashed #000;
          padding-bottom: 5px;
        }
        .section {
          margin: 10px 0;
        }
        .item {
          margin: 5px 0;
        }
        .item-name {
          font-weight: bold;
        }
        .item-details {
          font-size: 10px;
          margin-left: 10px;
        }
        .footer {
          margin-top: 10px;
          border-top: 1px dashed #000;
          padding-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>${type.toUpperCase()}</div>
        <div>Order #${content.header.orderNumber}</div>
        <div>${new Date(content.header.timestamp).toLocaleString()}</div>
        ${content.header.tableName ? `<div>Table: ${content.header.tableName}</div>` : ''}
        ${content.header.customerName ? `<div>Customer: ${content.header.customerName}</div>` : ''}
      </div>

      <div class="section">
  `;

  // Add items
  content.items.forEach((item) => {
    html += `
      <div class="item">
        <div class="item-name">${item.quantity}x ${item.name}</div>
    `;

    if (item.variants && item.variants.length > 0) {
      html += `<div class="item-details">Variants: ${item.variants.join(', ')}</div>`;
    }

    if (item.addons && item.addons.length > 0) {
      html += `<div class="item-details">Addons: ${item.addons.join(', ')}</div>`;
    }

    if (item.specialInstructions) {
      html += `<div class="item-details">Note: ${item.specialInstructions}</div>`;
    }

    html += `</div>`;
  });

  html += `</div>`;

  // Add footer
  if (content.footer) {
    html += `<div class="footer">`;

    if (content.footer.specialInstructions) {
      html += `<div>Special Instructions: ${content.footer.specialInstructions}</div>`;
    }

    if (content.footer.total) {
      html += `<div>Total: ₹${content.footer.total.toFixed(2)}</div>`;
    }

    html += `</div>`;
  }

  html += `
    </body>
    </html>
  `;

  return html;
}

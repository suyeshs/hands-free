/**
 * Offline Queue (Stub)
 * Queues failed sync operations for later retry
 */

export class OfflineQueue {
  private queue: Array<{ type: string; error: any; timestamp: number }> = [];

  constructor() {
    // Load queue from localStorage
    this.loadQueue();
  }

  /**
   * Add a failed sync operation to the queue
   */
  async addFailedSync(type: string, error: any): Promise<void> {
    const item = {
      type,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    };

    this.queue.push(item);
    this.saveQueue();

    console.log(`[OfflineQueue] Added failed sync: ${type}`);
  }

  /**
   * Get all queued items
   */
  getQueue(): Array<{ type: string; error: any; timestamp: number }> {
    return [...this.queue];
  }

  /**
   * Clear a specific item from the queue
   */
  clearItem(index: number): void {
    this.queue.splice(index, 1);
    this.saveQueue();
  }

  /**
   * Clear all items from the queue
   */
  clearAll(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem('offline-sync-queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem('offline-sync-queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }
}

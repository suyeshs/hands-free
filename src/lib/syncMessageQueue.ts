/**
 * Sync Message Queue
 *
 * Queues WebSocket messages when offline and flushes on reconnection.
 * Uses IndexedDB for persistence across browser restarts.
 */

interface QueuedMessage {
  id: string;
  type: string;
  payload: any;
  version?: number;
  timestamp: number;
  orderId?: string; // For dedup
}

const DB_NAME = 'handsfree-sync-queue';
const STORE_NAME = 'messages';
const DB_VERSION = 1;

class SyncMessageQueue {
  private db: IDBDatabase | null = null;
  private memoryQueue: QueuedMessage[] = []; // Fallback when IndexedDB not available
  private isIndexedDBAvailable = true;

  constructor() {
    this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      console.log('[SyncMessageQueue] IndexedDB not available, using memory queue');
      this.isIndexedDBAvailable = false;
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[SyncMessageQueue] Failed to open IndexedDB:', request.error);
        this.isIndexedDBAvailable = false;
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[SyncMessageQueue] IndexedDB initialized');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    } catch (error) {
      console.error('[SyncMessageQueue] IndexedDB init error:', error);
      this.isIndexedDBAvailable = false;
    }
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a message to the queue
   */
  async enqueue(type: string, payload: any, orderId?: string, version?: number): Promise<void> {
    const message: QueuedMessage = {
      id: this.generateId(),
      type,
      payload,
      version,
      timestamp: Date.now(),
      orderId,
    };

    console.log('[SyncMessageQueue] Enqueueing message:', type, orderId);

    if (this.isIndexedDBAvailable && this.db) {
      try {
        await this.addToIndexedDB(message);
      } catch (error) {
        console.error('[SyncMessageQueue] IndexedDB write failed, using memory:', error);
        this.memoryQueue.push(message);
      }
    } else {
      this.memoryQueue.push(message);
    }
  }

  private addToIndexedDB(message: QueuedMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all queued messages (FIFO order)
   */
  async getAll(): Promise<QueuedMessage[]> {
    if (this.isIndexedDBAvailable && this.db) {
      try {
        return await this.getAllFromIndexedDB();
      } catch (error) {
        console.error('[SyncMessageQueue] IndexedDB read failed:', error);
        return [...this.memoryQueue];
      }
    }
    return [...this.memoryQueue];
  }

  private getAllFromIndexedDB(): Promise<QueuedMessage[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove a message from the queue
   */
  async remove(messageId: string): Promise<void> {
    if (this.isIndexedDBAvailable && this.db) {
      try {
        await this.removeFromIndexedDB(messageId);
      } catch (error) {
        console.error('[SyncMessageQueue] IndexedDB delete failed:', error);
        this.memoryQueue = this.memoryQueue.filter((m) => m.id !== messageId);
      }
    } else {
      this.memoryQueue = this.memoryQueue.filter((m) => m.id !== messageId);
    }
  }

  private removeFromIndexedDB(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(messageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all messages from the queue
   */
  async clear(): Promise<void> {
    if (this.isIndexedDBAvailable && this.db) {
      try {
        await this.clearIndexedDB();
      } catch (error) {
        console.error('[SyncMessageQueue] IndexedDB clear failed:', error);
        this.memoryQueue = [];
      }
    } else {
      this.memoryQueue = [];
    }
    console.log('[SyncMessageQueue] Queue cleared');
  }

  private clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Dedup messages before flushing - keep only highest version per orderId
   */
  async dedupQueue(): Promise<QueuedMessage[]> {
    const messages = await this.getAll();

    // Group by orderId + type
    const dedupMap = new Map<string, QueuedMessage>();

    for (const msg of messages) {
      const key = msg.orderId ? `${msg.orderId}:${msg.type}` : msg.id;
      const existing = dedupMap.get(key);

      if (!existing) {
        dedupMap.set(key, msg);
      } else {
        // Keep higher version or newer timestamp
        const existingVersion = existing.version || 0;
        const msgVersion = msg.version || 0;

        if (msgVersion > existingVersion) {
          // Remove older message
          await this.remove(existing.id);
          dedupMap.set(key, msg);
        } else if (msgVersion === existingVersion && msg.timestamp > existing.timestamp) {
          await this.remove(existing.id);
          dedupMap.set(key, msg);
        } else {
          // Remove duplicate
          await this.remove(msg.id);
        }
      }
    }

    return Array.from(dedupMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    const messages = await this.getAll();
    return messages.length;
  }

  /**
   * Flush queue - returns deduped messages in FIFO order and clears the queue
   */
  async flush(): Promise<QueuedMessage[]> {
    const messages = await this.dedupQueue();
    console.log('[SyncMessageQueue] Flushing', messages.length, 'messages');
    await this.clear();
    return messages;
  }
}

export const syncMessageQueue = new SyncMessageQueue();

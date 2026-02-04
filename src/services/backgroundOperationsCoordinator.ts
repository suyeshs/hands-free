/**
 * Background Operations Coordinator
 * Manages pausing and resuming of background operations during critical database operations
 * Prevents concurrent access issues by coordinating all background services
 */

type OperationHandler = {
  pause: () => void | Promise<void>;
  resume: () => void | Promise<void>;
  name: string;
};

class BackgroundOperationsCoordinator {
  private operations: Map<string, OperationHandler> = new Map();
  private pauseCount: number = 0;
  private isPaused: boolean = false;

  /**
   * Register a background operation that can be paused/resumed
   */
  register(id: string, handler: OperationHandler): void {
    if (this.operations.has(id)) {
      console.warn(`[BackgroundCoordinator] Operation ${id} already registered, replacing`);
    }
    this.operations.set(id, handler);
    console.log(`[BackgroundCoordinator] Registered operation: ${handler.name} (${id})`);

    // If currently paused, pause the newly registered operation immediately
    if (this.isPaused) {
      handler.pause();
    }
  }

  /**
   * Unregister a background operation
   */
  unregister(id: string): void {
    if (this.operations.delete(id)) {
      console.log(`[BackgroundCoordinator] Unregistered operation: ${id}`);
    }
  }

  /**
   * Pause all background operations
   * Uses reference counting to support nested pauses
   */
  async pauseAll(): Promise<void> {
    this.pauseCount++;

    if (this.isPaused) {
      console.log(`[BackgroundCoordinator] Already paused (count: ${this.pauseCount})`);
      return;
    }

    this.isPaused = true;
    console.log(`[BackgroundCoordinator] Pausing ${this.operations.size} background operations...`);

    const pausePromises: Promise<void>[] = [];
    for (const [id, handler] of this.operations.entries()) {
      try {
        const result = handler.pause();
        if (result instanceof Promise) {
          pausePromises.push(result);
        }
        console.log(`[BackgroundCoordinator] Paused: ${handler.name} (${id})`);
      } catch (error) {
        console.error(`[BackgroundCoordinator] Failed to pause ${handler.name}:`, error);
      }
    }

    // Wait for all async pause operations to complete
    await Promise.all(pausePromises);
    console.log(`[BackgroundCoordinator] All operations paused`);
  }

  /**
   * Resume all background operations
   * Uses reference counting - only resumes when count reaches 0
   */
  async resumeAll(): Promise<void> {
    if (this.pauseCount > 0) {
      this.pauseCount--;
    }

    if (this.pauseCount > 0) {
      console.log(`[BackgroundCoordinator] Still paused (count: ${this.pauseCount})`);
      return;
    }

    if (!this.isPaused) {
      console.log(`[BackgroundCoordinator] Not paused, nothing to resume`);
      return;
    }

    this.isPaused = false;
    console.log(`[BackgroundCoordinator] Resuming ${this.operations.size} background operations...`);

    const resumePromises: Promise<void>[] = [];
    for (const [id, handler] of this.operations.entries()) {
      try {
        const result = handler.resume();
        if (result instanceof Promise) {
          resumePromises.push(result);
        }
        console.log(`[BackgroundCoordinator] Resumed: ${handler.name} (${id})`);
      } catch (error) {
        console.error(`[BackgroundCoordinator] Failed to resume ${handler.name}:`, error);
      }
    }

    // Wait for all async resume operations to complete
    await Promise.all(resumePromises);
    console.log(`[BackgroundCoordinator] All operations resumed`);
  }

  /**
   * Execute a critical operation with all background operations paused
   * Automatically resumes operations after completion (even if operation fails)
   */
  async withPausedOperations<T>(
    operation: () => Promise<T>,
    operationName: string = 'Critical Operation'
  ): Promise<T> {
    console.log(`[BackgroundCoordinator] Starting critical operation: ${operationName}`);

    await this.pauseAll();

    try {
      const result = await operation();
      console.log(`[BackgroundCoordinator] Critical operation completed: ${operationName}`);
      return result;
    } catch (error) {
      console.error(`[BackgroundCoordinator] Critical operation failed: ${operationName}`, error);
      throw error;
    } finally {
      await this.resumeAll();
    }
  }

  /**
   * Get current pause status
   */
  getStatus(): { isPaused: boolean; pauseCount: number; operationsCount: number } {
    return {
      isPaused: this.isPaused,
      pauseCount: this.pauseCount,
      operationsCount: this.operations.size,
    };
  }

  /**
   * List all registered operations
   */
  listOperations(): Array<{ id: string; name: string }> {
    return Array.from(this.operations.entries()).map(([id, handler]) => ({
      id,
      name: handler.name,
    }));
  }
}

// Singleton instance
export const backgroundCoordinator = new BackgroundOperationsCoordinator();

// Export convenience function for critical operations
export async function executeCriticalOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Critical Operation'
): Promise<T> {
  return backgroundCoordinator.withPausedOperations(operation, operationName);
}

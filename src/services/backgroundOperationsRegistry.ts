/**
 * Background Operations Registry
 * Provides utilities and patterns for registering background operations with the coordinator
 */

import { backgroundCoordinator } from './backgroundOperationsCoordinator';

/**
 * Helper to register an interval-based operation
 * Automatically handles pausing by clearing interval and resuming by recreating it
 */
export function registerIntervalOperation(
  id: string,
  name: string,
  intervalCallback: () => void | Promise<void>,
  intervalMs: number
): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  let isPaused = false;

  const start = () => {
    if (!isPaused && !intervalId) {
      intervalId = setInterval(intervalCallback, intervalMs);
      console.log(`[${name}] Started interval (${intervalMs}ms)`);
    }
  };

  const pause = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      isPaused = true;
      console.log(`[${name}] Paused interval`);
    }
  };

  const resume = () => {
    isPaused = false;
    start();
    console.log(`[${name}] Resumed interval`);
  };

  // Register with coordinator
  backgroundCoordinator.register(id, { pause, resume, name });

  // Start the interval
  start();

  // Return cleanup function
  return () => {
    pause();
    backgroundCoordinator.unregister(id);
  };
}

/**
 * Helper to register a WebSocket-based operation
 * Provides pause/resume by disconnecting/reconnecting the WebSocket
 */
export function registerWebSocketOperation(
  id: string,
  name: string,
  getWebSocket: () => WebSocket | null,
  reconnect: () => void
): () => void {
  let wasPausedByCoordinator = false;

  const pause = () => {
    const ws = getWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      wasPausedByCoordinator = true;
      console.log(`[${name}] Closed WebSocket`);
    }
  };

  const resume = () => {
    if (wasPausedByCoordinator) {
      reconnect();
      wasPausedByCoordinator = false;
      console.log(`[${name}] Reconnecting WebSocket`);
    }
  };

  backgroundCoordinator.register(id, { pause, resume, name });

  return () => {
    backgroundCoordinator.unregister(id);
  };
}

/**
 * Helper to register a generic async operation with custom pause/resume logic
 */
export function registerAsyncOperation(
  id: string,
  name: string,
  pauseCallback: () => void | Promise<void>,
  resumeCallback: () => void | Promise<void>
): () => void {
  backgroundCoordinator.register(id, {
    pause: pauseCallback,
    resume: resumeCallback,
    name,
  });

  return () => {
    backgroundCoordinator.unregister(id);
  };
}

/**
 * React hook to register an operation during component lifecycle
 * Automatically unregisters on unmount
 */
export function useBackgroundOperation(
  id: string,
  name: string,
  _pauseCallback: () => void | Promise<void>,
  _resumeCallback: () => void | Promise<void>,
  dependencies: any[] = []
): void {
  // This is just a blueprint - actual React implementation would use useEffect
  // Users can copy this pattern into their React hooks
  console.log('Use this pattern in React components with useEffect');
  console.log('Example:', { id, name, dependencies });
}

// Export coordinator for direct access if needed
export { backgroundCoordinator };

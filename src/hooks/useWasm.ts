/**
 * useWasm Hook
 *
 * React hook for loading and using WASM plugins in components
 *
 * @example
 * ```tsx
 * function BarDashboard() {
 *   const { instance, loading, error, invoke } = useWasm('bar-management');
 *
 *   const calculatePrice = async (ingredients: Ingredient[]) => {
 *     if (!instance) return;
 *     const result = await invoke('calculate_drink_price', JSON.stringify(ingredients));
 *     return JSON.parse(result as string);
 *   };
 *
 *   if (loading) return <div>Loading plugin...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>Plugin loaded!</div>;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPluginManager } from '@/services/plugins/pluginManager';
import { useAuthStore } from '@/stores/authStore';
import type { PluginLoadingState } from '@/types/plugin';

export interface UseWasmOptions {
  /**
   * Auto-load the plugin on mount
   * Default: true
   */
  autoLoad?: boolean;

  /**
   * Preload the plugin in the background
   * Default: false
   */
  preload?: boolean;

  /**
   * Retry loading on failure
   * Default: 0 (no retry)
   */
  retries?: number;

  /**
   * Callback when plugin loads successfully
   */
  onLoad?: (instance: WebAssembly.Instance) => void;

  /**
   * Callback when plugin loading fails
   */
  onError?: (error: Error) => void;
}

export interface UseWasmReturn {
  /**
   * WASM instance (null if not loaded)
   */
  instance: WebAssembly.Instance | null;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Error if loading failed
   */
  error: Error | null;

  /**
   * Current loading state
   */
  state: PluginLoadingState;

  /**
   * Manually load the plugin
   */
  load: () => Promise<void>;

  /**
   * Reload the plugin
   */
  reload: () => Promise<void>;

  /**
   * Unload the plugin from memory
   */
  unload: () => void;

  /**
   * Invoke a WASM function exported by the plugin
   */
  invoke: <T = unknown>(functionName: string, ...args: unknown[]) => Promise<T>;

  /**
   * Check if a function exists in the plugin
   */
  hasFunction: (functionName: string) => boolean;
}

/**
 * Hook for loading and using WASM plugins
 */
export function useWasm(
  pluginId: string,
  options: UseWasmOptions = {}
): UseWasmReturn {
  const {
    autoLoad = true,
    preload = false,
    retries = 0,
    onLoad,
    onError,
  } = options;

  const [instance, setInstance] = useState<WebAssembly.Instance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<PluginLoadingState>('idle');

  const tenantId = useAuthStore(state => state.tenantId) || 'default';
  const pluginManager = getPluginManager(tenantId);

  const retryCount = useRef(0);
  const mounted = useRef(true);

  /**
   * Load the plugin
   */
  const load = useCallback(async () => {
    if (!mounted.current) return;

    setLoading(true);
    setError(null);
    setState('loading');

    try {
      const wasmInstance = await pluginManager.loadWasm(pluginId);

      if (!mounted.current) return;

      setInstance(wasmInstance);
      setState('loaded');
      setLoading(false);
      retryCount.current = 0;

      onLoad?.(wasmInstance);
    } catch (err) {
      if (!mounted.current) return;

      const error = err as Error;
      console.error(`Failed to load plugin ${pluginId}:`, error);

      // Retry if configured
      if (retryCount.current < retries) {
        retryCount.current++;
        console.log(`Retrying plugin load (${retryCount.current}/${retries})...`);
        setTimeout(() => load(), 1000 * retryCount.current);
        return;
      }

      setError(error);
      setState('error');
      setLoading(false);

      onError?.(error);
    }
  }, [pluginId, pluginManager, retries, onLoad, onError]);

  /**
   * Reload the plugin
   */
  const reload = useCallback(async () => {
    if (!mounted.current) return;

    setInstance(null);
    setState('idle');
    await pluginManager.reload(pluginId);
    await load();
  }, [pluginId, pluginManager, load]);

  /**
   * Unload the plugin
   */
  const unload = useCallback(() => {
    setInstance(null);
    setState('idle');
    setError(null);
  }, []);

  /**
   * Invoke a WASM function
   */
  const invoke = useCallback(
    async <T = unknown>(functionName: string, ...args: unknown[]): Promise<T> => {
      if (!instance) {
        throw new Error(`Plugin ${pluginId} not loaded`);
      }

      const fn = instance.exports[functionName];

      if (typeof fn !== 'function') {
        throw new Error(`Function ${functionName} not found in plugin ${pluginId}`);
      }

      try {
        const result = await (fn as CallableFunction)(...args);
        return result as T;
      } catch (err) {
        const error = err as Error;
        console.error(`Error invoking ${functionName}:`, error);
        throw error;
      }
    },
    [instance, pluginId]
  );

  /**
   * Check if a function exists
   */
  const hasFunction = useCallback(
    (functionName: string): boolean => {
      if (!instance) return false;
      return typeof instance.exports[functionName] === 'function';
    },
    [instance]
  );

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    if (autoLoad) {
      load();
    } else if (preload) {
      pluginManager.preloadWasm([pluginId]).catch(err => {
        console.warn(`Failed to preload plugin ${pluginId}:`, err);
      });
    }

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId, autoLoad, preload]);

  return {
    instance,
    loading,
    error,
    state,
    load,
    reload,
    unload,
    invoke,
    hasFunction,
  };
}

/**
 * Hook for using multiple WASM plugins
 */
export function useWasmPlugins(pluginIds: string[], options: UseWasmOptions = {}) {
  const plugins = pluginIds.map(id => useWasm(id, options));

  return {
    plugins,
    allLoaded: plugins.every(p => p.state === 'loaded'),
    anyLoading: plugins.some(p => p.loading),
    errors: plugins.map(p => p.error).filter(Boolean) as Error[],
  };
}

/**
 * Hook for lazy-loading a WASM plugin
 * Doesn't load until explicitly called
 */
export function useLazyWasm(pluginId: string, options: Omit<UseWasmOptions, 'autoLoad'> = {}) {
  return useWasm(pluginId, { ...options, autoLoad: false });
}

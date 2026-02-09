/**
 * Centralized logging utility with configurable levels
 * Reduces noise in production while keeping essential logs
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
  level: LogLevel;
  enabledModules: Set<string>;
}

class Logger {
  private config: LoggerConfig = {
    level: import.meta.env.DEV ? 'info' : 'warn', // Less verbose in dev
    enabledModules: new Set([
      // Only enable critical modules by default
      'Setup',
      'Migration',
      'Plugin',
      'Database',
      'Error',
    ]),
  };

  private shouldLog(level: LogLevel, module?: string): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const requestedLevelIndex = levels.indexOf(level);

    if (requestedLevelIndex < currentLevelIndex) {
      return false;
    }

    if (module && !this.config.enabledModules.has(module)) {
      return false;
    }

    return true;
  }

  setLevel(level: LogLevel) {
    this.config.level = level;
  }

  enableModule(module: string) {
    this.config.enabledModules.add(module);
  }

  disableModule(module: string) {
    this.config.enabledModules.delete(module);
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(message, ...args);
    }
  }

  info(module: string, message: string, ...args: any[]) {
    if (this.shouldLog('info', module)) {
      console.log(`[${module}] ${message}`, ...args);
    }
  }

  warn(module: string, message: string, ...args: any[]) {
    if (this.shouldLog('warn', module)) {
      console.warn(`[${module}] ${message}`, ...args);
    }
  }

  error(module: string, message: string, ...args: any[]) {
    if (this.shouldLog('error', module)) {
      console.error(`[${module}] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

// Expose to window for runtime control
if (typeof window !== 'undefined') {
  (window as any).logger = logger;
  (window as any).enableDebugLogs = () => {
    logger.setLevel('debug');
    console.log('✅ Debug logging enabled. Run logger.enableModule("ModuleName") for specific modules.');
  };
  (window as any).disableDebugLogs = () => {
    logger.setLevel('warn');
    console.log('✅ Debug logging disabled.');
  };
}

/**
 * File-based logger for debugging when dev console is inaccessible
 * Writes logs to a file that can be read after the app unfreezes
 */

// import { invoke } from '@tauri-apps/api/core';
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

class FileLogger {
  private logs: string[] = [];
  private logFile = 'setup-debug.log';

  async log(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;

    this.logs.push(logEntry);
    console.log(logEntry); // Still log to console if accessible

    // Write to file asynchronously (don't await to avoid blocking)
    this.writeToFile(logEntry).catch(err => {
      console.error('Failed to write to log file:', err);
    });
  }

  private async writeToFile(_entry: string) {
    try {
      // Append to file
      const allLogs = this.logs.join('\n') + '\n';
      await writeTextFile(this.logFile, allLogs, {
        baseDir: BaseDirectory.AppLocalData
      });
    } catch (error) {
      console.error('File logging error:', error);
    }
  }

  async getLogs(): Promise<string> {
    return this.logs.join('\n');
  }

  async clear() {
    this.logs = [];
    try {
      await writeTextFile(this.logFile, '', {
        baseDir: BaseDirectory.AppLocalData
      });
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }
}

export const fileLogger = new FileLogger();

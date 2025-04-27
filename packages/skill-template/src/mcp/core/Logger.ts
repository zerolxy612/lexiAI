/**
 * Simple logger implementation compatible with the Logger interface
 */
export namespace Logger {
  function logPrefix(level: string): string {
    return `[${level.toUpperCase()}]`;
  }

  /**
   * Log an informational message
   */
  export function info(message: any, ...args: any[]): void {
    console.log(logPrefix('info'), message, ...args);
  }

  /**
   * Log an error message
   */
  export function error(message: any, ...args: any[]): void {
    console.error(logPrefix('error'), message, ...args);
  }

  /**
   * Log a warning message
   */
  export function warn(message: any, ...args: any[]): void {
    console.warn(logPrefix('warn'), message, ...args);
  }

  /**
   * Log a debug message
   */
  export function debug(message: any, ...args: any[]): void {
    console.debug(logPrefix('debug'), message, ...args);
  }

  /**
   * Log a regular message (alias for info)
   */
  export function log(message: any, ...args: any[]): void {
    info(message, ...args);
  }
}

import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

interface LogEntry {
  level: string;
  message: string;
  context?: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  schoolId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: string;
  [key: string]: unknown;
}

/**
 * AppLoggerService — Structured JSON logger cho NBK_EMS.
 *
 * Production: log JSON format cho ELK/CloudWatch/Datadog.
 * Development: log readable format.
 *
 * Implement NestJS LoggerService interface nên có thể inject global:
 *   app.useLogger(app.get(AppLoggerService))
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly isProduction = process.env['NODE_ENV'] === 'production';

  log(message: string, context?: string): void;
  log(message: unknown, context?: string): void;
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeLog('log', message, optionalParams);
  }

  error(message: string, trace?: string, context?: string): void;
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.writeLog('error', message, optionalParams);
  }

  warn(message: string, context?: string): void;
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeLog('warn', message, optionalParams);
  }

  debug(message: string, context?: string): void;
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeLog('debug', message, optionalParams);
  }

  verbose(message: string, context?: string): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeLog('verbose', message, optionalParams);
  }

  fatal(message: string, context?: string): void;
  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.writeLog('fatal', message, optionalParams);
  }

  setLogLevels(_levels: LogLevel[]): void {
    // No-op — can extend with configurable log levels
  }

  private writeLog(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const timestamp = new Date().toISOString();
    const context =
      optionalParams.length > 0 &&
      typeof optionalParams[optionalParams.length - 1] === 'string'
        ? (optionalParams[optionalParams.length - 1] as string)
        : undefined;

    if (this.isProduction) {
      const entry: LogEntry = {
        level,
        timestamp,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        context,
      };

      // If message is an object with structured fields, merge them
      if (message && typeof message === 'object' && !Array.isArray(message)) {
        Object.assign(entry, message);
      }

      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      // Development: readable format
      const prefix = context ? `[${context}]` : '';
      const formattedMessage =
        typeof message === 'object'
          ? JSON.stringify(message, null, 2)
          : String(message);
      const color = this.getColor(level);
      console.log(
        `${color}[${level.toUpperCase()}]${prefix} ${timestamp} — ${formattedMessage}\x1b[0m`,
      );
    }
  }

  private getColor(level: string): string {
    switch (level) {
      case 'error':
      case 'fatal':
        return '\x1b[31m'; // red
      case 'warn':
        return '\x1b[33m'; // yellow
      case 'debug':
      case 'verbose':
        return '\x1b[36m'; // cyan
      default:
        return '\x1b[32m'; // green
    }
  }
}

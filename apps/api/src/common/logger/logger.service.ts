import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger as PinoLoggerInstance } from 'pino';

export const REDACTED_PATHS = [
  'password',
  '*.password',
  'password_hash',
  '*.password_hash',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'secret',
  '*.secret',
  'pin',
  '*.pin',
  'authorization',
  '*.authorization',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly logger: PinoLoggerInstance;

  constructor() {
    const isDev = process.env.NODE_ENV !== 'production';

    this.logger = pino({
      level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
      redact: {
        paths: REDACTED_PATHS,
        censor: '[REDACTED]',
      },
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.callLogger('info', message, optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.callLogger('error', message, optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.callLogger('warn', message, optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.callLogger('debug', message, optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.callLogger('trace', message, optionalParams);
  }

  private callLogger(
    level: 'info' | 'error' | 'warn' | 'debug' | 'trace',
    message: string,
    optionalParams: unknown[],
  ): void {
    if (optionalParams.length > 0) {
      const context =
        typeof optionalParams[optionalParams.length - 1] === 'string'
          ? optionalParams[optionalParams.length - 1]
          : undefined;

      const metadata = optionalParams.slice(0, context ? -1 : undefined);
      this.logger[level]({ context, metadata }, message);
    } else {
      this.logger[level](message);
    }
  }

  /**
   * Directly get the underlying Pino instance.
   */
  getPinoInstance(): PinoLoggerInstance {
    return this.logger;
  }
}

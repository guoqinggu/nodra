/**
 * Nodra Framework - Logger
 *
 * Structured JSON logger built on pino.
 * Supports child loggers for request-scoped context.
 */

import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import type { LoggingConfig } from '../core/config.js';

export type Logger = pino.Logger;

interface WritableStream {
  write(chunk: string): void;
}

export function createLogger(config: LoggingConfig, destination?: WritableStream): Logger {
  const options: LoggerOptions = {
    level: config.level,
  };

  if (config.format === 'pretty') {
    options.transport = destination
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true },
        };
  }

  if (destination) {
    return pino(options, destination as DestinationStream);
  }

  return pino(options);
}

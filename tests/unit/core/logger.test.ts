import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '../../../src/utils/logger.js';
import type { LogLevel } from '../../../src/core/config.js';

describe('Logger', () => {
  describe('createLogger()', () => {
    it('should create a logger instance', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      expect(logger).toBeDefined();
      expect(logger.info).toBeTypeOf('function');
      expect(logger.error).toBeTypeOf('function');
      expect(logger.warn).toBeTypeOf('function');
      expect(logger.debug).toBeTypeOf('function');
    });

    it('should respect the configured log level', () => {
      const logger = createLogger({ level: 'error', format: 'json' });
      expect(logger.level).toBe('error');
    });

    it('should support all log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
      for (const level of levels) {
        const logger = createLogger({ level, format: 'json' });
        expect(logger.level).toBe(level);
      }
    });

    it('should create child logger with context', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      const child = logger.child({ requestId: 'req-123', doctype: 'Todo' });
      expect(child).toBeDefined();
      expect(child.info).toBeTypeOf('function');
    });
  });

  describe('log output', () => {
    it('should include message in log output', () => {
      const chunks: string[] = [];
      const logger = createLogger(
        { level: 'info', format: 'json' },
        {
          write(chunk: string) {
            chunks.push(chunk);
          },
        },
      );

      logger.info('test message');

      expect(chunks).toHaveLength(1);
      const parsed = JSON.parse(chunks[0]!) as Record<string, unknown>;
      expect(parsed['msg']).toBe('test message');
      expect(parsed['level']).toBeDefined();
    });

    it('should include extra context in log output', () => {
      const chunks: string[] = [];
      const logger = createLogger(
        { level: 'info', format: 'json' },
        {
          write(chunk: string) {
            chunks.push(chunk);
          },
        },
      );

      logger.info({ doctype: 'Todo', action: 'save' }, 'document saved');

      const parsed = JSON.parse(chunks[0]!) as Record<string, unknown>;
      expect(parsed['msg']).toBe('document saved');
      expect(parsed['doctype']).toBe('Todo');
      expect(parsed['action']).toBe('save');
    });

    it('should include child context in log output', () => {
      const chunks: string[] = [];
      const logger = createLogger(
        { level: 'info', format: 'json' },
        {
          write(chunk: string) {
            chunks.push(chunk);
          },
        },
      );

      const child = logger.child({ requestId: 'req-abc' });
      child.info('request started');

      const parsed = JSON.parse(chunks[0]!) as Record<string, unknown>;
      expect(parsed['msg']).toBe('request started');
      expect(parsed['requestId']).toBe('req-abc');
    });

    it('should not output debug logs when level is info', () => {
      const chunks: string[] = [];
      const logger = createLogger(
        { level: 'info', format: 'json' },
        {
          write(chunk: string) {
            chunks.push(chunk);
          },
        },
      );

      logger.debug('this should be suppressed');
      expect(chunks).toHaveLength(0);
    });
  });
});

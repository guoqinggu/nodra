import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, getDefaults, validateConfig } from '../../../src/core/config.js';
import type { NodraConfig } from '../../../src/core/config.js';

describe('Configuration System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDefaults()', () => {
    it('should return default configuration', () => {
      const defaults = getDefaults();
      expect(defaults.db.host).toBe('localhost');
      expect(defaults.db.port).toBe(5432);
      expect(defaults.db.pool.min).toBe(2);
      expect(defaults.db.pool.max).toBe(10);
      expect(defaults.server.host).toBe('0.0.0.0');
      expect(defaults.server.port).toBe(8000);
      expect(defaults.auth.tokenExpiry).toBe('24h');
      expect(defaults.logging.level).toBe('info');
      expect(defaults.logging.format).toBe('json');
    });
  });

  describe('loadConfig()', () => {
    it('should return defaults when no overrides provided', () => {
      const config = loadConfig({});
      expect(config.db.host).toBe('localhost');
      expect(config.server.port).toBe(8000);
    });

    it('should merge partial overrides with defaults', () => {
      const config = loadConfig({
        db: { host: 'db.example.com', port: 5433 },
      });
      expect(config.db.host).toBe('db.example.com');
      expect(config.db.port).toBe(5433);
      // defaults preserved
      expect(config.db.pool.min).toBe(2);
      expect(config.server.port).toBe(8000);
    });

    it('should deep merge nested pool config', () => {
      const config = loadConfig({
        db: { pool: { max: 20 } },
      });
      expect(config.db.pool.max).toBe(20);
      expect(config.db.pool.min).toBe(2); // default preserved
    });

    it('should override from environment variables', () => {
      process.env['NODRA_DB_HOST'] = 'envhost';
      process.env['NODRA_DB_PORT'] = '5555';
      process.env['NODRA_SERVER_PORT'] = '3000';
      process.env['NODRA_LOGGING_LEVEL'] = 'debug';

      const config = loadConfig({});
      expect(config.db.host).toBe('envhost');
      expect(config.db.port).toBe(5555);
      expect(config.server.port).toBe(3000);
      expect(config.logging.level).toBe('debug');
    });

    it('should prioritize env vars over file config', () => {
      process.env['NODRA_DB_HOST'] = 'from-env';
      const config = loadConfig({ db: { host: 'from-file' } });
      expect(config.db.host).toBe('from-env');
    });

    it('should handle NODRA_DB_PASSWORD from env', () => {
      process.env['NODRA_DB_PASSWORD'] = 'secret123';
      const config = loadConfig({});
      expect(config.db.password).toBe('secret123');
    });
  });

  describe('validateConfig()', () => {
    it('should pass for valid config', () => {
      const config = loadConfig({ db: { database: 'testdb', user: 'testuser' } });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw if db.database is empty', () => {
      const config = loadConfig({});
      config.db.database = '';
      expect(() => validateConfig(config)).toThrow('db.database');
    });

    it('should throw if db.port is out of range', () => {
      const config = loadConfig({});
      config.db.database = 'test';
      config.db.port = 99999;
      expect(() => validateConfig(config)).toThrow('db.port');
    });

    it('should throw if server.port is out of range', () => {
      const config = loadConfig({});
      config.db.database = 'test';
      config.server.port = -1;
      expect(() => validateConfig(config)).toThrow('server.port');
    });

    it('should throw if logging.level is invalid', () => {
      const config = loadConfig({});
      config.db.database = 'test';
      (config.logging.level as string) = 'verbose';
      expect(() => validateConfig(config)).toThrow('logging.level');
    });

    it('should throw if db.pool.min > db.pool.max', () => {
      const config = loadConfig({ db: { database: 'test', pool: { min: 20, max: 5 } } });
      expect(() => validateConfig(config)).toThrow('pool');
    });
  });

  describe('NodraConfig type', () => {
    it('should have all required sections', () => {
      const config = loadConfig({});
      expect(config).toHaveProperty('db');
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('auth');
      expect(config).toHaveProperty('logging');
      expect(config).toHaveProperty('jobs');
      expect(config).toHaveProperty('installedApps');
    });
  });
});

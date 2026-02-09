/**
 * Nodra Framework - Configuration System
 *
 * Loads configuration from defaults, file overrides, and environment variables.
 * Priority: env vars > file config > defaults.
 */

import { ValidationError } from './errors.js';

// --- Types ---

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
}

export interface ServerConfig {
  host: string;
  port: number;
}

export interface AuthConfig {
  secret: string;
  tokenExpiry: string;
  passwordHashRounds: number;
}

export interface JobsConfig {
  concurrency: number;
  retryLimit: number;
  retryDelay: number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'pretty';

export interface LoggingConfig {
  level: LogLevel;
  format: LogFormat;
}

export interface NodraConfig {
  db: DatabaseConfig;
  server: ServerConfig;
  auth: AuthConfig;
  jobs: JobsConfig;
  logging: LoggingConfig;
  installedApps: string[];
}

// --- Deep partial type for overrides ---

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type NodraConfigOverride = DeepPartial<NodraConfig>;

// --- Defaults ---

export function getDefaults(): NodraConfig {
  return {
    db: {
      host: 'localhost',
      port: 5432,
      database: '',
      user: 'postgres',
      password: '',
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
      },
    },
    server: {
      host: '0.0.0.0',
      port: 8000,
    },
    auth: {
      secret: '',
      tokenExpiry: '24h',
      passwordHashRounds: 12,
    },
    jobs: {
      concurrency: 5,
      retryLimit: 3,
      retryDelay: 60000,
    },
    logging: {
      level: 'info',
      format: 'json',
    },
    installedApps: ['nodra'],
  };
}

// --- Deep merge utility ---

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  const src = source as Record<string, unknown>;

  for (const key of Object.keys(src)) {
    const sourceVal = src[key];
    const targetVal = result[key];

    if (
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, sourceVal as DeepPartial<typeof targetVal>);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result as T;
}

// --- Environment variable loading ---

const ENV_MAP: Record<string, (config: NodraConfig, value: string) => void> = {
  NODRA_DB_HOST: (c, v) => { c.db.host = v; },
  NODRA_DB_PORT: (c, v) => { c.db.port = parseInt(v, 10); },
  NODRA_DB_DATABASE: (c, v) => { c.db.database = v; },
  NODRA_DB_USER: (c, v) => { c.db.user = v; },
  NODRA_DB_PASSWORD: (c, v) => { c.db.password = v; },
  NODRA_DB_POOL_MIN: (c, v) => { c.db.pool.min = parseInt(v, 10); },
  NODRA_DB_POOL_MAX: (c, v) => { c.db.pool.max = parseInt(v, 10); },
  NODRA_SERVER_HOST: (c, v) => { c.server.host = v; },
  NODRA_SERVER_PORT: (c, v) => { c.server.port = parseInt(v, 10); },
  NODRA_AUTH_SECRET: (c, v) => { c.auth.secret = v; },
  NODRA_AUTH_TOKEN_EXPIRY: (c, v) => { c.auth.tokenExpiry = v; },
  NODRA_LOGGING_LEVEL: (c, v) => { c.logging.level = v as LogLevel; },
  NODRA_LOGGING_FORMAT: (c, v) => { c.logging.format = v as LogFormat; },
};

function applyEnvOverrides(config: NodraConfig): void {
  for (const [envKey, setter] of Object.entries(ENV_MAP)) {
    const value = process.env[envKey];
    if (value !== undefined && value !== '') {
      setter(config, value);
    }
  }
}

// --- Public API ---

export function loadConfig(overrides: NodraConfigOverride): NodraConfig {
  const defaults = getDefaults();
  const config = deepMerge(defaults, overrides as DeepPartial<typeof defaults>);
  applyEnvOverrides(config);
  return config;
}

const VALID_LOG_LEVELS = new Set<string>(['debug', 'info', 'warn', 'error']);

export function validateConfig(config: NodraConfig): void {
  const errors: string[] = [];

  if (!config.db.database) {
    errors.push('db.database is required');
  }
  if (config.db.port < 1 || config.db.port > 65535) {
    errors.push('db.port must be between 1 and 65535');
  }
  if (config.server.port < 0 || config.server.port > 65535) {
    errors.push('server.port must be between 0 and 65535');
  }
  if (!VALID_LOG_LEVELS.has(config.logging.level)) {
    errors.push(`logging.level must be one of: ${[...VALID_LOG_LEVELS].join(', ')}`);
  }
  if (config.db.pool.min > config.db.pool.max) {
    errors.push('db.pool.min cannot be greater than db.pool.max');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid configuration: ${errors.join('; ')}`, {
      details: errors.map((msg) => ({ field: msg.split(' ')[0] ?? 'config', message: msg })),
    });
  }
}

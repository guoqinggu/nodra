/**
 * Nodra Framework - Application Class
 *
 * The main application singleton that ties together the database,
 * DocType registry, ORM, API server, and logger.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { NodraConfig } from './core/config.js';
import { Database } from './database/connection.js';
import { DocTypeRegistry } from './core/doctype/registry.js';
import { ORM, type ListOptions } from './orm/crud.js';
import { createLogger, type Logger } from './utils/logger.js';
import type { Document } from './core/document/document.js';
import { errorHandlerPlugin } from './api/error-handler.js';
import { resourceRoutes } from './api/resource.js';
import { authRoutes } from './api/auth.js';

/**
 * Main Nodra application class.
 *
 * Wires together all framework subsystems and provides convenience
 * methods that delegate to the ORM layer.
 */
export class Nodra {
  readonly config: NodraConfig;
  readonly db: Database;
  readonly registry: DocTypeRegistry;
  readonly orm: ORM;
  readonly logger: Logger;

  private server: FastifyInstance | null = null;

  constructor(config: NodraConfig) {
    this.config = config;
    this.db = new Database(config.db);
    this.registry = new DocTypeRegistry();
    this.orm = new ORM(this.db, this.registry);
    this.logger = createLogger(config.logging);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Boot the application:
   * 1. Connect to database
   * 2. Create Fastify server and register plugins/routes
   */
  async boot(): Promise<void> {
    // 1. Connect to database
    await this.db.connect();
    this.logger.info('Database connected');

    // 2. Create Fastify server with plugins and routes
    this.server = Fastify({ logger: false });
    errorHandlerPlugin(this.server);

    // Register Swagger UI
    await this.server.register(swagger, {
      openapi: {
        info: {
          title: 'Nodra API',
          description: 'Metadata-driven web framework API',
          version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${this.config.server.port}` }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await this.server.register(swaggerUi, {
      routePrefix: '/api/docs/ui',
    });

    resourceRoutes(this.server, this.orm, this.registry, this.db);
    
    // Register auth routes
    authRoutes(this.server, this.orm, this.registry, {
      secret: this.config.auth.secret,
      expiresIn: this.config.auth.tokenExpiry,
    });

    // Start listening
    const { host, port } = this.config.server;
    await this.server.listen({ host, port });
    this.logger.info(`Server listening on ${host}:${port}`);
  }

  /**
   * Gracefully shut down the application:
   * 1. Close Fastify server
   * 2. Disconnect database
   */
  async shutdown(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    await this.db.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Convenience methods (delegate to ORM)
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single document by doctype and name.
   */
  async getDoc(doctype: string, name: string): Promise<Document> {
    return this.orm.getDoc(doctype, name);
  }

  /**
   * Fetch a list of documents with optional filters, fields, ordering, and pagination.
   */
  async getList(doctype: string, options?: ListOptions): Promise<Document[]> {
    return this.orm.getList(doctype, options);
  }

  /**
   * Get the count of documents matching optional filters.
   */
  async getCount(doctype: string, filters?: Record<string, unknown>): Promise<number> {
    return this.orm.getCount(doctype, filters);
  }

  /**
   * Get a single field value from a document.
   */
  async getValue(doctype: string, name: string, field: string): Promise<unknown> {
    return this.orm.getValue(doctype, name, field);
  }

  /**
   * Set a single field value for a document.
   */
  async setValue(doctype: string, name: string, field: string, value: unknown): Promise<void> {
    return this.orm.setValue(doctype, name, field, value);
  }

  /**
   * Delete a document.
   */
  async deleteDoc(doctype: string, name: string): Promise<void> {
    return this.orm.deleteDoc(doctype, name);
  }

  /**
   * Check whether a document exists.
   */
  async exists(doctype: string, name: string): Promise<boolean> {
    return this.orm.exists(doctype, name);
  }
}

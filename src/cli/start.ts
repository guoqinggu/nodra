/**
 * start command - Start development server
 */

import type { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import type { Command, StartOptions } from './types.js';
import { NodraError } from '../core/errors.js';
import Fastify from 'fastify';
import { errorHandlerPlugin } from '../api/error-handler.js';

/**
 * StartCommand starts the development server
 */
export class StartCommand implements Command {
	name = 'start';
	description = 'Start development server';

	constructor(
		private pool: Pool,
		private server?: FastifyInstance
	) {}

	/**
	 * Parse command line arguments into StartOptions
	 */
	private parseArgs(args: string[]): StartOptions {
		const options: Partial<StartOptions> = {
			port: 3000,
			host: '0.0.0.0',
		};

		for (const arg of args) {
			if (arg.startsWith('--db-url=')) {
				options.dbUrl = arg.split('=')[1];
			} else if (arg.startsWith('--site-name=')) {
				options.siteName = arg.split('=')[1];
			} else if (arg.startsWith('--port=')) {
				const portStr = arg.split('=')[1];
				if (portStr) {
					options.port = parseInt(portStr, 10);
				}
			} else if (arg.startsWith('--host=')) {
				options.host = arg.split('=')[1];
			}
		}

		if (!options.dbUrl) {
			throw new NodraError('--db-url is required');
		}

		if (!options.siteName) {
			throw new NodraError('--site-name is required');
		}

		if (isNaN(options.port!)) {
			throw new NodraError('--port must be a valid number');
		}

		return options as StartOptions;
	}

	/**
	 * Setup Fastify server with routes and plugins
	 */
	private async setupServer(server: FastifyInstance): Promise<void> {
		// Register error handler
		await server.register(errorHandlerPlugin);

		// TODO: Register resource routes (CRUD API) when ready
		// await server.register(registerResourceRoutes, { pool: this.pool });

		// TODO: Register auth routes when ready
		// await server.register(registerAuthRoutes, { pool: this.pool });

		// Health check endpoint
		server.get('/health', async () => {
			return { status: 'ok' };
		});
	}

	/**
	 * Setup graceful shutdown handlers
	 */
	private setupGracefulShutdown(server: FastifyInstance): void {
		const shutdown = async () => {
			console.log('\nShutting down gracefully...');

			try {
				await server.close();
				await this.pool.end();
				console.log('Server closed');
				process.exit(0);
			} catch (err) {
				console.error('Error during shutdown:', err);
				process.exit(1);
			}
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);
	}

	/**
	 * Execute the start command
	 */
	async execute(args: string[]): Promise<void> {
		const options = this.parseArgs(args);

		// Use provided server or create new one
		const server = this.server || Fastify({ logger: true });

		console.log(`Starting server for site: ${options.siteName}`);

		// Setup routes and plugins
		await this.setupServer(server);

		// Setup graceful shutdown
		this.setupGracefulShutdown(server);

		// Start listening
		try {
			await server.listen({
				port: options.port,
				host: options.host,
			});

			console.log(`Server started on http://${options.host}:${options.port}`);
		} catch (err) {
			console.error('Failed to start server:', err);
			throw err;
		}
	}
}

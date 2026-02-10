/**
 * console command - Interactive REPL with Nodra API
 */

import type { Pool } from 'pg';
import type { Command, ConsoleOptions } from './types.js';
import { NodraError } from '../core/errors.js';
import * as repl from 'node:repl';

/**
 * ConsoleCommand starts an interactive REPL session with Nodra API
 */
export class ConsoleCommand implements Command {
	name = 'console';
	description = 'Interactive REPL with Nodra API';

	constructor(private pool: Pool) {}

	/**
	 * Parse command line arguments into ConsoleOptions
	 */
	private parseArgs(args: string[]): ConsoleOptions {
		const options: Partial<ConsoleOptions> = {};

		for (const arg of args) {
			if (arg.startsWith('--db-url=')) {
				options.dbUrl = arg.split('=')[1];
			} else if (arg.startsWith('--site-name=')) {
				options.siteName = arg.split('=')[1];
			}
		}

		if (!options.dbUrl) {
			throw new NodraError('--db-url is required');
		}

		if (!options.siteName) {
			throw new NodraError('--site-name is required');
		}

		return options as ConsoleOptions;
	}

	/**
	 * Create REPL context with Nodra API
	 */
	private createContext() {
		return {
			// Expose database pool
			pool: this.pool,

			// High-level ORM methods (placeholders - would be implemented with actual ORM)
			getDoc: async (doctype: string, name: string) => {
				const result = await this.pool.query(
					`SELECT * FROM tab_${doctype.toLowerCase().replace(/\s+/g, '_')} WHERE name = $1`,
					[name]
				);
				return result.rows[0];
			},

			getList: async (doctype: string, options?: { limit?: number; offset?: number }) => {
				const limit = options?.limit || 20;
				const offset = options?.offset || 0;
				const result = await this.pool.query(
					`SELECT * FROM tab_${doctype.toLowerCase().replace(/\s+/g, '_')} LIMIT $1 OFFSET $2`,
					[limit, offset]
				);
				return result.rows;
			},

			// Direct SQL query access
			query: async (sql: string, params?: unknown[]) => {
				return this.pool.query(sql, params);
			},

			// Helper functions
			help: () => {
				console.log('\nAvailable commands:');
				console.log('  pool          - Database connection pool');
				console.log('  getDoc(doctype, name)  - Get a single document');
				console.log('  getList(doctype, opts) - Get list of documents');
				console.log('  query(sql, params)     - Execute raw SQL query');
				console.log('  help()        - Show this help message');
				console.log('  .exit         - Exit the console\n');
			},
		};
	}

	/**
	 * Execute the console command
	 */
	async execute(args: string[]): Promise<void> {
		const options = this.parseArgs(args);

		console.log(`\n=== Nodra Console ===`);
		console.log(`Site: ${options.siteName}`);
		console.log(`Type 'help()' for available commands or '.exit' to quit\n`);

		// Create REPL context
		const context = this.createContext();

		// Start REPL
		const replServer = repl.start({
			prompt: 'nodra> ',
			useColors: true,
		});

		// Inject context
		Object.assign(replServer.context, context);

		// Handle exit
		replServer.on('exit', async () => {
			console.log('\nGoodbye!');
			await this.pool.end();
			process.exit(0);
		});
	}
}

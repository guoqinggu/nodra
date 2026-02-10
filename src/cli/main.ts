#!/usr/bin/env node
/**
 * Nodra CLI - Main entry point
 */

import { Pool } from 'pg';
import { NewSiteCommand } from './new-site.js';
import { MigrateCommand } from './migrate.js';
import { StartCommand } from './start.js';
import { ConsoleCommand } from './console.js';
import type { Command } from './types.js';

/**
 * Display CLI usage information
 */
function displayUsage(): void {
	console.log(`
Nodra Framework CLI

Usage:
  nodra <command> [options]

Commands:
  new-site    Create a new site with database and initial setup
  migrate     Sync DocType definitions to database schema
  start       Start development server
  console     Interactive REPL with Nodra API
  help        Show this help message

Options:
  --site-name=<name>       Site name (required for most commands)
  --db-url=<url>           PostgreSQL connection URL (required)
  --admin-password=<pwd>   Administrator password (new-site only)
  --admin-email=<email>    Administrator email (new-site only)
  --port=<port>            Server port (start only, default: 3000)
  --host=<host>            Server host (start only, default: 0.0.0.0)
  --doctype-dir=<path>     DocType directory (migrate only, default: ./doctypes)
  --verbose                Verbose output (migrate only)

Examples:
  nodra new-site --site-name=mysite --db-url=postgresql://localhost/mydb --admin-password=secret
  nodra migrate --site-name=mysite --db-url=postgresql://localhost/mydb
  nodra start --site-name=mysite --db-url=postgresql://localhost/mydb --port=8080
  nodra console --site-name=mysite --db-url=postgresql://localhost/mydb
`);
}

/**
 * Parse DB URL from arguments and create connection pool
 */
function createPoolFromArgs(args: string[]): Pool | null {
	const dbUrlArg = args.find((arg) => arg.startsWith('--db-url='));
	if (!dbUrlArg) {
		return null;
	}

	const dbUrl = dbUrlArg.split('=')[1];
	return new Pool({ connectionString: dbUrl });
}

/**
 * Main CLI execution
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
		displayUsage();
		process.exit(0);
	}

	const commandName = args[0];
	const commandArgs = args.slice(1);

	// Create pool for commands that need it
	const pool = createPoolFromArgs(commandArgs);

	let command: Command | null = null;

	switch (commandName) {
		case 'new-site':
			if (!pool) {
				console.error('Error: --db-url is required');
				process.exit(1);
			}
			command = new NewSiteCommand(pool);
			break;

		case 'migrate':
			if (!pool) {
				console.error('Error: --db-url is required');
				process.exit(1);
			}
			command = new MigrateCommand(pool);
			break;

		case 'start':
			if (!pool) {
				console.error('Error: --db-url is required');
				process.exit(1);
			}
			command = new StartCommand(pool);
			break;

		case 'console':
			if (!pool) {
				console.error('Error: --db-url is required');
				process.exit(1);
			}
			command = new ConsoleCommand(pool);
			break;

		default:
			console.error(`Unknown command: ${commandName}`);
			displayUsage();
			process.exit(1);
	}

	try {
		await command.execute(commandArgs);
	} catch (err) {
		console.error('Error:', err instanceof Error ? err.message : String(err));
		if (pool) {
			await pool.end();
		}
		process.exit(1);
	}
}

// Run CLI
main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});

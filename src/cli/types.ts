/**
 * CLI command types and interfaces
 */

/**
 * Base interface for CLI commands
 */
export interface Command {
	name: string;
	description: string;
	execute(args: string[]): Promise<void>;
}

/**
 * CLI configuration options
 */
export interface CLIOptions {
	/**
	 * Database connection string
	 */
	dbUrl?: string;

	/**
	 * Site name
	 */
	siteName?: string;

	/**
	 * HTTP port
	 */
	port?: number;

	/**
	 * Host to bind to
	 */
	host?: string;

	/**
	 * Enable debug logging
	 */
	debug?: boolean;
}

/**
 * New site configuration
 */
export interface NewSiteOptions {
	siteName: string;
	dbUrl: string;
	adminPassword: string;
	adminEmail?: string;
}

/**
 * Migrate command options
 */
export interface MigrateOptions {
	dbUrl: string;
	siteName: string;
	verbose?: boolean;
}

/**
 * Start server options
 */
export interface StartOptions {
	port: number;
	host: string;
	dbUrl: string;
	siteName: string;
}

/**
 * Console (REPL) options
 */
export interface ConsoleOptions {
	dbUrl: string;
	siteName: string;
}

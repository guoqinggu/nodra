/**
 * migrate command - Sync DocTypes to database schema
 */

import type { Pool } from 'pg';
import type { Command, MigrateOptions } from './types.js';
import { NodraError } from '../core/errors.js';
import { loadDocTypesFromDirectory } from '../core/doctype/loader.js';
import { SchemaSync } from '../database/schema-sync.js';
import type { ColumnInfo } from '../database/schema-sync.js';
import { toTableName } from '../core/doctype/naming.js';
import path from 'node:path';

/**
 * MigrateCommand syncs DocType definitions to database schema
 */
export class MigrateCommand implements Command {
	name = 'migrate';
	description = 'Sync DocType definitions to database schema';

	private schemaSync: SchemaSync;

	constructor(private pool: Pool) {
		this.schemaSync = new SchemaSync();
	}

	/**
	 * Parse command line arguments into MigrateOptions
	 */
	private parseArgs(args: string[]): MigrateOptions & { doctypeDir?: string } {
		const options: Partial<MigrateOptions & { doctypeDir?: string }> = {};

		for (const arg of args) {
			if (arg.startsWith('--db-url=')) {
				options.dbUrl = arg.split('=')[1];
			} else if (arg.startsWith('--site-name=')) {
				options.siteName = arg.split('=')[1];
			} else if (arg.startsWith('--doctype-dir=')) {
				options.doctypeDir = arg.split('=')[1];
			} else if (arg === '--verbose') {
				options.verbose = true;
			}
		}

		if (!options.dbUrl) {
			throw new NodraError('--db-url is required');
		}

		if (!options.siteName) {
			throw new NodraError('--site-name is required');
		}

		return options as MigrateOptions & { doctypeDir?: string };
	}

	/**
	 * Introspect existing database schema for a table
	 */
	private async getExistingColumns(tableName: string): Promise<ColumnInfo[]> {
		const result = await this.pool.query<ColumnInfo>(
			`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `,
			[tableName]
		);

		return result.rows;
	}

	/**
	 * Check if a table exists in the database
	 */
	private async tableExists(tableName: string): Promise<boolean> {
		const result = await this.pool.query(
			`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = $1
      )
    `,
			[tableName]
		);

		return result.rows[0]?.exists === true;
	}

	/**
	 * Execute the migrate command
	 */
	async execute(args: string[]): Promise<void> {
		const options = this.parseArgs(args);

		// Determine DocType directory
		const doctypeDir = options.doctypeDir || path.join(process.cwd(), 'doctypes');

		console.log(`Loading DocTypes from: ${doctypeDir}`);

		// Load all DocTypes
		const doctypes = await loadDocTypesFromDirectory(doctypeDir);

		console.log(`Found ${doctypes.length} DocTypes`);

		if (doctypes.length === 0) {
			console.log('No DocTypes found. Nothing to migrate.');
			return;
		}

		let createCount = 0;
		let alterCount = 0;
		let indexCount = 0;

		// Sync each DocType
		for (const doctype of doctypes) {
			const tableName = toTableName(doctype.name);
			const exists = await this.tableExists(tableName);

			if (!exists) {
				// Create new table
				if (options.verbose) {
					console.log(`Creating table: ${tableName}`);
				}

				const createTableSql = this.schemaSync.generateCreateTable(doctype);
				await this.pool.query(createTableSql);
				createCount++;

				// Create indexes
				const indexSqls = this.schemaSync.generateIndexes(doctype);
				for (const indexSql of indexSqls) {
					await this.pool.query(indexSql);
					indexCount++;
				}
			} else {
				// Alter existing table (add missing columns)
				if (options.verbose) {
					console.log(`Checking table: ${tableName}`);
				}

				const existingColumns = await this.getExistingColumns(tableName);
				const alterStatements = this.schemaSync.generateAlterTable(doctype, existingColumns);

				if (alterStatements.length > 0) {
					if (options.verbose) {
						console.log(`Altering table: ${tableName} (${alterStatements.length} columns)`);
					}

					for (const alterSql of alterStatements) {
						await this.pool.query(alterSql);
					}

					alterCount += alterStatements.length;
				}

				// Ensure indexes exist
				const indexSqls = this.schemaSync.generateIndexes(doctype);
				for (const indexSql of indexSqls) {
					await this.pool.query(indexSql);
					indexCount++;
				}
			}
		}

		console.log(`\nMigration complete:`);
		console.log(`  - Tables created: ${createCount}`);
		console.log(`  - Columns added: ${alterCount}`);
		console.log(`  - Indexes created: ${indexCount}`);
	}
}

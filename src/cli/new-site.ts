/**
 * new-site command - Create new site with database and initial setup
 */

import type { Pool } from 'pg';
import type { Command, NewSiteOptions } from './types.js';
import { hashPassword } from '../auth/password.js';
import { NodraError } from '../core/errors.js';

/**
 * NewSiteCommand creates a new Nodra site with database schema and admin user
 */
export class NewSiteCommand implements Command {
	name = 'new-site';
	description = 'Create a new site with database and initial setup';

	constructor(private pool: Pool) {}

	/**
	 * Parse command line arguments into NewSiteOptions
	 */
	private parseArgs(args: string[]): NewSiteOptions {
		const options: Partial<NewSiteOptions> = {};

		for (const arg of args) {
			if (arg.startsWith('--site-name=')) {
				options.siteName = arg.split('=')[1];
			} else if (arg.startsWith('--db-url=')) {
				options.dbUrl = arg.split('=')[1];
			} else if (arg.startsWith('--admin-password=')) {
				options.adminPassword = arg.split('=')[1];
			} else if (arg.startsWith('--admin-email=')) {
				options.adminEmail = arg.split('=')[1];
			}
		}

		if (!options.siteName) {
			throw new NodraError('--site-name is required');
		}

		if (!options.dbUrl) {
			throw new NodraError('--db-url is required');
		}

		if (!options.adminPassword) {
			throw new NodraError('--admin-password is required');
		}

		// Default admin email
		if (!options.adminEmail) {
			options.adminEmail = 'admin@localhost';
		}

		return options as NewSiteOptions;
	}

	/**
	 * Create core database tables
	 */
	private async createTables(): Promise<void> {
		// Create User table
		await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tab_user (
        name VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        enabled BOOLEAN DEFAULT true,
        owner VARCHAR(255),
        creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_by VARCHAR(255),
        docstatus SMALLINT DEFAULT 0,
        idx INTEGER DEFAULT 0
      )
    `);

		// Create Role table
		await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tab_role (
        name VARCHAR(255) PRIMARY KEY,
        role_name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        owner VARCHAR(255),
        creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_by VARCHAR(255),
        docstatus SMALLINT DEFAULT 0,
        idx INTEGER DEFAULT 0
      )
    `);

		// Create User Role table (junction table)
		await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tab_user_role (
        name VARCHAR(255) PRIMARY KEY,
        parent VARCHAR(255) REFERENCES tab_user(name) ON DELETE CASCADE,
        parenttype VARCHAR(255) DEFAULT 'User',
        parentfield VARCHAR(255) DEFAULT 'roles',
        role VARCHAR(255) REFERENCES tab_role(name),
        idx INTEGER DEFAULT 0,
        owner VARCHAR(255),
        creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_by VARCHAR(255),
        docstatus SMALLINT DEFAULT 0
      )
    `);
	}

	/**
	 * Create default roles
	 */
	private async createDefaultRoles(): Promise<void> {
		const roles = [
			{ name: 'System Manager', description: 'System administrator with full access' },
			{ name: 'Guest', description: 'Guest user with minimal permissions' },
			{ name: 'All', description: 'All users' },
		];

		for (const role of roles) {
			await this.pool.query(
				`
        INSERT INTO tab_role (name, role_name, description, owner, modified_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO NOTHING
      `,
				[role.name, role.name, role.description, 'Administrator', 'Administrator']
			);
		}
	}

	/**
	 * Create administrator user
	 */
	private async createAdminUser(options: NewSiteOptions): Promise<void> {
		const hashedPassword = await hashPassword(options.adminPassword);

		// Create Administrator user
		await this.pool.query(
			`
      INSERT INTO tab_user (name, email, password, full_name, enabled, owner, modified_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (name) DO NOTHING
    `,
			[
				'Administrator',
				options.adminEmail || 'admin@localhost',
				hashedPassword,
				'Administrator',
				true,
				'Administrator',
				'Administrator',
			]
		);

		// Assign System Manager role to Administrator
		await this.pool.query(
			`
      INSERT INTO tab_user_role (name, parent, role, owner, modified_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO NOTHING
    `,
			[
				'Administrator-System Manager',
				'Administrator',
				'System Manager',
				'Administrator',
				'Administrator',
			]
		);
	}

	/**
	 * Execute the new-site command
	 */
	async execute(args: string[]): Promise<void> {
		const options = this.parseArgs(args);

		console.log(`Creating new site: ${options.siteName}`);

		// Create tables
		console.log('Creating database tables...');
		await this.createTables();

		// Create default roles
		console.log('Creating default roles...');
		await this.createDefaultRoles();

		// Create admin user
		console.log('Creating administrator user...');
		await this.createAdminUser(options);

		console.log(`Site ${options.siteName} created successfully!`);
		console.log(`Administrator email: ${options.adminEmail}`);
	}
}

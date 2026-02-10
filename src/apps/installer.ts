/**
 * App installer - handles app installation and removal
 */

import type { Pool } from 'pg';
import type { App, AppInstaller, AppRegistry, InstallOptions, UninstallOptions } from './types.js';
import { ValidationError, DuplicateError, NotFoundError } from '../core/errors.js';

/**
 * Default app installer implementation
 */
export class DefaultAppInstaller implements AppInstaller {
	constructor(
		private registry: AppRegistry,
		private pool: Pool
	) {}

	/**
	 * Install an app
	 */
	async install(app: App, options?: InstallOptions): Promise<void> {
		// Check if already installed
		if (await this.isInstalled(app.name)) {
			if (!options?.force) {
				throw new DuplicateError('App', app.name);
			}

			// Uninstall first if force option is true
			await this.uninstall(app.name, { force: true });
		}

		// Check dependencies
		if (!options?.skipDependencies) {
			await this.checkDependencies(app);
		}

		// Create installed_apps table if not exists
		await this.ensureInstalledAppsTable();

		// Insert app record
		await this.pool.query(
			`
      INSERT INTO installed_apps (name, version, path, manifest, installed_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (name) DO UPDATE
        SET version = EXCLUDED.version,
            path = EXCLUDED.path,
            manifest = EXCLUDED.manifest,
            installed_at = NOW()
    `,
			[app.name, app.version, app.path, JSON.stringify(app.manifest)]
		);

		// Register app
		app.installed = true;
		app.enabled = true;
		this.registry.register(app);

		console.log(`Installed app: ${app.name} v${app.version}`);
	}

	/**
	 * Uninstall an app
	 */
	async uninstall(appName: string, options?: UninstallOptions): Promise<void> {
		// Check if installed
		if (!(await this.isInstalled(appName))) {
			throw new NotFoundError('App', appName);
		}

		// Check if other apps depend on this app
		if (!options?.force) {
			await this.checkDependents(appName);
		}

		// Remove from database
		await this.pool.query(
			`
      DELETE FROM installed_apps WHERE name = $1
    `,
			[appName]
		);

		// Unregister app
		try {
			this.registry.unregister(appName);
		} catch {
			// App might not be in registry
		}

		console.log(`Uninstalled app: ${appName}`);
	}

	/**
	 * Check if app is installed
	 */
	async isInstalled(appName: string): Promise<boolean> {
		try {
			await this.ensureInstalledAppsTable();

			const result = await this.pool.query(
				`
        SELECT EXISTS (
          SELECT 1 FROM installed_apps WHERE name = $1
        )
      `,
				[appName]
			);

			return result.rows[0]?.exists === true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if all dependencies are installed
	 */
	private async checkDependencies(app: App): Promise<void> {
		const dependencies = app.manifest.nodra?.depends_on || [];

		for (const dep of dependencies) {
			if (!(await this.isInstalled(dep))) {
				throw new ValidationError(`Dependency ${dep} is not installed`);
			}
		}
	}

	/**
	 * Check if any other apps depend on this app
	 */
	private async checkDependents(appName: string): Promise<void> {
		const allApps = this.registry.getAll();

		for (const app of allApps) {
			const dependencies = app.manifest.nodra?.depends_on || [];
			if (dependencies.includes(appName)) {
				throw new ValidationError(`Cannot uninstall ${appName}: ${app.name} depends on it`);
			}
		}
	}

	/**
	 * Ensure installed_apps table exists
	 */
	private async ensureInstalledAppsTable(): Promise<void> {
		await this.pool.query(`
      CREATE TABLE IF NOT EXISTS installed_apps (
        name VARCHAR(255) PRIMARY KEY,
        version VARCHAR(50) NOT NULL,
        path TEXT NOT NULL,
        manifest JSONB NOT NULL,
        installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
	}
}

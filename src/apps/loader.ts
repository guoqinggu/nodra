/**
 * App loader - loads apps from filesystem
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { App, AppManifest, AppLoader } from './types.js';
import { NotFoundError, ValidationError } from '../core/errors.js';

/**
 * Default app loader implementation
 */
export class DefaultAppLoader implements AppLoader {
	/**
	 * Load app from directory
	 */
	async load(appPath: string): Promise<App> {
		// Read package.json
		const packageJsonPath = path.join(appPath, 'package.json');
		let content: string;

		try {
			content = await readFile(packageJsonPath, 'utf-8');
		} catch (err: unknown) {
			if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
				throw new NotFoundError('package.json', packageJsonPath);
			}
			throw err;
		}

		// Parse package.json
		let manifest: AppManifest;
		try {
			manifest = JSON.parse(content) as AppManifest;
		} catch {
			throw new ValidationError(`Invalid JSON in ${packageJsonPath}`);
		}

		// Validate required fields
		if (!manifest.name) {
			throw new ValidationError('App manifest must have a name field');
		}

		if (!manifest.version) {
			throw new ValidationError('App manifest must have a version field');
		}

		// Get DocTypes
		const doctypes = await this.getDocTypes({ name: manifest.name, path: appPath } as App);

		// Create app object
		const app: App = {
			name: manifest.name,
			version: manifest.version,
			path: appPath,
			manifest,
			installed: false,
			enabled: false,
			doctypes,
		};

		return app;
	}

	/**
	 * Load all apps from apps directory
	 */
	async loadAll(appsDir: string): Promise<App[]> {
		const apps: App[] = [];

		let entries;
		try {
			entries = await readdir(appsDir, { withFileTypes: true });
		} catch {
			// Directory doesn't exist, return empty array
			return apps;
		}

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue;
			}

			const appPath = path.join(appsDir, entry.name);

			try {
				const app = await this.load(appPath);
				apps.push(app);
			} catch (err: unknown) {
				// Skip apps that fail to load
				const message = err instanceof Error ? err.message : String(err);
				console.warn(`Skipping ${appPath}: ${message}`);
			}
		}

		return apps;
	}

	/**
	 * Get DocTypes for an app
	 */
	async getDocTypes(app: App): Promise<string[]> {
		const doctypesDir = path.join(app.path, 'doctypes');
		const doctypes: string[] = [];

		try {
			const files = await this.findJsonFiles(doctypesDir);
			doctypes.push(...files.map((f) => path.basename(f, '.json')));
		} catch {
			// No doctypes directory, return empty array
			return [];
		}

		return doctypes;
	}

	/**
	 * Recursively find all .json files in a directory
	 */
	private async findJsonFiles(dirPath: string): Promise<string[]> {
		const results: string[] = [];

		let entries;
		try {
			entries = await readdir(dirPath, { withFileTypes: true });
		} catch {
			return results;
		}

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);

			if (entry.isDirectory()) {
				const nested = await this.findJsonFiles(fullPath);
				results.push(...nested);
			} else if (entry.isFile() && entry.name.endsWith('.json')) {
				results.push(fullPath);
			}
		}

		return results;
	}
}

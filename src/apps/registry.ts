/**
 * App registry - tracks installed apps
 */

import type { App, AppRegistry } from './types.js';
import { NotFoundError } from '../core/errors.js';

/**
 * Default in-memory app registry
 */
export class DefaultAppRegistry implements AppRegistry {
	private apps = new Map<string, App>();

	/**
	 * Register an installed app
	 */
	register(app: App): void {
		this.apps.set(app.name, app);
	}

	/**
	 * Unregister an app
	 */
	unregister(appName: string): void {
		if (!this.apps.has(appName)) {
			throw new NotFoundError('App', appName);
		}

		this.apps.delete(appName);
	}

	/**
	 * Get an app by name
	 */
	get(appName: string): App | undefined {
		return this.apps.get(appName);
	}

	/**
	 * Get all registered apps
	 */
	getAll(): App[] {
		return Array.from(this.apps.values());
	}

	/**
	 * Check if app is registered
	 */
	has(appName: string): boolean {
		return this.apps.has(appName);
	}
}

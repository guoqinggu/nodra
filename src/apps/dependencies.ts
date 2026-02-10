/**
 * Dependency resolver - resolves app dependencies and installation order
 */

import type { App, DependencyResolution } from './types.js';

/**
 * Dependency resolver using topological sort
 */
export class DependencyResolver {
	/**
	 * Resolve dependencies and determine installation order
	 */
	resolve(apps: App[]): DependencyResolution {
		const appMap = new Map<string, App>();
		for (const app of apps) {
			appMap.set(app.name, app);
		}

		const installOrder: string[] = [];
		const missing: string[] = [];
		const circular: string[][] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();

		// Helper to visit an app and its dependencies (DFS)
		const visit = (appName: string, path: string[] = []): boolean => {
			// Check for circular dependency
			if (visiting.has(appName)) {
				circular.push([...path, appName]);
				return false;
			}

			// Already processed
			if (visited.has(appName)) {
				return true;
			}

			const app = appMap.get(appName);
			if (!app) {
				// Missing dependency
				if (!missing.includes(appName)) {
					missing.push(appName);
				}
				return false;
			}

			visiting.add(appName);

			// Visit dependencies first
			const dependencies = app.manifest.nodra?.depends_on || [];
			for (const dep of dependencies) {
				if (!visit(dep, [...path, appName])) {
					// Dependency resolution failed
					visiting.delete(appName);
					return false;
				}
			}

			visiting.delete(appName);
			visited.add(appName);
			installOrder.push(appName);

			return true;
		};

		// Visit all apps
		for (const app of apps) {
			if (!visited.has(app.name)) {
				visit(app.name);
			}
		}

		return {
			installOrder,
			missing,
			circular,
		};
	}

	/**
	 * Check if dependencies can be resolved
	 */
	canResolve(apps: App[]): boolean {
		const result = this.resolve(apps);
		return result.missing.length === 0 && result.circular.length === 0;
	}

	/**
	 * Get apps in installation order
	 */
	getInstallOrder(apps: App[]): string[] {
		const result = this.resolve(apps);

		if (result.missing.length > 0) {
			throw new Error(`Missing dependencies: ${result.missing.join(', ')}`);
		}

		if (result.circular.length > 0) {
			const cycles = result.circular.map((cycle) => cycle.join(' -> ')).join(', ');
			throw new Error(`Circular dependencies detected: ${cycles}`);
		}

		return result.installOrder;
	}
}

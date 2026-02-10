import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultAppInstaller } from '../../../src/apps/installer.js';
import { DefaultAppRegistry } from '../../../src/apps/registry.js';
import type { App } from '../../../src/apps/types.js';
import type { Pool } from 'pg';

describe('App Removal', () => {
	let installer: DefaultAppInstaller;
	let registry: DefaultAppRegistry;
	let mockPool: Pool;
	let installedApps: Set<string>;

	beforeEach(() => {
		registry = new DefaultAppRegistry();
		installedApps = new Set<string>();

		mockPool = {
			query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
				// Mock table creation
				if (sql.includes('CREATE TABLE')) {
					return Promise.resolve({ rows: [], rowCount: 0 });
				}
				// Mock EXISTS check
				if (sql.includes('EXISTS')) {
					const appName = params?.[0] as string;
					const exists = installedApps.has(appName);
					return Promise.resolve({ rows: [{ exists }], rowCount: 1 });
				}
				// Mock INSERT
				if (sql.includes('INSERT INTO')) {
					const appName = params?.[0] as string;
					if (appName) {
						installedApps.add(appName);
					}
					return Promise.resolve({ rows: [], rowCount: 0 });
				}
				// Mock DELETE
				if (sql.includes('DELETE FROM')) {
					const appName = params?.[0] as string;
					if (appName) {
						installedApps.delete(appName);
					}
					return Promise.resolve({ rows: [], rowCount: 0 });
				}
				return Promise.resolve({ rows: [], rowCount: 0 });
			}),
			end: vi.fn(),
		} as unknown as Pool;

		installer = new DefaultAppInstaller(registry, mockPool);
	});

	const testApp: App = {
		name: 'test-app',
		version: '1.0.0',
		path: '/apps/test-app',
		manifest: {
			name: 'test-app',
			version: '1.0.0',
		},
		installed: false,
		enabled: false,
		doctypes: ['TestDocType'],
	};

	describe('Uninstall', () => {
		it('should uninstall an installed app', async () => {
			// Install first
			await installer.install(testApp);

			// Uninstall
			await installer.uninstall('test-app');

			const isInstalled = await installer.isInstalled('test-app');
			expect(isInstalled).toBe(false);
		});

		it('should remove app from registry', async () => {
			await installer.install(testApp);
			await installer.uninstall('test-app');

			const app = registry.get('test-app');
			expect(app).toBeUndefined();
		});

		it('should delete app record from database', async () => {
			await installer.install(testApp);

			const beforeCalls = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls.length;
			await installer.uninstall('test-app');
			const afterCalls = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls.length;

			// Should have made additional DELETE query
			const newCalls = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls.slice(beforeCalls);
			const deleteCalls = newCalls.filter((call) => {
				const sql = call[0] as string;
				return sql.includes('DELETE FROM') && sql.includes('installed_apps');
			});

			expect(deleteCalls.length).toBeGreaterThan(0);
		});

		it('should throw error if app is not installed', async () => {
			await expect(installer.uninstall('non-existent-app')).rejects.toThrow();
		});

		it('should throw error if other apps depend on it', async () => {
			const depApp: App = {
				name: 'dep-app',
				version: '1.0.0',
				path: '/apps/dep-app',
				manifest: {
					name: 'dep-app',
					version: '1.0.0',
				},
				installed: false,
				enabled: false,
				doctypes: [],
			};

			const mainApp: App = {
				name: 'main-app',
				version: '1.0.0',
				path: '/apps/main-app',
				manifest: {
					name: 'main-app',
					version: '1.0.0',
					nodra: {
						depends_on: ['dep-app'],
					},
				},
				installed: false,
				enabled: false,
				doctypes: [],
			};

			await installer.install(depApp);
			await installer.install(mainApp);

			// Should fail because main-app depends on dep-app
			await expect(installer.uninstall('dep-app')).rejects.toThrow();
		});

		it('should force uninstall if force option is true', async () => {
			const depApp: App = {
				name: 'dep-app',
				version: '1.0.0',
				path: '/apps/dep-app',
				manifest: {
					name: 'dep-app',
					version: '1.0.0',
				},
				installed: false,
				enabled: false,
				doctypes: [],
			};

			const mainApp: App = {
				name: 'main-app',
				version: '1.0.0',
				path: '/apps/main-app',
				manifest: {
					name: 'main-app',
					version: '1.0.0',
					nodra: {
						depends_on: ['dep-app'],
					},
				},
				installed: false,
				enabled: false,
				doctypes: [],
			};

			await installer.install(depApp);
			await installer.install(mainApp);

			// Should succeed with force option
			await expect(installer.uninstall('dep-app', { force: true })).resolves.not.toThrow();
		});

		it('should handle removeData option', async () => {
			await installer.install(testApp);

			// Should succeed (data removal would be implemented in full version)
			await expect(
				installer.uninstall('test-app', { removeData: true })
			).resolves.not.toThrow();
		});
	});
});
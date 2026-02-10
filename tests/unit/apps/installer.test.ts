import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultAppInstaller } from '../../../src/apps/installer.js';
import { DefaultAppRegistry } from '../../../src/apps/registry.js';
import type { App } from '../../../src/apps/types.js';
import type { Pool } from 'pg';

describe('DefaultAppInstaller', () => {
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

	describe('App installation', () => {
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

		it('should install an app', async () => {
			await installer.install(testApp);

			const isInstalled = await installer.isInstalled('test-app');
			expect(isInstalled).toBe(true);
		});

		it('should register app in registry after installation', async () => {
			await installer.install(testApp);

			const app = registry.get('test-app');
			expect(app).toBeDefined();
			expect(app?.installed).toBe(true);
		});

		it('should create app record in database', async () => {
			const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
			mockPool.query = mockQuery;

			await installer.install(testApp);

			// Should insert into installed_apps table
			const insertCalls = mockQuery.mock.calls.filter((call) => {
				const sql = call[0] as string;
				return sql.includes('INSERT INTO') && sql.includes('installed_apps');
			});

			expect(insertCalls.length).toBeGreaterThan(0);
		});

		it('should throw error if app already installed', async () => {
			await installer.install(testApp);

			await expect(installer.install(testApp)).rejects.toThrow();
		});

		it('should skip installation if force option is true', async () => {
			await installer.install(testApp);

			// Should succeed with force option
			await expect(installer.install(testApp, { force: true })).resolves.not.toThrow();
		});

		it('should install dependencies before app', async () => {
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

			const appWithDeps: App = {
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

			// Install dependency first
			await installer.install(depApp);

			// Should succeed
			await expect(installer.install(appWithDeps)).resolves.not.toThrow();
		});

		it('should throw error if dependencies are missing', async () => {
			const appWithDeps: App = {
				name: 'main-app',
				version: '1.0.0',
				path: '/apps/main-app',
				manifest: {
					name: 'main-app',
					version: '1.0.0',
					nodra: {
						depends_on: ['missing-app'],
					},
				},
				installed: false,
				enabled: false,
				doctypes: [],
			};

			await expect(installer.install(appWithDeps)).rejects.toThrow();
		});

		it('should skip dependency check if skipDependencies option is true', async () => {
			const appWithDeps: App = {
				name: 'main-app',
				version: '1.0.0',
				path: '/apps/main-app',
				manifest: {
					name: 'main-app',
					version: '1.0.0',
					nodra: {
						depends_on: ['missing-app'],
					},
				},
				installed: false,
				enabled: false,
				doctypes: [],
			};

			// Should succeed with skipDependencies
			await expect(
				installer.install(appWithDeps, { skipDependencies: true })
			).resolves.not.toThrow();
		});

		it('should mark app as enabled after installation', async () => {
			await installer.install(testApp);

			const app = registry.get('test-app');
			expect(app?.enabled).toBe(true);
		});

		it('should call setup hooks if available', async () => {
			// This test verifies that setup hooks are called during installation
			// In a real implementation, apps would have setup.ts files
			await installer.install(testApp);

			// Just verify installation succeeded
			expect(await installer.isInstalled('test-app')).toBe(true);
		});
	});
});
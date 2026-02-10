import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultAppLoader } from '../../../src/apps/loader.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/apps');

describe('DefaultAppLoader', () => {
	let loader: DefaultAppLoader;

	beforeEach(() => {
		loader = new DefaultAppLoader();
	});

	describe('App directory convention', () => {
		it('should load app from directory with package.json', async () => {
			const appPath = path.join(fixturesDir, 'test-app');
			const app = await loader.load(appPath);

			expect(app).toBeDefined();
			expect(app.name).toBe('test-app');
			expect(app.path).toBe(appPath);
			expect(app.manifest).toBeDefined();
		});

		it('should parse nodra metadata from package.json', async () => {
			const appPath = path.join(fixturesDir, 'test-app');
			const app = await loader.load(appPath);

			expect(app.manifest.nodra).toBeDefined();
			expect(app.manifest.nodra?.title).toBeDefined();
		});

		it('should throw error if package.json is missing', async () => {
			const appPath = path.join(fixturesDir, 'invalid-app');

			await expect(loader.load(appPath)).rejects.toThrow();
		});

		it('should discover DocTypes in app directory', async () => {
			const appPath = path.join(fixturesDir, 'test-app');
			const app = await loader.load(appPath);
			const doctypes = await loader.getDocTypes(app);

			expect(Array.isArray(doctypes)).toBe(true);
			expect(doctypes.length).toBeGreaterThan(0);
		});

		it('should find DocTypes in doctypes/ subdirectory', async () => {
			const appPath = path.join(fixturesDir, 'test-app');
			const app = await loader.load(appPath);
			const doctypes = await loader.getDocTypes(app);

			// Should find .json files in doctypes/ directory
			const hasJsonFiles = doctypes.length > 0;
			expect(hasJsonFiles).toBe(true);
		});

		it('should return empty array if no doctypes/ directory', async () => {
			const appPath = path.join(fixturesDir, 'app-without-doctypes');
			const app = await loader.load(appPath);
			const doctypes = await loader.getDocTypes(app);

			expect(doctypes).toEqual([]);
		});

		it('should load all apps from apps directory', async () => {
			const apps = await loader.loadAll(fixturesDir);

			expect(Array.isArray(apps)).toBe(true);
			expect(apps.length).toBeGreaterThan(0);
		});

		it('should skip directories without package.json', async () => {
			const apps = await loader.loadAll(fixturesDir);

			// Should not include invalid-app
			const hasInvalidApp = apps.some((app) => app.name === 'invalid-app');
			expect(hasInvalidApp).toBe(false);
		});

		it('should set default values for optional fields', async () => {
			const appPath = path.join(fixturesDir, 'minimal-app');
			const app = await loader.load(appPath);

			expect(app.installed).toBe(false);
			expect(app.enabled).toBe(false);
			expect(app.doctypes).toEqual([]);
		});

		it('should handle apps with dependencies', async () => {
			const appPath = path.join(fixturesDir, 'app-with-deps');
			const app = await loader.load(appPath);

			expect(app.manifest.nodra?.depends_on).toBeDefined();
			expect(Array.isArray(app.manifest.nodra?.depends_on)).toBe(true);
		});
	});
});
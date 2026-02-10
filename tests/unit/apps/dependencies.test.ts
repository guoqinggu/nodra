import { describe, it, expect } from 'vitest';
import { DependencyResolver } from '../../../src/apps/dependencies.js';
import type { App } from '../../../src/apps/types.js';

describe('DependencyResolver', () => {
	const resolver = new DependencyResolver();

	describe('Dependency resolution', () => {
		it('should resolve apps with no dependencies', () => {
			const apps: App[] = [
				{
					name: 'app1',
					version: '1.0.0',
					path: '/apps/app1',
					manifest: { name: 'app1', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app2',
					version: '1.0.0',
					path: '/apps/app2',
					manifest: { name: 'app2', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			expect(result.installOrder).toHaveLength(2);
			expect(result.missing).toHaveLength(0);
			expect(result.circular).toHaveLength(0);
		});

		it('should order apps by dependencies', () => {
			const apps: App[] = [
				{
					name: 'main-app',
					version: '1.0.0',
					path: '/apps/main-app',
					manifest: {
						name: 'main-app',
						version: '1.0.0',
						nodra: { depends_on: ['base-app'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'base-app',
					version: '1.0.0',
					path: '/apps/base-app',
					manifest: { name: 'base-app', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			expect(result.installOrder).toEqual(['base-app', 'main-app']);
			expect(result.missing).toHaveLength(0);
			expect(result.circular).toHaveLength(0);
		});

		it('should handle transitive dependencies', () => {
			const apps: App[] = [
				{
					name: 'app-c',
					version: '1.0.0',
					path: '/apps/app-c',
					manifest: {
						name: 'app-c',
						version: '1.0.0',
						nodra: { depends_on: ['app-b'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app-b',
					version: '1.0.0',
					path: '/apps/app-b',
					manifest: {
						name: 'app-b',
						version: '1.0.0',
						nodra: { depends_on: ['app-a'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app-a',
					version: '1.0.0',
					path: '/apps/app-a',
					manifest: { name: 'app-a', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			expect(result.installOrder).toEqual(['app-a', 'app-b', 'app-c']);
			expect(result.missing).toHaveLength(0);
			expect(result.circular).toHaveLength(0);
		});

		it('should detect missing dependencies', () => {
			const apps: App[] = [
				{
					name: 'main-app',
					version: '1.0.0',
					path: '/apps/main-app',
					manifest: {
						name: 'main-app',
						version: '1.0.0',
						nodra: { depends_on: ['missing-app'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			expect(result.missing).toContain('missing-app');
		});

		it('should detect circular dependencies', () => {
			const apps: App[] = [
				{
					name: 'app-a',
					version: '1.0.0',
					path: '/apps/app-a',
					manifest: {
						name: 'app-a',
						version: '1.0.0',
						nodra: { depends_on: ['app-b'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app-b',
					version: '1.0.0',
					path: '/apps/app-b',
					manifest: {
						name: 'app-b',
						version: '1.0.0',
						nodra: { depends_on: ['app-a'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			expect(result.circular.length).toBeGreaterThan(0);
		});

		it('should handle complex dependency graph', () => {
			const apps: App[] = [
				{
					name: 'app-d',
					version: '1.0.0',
					path: '/apps/app-d',
					manifest: {
						name: 'app-d',
						version: '1.0.0',
						nodra: { depends_on: ['app-b', 'app-c'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app-c',
					version: '1.0.0',
					path: '/apps/app-c',
					manifest: {
						name: 'app-c',
						version: '1.0.0',
						nodra: { depends_on: ['app-a'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app-b',
					version: '1.0.0',
					path: '/apps/app-b',
					manifest: {
						name: 'app-b',
						version: '1.0.0',
						nodra: { depends_on: ['app-a'] },
					},
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'app-a',
					version: '1.0.0',
					path: '/apps/app-a',
					manifest: { name: 'app-a', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			// app-a should be first
			expect(result.installOrder[0]).toBe('app-a');

			// app-d should be last
			expect(result.installOrder[result.installOrder.length - 1]).toBe('app-d');

			// app-b and app-c should come before app-d
			const bIndex = result.installOrder.indexOf('app-b');
			const cIndex = result.installOrder.indexOf('app-c');
			const dIndex = result.installOrder.indexOf('app-d');

			expect(bIndex).toBeLessThan(dIndex);
			expect(cIndex).toBeLessThan(dIndex);
		});

		it('should handle multiple independent apps', () => {
			const apps: App[] = [
				{
					name: 'independent-1',
					version: '1.0.0',
					path: '/apps/independent-1',
					manifest: { name: 'independent-1', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
				{
					name: 'independent-2',
					version: '1.0.0',
					path: '/apps/independent-2',
					manifest: { name: 'independent-2', version: '1.0.0' },
					installed: false,
					enabled: false,
					doctypes: [],
				},
			];

			const result = resolver.resolve(apps);

			expect(result.installOrder).toHaveLength(2);
			expect(result.missing).toHaveLength(0);
			expect(result.circular).toHaveLength(0);
		});
	});
});
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NewSiteCommand } from '../../../src/cli/new-site.js';
import type { Pool } from 'pg';

describe('NewSiteCommand', () => {
	let mockPool: Pool;
	let command: NewSiteCommand;

	beforeEach(() => {
		mockPool = {
			query: vi.fn(),
			end: vi.fn(),
		} as unknown as Pool;

		command = new NewSiteCommand(mockPool);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should have correct name and description', () => {
		expect(command.name).toBe('new-site');
		expect(command.description).toBeTruthy();
	});

	it('should create database schema', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--site-name=test-site',
			'--db-url=postgresql://localhost:5432/test',
			'--admin-password=admin123',
		]);

		// Should create core tables
		expect(mockQuery).toHaveBeenCalled();
		const calls = mockQuery.mock.calls;
		const sqlCalls = calls.map((call) => call[0] as string);

		// Check for User table creation
		expect(sqlCalls.some((sql) => sql.includes('CREATE TABLE') && sql.includes('tab_user'))).toBe(
			true
		);

		// Check for Role table creation
		expect(sqlCalls.some((sql) => sql.includes('CREATE TABLE') && sql.includes('tab_role'))).toBe(
			true
		);
	});

	it('should create administrator user', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--site-name=test-site',
			'--db-url=postgresql://localhost:5432/test',
			'--admin-password=admin123',
			'--admin-email=admin@example.com',
		]);

		const calls = mockQuery.mock.calls;
		const insertCalls = calls.filter((call) => {
			const sql = call[0] as string;
			return sql.includes('INSERT INTO') && sql.includes('tab_user');
		});

		expect(insertCalls.length).toBeGreaterThan(0);
	});

	it('should hash admin password with argon2', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--site-name=test-site',
			'--db-url=postgresql://localhost:5432/test',
			'--admin-password=admin123',
		]);

		const calls = mockQuery.mock.calls;
		const userInsert = calls.find((call) => {
			const sql = call[0] as string;
			return sql.includes('INSERT INTO') && sql.includes('tab_user');
		});

		expect(userInsert).toBeDefined();
		if (userInsert) {
			const params = userInsert[1] as unknown[];
			// Password should be hashed (starts with $argon2)
			const passwordParam = params.find(
				(p) => typeof p === 'string' && p.startsWith('$argon2')
			);
			expect(passwordParam).toBeDefined();
		}
	});

	it('should create default roles', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--site-name=test-site',
			'--db-url=postgresql://localhost:5432/test',
			'--admin-password=admin123',
		]);

		const calls = mockQuery.mock.calls;
		const roleInserts = calls.filter((call) => {
			const sql = call[0] as string;
			return sql.includes('INSERT INTO') && sql.includes('tab_role');
		});

		// Should create at least System Manager and Guest roles
		expect(roleInserts.length).toBeGreaterThanOrEqual(2);
	});

	it('should throw error if site name is missing', async () => {
		await expect(
			command.execute(['--db-url=postgresql://localhost:5432/test', '--admin-password=admin123'])
		).rejects.toThrow();
	});

	it('should throw error if db url is missing', async () => {
		await expect(
			command.execute(['--site-name=test-site', '--admin-password=admin123'])
		).rejects.toThrow();
	});

	it('should throw error if admin password is missing', async () => {
		await expect(
			command.execute([
				'--site-name=test-site',
				'--db-url=postgresql://localhost:5432/test',
			])
		).rejects.toThrow();
	});

	it('should use default admin email if not provided', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--site-name=test-site',
			'--db-url=postgresql://localhost:5432/test',
			'--admin-password=admin123',
		]);

		const calls = mockQuery.mock.calls;
		const userInsert = calls.find((call) => {
			const sql = call[0] as string;
			return sql.includes('INSERT INTO') && sql.includes('tab_user');
		});

		expect(userInsert).toBeDefined();
		if (userInsert) {
			const params = userInsert[1] as unknown[];
			// Should have an email parameter
			expect(params.some((p) => typeof p === 'string' && p.includes('@'))).toBe(true);
		}
	});
});

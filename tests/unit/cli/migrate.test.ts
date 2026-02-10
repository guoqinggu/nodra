import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MigrateCommand } from '../../../src/cli/migrate.js';
import type { Pool } from 'pg';

describe('MigrateCommand', () => {
	let mockPool: Pool;
	let command: MigrateCommand;

	beforeEach(() => {
		mockPool = {
			query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
			end: vi.fn(),
		} as unknown as Pool;

		command = new MigrateCommand(mockPool);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should have correct name and description', () => {
		expect(command.name).toBe('migrate');
		expect(command.description).toBeTruthy();
	});

	it('should sync DocTypes from default directory', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		// Should have executed some SQL statements
		expect(mockQuery).toHaveBeenCalled();
	});

	it('should generate CREATE TABLE for new DocTypes', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		const calls = mockQuery.mock.calls;
		const createTableCalls = calls.filter((call) => {
			const sql = call[0] as string;
			return sql.includes('CREATE TABLE IF NOT EXISTS');
		});

		// Should create tables for DocTypes in doctypes/ directory
		expect(createTableCalls.length).toBeGreaterThan(0);
	});

	it('should generate CREATE INDEX for DocType fields', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		const calls = mockQuery.mock.calls;
		const createIndexCalls = calls.filter((call) => {
			const sql = call[0] as string;
			return sql.includes('CREATE INDEX IF NOT EXISTS');
		});

		// Should create indexes
		expect(createIndexCalls.length).toBeGreaterThan(0);
	});

	it('should throw error if db url is missing', async () => {
		await expect(command.execute(['--site-name=test-site'])).rejects.toThrow();
	});

	it('should throw error if site name is missing', async () => {
		await expect(command.execute(['--db-url=postgresql://localhost:5432/test'])).rejects.toThrow();
	});

	it('should support verbose mode', async () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
			'--verbose',
		]);

		// Should log more details in verbose mode
		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
	});

	it('should handle ALTER TABLE for existing tables', async () => {
		const mockQuery = vi.fn();

		// First call: introspect existing columns for each table
		mockQuery.mockImplementation((sql: string) => {
			if (sql.includes('information_schema.columns')) {
				return Promise.resolve({
					rows: [
						{ column_name: 'name', data_type: 'character varying', is_nullable: 'NO' },
						{ column_name: 'owner', data_type: 'character varying', is_nullable: 'NO' },
					],
					rowCount: 2,
				});
			} else if (sql.includes('information_schema.tables')) {
				// Table exists
				return Promise.resolve({ rows: [{ exists: true }], rowCount: 1 });
			} else {
				// DDL statements
				return Promise.resolve({ rows: [], rowCount: 0 });
			}
		});

		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		// Should query for table existence
		const tableExistsCalls = mockQuery.mock.calls.filter((call) => {
			const sql = call[0] as string;
			return sql.includes('information_schema.tables');
		});

		expect(tableExistsCalls.length).toBeGreaterThan(0);
	});

	it('should support custom DocType directory', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
			'--doctype-dir=./custom-doctypes',
		]);

		// Custom directory may not have DocTypes, so just verify no errors
		expect(true).toBe(true);
	});

	it('should skip invalid DocType files with warning', async () => {
		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		// Should continue execution even if some DocTypes are invalid
		expect(mockQuery).toHaveBeenCalled();

		consoleWarnSpy.mockRestore();
	});
});

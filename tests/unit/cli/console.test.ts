import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsoleCommand } from '../../../src/cli/console.js';
import type { Pool } from 'pg';

describe('ConsoleCommand', () => {
	let mockPool: Pool;
	let command: ConsoleCommand;

	beforeEach(() => {
		mockPool = {
			query: vi.fn(),
			end: vi.fn(),
		} as unknown as Pool;

		command = new ConsoleCommand(mockPool);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should have correct name and description', () => {
		expect(command.name).toBe('console');
		expect(command.description).toBeTruthy();
	});

	it('should throw error if db url is missing', async () => {
		await expect(command.execute(['--site-name=test-site'])).rejects.toThrow();
	});

	it('should throw error if site name is missing', async () => {
		await expect(command.execute(['--db-url=postgresql://localhost:5432/test'])).rejects.toThrow();
	});

	it('should parse arguments correctly', () => {
		// Test argument parsing by checking error messages
		expect(() => {
			// Access private method through any
			(command as any).parseArgs(['--site-name=test-site']);
		}).toThrow('--db-url is required');

		expect(() => {
			(command as any).parseArgs(['--db-url=postgresql://localhost/test']);
		}).toThrow('--site-name is required');

		const options = (command as any).parseArgs([
			'--db-url=postgresql://localhost/test',
			'--site-name=mysite',
		]);

		expect(options.dbUrl).toBe('postgresql://localhost/test');
		expect(options.siteName).toBe('mysite');
	});

	it('should create context with expected properties', () => {
		const context = (command as any).createContext();

		expect(context).toHaveProperty('pool');
		expect(context).toHaveProperty('getDoc');
		expect(context).toHaveProperty('getList');
		expect(context).toHaveProperty('query');
		expect(context).toHaveProperty('help');
		expect(context.pool).toBe(mockPool);
	});

	it('should provide getDoc method in context', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [{ name: 'TEST-001' }] });
		mockPool.query = mockQuery;

		const context = (command as any).createContext();
		const result = await context.getDoc('Todo', 'TEST-001');

		expect(mockQuery).toHaveBeenCalled();
		expect(result).toEqual({ name: 'TEST-001' });
	});

	it('should provide getList method in context', async () => {
		const mockQuery = vi.fn().mockResolvedValue({
			rows: [{ name: 'TEST-001' }, { name: 'TEST-002' }],
		});
		mockPool.query = mockQuery;

		const context = (command as any).createContext();
		const result = await context.getList('Todo', { limit: 10 });

		expect(mockQuery).toHaveBeenCalled();
		expect(result).toHaveLength(2);
	});

	it('should provide direct query method in context', async () => {
		const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		mockPool.query = mockQuery;

		const context = (command as any).createContext();
		await context.query('SELECT * FROM tab_todo');

		expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tab_todo', undefined);
	});

	it('should provide help method in context', () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const context = (command as any).createContext();
		context.help();

		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
	});
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CLI Integration', () => {
	it('should export all command classes', async () => {
		const cliModule = await import('../../../src/cli/index.js');

		expect(cliModule.NewSiteCommand).toBeDefined();
		expect(cliModule.MigrateCommand).toBeDefined();
		expect(cliModule.StartCommand).toBeDefined();
		expect(cliModule.ConsoleCommand).toBeDefined();
	});

	it('should have consistent command interface', async () => {
		const { NewSiteCommand, MigrateCommand, StartCommand, ConsoleCommand } = await import(
			'../../../src/cli/index.js'
		);

		const mockPool = {} as any;

		const commands = [
			new NewSiteCommand(mockPool),
			new MigrateCommand(mockPool),
			new StartCommand(mockPool),
			new ConsoleCommand(mockPool),
		];

		for (const command of commands) {
			expect(command).toHaveProperty('name');
			expect(command).toHaveProperty('description');
			expect(command).toHaveProperty('execute');
			expect(typeof command.name).toBe('string');
			expect(typeof command.description).toBe('string');
			expect(typeof command.execute).toBe('function');
		}
	});

	it('should have unique command names', async () => {
		const { NewSiteCommand, MigrateCommand, StartCommand, ConsoleCommand } = await import(
			'../../../src/cli/index.js'
		);

		const mockPool = {} as any;

		const commands = [
			new NewSiteCommand(mockPool),
			new MigrateCommand(mockPool),
			new StartCommand(mockPool),
			new ConsoleCommand(mockPool),
		];

		const names = commands.map((cmd) => cmd.name);
		const uniqueNames = new Set(names);

		expect(uniqueNames.size).toBe(names.length);
	});

	it('should parse command-line arguments consistently', async () => {
		const { NewSiteCommand, MigrateCommand } = await import('../../../src/cli/index.js');

		const mockPool = {
			query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
			end: vi.fn(),
		} as any;

		const newSiteCmd = new NewSiteCommand(mockPool);
		const migrateCmd = new MigrateCommand(mockPool);

		// Both should reject when required args are missing
		await expect(newSiteCmd.execute([])).rejects.toThrow();
		await expect(migrateCmd.execute([])).rejects.toThrow();

		// Both should accept --db-url and --site-name
		await expect(
			newSiteCmd.execute([
				'--db-url=postgresql://localhost/test',
				'--site-name=test',
				'--admin-password=test123',
			])
		).resolves.not.toThrow();

		await expect(
			migrateCmd.execute(['--db-url=postgresql://localhost/test', '--site-name=test'])
		).resolves.not.toThrow();
	});

	it('should handle database errors gracefully', async () => {
		const { NewSiteCommand } = await import('../../../src/cli/index.js');

		const mockPool = {
			query: vi.fn().mockRejectedValue(new Error('Database connection failed')),
			end: vi.fn(),
		} as any;

		const command = new NewSiteCommand(mockPool);

		await expect(
			command.execute([
				'--db-url=postgresql://localhost/test',
				'--site-name=test',
				'--admin-password=test123',
			])
		).rejects.toThrow('Database connection failed');
	});
});

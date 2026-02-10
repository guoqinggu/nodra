import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StartCommand } from '../../../src/cli/start.js';
import type { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';

describe('StartCommand', () => {
	let mockPool: Pool;
	let mockServer: FastifyInstance;
	let command: StartCommand;

	beforeEach(() => {
		mockPool = {
			query: vi.fn(),
			end: vi.fn(),
		} as unknown as Pool;

		mockServer = {
			listen: vi.fn().mockResolvedValue(undefined),
			close: vi.fn().mockResolvedValue(undefined),
			register: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockReturnThis(),
			log: {
				info: vi.fn(),
				error: vi.fn(),
			},
		} as unknown as FastifyInstance;

		command = new StartCommand(mockPool, mockServer);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should have correct name and description', () => {
		expect(command.name).toBe('start');
		expect(command.description).toBeTruthy();
	});

	it('should start server on default port 3000', async () => {
		const mockListen = vi.fn().mockResolvedValue(undefined);
		mockServer.listen = mockListen;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		expect(mockListen).toHaveBeenCalledWith(
			expect.objectContaining({
				port: 3000,
				host: '0.0.0.0',
			})
		);
	});

	it('should start server on custom port', async () => {
		const mockListen = vi.fn().mockResolvedValue(undefined);
		mockServer.listen = mockListen;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
			'--port=8080',
		]);

		expect(mockListen).toHaveBeenCalledWith(
			expect.objectContaining({
				port: 8080,
			})
		);
	});

	it('should start server on custom host', async () => {
		const mockListen = vi.fn().mockResolvedValue(undefined);
		mockServer.listen = mockListen;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
			'--host=127.0.0.1',
		]);

		expect(mockListen).toHaveBeenCalledWith(
			expect.objectContaining({
				host: '127.0.0.1',
			})
		);
	});

	it('should throw error if db url is missing', async () => {
		await expect(command.execute(['--site-name=test-site'])).rejects.toThrow();
	});

	it('should throw error if site name is missing', async () => {
		await expect(command.execute(['--db-url=postgresql://localhost:5432/test'])).rejects.toThrow();
	});

	it('should log server start message', async () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const mockListen = vi.fn().mockResolvedValue(undefined);
		mockServer.listen = mockListen;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Server started on http://0.0.0.0:3000')
		);

		consoleSpy.mockRestore();
	});

	it('should handle server start errors', async () => {
		const mockListen = vi.fn().mockRejectedValue(new Error('Port already in use'));
		mockServer.listen = mockListen;

		await expect(
			command.execute([
				'--db-url=postgresql://localhost:5432/test',
				'--site-name=test-site',
			])
		).rejects.toThrow();
	});

	it('should register API routes', async () => {
		const mockRegister = vi.fn().mockResolvedValue(undefined);
		const mockListen = vi.fn().mockResolvedValue(undefined);
		mockServer.register = mockRegister;
		mockServer.listen = mockListen;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		// Should register plugins/routes
		expect(mockRegister).toHaveBeenCalled();
	});

	it('should register health check endpoint', async () => {
		const mockGet = vi.fn().mockReturnThis();
		const mockListen = vi.fn().mockResolvedValue(undefined);
		mockServer.get = mockGet;
		mockServer.listen = mockListen;

		await command.execute([
			'--db-url=postgresql://localhost:5432/test',
			'--site-name=test-site',
		]);

		// Should register /health endpoint
		expect(mockGet).toHaveBeenCalledWith('/health', expect.any(Function));
	});
});

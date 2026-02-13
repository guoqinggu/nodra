/**
 * Tests for API Method Routes
 *
 * Method routes allow calling whitelisted functions via POST /api/method/{path}
 * This is essential for the Desk frontend to call server-side business logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { methodRoutes } from '../../../src/api/method.js';
import { errorHandlerPlugin } from '../../../src/api/error-handler.js';
import { AuthenticationError, PermissionError, ValidationError } from '../../../src/core/errors.js';
import type { UserContext } from '../../../src/permissions/permission.js';

// ---------------------------------------------------------------------------
// Mock method registry
// ---------------------------------------------------------------------------

interface MethodDefinition {
  handler: (...args: unknown[]) => unknown;
  requireAuth: boolean;
  requiredRoles: string[];
}

class MethodRegistry {
  private methods = new Map<string, MethodDefinition>();

  register(
    path: string,
    handler: (...args: unknown[]) => unknown,
    options: { requireAuth?: boolean; requiredRoles?: string[] } = {},
  ): void {
    this.methods.set(path, {
      handler,
      requireAuth: options.requireAuth ?? true,
      requiredRoles: options.requiredRoles ?? [],
    });
  }

  get(path: string): MethodDefinition | undefined {
    return this.methods.get(path);
  }

  has(path: string): boolean {
    return this.methods.has(path);
  }

  clear(): void {
    this.methods.clear();
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockMethodRegistry(): MethodRegistry {
  return new MethodRegistry();
}

function createMockAuthMiddleware(user: UserContext | null = null) {
  return async (request: { user?: UserContext }, reply: unknown) => {
    if (user) {
      request.user = user;
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Method Routes - Basic Functionality', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    // Register error handler
    await app.register(errorHandlerPlugin);

    // Register method routes with mock registry
    app.decorateRequest('user', null);
    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should call a simple whitelisted method', async () => {
    methodRegistry.register('test.hello', () => {
      return { message: 'Hello World' };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.hello',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ message: 'Hello World' });
  });

  it('should pass arguments to the method handler', async () => {
    const handler = vi.fn().mockReturnValue({ result: 'success' });
    methodRegistry.register('test.calculate', handler);

    await app.inject({
      method: 'POST',
      url: '/api/method/test.calculate',
      payload: { a: 10, b: 20, operation: 'add' },
    });

    expect(handler).toHaveBeenCalledWith({ a: 10, b: 20, operation: 'add' });
  });

  it('should return 404 for non-existent method', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/method/nonexistent.method',
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.payload)).toMatchObject({
      error: 'Method not found',
    });
  });

  it('should handle method returning primitive values', async () => {
    methodRegistry.register('test.getCount', () => 42);

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.getCount',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ result: 42 });
  });

  it('should handle method returning arrays', async () => {
    methodRegistry.register('test.getList', () => ['item1', 'item2', 'item3']);

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.getList',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ result: ['item1', 'item2', 'item3'] });
  });
});

describe('Method Routes - Authentication', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    await app.register(errorHandlerPlugin);

    // Mock authentication middleware
    app.decorateRequest('user', null);
    app.addHook('preHandler', async (request) => {
      // Simulate auth middleware setting user
      const authHeader = request.headers.authorization;
      if (authHeader === 'Bearer valid-token') {
        request.user = {
          email: 'test@example.com',
          roles: ['User'],
        } as UserContext;
      }
    });

    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should allow access to public method without auth', async () => {
    methodRegistry.register(
      'public.status',
      () => ({ status: 'ok' }),
      { requireAuth: false },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/public.status',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject unauthenticated request to protected method', async () => {
    methodRegistry.register('protected.data', () => ({ secret: 'data' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/protected.data',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.payload)).toMatchObject({
      error: 'Authentication required',
    });
  });

  it('should allow authenticated request to protected method', async () => {
    methodRegistry.register('protected.data', () => ({ secret: 'data' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/protected.data',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ secret: 'data' });
  });
});

describe('Method Routes - Authorization', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    await app.register(errorHandlerPlugin);

    app.decorateRequest('user', null);
    app.addHook('preHandler', async (request) => {
      const authHeader = request.headers.authorization;
      if (authHeader === 'Bearer admin-token') {
        request.user = {
          email: 'admin@example.com',
          roles: ['Admin'],
        } as UserContext;
      } else if (authHeader === 'Bearer user-token') {
        request.user = {
          email: 'user@example.com',
          roles: ['User'],
        } as UserContext;
      }
    });

    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should allow access when user has required role', async () => {
    methodRegistry.register(
      'admin.only',
      () => ({ adminData: 'secret' }),
      { requiredRoles: ['Admin'] },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/admin.only',
      headers: { authorization: 'Bearer admin-token' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
  });

  it('should deny access when user lacks required role', async () => {
    methodRegistry.register(
      'admin.only',
      () => ({ adminData: 'secret' }),
      { requiredRoles: ['Admin'] },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/admin.only',
      headers: { authorization: 'Bearer user-token' },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toMatchObject({
      error: 'Permission denied',
    });
  });

  it('should allow access when user has one of multiple required roles', async () => {
    methodRegistry.register(
      'multi.role',
      () => ({ data: 'ok' }),
      { requiredRoles: ['Admin', 'Manager'] },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/multi.role',
      headers: { authorization: 'Bearer admin-token' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('Method Routes - Error Handling', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    await app.register(errorHandlerPlugin);
    app.decorateRequest('user', null);
    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should handle ValidationError from method', async () => {
    methodRegistry.register('test.validate', () => {
      throw new ValidationError('Invalid input', [
        { field: 'email', message: 'Invalid email format' },
      ]);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.validate',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toHaveLength(1);
  });

  it('should handle PermissionError from method', async () => {
    methodRegistry.register('test.permission', () => {
      throw new PermissionError('You cannot perform this action');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.permission',
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload).error).toBe('You cannot perform this action');
  });

  it('should handle unexpected errors with 500', async () => {
    methodRegistry.register('test.error', () => {
      throw new Error('Something went wrong');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.error',
      payload: {},
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.payload)).toHaveProperty('error');
  });

  it('should handle async method errors', async () => {
    methodRegistry.register('test.asyncError', async () => {
      await Promise.resolve();
      throw new Error('Async error');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.asyncError',
      payload: {},
    });

    expect(response.statusCode).toBe(500);
  });
});

describe('Method Routes - Request Validation', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    await app.register(errorHandlerPlugin);
    app.decorateRequest('user', null);
    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should parse JSON payload correctly', async () => {
    const handler = vi.fn().mockReturnValue({});
    methodRegistry.register('test.payload', handler);

    await app.inject({
      method: 'POST',
      url: '/api/method/test.payload',
      payload: { name: 'John', age: 30 },
      headers: { 'content-type': 'application/json' },
    });

    expect(handler).toHaveBeenCalledWith({ name: 'John', age: 30 });
  });

  it('should handle empty payload', async () => {
    const handler = vi.fn().mockReturnValue({});
    methodRegistry.register('test.empty', handler);

    await app.inject({
      method: 'POST',
      url: '/api/method/test.empty',
    });

    expect(handler).toHaveBeenCalledWith({});
  });

  it('should handle nested objects in payload', async () => {
    const handler = vi.fn().mockReturnValue({});
    methodRegistry.register('test.nested', handler);

    const payload = {
      user: { name: 'John', address: { city: 'NYC' } },
      items: [{ id: 1 }, { id: 2 }],
    };

    await app.inject({
      method: 'POST',
      url: '/api/method/test.nested',
      payload,
    });

    expect(handler).toHaveBeenCalledWith(payload);
  });
});

describe('Method Routes - Method Path Format', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    await app.register(errorHandlerPlugin);
    app.decorateRequest('user', null);
    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should support dot notation paths', async () => {
    methodRegistry.register('frappe.client.get', () => ({ data: 'test' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/frappe.client.get',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
  });

  it('should support nested paths', async () => {
    methodRegistry.register('app.module.submodule.action', () => ({ result: 'ok' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/app.module.submodule.action',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject invalid path characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/method/invalid@path#here',
      payload: {},
    });

    // Should either 404 or sanitize the path
    expect([400, 404]).toContain(response.statusCode);
  });
});

describe('Method Routes - Response Format', () => {
  let app: ReturnType<typeof Fastify>;
  let methodRegistry: MethodRegistry;

  beforeEach(async () => {
    app = Fastify();
    methodRegistry = createMockMethodRegistry();

    await app.register(errorHandlerPlugin);
    app.decorateRequest('user', null);
    methodRoutes(app, methodRegistry as unknown as Parameters<typeof methodRoutes>[1]);
  });

  it('should return JSON with correct content-type', async () => {
    methodRegistry.register('test.json', () => ({ data: 'test' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.json',
      payload: {},
    });

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should wrap primitive return values', async () => {
    methodRegistry.register('test.string', () => 'hello');

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.string',
      payload: {},
    });

    expect(JSON.parse(response.payload)).toEqual({ result: 'hello' });
  });

  it('should handle null return value', async () => {
    methodRegistry.register('test.null', () => null);

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.null',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ result: null });
  });

  it('should handle undefined return value', async () => {
    methodRegistry.register('test.undefined', () => undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/api/method/test.undefined',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({});
  });
});

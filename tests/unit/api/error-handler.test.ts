import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { errorHandlerPlugin } from '../../../src/api/error-handler.js';
import {
  ValidationError,
  NotFoundError,
  PermissionError,
  AuthenticationError,
  DuplicateError,
  DatabaseError,
  NodraError,
} from '../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Fastify instance with the error handler plugin and a test route
 * that throws the given error.
 */
function buildApp(errorToThrow: Error) {
  const app = Fastify();
  errorHandlerPlugin(app);

  app.get('/test', () => {
    throw errorToThrow;
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('errorHandlerPlugin', () => {
  it('should return 400 with details for ValidationError', async () => {
    const err = new ValidationError('Title is required', {
      details: [{ field: 'title', message: 'This field is required' }],
    });
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'ValidationError',
        message: 'Title is required',
        details: [{ field: 'title', message: 'This field is required' }],
      },
    });
  });

  it('should return 404 for NotFoundError', async () => {
    const err = new NotFoundError('Todo', 'TODO-0001');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'NotFoundError',
        message: 'Todo "TODO-0001" not found',
      },
    });
  });

  it('should return 403 for PermissionError', async () => {
    const err = new PermissionError('Not allowed', { doctype: 'Todo', action: 'write' });
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'PermissionError',
        message: 'Not allowed',
      },
    });
  });

  it('should return 401 for AuthenticationError', async () => {
    const err = new AuthenticationError('Invalid token');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'AuthenticationError',
        message: 'Invalid token',
      },
    });
  });

  it('should return 409 for DuplicateError', async () => {
    const err = new DuplicateError('Todo', 'TODO-0001');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'DuplicateError',
        message: 'Todo "TODO-0001" already exists',
      },
    });
  });

  it('should return 500 for DatabaseError', async () => {
    const err = new DatabaseError('connection lost');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'DatabaseError',
        message: 'connection lost',
      },
    });
  });

  it('should return 500 with generic message for unknown errors', async () => {
    const err = new Error('something bad happened');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'InternalError',
        message: 'Internal server error',
      },
    });
  });

  it('should never expose stack traces in responses', async () => {
    const err = new Error('sensitive stack info');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = res.json();

    expect(body.error.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('should set correct content-type header', async () => {
    const err = new ValidationError('bad');
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.headers['content-type']).toContain('application/json');
  });

  it('should handle NodraError base class with custom httpStatus', async () => {
    const err = new NodraError('custom error', 418);
    const app = buildApp(err);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(418);
    const body = res.json();
    expect(body).toEqual({
      error: {
        type: 'NodraError',
        message: 'custom error',
      },
    });
  });

  it('should include details only when present on ValidationError', async () => {
    const errNoDetails = new ValidationError('just a message');
    const app = buildApp(errNoDetails);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    // details should not be present when it's an empty array
    expect(body.error.details).toBeUndefined();
  });
});

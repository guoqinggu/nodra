/**
 * Method Routes - Whitelisted API Method Endpoints
 *
 * Allows calling registered server-side functions via POST /api/method/{path}
 * Used by Desk frontend to execute business logic.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserContext } from '../permissions/permission.js';
import { NodraError } from '../core/errors.js';

/**
 * Method definition structure
 */
export interface MethodDefinition {
  /** The handler function */
  handler: (...args: unknown[]) => unknown;
  /** Whether authentication is required */
  requireAuth: boolean;
  /** Required roles to access this method */
  requiredRoles: string[];
}

/**
 * Method registry interface
 */
export interface MethodRegistry {
  /** Register a method */
  register(
    path: string,
    handler: (...args: unknown[]) => unknown,
    options?: { requireAuth?: boolean; requiredRoles?: string[] }
  ): void;
  /** Get method definition */
  get(path: string): MethodDefinition | undefined;
  /** Check if method exists */
  has(path: string): boolean;
}

/**
 * Default implementation of MethodRegistry
 */
export class DefaultMethodRegistry implements MethodRegistry {
  private methods = new Map<string, MethodDefinition>();

  register(
    path: string,
    handler: (...args: unknown[]) => unknown,
    options: { requireAuth?: boolean; requiredRoles?: string[] } = {}
  ): void {
    this.methods.set(path, {
      handler,
      requireAuth: options.requireAuth ?? false,
      requiredRoles: options.requiredRoles ?? [],
    });
  }

  get(path: string): MethodDefinition | undefined {
    return this.methods.get(path);
  }

  has(path: string): boolean {
    return this.methods.has(path);
  }

  /** Clear all registered methods (useful for testing) */
  clear(): void {
    this.methods.clear();
  }
}

/**
 * Get user context from request (set by auth middleware)
 * Returns undefined if user property doesn't exist (auth not configured)
 */
function getUserFromRequest(request: FastifyRequest): UserContext | null | undefined {
  const req = request as unknown as { user?: UserContext };
  return req.user;
}

/**
 * Check if user has any of the required roles
 */
function hasRequiredRole(user: UserContext, requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.some((role) => user.roles.includes(role));
}

/**
 * Format method result for JSON response
 * - Plain objects are returned as-is
 * - Arrays, primitives, null are wrapped in { result: ... }
 * - Undefined returns empty object
 */
function formatResult(result: unknown): unknown {
  if (result === undefined) {
    return {};
  }

  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    return { result };
  }

  return result;
}

/**
 * Register method routes on Fastify instance
 *
 * @param app - Fastify instance
 * @param registry - Method registry
 */
export function methodRoutes(
  app: FastifyInstance,
  registry: MethodRegistry
): void {
  // POST /api/method/:methodPath
  app.post<{ Params: { methodPath: string } }>(
    '/api/method/:methodPath',
    async (
      request: FastifyRequest<{ Params: { methodPath: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { methodPath } = request.params;

        // Check if method exists
        if (!registry.has(methodPath)) {
          return reply.status(404).send({
            error: 'Method not found',
          });
        }

        const methodDef = registry.get(methodPath)!;

        // Check authentication if required
        if (methodDef.requireAuth) {
          const user = getUserFromRequest(request);
          // Only reject if auth middleware has run (user property exists) but no valid user
          if (user === null) {
            return reply.status(401).send({
              error: 'Authentication required',
            });
          }

          // Check role authorization (skip if auth not configured - user is undefined)
          if (user && !hasRequiredRole(user, methodDef.requiredRoles)) {
            return reply.status(403).send({
              error: 'Permission denied',
            });
          }
        }

        // Call the handler with request body as argument
        const result = await methodDef.handler(request.body || {});

        // Return formatted result
        return reply.send(formatResult(result));
      } catch (error) {
        // Handle NodraError types directly
        if (error instanceof NodraError) {
          const errorObj: Record<string, unknown> = {
            type: error.name,
            message: error.message,
          };
          if ('details' in error && Array.isArray((error as {details: unknown}).details)) {
            errorObj['details'] = (error as {details: unknown}).details;
          }
          return reply.status(error.httpStatus).send({ error: errorObj });
        }
        // Re-throw other errors to let error handler plugin handle them
        throw error;
      }
    }
  );
}

/**
 * Nodra Framework - Error Handler Plugin
 *
 * Fastify plugin that converts NodraError instances to structured
 * HTTP error responses. Unknown errors are mapped to 500 with a
 * generic message to avoid leaking internal details.
 */

import type { FastifyInstance } from 'fastify';
import { NodraError, ValidationError } from '../core/errors.js';

/**
 * Register a Fastify error handler that converts framework errors
 * into a consistent JSON response format:
 *
 * ```json
 * { "error": { "type": "...", "message": "...", "details?": [...] } }
 * ```
 */
export function errorHandlerPlugin(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof NodraError) {
      const body: Record<string, unknown> = {
        type: error.name,
        message: error.message,
      };

      // Include details only for ValidationError with non-empty details
      if (error instanceof ValidationError && error.details.length > 0) {
        body['details'] = error.details;
      }

      return reply.status(error.httpStatus).send({ error: body });
    }

    // Unknown error → 500 with generic message (never expose internals)
    return reply.status(500).send({
      error: {
        type: 'InternalError',
        message: 'Internal server error',
      },
    });
  });
}

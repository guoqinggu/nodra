/**
 * Nodra Framework - Resource Routes
 *
 * Auto-generated CRUD REST endpoints for any registered DocType.
 * Routes are mounted under `/api/resource/:doctype`.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ORM, ListOptions } from '../orm/crud.js';
import type { DocTypeRegistry } from '../core/doctype/registry.js';
import { Document } from '../core/document/document.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_LENGTH = 20;

/**
 * Validate that a DocType is registered. Throws (via registry.get) if not,
 * which the error handler plugin will translate to a 404.
 */
function ensureDocType(registry: DocTypeRegistry, doctype: string): void {
  registry.get(doctype); // throws NotFoundError if missing
}

/**
 * Serialise a Document (or mock) to a plain data object for JSON responses.
 */
function serialise(doc: unknown): Record<string, unknown> {
  if (doc && typeof doc === 'object' && 'getData' in doc && typeof (doc as { getData: unknown }).getData === 'function') {
    return (doc as { getData(): Record<string, unknown> }).getData();
  }
  return doc as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function resourceRoutes(
  app: FastifyInstance,
  orm: ORM,
  registry: DocTypeRegistry,
): void {
  // -----------------------------------------------------------------------
  // GET /api/resource/:doctype — list
  // -----------------------------------------------------------------------

  app.get(
    '/api/resource/:doctype',
    async (
      request: FastifyRequest<{
        Params: { doctype: string };
        Querystring: {
          fields?: string;
          filters?: string;
          order_by?: string;
          limit_start?: string;
          limit_page_length?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { doctype } = request.params;
      ensureDocType(registry, doctype);

      const query = request.query;

      const limit = query.limit_page_length
        ? parseInt(query.limit_page_length, 10)
        : DEFAULT_PAGE_LENGTH;
      const offset = query.limit_start
        ? parseInt(query.limit_start, 10)
        : 0;

      const options: ListOptions = { limit, offset };

      if (query.fields) {
        options.fields = query.fields.split(',').map((f) => f.trim());
      }

      if (query.filters) {
        try {
          options.filters = JSON.parse(query.filters) as Record<string, unknown>;
        } catch {
          // Ignore malformed filters — treat as no filters
        }
      }

      if (query.order_by) {
        options.orderBy = query.order_by;
      }

      const [docs, totalCount] = await Promise.all([
        orm.getList(doctype, options),
        orm.getCount(doctype, options.filters),
      ]);

      return reply.send({
        data: docs.map(serialise),
        meta: {
          total_count: totalCount,
          limit,
          offset,
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/resource/:doctype/:name — get single
  // -----------------------------------------------------------------------

  app.get(
    '/api/resource/:doctype/:name',
    async (
      request: FastifyRequest<{ Params: { doctype: string; name: string } }>,
      reply: FastifyReply,
    ) => {
      const { doctype, name } = request.params;
      ensureDocType(registry, doctype);

      const doc = await orm.getDoc(doctype, name);
      return reply.send({ data: serialise(doc) });
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/resource/:doctype — create
  // -----------------------------------------------------------------------

  app.post(
    '/api/resource/:doctype',
    async (
      request: FastifyRequest<{ Params: { doctype: string }; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const { doctype } = request.params;
      const meta = registry.get(doctype); // validates + retrieves

      const body = (request.body ?? {}) as Record<string, unknown>;
      const doc = new Document(meta, body);
      const inserted = await orm.insert(doc);

      return reply.status(201).send({ data: serialise(inserted) });
    },
  );

  // -----------------------------------------------------------------------
  // PUT /api/resource/:doctype/:name — update
  // -----------------------------------------------------------------------

  app.put(
    '/api/resource/:doctype/:name',
    async (
      request: FastifyRequest<{
        Params: { doctype: string; name: string };
        Body: Record<string, unknown>;
      }>,
      reply: FastifyReply,
    ) => {
      const { doctype, name } = request.params;
      ensureDocType(registry, doctype);

      // Fetch existing document, apply changes, then update
      const doc = await orm.getDoc(doctype, name);
      const body = (request.body ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        doc.set(key, value);
      }

      const updated = await orm.update(doc);
      return reply.send({ data: serialise(updated) });
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /api/resource/:doctype/:name — delete
  // -----------------------------------------------------------------------

  app.delete(
    '/api/resource/:doctype/:name',
    async (
      request: FastifyRequest<{ Params: { doctype: string; name: string } }>,
      reply: FastifyReply,
    ) => {
      const { doctype, name } = request.params;
      ensureDocType(registry, doctype);

      await orm.deleteDoc(doctype, name);
      return reply.send({ message: 'ok' });
    },
  );
}

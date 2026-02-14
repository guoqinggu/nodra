/**
 * Nodra Framework - ORM CRUD Layer
 *
 * Provides high-level data operations (insert, get, getList, update, delete)
 * that combine lifecycle hooks, validation, and database access.
 */

import type { Database } from '../database/connection.js';
import type { DocTypeRegistry } from '../core/doctype/registry.js';
import type { DocTypeDefinition } from '../core/doctype/schema.js';
import { Document } from '../core/document/document.js';
import { validateDocument } from '../core/validation/validator.js';
import { toTableName } from '../core/doctype/naming.js';
import { generateHash } from '../core/doctype/naming.js';
import { NotFoundError } from '../core/errors.js';
import { QueryBuilder } from '../database/query-builder.js';

/**
 * Options for the getList operation.
 */
export interface ListOptions {
  filters?: Record<string, unknown>;
  fields?: string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

/** Default user for auto-populated fields when no session context is available. */
const DEFAULT_USER = 'Administrator';

/**
 * High-level ORM providing CRUD operations with lifecycle hooks and validation.
 */
export class ORM {
  private readonly db: Database;
  private readonly registry: DocTypeRegistry;

  constructor(db: Database, registry: DocTypeRegistry) {
    this.db = db;
    this.registry = registry;
  }

  get database(): Database {
    return this.db;
  }

  // ---------------------------------------------------------------------------
  // insert
  // ---------------------------------------------------------------------------

  /**
   * Insert a new Document into the database.
   *
   * Lifecycle: beforeValidate → validate → beforeInsert → beforeSave → DB INSERT → afterSave → afterInsert
   *
   * Auto-populates: name, owner, creation, modified, modified_by, docstatus.
   */
  async insert(doc: Document): Promise<Document> {
    const meta = this.registry.get(doc.doctype);
    const now = new Date();

    // Auto-populate standard fields
    if (!doc.name) {
      doc.name = this.generateName(meta);
    }
    if (!doc.owner) {
      doc.owner = DEFAULT_USER;
    }
    doc.creation = now;
    doc.modified = now;
    if (!doc.modified_by) {
      doc.modified_by = doc.owner;
    }

    // Lifecycle: pre-validation
    await doc.beforeValidate();
    await doc.validate();

    // Framework validation
    validateDocument(doc, meta);

    // Lifecycle: pre-insert/save
    await doc.beforeInsert();
    await doc.beforeSave();

    // Build INSERT data
    const data = this.buildInsertData(doc, meta);
    const tableName = toTableName(doc.doctype);
    const qb = new QueryBuilder(tableName).insert(data);
    const { sql, params } = qb.build();

    const rows = await this.db.query<Record<string, unknown>>(sql, params);
    const row = rows[0];

    // Apply returned data to document
    if (row) {
      this.applyRowToDocument(doc, row);
    }

    // Mark as persisted
    doc.setIsNew(false);
    doc.markAsClean();

    // Lifecycle: post-save/insert
    await doc.afterSave();
    await doc.afterInsert();

    return doc;
  }

  // ---------------------------------------------------------------------------
  // getDoc
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single document by doctype and name.
   *
   * @throws {NotFoundError} If the document does not exist.
   */
  async getDoc(doctype: string, name: string): Promise<Document> {
    const meta = this.registry.get(doctype);
    const tableName = toTableName(doctype);

    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM ${tableName} WHERE name = $1`,
      [name],
    );

    if (!row) {
      throw new NotFoundError(doctype, name);
    }

    return this.rowToDocument(meta, row);
  }

  // ---------------------------------------------------------------------------
  // getList
  // ---------------------------------------------------------------------------

  /**
   * Fetch a list of documents with optional filters, fields, ordering, and pagination.
   */
  async getList(doctype: string, options?: ListOptions): Promise<Document[]> {
    const meta = this.registry.get(doctype);
    const tableName = toTableName(doctype);

    const qb = new QueryBuilder(tableName);

    // Select fields
    if (options?.fields && options.fields.length > 0) {
      qb.select(...options.fields);
    } else {
      qb.select('*');
    }

    // Filters
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        qb.where(key, '=', value);
      }
    }

    // Order by
    if (options?.orderBy) {
      const parts = options.orderBy.split(/\s+/);
      const column = parts[0]!;
      const direction = (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
      qb.orderBy(column, direction);
    }

    // Pagination
    if (options?.limit !== undefined) {
      qb.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      qb.offset(options.offset);
    }

    const { sql, params } = qb.build();
    const rows = await this.db.query<Record<string, unknown>>(sql, params);

    return rows.map((row) => this.rowToDocument(meta, row));
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  /**
   * Update an existing Document in the database.
   *
   * Lifecycle: beforeValidate → validate → beforeSave → DB UPDATE → afterSave → onChange
   *
   * Updates the modified timestamp automatically.
   */
  async update(doc: Document): Promise<Document> {
    const meta = this.registry.get(doc.doctype);
    const now = new Date();
    const tableName = toTableName(doc.doctype);

    // Update modified timestamp
    doc.modified = now;
    doc.modified_by = doc.modified_by || DEFAULT_USER;

    // Lifecycle: pre-validation
    await doc.beforeValidate();
    await doc.validate();

    // Framework validation
    validateDocument(doc, meta);

    // Lifecycle: pre-save
    await doc.beforeSave();

    // Build UPDATE data (all custom + standard mutable fields)
    const data = this.buildUpdateData(doc, meta);
    const qb = new QueryBuilder(tableName)
      .update(data)
      .where('name', '=', doc.name);
    const { sql, params } = qb.build();

    const rows = await this.db.query<Record<string, unknown>>(sql + ' RETURNING *', params);
    const row = rows[0];

    if (row) {
      this.applyRowToDocument(doc, row);
    }

    doc.markAsClean();

    // Lifecycle: post-save + onChange
    await doc.afterSave();
    await doc.onChange();

    return doc;
  }

  // ---------------------------------------------------------------------------
  // deleteDoc
  // ---------------------------------------------------------------------------

  /**
   * Delete a document from the database.
   *
   * Lifecycle: beforeDelete → DB DELETE → afterDelete
   *
   * @throws {NotFoundError} If the document does not exist.
   */
  async deleteDoc(doctype: string, name: string): Promise<void> {
    const doc = await this.getDoc(doctype, name);
    const tableName = toTableName(doctype);

    // Lifecycle: pre-delete
    await doc.beforeDelete();

    // DB DELETE
    await this.db.execute(
      `DELETE FROM ${tableName} WHERE name = $1`,
      [name],
    );

    // Lifecycle: post-delete
    await doc.afterDelete();
  }

  // ---------------------------------------------------------------------------
  // getCount
  // ---------------------------------------------------------------------------

  /**
   * Get the count of documents matching optional filters.
   */
  async getCount(doctype: string, filters?: Record<string, unknown>): Promise<number> {
    this.registry.get(doctype); // validate doctype exists
    const tableName = toTableName(doctype);

    const qb = new QueryBuilder(tableName).count();

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        qb.where(key, '=', value);
      }
    }

    const { sql, params } = qb.build();
    const row = await this.db.queryOne<{ count: string }>(sql, params);

    return Number(row?.count ?? 0);
  }

  // ---------------------------------------------------------------------------
  // getValue
  // ---------------------------------------------------------------------------

  /**
   * Get a single field value from a document.
   *
   * @returns The field value, or undefined if the document is not found.
   */
  async getValue(doctype: string, name: string, fieldname: string): Promise<unknown> {
    this.registry.get(doctype); // validate doctype exists
    const tableName = toTableName(doctype);

    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT ${fieldname} FROM ${tableName} WHERE name = $1`,
      [name],
    );

    if (!row) {
      return undefined;
    }

    return row[fieldname];
  }

  // ---------------------------------------------------------------------------
  // setValue
  // ---------------------------------------------------------------------------

  /**
   * Set a single field value for a document and update the modified timestamp.
   */
  async setValue(
    doctype: string,
    name: string,
    fieldname: string,
    value: unknown,
  ): Promise<void> {
    this.registry.get(doctype); // validate doctype exists
    const tableName = toTableName(doctype);
    const now = new Date();

    await this.db.execute(
      `UPDATE ${tableName} SET ${fieldname} = $1, modified = $2 WHERE name = $3`,
      [value, now, name],
    );
  }

  // ---------------------------------------------------------------------------
  // exists
  // ---------------------------------------------------------------------------

  /**
   * Check whether a document exists.
   */
  async exists(doctype: string, name: string): Promise<boolean> {
    this.registry.get(doctype); // validate doctype exists
    const tableName = toTableName(doctype);

    const row = await this.db.queryOne<{ name: string }>(
      `SELECT name FROM ${tableName} WHERE name = $1`,
      [name],
    );

    return row !== null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a document name based on the naming rule.
   * For now, supports 'hash' and falls back to hash for others.
   */
  private generateName(meta: DocTypeDefinition): string {
    switch (meta.naming_rule) {
      case 'hash':
        return generateHash(10);
      case 'autoincrement':
        // Autoincrement is handled by the DB, but we need a placeholder.
        // In a real implementation this would use a sequence. Use hash as fallback.
        return generateHash(10);
      default:
        return generateHash(10);
    }
  }

  /**
   * Build the data object for an INSERT operation.
   */
  private buildInsertData(
    doc: Document,
    meta: DocTypeDefinition,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      name: doc.name,
      owner: doc.owner,
      creation: doc.creation,
      modified: doc.modified,
      modified_by: doc.modified_by,
      docstatus: doc.docstatus,
      idx: doc.idx,
    };

    // Add custom field values
    for (const field of meta.fields) {
      const value = doc.get(field.fieldname);
      if (value !== undefined) {
        data[field.fieldname] = value;
      }
    }

    return data;
  }

  /**
   * Build the data object for an UPDATE operation.
   */
  private buildUpdateData(
    doc: Document,
    meta: DocTypeDefinition,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      modified: doc.modified,
      modified_by: doc.modified_by,
    };

    // Include all custom fields that have values
    for (const field of meta.fields) {
      const value = doc.get(field.fieldname);
      if (value !== undefined) {
        data[field.fieldname] = value;
      }
    }

    return data;
  }

  /**
   * Convert a database row to a Document instance, marked as not new.
   */
  private rowToDocument(
    meta: DocTypeDefinition,
    row: Record<string, unknown>,
  ): Document {
    const doc = new Document(meta, { ...row, _isNew: false });
    doc.markAsClean();
    return doc;
  }

  /**
   * Apply returned database row values to an existing Document.
   */
  private applyRowToDocument(
    doc: Document,
    row: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(row)) {
      doc.set(key, value);
    }
  }
}

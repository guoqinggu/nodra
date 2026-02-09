/**
 * Nodra Framework - Schema Sync Engine
 *
 * Generates SQL DDL (CREATE TABLE, CREATE INDEX, ALTER TABLE) from
 * DocType definitions. Does NOT execute SQL — it only produces strings.
 * This separation makes the engine easy to test without a database.
 */

import { toTableName } from '../core/doctype/naming.js';
import { getPgType, isDataField } from '../core/doctype/field-types.js';
import type { DocTypeDefinition, FieldDefinition } from '../core/doctype/schema.js';

// --- Public types ---

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;       // 'YES' or 'NO'
  column_default: string | null;
}

// --- Reserved words that need quoting ---

const PG_RESERVED_WORDS = new Set([
  'user', 'order', 'group', 'table', 'select', 'insert', 'update', 'delete',
  'check', 'index', 'constraint', 'primary', 'foreign', 'references', 'default',
  'column', 'limit', 'offset', 'where', 'from', 'join', 'on', 'and', 'or',
  'not', 'null', 'in', 'like', 'between', 'as', 'all', 'any', 'exists',
  'having', 'union', 'except', 'intersect', 'case', 'when', 'then', 'else',
  'end', 'create', 'alter', 'drop', 'grant', 'revoke', 'with', 'do',
]);

/**
 * Quote a column name if it's a PostgreSQL reserved word.
 */
function quoteIdent(name: string): string {
  if (PG_RESERVED_WORDS.has(name.toLowerCase())) {
    return `"${name}"`;
  }
  return name;
}

// --- SchemaSync class ---

export class SchemaSync {
  /**
   * Generate a CREATE TABLE IF NOT EXISTS statement for a DocType.
   */
  generateCreateTable(doctype: DocTypeDefinition): string {
    const tableName = toTableName(doctype.name);
    const columnDefs: string[] = [];

    // Standard columns
    columnDefs.push(...this.getStandardColumnDefs());

    // Child table columns
    if (doctype.is_child) {
      columnDefs.push(...this.getChildColumnDefs());
    }

    // Custom field columns
    for (const field of doctype.fields) {
      const colDef = this.fieldToColumnDef(field);
      if (colDef) {
        columnDefs.push(colDef);
      }
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnDefs.join(',\n  ')}\n)`;
  }

  /**
   * Generate CREATE INDEX IF NOT EXISTS statements for a DocType.
   */
  generateIndexes(doctype: DocTypeDefinition): string[] {
    const tableName = toTableName(doctype.name);
    const indexes: string[] = [];

    // Standard indexes: modified, owner
    indexes.push(this.createIndexSql(tableName, 'modified'));
    indexes.push(this.createIndexSql(tableName, 'owner'));

    // Child table indexes: parent, parenttype
    if (doctype.is_child) {
      indexes.push(this.createIndexSql(tableName, 'parent'));
      indexes.push(this.createIndexSql(tableName, 'parenttype'));
    }

    // Link fields and search_index fields
    for (const field of doctype.fields) {
      if (!isDataField(field.fieldtype)) {
        continue;
      }

      const needsIndex =
        field.fieldtype === 'Link' ||
        field.fieldtype === 'DynamicLink' ||
        field.search_index === true;

      if (needsIndex) {
        indexes.push(this.createIndexSql(tableName, field.fieldname));
      }
    }

    return indexes;
  }

  /**
   * Compare a DocType definition with existing database columns and generate
   * ALTER TABLE ADD COLUMN statements for new fields.
   *
   * Safety: this method NEVER generates DROP COLUMN.
   */
  generateAlterTable(doctype: DocTypeDefinition, existingColumns: ColumnInfo[]): string[] {
    const tableName = toTableName(doctype.name);
    const existingColumnNames = new Set(existingColumns.map((c) => c.column_name));
    const alterStatements: string[] = [];

    // Collect all columns that the DocType needs
    const requiredFields = this.getAllFields(doctype);

    for (const field of requiredFields) {
      if (!isDataField(field.fieldtype)) {
        continue;
      }

      if (!existingColumnNames.has(field.fieldname)) {
        const pgType = getPgType(field.fieldtype, field.max_length);
        if (!pgType) continue;

        let colDef = `${quoteIdent(field.fieldname)} ${pgType}`;
        if (field.reqd) {
          colDef += ' NOT NULL';
        }
        if (field.unique) {
          colDef += ' UNIQUE';
        }
        if (field.default !== undefined) {
          colDef += ` DEFAULT ${this.formatDefault(field.default)}`;
        }

        alterStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${colDef}`);
      }
    }

    return alterStatements;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getStandardColumnDefs(): string[] {
    return [
      'name VARCHAR(255) PRIMARY KEY',
      'owner VARCHAR(255) NOT NULL',
      'creation TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      'modified TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      'modified_by VARCHAR(255) NOT NULL',
      'docstatus SMALLINT NOT NULL DEFAULT 0',
      'idx INTEGER NOT NULL DEFAULT 0',
    ];
  }

  private getChildColumnDefs(): string[] {
    return [
      'parent VARCHAR(255)',
      'parenttype VARCHAR(255)',
      'parentfield VARCHAR(255)',
    ];
  }

  /**
   * Convert a FieldDefinition to a SQL column definition string.
   * Returns null for virtual fields (Table, ReadOnly) that have no column.
   */
  private fieldToColumnDef(field: FieldDefinition): string | null {
    if (!isDataField(field.fieldtype)) {
      return null;
    }

    const pgType = getPgType(field.fieldtype, field.max_length);
    if (!pgType) return null;

    let def = `${quoteIdent(field.fieldname)} ${pgType}`;

    if (field.reqd) {
      def += ' NOT NULL';
    }
    if (field.unique) {
      def += ' UNIQUE';
    }
    if (field.default !== undefined) {
      def += ` DEFAULT ${this.formatDefault(field.default)}`;
    }

    return def;
  }

  /**
   * Format a default value for SQL.
   */
  private formatDefault(value: unknown): string {
    if (typeof value === 'string') {
      // Escape single quotes in strings
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (value === null) {
      return 'NULL';
    }
    return `'${String(value)}'`;
  }

  /**
   * Create a single CREATE INDEX IF NOT EXISTS statement.
   */
  private createIndexSql(tableName: string, columnName: string): string {
    const indexName = `idx_${tableName}_${columnName}`;
    return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${quoteIdent(columnName)})`;
  }

  /**
   * Get all fields for a DocType, including only the custom fields
   * (standard and child fields are handled separately).
   */
  private getAllFields(doctype: DocTypeDefinition): FieldDefinition[] {
    return doctype.fields;
  }
}

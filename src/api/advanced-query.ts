import type { Database } from '../database/connection.js';
import { toTableName } from '../core/doctype/naming.js';
import { Parser } from 'json2csv';

export interface SearchOptions {
  doctype: string;
  searchText: string;
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface AggregateOptions {
  doctype: string;
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: string;
}

export interface ExportOptions {
  doctype: string;
  format: 'json' | 'csv' | 'xlsx';
  fields?: string[];
  filters?: Record<string, unknown>;
}

export async function fullTextSearch(db: Database, options: SearchOptions) {
  const { doctype, searchText, fields, limit = 20, offset = 0 } = options;
  const tableName = toTableName(doctype);

  const searchFields = fields && fields.length > 0 ? fields : ['name'];
  const conditions = searchFields.map((f) => `${f} ILIKE $1`).join(' OR ');
  const param = `%${searchText}%`;

  const sql = `
    SELECT * FROM ${tableName}
    WHERE (${conditions})
    LIMIT $2 OFFSET $3
  `;

  const rows = await db.query(sql, [param, limit, offset]);
  return rows;
}

export async function aggregateQuery(db: Database, options: AggregateOptions) {
  const { doctype, field, operation, groupBy } = options;
  const tableName = toTableName(doctype);

  const validOps = ['count', 'sum', 'avg', 'min', 'max'];
  const op = validOps.includes(operation) ? operation : 'count';
  const aggField = op === 'count' ? '*' : field;

  let sql: string;
  if (groupBy) {
    sql = `SELECT ${groupBy}, ${op}(${aggField}) as value FROM ${tableName} GROUP BY ${groupBy}`;
  } else {
    sql = `SELECT ${op}(${aggField}) as value FROM ${tableName}`;
  }

  const rows = await db.query(sql);
  return rows;
}

export async function exportData(db: Database, options: ExportOptions) {
  const { doctype, format, fields, filters } = options;
  const tableName = toTableName(doctype);

  let sql = 'SELECT ';
  sql += fields && fields.length > 0 ? fields.join(', ') : '*';
  sql += ` FROM ${tableName}`;

  const params: unknown[] = [];
  if (filters && Object.keys(filters).length > 0) {
    const conditions = Object.keys(filters).map((key, i) => {
      params.push(filters[key]);
      return `${key} = $${i + 1}`;
    });
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const rows = await db.query(sql, params);

  switch (format) {
    case 'json':
      return JSON.stringify(rows, null, 2);
    case 'csv':
      return convertToCSV(rows);
    case 'xlsx':
      return await convertToExcel(rows);
    default:
      return rows;
  }
}

export function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const parser = new Parser();
  return parser.parse(data);
}

let xlsxPackage: typeof import('xlsx') | null = null;

async function getXlsx() {
  if (!xlsxPackage) {
    xlsxPackage = await import('xlsx');
  }
  return xlsxPackage;
}

export async function convertToExcel(data: Record<string, unknown>[]): Promise<Buffer> {
  const XLSX = await getXlsx();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

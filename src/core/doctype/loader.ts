/**
 * Nodra Framework - DocType Loader
 *
 * Loads DocType definitions from JSON files on disk, parses them via
 * parseDocType, injects standard fields, and provides utilities for
 * resolving DocType file paths by convention.
 */

import { readFile, readdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { NotFoundError, ValidationError } from '../errors.js';
import { parseDocType, injectStandardFields } from './schema.js';
import type { DocTypeDefinition } from './schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a DocType name to snake_case for file lookup.
 * "Sales Invoice" -> "sales_invoice", "Todo" -> "todo", "Note Item" -> "note_item"
 */
function toSnakeCase(name: string): string {
  return name
    .replace(/\s+/g, '_')          // spaces to underscores
    .replace(/([a-z])([A-Z])/g, '$1_$2')  // camelCase boundaries
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // consecutive caps
    .toLowerCase();
}

/**
 * Recursively find all *.json files in a directory.
 */
async function findJsonFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await findJsonFiles(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Recursively find all *.json files in a directory (synchronous).
 */
function findJsonFilesSync(dirPath: string): string[] {
  const results: string[] = [];

  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = findJsonFilesSync(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a single DocType definition from a JSON file.
 *
 * Reads the file, parses JSON, validates via `parseDocType`,
 * then injects standard fields.
 *
 * @throws {NotFoundError} If the file does not exist
 * @throws {ValidationError} If the JSON is malformed or fails DocType validation
 */
export async function loadDocTypeFromFile(filePath: string): Promise<DocTypeDefinition> {
  // Check file existence
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('DocType', filePath);
    }
    throw err;
  }

  // Parse JSON
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new ValidationError(`Invalid JSON in file: ${filePath}`);
  }

  // Validate and parse DocType definition (may throw ValidationError)
  const doctype = parseDocType(raw);

  // Inject standard fields
  return injectStandardFields(doctype);
}

/**
 * Load all DocType definitions from a directory (recursively).
 *
 * Scans for *.json files, attempts to load each one. Files that
 * fail validation are skipped with a console warning.
 *
 * @returns Array of successfully loaded DocTypeDefinitions
 */
export async function loadDocTypesFromDirectory(dirPath: string): Promise<DocTypeDefinition[]> {
  const jsonFiles = await findJsonFiles(dirPath);
  const doctypes: DocTypeDefinition[] = [];

  for (const filePath of jsonFiles) {
    try {
      const doctype = await loadDocTypeFromFile(filePath);
      doctypes.push(doctype);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Skipping ${filePath}: ${message}`);
    }
  }

  return doctypes;
}

/**
 * Resolve the file path for a DocType by name.
 *
 * Searches recursively in each base path for `<snake_case_name>.json`.
 * Returns the first match found, or undefined if not found.
 */
export function resolveDocTypePath(basePaths: string[], doctypeName: string): string | undefined {
  const snakeName = toSnakeCase(doctypeName);
  const targetFilename = `${snakeName}.json`;

  for (const basePath of basePaths) {
    const jsonFiles = findJsonFilesSync(basePath);
    for (const filePath of jsonFiles) {
      if (path.basename(filePath) === targetFilename) {
        return filePath;
      }
    }
  }

  return undefined;
}

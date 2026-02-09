/**
 * Nodra Framework - DocType Registry
 *
 * In-memory store for DocType definitions. Provides registration,
 * lookup, listing, and cross-reference queries (e.g. linked DocTypes).
 */

import { DuplicateError, NotFoundError } from '../errors.js';
import type { DocTypeDefinition } from './schema.js';

/**
 * In-memory registry for DocType definitions.
 *
 * Each DocType is stored by its unique `name`. The registry supports
 * querying by name, module, and cross-referencing Link fields.
 */
export class DocTypeRegistry {
  private readonly store = new Map<string, DocTypeDefinition>();

  /**
   * Register a DocType definition.
   *
   * @throws {DuplicateError} If a DocType with the same name is already registered
   */
  register(doctype: DocTypeDefinition): void {
    if (this.store.has(doctype.name)) {
      throw new DuplicateError('DocType', doctype.name);
    }
    this.store.set(doctype.name, doctype);
  }

  /**
   * Retrieve a DocType definition by name.
   *
   * @throws {NotFoundError} If the DocType is not registered
   */
  get(name: string): DocTypeDefinition {
    const doctype = this.store.get(name);
    if (!doctype) {
      throw new NotFoundError('DocType', name);
    }
    return doctype;
  }

  /**
   * Check whether a DocType with the given name is registered.
   */
  has(name: string): boolean {
    return this.store.has(name);
  }

  /**
   * Return all registered DocType definitions.
   */
  list(): DocTypeDefinition[] {
    return Array.from(this.store.values());
  }

  /**
   * Return all DocType definitions that belong to the given module.
   */
  listByModule(module: string): DocTypeDefinition[] {
    return this.list().filter((dt) => dt.module === module);
  }

  /**
   * Return names of DocTypes that have Link fields pointing to the given DocType.
   *
   * Scans all registered DocTypes for fields with `fieldtype === 'Link'`
   * whose `options` equals the target DocType name.
   */
  getLinkedDocTypes(name: string): string[] {
    const linked: string[] = [];

    for (const doctype of this.store.values()) {
      const hasLink = doctype.fields.some(
        (field) => field.fieldtype === 'Link' && field.options === name,
      );
      if (hasLink) {
        linked.push(doctype.name);
      }
    }

    return linked;
  }

  /**
   * Remove all registered DocTypes. Intended for testing.
   */
  clear(): void {
    this.store.clear();
  }
}

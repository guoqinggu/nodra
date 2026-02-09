/**
 * Nodra Framework - Base Document Class
 *
 * A Document is the runtime representation of a single database record
 * of a given DocType. It provides field access, dirty tracking, and
 * overridable lifecycle hooks for subclasses (controllers).
 */

import type { DocTypeDefinition } from '../doctype/schema.js';

// Standard field names that are stored as top-level properties
const STANDARD_FIELD_NAMES = new Set([
  'name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx',
]);

/**
 * Base Document class — runtime instance of a DocType record.
 *
 * Subclass this to create controllers with custom lifecycle logic.
 */
export class Document {
  /** DocType name (e.g. "Todo") */
  doctype: string;

  /** Primary key */
  name: string;

  /** Creator user */
  owner: string;

  /** Created timestamp */
  creation: Date | null;

  /** Last modified timestamp */
  modified: Date | null;

  /** Last modified by user */
  modified_by: string;

  /** Document status: 0 = Draft, 1 = Submitted, 2 = Cancelled */
  docstatus: number;

  /** Sort index (for child documents) */
  idx: number;

  // --- Private state ---

  private _meta: DocTypeDefinition;
  private _data: Record<string, unknown>;
  private _previousValues: Record<string, unknown>;
  private _isNew: boolean;

  constructor(meta: DocTypeDefinition, data?: Record<string, unknown>) {
    this._meta = meta;
    this._data = {};
    this._previousValues = {};
    this._isNew = true;

    // Defaults for standard fields
    this.doctype = meta.name;
    this.name = '';
    this.owner = '';
    this.creation = null;
    this.modified = null;
    this.modified_by = '';
    this.docstatus = 0;
    this.idx = 0;

    // Populate from initial data if provided
    if (data) {
      // Handle _isNew flag from data
      if (data['_isNew'] !== undefined) {
        this._isNew = Boolean(data['_isNew']);
      }

      for (const [key, value] of Object.entries(data)) {
        if (key === '_isNew') continue;

        if (STANDARD_FIELD_NAMES.has(key)) {
          this._setStandardField(key, value);
        } else {
          this._data[key] = value;
        }
      }
    }

    // Snapshot current state as "clean" baseline for change tracking
    this._previousValues = this._snapshotValues();
  }

  // ---------------------------------------------------------------------------
  // Field access
  // ---------------------------------------------------------------------------

  /**
   * Get the value of a field by name.
   */
  get(fieldname: string): unknown {
    if (STANDARD_FIELD_NAMES.has(fieldname)) {
      return this._getStandardField(fieldname);
    }
    return this._data[fieldname];
  }

  /**
   * Set the value of a field by name.
   */
  set(fieldname: string, value: unknown): void {
    if (STANDARD_FIELD_NAMES.has(fieldname)) {
      this._setStandardField(fieldname, value);
    } else {
      this._data[fieldname] = value;
    }
  }

  /**
   * Return all field values as a plain object (including standard fields).
   */
  getData(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      doctype: this.doctype,
      name: this.name,
      owner: this.owner,
      creation: this.creation,
      modified: this.modified,
      modified_by: this.modified_by,
      docstatus: this.docstatus,
      idx: this.idx,
    };

    for (const [key, value] of Object.entries(this._data)) {
      result[key] = value;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Change tracking
  // ---------------------------------------------------------------------------

  /**
   * Returns true if this document has not yet been persisted to the database.
   */
  isNew(): boolean {
    return this._isNew;
  }

  /**
   * Returns true if the given field value has changed since the last clean snapshot.
   */
  hasChanged(fieldname: string): boolean {
    const current = this.get(fieldname);
    const previous = this._previousValues[fieldname];
    return current !== previous;
  }

  /**
   * Return the previous (clean-snapshot) value of the given field.
   */
  getPrevious(fieldname: string): unknown {
    return this._previousValues[fieldname];
  }

  /**
   * Return an array of field names that have changed since the last clean snapshot.
   */
  getChangedFields(): string[] {
    const changed: string[] = [];
    const allKeys = new Set([
      ...Object.keys(this._previousValues),
      ...Object.keys(this._data),
      ...STANDARD_FIELD_NAMES,
    ]);

    for (const key of allKeys) {
      if (this.hasChanged(key)) {
        changed.push(key);
      }
    }
    return changed;
  }

  /**
   * Reset change tracking — marks the current state as the clean baseline.
   * Typically called after a successful save/insert.
   */
  markAsClean(): void {
    this._previousValues = this._snapshotValues();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle hooks (override in subclasses)
  // ---------------------------------------------------------------------------

  async beforeValidate(): Promise<void> { /* no-op */ }
  async validate(): Promise<void> { /* no-op */ }
  async beforeSave(): Promise<void> { /* no-op */ }
  async afterSave(): Promise<void> { /* no-op */ }
  async beforeInsert(): Promise<void> { /* no-op */ }
  async afterInsert(): Promise<void> { /* no-op */ }
  async beforeDelete(): Promise<void> { /* no-op */ }
  async afterDelete(): Promise<void> { /* no-op */ }
  async onChange(): Promise<void> { /* no-op */ }

  // ---------------------------------------------------------------------------
  // Internal: access the DocType metadata
  // ---------------------------------------------------------------------------

  /** @internal Return the DocType metadata for this document. */
  getMeta(): DocTypeDefinition {
    return this._meta;
  }

  /** @internal Mark document as not new (loaded from DB). */
  setIsNew(value: boolean): void {
    this._isNew = value;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _getStandardField(key: string): unknown {
    switch (key) {
      case 'name': return this.name;
      case 'owner': return this.owner;
      case 'creation': return this.creation;
      case 'modified': return this.modified;
      case 'modified_by': return this.modified_by;
      case 'docstatus': return this.docstatus;
      case 'idx': return this.idx;
      default: return undefined;
    }
  }

  private _setStandardField(key: string, value: unknown): void {
    switch (key) {
      case 'name': this.name = String(value ?? ''); break;
      case 'owner': this.owner = String(value ?? ''); break;
      case 'creation': this.creation = value instanceof Date ? value : (value ? new Date(String(value)) : null); break;
      case 'modified': this.modified = value instanceof Date ? value : (value ? new Date(String(value)) : null); break;
      case 'modified_by': this.modified_by = String(value ?? ''); break;
      case 'docstatus': this.docstatus = Number(value ?? 0); break;
      case 'idx': this.idx = Number(value ?? 0); break;
    }
  }

  /**
   * Snapshot all current values (standard + custom fields) for change tracking.
   */
  private _snapshotValues(): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};

    // Standard fields
    for (const key of STANDARD_FIELD_NAMES) {
      snapshot[key] = this._getStandardField(key);
    }

    // Custom fields
    for (const [key, value] of Object.entries(this._data)) {
      snapshot[key] = value;
    }

    return snapshot;
  }
}

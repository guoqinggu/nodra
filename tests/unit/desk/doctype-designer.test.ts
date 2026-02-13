/**
 * Tests for DocType Designer
 *
 * DocType Designer is the core visual tool for creating and editing DocTypes.
 * It allows users to define fields, permissions, and behavior without writing JSON.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDesignerStore,
  type DesignerStore,
  type DesignerState,
  type FieldItem,
  type DesignerAction,
} from '../../../desk/src/stores/doctype-designer.js';
import type { DocTypeDefinition, FieldDefinition } from '../../../src/core/doctype/schema.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const sampleDocType: DocTypeDefinition = {
  name: 'TestDoc',
  module: 'Core',
  naming_rule: 'autoincrement',
  is_submittable: false,
  is_child: false,
  is_single: false,
  is_tree: false,
  is_virtual: false,
  fields: [
    {
      fieldname: 'title',
      fieldtype: 'Data',
      label: 'Title',
      reqd: true,
    },
    {
      fieldname: 'description',
      fieldtype: 'Text',
      label: 'Description',
    },
  ],
  permissions: [
    {
      role: 'System Manager',
      read: true,
      write: true,
      create: true,
      delete: true,
    },
  ],
};

const newField: FieldItem = {
  id: 'field-1',
  fieldname: 'status',
  fieldtype: 'Select',
  label: 'Status',
  options: 'Open\nClosed',
  reqd: false,
};

// ---------------------------------------------------------------------------
// Tests - Store Initialization
// ---------------------------------------------------------------------------

describe('DocType Designer Store - Initialization', () => {
  it('should create store with initial state', () => {
    const store = createDesignerStore();
    const state = store.getState();

    expect(state.docType).toBeNull();
    expect(state.fields).toEqual([]);
    expect(state.selectedFieldId).toBeNull();
    expect(state.isDirty).toBe(false);
    expect(state.isSaving).toBe(false);
    expect(state.errors).toEqual([]);
  });

  it('should create store with existing DocType', () => {
    const store = createDesignerStore(sampleDocType);
    const state = store.getState();

    expect(state.docType).toEqual(sampleDocType);
    expect(state.fields).toHaveLength(2);
    expect(state.fields[0].fieldname).toBe('title');
  });

  it('should generate unique IDs for fields', () => {
    const store = createDesignerStore(sampleDocType);
    const state = store.getState();

    state.fields.forEach((field) => {
      expect(field.id).toBeDefined();
      expect(typeof field.id).toBe('string');
    });
  });
});

describe('DocType Designer Store - Field Management', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should add new field', () => {
    store.getState().addField(newField);
    const state = store.getState();

    expect(state.fields).toHaveLength(1);
    expect(state.fields[0].fieldname).toBe('status');
    expect(state.isDirty).toBe(true);
  });

  it('should generate fieldname from label when not provided', () => {
    const fieldWithoutName: Partial<FieldItem> = {
      label: 'Due Date',
      fieldtype: 'Date',
    };

    store.getState().addField(fieldWithoutName as FieldItem);
    const state = store.getState();

    expect(state.fields[0].fieldname).toBe('due_date');
  });

  it('should validate unique fieldname', () => {
    store.getState().addField(newField);

    const duplicateField: FieldItem = {
      ...newField,
      id: 'field-2',
    };

    store.getState().addField(duplicateField);
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'fieldname',
        message: 'Fieldname "status" already exists',
      }),
    );
  });

  it('should remove field by id', () => {
    store.getState().addField(newField);
    const fieldId = store.getState().fields[0].id;

    store.getState().removeField(fieldId);
    const state = store.getState();

    expect(state.fields).toHaveLength(0);
    expect(state.isDirty).toBe(true);
  });

  it('should update field properties', () => {
    store.getState().addField(newField);
    const fieldId = store.getState().fields[0].id;

    store.getState().updateField(fieldId, { label: 'New Status', reqd: true });
    const state = store.getState();

    expect(state.fields[0].label).toBe('New Status');
    expect(state.fields[0].reqd).toBe(true);
    expect(state.isDirty).toBe(true);
  });

  it('should reorder fields', () => {
    store.getState().addField({ ...newField, fieldname: 'field1', label: 'Field 1' });
    store.getState().addField({ ...newField, id: 'field-2', fieldname: 'field2', label: 'Field 2' });

    const state = store.getState();
    const field1Id = state.fields[0].id;
    const field2Id = state.fields[1].id;

    store.getState().reorderFields([field2Id, field1Id]);
    const newState = store.getState();

    expect(newState.fields[0].fieldname).toBe('field2');
    expect(newState.fields[1].fieldname).toBe('field1');
  });

  it('should select field', () => {
    store.getState().addField(newField);
    const fieldId = store.getState().fields[0].id;

    store.getState().selectField(fieldId);
    const state = store.getState();

    expect(state.selectedFieldId).toBe(fieldId);
  });

  it('should duplicate field', () => {
    store.getState().addField(newField);
    const fieldId = store.getState().fields[0].id;

    store.getState().duplicateField(fieldId);
    const state = store.getState();

    expect(state.fields).toHaveLength(2);
    expect(state.fields[1].fieldname).toMatch(/status_\d+/);
    expect(state.fields[1].label).toBe('Status (Copy)');
  });
});

describe('DocType Designer Store - Field Validation', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should validate required field properties', () => {
    const invalidField: Partial<FieldItem> = {
      fieldtype: 'Data',
      // missing fieldname and label
    };

    store.getState().addField(invalidField as FieldItem);
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'fieldname',
        message: 'Fieldname is required',
      }),
    );
    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'label',
        message: 'Label is required',
      }),
    );
  });

  it('should validate fieldname format', () => {
    const invalidField: FieldItem = {
      ...newField,
      fieldname: 'Invalid Field Name!', // spaces and special chars
    };

    store.getState().addField(invalidField);
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'fieldname',
        message: 'Fieldname must contain only lowercase letters, numbers, and underscores',
      }),
    );
  });

  it('should validate Select field has options', () => {
    const selectFieldWithoutOptions: FieldItem = {
      ...newField,
      fieldtype: 'Select',
      options: '',
    };

    store.getState().addField(selectWithoutOptions);
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'options',
        message: 'Select field must have options',
      }),
    );
  });

  it('should validate Link field has options (doctype)', () => {
    const linkFieldWithoutOptions: FieldItem = {
      ...newField,
      fieldtype: 'Link',
      options: '',
    };

    store.getState().addField(linkFieldWithoutOptions);
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'options',
        message: 'Link field must reference a DocType',
      }),
    );
  });

  it('should clear errors when field is updated', () => {
    const invalidField: Partial<FieldItem> = {
      fieldtype: 'Data',
    };

    store.getState().addField(invalidField as FieldItem);
    expect(store.getState().errors).toHaveLength(2);

    const fieldId = store.getState().fields[0].id;
    store.getState().updateField(fieldId, { fieldname: 'valid_name', label: 'Valid Label' });

    expect(store.getState().errors).toHaveLength(0);
  });
});

describe('DocType Designer Store - DocType Properties', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should update DocType name', () => {
    store.getState().updateDocType({ name: 'NewDocType' });
    const state = store.getState();

    expect(state.docType?.name).toBe('NewDocType');
    expect(state.isDirty).toBe(true);
  });

  it('should update DocType module', () => {
    store.getState().updateDocType({ module: 'Custom' });
    const state = store.getState();

    expect(state.docType?.module).toBe('Custom');
  });

  it('should update naming rule', () => {
    store.getState().updateDocType({ naming_rule: 'hash' });
    const state = store.getState();

    expect(state.docType?.naming_rule).toBe('hash');
  });

  it('should toggle is_submittable', () => {
    store.getState().updateDocType({ is_submittable: true });
    const state = store.getState();

    expect(state.docType?.is_submittable).toBe(true);
  });

  it('should validate DocType name format', () => {
    store.getState().updateDocType({ name: 'invalid name with spaces!' });
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'name',
        message: 'DocType name must contain only letters, numbers, and spaces',
      }),
    );
  });
});

describe('DocType Designer Store - Permission Management', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should add permission rule', () => {
    store.getState().addPermission({
      role: 'User',
      read: true,
      write: true,
      create: false,
      delete: false,
    });
    const state = store.getState();

    expect(state.docType?.permissions).toHaveLength(1);
    expect(state.docType?.permissions[0].role).toBe('User');
  });

  it('should update permission rule', () => {
    store.getState().addPermission({
      role: 'User',
      read: true,
      write: false,
      create: false,
      delete: false,
    });

    store.getState().updatePermission(0, { write: true });
    const state = store.getState();

    expect(state.docType?.permissions[0].write).toBe(true);
  });

  it('should remove permission rule', () => {
    store.getState().addPermission({
      role: 'User',
      read: true,
      write: true,
      create: false,
      delete: false,
    });

    store.getState().removePermission(0);
    const state = store.getState();

    expect(state.docType?.permissions).toHaveLength(0);
  });

  it('should validate at least one permission rule exists', () => {
    store.getState().validate();
    const state = store.getState();

    expect(state.errors).toContainEqual(
      expect.objectContaining({
        field: 'permissions',
        message: 'At least one permission rule is required',
      }),
    );
  });
});

describe('DocType Designer Store - Undo/Redo', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should undo last action', () => {
    store.getState().addField(newField);
    expect(store.getState().fields).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().fields).toHaveLength(0);
  });

  it('should redo undone action', () => {
    store.getState().addField(newField);
    store.getState().undo();
    expect(store.getState().fields).toHaveLength(0);

    store.getState().redo();
    expect(store.getState().fields).toHaveLength(1);
  });

  it('should maintain undo history limit', () => {
    // Add more fields than history limit
    for (let i = 0; i < 60; i++) {
      store.getState().addField({
        ...newField,
        id: `field-${i}`,
        fieldname: `field_${i}`,
        label: `Field ${i}`,
      });
    }

    // Should only keep last 50 actions
    expect(store.getState().canUndo()).toBe(true);
  });

  it('should clear redo stack on new action', () => {
    store.getState().addField(newField);
    store.getState().undo();

    // Add new field (should clear redo stack)
    store.getState().addField({ ...newField, fieldname: 'another_field' });

    expect(store.getState().canRedo()).toBe(false);
  });
});

describe('DocType Designer Store - Save/Export', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should export to DocType definition', () => {
    store.getState().updateDocType({
      name: 'TestDoc',
      module: 'Core',
      naming_rule: 'autoincrement',
    });

    store.getState().addField(newField);
    store.getState().addPermission({
      role: 'System Manager',
      read: true,
      write: true,
      create: true,
      delete: true,
    });

    const definition = store.getState().toDocTypeDefinition();

    expect(definition.name).toBe('TestDoc');
    expect(definition.fields).toHaveLength(1);
    expect(definition.permissions).toHaveLength(1);
    expect(definition.fields[0].fieldname).toBe('status');
  });

  it('should validate before export', () => {
    store.getState().updateDocType({ name: '' }); // Invalid - empty name

    const result = store.getState().toDocTypeDefinition();

    expect(result).toBeNull();
    expect(store.getState().errors).toHaveLengthGreaterThan(0);
  });

  it('should reset dirty state after successful save', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true });

    store.getState().updateDocType({ name: 'TestDoc' });
    store.getState().addField(newField);

    expect(store.getState().isDirty).toBe(true);

    await store.getState().save(mockSave);

    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().isSaving).toBe(false);
  });

  it('should handle save error', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'));

    store.getState().updateDocType({ name: 'TestDoc' });

    await expect(store.getState().save(mockSave)).rejects.toThrow('Save failed');

    expect(store.getState().isSaving).toBe(false);
    expect(store.getState().isDirty).toBe(true);
  });
});

describe('DocType Designer Store - Import', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should import from DocType definition', () => {
    store.getState().fromDocTypeDefinition(sampleDocType);
    const state = store.getState();

    expect(state.docType?.name).toBe('TestDoc');
    expect(state.fields).toHaveLength(2);
    expect(state.fields[0].fieldname).toBe('title');
    expect(state.isDirty).toBe(false);
  });

  it('should clear existing state on import', () => {
    store.getState().addField(newField);
    expect(store.getState().fields).toHaveLength(1);

    store.getState().fromDocTypeDefinition(sampleDocType);

    expect(store.getState().fields).toHaveLength(2);
    expect(store.getState().fields[0].fieldname).toBe('title');
  });

  it('should handle invalid import data', () => {
    const invalidData = { name: 'Invalid' }; // Missing required fields

    store.getState().fromDocTypeDefinition(invalidData as DocTypeDefinition);

    expect(store.getState().errors).toHaveLengthGreaterThan(0);
  });
});

describe('DocType Designer Store - Preview', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
  });

  it('should generate form preview data', () => {
    store.getState().updateDocType({ name: 'TestDoc' });
    store.getState().addField({
      ...newField,
      fieldtype: 'Data',
      fieldname: 'title',
      label: 'Title',
      default: 'Default Title',
    });

    const preview = store.getState().generateFormPreview();

    expect(preview.fields).toHaveLength(1);
    expect(preview.fields[0].component).toBe('Input');
    expect(preview.data.title).toBe('Default Title');
  });

  it('should generate list preview columns', () => {
    store.getState().updateDocType({ name: 'TestDoc' });
    store.getState().addField({
      ...newField,
      fieldtype: 'Data',
      fieldname: 'title',
      label: 'Title',
    });
    store.getState().addField({
      ...newField,
      id: 'field-2',
      fieldtype: 'Select',
      fieldname: 'status',
      label: 'Status',
    });

    const preview = store.getState().generateListPreview();

    expect(preview.columns).toHaveLength(2);
    expect(preview.columns[0].field).toBe('title');
    expect(preview.columns[1].field).toBe('status');
  });

  it('should map field types to components correctly', () => {
    store.getState().updateDocType({ name: 'TestDoc' });
    store.getState().addField({ ...newField, fieldtype: 'Data' });
    store.getState().addField({ ...newField, id: 'f2', fieldtype: 'Text' });
    store.getState().addField({ ...newField, id: 'f3', fieldtype: 'Date' });
    store.getState().addField({ ...newField, id: 'f4', fieldtype: 'Select' });
    store.getState().addField({ ...newField, id: 'f5', fieldtype: 'Link' });
    store.getState().addField({ ...newField, id: 'f6', fieldtype: 'Check' });

    const preview = store.getState().generateFormPreview();

    expect(preview.fields[0].component).toBe('Input');
    expect(preview.fields[1].component).toBe('Textarea');
    expect(preview.fields[2].component).toBe('DatePicker');
    expect(preview.fields[3].component).toBe('Select');
    expect(preview.fields[4].component).toBe('LinkField');
    expect(preview.fields[5].component).toBe('Checkbox');
  });
});

describe('DocType Designer Store - Auto-save', () => {
  let store: DesignerStore;

  beforeEach(() => {
    store = createDesignerStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger auto-save after delay', () => {
    const mockAutoSave = vi.fn().mockResolvedValue({});
    store.getState().enableAutoSave(mockAutoSave, 1000);

    store.getState().addField(newField);

    expect(mockAutoSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1001);

    expect(mockAutoSave).toHaveBeenCalled();
  });

  it('should debounce rapid changes', () => {
    const mockAutoSave = vi.fn().mockResolvedValue({});
    store.getState().enableAutoSave(mockAutoSave, 1000);

    store.getState().addField({ ...newField, fieldname: 'field1' });
    vi.advanceTimersByTime(500);
    store.getState().addField({ ...newField, id: 'f2', fieldname: 'field2' });
    vi.advanceTimersByTime(500);
    store.getState().addField({ ...newField, id: 'f3', fieldname: 'field3' });
    vi.advanceTimersByTime(1001);

    expect(mockAutoSave).toHaveBeenCalledTimes(1);
  });

  it('should disable auto-save', () => {
    const mockAutoSave = vi.fn().mockResolvedValue({});
    store.getState().enableAutoSave(mockAutoSave, 1000);
    store.getState().disableAutoSave();

    store.getState().addField(newField);
    vi.advanceTimersByTime(1001);

    expect(mockAutoSave).not.toHaveBeenCalled();
  });
});

/**
 * Tests for Form View
 *
 * Form View displays and edits a single document with field rendering,
 * validation, and lifecycle management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFormViewStore,
  type FormViewStore,
  type FormViewState,
  type FormField,
  type FormSection,
  type FieldChangeEvent,
} from '../../../desk/src/stores/form-view.js';
import type { DocTypeDefinition, FieldDefinition } from '../../../src/core/doctype/schema.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const todoDocType: DocTypeDefinition = {
  name: 'Todo',
  module: 'Core',
  naming_rule: 'autoincrement',
  is_submittable: true,
  is_child: false,
  is_single: false,
  is_tree: false,
  is_virtual: false,
  fields: [
    { fieldname: 'name', fieldtype: 'Data', label: 'ID', read_only: 1 },
    { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true, max_length: 200 },
    { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: 'Open\nIn Progress\nCompleted', default: 'Open' },
    { fieldname: 'priority', fieldtype: 'Select', label: 'Priority', options: 'Low\nMedium\nHigh', default: 'Medium' },
    { fieldname: 'due_date', fieldtype: 'Date', label: 'Due Date', depends_on: 'eval:doc.status=="Open"' },
    { fieldname: 'assigned_to', fieldtype: 'Link', label: 'Assigned To', options: 'User' },
    { fieldname: 'description', fieldtype: 'Text', label: 'Description' },
    { fieldname: 'is_urgent', fieldtype: 'Check', label: 'Is Urgent' },
    { fieldname: 'completion_date', fieldtype: 'Date', label: 'Completion Date', read_only: 1 },
    {
      fieldname: 'items',
      fieldtype: 'Table',
      label: 'Items',
      options: 'Todo Item',
    },
  ],
  permissions: [],
};

const existingDocument = {
  name: 'TODO-001',
  title: 'Fix critical bug',
  status: 'Open',
  priority: 'High',
  due_date: '2025-01-15',
  assigned_to: 'user1@example.com',
  description: 'This needs to be fixed ASAP',
  is_urgent: 1,
  completion_date: null,
  items: [
    { name: 'ITEM-001', item_name: 'Step 1', completed: 1 },
    { name: 'ITEM-002', item_name: 'Step 2', completed: 0 },
  ],
  docstatus: 0,
  owner: 'user1@example.com',
  creation: '2025-01-01T00:00:00Z',
  modified: '2025-01-10T00:00:00Z',
  modified_by: 'user2@example.com',
  idx: 0,
};

// ---------------------------------------------------------------------------
// Tests - Store Initialization
// ---------------------------------------------------------------------------

describe('Form View Store - Initialization', () => {
  it('should create store with default state', () => {
    const store = createFormViewStore();
    const state = store.getState();

    expect(state.docType).toBeNull();
    expect(state.document).toBeNull();
    expect(state.originalDocument).toBeNull();
    expect(state.isNew).toBe(true);
    expect(state.isDirty).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.isSaving).toBe(false);
    expect(state.errors).toEqual({});
    expect(state.activeTab).toBe('main');
  });

  it('should initialize for new document', () => {
    const store = createFormViewStore(todoDocType);
    const state = store.getState();

    expect(state.docType).toEqual(todoDocType);
    expect(state.isNew).toBe(true);
    expect(state.document).toBeDefined();
    expect(state.document?.status).toBe('Open'); // Default value
    expect(state.document?.priority).toBe('Medium'); // Default value
  });

  it('should initialize for existing document', () => {
    const store = createFormViewStore(todoDocType, existingDocument);
    const state = store.getState();

    expect(state.isNew).toBe(false);
    expect(state.document?.name).toBe('TODO-001');
    expect(state.document?.title).toBe('Fix critical bug');
    expect(state.originalDocument).toEqual(existingDocument);
  });

  it('should generate form sections from DocType', () => {
    const store = createFormViewStore(todoDocType);
    const state = store.getState();

    expect(state.sections).toHaveLengthGreaterThan(0);
    expect(state.sections[0].fields.length).toBeGreaterThan(0);
  });
});

describe('Form View Store - Field Value Management', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
  });

  it('should update field value', () => {
    store.getState().setFieldValue('title', 'Updated Title');

    expect(store.getState().document?.title).toBe('Updated Title');
    expect(store.getState().isDirty).toBe(true);
  });

  it('should track changed fields', () => {
    store.getState().setFieldValue('title', 'Updated Title');
    store.getState().setFieldValue('priority', 'Low');

    const changedFields = store.getState().getChangedFields();
    expect(changedFields).toContain('title');
    expect(changedFields).toContain('priority');
    expect(changedFields).not.toContain('status');
  });

  it('should get previous value', () => {
    const originalTitle = store.getState().document?.title;
    store.getState().setFieldValue('title', 'New Title');

    expect(store.getState().getPreviousValue('title')).toBe(originalTitle);
  });

  it('should reset field to original value', () => {
    store.getState().setFieldValue('title', 'Changed Title');
    store.getState().resetField('title');

    expect(store.getState().document?.title).toBe('Fix critical bug');
    expect(store.getState().isDirty).toBe(false);
  });

  it('should reset all fields', () => {
    store.getState().setFieldValue('title', 'Changed');
    store.getState().setFieldValue('priority', 'Low');
    store.getState().resetAll();

    expect(store.getState().document?.title).toBe('Fix critical bug');
    expect(store.getState().document?.priority).toBe('High');
    expect(store.getState().isDirty).toBe(false);
  });

  it('should clear all values for new document', () => {
    const newDocStore = createFormViewStore(todoDocType);
    newDocStore.getState().setFieldValue('title', 'Test');
    newDocStore.getState().clearAll();

    expect(newDocStore.getState().document?.title).toBe('');
    expect(newDocStore.getState().document?.description).toBe('');
  });
});

describe('Form View Store - Validation', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType);
  });

  it('should validate required fields', () => {
    store.getState().setFieldValue('title', '');
    const isValid = store.getState().validate();

    expect(isValid).toBe(false);
    expect(store.getState().errors.title).toContain('Title is required');
  });

  it('should validate field length', () => {
    store.getState().setFieldValue('title', 'A'.repeat(201));
    const isValid = store.getState().validate();

    expect(isValid).toBe(false);
    expect(store.getState().errors.title).toContain('Title must not exceed 200 characters');
  });

  it('should validate Select field options', () => {
    store.getState().setFieldValue('status', 'Invalid Status');
    const isValid = store.getState().validate();

    expect(isValid).toBe(false);
    expect(store.getState().errors.status).toContain('Invalid option for Status');
  });

  it('should validate Date field format', () => {
    store.getState().setFieldValue('due_date', 'invalid-date');
    const isValid = store.getState().validate();

    expect(isValid).toBe(false);
    expect(store.getState().errors.due_date).toContain('Invalid date format');
  });

  it('should clear field error on valid input', () => {
    store.getState().setFieldValue('title', '');
    store.getState().validate();
    expect(store.getState().errors.title).toBeDefined();

    store.getState().setFieldValue('title', 'Valid Title');
    store.getState().validateField('title');

    expect(store.getState().errors.title).toBeUndefined();
  });

  it('should return true when all fields valid', () => {
    store.getState().setFieldValue('title', 'Valid Title');
    store.getState().setFieldValue('status', 'Open');
    const isValid = store.getState().validate();

    expect(isValid).toBe(true);
    expect(Object.keys(store.getState().errors)).toHaveLength(0);
  });

  it('should validate on save attempt', async () => {
    const mockSave = vi.fn();
    store.getState().setFieldValue('title', '');

    await expect(store.getState().save(mockSave)).rejects.toThrow('Validation failed');

    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('Form View Store - Field Visibility', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
  });

  it('should evaluate depends_on condition', () => {
    // due_date depends_on: 'eval:doc.status=="Open"'
    expect(store.getState().isFieldVisible('due_date')).toBe(true);

    store.getState().setFieldValue('status', 'Completed');

    expect(store.getState().isFieldVisible('due_date')).toBe(false);
  });

  it('should handle fields without depends_on', () => {
    expect(store.getState().isFieldVisible('title')).toBe(true);
  });

  it('should evaluate mandatory_depends_on', () => {
    // Mock field with mandatory_depends_on
    const docTypeWithConditionalMandatory: DocTypeDefinition = {
      ...todoDocType,
      fields: [
        ...todoDocType.fields,
        {
          fieldname: 'reason',
          fieldtype: 'Data',
          label: 'Reason',
          mandatory_depends_on: 'eval:doc.is_urgent==1',
        },
      ],
    };

    const conditionalStore = createFormViewStore(docTypeWithConditionalMandatory, existingDocument);

    // is_urgent is 1, so reason should be mandatory
    expect(conditionalStore.getState().isFieldMandatory('reason')).toBe(true);

    conditionalStore.getState().setFieldValue('is_urgent', 0);

    expect(conditionalStore.getState().isFieldMandatory('reason')).toBe(false);
  });

  it('should evaluate read_only_depends_on', () => {
    const docTypeWithConditionalReadOnly: DocTypeDefinition = {
      ...todoDocType,
      fields: [
        ...todoDocType.fields,
        {
          fieldname: 'notes',
          fieldtype: 'Text',
          label: 'Notes',
          read_only_depends_on: 'eval:doc.status=="Completed"',
        },
      ],
    };

    const conditionalStore = createFormViewStore(docTypeWithConditionalReadOnly, existingDocument);

    expect(conditionalStore.getState().isFieldReadOnly('notes')).toBe(false);

    conditionalStore.getState().setFieldValue('status', 'Completed');

    expect(conditionalStore.getState().isFieldReadOnly('notes')).toBe(true);
  });
});

describe('Form View Store - Save/Submit', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
  });

  it('should save document', async () => {
    const mockSave = vi.fn().mockResolvedValue({
      ...existingDocument,
      title: 'Updated Title',
      modified: '2025-01-11T00:00:00Z',
    });

    store.getState().setFieldValue('title', 'Updated Title');
    await store.getState().save(mockSave);

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TODO-001',
        title: 'Updated Title',
      }),
    );
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().isSaving).toBe(false);
  });

  it('should handle save error', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'));

    store.getState().setFieldValue('title', 'Updated Title');

    await expect(store.getState().save(mockSave)).rejects.toThrow('Save failed');

    expect(store.getState().isSaving).toBe(false);
    expect(store.getState().isDirty).toBe(true);
  });

  it('should submit document', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({
      ...existingDocument,
      docstatus: 1,
    });

    await store.getState().submit(mockSubmit);

    expect(mockSubmit).toHaveBeenCalledWith('TODO-001');
    expect(store.getState().document?.docstatus).toBe(1);
  });

  it('should cancel document', async () => {
    const submittedDoc = { ...existingDocument, docstatus: 1 };
    const submittedStore = createFormViewStore(todoDocType, submittedDoc);

    const mockCancel = vi.fn().mockResolvedValue({
      ...submittedDoc,
      docstatus: 2,
    });

    await submittedStore.getState().cancel(mockCancel);

    expect(mockCancel).toHaveBeenCalledWith('TODO-001');
    expect(submittedStore.getState().document?.docstatus).toBe(2);
  });

  it('should not save if no changes', async () => {
    const mockSave = vi.fn();

    await store.getState().save(mockSave);

    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('Form View Store - Child Table', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
  });

  it('should add child row', () => {
    store.getState().addChildRow('items', { item_name: 'New Step', completed: 0 });

    const items = store.getState().document?.items;
    expect(items).toHaveLength(3);
    expect(items[2].item_name).toBe('New Step');
    expect(items[2].idx).toBe(3);
  });

  it('should update child row', () => {
    store.getState().updateChildRow('items', 0, { completed: 1 });

    expect(store.getState().document?.items[0].completed).toBe(1);
    expect(store.getState().isDirty).toBe(true);
  });

  it('should remove child row', () => {
    store.getState().removeChildRow('items', 0);

    expect(store.getState().document?.items).toHaveLength(1);
    expect(store.getState().document?.items[0].name).toBe('ITEM-002');
  });

  it('should reorder child rows', () => {
    store.getState().reorderChildRows('items', [1, 0]);

    const items = store.getState().document?.items;
    expect(items[0].name).toBe('ITEM-002');
    expect(items[1].name).toBe('ITEM-001');
  });

  it('should get child table length', () => {
    expect(store.getState().getChildTableLength('items')).toBe(2);
  });
});

describe('Form View Store - Tab Management', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
  });

  it('should set active tab', () => {
    store.getState().setActiveTab('details');

    expect(store.getState().activeTab).toBe('details');
  });

  it('should get fields for active tab', () => {
    const activeFields = store.getState().getActiveTabFields();

    expect(activeFields.length).toBeGreaterThan(0);
  });

  it('should show error tabs', () => {
    store.getState().setFieldValue('title', '');
    store.getState().validate();

    const errorTabs = store.getState().getTabsWithErrors();

    expect(errorTabs.length).toBeGreaterThan(0);
  });
});

describe('Form View Store - Permissions', () => {
  it('should check if user can read', () => {
    const store = createFormViewStore(todoDocType, existingDocument);

    expect(store.getState().canRead()).toBe(true);
  });

  it('should check if user can write', () => {
    const store = createFormViewStore(todoDocType, existingDocument);

    expect(store.getState().canWrite()).toBe(true);
  });

  it('should check if user can create', () => {
    const newDocStore = createFormViewStore(todoDocType);

    expect(newDocStore.getState().canCreate()).toBe(true);
  });

  it('should check if user can delete', () => {
    const store = createFormViewStore(todoDocType, existingDocument);

    expect(store.getState().canDelete()).toBe(true);
  });

  it('should check if user can submit', () => {
    const store = createFormViewStore(todoDocType, existingDocument);

    expect(store.getState().canSubmit()).toBe(true);
  });

  it('should not allow submit if already submitted', () => {
    const submittedDoc = { ...existingDocument, docstatus: 1 };
    const store = createFormViewStore(todoDocType, submittedDoc);

    expect(store.getState().canSubmit()).toBe(false);
  });

  it('should check if user can cancel', () => {
    const submittedDoc = { ...existingDocument, docstatus: 1 };
    const store = createFormViewStore(todoDocType, submittedDoc);

    expect(store.getState().canCancel()).toBe(true);
  });
});

describe('Form View Store - Field Component Mapping', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType);
  });

  it('should map Data field to Input component', () => {
    const component = store.getState().getFieldComponent('title');
    expect(component).toBe('Input');
  });

  it('should map Text field to Textarea component', () => {
    const component = store.getState().getFieldComponent('description');
    expect(component).toBe('Textarea');
  });

  it('should map Select field to Select component', () => {
    const component = store.getState().getFieldComponent('status');
    expect(component).toBe('Select');
  });

  it('should map Date field to DatePicker component', () => {
    const component = store.getState().getFieldComponent('due_date');
    expect(component).toBe('DatePicker');
  });

  it('should map Link field to LinkField component', () => {
    const component = store.getState().getFieldComponent('assigned_to');
    expect(component).toBe('LinkField');
  });

  it('should map Check field to Checkbox component', () => {
    const component = store.getState().getFieldComponent('is_urgent');
    expect(component).toBe('Checkbox');
  });

  it('should map Table field to SubTable component', () => {
    const component = store.getState().getFieldComponent('items');
    expect(component).toBe('SubTable');
  });
});

describe('Form View Store - Autosave', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger autosave after delay', () => {
    const mockAutosave = vi.fn().mockResolvedValue({});
    store.getState().enableAutosave(mockAutosave, 1000);

    store.getState().setFieldValue('title', 'Changed');

    expect(mockAutosave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1001);

    expect(mockAutosave).toHaveBeenCalled();
  });

  it('should debounce rapid changes', () => {
    const mockAutosave = vi.fn().mockResolvedValue({});
    store.getState().enableAutosave(mockAutosave, 1000);

    store.getState().setFieldValue('title', 'Change 1');
    vi.advanceTimersByTime(500);
    store.getState().setFieldValue('title', 'Change 2');
    vi.advanceTimersByTime(500);
    store.getState().setFieldValue('title', 'Change 3');
    vi.advanceTimersByTime(1001);

    expect(mockAutosave).toHaveBeenCalledTimes(1);
  });
});

describe('Form View Store - Keyboard Shortcuts', () => {
  let store: FormViewStore;

  beforeEach(() => {
    store = createFormViewStore(todoDocType, existingDocument);
  });

  it('should handle Ctrl+S to save', () => {
    const mockSave = vi.fn().mockResolvedValue(existingDocument);
    store.getState().setFieldValue('title', 'Changed');

    store.getState().handleKeyboardShortcut('ctrl+s', mockSave);

    expect(mockSave).toHaveBeenCalled();
  });

  it('should handle Escape to cancel edit', () => {
    store.getState().setFieldValue('title', 'Changed');

    store.getState().handleKeyboardShortcut('escape');

    expect(store.getState().document?.title).toBe('Fix critical bug');
  });

  it('should navigate fields with Tab', () => {
    store.getState().setActiveField('title');

    store.getState().handleKeyboardShortcut('tab');

    expect(store.getState().activeField).not.toBe('title');
  });
});

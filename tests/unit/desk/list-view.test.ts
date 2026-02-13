/**
 * Tests for List View
 *
 * List View displays a paginated, filterable, sortable list of documents
 * with bulk operations and view customization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createListViewStore,
  type ListViewStore,
  type ListViewState,
  type ListColumn,
  type ListFilter,
  type BulkAction,
} from '../../../desk/src/stores/list-view.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const todoDocType: DocTypeDefinition = {
  name: 'Todo',
  module: 'Core',
  naming_rule: 'autoincrement',
  is_submittable: false,
  is_child: false,
  is_single: false,
  is_tree: false,
  is_virtual: false,
  fields: [
    { fieldname: 'name', fieldtype: 'Data', label: 'ID', read_only: 1 },
    { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true },
    { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: 'Open\nIn Progress\nCompleted', default: 'Open' },
    { fieldname: 'priority', fieldtype: 'Select', label: 'Priority', options: 'Low\nMedium\nHigh', default: 'Medium' },
    { fieldname: 'due_date', fieldtype: 'Date', label: 'Due Date' },
    { fieldname: 'assigned_to', fieldtype: 'Link', label: 'Assigned To', options: 'User' },
    { fieldname: 'description', fieldtype: 'Text', label: 'Description' },
    { fieldname: 'is_urgent', fieldtype: 'Check', label: 'Is Urgent' },
  ],
  permissions: [],
};

const sampleDocuments = [
  { name: 'TODO-001', title: 'Fix bug', status: 'Open', priority: 'High', due_date: '2025-01-15', assigned_to: 'user1@example.com', is_urgent: 1 },
  { name: 'TODO-002', title: 'Write tests', status: 'In Progress', priority: 'Medium', due_date: '2025-01-20', assigned_to: 'user2@example.com', is_urgent: 0 },
  { name: 'TODO-003', title: 'Deploy app', status: 'Completed', priority: 'High', due_date: '2025-01-10', assigned_to: 'user1@example.com', is_urgent: 1 },
  { name: 'TODO-004', title: 'Review code', status: 'Open', priority: 'Low', due_date: '2025-01-25', assigned_to: null, is_urgent: 0 },
  { name: 'TODO-005', title: 'Update docs', status: 'Open', priority: 'Medium', due_date: null, assigned_to: 'user3@example.com', is_urgent: 0 },
];

// ---------------------------------------------------------------------------
// Tests - Store Initialization
// ---------------------------------------------------------------------------

describe('List View Store - Initialization', () => {
  it('should create store with default state', () => {
    const store = createListViewStore();
    const state = store.getState();

    expect(state.doctype).toBeNull();
    expect(state.documents).toEqual([]);
    expect(state.columns).toEqual([]);
    expect(state.filters).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.pagination.page).toBe(1);
    expect(state.pagination.pageSize).toBe(20);
    expect(state.pagination.total).toBe(0);
  });

  it('should initialize with DocType', () => {
    const store = createListViewStore(todoDocType);
    const state = store.getState();

    expect(state.doctype).toEqual(todoDocType);
    expect(state.columns.length).toBeGreaterThan(0);
  });

  it('should generate default columns from DocType fields', () => {
    const store = createListViewStore(todoDocType);
    const state = store.getState();

    expect(state.columns).toContainEqual(
      expect.objectContaining({ field: 'name', visible: true }),
    );
    expect(state.columns).toContainEqual(
      expect.objectContaining({ field: 'title', visible: true }),
    );
    expect(state.columns).toContainEqual(
      expect.objectContaining({ field: 'status', visible: true }),
    );
  });

  it('should exclude long text fields from default columns', () => {
    const store = createListViewStore(todoDocType);
    const state = store.getState();

    const descriptionColumn = state.columns.find((c) => c.field === 'description');
    expect(descriptionColumn?.visible).toBe(false);
  });
});

describe('List View Store - Data Loading', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
  });

  it('should load documents', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      data: sampleDocuments,
      total: sampleDocuments.length,
    });

    await store.getState().loadDocuments(mockFetch);
    const state = store.getState();

    expect(state.documents).toEqual(sampleDocuments);
    expect(state.pagination.total).toBe(5);
    expect(state.loading).toBe(false);
  });

  it('should set loading state while fetching', async () => {
    const mockFetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const loadPromise = store.getState().loadDocuments(mockFetch);
    expect(store.getState().loading).toBe(true);

    await loadPromise;
    expect(store.getState().loading).toBe(false);
  });

  it('should handle load error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await store.getState().loadDocuments(mockFetch);
    const state = store.getState();

    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
  });

  it('should refresh documents', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      data: sampleDocuments,
      total: 5,
    });

    await store.getState().refresh(mockFetch);

    expect(mockFetch).toHaveBeenCalled();
  });
});

describe('List View Store - Pagination', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
  });

  it('should change page', () => {
    store.getState().setPage(3);

    expect(store.getState().pagination.page).toBe(3);
  });

  it('should change page size', () => {
    store.getState().setPageSize(50);

    expect(store.getState().pagination.pageSize).toBe(50);
    expect(store.getState().pagination.page).toBe(1); // Reset to first page
  });

  it('should calculate total pages', () => {
    store.getState().setTotal(95);
    store.getState().setPageSize(20);

    expect(store.getState().pagination.totalPages).toBe(5);
  });

  it('should go to next page', () => {
    store.getState().setTotal(50);
    store.getState().setPage(1);

    store.getState().nextPage();

    expect(store.getState().pagination.page).toBe(2);
  });

  it('should go to previous page', () => {
    store.getState().setPage(3);

    store.getState().previousPage();

    expect(store.getState().pagination.page).toBe(2);
  });

  it('should not go below page 1', () => {
    store.getState().setPage(1);
    store.getState().previousPage();

    expect(store.getState().pagination.page).toBe(1);
  });

  it('should not exceed total pages', () => {
    store.getState().setTotal(30);
    store.getState().setPageSize(10);
    store.getState().setPage(3);

    store.getState().nextPage();

    expect(store.getState().pagination.page).toBe(3);
  });
});

describe('List View Store - Sorting', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should sort by field ascending', () => {
    store.getState().setSort('title', 'asc');

    expect(store.getState().sort.field).toBe('title');
    expect(store.getState().sort.direction).toBe('asc');
  });

  it('should sort by field descending', () => {
    store.getState().setSort('priority', 'desc');

    expect(store.getState().sort.field).toBe('priority');
    expect(store.getState().sort.direction).toBe('desc');
  });

  it('should toggle sort direction on same field', () => {
    store.getState().setSort('status', 'asc');
    store.getState().toggleSort('status');

    expect(store.getState().sort.direction).toBe('desc');
  });

  it('should clear sort', () => {
    store.getState().setSort('title', 'asc');
    store.getState().clearSort();

    expect(store.getState().sort.field).toBeNull();
    expect(store.getState().sort.direction).toBeNull();
  });

  it('should sort documents locally', () => {
    store.getState().setSort('priority', 'asc');
    store.getState().applyLocalSort();

    const sorted = store.getState().documents;
    expect(sorted[0].priority).toBe('High');
    expect(sorted[sorted.length - 1].priority).toBe('Medium');
  });
});

describe('List View Store - Filtering', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should add filter', () => {
    const filter: ListFilter = {
      field: 'status',
      operator: 'equals',
      value: 'Open',
    };

    store.getState().addFilter(filter);

    expect(store.getState().filters).toContainEqual(filter);
    expect(store.getState().pagination.page).toBe(1); // Reset to first page
  });

  it('should remove filter', () => {
    store.getState().addFilter({ field: 'status', operator: 'equals', value: 'Open' });
    store.getState().addFilter({ field: 'priority', operator: 'equals', value: 'High' });

    store.getState().removeFilter(0);

    expect(store.getState().filters).toHaveLength(1);
    expect(store.getState().filters[0].field).toBe('priority');
  });

  it('should update filter', () => {
    store.getState().addFilter({ field: 'status', operator: 'equals', value: 'Open' });

    store.getState().updateFilter(0, { value: 'Completed' });

    expect(store.getState().filters[0].value).toBe('Completed');
  });

  it('should clear all filters', () => {
    store.getState().addFilter({ field: 'status', operator: 'equals', value: 'Open' });
    store.getState().addFilter({ field: 'priority', operator: 'equals', value: 'High' });

    store.getState().clearFilters();

    expect(store.getState().filters).toHaveLength(0);
  });

  it('should apply filters locally', () => {
    store.getState().addFilter({ field: 'status', operator: 'equals', value: 'Open' });
    store.getState().applyLocalFilters();

    const filtered = store.getState().filteredDocuments;
    expect(filtered).toHaveLength(3);
    expect(filtered.every((d) => d.status === 'Open')).toBe(true);
  });

  it('should apply multiple filters with AND logic', () => {
    store.getState().addFilter({ field: 'status', operator: 'equals', value: 'Open' });
    store.getState().addFilter({ field: 'priority', operator: 'equals', value: 'High' });
    store.getState().applyLocalFilters();

    const filtered = store.getState().filteredDocuments;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('TODO-001');
  });

  it('should support various filter operators', () => {
    // Contains
    store.getState().addFilter({ field: 'title', operator: 'contains', value: 'bug' });
    store.getState().applyLocalFilters();
    expect(store.getState().filteredDocuments).toHaveLength(1);

    store.getState().clearFilters();

    // Greater than (for dates)
    store.getState().addFilter({ field: 'due_date', operator: 'greater_than', value: '2025-01-15' });
    store.getState().applyLocalFilters();
    expect(store.getState().filteredDocuments.length).toBeGreaterThan(0);

    store.getState().clearFilters();

    // Is empty
    store.getState().addFilter({ field: 'assigned_to', operator: 'is_empty', value: '' });
    store.getState().applyLocalFilters();
    expect(store.getState().filteredDocuments).toHaveLength(1);
  });
});

describe('List View Store - Column Management', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
  });

  it('should toggle column visibility', () => {
    const initialVisible = store.getState().columns.find((c) => c.field === 'description')?.visible;

    store.getState().toggleColumn('description');

    const column = store.getState().columns.find((c) => c.field === 'description');
    expect(column?.visible).toBe(!initialVisible);
  });

  it('should reorder columns', () => {
    const initialOrder = store.getState().columns.map((c) => c.field);

    store.getState().reorderColumns(['title', 'name', 'status', ...initialOrder.slice(3)]);

    const newOrder = store.getState().columns.map((c) => c.field);
    expect(newOrder[0]).toBe('title');
    expect(newOrder[1]).toBe('name');
  });

  it('should resize column', () => {
    store.getState().resizeColumn('title', 200);

    const column = store.getState().columns.find((c) => c.field === 'title');
    expect(column?.width).toBe(200);
  });

  it('should get visible columns only', () => {
    const visibleColumns = store.getState().getVisibleColumns();

    expect(visibleColumns.every((c) => c.visible)).toBe(true);
  });

  it('should reset columns to default', () => {
    store.getState().toggleColumn('title');
    store.getState().reorderColumns([...store.getState().columns.map((c) => c.field)].reverse());

    store.getState().resetColumns();

    const columns = store.getState().columns;
    expect(columns.find((c) => c.field === 'title')?.visible).toBe(true);
  });
});

describe('List View Store - Selection', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should select single document', () => {
    store.getState().selectDocument('TODO-001');

    expect(store.getState().selectedIds).toContain('TODO-001');
  });

  it('should deselect document', () => {
    store.getState().selectDocument('TODO-001');
    store.getState().deselectDocument('TODO-001');

    expect(store.getState().selectedIds).not.toContain('TODO-001');
  });

  it('should toggle selection', () => {
    store.getState().toggleSelection('TODO-001');
    expect(store.getState().selectedIds).toContain('TODO-001');

    store.getState().toggleSelection('TODO-001');
    expect(store.getState().selectedIds).not.toContain('TODO-001');
  });

  it('should select all documents', () => {
    store.getState().selectAll();

    expect(store.getState().selectedIds).toHaveLength(sampleDocuments.length);
    expect(store.getState().isAllSelected).toBe(true);
  });

  it('should deselect all documents', () => {
    store.getState().selectAll();
    store.getState().deselectAll();

    expect(store.getState().selectedIds).toHaveLength(0);
    expect(store.getState().isAllSelected).toBe(false);
  });

  it('should select range with shift', () => {
    store.getState().selectDocument('TODO-001');
    store.getState().selectRange('TODO-003');

    expect(store.getState().selectedIds).toContain('TODO-001');
    expect(store.getState().selectedIds).toContain('TODO-002');
    expect(store.getState().selectedIds).toContain('TODO-003');
  });

  it('should get selected documents', () => {
    store.getState().selectDocument('TODO-001');
    store.getState().selectDocument('TODO-002');

    const selected = store.getState().getSelectedDocuments();

    expect(selected).toHaveLength(2);
    expect(selected[0].name).toBe('TODO-001');
    expect(selected[1].name).toBe('TODO-002');
  });
});

describe('List View Store - Bulk Actions', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should execute bulk delete', async () => {
    const mockDelete = vi.fn().mockResolvedValue({ success: true });

    store.getState().selectDocument('TODO-001');
    store.getState().selectDocument('TODO-002');

    await store.getState().bulkDelete(mockDelete);

    expect(mockDelete).toHaveBeenCalledWith(['TODO-001', 'TODO-002']);
    expect(store.getState().selectedIds).toHaveLength(0);
  });

  it('should execute bulk update', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ success: true });

    store.getState().selectDocument('TODO-001');
    store.getState().selectDocument('TODO-002');

    await store.getState().bulkUpdate({ status: 'Completed' }, mockUpdate);

    expect(mockUpdate).toHaveBeenCalledWith(
      ['TODO-001', 'TODO-002'],
      { status: 'Completed' },
    );
  });

  it('should execute bulk export', async () => {
    const mockExport = vi.fn().mockResolvedValue({ file_url: '/exports/data.csv' });

    store.getState().selectDocument('TODO-001');

    const result = await store.getState().bulkExport('csv', mockExport);

    expect(mockExport).toHaveBeenCalledWith(['TODO-001'], 'csv');
    expect(result.file_url).toBe('/exports/data.csv');
  });

  it('should not execute bulk action without selection', async () => {
    const mockAction = vi.fn();

    await expect(store.getState().bulkDelete(mockAction)).rejects.toThrow(
      'No documents selected',
    );

    expect(mockAction).not.toHaveBeenCalled();
  });
});

describe('List View Store - View Configuration', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
  });

  it('should save view configuration', () => {
    store.getState().setColumns([
      { field: 'title', visible: true, width: 300 },
      { field: 'status', visible: true },
    ]);
    store.getState().setSort('priority', 'desc');
    store.getState().addFilter({ field: 'status', operator: 'equals', value: 'Open' });

    const config = store.getState().saveViewConfig('My View');

    expect(config.name).toBe('My View');
    expect(config.columns).toHaveLength(2);
    expect(config.sort).toEqual({ field: 'priority', direction: 'desc' });
    expect(config.filters).toHaveLength(1);
  });

  it('should load view configuration', () => {
    const config = {
      name: 'My View',
      columns: [
        { field: 'title', visible: true, width: 300 },
        { field: 'status', visible: false },
      ],
      sort: { field: 'due_date', direction: 'asc' },
      filters: [{ field: 'priority', operator: 'equals', value: 'High' }],
    };

    store.getState().loadViewConfig(config);

    expect(store.getState().columns.find((c) => c.field === 'title')?.width).toBe(300);
    expect(store.getState().columns.find((c) => c.field === 'status')?.visible).toBe(false);
    expect(store.getState().sort.field).toBe('due_date');
    expect(store.getState().filters).toHaveLength(1);
  });

  it('should list saved views', () => {
    store.getState().saveViewConfig('View 1');
    store.getState().saveViewConfig('View 2');

    const views = store.getState().getSavedViews();

    expect(views).toHaveLength(2);
    expect(views.map((v) => v.name)).toContain('View 1');
    expect(views.map((v) => v.name)).toContain('View 2');
  });

  it('should delete saved view', () => {
    store.getState().saveViewConfig('View to Delete');
    const views = store.getState().getSavedViews();
    const viewId = views[0].id;

    store.getState().deleteSavedView(viewId);

    expect(store.getState().getSavedViews()).toHaveLength(0);
  });
});

describe('List View Store - Quick Filters', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should apply quick filter by status', () => {
    store.getState().applyQuickFilter('status', 'Open');

    expect(store.getState().filters).toContainEqual({
      field: 'status',
      operator: 'equals',
      value: 'Open',
    });
  });

  it('should apply quick filter by assigned user', () => {
    store.getState().applyQuickFilter('assigned_to', 'user1@example.com');

    expect(store.getState().filters).toContainEqual({
      field: 'assigned_to',
      operator: 'equals',
      value: 'user1@example.com',
    });
  });

  it('should toggle quick filter off if already active', () => {
    store.getState().applyQuickFilter('status', 'Open');
    store.getState().applyQuickFilter('status', 'Open'); // Toggle off

    expect(store.getState().filters).not.toContainEqual(
      expect.objectContaining({ field: 'status', value: 'Open' }),
    );
  });
});

describe('List View Store - Search', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should set search query', () => {
    store.getState().setSearchQuery('bug');

    expect(store.getState().searchQuery).toBe('bug');
  });

  it('should clear search query', () => {
    store.getState().setSearchQuery('test');
    store.getState().clearSearch();

    expect(store.getState().searchQuery).toBe('');
  });

  it('should search across multiple fields locally', () => {
    store.getState().setSearchQuery('fix');
    store.getState().applyLocalSearch();

    const results = store.getState().filteredDocuments;
    expect(results).toHaveLength(1);
    expect(results[0].title).toContain('Fix');
  });

  it('should debounce search input', () => {
    vi.useFakeTimers();

    store.getState().setSearchQuery('t');
    store.getState().setSearchQuery('te');
    store.getState().setSearchQuery('tes');
    store.getState().setSearchQuery('test');

    expect(store.getState().searchQuery).toBe('test');

    vi.useRealTimers();
  });
});

describe('List View Store - Keyboard Navigation', () => {
  let store: ListViewStore;

  beforeEach(() => {
    store = createListViewStore(todoDocType);
    store.getState().setDocuments(sampleDocuments);
  });

  it('should navigate to next row', () => {
    store.getState().setActiveRow('TODO-001');
    store.getState().navigateNext();

    expect(store.getState().activeRowId).toBe('TODO-002');
  });

  it('should navigate to previous row', () => {
    store.getState().setActiveRow('TODO-002');
    store.getState().navigatePrevious();

    expect(store.getState().activeRowId).toBe('TODO-001');
  });

  it('should not navigate past first row', () => {
    store.getState().setActiveRow('TODO-001');
    store.getState().navigatePrevious();

    expect(store.getState().activeRowId).toBe('TODO-001');
  });

  it('should not navigate past last row', () => {
    store.getState().setActiveRow('TODO-005');
    store.getState().navigateNext();

    expect(store.getState().activeRowId).toBe('TODO-005');
  });

  it('should select active row on space', () => {
    store.getState().setActiveRow('TODO-001');
    store.getState().toggleActiveRowSelection();

    expect(store.getState().selectedIds).toContain('TODO-001');
  });
});

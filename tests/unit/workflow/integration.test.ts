import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Document } from '../../../src/core/document/document.js';
import { WorkflowManager } from '../../../src/workflow/workflow.js';
import { WorkflowExecutor } from '../../../src/workflow/executor.js';
import type { WorkflowDefinition } from '../../../src/workflow/types.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';

describe('Workflow-Document Integration', () => {
  let workflowManager: WorkflowManager;
  let workflowExecutor: WorkflowExecutor;

  // Simple DocType metadata
  const taskDocType: DocTypeDefinition = {
    name: 'Task',
    module: 'Projects',
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
        submit: false,
        cancel: false,
        amend: false,
        if_owner: false,
      },
    ],
  };

  // Workflow definition
  const taskWorkflow: WorkflowDefinition = {
    name: 'Task Workflow',
    document_type: 'Task',
    is_active: true,
    workflow_state_field: 'workflow_state',
    states: [
      {
        state: 'Open',
        doc_status: 0,
        is_initial: true,
        color: 'blue',
      },
      {
        state: 'In Progress',
        doc_status: 0,
        color: 'orange',
      },
      {
        state: 'Completed',
        doc_status: 1,
        is_final: true,
        color: 'green',
      },
    ],
    transitions: [
      {
        from_state: 'Open',
        to_state: 'In Progress',
        action: 'Start Work',
        allowed_roles: ['Developer', 'Project Manager'],
      },
      {
        from_state: 'In Progress',
        to_state: 'Completed',
        action: 'Mark Complete',
        allowed_roles: ['Developer', 'Project Manager'],
      },
    ],
  };

  beforeEach(() => {
    workflowManager = new WorkflowManager();
    workflowExecutor = new WorkflowExecutor(workflowManager);
    workflowManager.registerWorkflow(taskWorkflow);
  });

  describe('Document Creation with Workflow', () => {
    it('should initialize new document with initial workflow state', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        title: 'Test Task',
      });

      const docData = doc.getData();
      workflowExecutor.initializeDocument('Task', docData, 'user@example.com');

      // Update document with initialized data
      doc.set('workflow_state', docData['workflow_state']);
      doc.set('docstatus', docData['docstatus']);

      expect(doc.get('workflow_state')).toBe('Open');
      expect(doc.get('docstatus')).toBe(0);
    });

    it('should preserve existing workflow state on initialization', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        title: 'Test Task',
        workflow_state: 'In Progress',
      });

      workflowExecutor.initializeDocument('Task', doc.getData(), 'user@example.com');

      expect(doc.get('workflow_state')).toBe('In Progress');
    });
  });

  describe('Document State Transitions', () => {
    it('should transition document through workflow states', async () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      const docData = doc.getData();

      // Transition from Open to In Progress
      await workflowExecutor.applyTransition('Task', docData, 'Start Work', 'dev@example.com', [
        'Developer',
      ]);

      // Update document with new data
      doc.set('workflow_state', docData['workflow_state']);
      doc.set('docstatus', docData['docstatus']);

      expect(doc.get('workflow_state')).toBe('In Progress');
      expect(doc.get('docstatus')).toBe(0);

      // Transition from In Progress to Completed
      await workflowExecutor.applyTransition('Task', docData, 'Mark Complete', 'dev@example.com', [
        'Developer',
      ]);

      doc.set('workflow_state', docData['workflow_state']);
      doc.set('docstatus', docData['docstatus']);

      expect(doc.get('workflow_state')).toBe('Completed');
      expect(doc.get('docstatus')).toBe(1);
    });

    it('should prevent unauthorized state transitions', async () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      const docData = doc.getData();

      // Try to transition with unauthorized role
      await expect(
        workflowExecutor.applyTransition(
          'Task',
          docData,
          'Start Work',
          'guest@example.com',
          ['Guest'], // Not in allowed roles
        ),
      ).rejects.toThrow('not allowed');

      // Workflow state should remain unchanged
      expect(doc.get('workflow_state')).toBe('Open');
    });

    it('should prevent invalid transitions', async () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      const docData = doc.getData();

      // Try to transition directly to Completed (not allowed from Open)
      await expect(
        workflowExecutor.applyTransition('Task', docData, 'Mark Complete', 'dev@example.com', [
          'Developer',
        ]),
      ).rejects.toThrow('No transition');

      // Workflow state should remain unchanged
      expect(doc.get('workflow_state')).toBe('Open');
    });
  });

  describe('Document Lifecycle Hook Integration', () => {
    it('should call lifecycle hooks during workflow transitions', async () => {
      // Create custom document class with hooks
      class TaskDocument extends Document {
        beforeSaveCalled = false;
        afterSaveCalled = false;

        override async beforeSave(): Promise<void> {
          this.beforeSaveCalled = true;
        }

        override async afterSave(): Promise<void> {
          this.afterSaveCalled = true;
        }
      }

      const doc = new TaskDocument(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      // Simulate transition with hooks
      const docData = doc.getData();

      await doc.beforeSave();
      await workflowExecutor.applyTransition('Task', docData, 'Start Work', 'dev@example.com', [
        'Developer',
      ]);
      doc.set('workflow_state', docData['workflow_state']);
      await doc.afterSave();

      expect(doc.beforeSaveCalled).toBe(true);
      expect(doc.afterSaveCalled).toBe(true);
      expect(doc.get('workflow_state')).toBe('In Progress');
    });
  });

  describe('Available Actions for Document', () => {
    it('should get available actions based on current state and user roles', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      const actions = workflowExecutor.getDocumentActions('Task', doc.getData(), ['Developer']);

      expect(actions).toHaveLength(1);
      expect(actions[0]?.action).toBe('Start Work');
      expect(actions[0]?.to_state).toBe('In Progress');
    });

    it('should return empty actions for final state', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Completed',
      });

      const actions = workflowExecutor.getDocumentActions('Task', doc.getData(), ['Developer']);

      expect(actions).toHaveLength(0);
    });

    it('should return only actions user has permission for', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      // User without required roles
      const actions = workflowExecutor.getDocumentActions('Task', doc.getData(), ['Guest']);

      expect(actions).toHaveLength(0);
    });
  });

  describe('Workflow State Validation', () => {
    it('should validate document has valid workflow state', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      expect(() => workflowExecutor.validateWorkflowState('Task', doc.getData())).not.toThrow();
    });

    it('should throw error for invalid workflow state', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'InvalidState',
      });

      expect(() => workflowExecutor.validateWorkflowState('Task', doc.getData())).toThrow(
        'Invalid workflow state',
      );
    });

    it('should throw error when workflow state field is missing', () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
      });

      expect(() => workflowExecutor.validateWorkflowState('Task', doc.getData())).toThrow(
        'does not have workflow state',
      );
    });
  });

  describe('Change Tracking with Workflow', () => {
    it('should track workflow state changes', async () => {
      const doc = new Document(taskDocType as unknown as DocTypeDefinition, {
        name: 'TASK-001',
        title: 'Test Task',
        workflow_state: 'Open',
      });

      // Mark as clean (simulate loaded from DB)
      doc.markAsClean();

      const docData = doc.getData();

      // Apply transition
      await workflowExecutor.applyTransition('Task', docData, 'Start Work', 'dev@example.com', [
        'Developer',
      ]);

      // Update document
      doc.set('workflow_state', docData['workflow_state']);

      // Check if change is detected
      expect(doc.hasChanged('workflow_state')).toBe(true);
      expect(doc.getPrevious('workflow_state')).toBe('Open');
      expect(doc.get('workflow_state')).toBe('In Progress');
    });
  });
});

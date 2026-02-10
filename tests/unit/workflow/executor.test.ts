import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowExecutor } from '../../../src/workflow/executor.js';
import { WorkflowManager } from '../../../src/workflow/workflow.js';
import type { WorkflowDefinition } from '../../../src/workflow/types.js';

describe('WorkflowExecutor', () => {
  let workflowManager: WorkflowManager;
  let workflowExecutor: WorkflowExecutor;

  // Sample workflow: Simple approval workflow
  const approvalWorkflow: WorkflowDefinition = {
    name: 'Simple Approval',
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
      {
        state: 'Cancelled',
        doc_status: 2,
        is_final: true,
        color: 'red',
      },
    ],
    transitions: [
      {
        from_state: 'Open',
        to_state: 'In Progress',
        action: 'Start',
        allowed_roles: ['User', 'Admin'],
      },
      {
        from_state: 'In Progress',
        to_state: 'Completed',
        action: 'Complete',
        allowed_roles: ['User', 'Admin'],
      },
      {
        from_state: 'Open',
        to_state: 'Cancelled',
        action: 'Cancel',
        allowed_roles: ['Admin'],
      },
      {
        from_state: 'In Progress',
        to_state: 'Cancelled',
        action: 'Cancel',
        allowed_roles: ['Admin'],
      },
    ],
  };

  beforeEach(() => {
    workflowManager = new WorkflowManager();
    workflowExecutor = new WorkflowExecutor(workflowManager);
    workflowManager.registerWorkflow(approvalWorkflow);
  });

  describe('Document Initialization', () => {
    it('should initialize document with initial state', () => {
      const doc = { name: 'TASK-001' };

      workflowExecutor.initializeDocument('Task', doc, 'user@example.com');

      expect(doc['workflow_state']).toBe('Open');
      expect(doc['docstatus']).toBe(0);
    });

    it('should not override existing workflow state', () => {
      const doc = { name: 'TASK-001', workflow_state: 'In Progress' };

      workflowExecutor.initializeDocument('Task', doc, 'user@example.com');

      expect(doc['workflow_state']).toBe('In Progress');
    });

    it('should handle custom workflow_state_field', () => {
      const customWorkflow = {
        ...approvalWorkflow,
        workflow_state_field: 'status',
      };
      workflowManager.registerWorkflow(customWorkflow);

      const doc = { name: 'TASK-001' };

      workflowExecutor.initializeDocument('Task', doc, 'user@example.com');

      expect(doc['status']).toBe('Open');
    });

    it('should do nothing for doctype without workflow', () => {
      const doc = { name: 'DOC-001' };

      workflowExecutor.initializeDocument('Non Existent', doc, 'user@example.com');

      expect(doc['workflow_state']).toBeUndefined();
    });
  });

  describe('State Transition Execution', () => {
    it('should execute valid transition', async () => {
      const doc = { name: 'TASK-001', workflow_state: 'Open' };

      await workflowExecutor.applyTransition(
        'Task',
        doc,
        'Start',
        'user@example.com',
        ['User'],
      );

      expect(doc['workflow_state']).toBe('In Progress');
      expect(doc['docstatus']).toBe(0);
    });

    it('should update doc_status on transition', async () => {
      const doc = { name: 'TASK-001', workflow_state: 'In Progress' };

      await workflowExecutor.applyTransition(
        'Task',
        doc,
        'Complete',
        'user@example.com',
        ['User'],
      );

      expect(doc['workflow_state']).toBe('Completed');
      expect(doc['docstatus']).toBe(1);
    });

    it('should throw error for unauthorized transition', async () => {
      const doc = { name: 'TASK-001', workflow_state: 'Open' };

      await expect(
        workflowExecutor.applyTransition(
          'Task',
          doc,
          'Cancel',
          'user@example.com',
          ['User'], // Only Admin can cancel
        ),
      ).rejects.toThrow('not allowed');
    });

    it('should throw error for invalid transition', async () => {
      const doc = { name: 'TASK-001', workflow_state: 'Open' };

      await expect(
        workflowExecutor.applyTransition(
          'Task',
          doc,
          'Complete', // Can't complete from Open
          'user@example.com',
          ['User'],
        ),
      ).rejects.toThrow('No transition');
    });

    it('should throw error when doctype has no workflow', async () => {
      const doc = { name: 'DOC-001' };

      await expect(
        workflowExecutor.applyTransition(
          'Non Existent',
          doc,
          'Start',
          'user@example.com',
          ['User'],
        ),
      ).rejects.toThrow('No active workflow');
    });
  });

  describe('Workflow State Validation', () => {
    it('should validate document is in correct state', () => {
      const doc = { name: 'TASK-001', workflow_state: 'Open' };

      expect(() =>
        workflowExecutor.validateWorkflowState('Task', doc),
      ).not.toThrow();
    });

    it('should throw error for invalid state', () => {
      const doc = { name: 'TASK-001', workflow_state: 'InvalidState' };

      expect(() => workflowExecutor.validateWorkflowState('Task', doc)).toThrow(
        'Invalid workflow state',
      );
    });

    it('should handle missing workflow_state field', () => {
      const doc = { name: 'TASK-001' };

      expect(() => workflowExecutor.validateWorkflowState('Task', doc)).toThrow(
        'does not have workflow state',
      );
    });

    it('should do nothing for doctype without workflow', () => {
      const doc = { name: 'DOC-001' };

      expect(() =>
        workflowExecutor.validateWorkflowState('Non Existent', doc),
      ).not.toThrow();
    });
  });

  describe('Workflow Actions Retrieval', () => {
    it('should get available actions for document', () => {
      const doc = { name: 'TASK-001', workflow_state: 'Open' };

      const actions = workflowExecutor.getDocumentActions(
        'Task',
        doc,
        ['User'],
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('Start');
    });

    it('should get multiple actions based on roles', () => {
      const doc = { name: 'TASK-001', workflow_state: 'Open' };

      const actions = workflowExecutor.getDocumentActions(
        'Task',
        doc,
        ['Admin'],
      );

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.action)).toContain('Start');
      expect(actions.map((a) => a.action)).toContain('Cancel');
    });

    it('should return empty array for final state', () => {
      const doc = { name: 'TASK-001', workflow_state: 'Completed' };

      const actions = workflowExecutor.getDocumentActions(
        'Task',
        doc,
        ['User'],
      );

      expect(actions).toHaveLength(0);
    });

    it('should return empty array for doctype without workflow', () => {
      const doc = { name: 'DOC-001' };

      const actions = workflowExecutor.getDocumentActions(
        'Non Existent',
        doc,
        ['User'],
      );

      expect(actions).toHaveLength(0);
    });
  });
});

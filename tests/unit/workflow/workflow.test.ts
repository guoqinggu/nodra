import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowManager,
  WorkflowValidationError,
} from '../../../src/workflow/workflow.js';
import type {
  WorkflowDefinition,
  WorkflowExecutionContext,
} from '../../../src/workflow/types.js';

describe('WorkflowManager', () => {
  let workflowManager: WorkflowManager;

  // Sample workflow definition: Purchase Order approval workflow
  const poWorkflow: WorkflowDefinition = {
    name: 'Purchase Order Approval',
    document_type: 'Purchase Order',
    is_active: true,
    workflow_state_field: 'workflow_state',
    states: [
      {
        state: 'Draft',
        doc_status: 0,
        is_initial: true,
        color: 'gray',
      },
      {
        state: 'Pending Approval',
        doc_status: 0,
        color: 'yellow',
      },
      {
        state: 'Approved',
        doc_status: 1,
        is_final: true,
        color: 'green',
      },
      {
        state: 'Rejected',
        doc_status: 2,
        is_final: true,
        color: 'red',
      },
    ],
    transitions: [
      {
        from_state: 'Draft',
        to_state: 'Pending Approval',
        action: 'Submit for Approval',
        allowed_roles: ['Employee', 'Manager'],
      },
      {
        from_state: 'Pending Approval',
        to_state: 'Approved',
        action: 'Approve',
        allowed_roles: ['Manager', 'Admin'],
      },
      {
        from_state: 'Pending Approval',
        to_state: 'Rejected',
        action: 'Reject',
        allowed_roles: ['Manager', 'Admin'],
      },
      {
        from_state: 'Pending Approval',
        to_state: 'Draft',
        action: 'Return to Draft',
        allowed_roles: ['Manager', 'Admin'],
      },
    ],
  };

  beforeEach(() => {
    workflowManager = new WorkflowManager();
  });

  describe('Workflow Registration', () => {
    it('should register a workflow definition', () => {
      workflowManager.registerWorkflow(poWorkflow);

      const workflow = workflowManager.getWorkflow('Purchase Order');
      expect(workflow).toEqual(poWorkflow);
    });

    it('should throw error when registering workflow without states', () => {
      const invalidWorkflow = {
        ...poWorkflow,
        states: [],
      };

      expect(() => workflowManager.registerWorkflow(invalidWorkflow)).toThrow(
        WorkflowValidationError,
      );
    });

    it('should throw error when registering workflow without initial state', () => {
      const invalidWorkflow = {
        ...poWorkflow,
        states: poWorkflow.states.map((s) => ({ ...s, is_initial: false })),
      };

      expect(() => workflowManager.registerWorkflow(invalidWorkflow)).toThrow(
        WorkflowValidationError,
      );
    });

    it('should throw error when registering workflow with multiple initial states', () => {
      const invalidWorkflow = {
        ...poWorkflow,
        states: poWorkflow.states.map((s) => ({ ...s, is_initial: true })),
      };

      expect(() => workflowManager.registerWorkflow(invalidWorkflow)).toThrow(
        WorkflowValidationError,
      );
    });

    it('should throw error when transition references non-existent state', () => {
      const invalidWorkflow = {
        ...poWorkflow,
        transitions: [
          {
            from_state: 'Draft',
            to_state: 'NonExistentState',
            action: 'Invalid',
            allowed_roles: ['Manager'],
          },
        ],
      };

      expect(() => workflowManager.registerWorkflow(invalidWorkflow)).toThrow(
        WorkflowValidationError,
      );
    });

    it('should allow overwriting existing workflow', () => {
      workflowManager.registerWorkflow(poWorkflow);

      const updatedWorkflow = {
        ...poWorkflow,
        is_active: false,
      };

      workflowManager.registerWorkflow(updatedWorkflow);

      const workflow = workflowManager.getWorkflow('Purchase Order');
      expect(workflow?.is_active).toBe(false);
    });
  });

  describe('Workflow Lookup', () => {
    beforeEach(() => {
      workflowManager.registerWorkflow(poWorkflow);
    });

    it('should get workflow by doctype', () => {
      const workflow = workflowManager.getWorkflow('Purchase Order');
      expect(workflow).toEqual(poWorkflow);
    });

    it('should return undefined for non-existent workflow', () => {
      const workflow = workflowManager.getWorkflow('Non Existent');
      expect(workflow).toBeUndefined();
    });

    it('should check if doctype has workflow', () => {
      expect(workflowManager.hasWorkflow('Purchase Order')).toBe(true);
      expect(workflowManager.hasWorkflow('Non Existent')).toBe(false);
    });

    it('should get initial state for a workflow', () => {
      const initialState = workflowManager.getInitialState('Purchase Order');
      expect(initialState).toBe('Draft');
    });
  });

  describe('State Transition Validation', () => {
    beforeEach(() => {
      workflowManager.registerWorkflow(poWorkflow);
    });

    it('should allow valid transition with correct role', () => {
      const context: WorkflowExecutionContext = {
        user: 'user@example.com',
        user_roles: ['Employee'],
        doc: { name: 'PO-001', workflow_state: 'Draft' },
        current_state: 'Draft',
        action: 'Submit for Approval',
      };

      const result = workflowManager.validateTransition('Purchase Order', context);

      expect(result.allowed).toBe(true);
      expect(result.new_state).toBe('Pending Approval');
    });

    it('should deny transition without required role', () => {
      const context: WorkflowExecutionContext = {
        user: 'user@example.com',
        user_roles: ['Guest'],
        doc: { name: 'PO-001', workflow_state: 'Pending Approval' },
        current_state: 'Pending Approval',
        action: 'Approve',
      };

      const result = workflowManager.validateTransition('Purchase Order', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('should deny transition from invalid state', () => {
      const context: WorkflowExecutionContext = {
        user: 'manager@example.com',
        user_roles: ['Manager'],
        doc: { name: 'PO-001', workflow_state: 'Draft' },
        current_state: 'Draft',
        action: 'Approve',
      };

      const result = workflowManager.validateTransition('Purchase Order', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No transition');
    });

    it('should deny transition with invalid action', () => {
      const context: WorkflowExecutionContext = {
        user: 'user@example.com',
        user_roles: ['Employee'],
        doc: { name: 'PO-001', workflow_state: 'Draft' },
        current_state: 'Draft',
        action: 'NonExistentAction',
      };

      const result = workflowManager.validateTransition('Purchase Order', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No transition');
    });
  });

  describe('Available Actions', () => {
    beforeEach(() => {
      workflowManager.registerWorkflow(poWorkflow);
    });

    it('should get available actions for user in Draft state', () => {
      const actions = workflowManager.getAvailableActions(
        'Purchase Order',
        'Draft',
        ['Employee'],
      );

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        action: 'Submit for Approval',
        to_state: 'Pending Approval',
      });
    });

    it('should get available actions for Manager in Pending Approval state', () => {
      const actions = workflowManager.getAvailableActions(
        'Purchase Order',
        'Pending Approval',
        ['Manager'],
      );

      expect(actions).toHaveLength(3);
      expect(actions.map((a) => a.action)).toEqual([
        'Approve',
        'Reject',
        'Return to Draft',
      ]);
    });

    it('should return empty array for user without permissions', () => {
      const actions = workflowManager.getAvailableActions(
        'Purchase Order',
        'Pending Approval',
        ['Guest'],
      );

      expect(actions).toHaveLength(0);
    });

    it('should return empty array for final state', () => {
      const actions = workflowManager.getAvailableActions(
        'Purchase Order',
        'Approved',
        ['Manager'],
      );

      expect(actions).toHaveLength(0);
    });

    it('should return empty array for non-existent workflow', () => {
      const actions = workflowManager.getAvailableActions(
        'Non Existent',
        'Draft',
        ['Manager'],
      );

      expect(actions).toHaveLength(0);
    });
  });

  describe('State Validation', () => {
    beforeEach(() => {
      workflowManager.registerWorkflow(poWorkflow);
    });

    it('should validate that state exists in workflow', () => {
      expect(workflowManager.isValidState('Purchase Order', 'Draft')).toBe(true);
      expect(workflowManager.isValidState('Purchase Order', 'Approved')).toBe(true);
      expect(workflowManager.isValidState('Purchase Order', 'Invalid')).toBe(false);
    });

    it('should check if state is final', () => {
      expect(workflowManager.isFinalState('Purchase Order', 'Draft')).toBe(false);
      expect(workflowManager.isFinalState('Purchase Order', 'Approved')).toBe(true);
      expect(workflowManager.isFinalState('Purchase Order', 'Rejected')).toBe(true);
    });
  });
});

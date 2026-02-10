/**
 * Workflow Executor - applies workflow transitions to documents
 */

import type {
  WorkflowExecutionContext,
  WorkflowTransition,
} from './types.js';
import { WorkflowManager } from './workflow.js';

/**
 * Workflow execution error
 */
export class WorkflowExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

/**
 * Workflow Executor - manages workflow transitions on documents
 */
export class WorkflowExecutor {
  constructor(private workflowManager: WorkflowManager) {}

  /**
   * Initialize a new document with workflow state
   */
  initializeDocument(
    doctype: string,
    doc: Record<string, unknown>,
    _user: string,
  ): void {
    const workflow = this.workflowManager.getWorkflow(doctype);
    if (!workflow || !workflow.is_active) {
      return;
    }

    const stateField = workflow.workflow_state_field || 'workflow_state';

    // Only set initial state if not already set
    if (!doc[stateField]) {
      const initialState = this.workflowManager.getInitialState(doctype);
      if (initialState) {
        doc[stateField] = initialState;

        // Set doc_status based on initial state
        const state = workflow.states.find((s) => s.state === initialState);
        if (state && state.doc_status !== undefined) {
          doc['docstatus'] = state.doc_status;
        }
      }
    }
  }

  /**
   * Apply a workflow transition to a document
   */
  async applyTransition(
    doctype: string,
    doc: Record<string, unknown>,
    action: string,
    user: string,
    userRoles: string[],
  ): Promise<void> {
    const workflow = this.workflowManager.getWorkflow(doctype);
    if (!workflow || !workflow.is_active) {
      throw new WorkflowExecutionError(
        `No active workflow found for ${doctype}`,
      );
    }

    const stateField = workflow.workflow_state_field || 'workflow_state';
    const currentState = doc[stateField] as string;

    if (!currentState) {
      throw new WorkflowExecutionError(
        `Document ${doc['name']} does not have workflow state`,
      );
    }

    // Validate transition
    const context: WorkflowExecutionContext = {
      user,
      user_roles: userRoles,
      doc,
      current_state: currentState,
      action,
    };

    const result = this.workflowManager.validateTransition(doctype, context);

    if (!result.allowed) {
      throw new WorkflowExecutionError(
        result.reason || 'Transition not allowed',
      );
    }

    // Apply state change
    if (result.new_state) {
      doc[stateField] = result.new_state;

      // Update doc_status based on new state
      const newState = workflow.states.find((s) => s.state === result.new_state);
      if (newState && newState.doc_status !== undefined) {
        doc['docstatus'] = newState.doc_status;
      }
    }
  }

  /**
   * Validate that document's workflow state is valid
   */
  validateWorkflowState(
    doctype: string,
    doc: Record<string, unknown>,
  ): void {
    const workflow = this.workflowManager.getWorkflow(doctype);
    if (!workflow || !workflow.is_active) {
      return;
    }

    const stateField = workflow.workflow_state_field || 'workflow_state';
    const currentState = doc[stateField] as string;

    if (!currentState) {
      throw new WorkflowExecutionError(
        `Document ${doc['name']} does not have workflow state field "${stateField}"`,
      );
    }

    if (!this.workflowManager.isValidState(doctype, currentState)) {
      throw new WorkflowExecutionError(
        `Invalid workflow state "${currentState}" for ${doctype}`,
      );
    }
  }

  /**
   * Get available actions for a document based on user's roles
   */
  getDocumentActions(
    doctype: string,
    doc: Record<string, unknown>,
    userRoles: string[],
  ): WorkflowTransition[] {
    const workflow = this.workflowManager.getWorkflow(doctype);
    if (!workflow || !workflow.is_active) {
      return [];
    }

    const stateField = workflow.workflow_state_field || 'workflow_state';
    const currentState = doc[stateField] as string;

    if (!currentState) {
      return [];
    }

    return this.workflowManager.getAvailableActions(
      doctype,
      currentState,
      userRoles,
    );
  }
}

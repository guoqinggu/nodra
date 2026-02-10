/**
 * Workflow Engine - Workflow Manager
 */

import type {
  WorkflowDefinition,
  WorkflowTransition,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowRegistry,
} from './types.js';

/**
 * Workflow validation error
 */
export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Workflow Manager - manages workflow definitions and validates transitions
 */
export class WorkflowManager {
  private registry: WorkflowRegistry;

  constructor() {
    this.registry = {
      workflows: new Map(),
    };
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.validateWorkflowDefinition(workflow);
    this.registry.workflows.set(workflow.document_type, workflow);
  }

  /**
   * Get workflow for a doctype
   */
  getWorkflow(doctype: string): WorkflowDefinition | undefined {
    return this.registry.workflows.get(doctype);
  }

  /**
   * Check if a doctype has a workflow
   */
  hasWorkflow(doctype: string): boolean {
    const workflow = this.registry.workflows.get(doctype);
    return workflow !== undefined && workflow.is_active;
  }

  /**
   * Get the initial state for a workflow
   */
  getInitialState(doctype: string): string | undefined {
    const workflow = this.registry.workflows.get(doctype);
    if (!workflow) return undefined;

    const initialState = workflow.states.find((s) => s.is_initial);
    return initialState?.state;
  }

  /**
   * Validate a state transition
   */
  validateTransition(
    doctype: string,
    context: WorkflowExecutionContext,
  ): WorkflowExecutionResult {
    const workflow = this.registry.workflows.get(doctype);

    if (!workflow || !workflow.is_active) {
      return {
        allowed: false,
        reason: `No active workflow found for ${doctype}`,
      };
    }

    // Find matching transition
    const transition = workflow.transitions.find(
      (t) =>
        t.from_state === context.current_state && t.action === context.action,
    );

    if (!transition) {
      return {
        allowed: false,
        reason: `No transition found from state "${context.current_state}" with action "${context.action}"`,
      };
    }

    // Check role permission
    const hasRole = transition.allowed_roles.some((role) =>
      context.user_roles.includes(role),
    );

    if (!hasRole) {
      return {
        allowed: false,
        reason: `User with roles [${context.user_roles.join(', ')}] is not allowed to perform action "${context.action}"`,
      };
    }

    return {
      allowed: true,
      new_state: transition.to_state,
    };
  }

  /**
   * Get available actions for a user in a given state
   */
  getAvailableActions(
    doctype: string,
    currentState: string,
    userRoles: string[],
  ): WorkflowTransition[] {
    const workflow = this.registry.workflows.get(doctype);

    if (!workflow || !workflow.is_active) {
      return [];
    }

    // Don't allow transitions from final states
    const state = workflow.states.find((s) => s.state === currentState);
    if (state?.is_final) {
      return [];
    }

    // Find all transitions from current state that user can perform
    return workflow.transitions.filter(
      (t) =>
        t.from_state === currentState &&
        t.allowed_roles.some((role) => userRoles.includes(role)),
    );
  }

  /**
   * Check if a state is valid for the workflow
   */
  isValidState(doctype: string, state: string): boolean {
    const workflow = this.registry.workflows.get(doctype);
    if (!workflow) return false;

    return workflow.states.some((s) => s.state === state);
  }

  /**
   * Check if a state is final
   */
  isFinalState(doctype: string, state: string): boolean {
    const workflow = this.registry.workflows.get(doctype);
    if (!workflow) return false;

    const workflowState = workflow.states.find((s) => s.state === state);
    return workflowState?.is_final === true;
  }

  /**
   * Validate a workflow definition
   */
  private validateWorkflowDefinition(workflow: WorkflowDefinition): void {
    // Must have at least one state
    if (workflow.states.length === 0) {
      throw new WorkflowValidationError(
        `Workflow "${workflow.name}" must have at least one state`,
      );
    }

    // Must have exactly one initial state
    const initialStates = workflow.states.filter((s) => s.is_initial);
    if (initialStates.length === 0) {
      throw new WorkflowValidationError(
        `Workflow "${workflow.name}" must have an initial state`,
      );
    }
    if (initialStates.length > 1) {
      throw new WorkflowValidationError(
        `Workflow "${workflow.name}" can only have one initial state`,
      );
    }

    // Validate all transitions reference existing states
    const stateNames = new Set(workflow.states.map((s) => s.state));

    for (const transition of workflow.transitions) {
      if (!stateNames.has(transition.from_state)) {
        throw new WorkflowValidationError(
          `Transition references non-existent state: ${transition.from_state}`,
        );
      }
      if (!stateNames.has(transition.to_state)) {
        throw new WorkflowValidationError(
          `Transition references non-existent state: ${transition.to_state}`,
        );
      }
    }
  }
}

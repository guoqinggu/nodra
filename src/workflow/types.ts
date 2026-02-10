/**
 * Workflow Engine - Type definitions
 */

export interface WorkflowState {
  /** State name (e.g., "Draft", "Pending", "Approved") */
  state: string;

  /** Document status value (0 = draft, 1 = submitted, 2 = cancelled) */
  doc_status?: number;

  /** Custom field to store state in (if not using doc_status) */
  state_field?: string;

  /** Is this the initial state? */
  is_initial?: boolean;

  /** Is this a final/terminal state? */
  is_final?: boolean;

  /** State color for UI (optional) */
  color?: string;
}

export interface WorkflowTransition {
  /** Source state */
  from_state: string;

  /** Target state */
  to_state: string;

  /** Action name shown to user (e.g., "Approve", "Reject") */
  action: string;

  /** Roles allowed to perform this transition */
  allowed_roles: string[];

  /** Optional condition (not implemented in Phase 9) */
  condition?: string;

  /** Next state if condition fails (not implemented in Phase 9) */
  next_state_on_condition_fail?: string;
}

export interface WorkflowDefinition {
  /** Workflow name */
  name: string;

  /** DocType this workflow applies to */
  document_type: string;

  /** Is this workflow active? */
  is_active: boolean;

  /** Field to store workflow state (defaults to "workflow_state") */
  workflow_state_field?: string;

  /** All states in this workflow */
  states: WorkflowState[];

  /** All allowed transitions */
  transitions: WorkflowTransition[];
}

export interface WorkflowExecutionContext {
  /** User performing the action */
  user: string;

  /** User's roles */
  user_roles: string[];

  /** Document being transitioned */
  doc: Record<string, unknown>;

  /** Current workflow state */
  current_state: string;

  /** Action being performed */
  action: string;
}

export interface WorkflowExecutionResult {
  /** Was transition allowed? */
  allowed: boolean;

  /** Reason if not allowed */
  reason?: string;

  /** New state after transition */
  new_state?: string;
}

/**
 * Workflow registry - manages all workflow definitions
 */
export interface WorkflowRegistry {
  /** Map of doctype -> workflow definition */
  workflows: Map<string, WorkflowDefinition>;
}

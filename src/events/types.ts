/**
 * Nodra Framework - Event System Types
 *
 * Defines the core types and interfaces for the event system.
 */

// --- Event Priority ---

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export const EVENT_PRIORITY_VALUES: Record<EventPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

// --- Core Event Types ---

export type EventType = string;

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  payload?: Record<string, unknown>;
}

// --- Event Handler ---

export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void> | void;

export interface EventHandlerRegistration<T extends BaseEvent = BaseEvent> {
  type: EventType;
  handler: EventHandler<T>;
  priority: EventPriority;
  once: boolean;
}

// --- Built-in Events ---

export interface DocumentEvent extends BaseEvent {
  doctype: string;
  name: string;
  operation: 'insert' | 'update' | 'delete' | 'submit' | 'cancel';
  data: Record<string, unknown>;
}

export interface UserEvent extends BaseEvent {
  user: string;
  action: string;
  details?: Record<string, unknown>;
}

export interface SystemEvent extends BaseEvent {
  component: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// --- Event Emitter Options ---

export interface EventEmitterOptions {
  /**
   * Maximum number of listeners per event type (default: 10)
   */
  maxListeners?: number;
  
  /**
   * Whether to throw errors when maxListeners is exceeded (default: false)
   */
  throwOnMaxListenersExceeded?: boolean;
  
  /**
   * Whether to log event emissions (default: false)
   */
  debug?: boolean;
}
/**
 * Nodra Framework - Event Emitter
 *
 * A type-safe, priority-based event emitter for the Nodra framework.
 * Supports both synchronous and asynchronous event handling.
 */

import type {
  EventType,
  BaseEvent,
  EventHandler,
  EventHandlerRegistration,
  EventPriority,
  EventEmitterOptions,
} from './types.js';
import { EVENT_PRIORITY_VALUES } from './types.js';

/**
 * Type-safe event emitter with priority support.
 */
export class EventEmitter {
  private handlers: Map<EventType, EventHandlerRegistration[]> = new Map();
  private options: Required<EventEmitterOptions>;
  private wildcardHandlers: EventHandlerRegistration[] = [];

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      maxListeners: 10,
      throwOnMaxListenersExceeded: false,
      debug: false,
      ...options,
    };
  }

  /**
   * Register an event handler for a specific event type.
   */
  on<T extends BaseEvent = BaseEvent>(
    type: EventType,
    handler: EventHandler<T>,
    priority: EventPriority = 'normal',
  ): this {
    this.addHandler(type, handler, priority, false);
    return this;
  }

  /**
   * Register a one-time event handler that will be removed after first execution.
   */
  once<T extends BaseEvent = BaseEvent>(
    type: EventType,
    handler: EventHandler<T>,
    priority: EventPriority = 'normal',
  ): this {
    this.addHandler(type, handler, priority, true);
    return this;
  }

  /**
   * Remove a specific event handler.
   */
  off<T extends BaseEvent = BaseEvent>(
    type: EventType,
    handler: EventHandler<T>,
  ): this {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const filtered = handlers.filter((h) => h.handler !== handler);
      if (filtered.length === 0) {
        this.handlers.delete(type);
      } else {
        this.handlers.set(type, filtered);
      }
    }
    return this;
  }

  /**
   * Remove all handlers for a specific event type.
   */
  removeAllListeners(type?: EventType): this {
    if (type) {
      this.handlers.delete(type);
    } else {
      this.handlers.clear();
      this.wildcardHandlers = [];
    }
    return this;
  }

  /**
   * Emit an event and call all registered handlers.
   * Returns a promise that resolves when all handlers have completed.
   */
  async emit<T extends BaseEvent = BaseEvent>(event: T): Promise<void> {
    if (this.options.debug) {
      console.debug(`[EventEmitter] Emitting event: ${event.type}`, event);
    }

    // Get specific handlers for this event type
    const specificHandlers = this.handlers.get(event.type) || [];
    
    // Get wildcard handlers (handle all events)
    const allHandlers = [...specificHandlers, ...this.wildcardHandlers];
    
    if (allHandlers.length === 0) {
      return;
    }

    // Sort by priority (highest first)
    const sortedHandlers = [...allHandlers].sort((a, b) => {
      return EVENT_PRIORITY_VALUES[b.priority] - EVENT_PRIORITY_VALUES[a.priority];
    });

    // Execute handlers in order
    for (const registration of sortedHandlers) {
      try {
        await Promise.resolve(registration.handler(event));
        
        // Remove once handlers after execution
        if (registration.once) {
          this.removeHandler(registration);
        }
      } catch (error) {
        console.error(`[EventEmitter] Error in handler for event ${event.type}:`, error);
        // Continue with other handlers even if one fails
      }
    }
  }

  /**
   * Register a wildcard handler that receives all events.
   */
  onAny<T extends BaseEvent = BaseEvent>(
    handler: EventHandler<T>,
    priority: EventPriority = 'normal',
  ): this {
    this.wildcardHandlers.push({
      type: '*',
      handler: handler as EventHandler<BaseEvent>,
      priority,
      once: false,
    });
    return this;
  }

  /**
   * Register a one-time wildcard handler.
   */
  onceAny<T extends BaseEvent = BaseEvent>(
    handler: EventHandler<T>,
    priority: EventPriority = 'normal',
  ): this {
    this.wildcardHandlers.push({
      type: '*',
      handler: handler as EventHandler<BaseEvent>,
      priority,
      once: true,
    });
    return this;
  }

  /**
   * Get the number of listeners for a specific event type.
   */
  listenerCount(type: EventType): number {
    return this.handlers.get(type)?.length || 0;
  }

  /**
   * Get all registered event types.
   */
  eventNames(): EventType[] {
    return Array.from(this.handlers.keys());
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private addHandler<T extends BaseEvent>(
    type: EventType,
    handler: EventHandler<T>,
    priority: EventPriority,
    once: boolean,
  ): void {
    const registration: EventHandlerRegistration = {
      type,
      handler: handler as EventHandler<BaseEvent>,
      priority,
      once,
    };

    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }

    const handlers = this.handlers.get(type);
    if (!handlers) {
      return;
    }
    
    // Check listener limit
    if (handlers.length >= this.options.maxListeners) {
      if (this.options.throwOnMaxListenersExceeded) {
        throw new Error(
          `Max listeners (${this.options.maxListeners}) exceeded for event type: ${type}`
        );
      } else {
        console.warn(
          `Max listeners (${this.options.maxListeners}) exceeded for event type: ${type}`
        );
      }
    }

    handlers.push(registration);
  }

  private removeHandler(registration: EventHandlerRegistration): void {
    if (registration.type === '*') {
      // Remove from wildcard handlers
      const index = this.wildcardHandlers.indexOf(registration);
      if (index !== -1) {
        this.wildcardHandlers.splice(index, 1);
      }
    } else {
      // Remove from specific event handlers
      const handlers = this.handlers.get(registration.type);
      if (handlers) {
        const index = handlers.indexOf(registration);
        if (index !== -1) {
          handlers.splice(index, 1);
          if (handlers.length === 0) {
            this.handlers.delete(registration.type);
          }
        }
      }
    }
  }
}
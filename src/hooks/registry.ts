/**
 * Nodra Framework - Hook Registry
 *
 * Manages registration and execution of application hooks.
 */

import type { 
  HooksConfig, 
  RegisteredHook, 
  HookRegistry
} from './types.js';
import type { EventEmitter } from '../events/emitter.js';

export class HookRegistryManager {
  private registry: HookRegistry;
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
    this.registry = {
      docHooks: new Map(),
      bootHooks: [],
      scheduledHooks: new Map(),
      methodOverrides: new Map(),
    };
  }

  /**
   * Register hooks from an app configuration
   */
  registerAppHooks(appName: string, config: HooksConfig): void {
    // Register doc_events hooks
    if (config.doc_events) {
      this.registerDocHooks(appName, config.doc_events);
    }

    // Register scheduler_events hooks
    if (config.scheduler_events) {
      this.registerScheduledHooks(appName, config.scheduler_events);
    }

    // Register boot_session hooks
    if (config.boot_session) {
      this.registerBootHooks(appName, config.boot_session);
    }

    // Register method overrides
    if (config.override_whitelisted_methods) {
      this.registerMethodOverrides(appName, config.override_whitelisted_methods);
    }
  }

  /**
   * Execute document lifecycle hooks
   */
  async executeDocHooks(
    doctype: string,
    event: string,
    doc: Record<string, unknown>,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    const key = `${doctype}:${event}`;
    const hooks = [
      ...(this.registry.docHooks.get(key) || []),
      ...(this.registry.docHooks.get(`*:${event}`) || []), // Wildcard doctype
    ];

    // Sort by priority
    const sortedHooks = [...hooks].sort((a, b) => b.priority - a.priority);

    for (const hook of sortedHooks) {
      try {
        if (typeof hook.handler === 'function') {
          await Promise.resolve(hook.handler(doc, { 
            type: `doc:${event}`,
            timestamp: new Date(),
            doctype,
            name: doc['name'] as string,
            operation: event as 'insert' | 'update' | 'delete' | 'submit' | 'cancel',
            data: doc,
            context
          }));
        }
      } catch (error) {
        console.error(`[HookRegistry] Error in doc hook ${hook['name']}:`, error);
        // Continue with other hooks
      }
    }
  }

  /**
   * Execute boot session hooks
   */
  async executeBootHooks(context: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    
    // Sort by priority
    const sortedHooks = [...this.registry.bootHooks].sort((a, b) => b.priority - a.priority);

    for (const hook of sortedHooks) {
      try {
        if (typeof hook.handler === 'function') {
          const hookResult = await Promise.resolve(hook.handler(context));
          if (hookResult && typeof hookResult === 'object') {
            Object.assign(result, hookResult);
          }
        }
      } catch (error) {
        console.error(`[HookRegistry] Error in boot hook ${hook['name']}:`, error);
        // Continue with other hooks
      }
    }

    return result;
  }

  /**
   * Execute scheduled hooks
   */
  async executeScheduledHooks(
    schedule: string,
    task: string,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    const hooks = this.registry.scheduledHooks.get(schedule) || [];
    
    // Sort by priority
    const sortedHooks = [...hooks].sort((a, b) => b.priority - a.priority);

    for (const hook of sortedHooks) {
      try {
        if (typeof hook.handler === 'function') {
          await Promise.resolve(hook.handler({
            type: 'scheduled',
            timestamp: new Date(),
            component: 'scheduler',
            level: 'info',
            message: `Executing scheduled task: ${task}`,
            task,
            schedule,
            ...context
          }));
        }
      } catch (error) {
        console.error(`[HookRegistry] Error in scheduled hook ${hook['name']}:`, error);
        // Continue with other hooks
      }
    }
  }

  /**
   * Get method override if exists
   */
  getMethodOverride(methodPath: string): ((...args: unknown[]) => Promise<unknown> | unknown) | undefined {
    const hook = this.registry.methodOverrides.get(methodPath);
    return hook ? (hook.handler as (...args: unknown[]) => Promise<unknown> | unknown) : undefined;
  }

  /**
   * Get all registered hooks for debugging
   */
  getRegistryInfo(): {
    docHooks: number;
    bootHooks: number;
    scheduledHooks: number;
    methodOverrides: number;
  } {
    return {
      docHooks: Array.from(this.registry.docHooks.values()).flat().length,
      bootHooks: this.registry.bootHooks.length,
      scheduledHooks: Array.from(this.registry.scheduledHooks.values()).flat().length,
      methodOverrides: this.registry.methodOverrides.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Registration Methods
  // ---------------------------------------------------------------------------

  private registerDocHooks(appName: string, docEvents: NonNullable<HooksConfig['doc_events']>): void {
    for (const [doctype, events] of Object.entries(docEvents)) {
      for (const [event, handlers] of Object.entries(events)) {
        const handlerList = Array.isArray(handlers) ? handlers : [handlers];
        const key = `${doctype}:${event}`;
        
        if (!this.registry.docHooks.has(key)) {
          this.registry.docHooks.set(key, []);
        }

        for (const handlerPath of handlerList) {
          // In a real implementation, this would dynamically import the handler
          // For now, we'll register a placeholder
          const hook: RegisteredHook = {
            name: `${appName}:${handlerPath}`,
            handler: this.createPlaceholderHandler(handlerPath),
            app: appName,
            priority: 100, // Default priority
          };

          const hooks = this.registry.docHooks.get(key);
          if (hooks) {
            hooks.push(hook);
          }
        }
      }
    }
  }

  private registerScheduledHooks(appName: string, schedulerEvents: NonNullable<HooksConfig['scheduler_events']>): void {
    // Register predefined schedules
    const schedules = ['daily', 'hourly', 'weekly', 'monthly'] as const;
    
    for (const schedule of schedules) {
      const handlers = schedulerEvents[schedule];
      if (handlers) {
        const handlerList = Array.isArray(handlers) ? handlers : [handlers];
        
        if (!this.registry.scheduledHooks.has(schedule)) {
          this.registry.scheduledHooks.set(schedule, []);
        }

        for (const handlerPath of handlerList) {
          const hook: RegisteredHook = {
            name: `${appName}:${handlerPath}`,
            handler: this.createPlaceholderHandler(handlerPath),
            app: appName,
            priority: 100,
          };

          const hooks = this.registry.scheduledHooks.get(schedule);
          if (hooks) {
            hooks.push(hook);
          }
        }
      }
    }

    // Register cron schedules
    if (schedulerEvents.cron) {
      for (const [cronExpression, handlers] of Object.entries(schedulerEvents.cron)) {
        const handlerList = Array.isArray(handlers) ? handlers : [handlers];
        
        if (!this.registry.scheduledHooks.has(cronExpression)) {
          this.registry.scheduledHooks.set(cronExpression, []);
        }

        for (const handlerPath of handlerList) {
          const hook: RegisteredHook = {
            name: `${appName}:${handlerPath}`,
            handler: this.createPlaceholderHandler(handlerPath),
            app: appName,
            priority: 100,
          };

          const hooks = this.registry.scheduledHooks.get(cronExpression);
          if (hooks) {
            hooks.push(hook);
          }
        }
      }
    }
  }

  private registerBootHooks(appName: string, bootHandlers: string | string[]): void {
    const handlerList = Array.isArray(bootHandlers) ? bootHandlers : [bootHandlers];

    for (const handlerPath of handlerList) {
      const hook: RegisteredHook = {
        name: `${appName}:${handlerPath}`,
        handler: this.createPlaceholderHandler(handlerPath),
        app: appName,
        priority: 100,
      };

      this.registry.bootHooks.push(hook);
    }
  }

  private registerMethodOverrides(
    appName: string, 
    overrides: NonNullable<HooksConfig['override_whitelisted_methods']>
  ): void {
    for (const [originalMethod, overrideMethod] of Object.entries(overrides)) {
      const hook: RegisteredHook = {
        name: `${appName}:${overrideMethod}`,
        handler: this.createPlaceholderHandler(overrideMethod),
        app: appName,
        priority: 100,
      };

      this.registry.methodOverrides.set(originalMethod, hook);
    }
  }

  /**
   * Create a placeholder handler for development
   * In production, this would dynamically import the actual handler function
   */
  private createPlaceholderHandler(handlerPath: string): (...args: unknown[]) => Promise<unknown> {
    return async (...args: unknown[]) => {
      console.debug(`[HookRegistry] Executing hook: ${handlerPath}`, args);
      // In a real implementation, this would:
      // 1. Parse the handler path (e.g., 'my_app.handlers.todo.after_save')
      // 2. Dynamically import the module
      // 3. Return the actual handler function
      return undefined;
    };
  }
}
/**
 * Nodra Framework - Hooks Module
 *
 * Application hook system for the Nodra framework.
 */

export { HookRegistryManager } from './registry.js';
export type {
  HooksConfig,
  DocEventsConfig,
  SchedulerEventsConfig,
  HookContext,
  DocHookHandler,
  BootHookHandler,
  ScheduledHookHandler,
  MethodOverrideHandler,
} from './types.js';
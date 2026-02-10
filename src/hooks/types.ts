/**
 * Nodra Framework - Hook System Types
 *
 * Defines the types and interfaces for the application hook system.
 */

import type { DocumentEvent, SystemEvent } from '../events/types.js';

// --- Hook Configuration ---

export interface DocEventsConfig {
  [doctype: string]: {
    [event: string]: string | string[]; // Handler function path(s)
  };
}

export interface SchedulerEventsConfig {
  /**
   * Daily scheduled events
   */
  daily?: string[];
  
  /**
   * Hourly scheduled events
   */
  hourly?: string[];
  
  /**
   * Weekly scheduled events
   */
  weekly?: string[];
  
  /**
   * Monthly scheduled events
   */
  monthly?: string[];
  
  /**
   * Cron expression scheduled events
   */
  cron?: Record<string, string | string[]>;
}

export interface HooksConfig {
  /**
   * Document lifecycle event hooks
   */
  doc_events?: DocEventsConfig;
  
  /**
   * Scheduled event hooks
   */
  scheduler_events?: SchedulerEventsConfig;
  
  /**
   * Boot session hooks (run when application starts)
   */
  boot_session?: string | string[];
  
  /**
   * Override whitelisted methods
   */
  override_whitelisted_methods?: Record<string, string>;
  
  /**
   * Include custom JavaScript files
   */
  app_include_js?: string[];
  
  /**
   * Include custom CSS files
   */
  app_include_css?: string[];
}

// --- Hook Context ---

export interface HookContext {
  /**
   * Current user (if authenticated)
   */
  user?: string;
  
  /**
   * Request context (for API hooks)
   */
  request?: unknown;
  
  /**
   * Additional context data
   */
  [key: string]: unknown;
}

// --- Built-in Hook Events ---

export interface DocHookEvent extends DocumentEvent {
  context: HookContext;
}

export interface BootHookEvent extends SystemEvent {
  context: HookContext;
}

export interface ScheduledHookEvent extends SystemEvent {
  task: string;
  schedule: string;
}

// --- Hook Handler Signatures ---

export type DocHookHandler = (
  doc: Record<string, unknown>,
  event: DocHookEvent
) => Promise<void> | void;

export type BootHookHandler = (
  context: HookContext
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type ScheduledHookHandler = (
  event: ScheduledHookEvent
) => Promise<void> | void;

export type MethodOverrideHandler = (
  ...args: unknown[]
) => Promise<unknown> | unknown;

// --- Hook Registry ---

export interface RegisteredHook {
  name: string;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
  app: string;
  priority: number;
}

export interface HookRegistry {
  docHooks: Map<string, RegisteredHook[]>;
  bootHooks: RegisteredHook[];
  scheduledHooks: Map<string, RegisteredHook[]>;
  methodOverrides: Map<string, RegisteredHook>;
}
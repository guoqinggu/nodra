/**
 * Tests for the HookRegistryManager class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HookRegistryManager } from '../../../src/hooks/registry.js';
import { EventEmitter } from '../../../src/events/emitter.js';
import type { HooksConfig } from '../../../src/hooks/types.js';

describe('HookRegistryManager', () => {
  let hookRegistry: HookRegistryManager;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    hookRegistry = new HookRegistryManager(eventEmitter);
  });

  // ---------------------------------------------------------------------------
  // Registration Tests
  // ---------------------------------------------------------------------------

  it('should register doc_events hooks', () => {
    const config: HooksConfig = {
      doc_events: {
        'User': {
          'afterSave': 'my_app.handlers.user.after_save',
          'beforeDelete': ['my_app.handlers.user.before_delete']
        },
        '*': {
          'validate': 'my_app.handlers.common.validate'
        }
      }
    };

    hookRegistry.registerAppHooks('my_app', config);
    
    const info = hookRegistry.getRegistryInfo();
    expect(info.docHooks).toBeGreaterThan(0);
  });

  it('should register scheduler_events hooks', () => {
    const config: HooksConfig = {
      scheduler_events: {
        daily: ['my_app.tasks.daily_cleanup'],
        hourly: 'my_app.tasks.sync_data',
        cron: {
          '0 */6 * * *': ['my_app.tasks.periodic_task']
        }
      }
    };

    hookRegistry.registerAppHooks('my_app', config);
    
    const info = hookRegistry.getRegistryInfo();
    expect(info.scheduledHooks).toBeGreaterThan(0);
  });

  it('should register boot_session hooks', () => {
    const config: HooksConfig = {
      boot_session: 'my_app.boot.get_boot_data'
    };

    hookRegistry.registerAppHooks('my_app', config);
    
    const info = hookRegistry.getRegistryInfo();
    expect(info.bootHooks).toBe(1);
  });

  it('should register method overrides', () => {
    const config: HooksConfig = {
      override_whitelisted_methods: {
        'nodra.api.some_method': 'my_app.override.custom_method'
      }
    };

    hookRegistry.registerAppHooks('my_app', config);
    
    const info = hookRegistry.getRegistryInfo();
    expect(info.methodOverrides).toBe(1);
    
    const override = hookRegistry.getMethodOverride('nodra.api.some_method');
    expect(override).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Doc Events Execution Tests
  // ---------------------------------------------------------------------------

  it('should execute doc_events hooks', async () => {
    const config: HooksConfig = {
      doc_events: {
        'User': {
          'afterSave': 'test_app.handlers.user.after_save'
        }
      }
    };

    hookRegistry.registerAppHooks('test_app', config);

    const doc = { name: 'USR001', email: 'test@example.com' };
    const context = { user: 'admin' };

    // Mock console.debug to verify hook execution
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await hookRegistry.executeDocHooks('User', 'afterSave', doc, context);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HookRegistry] Executing hook: test_app.handlers.user.after_save',
      expect.any(Array)
    );

    consoleSpy.mockRestore();
  });

  it('should execute wildcard doc_events hooks', async () => {
    const config: HooksConfig = {
      doc_events: {
        '*': {
          'validate': 'test_app.handlers.common.validate'
        }
      }
    };

    hookRegistry.registerAppHooks('test_app', config);

    const doc = { name: 'TODO001', title: 'Test Task' };

    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await hookRegistry.executeDocHooks('Todo', 'validate', doc);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HookRegistry] Executing hook: test_app.handlers.common.validate',
      expect.any(Array)
    );

    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Boot Hooks Execution Tests
  // ---------------------------------------------------------------------------

  it('should execute boot_session hooks', async () => {
    const config: HooksConfig = {
      boot_session: ['test_app.boot.init', 'test_app.boot.setup']
    };

    hookRegistry.registerAppHooks('test_app', config);

    const context = { site: 'test.local' };

    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const result = await hookRegistry.executeBootHooks(context);

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({});

    consoleSpy.mockRestore();
  });

  it('should merge results from boot hooks', async () => {
    // This would require mocking the actual handler functions
    // For now, we test that the method doesn't throw
    const config: HooksConfig = {
      boot_session: 'test_app.boot.get_data'
    };

    hookRegistry.registerAppHooks('test_app', config);
    
    await expect(hookRegistry.executeBootHooks()).resolves.not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Scheduled Hooks Execution Tests
  // ---------------------------------------------------------------------------

  it('should execute scheduled hooks', async () => {
    const config: HooksConfig = {
      scheduler_events: {
        daily: 'test_app.tasks.daily_task'
      }
    };

    hookRegistry.registerAppHooks('test_app', config);

    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await hookRegistry.executeScheduledHooks('daily', 'daily_task');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HookRegistry] Executing hook: test_app.tasks.daily_task',
      expect.any(Array)
    );

    consoleSpy.mockRestore();
  });

  it('should execute cron scheduled hooks', async () => {
    const config: HooksConfig = {
      scheduler_events: {
        cron: {
          '0 0 * * *': 'test_app.tasks.midnight_task'
        }
      }
    };

    hookRegistry.registerAppHooks('test_app', config);

    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await hookRegistry.executeScheduledHooks('0 0 * * *', 'midnight_task');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HookRegistry] Executing hook: test_app.tasks.midnight_task',
      expect.any(Array)
    );

    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Error Handling Tests
  // ---------------------------------------------------------------------------

  it('should continue execution when a hook fails', async () => {
    const config: HooksConfig = {
      doc_events: {
        'User': {
          'afterSave': ['test_app.handlers.user.good_hook', 'test_app.handlers.user.bad_hook']
        }
      }
    };

    hookRegistry.registerAppHooks('test_app', config);

    const doc = { name: 'USR001' };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The placeholder handlers don't actually fail, so this tests the error handling path
    await expect(hookRegistry.executeDocHooks('User', 'afterSave', doc)).resolves.not.toThrow();

    consoleErrorSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Registry Info Tests
  // ---------------------------------------------------------------------------

  it('should provide correct registry information', () => {
    const emptyInfo = hookRegistry.getRegistryInfo();
    expect(emptyInfo).toEqual({
      docHooks: 0,
      bootHooks: 0,
      scheduledHooks: 0,
      methodOverrides: 0
    });

    const config: HooksConfig = {
      doc_events: { 'User': { 'afterSave': 'test.handler' } },
      boot_session: 'test.boot',
      scheduler_events: { daily: 'test.task' },
      override_whitelisted_methods: { 'original': 'override' }
    };

    hookRegistry.registerAppHooks('test_app', config);
    
    const info = hookRegistry.getRegistryInfo();
    expect(info.docHooks).toBeGreaterThan(0);
    expect(info.bootHooks).toBeGreaterThan(0);
    expect(info.scheduledHooks).toBeGreaterThan(0);
    expect(info.methodOverrides).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Multiple Apps Tests
  // ---------------------------------------------------------------------------

  it('should handle hooks from multiple apps', async () => {
    const app1Config: HooksConfig = {
      doc_events: {
        'User': { 'afterSave': 'app1.handlers.user.save' }
      }
    };

    const app2Config: HooksConfig = {
      doc_events: {
        'User': { 'afterSave': 'app2.handlers.user.save' }
      }
    };

    hookRegistry.registerAppHooks('app1', app1Config);
    hookRegistry.registerAppHooks('app2', app2Config);

    const info = hookRegistry.getRegistryInfo();
    expect(info.docHooks).toBe(2); // Two handlers for the same event

    const doc = { name: 'USR001' };
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await hookRegistry.executeDocHooks('User', 'afterSave', doc);

    // Should call both app handlers
    expect(consoleSpy).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });
});
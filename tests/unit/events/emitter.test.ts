/**
 * Tests for the EventEmitter class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from '../../../src/events/emitter.js';
import type { BaseEvent, DocumentEvent } from '../../../src/events/types.js';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  // ---------------------------------------------------------------------------
  // Basic Event Handling Tests
  // ---------------------------------------------------------------------------

  it('should register and emit basic events', async () => {
    const handler = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', handler);
    await emitter.emit(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple handlers for the same event type', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', handler1);
    emitter.on('test', handler2);
    await emitter.emit(event);

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should handle events with different types separately', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event1 = { type: 'test1', timestamp: new Date() };
    const event2 = { type: 'test2', timestamp: new Date() };

    emitter.on('test1', handler1);
    emitter.on('test2', handler2);

    await emitter.emit(event1);
    await emitter.emit(event2);

    expect(handler1).toHaveBeenCalledWith(event1);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith(event2);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Once Handler Tests
  // ---------------------------------------------------------------------------

  it('should remove once handlers after first execution', async () => {
    const handler = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.once('test', handler);
    await emitter.emit(event);
    await emitter.emit(event); // Second emit should not call handler

    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle mixed once and regular handlers', async () => {
    const onceHandler = vi.fn();
    const regularHandler = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.once('test', onceHandler);
    emitter.on('test', regularHandler);

    await emitter.emit(event);
    await emitter.emit(event);

    expect(onceHandler).toHaveBeenCalledTimes(1);
    expect(regularHandler).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // Off/Remove Tests
  // ---------------------------------------------------------------------------

  it('should remove specific handlers', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', handler1);
    emitter.on('test', handler2);

    emitter.off('test', handler1);
    await emitter.emit(event);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('should remove all handlers for an event type', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', handler1);
    emitter.on('test', handler2);

    emitter.removeAllListeners('test');
    await emitter.emit(event);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should remove all handlers when called without arguments', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event1 = { type: 'test1', timestamp: new Date() };
    const event2 = { type: 'test2', timestamp: new Date() };

    emitter.on('test1', handler1);
    emitter.on('test2', handler2);

    emitter.removeAllListeners();
    await emitter.emit(event1);
    await emitter.emit(event2);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Async Event Handling Tests
  // ---------------------------------------------------------------------------

  it('should handle async handlers', async () => {
    const asyncHandler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', asyncHandler);
    await emitter.emit(event);

    expect(asyncHandler).toHaveBeenCalledWith(event);
  });

  it('should execute async handlers in sequence', async () => {
    const callOrder: number[] = [];

    const handler1 = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      callOrder.push(1);
    });

    const handler2 = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      callOrder.push(2);
    });

    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', handler1);
    emitter.on('test', handler2);

    await emitter.emit(event);

    expect(callOrder).toEqual([1, 2]); // First handler completes before second
  });

  it('should continue execution even if one handler fails', async () => {
    const failingHandler = vi.fn().mockImplementation(() => {
      throw new Error('Handler failed');
    });

    const successfulHandler = vi.fn();
    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', failingHandler);
    emitter.on('test', successfulHandler);

    await expect(emitter.emit(event)).resolves.toBeUndefined();

    expect(failingHandler).toHaveBeenCalledWith(event);
    expect(successfulHandler).toHaveBeenCalledWith(event);
  });

  // ---------------------------------------------------------------------------
  // Priority Tests
  // ---------------------------------------------------------------------------

  it('should execute handlers in priority order', async () => {
    const callOrder: string[] = [];

    const lowHandler = vi.fn().mockImplementation(() => callOrder.push('low'));
    const normalHandler = vi.fn().mockImplementation(() => callOrder.push('normal'));
    const highHandler = vi.fn().mockImplementation(() => callOrder.push('high'));
    const criticalHandler = vi.fn().mockImplementation(() => callOrder.push('critical'));

    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', lowHandler, 'low');
    emitter.on('test', normalHandler, 'normal');
    emitter.on('test', highHandler, 'high');
    emitter.on('test', criticalHandler, 'critical');

    await emitter.emit(event);

    expect(callOrder).toEqual(['critical', 'high', 'normal', 'low']);
  });

  it('should handle same priority handlers in registration order', async () => {
    const callOrder: number[] = [];

    const handler1 = vi.fn().mockImplementation(() => callOrder.push(1));
    const handler2 = vi.fn().mockImplementation(() => callOrder.push(2));
    const handler3 = vi.fn().mockImplementation(() => callOrder.push(3));

    const event = { type: 'test', timestamp: new Date() };

    emitter.on('test', handler1, 'normal');
    emitter.on('test', handler2, 'normal');
    emitter.on('test', handler3, 'normal');

    await emitter.emit(event);

    expect(callOrder).toEqual([1, 2, 3]);
  });

  // ---------------------------------------------------------------------------
  // Wildcard Handler Tests
  // ---------------------------------------------------------------------------

  it('should handle wildcard handlers for all events', async () => {
    const wildcardHandler = vi.fn();
    const event1 = { type: 'test1', timestamp: new Date() };
    const event2 = { type: 'test2', timestamp: new Date() };

    emitter.onAny(wildcardHandler);

    await emitter.emit(event1);
    await emitter.emit(event2);

    expect(wildcardHandler).toHaveBeenCalledWith(event1);
    expect(wildcardHandler).toHaveBeenCalledWith(event2);
    expect(wildcardHandler).toHaveBeenCalledTimes(2);
  });

  it('should handle once wildcard handlers', async () => {
    const wildcardHandler = vi.fn();
    const event1 = { type: 'test1', timestamp: new Date() };
    const event2 = { type: 'test2', timestamp: new Date() };

    emitter.onceAny(wildcardHandler);

    await emitter.emit(event1);
    await emitter.emit(event2); // Should not call handler again

    expect(wildcardHandler).toHaveBeenCalledWith(event1);
    expect(wildcardHandler).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Utility Methods Tests
  // ---------------------------------------------------------------------------

  it('should return correct listener count', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('test1', handler1);
    emitter.on('test1', handler2);
    emitter.on('test2', handler1);

    expect(emitter.listenerCount('test1')).toBe(2);
    expect(emitter.listenerCount('test2')).toBe(1);
    expect(emitter.listenerCount('test3')).toBe(0);
  });

  it('should return all event names', () => {
    const handler = vi.fn();

    emitter.on('test1', handler);
    emitter.on('test2', handler);
    emitter.on('test3', handler);

    const eventNames = emitter.eventNames();
    expect(eventNames).toContain('test1');
    expect(eventNames).toContain('test2');
    expect(eventNames).toContain('test3');
    expect(eventNames).toHaveLength(3);
  });

  // ---------------------------------------------------------------------------
  // Options and Limits Tests
  // ---------------------------------------------------------------------------

  it('should warn when exceeding max listeners', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emitter = new EventEmitter({ maxListeners: 2 });
    const handler = vi.fn();

    emitter.on('test', handler);
    emitter.on('test', handler);
    emitter.on('test', handler); // This should trigger warning

    expect(consoleWarnSpy).toHaveBeenCalledWith('Max listeners (2) exceeded for event type: test');

    consoleWarnSpy.mockRestore();
  });

  it('should throw when exceeding max listeners with throw option', () => {
    const emitter = new EventEmitter({
      maxListeners: 2,
      throwOnMaxListenersExceeded: true,
    });
    const handler = vi.fn();

    emitter.on('test', handler);
    emitter.on('test', handler);

    expect(() => emitter.on('test', handler)).toThrow(
      'Max listeners (2) exceeded for event type: test',
    );
  });

  // ---------------------------------------------------------------------------
  // Type Safety Tests
  // ---------------------------------------------------------------------------

  it('should handle typed events correctly', async () => {
    interface CustomEvent extends BaseEvent {
      data: { id: string; value: number };
    }

    const typedHandler = vi.fn((event: CustomEvent): void => {
      event.data.value * 2;
    });

    const customEvent: CustomEvent = {
      type: 'custom',
      timestamp: new Date(),
      data: { id: '123', value: 42 },
    };

    emitter.on<CustomEvent>('custom', typedHandler);
    await emitter.emit(customEvent);

    expect(typedHandler).toHaveBeenCalledWith(customEvent);
    expect(typedHandler).toHaveBeenCalledTimes(1);
  });

  it('should handle DocumentEvent type', async () => {
    const docHandler = vi.fn();
    const docEvent: DocumentEvent = {
      type: 'document.insert',
      timestamp: new Date(),
      doctype: 'User',
      name: 'USR001',
      operation: 'insert',
      data: { name: 'John Doe', email: 'john@example.com' },
    };

    emitter.on<DocumentEvent>('document.insert', docHandler);
    await emitter.emit(docEvent);

    expect(docHandler).toHaveBeenCalledWith(docEvent);
  });
});

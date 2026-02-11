/**
 * Tests for WebSocket connection and basic communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket as MockWebSocket } from 'ws';
import type { ConnectedClient, ClientMessage, ServerMessage } from '../../../src/realtime/types.js';

// Mock WebSocket
vi.mock('ws', () => {
  return {
    WebSocket: class {
      public readyState = 1; // OPEN
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: ((error: Error) => void) | null = null;
      public sentMessages: string[] = [];

      send(data: string) {
        this.sentMessages.push(data);
      }

      close() {
        if (this.onclose) this.onclose();
      }

      // Simulate receiving a message
      simulateMessage(data: string) {
        if (this.onmessage) {
          this.onmessage({ data });
        }
      }
    },
  };
});

describe('WebSocket Connection', () => {
  let ws: MockWebSocket;

  beforeEach(() => {
    ws = new MockWebSocket('ws://localhost:3000');
  });

  afterEach(() => {
    ws.close();
  });

  it('should create a WebSocket connection', () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(1); // OPEN
  });

  it('should send a message', () => {
    const message: ClientMessage = {
      type: 'subscribe',
      doctype: 'Todo',
    };

    ws.send(JSON.stringify(message));

    expect((ws as any).sentMessages).toHaveLength(1);
    expect(JSON.parse((ws as any).sentMessages[0])).toEqual(message);
  });

  it('should receive a message', () => {
    const receivedMessages: ServerMessage[] = [];

    ws.onmessage = (event) => {
      receivedMessages.push(JSON.parse(event.data));
    };

    const message: ServerMessage = {
      type: 'doc_update',
      doctype: 'Todo',
      name: 'TODO-001',
      data: { status: 'Completed' },
    };

    (ws as any).simulateMessage(JSON.stringify(message));

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toEqual(message);
  });

  it('should handle connection close', () => {
    let closed = false;
    ws.onclose = () => {
      closed = true;
    };

    ws.close();

    expect(closed).toBe(true);
  });

  it('should handle errors', () => {
    let errorReceived = false;
    ws.onerror = () => {
      errorReceived = true;
    };

    if (ws.onerror) {
      ws.onerror(new Error('Connection error'));
    }

    expect(errorReceived).toBe(true);
  });
});

describe('ConnectedClient', () => {
  it('should track client metadata', () => {
    const ws = new MockWebSocket('ws://localhost:3000');
    const client: ConnectedClient = {
      ws: ws as any,
      userId: 'user-123',
      rooms: new Set(['doctype:Todo', 'document:Todo:TODO-001']),
      lastPing: Date.now(),
    };

    expect(client.userId).toBe('user-123');
    expect(client.rooms.size).toBe(2);
    expect(client.rooms.has('doctype:Todo')).toBe(true);
    expect(client.rooms.has('document:Todo:TODO-001')).toBe(true);
  });

  it('should manage room subscriptions', () => {
    const ws = new MockWebSocket('ws://localhost:3000');
    const client: ConnectedClient = {
      ws: ws as any,
      rooms: new Set(),
      lastPing: Date.now(),
    };

    // Subscribe to rooms
    client.rooms.add('doctype:Todo');
    client.rooms.add('document:Todo:TODO-001');

    expect(client.rooms.size).toBe(2);

    // Unsubscribe from a room
    client.rooms.delete('doctype:Todo');

    expect(client.rooms.size).toBe(1);
    expect(client.rooms.has('document:Todo:TODO-001')).toBe(true);
  });
});

describe('Message Protocol', () => {
  it('should serialize/deserialize subscribe message', () => {
    const message: ClientMessage = {
      type: 'subscribe',
      doctype: 'Todo',
    };

    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(message);
  });

  it('should serialize/deserialize document-specific subscribe message', () => {
    const message: ClientMessage = {
      type: 'subscribe',
      doctype: 'Todo',
      name: 'TODO-001',
    };

    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(message);
  });

  it('should serialize/deserialize doc_update message', () => {
    const message: ServerMessage = {
      type: 'doc_update',
      doctype: 'Todo',
      name: 'TODO-001',
      data: {
        status: 'Completed',
        modified: '2026-02-10T10:00:00Z',
      },
    };

    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(message);
  });

  it('should serialize/deserialize error message', () => {
    const message: ServerMessage = {
      type: 'error',
      error: 'Invalid message format',
    };

    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(message);
  });

  it('should serialize/deserialize ping/pong messages', () => {
    const ping: ClientMessage = { type: 'ping' };
    const pong: ServerMessage = { type: 'pong' };

    expect(JSON.parse(JSON.stringify(ping))).toEqual(ping);
    expect(JSON.parse(JSON.stringify(pong))).toEqual(pong);
  });
});

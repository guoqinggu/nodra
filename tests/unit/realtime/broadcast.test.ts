/**
 * Tests for document event broadcasting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Room, ServerMessage, DocEvent } from '../../../src/realtime/types';
import { DefaultRoomManager } from '../../../src/realtime/room-manager';

/**
 * Mock WebSocket server for testing broadcasts
 */
class MockBroadcastServer {
  private roomManager = new DefaultRoomManager();
  private sentMessages = new Map<string, ServerMessage[]>();

  subscribe(clientId: string, room: Room): void {
    this.roomManager.subscribe(clientId, room);
    if (!this.sentMessages.has(clientId)) {
      this.sentMessages.set(clientId, []);
    }
  }

  broadcast(room: Room, message: ServerMessage): void {
    const clientIds = this.roomManager.getClientsInRoom(room);

    for (const clientId of clientIds) {
      this.send(clientId, message);
    }
  }

  send(clientId: string, message: ServerMessage): void {
    if (!this.sentMessages.has(clientId)) {
      this.sentMessages.set(clientId, []);
    }
    this.sentMessages.get(clientId)!.push(message);
  }

  getMessagesForClient(clientId: string): ServerMessage[] {
    return this.sentMessages.get(clientId) || [];
  }

  clearMessages(): void {
    this.sentMessages.clear();
  }
}

describe('Document Event Broadcasting', () => {
  let server: MockBroadcastServer;

  beforeEach(() => {
    server = new MockBroadcastServer();
  });

  describe('DocType Room Broadcasting', () => {
    it('should broadcast doc_create to all clients in doctype room', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      // Subscribe multiple clients to Todo doctype
      server.subscribe('client-1', room);
      server.subscribe('client-2', room);
      server.subscribe('client-3', room);

      // Broadcast document creation event
      const message: ServerMessage = {
        type: 'doc_create',
        doctype: 'Todo',
        name: 'TODO-001',
        data: {
          title: 'New Todo',
          status: 'Open',
        },
      };

      server.broadcast(room, message);

      // All clients should receive the message
      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(1);
      expect(server.getMessagesForClient('client-3')).toHaveLength(1);

      expect(server.getMessagesForClient('client-1')[0]).toEqual(message);
    });

    it('should broadcast doc_update to doctype room', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      server.subscribe('client-1', room);
      server.subscribe('client-2', room);

      const message: ServerMessage = {
        type: 'doc_update',
        doctype: 'Todo',
        name: 'TODO-001',
        data: {
          status: 'Completed',
        },
      };

      server.broadcast(room, message);

      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(1);
    });

    it('should broadcast doc_delete to doctype room', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      server.subscribe('client-1', room);

      const message: ServerMessage = {
        type: 'doc_delete',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      server.broadcast(room, message);

      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-1')[0].type).toBe('doc_delete');
    });

    it('should not broadcast to clients subscribed to different doctypes', () => {
      const todoRoom: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      const userRoom: Room = {
        type: 'doctype',
        doctype: 'User',
      };

      server.subscribe('client-1', todoRoom);
      server.subscribe('client-2', userRoom);

      const message: ServerMessage = {
        type: 'doc_create',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      server.broadcast(todoRoom, message);

      // Only client-1 should receive the message
      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(0);
    });
  });

  describe('Document Room Broadcasting', () => {
    it('should broadcast to specific document room', () => {
      const room: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      server.subscribe('client-1', room);
      server.subscribe('client-2', room);

      const message: ServerMessage = {
        type: 'doc_update',
        doctype: 'Todo',
        name: 'TODO-001',
        data: {
          status: 'Completed',
        },
      };

      server.broadcast(room, message);

      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(1);
    });

    it('should not broadcast to document rooms of different documents', () => {
      const room1: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      const room2: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-002',
      };

      server.subscribe('client-1', room1);
      server.subscribe('client-2', room2);

      const message: ServerMessage = {
        type: 'doc_update',
        doctype: 'Todo',
        name: 'TODO-001',
        data: {
          status: 'Completed',
        },
      };

      server.broadcast(room1, message);

      // Only client-1 should receive the message
      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(0);
    });
  });

  describe('Multi-Room Broadcasting', () => {
    it('should broadcast to both doctype and document rooms', () => {
      const doctypeRoom: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      const documentRoom: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      // Client 1 subscribes to both rooms
      server.subscribe('client-1', doctypeRoom);
      server.subscribe('client-1', documentRoom);

      // Client 2 only subscribes to doctype room
      server.subscribe('client-2', doctypeRoom);

      // Client 3 only subscribes to document room
      server.subscribe('client-3', documentRoom);

      const message: ServerMessage = {
        type: 'doc_update',
        doctype: 'Todo',
        name: 'TODO-001',
        data: {
          status: 'Completed',
        },
      };

      // Broadcast to doctype room
      server.broadcast(doctypeRoom, message);

      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(1);
      expect(server.getMessagesForClient('client-3')).toHaveLength(0);

      server.clearMessages();

      // Broadcast to document room
      server.broadcast(documentRoom, message);

      expect(server.getMessagesForClient('client-1')).toHaveLength(1);
      expect(server.getMessagesForClient('client-2')).toHaveLength(0);
      expect(server.getMessagesForClient('client-3')).toHaveLength(1);
    });
  });

  describe('DocEvent Integration', () => {
    it('should convert DocEvent to ServerMessage and broadcast', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      server.subscribe('client-1', room);

      // Simulate a document event
      const docEvent: DocEvent = {
        doctype: 'Todo',
        name: 'TODO-001',
        action: 'create',
        data: {
          title: 'New Todo',
          status: 'Open',
        },
        user: 'user@example.com',
      };

      // Convert to ServerMessage
      const message: ServerMessage = {
        type: 'doc_create',
        doctype: docEvent.doctype,
        name: docEvent.name,
        data: docEvent.data,
      };

      server.broadcast(room, message);

      const messages = server.getMessagesForClient('client-1');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('doc_create');
      expect(messages[0].doctype).toBe('Todo');
      expect(messages[0].name).toBe('TODO-001');
    });

    it('should handle update events', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      server.subscribe('client-1', room);

      const docEvent: DocEvent = {
        doctype: 'Todo',
        name: 'TODO-001',
        action: 'update',
        data: {
          status: 'Completed',
        },
      };

      const message: ServerMessage = {
        type: 'doc_update',
        doctype: docEvent.doctype,
        name: docEvent.name,
        data: docEvent.data,
      };

      server.broadcast(room, message);

      const messages = server.getMessagesForClient('client-1');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('doc_update');
    });

    it('should handle delete events', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      server.subscribe('client-1', room);

      const docEvent: DocEvent = {
        doctype: 'Todo',
        name: 'TODO-001',
        action: 'delete',
      };

      const message: ServerMessage = {
        type: 'doc_delete',
        doctype: docEvent.doctype,
        name: docEvent.name,
      };

      server.broadcast(room, message);

      const messages = server.getMessagesForClient('client-1');
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('doc_delete');
    });
  });
});

/**
 * Tests for room management system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Room } from '../../../src/realtime/types';

/**
 * Helper to create room key from Room object
 */
function getRoomKey(room: Room): string {
  if (room.type === 'doctype') {
    return `doctype:${room.doctype}`;
  }
  return `document:${room.doctype}:${room.name}`;
}

/**
 * Simple in-memory room manager for testing
 */
class TestRoomManager {
  // Map of room key -> Set of client IDs
  private rooms = new Map<string, Set<string>>();
  // Map of client ID -> Set of room keys
  private clientRooms = new Map<string, Set<string>>();

  subscribe(clientId: string, room: Room): void {
    const roomKey = getRoomKey(room);

    // Add client to room
    if (!this.rooms.has(roomKey)) {
      this.rooms.set(roomKey, new Set());
    }
    this.rooms.get(roomKey)!.add(clientId);

    // Add room to client
    if (!this.clientRooms.has(clientId)) {
      this.clientRooms.set(clientId, new Set());
    }
    this.clientRooms.get(clientId)!.add(roomKey);
  }

  unsubscribe(clientId: string, room: Room): void {
    const roomKey = getRoomKey(room);

    // Remove client from room
    const roomClients = this.rooms.get(roomKey);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        this.rooms.delete(roomKey);
      }
    }

    // Remove room from client
    const rooms = this.clientRooms.get(clientId);
    if (rooms) {
      rooms.delete(roomKey);
      if (rooms.size === 0) {
        this.clientRooms.delete(clientId);
      }
    }
  }

  getClientsInRoom(room: Room): Set<string> {
    const roomKey = getRoomKey(room);
    return new Set(this.rooms.get(roomKey) || []);
  }

  getRoomsForClient(clientId: string): Set<string> {
    return new Set(this.clientRooms.get(clientId) || []);
  }

  removeClient(clientId: string): void {
    const rooms = this.clientRooms.get(clientId);
    if (rooms) {
      // Remove client from all rooms
      for (const roomKey of rooms) {
        const roomClients = this.rooms.get(roomKey);
        if (roomClients) {
          roomClients.delete(clientId);
          if (roomClients.size === 0) {
            this.rooms.delete(roomKey);
          }
        }
      }
      this.clientRooms.delete(clientId);
    }
  }
}

describe('Room Manager', () => {
  let manager: TestRoomManager;

  beforeEach(() => {
    manager = new TestRoomManager();
  });

  describe('DocType Rooms', () => {
    it('should subscribe client to doctype room', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      manager.subscribe('client-1', room);

      const clients = manager.getClientsInRoom(room);
      expect(clients.has('client-1')).toBe(true);
    });

    it('should handle multiple clients in doctype room', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      manager.subscribe('client-1', room);
      manager.subscribe('client-2', room);
      manager.subscribe('client-3', room);

      const clients = manager.getClientsInRoom(room);
      expect(clients.size).toBe(3);
      expect(clients.has('client-1')).toBe(true);
      expect(clients.has('client-2')).toBe(true);
      expect(clients.has('client-3')).toBe(true);
    });

    it('should unsubscribe client from doctype room', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      manager.subscribe('client-1', room);
      manager.subscribe('client-2', room);

      manager.unsubscribe('client-1', room);

      const clients = manager.getClientsInRoom(room);
      expect(clients.size).toBe(1);
      expect(clients.has('client-2')).toBe(true);
    });
  });

  describe('Document Rooms', () => {
    it('should subscribe client to document room', () => {
      const room: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      manager.subscribe('client-1', room);

      const clients = manager.getClientsInRoom(room);
      expect(clients.has('client-1')).toBe(true);
    });

    it('should handle multiple clients in document room', () => {
      const room: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      manager.subscribe('client-1', room);
      manager.subscribe('client-2', room);

      const clients = manager.getClientsInRoom(room);
      expect(clients.size).toBe(2);
    });

    it('should keep document rooms separate by document name', () => {
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

      manager.subscribe('client-1', room1);
      manager.subscribe('client-2', room2);

      const clients1 = manager.getClientsInRoom(room1);
      const clients2 = manager.getClientsInRoom(room2);

      expect(clients1.size).toBe(1);
      expect(clients2.size).toBe(1);
      expect(clients1.has('client-1')).toBe(true);
      expect(clients2.has('client-2')).toBe(true);
    });
  });

  describe('Client Management', () => {
    it('should track multiple rooms for a client', () => {
      const room1: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      const room2: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      manager.subscribe('client-1', room1);
      manager.subscribe('client-1', room2);

      const rooms = manager.getRoomsForClient('client-1');
      expect(rooms.size).toBe(2);
      expect(rooms.has('doctype:Todo')).toBe(true);
      expect(rooms.has('document:Todo:TODO-001')).toBe(true);
    });

    it('should remove client from all rooms on disconnect', () => {
      const room1: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      const room2: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      manager.subscribe('client-1', room1);
      manager.subscribe('client-1', room2);

      manager.removeClient('client-1');

      expect(manager.getClientsInRoom(room1).size).toBe(0);
      expect(manager.getClientsInRoom(room2).size).toBe(0);
      expect(manager.getRoomsForClient('client-1').size).toBe(0);
    });

    it('should handle empty rooms after all clients unsubscribe', () => {
      const room: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      manager.subscribe('client-1', room);
      manager.subscribe('client-2', room);

      manager.unsubscribe('client-1', room);
      manager.unsubscribe('client-2', room);

      const clients = manager.getClientsInRoom(room);
      expect(clients.size).toBe(0);
    });
  });

  describe('Room Isolation', () => {
    it('should keep doctype and document rooms separate', () => {
      const doctypeRoom: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      const documentRoom: Room = {
        type: 'document',
        doctype: 'Todo',
        name: 'TODO-001',
      };

      manager.subscribe('client-1', doctypeRoom);
      manager.subscribe('client-2', documentRoom);

      expect(manager.getClientsInRoom(doctypeRoom).has('client-1')).toBe(true);
      expect(manager.getClientsInRoom(doctypeRoom).has('client-2')).toBe(false);

      expect(manager.getClientsInRoom(documentRoom).has('client-2')).toBe(true);
      expect(manager.getClientsInRoom(documentRoom).has('client-1')).toBe(false);
    });

    it('should keep different doctypes separate', () => {
      const todoRoom: Room = {
        type: 'doctype',
        doctype: 'Todo',
      };

      const userRoom: Room = {
        type: 'doctype',
        doctype: 'User',
      };

      manager.subscribe('client-1', todoRoom);
      manager.subscribe('client-2', userRoom);

      expect(manager.getClientsInRoom(todoRoom).size).toBe(1);
      expect(manager.getClientsInRoom(userRoom).size).toBe(1);
    });
  });
});

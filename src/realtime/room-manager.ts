/**
 * Room manager for WebSocket subscriptions
 */

import type { Room, RoomManager } from './types.js';

/**
 * Helper to create room key from Room object
 */
export function getRoomKey(room: Room): string {
  if (room.type === 'doctype') {
    return `doctype:${room.doctype}`;
  }
  return `document:${room.doctype}:${room.name ?? ''}`;
}

/**
 * Parse room key back to Room object
 */
export function parseRoomKey(key: string): Room | null {
  const parts = key.split(':');

  if (parts[0] === 'doctype' && parts.length === 2) {
    return {
      type: 'doctype',
      doctype: parts[1] ?? '',
    };
  }

  if (parts[0] === 'document' && parts.length === 3) {
    return {
      type: 'document',
      doctype: parts[1] ?? '',
      name: parts[2],
    };
  }

  return null;
}

/**
 * In-memory room manager for WebSocket subscriptions
 */
export class DefaultRoomManager implements RoomManager {
  // Map of room key -> Set of client IDs
  private rooms = new Map<string, Set<string>>();
  // Map of client ID -> Set of room keys
  private clientRooms = new Map<string, Set<string>>();

  /**
   * Subscribe a client to a room
   */
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

  /**
   * Unsubscribe a client from a room
   */
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

  /**
   * Get all clients subscribed to a room
   */
  getClientsInRoom(room: Room): Set<string> {
    const roomKey = getRoomKey(room);
    return new Set(this.rooms.get(roomKey) || []);
  }

  /**
   * Get all rooms a client is subscribed to
   */
  getRoomsForClient(clientId: string): Set<string> {
    return new Set(this.clientRooms.get(clientId) || []);
  }

  /**
   * Remove a client from all rooms (on disconnect)
   */
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

  /**
   * Get all active rooms (for debugging/monitoring)
   */
  getAllRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get all connected clients (for debugging/monitoring)
   */
  getAllClients(): string[] {
    return Array.from(this.clientRooms.keys());
  }

  /**
   * Clear all rooms and clients (for testing)
   */
  clear(): void {
    this.rooms.clear();
    this.clientRooms.clear();
  }
}

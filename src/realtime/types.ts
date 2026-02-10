/**
 * Real-time WebSocket types for document change notifications
 */

import type { WebSocket } from 'ws';

/**
 * WebSocket message types
 */
export type MessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'doc_update'
  | 'doc_create'
  | 'doc_delete'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * Message sent from client to server
 */
export interface ClientMessage {
  type: MessageType;
  doctype?: string;
  name?: string;
  room?: string;
  data?: unknown;
}

/**
 * Message sent from server to client
 */
export interface ServerMessage {
  type: MessageType;
  doctype?: string;
  name?: string;
  room?: string;
  data?: unknown;
  error?: string;
}

/**
 * Room types for organizing subscriptions
 */
export type RoomType = 'doctype' | 'document';

/**
 * Room identifier
 */
export interface Room {
  type: RoomType;
  doctype: string;
  name?: string; // undefined for doctype rooms, defined for document rooms
}

/**
 * Connected WebSocket client with metadata
 */
export interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  rooms: Set<string>;
  lastPing: number;
}

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
  path?: string;
  pingInterval?: number;
  pingTimeout?: number;
  maxPayload?: number;
}

/**
 * Document event data for broadcasting
 */
export interface DocEvent {
  doctype: string;
  name: string;
  action: 'create' | 'update' | 'delete';
  data?: unknown;
  user?: string;
}

/**
 * Room manager interface
 */
export interface RoomManager {
  subscribe(clientId: string, room: Room): void;
  unsubscribe(clientId: string, room: Room): void;
  getClientsInRoom(room: Room): Set<string>;
  getRoomsForClient(clientId: string): Set<string>;
  removeClient(clientId: string): void;
}

/**
 * WebSocket server interface
 */
export interface WebSocketServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(room: Room, message: ServerMessage): void;
  send(clientId: string, message: ServerMessage): void;
  getConnectedClients(): Map<string, ConnectedClient>;
}

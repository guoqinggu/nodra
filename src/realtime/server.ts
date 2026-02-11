/**
 * WebSocket server for real-time document notifications
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type {
  WebSocketConfig,
  WebSocketServer as IWebSocketServer,
  ConnectedClient,
  ClientMessage,
  ServerMessage,
  Room,
} from './types.js';
import { DefaultRoomManager, getRoomKey } from './room-manager.js';
import { randomUUID } from 'crypto';

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  path: '/ws',
  pingInterval: 30000, // 30 seconds
  pingTimeout: 10000, // 10 seconds
  maxPayload: 1024 * 1024, // 1MB
};

/**
 * WebSocket server implementation using Fastify WebSocket plugin
 */
export class WebSocketServer implements IWebSocketServer {
  private app: FastifyInstance;
  private config: Required<WebSocketConfig>;
  private clients = new Map<string, ConnectedClient>();
  private roomManager = new DefaultRoomManager();
  private pingIntervalId?: NodeJS.Timeout;
  private started = false;

  constructor(app: FastifyInstance, config?: WebSocketConfig) {
    this.app = app;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    // Register WebSocket plugin (must be done before routes)
    await this.app.register(import('@fastify/websocket'), {
      options: {
        maxPayload: this.config.maxPayload,
      },
    });

    // Register WebSocket route
    this.app.register(async (fastify) => {
      fastify.get(this.config.path, { websocket: true }, (socket, _req) => {
        this.handleConnection(socket);
      });
    });

    // Start ping interval
    this.startPingInterval();

    this.started = true;
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop ping interval
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close();
      this.roomManager.removeClient(clientId);
    }

    this.clients.clear();
    this.started = false;
  }

  /**
   * Broadcast a message to all clients in a room
   */
  broadcast(room: Room, message: ServerMessage): void {
    const clientIds = this.roomManager.getClientsInRoom(room);

    for (const clientId of clientIds) {
      this.send(clientId, message);
    }
  }

  /**
   * Send a message to a specific client
   */
  send(clientId: string, message: ServerMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      if (client.ws.readyState === 1) {
        // 1 = OPEN
        client.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
    }
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): Map<string, ConnectedClient> {
    return new Map(this.clients);
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = randomUUID();
    const client: ConnectedClient = {
      ws,
      rooms: new Set(),
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch {
        this.sendError(clientId, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // Handle errors
    ws.on('error', () => {
      this.handleDisconnect(clientId);
    });
  }

  /**
   * Handle incoming client message
   */
  private handleMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, message);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message);
        break;

      case 'ping':
        client.lastPing = Date.now();
        this.send(clientId, { type: 'pong' });
        break;

      default:
        this.sendError(clientId, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle subscribe message
   */
  private handleSubscribe(clientId: string, message: ClientMessage): void {
    const { doctype, name } = message;

    if (!doctype) {
      this.sendError(clientId, 'doctype is required for subscription');
      return;
    }

    const room: Room = name ? { type: 'document', doctype, name } : { type: 'doctype', doctype };

    this.roomManager.subscribe(clientId, room);

    const client = this.clients.get(clientId);
    if (client) {
      client.rooms.add(getRoomKey(room));
    }
  }

  /**
   * Handle unsubscribe message
   */
  private handleUnsubscribe(clientId: string, message: ClientMessage): void {
    const { doctype, name } = message;

    if (!doctype) {
      this.sendError(clientId, 'doctype is required for unsubscription');
      return;
    }

    const room: Room = name ? { type: 'document', doctype, name } : { type: 'doctype', doctype };

    this.roomManager.unsubscribe(clientId, room);

    const client = this.clients.get(clientId);
    if (client) {
      client.rooms.delete(getRoomKey(room));
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    this.roomManager.removeClient(clientId);
    this.clients.delete(clientId);
  }

  /**
   * Send an error message to a client
   */
  private sendError(clientId: string, error: string): void {
    this.send(clientId, { type: 'error', error });
  }

  /**
   * Start ping interval to detect stale connections
   */
  private startPingInterval(): void {
    this.pingIntervalId = setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceLastPing = now - client.lastPing;

        if (timeSinceLastPing > this.config.pingTimeout) {
          // Client didn't respond to ping, close connection
          client.ws.close();
          this.handleDisconnect(clientId);
        } else if (timeSinceLastPing > this.config.pingInterval / 2) {
          // Send ping if we're halfway to the timeout
          this.send(clientId, { type: 'ping' });
        }
      }
    }, this.config.pingInterval);
  }
}

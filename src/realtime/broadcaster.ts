/**
 * Document event broadcaster - integrates WebSocket server with document lifecycle
 */

import type { WebSocketServer } from './server.js';
import type { DocEvent, Room, ServerMessage } from './types.js';

/**
 * Helper to convert DocEvent action to ServerMessage type
 */
function getMessageType(
  action: DocEvent['action']
): 'doc_create' | 'doc_update' | 'doc_delete' {
  if (action === 'create') {
    return 'doc_create';
  } else if (action === 'update') {
    return 'doc_update';
  } else {
    return 'doc_delete';
  }
}

/**
 * Broadcast document events to WebSocket clients
 */
export class DocumentEventBroadcaster {
  constructor(private wsServer: WebSocketServer) {}

  /**
   * Broadcast a document event to subscribed clients
   */
  broadcastDocEvent(event: DocEvent): void {
    const message: ServerMessage = {
      type: getMessageType(event.action),
      doctype: event.doctype,
      name: event.name,
      data: event.data,
    };

    // Broadcast to doctype room (all documents of this type)
    const doctypeRoom: Room = {
      type: 'doctype',
      doctype: event.doctype,
    };
    this.wsServer.broadcast(doctypeRoom, message);

    // For update/delete events, also broadcast to specific document room
    if (event.action === 'update' || event.action === 'delete') {
      const documentRoom: Room = {
        type: 'document',
        doctype: event.doctype,
        name: event.name,
      };
      this.wsServer.broadcast(documentRoom, message);
    }
  }

  /**
   * Broadcast document creation
   */
  broadcastCreate(doctype: string, name: string, data?: unknown): void {
    this.broadcastDocEvent({
      doctype,
      name,
      action: 'create',
      data,
    });
  }

  /**
   * Broadcast document update
   */
  broadcastUpdate(doctype: string, name: string, data?: unknown): void {
    this.broadcastDocEvent({
      doctype,
      name,
      action: 'update',
      data,
    });
  }

  /**
   * Broadcast document deletion
   */
  broadcastDelete(doctype: string, name: string): void {
    this.broadcastDocEvent({
      doctype,
      name,
      action: 'delete',
    });
  }
}

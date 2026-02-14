/**
 * Permission middleware for Fastify
 *
 * Authenticates and authorizes requests before handling
 */

import type { FastifyRequest } from 'fastify';
import type { DocTypeRegistry } from '../core/doctype/registry.js';
import type { ORM } from '../orm/crud.js';
import { extractTokenFromHeader, verifyToken, type SessionConfig } from '../auth/session.js';
import {
  hasPermission,
  type PermissionAction,
  type UserContext,
  getRoleHierarchy,
} from '../permissions/permission.js';
import { logPermissionCheck } from '../permissions/audit-log.js';
import { AuthenticationError, PermissionError, NotFoundError } from '../core/errors.js';

/**
 * Extended request type with user info
 */
interface RequestWithUser extends FastifyRequest {
  user?: {
    email: string;
    fullName?: string;
    userType: string;
  };
}

/**
 * Request params with name
 */
interface RequestParamsWithName {
  name: string;
}

/**
 * User roles cache (in production this would come from database)
 * For now, we'll fetch from User document
 */
async function getUserRoles(orm: ORM, userEmail: string): Promise<string[]> {
  try {
    const user = await orm.getDoc('User', userEmail);

    const roles = user.get('roles') as Array<{ role: string }> | undefined;

    if (!roles || roles.length === 0) {
      return ['Guest'];
    }

    const userRoles = roles.map((r) => r.role);

    const roleHierarchy = await getRoleHierarchyFromDB(orm);
    return getRoleHierarchy(userRoles, roleHierarchy);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new AuthenticationError('User not found');
    }
    throw error;
  }
}

/**
 * Get role hierarchy from database
 */
async function getRoleHierarchyFromDB(orm: ORM): Promise<Map<string, string>> {
  const hierarchy = new Map<string, string>();

  try {
    const roles = await orm.getList('Role', { filters: { disabled: 0 } });

    for (const role of roles) {
      const parentRole = role.get('parent_role') as string | undefined;
      const roleName = role.get('role_name') as string;

      if (parentRole) {
        hierarchy.set(roleName, parentRole);
      }
    }
  } catch {
    // If Role DocType doesn't exist yet, return empty hierarchy
  }

  return hierarchy;
}

/**
 * Create authentication middleware
 * Verifies JWT token and adds user context to request
 */
export function createAuthMiddleware(sessionConfig: SessionConfig) {
  return async (request: FastifyRequest): Promise<void> => {
    const authHeader = request.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Verify and decode token
    const payload = verifyToken(token, sessionConfig.secret as string);

    // Attach user info to request
    (request as RequestWithUser).user = {
      email: payload.email,
      fullName: payload.fullName,
      userType: payload.userType,
    };
  };
}

/**
 * Create permission checking middleware for DocType operations
 *
 * @param registry - DocType registry
 * @param orm - ORM instance
 * @param action - Permission action to check
 * @param getDoctypeName - Function to extract doctype name from request
 */
export function createPermissionMiddleware(
  registry: DocTypeRegistry,
  orm: ORM,
  action: PermissionAction,
  getDoctypeName: (request: FastifyRequest) => string,
) {
  return async (request: FastifyRequest): Promise<void> => {
    // Check if user is authenticated
    const user = (request as RequestWithUser).user;
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    // Get doctype name from request
    const doctypeName = getDoctypeName(request);

    // Get DocType definition
    let doctype;
    try {
      doctype = registry.get(doctypeName);
    } catch {
      throw new NotFoundError('DocType', doctypeName);
    }

    // Get user roles
    const roles = await getUserRoles(orm, user.email);

    const userContext: UserContext = {
      email: user.email,
      roles,
    };

    // For read/write/delete operations, check document owner if applicable
    let documentOwner: string | undefined;
    let docName: string | undefined;
    if (['write', 'delete'].includes(action)) {
      const params = request.params as RequestParamsWithName;
      docName = params.name;
      if (docName) {
        try {
          const doc = await orm.getDoc(doctypeName, docName);
          documentOwner = doc.get('owner') as string;
        } catch {
          // Document not found, will be handled by route handler
        }
      }
    }

    // Check permission
    const hasPerm = hasPermission(doctype, action, userContext, documentOwner);

    // Log permission check
    await logPermissionCheck({
      userEmail: user.email,
      action,
      doctype: doctypeName,
      documentName: docName,
      result: hasPerm ? 'Allowed' : 'Denied',
      ipAddress: (request.ip as string) || 'unknown',
    });

    if (!hasPerm) {
      throw new PermissionError(
        doctypeName,
        action,
        `You do not have permission to ${action} ${doctypeName}`,
      );
    }
  };
}

/**
 * Optional authentication middleware (doesn't throw if no token)
 * Just attaches user if token is present
 */
export function createOptionalAuthMiddleware(sessionConfig: SessionConfig) {
  return async (request: FastifyRequest): Promise<void> => {
    const authHeader = request.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const payload = verifyToken(token, sessionConfig.secret as string);
        (request as RequestWithUser).user = {
          email: payload.email,
          fullName: payload.fullName,
          userType: payload.userType,
        };
      } catch {
        // Invalid token, but don't throw - just continue without user
      }
    }
  };
}

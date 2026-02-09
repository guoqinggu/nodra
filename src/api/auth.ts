/**
 * Authentication API endpoints
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ORM } from '../orm/crud.js';
import type { DocTypeRegistry } from '../core/doctype/registry.js';
import { verifyPassword } from '../auth/password.js';
import { generateToken, verifyToken, extractTokenFromHeader, type SessionConfig } from '../auth/session.js';
import { AuthenticationError, NotFoundError } from '../core/errors.js';
import type { Document } from '../core/document/document.js';

/**
 * Login request body
 */
interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response
 */
interface LoginResponse {
  message: string;
  user: {
    email: string;
    full_name: string;
    user_type: string;
  };
  token: string;
}

/**
 * Register authentication routes
 */
export function authRoutes(
  server: FastifyInstance,
  orm: ORM,
  registry: DocTypeRegistry,
  sessionConfig: SessionConfig
): void {
  /**
   * POST /api/method/login
   * Authenticate user and return JWT token
   */
  server.post<{ Body: LoginRequest }>(
    '/api/method/login',
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      // Validate input
      if (!email || !password) {
        throw new AuthenticationError('Email and password are required');
      }

      try {
        // Fetch user by email
        const user = await orm.getDoc('User', email);

        // Check if user is enabled
        const enabled = user.get('enabled') as boolean;
        if (!enabled) {
          throw new AuthenticationError('User account is disabled');
        }

        // Verify password
        const hashedPassword = user.get('password') as string;
        const isValidPassword = await verifyPassword(hashedPassword, password);

        if (!isValidPassword) {
          throw new AuthenticationError('Invalid email or password');
        }

        // Update last login info
        const now = new Date();
        user.set('last_login', now);
        user.set('last_ip', request.ip);

        // Note: We skip saving for now as it would require full ORM save implementation
        // await user.save();

        // Generate JWT token
        const token = generateToken(
          {
            email: user.get('email') as string,
            fullName: user.get('full_name') as string,
            userType: user.get('user_type') as string,
          },
          sessionConfig
        );

        const response: LoginResponse = {
          message: 'Login successful',
          user: {
            email: user.get('email') as string,
            full_name: user.get('full_name') as string,
            user_type: user.get('user_type') as string,
          },
          token,
        };

        return reply.code(200).send({ data: response });
      } catch (error) {
        if (error instanceof NotFoundError) {
          // Don't reveal whether user exists or not
          throw new AuthenticationError('Invalid email or password');
        }
        throw error;
      }
    }
  );

  /**
   * POST /api/method/logout
   * Logout current user (client-side token removal)
   */
  server.post(
    '/api/method/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // JWT is stateless, so logout is handled client-side by removing the token
      // This endpoint exists for consistency and future session management
      return reply.code(200).send({
        data: {
          message: 'Logout successful',
        },
      });
    }
  );

  /**
   * GET /api/method/get_logged_user
   * Get currently logged in user from JWT token
   */
  server.get(
    '/api/method/get_logged_user',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        throw new AuthenticationError('No authentication token provided');
      }

      // Verify token
      const payload = verifyToken(token, sessionConfig.secret);

      try {
        // Fetch fresh user data
        const user = await orm.getDoc('User', payload.email);

        // Check if user is still enabled
        const enabled = user.get('enabled') as boolean;
        if (!enabled) {
          throw new AuthenticationError('User account is disabled');
        }

        return reply.code(200).send({
          data: {
            email: user.get('email'),
            full_name: user.get('full_name'),
            first_name: user.get('first_name'),
            last_name: user.get('last_name'),
            user_type: user.get('user_type'),
            enabled: user.get('enabled'),
          },
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new AuthenticationError('User not found');
        }
        throw error;
      }
    }
  );
}

import { describe, it, expect } from 'vitest';
import {
  NodraError,
  ValidationError,
  PermissionError,
  NotFoundError,
  DuplicateError,
  LinkValidationError,
  MandatoryError,
  InvalidStateError,
  DatabaseError,
  AuthenticationError,
  AppError,
} from '../../../src/core/errors.js';

describe('Error Hierarchy', () => {
  describe('NodraError (base)', () => {
    it('should be an instance of Error', () => {
      const err = new NodraError('test error');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(NodraError);
    });

    it('should have correct name and message', () => {
      const err = new NodraError('something went wrong');
      expect(err.name).toBe('NodraError');
      expect(err.message).toBe('something went wrong');
    });

    it('should capture stack trace', () => {
      const err = new NodraError('test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('NodraError');
    });

    it('should default to 500 HTTP status', () => {
      const err = new NodraError('test');
      expect(err.httpStatus).toBe(500);
    });
  });

  describe('ValidationError', () => {
    it('should extend NodraError', () => {
      const err = new ValidationError('invalid data');
      expect(err).toBeInstanceOf(NodraError);
      expect(err).toBeInstanceOf(ValidationError);
    });

    it('should have 400 HTTP status', () => {
      const err = new ValidationError('bad input');
      expect(err.httpStatus).toBe(400);
      expect(err.name).toBe('ValidationError');
    });

    it('should carry field-level details', () => {
      const details = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Must be a positive number' },
      ];
      const err = new ValidationError('Validation failed', { details });
      expect(err.details).toEqual(details);
      expect(err.details).toHaveLength(2);
    });
  });

  describe('MandatoryError', () => {
    it('should extend ValidationError', () => {
      const err = new MandatoryError('title', 'Todo');
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(NodraError);
    });

    it('should have 400 HTTP status', () => {
      const err = new MandatoryError('title', 'Todo');
      expect(err.httpStatus).toBe(400);
      expect(err.name).toBe('MandatoryError');
    });

    it('should format message with field and doctype', () => {
      const err = new MandatoryError('title', 'Todo');
      expect(err.message).toContain('title');
      expect(err.message).toContain('Todo');
      expect(err.fieldname).toBe('title');
      expect(err.doctype).toBe('Todo');
    });
  });

  describe('LinkValidationError', () => {
    it('should extend ValidationError', () => {
      const err = new LinkValidationError('assigned_to', 'User', 'nonexistent@test.com');
      expect(err).toBeInstanceOf(ValidationError);
    });

    it('should have 400 HTTP status and carry context', () => {
      const err = new LinkValidationError('assigned_to', 'User', 'nonexistent@test.com');
      expect(err.httpStatus).toBe(400);
      expect(err.name).toBe('LinkValidationError');
      expect(err.fieldname).toBe('assigned_to');
      expect(err.doctype).toBe('User');
      expect(err.value).toBe('nonexistent@test.com');
    });
  });

  describe('PermissionError', () => {
    it('should extend NodraError with 403 status', () => {
      const err = new PermissionError('Todo', 'read');
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(403);
      expect(err.name).toBe('PermissionError');
    });

    it('should carry doctype and action context', () => {
      const err = new PermissionError('Todo', 'read', 'Access denied');
      expect(err.doctype).toBe('Todo');
      expect(err.action).toBe('read');
      expect(err.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    it('should extend NodraError with 404 status', () => {
      const err = new NotFoundError('Todo', 'TODO-0001');
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(404);
      expect(err.name).toBe('NotFoundError');
    });

    it('should format message with doctype and name', () => {
      const err = new NotFoundError('Todo', 'TODO-0001');
      expect(err.message).toContain('Todo');
      expect(err.message).toContain('TODO-0001');
      expect(err.doctype).toBe('Todo');
      expect(err.docName).toBe('TODO-0001');
    });
  });

  describe('DuplicateError', () => {
    it('should extend NodraError with 409 status', () => {
      const err = new DuplicateError('Todo', 'TODO-0001');
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(409);
      expect(err.name).toBe('DuplicateError');
    });

    it('should carry context', () => {
      const err = new DuplicateError('Todo', 'TODO-0001');
      expect(err.message).toContain('Todo');
      expect(err.message).toContain('TODO-0001');
      expect(err.doctype).toBe('Todo');
      expect(err.docName).toBe('TODO-0001');
    });
  });

  describe('InvalidStateError', () => {
    it('should extend NodraError with 409 status', () => {
      const err = new InvalidStateError('Cannot transition from Draft to Cancelled');
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(409);
      expect(err.name).toBe('InvalidStateError');
    });

    it('should carry state transition context', () => {
      const err = new InvalidStateError('Invalid transition', {
        doctype: 'Todo',
        from: 'Draft',
        to: 'Cancelled',
      });
      expect(err.doctype).toBe('Todo');
      expect(err.from).toBe('Draft');
      expect(err.to).toBe('Cancelled');
    });
  });

  describe('DatabaseError', () => {
    it('should extend NodraError with 500 status', () => {
      const err = new DatabaseError('Connection refused');
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(500);
      expect(err.name).toBe('DatabaseError');
    });

    it('should wrap original database error', () => {
      const original = new Error('ECONNREFUSED');
      const err = new DatabaseError('Connection failed', { cause: original });
      expect(err.cause).toBe(original);
    });
  });

  describe('AuthenticationError', () => {
    it('should extend NodraError with 401 status', () => {
      const err = new AuthenticationError('Invalid credentials');
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(401);
      expect(err.name).toBe('AuthenticationError');
    });
  });

  describe('AppError', () => {
    it('should extend NodraError with configurable status', () => {
      const err = new AppError('Custom error', 422);
      expect(err).toBeInstanceOf(NodraError);
      expect(err.httpStatus).toBe(422);
      expect(err.name).toBe('AppError');
    });

    it('should default to 500 status', () => {
      const err = new AppError('Something broke');
      expect(err.httpStatus).toBe(500);
    });
  });

  describe('toJSON serialization', () => {
    it('should serialize NodraError to JSON', () => {
      const err = new ValidationError('Bad input', {
        details: [{ field: 'title', message: 'Required' }],
      });
      const json = err.toJSON();
      expect(json.type).toBe('ValidationError');
      expect(json.message).toBe('Bad input');
      expect(json.httpStatus).toBe(400);
      expect(json.details).toHaveLength(1);
    });

    it('should not include stack in JSON output', () => {
      const err = new NodraError('test');
      const json = err.toJSON();
      expect(json).not.toHaveProperty('stack');
    });
  });
});

/**
 * Nodra Framework - Error Hierarchy
 *
 * All framework errors extend NodraError. Each error type maps
 * to a specific HTTP status code for API responses.
 */

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorJSON {
  type: string;
  message: string;
  httpStatus: number;
  details?: ErrorDetail[];
  [key: string]: unknown;
}

/**
 * Base error class for all Nodra framework errors.
 * Maps to HTTP 500 by default.
 */
export class NodraError extends Error {
  public readonly httpStatus: number;

  constructor(message: string, httpStatus = 500) {
    super(message);
    this.name = 'NodraError';
    this.httpStatus = httpStatus;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      type: this.name,
      message: this.message,
      httpStatus: this.httpStatus,
    };
  }
}

// --- 400 Errors ---

export class ValidationError extends NodraError {
  public readonly details: ErrorDetail[];

  constructor(message: string, options?: { details?: ErrorDetail[] }) {
    super(message, 400);
    this.name = 'ValidationError';
    this.details = options?.details ?? [];
  }

  override toJSON(): ErrorJSON {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

export class MandatoryError extends ValidationError {
  public readonly fieldname: string;
  public readonly doctype: string;

  constructor(fieldname: string, doctype: string) {
    super(`${doctype}: "${fieldname}" is a mandatory field`, {
      details: [{ field: fieldname, message: 'This field is required' }],
    });
    this.name = 'MandatoryError';
    this.fieldname = fieldname;
    this.doctype = doctype;
  }
}

export class LinkValidationError extends ValidationError {
  public readonly fieldname: string;
  public readonly doctype: string;
  public readonly value: string;

  constructor(fieldname: string, doctype: string, value: string) {
    super(`Link validation failed: "${value}" not found in ${doctype}`, {
      details: [{ field: fieldname, message: `"${value}" is not a valid ${doctype}` }],
    });
    this.name = 'LinkValidationError';
    this.fieldname = fieldname;
    this.doctype = doctype;
    this.value = value;
  }
}

// --- 401 Error ---

export class AuthenticationError extends NodraError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

// --- 403 Error ---

export class PermissionError extends NodraError {
  public readonly doctype?: string;
  public readonly action?: string;

  constructor(message: string, options?: { doctype?: string; action?: string }) {
    super(message, 403);
    this.name = 'PermissionError';
    this.doctype = options?.doctype;
    this.action = options?.action;
  }
}

// --- 404 Error ---

export class NotFoundError extends NodraError {
  public readonly doctype: string;
  public readonly docName: string;

  constructor(doctype: string, docName: string) {
    super(`${doctype} "${docName}" not found`, 404);
    this.name = 'NotFoundError';
    this.doctype = doctype;
    this.docName = docName;
  }
}

// --- 409 Errors ---

export class DuplicateError extends NodraError {
  public readonly doctype: string;
  public readonly docName: string;

  constructor(doctype: string, docName: string) {
    super(`${doctype} "${docName}" already exists`, 409);
    this.name = 'DuplicateError';
    this.doctype = doctype;
    this.docName = docName;
  }
}

export class InvalidStateError extends NodraError {
  public readonly doctype?: string;
  public readonly from?: string;
  public readonly to?: string;

  constructor(message: string, options?: { doctype?: string; from?: string; to?: string }) {
    super(message, 409);
    this.name = 'InvalidStateError';
    this.doctype = options?.doctype;
    this.from = options?.from;
    this.to = options?.to;
  }
}

// --- 500 Errors ---

export class DatabaseError extends NodraError {
  public override readonly cause?: Error;

  constructor(message: string, options?: { cause?: Error }) {
    super(message, 500);
    this.name = 'DatabaseError';
    this.cause = options?.cause;
  }
}

export class AppError extends NodraError {
  constructor(message: string, httpStatus = 500) {
    super(message, httpStatus);
    this.name = 'AppError';
  }
}

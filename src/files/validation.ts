/**
 * File upload validation
 */

import type { FileUpload, FileValidationConfig } from './types.js';
import { ValidationError } from '../core/errors.js';

/**
 * File validation error
 */
export class FileValidationError extends ValidationError {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * File validator
 */
export class FileValidator {
  constructor(private config: FileValidationConfig = {}) {}

  /**
   * Validate a file upload
   */
  validate(file: FileUpload): void {
    const errors: string[] = [];

    // Validate file size
    if (this.config.maxSize && file.size > this.config.maxSize) {
      errors.push(
        `File size ${file.size} bytes exceeds maximum ${this.config.maxSize} bytes`
      );
    }

    // Validate MIME type
    if (
      this.config.allowedMimeTypes &&
      this.config.allowedMimeTypes.length > 0
    ) {
      if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
        errors.push(
          `MIME type ${file.mimetype} is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`
        );
      }
    }

    // Validate file extension
    if (
      this.config.allowedExtensions &&
      this.config.allowedExtensions.length > 0
    ) {
      const ext = this.getExtension(file.filename);
      if (!this.config.allowedExtensions.includes(ext)) {
        errors.push(
          `File extension ${ext} is not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`
        );
      }
    }

    if (errors.length > 0) {
      throw new FileValidationError('File validation failed', errors);
    }
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? (parts[parts.length - 1] ?? '').toLowerCase() : '';
  }
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '') // Remove path traversal first
    .replace(/[/\\]/g, '-') // Replace path separators
    .replace(/[<>:"|?*]/g, '-') // Remove special characters
    .replace(/\s+/g, '-') // Replace whitespace with dash
    .replace(/-{2,}/g, '-') // Replace multiple dashes with single dash
    .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
    .toLowerCase();
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '').toLowerCase() : '';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get MIME type from file extension (fallback)
 */
export function getMimeTypeFromExtension(filename: string): string {
  const ext = getFileExtension(filename);
  const mimeTypes: Record<string, string> = {
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
  };

  return mimeTypes[ext] ?? 'application/octet-stream';
}

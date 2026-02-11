/**
 * Tests for file upload validation and handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { FileUpload, FileValidationConfig } from '../../../src/files/types.js';

/**
 * File validator for testing
 */
class FileValidator {
  constructor(private config: FileValidationConfig = {}) {}

  validate(file: FileUpload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate file size
    if (this.config.maxSize && file.size > this.config.maxSize) {
      errors.push(`File size ${file.size} bytes exceeds maximum ${this.config.maxSize} bytes`);
    }

    // Validate MIME type
    if (this.config.allowedMimeTypes && this.config.allowedMimeTypes.length > 0) {
      if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
        errors.push(
          `MIME type ${file.mimetype} is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
        );
      }
    }

    // Validate file extension
    if (this.config.allowedExtensions && this.config.allowedExtensions.length > 0) {
      const ext = this.getExtension(file.filename);
      if (!this.config.allowedExtensions.includes(ext)) {
        errors.push(
          `File extension ${ext} is not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }
}

describe('File Upload Validation', () => {
  describe('File Size Validation', () => {
    it('should accept files within size limit', () => {
      const validator = new FileValidator({
        maxSize: 5 * 1024 * 1024, // 5 MB
      });

      const file: FileUpload = {
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        encoding: '7bit',
        data: Buffer.alloc(1024 * 1024), // 1 MB
        size: 1024 * 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files exceeding size limit', () => {
      const validator = new FileValidator({
        maxSize: 1024 * 1024, // 1 MB
      });

      const file: FileUpload = {
        filename: 'large.pdf',
        mimetype: 'application/pdf',
        encoding: '7bit',
        data: Buffer.alloc(5 * 1024 * 1024), // 5 MB
        size: 5 * 1024 * 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('should accept any size when no limit is set', () => {
      const validator = new FileValidator({});

      const file: FileUpload = {
        filename: 'huge.zip',
        mimetype: 'application/zip',
        encoding: '7bit',
        data: Buffer.alloc(100 * 1024 * 1024), // 100 MB
        size: 100 * 1024 * 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('MIME Type Validation', () => {
    it('should accept allowed MIME types', () => {
      const validator = new FileValidator({
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      });

      const file: FileUpload = {
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        encoding: '7bit',
        data: Buffer.alloc(1024),
        size: 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed MIME types', () => {
      const validator = new FileValidator({
        allowedMimeTypes: ['application/pdf', 'image/jpeg'],
      });

      const file: FileUpload = {
        filename: 'script.js',
        mimetype: 'application/javascript',
        encoding: '7bit',
        data: Buffer.alloc(1024),
        size: 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not allowed');
    });

    it('should accept any MIME type when no restriction is set', () => {
      const validator = new FileValidator({});

      const file: FileUpload = {
        filename: 'data.bin',
        mimetype: 'application/octet-stream',
        encoding: '7bit',
        data: Buffer.alloc(1024),
        size: 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('File Extension Validation', () => {
    it('should accept allowed extensions', () => {
      const validator = new FileValidator({
        allowedExtensions: ['pdf', 'jpg', 'png', 'docx'],
      });

      const file: FileUpload = {
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        encoding: '7bit',
        data: Buffer.alloc(1024),
        size: 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed extensions', () => {
      const validator = new FileValidator({
        allowedExtensions: ['pdf', 'docx'],
      });

      const file: FileUpload = {
        filename: 'archive.zip',
        mimetype: 'application/zip',
        encoding: '7bit',
        data: Buffer.alloc(1024),
        size: 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not allowed');
    });

    it('should be case insensitive', () => {
      const validator = new FileValidator({
        allowedExtensions: ['pdf', 'jpg'],
      });

      const file: FileUpload = {
        filename: 'IMAGE.JPG',
        mimetype: 'image/jpeg',
        encoding: '7bit',
        data: Buffer.alloc(1024),
        size: 1024,
      };

      const result = validator.validate(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('Combined Validation', () => {
    it('should validate both size and type', () => {
      const validator = new FileValidator({
        maxSize: 10 * 1024 * 1024, // 10 MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      });

      const validFile: FileUpload = {
        filename: 'report.pdf',
        mimetype: 'application/pdf',
        encoding: '7bit',
        data: Buffer.alloc(5 * 1024 * 1024),
        size: 5 * 1024 * 1024,
      };

      expect(validator.validate(validFile).valid).toBe(true);
    });

    it('should collect multiple validation errors', () => {
      const validator = new FileValidator({
        maxSize: 1024 * 1024, // 1 MB
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['pdf'],
      });

      const invalidFile: FileUpload = {
        filename: 'large-video.mp4',
        mimetype: 'video/mp4',
        encoding: '7bit',
        data: Buffer.alloc(10 * 1024 * 1024),
        size: 10 * 1024 * 1024,
      };

      const result = validator.validate(invalidFile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Security Validations', () => {
    it('should reject potentially dangerous file types', () => {
      const validator = new FileValidator({
        allowedExtensions: ['pdf', 'jpg', 'png', 'docx'],
      });

      const dangerousFiles = [
        { filename: 'virus.exe', mimetype: 'application/x-msdownload' },
        { filename: 'script.js', mimetype: 'application/javascript' },
        { filename: 'page.html', mimetype: 'text/html' },
        { filename: 'shell.sh', mimetype: 'application/x-sh' },
      ];

      for (const dangerous of dangerousFiles) {
        const file: FileUpload = {
          ...dangerous,
          encoding: '7bit',
          data: Buffer.alloc(1024),
          size: 1024,
        };

        const result = validator.validate(file);
        expect(result.valid).toBe(false);
      }
    });
  });
});

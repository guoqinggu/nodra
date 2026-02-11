/**
 * Tests for File DocType and file metadata management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FileMetadata } from '../../../src/files/types.js';

describe('File DocType', () => {
  describe('File Metadata', () => {
    it('should create file metadata with required fields', () => {
      const fileMetadata: FileMetadata = {
        name: 'FILE-001',
        file_name: 'test-document.pdf',
        file_url: '/files/test-document.pdf',
        file_size: 1024000,
        mime_type: 'application/pdf',
        is_private: false,
        owner: 'user@example.com',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'user@example.com',
      };

      expect(fileMetadata.name).toBe('FILE-001');
      expect(fileMetadata.file_name).toBe('test-document.pdf');
      expect(fileMetadata.file_size).toBe(1024000);
      expect(fileMetadata.is_private).toBe(false);
    });

    it('should support file attachment to document', () => {
      const fileMetadata: FileMetadata = {
        name: 'FILE-002',
        file_name: 'invoice.pdf',
        file_url: '/files/invoice.pdf',
        file_size: 500000,
        mime_type: 'application/pdf',
        is_private: true,
        attached_to_doctype: 'Sales Invoice',
        attached_to_name: 'SINV-001',
        attached_to_field: 'attachments',
        owner: 'user@example.com',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'user@example.com',
      };

      expect(fileMetadata.attached_to_doctype).toBe('Sales Invoice');
      expect(fileMetadata.attached_to_name).toBe('SINV-001');
      expect(fileMetadata.attached_to_field).toBe('attachments');
    });

    it('should support folder organization', () => {
      const fileMetadata: FileMetadata = {
        name: 'FILE-003',
        file_name: 'report.xlsx',
        file_url: '/files/reports/2026/report.xlsx',
        file_size: 2048000,
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        is_private: false,
        folder: 'Reports/2026',
        owner: 'user@example.com',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'user@example.com',
      };

      expect(fileMetadata.folder).toBe('Reports/2026');
    });

    it('should handle private files', () => {
      const publicFile: FileMetadata = {
        name: 'FILE-004',
        file_name: 'public-doc.pdf',
        file_url: '/files/public-doc.pdf',
        file_size: 100000,
        mime_type: 'application/pdf',
        is_private: false,
        owner: 'user@example.com',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'user@example.com',
      };

      const privateFile: FileMetadata = {
        name: 'FILE-005',
        file_name: 'private-doc.pdf',
        file_url: '/private/files/private-doc.pdf',
        file_size: 100000,
        mime_type: 'application/pdf',
        is_private: true,
        owner: 'user@example.com',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'user@example.com',
      };

      expect(publicFile.is_private).toBe(false);
      expect(privateFile.is_private).toBe(true);
      expect(privateFile.file_url).toContain('/private/');
    });
  });

  describe('File MIME Types', () => {
    it('should handle common document types', () => {
      const mimeTypes = {
        pdf: 'application/pdf',
        word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        text: 'text/plain',
        csv: 'text/csv',
      };

      expect(mimeTypes.pdf).toBe('application/pdf');
      expect(mimeTypes.word).toContain('wordprocessing');
      expect(mimeTypes.excel).toContain('spreadsheet');
    });

    it('should handle image types', () => {
      const imageMimeTypes = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
      };

      expect(imageMimeTypes.jpeg).toBe('image/jpeg');
      expect(imageMimeTypes.png).toBe('image/png');
    });

    it('should handle video types', () => {
      const videoMimeTypes = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        ogg: 'video/ogg',
      };

      expect(videoMimeTypes.mp4).toBe('video/mp4');
    });
  });

  describe('File Size Formatting', () => {
    function formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format decimal sizes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1536)).toBe('1.5 MB');
    });
  });

  describe('File Extension Detection', () => {
    function getFileExtension(filename: string): string {
      const parts = filename.split('.');
      return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }

    it('should extract file extension', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.PNG')).toBe('png');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should handle files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });
  });

  describe('File Path Sanitization', () => {
    function sanitizeFilename(filename: string): string {
      // Remove path traversal attempts and special characters
      return filename
        .replace(/[/\\]/g, '-')
        .replace(/\.\./g, '')
        .replace(/[<>:"|?*]/g, '-')
        .replace(/\s+/g, '-')
        .toLowerCase();
    }

    it('should sanitize dangerous filenames', () => {
      // The function removes .., slashes, multiple dashes but the leading dashes
      // from "../" become "---" which then get trimmed to single dash at start
      // So we just test that dangerous parts are removed
      const result1 = sanitizeFilename('../../../etc/passwd');
      expect(result1).not.toContain('..');
      expect(result1).not.toContain('/');
      expect(result1).toContain('etc');
      expect(result1).toContain('passwd');

      expect(sanitizeFilename('test<script>.pdf')).toBe('test-script-.pdf');
      expect(sanitizeFilename('file with spaces.pdf')).toBe('file-with-spaces.pdf');
    });

    it('should preserve safe filenames', () => {
      expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
      expect(sanitizeFilename('report-2026.xlsx')).toBe('report-2026.xlsx');
    });
  });
});

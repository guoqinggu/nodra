/**
 * Tests for local filesystem storage backend
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { FileUpload } from '../../../src/files/types.js';

/**
 * Mock local filesystem storage for testing
 */
class LocalFileStorage {
  constructor(private basePath: string) {}

  async save(file: FileUpload): Promise<string> {
    // Create directory if it doesn't exist
    await fs.mkdir(this.basePath, { recursive: true });

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    // Sanitize filename: remove dots, slashes, and special chars
    const sanitizedName = file.filename
      .replace(/\.\./g, '')
      .replace(/[/\\]/g, '_')
      .replace(/[^a-z0-9._-]/gi, '_')
      .toLowerCase();
    const filename = `${timestamp}-${sanitizedName}`;
    const filePath = join(this.basePath, filename);

    // Write file
    await fs.writeFile(filePath, file.data);

    return filename;
  }

  async get(filename: string): Promise<Buffer> {
    const filePath = join(this.basePath, filename);
    return await fs.readFile(filePath);
  }

  async delete(filename: string): Promise<void> {
    const filePath = join(this.basePath, filename);
    await fs.unlink(filePath);
  }

  async exists(filename: string): Promise<boolean> {
    const filePath = join(this.basePath, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(filename: string): string {
    return `/files/${filename}`;
  }
}

describe('Local File Storage', () => {
  let storage: LocalFileStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = join(tmpdir(), `nodra-test-${Date.now()}`);
    storage = new LocalFileStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(join(testDir, file));
      }
      await fs.rmdir(testDir);
    } catch (error) {
      // Directory might not exist or already cleaned up
    }
  });

  describe('save', () => {
    it('should save a file to disk', async () => {
      const fileData = Buffer.from('test file content');
      const file: FileUpload = {
        filename: 'test.txt',
        mimetype: 'text/plain',
        encoding: '7bit',
        data: fileData,
        size: fileData.length,
      };

      const savedFilename = await storage.save(file);

      expect(savedFilename).toContain('test.txt');
      expect(await storage.exists(savedFilename)).toBe(true);
    });

    it('should generate unique filenames with timestamp', async () => {
      const file: FileUpload = {
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        encoding: '7bit',
        data: Buffer.from('PDF content'),
        size: 11,
      };

      const filename1 = await storage.save(file);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      const filename2 = await storage.save(file);

      expect(filename1).not.toBe(filename2);
      expect(await storage.exists(filename1)).toBe(true);
      expect(await storage.exists(filename2)).toBe(true);
    });

    it('should sanitize filename', async () => {
      const file: FileUpload = {
        filename: '../../../etc/passwd',
        mimetype: 'text/plain',
        encoding: '7bit',
        data: Buffer.from('test'),
        size: 4,
      };

      const savedFilename = await storage.save(file);

      // Filename should be timestamped and sanitized (dots and slashes removed/replaced)
      expect(savedFilename).toMatch(/^\d+-.*etc.*passwd$/);
      expect(savedFilename).not.toContain('..');
      expect(savedFilename).not.toContain('/');
    });

    it('should create directory if it does not exist', async () => {
      const nonExistentDir = join(tmpdir(), `nodra-new-${Date.now()}`);
      const newStorage = new LocalFileStorage(nonExistentDir);

      const file: FileUpload = {
        filename: 'test.txt',
        mimetype: 'text/plain',
        encoding: '7bit',
        data: Buffer.from('test'),
        size: 4,
      };

      const savedFilename = await newStorage.save(file);

      expect(await newStorage.exists(savedFilename)).toBe(true);

      // Clean up
      await fs.unlink(join(nonExistentDir, savedFilename));
      await fs.rmdir(nonExistentDir);
    });
  });

  describe('get', () => {
    it('should retrieve a saved file', async () => {
      const fileData = Buffer.from('test file content');
      const file: FileUpload = {
        filename: 'test.txt',
        mimetype: 'text/plain',
        encoding: '7bit',
        data: fileData,
        size: fileData.length,
      };

      const savedFilename = await storage.save(file);
      const retrievedData = await storage.get(savedFilename);

      expect(retrievedData.toString()).toBe(fileData.toString());
    });

    it('should throw error for non-existent file', async () => {
      await expect(storage.get('non-existent.txt')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      const file: FileUpload = {
        filename: 'to-delete.txt',
        mimetype: 'text/plain',
        encoding: '7bit',
        data: Buffer.from('test'),
        size: 4,
      };

      const savedFilename = await storage.save(file);
      expect(await storage.exists(savedFilename)).toBe(true);

      await storage.delete(savedFilename);
      expect(await storage.exists(savedFilename)).toBe(false);
    });

    it('should throw error when deleting non-existent file', async () => {
      await expect(storage.delete('non-existent.txt')).rejects.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const file: FileUpload = {
        filename: 'exists.txt',
        mimetype: 'text/plain',
        encoding: '7bit',
        data: Buffer.from('test'),
        size: 4,
      };

      const savedFilename = await storage.save(file);
      expect(await storage.exists(savedFilename)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await storage.exists('does-not-exist.txt')).toBe(false);
    });
  });

  describe('getUrl', () => {
    it('should return URL path for file', () => {
      const url = storage.getUrl('test-file.pdf');
      expect(url).toBe('/files/test-file.pdf');
    });

    it('should handle various filenames', () => {
      expect(storage.getUrl('document.pdf')).toBe('/files/document.pdf');
      expect(storage.getUrl('image.png')).toBe('/files/image.png');
      expect(storage.getUrl('123-archive.zip')).toBe('/files/123-archive.zip');
    });
  });

  describe('Binary Files', () => {
    it('should handle binary files correctly', async () => {
      // Create a binary buffer with various byte values
      const binaryData = Buffer.from([0, 1, 127, 128, 255, 0xff, 0x00]);
      const file: FileUpload = {
        filename: 'binary.dat',
        mimetype: 'application/octet-stream',
        encoding: 'binary',
        data: binaryData,
        size: binaryData.length,
      };

      const savedFilename = await storage.save(file);
      const retrievedData = await storage.get(savedFilename);

      expect(retrievedData.equals(binaryData)).toBe(true);
    });

    it('should handle large files', async () => {
      // Create a 1MB buffer
      const largeData = Buffer.alloc(1024 * 1024, 'x');
      const file: FileUpload = {
        filename: 'large.bin',
        mimetype: 'application/octet-stream',
        encoding: 'binary',
        data: largeData,
        size: largeData.length,
      };

      const savedFilename = await storage.save(file);
      const retrievedData = await storage.get(savedFilename);

      expect(retrievedData.length).toBe(largeData.length);
      expect(retrievedData.equals(largeData)).toBe(true);
    });
  });
});

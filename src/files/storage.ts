/**
 * Local filesystem storage backend
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { FileStorage, FileUpload } from './types.js';
import { sanitizeFilename } from './validation.js';

/**
 * Local filesystem storage implementation
 */
export class LocalFileStorage implements FileStorage {
  constructor(
    private basePath: string,
    private baseUrl: string = '/files'
  ) {}

  /**
   * Save a file to local filesystem
   */
  async save(file: FileUpload): Promise<string> {
    // Ensure base directory exists
    await fs.mkdir(this.basePath, { recursive: true });

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const sanitized = sanitizeFilename(file.filename);
    const filename = `${timestamp}-${sanitized}`;
    const filePath = join(this.basePath, filename);

    // Ensure parent directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });

    // Write file
    await fs.writeFile(filePath, file.data);

    return filename;
  }

  /**
   * Get file contents
   */
  async get(filename: string): Promise<Buffer> {
    const filePath = join(this.basePath, filename);
    return await fs.readFile(filePath);
  }

  /**
   * Delete a file
   */
  async delete(filename: string): Promise<void> {
    const filePath = join(this.basePath, filename);
    await fs.unlink(filePath);
  }

  /**
   * Check if file exists
   */
  async exists(filename: string): Promise<boolean> {
    const filePath = join(this.basePath, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get public URL for file
   */
  getUrl(filename: string): string {
    return `${this.baseUrl}/${filename}`;
  }

  /**
   * Get file size
   */
  async getSize(filename: string): Promise<number> {
    const filePath = join(this.basePath, filename);
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * List files in directory
   */
  async list(folder?: string): Promise<string[]> {
    const dirPath = folder ? join(this.basePath, folder) : this.basePath;
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }

  /**
   * Create a folder
   */
  async createFolder(folder: string): Promise<void> {
    const folderPath = join(this.basePath, folder);
    await fs.mkdir(folderPath, { recursive: true });
  }
}

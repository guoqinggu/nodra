/**
 * File DocType Controller
 *
 * Handles file-specific business logic
 */

import { Document } from '../../../src/core/document/document.js';
import { ValidationError } from '../../../src/core/errors.js';

export class File extends Document {
  file_name!: string;
  file_url?: string;
  file_size?: number;
  file_type?: string;
  is_private!: boolean;
  is_folder!: boolean;
  folder?: string;
  attached_to_doctype?: string;
  attached_to_name?: string;
  attached_to_field?: string;
  thumbnail_url?: string;

  /**
   * Validate: ensure file has either file_url or is a folder
   */
  async validate(): Promise<void> {
    if (!this.is_folder && !this.file_url) {
      throw new ValidationError('File URL is required for non-folder files');
    }

    // Validate folder reference
    if (this.folder && this.folder === this.name) {
      throw new ValidationError('File cannot be its own parent folder');
    }
  }

  /**
   * Before delete: check if folder is empty
   */
  async beforeDelete(): Promise<void> {
    if (this.is_folder) {
      // TODO: Check if folder has children when ORM query is available
      // For now, this is a placeholder for Phase 12 implementation
    }
  }
}

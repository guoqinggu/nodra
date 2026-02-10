/**
 * File management types
 */

/**
 * File storage backend interface
 */
export interface FileStorage {
  save(file: FileUpload): Promise<string>;
  get(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  getUrl(filePath: string): string;
}

/**
 * File upload data
 */
export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  data: Buffer;
  size: number;
}

/**
 * File metadata stored in database
 */
export interface FileMetadata {
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  is_private: boolean;
  attached_to_doctype?: string;
  attached_to_name?: string;
  attached_to_field?: string;
  folder?: string;
  owner: string;
  creation: Date;
  modified: Date;
  modified_by: string;
}

/**
 * File validation config
 */
export interface FileValidationConfig {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  backend: 'local' | 's3';
  localPath?: string;
  s3Config?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  validation?: FileValidationConfig;
}

/**
 * File attachment reference
 */
export interface FileAttachment {
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

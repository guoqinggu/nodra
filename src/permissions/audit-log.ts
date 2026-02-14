import type { PermissionAction } from './permission.js';

export interface AuditLogEntry {
  userEmail: string;
  action: PermissionAction;
  doctype: string;
  documentName?: string;
  result: 'Allowed' | 'Denied';
  ipAddress: string;
}

export async function logPermissionCheck(entry: AuditLogEntry): Promise<void> {
  try {
    const timestamp = new Date();
    console.log(
      `[AUDIT] ${timestamp.toISOString()} | ${entry.userEmail} | ${entry.action} | ${entry.doctype} | ${entry.documentName || '-'} | ${entry.result} | ${entry.ipAddress}`
    );
  } catch (error) {
    console.error('Failed to log permission audit:', error);
  }
}

import { describe, it, expect, vi } from 'vitest';
import { logPermissionCheck } from '../../../src/permissions/audit-log.js';

describe('Permission Audit Log', () => {
  it('should log permission check with all fields', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await logPermissionCheck({
      userEmail: 'user@example.com',
      action: 'read',
      doctype: 'Task',
      documentName: 'TASK-001',
      result: 'Allowed',
      ipAddress: '192.168.1.1',
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedMessage = consoleSpy.mock.calls[0]![0] as string;
    expect(loggedMessage).toContain('user@example.com');
    expect(loggedMessage).toContain('read');
    expect(loggedMessage).toContain('Allowed');

    consoleSpy.mockRestore();
  });

  it('should log without document name', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await logPermissionCheck({
      userEmail: 'user@example.com',
      action: 'write',
      doctype: 'Task',
      result: 'Denied',
      ipAddress: '192.168.1.1',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should not throw on logging failure', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('Logging failed');
    });

    await expect(
      logPermissionCheck({
        userEmail: 'user@example.com',
        action: 'read',
        doctype: 'Task',
        result: 'Allowed',
        ipAddress: '192.168.1.1',
      })
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});

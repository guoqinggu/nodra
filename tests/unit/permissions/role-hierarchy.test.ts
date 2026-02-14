import { describe, it, expect, beforeEach } from 'vitest';
import { getRoleHierarchy, clearRoleHierarchyCache } from '../../../src/permissions/permission.js';

describe('Role Hierarchy', () => {
  beforeEach(() => {
    clearRoleHierarchyCache();
  });

  it('should return original roles when no hierarchy', () => {
    const roles = ['Sales Manager', 'Accounts User'];
    const hierarchy = new Map<string, string>();

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Manager');
    expect(result).toContain('Accounts User');
  });

  it('should expand child role with parent role', () => {
    const roles = ['Sales Manager'];
    const hierarchy = new Map<string, string>([
      ['Sales Manager', 'Sales User'],
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Manager');
    expect(result).toContain('Sales User');
  });

  it('should handle multi-level hierarchy', () => {
    const roles = ['Sales Director'];
    const hierarchy = new Map<string, string>([
      ['Sales Director', 'Sales Manager'],
      ['Sales Manager', 'Sales User'],
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Director');
    expect(result).toContain('Sales Manager');
    expect(result).toContain('Sales User');
  });

  it('should prevent circular reference infinite loop', () => {
    const roles = ['Role A'];
    const hierarchy = new Map<string, string>([
      ['Role A', 'Role B'],
      ['Role B', 'Role A'],
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Role A');
    expect(result).toContain('Role B');
  });

  it('should handle multiple child roles', () => {
    const roles = ['Sales Manager', 'Accounts Manager'];
    const hierarchy = new Map<string, string>([
      ['Sales Manager', 'Sales User'],
      ['Accounts Manager', 'Accounts User'],
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Manager');
    expect(result).toContain('Sales User');
    expect(result).toContain('Accounts Manager');
    expect(result).toContain('Accounts User');
  });

  it('should return empty array for empty input', () => {
    const roles: string[] = [];
    const hierarchy = new Map<string, string>();

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toEqual([]);
  });

  it('should handle role with no parent', () => {
    const roles = ['Sales Manager'];
    const hierarchy = new Map<string, string>();

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toEqual(['Sales Manager']);
  });
});

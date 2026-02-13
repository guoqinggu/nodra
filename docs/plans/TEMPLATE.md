# Implementation Plan Template

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about the approach and design decisions]

**Tech Stack:** [Key technologies, libraries, and dependencies]

---

## Pre-Implementation Checklist

- [ ] Review CLAUDE.md for project conventions
- [ ] Identify affected modules and dependencies
- [ ] Check for existing similar implementations in codebase
- [ ] Create git worktree for isolated development

---

## Task 1: [Component/Feature Name]

**Files:**

- Create: `path/to/new/file.ts`
- Modify: `path/to/existing/file.ts:line-range`
- Test: `tests/unit/path/to/test.ts`

### Step 1: Write the failing test

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../../../src/path/to/module.js';

describe('functionToTest', () => {
  it('should [expected behavior]', async () => {
    // Arrange
    const input = /* test data */;

    // Act
    const result = await functionToTest(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

### Step 2: Run test to verify it fails

```bash
pnpm vitest run tests/unit/path/to/test.ts
```

**Expected:** FAIL with "functionToTest is not defined" or similar

### Step 3: Write minimal implementation

```typescript
// src/path/to/module.ts
export async function functionToTest(input: InputType): Promise<OutputType> {
  // Minimal implementation to pass test
  return expectedValue;
}
```

### Step 4: Run test to verify it passes

```bash
pnpm vitest run tests/unit/path/to/test.ts
```

**Expected:** PASS

### Step 5: Add edge case tests

```typescript
it('should handle [edge case]', async () => {
  // Test edge case
});

it('should throw [error] when [condition]', async () => {
  // Test error case
});
```

### Step 6: Commit

```bash
git add tests/unit/path/to/test.ts src/path/to/module.ts
git commit -m "feat(scope): add [feature description]"
```

---

## Task 2: [Next Component]

**Files:**

- Create:
- Modify:
- Test:

[Repeat the 6-step pattern for each task...]

---

## Post-Implementation Verification

Before marking complete:

- [ ] All tasks implemented
- [ ] `pnpm test` passes (all tests)
- [ ] `pnpm typecheck` passes (no type errors)
- [ ] `pnpm lint` passes (no lint errors)
- [ ] `pnpm build` succeeds
- [ ] Code follows project conventions (see CLAUDE.md)
- [ ] Documentation updated (if applicable)
- [ ] All commits follow conventional commit format

## Execution Options

After this plan is complete, choose execution approach:

1. **Subagent-Driven** - Dispatch fresh subagent per task, review between tasks
2. **Parallel Session** - Open new session with superpowers:executing-plans

## Notes

[Any additional context, design decisions, or gotchas to be aware of]

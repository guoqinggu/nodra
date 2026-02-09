# nodra-test Skill

Use this skill when writing tests for the Nodra framework following TDD methodology.

## Context

Nodra uses Vitest as its test framework. All development follows TDD: tests are written BEFORE implementation code. Read `AGENTS.md` for coding conventions and `docs/ARCHITECTURE.md` for architecture.

## When to Use

- Writing unit tests for any Nodra module
- Writing integration tests that require a real PostgreSQL database
- Creating test fixtures (DocType JSONs, mock data)
- Setting up test infrastructure (helpers, factories, database setup/teardown)
- Debugging failing tests

## Test Organization

```
tests/
├── unit/                    # No external dependencies
│   ├── core/
│   │   ├── doctype.test.ts
│   │   ├── document.test.ts
│   │   ├── validation.test.ts
│   │   ├── naming.test.ts
│   │   └── errors.test.ts
│   ├── database/
│   │   ├── query-builder.test.ts
│   │   └── schema-sync.test.ts
│   ├── orm/
│   │   ├── crud.test.ts
│   │   └── filters.test.ts
│   └── api/
│       ├── resource.test.ts
│       └── serializer.test.ts
├── integration/             # Requires real PostgreSQL
│   ├── database/
│   │   ├── connection.test.ts
│   │   └── schema-sync.test.ts
│   ├── orm/
│   │   └── crud.test.ts
│   ├── api/
│   │   └── resource.test.ts
│   └── setup.ts             # DB setup/teardown
├── fixtures/
│   ├── doctypes/
│   │   ├── todo.json         # Simple test DocType
│   │   ├── note.json         # DocType with child table
│   │   ├── note_item.json    # Child DocType
│   │   └── settings.json     # Single DocType
│   └── data/
│       └── seed.ts           # Test data factories
└── helpers/
    ├── db.ts                 # Database test helpers
    ├── factory.ts            # Document factory functions
    └── assertions.ts         # Custom assertion helpers
```

## TDD Workflow

### Step 1: Write the Test (Red Phase)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('DocTypeRegistry', () => {
  let registry: DocTypeRegistry;

  beforeEach(() => {
    registry = new DocTypeRegistry();
  });

  it('should register a DocType', () => {
    const doctype = loadFixture('todo.json');
    registry.register(doctype);
    expect(registry.get('Todo')).toBeDefined();
    expect(registry.get('Todo')?.name).toBe('Todo');
  });

  it('should throw on duplicate registration', () => {
    const doctype = loadFixture('todo.json');
    registry.register(doctype);
    expect(() => registry.register(doctype)).toThrow(DuplicateError);
  });

  it('should list all registered DocTypes', () => {
    registry.register(loadFixture('todo.json'));
    registry.register(loadFixture('note.json'));
    expect(registry.list()).toHaveLength(2);
  });
});
```

### Step 2: Implement Minimally (Green Phase)

Write just enough code to make the tests pass. No extra features, no premature optimization.

### Step 3: Refactor (Blue Phase)

Clean up the code. Ensure tests still pass. Add edge case tests if discovered.

## Test Patterns

### Unit Test Pattern (no DB)

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ModuleName', () => {
  // Mock external dependencies
  const mockDb = {
    query: vi.fn(),
    execute: vi.fn(),
  };

  it('should do something specific', () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toEqual(expected);
  });
});
```

### Integration Test Pattern (with DB)

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanTables } from '../helpers/db.js';

describe('ORM CRUD Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanTables(['tab_todo']);
  });

  it('should insert and retrieve a document', async () => {
    const doc = await nodra.getDoc({ doctype: 'Todo', title: 'Test' });
    await doc.insert();
    
    const fetched = await nodra.getDoc('Todo', doc.name);
    expect(fetched.title).toBe('Test');
  });
});
```

### Fixture Pattern

```typescript
// tests/helpers/factory.ts
export function createTodoFixture(overrides?: Partial<TodoData>): TodoData {
  return {
    doctype: 'Todo',
    title: 'Test Todo',
    status: 'Open',
    ...overrides,
  };
}
```

## Testing Rules

1. **Each test is independent**: No test should depend on another test's state
2. **Descriptive names**: Test name should describe the expected behavior
3. **AAA pattern**: Arrange → Act → Assert
4. **One assertion focus**: Each test should verify one behavior (multiple expects OK if related)
5. **Mock at boundaries**: Mock database, filesystem, network - not internal classes
6. **Test error paths**: Always test that errors are thrown correctly
7. **No test duplication**: If integration test covers the same logic, unit test can be simpler

## Commands

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm vitest run tests/unit/

# Run integration tests only
pnpm vitest run tests/integration/

# Run with coverage
pnpm vitest run --coverage

# Watch mode
pnpm test:watch

# Run single file
pnpm vitest run tests/unit/core/doctype.test.ts
```

## Vitest Configuration Reference

The project uses `vitest.config.ts` at the root with:
- TypeScript transform via esbuild
- ESM module resolution
- Path aliases matching tsconfig
- Separate test environments for unit (node) and integration (node with setup)

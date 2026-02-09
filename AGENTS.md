# AGENTS.md - Nodra Development Guide

## Project Overview

Nodra is a metadata-driven web framework (Node.js + TypeScript + PostgreSQL), inspired by Frappe.
See `docs/ARCHITECTURE.md` for full architecture and `docs/ROADMAP.md` for development plan.

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript 5.x (strict mode, ESM)
- **HTTP**: Fastify 5.x
- **Database**: PostgreSQL 15+ via pg (node-postgres)
- **Testing**: Vitest
- **Package Manager**: pnpm
- **Build**: tsup

## Commands

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm vitest run tests/unit/core/doctype.test.ts

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build

# Start dev server
pnpm dev
```

## Development Methodology

### TDD Workflow

1. **Red**: Write a failing test that describes the desired behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up the code while keeping tests green

Every feature must have tests written BEFORE the implementation code.

### Git Commit Convention

Use conventional commits:

```
<type>(<scope>): <description>

Types: feat, fix, test, refactor, docs, chore
Scopes: core, doctype, document, database, orm, api, auth, permissions, workflow, hooks, events, jobs, realtime, files, report, cli, app, migration
```

Commit frequently - each logical unit of work should be a separate commit.

## Code Conventions

### File Organization

- Source code: `src/`
- Tests: `tests/` (mirror src/ structure)
- Core DocTypes: `doctypes/`
- Documentation: `docs/`

### Naming Conventions

| Item                  | Convention        | Example                    |
|-----------------------|-------------------|----------------------------|
| Files                 | kebab-case        | `query-builder.ts`         |
| Classes               | PascalCase        | `QueryBuilder`             |
| Interfaces            | PascalCase        | `DocTypeDefinition`        |
| Functions/Methods     | camelCase         | `getDocType()`             |
| Constants             | UPPER_SNAKE_CASE  | `MAX_POOL_SIZE`            |
| Database tables       | snake_case + prefix | `tab_todo`               |
| Database columns      | snake_case        | `modified_by`              |
| DocType names         | PascalCase/spaces | `Todo`, `Sales Invoice`    |
| Field names           | snake_case        | `due_date`, `assigned_to`  |

### TypeScript Rules

- strict mode enabled
- No `any` unless absolutely necessary (use `unknown` + type narrowing)
- Prefer interfaces over type aliases for object shapes
- Export only what's needed (internal modules use non-exported helpers)
- Use barrel exports (`index.ts`) for public API

### Testing Rules

- Unit tests: `tests/unit/` - no external dependencies (mock DB, etc.)
- Integration tests: `tests/integration/` - real PostgreSQL
- Test files: `*.test.ts`
- Test fixtures: `tests/fixtures/`
- Use `describe()` blocks to group related tests
- Each test should be independent and idempotent
- Aim for >80% code coverage on core modules

### Error Handling

- Use the error hierarchy defined in `src/core/errors.ts`
- Never throw plain `Error` - always use a specific Nodra error class
- Errors should carry enough context for debugging (doctype, fieldname, value, etc.)
- API layer maps errors to appropriate HTTP status codes

### Security

- All SQL queries MUST use parameterized statements ($1, $2, etc.)
- Never concatenate user input into SQL strings
- Validate all input at API boundary
- Use argon2 for password hashing (never bcrypt, md5, sha)
- Sanitize output to prevent XSS

## Multi-Agent Development

Development uses specialized Qoder skills for different domains:

### Available Skills

| Skill         | Purpose                                              |
|--------------|------------------------------------------------------|
| `nodra-core` | Core framework: DocType, Document, errors, config    |
| `nodra-db`   | Database: connection, query builder, schema sync     |
| `nodra-api`  | API layer: Fastify routes, middleware, serialization  |
| `nodra-test` | TDD: test writing, fixtures, test infrastructure     |

### Agent Workflow

1. **Planning**: Use `nodra-core` skill to understand the architecture and plan work
2. **Test First**: Use `nodra-test` skill to write tests for the feature
3. **Implementation**: Use the appropriate domain skill to implement
4. **Verification**: Run tests, type check, and lint before committing

### Inter-Module Dependencies

When implementing a feature that spans multiple modules:

1. Start from the lowest dependency (usually database or core)
2. Write interfaces/types first for the dependency boundary
3. Implement bottom-up with tests at each layer
4. Integration test the full stack at the end

## Architecture Quick Reference

### Core Concepts

- **DocType**: JSON metadata defining a model (schema, permissions, behavior)
- **Document**: Runtime instance of a DocType (one database row)
- **Naming Rule**: Strategy for generating document primary keys
- **Standard Fields**: Auto-added fields (name, owner, creation, modified, etc.)
- **Child DocType**: Nested table within a parent document
- **Controller**: TypeScript class with lifecycle hooks for a DocType

### Key Patterns

- **Metadata-driven**: DocType JSON is the single source of truth
- **Lifecycle hooks**: beforeValidate → validate → beforeSave → DB → afterSave
- **Permission layers**: DocType-level → User-level → Field-level → Owner-based
- **Convention**: DocType `Todo` → table `tab_todo`, controller `todo.ts`

### Database Convention

- Table name: `tab_` + snake_case(doctype_name)
- All tables have standard columns: name, owner, creation, modified, modified_by, docstatus, idx
- Child tables add: parent, parenttype, parentfield
- Link fields create implicit foreign key relationships (not enforced at DB level)
- Indexes auto-created for: primary key, modified, owner, Link fields, search_index fields

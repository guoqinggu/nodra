# CLAUDE.md - Nodra AI Development Guidelines

This document defines the engineering standards and workflows for AI-assisted development of the Nodra framework.

## Project Overview

Nodra is a metadata-driven web framework (Node.js + TypeScript + PostgreSQL), inspired by Frappe Framework.

## Development Workflow

### 1. Git Worktrees (Required)

**Worktree Directory**: `.worktrees/`

All feature development MUST use git worktrees for isolation:

```bash
# Create worktree for new feature
git worktree add .worktrees/feature-name -b feature/feature-name
cd .worktrees/feature-name
pnpm install
```

**Why worktrees?**

- Isolated development environments
- No stashing/switching overhead
- Clean separation of concerns
- Required by superpowers:using-git-worktrees skill

### 2. Plan-Driven Development (Required for Multi-Step Tasks)

**Plans Directory**: `docs/plans/`

For any task requiring 2+ steps:

1. **Write the plan first** to `docs/plans/YYYY-MM-DD-<feature-name>.md`
2. **Use superpowers:writing-plans skill** to create comprehensive plans
3. **Follow TDD** for each task
4. **Reference required sub-skills** in plan header

**Plan Template Structure:**

````markdown
# Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** One sentence describing what this builds

**Architecture:** 2-3 sentences about approach

**Tech Stack:** Key technologies/libraries

---

### Task N: Component Name

**Files:**

- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `tests/exact/path/to/test.ts`

**Step 1: Write the failing test**

```typescript
// Test code here
```
````

**Step 2: Run test to verify it fails**
Run: `pnpm vitest run tests/path/test.ts`
Expected: FAIL with specific error

**Step 3: Write minimal implementation**

```typescript
// Implementation code here
```

**Step 4: Run test to verify it passes**
Run: `pnpm vitest run tests/path/test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.ts src/path/file.ts
git commit -m "feat(scope): description"
```

````

### 3. Test-Driven Development (Required)

**Iron Law**: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

**Red-Green-Refactor Cycle:**
1. **RED**: Write one minimal failing test
2. **Verify RED**: Run test, confirm it fails correctly
3. **GREEN**: Write minimal code to pass
4. **Verify GREEN**: Run test, confirm all pass
5. **REFACTOR**: Clean up, keep tests green

**Mandatory Verification:**
```bash
# Before claiming completion
pnpm test              # Must pass
pnpm typecheck         # Must pass
pnpm lint              # Must pass
````

### 4. Code Quality Standards

**TypeScript Rules:**

- `strict: true` - Always enabled
- No `any` - Use `unknown` + type narrowing
- Explicit return types on public APIs
- No `@ts-ignore` or `@ts-expect-error` without justification

**Testing Rules:**

- Unit tests: `tests/unit/` - no external dependencies (mock DB)
- Integration tests: `tests/integration/` - real PostgreSQL
- Coverage threshold: 80% for statements, branches, functions, lines
- One behavior per test
- Clear test names describing behavior

**Error Handling:**

- Use NodraError hierarchy from `src/core/errors.ts`
- Never throw plain `Error`
- Include context (doctype, fieldname, value) in errors

**Naming Conventions:**
| Item | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `query-builder.ts` |
| Classes | PascalCase | `QueryBuilder` |
| Functions | camelCase | `getDocType()` |
| Constants | UPPER_SNAKE_CASE | `MAX_POOL_SIZE` |
| DB tables | snake_case + prefix | `tab_todo` |

### 5. Git Commit Convention

Use conventional commits:

```
<type>(<scope>): <description>

Types: feat, fix, test, refactor, docs, chore, perf, ci
Scopes: core, doctype, document, database, orm, api, auth, permissions, workflow, hooks, events, jobs, realtime, files, report, cli, app, migration
```

**Examples:**

```bash
feat(core): add validation engine for DocType fields
fix(api): correct HTTP status code for validation errors
test(doctype): add tests for naming rule generation
docs(readme): update installation instructions
```

**Commit Frequency:**

- Each logical unit = one commit
- Red-Green-Refactor = 1-3 commits
- Never batch unrelated changes

### 6. Verification Before Completion (Required)

**Before ANY completion claim:**

1. **Identify**: What command proves this claim?
2. **Run**: Execute the FULL command (fresh, complete)
3. **Read**: Full output, check exit code, count failures
4. **Verify**: Does output confirm the claim?
5. **Report**: State claim WITH evidence

**Verification Commands:**

```bash
# Tests
pnpm test              # All tests must pass
pnpm test:coverage     # Coverage must meet thresholds

# Code Quality
pnpm lint              # No errors
pnpm typecheck         # No type errors
pnpm format:check      # No formatting issues

# Build
pnpm build             # Must complete successfully
```

**No shortcuts**: Run commands fresh. Previous runs don't count.

### 7. Skill Invocation Requirements

**Always invoke skills BEFORE any response or action:**

| Task Type                 | Required Skills                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------- |
| New feature               | superpowers:writing-plans, superpowers:test-driven-development                          |
| Bug fix                   | superpowers:systematic-debugging, superpowers:test-driven-development                   |
| Multi-step implementation | superpowers:using-git-worktrees, superpowers:writing-plans, superpowers:executing-plans |
| Code review               | superpowers:requesting-code-review                                                      |
| Completion                | superpowers:verification-before-completion, superpowers:finishing-a-development-branch  |

**If even 1% chance a skill applies → INVOKE IT.**

## Project Structure

```
nodra/
├── .github/workflows/     # CI/CD configurations
├── .worktrees/           # Git worktrees (gitignored)
├── docs/
│   ├── plans/            # Implementation plans
│   ├── en/               # English documentation
│   └── zh/               # Chinese documentation
├── doctypes/             # DocType JSON definitions
├── src/
│   ├── core/             # Core framework (DocType, Document, errors)
│   ├── database/         # Database layer
│   ├── api/              # REST API layer
│   ├── auth/             # Authentication
│   └── ...               # Other modules
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test fixtures
├── .qoder/skills/        # Domain-specific skills
├── CLAUDE.md             # This file
└── AGENTS.md             # General development guide
```

## Module Quick Reference

### Core Module (`src/core/`)

- **DocType System**: Metadata definition, validation, registry
- **Document System**: Runtime instances, lifecycle hooks, dirty tracking
- **Errors**: NodraError hierarchy
- **When to use**: DocType/Document changes, validation logic, core types

### Database Module (`src/database/`)

- **Connection**: Pool management, transaction handling
- **Query Builder**: SQL generation, parameterized queries
- **Schema Sync**: DDL generation from DocTypes
- **When to use**: SQL queries, migrations, schema changes

### API Module (`src/api/`)

- **Routes**: REST endpoints for DocType CRUD
- **Middleware**: Auth, validation, error handling
- **Serialization**: JSON formatting, field filtering
- **When to use**: HTTP endpoints, request handling, responses

## Development Commands

```bash
# Installation
pnpm install

# Development
pnpm dev              # Start dev server
pnpm build            # Build for production

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report

# Code Quality
pnpm typecheck        # TypeScript type check
pnpm lint             # ESLint check
pnpm lint:fix         # Fix linting issues
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
```

## Pre-commit Checklist

Before committing:

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Tests written for new functionality
- [ ] Commit message follows conventional format
- [ ] Work is in isolated worktree (not main branch)

## Troubleshooting

**Tests failing in CI but passing locally:**

- Check Node.js version (must be 20+)
- Clear `node_modules` and reinstall: `rm -rf node_modules && pnpm install`
- Check for environment-specific code

**Type errors after changes:**

- Run `pnpm typecheck` to see all errors
- Fix root cause, not symptoms
- Check `strict` mode compliance

**Lint errors:**

- Run `pnpm lint:fix` for auto-fixable issues
- Manual fix required for: `no-explicit-any`, naming violations

## Resources

- **Architecture**: `docs/en/ARCHITECTURE.md` or `docs/zh/ARCHITECTURE.md`
- **API Reference**: `docs/en/API_REFERENCE.md`
- **Skills**: `.qoder/skills/nodra-*/SKILL.md`
- **Superpowers**: Refer to skill documentation in superpowers directory

## Last Updated

2026-02-13 - Initial CLAUDE.md for Nodra project

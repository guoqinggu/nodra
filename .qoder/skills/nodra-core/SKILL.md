# nodra-core Skill

Use this skill when working on the Nodra framework's core modules: DocType system, Document system, error hierarchy, configuration, naming rules, and the main Nodra application class.

## Context

Nodra is a metadata-driven web framework (Node.js + TypeScript + PostgreSQL) inspired by Frappe Framework. Read `docs/ARCHITECTURE.md` for full architecture and `AGENTS.md` for coding conventions.

## When to Use

- Implementing or modifying DocType schema, field types, DocType loader, or DocType registry
- Working on the Document base class, lifecycle hooks, dirty tracking, or child documents
- Implementing the error hierarchy (NodraError and subclasses)
- Working on the configuration system
- Implementing naming rules (autoincrement, hash, field, format, expression)
- Building the validation engine
- Working on the hook system or event emitter
- Modifying the main Nodra application singleton

## Key Architecture Decisions

### DocType System
- DocTypes are defined as JSON files in `doctypes/` directory
- Each DocType JSON is validated against a JSON Schema
- DocTypes are loaded into an in-memory registry at boot time
- Standard fields (name, owner, creation, modified, modified_by, docstatus, idx) are auto-injected
- Child DocTypes have `is_child: true` and include parent, parenttype, parentfield columns

### Document System
- Base Document class in `src/core/document/document.ts`
- Lifecycle hook execution order:
  - Save: beforeValidate → validate → beforeSave → [DB operation] → afterSave → onChange
  - Insert: beforeInsert → [save lifecycle] → afterInsert
  - Submit: beforeSubmit → [save lifecycle] → afterSubmit
  - Cancel: beforeCancel → [save lifecycle] → afterCancel
  - Delete: beforeDelete → [DB delete] → afterDelete
- Controllers are optional TypeScript classes co-located with DocType JSON
- Dirty tracking compares current values with `_previousValues` snapshot

### Error Hierarchy
```
NodraError (base)
├── ValidationError
├── PermissionError
├── NotFoundError
├── DuplicateError
├── LinkValidationError
├── MandatoryError
├── InvalidStateError
├── DatabaseError
├── AuthenticationError
└── AppError
```

### Field Types and PostgreSQL Mapping
- Data → VARCHAR(n), Int → INTEGER, Float → DOUBLE PRECISION
- Currency → NUMERIC(18,6), Date → DATE, Datetime → TIMESTAMPTZ
- Text/LongText/SmallText → TEXT, Check → BOOLEAN
- Select → VARCHAR(255), Link → VARCHAR(255), JSON → JSONB
- See `docs/ARCHITECTURE.md` Section 2.3 for full mapping

### Naming Rules
- Each DocType specifies a `naming_rule` in its JSON definition
- Naming is executed during document insert, before the DB operation
- `autoincrement`: uses PostgreSQL SEQUENCE per DocType
- `hash`: generates random alphanumeric string
- `field`: uses the value of a specified field as the name
- `format`: pattern like `TODO-{####}` with auto-incrementing counter
- `expression`: evaluates a TypeScript expression

## Implementation Guidelines

1. **Always read the relevant architecture docs first** before making changes
2. **Follow TDD**: Write tests in `tests/unit/core/` before implementing
3. **Use strict TypeScript**: no `any`, prefer `unknown` + narrowing
4. **Export minimally**: only public API through `src/index.ts`
5. **Error context**: every thrown error must include doctype, fieldname, or value for debugging
6. **Immutable metadata**: DocType definitions in the registry should be frozen (Object.freeze)

## File Locations

- Source: `src/core/doctype/`, `src/core/document/`, `src/core/validation/`, `src/core/errors.ts`
- Tests: `tests/unit/core/`
- Fixtures: `tests/fixtures/`
- DocType JSONs: `doctypes/core/`

## Testing

```bash
# Run core tests
pnpm vitest run tests/unit/core/

# Run specific test
pnpm vitest run tests/unit/core/doctype.test.ts

# Watch mode
pnpm vitest watch tests/unit/core/
```

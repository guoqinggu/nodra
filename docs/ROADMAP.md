# Nodra Framework - Development Roadmap

## Development Principles

- **TDD (Test-Driven Development)**: Write tests first, then implement
- **Incremental**: Each phase builds on the previous, always keeping the system runnable
- **Git discipline**: Each significant feature/module is committed separately
- **Multi-agent**: Development leverages specialized agents (core, db, api, test)

---

## Phase 1: Project Bootstrap & Foundation

### 1.1 Project Initialization
- [ ] Initialize Node.js project with pnpm
- [ ] Configure TypeScript (strict mode, ESM, path aliases)
- [ ] Configure Vitest for testing
- [ ] Configure tsup for building
- [ ] Configure ESLint + Prettier
- [ ] Set up .gitignore, .editorconfig
- [ ] Create initial directory structure

### 1.2 Error System
- [ ] Define error hierarchy (NodraError, ValidationError, etc.)
- [ ] Implement error classes with proper stack traces
- [ ] Map errors to HTTP status codes
- [ ] Tests for all error types

### 1.3 Configuration System
- [ ] Config loading from file + environment variables
- [ ] Config schema validation
- [ ] Default configuration values
- [ ] Tests for config loading and validation

### 1.4 Logger
- [ ] Structured JSON logger (using pino)
- [ ] Log levels: debug, info, warn, error
- [ ] Request-scoped logging with correlation IDs
- [ ] Tests for log output

---

## Phase 2: DocType System

### 2.1 Field Types
- [ ] Define all field type enums and type mappings
- [ ] Field-to-PostgreSQL type mapping
- [ ] Field validation rule mapping
- [ ] Tests for type definitions and mappings

### 2.2 DocType Schema
- [ ] DocType definition interface (TypeScript)
- [ ] JSON Schema for DocType validation
- [ ] DocType definition parser
- [ ] Standard fields injection (name, owner, creation, modified, etc.)
- [ ] Tests for schema parsing and validation

### 2.3 DocType Loader
- [ ] Load DocType JSON from filesystem
- [ ] Validate against DocType JSON Schema
- [ ] Resolve child DocType references
- [ ] Tests with fixture DocTypes

### 2.4 DocType Registry
- [ ] In-memory DocType registry (singleton)
- [ ] Register, lookup, list DocTypes
- [ ] Dependency resolution (Link fields, child tables)
- [ ] Module grouping
- [ ] Tests for registry operations

### 2.5 Naming System
- [ ] autoincrement naming (PostgreSQL SEQUENCE)
- [ ] hash naming (random ID generation)
- [ ] field-based naming
- [ ] format naming (e.g., `TODO-{####}`)
- [ ] expression naming
- [ ] Tests for each naming strategy

---

## Phase 3: Database Layer

### 3.1 Connection Management
- [ ] pg Pool wrapper with configuration
- [ ] Connection health check
- [ ] Graceful shutdown (drain pool)
- [ ] Tests with real PostgreSQL (testcontainers or local)

### 3.2 Query Builder
- [ ] SELECT with column selection
- [ ] WHERE clause builder (=, !=, >, <, >=, <=, LIKE, IN, NOT IN, BETWEEN, IS NULL, IS NOT NULL)
- [ ] ORDER BY, LIMIT, OFFSET
- [ ] INSERT with RETURNING
- [ ] UPDATE with WHERE
- [ ] DELETE with WHERE
- [ ] Parameterized queries (SQL injection prevention)
- [ ] Tests for all query types and edge cases

### 3.3 Schema Sync Engine
- [ ] Introspect existing database schema
- [ ] Compare DocType definitions with DB schema
- [ ] Generate CREATE TABLE for new DocTypes
- [ ] Generate ALTER TABLE for modified DocTypes (add columns, change types)
- [ ] Create indexes from field definitions
- [ ] Handle child table relationships
- [ ] Safety: never auto-drop columns
- [ ] Tests for schema diffing and SQL generation

### 3.4 Transaction Support
- [ ] Transaction wrapper with auto-rollback
- [ ] Savepoint support
- [ ] Tests for commit and rollback scenarios

### 3.5 Migration System
- [ ] Track applied migrations in database
- [ ] Schema diff to generate migration scripts
- [ ] Migration runner (up/down)
- [ ] Data migration support
- [ ] Tests for migration lifecycle

---

## Phase 4: Document & ORM

### 4.1 Base Document Class
- [ ] Document constructor from DocType + data
- [ ] Getter/setter for fields with type coercion
- [ ] Dirty tracking (changed fields detection)
- [ ] isNew() detection
- [ ] Standard field population (owner, creation, modified, modified_by)
- [ ] Tests for document operations

### 4.2 Document Lifecycle
- [ ] Hook manager (before/after pattern)
- [ ] Execution order: beforeValidate → validate → beforeSave → DB → afterSave
- [ ] Insert lifecycle: beforeInsert → (save lifecycle) → afterInsert
- [ ] Submit lifecycle: beforeSubmit → (save lifecycle) → afterSubmit
- [ ] Cancel lifecycle: beforeCancel → (save lifecycle) → afterCancel
- [ ] Delete lifecycle: beforeDelete → DB → afterDelete
- [ ] onChange detection and trigger
- [ ] Tests for each lifecycle path

### 4.3 Document Controller
- [ ] Auto-discover controller files (.ts next to .json)
- [ ] Controller class loading and instantiation
- [ ] Override lifecycle hooks via controller
- [ ] Tests for controller loading and hook execution

### 4.4 Child Documents
- [ ] Table field handling (one-to-many)
- [ ] append(), remove() for child rows
- [ ] Child document validation
- [ ] Save/load with parent
- [ ] Cascade delete
- [ ] Tests for child document operations

### 4.5 ORM High-Level API
- [ ] `nodra.getDoc(doctype, name)` - fetch single
- [ ] `nodra.getDoc({doctype, ...fields})` - create new
- [ ] `nodra.getList(doctype, options)` - list with filters
- [ ] `nodra.getCount(doctype, filters)` - count
- [ ] `nodra.getValue(doctype, name, field)` - get single value
- [ ] `nodra.setValue(doctype, name, field, value)` - set single value
- [ ] `nodra.deleteDoc(doctype, name)` - delete
- [ ] `nodra.exists(doctype, name)` - check existence
- [ ] `doc.save()`, `doc.insert()`, `doc.delete()`, `doc.submit()`, `doc.cancel()`
- [ ] Tests for all ORM operations

### 4.6 Validation Engine
- [ ] Required field validation
- [ ] Type validation (string, number, date, etc.)
- [ ] Max length validation
- [ ] Unique constraint validation
- [ ] Select option validation
- [ ] Link existence validation
- [ ] Custom validator support
- [ ] Collect all errors (not fail-fast)
- [ ] Tests for each validation type

---

## Phase 5: REST API

### 5.1 Fastify Server Setup
- [ ] Fastify instance with TypeScript
- [ ] Plugin architecture (register pattern)
- [ ] Request/response logging
- [ ] Error handler plugin
- [ ] CORS configuration
- [ ] Tests for server boot

### 5.2 Resource Routes
- [ ] GET `/api/resource/:doctype` - list with filters, pagination, sorting
- [ ] GET `/api/resource/:doctype/:name` - get single document
- [ ] POST `/api/resource/:doctype` - create document
- [ ] PUT `/api/resource/:doctype/:name` - update document
- [ ] DELETE `/api/resource/:doctype/:name` - delete document
- [ ] GET `/api/resource/:doctype/count` - count
- [ ] Request validation from DocType schema
- [ ] Response serialization
- [ ] Tests for each endpoint

### 5.3 Method Routes
- [ ] POST `/api/method/:path` - call whitelisted functions
- [ ] `@whitelist` decorator for exposing functions
- [ ] Argument parsing from request body
- [ ] Tests for method calling

### 5.4 OpenAPI Generation
- [ ] Auto-generate OpenAPI 3.0 spec from DocTypes
- [ ] Swagger UI integration
- [ ] Tests for spec generation

---

## Phase 6: Authentication

### 6.1 Password Management
- [ ] argon2 hashing and verification
- [ ] Password strength validation
- [ ] Tests for hashing

### 6.2 Session Management
- [ ] JWT token generation and verification
- [ ] Refresh token rotation
- [ ] Token expiry handling
- [ ] Tests for session lifecycle

### 6.3 Auth Endpoints
- [ ] POST `/api/method/login` - login with email/password
- [ ] POST `/api/method/logout` - invalidate session
- [ ] GET `/api/method/get_logged_user` - get current user
- [ ] Tests for auth flows

### 6.4 API Key Authentication
- [ ] API key generation per user
- [ ] API key + secret authentication
- [ ] Tests for API key auth

---

## Phase 7: Permission System

### 7.1 Role System
- [ ] Role DocType
- [ ] User-Role assignment
- [ ] Role hierarchy / inheritance
- [ ] Tests for role operations

### 7.2 DocType Permissions
- [ ] Permission rules from DocType definition
- [ ] CRUD permission checks (read, write, create, delete, submit, cancel)
- [ ] Owner-based permissions (if_owner flag)
- [ ] Tests for permission checks

### 7.3 User Permissions
- [ ] User Permission DocType (restrict Link field values)
- [ ] Auto-filter in getList based on user permissions
- [ ] Tests for user permission filtering

### 7.4 Permission Middleware
- [ ] Fastify preHandler for permission checks
- [ ] Integrate with resource routes
- [ ] Tests for middleware integration

---

## Phase 8: Hook & Event System

### 8.1 Event Emitter
- [ ] Typed event emitter
- [ ] Synchronous and asynchronous event handling
- [ ] Event priority ordering
- [ ] Tests for event emission and handling

### 8.2 App Hooks
- [ ] Hook registration from app hooks.ts
- [ ] doc_events hooks
- [ ] scheduler_events hooks
- [ ] boot_session hooks
- [ ] override_whitelisted_methods
- [ ] Tests for hook registration and execution

---

## Phase 9: Workflow Engine

### 9.1 Workflow Definition
- [ ] Workflow DocType
- [ ] State definition with doc_status mapping
- [ ] Transition rules with role-based access
- [ ] Tests for workflow definition parsing

### 9.2 Workflow Execution
- [ ] Apply workflow to document lifecycle
- [ ] State transition validation
- [ ] Action execution
- [ ] Integration with document save
- [ ] Tests for workflow execution paths

---

## Phase 10: Background Jobs

### 10.1 Job Queue
- [ ] PostgreSQL-based job queue (SKIP LOCKED)
- [ ] Job serialization/deserialization
- [ ] Job status tracking (queued, active, completed, failed)
- [ ] Dead letter queue
- [ ] Tests for queue operations

### 10.2 Scheduler
- [ ] Cron expression parser
- [ ] Schedule job registration
- [ ] Recurring job execution
- [ ] Tests for scheduler

### 10.3 Worker
- [ ] Worker pool management
- [ ] Concurrency control
- [ ] Retry logic with backoff
- [ ] Graceful shutdown
- [ ] Tests for worker lifecycle

---

## Phase 11: Real-time

### 11.1 WebSocket Server
- [ ] Fastify WebSocket plugin
- [ ] Connection authentication
- [ ] Room management (doctype rooms, document rooms)
- [ ] Tests for WebSocket connections

### 11.2 Document Events
- [ ] Publish document changes to rooms
- [ ] Client subscription management
- [ ] Tests for document change broadcasting

---

## Phase 12: File Management

### 12.1 File DocType
- [ ] File DocType definition
- [ ] File metadata storage
- [ ] Tests for file CRUD

### 12.2 Upload Handling
- [ ] Multipart upload endpoint
- [ ] File size limits
- [ ] File type validation
- [ ] Tests for upload

### 12.3 Storage Backends
- [ ] Local filesystem storage
- [ ] S3-compatible storage (future)
- [ ] Tests for storage operations

---

## Phase 13: Reporting

### 13.1 Query Reports
- [ ] SQL-based report definition
- [ ] Parameterized queries
- [ ] Column definition and formatting
- [ ] Tests for report execution

### 13.2 Script Reports
- [ ] TypeScript-based report logic
- [ ] Data processing pipeline
- [ ] Tests for script reports

---

## Phase 14: CLI

### 14.1 Core Commands
- [ ] `nodra new-site` - Create database and initial setup
- [ ] `nodra migrate` - Sync DocTypes to database
- [ ] `nodra start` - Start development server
- [ ] `nodra console` - Interactive REPL with nodra API
- [ ] Tests for CLI commands

### 14.2 App Commands
- [ ] `nodra new-app` - Scaffold new application
- [ ] `nodra install-app` - Install app to site
- [ ] `nodra uninstall-app` - Remove app from site
- [ ] Tests for app management

---

## Phase 15: App System

### 15.1 App Structure
- [ ] App directory convention
- [ ] App manifest (package.json extensions)
- [ ] DocType discovery from app directories
- [ ] Tests for app loading

### 15.2 App Lifecycle
- [ ] App installation (run setup, install DocTypes)
- [ ] App removal (cleanup)
- [ ] App dependency resolution
- [ ] Tests for app lifecycle

---

## Phase 16: Core DocTypes

### 16.1 Meta DocTypes
- [ ] DocType (meta-DocType that describes DocTypes)
- [ ] DocField (child of DocType)
- [ ] DocPerm (child of DocType)
- [ ] Module Def

### 16.2 User & Access
- [ ] User
- [ ] Role
- [ ] User Role (child)
- [ ] User Permission

### 16.3 System
- [ ] File
- [ ] Workflow
- [ ] Workflow State (child)
- [ ] Workflow Transition (child)

---

## Git Commit Strategy

Each phase and sub-section should be committed separately with descriptive messages:

```
feat(core): add error hierarchy with HTTP status mapping
feat(doctype): implement DocType schema parser and validator
feat(database): add connection pool with health checks
feat(orm): implement base Document class with lifecycle hooks
feat(api): auto-generate REST endpoints from DocTypes
feat(auth): add JWT session management with argon2
feat(permissions): implement role-based DocType permissions
feat(workflow): add state-machine workflow engine
feat(jobs): implement PostgreSQL-based job queue
feat(realtime): add WebSocket document change notifications
feat(cli): implement nodra new-site and migrate commands
```

Testing commits should accompany or precede feature commits (TDD):

```
test(doctype): add DocType schema validation tests
test(database): add query builder tests with edge cases
test(orm): add Document lifecycle integration tests
```

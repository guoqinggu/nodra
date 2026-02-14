# Nodra Framework - Development Roadmap

## Development Principles

- **TDD (Test-Driven Development)**: Write tests first, then implement
- **Incremental**: Each phase builds on the previous, always keeping the system runnable
- **Git discipline**: Each significant feature/module is committed separately
- **Multi-agent**: Development leverages specialized agents (core, db, api, test)
- **No-Code First**: Prioritize visual interfaces to lower the barrier to entry

---

## Completed Phases ✅

### Phase 1: Project Bootstrap & Foundation ✅

- [x] Initialize Node.js project with pnpm
- [x] Configure TypeScript (strict mode, ESM, path aliases)
- [x] Configure Vitest for testing
- [x] Configure tsup for building
- [x] Configure ESLint + Prettier
- [x] Set up .gitignore, .editorconfig
- [x] Create initial directory structure
- [x] Define error hierarchy (NodraError, ValidationError, etc.)
- [x] Implement error classes with proper stack traces
- [x] Map errors to HTTP status codes
- [x] Config loading from file + environment variables
- [x] Structured JSON logger (using pino)

### Phase 2: DocType System ✅

- [x] Define all field type enums and type mappings
- [x] Field-to-PostgreSQL type mapping
- [x] DocType definition interface (TypeScript)
- [x] Field definition type system
- [x] Permission definition type system
- [x] Naming rule type system
- [x] DocType loader implementation
- [x] Standard fields injection (name, owner, creation, modified, etc.)

### Phase 3: Database Layer ✅

- [x] pg Pool wrapper with configuration
- [x] Connection health check
- [x] Transaction support
- [x] SELECT with column selection
- [x] WHERE clause builder (=, !=, >, <, >=, <=, LIKE, IN, NOT IN, BETWEEN, IS NULL, IS NOT NULL)
- [x] ORDER BY, LIMIT, OFFSET
- [x] Generate CREATE TABLE for new DocTypes
- [x] Generate ALTER TABLE for modified DocTypes (add columns)
- [x] Create indexes from field definitions

### Phase 4: Document & ORM ✅

- [x] Document constructor from DocType + data
- [x] Getter/setter for fields
- [x] Dirty tracking (changed fields detection)
- [x] isNew() detection
- [x] Standard field population
- [x] Insert document
- [x] Read document
- [x] Update document
- [x] Delete document
- [x] Required field validation
- [x] Type validation
- [x] Link existence validation

### Phase 5: REST API (Basic) ✅

- [x] Fastify instance with TypeScript
- [x] Error handler plugin
- [x] JWT token generation and verification
- [x] argon2 password hashing
- [x] Session management
- [x] Login/logout endpoints
- [x] GET `/api/resource/:doctype` - list with filters, pagination, sorting
- [x] GET `/api/resource/:doctype/:name` - get single document
- [x] POST `/api/resource/:doctype` - create document
- [x] PUT `/api/resource/:doctype/:name` - update document
- [x] DELETE `/api/resource/:doctype/:name` - delete document

### Phase 6: Permission System (Basic) ✅

- [x] User DocType definition
- [x] Role DocType definition
- [x] DocType-level permissions
- [x] Basic permission checking

### Phase 7: Hook & Event System ✅

- [x] Typed event emitter
- [x] Event listener registration
- [x] before_validate, validate events
- [x] before_save, after_save events
- [x] before_delete, after_delete events
- [x] Hook registration mechanism

### Phase 8: File Management (Basic) ✅

- [x] File DocType definition
- [x] Local filesystem storage
- [x] File upload endpoint
- [x] File type validation

### Phase 9: Background Jobs ✅

- [x] PostgreSQL-based job queue (SKIP LOCKED)
- [x] Cron expression parser
- [x] Recurring job execution
- [x] Worker pool management
- [x] Job status tracking
- [x] Retry logic with backoff

### Phase 10: Real-time ✅

- [x] WebSocket server configuration
- [x] Connection management
- [x] Room management (doctype rooms, document rooms)
- [x] Document change broadcasting
- [x] Event broadcast mechanism

### Phase 11: Reporting (Basic) ✅

- [x] SQL-based report definition
- [x] TypeScript-based report logic
- [x] Column formatting utilities

### Phase 12: Workflow Engine ✅

- [x] Workflow DocType
- [x] State definition with doc_status mapping
- [x] Transition rules with role-based access
- [x] Workflow executor
- [x] Workflow history tracking

### Phase 13: CLI (Basic) ✅

- [x] `nodra new-site` - Create database and initial setup
- [x] `nodra migrate` - Sync DocTypes to database
- [x] `nodra start` - Start development server
- [x] `nodra console` - Interactive REPL

### Phase 14: App System (Basic) ✅

- [x] App directory convention
- [x] App dependency resolution
- [x] App installation
- [x] App uninstallation

---

## In Progress 🔄

### Phase 15: API Enhancement 🔄

**Goal**: Complete API layer for third-party integration

- [x] **15.1 Method Routes**
  - [x] POST `/api/method/{method_path}` implementation
  - [x] Method whitelist mechanism
  - [x] Parameter validation and serialization
  - [x] Permission check integration

- [x] **15.2 API Key Authentication**
  - [x] API key generation and management
  - [x] API key authentication middleware
  - [x] API key permission scope control
  - [x] API key expiration and refresh

- [x] **15.3 OpenAPI Generation**
  - [x] Generate OpenAPI Schema from DocTypes
  - [x] Auto-generate API documentation
  - [x] Swagger UI integration
  - [ ] API versioning

- [x] **15.4 Advanced Query**
  - [x] Full-text search endpoint
  - [x] Aggregation query support
  - [ ] Related query optimization
  - [x] Export functionality (CSV/Excel)

### Phase 16: Permission System Enhancement 🔄

**Goal**: Implement fine-grained permission control

- [x] **16.1 Field-Level Permissions**
  - [x] Field visibility control
  - [x] Field read/write permissions
  - [x] Field-level permission middleware
  - [x] API response field filtering

- [x] **16.2 Row-Level Permissions (User Permission)**
  - [x] Condition-based record filtering
  - [x] Link field value restrictions
  - [x] Row-level permission query optimization
  - [x] Permission caching

- [x] **16.3 Permission Middleware Integration**
  - [x] Authentication middleware enhancement
  - [ ] Permission validation middleware
  - [ ] Role hierarchy
  - [ ] Permission audit logging

---

## Planned Phases 📋

### Phase 17: Frontend Interface (Desk) 📋 **[HIGHEST PRIORITY]**

**Goal**: Build visual management interface for true no-code development

- [ ] **17.1 Desk Framework**
  - [ ] Frontend tech stack selection (React/Vue + TypeScript)
  - [ ] Project structure and build configuration
  - [ ] Routing and navigation
  - [ ] State management
  - [ ] UI component library selection/development
  - [ ] Theme and styling system

- [ ] **17.2 DocType Designer**
  - [ ] Visual field drag-and-drop
  - [ ] Field property configuration panel
  - [ ] Field type selector
  - [ ] Permission rule configuration UI
  - [ ] Naming rule configuration
  - [ ] Real-time preview
  - [ ] JSON code editor (advanced mode)

- [ ] **17.3 List View**
  - [ ] List page layout
  - [ ] Column display configuration
  - [ ] Sorting and filtering UI
  - [ ] Pagination component
  - [ ] Bulk operations (delete, export)
  - [ ] Quick search
  - [ ] Saved filters
  - [ ] View sharing

- [ ] **17.4 Form View**
  - [ ] Form layout rendering
  - [ ] Field component mapping
  - [ ] Field validation feedback
  - [ ] Sub-table (Table field) editing
  - [ ] Link field search selection
  - [ ] File upload component
  - [ ] Form action buttons (save, submit, cancel)
  - [ ] Version history view

- [ ] **17.5 Dashboard**
  - [ ] Dashboard layout system
  - [ ] Statistics card components
  - [ ] Chart components (bar, line, pie)
  - [ ] Recent activity feed
  - [ ] Quick action shortcuts
  - [ ] Custom dashboard builder

- [ ] **17.6 Workflow Designer**
  - [ ] Visual flowchart editor
  - [ ] State node drag-and-drop
  - [ ] Transition line configuration
  - [ ] Condition rule settings
  - [ ] Approver assignment
  - [ ] Workflow preview

- [ ] **17.7 Report Designer**
  - [ ] Visual query builder
  - [ ] Field selector
  - [ ] Filter condition configuration
  - [ ] Sort configuration
  - [ ] Chart type selection
  - [ ] Report preview
  - [ ] Report scheduling

- [ ] **17.8 System Administration**
  - [ ] User management
  - [ ] Role and permission configuration
  - [ ] System settings
  - [ ] App management
  - [ ] Job queue monitoring
  - [ ] Log viewer

### Phase 18: Caching & Performance 📋

**Goal**: Improve system performance for high concurrency

- [ ] **18.1 In-Memory Cache**
  - [ ] LRU cache implementation
  - [ ] DocType definition caching
  - [ ] Permission caching
  - [ ] Query result caching

- [ ] **18.2 Redis Integration**
  - [ ] Redis connection management
  - [ ] Distributed caching
  - [ ] Session storage
  - [ ] Real-time data caching

- [ ] **18.3 Cache Strategies**
  - [ ] Cache invalidation mechanism
  - [ ] Cache warming
  - [ ] Cache penetration protection
  - [ ] Multi-level cache strategy

- [ ] **18.4 Query Optimization**
  - [ ] Query performance analysis
  - [ ] N+1 query optimization
  - [ ] Database connection pool tuning
  - [ ] Slow query monitoring

### Phase 19: File Management Enhancement 📋

**Goal**: Support cloud storage and enterprise file management

- [ ] **19.1 Cloud Storage Support**
  - [ ] AWS S3 integration
  - [ ] Alibaba Cloud OSS integration
  - [ ] Storage backend abstraction
  - [ ] Multi-storage switching

- [ ] **19.2 File Processing**
  - [ ] Image thumbnail generation
  - [ ] File preview (PDF, images)
  - [ ] Batch upload/download
  - [ ] Folder management

- [ ] **19.3 File Security**
  - [ ] File access permissions
  - [ ] Virus scan integration
  - [ ] Sensitive file detection
  - [ ] File encryption storage

### Phase 20: Notifications & Communication 📋

**Goal**: Implement complete notification system

- [ ] **20.1 Email System**
  - [ ] SMTP configuration
  - [ ] Email template management
  - [ ] Bulk email sending
  - [ ] Email queue

- [ ] **20.2 Notification Center**
  - [ ] In-app notifications
  - [ ] Notification templates
  - [ ] Notification preferences
  - [ ] Notification history

- [ ] **20.3 Integration Notifications**
  - [ ] Webhook support
  - [ ] WeChat Work integration
  - [ ] DingTalk integration
  - [ ] Slack integration

### Phase 21: Migration System 📋

**Goal**: Complete database migration mechanism

- [ ] **21.1 Migration Framework**
  - [ ] Migration file format definition
  - [ ] Migration generator
  - [ ] Migration executor
  - [ ] Migration rollback

- [ ] **21.2 Migration Tools**
  - [ ] `nodra migration:create` command
  - [ ] `nodra migration:status` command
  - [ ] Migration history tracking
  - [ ] Data migration support

### Phase 22: CLI Enhancement 📋

**Goal**: Improve development efficiency

- [ ] **22.1 Code Generation**
  - [ ] `nodra generate:doctype` command
  - [ ] `nodra generate:controller` command
  - [ ] `nodra generate:app` command
  - [ ] `nodra generate:migration` command

- [ ] **22.2 Development Tools**
  - [ ] `nodra dev` development mode (hot reload)
  - [ ] `nodra doctor` system diagnostics
  - [ ] `nodra benchmark` performance testing
  - [ ] `nodra logs` log viewer

- [ ] **22.3 Database Tools**
  - [ ] `nodra db:backup` database backup
  - [ ] `nodra db:restore` database restore
  - [ ] `nodra db:reset` database reset

### Phase 23: Full-Text Search 📋

**Goal**: Implement powerful search functionality

- [ ] **23.1 Search Engine Integration**
  - [ ] PostgreSQL full-text search
  - [ ] Elasticsearch integration (optional)
  - [ ] Search index management
  - [ ] Incremental index updates

- [ ] **23.2 Search Features**
  - [ ] Global search
  - [ ] Advanced search filters
  - [ ] Search suggestions (autocomplete)
  - [ ] Search result highlighting

### Phase 24: Deployment & Operations 📋

**Goal**: Support production environment deployment

- [ ] **24.1 Containerization**
  - [ ] Dockerfile
  - [ ] Docker Compose configuration
  - [ ] Kubernetes deployment templates
  - [ ] Helm Charts

- [ ] **24.2 Monitoring & Logging**
  - [ ] Prometheus metrics
  - [ ] Grafana dashboards
  - [ ] Distributed log collection
  - [ ] Alerting system

- [ ] **24.3 CI/CD**
  - [ ] GitHub Actions workflows
  - [ ] Automated testing
  - [ ] Automated deployment
  - [ ] Release process

### Phase 25: Multi-Tenancy 📋

**Goal**: Support SaaS deployment

- [ ] **25.1 Tenant Isolation**
  - [ ] Tenant identification mechanism
  - [ ] Database-level isolation
  - [ ] Schema-level isolation
  - [ ] Row-level isolation

- [ ] **25.2 Tenant Management**
  - [ ] Tenant registration
  - [ ] Tenant configuration
  - [ ] Resource quotas
  - [ ] Tenant billing

### Phase 26: Ecosystem 📋

**Goal**: Build developer ecosystem

- [ ] **26.1 SDK Development**
  - [ ] JavaScript/TypeScript SDK
  - [ ] Python SDK
  - [ ] API client generation

- [ ] **26.2 Tool Integration**
  - [ ] VS Code plugin
  - [ ] Debugging tools
  - [ ] Performance analysis tools

- [ ] **26.3 App Marketplace**
  - [ ] App package format specification
  - [ ] App publishing process
  - [ ] App version management
  - [ ] App rating system

---

## Development Timeline

### Current Phase (In Progress)

- **Phase 17**: Frontend Interface (Desk) - **HIGHEST PRIORITY**

### Phase 1: No-Code MVP (2-3 months)

**Goal**: Achieve basic no-code development capability

**Core Tasks**:

1. **Phase 17.1-17.4**: Desk framework + DocType Designer + List/Form Views
2. **Phase 15**: API Enhancement (support frontend calls)
3. **Phase 16**: Permission System Enhancement

**Deliverables**:

- Visual DocType Designer
- Auto-generated list and form interfaces
- Basic permission control
- Simple app development through UI

### Phase 2: Production Ready (3-4 months)

**Goal**: Reach production environment standards

**Core Tasks**:

1. **Phase 17.5-17.8**: Dashboard + Workflow Designer + Report Designer + System Admin
2. **Phase 18**: Caching & Performance Optimization
3. **Phase 19**: File Management Enhancement (Cloud Storage)
4. **Phase 20**: Notifications & Communication
5. **Phase 21**: Migration System

**Deliverables**:

- Complete visual development environment
- Workflow and report designers
- High-performance, scalable backend
- Enterprise file management

### Phase 3: Enterprise Grade (4-6 months)

**Goal**: Support large-scale enterprise applications

**Core Tasks**:

1. **Phase 22**: CLI Enhancement
2. **Phase 23**: Full-Text Search
3. **Phase 24**: Deployment & Operations
4. **Phase 25**: Multi-Tenancy
5. **Phase 26**: Ecosystem

**Deliverables**:

- Complete enterprise features
- SaaS support
- Developer tools and SDKs
- App marketplace

---

## Milestones

### 🎯 No-Code MVP (3 months)

- [ ] Desk frontend framework
- [ ] Visual DocType Designer
- [ ] List and Form views
- [ ] Basic permission control
- [ ] Simple app creation through UI

### 🚀 Beta Version (6 months)

- [ ] Complete frontend interface (Desk)
- [ ] Workflow Designer
- [ ] Report Designer
- [ ] Dashboard Builder
- [ ] Caching and performance optimization
- [ ] Cloud storage support

### ⭐ Production Version (12 months)

- [ ] Full-text search
- [ ] Complete CLI tools
- [ ] Docker/K8s deployment
- [ ] Monitoring and logging system
- [ ] Complete documentation and tutorials

### 🏆 Enterprise Version (18 months)

- [ ] Multi-tenancy support
- [ ] App marketplace
- [ ] SDKs and development tools
- [ ] Advanced security features
- [ ] Enterprise support services

---

## Development Priorities (Updated)

### 🔥 Highest Priority (No-Code Core)

1. **Desk Frontend Interface**: This is the key to achieving no-code development ✅ COMPLETED
   - Phase 15: API Enhancement (Method Routes, API Key, OpenAPI) ✅
   - Phase 16: Permission System Enhancement (Field-level, Row-level) ✅

### 🔶 High Priority (Production Required)

2. **Desk Frontend Interface**: Begin Phase 17 development
3. **Caching & Performance**: Redis, Multi-level caching, Query optimization
4. **File Management Enhancement**: Cloud Storage (S3/OSS)
5. **Notification System**: Email, Webhook, Integrations
6. **Migration System**: Complete database migrations

### 🟡 Medium Priority (Experience Optimization)

7. **CLI Enhancement**: Code generation, Development tools
8. **Full-Text Search**: PostgreSQL/Elasticsearch
9. **Workflow Designer**: Visual flow design

### 🔷 Low Priority (Enterprise Grade)

11. **Deployment & Operations**: Docker, K8s, Monitoring
12. **Multi-Tenancy**: SaaS support
13. **Ecosystem**: SDKs, App marketplace

---

## Resource Allocation Recommendations

### Team Configuration

**Current Phase (No-Code MVP)**:

- 1 Frontend Developer (Desk Interface)
- 1 Backend Developer (API Enhancement, Permission Enhancement)
- 1 Full-Stack (DocType Designer, Frontend-Backend Integration)

**Production Ready Phase**:

- 2 Frontend Developers
- 2 Backend Developers
- 1 DevOps Engineer

### Time Allocation

```
No-Code MVP Phase:
├── Desk Frontend Framework: 40%
├── DocType Designer: 25%
├── List/Form Views: 20%
├── API Enhancement: 10%
└── Permission Enhancement: 5%

Production Ready Phase:
├── Frontend Feature Completion: 35%
├── Performance Optimization: 20%
├── File/Notification System: 20%
├── Migration/CLI Tools: 15%
└── Testing/Documentation: 10%
```

---

## Quality Standards

### Code Quality

- **Test Coverage**: Unit tests > 80%, Integration tests > 70%
- **Code Standards**: ESLint + Prettier, strict TypeScript configuration
- **Code Review**: All PRs must be reviewed
- **Documentation**: All public APIs must be documented

### Performance Standards

- **API Response Time**: < 200ms (P95)
- **Frontend First Paint**: < 3 seconds
- **Throughput**: 1000+ concurrent requests
- **Availability**: 99.9% uptime

### Security Standards

- **Dependency Security**: Regular security scans and updates
- **Code Security**: Security code reviews
- **Data Security**: Encrypted transmission and storage
- **Access Control**: Fine-grained permission control

---

## Summary

The Nodra backend framework is already quite mature (~70-80% complete), with core features including DocType system, ORM, API, workflow, job queue, and real-time communication all implemented and tested.

**The most critical task now is developing the Desk frontend interface**, which is essential for achieving no-code development. Without a visual interface, users still need to hand-write JSON to define DocTypes, which doesn't demonstrate the value of a no-code platform.

It is recommended to immediately start **Phase 17: Frontend Interface (Desk)** development, while completing **Phase 15-16** API and permission enhancements in parallel to support frontend functionality requirements.

---

## Next Actions

1. **Review this plan**: Team discussion and plan confirmation
2. **Tech stack selection**: Finalize frontend technology stack
3. **Create tasks**: Break down plan into specific development tasks
4. **Start development**: Begin development following module order
5. **Regular check-ins**: Weekly progress reviews, plan adjustments

---

_This plan is based on analysis of the current codebase state and may need adjustment during actual execution based on specific circumstances._

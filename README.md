# Nodra

A metadata-driven web framework inspired by Frappe, built on Node.js + TypeScript + PostgreSQL.

## Overview

Nodra is a modern, metadata-driven web framework that follows the principles of Frappe. It provides a comprehensive platform for building enterprise applications with minimal code through declarative metadata definitions.

## Features

- **Metadata-driven architecture**: Define your application through JSON metadata
- **Type-safe**: Built with TypeScript for enhanced developer experience
- **PostgreSQL integration**: Robust database layer with query builder
- **Authentication & Authorization**: JWT-based authentication with role-based permissions
- **Real-time capabilities**: WebSocket support for live updates
- **Job queues**: Background job processing with cron support
- **File management**: Secure file upload and storage system
- **Workflow engine**: Business process automation
- **Reporting system**: Query and script-based reports

## Architecture

### Core Concepts

- **DocType**: JSON metadata defining data models (schema, permissions, behavior)
- **Document**: Runtime instance of a DocType (database record)
- **Controllers**: TypeScript classes with lifecycle hooks
- **Hooks**: Event-driven system for customizing behavior
- **Apps**: Modular application packaging system

### Modules

- **Core**: Foundation classes, DocType system, error handling
- **Database**: Connection pooling, query builder, schema synchronization
- **ORM**: CRUD operations, validation, transaction management
- **API**: Fastify-based REST API with authentication
- **Auth**: Session management, password hashing, JWT handling
- **Permissions**: Role-based access control
- **Events**: Event emitter system
- **Files**: File upload, storage, and validation
- **Jobs**: Task queues, workers, cron scheduler
- **Realtime**: WebSocket server, room management, broadcasting
- **Reports**: Query reports, script reports, formatting
- **Workflow**: State machines, transitions, execution

## Installation

```bash
pnpm install
```

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Set up PostgreSQL database
4. Configure environment variables

### Scripts

```bash
# Build the project
pnpm build

# Run development server
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run type checking
pnpm typecheck

# Run linting
pnpm lint
```

## Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## License

MIT
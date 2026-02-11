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

## Documentation

### 📚 Complete Documentation

We provide comprehensive bilingual documentation in both Chinese and English.

#### 🇨🇳 中文文档 | Chinese Documentation

| 文档           | 描述                       | 链接                                                       |
| -------------- | -------------------------- | ---------------------------------------------------------- |
| **架构文档**   | 详细的系统架构和设计说明   | [docs/zh/ARCHITECTURE.md](./docs/zh/ARCHITECTURE.md)       |
| **API 参考**   | 完整的 REST API 文档和示例 | [docs/zh/API_REFERENCE.md](./docs/zh/API_REFERENCE.md)     |
| **部署指南**   | 生产环境部署最佳实践       | [docs/zh/DEPLOYMENT.md](./docs/zh/DEPLOYMENT.md)           |
| **故障排除**   | 常见问题诊断和解决方案     | [docs/zh/TROUBLESHOOTING.md](./docs/zh/TROUBLESHOOTING.md) |
| **性能优化**   | 大规模应用性能调优指南     | [docs/zh/PERFORMANCE.md](./docs/zh/PERFORMANCE.md)         |
| **开发路线图** | 详细的开发计划和进度       | [docs/zh/ROADMAP.md](./docs/zh/ROADMAP.md)                 |

#### 🇺🇸 English Documentation

| Document                     | Description                                  | Link                                                       |
| ---------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **Architecture**             | Detailed system architecture and design      | [docs/en/ARCHITECTURE.md](./docs/en/ARCHITECTURE.md)       |
| **API Reference**            | Complete REST API documentation and examples | [docs/en/API_REFERENCE.md](./docs/en/API_REFERENCE.md)     |
| **Deployment Guide**         | Production deployment best practices         | [docs/en/DEPLOYMENT.md](./docs/en/DEPLOYMENT.md)           |
| **Troubleshooting**          | Common issues diagnosis and solutions        | [docs/en/TROUBLESHOOTING.md](./docs/en/TROUBLESHOOTING.md) |
| **Performance Optimization** | Large-scale application tuning guide         | [docs/en/PERFORMANCE.md](./docs/en/PERFORMANCE.md)         |
| **Development Roadmap**      | Detailed development plans and progress      | [docs/en/ROADMAP.md](./docs/en/ROADMAP.md)                 |

### 📖 Documentation Features

- **🏗️ Complete Architecture**: Detailed architecture documentation with module dependency diagrams and design principles
- **🔌 Comprehensive API**: Complete examples for every endpoint, covering authentication, error handling, and best practices
- **🚀 Production-Ready**: Complete deployment workflow from development to production, including security configuration and monitoring
- **🔧 Troubleshooting Guide**: Systematic problem diagnosis covering development, deployment, and operations scenarios
- **⚡ Performance Optimization**: Comprehensive optimization strategies for database, caching, and application layers
- **📈 Monitoring Framework**: Complete performance metrics collection and analysis framework

## Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## License

MIT

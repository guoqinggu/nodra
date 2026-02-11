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

## 文档

### 📚 完整文档

| 文档           | 描述                       | 链接                                            |
| -------------- | -------------------------- | ----------------------------------------------- |
| **架构文档**   | 详细的系统架构和设计说明   | [ARCHITECTURE.md](./docs/ARCHITECTURE.md)       |
| **API 参考**   | 完整的 REST API 文档和示例 | [API_REFERENCE.md](./docs/API_REFERENCE.md)     |
| **部署指南**   | 生产环境部署最佳实践       | [DEPLOYMENT.md](./docs/DEPLOYMENT.md)           |
| **故障排除**   | 常见问题诊断和解决方案     | [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) |
| **性能优化**   | 大规模应用性能调优指南     | [PERFORMANCE.md](./docs/PERFORMANCE.md)         |
| **开发路线图** | 详细的开发计划和进度       | [docs/ROADMAP.md](./docs/ROADMAP.md)            |

### 📖 文档特色

- **🏗️ 架构完整**: 862行详细架构说明，包含模块依赖图和设计原理
- **🔌 API 详实**: 每个端点都有完整示例，涵盖认证、错误处理和最佳实践
- **🚀 部署就绪**: 从开发到生产的完整部署流程，包含安全配置和监控
- **🔧 故障排除**: 系统性的问题诊断方法，覆盖开发、部署和运维场景
- **⚡ 性能优化**: 数据库、缓存、应用层的全面优化策略
- **📈 监控体系**: 完整的性能指标收集和分析框架

## Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## License

MIT

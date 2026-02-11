# Nodra Performance Optimization Guide

This guide provides performance optimization strategies for Nodra applications in development and production environments, including database optimization, caching strategies, application layer optimization, and large-scale deployment recommendations.

## Table of Contents

- [Database Performance Optimization](#database-performance-optimization)
- [Caching Strategies](#caching-strategies)
- [Application Layer Optimization](#application-layer-optimization)
- [Frontend Performance Optimization](#frontend-performance-optimization)
- [System-Level Optimization](#system-level-optimization)
- [Monitoring and Analysis](#monitoring-and-analysis)
- [Large-Scale Deployment](#large-scale-deployment)
- [Performance Testing](#performance-testing)

---

## Database Performance Optimization

### PostgreSQL Configuration Optimization

Edit `/etc/postgresql/15/main/postgresql.conf`:

```ini
# Memory Settings (adjust based on available RAM)
shared_buffers = 256MB          # 25% of RAM for small servers
effective_cache_size = 1GB      # 75% of RAM
work_mem = 4MB                   # Per operation memory
maintenance_work_mem = 64MB      # For VACUUM, CREATE INDEX

# Connection Settings
max_connections = 100
superuser_reserved_connections = 3

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
checkpoint_timeout = 10min

# Query Planning
random_page_cost = 1.1           # For SSD storage
effective_io_concurrency = 200   # For SSD

# Logging for Performance Analysis
log_min_duration_statement = 1000  # Log queries > 1s
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### Index Optimization

#### Create Strategic Indexes

```sql
-- Index for frequently queried fields
CREATE INDEX CONCURRENTLY idx_tab_customer_email ON tab_customer(email);
CREATE INDEX CONCURRENTLY idx_tab_todo_status ON tab_todo(status);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_tab_todo_status_priority ON tab_todo(status, priority DESC);
CREATE INDEX CONCURRENTLY idx_tab_sales_order_date_customer ON tab_sales_order(creation DESC, customer);

-- Partial indexes for specific conditions
CREATE INDEX CONCURRENTLY idx_tab_todo_active ON tab_todo(name) WHERE docstatus = 0;
CREATE INDEX CONCURRENTLY idx_tab_user_enabled ON tab_user(email) WHERE enabled = 1;

-- Text search indexes
CREATE INDEX CONCURRENTLY idx_tab_customer_search ON tab_customer USING gin(to_tsvector('english', customer_name || ' ' || email));
```

#### Monitor Index Usage

```sql
-- Check unused indexes
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan < 100
ORDER BY idx_scan;

-- Index size analysis
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### Query Optimization

#### Analyze Slow Queries

```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000  -- queries > 1 second
ORDER BY mean_time DESC
LIMIT 10;

-- Explain specific query
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM tab_todo WHERE status = 'Open' ORDER BY creation DESC LIMIT 20;
```

#### Optimize Common Query Patterns

```sql
-- Use EXISTS instead of IN for subqueries
-- Bad:
SELECT * FROM tab_todo WHERE customer IN (SELECT name FROM tab_customer WHERE status = 'Active');

-- Good:
SELECT * FROM tab_todo t WHERE EXISTS (SELECT 1 FROM tab_customer c WHERE c.name = t.customer AND c.status = 'Active');

-- Use UNION ALL instead of UNION when no duplicates
-- Bad:
SELECT name FROM tab_user UNION SELECT name FROM tab_customer;

-- Good:
SELECT name FROM tab_user UNION ALL SELECT name FROM tab_customer;
```

### Connection Pooling

#### PgBouncer Configuration

Install and configure PgBouncer:

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
nodra_prod = host=localhost port=5432 dbname=nodra_prod

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = postgres
stats_users = stats, postgres

# Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 50
max_user_connections = 50

# Timeouts
server_reset_query = DISCARD ALL
server_check_delay = 30
server_check_query = select 1
server_lifetime = 3600
server_idle_timeout = 600
```

---

## Caching Strategies

### Redis Configuration

#### Production Redis Setup

```conf
# /etc/redis/redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Network
timeout 300
tcp-keepalive 300
tcp-backlog 511

# Performance
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

#### Application-Level Caching

```typescript
// src/cache/cache-manager.ts
import Redis from 'ioredis';

export class CacheManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  // Cache DocType metadata
  async getDocType(doctype: string): Promise<any> {
    const cacheKey = `doctype:${doctype}`;
    let docType = await this.redis.get(cacheKey);

    if (!docType) {
      docType = await this.loadDocTypeFromDB(doctype);
      await this.redis.setex(cacheKey, 3600, JSON.stringify(docType)); // 1 hour
      return docType;
    }

    return JSON.parse(docType);
  }

  // Cache user permissions
  async getUserPermissions(userId: string): Promise<any[]> {
    const cacheKey = `permissions:${userId}`;
    let permissions = await this.redis.get(cacheKey);

    if (!permissions) {
      permissions = await this.loadUserPermissionsFromDB(userId);
      await this.redis.setex(cacheKey, 1800, JSON.stringify(permissions)); // 30 minutes
      return permissions;
    }

    return JSON.parse(permissions);
  }

  // Cache API responses
  async cacheApiResponse(key: string, data: any, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }

  // Invalidate cache patterns
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Multi-Level Caching

```typescript
// src/cache/multi-level-cache.ts
export class MultiLevelCache {
  private l1Cache = new Map<string, { data: any; expiry: number }>();
  private l2Cache: CacheManager;

  async get(key: string): Promise<any> {
    // L1: In-memory cache
    const l1Item = this.l1Cache.get(key);
    if (l1Item && l1Item.expiry > Date.now()) {
      return l1Item.data;
    }

    // L2: Redis cache
    const l2Data = await this.l2Cache.get(key);
    if (l2Data) {
      // Promote to L1
      this.l1Cache.set(key, { data: l2Data, expiry: Date.now() + 300000 }); // 5 minutes
      return l2Data;
    }

    return null;
  }

  async set(key: string, data: any, ttl: number = 300): Promise<void> {
    // Set in both levels
    this.l1Cache.set(key, { data, expiry: Date.now() + Math.min(ttl * 1000, 300000) });
    await this.l2Cache.set(key, data, ttl);
  }
}
```

---

## Application Layer Optimization

### Connection Management

#### Database Connection Pool

```typescript
// src/db/pool.ts
import { Pool } from 'pg';

export const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: 5, // Minimum connections
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle pool errors
dbPool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await dbPool.end();
});
```

#### HTTP Keep-Alive

```typescript
// src/server.ts
import Fastify from 'fastify';

const server = Fastify({
  keepAliveTimeout: 65000, // 65 seconds
  bodyLimit: 10485760, // 10MB
  maxParamLength: 1000,
});

// Optimize for production
if (process.env.NODE_ENV === 'production') {
  server.addHook('onRequest', async (request, reply) => {
    reply.header('Connection', 'keep-alive');
  });
}
```

### Batch Operations

#### Bulk Database Operations

```typescript
// src/core/bulk-operations.ts
export class BulkOperations {
  // Batch insert
  async bulkInsert(doctype: string, documents: any[]): Promise<void> {
    if (documents.length === 0) return;

    const columns = Object.keys(documents[0]);
    const values = documents.map((doc) => columns.map((col) => this.formatValue(doc[col])));

    const query = `
      INSERT INTO tab_${doctype.toLowerCase().replace(/\s+/g, '_')}
      (${columns.join(', ')})
      VALUES ${values
        .map((vals, i) => `(${vals.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`)
        .join(', ')}
    `;

    await dbPool.query(query, values.flat());
  }

  // Batch update
  async bulkUpdate(doctype: string, updates: Array<{ name: string; data: any }>): Promise<void> {
    const promises = updates.map(({ name, data }) => this.updateDocument(doctype, name, data));

    await Promise.all(promises);
  }

  // Batch delete
  async bulkDelete(doctype: string, names: string[]): Promise<void> {
    if (names.length === 0) return;

    const query = `
      DELETE FROM tab_${doctype.toLowerCase().replace(/\s+/g, '_')}
      WHERE name = ANY($1)
    `;

    await dbPool.query(query, [names]);
  }
}
```

### Async Processing

#### Background Job Queue

```typescript
// src/jobs/job-queue.ts
import Bull from 'bull';

export class JobQueue {
  private queues: Map<string, Bull.Queue> = new Map();

  getQueue(name: string): Bull.Queue {
    if (!this.queues.has(name)) {
      const queue = new Bull(name, {
        redis: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      this.queues.set(name, queue);
    }

    return this.queues.get(name)!;
  }

  async addJob(queueName: string, jobData: any, options?: Bull.JobOptions): Promise<Bull.Job> {
    const queue = this.getQueue(queueName);
    return queue.add(jobData, options);
  }

  processJobs(queueName: string, processor: Bull.ProcessCallbackFunction<any>): void {
    const queue = this.getQueue(queueName);
    queue.process(processor);
  }
}
```

---

## Frontend Performance Optimization

### API Response Optimization

#### Data Compression

```typescript
// src/plugins/compression.ts
import compression from '@fastify/compress';

export const compressionPlugin = async (server: FastifyInstance) => {
  await server.register(compression, {
    threshold: 1024, // Compress responses > 1KB
    encodings: ['gzip', 'deflate', 'br'],
    brotli: {
      params: {
        [import('zlib').constants.BROTLI_PARAM_QUALITY]: 4,
      },
    },
  });
};
```

#### Response Minification

```typescript
// src/hooks/response-optimization.ts
export const responseOptimizationHook = async (request: FastifyRequest, reply: FastifyReply) => {
  // Add ETag headers
  const etag = generateETag(request.payload);
  reply.header('ETag', etag);

  // Handle conditional requests
  if (request.headers['if-none-match'] === etag) {
    reply.code(304).send();
    return;
  }

  // Add cache headers for static data
  if (isStaticEndpoint(request.url)) {
    reply.header('Cache-Control', 'public, max-age=3600'); // 1 hour
  }
};
```

### Efficient Data Loading

#### Lazy Loading

```typescript
// src/controllers/lazy-loading.ts
export class LazyLoadingController {
  async getDocumentList(request: FastifyRequest, reply: FastifyReply) {
    const { fields, limit = 20, offset = 0 } = request.query as any;

    // Only load requested fields
    const selectedFields = fields ? fields.split(',') : ['name', 'creation', 'modified'];

    // Use cursor-based pagination for large datasets
    const documents = await this.getDocumentsWithCursor(selectedFields, limit, offset);

    return {
      data: documents,
      pagination: {
        limit,
        offset,
        has_more: documents.length === limit,
      },
    };
  }

  async getDocumentDetails(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as any;

    // Load basic document first
    const document = await this.getDocument(name);

    // Load related data separately
    if (document.has_children) {
      document.children = await this.getChildren(name);
    }

    return { data: document };
  }
}
```

---

## System-Level Optimization

### Operating System Tuning

#### Linux Kernel Parameters

Add to `/etc/sysctl.conf`:

```ini
# Network optimization
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 65536 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_congestion_control = bbr

# File descriptor limits
fs.file-max = 1000000

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Process limits
kernel.pid_max = 4194303
```

Apply changes:

```bash
sudo sysctl -p
```

#### Process Limits

Edit `/etc/security/limits.conf`:

```ini
nodra soft nofile 65536
nodra hard nofile 65536
nodra soft nproc 32768
nodra hard nproc 32768
```

### Container Optimization

#### Docker Configuration

```dockerfile
# Use multi-stage build for smaller image size
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodra && adduser -S nodra -u 1001

# Copy only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodra:nodra . .

USER nodra

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

#### Docker Compose Optimization

```yaml
version: '3.8'
services:
  app:
    build: .
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          memory: 256M

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: nodra_prod
      POSTGRES_USER: nodra
    deploy:
      resources:
        limits:
          memory: 1G
    volumes:
      - postgres_data:/var/lib/postgresql/data

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app
```

---

## Monitoring and Analysis

### Performance Metrics

#### Application Metrics

```typescript
// src/metrics/performance-metrics.ts
import prometheus from 'prom-client';

export class PerformanceMetrics {
  private httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  private httpRequestTotal = new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  private databaseQueryDuration = new prometheus.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    this.httpRequestDuration.observe({ method, route, status }, duration / 1000);
    this.httpRequestTotal.inc({ method, route, status });
  }

  recordDatabaseQuery(queryType: string, table: string, duration: number): void {
    this.databaseQueryDuration.observe({ query_type: queryType, table }, duration / 1000);
  }
}
```

#### Real-Time Monitoring Dashboard

```typescript
// src/routes/metrics.ts
export async function getMetrics(req, reply) {
  const metrics = await performanceMetrics.getMetrics();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    requests: {
      total: metrics.httpRequestsTotal,
      averageDuration: metrics.averageRequestDuration,
      errorRate: metrics.errorRate,
    },
    database: {
      connections: metrics.dbConnections,
      slowQueries: metrics.slowQueries,
      averageQueryTime: metrics.averageQueryTime,
    },
    cache: {
      hitRate: metrics.cacheHitRate,
      memoryUsage: metrics.cacheMemoryUsage,
    },
  };
}
```

### Database Performance Analysis

#### Query Performance Dashboard

```sql
-- Create performance monitoring view
CREATE OR REPLACE VIEW performance_dashboard AS
SELECT
    'slow_queries' as metric,
    COUNT(*) as value,
    'Number of queries > 1 second' as description
FROM pg_stat_statements
WHERE mean_time > 1000

UNION ALL

SELECT
    'cache_hit_ratio' as metric,
    ROUND((blks_hit::float / NULLIF(blks_hit + blks_read, 0)) * 100, 2) as value,
    'Database cache hit percentage' as description
FROM pg_stat_database
WHERE datname = current_database()

UNION ALL

SELECT
    'active_connections' as metric,
    COUNT(*) as value,
    'Current active connections' as description
FROM pg_stat_activity
WHERE state = 'active' AND pid <> pg_backend_pid();
```

---

## Large-Scale Deployment

### Horizontal Scaling

#### Load Balancer Configuration

```nginx
# /etc/nginx/nginx.conf
upstream nodra_backend {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name nodra.example.com;

    location /api/ {
        proxy_pass http://nodra_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Performance optimizations
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
}
```

#### Session Management for Scaling

```typescript
// src/auth/session-manager.ts
export class SessionManager {
  private redis: Redis;

  async createSession(userId: string, data: any): Promise<string> {
    const sessionId = generateSecureToken();
    const sessionData = {
      userId,
      ...data,
      createdAt: new Date().toISOString(),
    };

    await this.redis.setex(`session:${sessionId}`, 86400, JSON.stringify(sessionData));
    return sessionId;
  }

  async getSession(sessionId: string): Promise<any> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }
}
```

### Database Scaling

#### Read Replicas Configuration

```typescript
// src/db/read-replica-manager.ts
export class ReadReplicaManager {
  private primaryPool: Pool;
  private replicaPools: Pool[];

  constructor() {
    // Primary database (writes)
    this.primaryPool = new Pool({
      host: process.env.DB_PRIMARY_HOST,
      // ... primary config
    });

    // Read replicas
    this.replicaPools = [
      new Pool({ host: process.env.DB_REPLICA1_HOST, ... }),
      new Pool({ host: process.env.DB_REPLICA2_HOST, ... }),
    ];
  }

  async query(sql: string, params?: any[], readOnly = false): Promise<any> {
    if (readOnly && this.replicaPools.length > 0) {
      // Route read queries to replicas
      const pool = this.getRandomReplica();
      return pool.query(sql, params);
    } else {
      // Route write queries to primary
      return this.primaryPool.query(sql, params);
    }
  }

  private getRandomReplica(): Pool {
    const index = Math.floor(Math.random() * this.replicaPools.length);
    return this.replicaPools[index];
  }
}
```

#### Database Sharding Strategy

```typescript
// src/db/shard-manager.ts
export class ShardManager {
  private shards: Map<string, Pool> = new Map();

  constructor() {
    // Initialize shards
    this.initializeShards();
  }

  private getShardKey(document: any): string {
    // Shard by customer or user ID
    return document.customer || document.user || 'default';
  }

  private getShardPool(shardKey: string): Pool {
    const shardId = this.hashShardKey(shardKey) % this.shards.size;
    return Array.from(this.shards.values())[shardId];
  }

  async createDocument(doctype: string, document: any): Promise<any> {
    const shardKey = this.getShardKey(document);
    const pool = this.getShardPool(shardKey);

    const tableName = `tab_${doctype.toLowerCase().replace(/\s+/g, '_')}`;
    const shardTable = `${tableName}_shard_${this.hashShardKey(shardKey)}`;

    // Insert into appropriate shard
    const query = `INSERT INTO ${shardTable} ...`;
    return pool.query(query);
  }

  async getDocument(doctype: string, name: string): Promise<any> {
    // Try all shards to find the document
    for (const pool of this.shards.values()) {
      try {
        const result = await pool.query('SELECT * FROM tab_' + doctype + ' WHERE name = $1', [
          name,
        ]);
        if (result.rows.length > 0) {
          return result.rows[0];
        }
      } catch (error) {
        // Continue to next shard
      }
    }
    return null;
  }
}
```

---

## Performance Testing

### Load Testing

#### Artillery Configuration

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100

scenarios:
  - name: 'API Load Test'
    weight: 70
    flow:
      - get:
          url: '/api/resource/Todo'
          qs:
            limit: 20
      - get:
          url: '/api/resource/Todo/{{ $randomString() }}'

  - name: 'Authentication Test'
    weight: 20
    flow:
      - post:
          url: '/api/method/login'
          json:
            email: 'test@example.com'
            password: 'password'

  - name: 'Document Operations'
    weight: 10
    flow:
      - post:
          url: '/api/resource/Todo'
          json:
            description: 'Test todo'
            status: 'Open'
      - think: 5
      - put:
          url: '/api/resource/Todo/{{ previousResponse.data.data.name }}'
          json:
            status: 'Completed'
```

#### Performance Test Runner

```typescript
// tests/performance/load-test.ts
import Artillery from 'artillery';

export class PerformanceTestRunner {
  async runLoadTest(configPath: string): Promise<any> {
    const artillery = new Artillery();

    const results = await artillery.run(configPath, {
      target: 'http://localhost:3000',
      environment: 'production',
    });

    return this.analyzeResults(results);
  }

  private analyzeResults(results: any): any {
    return {
      totalRequests: results.aggregate.counters['http.requests'],
      successfulRequests: results.aggregate.counters['http.responses.2xx'],
      failedRequests:
        results.aggregate.counters['http.responses.4xx'] +
        results.aggregate.counters['http.responses.5xx'],
      averageResponseTime: results.aggregate.timings['http.response_time'],
      p95ResponseTime: results.aggregate.timings['http.response_time.p95'],
      p99ResponseTime: results.aggregate.timings['http.response_time.p99'],
      throughput: results.aggregate.rps.mean,
    };
  }
}
```

### Stress Testing

#### Database Stress Test

```sql
-- Create stress test data
CREATE OR REPLACE FUNCTION create_stress_data(num_records integer)
RETURNS void AS $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..num_records LOOP
        INSERT INTO tab_todo (name, description, status, priority)
        VALUES (
            'TODO-' || lpad(i::text, 6, '0'),
            'Stress test todo ' || i,
            CASE WHEN (i % 3) = 0 THEN 'Completed' ELSE 'Open' END,
            CASE WHEN (i % 5) = 0 THEN 'High' WHEN (i % 5) = 1 THEN 'Medium' ELSE 'Low' END
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run stress test
SELECT create_stress_data(10000);

-- Performance test queries
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tab_todo WHERE status = 'Open' ORDER BY creation DESC LIMIT 100;
```

---

This performance optimization guide provides comprehensive strategies for scaling Nodra applications. Remember to monitor performance continuously and adjust configurations based on your specific workload patterns.

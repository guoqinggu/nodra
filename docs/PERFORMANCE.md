# Nodra 性能优化指南

本指南提供 Nodra 应用在开发和生产环境中的性能优化策略，包括数据库优化、缓存策略、应用层优化和大规模部署建议。

## 目录

- [数据库性能优化](#数据库性能优化)
- [缓存策略](#缓存策略)
- [应用层优化](#应用层优化)
- [前端性能优化](#前端性能优化)
- [系统级优化](#系统级优化)
- [监控和分析](#监控和分析)
- [大规模部署](#大规模部署)
- [性能测试](#性能测试)

---

## 数据库性能优化

### PostgreSQL 配置优化

#### 内存配置

```sql
-- /etc/postgresql/15/main/postgresql.conf

-- 基于系统内存调整 (假设 16GB RAM)
shared_buffers = 4GB                    -- 25% of RAM
effective_cache_size = 12GB                 -- 75% of RAM
work_mem = 8MB                            -- 每个连接的工作内存
maintenance_work_mem = 256MB                -- 维护操作的内存

-- 连接池优化
max_connections = 200
shared_preload_libraries = 'pg_stat_statements,pg_stat_plans'

-- 检查点优化
checkpoint_completion_target = 0.9            -- 90% 完成时触发检查点
wal_buffers = 64MB                         -- WAL 缓冲区
checkpoint_segments = 64                       -- 更多 WAL 段
checkpoint_timeout = 15min                   -- 检查点超时
```

#### 查询优化

```sql
-- 创建复合索引
CREATE INDEX CONCURRENTLY idx_tab_todo_owner_status_modified
ON tab_todo (owner, status, modified DESC);

-- 部分索引（用于 LIKE 查询）
CREATE INDEX CONCURRENTLY idx_tab_todo_title_gin
ON tab_todo USING gin (title gin_trgm_ops);

-- 表达式索引
CREATE INDEX CONCURRENTLY idx_tab_todo_created_month
ON tab_todo (date_trunc('month', creation));

-- 统计信息更新
ANALYZE tab_todo;
ANALYZE tab_user;
ANALYZE tab_role;

-- 查看缺失的索引
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND correlation > 0.1
ORDER BY correlation DESC;
```

#### 连接池优化

```typescript
// nodra.config.ts
export default {
  db: {
    pool: {
      min: 10,                    -- 最小连接数
      max: 50,                    -- 最大连接数
      idleTimeoutMillis: 30000,     -- 30 秒空闲超时
      connectionTimeoutMillis: 2000,   -- 2 秒连接超时
      reapIntervalMillis: 1000,       -- 1 秒清理间隔
      createTimeoutMillis: 5000,      -- 5 秒创建超时

      -- 连接验证
      validate: (client) => {
        return client.query('SELECT 1');
      }
    }
  }
};
```

---

## 缓存策略

### Redis 缓存架构

```typescript
// 多层缓存配置
export default {
  cache: {
    // L1: 应用内缓存
    memory: {
      maxSize: 100 * 1024 * 1024,  // 100MB
      ttl: 300000,                 -- 5 分钟
      checkPeriod: 60000,            -- 1 分钟清理
      deleteOnExpire: true
    },

    // L2: Redis 缓存
    redis: {
      url: process.env.REDIS_URL!,
      keyPrefix: 'nodra:',
      defaultTTL: 1800,              -- 30 分钟

      // 不同类型的缓存策略
      sessions: {
        ttl: 3600,                   -- 1 小时
        maxSize: 10000
      },

      queries: {
        ttl: 300,                    -- 5 分钟
        maxSize: 5000
      },

      permissions: {
        ttl: 1800,                   -- 30 分钟
        maxSize: 1000
      },

      doctypes: {
        ttl: 86400,                  -- 24 小时
        maxSize: 500
      }
    },

    // L3: 数据库查询缓存
    database: {
      ttl: 60,                     -- 1 分钟
      maxSize: 1000,
      invalidateOnWrite: true
    }
  }
};
```

### 缓存实现示例

```typescript
class CacheManager {
  private redis: Redis;
  private memoryCache = new Map<string, CacheItem>();

  async get<T>(key: string): Promise<T | null> {
    // L1: 内存缓存
    const memItem = this.memoryCache.get(key);
    if (memItem && Date.now() - memItem.timestamp < memItem.ttl) {
      return memItem.value;
    }

    // L2: Redis 缓存
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);

      // 回写 L1 缓存
      this.memoryCache.set(key, {
        value: parsed,
        timestamp: Date.now(),
        ttl: this.getTTL(key),
      });

      return parsed;
    }

    return null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // 同时写入 L1 和 L2
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.getTTL(key),
    };

    this.memoryCache.set(key, item);
    await this.redis.setex(key, ttl || 300, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    // 清除匹配模式的缓存
    const keys = await this.redis.keys(`${this.redis.options.keyPrefix}${pattern}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    // 清除内存缓存
    for (const [key] of this.memoryCache.entries()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }
  }
}
```

---

## 应用层优化

### ORM 优化

```typescript
// 批量操作优化
class OptimizedORM {
  // 批量插入
  async bulkInsert(doctype: string, documents: any[]): Promise<void> {
    const batchSize = 1000;
    const batches = this.chunk(documents, batchSize);

    for (const batch of batches) {
      await this.db.query(doctype)
        .insert(batch)
        .execute();

      // 批次间的小延迟避免数据库过载
      await this.sleep(10);
    }
  }

  // 预加载关联数据
  async preloadRelated(docs: any[]): Promise<void> {
    const userNames = [...new Set(docs.map(d => d.owner))];
    const users = await this.db.query('User')
      .select('name', 'full_name', 'email')
      .where('name', 'IN', userNames)
      .execute();

    const userMap = new Map(users.rows.map(u => [u.name, u]));

    docs.forEach(doc => {
      if (userMap.has(doc.owner)) {
        doc.user = userMap.get(doc.owner);
      }
    });
  }

  // 智能查询优化
  async optimizedList(doctype: string, options: ListOptions) {
    let query = this.db.query(doctype);

    // 选择性字段加载
    if (options.fields && options.fields.length < 10) {
      query = query.select(...options.fields);
    } else {
      query = query.select('*');  -- 小表使用 SELECT *
    }

    // 智能索引使用
    if (options.filters?.owner) {
      query = query.where('owner', '=', options.filters.owner);
      query = query.indexHint('idx_owner_status');  -- 使用复合索引
    }

    // 分页优化
    if (options.offset > 1000) {
      query = query.cursorBased();  -- 大偏移量使用游标分页
    }

    return query.execute();
  }
}
```

### 事件循环优化

```typescript
// 非阻塞操作
import { EventEmitter } from 'events';

class OptimizedEvents {
  private emitter = new EventEmitter();
  private processing = new Set();

  // 批量处理事件
  async emitBatch(event: string, data: any[]): Promise<void> {
    const batch = [...data];

    // 使用 setImmediate 避免阻塞
    setImmediate(() => {
      for (const item of batch) {
        if (!this.processing.has(item.id)) {
          this.processing.add(item.id);

          // 异步处理每个项目
          this.processItem(item).finally(() => {
            this.processing.delete(item.id);
          });
        }
      }
    });
  }

  private async processItem(item: any): Promise<void> {
    // 具体处理逻辑
    await this.saveToDatabase(item);
    this.emitter.emit('processed', item);
  }
}
```

---

## 前端性能优化

### 资源优化

```typescript
// 构建优化配置
// tsup.config.ts
export default {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  minify: true,
  sourcemap: false,
  treeshake: true,
  splitting: true,

  // 代码分割
  splitting: {
    chunks: () => ({
      vendor: ['react', 'fastify'],
      api: ['src/api/**'],
      ui: ['src/ui/**'],
    }),
  },

  // 资源处理
  esbuildOptions: (options) => ({
    ...options,
    loader: 'tsx',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  }),
};
```

### Nginx 静态文件优化

```nginx
server {
    # 启用 gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # 设置缓存头
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }

    # HTML 文件缓存策略
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, no-cache";
    }

    # Brotli 压缩（如果可用）
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/json application/javascript;

    # 预加载关键资源
    location = / {
        add_header Link "</assets/critical.css>; rel=preload; as=style" always;
        add_header Link "</assets/critical.js>; rel=preload; as=script" always;
    }
}
```

---

## 系统级优化

### 操作系统优化

```bash
# 系统参数调优
# /etc/sysctl.conf

# 网络优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_keepalive_probes = 9
net.ipv4.tcp_keepalive_intvl = 30

# 内存管理
vm.swappiness = 10                      -- 减少交换使用
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.dirty_expire_centisecs = 1200

# 文件描述符限制
fs.file-max = 2097152

# 应用更改
sudo sysctl -p
```

### Node.js 运行时优化

```typescript
// 生产环境 Node.js 优化
export default {
  node: {
    // 内存管理
    maxOldSpaceSize: '2048',      -- 2GB 老生代
    maxSemiSpaceSize: '1024',      -- 1GB 半空间
    maxExecutableSize: '1024',       -- 1MB 可执行内存
    maxHeapTotalSize: '3072',      -- 3GB 总堆内存

    // 垃圾回收优化
    gc: {
      mode: 'incremental',
      maxMarkSweepPause: 100,        -- 最大停顿时间（毫秒）

      // 启用 GC 日志
      tracking: {
        allocation: true,
        promotion: true,
        retention: 10000
      }
    },

    // 进程优化
    cluster: {
      enabled: true,
      instances: 'max',  -- 基于 CPU 核心数
      maxRestarts: 10,
      reloadTimeout: 5000
    }
  }
};
```

---

## 监控和分析

### 性能指标收集

```typescript
class PerformanceMonitor {
  private metrics = {
    // HTTP 指标
    http: {
      requests: 0,
      duration: [],
      errors: 0,
      statusCodes: new Map(),
    },

    // 数据库指标
    database: {
      connections: 0,
      queries: 0,
      slowQueries: 0,
      avgDuration: 0,
    },

    // 系统指标
    system: {
      cpu: 0,
      memory: {
        used: 0,
        total: 0,
      },
      disk: {
        used: 0,
        total: 0,
      },
    },
  };

  // 记录请求时间
  recordRequest(duration: number, statusCode: number) {
    this.metrics.http.requests++;
    this.metrics.http.duration.push(duration);

    const statusCount = this.metrics.http.statusCodes.get(statusCode) || 0;
    this.metrics.http.statusCodes.set(statusCode, statusCount + 1);

    if (statusCode >= 400) {
      this.metrics.http.errors++;
    }

    // 每 1000 个请求计算一次统计
    if (this.metrics.http.requests % 1000 === 0) {
      this.calculateHttpStats();
    }
  }

  // 计算 95% 响应时间
  calculateHttpStats() {
    const sorted = [...this.metrics.http.duration].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 0;

    console.log(`HTTP P95: ${p95}ms`);

    // 发送到监控系统
    this.sendMetrics('http.p95_duration', p95);
  }
}
```

### APM 集成

```typescript
// 集成 New Relic / DataDog
import * as newrelic from 'newrelic';

if (process.env.NODE_ENV === 'production') {
  newrelic.configure({
    app_name: 'nodra-app',
    license_key: process.env.NEW_RELIC_LICENSE_KEY,

    // 分布式跟踪
    distributed_tracing: {
      enabled: true,
    },

    // 错误收集
    error_collector: {
      enabled: true,
      capture_events: true,
    },

    // 浏览器监控
    browser_monitoring: {
      enabled: true,
    },
  });
}
```

---

## 大规模部署

### 水平扩展策略

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # 应用服务器集群
  app:
    image: nodra:latest
    replicas: 4
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-cluster
      - REDIS_URL=redis://redis-cluster
    depends_on:
      - postgres-cluster
      - redis-cluster

    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

    # 健康检查
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  # 数据库集群
  postgres-master:
    image: postgres:15
    environment:
      POSTGRES_DB: nodra_production
      POSTGRES_USER: nodra_app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./postgres/master.conf:/etc/postgresql/postgresql.conf

  postgres-slave:
    image: postgres:15
    environment:
      POSTGRES_DB: nodra_production
      POSTGRES_USER: nodra_app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_slave_data:/var/lib/postgresql/data
      - ./postgres/slave.conf:/etc/postgresql/postgresql.conf

  # Redis 集群
  redis-master:
    image: redis:7
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  redis-slave:
    image: redis:7
    command: redis-server --slaveof redis-master 6379
    depends_on:
      - redis-master
```

### 负载均衡配置

```nginx
upstream nodra_cluster {
    least_conn;
    server app1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app2:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app3:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app4:3000 weight=1 max_fails=3 fail_timeout=30s;

    # 健康检查
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

server {
    listen 443 ssl http2;
    server_name myapp.example.com;

    # 会话粘性（如果需要）
    ip_hash;

    # 连接池配置
    proxy_http_version 1.1;
    proxy_set_header Connection "";

    # 缓存配置
    proxy_cache_path /var/cache/nginx;
    proxy_cache_valid 200 5m;
    proxy_cache_valid 404 1m;

    # 压缩
    gzip on;
    gzip_proxied any;

    location /api/ {
        proxy_pass http://nodra_cluster;

        # 缓存策略
        proxy_cache_bypass $http_upgrade;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;

        # 超时配置
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## 性能测试

### 负载测试脚本

```bash
#!/bin/bash
# performance-test.sh

API_BASE_URL="http://localhost:3000"
CONCURRENT_USERS=(50 100 200 500)
DURATION=60s

echo "开始性能测试..."

# 使用 wrk 进行现代负载测试
for USERS in "${CONCURRENT_USERS[@]}"; do
    echo "测试并发用户数: $USERS"

    wrk -t12 -c$USERS -d$DURATION --timeout 10s --latency \
        --script scripts/post-api.lua \
        --output json \
        $API_BASE_URL/api/resource/Todo > results_${USERS}.json

    # 提取关键指标
    RESPONSE_TIME=$(jq '.latency.max' results_${USERS}.json)
    REQUESTS_PER_SEC=$(jq '.requestsPerSec' results_${USERS}.json)
    ERROR_RATE=$(jq '.errorsPerSec' results_${USERS}.json)

    echo "并发 $USERS: RPS=$REQUESTS_PER_SEC, 延迟=$RESPONSE_TIME, 错误率=$ERROR_RATE"
done

# 数据库压力测试
echo "开始数据库压力测试..."
pgbench -i 100 -c 20 -j 4 -T 300s nodra_production

echo "性能测试完成！"
```

### 测试脚本示例

```lua
-- scripts/post-api.lua
wrk.method = "POST"
wrk.body = '{"title": "Load test task", "status": "Open"}'
wrk.headers["Content-Type"] = "application/json"

request = function()
    return wrk.format(wrk.method, wrk.path, wrk.headers, wrk.body)
end

response = function(status, headers, body)
    -- 记录响应时间
    if status == 200 then
        wrk.thread:stop()
    end
end
```

---

## 性能基准和目标

### 关键性能指标 (KPI)

| 指标               | 优秀    | 良好    | 需要优化 |
| ------------------ | ------- | ------- | -------- |
| **响应时间 (P95)** | < 100ms | < 200ms | > 200ms  |
| **吞吐量 (RPS)**   | > 5000  | > 2000  | < 2000   |
| **CPU 使用率**     | < 50%   | < 70%   | > 70%    |
| **内存使用率**     | < 70%   | < 85%   | > 85%    |
| **数据库连接**     | < 60%   | < 80%   | > 80%    |
| **错误率**         | < 0.1%  | < 1%    | > 1%     |

### 容量规划

```typescript
// 基于用户数的容量规划
function calculateCapacity(users: number) {
  return {
    // 每用户每日请求量
    requests_per_user_per_day: 100,

    // 峰值倍数
    peak_multiplier: 3.0,

    // 计算所需资源
    required_rps: Math.ceil((users * 100 * 3.0) / 86400),
    required_memory_gb: Math.ceil((users * 50) / 1024), // 50MB 每用户
    required_db_connections: Math.ceil(users * 0.1), // 10% 用户在线

    // 推荐配置
    recommended_config: {
      app_instances: Math.max(4, Math.ceil(users / 1000)),
      db_connections: Math.max(20, Math.ceil(users * 0.15)),
      redis_memory_mb: Math.max(512, Math.ceil(users * 2)),
    },
  };
}

// 示例：10,000 用户应用
const capacity = calculateCapacity(10000);
console.log(capacity);
// 输出：
// {
//   required_rps: 35,
//   required_memory_gb: 489,
//   required_db_connections: 1000,
//   recommended_config: {
//     app_instances: 10,
//     db_connections: 150,
//     redis_memory_mb: 20480
//   }
// }
```

---

## 持续优化

### 自动化性能优化

```typescript
// 性能优化自动化
class AutoOptimizer {
  private thresholds = {
    response_time_p95: 200, // ms
    cpu_usage: 70, // %
    memory_usage: 85, // %
    error_rate: 1.0, // %
  };

  async runOptimizationCycle(): Promise<void> {
    const metrics = await this.collectMetrics();

    // 响应时间优化
    if (metrics.http.p95 > this.thresholds.response_time_p95) {
      await this.optimizeResponseTime();
    }

    // CPU 使用率优化
    if (metrics.system.cpu > this.thresholds.cpu_usage) {
      await this.optimizeCPUUsage();
    }

    // 内存使用优化
    if (metrics.system.memory.usage > this.thresholds.memory_usage) {
      await this.optimizeMemoryUsage();
    }

    // 自动扩容
    if (this.shouldScale(metrics)) {
      await this.autoScale();
    }
  }

  private async optimizeResponseTime(): Promise<void> {
    // 启用查询缓存
    await this.enableQueryCache();

    // 优化数据库索引
    await this.optimizeDatabaseIndexes();

    // 调整缓存 TTL
    await this.adjustCacheTTL();
  }

  private async optimizeCPUUsage(): Promise<void> {
    // 增加 Worker 线程数
    await this.scaleWorkers();

    // 优化 CPU 密集型任务
    await this.optimizeCPUIntensiveTasks();
  }

  private async optimizeMemoryUsage(): Promise<void> {
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }

    // 调整内存限制
    await this.adjustMemoryLimits();

    // 清理缓存
    await this.cleanupCache();
  }
}
```

### 性能报告生成

```typescript
class PerformanceReporter {
  async generateDailyReport(): Promise<PerformanceReport> {
    const day = new Date().toISOString().split('T')[0];

    const report = {
      date: day,

      // HTTP 性能
      http: {
        total_requests: await this.getTotalRequests(),
        avg_response_time: await this.getAvgResponseTime(),
        p95_response_time: await this.getP95ResponseTime(),
        error_rate: await this.getErrorRate(),
        status_distribution: await this.getStatusDistribution(),
      },

      // 数据库性能
      database: {
        avg_query_time: await this.getAvgQueryTime(),
        slow_queries_count: await this.getSlowQueriesCount(),
        connection_usage: await this.getConnectionUsage(),
        index_hit_rate: await this.getIndexHitRate(),
      },

      // 系统性能
      system: {
        avg_cpu_usage: await this.getAvgCPUUsage(),
        max_memory_usage: await this.getMaxMemoryUsage(),
        disk_io_wait: await this.getDiskIOWait(),
        network_throughput: await this.getNetworkThroughput(),
      },

      // 趋势分析
      trends: {
        requests_growth: await this.getRequestsGrowth(),
        response_trend: await this.getResponseTimeTrend(),
        resource_trend: await this.getResourceTrend(),
      },
    };

    // 生成报告
    await this.saveReport(report);
    await this.sendSlackAlert(report);

    return report;
  }
}
```

---

_最后更新：2026-02-11_

# Nodra 故障排除指南

本指南提供 Nodra 应用开发、部署和运维过程中常见问题的诊断和解决方案。

## 目录

- [快速诊断](#快速诊断)
- [开发环境问题](#开发环境问题)
- [部署问题](#部署问题)
- [数据库问题](#数据库问题)
- [性能问题](#性能问题)
- [认证和权限](#认证和权限)
- [文件上传问题](#文件上传问题)
- [WebSocket 连接问题](#websocket-连接问题)
- [作业队列问题](#作业队列问题)
- [内存泄漏](#内存泄漏)
- [日志分析](#日志分析)

---

## 快速诊断

### 健康检查

首先运行系统健康检查：

```bash
# 检查应用状态
curl http://localhost:3000/health

# 检查系统资源
free -h
df -h
top -bn1 | head -20

# 检查服务状态
systemctl status nodra postgresql nginx redis-server
```

### 快速命令参考

```bash
# 重启所有服务
sudo systemctl restart nodra postgresql nginx redis-server

# 查看最新日志
sudo journalctl -u nodra -f --since "10 minutes ago"
tail -f /var/log/nodra/app.log

# 检查端口占用
sudo netstat -tlnp | grep -E ':(3000|5432|80|443|6379)\s'

# 测试数据库连接
psql -U nodra_app -h localhost -d nodra_production -c "SELECT version();"
```

---

## 开发环境问题

### 1. 应用无法启动

#### 问题现象

```bash
$ pnpm dev
Error: listen EADDRINUSE :::3000
# 或
Error: Cannot find module 'nodra'
# 或
TypeError: Cannot read property 'config' of undefined
```

#### 诊断步骤

```bash
# 检查端口占用
lsof -i :3000
netstat -tlnp | grep :3000

# 检查依赖安装
pnpm ls
pnpm outdated

# 检查配置文件
node -c nodra.config.ts

# 检查 Node.js 版本
node --version
npm --version
```

#### 解决方案

```bash
# 终止占用端口的进程
kill -9 $(lsof -t -i :3000 -F pid)

# 重新安装依赖
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 修复配置文件
# 确保 nodra.config.ts 导出正确的配置对象

# 检查 Node.js 版本兼容性
# 确保使用 Node.js 20+
```

### 2. TypeScript 编译错误

#### 常见错误类型

```typescript
// 错误：找不到模块
Cannot find module './types' or its corresponding type declarations

// 错误：类型不匹配
Type 'string' is not assignable to type 'number'

// 错误：未定义属性
Property 'x' does not exist on type 'Y'
```

#### 诊断方法

```bash
# 详细类型检查
pnpm typecheck --noEmit

# 检查 tsconfig.json
cat tsconfig.json | jq .

# 检查导入路径
find src -name "*.ts" -exec grep "import.*from" {} + | grep -E "(error|Error)"
```

#### 解决方案

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/types/*": ["src/types/*"]
    },
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 3. 测试失败

#### 常见测试错误

```bash
# 超时错误
Test timeout of 5000ms exceeded

# 数据库连接错误
connect ECONNREFUSED 127.0.0.1:5432

# 断言失败
Expected: "Open"
Received: "Closed"
```

#### 诊断和修复

```bash
# 调试特定测试
pnpm vitest run tests/unit/auth.test.ts --reporter=verbose

# 检查测试数据库配置
export TEST_DB_URL="postgresql://test:test@localhost:5432/nodra_test"

# 清理并重新运行测试
pnpm vitest run --run --reporter=verbose
```

---

## 部署问题

### 1. 生产环境启动失败

#### 问题现象

```bash
$ systemctl start nodra
Failed to start nodra.service: Unit nodra.service failed to load.
# 或
nodra.service: Main process exited, status=1/FAILURE
```

#### 诊断步骤

```bash
# 检查服务配置
systemctl cat nodra.service

# 检查权限
ls -la /opt/nodra/
ps aux | grep nodra

# 检查环境变量
systemctl show-environment nodra.service

# 查看详细错误
journalctl -u nodra -n 50 --no-pager
```

#### 解决方案

```ini
# 修复 systemd 服务配置
[Unit]
Description=Nodra Application Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=nodra
Group=nodra
WorkingDirectory=/opt/nodra/app
Environment=NODE_ENV=production
EnvironmentFile=/etc/environment.d/nodra
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=on-failure
RestartSec=10
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. 数据库连接失败

#### 问题现象

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
# 或
Error: password authentication failed for user 'nodra_app'
# 或
Error: database "nodra_production" does not exist
```

#### 诊断步骤

```bash
# 测试数据库连接
psql -U nodra_app -h localhost -p 5432 -d nodra_production

# 检查 PostgreSQL 状态
systemctl status postgresql
tail -f /var/log/postgresql/postgresql-*.log

# 检查用户和权限
sudo -u postgres psql -c "\du"
sudo -u postgres psql -c "\l"
```

#### 解决方案

```sql
-- 创建数据库用户
CREATE USER nodra_app WITH PASSWORD 'secure_password';
ALTER USER nodra_app CREATEDB;

-- 创建数据库
CREATE DATABASE nodra_production OWNER nodra_app;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE nodra_production TO nodra_app;

-- 修改 PostgreSQL 配置
# /etc/postgresql/15/main/pg_hba.conf
local   all             postgres                                peer
local   all             nodra_app                                md5
host    nodra_production  nodra_app   127.0.0.1/32   md5
```

### 3. Nginx 配置问题

#### 常见问题

```bash
# 502 Bad Gateway
# 504 Gateway Timeout
# SSL 证书错误
# 静态文件 404
```

#### 诊断步骤

```bash
# 测试 Nginx 配置
nginx -t

# 检查 Nginx 状态
systemctl status nginx
tail -f /var/log/nginx/error.log

# 测试上游服务器
curl http://localhost:8000/health

# 检查 SSL 证书
openssl x509 -in /etc/letsencrypt/live/myapp.example.com/cert.pem -text -noout
```

#### 解决方案

```nginx
# 修复 502 错误 - 确保上游服务器运行
upstream nodra_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    location /api/ {
        proxy_pass http://nodra_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# 修复 SSL 配置
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/myapp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myapp.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
}
```

---

## 数据库问题

### 1. 连接池耗尽

#### 问题现象

```bash
Error: sorry, too many clients already
# 或
Error: remaining connection slots are reserved for non-replication superuser connections
```

#### 诊断步骤

```sql
-- 查看当前连接
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- 查看连接统计
SELECT datname, numbackends, xact_commit, xact_rollback
FROM pg_stat_database;

-- 查看连接限制
SHOW max_connections;
SHOW shared_buffers;
SHOW work_mem;
```

#### 解决方案

```typescript
// 优化连接池配置
export default {
  db: {
    pool: {
      min: 5, // 最小连接数
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000, // 空闲超时
      connectionTimeoutMillis: 2000, // 连接超时
      reapIntervalMillis: 1000, // 清理间隔
      createTimeoutMillis: 30000, // 创建超时
    },
  },
};
```

### 2. 慢查询

#### 诊断步骤

```sql
-- 查找慢查询
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows
FROM pg_stat_statements
WHERE calls > 10
ORDER BY total_exec_time DESC
LIMIT 10;

-- 查看当前执行中的查询
SELECT
    pid,
    now() - query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- 查看表统计
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;
```

#### 优化方案

```sql
-- 创建必要的索引
CREATE INDEX CONCURRENTLY idx_tab_todo_modified
ON tab_todo (modified DESC);

CREATE INDEX CONCURRENTLY idx_tab_todo_owner_status
ON tab_todo (owner, status);

CREATE INDEX CONCURRENTLY idx_tab_user_email
ON tab_user (email);

-- 分析表统计信息
ANALYZE tab_todo;
ANALYZE tab_user;

-- 清理碎片化表
VACUUM (ANALYZE, VERBOSE) tab_todo;

-- 重新构建索引
REINDEX INDEX CONCURRENTLY idx_tab_todo_modified;
```

### 3. 锁等待和死锁

#### 诊断步骤

```sql
-- 查看锁等待
SELECT
    pid,
    granted,
    mode,
    relation::regclass
FROM pg_locks
WHERE NOT granted;

-- 查看当前锁
SELECT
    pg_class.relname AS table,
    pg_locks.locktype,
    pg_locks.mode,
    pg_locks.granted,
    pg_stat_activity.query
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid;

-- 查看死锁
SELECT * FROM pg_stat_activity
WHERE wait_event IS NOT NULL;
```

#### 解决方案

```typescript
// 优化事务处理
export default {
  db: {
    isolationLevel: 'READ_COMMITTED',
    statementTimeout: 30000,
    queryTimeout: 15000,
  },
};

// 在代码中避免长事务
await db.transaction(async (trx) => {
  // 分批处理大量数据
  for (const batch of chunks(data, 100)) {
    await trx.insert('Todo', batch);
  }
});
```

---

## 性能问题

### 1. 高内存使用

#### 诊断步骤

```bash
# 检查内存使用
free -h
ps aux --sort=-%mem | head -20

# Node.js 内存分析
node --inspect=0.0.0.0:9229 dist/index.js

# 堆快照
node --heap-prof dist/index.js

# 监控内存泄漏
while true; do
    ps aux | grep nodra | awk '{print $6}' | awk '{sum+=$1} END {print sum/1024 "MB"}'
    sleep 60
done
```

#### 解决方案

```typescript
// 配置内存限制
export default {
  maxOldSpaceSize: '1024', // MB
  maxSemiSpaceSize: '256', // MB

  // 启用垃圾回收日志
  gc: {
    mode: 'incremental',
    maxMarkSweepPause: 100,
  },
};
```

### 2. CPU 使用率过高

#### 诊断步骤

```bash
# CPU 监控
top -bn1 | grep nodra
htop -p $(pgrep nodra)

# Node.js CPU 分析
node --cpu-prof dist/index.js

# 查看事件循环延迟
node --trace-event-categories node.async_hooks dist/index.js
```

#### 解决方案

```typescript
// 优化事件循环
export default {
  server: {
    keepAliveTimeout: 5000,
    requestTimeout: 30000,
    bodyLimit: 1048576, // 1MB
  },
};

// 使用 Worker 线程
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

if (isMainThread) {
  // 创建 Worker 池
  const workers = [];
  for (let i = 0; i < os.cpus().length; i++) {
    workers.push(new Worker(__filename, { workerData: { workerId: i } }));
  }
}
```

### 3. 响应时间慢

#### 诊断步骤

```bash
# 响应时间测试
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/resource/Todo"

# curl-format.txt 内容：
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#          ----------:  %\n
#          time_total:  %{time_total}\n

# 使用 Apache Bench
ab -n 1000 -c 50 -t 30 http://localhost:3000/api/resource/Todo

# 使用 wrk
wrk -t12 -c400 -d30s --timeout 10s --latency \
  --script "scripts/post.lua" http://localhost:3000/api/resource/Todo
```

#### 优化方案

```typescript
// 启用缓存
export default {
  cache: {
    type: 'redis',
    ttl: 300, // 5 分钟
    maxSize: 1000,
  },

  // 数据库查询优化
  db: {
    queryTimeout: 5000,
    statementTimeout: 10000,

    // 查询缓存
    cache: {
      enabled: true,
      ttl: 60,
    },
  },
};

// 实现响应缓存
app.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/resource/') && request.method === 'GET') {
    const cacheKey = `api:${request.url}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      reply.header('X-Cache', 'HIT');
      return reply.send(JSON.parse(cached));
    }

    reply.header('X-Cache', 'MISS');
  }
});
```

---

## 认证和权限

### 1. JWT 令牌问题

#### 常见问题

```bash
# 令牌无效
Error: JsonWebTokenError: invalid signature

# 令牌过期
Error: TokenExpiredError: jwt expired

# 令牌格式错误
Error: JsonWebTokenError: jwt malformed
```

#### 诊断步骤

```bash
# 解码 JWT 令牌
node -e "
const jwt = require('jsonwebtoken');
const token = 'your.token.here';
const decoded = jwt.decode(token, {complete: true});
console.log(JSON.stringify(decoded, null, 2));
"

# 检查令牌有效性
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/method/get_logged_user
```

#### 解决方案

```typescript
// JWT 配置优化
export default {
  auth: {
    secret: process.env.JWT_SECRET!,
    tokenExpiry: '24h',
    refreshExpiry: '7d',

    // 令牌验证选项
    verify: {
      algorithms: ['HS256'],
      ignoreExpiration: false,
      ignoreNotBefore: false,
    },
  },
};

// 令牌刷新逻辑
app.post('/api/auth/refresh', async (request, reply) => {
  const { refreshToken } = request.body;

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newToken = generateAccessToken(decoded.user);

    return { token: newToken };
  } catch (error) {
    reply.code(401).send({ error: 'Invalid refresh token' });
  }
});
```

### 2. 权限检查失败

#### 诊断步骤

```sql
-- 检查用户权限
SELECT
    r.rolname as role,
    p.tablename as table,
    p.permtype as permission
FROM pg_roles r
JOIN pg_auth_members m ON r.oid = m.member
JOIN pg_auth_def p ON m.role = p.role
JOIN pg_class c ON p.objoid = c.oid
WHERE r.rolname = 'your_role';

-- 检查表权限
SELECT
    table_name,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE grantee = 'your_user';
```

#### 解决方案

```typescript
// 权限缓存优化
class PermissionCache {
  private cache = new Map<string, boolean>();
  private ttl = 1800; // 30 分钟

  async hasPermission(user: string, doctype: string, action: string): Promise<boolean> {
    const key = `${user}:${doctype}:${action}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const hasPermission = await this.checkPermission(user, doctype, action);
    this.cache.set(key, hasPermission);

    setTimeout(() => this.cache.delete(key), this.ttl * 1000);

    return hasPermission;
  }
}
```

---

## 文件上传问题

### 1. 上传失败

#### 常见错误

```bash
# 文件大小超限
Error: Request entity too large

# 文件类型不支持
Error: File type not allowed

# 磁盘空间不足
Error: ENOSPC: no space left on device

# 权限错误
Error: EACCES: permission denied
```

#### 诊断步骤

```bash
# 检查磁盘空间
df -h

# 检查权限
ls -la /opt/nodra/uploads/

# 检查 Nginx 配置
grep client_max_body_size /etc/nginx/sites-available/nodra

# 监控上传目录
inotifywait -m /opt/nodra/uploads/ -e create,modify,delete
```

#### 解决方案

```nginx
# Nginx 配置优化
server {
    client_max_body_size 100M;
    client_body_timeout 300s;
    client_header_timeout 300s;

    location /api/resource/*/attach {
        proxy_request_buffering off;
        proxy_max_temp_file_size 100M;
        proxy_max_temp_file_count 10;
    }
}
```

```typescript
// 文件上传验证
export default {
  files: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],

    // 文件扫描
    scan: {
      virus: true,
      content: true,
    },
  },
};
```

---

## WebSocket 连接问题

### 1. 连接失败

#### 诊断步骤

```bash
# 检查 WebSocket 端口
netstat -tlnp | grep :3000

# 使用 wscat 测试连接
wscat -c ws://localhost:3000/ws

# 检查防火墙
sudo ufw status | grep 3000

# 查看连接日志
tail -f /var/log/nodra/websocket.log
```

#### 解决方案

```typescript
// WebSocket 配置优化
export default {
  realtime: {
    port: 3000,
    maxConnections: 10000,

    // 心跳配置
    heartbeat: {
      interval: 30000, // 30 秒
      timeout: 5000, // 5 秒
    },

    // 代理配置
    proxy: {
      enabled: true,
      trust: true,
    },
  },
};
```

### 2. 连接断开频繁

#### 诊断步骤

```bash
# 监控连接数
watch -n 5 'curl -s http://localhost:3000/api/metrics | grep active_connections'

# 查看断开原因
grep -i "disconnect\|close\|error" /var/log/nodra/websocket.log | tail -20

# 检查负载均衡器
systemctl status nginx
```

#### 解决方案

```typescript
// 连接保活
class WebSocketServer {
  setupHeartbeat(ws) {
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('pong', () => {
      // 重置超时计时器
      clearTimeout(this.pongTimeout);
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      clearTimeout(this.pongTimeout);
    });
  }
}
```

---

## 作业队列问题

### 1. 作业堆积

#### 诊断步骤

```sql
-- 查看作业队列状态
SELECT
    job_id,
    job_type,
    status,
    attempts,
    created_at,
    scheduled_at,
    error_message
FROM nodra_job_queue
WHERE status IN ('queued', 'failed')
ORDER BY created_at ASC;

-- 查看统计信息
SELECT
    status,
    COUNT(*) as count
FROM nodra_job_queue
GROUP BY status;
```

#### 解决方案

```typescript
// 作业队列优化
export default {
  jobs: {
    concurrency: parseInt(process.env.JOB_CONCURRENCY || '10'),

    // 重试配置
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
      delay: 60000,
    },

    // 优先级处理
    priorities: {
      high: 10,
      normal: 5,
      low: 1,
    },
  },
};
```

---

## 内存泄漏

### 诊断步骤

```bash
# 使用 Chrome DevTools 内存分析
node --inspect=0.0.0.0:9229 --inspect-brk dist/index.js

# 使用 heapdump
npm install -g heapdump
kill -USR2 <nodra_pid>  # 生成堆快照

# 监控内存增长
while true; do
  ps aux | grep nodra | grep -v grep | awk '{print $6}'
  sleep 30
done
```

#### 内存分析代码

```typescript
// 内存监控中间件
app.addHook('preHandler', (request, reply) => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 500 * 1024 * 1024) {
    // 500MB
    console.warn('High memory usage detected:', {
      heap: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    });
  }
});

// 定期垃圾回收
setInterval(() => {
  if (global.gc) {
    global.gc();
    console.log('Forced garbage collection');
  }
}, 60000); // 每分钟
```

---

## 日志分析

### 日志模式识别

```bash
# 错误日志统计
grep -i "error" /var/log/nodra/app.log |
  awk '{print $1" "$2}' | sort | uniq -c | sort -nr

# 4xx 错误统计
grep "HTTP/1.[34].." /var/log/nginx/access.log |
  awk '{print $9}' | sort | uniq -c

# 响应时间分析
grep "200" /var/log/nginx/access.log |
  awk '{print $NF}' | sort -n | tail -100
```

### 实时监控脚本

```bash
#!/bin/bash
# monitor.sh - 实时系统监控

while true; do
  # 获取系统指标
  CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
  MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')
  DISK_USAGE=$(df / | tail -1 | awk '{print $5}')

  # 获取应用指标
  RESPONSE_TIME=$(curl -w "%{time_total}" -o /dev/null -s http://localhost:3000/health)
  ACTIVE_CONNECTIONS=$(curl -s http://localhost:3000/metrics | grep active_connections | awk '{print $2}')

  echo "$(date): CPU=${CPU_USAGE}%, MEM=${MEM_USAGE}, DISK=${DISK_USAGE}, RT=${RESPONSE_TIME}s, CONN=${ACTIVE_CONNECTIONS}"

  sleep 30
done
```

---

## 应急响应流程

### 生产环境故障响应

1. **立即评估** (5 分钟内)
   - 确定影响范围
   - 识别关键服务状态
   - 通知相关人员

2. **快速修复** (15 分钟内)
   - 重启失败的服务
   - 回滚最近的更改
   - 启用备份服务

3. **根因分析** (30 分钟内)
   - 分析日志和指标
   - 识别触发条件
   - 制定永久解决方案

4. **预防措施** (1 小时内)
   - 更新监控告警
   - 改进部署流程
   - 更新文档和培训

### 联系信息

| 问题类型 | 联系方式                 | 响应时间 |
| -------- | ------------------------ | -------- |
| 生产故障 | devops-alert@company.com | 15 分钟  |
| 安全事件 | security@company.com     | 5 分钟   |
| 性能问题 | performance@company.com  | 1 小时   |
| 数据丢失 | data-loss@company.com    | 立即     |

---

## 工具推荐

### 开发工具

```bash
# 性能分析
npm install -g 0x clinic

# 内存泄漏检测
npm install -g memwatch-next

# 依赖分析
npm install -g npm-check-updates

# 代码质量
npm install -g eslint prettier
```

### 运维工具

```bash
# 监控
npm install -g pm2
apt install -y htop iotop

# 日志分析
apt install -y goaccess logtail
pip install journalql

# 网络分析
apt install -y nmap netcat wireshark
```

### 数据库工具

```bash
# 性能分析
apt install -y pgbadger pgstat

# 监控
apt install -y pgbouncer pgpool-II

# 备份
apt install -n postgresql-client-common
```

---

_最后更新：2026-02-11_

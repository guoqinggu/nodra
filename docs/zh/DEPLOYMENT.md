# Nodra 部署指南

本指南提供 Nodra 应用在生产环境中的部署最佳实践，包括安全配置、性能优化和运维监控。

## 目录

- [环境准备](#环境准备)
- [配置管理](#配置管理)
- [数据库部署](#数据库部署)
- [应用部署](#应用部署)
- [负载均衡](#负载均衡)
- [安全配置](#安全配置)
- [性能优化](#性能优化)
- [监控和日志](#监控和日志)
- [备份策略](#备份策略)
- [故障排除](#故障排除)

---

## 环境准备

### 系统要求

#### 最低配置

| 组件       | 最低要求                  | 推荐配置         |
| ---------- | ------------------------- | ---------------- |
| CPU        | 2 核心                    | 4+ 核心          |
| 内存       | 4 GB RAM                  | 8+ GB RAM        |
| 存储       | 20 GB SSD                 | 50+ GB SSD       |
| 操作系统   | Ubuntu 20.04+ / CentOS 8+ | Ubuntu 22.04 LTS |
| Node.js    | 20.x LTS                  | 20.x LTS         |
| PostgreSQL | 15+                       | 15+              |

#### 推荐配置

| 组件   | 推荐配置         | 说明                   |
| ------ | ---------------- | ---------------------- |
| CPU    | 8+ 核心          | 支持并发请求处理       |
| 内存   | 16+ GB RAM       | 数据库缓存和应用缓存   |
| 存储   | 100+ GB NVMe SSD | 快速 I/O 性能          |
| 网络   | 1 Gbps           | 高速数据传输           |
| 数据库 | 独立服务器       | 分离数据库和应用服务器 |

### 系统依赖安装

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-contrib-15

# 安装 pnpm
npm install -g pnpm

# 安装必要工具
sudo apt install -y nginx redis-server certbot python3-certbot-nginx
```

---

## 配置管理

### 环境变量

生产环境应使用环境变量管理配置，避免硬编码敏感信息：

```bash
# /etc/environment.d/nodra
export NODE_ENV=production
export NODRA_SITE=myapp.example.com
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=nodra_production
export DB_USER=nodra_user
export DB_PASSWORD=your_secure_password
export JWT_SECRET=your_jwt_secret_key_256_bits
export REDIS_URL=redis://localhost:6379
export LOG_LEVEL=info
export MAX_WORKERS=4
export PORT=8000
```

### 生产配置文件

```typescript
// nodra.config.ts
import dotenv from 'dotenv';

dotenv.config();

export default {
  site: process.env.NODRA_SITE!,
  db: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: false,
          }
        : false,
  },
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '8000'),
    trustProxy: true,
  },
  auth: {
    secret: process.env.JWT_SECRET!,
    tokenExpiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    passwordHashRounds: 12,
  },
  redis: {
    url: process.env.REDIS_URL!,
    keyPrefix: 'nodra:',
    ttl: 3600,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    file: '/var/log/nodra/app.log',
    maxSize: '100MB',
    maxFiles: 10,
  },
  jobs: {
    concurrency: parseInt(process.env.JOB_CONCURRENCY || '10'),
    retryLimit: 3,
    retryDelay: 60000,
  },
};
```

---

## 数据库部署

### PostgreSQL 配置优化

```bash
# /etc/postgresql/15/main/postgresql.conf

# 内存配置
shared_buffers = 256MB                    # 25% of RAM
effective_cache_size = 1GB                  # 75% of RAM
work_mem = 4MB                            # Per connection
maintenance_work_mem = 64MB

# 连接配置
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# 检查点配置
checkpoint_completion_target = 0.9
wal_buffers = 16MB
checkpoint_segments = 32

# 日志配置
log_destination = 'csvlog'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### 数据库用户和安全

```sql
-- 创建专用数据库用户
CREATE USER nodra_app WITH PASSWORD 'secure_password';

-- 创建数据库
CREATE DATABASE nodra_production OWNER nodra_app;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE nodra_production TO nodra_app;

-- 连接到应用数据库
\c nodra_production;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### 数据库备份配置

```bash
# /etc/cron.d/nodra-backup
# 每日完整备份
0 2 * * * postgres pg_dump -U nodra_app -h localhost nodra_production | gzip > /backup/nodra/daily/nodra_$(date +\%Y\%m\%d).sql.gz

# 每小时增量备份
0 * * * * postgres pg_dump -U nodra_app -h localhost --schema-only nodra_production | gzip > /backup/nodra/hourly/nodra_$(date +\%Y\%m\%d_\%H).sql.gz

# 每周清理旧备份
0 3 * * 0 find /backup/nodra -name "*.sql.gz" -mtime +30 -delete
```

---

## 应用部署

### 构建应用

```bash
# 构建生产版本
pnpm build

# 创建部署目录结构
sudo mkdir -p /opt/nodra/{app,logs,uploads,temp}
sudo chown -R nodra:nodra /opt/nodra

# 复制构建文件
sudo cp -r dist/* /opt/nodra/app/
sudo cp package.json /opt/nodra/app/
sudo cp -r node_modules /opt/nodra/app/
```

### Systemd 服务配置

```ini
# /etc/systemd/system/nodra.service
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

[Install]
WantedBy=multi-user.target
```

```bash
# 启用和启动服务
sudo systemctl daemon-reload
sudo systemctl enable nodra
sudo systemctl start nodra

# 检查状态
sudo systemctl status nodra
sudo journalctl -u nodra -f
```

### 进程管理 (PM2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'nodra',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        MAX_WORKERS: 4,
      },
      error_file: '/var/log/nodra/pm2-error.log',
      out_file: '/var/log/nodra/pm2-out.log',
      log_file: '/var/log/nodra/pm2-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
```

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 负载均衡

### Nginx 配置

```nginx
# /etc/nginx/sites-available/nodra
upstream nodra_backend {
    least_conn;
    server 127.0.0.1:8000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8001 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8002 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8003 weight=1 max_fails=3 fail_timeout=30s;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name myapp.example.com www.myapp.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name myapp.example.com www.myapp.example.com;

    # SSL 配置
    ssl_certificate /etc/letsencrypt/live/myapp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myapp.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 限制请求大小
    client_max_body_size 50M;

    # 日志配置
    access_log /var/log/nginx/nodra_access.log;
    error_log /var/log/nginx/nodra_error.log;

    # API 路由
    location /api/ {
        proxy_pass http://nodra_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 静态文件缓存
    location /assets/ {
        alias /opt/nodra/app/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }

    # 文件上传
    location /api/resource/*/attach {
        proxy_pass http://nodra_backend;
        client_max_body_size 100M;
        proxy_request_buffering off;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://nodra_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 健康检查
    location /health {
        proxy_pass http://nodra_backend;
        access_log off;
    }
}
```

### SSL 证书配置

```bash
# 使用 Let's Encrypt 获取免费 SSL 证书
sudo certbot --nginx -d myapp.example.com -d www.myapp.example.com

# 自动续期
sudo crontab -e
# 添加以下行
0 3 * * * /usr/bin/certbot renew --quiet --nginx
```

---

## 安全配置

### 防火墙设置

```bash
# UFW 防火墙配置
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许 SSH
sudo ufw allow ssh

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 如果需要数据库远程访问（不推荐）
# sudo ufw allow 5432/tcp

# 检查状态
sudo ufw status
```

### 数据库安全

```sql
-- 限制连接
ALTER SYSTEM SET max_connections = 200;

-- 启用行级安全
ALTER SYSTEM SET row_security = on;

-- 审计日志
ALTER SYSTEM SET pgaudit.log = 'all';
ALTER SYSTEM SET pgaudit.log_catalog = on;
ALTER SYSTEM SET pgaudit.log_parameter = on;
ALTER SYSTEM SET pgaudit.log_statement = 'all';
```

### 应用安全配置

```typescript
// nodra.config.ts - 生产安全配置
export default {
  // ... 其他配置

  // 安全中间件
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 分钟
      max: 100, // 每个窗口最多 100 请求
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    },

    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },

    cors: {
      origin: ['https://myapp.example.com'],
      credentials: true,
      optionsSuccessStatus: 200,
    },
  },
};
```

---

## 性能优化

### 数据库优化

```sql
-- 创建必要索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tab_todo_modified ON tab_todo (modified DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tab_todo_owner_status ON tab_todo (owner, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tab_todo_title_gin ON tab_todo USING gin (title gin_trgm_ops);

-- 分析查询性能
SELECT * FROM pg_stat_statements WHERE calls > 100 ORDER BY total_exec_time DESC LIMIT 10;

-- 更新表统计信息
ANALYZE tab_todo;
ANALYZE tab_user;
ANALYZE tab_role;

-- 清理无用数据
VACUUM (ANALYZE, VERBOSE) tab_todo;
```

### 应用缓存配置

```typescript
// Redis 缓存配置
export default {
  cache: {
    // 会话缓存
    session: {
      ttl: 3600, // 1 小时
      prefix: 'session:',
    },

    // 查询缓存
    query: {
      ttl: 300, // 5 分钟
      prefix: 'query:',
      maxSize: 1000,
    },

    // 权限缓存
    permission: {
      ttl: 1800, // 30 分钟
      prefix: 'perm:',
    },

    // DocType 定义缓存
    doctype: {
      ttl: 86400, // 24 小时
      prefix: 'doctype:',
    },
  },
};
```

### 静态资源优化

```bash
# 构建时优化
# package.json
{
  "scripts": {
    "build": "npm run build:prod",
    "build:prod": "NODE_ENV=production tsup --minify --sourcemap",
    "optimize:assets": "npm run build && npm run compress:assets",
    "compress:assets": "find dist/public -name '*.js' -exec gzip -k {} \\; && find dist/public -name '*.css' -exec gzip -k {} \\;"
  }
}
```

---

## 监控和日志

### 应用监控

```typescript
// 健康检查端点
app.get('/health', async (request, reply) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,

    // 数据库连接状态
    database: {
      status: await checkDatabaseConnection(),
      latency: await measureDatabaseLatency(),
    },

    // 缓存状态
    cache: {
      status: await checkRedisConnection(),
      memory: await getRedisMemoryUsage(),
    },

    // 系统资源
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
    },
  };

  reply.code(200).send(health);
});

// 指标收集
app.get('/metrics', async (request, reply) => {
  const metrics = {
    http_requests_total: requestCounter.getValue(),
    http_request_duration_seconds: histogram.getValues(),
    active_connections: connectionCount.getValue(),
    database_connections: pool.totalCount,
    job_queue_size: await jobQueue.size(),
    cache_hit_rate: cache.getHitRate(),
  };

  reply.type('text/plain').send(formatPrometheusMetrics(metrics));
});
```

### 日志配置

```typescript
// 使用 Pino 日志库
import pino from 'pino';
import { writeFileSync } from 'fs';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // 生产环境 JSON 格式
  transport:
    process.env.NODE_ENV === 'production'
      ? {
          target: 'pino/file',
          options: {
            destination: '/var/log/nodra/app.log',
            mkdir: true,
          },
        }
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },

  // 序列化器
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,

    // 自定义序列化器
    user: (user) => ({
      email: user.email,
      role: user.role,
    }),
  },

  // 基础字段
  base: {
    pid: process.pid,
    hostname: require('os').hostname(),
    service: 'nodra',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
  },
});
```

### Logrotate 配置

```bash
# /etc/logrotate.d/nodra
/var/log/nodra/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nodra nodra
    postrotate
        systemctl reload nodra > /dev/null 2>&1 || true
    endscript
}
```

---

## 备份策略

### 数据备份

```bash
#!/bin/bash
# /opt/scripts/backup-nodra.sh

set -euo pipefail

BACKUP_DIR="/backup/nodra"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/hourly"

# 完整数据库备份
echo "Starting full database backup..."
pg_dump -U nodra_app -h localhost -Fc nodra_production | gzip > "$BACKUP_DIR/daily/nodra_full_$DATE.dump.gz"

# 上传到云存储
if command -v aws; then
    aws s3 cp "$BACKUP_DIR/daily/nodra_full_$DATE.dump.gz" "s3://my-backups/nodra/daily/"
fi

# 清理旧备份
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: nodra_full_$DATE.dump.gz"
```

### 应用配置备份

```bash
#!/bin/bash
# /opt/scripts/backup-config.sh

BACKUP_DIR="/backup/config"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份配置文件
tar -czf "$BACKUP_DIR/nodra_config_$DATE.tar.gz" \
    /opt/nodra/app/.env \
    /opt/nodra/app/nodra.config.ts \
    /etc/nginx/sites-available/nodra \
    /etc/systemd/system/nodra.service

# 备份 DocType 定义
tar -czf "$BACKUP_DIR/doctypes_$DATE.tar.gz" /opt/nodra/app/doctypes/

echo "Configuration backup completed"
```

### 恢复流程

```bash
#!/bin/bash
# /opt/scripts/restore-nodra.sh

BACKUP_FILE=$1
RESTORE_DIR="/tmp/nodra_restore"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# 创建恢复目录
mkdir -p "$RESTORE_DIR"

# 停止应用
systemctl stop nodra

# 恢复数据库
echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | pg_restore -U nodra_app -h localhost -d nodra_production -v

# 启动应用
systemctl start nodra

# 验证恢复
sleep 10
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "Restore completed successfully"
else
    echo "Restore failed - check logs"
    systemctl status nodra
fi

# 清理
rm -rf "$RESTORE_DIR"
```

---

## 故障排除

### 常见问题和解决方案

#### 1. 应用无法启动

```bash
# 检查服务状态
systemctl status nodra
journalctl -u nodra -n 50

# 检查端口占用
sudo netstat -tlnp | grep :8000

# 检查配置文件语法
node -c /opt/nodra/app/nodra.config.ts
```

#### 2. 数据库连接问题

```bash
# 测试数据库连接
psql -U nodra_app -h localhost -d nodra_production -c "SELECT version();"

# 检查 PostgreSQL 状态
systemctl status postgresql
tail -f /var/log/postgresql/postgresql-*.log

# 检查连接池
psql -U postgres -h localhost -d postgres -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

#### 3. 高内存使用

```bash
# 检查内存使用
free -h
ps aux --sort=-%mem | head -10

# 检查 Node.js 内存
node --inspect=0.0.0.0:9229 dist/index.js

# 监控内存泄漏
while true; do
    ps aux | grep nodra | awk '{print $6}' | awk '{sum+=$1} END {print sum/1024 "MB"}'
    sleep 10
done
```

#### 4. 性能问题诊断

```sql
-- 查找慢查询
SELECT query, calls, total_exec_time, mean_exec_time, stddev_exec_time
FROM pg_stat_statements
WHERE calls > 10
ORDER BY total_exec_time DESC
LIMIT 10;

-- 检查索引使用情况
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY correlation DESC;

-- 检查表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 紧急响应流程

```bash
#!/bin/bash
# /opt/scripts/emergency.sh

echo "🚨 Emergency response initiated"

# 1. 快速备份
echo "Creating emergency backup..."
/opt/scripts/backup-nodra.sh

# 2. 保存诊断信息
echo "Collecting diagnostics..."
mkdir -p /tmp/emergency/$(date +%Y%m%d_%H%M%S)

# 系统信息
uname -a > /tmp/emergency/$(date +%Y%m%d_%H%M%S)/system.txt
free -h >> /tmp/emergency/$(date +%Y%m%d_%H%M%S)/system.txt
df -h >> /tmp/emergency/$(date +%Y%m%d_%H%M%S)/system.txt

# 进程信息
ps aux > /tmp/emergency/$(date +%Y%m%d_%H%M%S)/processes.txt
systemctl status nodra > /tmp/emergency/$(date +%Y%m%d_%H%M%S)/services.txt

# 日志文件
tail -1000 /var/log/nodra/app.log > /tmp/emergency/$(date +%Y%m%d_%H%M%S)/nodra.log
journalctl -u nodra --since "1 hour ago" > /tmp/emergency/$(date +%Y%m%d_%H%M%S)/systemd.log

# 3. 重启服务
echo "Restarting services..."
systemctl restart postgresql
sleep 5
systemctl restart nodra
sleep 10

# 4. 验证服务
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Services recovered successfully"
else
    echo "❌ Service recovery failed - manual intervention required"
    systemctl status nodra
fi

echo "Emergency response completed"
```

---

## 部署清单

### 部署前检查清单

- [ ] 服务器满足最低硬件要求
- [ ] 操作系统和依赖已更新
- [ ] 防火墙规则已配置
- [ ] SSL 证书已获取并配置
- [ ] 数据库已创建和优化
- [ ] 环境变量已设置
- [ ] 备份策略已实施
- [ ] 监控系统已配置
- [ ] 日志轮转已配置

### 部署步骤清单

- [ ] 构建生产版本应用
- [ ] 上传应用文件到服务器
- [ ] 安装依赖和配置环境
- [ ] 配置和启动系统服务
- [ ] 配置 Nginx 反向代理
- [ ] 测试所有端点功能
- [ ] 验证 SSL 证书有效性
- [ ] 运行性能基准测试
- [ ] 设置监控告警

### 部署后验证清单

- [ ] 所有服务正常运行
- [ ] 健康检查端点响应正常
- [ ] 数据库连接和查询正常
- [ ] 日志记录正常工作
- [ ] 监控指标收集正常
- [ ] 备份流程执行成功
- [ ] 负载均衡分发正常
- [ ] 缓存系统工作正常

---

## 性能基准

### 预期性能指标

| 指标           | 目标值    | 说明             |
| -------------- | --------- | ---------------- |
| 响应时间 (95%) | < 200ms   | API 端点响应时间 |
| 数据库查询时间 | < 50ms    | 平均查询执行时间 |
| 并发连接数     | 100+      | 数据库连接池     |
| 内存使用率     | < 80%     | 应用服务器内存   |
| CPU 使用率     | < 70%     | 应用服务器 CPU   |
| 吞吐量         | 1000+ RPS | 每秒请求数       |

### 性能测试命令

```bash
# 使用 Apache Bench 进行负载测试
ab -n 10000 -c 100 http://localhost:8000/api/resource/Todo

# 使用 wrk 进行现代负载测试
wrk -t12 -c400 -d30s --timeout 10s --latency http://localhost:8000/api/resource/Todo

# 数据库性能测试
pgbench -i 100 -c 10 -j 2 -T 60 nodra_production
```

---

_最后更新：2026-02-11_

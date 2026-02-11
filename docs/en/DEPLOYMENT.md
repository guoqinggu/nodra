# Nodra Deployment Guide

This guide provides best practices for deploying Nodra applications in production environments, including security configuration, performance optimization, and operations monitoring.

## Table of Contents

- [Environment Preparation](#environment-preparation)
- [Configuration Management](#configuration-management)
- [Database Deployment](#database-deployment)
- [Application Deployment](#application-deployment)
- [Load Balancing](#load-balancing)
- [Security Configuration](#security-configuration)
- [Performance Optimization](#performance-optimization)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup Strategy](#backup-strategy)
- [Troubleshooting](#troubleshooting)

---

## Environment Preparation

### System Requirements

#### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+

#### Recommended Requirements

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: 1Gbps

### Dependencies

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15+
sudo apt-get install -y postgresql-15 postgresql-contrib

# pnpm
npm install -g pnpm

# Nginx (for reverse proxy)
sudo apt-get install -y nginx

# Redis (for caching and sessions)
sudo apt-get install -y redis-server
```

---

## Configuration Management

### Environment Variables

Create `.env.production`:

```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nodra_prod
DB_USER=nodra
DB_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_encryption_key_here

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# File Storage
UPLOAD_DIR=/var/nodra/files
MAX_FILE_SIZE=10485760

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/nodra/app.log
```

### Configuration Files

#### `config/production.json`

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "keepAliveTimeout": 65000,
    "bodyLimit": "10mb"
  },
  "database": {
    "host": "${DB_HOST}",
    "port": "${DB_PORT}",
    "name": "${DB_NAME}",
    "user": "${DB_USER}",
    "password": "${DB_PASSWORD}",
    "pool": {
      "min": 2,
      "max": 10,
      "idleTimeoutMillis": 30000
    }
  },
  "redis": {
    "host": "${REDIS_HOST}",
    "port": "${REDIS_PORT}",
    "password": "${REDIS_PASSWORD}",
    "db": 0
  },
  "auth": {
    "jwtSecret": "${JWT_SECRET}",
    "sessionTimeout": 86400,
    "maxLoginAttempts": 5,
    "lockoutDuration": 900
  },
  "files": {
    "uploadDir": "${UPLOAD_DIR}",
    "maxFileSize": "${MAX_FILE_SIZE}",
    "allowedTypes": ["image/*", "application/pdf", "text/*"]
  },
  "email": {
    "smtp": {
      "host": "${SMTP_HOST}",
      "port": "${SMTP_PORT}",
      "secure": false,
      "auth": {
        "user": "${SMTP_USER}",
        "pass": "${SMTP_PASSWORD}"
      }
    }
  }
}
```

---

## Database Deployment

### PostgreSQL Setup

#### Create Database and User

```sql
-- Create database
CREATE DATABASE nodra_prod;

-- Create user
CREATE USER nodra WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE nodra_prod TO nodra;

-- Connect to database and grant schema privileges
\c nodra_prod;
GRANT ALL ON SCHEMA public TO nodra;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nodra;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nodra;
```

#### PostgreSQL Configuration

Edit `/etc/postgresql/15/main/postgresql.conf`:

```ini
# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 100
listen_addresses = 'localhost'

# Performance settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

Edit `/etc/postgresql/15/main/pg_hba.conf`:

```ini
# Local connections
local   all             postgres                                peer
local   all             nodra                                   md5

# IPv4 local connections
host    all             nodra           127.0.0.1/32            md5

# IPv6 local connections
host    all             nodra           ::1/128                 md5
```

### Database Optimization

#### Create Indexes

```sql
-- Standard indexes (automatically created by Nodra)
-- Additional indexes for your specific queries

-- Example: Index for frequently queried fields
CREATE INDEX CONCURRENTLY idx_tab_customer_email ON tab_customer(email);
CREATE INDEX CONCURRENTLY idx_tab_customer_status ON tab_customer(status);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_tab_todo_status_priority ON tab_todo(status, priority DESC);
```

#### Partitioning (for large tables)

```sql
-- Example: Partition logs table by date
CREATE TABLE tab_system_log (
    LIKE tab_system_log INCLUDING ALL
) PARTITION BY RANGE (creation);

CREATE TABLE tab_system_log_2024_01 PARTITION OF tab_system_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE tab_system_log_2024_02 PARTITION OF tab_system_log
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

---

## Application Deployment

### Build Process

```bash
# Clone repository
git clone https://github.com/your-org/nodra-app.git
cd nodra-app

# Install dependencies
pnpm install

# Build application
pnpm build

# Run database migrations
pnpm db:migrate

# Create admin user
pnpm create-admin
```

### Process Management with PM2

Install PM2:

```bash
npm install -g pm2
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'nodra',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/nodra/pm2-error.log',
      out_file: '/var/log/nodra/pm2-out.log',
      log_file: '/var/log/nodra/pm2-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
    },
  ],
};
```

Start application:

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Directory Structure

```bash
/var/nodra/
├── app/                 # Application code
├── files/               # User uploads
├── logs/                # Application logs
├── backups/             # Database backups
└── config/              # Configuration files
```

Set permissions:

```bash
sudo mkdir -p /var/nodra/{app,files,logs,backups,config}
sudo chown -R nodra:nodra /var/nodra
chmod 755 /var/nodra/files
chmod 700 /var/nodra/config
```

---

## Load Balancing

### Nginx Configuration

Create `/etc/nginx/sites-available/nodra`:

```nginx
upstream nodra_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Static files
    location /files/ {
        alias /var/nodra/files/;
        expires 1y;
        add_header Cache-Control "public, immutable";

        # Security for file uploads
        location ~* \.(php|jsp|asp|sh|py)$ {
            deny all;
        }
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://nodra_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Login endpoint with stricter rate limiting
    location /api/method/login {
        limit_req zone=login burst=5 nodelay;

        proxy_pass http://nodra_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://nodra_backend;
        access_log off;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/nodra /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Security Configuration

### SSL/TLS Setup

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow PostgreSQL from application server only
sudo ufw allow from 127.0.0.1 to any port 5432

# Check status
sudo ufw status
```

### Security Hardening

#### Kernel Parameters

Add to `/etc/sysctl.conf`:

```ini
# Network security
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# SYN cookies protection
net.ipv4.tcp_syncookies = 1

# Log martian packets
net.ipv4.conf.all.log_martians = 1
```

Apply settings:

```bash
sudo sysctl -p
```

---

## Performance Optimization

### Application Performance

#### Connection Pooling

```javascript
// config/production.json
{
  "database": {
    "pool": {
      "min": 5,
      "max": 20,
      "acquireTimeoutMillis": 30000,
      "createTimeoutMillis": 30000,
      "destroyTimeoutMillis": 5000,
      "idleTimeoutMillis": 30000,
      "reapIntervalMillis": 1000,
      "createRetryIntervalMillis": 100
    }
  }
}
```

#### Caching Strategy

```javascript
// Redis caching configuration
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "db": 0,
    "keyPrefix": "nodra:",
    "ttl": 3600 // 1 hour default TTL
  },
  "cache": {
    "enabled": true,
    "strategies": {
      "user_sessions": { ttl: 86400 }, // 24 hours
      "doctype_metadata": { ttl: 3600 }, // 1 hour
      "user_permissions": { ttl: 1800 }, // 30 minutes
      "api_responses": { ttl: 300 } // 5 minutes
    }
  }
}
```

### Database Performance

#### Query Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM tab_todo WHERE status = 'Open';

-- Update table statistics
ANALYZE tab_todo;

-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### Connection Limits

```sql
-- Set connection limits per user
ALTER USER nodra CONNECTION LIMIT 50;

-- Monitor connections
SELECT * FROM pg_stat_activity WHERE datname = 'nodra_prod';
```

---

## Monitoring and Logging

### Application Monitoring

#### Health Check Endpoint

```javascript
// src/routes/health.ts
export async function healthCheck(req, reply) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  };

  reply.send(health);
}
```

#### Metrics Collection

```javascript
// Prometheus metrics
import client from 'prom-client';

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});
```

### Log Management

#### Structured Logging

```javascript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: '/var/log/nodra/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: '/var/log/nodra/combined.log',
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}
```

### System Monitoring

#### Setup Monitoring Stack

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - '9090:9090'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - '3001:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

---

## Backup Strategy

### Database Backups

#### Automated Backups

```bash
#!/bin/bash
# /usr/local/bin/backup-nodra.sh

BACKUP_DIR="/var/nodra/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="nodra_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U nodra -d $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# File backup
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz /var/nodra/files/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://your-backup-bucket/
```

Make executable and setup cron:

```bash
sudo chmod +x /usr/local/bin/backup-nodra.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-nodra.sh
```

#### Point-in-Time Recovery

```sql
-- Enable WAL archiving
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/nodra/backups/wal/%f'
```

---

## Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check logs
pm2 logs nodra

# Check configuration
node -c config/production.json

# Check database connection
psql -h localhost -U nodra -d nodra_prod -c "SELECT 1;"
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection count
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql -U postgres -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"
```

#### Performance Issues

```bash
# Check system resources
top
htop
iotop

# Check Nginx status
sudo nginx -t
sudo systemctl status nginx

# Check PM2 status
pm2 status
pm2 monit
```

### Log Analysis

#### Search Error Logs

```bash
# Search for errors in last hour
sudo journalctl -u nodra --since "1 hour ago" | grep ERROR

# Search for slow queries
sudo grep "slow query" /var/log/postgresql/postgresql-15-main.log

# Analyze Nginx access logs
sudo tail -f /var/log/nginx/access.log | grep -v "200\|301\|302"
```

### Performance Debugging

#### Node.js Profiling

```bash
# Generate CPU profile
node --prof dist/server.js

# Analyze profile
node --prof-process isolate-*.log > processed.txt
```

#### Database Profiling

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries >100ms
SELECT pg_reload_conf();

-- Check table bloat
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_stat_get_last_vacuum_time(c.oid) as last_vacuum
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relkind = 'r'
AND n.nspname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Emergency Procedures

### Database Recovery

```bash
# Restore from backup
gunzip -c /var/nodra/backups/db_backup_20240201_020000.sql.gz | psql -h localhost -U nodra -d nodra_prod

# Point-in-time recovery
pg_basebackup -h localhost -D /var/nodra/backups/base_backup -U nodra -v -P -W
```

### Application Rollback

```bash
# Rollback to previous version
git checkout <previous-commit-tag>
pnpm install
pnpm build
pm2 reload nodra
```

### Security Incident Response

1. **Isolate**: Block suspicious IPs
2. **Analyze**: Review logs for breach scope
3. **Patch**: Update vulnerable dependencies
4. **Rotate**: Change all secrets and passwords
5. **Monitor**: Increase monitoring frequency

---

This deployment guide provides a comprehensive foundation for running Nodra applications in production. Adjust configurations based on your specific requirements and infrastructure.

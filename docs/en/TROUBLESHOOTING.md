# Nodra Troubleshooting Guide

This guide provides diagnosis and solutions for common issues encountered during Nodra application development, deployment, and operations.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Development Environment Issues](#development-environment-issues)
- [Deployment Issues](#deployment-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [Authentication and Permissions](#authentication-and-permissions)
- [File Upload Issues](#file-upload-issues)
- [WebSocket Connection Issues](#websocket-connection-issues)
- [Job Queue Issues](#job-queue-issues)
- [Memory Leaks](#memory-leaks)
- [Log Analysis](#log-analysis)

---

## Quick Diagnosis

### Health Check Checklist

```bash
# 1. Application status
curl -f http://localhost:3000/health || echo "Application health check failed"

# 2. Database connectivity
psql -h localhost -U nodra -d nodra_prod -c "SELECT 1;" || echo "Database connection failed"

# 3. Redis connectivity
redis-cli ping || echo "Redis connection failed"

# 4. File system permissions
ls -la /var/nodra/files/ || echo "File directory check failed"

# 5. System resources
free -h && df -h && uptime
```

### Quick Log Scan

```bash
# Application errors (last 100 lines)
tail -n 100 /var/log/nodra/app.log | grep -i error

# Database errors
sudo tail -n 50 /var/log/postgresql/postgresql-15-main.log | grep -i error

# Nginx errors
sudo tail -n 50 /var/log/nginx/error.log

# System logs for critical issues
sudo journalctl -u nodra --since "1 hour ago" -p err
```

---

## Development Environment Issues

### Node.js Version Compatibility

**Problem**: Application fails to start due to Node.js version mismatch

```bash
# Check current Node.js version
node --version

# Expected: v20.x or higher
# If version is lower:
nvm install 20
nvm use 20
```

### Dependency Installation Issues

**Problem**: `pnpm install` fails with permission errors

```bash
# Clear pnpm cache
pnpm store prune

# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# If permission issues persist:
sudo chown -R $(whoami) ~/.pnpm-store
```

### TypeScript Compilation Errors

**Problem**: `tsc` or `pnpm build` fails with TypeScript errors

```bash
# Check TypeScript configuration
npx tsc --noEmit --project tsconfig.json

# Clear build cache
rm -rf dist/
pnpm build

# Common fixes:
# 1. Update @types packages
# 2. Check tsconfig.json paths
# 3. Verify import/export syntax
```

### Hot Reload Not Working

**Problem**: Changes not reflected during development

```bash
# Check if development server is running
ps aux | grep "nodra dev"

# Restart development server
pnpm dev

# Check file watchers
lsof | grep node | grep WATCH
```

---

## Deployment Issues

### Application Won't Start

**Problem**: PM2 reports application as "errored" or "stopped"

```bash
# Check PM2 status
pm2 status
pm2 logs nodra --lines 50

# Check configuration
node -c config/production.json

# Common causes and solutions:

# 1. Port already in use
sudo netstat -tulpn | grep :3000
# Kill process or change port

# 2. Environment variables missing
printenv | grep -E "(DB_|REDIS_|JWT_)"
# Check .env file

# 3. File permissions
ls -la /var/nodra/
sudo chown -R nodra:nodra /var/nodra

# 4. Database connection failure
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

### SSL Certificate Issues

**Problem**: HTTPS not working or certificate errors

```bash
# Check certificate status
sudo certbot certificates

# Test certificate renewal
sudo certbot renew --dry-run

# Check Nginx SSL configuration
sudo nginx -t
sudo grep -A 10 -B 5 ssl_certificate /etc/nginx/sites-available/nodra

# Common fixes:
# 1. Renew certificate
sudo certbot renew

# 2. Check domain DNS records
nslookup your-domain.com

# 3. Verify firewall ports 80/443 are open
sudo ufw status
```

### Nginx Reverse Proxy Issues

**Problem**: 502 Bad Gateway or connection timeouts

```bash
# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Check upstream server connectivity
curl -I http://localhost:3000/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Common fixes:
# 1. Restart upstream application
pm2 restart nodra

# 2. Check upstream server configuration
grep upstream /etc/nginx/sites-available/nodra

# 3. Adjust timeout values
# Add to nginx config:
# proxy_connect_timeout 60s;
# proxy_send_timeout 60s;
# proxy_read_timeout 60s;
```

---

## Database Issues

### Connection Refused

**Problem**: Application cannot connect to PostgreSQL

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if service is running on correct port
sudo netstat -tulpn | grep :5432

# Test connection manually
psql -h localhost -U nodra -d nodra_prod

# Common fixes:

# 1. Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 2. Check postgresql.conf
sudo grep "listen_addresses" /etc/postgresql/15/main/postgresql.conf
# Should be: listen_addresses = 'localhost'

# 3. Check pg_hba.conf authentication
sudo grep "host.*nodra" /etc/postgresql/15/main/pg_hba.conf

# 4. Reset user password
sudo -u postgres psql -c "ALTER USER nodra PASSWORD 'new_password';"
```

### Slow Queries

**Problem**: Application performance degraded due to slow database queries

```bash
# Enable query logging temporarily
sudo -u postgres psql -c "ALTER SYSTEM SET log_min_duration_statement = 100;"
sudo -u postgres psql -c "SELECT pg_reload_conf();"

# Monitor slow queries
sudo tail -f /var/log/postgresql/postgresql-15-main.log | grep "duration:"

# Analyze query performance
sudo -u postgres psql -d nodra_prod -c "
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;"

# Common fixes:

# 1. Update table statistics
sudo -u postgres psql -d nodra_prod -c "ANALYZE;"

# 2. Rebuild indexes
sudo -u postgres psql -d nodra_prod -c "REINDEX DATABASE nodra_prod;"

# 3. Check for missing indexes
sudo -u postgres psql -d nodra_prod -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'tab_todo'
ORDER BY n_distinct DESC;"
```

### Database Lock Contention

**Problem**: Transactions blocking each other

```bash
# Check current locks
sudo -u postgres psql -d nodra_prod -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;"

# Kill blocking session (use with caution)
# sudo -u postgres psql -c "SELECT pg_terminate_backend(PID);"

# Common fixes:
# 1. Optimize long-running transactions
# 2. Use proper transaction isolation levels
# 3. Implement connection pooling
```

### Disk Space Issues

**Problem**: Database disk space full

```bash
# Check database size
sudo -u postgres psql -d nodra_prod -c "
SELECT pg_size_pretty(pg_database_size('nodra_prod')) as db_size,
       pg_size_pretty(pg_database_size('nodra_prod') - pg_database_size('nodra_prod_template')) as data_size;"

# Check table sizes
sudo -u postgres psql -d nodra_prod -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;"

# Clean up old data
sudo -u postgres psql -d nodra_prod -c "VACUUM FULL;"
```

---

## Performance Issues

### High CPU Usage

**Problem**: Application consuming excessive CPU

```bash
# Check CPU usage
top -p $(pgrep -f "node.*nodra")

# Profile Node.js application
pm2 monit

# Generate CPU profile
node --prof dist/server.js
# Let it run for 30 seconds, then:
node --prof-process isolate-*.log > cpu-profile.txt

# Common fixes:

# 1. Optimize database queries
# 2. Implement caching
# 3. Use clustering (already configured in PM2)
# 4. Optimize JavaScript code (avoid busy loops)
```

### High Memory Usage

**Problem**: Application memory usage grows continuously

```bash
# Check memory usage
free -h
ps aux | grep "node.*nodra" | awk '{print $4, $11}'

# Monitor memory growth
watch -n 5 'ps aux | grep "node.*nodra" | grep -v grep'

# Generate heap snapshot
node --inspect dist/server.js
# Then use Chrome DevTools to analyze

# Common fixes:

# 1. Check for memory leaks
node --inspect --trace-warnings dist/server.js

# 2. Optimize connection pools
# Reduce max connections in database config

# 3. Enable garbage collection tuning
node --max-old-space-size=1024 dist/server.js

# 4. Monitor with PM2
pm2 install pm2-node-monit
```

### Slow Response Times

**Problem**: API endpoints responding slowly

```bash
# Test response times
curl -w "@curl-format.txt" http://localhost:3000/api/resource/Todo

# Where curl-format.txt contains:
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#                      ----------\n
#           time_total:  %{time_total}\n

# Check database query times
sudo tail -f /var/log/postgresql/postgresql-15-main.log | grep "duration:"

# Common fixes:

# 1. Add database indexes
# 2. Implement Redis caching
# 3. Optimize Nginx configuration
# 4. Enable compression
```

---

## Authentication and Permissions

### Login Failures

**Problem**: Users cannot login or get invalid credentials error

```bash
# Check user account in database
psql -U nodra -d nodra_prod -c "SELECT name, email, enabled FROM tab_user WHERE email = 'user@example.com';"

# Check password hash format
psql -U nodra -d nodra_prod -c "SELECT name, password FROM tab_user WHERE email = 'user@example.com';"

# Test login API manually
curl -X POST http://localhost:3000/api/method/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Common fixes:

# 1. Reset user password
psql -U nodra -d nodra_prod -c "UPDATE tab_user SET password = '$2a$10$...' WHERE email = 'user@example.com';"

# 2. Check user role and permissions
psql -U nodra -d nodra_prod -c "SELECT * FROM tab_has_role WHERE parent = 'user@example.com';"

# 3. Verify JWT secret
printenv | grep JWT_SECRET
```

### Permission Denied Errors

**Problem**: Users get permission denied when accessing resources

```bash
# Check user permissions
psql -U nodra -d nodra_prod -c "
SELECT u.name, r.role, p.perm_type, p.document_type
FROM tab_user u
JOIN tab_has_role hr ON u.name = hr.parent
JOIN tab_role r ON hr.role = r.name
LEFT JOIN tab_user_permission p ON r.name = p.parent
WHERE u.email = 'user@example.com';"

# Check DocType permissions
psql -U nodra -d nodra_prod -c "SELECT * FROM tab_doc_perm WHERE parent = 'Todo';"

# Common fixes:

# 1. Grant necessary permissions
INSERT INTO tab_has_role (parent, role) VALUES ('user@example.com', 'System Manager');

# 2. Update DocType permissions
UPDATE tab_doc_perm SET read = 1 WHERE parent = 'Todo' AND role = 'System Manager';
```

### JWT Token Issues

**Problem**: Authentication tokens invalid or expired

```bash
# Check JWT secret
printenv | grep JWT_SECRET

# Decode JWT token (for debugging)
echo "your.jwt.token" | cut -d. -f2 | base64 -d | jq .

# Common fixes:

# 1. Ensure JWT_SECRET is set and consistent across all instances
# 2. Check token expiration time
# 3. Verify token format in Authorization header
```

---

## File Upload Issues

### File Upload Fails

**Problem**: File uploads return error or don't complete

```bash
# Check upload directory permissions
ls -la /var/nodra/files/
sudo chown -R nodra:nodra /var/nodra/files/
chmod 755 /var/nodra/files/

# Check disk space
df -h /var/nodra/files/

# Check Nginx configuration for file size limits
grep client_max_body_size /etc/nginx/sites-available/nodra

# Common fixes:

# 1. Increase file size limits
# Add to nginx config: client_max_body_size 100M;

# 2. Check file type restrictions
grep allowedTypes config/production.json

# 3. Verify temporary directory permissions
ls -la /tmp/
```

### File Not Accessible After Upload

**Problem**: Uploaded files return 404 or access denied

```bash
# Check if file exists
ls -la /var/nodra/files/$(date +%Y/%m/%d)/

# Check Nginx static file configuration
grep -A 10 "/files/" /etc/nginx/sites-available/nodra

# Test file access directly
curl -I http://localhost/files/your-file-name

# Common fixes:

# 1. Fix file permissions
find /var/nodra/files/ -type f -exec chmod 644 {} \;
find /var/nodra/files/ -type d -exec chmod 755 {} \;

# 2. Update Nginx configuration
# Ensure proper alias and directory structure

# 3. Check file path in database
psql -U nodra -d nodra_prod -c "SELECT name, file_url FROM tab_file WHERE name = 'your-file-name';"
```

---

## WebSocket Connection Issues

### Connection Fails

**Problem**: WebSocket connections not establishing

```bash
# Check if WebSocket server is running
netstat -tulpn | grep :3000

# Test WebSocket connection
wscat -c ws://localhost:3000/socket.io/

# Check firewall rules
sudo ufw status | grep 3000

# Common fixes:

# 1. Ensure WebSocket support in Nginx
# Add to nginx config:
# proxy_http_version 1.1;
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";

# 2. Check Redis configuration (for Socket.IO scaling)
redis-cli ping

# 3. Verify CORS settings
grep cors config/production.json
```

### Connection Drops Frequently

**Problem**: WebSocket connections disconnect frequently

```bash
# Check keepalive settings
grep keepAliveTimeout config/production.json

# Monitor connection drops
pm2 logs nodra | grep -i disconnect

# Common fixes:

# 1. Increase timeout values
# Set keepAliveTimeout to 65000 in config

# 2. Check proxy timeout settings
# In nginx config: proxy_read_timeout 86400;

# 3. Implement reconnection logic in client
```

---

## Job Queue Issues

### Jobs Not Processing

**Problem**: Background jobs stuck in queue

```bash
# Check job queue status
psql -U nodra -d nodra_prod -c "SELECT status, COUNT(*) FROM tab_background_job GROUP BY status;"

# Check failed jobs
psql -U nodra -d nodra_prod -c "SELECT name, method, status, error_message FROM tab_background_job WHERE status = 'Failed' ORDER BY creation DESC LIMIT 10;"

# Check if job processor is running
ps aux | grep "job.*processor"

# Common fixes:

# 1. Restart job processor
pm2 restart nodra-job-processor

# 2. Check Redis connection
redis-cli keys "job:*"

# 3. Clear stuck jobs
psql -U nodra -d nodra_prod -c "UPDATE tab_background_job SET status = 'Cancelled' WHERE status = 'In Progress' AND creation < NOW() - INTERVAL '1 hour';"
```

### Jobs Failing Repeatedly

**Problem**: Background jobs failing with errors

```bash
# Check error logs
pm2 logs nodra-job-processor | grep -i error

# Check specific job details
psql -U nodra -d nodra_prod -c "SELECT * FROM tab_background_job WHERE name = 'job-name';"

# Test job method manually
curl -X POST http://localhost:3000/api/method/your.method \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"arg1": "value1"}'

# Common fixes:

# 1. Fix method implementation
# 2. Update job parameters
# 3. Check dependencies
```

---

## Memory Leaks

### Detecting Memory Leaks

**Problem**: Memory usage increases over time

```bash
# Monitor memory usage over time
watch -n 60 'ps aux | grep "node.*nodra" | grep -v grep | awk "{print $4, $6}"'

# Generate heap snapshots
node --inspect --heap-prof dist/server.js

# Use clinic.js for detailed analysis
npm install -g clinic
clinic doctor -- node dist/server.js
clinic flame -- node dist/server.js

# Common sources of memory leaks:

# 1. Event listeners not removed
# 2. Cached objects growing indefinitely
# 3. Database connections not closed
# 4. Timer/interval not cleared
```

### Fixing Memory Leaks

**Problem**: Identified memory leak needs fixing

```javascript
// Example fixes:

// 1. Remove event listeners
element.removeEventListener('event', handler);

// 2. Clear intervals
clearInterval(intervalId);

// 3. Close database connections
await connection.close();

// 4. Limit cache size
const cache = new Map();
const MAX_CACHE_SIZE = 1000;
if (cache.size > MAX_CACHE_SIZE) {
  const firstKey = cache.keys().next().value;
  cache.delete(firstKey);
}
```

---

## Log Analysis

### Centralized Logging

**Problem**: Logs scattered across multiple files and services

```bash
# Setup log aggregation with ELK stack or similar
# Example with journalctl:

# Application logs
journalctl -u nodra -f

# System logs
journalctl -f

# Database logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log &
sudo tail -f /var/log/nginx/error.log &
```

### Pattern Analysis

**Problem**: Need to identify common error patterns

```bash
# Find most frequent errors
grep -i error /var/log/nodra/app.log | sort | uniq -c | sort -nr | head -10

# Find slow requests
grep "duration" /var/log/nodra/app.log | awk '{print $NF}' | sort -nr | head -10

# Find failed login attempts
grep "login.*failed" /var/log/nodra/app.log | awk '{print $1, $2}' | sort | uniq -c

# Monitor real-time errors
tail -f /var/log/nodra/app.log | grep -i --color=always error
```

### Performance Logging

**Problem**: Need to identify performance bottlenecks

```bash
# Extract response times from logs
grep "response_time" /var/log/nodra/app.log | awk '{print $NF}' | sort -n

# Find API endpoints with highest error rates
grep "POST\|GET\|PUT\|DELETE" /var/log/nodra/app.log | grep -i error | awk '{print $4}' | sort | uniq -c | sort -nr

# Database query analysis
grep "query.*duration" /var/log/postgresql/postgresql-15-main.log | awk '{print $NF}' | sort -nr | head -10
```

---

## Emergency Procedures

### Application Crashes

**Problem**: Application crashes and won't restart

```bash
# Immediate recovery
pm2 restart nodra

# If restart fails:
pm2 delete nodra
pm2 start ecosystem.config.js

# Check for root cause
pm2 logs nodra --lines 100

# Rollback to previous version if needed
git checkout <previous-commit-tag>
pnpm build
pm2 restart nodra
```

### Database Corruption

**Problem**: Database corrupted or inconsistent

```bash
# Check database consistency
sudo -u postgres pg_dump nodra_prod > /tmp/check.sql
# If no errors, database is likely consistent

# Emergency restore
sudo systemctl stop postgresql
sudo -u postgres pg_dump nodra_prod > /tmp/emergency_backup.sql
# Restore from last known good backup
```

### Security Incident

**Problem**: Security breach detected

```bash
# Immediate containment
# 1. Block suspicious IPs
sudo ufw deny from <IP>

# 2. Rotate all secrets
# Change JWT_SECRET, DB_PASSWORD, REDIS_PASSWORD

# 3. Force logout all users
pm2 restart nodra

# 4. Enable detailed logging
# Set LOG_LEVEL to debug

# 5. Audit user accounts
psql -U nodra -d nodra_prod -c "SELECT name, email, last_login FROM tab_user WHERE last_login > NOW() - INTERVAL '24 hours';"
```

---

This troubleshooting guide covers the most common issues you may encounter with Nodra. For additional help, refer to the [Deployment Guide](DEPLOYMENT.md) or [API Reference](API_REFERENCE.md).

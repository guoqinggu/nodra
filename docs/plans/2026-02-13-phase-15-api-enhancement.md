# 阶段 15：API 层增强 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现方法端点路由（Method Routes）和 API Key 认证系统，使 Desk 前端可以调用服务器端业务逻辑，并支持第三方集成。

**Architecture:**

- 方法端点采用白名单机制，通过 `POST /api/method/{path}` 调用注册的方法
- API Key 使用 key:secret 对，采用 Argon2 哈希存储，支持作用域控制和轮换
- 两个模块都遵循现有的错误处理模式和权限检查机制

**Tech Stack:** Fastify 5.x, TypeScript 5.x (strict), Argon2, Vitest for testing

---

## 前置检查

**Step 1: 确认工作目录和分支**

```bash
pwd
# Expected: /home/sam/nodra or worktree path
git status
# Expected: On feature/phase-15-api-enhancement branch or main
```

**Step 2: 运行现有测试确认基线**

```bash
pnpm test 2>&1 | tail -20
# Expected: 52 passed, 8 failed (the ones we're about to fix)
```

---

## 第一部分：方法端点路由 (src/api/method.ts)

### Task 1: 创建 MethodRegistry 类型定义和接口

**Files:**

- Create: `src/api/method.ts` (initial structure)
- Test: Already exists at `tests/unit/api/method.test.ts`

**Step 1: 创建文件骨架和类型定义**

Create `src/api/method.ts`:

```typescript
/**
 * Method Routes - Whitelisted API Method Endpoints
 *
 * Allows calling registered server-side functions via POST /api/method/{path}
 * Used by Desk frontend to execute business logic.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserContext } from '../permissions/permission.js';
import { AuthenticationError, PermissionError } from '../core/errors.js';

/**
 * Method definition structure
 */
export interface MethodDefinition {
  /** The handler function */
  handler: (...args: unknown[]) => unknown;
  /** Whether authentication is required */
  requireAuth: boolean;
  /** Required roles to access this method */
  requiredRoles: string[];
}

/**
 * Method registry interface
 */
export interface MethodRegistry {
  /** Register a method */
  register(
    path: string,
    handler: (...args: unknown[]) => unknown,
    options?: { requireAuth?: boolean; requiredRoles?: string[] },
  ): void;
  /** Get method definition */
  get(path: string): MethodDefinition | undefined;
  /** Check if method exists */
  has(path: string): boolean;
}
```

**Step 2: 验证类型检查通过**

```bash
pnpm typecheck 2>&1 | grep -A2 "method.ts" || echo "No errors for method.ts"
# Expected: No type errors for method.ts
```

**Step 3: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): add MethodRegistry type definitions for method routes"
```

---

### Task 2: 实现 MethodRegistry 类

**Files:**

- Modify: `src/api/method.ts` (add class implementation)

**Step 1: 添加 MethodRegistry 类实现**

Add to `src/api/method.ts` after the interfaces:

```typescript
/**
 * Default implementation of MethodRegistry
 */
export class DefaultMethodRegistry implements MethodRegistry {
  private methods = new Map<string, MethodDefinition>();

  register(
    path: string,
    handler: (...args: unknown[]) => unknown,
    options: { requireAuth?: boolean; requiredRoles?: string[] } = {},
  ): void {
    this.methods.set(path, {
      handler,
      requireAuth: options.requireAuth ?? true,
      requiredRoles: options.requiredRoles ?? [],
    });
  }

  get(path: string): MethodDefinition | undefined {
    return this.methods.get(path);
  }

  has(path: string): boolean {
    return this.methods.has(path);
  }

  /** Clear all registered methods (useful for testing) */
  clear(): void {
    this.methods.clear();
  }
}
```

**Step 2: 验证类型检查**

```bash
pnpm typecheck 2>&1 | grep -A2 "method.ts" || echo "No errors"
# Expected: No type errors
```

**Step 3: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): implement DefaultMethodRegistry class"
```

---

### Task 3: 实现 methodRoutes 函数 - 基础路由

**Files:**

- Modify: `src/api/method.ts` (add route registration)

**Step 1: 添加 methodRoutes 函数骨架**

Add to end of `src/api/method.ts`:

```typescript
/**
 * Register method routes on Fastify instance
 *
 * @param app - Fastify instance
 * @param registry - Method registry
 */
export function methodRoutes(app: FastifyInstance, registry: MethodRegistry): void {
  // POST /api/method/:methodPath
  app.post<{ Params: { methodPath: string } }>(
    '/api/method/:methodPath',
    async (request: FastifyRequest<{ Params: { methodPath: string } }>, reply: FastifyReply) => {
      const { methodPath } = request.params;

      // Check if method exists
      if (!registry.has(methodPath)) {
        return reply.status(404).send({
          error: 'Method not found',
        });
      }

      const methodDef = registry.get(methodPath)!;

      // Call the handler with request body as argument
      const result = await methodDef.handler(request.body || {});

      // Return result
      return reply.send(result);
    },
  );
}
```

**Step 2: 运行相关测试（应该部分通过）**

```bash
pnpm vitest run tests/unit/api/method.test.ts --reporter=verbose 2>&1 | tail -50
# Expected: Some tests pass (basic functionality), some fail (auth not implemented yet)
```

**Step 3: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): implement basic method routes without auth"
```

---

### Task 4: 实现响应格式化（处理原始值、null、undefined）

**Files:**

- Modify: `src/api/method.ts` (update result handling)

**Step 1: 添加响应格式化函数并更新路由**

Replace the result handling in `methodRoutes`:

```typescript
/**
 * Format method result for JSON response
 * - Objects are returned as-is
 * - Primitives, null, and undefined are wrapped in { result: ... }
 */
function formatResult(result: unknown): Record<string, unknown> {
  if (result === undefined) {
    return {};
  }

  if (result === null || (typeof result !== 'object' && !Array.isArray(result))) {
    return { result };
  }

  return result as Record<string, unknown>;
}
```

Then update the route handler:

```typescript
// Call the handler with request body as argument
const result = await methodDef.handler(request.body || {});

// Return formatted result
return reply.send(formatResult(result));
```

**Step 2: 运行测试验证响应格式化**

```bash
pnpm vitest run tests/unit/api/method.test.ts -t "should handle method returning primitive values" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should wrap primitive return values" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): format method responses - wrap primitives, handle null/undefined"
```

---

### Task 5: 实现认证检查

**Files:**

- Modify: `src/api/method.ts` (add auth check)

**Step 1: 添加认证检查逻辑**

Add helper function before `methodRoutes`:

```typescript
/**
 * Get user context from request (set by auth middleware)
 */
function getUserFromRequest(request: FastifyRequest): UserContext | null {
  return (request as unknown as { user?: UserContext }).user || null;
}
```

Update the route handler to include auth check:

```typescript
const methodDef = registry.get(methodPath)!;

// Check authentication if required
if (methodDef.requireAuth) {
  const user = getUserFromRequest(request);
  if (!user) {
    return reply.status(401).send({
      error: 'Authentication required',
    });
  }
}

// Call the handler with request body as argument
const result = await methodDef.handler(request.body || {});
```

**Step 2: 运行认证相关测试**

```bash
pnpm vitest run tests/unit/api/method.test.ts -t "should allow access to public method without auth" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should reject unauthenticated request to protected method" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should allow authenticated request to protected method" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): add authentication check for method routes"
```

---

### Task 6: 实现角色授权检查

**Files:**

- Modify: `src/api/method.ts` (add role check)

**Step 1: 添加角色检查逻辑**

Add helper function before `methodRoutes`:

```typescript
/**
 * Check if user has any of the required roles
 */
function hasRequiredRole(user: UserContext, requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.some((role) => user.roles.includes(role));
}
```

Update the auth check section:

```typescript
// Check authentication if required
if (methodDef.requireAuth) {
  const user = getUserFromRequest(request);
  if (!user) {
    return reply.status(401).send({
      error: 'Authentication required',
    });
  }

  // Check role authorization
  if (!hasRequiredRole(user, methodDef.requiredRoles)) {
    return reply.status(403).send({
      error: 'Permission denied',
    });
  }
}
```

**Step 2: 运行授权测试**

```bash
pnpm vitest run tests/unit/api/method.test.ts -t "should allow access when user has required role" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should deny access when user lacks required role" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should allow access when user has one of multiple required roles" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): add role-based authorization for method routes"
```

---

### Task 7: 集成错误处理

**Files:**

- Modify: `src/api/method.ts` (add try-catch for error handling)

**Step 1: 包装路由处理器以捕获错误**

Update the route handler with try-catch:

```typescript
app.post<{ Params: { methodPath: string } }>(
  '/api/method/:methodPath',
  async (request: FastifyRequest<{ Params: { methodPath: string } }>, reply: FastifyReply) => {
    try {
      const { methodPath } = request.params;

      // Check if method exists
      if (!registry.has(methodPath)) {
        return reply.status(404).send({
          error: 'Method not found',
        });
      }

      const methodDef = registry.get(methodPath)!;

      // Check authentication if required
      if (methodDef.requireAuth) {
        const user = getUserFromRequest(request);
        if (!user) {
          return reply.status(401).send({
            error: 'Authentication required',
          });
        }

        // Check role authorization
        if (!hasRequiredRole(user, methodDef.requiredRoles)) {
          return reply.status(403).send({
            error: 'Permission denied',
          });
        }
      }

      // Call the handler with request body as argument
      const result = await methodDef.handler(request.body || {});

      // Return formatted result
      return reply.send(formatResult(result));
    } catch (error) {
      // Re-throw to let error handler plugin handle it
      throw error;
    }
  },
);
```

**Step 2: 运行错误处理测试**

```bash
pnpm vitest run tests/unit/api/method.test.ts -t "should handle ValidationError from method" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should handle PermissionError from method" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should handle unexpected errors with 500" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/api/method.test.ts -t "should handle async method errors" --reporter=verbose
# Expected: PASS
```

**Step 3: 运行所有 method 测试**

```bash
pnpm vitest run tests/unit/api/method.test.ts --reporter=verbose 2>&1 | tail -30
# Expected: All tests PASS
```

**Step 4: Commit**

```bash
git add src/api/method.ts
git commit -m "feat(api): complete method routes with error handling integration"
```

---

## 第二部分：API Key 认证系统 (src/auth/api-key.ts)

### Task 8: 创建 API Key 类型定义和配置

**Files:**

- Create: `src/auth/api-key.ts` (initial structure)
- Test: Already exists at `tests/unit/auth/api-key.test.ts`

**Step 1: 创建文件骨架和类型定义**

Create `src/auth/api-key.ts`:

```typescript
/**
 * API Key Authentication System
 *
 * Provides programmatic access to the API without user credentials.
 * Uses key:secret pairs with Argon2 hashing for secure storage.
 */

import { hash, verify } from 'argon2';
import { AuthenticationError } from '../core/errors.js';

/**
 * API Key configuration
 */
export interface APIKeyConfig {
  /** Key prefix (e.g., 'nodra') */
  prefix: string;
  /** Length of the random key part */
  keyLength: number;
  /** Length of the secret */
  secretLength: number;
}

/**
 * API Key record stored in database
 */
export interface APIKeyRecord {
  /** Hashed key (identifier) */
  keyHash: string;
  /** Hashed secret */
  secretHash: string;
  /** User email associated with this key */
  userEmail: string;
  /** User roles */
  userRoles: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp (null = never) */
  expiresAt: Date | null;
  /** Last used timestamp */
  lastUsedAt: Date | null;
  /** Whether key is active */
  isActive: boolean;
  /** Permission scopes */
  scopes: string[];
  /** Description */
  description: string;
  /** Revocation timestamp */
  revokedAt?: Date;
}

/**
 * API Key pair (returned once on generation)
 */
export interface APIKeyPair {
  /** The API key (public identifier) */
  key: string;
  /** The secret (private, shown only once) */
  secret: string;
}

/**
 * API Key storage interface
 */
export interface APIKeyStore {
  save(record: APIKeyRecord): Promise<void>;
  findByHash(keyHash: string): Promise<APIKeyRecord | undefined>;
  findByUser(userEmail: string): Promise<APIKeyRecord[]>;
  revoke(keyHash: string): Promise<void>;
  update(record: APIKeyRecord): Promise<void>;
}

/** Default configuration */
export const DEFAULT_API_KEY_CONFIG: APIKeyConfig = {
  prefix: 'nodra',
  keyLength: 32,
  secretLength: 32,
};
```

**Step 2: 验证类型检查**

```bash
pnpm typecheck 2>&1 | grep -A2 "api-key.ts" || echo "No errors for api-key.ts"
# Expected: No type errors for api-key.ts
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): add API Key type definitions and interfaces"
```

---

### Task 9: 实现 generateAPIKey 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add key generation)

**Step 1: 添加 generateAPIKey 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsetLength = charset.length;

  // Use crypto.getRandomValues for secure randomness
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charsetLength];
  }

  return result;
}

/**
 * Generate a new API key pair
 *
 * @param config - API key configuration
 * @returns Object containing the key and secret (shown only once!)
 */
export function generateAPIKey(config: APIKeyConfig = DEFAULT_API_KEY_CONFIG): APIKeyPair {
  const randomKey = generateRandomString(config.keyLength);
  const secret = generateRandomString(config.secretLength);

  return {
    key: `${config.prefix}_${randomKey}`,
    secret,
  };
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should generate a valid API key pair" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should generate unique keys each time" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should include prefix in generated key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should generate URL-safe keys" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement generateAPIKey with secure random generation"
```

---

### Task 10: 实现 hashAPIKey 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add hashing)

**Step 1: 添加 hashAPIKey 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * Hash an API key using Argon2
 *
 * @param key - The API key to hash
 * @returns Argon2 hash string
 */
export async function hashAPIKey(key: string): Promise<string> {
  return hash(key, {
    type: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should hash API key consistently" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should produce different hashes for different keys" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should use secure hashing algorithm" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement hashAPIKey using Argon2id"
```

---

### Task 11: 实现 verifyAPIKey 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add verification)

**Step 1: 添加 verifyAPIKey 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * Verify an API key and secret
 *
 * @param key - The API key
 * @param secret - The API secret
 * @param store - API key storage
 * @returns The API key record if valid
 * @throws {AuthenticationError} If key is invalid, revoked, or expired
 */
export async function verifyAPIKey(
  key: string,
  secret: string,
  store: APIKeyStore,
): Promise<APIKeyRecord> {
  // Hash the key to look it up
  const keyHash = await hashAPIKey(key);

  // Find the key record
  const record = await store.findByHash(keyHash);

  if (!record) {
    throw new AuthenticationError('Invalid API key');
  }

  // Check if key is active
  if (!record.isActive) {
    throw new AuthenticationError('API key has been revoked');
  }

  // Check expiration
  if (record.expiresAt && record.expiresAt < new Date()) {
    throw new AuthenticationError('API key has expired');
  }

  // Verify the secret
  const isValidSecret = await verify(record.secretHash, secret);

  if (!isValidSecret) {
    throw new AuthenticationError('Invalid API key');
  }

  // Update last used timestamp
  record.lastUsedAt = new Date();
  await store.update(record);

  return record;
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should verify valid API key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should reject invalid API key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should reject revoked API key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should reject expired API key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should reject incorrect secret" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should update lastUsedAt on successful verification" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement verifyAPIKey with full validation"
```

---

### Task 12: 实现 revokeAPIKey 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add revocation)

**Step 1: 添加 revokeAPIKey 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * Revoke an API key
 *
 * @param keyHash - The hashed key to revoke
 * @param store - API key storage
 * @throws {AuthenticationError} If key not found
 */
export async function revokeAPIKey(keyHash: string, store: APIKeyStore): Promise<void> {
  // Check if key exists
  const record = await store.findByHash(keyHash);

  if (!record) {
    throw new AuthenticationError('API key not found');
  }

  await store.revoke(keyHash);
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should revoke active API key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should throw when revoking non-existent key" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement revokeAPIKey function"
```

---

### Task 13: 实现 listUserAPIKeys 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add list function)

**Step 1: 添加 listUserAPIKeys 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * List all active API keys for a user
 *
 * @param userEmail - User's email
 * @param store - API key storage
 * @returns Array of active API key records
 */
export async function listUserAPIKeys(
  userEmail: string,
  store: APIKeyStore,
): Promise<APIKeyRecord[]> {
  const keys = await store.findByUser(userEmail);
  // Filter to only active keys (store should already do this, but double-check)
  return keys.filter((key) => key.isActive);
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should list only active keys for user" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should return empty array for user with no keys" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement listUserAPIKeys function"
```

---

### Task 14: 实现 getAPIKeyPermissions 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add permissions function)

**Step 1: 添加 getAPIKeyPermissions 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * Get permission scopes for an API key
 *
 * @param keyHash - The hashed key
 * @param store - API key storage
 * @returns Array of permission scopes
 * @throws {AuthenticationError} If key not found or revoked
 */
export async function getAPIKeyPermissions(keyHash: string, store: APIKeyStore): Promise<string[]> {
  const record = await store.findByHash(keyHash);

  if (!record) {
    throw new AuthenticationError('API key not found');
  }

  if (!record.isActive) {
    throw new AuthenticationError('API key has been revoked');
  }

  return record.scopes;
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should return scopes for valid key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should throw for non-existent key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should throw for revoked key" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement getAPIKeyPermissions function"
```

---

### Task 15: 实现 rotateAPIKey 函数

**Files:**

- Modify: `src/auth/api-key.ts` (add rotation)

**Step 1: 添加 rotateAPIKey 函数**

Add to end of `src/auth/api-key.ts`:

```typescript
/**
 * Rotate (replace) an API key with a new one
 * Preserves permissions and user association
 *
 * @param oldKeyHash - The hashed key to rotate
 * @param config - API key configuration
 * @param store - API key storage
 * @returns New API key pair
 * @throws {AuthenticationError} If old key not found
 */
export async function rotateAPIKey(
  oldKeyHash: string,
  config: APIKeyConfig,
  store: APIKeyStore,
): Promise<APIKeyPair> {
  // Get the old record
  const oldRecord = await store.findByHash(oldKeyHash);

  if (!oldRecord) {
    throw new AuthenticationError('API key not found');
  }

  // Revoke the old key
  await store.revoke(oldKeyHash);

  // Generate new key pair
  const newKeyPair = generateAPIKey(config);

  // Create new record with same permissions
  const newRecord: APIKeyRecord = {
    keyHash: await hashAPIKey(newKeyPair.key),
    secretHash: await hashAPIKey(newKeyPair.secret),
    userEmail: oldRecord.userEmail,
    userRoles: oldRecord.userRoles,
    createdAt: new Date(),
    expiresAt: oldRecord.expiresAt,
    lastUsedAt: null,
    isActive: true,
    scopes: oldRecord.scopes,
    description: oldRecord.description,
  };

  await store.save(newRecord);

  return newKeyPair;
}
```

**Step 2: 运行相关测试**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts -t "should rotate API key and return new key pair" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should revoke old key after rotation" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should preserve permissions in rotated key" --reporter=verbose
# Expected: PASS

pnpm vitest run tests/unit/auth/api-key.test.ts -t "should throw when rotating non-existent key" --reporter=verbose
# Expected: PASS
```

**Step 3: Commit**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): implement rotateAPIKey for key rotation"
```

---

### Task 16: 运行所有 API Key 测试

**Step 1: 运行完整测试套件**

```bash
pnpm vitest run tests/unit/auth/api-key.test.ts --reporter=verbose 2>&1 | tail -40
# Expected: All tests PASS
```

**Step 2: Commit 完成标记**

```bash
git add src/auth/api-key.ts
git commit -m "feat(auth): complete API Key authentication system"
```

---

## 第三部分：整合与验证

### Task 17: 更新主导出文件

**Files:**

- Modify: `src/index.ts` (add exports for new modules)

**Step 1: 添加方法路由导出**

Find the exports section in `src/index.ts` and add after the API exports:

```typescript
// API Methods
export { methodRoutes, DefaultMethodRegistry } from './api/method.js';

export type { MethodDefinition, MethodRegistry } from './api/method.js';
```

**Step 2: 添加 API Key 导出**

Add after the auth exports:

```typescript
// API Key Authentication
export {
  generateAPIKey,
  hashAPIKey,
  verifyAPIKey,
  revokeAPIKey,
  getAPIKeyPermissions,
  listUserAPIKeys,
  rotateAPIKey,
  DEFAULT_API_KEY_CONFIG,
} from './auth/api-key.js';

export type { APIKeyConfig, APIKeyRecord, APIKeyPair, APIKeyStore } from './auth/api-key.js';
```

**Step 3: 验证类型检查**

```bash
pnpm typecheck 2>&1 | head -20
# Expected: No type errors
```

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: export method routes and API key modules from index"
```

---

### Task 18: 完整测试验证

**Step 1: 运行所有测试**

```bash
pnpm test 2>&1 | tail -30
# Expected: 60 passed, 0 failed (or close to it)
```

**Step 2: 检查测试覆盖率**

```bash
pnpm vitest run --coverage 2>&1 | tail -50
# Expected: Coverage metrics for new code
```

**Step 3: Lint 检查**

```bash
pnpm lint 2>&1 | tail -20
# Expected: No lint errors
```

---

### Task 19: 创建实施总结文档

**Files:**

- Create: `docs/plans/phase-15-completion-summary.md`

**Step 1: 创建总结文档**

```markdown
# 阶段 15 实施完成总结

## 完成的功能

### 1. 方法端点路由 (src/api/method.ts)

**功能:**

- ✅ 白名单方法注册机制
- ✅ `POST /api/method/{path}` 端点
- ✅ 支持公开和受保护的方法
- ✅ 基于角色的访问控制
- ✅ 响应格式化（原始值包装）
- ✅ 完整的错误处理集成

**关键组件:**

- `MethodRegistry` 接口 - 方法注册表抽象
- `DefaultMethodRegistry` 类 - 默认实现
- `methodRoutes()` 函数 - Fastify 路由注册

### 2. API Key 认证 (src/auth/api-key.ts)

**功能:**

- ✅ 生成安全的 API Key 对（key:secret）
- ✅ Argon2id 哈希存储
- ✅ 密钥验证（支持过期、撤销检查）
- ✅ 权限范围控制（scopes）
- ✅ 密钥轮换机制
- ✅ 用户密钥列表查询

**关键组件:**

- `generateAPIKey()` - 生成新密钥对
- `hashAPIKey()` - Argon2 哈希
- `verifyAPIKey()` - 验证密钥
- `revokeAPIKey()` - 撤销密钥
- `rotateAPIKey()` - 轮换密钥
- `APIKeyStore` 接口 - 存储抽象

## 测试结果

- ✅ 所有方法路由测试通过
- ✅ 所有 API Key 测试通过
- ✅ TypeScript 严格模式检查通过
- ✅ ESLint 检查通过

## 集成点

1. **与现有错误处理集成**: 自动使用 `error-handler.ts`
2. **与权限系统集成**: 复用 `UserContext` 类型
3. **与认证系统集成**: 使用相同的 `AuthenticationError`

## 下一步建议

1. 实现基于数据库的 `APIKeyStore` 实现
2. 添加 API Key 管理端点到 `authRoutes`
3. 集成 API Key 认证到中间件
4. 添加 API Key 作用域验证中间件
```

**Step 2: Commit**

```bash
git add docs/plans/phase-15-completion-summary.md
git commit -m "docs: add phase 15 implementation completion summary"
```

---

## 最终验证清单

**Step 1: 最终测试运行**

```bash
# 运行所有测试
pnpm test

# 类型检查
pnpm typecheck

# Lint 检查
pnpm lint

# 构建检查
pnpm build
```

**Expected Results:**

- Tests: 60 passed, 0 failed
- TypeCheck: No errors
- Lint: No errors
- Build: Success

**Step 2: Git 状态检查**

```bash
git log --oneline -10
# Expected: 10+ commits with conventional commit format

git status
# Expected: clean working tree
```

---

## 计划完成

**本计划已实现:**

- ✅ 方法端点路由系统
- ✅ API Key 认证系统
- ✅ 完整的类型定义
- ✅ 全面的测试覆盖
- ✅ 与现有系统集成

**执行后状态:**

- 阶段 15 完成
- 可进入阶段 16 (权限系统完善) 或阶段 17 (Desk 前端)

---

_Plan created: 2026-02-13_
_Estimated execution time: 2-3 hours_

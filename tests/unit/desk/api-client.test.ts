/**
 * Tests for Desk API Client
 *
 * API client is the bridge between Desk frontend and Nodra backend.
 * It handles authentication, request/response transformation, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAPIClient,
  type APIClient,
  type APIClientConfig,
  type RequestInterceptor,
  type ResponseInterceptor,
} from '../../../desk/src/api/client.js';

// ---------------------------------------------------------------------------
// Mock fetch for testing
// ---------------------------------------------------------------------------

global.fetch = vi.fn();

function mockFetchResponse(response: {
  ok: boolean;
  status: number;
  statusText?: string;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}) {
  const mockResponse = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText || 'OK',
    headers: new Headers(response.headers || {}),
    json: vi.fn().mockResolvedValue(response.json || {}),
    text: vi.fn().mockResolvedValue(response.text || ''),
  };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testConfig: APIClientConfig = {
  baseURL: 'http://localhost:3000',
  timeout: 5000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Client - Initialization', () => {
  it('should create API client with config', () => {
    const client = createAPIClient(testConfig);

    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('should use default config when not provided', () => {
    const client = createAPIClient();

    expect(client).toBeDefined();
  });

  it('should merge custom config with defaults', () => {
    const customConfig: Partial<APIClientConfig> = {
      baseURL: 'https://api.example.com',
    };

    const client = createAPIClient(customConfig as APIClientConfig);
    expect(client).toBeDefined();
  });
});

describe('API Client - GET Requests', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should make GET request to correct URL', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { data: 'test' } });

    await client.get('/api/resource/Todo');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo',
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
  });

  it('should append query parameters', async () => {
    mockFetchResponse({ ok: true, status: 200, json: [] });

    await client.get('/api/resource/Todo', {
      params: {
        fields: 'name,title',
        filters: JSON.stringify({ status: 'Open' }),
        limit: 20,
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('fields=name%2Ctitle'),
      expect.any(Object),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('filters='),
      expect.any(Object),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=20'),
      expect.any(Object),
    );
  });

  it('should return parsed JSON response', async () => {
    const mockData = { data: [{ name: 'TODO-001', title: 'Test' }] };
    mockFetchResponse({ ok: true, status: 200, json: mockData });

    const response = await client.get('/api/resource/Todo');

    expect(response.data).toEqual(mockData);
  });

  it('should handle empty response', async () => {
    mockFetchResponse({ ok: true, status: 200, json: null });

    const response = await client.get('/api/resource/Todo');

    expect(response.data).toBeNull();
  });
});

describe('API Client - POST Requests', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should make POST request with JSON body', async () => {
    mockFetchResponse({ ok: true, status: 201, json: { name: 'TODO-001' } });

    const payload = { title: 'New Todo', status: 'Open' };
    await client.post('/api/resource/Todo', payload);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      }),
    );
  });

  it('should return created resource', async () => {
    const createdDoc = { name: 'TODO-001', title: 'New Todo' };
    mockFetchResponse({ ok: true, status: 201, json: createdDoc });

    const response = await client.post('/api/resource/Todo', { title: 'New Todo' });

    expect(response.data).toEqual(createdDoc);
    expect(response.status).toBe(201);
  });

  it('should handle FormData for file uploads', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { file_url: '/files/test.pdf' } });

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.pdf');

    await client.post('/api/upload', formData);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: formData,
      }),
    );
  });
});

describe('API Client - PUT Requests', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should make PUT request with JSON body', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { name: 'TODO-001', title: 'Updated' } });

    const payload = { title: 'Updated Todo' };
    await client.put('/api/resource/Todo/TODO-001', payload);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo/TODO-001',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    );
  });
});

describe('API Client - DELETE Requests', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should make DELETE request', async () => {
    mockFetchResponse({ ok: true, status: 204 });

    await client.delete('/api/resource/Todo/TODO-001');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo/TODO-001',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });
});

describe('API Client - Authentication', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should include JWT token in Authorization header', async () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
    client.setAuthToken(token);

    mockFetchResponse({ ok: true, status: 200, json: {} });
    await client.get('/api/resource/Todo');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
        }),
      }),
    );
  });

  it('should include API Key in header', async () => {
    const apiKey = 'nodra_abc123';
    const apiSecret = 'secret_xyz789';
    client.setAPIKey(apiKey, apiSecret);

    mockFetchResponse({ ok: true, status: 200, json: {} });
    await client.get('/api/resource/Todo');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret,
        }),
      }),
    );
  });

  it('should clear auth token', async () => {
    client.setAuthToken('some-token');
    client.clearAuth();

    mockFetchResponse({ ok: true, status: 200, json: {} });
    await client.get('/api/resource/Todo');

    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers.get('Authorization')).toBeNull();
  });
});

describe('API Client - Error Handling', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should throw on 401 Unauthorized', async () => {
    mockFetchResponse({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: { error: 'Authentication required' },
    });

    await expect(client.get('/api/resource/Todo')).rejects.toThrow('Authentication required');
  });

  it('should throw on 403 Forbidden', async () => {
    mockFetchResponse({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: { error: 'Permission denied' },
    });

    await expect(client.get('/api/resource/Todo')).rejects.toThrow('Permission denied');
  });

  it('should throw on 404 Not Found', async () => {
    mockFetchResponse({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: { error: 'Document not found' },
    });

    await expect(client.get('/api/resource/Todo/INVALID')).rejects.toThrow('Document not found');
  });

  it('should throw on 400 Validation Error', async () => {
    mockFetchResponse({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: {
        error: 'Validation failed',
        details: [{ field: 'email', message: 'Invalid email format' }],
      },
    });

    try {
      await client.post('/api/resource/Todo', {});
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).toContain('Validation failed');
      }
    }
  });

  it('should throw on 500 Server Error', async () => {
    mockFetchResponse({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: { error: 'Internal server error' },
    });

    await expect(client.get('/api/resource/Todo')).rejects.toThrow('Internal server error');
  });

  it('should handle network errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    await expect(client.get('/api/resource/Todo')).rejects.toThrow('Network error');
  });

  it('should handle timeout', async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const promise = client.get('/api/resource/Todo', { timeout: 1000 });
    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow('Request timeout');
    vi.useRealTimers();
  });
});

describe('API Client - Request Interceptors', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should apply request interceptor', async () => {
    const interceptor: RequestInterceptor = (config) => {
      config.headers = config.headers || {};
      config.headers['X-Custom-Header'] = 'custom-value';
      return config;
    };

    client.addRequestInterceptor(interceptor);
    mockFetchResponse({ ok: true, status: 200, json: {} });

    await client.get('/api/resource/Todo');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'custom-value',
        }),
      }),
    );
  });

  it('should apply multiple request interceptors in order', async () => {
    const order: number[] = [];

    client.addRequestInterceptor((config) => {
      order.push(1);
      return config;
    });

    client.addRequestInterceptor((config) => {
      order.push(2);
      return config;
    });

    mockFetchResponse({ ok: true, status: 200, json: {} });
    await client.get('/api/resource/Todo');

    expect(order).toEqual([1, 2]);
  });

  it('should remove request interceptor', async () => {
    const interceptor: RequestInterceptor = (config) => {
      config.headers = config.headers || {};
      config.headers['X-Should-Not-Exist'] = 'value';
      return config;
    };

    const id = client.addRequestInterceptor(interceptor);
    client.removeRequestInterceptor(id);

    mockFetchResponse({ ok: true, status: 200, json: {} });
    await client.get('/api/resource/Todo');

    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers.get('X-Should-Not-Exist')).toBeNull();
  });
});

describe('API Client - Response Interceptors', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should apply response interceptor', async () => {
    const interceptor: ResponseInterceptor = (response) => {
      if (response.data) {
        response.data.intercepted = true;
      }
      return response;
    };

    client.addResponseInterceptor(interceptor);
    mockFetchResponse({ ok: true, status: 200, json: { original: true } });

    const response = await client.get('/api/resource/Todo');

    expect(response.data).toEqual({ original: true, intercepted: true });
  });

  it('should handle error in response interceptor', async () => {
    const interceptor: ResponseInterceptor = () => {
      throw new Error('Interceptor error');
    };

    client.addResponseInterceptor(interceptor);
    mockFetchResponse({ ok: true, status: 200, json: {} });

    await expect(client.get('/api/resource/Todo')).rejects.toThrow('Interceptor error');
  });
});

describe('API Client - Resource Helpers', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient(testConfig);
    vi.clearAllMocks();
  });

  it('should get DocType list', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { data: [] } });

    await client.getDocTypeList();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/resource/DocType'),
      expect.any(Object),
    );
  });

  it('should get document list', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { data: [] } });

    await client.getList('Todo', { filters: { status: 'Open' } });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/resource/Todo'),
      expect.any(Object),
    );
  });

  it('should get single document', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { name: 'TODO-001' } });

    await client.getDoc('Todo', 'TODO-001');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo/TODO-001',
      expect.any(Object),
    );
  });

  it('should save document', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { name: 'TODO-001' } });

    await client.saveDoc('Todo', { name: 'TODO-001', title: 'Updated' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo/TODO-001',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should create document', async () => {
    mockFetchResponse({ ok: true, status: 201, json: { name: 'TODO-001' } });

    await client.createDoc('Todo', { title: 'New Todo' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should delete document', async () => {
    mockFetchResponse({ ok: true, status: 204 });

    await client.deleteDoc('Todo', 'TODO-001');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resource/Todo/TODO-001',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('should call method', async () => {
    mockFetchResponse({ ok: true, status: 200, json: { result: 'success' } });

    await client.callMethod('frappe.client.get_count', { doctype: 'Todo' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/method/frappe.client.get_count',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('API Client - Retry Logic', () => {
  let client: APIClient;

  beforeEach(() => {
    client = createAPIClient({ ...testConfig, retry: 3 });
    vi.clearAllMocks();
  });

  it('should retry on network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      });

    const response = await client.get('/api/resource/Todo');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(response.data).toEqual({ data: 'success' });
  });

  it('should retry on 500 error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: vi.fn().mockResolvedValue({ error: 'Server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      });

    const response = await client.get('/api/resource/Todo');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(response.data).toEqual({ data: 'success' });
  });

  it('should not retry on 4xx errors (except 429)', async () => {
    mockFetchResponse({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: { error: 'Bad request' },
    });

    await expect(client.get('/api/resource/Todo')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should respect max retry count', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    await expect(client.get('/api/resource/Todo')).rejects.toThrow('Network error');
    expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });
});

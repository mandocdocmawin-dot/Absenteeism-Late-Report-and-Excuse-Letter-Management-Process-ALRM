import assert from 'node:assert/strict';
import { mock } from 'node:test';

// API contract tests model the new gateway bootstrap separately from the endpoint
// under test. Cryptographic CSRF validation is exercised by cookie-gateway.test.js.
export function mockApiFetch(implementation) {
  const endpoint = mock.fn(implementation);
  const wrapper = mock.method(globalThis, 'fetch', (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.has('Authorization'), false);
    if (url === '/api/auth/csrf') return Promise.resolve(Response.json({ success: true, data: { csrf_token: 'test-csrf-proof' } }));
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) assert.equal(options.headers.get('X-CSRF-Token'), 'test-csrf-proof');
    return endpoint(url, options);
  });
  endpoint.mock.restore = () => wrapper.mock.restore();
  return endpoint;
}

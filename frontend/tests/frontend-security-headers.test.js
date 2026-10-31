import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { contentSecurityPolicy, securityHeaders } from '../server/securityHeaders.js';
import { cookieGatewayPlugin } from '../server/viteGateway.js';

test('production CSP blocks executable injection and permits the actual metadata and local assets', async () => {
  const policy = contentSecurityPolicy();
  const directives = Object.fromEntries(policy.split(';').map(part => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]));
  assert.deepEqual(directives['default-src'], ["'none'"]);
  assert.deepEqual(directives['script-src-attr'], ["'none'"]);
  assert.deepEqual(directives['object-src'], ["'none'"]);
  assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
  assert.deepEqual(directives['base-uri'], ["'none'"]);
  assert.deepEqual(directives['connect-src'], ["'self'"]);
  assert.doesNotMatch(directives['script-src'].join(' '), /unsafe-inline|unsafe-eval|https:|\*/);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  // HTML parsing normalizes line endings before CSP checks inline script text.
  const metadata = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\r\n?/g, '\n');
  assert.ok(directives['script-src'].includes(`'sha256-${createHash('sha256').update(metadata).digest('base64')}'`));
  assert.ok(directives['img-src'].includes('blob:'));
  assert.deepEqual(directives['font-src'], ["'self'"]);
});

test('Vercel applies the production policy and routes every API call through the cookie gateway', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rule = config.headers.find(rule => rule.source === '/(.*)');
  for (const [key, value] of Object.entries(securityHeaders())) assert.ok(rule.headers.some(header => header.key === key && header.value === value), key);
  assert.equal(config.rewrites[0].destination, '/api/gateway?__alrm_path=:path*');
  assert.ok(config.rewrites.every(rule => !rule.destination.startsWith('https:')));
});

test('development allows only the Vite features that production excludes', () => {
  const policy = contentSecurityPolicy({ development: true });
  assert.match(policy, /ws:\/\/localhost:\*/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
});

test('the build validates inline metadata after Vite emits index.html', () => {
  const hook = cookieGatewayPlugin({}).generateBundle;
  assert.equal(hook.order, 'post');
  assert.throws(() => hook.handler({}, { 'index.html': { source: '<script>unexpected()</script>' } }), /CSP hash/);
  assert.throws(() => hook.handler({}, {}), /index.html/);
});

test('Windows and Linux HTML produce the same CSP-approved inline metadata', async () => {
  const plugin = cookieGatewayPlugin({});
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
  assert.equal(typeof plugin.transformIndexHtml?.handler, 'function');
  assert.equal(plugin.transformIndexHtml.order, 'pre');
  for (const source of [html, html.replace(/\n/g, '\r\n')]) {
    const transformed = plugin.transformIndexHtml.handler(source);
    assert.equal(transformed, html);
    assert.doesNotThrow(() => plugin.generateBundle.handler({}, { 'index.html': { source: transformed } }));
    assert.throws(() => plugin.generateBundle.handler({}, {
      'index.html': { source: transformed.replace('"name": "ALRM System"', '"name": "Changed metadata"') },
    }), /CSP hash/);
  }
});

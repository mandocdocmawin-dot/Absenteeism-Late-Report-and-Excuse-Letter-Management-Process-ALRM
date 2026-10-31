import { randomBytes, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { handleGateway } from './authGateway.js';
import { securityHeaders, contentSecurityPolicy } from './securityHeaders.js';

const developmentSecret = randomBytes(32).toString('hex');

export function nodeGateway(options) {
  return async (incoming, outgoing) => {
    try {
      const origin = `http://${incoming.headers.host}`;
      const request = new Request(new URL(incoming.url, origin), {
        method: incoming.method,
        headers: incoming.headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
      });
      const response = await handleGateway(request, { ...options, clientIp: incoming.socket.remoteAddress });
      outgoing.statusCode = response.status;
      for (const [name, value] of response.headers) if (name !== 'set-cookie') outgoing.setHeader(name, value);
      if (response.headers.getSetCookie().length) outgoing.setHeader('Set-Cookie', response.headers.getSetCookie());
      if (response.body) Readable.fromWeb(response.body).on('error', () => outgoing.destroy()).pipe(outgoing);
      else outgoing.end();
    } catch {
      outgoing.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify({ success: false, message: 'The API could not be reached. Please try again.', data: null }));
    }
  };
}

export function cookieGatewayPlugin(env) {
  function mount(server, development) {
    const gateway = nodeGateway({
      secret: env.ALRM_COOKIE_SECRET || developmentSecret,
      backendOrigin: env.ALRM_BACKEND_ORIGIN || 'https://absenteeism-late-report-and-excuse.onrender.com',
      production: false,
    });
    server.middlewares.use((request, response, next) => {
      for (const [name, value] of Object.entries(securityHeaders({ development }))) response.setHeader(name, value);
      if (request.url.startsWith('/api/')) return gateway(request, response);
      next();
    });
  }
  return {
    name: 'alrm-cookie-gateway',
    transformIndexHtml: {
      order: 'pre',
      // Keep inline-script bytes identical across Windows and Linux builds.
      handler(html) { return html.replace(/\r\n?/g, '\n'); },
    },
    configureServer(server) { mount(server, true); },
    configurePreviewServer(server) { mount(server, false); },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const html = bundle['index.html']?.source;
        if (!html) throw new Error('Cannot validate the CSP without the emitted index.html.');
        for (const [, source] of String(html).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
          if (!source.trim()) continue;
          const hash = `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
          if (!contentSecurityPolicy().includes(hash)) throw new Error('Update the JSON-LD CSP hash in server/securityHeaders.js and vercel.json after changing inline metadata.');
        }
      },
    },
  };
}

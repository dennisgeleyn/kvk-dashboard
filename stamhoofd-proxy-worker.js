// Stamhoofd API CORS Proxy — Cloudflare Worker

const ALLOWED_ORIGIN = '*';
const ALLOWED_HOSTS = ['api.stamhoofd.app', 'status.stamhoofd.app'];

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const incoming = new URL(request.url);
    const target = incoming.searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    const allowed = ALLOWED_HOSTS.some(h => target.includes(h));
    if (!allowed) {
      return new Response('Domain not allowed', { status: 403 });
    }

    // Build forward headers — only pass Authorization for API calls, not status page
    const forwardHeaders = new Headers();
    const apiKey = incoming.searchParams.get('apiKey');
    if (apiKey) forwardHeaders.set('Authorization', 'Bearer ' + apiKey);
    const ct = request.headers.get('Content-Type');
    if (ct) forwardHeaders.set('Content-Type', ct);

    let response;
    try {
      response = await fetch(new Request(target, {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== 'GET' ? request.body : undefined,
      }));
    } catch (err) {
      return new Response('Proxy fetch failed: ' + err.message, { status: 502 });
    }

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
      },
    });
  },
};

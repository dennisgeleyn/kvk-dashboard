// Stamhoofd API CORS Proxy + Auth + User Management — Cloudflare Worker
//
// ── Required secrets ──────────────────────────────────────────────────────────
//   STAMHOOFD_API_KEY  — your Stamhoofd API key
//   ADMIN_PASSWORD     — admin password for the dashboard
//
// ── Required KV binding ───────────────────────────────────────────────────────
//   Create a KV namespace in Cloudflare dashboard → Workers & Pages → KV
//   Then bind it to this worker: Worker → Settings → Variables → KV Namespace Bindings
//     Variable name: KVK_STORE  (must be exactly this)
//
// ── Optional secrets (email notifications) ────────────────────────────────────
//   RESEND_API_KEY  — from resend.com (free: 100 emails/day)
//   NOTIFY_TO       — email to notify on new access requests
//   NOTIFY_FROM     — sender address ('onboarding@resend.dev' works for testing)

const ALLOWED_ORIGIN = '*';
const ALLOWED_HOSTS  = ['api.stamhoofd.app', 'status.stamhoofd.app'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Token',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });

const fail = (msg, status = 400) =>
  new Response(msg, { status, headers: CORS_HEADERS });

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// KV helpers
async function kvGet(env, key)       { try { const v = await env.KVK_STORE.get(key); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
async function kvSet(env, key, val)  { await env.KVK_STORE.put(key, JSON.stringify(val)); }

function adminOk(request, env) {
  return request.headers.get('X-Admin-Token') === env.ADMIN_PASSWORD;
}

export default {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── /auth POST — verify admin password ────────────────────────────────────
    if (path === '/auth' && request.method === 'POST') {
      try {
        const { password } = await request.json();
        if (!env.ADMIN_PASSWORD) return fail('Not configured', 500);
        return password === env.ADMIN_PASSWORD ? json({ ok: true }) : json({ ok: false }, 401);
      } catch(e) { return fail('Bad request'); }
    }

    // ── /users GET — list users + pending requests (admin only) ───────────────
    if (path === '/users' && request.method === 'GET') {
      if (!adminOk(request, env)) return fail('Unauthorized', 401);
      const users    = await kvGet(env, 'users')    || [];
      const requests = await kvGet(env, 'requests') || [];
      const resets   = (await kvGet(env, 'resets')  || []).filter(r => Date.now() < r.expires);
      await kvSet(env, 'resets', resets); // prune expired
      return json({ users, requests, resets });
    }

    // ── /users/login POST — check user credentials ────────────────────────────
    if (path === '/users/login' && request.method === 'POST') {
      try {
        const { emailHash, pwHash } = await request.json();
        // Check one-time reset tokens
        const resets = (await kvGet(env, 'resets') || []).filter(r => Date.now() < r.expires);
        const reset = resets.find(r => r.emailHash === emailHash && r.pwHash === pwHash);
        if (reset) {
          await kvSet(env, 'resets', resets.filter(r => r !== reset));
          return json({ ok: true, mustChangePassword: true });
        }
        // Check regular users
        const users = await kvGet(env, 'users') || [];
        const user = users.find(u => u.emailHash === emailHash && u.pwHash === pwHash);
        return user ? json({ ok: true, mustChangePassword: false }) : json({ ok: false }, 401);
      } catch(e) { return fail('Bad request'); }
    }

    // ── /users/changepw POST — change own password ────────────────────────────
    if (path === '/users/changepw' && request.method === 'POST') {
      try {
        const { emailHash, oldPwHash, newPwHash } = await request.json();
        const users = await kvGet(env, 'users') || [];
        const idx = users.findIndex(u => u.emailHash === emailHash && u.pwHash === oldPwHash);
        if (idx < 0) return json({ ok: false }, 401);
        users[idx].pwHash = newPwHash;
        await kvSet(env, 'users', users);
        return json({ ok: true });
      } catch(e) { return fail('Bad request'); }
    }

    // ── /requests POST — submit an access request ─────────────────────────────
    if (path === '/requests' && request.method === 'POST') {
      try {
        const { name, emailHash, displayEmail } = await request.json();
        if (!name || !emailHash) return fail('Missing fields');
        const requests = await kvGet(env, 'requests') || [];
        const users    = await kvGet(env, 'users')    || [];
        if (requests.find(r => r.emailHash === emailHash)) return json({ ok: false, reason: 'duplicate' });
        if (users.find(u => u.emailHash === emailHash))    return json({ ok: false, reason: 'already_approved' });
        requests.push({ id: Date.now().toString(), name, emailHash, displayEmail, ts: new Date().toISOString() });
        await kvSet(env, 'requests', requests);
        // Fire-and-forget email notification
        if (env.RESEND_API_KEY && env.NOTIFY_TO) {
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env.NOTIFY_FROM || 'onboarding@resend.dev',
              to: [env.NOTIFY_TO],
              subject: 'KVK Dashboard — nieuwe toegangsaanvraag',
              html: `<p>Nieuwe aanvraag voor het KVK Dashboard.</p>
                <table style="font-family:sans-serif;font-size:14px">
                  <tr><td style="padding:4px 12px 4px 0;color:#666">Naam</td><td><strong>${name}</strong></td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666">E-mail</td><td>${displayEmail}</td></tr>
                  <tr><td style="padding:4px 12px 4px 0;color:#666">Tijdstip</td><td>${new Date().toLocaleString('nl-BE')}</td></tr>
                </table>
                <p><a href="https://dennisgeleyn.github.io/kvk-dashboard" style="background:#c9a84c;color:#fff;padding:8px 16px;text-decoration:none">Open dashboard</a></p>`
            })
          }).catch(() => {});
        }
        return json({ ok: true });
      } catch(e) { return fail('Bad request: ' + e.message); }
    }

    // ── /requests/:id/approve POST — approve request (admin) ─────────────────
    if (path.match(/^\/requests\/[^/]+\/approve$/) && request.method === 'POST') {
      if (!adminOk(request, env)) return fail('Unauthorized', 401);
      try {
        const reqId = path.split('/')[2];
        const { pwHash } = await request.json();
        const requests = await kvGet(env, 'requests') || [];
        const req = requests.find(r => r.id === reqId);
        if (!req) return fail('Not found', 404);
        const users = await kvGet(env, 'users') || [];
        users.push({ emailHash: req.emailHash, displayEmail: req.displayEmail, pwHash });
        await kvSet(env, 'users', users);
        await kvSet(env, 'requests', requests.filter(r => r.id !== reqId));
        return json({ ok: true });
      } catch(e) { return fail('Bad request'); }
    }

    // ── /requests/:id/deny DELETE — deny request (admin) ─────────────────────
    if (path.match(/^\/requests\/[^/]+\/deny$/) && request.method === 'DELETE') {
      if (!adminOk(request, env)) return fail('Unauthorized', 401);
      const reqId = path.split('/')[2];
      const requests = await kvGet(env, 'requests') || [];
      await kvSet(env, 'requests', requests.filter(r => r.id !== reqId));
      return json({ ok: true });
    }

    // ── /users/:emailHash DELETE — revoke user (admin) ────────────────────────
    if (path.match(/^\/users\/[^/]+$/) && request.method === 'DELETE') {
      if (!adminOk(request, env)) return fail('Unauthorized', 401);
      const emailHash = path.split('/')[2];
      const users = await kvGet(env, 'users') || [];
      await kvSet(env, 'users', users.filter(u => u.emailHash !== emailHash));
      return json({ ok: true });
    }

    // ── /users/:emailHash/reset POST — generate one-time reset token (admin) ──
    if (path.match(/^\/users\/[^/]+\/reset$/) && request.method === 'POST') {
      if (!adminOk(request, env)) return fail('Unauthorized', 401);
      const emailHash = path.split('/')[2];
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const arr = new Uint8Array(8);
      crypto.getRandomValues(arr);
      let token = '';
      arr.forEach(b => token += chars[b % chars.length]);
      const pwHash = await sha256(token);
      const resets = (await kvGet(env, 'resets') || []).filter(r => r.emailHash !== emailHash);
      resets.push({ emailHash, pwHash, expires: Date.now() + 24 * 60 * 60 * 1000 });
      await kvSet(env, 'resets', resets);
      return json({ ok: true, token });
    }

    // ── /proxy GET/POST — Stamhoofd API CORS proxy ────────────────────────────
    if (path === '/proxy') {
      const target = url.searchParams.get('url');
      if (!target) return fail('Missing ?url= parameter');
      if (!ALLOWED_HOSTS.some(h => target.includes(h))) return fail('Domain not allowed', 403);
      const fwd = new Headers();
      if (target.includes('api.stamhoofd.app')) {
        if (!env.STAMHOOFD_API_KEY) return fail('API key not configured', 500);
        fwd.set('Authorization', 'Bearer ' + env.STAMHOOFD_API_KEY);
      }
      const ct = request.headers.get('Content-Type');
      if (ct) fwd.set('Content-Type', ct);
      let res;
      try {
        res = await fetch(new Request(target, {
          method: request.method, headers: fwd,
          body: request.method !== 'GET' ? request.body : undefined,
        }));
      } catch(e) { return fail('Proxy error: ' + e.message, 502); }
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...CORS_HEADERS, 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
      });
    }

    return fail('Not found', 404);
  },
};

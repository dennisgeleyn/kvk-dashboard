# KVK Dashboard

Live ticketing dashboard for **Koninklijke Toneelgroep Kunst Veredelt Kieldrecht vzw**, built on top of the [Stamhoofd](https://stamhoofd.app) API.

🔗 **[dennisgeleyn.github.io/kvk-dashboard](https://dennisgeleyn.github.io/kvk-dashboard)**

---

## Features

- **Live sales data** — fetches all orders via the Stamhoofd API with full pagination and deduplication
- **KPI overview** — total revenue, paid revenue, tickets sold, average order value
- **Per-show breakdown** — tickets sold, capacity (239 seats), seats remaining, and a traffic light:
  - 🟢 **Vrij** — fewer than 194 tickets sold
  - 🟡 **Laatste kaarten** — 194 to 233 tickets sold
  - 🔴 **Uitverkocht** — 234 or more tickets sold
- **Tickets per week** — bar chart with hover tooltip
- **Payment status breakdown** and **recent orders table**
- **Stamhoofd system status** — live status pill in the header
- **Auto-refresh** every 5 minutes
- **Mobile-friendly** — responsive layout

---

## Architecture

```
Browser → Cloudflare Worker → Stamhoofd API
                ↕
           Cloudflare KV  (users, requests, sessions, magic link tokens)
                ↕
             Resend API  (magic link emails + admin notifications)
```

### How login works (magic links)

There are no passwords for regular users. Instead:

1. User enters their email on the login screen → Worker sends a one-time login link
2. User clicks the link → Worker validates the token → session is created in KV
3. Sessions last 7 days; tokens expire after 15 minutes and are single-use
4. To log in again after 7 days, they just request a new link

Admin login uses a password (stored as a Worker secret, never in source code).

### Security model

- **API key** — Cloudflare Worker secret, never in the browser
- **Admin password** — Cloudflare Worker secret, validated server-side
- **No passwords stored** for regular users — magic link tokens only
- **Sessions in KV** — invalidated on logout, expire server-side after 7 days
- **Login lockout** — 5 failed admin attempts triggers a 15-minute lockout
- **Email addresses** — only SHA-256 hashes stored in KV; display hints masked (`den***@gmail.com`)

---

## Setup

### 1. Create a Resend account

1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day)
2. Create an API key
3. For production: verify your sending domain. For testing: use `onboarding@resend.dev` as the sender (can only send to your own verified email address)

### 2. Deploy the Cloudflare Worker

1. Create a free account at [workers.cloudflare.com](https://workers.cloudflare.com)
2. Create a new Worker and paste `stamhoofd-proxy-worker.js`
3. Deploy — note your worker URL (e.g. `https://your-worker.your-name.workers.dev`)

#### Add secrets

In **Worker → Settings → Variables & Secrets**, add:

| Secret | Value |
|---|---|
| `STAMHOOFD_API_KEY` | Your Stamhoofd API key |
| `ADMIN_PASSWORD` | Your admin password |
| `RESEND_API_KEY` | Your Resend API key |
| `NOTIFY_TO` | Your email — receives access request notifications |
| `NOTIFY_FROM` | Sender address (`onboarding@resend.dev` for testing) |
| `DASHBOARD_URL` | `https://dennisgeleyn.github.io/kvk-dashboard` |

#### Create a KV namespace

1. **Cloudflare dashboard → Workers & Pages → KV → Create namespace** (name it anything)
2. **Worker → Settings → Variables → KV Namespace Bindings → Add binding**
   - Variable name: `KVK_STORE` (must be exactly this)
   - Namespace: select the one you just created
3. Redeploy the worker after adding the binding

### 3. Configure the dashboard

Open `index.html` and update the `DEFAULTS` block:

```js
const DEFAULTS = {
  orgId:     'your-organisation-id',
  webshopId: 'your-webshop-id',
  proxyUrl:  'https://your-worker.workers.dev',
};
```

### 4. Publish via GitHub Pages

1. Push `index.html` to a GitHub repository
2. **Settings → Pages** → set source to `main` branch
3. Live at `https://your-username.github.io/your-repo/`

---

## User management

### Admin login

On the login screen, enter `admin` or `beheerder` as the email address. You'll be prompted for the admin password.

### Granting access

Users click **"Toegang aanvragen"**, enter their name and email. You receive an email notification. Then:

1. Click **⚙ Instellingen** → scroll to **Gebruikersbeheer**
2. Click **Goedkeuren + stuur link** → user is approved and receives a magic login link by email immediately

### Revoking access

Click **Verwijderen** next to a user in **Gebruikersbeheer**. Their active sessions remain valid until they expire (max 7 days).

---

## Files

| File | Description |
|---|---|
| `index.html` | Complete dashboard — single file, no build required |
| `stamhoofd-proxy-worker.js` | Cloudflare Worker: proxy, auth, magic links, KV user management |
| `README.md` | This documentation |

---

## Credits

Built for internal use by **Koninklijke Toneelgroep Kunst Veredelt Kieldrecht vzw**  
Registered office: Kouterstraat 261, 9130 Kieldrecht, Belgium  
Company number: 1010.418.811 — RPR Ghent, Dendermonde division

Built with [Claude AI](https://claude.ai) by Anthropic.

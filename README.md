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
- **Mobile-friendly** — responsive layout, wide logo on desktop / square logo on mobile
- **Debug panel** — visible to admins only

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
2. User copies the link from the email and opens it in their browser
3. Worker validates the token → session is created in KV
4. Sessions last 7 days; tokens expire after 15 minutes and are single-use
5. To log in again after 7 days, they just request a new link

> **Note:** Magic links are currently sent as plain text (not clickable buttons). Once you verify your own domain in Brevo you can disable click tracking and switch back to clickable buttons.

Admin login uses a password (stored as a Worker secret, never in source code).

### Security model

- **API key** — Cloudflare Worker secret, never in the browser or source code
- **Admin password** — Cloudflare Worker secret, validated server-side
- **No passwords stored** for regular users — magic link tokens only
- **Sessions in KV** — invalidated on logout, expire server-side after 7 days
- **Login lockout** — 5 failed admin attempts triggers a 15-minute lockout
- **Email addresses** — only SHA-256 hashes stored in KV; display hints masked (`den***@gmail.com`)

---

## Setup

### 1. Create a Brevo account

1. Sign up at [brevo.com](https://brevo.com) (free tier: 300 emails/day, send to any recipient)
2. Go to **Senders & IPs → Senders → Add a sender** and verify your email address
3. Go to **Settings → API Keys** and create a new API key

### 2. Deploy the Cloudflare Worker

The worker auto-deploys to Cloudflare via GitHub Actions on every push to `main` that touches `stamhoofd-proxy-worker.js` or `wrangler.toml`.

For the initial manual setup:
1. Create a free account at [workers.cloudflare.com](https://workers.cloudflare.com)
2. Create a new Worker, paste `stamhoofd-proxy-worker.js`, and deploy
3. Note your worker URL (e.g. `https://wandering-boat-05cb.dennisgeleyn.workers.dev`)

#### Add secrets

In **Worker → Settings → Variables & Secrets**, add:

| Secret | Value |
|---|---|
| `STAMHOOFD_API_KEY` | Your Stamhoofd API key |
| `ADMIN_PASSWORD` | Your admin password |
| `BREVO_API_KEY` | Your Brevo API key |
| `NOTIFY_TO` | Your email — receives access request notifications |
| `NOTIFY_FROM` | A verified sender address in your Brevo account |
| `DASHBOARD_URL` | `https://dennisgeleyn.github.io/kvk-dashboard` |

> Secrets are set once in the Cloudflare dashboard and are never touched by GitHub Actions deployments.

#### Create a KV namespace

1. **Cloudflare dashboard → Workers & Pages → KV → Create namespace** (name it anything)
2. **Worker → Settings → Variables → KV Namespace Bindings → Add binding**
   - Variable name: `KVK_STORE` (must be exactly this)
   - Namespace: select the one you just created
3. Copy the namespace ID into `wrangler.toml`

#### GitHub Actions auto-deploy

Add these two secrets to your GitHub repo (**Settings → Secrets and variables → Actions**):

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right sidebar |

From then on, every push to `main` that touches the worker file deploys automatically.

### 3. Configure the dashboard

Open `index.html` and update the `DEFAULTS` block near the top of the script:

```js
const DEFAULTS = {
  orgId:     'your-organisation-id',
  webshopId: 'your-webshop-id',
  proxyUrl:  'https://your-worker.workers.dev',
};
```

### 4. Publish via GitHub Pages

1. Push all files to a GitHub repository
2. **Settings → Pages** → set source to `main` branch, root folder
3. Live at `https://your-username.github.io/your-repo/`

---

## User management

### Admin login

On the login screen, type `admin` or `beheerder` as the email address. A password prompt appears inline — no separate page.

### Granting access

1. User clicks **"Toegang aanvragen"**, fills in name and email
2. You receive an email notification
3. Log in as admin → **⚙ Instellingen** → **Gebruikersbeheer**
4. Click **Goedkeuren** → user is approved and immediately receives a magic login link by email

### Resending a magic link

If a user's link has expired or was lost, click **Stuur nieuwe link** next to their name in **Gebruikersbeheer**. You'll be prompted for their email address if it isn't stored yet (this only happens for users approved before this feature was added).

### Revoking access

Click **Verwijderen** next to a user in **Gebruikersbeheer**. Their active sessions expire within 7 days at most.

---

## Files

| File | Description |
|---|---|
| `index.html` | Complete dashboard — single file, no build required, logos embedded |
| `stamhoofd-proxy-worker.js` | Cloudflare Worker: API proxy, admin auth, magic links, KV user management |
| `wrangler.toml` | Wrangler config for automated Cloudflare deployments |
| `.github/workflows/deploy-worker.yml` | GitHub Actions workflow — auto-deploys worker on push |
| `README.md` | This file |

---

## Credits

Built for internal use by **Koninklijke Toneelgroep Kunst Veredelt Kieldrecht vzw**  
Registered office: Kouterstraat 261, 9130 Kieldrecht, Belgium  
Company number: 1010.418.811 — RPR Ghent, Dendermonde division

Built with [Claude](https://claude.ai) by Anthropic.

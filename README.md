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
- **Tickets per week** — bar chart with hover tooltip showing week number, date range, and total
- **Payment status breakdown** — overview of all payment statuses
- **Recent orders table** — paginated, 10 orders per page
- **Stamhoofd system status** — live status pill in the header
- **Auto-refresh** — data and status refresh every 5 minutes
- **Mobile-friendly** — responsive layout, tested on iOS Safari and Firefox

---

## Architecture

The dashboard is a **single HTML file** with no build step or external dependencies.

```
Browser → Cloudflare Worker → Stamhoofd API
                ↑
         (holds API key + admin password securely)
```

### Cloudflare Worker endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/proxy?url=...` | GET/POST | CORS proxy to Stamhoofd API — injects API key server-side |
| `/auth` | POST | Validates the admin password — returns 200 or 401 |
| `/notify` | POST | Sends an email notification when someone requests access |

### Security model

- **API key** — stored as a Cloudflare Worker secret (`STAMHOOFD_API_KEY`), never exposed to the browser
- **Admin password** — stored as a Cloudflare Worker secret (`ADMIN_PASSWORD`), validated server-side via `/auth`. No hash in the source code.
- **Login system** — full login screen with session management:
  - Sessions expire after **7 days**
  - **5 failed attempts** trigger a **15-minute lockout** (applies to both the login screen and settings panel)
  - Sessions stored in `localStorage` with expiry timestamp
- **User data privacy** — email addresses are **never stored in plaintext**. Only SHA-256 hashes and a masked display hint (`den***@gmail.com`) are kept in shared storage.
- **Password resets** — admin generates a random 8-character one-time token (valid 24 hours). User is prompted to set a new password after using it.

---

## Setup

### 1. Deploy the Cloudflare Worker

1. Create a free account at [workers.cloudflare.com](https://workers.cloudflare.com)
2. Create a new Worker and paste the contents of `stamhoofd-proxy-worker.js`
3. Deploy — you'll get a URL like `https://your-worker.your-name.workers.dev`
4. Add the following secrets in **Settings → Variables & Secrets**:

| Secret name | Value |
|---|---|
| `STAMHOOFD_API_KEY` | Your Stamhoofd API key |
| `ADMIN_PASSWORD` | Your chosen admin password |
| `NOTIFY_TO` | Email address to receive access request notifications |
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) (free tier: 100 emails/day) |
| `NOTIFY_FROM` | Sender address (use `onboarding@resend.dev` for testing, or a verified domain) |

> `RESEND_API_KEY`, `NOTIFY_TO`, and `NOTIFY_FROM` are optional. If omitted, access request notifications are simply not sent — the dashboard still works fully.

#### KV namespace binding (required for user management)

User accounts, access requests, and password reset tokens are stored in Cloudflare KV.

1. Go to **Cloudflare dashboard → Workers & Pages → KV**
2. Click **Create namespace** and name it anything (e.g. `kvk-store`)
3. Go to your Worker → **Settings → Variables → KV Namespace Bindings**
4. Click **Add binding** — set the variable name to exactly **`KVK_STORE`** and select the namespace you just created
5. Save and redeploy

### 2. Configure the dashboard

Open `index.html` and update the `DEFAULTS` block near the top of the script:

```js
const DEFAULTS = {
  orgId:     'your-organisation-id',
  webshopId: 'your-webshop-id',
  proxyUrl:  'https://your-worker.workers.dev',
};
```

The API key and admin password are no longer configured here — they live in the Worker.

### 3. Publish via GitHub Pages

1. Create a GitHub repository
2. Upload `index.html` as the main page
3. Go to **Settings → Pages** and set the source to the `main` branch
4. Your dashboard will be live at `https://your-username.github.io/your-repo/`

---

## User management

The dashboard has a built-in user system accessible from the admin settings panel.

### Logging in as admin

On the login screen, enter:
- **E-mailadres:** `admin` or `beheerder`
- **Wachtwoord:** your `ADMIN_PASSWORD`

### Granting access to others

Users can request access via the **"Toegang aanvragen"** tab on the login screen. As admin:

1. Click **⚙ Instellingen** in the toolbar
2. Scroll to **Gebruikersbeheer**
3. Pending requests appear with a name and masked email
4. Enter a password and click **Goedkeuren** — or click **Weigeren** to decline

### Resetting a password

1. In **Gebruikersbeheer**, click **Reset pw** next to the user
2. A one-time 8-character code is generated and shown in a popup (valid for 24 hours)
3. Share it with the user — they'll be prompted to set a new password after logging in

### Revoking access

Click **Verwijderen** next to any active user in **Gebruikersbeheer**.

---

## Files

| File | Description |
|---|---|
| `index.html` | The complete dashboard — single file, no build required |
| `stamhoofd-proxy-worker.js` | Cloudflare Worker: CORS proxy, admin auth, and email notifications |
| `README.md` | This documentation |

---

## Credits

Built for internal use by **Koninklijke Toneelgroep Kunst Veredelt Kieldrecht vzw**  
Registered office: Kouterstraat 261, 9130 Kieldrecht, Belgium  
Company number: 1010.418.811 — RPR Ghent, Dendermonde division

Built with [Claude AI](https://claude.ai) by Anthropic.

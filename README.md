# KVK Dashboard

Live ticketing dashboard for **Koninklijke Toneelgroep Kunst Veredelt Kieldrecht vzw**, built on top of the [Stamhoofd](https://stamhoofd.app) API.

🔗 **[dennisgeleyn.github.io/kvk-dashboard](https://dennisgeleyn.github.io/kvk-dashboard)**

---

## Features

- **Live sales data** — fetches all orders via the Stamhoofd API with pagination and deduplication
- **KPI overview** — total revenue, paid revenue, tickets sold, average order value
- **Shows** — per show: tickets sold, capacity (239 seats), seats remaining, and a traffic light for availability:
  - 🟢 **Vrij** — fewer than 194 tickets sold
  - 🟡 **Laatste kaarten** — 194 to 233 tickets sold
  - 🔴 **Uitverkocht** — 234 or more tickets sold
- **Tickets per week** — bar chart with week number and total on hover
- **Payment status** — breakdown of payment statuses (Succeeded, Created, etc.)
- **Recent orders** — table showing the latest orders, expandable 10 at a time
- **Stamhoofd system status** — live status pill in the header linked to status.stamhoofd.app
- **Auto-refresh** — data and status automatically refresh every 5 minutes
- **Mobile-friendly** — responsive layout, tested on iOS (Firefox/Safari)

---

## How it works

The dashboard is a single HTML file (`index.html`) with no external dependencies or build step required.

### Stamhoofd API
Data is fetched from the Stamhoofd v247 API:
- `GET /webshop/{id}/orders` — all orders using `updatedSince` + `lastId` cursor pagination
- `GET /webshop/{id}` — webshop data and product information

### CORS proxy (Cloudflare Worker)
The Stamhoofd API does not allow cross-origin requests from browsers. All API traffic is therefore routed through a Cloudflare Worker that acts as a CORS proxy.

The worker code lives in `stamhoofd-proxy-worker.js` and allows requests to:
- `api.stamhoofd.app`
- `status.stamhoofd.app`

### Security
- The settings panel is protected by an admin password (SHA-256 hashed, stored in the source code)
- Settings are saved locally via `localStorage` (per browser)
- The API key is baked into the file — keep the dashboard within a trusted group

---

## Setup & hosting

### 1. Deploy the Cloudflare Worker

1. Create a free account at [workers.cloudflare.com](https://workers.cloudflare.com)
2. Create a new Worker and paste the contents of `stamhoofd-proxy-worker.js`
3. Deploy — you'll get a URL like `https://your-worker.your-name.workers.dev`

### 2. Configure the dashboard

Open `index.html` in a text editor and update the `DEFAULTS` in the `CONFIG` block at the top of the script:

```js
const DEFAULTS = {
  orgId: 'your-organisation-id',
  webshopId: 'your-webshop-id',
  apiKey: 'your-api-key',
  capacity: 239,           // Total number of seats in the theatre
  proxyUrl: 'https://your-worker.workers.dev',
};
```

The admin password for the settings panel is stored as a SHA-256 hash. To change it:
```bash
echo -n 'your-password' | shasum -a 256
```
Then replace the value of `ADMIN_HASH` in the script with the output.

### 3. Publish via GitHub Pages

1. Create a GitHub repository
2. Upload `index.html` as the main page
3. Go to **Settings → Pages** and select the `main` branch as the source
4. Your dashboard will be live at `https://your-username.github.io/your-repo/`

---

## Files

| File | Description |
|---|---|
| `index.html` | The complete dashboard (single file, no build required) |
| `stamhoofd-proxy-worker.js` | Cloudflare Worker CORS proxy |
| `README.md` | This documentation |

---

## Credits

Built for internal use by **Koninklijke Toneelgroep Kunst Veredelt Kieldrecht vzw**  
Registered office: Kouterstraat 261, 9130 Kieldrecht, Belgium  
Company number: 1010.418.811 — RPR Ghent, Dendermonde division

Built with [Claude](https://claude.ai) by Anthropic.

# ANZ Zoho Lead Distribution Tracker

A browser-based single-page app for tracking monthly lead assignments across sales team
members, organised by segment. Real-time counters, end-of-month archiving with duplicate
protection, historical dashboards with charts, and CSV export. No backend, no auth — all
data lives in the browser's `localStorage`.

**Live app:** https://thilbad.github.io/leaddist/

## Features

- **Tracker** — segments (Retail, Mid Market, Mid Market – SOS) each with member cards.
  Increment/decrement leads (and a **BB** counter on applicable segments), add/remove members,
  live section subtotals and a grand total in the header.
- **Close month** — snapshots current counts to history and resets counters, with a
  confirmation modal. If the month already exists, choose **Replace** or **Add to existing**
  (merge).
- **History** — collapsible month cards showing the per-segment/per-member breakdown plus a
  **Chart.js** bar chart of leads per member (built lazily when a card is opened).
- **CSV download** — a download button on each month card exports just that month's data
  as a `.csv` file; the toolbar button downloads all months at once (UTF-8 with BOM, CRLF,
  quoted fields).
- **Light / dark theme** — follows your OS preference, with a manual toggle in the header.
- **Cloud sync** — the shared dataset lives in Supabase and syncs across all devices in
  real time. History is readable by anyone; **editing the Tracker requires a team passcode**
  that is verified and enforced by a database function (never stored in this repo). A sync
  status indicator and a lock/unlock control live in the header/close bar. `localStorage`
  is kept as an offline cache.
- Responsive down to 360px; seed data on first load.

## Tech

Plain HTML, CSS, and vanilla JavaScript — no build step.

- `index.html` — markup, loads Chart.js and Tabler Icons from CDN
- `styles.css` — theming (CSS custom properties for light/dark) and layout
- `app.js` — state, rendering, interactions, close-month flow, CSV, charts

Persistence key: `localStorage["anz_v3"]`.

## Running locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which publishes the site to
GitHub Pages automatically.

# LeadDist

Lead Distribution tracker for my team.

A lightweight, single-page web app to track and distribute sales leads across your team.
No backend — all data is stored in your browser's `localStorage`, so it runs anywhere,
including GitHub Pages.

**Live app:** https://thilbad.github.io/leaddist/

## Features

- **Dashboard** — totals, pipeline value, won count/value, conversion rate, and unassigned count.
- **Distribution view** — bar chart of how many leads each rep holds, plus one-click
  **auto-assign** that spreads unassigned leads round-robin to active reps by current load.
- **Leads** — add / edit / delete, search, filter by status/rep/source, sort columns, and
  reassign inline from the table.
- **Team** — manage reps, mark them active/inactive, and see per-rep leads, wins, and pipeline.
- **Data** — export to JSON or CSV, import from JSON, and reset.

## Tech

Plain HTML, CSS, and vanilla JavaScript — no build step and no dependencies.

- `index.html` — markup
- `styles.css` — styling
- `app.js` — state, rendering, and logic

## Running locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds and publishes
the site to GitHub Pages automatically.

# Affine Dash Starter — API + Frontend

This repo is a Vite React frontend with Vercel-ready Serverless API routes for querying the Affine production PostgreSQL database (read-only). It implements the simplest, quickest deployment path: Vercel serverless functions under the `/api` directory.

## What&#39;s Included

- Serverless API routes (Vercel) with `pg` connection pooling:
  - `GET /api/leaderboard` — Top 20 miners by average score (Query A)
  - `GET /api/activity` — Last 10 rollouts (Query B)
  - `GET /api/performance-by-env` — Performance grouped by environment (Query C)
  - `GET /api/results-over-time` — Aggregated by day for last 30d (Query D)
  - `GET /api/daily-rollouts-by-model` — Daily counts for top 5 models, last 7d (Query E)
- Shared DB pool helper: `api/_db.js` (SSL required, uses `DATABASE_URL`)
- Frontend typed client: `src/services/api.ts` (fetch helpers for all routes)
- Vite React app (currently using mock data; you can wire components to API when ready)

## Database (Read-only)

Use the following connection string as a single `DATABASE_URL` value:

```
postgresql://app_reader:ca35a0d8bd31d0d5@database-1.clo608s4ivev.us-east-1.rds.amazonaws.com:5432/postgres
```

Notes:
- SSL is required and enforced by `api/_db.js` via `ssl: { rejectUnauthorized: false }`.
- The DB user (`app_reader`) is read-only.

## API Endpoints and SQL

All queries are executed against `public.affine_results`:

- Leaderboard (A)
  - File: `api/leaderboard.js`
  - Fields: `hotkey`, `last_seen_uid`, `model`, `total_rollouts`, `average_score`, `success_rate_percent`, `avg_latency`
- Activity (B)
  - File: `api/activity.js`
  - Fields: `ingested_at`, `hotkey`, `uid`, `model`, `env_name`, `score`, `success`
- Performance by Environment (C)
  - File: `api/performance-by-env.js`
  - Fields: `env_name`, `total_rollouts`, `average_score`, `success_rate_percent`
- Results over Time (D)
  - File: `api/results-over-time.js`
  - Fields: `period` (day), `total_rollouts`, `average_score`
- Daily Rollouts per Model (E)
  - File: `api/daily-rollouts-by-model.js`
  - Fields: `day`, `model`, `daily_rollouts`

Each file contains the exact SQL from the provided spec.

## Local Development

You have two options:

1) Use Vercel Dev (recommended so `/api` routes work locally)
- Prereqs:
  - Node.js 18+ (or 20+)
  - Vercel CLI: `npm i -g vercel` (or `pnpm add -g vercel`)
- Create a local env file `.env.local` at repo root:
  ```
  DATABASE_URL=postgresql://app_reader:ca35a0d8bd31d0d5@database-1.clo68s4ivev.us-east-1.rds.amazonaws.com:5432/postgres
  ```
- Start the full stack locally (frontend + API):
  ```
  vercel dev
  ```
  This serves both the Vite app and the `/api/*` endpoints on the same origin.

2) Run Vite only (frontend only; API will 404)
- If you just run `npm run dev`, the `/api/*` endpoints are not served.
- Use this only for UI work that doesn&#39;t call the backend, or set up a proxy to a remote deployment.

## Deploy to Vercel (Easiest & Quickest)

- Push this repo to GitHub.
- In Vercel:
  1. Import the repo as a new Project.
  2. In Project > Settings > Environment Variables, add:
     - Name: `DATABASE_URL`
     - Value: `postgresql://app_reader:ca35a0d8bd31d0d5@database-1.clo68s4ivev.us-east-1.rds.amazonaws.com:5432/postgres`
  3. Redeploy to apply env vars.

After deploy, your API will be available at:
```
https://<your-project>.vercel.app/api/leaderboard
https://<your-project>.vercel.app/api/activity
https://<your-project>.vercel.app/api/performance-by-env
https://<your-project>.vercel.app/api/results-over-time
https://<your-project>.vercel.app/api/daily-rollouts-by-model
```

Optional region optimization:
- The database is in us-east-1. You can set Vercel Serverless region to a nearby US region (e.g., IAD) via a `vercel.json` later to reduce latency.
- Not required for functionality.

## Frontend Usage

A typed client for the endpoints is provided:
- `src/services/api.ts`
  - `fetchLeaderboard()`
  - `fetchActivity()`
  - `fetchPerformanceByEnv()`
  - `fetchResultsOverTime()`
  - `fetchDailyRolloutsByModel()`

Example:
```ts
import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardRow } from './services/api';

export function Example() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  return (
    <ul>
      {rows.map((r) => (
        <li key={`${r.hotkey}-${r.model}`}>{r.hotkey} — {r.model}: {r.average_score.toFixed(3)}</li>
      ))}
    </ul>
  );
}
```

Note: To have `/api` available during local development, run `vercel dev`.

## Quick cURL Tests

Once running (locally with `vercel dev` or on Vercel):

```
curl http://localhost:3000/api/leaderboard
curl http://localhost:3000/api/activity
curl http://localhost:3000/api/performance-by-env
curl http://localhost:3000/api/results-over-time
curl http://localhost:3000/api/daily-rollouts-by-model
```

Replace `localhost:3000` with your deployed domain on Vercel to test in production.

## Security

- Do not commit secrets. `DATABASE_URL` must be set via Vercel Project Settings or `.env.local` for local development.
- The DB user here is read-only (`app_reader`).

## Scripts

- `npm run dev` — Vite dev server (frontend only)
- `npm run build` — Build frontend
- `npm run preview` — Preview built frontend
- For full-stack local dev (frontend + API): `vercel dev`

## Tech

- Vercel Serverless Functions under `api/`
- Node.js + `pg` v8
- React 18 + Vite + Tailwind

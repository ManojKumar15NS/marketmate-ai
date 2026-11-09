# MarketMate AI — Production Deployment Guide
**Frontend**: Vercel | **Backend**: Render | **Database**: Neon PostgreSQL | **Repository**: GitHub

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │             Vercel Frontend             │
                      │         (React 19 + Vite 6 SPA)         │
                      │       https://your-app.vercel.app       │
                      └────────────────────┬────────────────────┘
                                           │
                                HTTPS / WSS API Requests
                        (VITE_API_BASE_URL -> Render Backend)
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │              Render Backend             │
                      │     (Node.js + Express + Worker Pool)   │
                      │    https://your-server.onrender.com     │
                      └────────────────────┬────────────────────┘
                                           │
                                  SSL Connection Pool
                                 (pg.Pool + JSONB DDL)
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │             Neon PostgreSQL             │
                      │        (Serverless PostgreSQL 16)       │
                      │          13 Structured Tables           │
                      └─────────────────────────────────────────┘
```

---

## 1. Neon PostgreSQL Setup

1. Log in to [Neon Console](https://console.neon.tech/).
2. Create a new project (e.g. `marketmate-ai-db`).
3. Select your preferred AWS/GCP region closest to your Render server (e.g., `us-east-2` Ohio or `us-east-1` N. Virginia).
4. On the Neon Dashboard, copy your connection string from the **Connection Details** widget. Ensure **Pooled connection** or standard connection with `sslmode=require` is selected.
   ```
   postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Save this URL for Step 3 (Render) and Step 5 (Migration).

---

## 2. GitHub Repository Setup

From your local machine or terminal:

```bash
cd marketmate-ai

# Initialize Git (if not already initialized)
git init

# Stage all files (sensitive files and SQLite backups are already gitignored)
git add .

# Create initial migration commit
git commit -m "feat: complete SQLite to PostgreSQL migration for Vercel, Render & Neon"

# Set main branch and link your GitHub remote
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/marketmate-ai.git

# Push to GitHub
git push -u origin main
```

---

## 3. Render Backend Deployment

### Option A: Using Blueprint (Recommended)
1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** -> **Blueprint**.
2. Connect your GitHub repository `marketmate-ai`.
3. Render will automatically detect `render.yaml` and configure the web service with:
   - **Runtime**: Node
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Health Check Path**: `/api/health`

### Option B: Manual Web Service Setup
1. Click **New +** -> **Web Service**.
2. Select your repository `marketmate-ai`.
3. Configure the settings:
   - **Name**: `marketmate-ai-server`
   - **Region**: Same region as your Neon database (e.g. Ohio / Oregon / Frankfurt).
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Starter` (or Free)
4. Under **Advanced** -> **Health Check Path**, enter: `/api/health`.
5. Under **Environment Variables**, add:

| Key | Example Value | Description |
|---|---|---|
| `PORT` | `10000` | Render assigns this dynamically; default `10000` |
| `NODE_ENV` | `production` | Enables production optimizations |
| `DATABASE_URL` | `postgresql://neondb_owner:pass@ep-...neon.tech/neondb?sslmode=require` | Your Neon database URL |
| `FRONTEND_URL` | `https://your-marketmate.vercel.app` | Production CORS domain |
| `GEMINI_API_KEY` | `AIzaSy...` | Required for AI research and structuring |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Fast, cost-effective Gemini model |
| `TAVILY_API_KEY` | `tvly-...` | Required for live web scraping & LinkedIn search |
| `HUNTER_API_KEY` | `your_hunter_key` | Optional: for Hunter.io email discovery |
| `PAGESPEED_API_KEY` | `your_pagespeed_key` | Optional: for Google PageSpeed SEO metrics |
| `GOOGLE_PLACES_API_KEY` | `your_places_key` | Optional: for radius discovery maps |
| `AUTH_TOKEN` | `generate-a-strong-random-token` | Protects backend settings and management API |
| `ADMIN_PASSWORD` | `your-admin-password` | Admin login password |

6. Click **Create Web Service**. Wait for the build and deployment to succeed.
7. Note your Render backend URL (e.g. `https://marketmate-ai-server.onrender.com`).

---

## 4. Vercel Frontend Deployment

1. Log in to [Vercel](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2. Import your GitHub repository `marketmate-ai`.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client` (Click "Edit" and select the `client` folder)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
4. Under **Environment Variables**, add:

| Key | Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://marketmate-ai-server.onrender.com` | Your deployed Render backend URL |

5. Click **Deploy**. Vercel will build the frontend assets.
6. Once deployed, note your frontend URL (e.g. `https://marketmate-ai.vercel.app`).
7. Update the `FRONTEND_URL` variable in your Render Dashboard to match this Vercel domain to ensure CORS requests are accepted.

---

## 5. Running the Database Migration Script

To migrate all pre-existing records (jobs, company profiles, research sessions, competitors, campaigns, leads, email searches, documents, tasks) into your live Neon PostgreSQL database:

### From Your Local Machine:
```bash
# Navigate to server directory
cd server

# Set your Neon connection string in server/.env or export in shell:
export DATABASE_URL="postgresql://neondb_owner:YOUR_PASS@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Execute migration
npm run db:migrate
```

### What the Migration Does Automatically:
1. **Safety Backup**: Creates an untouched copy of your SQLite database and all JSON files in `data/backup_pre_postgres_<timestamp>/`.
2. **Schema Creation**: Connects via SSL pool and applies `server/src/db/migrations/001_initial_schema.sql` (creating all 13 tables and indexes).
3. **Data Ingestion**: Ingests all 253 records from SQLite and JSON files into PostgreSQL using parameterized SQL and JSONB formatting with conflict handling.
4. **Count Verification**: Verifies PostgreSQL row counts match source data counts and prints the audit report.

---

## 6. Verification and Health Probes

Once deployed:

### Liveness Probe
```bash
curl https://your-server.onrender.com/api/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2026-11-09T18:25:00.000Z",
  "geminiConfigured": true,
  "activeModel": "gemini-2.5-flash"
}
```

### Readiness Probe (Verifies PostgreSQL Pool & Gemini)
```bash
curl https://your-server.onrender.com/api/ready
```
Response:
```json
{
  "status": "ready",
  "database": "connected (Neon PostgreSQL Pool)",
  "engine": "postgresql",
  "gemini": "configured",
  "timestamp": "2026-11-09T18:25:00.000Z"
}
```

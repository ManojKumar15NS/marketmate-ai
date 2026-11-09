# MarketMate AI — Autonomous B2B Prospecting & Marketing Intelligence Platform

MarketMate AI is a production-grade, dynamic B2B prospecting platform and multi-tool agent workspace. It executes an end-to-end autonomous 6-stage research pipeline for any company URL, crawls websites with SSRF protection, extracts verified LinkedIn decision-makers, crafts tailored 1:1 outreach, and operates with a persistent SQLite background job queue.

---

## 🏗️ Architecture Overview

```
                          ┌───────────────────────────────┐
                          │   Client (React 18 + Vite)    │
                          │   SPA / Tailwind / EventSource│
                          └───────────────┬───────────────┘
                                          │
                            REST API / SSE (Jobs Stream)
                                          │
                          ┌───────────────▼───────────────┐
                          │    Server (Node 22 Express)   │
                          │    Auth & Security Headers    │
                          └───────┬───────────────┬───────┘
                                  │               │
                    ┌─────────────▼─────┐   ┌─────▼───────────────┐
                    │ SQLite Database   │   │ Worker Runner Pool  │
                    │ WAL Mode / Jobs   │   │ Detached from HTTP  │
                    │ Agent Cache Store │   │ Per-job AbortSignals│
                    └───────────────────┘   └─────┬───────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
       ┌─────────▼────────┐             ┌─────────▼────────┐             ┌─────────▼────────┐
       │  B2B Prospector  │             │   SEO Auditor    │             │  LinkedIn Finder │
       │  6-Stage Engine  │             │   SSRF-Safe /    │             │  Tavily / Hunter │
       │  Map Discovery   │             │   PageSpeed API  │             │  Email Cascade   │
       └──────────────────┘             └──────────────────┘             └──────────────────┘
```

---

## 🌟 Key Features

1. **Autonomous 6-Stage B2B Prospector**:
   - Universal URL input (any company website).
   - Stage 1: Deep company profile extraction.
   - Stage 2: Verified direct and indirect competitor mapping.
   - Stage 3: Target campaign and buying-intent keyword grouping.
   - Stage 4: Map & directory potential account discovery.
   - Stage 5: Decision-maker identification with public LinkedIn profile URLs.
   - Stage 6: Personalized 1:1 cold email copywriting.

2. **Persistent Background Job System**:
   - SQLite database (`node:sqlite` WAL mode) tracking all jobs: `jobId`, `agentId`, `status`, `progress`, `currentStage`, `result`, `error`, `timestamps`.
   - Workers run completely detached from HTTP requests and React unmounting.
   - Survives browser refresh and route navigation.
   - Survives server restart: any in-flight jobs are cleanly marked as `interrupted` with a one-click **Retry** button.
   - Slide-over **Background Activity Panel** for monitoring and managing all jobs across the platform.

3. **Technical SEO & GEO Auditor**:
   - Crawls real websites with strict SSRF protection and robots.txt compliance.
   - Deterministic, code-calculated scoring (0-100).
   - Performance metrics come strictly from Google PageSpeed Insights API (otherwise reported honestly as "Not measured").
   - Detailed findings with URL, actual extracted values, HTML evidence, and code fixes.

4. **Decoupled LinkedIn People & Email Discovery**:
   - Public LinkedIn People Discovery works 100% independently of Hunter.
   - Professional email discovery is strictly optional and never fabricates fake emails.
   - Hunter credit exhaustion (402/429) displays "Hunter credits exhausted" while keeping all discovered people and LinkedIn links intact.

5. **Security & Operations Ready**:
   - Server-side authentication on API endpoints.
   - Strict CORS origin restriction.
   - Rate limiting and security headers (no MIME-sniffing, clickjacking protection, no X-Powered-By).
   - SSRF protection against private CIDRs and cloud metadata endpoints.
   - Automated secret scrubbing on all logs (never outputs raw keys).

---

## ⚙️ Environment Variables Reference

Copy `.env.example` to `server/.env` and populate the values:

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional (default: `5000`) | Server listening port |
| `NODE_ENV` | Optional (default: `development`) | Environment mode (`development`, `production`, `test`) |
| `FRONTEND_URL` | Optional (default: `http://localhost:5173`) | Allowed CORS origin |
| `GEMINI_API_KEY` | Required | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | Optional (default: `gemini-flash-lite-latest`) | Active Gemini model |
| `TAVILY_API_KEY` | Optional | Tavily Search API key for real-time web grounding and public LinkedIn discovery |
| `HUNTER_API_KEY` | Optional | Hunter.io API key for optional on-demand email verification |
| `PAGESPEED_API_KEY` | Optional | Google PageSpeed Insights API key for Lighthouse performance metrics |
| `AUTH_TOKEN` | Optional | Secret Bearer token for API protection. If omitted, an internal token is generated |
| `ADMIN_PASSWORD` | Optional (default: `admin`) | Admin password for logging in to protected endpoints |
| `DATABASE_PATH` | Optional | Custom path for SQLite database file (defaults to `server/data/marketmate.sqlite`) |

---

## 🚀 Running Locally

### 1. Prerequisites
- **Node.js**: v20+ or v22+ (tested on Node v22.15.1)
- **npm**: v10+

### 2. Quickstart
```bash
# Clone the repository
git clone https://github.com/your-org/marketmate-ai.git
cd marketmate-ai

# Install root, client, and server dependencies
npm install --prefix server
npm install --prefix client

# Configure environment
cp .env.example server/.env
# Edit server/.env and add your GEMINI_API_KEY

# Build both client and server
npm run build

# Start the production application
npm start
```
The application will be accessible at:
- Web Application: `http://localhost:5000`
- API Health Check: `http://localhost:5000/api/health`
- Readiness Probe: `http://localhost:5000/api/ready`

### 3. Development Mode
To run with hot-reloading for client and server:
```bash
# Terminal 1: Backend
npm run dev --prefix server

# Terminal 2: Frontend
npm run dev --prefix client
```

---

## 🐳 Docker Deployment

### 1. Build and Run with Docker Compose
```bash
# Build the multi-stage container and start with persistent SQLite storage
docker-compose up --build -d

# Check running status and health check
docker-compose ps

# View real-time logs (with secret redaction)
docker-compose logs -f
```

### 2. Standalone Docker Run
```bash
# Build image
docker build -t marketmate-ai:latest .

# Run container with volume mount for SQLite persistence
docker run -d \
  --name marketmate-ai \
  -p 5000:5000 \
  --env-file server/.env \
  -v marketmate_data:/app/server/data \
  marketmate-ai:latest
```

---

## ☁️ Cloud Deployment (Render / Railway / VPS)

### Deploying on Railway or Render
1. Connect your Git repository.
2. Set the build command: `npm run build`
3. Set the start command: `npm start`
4. Add a Persistent Disk / Volume mounted at `/app/server/data` (to preserve SQLite database, jobs, and settings across redeployments).
5. Add your environment variables (`GEMINI_API_KEY`, `TAVILY_API_KEY`, `HUNTER_API_KEY`, `NODE_ENV=production`).

---

## 🔑 Adding Optional Provider Keys

### 1. Hunter.io (Professional Email Discovery)
- Obtain an API key from [Hunter.io](https://hunter.io).
- Navigate to **System Settings** (`/settings`) in MarketMate AI.
- In the **Hunter.io API Configuration** card, enter your API key and click **Test Connection**.
- Once verified, toggle email discovery on.

### 2. Google PageSpeed Insights (Technical SEO Speed Metrics)
- Obtain an API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
- Add `PAGESPEED_API_KEY=your_key_here` to `server/.env`.
- Restart the server. Running an SEO audit on `/seo` will automatically populate real mobile Lighthouse speed scores, FCP, LCP, and CLS.

---

## 💾 Database Persistence & Backup

MarketMate AI stores jobs, agent cache, and research history in SQLite at `server/data/marketmate.sqlite`.

To create a hot backup while the server is running:
```bash
# SQLite online safe backup
sqlite3 server/data/marketmate.sqlite ".backup server/data/marketmate.backup.sqlite"
```
To restore:
```bash
cp server/data/marketmate.backup.sqlite server/data/marketmate.sqlite
```

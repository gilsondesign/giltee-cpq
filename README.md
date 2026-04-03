# Giltee Ledger

Internal quote management tool for Giltee Apparel Co.

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Google Cloud OAuth app (for auth)

### Install

```bash
npm install
```

### Database

```bash
createdb giltee_ledger
psql giltee_ledger < server/db/schema.sql
```

### Environment

```bash
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, APP_URL
```

**Google OAuth setup:**
1. Create a project in Google Cloud Console
2. Enable the Google+ API
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:5173/auth/google/callback` as an authorized redirect URI
5. Copy Client ID and Secret to `.env`

### Run

```bash
npm run dev        # Start both servers
npm run server     # Express only (port 3001)
npm run client     # Vite only (port 5173)
npm test           # Run all tests
```

### Admin Bootstrap

Set `ADMIN_EMAIL=your@email.com` in `.env`. On first server start, that account is created as admin. Sign in with Google using that account — no invite needed.

## Deployment (Render)

See `render.yaml`. Set all `sync: false` env vars manually in the Render dashboard.
Add `https://your-app.onrender.com/auth/google/callback` to your Google OAuth app's authorized redirect URIs.

## Plan Status

- [x] Plan A: Foundation (auth, user management, DB)
- [ ] Plan B: Backend services + API routes
- [ ] Plan C: Frontend pages + integration wiring

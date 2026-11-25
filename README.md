# KUC – Kalanja United Club

*United We Play, United We Grow.*

Full-stack club management portal built with **React 19**, **Vite**, **Tailwind CSS v4**, **Express**, and **SQLite (`better-sqlite3`)**.

## Features

- **Admin-Only Security**: First-run admin setup (or `ADMIN_PASSCODE` env override), scrypt-hashed passwords, HMAC-signed Bearer session tokens, and protected `/api/*` routes.
- **Dashboard & Navigation Lock**: Summary metrics, weekly collection snapshot, audit log feed, and automatic lock of Stats, Money, Search, Committee, and Awards until at least one player is registered.
- **Players Management**: Auto-generated unique IDs (`KUC-0001`), full profile views, search/filter/sort, and linked stats/payments/honors history.
- **Stats & Match History**: Player match logs, cumulative totals, club leaderboard, and performance charts.
- **Weekly Money System**: Automated ₹10/week dues per active player, duplicate-payment prevention, weekly/monthly/yearly totals, and financial reports.
- **KUC Google (Internal Search)**: Instant offline search across players, IDs, statistics, payments, committees, and awards.
- **Annual Committees & Awards**: Yearly committee builder plus annual Golden Ball, Golden Boot, and Golden Gloves awards gated by an explicit **Start New Year** action.
- **Activity Log**: Audit trail of all administrative updates.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment template and configure optional variables:
   ```bash
   cp .env.example .env
   ```
3. Start development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   npm start
   ```

## Publishing via GitHub

Because this application runs an **Express + SQLite (`better-sqlite3`)** backend, **GitHub Pages** (static HTML only) cannot execute the API or database. Push the repository to GitHub first, then connect that GitHub repo to a Node.js host:

1. **Push to GitHub** (via AI Studio's **Save to GitHub** button or `git push -u origin main`).
2. **Deploy from GitHub** on **Render**, **Railway**, **Fly.io**, or **Google Cloud Run**:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**: `NODE_ENV=production`, `SESSION_SECRET` (random 32+ char string), and optional `ADMIN_PASSCODE`
   - **Persistent Disk**: Mount a persistent volume at `/app/data` (or project `data/`) so `kuc.db` survives redeployments.

> Note: Local club records are stored in `data/kuc.db` (ignored by Git via `.gitignore`).


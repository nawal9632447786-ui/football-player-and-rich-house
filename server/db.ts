import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kuc.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS club_sequences (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );

  INSERT OR IGNORE INTO club_sequences (key, value) VALUES ('next_player_num', 1);

  CREATE TABLE IF NOT EXISTS admin_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    photo_url TEXT NOT NULL DEFAULT '',
    age INTEGER NOT NULL,
    date_of_birth TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    position TEXT NOT NULL,
    joining_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_date TEXT NOT NULL,
    opponent TEXT NOT NULL,
    competition TEXT NOT NULL DEFAULT 'Club Friendly',
    venue TEXT NOT NULL DEFAULT 'KUC Home Ground',
    kuc_score INTEGER NOT NULL DEFAULT 0,
    opponent_score INTEGER NOT NULL DEFAULT 0,
    result TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
    record_date TEXT NOT NULL,
    record_label TEXT NOT NULL,
    matches_played INTEGER NOT NULL DEFAULT 0,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    yellow_cards INTEGER NOT NULL DEFAULT 0,
    red_cards INTEGER NOT NULL DEFAULT 0,
    clean_sheets INTEGER NOT NULL DEFAULT 0,
    saves INTEGER NOT NULL DEFAULT 0,
    goals_conceded INTEGER NOT NULL DEFAULT 0,
    attendance REAL NOT NULL DEFAULT 100,
    performance_rating REAL NOT NULL DEFAULT 7.0,
    custom_stats TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    week_label TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'UNPAID',
    paid_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(player_id, week_start)
  );

  CREATE TABLE IF NOT EXISTS financial_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    payment_id INTEGER REFERENCES weekly_payments(id) ON DELETE SET NULL,
    tx_type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    direction TEXT NOT NULL,
    description TEXT NOT NULL,
    tx_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS committees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS committee_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    assigned_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS award_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    started_by TEXT NOT NULL DEFAULT 'admin',
    started_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'ANNUAL',
    award_year INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    winner_photo_url TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL,
    performance_details TEXT NOT NULL DEFAULT '',
    goals_scored INTEGER NOT NULL DEFAULT 0,
    clean_sheets INTEGER NOT NULL DEFAULT 0,
    saves INTEGER NOT NULL DEFAULT 0,
    goals_conceded INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(category, period_type, award_year)
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    details TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'admin',
    entity_type TEXT,
    entity_id INTEGER,
    created_at TEXT NOT NULL
  );
`);

db.exec(`
  UPDATE awards SET period_type = 'ANNUAL' WHERE period_type != 'ANNUAL';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_awards_category_year ON awards(category, award_year);
`);

const existingAwardYears = db.prepare(`SELECT DISTINCT award_year FROM awards`).all() as Array<{ award_year: number }>;
for (const row of existingAwardYears) {
  db.prepare(
    `INSERT OR IGNORE INTO award_years (year, title, is_active, started_by, started_at)
     VALUES (?, ?, 1, 'admin', ?)`,
  ).run(row.award_year, `${row.award_year} Annual Awards`, new Date().toISOString());
}

const activityCols = db.prepare(`PRAGMA table_info(activity_logs)`).all() as Array<{ name: string }>;
const activityColNames = new Set(activityCols.map((c) => c.name));
if (!activityColNames.has('actor')) {
  db.exec(`ALTER TABLE activity_logs ADD COLUMN actor TEXT NOT NULL DEFAULT 'admin'`);
}
if (!activityColNames.has('entity_type')) {
  db.exec(`ALTER TABLE activity_logs ADD COLUMN entity_type TEXT`);
}
if (!activityColNames.has('entity_id')) {
  db.exec(`ALTER TABLE activity_logs ADD COLUMN entity_id INTEGER`);
}

export function getCurrentWeekInfo(referenceDate?: string): { weekStart: string; weekLabel: string } {
  const base = referenceDate ? new Date(`${referenceDate}T00:00:00Z`) : new Date();
  const utcDay = base.getUTCDay();
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + diffToMonday));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const shortFmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  const startOfYear = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
  const pastDays = Math.floor((monday.getTime() - startOfYear.getTime()) / 86400000);
  const weekNum = Math.ceil((pastDays + startOfYear.getUTCDay() + 1) / 7);

  return {
    weekStart: fmt(monday),
    weekLabel: `${monday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')} · ${shortFmt(monday)} – ${shortFmt(sunday)}`,
  };
}

export function generateNextPlayerCode(): string {
  const row = db.prepare(`SELECT value FROM club_sequences WHERE key = 'next_player_num'`).get() as { value: number } | undefined;
  let nextNum = row ? row.value : 1;

  while (true) {
    const candidate = `KUC-${String(nextNum).padStart(4, '0')}`;
    const exists = db.prepare(`SELECT 1 FROM players WHERE player_code = ?`).get(candidate);
    if (!exists) {
      db.prepare(`INSERT OR REPLACE INTO club_sequences (key, value) VALUES ('next_player_num', ?)`).run(nextNum + 1);
      return candidate;
    }
    nextNum += 1;
  }
}

export interface ActivityMeta {
  actor?: string;
  entityType?: string;
  entityId?: number | null;
}

export function logActivity(
  category: string,
  action: string,
  details: string,
  meta: ActivityMeta = {},
): void {
  const actor = meta.actor && meta.actor.trim() ? meta.actor.trim() : 'admin';
  const entityType = meta.entityType || null;
  const entityId = typeof meta.entityId === 'number' && Number.isFinite(meta.entityId) ? meta.entityId : null;
  db.prepare(
    `INSERT INTO activity_logs (action, category, details, actor, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(action, category, details, actor, entityType, entityId, new Date().toISOString());
}

export function ensureWeeklyPaymentsForWeek(weekStartInput?: string): { weekStart: string; weekLabel: string } {
  const { weekStart, weekLabel } = getCurrentWeekInfo(weekStartInput);
  const activePlayers = db.prepare(`SELECT id FROM players WHERE status = 'Active'`).all() as Array<{ id: number }>;
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO weekly_payments (player_id, week_start, week_label, amount, status, created_at)
    VALUES (?, ?, ?, 10, 'UNPAID', ?)
  `);

  const runTx = db.transaction(() => {
    for (const p of activePlayers) {
      insertStmt.run(p.id, weekStart, weekLabel, now);
    }
  });
  runTx();

  return { weekStart, weekLabel };
}

export default db;

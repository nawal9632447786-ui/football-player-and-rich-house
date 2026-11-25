import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import db, {
  ensureWeeklyPaymentsForWeek,
  generateNextPlayerCode,
  getCurrentWeekInfo,
  logActivity,
} from './server/db.ts';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const revokedTokens = new Set<string>();

interface TokenPayload {
  sub: string;
  displayName: string;
  jti: string;
  exp: number;
}

interface AuthedRequest extends Request {
  admin?: TokenPayload;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function safeStringCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signToken(username: string, displayName: string): string {
  const payload: TokenPayload = {
    sub: username,
    displayName,
    jti: crypto.randomUUID(),
    exp: Date.now() + 1000 * 60 * 60 * 24,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    if (!safeStringCompare(sig, expectedSig)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (revokedTokens.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function isAdminConfigured(): { configured: boolean; envOverride: boolean } {
  const envPass = getEnvPasscode();
  if (envPass.length > 0) {
    return { configured: true, envOverride: true };
  }
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM admin_accounts`).get() as { count: number };
  return { configured: countRow.count > 0, envOverride: false };
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.admin = payload;
  next();
}

function sanitizeImageUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/src/assets/')) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    if (trimmed.length > 2_500_000) {
      throw new Error('Image file is too large. Please choose a smaller photo (under 1.8 MB).');
    }
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    // invalid URL
  }
  return '';
}

function computeAgeFromDob(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 18;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(5, Math.min(99, age));
}

function computeTotalClubBalance(): number {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS balance
      FROM financial_transactions`,
    )
    .get() as { balance: number };
  return row?.balance ?? 0;
}

const VALID_POSITIONS = new Set(['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Winger']);
const VALID_STATUSES = new Set(['Active', 'Injured', 'Suspended', 'Inactive']);
const VALID_AWARD_CATEGORIES = new Set(['GOLDEN_BALL', 'GOLDEN_BOOT', 'GOLDEN_GLOVES']);
const VALID_COMMITTEE_POSITIONS = new Set([
  'President',
  'Vice President',
  'General Secretary',
  'Joint Secretary',
  'Treasurer',
  'Joint Treasurer',
  'Executive Members',
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // ==================== AUTH ROUTES ====================
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const { configured, envOverride } = isAdminConfigured();
    const token = extractBearerToken(req);
    const payload = token ? verifyToken(token) : null;
    res.json({
      configured,
      envOverride,
      authenticated: Boolean(payload),
      admin: payload ? { username: payload.sub, displayName: payload.displayName } : null,
    });
  });

  app.post('/api/auth/setup', (req: Request, res: Response) => {
    const { configured } = isAdminConfigured();
    if (configured) {
      res.status(409).json({ error: 'Admin account is already configured.' });
      return;
    }
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : 'admin';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim()
        : 'Club Administrator';

    if (!username || username.length < 3) {
      res.status(400).json({ error: 'Admin username must be at least 3 characters.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Admin password must be at least 6 characters.' });
      return;
    }

    const hash = hashPassword(password);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO admin_accounts (username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)`)
      .run(username, hash, displayName, now);

    logActivity('AUTH', 'Admin Claimed', `Initial administrator account (${username}) configured.`, {
      actor: username,
      entityType: 'AUTH',
    });
    const token = signToken(username, displayName);
    res.status(201).json({
      token,
      admin: { username, displayName },
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { configured, envOverride } = isAdminConfigured();
    if (!configured) {
      res.status(400).json({ error: 'Admin password has not been set up yet.' });
      return;
    }

    const usernameInput = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!usernameInput || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const envPass = getEnvPasscode();
    if (envOverride && envPass.length > 0) {
      const existingAdmin = db
        .prepare(`SELECT username, display_name FROM admin_accounts LIMIT 1`)
        .get() as { username: string; display_name: string } | undefined;
      const expectedUsername = existingAdmin ? existingAdmin.username : 'admin';
      const displayName = existingAdmin ? existingAdmin.display_name : 'Club Administrator';

      if (usernameInput !== expectedUsername && usernameInput !== 'admin') {
        res.status(401).json({ error: 'Invalid admin credentials.' });
        return;
      }
      if (!safeStringCompare(password, envPass)) {
        res.status(401).json({ error: 'Invalid admin credentials.' });
        return;
      }
      const token = signToken(usernameInput, displayName);
      logActivity('AUTH', 'Admin Login', `Administrator ${usernameInput} signed in.`, {
        actor: usernameInput,
        entityType: 'AUTH',
      });
      res.json({ token, admin: { username: usernameInput, displayName } });
      return;
    }

    const adminRow = db
      .prepare(`SELECT username, password_hash, display_name FROM admin_accounts WHERE username = ?`)
      .get(usernameInput) as { username: string; password_hash: string; display_name: string } | undefined;

    if (!adminRow || !verifyPassword(password, adminRow.password_hash)) {
      res.status(401).json({ error: 'Invalid admin username or password.' });
      return;
    }

    const token = signToken(adminRow.username, adminRow.display_name);
    logActivity('AUTH', 'Admin Login', `Administrator ${adminRow.username} signed in.`, {
      actor: adminRow.username,
      entityType: 'AUTH',
    });
    res.json({
      token,
      admin: { username: adminRow.username, displayName: adminRow.display_name },
    });
  });

  app.post('/api/auth/logout', requireAdmin, (req: AuthedRequest, res: Response) => {
    if (req.admin) {
      revokedTokens.add(req.admin.jti);
      logActivity('AUTH', 'Admin Logout', `Administrator ${req.admin.sub} signed out.`, {
        actor: req.admin.sub,
        entityType: 'AUTH',
      });
    }
    res.json({ ok: true });
  });

  // ==================== DASHBOARD ROUTE ====================
  app.get('/api/dashboard', requireAdmin, (_req: Request, res: Response) => {
    const counts = db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) AS activeCount
        FROM players`,
      )
      .get() as { total: number; activeCount: number };

    const { weekStart } = ensureWeeklyPaymentsForWeek();
    const weekStats = db
      .prepare(
        `SELECT
          COALESCE(SUM(amount), 0) AS expected,
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS collected
        FROM weekly_payments WHERE week_start = ?`,
      )
      .get(weekStart) as { expected: number; collected: number };

    let currentCommitteeRow = db
      .prepare(`SELECT * FROM committees WHERE is_current = 1 ORDER BY year DESC LIMIT 1`)
      .get() as any;
    if (!currentCommitteeRow) {
      currentCommitteeRow = db.prepare(`SELECT * FROM committees ORDER BY year DESC LIMIT 1`).get() as any;
    }

    let currentCommittee = null;
    if (currentCommitteeRow) {
      const members = db
        .prepare(
          `SELECT cm.*, p.full_name, p.player_code, p.photo_url, p.position AS player_position
           FROM committee_members cm
           JOIN players p ON p.id = cm.player_id
           WHERE cm.committee_id = ?
           ORDER BY cm.id ASC`,
        )
        .all(currentCommitteeRow.id);
      currentCommittee = { ...currentCommitteeRow, members };
    }

    const recentActivities = db
      .prepare(`SELECT * FROM activity_logs ORDER BY id DESC LIMIT 12`)
      .all();

    const latestAwards = db
      .prepare(
        `SELECT a.*, p.full_name AS player_name, p.player_code, p.photo_url AS player_photo, p.position AS player_position
         FROM awards a
         JOIN players p ON p.id = a.player_id
         ORDER BY a.award_year DESC, a.period_type DESC, a.id DESC
         LIMIT 6`,
      )
      .all();

    res.json({
      playerCount: counts.total,
      activePlayerCount: counts.activeCount,
      hasPlayers: counts.total > 0,
      totalMoney: computeTotalClubBalance(),
      weeklyExpected: weekStats.expected,
      weeklyCollected: weekStats.collected,
      currentCommittee,
      recentActivities,
      latestAwards,
    });
  });

  // ==================== ACTIVITY LOGS ROUTE ====================
  app.get('/api/activity-logs', requireAdmin, (req: Request, res: Response) => {
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toUpperCase() : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (category && category !== 'ALL') {
      conditions.push(`category = ?`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(action LIKE ? OR details LIKE ? OR actor LIKE ? OR category LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (dateFrom) {
      conditions.push(`substr(created_at, 1, 10) >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`substr(created_at, 1, 10) <= ?`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const logs = db
      .prepare(`SELECT * FROM activity_logs ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM activity_logs ${whereClause}`)
      .get(...params) as { cnt: number };

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM activity_logs WHERE substr(created_at, 1, 10) = ?`)
      .get(todayStr) as { cnt: number };

    const catRows = db
      .prepare(`SELECT category, COUNT(*) AS cnt FROM activity_logs GROUP BY category`)
      .all() as Array<{ category: string; cnt: number }>;

    const categoryCounts: Record<string, number> = {};
    for (const r of catRows) {
      categoryCounts[r.category] = r.cnt;
    }

    res.json({
      logs,
      total: totalRow.cnt,
      todayCount: todayRow.cnt,
      categoryCounts,
    });
  });

  // ==================== PLAYERS ROUTES ====================
  app.get('/api/players', requireAdmin, (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const position = typeof req.query.position === 'string' ? req.query.position.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const sortBy = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push(`(p.full_name LIKE ? OR p.player_code LIKE ? OR p.phone LIKE ? OR p.position LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (position && position !== 'ALL') {
      conditions.push(`p.position = ?`);
      params.push(position);
    }
    if (status && status !== 'ALL') {
      conditions.push(`p.status = ?`);
      params.push(status);
    }

    let orderClause = 'p.id DESC';
    if (sortBy === 'name_asc') orderClause = 'p.full_name ASC';
    else if (sortBy === 'name_desc') orderClause = 'p.full_name DESC';
    else if (sortBy === 'age_asc') orderClause = 'p.age ASC';
    else if (sortBy === 'age_desc') orderClause = 'p.age DESC';
    else if (sortBy === 'oldest') orderClause = 'p.id ASC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const players = db
      .prepare(
        `SELECT p.*,
          COALESCE((SELECT SUM(goals) FROM player_statistics s WHERE s.player_id = p.id), 0) AS total_goals,
          COALESCE((SELECT SUM(matches_played) FROM player_statistics s WHERE s.player_id = p.id), 0) AS total_matches,
          COALESCE((SELECT ROUND(AVG(performance_rating), 1) FROM player_statistics s WHERE s.player_id = p.id), 0) AS avg_rating
        FROM players p
        ${whereClause}
        ORDER BY ${orderClause}`,
      )
      .all(...params);

    res.json({ players });
  });

  app.get('/api/players/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid player ID.' });
      return;
    }

    const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
    if (!player) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }

    const statTotals = db
      .prepare(
        `SELECT
          ? AS player_id,
          COALESCE(SUM(matches_played), 0) AS matches_played,
          COALESCE(SUM(goals), 0) AS goals,
          COALESCE(SUM(assists), 0) AS assists,
          COALESCE(SUM(wins), 0) AS wins,
          COALESCE(SUM(losses), 0) AS losses,
          COALESCE(SUM(draws), 0) AS draws,
          COALESCE(SUM(yellow_cards), 0) AS yellow_cards,
          COALESCE(SUM(red_cards), 0) AS red_cards,
          COALESCE(SUM(clean_sheets), 0) AS clean_sheets,
          COALESCE(SUM(saves), 0) AS saves,
          COALESCE(SUM(goals_conceded), 0) AS goals_conceded,
          COALESCE(ROUND(AVG(attendance), 1), 0) AS avg_attendance,
          COALESCE(ROUND(AVG(performance_rating), 2), 0) AS avg_rating,
          COUNT(*) AS record_count
        FROM player_statistics WHERE player_id = ?`,
      )
      .get(id, id);

    const statHistory = db
      .prepare(
        `SELECT s.*, m.opponent
         FROM player_statistics s
         LEFT JOIN matches m ON m.id = s.match_id
         WHERE s.player_id = ?
         ORDER BY s.record_date DESC, s.id DESC`,
      )
      .all(id);

    const payments = db
      .prepare(
        `SELECT wp.*, p.full_name, p.player_code
         FROM weekly_payments wp
         JOIN players p ON p.id = wp.player_id
         WHERE wp.player_id = ?
         ORDER BY wp.week_start DESC`,
      )
      .all(id);

    const awards = db
      .prepare(
        `SELECT a.*, p.full_name AS player_name, p.player_code, p.photo_url AS player_photo, p.position AS player_position
         FROM awards a
         JOIN players p ON p.id = a.player_id
         WHERE a.player_id = ?
         ORDER BY a.award_year DESC, a.period_type DESC`,
      )
      .all(id);

    const committees = db
      .prepare(
        `SELECT cm.position, c.year, c.title, c.is_current
         FROM committee_members cm
         JOIN committees c ON c.id = cm.committee_id
         WHERE cm.player_id = ?
         ORDER BY c.year DESC`,
      )
      .all(id);

    res.json({ player, statTotals, statHistory, payments, awards, committees });
  });

  app.post('/api/players', requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
      const dateOfBirth = typeof req.body?.date_of_birth === 'string' ? req.body.date_of_birth.trim() : '';
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
      const position = typeof req.body?.position === 'string' ? req.body.position.trim() : 'Midfielder';
      const joiningDate =
        typeof req.body?.joining_date === 'string' && req.body.joining_date.trim()
          ? req.body.joining_date.trim()
          : new Date().toISOString().slice(0, 10);
      const status = typeof req.body?.status === 'string' ? req.body.status.trim() : 'Active';
      const ageInput = Number(req.body?.age);
      const age = Number.isFinite(ageInput) && ageInput >= 5 && ageInput <= 99 ? Math.round(ageInput) : computeAgeFromDob(dateOfBirth);
      const photoUrl = sanitizeImageUrl(req.body?.photo_url);

      if (!fullName || !dateOfBirth || !phone || !address) {
        res.status(400).json({ error: 'Full name, date of birth, phone number, and address are required.' });
        return;
      }
      if (!VALID_POSITIONS.has(position)) {
        res.status(400).json({ error: 'Invalid playing position.' });
        return;
      }
      if (!VALID_STATUSES.has(status)) {
        res.status(400).json({ error: 'Invalid player status.' });
        return;
      }

      const now = new Date().toISOString();
      const created = db.transaction(() => {
        const playerCode = generateNextPlayerCode();
        const info = db
          .prepare(
            `INSERT INTO players
              (player_code, full_name, photo_url, age, date_of_birth, phone, address, position, joining_date, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(playerCode, fullName, photoUrl, age, dateOfBirth, phone, address, position, joiningDate, status, now, now);

        const newId = Number(info.lastInsertRowid);

        if (status === 'Active') {
          const { weekStart, weekLabel } = getCurrentWeekInfo();
          db.prepare(
            `INSERT OR IGNORE INTO weekly_payments (player_id, week_start, week_label, amount, status, created_at)
             VALUES (?, ?, ?, 10, 'UNPAID', ?)`,
          ).run(newId, weekStart, weekLabel, now);
        }

        logActivity('PLAYERS', 'Player Registered', `${fullName} (${playerCode}) registered as ${position}.`, {
          actor: req.admin?.sub,
          entityType: 'PLAYER',
          entityId: newId,
        });
        return db.prepare(`SELECT * FROM players WHERE id = ?`).get(newId);
      })();

      res.status(201).json({ player: created });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to create player.' });
    }
  });

  app.put('/api/players/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid player ID.' });
        return;
      }
      const existing = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }

      const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : existing.full_name;
      const dateOfBirth = typeof req.body?.date_of_birth === 'string' ? req.body.date_of_birth.trim() : existing.date_of_birth;
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : existing.phone;
      const address = typeof req.body?.address === 'string' ? req.body.address.trim() : existing.address;
      const position = typeof req.body?.position === 'string' ? req.body.position.trim() : existing.position;
      const joiningDate = typeof req.body?.joining_date === 'string' ? req.body.joining_date.trim() : existing.joining_date;
      const status = typeof req.body?.status === 'string' ? req.body.status.trim() : existing.status;
      const ageInput = Number(req.body?.age);
      const age = Number.isFinite(ageInput) && ageInput >= 5 && ageInput <= 99 ? Math.round(ageInput) : computeAgeFromDob(dateOfBirth);
      const photoUrl = req.body?.photo_url !== undefined ? sanitizeImageUrl(req.body.photo_url) : existing.photo_url;

      if (!fullName || !dateOfBirth || !phone || !address) {
        res.status(400).json({ error: 'Full name, date of birth, phone number, and address are required.' });
        return;
      }
      if (!VALID_POSITIONS.has(position) || !VALID_STATUSES.has(status)) {
        res.status(400).json({ error: 'Invalid position or status.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE players SET
          full_name = ?, photo_url = ?, age = ?, date_of_birth = ?, phone = ?, address = ?,
          position = ?, joining_date = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      ).run(fullName, photoUrl, age, dateOfBirth, phone, address, position, joiningDate, status, now, id);

      if (status === 'Active') {
        ensureWeeklyPaymentsForWeek();
      }

      logActivity('PLAYERS', 'Player Updated', `Updated profile for ${fullName} (${existing.player_code}).`, {
        actor: req.admin?.sub,
        entityType: 'PLAYER',
        entityId: id,
      });
      const updated = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
      res.json({ player: updated });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to update player.' });
    }
  });

  app.delete('/api/players/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid player ID.' });
      return;
    }
    const existing = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }

    db.prepare(`DELETE FROM players WHERE id = ?`).run(id);
    logActivity('PLAYERS', 'Player Deleted', `Removed player ${existing.full_name} (${existing.player_code}).`, {
      actor: req.admin?.sub,
      entityType: 'PLAYER',
    });
    res.json({ ok: true });
  });

  // ==================== STATS & MATCHES ROUTES ====================
  app.get('/api/stats', requireAdmin, (_req: Request, res: Response) => {
    const clubTotals = db
      .prepare(
        `SELECT
          COALESCE(SUM(matches_played), 0) AS total_appearances,
          COALESCE(SUM(goals), 0) AS total_goals,
          COALESCE(SUM(assists), 0) AS total_assists,
          COALESCE(SUM(yellow_cards), 0) AS total_yellow_cards,
          COALESCE(SUM(red_cards), 0) AS total_red_cards,
          COALESCE(SUM(clean_sheets), 0) AS total_clean_sheets,
          COALESCE(ROUND(AVG(attendance), 1), 0) AS avg_attendance,
          COALESCE(ROUND(AVG(performance_rating), 2), 0) AS avg_rating
        FROM player_statistics`,
      )
      .get();

    const matchTotals = db
      .prepare(
        `SELECT
          COUNT(*) AS total_matches,
          COALESCE(SUM(CASE WHEN result = 'Win' THEN 1 ELSE 0 END), 0) AS wins,
          COALESCE(SUM(CASE WHEN result = 'Loss' THEN 1 ELSE 0 END), 0) AS losses,
          COALESCE(SUM(CASE WHEN result = 'Draw' THEN 1 ELSE 0 END), 0) AS draws,
          COALESCE(SUM(kuc_score), 0) AS goals_for,
          COALESCE(SUM(opponent_score), 0) AS goals_against
        FROM matches`,
      )
      .get();

    const playerLeaderboard = db
      .prepare(
        `SELECT
          p.id AS player_id,
          p.player_code,
          p.full_name,
          p.photo_url,
          p.position,
          p.status,
          COALESCE(SUM(s.matches_played), 0) AS matches_played,
          COALESCE(SUM(s.goals), 0) AS goals,
          COALESCE(SUM(s.assists), 0) AS assists,
          COALESCE(SUM(s.wins), 0) AS wins,
          COALESCE(SUM(s.losses), 0) AS losses,
          COALESCE(SUM(s.draws), 0) AS draws,
          COALESCE(SUM(s.yellow_cards), 0) AS yellow_cards,
          COALESCE(SUM(s.red_cards), 0) AS red_cards,
          COALESCE(SUM(s.clean_sheets), 0) AS clean_sheets,
          COALESCE(SUM(s.saves), 0) AS saves,
          COALESCE(SUM(s.goals_conceded), 0) AS goals_conceded,
          COALESCE(ROUND(AVG(s.attendance), 1), 0) AS avg_attendance,
          COALESCE(ROUND(AVG(s.performance_rating), 2), 0) AS avg_rating,
          COUNT(s.id) AS record_count
        FROM players p
        LEFT JOIN player_statistics s ON s.player_id = p.id
        GROUP BY p.id
        ORDER BY goals DESC, avg_rating DESC, matches_played DESC`,
      )
      .all();

    const statRecords = db
      .prepare(
        `SELECT s.*, p.full_name AS player_name, p.player_code, p.photo_url AS player_photo, m.opponent
         FROM player_statistics s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN matches m ON m.id = s.match_id
         ORDER BY s.record_date DESC, s.id DESC`,
      )
      .all();

    const matches = db
      .prepare(`SELECT * FROM matches ORDER BY match_date DESC, id DESC`)
      .all();

    res.json({
      clubTotals,
      matchTotals,
      playerLeaderboard,
      statRecords,
      matches,
    });
  });

  app.post('/api/stats/record', requireAdmin, (req: AuthedRequest, res: Response) => {
    const playerId = Number(req.body?.player_id);
    if (!Number.isInteger(playerId) || playerId <= 0) {
      res.status(400).json({ error: 'Please select a valid player.' });
      return;
    }
    const player = db.prepare(`SELECT id, full_name, player_code FROM players WHERE id = ?`).get(playerId) as any;
    if (!player) {
      res.status(404).json({ error: 'Selected player does not exist.' });
      return;
    }

    const matchId = req.body?.match_id ? Number(req.body.match_id) : null;
    const recordDate =
      typeof req.body?.record_date === 'string' && req.body.record_date.trim()
        ? req.body.record_date.trim()
        : new Date().toISOString().slice(0, 10);
    const recordLabel =
      typeof req.body?.record_label === 'string' && req.body.record_label.trim()
        ? req.body.record_label.trim()
        : 'Performance Entry';

    const matchesPlayed = Math.max(0, Math.round(Number(req.body?.matches_played) || 0));
    const goals = Math.max(0, Math.round(Number(req.body?.goals) || 0));
    const assists = Math.max(0, Math.round(Number(req.body?.assists) || 0));
    const wins = Math.max(0, Math.round(Number(req.body?.wins) || 0));
    const losses = Math.max(0, Math.round(Number(req.body?.losses) || 0));
    const draws = Math.max(0, Math.round(Number(req.body?.draws) || 0));
    const yellowCards = Math.max(0, Math.round(Number(req.body?.yellow_cards) || 0));
    const redCards = Math.max(0, Math.round(Number(req.body?.red_cards) || 0));
    const cleanSheets = Math.max(0, Math.round(Number(req.body?.clean_sheets) || 0));
    const saves = Math.max(0, Math.round(Number(req.body?.saves) || 0));
    const goalsConceded = Math.max(0, Math.round(Number(req.body?.goals_conceded) || 0));
    const attendance = Math.min(100, Math.max(0, Number(req.body?.attendance ?? 100)));
    const rating = Math.min(10, Math.max(1, Number(req.body?.performance_rating ?? 7.0)));

    let customStatsJson = '{}';
    if (req.body?.custom_stats && typeof req.body.custom_stats === 'object') {
      customStatsJson = JSON.stringify(req.body.custom_stats);
    } else if (typeof req.body?.custom_stats === 'string' && req.body.custom_stats.trim()) {
      try {
        JSON.parse(req.body.custom_stats);
        customStatsJson = req.body.custom_stats.trim();
      } catch {
        customStatsJson = JSON.stringify({ note: req.body.custom_stats.trim() });
      }
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO player_statistics
          (player_id, match_id, record_date, record_label, matches_played, goals, assists, wins, losses, draws,
           yellow_cards, red_cards, clean_sheets, saves, goals_conceded, attendance, performance_rating, custom_stats, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        playerId,
        matchId,
        recordDate,
        recordLabel,
        matchesPlayed,
        goals,
        assists,
        wins,
        losses,
        draws,
        yellowCards,
        redCards,
        cleanSheets,
        saves,
        goalsConceded,
        attendance,
        rating,
        customStatsJson,
        now,
      );

    logActivity(
      'STATS',
      'Stats Recorded',
      `Added stats for ${player.full_name} (${player.player_code}): ${goals}G, ${assists}A, Rating ${rating}.`,
      {
        actor: req.admin?.sub,
        entityType: 'STAT',
        entityId: playerId,
      },
    );

    const record = db.prepare(`SELECT * FROM player_statistics WHERE id = ?`).get(Number(info.lastInsertRowid));
    res.status(201).json({ record });
  });

  app.put('/api/stats/record/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid stat record ID.' });
      return;
    }
    const existing = db.prepare(`SELECT * FROM player_statistics WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Stat record not found.' });
      return;
    }

    const recordDate = typeof req.body?.record_date === 'string' ? req.body.record_date.trim() : existing.record_date;
    const recordLabel = typeof req.body?.record_label === 'string' ? req.body.record_label.trim() : existing.record_label;
    const matchesPlayed = Math.max(0, Math.round(Number(req.body?.matches_played ?? existing.matches_played)));
    const goals = Math.max(0, Math.round(Number(req.body?.goals ?? existing.goals)));
    const assists = Math.max(0, Math.round(Number(req.body?.assists ?? existing.assists)));
    const wins = Math.max(0, Math.round(Number(req.body?.wins ?? existing.wins)));
    const losses = Math.max(0, Math.round(Number(req.body?.losses ?? existing.losses)));
    const draws = Math.max(0, Math.round(Number(req.body?.draws ?? existing.draws)));
    const yellowCards = Math.max(0, Math.round(Number(req.body?.yellow_cards ?? existing.yellow_cards)));
    const redCards = Math.max(0, Math.round(Number(req.body?.red_cards ?? existing.red_cards)));
    const cleanSheets = Math.max(0, Math.round(Number(req.body?.clean_sheets ?? existing.clean_sheets)));
    const saves = Math.max(0, Math.round(Number(req.body?.saves ?? existing.saves)));
    const goalsConceded = Math.max(0, Math.round(Number(req.body?.goals_conceded ?? existing.goals_conceded)));
    const attendance = Math.min(100, Math.max(0, Number(req.body?.attendance ?? existing.attendance)));
    const rating = Math.min(10, Math.max(1, Number(req.body?.performance_rating ?? existing.performance_rating)));

    let customStatsJson = existing.custom_stats;
    if (req.body?.custom_stats && typeof req.body.custom_stats === 'object') {
      customStatsJson = JSON.stringify(req.body.custom_stats);
    }

    db.prepare(
      `UPDATE player_statistics SET
        record_date = ?, record_label = ?, matches_played = ?, goals = ?, assists = ?,
        wins = ?, losses = ?, draws = ?, yellow_cards = ?, red_cards = ?,
        clean_sheets = ?, saves = ?, goals_conceded = ?, attendance = ?, performance_rating = ?, custom_stats = ?
       WHERE id = ?`,
    ).run(
      recordDate,
      recordLabel,
      matchesPlayed,
      goals,
      assists,
      wins,
      losses,
      draws,
      yellowCards,
      redCards,
      cleanSheets,
      saves,
      goalsConceded,
      attendance,
      rating,
      customStatsJson,
      id,
    );

    logActivity('STATS', 'Stats Updated', `Updated historical stat entry #${id} (${recordLabel}).`, {
      actor: req.admin?.sub,
      entityType: 'STAT',
      entityId: existing.player_id,
    });
    const updated = db.prepare(`SELECT * FROM player_statistics WHERE id = ?`).get(id);
    res.json({ record: updated });
  });

  app.delete('/api/stats/record/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid record ID.' });
      return;
    }
    const existing = db.prepare(`SELECT * FROM player_statistics WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Stat record not found.' });
      return;
    }
    db.prepare(`DELETE FROM player_statistics WHERE id = ?`).run(id);
    logActivity('STATS', 'Stats Deleted', `Deleted historical stat record #${id}.`, {
      actor: req.admin?.sub,
      entityType: 'STAT',
      entityId: existing.player_id,
    });
    res.json({ ok: true });
  });

  app.post('/api/matches', requireAdmin, (req: AuthedRequest, res: Response) => {
    const matchDate =
      typeof req.body?.match_date === 'string' && req.body.match_date.trim()
        ? req.body.match_date.trim()
        : new Date().toISOString().slice(0, 10);
    const opponent = typeof req.body?.opponent === 'string' ? req.body.opponent.trim() : '';
    const competition =
      typeof req.body?.competition === 'string' && req.body.competition.trim()
        ? req.body.competition.trim()
        : 'Club Friendly';
    const venue =
      typeof req.body?.venue === 'string' && req.body.venue.trim()
        ? req.body.venue.trim()
        : 'KUC Home Ground';
    const kucScore = Math.max(0, Math.round(Number(req.body?.kuc_score) || 0));
    const opponentScore = Math.max(0, Math.round(Number(req.body?.opponent_score) || 0));
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

    if (!opponent) {
      res.status(400).json({ error: 'Opponent name is required.' });
      return;
    }

    const result = kucScore > opponentScore ? 'Win' : kucScore < opponentScore ? 'Loss' : 'Draw';
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO matches (match_date, opponent, competition, venue, kuc_score, opponent_score, result, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(matchDate, opponent, competition, venue, kucScore, opponentScore, result, notes, now);

    logActivity('STATS', 'Match Logged', `KUC ${kucScore} – ${opponentScore} ${opponent} (${result}).`, {
      actor: req.admin?.sub,
      entityType: 'MATCH',
      entityId: Number(info.lastInsertRowid),
    });
    const match = db.prepare(`SELECT * FROM matches WHERE id = ?`).get(Number(info.lastInsertRowid));
    res.status(201).json({ match });
  });

  // ==================== MONEY MANAGEMENT ROUTES ====================
  app.get('/api/money', requireAdmin, (req: Request, res: Response) => {
    const requestedDate = typeof req.query.week === 'string' && req.query.week.trim() ? req.query.week.trim() : undefined;
    const { weekStart, weekLabel } = ensureWeeklyPaymentsForWeek(requestedDate);

    const weeklyRecords = db
      .prepare(
        `SELECT wp.*, p.player_code, p.full_name, p.photo_url, p.position, p.status AS player_status
         FROM weekly_payments wp
         JOIN players p ON p.id = wp.player_id
         WHERE wp.week_start = ?
         ORDER BY wp.status ASC, p.full_name ASC`,
      )
      .all(weekStart) as any[];

    const availableWeeks = db
      .prepare(
        `SELECT week_start, week_label,
          COUNT(*) AS player_count,
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS collected,
          COALESCE(SUM(amount), 0) AS expected
         FROM weekly_payments
         GROUP BY week_start, week_label
         ORDER BY week_start DESC`,
      )
      .all();

    const currentYear = weekStart.slice(0, 4);
    const currentMonth = weekStart.slice(0, 7);

    const weeklyCollection = weeklyRecords
      .filter((r) => r.status === 'PAID')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const pendingPaymentsAmount = weeklyRecords
      .filter((r) => r.status === 'UNPAID')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const monthlyRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM weekly_payments
         WHERE status = 'PAID' AND substr(week_start, 1, 7) = ?`,
      )
      .get(currentMonth) as { total: number };

    const yearlyRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM weekly_payments
         WHERE status = 'PAID' AND substr(week_start, 1, 4) = ?`,
      )
      .get(currentYear) as { total: number };

    const allPendingRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
         FROM weekly_payments
         WHERE status = 'UNPAID'`,
      )
      .get() as { total: number; cnt: number };

    const transactions = db
      .prepare(
        `SELECT ft.*, p.full_name AS player_name, p.player_code
         FROM financial_transactions ft
         LEFT JOIN players p ON p.id = ft.player_id
         ORDER BY ft.tx_date DESC, ft.id DESC
         LIMIT 50`,
      )
      .all();

    const weeklyTrend = db
      .prepare(
        `SELECT week_start, week_label,
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS collected,
          COALESCE(SUM(amount), 0) AS expected
         FROM weekly_payments
         GROUP BY week_start, week_label
         ORDER BY week_start ASC
         LIMIT 12`,
      )
      .all();

    const activePlayerCount = (
      db.prepare(`SELECT COUNT(*) AS cnt FROM players WHERE status = 'Active'`).get() as { cnt: number }
    ).cnt;

    res.json({
      weekStart,
      weekLabel,
      activePlayerCount,
      weeklyTarget: activePlayerCount * 10,
      weeklyRecords,
      availableWeeks,
      weeklyCollection,
      monthlyCollection: monthlyRow.total,
      yearlyCollection: yearlyRow.total,
      totalClubBalance: computeTotalClubBalance(),
      pendingPaymentsAmount,
      allPendingTotal: allPendingRow.total,
      allPendingCount: allPendingRow.cnt,
      paidCount: weeklyRecords.filter((r) => r.status === 'PAID').length,
      unpaidCount: weeklyRecords.filter((r) => r.status === 'UNPAID').length,
      transactions,
      weeklyTrend,
    });
  });

  app.post('/api/money/generate', requireAdmin, (req: AuthedRequest, res: Response) => {
    const targetDate = typeof req.body?.week_date === 'string' ? req.body.week_date.trim() : undefined;
    const { weekStart, weekLabel } = ensureWeeklyPaymentsForWeek(targetDate);
    logActivity('MONEY', 'Weekly Sheet Generated', `Synced ₹10 weekly contribution records for ${weekLabel}.`, {
      actor: req.admin?.sub,
      entityType: 'PAYMENT',
    });
    res.json({ weekStart, weekLabel });
  });

  app.post('/api/money/toggle-payment', requireAdmin, (req: AuthedRequest, res: Response) => {
    const paymentId = Number(req.body?.payment_id);
    const targetStatus = req.body?.status === 'PAID' ? 'PAID' : 'UNPAID';
    const paymentDate =
      typeof req.body?.paid_at === 'string' && req.body.paid_at.trim()
        ? req.body.paid_at.trim()
        : new Date().toISOString().slice(0, 10);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(400).json({ error: 'Invalid payment ID.' });
      return;
    }

    const result = db.transaction(() => {
      const payment = db
        .prepare(
          `SELECT wp.*, p.full_name, p.player_code
           FROM weekly_payments wp
           JOIN players p ON p.id = wp.player_id
           WHERE wp.id = ?`,
        )
        .get(paymentId) as any;

      if (!payment) {
        return { error: 'Payment record not found.', status: 404 };
      }

      if (targetStatus === 'PAID') {
        if (payment.status === 'PAID') {
          return { error: 'Duplicate payment prevented: this player is already marked PAID for this week.', status: 409 };
        }
        const now = new Date().toISOString();
        db.prepare(`UPDATE weekly_payments SET status = 'PAID', paid_at = ? WHERE id = ?`).run(paymentDate, paymentId);

        const existingTx = db
          .prepare(`SELECT id FROM financial_transactions WHERE payment_id = ?`)
          .get(paymentId);
        if (!existingTx) {
          db.prepare(
            `INSERT INTO financial_transactions (player_id, payment_id, tx_type, amount, direction, description, tx_date, created_at)
             VALUES (?, ?, 'WEEKLY_CONTRIBUTION', ?, 'IN', ?, ?, ?)`,
          ).run(
            payment.player_id,
            paymentId,
            payment.amount,
            `Weekly club fee (${payment.week_label}) — ${payment.full_name} (${payment.player_code})`,
            paymentDate,
            now,
          );
        }
        logActivity('MONEY', 'Payment Marked Paid', `₹${payment.amount} received from ${payment.full_name} for ${payment.week_label}.`, {
          actor: req.admin?.sub,
          entityType: 'PAYMENT',
          entityId: payment.player_id,
        });
      } else {
        db.prepare(`UPDATE weekly_payments SET status = 'UNPAID', paid_at = NULL WHERE id = ?`).run(paymentId);
        db.prepare(`DELETE FROM financial_transactions WHERE payment_id = ?`).run(paymentId);
        logActivity('MONEY', 'Payment Marked Unpaid', `Marked ${payment.full_name} as UNPAID for ${payment.week_label}.`, {
          actor: req.admin?.sub,
          entityType: 'PAYMENT',
          entityId: payment.player_id,
        });
      }

      return { ok: true };
    })();

    if ('error' in result) {
      res.status(result.status as number).json({ error: result.error });
      return;
    }

    res.json({ ok: true });
  });

  app.post('/api/money/transaction', requireAdmin, (req: AuthedRequest, res: Response) => {
    const txType = typeof req.body?.tx_type === 'string' ? req.body.tx_type : 'EXPENSE';
    const direction = req.body?.direction === 'IN' ? 'IN' : 'OUT';
    const amount = Math.round(Number(req.body?.amount) || 0);
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const txDate =
      typeof req.body?.tx_date === 'string' && req.body.tx_date.trim()
        ? req.body.tx_date.trim()
        : new Date().toISOString().slice(0, 10);
    const playerId = req.body?.player_id ? Number(req.body.player_id) : null;

    if (!['WEEKLY_CONTRIBUTION', 'EXPENSE', 'SPONSORSHIP', 'OTHER_INCOME'].includes(txType)) {
      res.status(400).json({ error: 'Invalid transaction type.' });
      return;
    }
    if (amount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than ₹0.' });
      return;
    }
    if (!description) {
      res.status(400).json({ error: 'Transaction description is required.' });
      return;
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO financial_transactions (player_id, payment_id, tx_type, amount, direction, description, tx_date, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
      )
      .run(playerId, txType, amount, direction, description, txDate, now);

    logActivity('MONEY', direction === 'IN' ? 'Club Income Logged' : 'Club Expense Logged', `₹${amount} (${txType}) — ${description}`, {
      actor: req.admin?.sub,
      entityType: 'TRANSACTION',
      entityId: Number(info.lastInsertRowid),
    });
    const tx = db.prepare(`SELECT * FROM financial_transactions WHERE id = ?`).get(Number(info.lastInsertRowid));
    res.status(201).json({ transaction: tx });
  });

  // ==================== KUC GOOGLE (INTERNAL DB SEARCH) ====================
  app.get('/api/search', requireAdmin, (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const categoryFilter = typeof req.query.category === 'string' ? req.query.category.trim() : 'ALL';

    if (!q) {
      res.json({ results: [], query: '' });
      return;
    }

    const like = `%${q}%`;
    const results: Array<{
      id: string;
      category: string;
      title: string;
      subtitle: string;
      meta: string;
      targetSection: string;
      entityId?: number;
    }> = [];

    // 1. Players & Player IDs
    const matchedPlayers = db
      .prepare(
        `SELECT * FROM players
         WHERE full_name LIKE ? OR player_code LIKE ? OR position LIKE ? OR phone LIKE ? OR address LIKE ? OR status LIKE ?
         ORDER BY id DESC LIMIT 25`,
      )
      .all(like, like, like, like, like, like) as any[];

    for (const p of matchedPlayers) {
      const isIdMatch = p.player_code.toLowerCase().includes(q.toLowerCase());
      results.push({
        id: `player-${p.id}`,
        category: isIdMatch ? 'Player IDs' : 'Players',
        title: `${p.full_name} (${p.player_code})`,
        subtitle: `${p.position} · Age ${p.age} · ${p.phone}`,
        meta: `${p.status} · Joined ${p.joining_date}`,
        targetSection: 'PLAYERS',
        entityId: p.id,
      });
    }

    // 2. Player Statistics
    const matchedStats = db
      .prepare(
        `SELECT s.*, p.full_name, p.player_code
         FROM player_statistics s
         JOIN players p ON p.id = s.player_id
         WHERE p.full_name LIKE ? OR p.player_code LIKE ? OR s.record_label LIKE ? OR s.custom_stats LIKE ?
         ORDER BY s.record_date DESC LIMIT 20`,
      )
      .all(like, like, like, like) as any[];

    for (const s of matchedStats) {
      results.push({
        id: `stat-${s.id}`,
        category: 'Player Statistics',
        title: `${s.full_name} — ${s.record_label}`,
        subtitle: `${s.matches_played} Matches · ${s.goals} Goals · ${s.assists} Assists · Rating ${s.performance_rating}`,
        meta: `${s.player_code} · ${s.record_date}`,
        targetSection: 'STATS',
        entityId: s.player_id,
      });
    }

    // 3. Payment History & Money Records
    const matchedPayments = db
      .prepare(
        `SELECT wp.*, p.full_name, p.player_code
         FROM weekly_payments wp
         JOIN players p ON p.id = wp.player_id
         WHERE p.full_name LIKE ? OR p.player_code LIKE ? OR wp.week_label LIKE ? OR wp.status LIKE ?
         ORDER BY wp.week_start DESC LIMIT 20`,
      )
      .all(like, like, like, like) as any[];

    for (const wp of matchedPayments) {
      results.push({
        id: `pay-${wp.id}`,
        category: 'Payment History',
        title: `${wp.full_name} (${wp.player_code}) — ₹${wp.amount} Weekly Contribution`,
        subtitle: `${wp.week_label} · Status: ${wp.status}`,
        meta: wp.paid_at ? `Paid on ${wp.paid_at}` : 'Awaiting Payment',
        targetSection: 'MONEY',
        entityId: wp.player_id,
      });
    }

    const matchedTx = db
      .prepare(
        `SELECT ft.*, p.full_name, p.player_code
         FROM financial_transactions ft
         LEFT JOIN players p ON p.id = ft.player_id
         WHERE ft.description LIKE ? OR ft.tx_type LIKE ? OR p.full_name LIKE ?
         ORDER BY ft.tx_date DESC LIMIT 20`,
      )
      .all(like, like, like) as any[];

    for (const tx of matchedTx) {
      results.push({
        id: `tx-${tx.id}`,
        category: 'Money Records',
        title: `${tx.direction === 'IN' ? '+' : '-'}₹${tx.amount} · ${tx.description}`,
        subtitle: `Type: ${tx.tx_type.replace(/_/g, ' ')}`,
        meta: tx.tx_date,
        targetSection: 'MONEY',
      });
    }

    // 4. Committee Members & Previous Committees
    const matchedCommitteeMembers = db
      .prepare(
        `SELECT cm.*, c.year, c.title, c.is_current, p.full_name, p.player_code
         FROM committee_members cm
         JOIN committees c ON c.id = cm.committee_id
         JOIN players p ON p.id = cm.player_id
         WHERE p.full_name LIKE ? OR p.player_code LIKE ? OR cm.position LIKE ? OR c.title LIKE ? OR CAST(c.year AS TEXT) LIKE ?
         ORDER BY c.year DESC LIMIT 20`,
      )
      .all(like, like, like, like, like) as any[];

    for (const cm of matchedCommitteeMembers) {
      results.push({
        id: `cm-${cm.id}`,
        category: cm.is_current ? 'Committee Members' : 'Previous Committees',
        title: `${cm.full_name} — ${cm.position}`,
        subtitle: `${cm.title} (${cm.year})`,
        meta: cm.is_current ? 'Current Committee' : 'Historical Committee',
        targetSection: 'COMMITTEE',
        entityId: cm.committee_id,
      });
    }

    // 5. Club Records (Matches, Awards & Activity Logs)
    const matchedMatches = db
      .prepare(
        `SELECT * FROM matches
         WHERE opponent LIKE ? OR competition LIKE ? OR venue LIKE ? OR result LIKE ?
         ORDER BY match_date DESC LIMIT 15`,
      )
      .all(like, like, like, like) as any[];

    for (const m of matchedMatches) {
      results.push({
        id: `match-${m.id}`,
        category: 'Club Records',
        title: `Match: KUC ${m.kuc_score} – ${m.opponent_score} ${m.opponent}`,
        subtitle: `${m.competition} · ${m.venue}`,
        meta: `${m.result} · ${m.match_date}`,
        targetSection: 'STATS',
      });
    }

    const matchedAwards = db
      .prepare(
        `SELECT a.*, p.full_name, p.player_code
         FROM awards a
         JOIN players p ON p.id = a.player_id
         WHERE p.full_name LIKE ? OR p.player_code LIKE ? OR a.category LIKE ? OR a.reason LIKE ? OR CAST(a.award_year AS TEXT) LIKE ?
         ORDER BY a.award_year DESC LIMIT 15`,
      )
      .all(like, like, like, like, like) as any[];

    for (const a of matchedAwards) {
      const catName = a.category.replace(/_/g, ' ');
      results.push({
        id: `award-${a.id}`,
        category: 'Club Records',
        title: `${catName} (${a.award_year} Annual) — ${a.full_name}`,
        subtitle: a.reason,
        meta: a.player_code,
        targetSection: 'AWARDS',
        entityId: a.id,
      });
    }

    const matchedLogs = db
      .prepare(
        `SELECT * FROM activity_logs
         WHERE action LIKE ? OR details LIKE ? OR category LIKE ? OR actor LIKE ?
         ORDER BY id DESC LIMIT 15`,
      )
      .all(like, like, like, like) as any[];

    for (const log of matchedLogs) {
      results.push({
        id: `log-${log.id}`,
        category: 'Club Records',
        title: `Audit: ${log.action} (${log.category})`,
        subtitle: log.details,
        meta: `By ${log.actor || 'admin'} · ${log.created_at.slice(0, 10)}`,
        targetSection: 'ACTIVITY',
        entityId: log.id,
      });
    }

    const filtered =
      categoryFilter && categoryFilter !== 'ALL'
        ? results.filter((r) => r.category === categoryFilter)
        : results;

    res.json({ results: filtered, query: q });
  });

  // ==================== COMMITTEE ROUTES ====================
  app.get('/api/committees', requireAdmin, (_req: Request, res: Response) => {
    const committees = db.prepare(`SELECT * FROM committees ORDER BY year DESC`).all() as any[];
    const memberStmt = db.prepare(
      `SELECT cm.*, p.full_name, p.player_code, p.photo_url, p.position AS player_position
       FROM committee_members cm
       JOIN players p ON p.id = cm.player_id
       WHERE cm.committee_id = ?
       ORDER BY cm.id ASC`,
    );

    const hydrated = committees.map((c) => ({
      ...c,
      members: memberStmt.all(c.id),
    }));

    res.json({ committees: hydrated });
  });

  app.post('/api/committees', requireAdmin, (req: AuthedRequest, res: Response) => {
    const year = Number(req.body?.year);
    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : `${year} Executive Committee`;
    const isCurrent = Boolean(req.body?.is_current);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const allowDuplicatePlayer = Boolean(req.body?.allowDuplicatePlayer);
    const members = Array.isArray(req.body?.members) ? req.body.members : [];

    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      res.status(400).json({ error: 'Please specify a valid committee year.' });
      return;
    }

    const existingYear = db.prepare(`SELECT id FROM committees WHERE year = ?`).get(year);
    if (existingYear) {
      res.status(409).json({ error: `A committee record for ${year} already exists. Edit that year instead.` });
      return;
    }

    if (members.length === 0) {
      res.status(400).json({ error: 'Assign at least one player to the committee.' });
      return;
    }

    if (!allowDuplicatePlayer) {
      const seen = new Set<number>();
      for (const m of members) {
        const pid = Number(m.player_id);
        if (seen.has(pid)) {
          res.status(400).json({
            error: 'Duplicate player assignment prevented. Enable "Allow multi-role assignment" if intentional.',
          });
          return;
        }
        seen.add(pid);
      }
    }

    for (const m of members) {
      if (!VALID_COMMITTEE_POSITIONS.has(m.position)) {
        res.status(400).json({ error: `Invalid committee position: ${m.position}` });
        return;
      }
      const pExists = db.prepare(`SELECT id FROM players WHERE id = ?`).get(Number(m.player_id));
      if (!pExists) {
        res.status(400).json({ error: 'One of the selected committee players does not exist.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const createdId = db.transaction(() => {
      if (isCurrent) {
        db.prepare(`UPDATE committees SET is_current = 0`).run();
      }
      const info = db
        .prepare(`INSERT INTO committees (year, title, is_current, notes, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(year, title, isCurrent ? 1 : 0, notes, now);
      const cid = Number(info.lastInsertRowid);
      const insMember = db.prepare(
        `INSERT INTO committee_members (committee_id, player_id, position, assigned_at) VALUES (?, ?, ?, ?)`,
      );
      for (const m of members) {
        insMember.run(cid, Number(m.player_id), m.position, now);
      }
      logActivity('COMMITTEE', 'Committee Created', `Created ${title} (${year}) with ${members.length} members.`, {
        actor: req.admin?.sub,
        entityType: 'COMMITTEE',
        entityId: cid,
      });
      return cid;
    })();

    res.status(201).json({ id: createdId });
  });

  app.put('/api/committees/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid committee ID.' });
      return;
    }
    const existing = db.prepare(`SELECT * FROM committees WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Committee not found.' });
      return;
    }

    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : existing.title;
    const isCurrent = req.body?.is_current !== undefined ? Boolean(req.body.is_current) : Boolean(existing.is_current);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : existing.notes;
    const allowDuplicatePlayer = Boolean(req.body?.allowDuplicatePlayer);
    const members = Array.isArray(req.body?.members) ? req.body.members : [];

    if (members.length === 0) {
      res.status(400).json({ error: 'Assign at least one player to the committee.' });
      return;
    }

    if (!allowDuplicatePlayer) {
      const seen = new Set<number>();
      for (const m of members) {
        const pid = Number(m.player_id);
        if (seen.has(pid)) {
          res.status(400).json({
            error: 'Duplicate player assignment prevented. Enable "Allow multi-role assignment" if intentional.',
          });
          return;
        }
        seen.add(pid);
      }
    }

    for (const m of members) {
      if (!VALID_COMMITTEE_POSITIONS.has(m.position)) {
        res.status(400).json({ error: `Invalid committee position: ${m.position}` });
        return;
      }
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      if (isCurrent) {
        db.prepare(`UPDATE committees SET is_current = 0`).run();
      }
      db.prepare(`UPDATE committees SET title = ?, is_current = ?, notes = ? WHERE id = ?`).run(
        title,
        isCurrent ? 1 : 0,
        notes,
        id,
      );
      db.prepare(`DELETE FROM committee_members WHERE committee_id = ?`).run(id);
      const insMember = db.prepare(
        `INSERT INTO committee_members (committee_id, player_id, position, assigned_at) VALUES (?, ?, ?, ?)`,
      );
      for (const m of members) {
        insMember.run(id, Number(m.player_id), m.position, now);
      }
      logActivity(
        'COMMITTEE',
        'Committee Updated',
        `Updated ${title} (${existing.year}) with ${members.length} assigned member(s).`,
        {
          actor: req.admin?.sub,
          entityType: 'COMMITTEE',
          entityId: id,
        },
      );
    })();

    res.json({ ok: true });
  });

  app.post('/api/committees/:id/set-current', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM committees WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Committee not found.' });
      return;
    }
    db.transaction(() => {
      db.prepare(`UPDATE committees SET is_current = 0`).run();
      db.prepare(`UPDATE committees SET is_current = 1 WHERE id = ?`).run(id);
      logActivity('COMMITTEE', 'Current Committee Set', `Set ${existing.title} (${existing.year}) as current committee.`, {
        actor: req.admin?.sub,
        entityType: 'COMMITTEE',
        entityId: id,
      });
    })();
    res.json({ ok: true });
  });

  // ==================== AWARDS & ACHIEVEMENTS ROUTES ====================
  app.get('/api/awards', requireAdmin, (_req: Request, res: Response) => {
    const awards = db
      .prepare(
        `SELECT a.*, p.full_name AS player_name, p.player_code, p.photo_url AS player_photo, p.position AS player_position
         FROM awards a
         JOIN players p ON p.id = a.player_id
         ORDER BY a.award_year DESC, a.category ASC`,
      )
      .all();

    const awardYears = db
      .prepare(`SELECT * FROM award_years ORDER BY year DESC`)
      .all();

    res.json({ awards, awardYears });
  });

  app.post('/api/awards/start-year', requireAdmin, (req: AuthedRequest, res: Response) => {
    const year = Number(req.body?.year);
    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : `${year} Annual Awards`;
    const setActive = req.body?.set_active === undefined ? true : Boolean(req.body.set_active);

    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      res.status(400).json({ error: 'Please enter a valid award year (1950–2100).' });
      return;
    }

    const existing = db.prepare(`SELECT id FROM award_years WHERE year = ?`).get(year);
    if (existing) {
      res.status(409).json({ error: `Award year ${year} has already been started.` });
      return;
    }

    const now = new Date().toISOString();
    const actor = req.admin?.sub || 'admin';
    const created = db.transaction(() => {
      if (setActive) {
        db.prepare(`UPDATE award_years SET is_active = 0`).run();
      }
      const info = db
        .prepare(
          `INSERT INTO award_years (year, title, is_active, started_by, started_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(year, title, setActive ? 1 : 0, actor, now);

      logActivity('AWARDS', 'Award Year Started', `Started annual awards cycle for ${year} (${title}).`, {
        actor,
        entityType: 'AWARD_YEAR',
        entityId: Number(info.lastInsertRowid),
      });

      return db.prepare(`SELECT * FROM award_years WHERE id = ?`).get(Number(info.lastInsertRowid));
    })();

    res.status(201).json({ awardYear: created });
  });

  app.post('/api/awards', requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
      const periodType = 'ANNUAL';
      const awardYear = Number(req.body?.award_year);
      const playerId = Number(req.body?.player_id);
      const winnerPhotoUrl = sanitizeImageUrl(req.body?.winner_photo_url);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const performanceDetails =
        typeof req.body?.performance_details === 'string' ? req.body.performance_details.trim() : '';
      const goalsScored = Math.max(0, Math.round(Number(req.body?.goals_scored) || 0));
      const cleanSheets = Math.max(0, Math.round(Number(req.body?.clean_sheets) || 0));
      const saves = Math.max(0, Math.round(Number(req.body?.saves) || 0));
      const goalsConceded = Math.max(0, Math.round(Number(req.body?.goals_conceded) || 0));
      const published = req.body?.published === undefined ? 1 : req.body.published ? 1 : 0;

      if (!VALID_AWARD_CATEGORIES.has(category)) {
        res.status(400).json({ error: 'Invalid award category.' });
        return;
      }
      if (!Number.isInteger(awardYear) || awardYear < 1950 || awardYear > 2100) {
        res.status(400).json({ error: 'Invalid award year.' });
        return;
      }

      const startedYear = db.prepare(`SELECT id FROM award_years WHERE year = ?`).get(awardYear);
      if (!startedYear) {
        res.status(400).json({
          error: `Award year ${awardYear} has not been started yet. Please click "Start New Year" first.`,
        });
        return;
      }

      const player = db.prepare(`SELECT id, full_name, player_code FROM players WHERE id = ?`).get(playerId) as any;
      if (!player) {
        res.status(404).json({ error: 'Selected player not found.' });
        return;
      }
      if (!reason) {
        res.status(400).json({ error: 'Reason / citation for winning is required.' });
        return;
      }

      const duplicate = db
        .prepare(`SELECT id FROM awards WHERE category = ? AND award_year = ?`)
        .get(category, awardYear);
      if (duplicate) {
        res.status(409).json({
          error: `An annual award for ${category.replace(/_/g, ' ')} (${awardYear}) already exists. Edit the existing record instead.`,
        });
        return;
      }

      const now = new Date().toISOString();
      const info = db
        .prepare(
          `INSERT INTO awards
            (category, period_type, award_year, player_id, winner_photo_url, reason, performance_details,
             goals_scored, clean_sheets, saves, goals_conceded, published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          category,
          periodType,
          awardYear,
          playerId,
          winnerPhotoUrl,
          reason,
          performanceDetails,
          goalsScored,
          cleanSheets,
          saves,
          goalsConceded,
          published,
          now,
          now,
        );

      logActivity(
        'AWARDS',
        'Award Published',
        `${category.replace(/_/g, ' ')} (${awardYear} Annual) awarded to ${player.full_name}.`,
        {
          actor: req.admin?.sub,
          entityType: 'AWARD',
          entityId: playerId,
        },
      );

      const created = db
        .prepare(
          `SELECT a.*, p.full_name AS player_name, p.player_code, p.photo_url AS player_photo, p.position AS player_position
           FROM awards a JOIN players p ON p.id = a.player_id WHERE a.id = ?`,
        )
        .get(Number(info.lastInsertRowid));
      res.status(201).json({ award: created });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to save award.' });
    }
  });

  app.put('/api/awards/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid award ID.' });
        return;
      }
      const existing = db.prepare(`SELECT * FROM awards WHERE id = ?`).get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Award record not found.' });
        return;
      }

      const playerId = Number(req.body?.player_id ?? existing.player_id);
      const player = db.prepare(`SELECT id, full_name FROM players WHERE id = ?`).get(playerId) as any;
      if (!player) {
        res.status(404).json({ error: 'Selected player not found.' });
        return;
      }

      const winnerPhotoUrl =
        req.body?.winner_photo_url !== undefined
          ? sanitizeImageUrl(req.body.winner_photo_url)
          : existing.winner_photo_url;
      const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : existing.reason;
      const performanceDetails =
        typeof req.body?.performance_details === 'string'
          ? req.body.performance_details.trim()
          : existing.performance_details;
      const goalsScored = Math.max(0, Math.round(Number(req.body?.goals_scored ?? existing.goals_scored)));
      const cleanSheets = Math.max(0, Math.round(Number(req.body?.clean_sheets ?? existing.clean_sheets)));
      const saves = Math.max(0, Math.round(Number(req.body?.saves ?? existing.saves)));
      const goalsConceded = Math.max(0, Math.round(Number(req.body?.goals_conceded ?? existing.goals_conceded)));
      const published = req.body?.published !== undefined ? (req.body.published ? 1 : 0) : existing.published;
      const now = new Date().toISOString();

      db.prepare(
        `UPDATE awards SET
          player_id = ?, winner_photo_url = ?, reason = ?, performance_details = ?,
          goals_scored = ?, clean_sheets = ?, saves = ?, goals_conceded = ?, published = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        playerId,
        winnerPhotoUrl,
        reason,
        performanceDetails,
        goalsScored,
        cleanSheets,
        saves,
        goalsConceded,
        published,
        now,
        id,
      );

      logActivity('AWARDS', 'Award Updated', `Updated ${existing.category.replace(/_/g, ' ')} (${existing.award_year}) winner to ${player.full_name}.`, {
        actor: req.admin?.sub,
        entityType: 'AWARD',
        entityId: playerId,
      });
      const updated = db
        .prepare(
          `SELECT a.*, p.full_name AS player_name, p.player_code, p.photo_url AS player_photo, p.position AS player_position
           FROM awards a JOIN players p ON p.id = a.player_id WHERE a.id = ?`,
        )
        .get(id);
      res.json({ award: updated });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to update award.' });
    }
  });

  app.delete('/api/awards/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid award ID.' });
      return;
    }
    const existing = db.prepare(`SELECT * FROM awards WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Award record not found.' });
      return;
    }
    db.prepare(`DELETE FROM awards WHERE id = ?`).run(id);
    logActivity('AWARDS', 'Award Removed', `Deleted award record #${id} (${existing.category.replace(/_/g, ' ')} ${existing.award_year}).`, {
      actor: req.admin?.sub,
      entityType: 'AWARD',
    });
    res.json({ ok: true });
  });

  // ==================== VITE / STATIC SERVING ====================
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KUC – Kalanja United Club server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

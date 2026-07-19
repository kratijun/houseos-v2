import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { buildICalendar, parseICalendar } from './ical.js';
import { listPrinters, printHouseReceipt } from './printer.js';
import { getLatestRelease, validRepository } from './updater.js';
import { controlBluetoothDevice, getBluetoothState, scanBluetoothDevices, setBluetoothPower } from './bluetooth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = process.env.HOUSEOS_DATA_DIR ? path.resolve(process.env.HOUSEOS_DATA_DIR) : path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const updateStatusPath = path.join(dataDir, 'update-status.json');
try {
  const status = JSON.parse(fs.readFileSync(updateStatusPath, 'utf8'));
  const serviceRestartFinished = status.status === 'restarting' && status.restartTarget === 'houseos' && String(status.version) === String(packageInfo.version);
  if (serviceRestartFinished) {
    fs.writeFileSync(updateStatusPath, JSON.stringify({ ...status, status: 'installed', progress: 100, message: `HouseOS ${status.version} wurde installiert und erfolgreich neu gestartet.`, updatedAt: new Date().toISOString() }, null, 2));
  }
} catch {}

const db = new Database(path.join(dataDir, 'houseos.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Mitglied',
    color TEXT NOT NULL DEFAULT '#007aff',
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    person TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT 'Heute',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS shopping (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Sonstiges',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    name TEXT NOT NULL,
    ingredients TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    ingredients TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL,
    end_time TEXT NOT NULL DEFAULT '',
    all_day INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL DEFAULT '',
    participants TEXT NOT NULL DEFAULT '[]',
    color TEXT NOT NULL DEFAULT '#0a84ff',
    recurrence TEXT NOT NULL DEFAULT 'none',
    reminder_minutes INTEGER NOT NULL DEFAULT 30,
    ical_uid TEXT NOT NULL DEFAULT '',
    ical_source TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS shopping_catalog (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Sonstiges',
    quantity TEXT NOT NULL DEFAULT '1 Stück',
    favorite INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS calendar_reminders (
    event_id INTEGER NOT NULL,
    occurrence_date TEXT NOT NULL,
    reminder_minutes INTEGER NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, occurrence_date, reminder_minutes)
  );
  CREATE TABLE IF NOT EXISTS print_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    printer_name TEXT NOT NULL DEFAULT '',
    paper_width INTEGER NOT NULL DEFAULT 58 CHECK (paper_width IN (58, 80)),
    auto_cut INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS device_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weather_city TEXT NOT NULL DEFAULT '',
    calendar_ical_token TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS print_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    printer_name TEXT NOT NULL,
    paper_width INTEGER NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS task_completions (
    task_id INTEGER PRIMARY KEY,
    member_id INTEGER,
    person_name TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL DEFAULT 10,
    completed_on TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    subscription TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT
  );
  CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (sender_id, recipient_id, id);
  CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (recipient_id, read_at, id);
  CREATE TABLE IF NOT EXISTS family_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    attachment_path TEXT NOT NULL DEFAULT '',
    attachment_type TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (length(body) BETWEEN 0 AND 1000),
    CHECK (length(body) > 0 OR length(attachment_path) > 0)
  );
  CREATE TABLE IF NOT EXISTS family_read_state (
    member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    last_read_message_id INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS message_reactions (
    message_kind TEXT NOT NULL CHECK (message_kind IN ('direct', 'family')),
    message_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_kind, message_id, member_id, emoji)
  );
`);

const ensureColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
ensureColumn('members', 'pin_hash', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tasks', 'due_date', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tasks', 'recurrence', "TEXT NOT NULL DEFAULT 'none'");
ensureColumn('tasks', 'notes', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tasks', 'recurrence_interval', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('tasks', 'recurrence_days', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('tasks', 'rotation', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('tasks', 'checklist', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('tasks', 'points', 'INTEGER NOT NULL DEFAULT 10');
ensureColumn('tasks', 'parent_task_id', 'INTEGER');
ensureColumn('tasks', 'series_id', "TEXT NOT NULL DEFAULT ''");
ensureColumn('shopping', 'quantity', "TEXT NOT NULL DEFAULT '1 Stück'");
ensureColumn('messages', 'attachment_path', "TEXT NOT NULL DEFAULT ''");
ensureColumn('messages', 'attachment_type', "TEXT NOT NULL DEFAULT ''");
ensureColumn('messages', 'edited_at', 'TEXT');
ensureColumn('family_messages', 'edited_at', 'TEXT');
ensureColumn('meal_plans', 'servings', 'INTEGER NOT NULL DEFAULT 2');
ensureColumn('dishes', 'servings', 'INTEGER NOT NULL DEFAULT 2');
ensureColumn('dishes', 'steps', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('dishes', 'prep_minutes', 'INTEGER NOT NULL DEFAULT 30');
ensureColumn('dishes', 'category', "TEXT NOT NULL DEFAULT 'Hauptgericht'");
ensureColumn('dishes', 'favorite', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('calendar_events', 'ical_uid', "TEXT NOT NULL DEFAULT ''");
ensureColumn('calendar_events', 'ical_source', "TEXT NOT NULL DEFAULT ''");
ensureColumn('device_settings', 'calendar_ical_token', "TEXT NOT NULL DEFAULT ''");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_ical_uid_idx ON calendar_events (ical_uid) WHERE ical_uid <> ''");
for (const table of ['messages', 'family_messages']) {
  ensureColumn(table, 'reply_kind', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(table, 'reply_message_id', 'INTEGER');
  ensureColumn(table, 'reply_sender_name', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(table, 'reply_body', "TEXT NOT NULL DEFAULT ''");
}

const seed = db.transaction(() => {
  if (!db.prepare('SELECT COUNT(*) AS count FROM members').get().count) {
    const insert = db.prepare('INSERT INTO members (id, name, role, color, is_admin) VALUES (?, ?, ?, ?, ?)');
    insert.run(1, 'Oliver', 'Haushaltsadmin', '#007aff', 1);
    insert.run(2, 'Mia', 'Mitglied', '#ff2d55', 0);
  }
  if (!db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count) {
    const insert = db.prepare('INSERT INTO tasks (id, text, done, person, time) VALUES (?, ?, ?, ?, ?)');
    insert.run(1, 'Pflanzen gießen', 0, 'Oliver', 'Heute');
    insert.run(2, 'Spülmaschine ausräumen', 1, 'Mia', 'Erledigt');
    insert.run(3, 'Papiermüll rausbringen', 0, 'Oliver', '18:00');
  }
  if (!db.prepare('SELECT COUNT(*) AS count FROM shopping').get().count) {
    const insert = db.prepare('INSERT INTO shopping (id, text, checked, category, quantity) VALUES (?, ?, ?, ?, ?)');
    insert.run(1, 'Hafermilch', 0, 'Frühstück', '1 Liter');
    insert.run(2, 'Tomaten', 0, 'Gemüse', '4 Stück');
    insert.run(3, 'Kaffeebohnen', 1, 'Vorrat', '500 g');
  }
});
seed();
db.prepare("INSERT OR IGNORE INTO print_settings (id, printer_name, paper_width, auto_cut) VALUES (1, '', 58, 1)").run();
db.prepare("INSERT OR IGNORE INTO device_settings (id, weather_city) VALUES (1, '')").run();
const calendarIcalToken = () => {
  let token = db.prepare('SELECT calendar_ical_token AS token FROM device_settings WHERE id = 1').get()?.token || '';
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
    token = randomBytes(32).toString('base64url');
    db.prepare('UPDATE device_settings SET calendar_ical_token = ? WHERE id = 1').run(token);
  }
  return token;
};
calendarIcalToken();

const app = express();
app.use(express.json({ limit: '8mb' }));

const vapidPath = path.join(dataDir, 'push-vapid.json');
const loadVapidKeys = () => {
  const environmentKeys = {
    publicKey: String(process.env.HOUSEOS_VAPID_PUBLIC_KEY || ''),
    privateKey: String(process.env.HOUSEOS_VAPID_PRIVATE_KEY || ''),
  };
  if (environmentKeys.publicKey && environmentKeys.privateKey) return environmentKeys;
  try {
    const stored = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
    if (stored.publicKey && stored.privateKey) return stored;
  } catch {}
  const generated = webpush.generateVAPIDKeys();
  fs.writeFileSync(vapidPath, JSON.stringify(generated, null, 2), { mode: 0o600 });
  return generated;
};
const vapidKeys = loadVapidKeys();
webpush.setVapidDetails(process.env.HOUSEOS_VAPID_SUBJECT || 'mailto:houseos@localhost', vapidKeys.publicKey, vapidKeys.privateKey);

const sessions = new Map();
const presenceStates = new Map();
const ONLINE_WINDOW_MS = 12_000;
const touchPresence = memberId => presenceStates.set(Number(memberId), Date.now());
const memberPresence = memberId => {
  const lastSeen = presenceStates.get(Number(memberId)) || 0;
  return { online: Boolean(lastSeen && Date.now() - lastSeen <= ONLINE_WINDOW_MS), lastSeenAt: lastSeen ? new Date(lastSeen).toISOString() : null };
};
const hashPin = (pin, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
const validPin = (pin, stored) => {
  try {
    const [salt, expectedHex] = String(stored).split(':');
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(pin, salt, expected.length);
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch { return false; }
};
const readCookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2));
const sessionMember = (req) => {
  const token = readCookies(req).houseos_session;
  const memberId = token && sessions.get(token);
  return memberId ? db.prepare('SELECT id, name, role, color, is_admin AS isAdmin FROM members WHERE id = ?').get(memberId) : null;
};
const requireAuth = (req, res, next) => {
  const member = sessionMember(req);
  if (!member) return res.status(401).json({ error: 'Bitte anmelden.' });
  req.member = { ...member, isAdmin: Boolean(member.isAdmin) };
  touchPresence(member.id);
  next();
};
const requireAdmin = (req, res, next) => requireAuth(req, res, () => req.member.isAdmin ? next() : res.status(403).json({ error: 'Administratorrechte erforderlich.' }));

const syncClients = new Set();
const broadcastSync = resource => {
  const payload = `event: collection\ndata: ${JSON.stringify({ resource, updatedAt: new Date().toISOString() })}\n\n`;
  for (const client of syncClients) {
    try { client.write(payload); } catch { syncClients.delete(client); }
  }
};

app.get('/api/sync/events', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(`retry: 2000\nevent: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  syncClients.add(res);
  const heartbeat = setInterval(() => { try { res.write(': verbunden\n\n'); } catch {} }, 20_000);
  res.on('close', () => { clearInterval(heartbeat); syncClients.delete(res); });
});

const pushRows = (memberId = null) => db.prepare(`
  SELECT endpoint, member_id AS memberId, subscription
  FROM push_subscriptions
  ${memberId ? 'WHERE member_id = ?' : ''}
`).all(...(memberId ? [memberId] : []));

const sendPush = async (payload, { excludeMemberId = null, memberName = '', endpoint = '' } = {}) => {
  const target = memberName ? db.prepare('SELECT id FROM members WHERE lower(name) = lower(?)').get(memberName) : null;
  const subscriptions = pushRows(target?.id || null).filter(row => row.memberId !== excludeMemberId && (!endpoint || row.endpoint === endpoint));
  await Promise.allSettled(subscriptions.map(async row => {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload), { TTL: 300, urgency: 'normal', topic: payload.tag?.slice(0, 32) });
    } catch (error) {
      if ([404, 410].includes(error?.statusCode)) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint);
      else console.error('Push-Mitteilung fehlgeschlagen:', error?.message || error);
    }
  }));
};

const localDateString = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const calendarEventOccursOn = (event, value) => {
  if (!event.startDate || value < event.startDate) return false;
  if (!event.recurrence || event.recurrence === 'none') return value === event.startDate;
  const start = new Date(`${event.startDate}T12:00:00`); const current = new Date(`${value}T12:00:00`);
  const days = Math.round((current - start) / 86_400_000);
  if (event.recurrence === 'daily') return days >= 0;
  if (event.recurrence === 'weekly') return days >= 0 && days % 7 === 0;
  if (event.recurrence === 'monthly') return current.getDate() === start.getDate();
  if (event.recurrence === 'yearly') return current.getDate() === start.getDate() && current.getMonth() === start.getMonth();
  return false;
};
const reminderLead = minutes => minutes >= 10080 ? 'in einer Woche' : minutes >= 1440 ? 'morgen' : minutes >= 60 ? `in ${Math.round(minutes / 60)} Std.` : minutes > 0 ? `in ${minutes} Min.` : 'jetzt';
const queueCalendarReminders = async () => {
  const now = new Date();
  const events = db.prepare("SELECT id, title, start_date AS startDate, start_time AS startTime, all_day AS allDay, location, participants, recurrence, reminder_minutes AS reminderMinutes FROM calendar_events WHERE reminder_minutes > 0").all();
  for (const event of events) {
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = new Date(now); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset);
      const occurrenceDate = localDateString(day);
      if (!calendarEventOccursOn(event, occurrenceDate)) continue;
      const eventAt = new Date(`${occurrenceDate}T${event.allDay || !event.startTime ? '09:00' : event.startTime}:00`);
      const reminderAt = new Date(eventAt.getTime() - Number(event.reminderMinutes) * 60_000);
      if (reminderAt > now || eventAt.getTime() + 600_000 < now.getTime()) continue;
      const inserted = db.prepare('INSERT OR IGNORE INTO calendar_reminders (event_id, occurrence_date, reminder_minutes) VALUES (?, ?, ?)').run(event.id, occurrenceDate, event.reminderMinutes);
      if (!inserted.changes) continue;
      let participants = [];
      try { participants = JSON.parse(event.participants || '[]'); } catch {}
      const payload = { title: `Termin ${reminderLead(event.reminderMinutes)}`, body: `${event.title}${event.location ? ` · ${event.location}` : ''}`, tag: `calendar-reminder-${event.id}`, url: '/?app=calendar', icon: '/icons/houseos-192.png' };
      if (participants.length) await Promise.allSettled(participants.map(memberName => sendPush(payload, { memberName })));
      else await sendPush(payload);
    }
  }
  db.prepare("DELETE FROM calendar_reminders WHERE sent_at < datetime('now', '-90 days')").run();
};
setTimeout(() => void queueCalendarReminders(), 3_000);
setInterval(() => void queueCalendarReminders(), 60_000);

const queueCollectionPush = (name, previousItems, items, actor) => {
  const previous = new Map(previousItems.map(item => [Number(item.id), item]));
  const current = new Map(items.map(item => [Number(item.id), item]));
  const added = items.filter(item => !previous.has(Number(item.id)));
  const removed = previousItems.filter(item => !current.has(Number(item.id)));
  const changed = items.filter(item => {
    const oldItem = previous.get(Number(item.id));
    return oldItem && JSON.stringify(oldItem) !== JSON.stringify(item);
  });
  const options = {};

  if (name === 'tasks') {
    for (const task of added) {
      void sendPush({ title: task.person ? `Neue Aufgabe für ${task.person}` : 'Neue Aufgabe', body: `${actor.name}: ${task.text}`, tag: `task-${task.id}`, url: '/?app=tasks', icon: '/icons/houseos-192.png' }, { ...options, memberName: task.person });
    }
    for (const task of changed) {
      const oldTask = previous.get(Number(task.id));
      if (!oldTask.done && Boolean(task.done)) {
        void sendPush({ title: 'Aufgabe erledigt', body: `${actor.name} hat „${task.text}“ erledigt.`, tag: `task-${task.id}`, url: '/?app=tasks', icon: '/icons/houseos-192.png' }, options);
      } else if (oldTask.person !== task.person && task.person) {
        void sendPush({ title: `Aufgabe für ${task.person}`, body: `${actor.name} hat dir „${task.text}“ zugewiesen.`, tag: `task-${task.id}`, url: '/?app=tasks', icon: '/icons/houseos-192.png' }, { ...options, memberName: task.person });
      } else if (oldTask.text !== task.text || oldTask.time !== task.time || oldTask.dueDate !== task.dueDate || oldTask.recurrence !== task.recurrence) {
        void sendPush({ title: 'Aufgabe geändert', body: `${actor.name} hat „${task.text}“ aktualisiert.`, tag: `task-${task.id}`, url: '/?app=tasks', icon: '/icons/houseos-192.png' }, { ...options, memberName: task.person });
      }
    }
  }

  if (name === 'shopping' && added.length) {
    const body = added.length === 1 ? `${actor.name} hat ${added[0].quantity || ''} ${added[0].text} hinzugefügt.` : `${actor.name} hat ${added.length} neue Artikel hinzugefügt.`;
    void sendPush({ title: 'Einkaufsliste aktualisiert', body, tag: 'shopping', url: '/?app=shopping', icon: '/icons/houseos-192.png' }, options);
  }

  if (name === 'mealplans') {
    const mealType = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen' };
    for (const meal of added) {
      void sendPush({ title: 'Neues Essen eingeplant', body: `${actor.name}: ${meal.name} als ${mealType[meal.mealType] || 'Essen'}.`, tag: `meal-${meal.id}`, url: '/?app=meals', icon: '/icons/houseos-192.png' }, options);
    }
    for (const meal of changed) {
      void sendPush({ title: 'Speiseplan geändert', body: `${actor.name} hat ${meal.name} aktualisiert.`, tag: `meal-${meal.id}`, url: '/?app=meals', icon: '/icons/houseos-192.png' }, options);
    }
    if (removed.length) {
      const body = removed.length === 1 ? `${actor.name} hat ${removed[0].name} aus dem Plan entfernt.` : `${actor.name} hat ${removed.length} Einträge entfernt.`;
      void sendPush({ title: 'Speiseplan geändert', body, tag: 'meal-plan', url: '/?app=meals', icon: '/icons/houseos-192.png' }, options);
    }
  }

  if (name === 'calendar') {
    for (const event of added) {
      const when = new Date(`${event.startDate}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      void sendPush({ title: 'Neuer Familientermin', body: `${actor.name}: ${event.title} · ${when}`, tag: `calendar-${event.id}`, url: '/?app=calendar', icon: '/icons/houseos-192.png' }, options);
    }
    for (const event of changed) {
      void sendPush({ title: 'Termin geändert', body: `${actor.name} hat „${event.title}“ aktualisiert.`, tag: `calendar-${event.id}`, url: '/?app=calendar', icon: '/icons/houseos-192.png' }, options);
    }
    if (removed.length) {
      const body = removed.length === 1 ? `${actor.name} hat „${removed[0].title}“ entfernt.` : `${actor.name} hat ${removed.length} Termine entfernt.`;
      void sendPush({ title: 'Kalender aktualisiert', body, tag: 'calendar', url: '/?app=calendar', icon: '/icons/houseos-192.png' }, options);
    }
  }
};

app.get('/api/push/status', requireAuth, (req, res) => {
  res.json({ supported: true, publicKey: vapidKeys.publicKey, subscriptions: pushRows(req.member.id).length });
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const subscription = req.body?.subscription;
  const endpoint = String(subscription?.endpoint || '');
  if (!endpoint.startsWith('https://') || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error: 'Ungültiges Push-Abonnement.' });
  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, member_id, subscription)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, subscription = excluded.subscription, updated_at = CURRENT_TIMESTAMP
  `).run(endpoint, req.member.id, JSON.stringify(subscription));
  res.json({ ok: true });
});

app.delete('/api/push/subscribe', requireAuth, (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?').run(endpoint, req.member.id);
  res.json({ ok: true });
});

app.post('/api/push/test', requireAuth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  const subscription = endpoint && db.prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint = ? AND member_id = ?').get(endpoint, req.member.id);
  if (!subscription) return res.status(404).json({ error: 'Dieses Gerät ist nicht für Mitteilungen registriert.' });
  await sendPush({ title: 'HouseOS Mitteilungen', body: 'Benachrichtigungen funktionieren auf diesem Gerät.', tag: 'houseos-test', url: '/?app=today', icon: '/icons/houseos-192.png' }, { memberName: req.member.name, endpoint });
  res.json({ ok: true });
});

const messageMediaDir = path.join(dataDir, 'message-media');
fs.mkdirSync(messageMediaDir, { recursive: true });
const reactionEmojis = new Set(['❤️', '👍', '😂', '🥰', '🎉']);
const attachmentPreview = type => type?.startsWith('audio/') ? '🎤 Sprachnachricht' : type === 'image/gif' ? 'GIF' : '📷 Foto';
const storeMessageAttachment = value => {
  if (!value) return { attachmentPath: '', attachmentType: '' };
  const match = String(value).match(/^data:((?:image\/(?:jpeg|png|webp|gif))|(?:audio\/(?:webm|ogg|mp4|mpeg)));base64,([a-z0-9+/=]+)$/i);
  if (!match) throw Object.assign(new Error('Dieses Medienformat wird nicht unterstützt.'), { status: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  const maxBytes = match[1] === 'image/gif' ? 4_000_000 : match[1].startsWith('audio/') ? 5_000_000 : 1_500_000;
  if (!buffer.length || buffer.length > maxBytes) throw Object.assign(new Error(match[1].startsWith('audio/') ? 'Die Sprachnachricht darf höchstens 5 MB groß sein.' : 'Das Bild darf höchstens 4 MB groß sein.'), { status: 413 });
  const validMagic = match[1] === 'image/jpeg' ? buffer[0] === 0xff && buffer[1] === 0xd8
    : match[1] === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'image/webp' ? buffer.subarray(8, 12).toString() === 'WEBP'
    : match[1] === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())
    : match[1] === 'audio/webm' ? buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : match[1] === 'audio/ogg' ? buffer.subarray(0, 4).toString() === 'OggS'
    : match[1] === 'audio/mp4' ? buffer.subarray(4, 8).toString() === 'ftyp'
    : buffer.subarray(0, 3).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (!validMagic) throw Object.assign(new Error('Die Mediendatei ist beschädigt.'), { status: 400 });
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' }[match[1]];
  const attachmentPath = `${randomBytes(24).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(messageMediaDir, attachmentPath), buffer, { flag: 'wx', mode: 0o600 });
  return { attachmentPath, attachmentType: match[1] };
};
const removeStoredImage = attachmentPath => { if (attachmentPath) try { fs.unlinkSync(path.join(messageMediaDir, attachmentPath)); } catch {} };
const reactionsFor = (kind, messageId, currentMemberId) => db.prepare(`
  SELECT r.emoji, COUNT(*) AS count,
         MAX(CASE WHEN r.member_id = ? THEN 1 ELSE 0 END) AS reactedByMe
  FROM message_reactions r WHERE r.message_kind = ? AND r.message_id = ? GROUP BY r.emoji ORDER BY MIN(r.created_at)
`).all(currentMemberId, kind, messageId).map(item => ({ ...item, count: Number(item.count), reactedByMe: Boolean(item.reactedByMe) }));
const serializeMessage = (row, kind, currentMemberId) => ({
  ...row, kind,
  attachmentUrl: row.attachmentPath ? `/api/message-media/${row.attachmentPath}` : '',
  reply: row.replyMessageId ? { kind: row.replyKind, id: row.replyMessageId, senderName: row.replySenderName, body: row.replyBody } : null,
  reactions: reactionsFor(kind, row.id, currentMemberId),
});
const messageRow = `
  SELECT msg.id, msg.sender_id AS senderId, msg.recipient_id AS recipientId,
         msg.body, msg.attachment_path AS attachmentPath, msg.attachment_type AS attachmentType,
         msg.created_at AS createdAt, msg.edited_at AS editedAt, msg.read_at AS readAt,
         msg.reply_kind AS replyKind, msg.reply_message_id AS replyMessageId,
         msg.reply_sender_name AS replySenderName, msg.reply_body AS replyBody,
         sender.name AS senderName, sender.color AS senderColor
  FROM messages msg JOIN members sender ON sender.id = msg.sender_id
`;
const familyMessageRow = `
  SELECT msg.id, msg.sender_id AS senderId, NULL AS recipientId,
         msg.body, msg.attachment_path AS attachmentPath, msg.attachment_type AS attachmentType,
         msg.created_at AS createdAt, msg.edited_at AS editedAt, NULL AS readAt,
         msg.reply_kind AS replyKind, msg.reply_message_id AS replyMessageId,
         msg.reply_sender_name AS replySenderName, msg.reply_body AS replyBody,
         sender.name AS senderName, sender.color AS senderColor
  FROM family_messages msg JOIN members sender ON sender.id = msg.sender_id
`;
const typingStates = new Map();
const directConversationKey = (firstId, secondId) => `direct:${[Number(firstId), Number(secondId)].sort((a, b) => a - b).join(':')}`;
const typingMembers = (conversationKey, currentMemberId) => {
  const now = Date.now(); const memberIds = [];
  for (const [memberId, state] of typingStates) {
    if (state.expiresAt <= now) { typingStates.delete(memberId); continue; }
    if (memberId !== currentMemberId && state.conversationKey === conversationKey) memberIds.push(memberId);
  }
  if (!memberIds.length) return [];
  const placeholders = memberIds.map(() => '?').join(',');
  return db.prepare(`SELECT id, name, color FROM members WHERE id IN (${placeholders}) ORDER BY lower(name)`).all(...memberIds);
};
const resolveReply = ({ family, recipientId, replyTo, currentMemberId }) => {
  if (!replyTo) return { kind: '', messageId: null, senderName: '', body: '' };
  const kind = String(replyTo.kind || ''); const messageId = Number(replyTo.id);
  if ((family && kind !== 'family') || (!family && kind !== 'direct') || !Number.isInteger(messageId)) throw Object.assign(new Error('Die beantwortete Nachricht ist ungültig.'), { status: 400 });
  const row = family
    ? db.prepare(`${familyMessageRow} WHERE msg.id = ?`).get(messageId)
    : db.prepare(`${messageRow} WHERE msg.id = ? AND ((msg.sender_id = ? AND msg.recipient_id = ?) OR (msg.sender_id = ? AND msg.recipient_id = ?))`).get(messageId, currentMemberId, recipientId, recipientId, currentMemberId);
  if (!row) throw Object.assign(new Error('Die beantwortete Nachricht wurde nicht gefunden.'), { status: 404 });
  return { kind, messageId, senderName: row.senderName, body: String(row.body || attachmentPreview(row.attachmentType)).slice(0, 240) };
};

app.post('/api/messages/typing', requireAuth, (req, res) => {
  const family = req.body?.family === true;
  const recipientId = Number(req.body?.recipientId);
  if (!family && !db.prepare('SELECT id FROM members WHERE id = ? AND id <> ?').get(recipientId, req.member.id)) return res.status(404).json({ error: 'Empfänger nicht gefunden.' });
  const conversationKey = family ? 'family' : directConversationKey(req.member.id, recipientId);
  if (req.body?.typing === true) typingStates.set(req.member.id, { conversationKey, expiresAt: Date.now() + 5_000 });
  else if (typingStates.get(req.member.id)?.conversationKey === conversationKey) typingStates.delete(req.member.id);
  res.json({ ok: true });
});

app.get('/api/messages/conversations', requireAuth, (req, res) => {
  const members = db.prepare(`
    SELECT m.id, m.name, m.role, m.color,
      (SELECT CASE WHEN length(x.body) THEN x.body WHEN x.attachment_type LIKE 'audio/%' THEN '🎤 Sprachnachricht' WHEN x.attachment_type = 'image/gif' THEN 'GIF' ELSE '📷 Foto' END FROM messages x WHERE (x.sender_id = ? AND x.recipient_id = m.id) OR (x.sender_id = m.id AND x.recipient_id = ?) ORDER BY x.id DESC LIMIT 1) AS lastMessage,
      (SELECT created_at FROM messages x WHERE (x.sender_id = ? AND x.recipient_id = m.id) OR (x.sender_id = m.id AND x.recipient_id = ?) ORDER BY x.id DESC LIMIT 1) AS lastMessageAt,
      (SELECT COUNT(*) FROM messages x WHERE x.sender_id = m.id AND x.recipient_id = ? AND x.read_at IS NULL) AS unreadCount
    FROM members m WHERE m.id <> ? ORDER BY lastMessageAt IS NULL, lastMessageAt DESC, lower(m.name)
  `).all(req.member.id, req.member.id, req.member.id, req.member.id, req.member.id, req.member.id);
  const familyLast = db.prepare("SELECT CASE WHEN length(body) THEN body WHEN attachment_type LIKE 'audio/%' THEN '🎤 Sprachnachricht' WHEN attachment_type = 'image/gif' THEN 'GIF' ELSE '📷 Foto' END AS lastMessage, created_at AS lastMessageAt FROM family_messages ORDER BY id DESC LIMIT 1").get() || {};
  const familyRead = db.prepare('SELECT last_read_message_id AS lastReadId FROM family_read_state WHERE member_id = ?').get(req.member.id)?.lastReadId || 0;
  const familyUnread = db.prepare('SELECT COUNT(*) AS count FROM family_messages WHERE id > ? AND sender_id <> ?').get(familyRead, req.member.id).count;
  const family = { id: 'family', name: 'Familienchat', role: 'Alle zusammen', color: '#ff9f0a', ...familyLast, unreadCount: Number(familyUnread) };
  const directUnread = members.reduce((sum, member) => sum + Number(member.unreadCount), 0);
  res.json({ family, members: members.map(member => ({ ...member, ...memberPresence(member.id), unreadCount: Number(member.unreadCount) })), unreadCount: directUnread + family.unreadCount });
});

app.get('/api/messages/family', requireAuth, (req, res) => {
  const messages = db.prepare(`${familyMessageRow} ORDER BY msg.id DESC LIMIT 200`).all().reverse().map(row => serializeMessage(row, 'family', req.member.id));
  const onlineCount = db.prepare('SELECT id FROM members WHERE id <> ?').all(req.member.id).filter(member => memberPresence(member.id).online).length;
  res.json({ member: { id: 'family', name: 'Familienchat', role: 'Alle zusammen', color: '#ff9f0a' }, messages, typing: typingMembers('family', req.member.id), presence: { online: onlineCount > 0, onlineCount } });
});

app.post('/api/messages/family/read', requireAuth, (req, res) => {
  const lastId = db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM family_messages').get().id;
  db.prepare(`INSERT INTO family_read_state (member_id, last_read_message_id) VALUES (?, ?)
    ON CONFLICT(member_id) DO UPDATE SET last_read_message_id = MAX(last_read_message_id, excluded.last_read_message_id)`).run(req.member.id, lastId);
  res.json({ ok: true, lastReadId: lastId });
});

app.get('/api/messages/:memberId', requireAuth, (req, res) => {
  const otherId = Number(req.params.memberId);
  const other = db.prepare('SELECT id, name, role, color FROM members WHERE id = ? AND id <> ?').get(otherId, req.member.id);
  if (!other) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  const messages = db.prepare(`${messageRow} WHERE (msg.sender_id = ? AND msg.recipient_id = ?) OR (msg.sender_id = ? AND msg.recipient_id = ?) ORDER BY msg.id DESC LIMIT 200`)
    .all(req.member.id, otherId, otherId, req.member.id).reverse().map(row => serializeMessage(row, 'direct', req.member.id));
  res.json({ member: other, messages, typing: typingMembers(directConversationKey(req.member.id, otherId), req.member.id), presence: memberPresence(otherId) });
});

app.post('/api/messages', requireAuth, (req, res) => {
  const family = req.body?.family === true;
  const recipientId = Number(req.body?.recipientId);
  const typedBody = String(req.body?.body || '').trim();
  if (typedBody.length > 1000) return res.status(400).json({ error: 'Die Nachricht darf höchstens 1.000 Zeichen lang sein.' });
  const recipient = family ? null : db.prepare('SELECT id, name FROM members WHERE id = ? AND id <> ?').get(recipientId, req.member.id);
  if (!family && !recipient) return res.status(404).json({ error: 'Empfänger nicht gefunden.' });
  let attachment;
  let reply;
  try {
    reply = resolveReply({ family, recipientId, replyTo: req.body?.replyTo, currentMemberId: req.member.id });
    attachment = storeMessageAttachment(req.body?.attachment || req.body?.image);
  } catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
  if (!typedBody && !attachment.attachmentPath) return res.status(400).json({ error: 'Schreibe eine Nachricht oder füge ein Medium hinzu.' });
  try {
    if (family) {
      const result = db.prepare('INSERT INTO family_messages (sender_id, body, attachment_path, attachment_type, reply_kind, reply_message_id, reply_sender_name, reply_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(req.member.id, typedBody, attachment.attachmentPath, attachment.attachmentType, reply.kind, reply.messageId, reply.senderName, reply.body);
      const message = serializeMessage(db.prepare(`${familyMessageRow} WHERE msg.id = ?`).get(result.lastInsertRowid), 'family', req.member.id);
      const preview = typedBody || (attachment.attachmentType.startsWith('audio/') ? '🎤 hat eine Sprachnachricht gesendet.' : attachment.attachmentType === 'image/gif' ? 'hat ein GIF geteilt.' : '📷 hat ein Foto geteilt.');
      void sendPush({ title: `${req.member.name} im Familienchat`, body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview, tag: 'messages-family', url: '/?app=messages&with=family', icon: '/icons/houseos-192.png' }, { excludeMemberId: req.member.id });
      return res.status(201).json(message);
    }
    const storedBody = typedBody || attachmentPreview(attachment.attachmentType);
    const result = db.prepare('INSERT INTO messages (sender_id, recipient_id, body, attachment_path, attachment_type, reply_kind, reply_message_id, reply_sender_name, reply_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(req.member.id, recipient.id, storedBody, attachment.attachmentPath, attachment.attachmentType, reply.kind, reply.messageId, reply.senderName, reply.body);
    const message = serializeMessage(db.prepare(`${messageRow} WHERE msg.id = ?`).get(result.lastInsertRowid), 'direct', req.member.id);
    const preview = typedBody || (attachment.attachmentType.startsWith('audio/') ? '🎤 hat dir eine Sprachnachricht geschickt.' : attachment.attachmentType === 'image/gif' ? 'hat dir ein GIF geschickt.' : '📷 hat dir ein Foto geschickt.');
    void sendPush({ title: `Nachricht von ${req.member.name}`, body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview, tag: `messages-${req.member.id}`, url: `/?app=messages&with=${req.member.id}`, icon: '/icons/houseos-192.png' }, { memberName: recipient.name });
    res.status(201).json(message);
  } catch (error) {
    removeStoredImage(attachment.attachmentPath);
    console.error('Nachricht konnte nicht gespeichert werden:', error);
    res.status(500).json({ error: 'Nachricht konnte nicht gespeichert werden.' });
  }
});

app.post('/api/messages/:memberId/read', requireAuth, (req, res) => {
  const result = db.prepare("UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL").run(Number(req.params.memberId), req.member.id);
  res.json({ ok: true, changed: result.changes });
});

app.patch('/api/messages/:kind/:messageId', requireAuth, (req, res) => {
  const kind = String(req.params.kind);
  const messageId = Number(req.params.messageId);
  const body = String(req.body?.body || '').trim();
  if (!['direct', 'family'].includes(kind) || !Number.isInteger(messageId)) return res.status(400).json({ error: 'Ungültige Nachricht.' });
  if (body.length > 1000) return res.status(400).json({ error: 'Die Nachricht darf höchstens 1.000 Zeichen lang sein.' });
  const table = kind === 'family' ? 'family_messages' : 'messages';
  const existing = db.prepare(`SELECT id, attachment_path AS attachmentPath, attachment_type AS attachmentType FROM ${table} WHERE id = ? AND sender_id = ?`).get(messageId, req.member.id);
  if (!existing) return res.status(404).json({ error: 'Nachricht nicht gefunden oder nicht von dir.' });
  if (!body && !existing.attachmentPath) return res.status(400).json({ error: 'Die Nachricht darf nicht leer sein.' });
  const storedBody = body || (kind === 'direct' ? attachmentPreview(existing.attachmentType) : '');
  db.prepare(`UPDATE ${table} SET body = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?`).run(storedBody, messageId);
  const row = db.prepare(`${kind === 'family' ? familyMessageRow : messageRow} WHERE msg.id = ?`).get(messageId);
  res.json(serializeMessage(row, kind, req.member.id));
});

app.delete('/api/messages/:kind/:messageId', requireAuth, (req, res) => {
  const kind = String(req.params.kind);
  const messageId = Number(req.params.messageId);
  if (!['direct', 'family'].includes(kind) || !Number.isInteger(messageId)) return res.status(400).json({ error: 'Ungültige Nachricht.' });
  const table = kind === 'family' ? 'family_messages' : 'messages';
  const existing = db.prepare(`SELECT id, attachment_path AS attachmentPath FROM ${table} WHERE id = ? AND sender_id = ?`).get(messageId, req.member.id);
  if (!existing) return res.status(404).json({ error: 'Nachricht nicht gefunden oder nicht von dir.' });
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM message_reactions WHERE message_kind = ? AND message_id = ?').run(kind, messageId);
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(messageId);
  });
  remove();
  removeStoredImage(existing.attachmentPath);
  res.json({ ok: true, id: messageId, kind });
});

app.post('/api/messages/:kind/:messageId/reactions', requireAuth, (req, res) => {
  const kind = String(req.params.kind);
  const messageId = Number(req.params.messageId);
  const emoji = String(req.body?.emoji || '');
  if (!['direct', 'family'].includes(kind) || !reactionEmojis.has(emoji)) return res.status(400).json({ error: 'Ungültige Reaktion.' });
  const allowed = kind === 'family'
    ? db.prepare('SELECT id FROM family_messages WHERE id = ?').get(messageId)
    : db.prepare('SELECT id FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)').get(messageId, req.member.id, req.member.id);
  if (!allowed) return res.status(404).json({ error: 'Nachricht nicht gefunden.' });
  const existing = db.prepare('SELECT 1 FROM message_reactions WHERE message_kind = ? AND message_id = ? AND member_id = ? AND emoji = ?').get(kind, messageId, req.member.id, emoji);
  if (existing) db.prepare('DELETE FROM message_reactions WHERE message_kind = ? AND message_id = ? AND member_id = ? AND emoji = ?').run(kind, messageId, req.member.id, emoji);
  else db.prepare('INSERT INTO message_reactions (message_kind, message_id, member_id, emoji) VALUES (?, ?, ?, ?)').run(kind, messageId, req.member.id, emoji);
  res.json({ reactions: reactionsFor(kind, messageId, req.member.id) });
});

app.get('/api/message-media/:filename', requireAuth, (req, res) => {
  const filename = String(req.params.filename);
  if (!/^[a-f0-9]{48}\.(?:jpg|png|webp|gif|webm|ogg|m4a|mp3)$/.test(filename)) return res.status(404).end();
  const direct = db.prepare('SELECT attachment_type AS type FROM messages WHERE attachment_path = ? AND (sender_id = ? OR recipient_id = ?)').get(filename, req.member.id, req.member.id);
  const family = direct ? null : db.prepare('SELECT attachment_type AS type FROM family_messages WHERE attachment_path = ?').get(filename);
  const media = direct || family;
  if (!media) return res.status(404).end();
  res.type(media.type).sendFile(path.join(messageMediaDir, filename));
});

app.get('/api/auth/users', (_req, res) => {
  const users = db.prepare("SELECT id, name, role, color, is_admin AS isAdmin, pin_hash <> '' AS hasPin FROM members ORDER BY is_admin DESC, created_at ASC").all();
  res.json(users.map(user => ({ ...user, isAdmin: Boolean(user.isAdmin), hasPin: Boolean(user.hasPin) })));
});

app.get('/api/auth/session', (req, res) => {
  const member = sessionMember(req);
  if (!member) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, member: { ...member, isAdmin: Boolean(member.isAdmin) } });
});

app.post('/api/auth/setup-pin', (req, res) => {
  const memberId = Number(req.body?.memberId);
  const pin = String(req.body?.pin || '');
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'Die PIN muss aus 4 bis 6 Ziffern bestehen.' });
  const member = db.prepare('SELECT id, pin_hash AS pinHash FROM members WHERE id = ?').get(memberId);
  if (!member) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  if (member.pinHash) return res.status(409).json({ error: 'Für diesen Benutzer ist bereits eine PIN eingerichtet.' });
  db.prepare('UPDATE members SET pin_hash = ? WHERE id = ?').run(hashPin(pin), memberId);
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const memberId = Number(req.body?.memberId);
  const pin = String(req.body?.pin || '');
  const member = db.prepare('SELECT id, name, role, color, is_admin AS isAdmin, pin_hash AS pinHash FROM members WHERE id = ?').get(memberId);
  if (!member?.pinHash || !validPin(pin, member.pinHash)) return res.status(401).json({ error: 'Die PIN ist nicht korrekt.' });
  const token = randomBytes(32).toString('hex');
  sessions.set(token, member.id);
  res.setHeader('Set-Cookie', `houseos_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
  res.json({ member: { id: member.id, name: member.name, role: member.role, color: member.color, isAdmin: Boolean(member.isAdmin) } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = readCookies(req).houseos_session;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'houseos_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.patch('/api/profile', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const color = String(req.body?.color || '').trim();
  if (name.length < 2 || name.length > 40) return res.status(400).json({ error: 'Der Name muss zwischen 2 und 40 Zeichen lang sein.' });
  if (!/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Die Akzentfarbe ist ungültig.' });
  const duplicate = db.prepare('SELECT id FROM members WHERE lower(name) = lower(?) AND id <> ?').get(name, req.member.id);
  if (duplicate) return res.status(409).json({ error: 'Dieser Name wird bereits verwendet.' });
  const update = db.transaction(() => {
    if (name !== req.member.name) db.prepare('UPDATE tasks SET person = ? WHERE person = ?').run(name, req.member.name);
    db.prepare('UPDATE members SET name = ?, color = ? WHERE id = ?').run(name, color, req.member.id);
  });
  update();
  broadcastSync('members');
  broadcastSync('tasks');
  res.json({ member: { ...req.member, name, color } });
});

app.get('/api/system/info', requireAdmin, (_req, res) => {
  let updateStatus = null;
  try { updateStatus = JSON.parse(fs.readFileSync(path.join(dataDir, 'update-status.json'), 'utf8')); } catch {}
  res.json({
    version: packageInfo.version,
    name: packageInfo.name,
    hostname: os.hostname(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(os.uptime()),
    repository: process.env.HOUSEOS_GITHUB_REPO || '',
    installerReady: process.platform === 'linux' && validRepository(process.env.HOUSEOS_GITHUB_REPO || ''),
    deviceActionsSupported: process.platform === 'linux',
    updateStatus,
  });
});

app.post('/api/system/action', requireAdmin, (req, res) => {
  const action = String(req.body?.action || '');
  if (!['reboot', 'shutdown', 'exitKiosk'].includes(action)) return res.status(400).json({ error: 'Unbekannte Geräteaktion.' });
  if (process.platform !== 'linux') return res.status(501).json({ error: 'Geräteaktionen sind nur auf dem Raspberry Pi verfügbar.' });
  if (action === 'exitKiosk') {
    try { fs.writeFileSync(path.join(dataDir, 'exit-kiosk'), new Date().toISOString()); }
    catch { return res.status(500).json({ error: 'Kiosk-Modus konnte nicht vorbereitet werden.' }); }
    res.status(202).json({ ok: true, message: 'Der Kiosk-Modus wird beendet.' });
    setTimeout(() => execFile('pkill', ['-TERM', '-u', os.userInfo().username, '-f', 'chromium.*--kiosk'], { windowsHide: true }, () => {}), 350);
    return;
  }
  const command = action === 'reboot' ? 'reboot' : 'poweroff';
  res.status(202).json({ ok: true, message: action === 'reboot' ? 'Der Raspberry Pi wird neu gestartet.' : 'Der Raspberry Pi wird heruntergefahren.' });
  setTimeout(() => execFile('sudo', ['-n', 'systemctl', command], { windowsHide: true }, () => {}), 500);
});

let updateCache = null;
app.get('/api/updates/check', requireAdmin, async (req, res) => {
  try {
    const force = req.query.force === '1';
    if (!force && updateCache && Date.now() - updateCache.checkedAt < 5 * 60 * 1000) return res.json(updateCache.value);
    const value = await getLatestRelease({ repository: process.env.HOUSEOS_GITHUB_REPO || '', currentVersion: packageInfo.version, token: process.env.GITHUB_TOKEN || '' });
    updateCache = { checkedAt: Date.now(), value };
    res.json(value);
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'Updateprüfung fehlgeschlagen.' }); }
});

app.post('/api/updates/install', requireAdmin, async (_req, res) => {
  if (process.platform !== 'linux') return res.status(501).json({ error: 'Updates können nur auf dem Raspberry Pi installiert werden.' });
  const repository = process.env.HOUSEOS_GITHUB_REPO || '';
  try {
    const release = await getLatestRelease({ repository, currentVersion: packageInfo.version, token: process.env.GITHUB_TOKEN || '' });
    if (!release.hasUpdate) return res.status(409).json({ error: 'HouseOS ist bereits aktuell.' });
    if (!release.installable || !release.artifact?.digest) return res.status(422).json({ error: 'Das Release enthält kein geprüftes HouseOS-Updatepaket.' });
    const pending = { repository, version: release.latestVersion, artifactApiUrl: release.artifact.apiUrl, digest: release.artifact.digest, requestedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dataDir, 'pending-update.json'), JSON.stringify(pending, null, 2));
    fs.writeFileSync(path.join(dataDir, 'update-status.json'), JSON.stringify({ status: 'queued', message: `HouseOS ${release.latestVersion} wurde zur Installation vorgemerkt.`, updatedAt: new Date().toISOString(), version: release.latestVersion }, null, 2));
    execFile('sudo', ['-n', 'systemctl', '--no-block', 'start', 'houseos-updater.service'], { windowsHide: true }, (error) => {
      if (error) fs.writeFileSync(path.join(dataDir, 'update-status.json'), JSON.stringify({ status: 'error', message: `Updater konnte nicht gestartet werden: ${error.message}`, updatedAt: new Date().toISOString(), version: release.latestVersion }, null, 2));
    });
    res.status(202).json({ ok: true, status: 'queued', version: release.latestVersion, message: `HouseOS ${release.latestVersion} wurde vorbereitet. Der Installationsdienst startet jetzt.` });
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'Update konnte nicht gestartet werden.' }); }
});

app.get('/api/updates/status', requireAdmin, (_req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(path.join(dataDir, 'update-status.json'), 'utf8'))); }
  catch { res.json({ status: 'idle', message: 'Keine Installation aktiv.' }); }
});

const geocodeCity = async (city) => {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: city, count: '1', language: 'de', format: 'json' });
  const response = await fetch(url);
  if (!response.ok) throw new Error('Stadtsuche ist momentan nicht erreichbar.');
  const result = (await response.json()).results?.[0];
  if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) throw new Error(`Die Stadt „${city}“ wurde nicht gefunden.`);
  return { latitude: result.latitude, longitude: result.longitude, location: [result.name, result.admin1].filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join(', ') };
};

app.get('/api/device/settings', requireAuth, (_req, res) => {
  const row = db.prepare('SELECT weather_city AS city FROM device_settings WHERE id = 1').get();
  res.json({ city: row?.city || '' });
});

app.put('/api/device/settings', requireAdmin, async (req, res) => {
  const city = String(req.body?.city || '').trim();
  if (city.length > 80) return res.status(400).json({ error: 'Der Stadtname darf höchstens 80 Zeichen lang sein.' });
  try {
    const place = city ? await geocodeCity(city) : null;
    db.prepare('UPDATE device_settings SET weather_city = ? WHERE id = 1').run(city);
    res.json({ ok: true, city, location: place?.location || '' });
  } catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Die Stadt konnte nicht gespeichert werden.' }); }
});

const contextCache = new Map();
app.get('/api/device-context', requireAuth, async (req, res) => {
  const savedCity = db.prepare('SELECT weather_city AS city FROM device_settings WHERE id = 1').get()?.city || '';
  const requestedCity = String(req.query.city ?? savedCity).trim();
  let latitudeValue = req.query.lat ?? process.env.HOUSEOS_LATITUDE;
  let longitudeValue = req.query.lon ?? process.env.HOUSEOS_LONGITUDE;
  let configuredLocation = '';
  if (requestedCity) {
    try {
      const place = await geocodeCity(requestedCity);
      latitudeValue = place.latitude;
      longitudeValue = place.longitude;
      configuredLocation = place.location;
    } catch (error) { return res.status(422).json({ error: error instanceof Error ? error.message : 'Die festgelegte Stadt wurde nicht gefunden.' }); }
  }
  if (latitudeValue === undefined || longitudeValue === undefined) {
    try {
      const locationResponse = await fetch('https://ipwho.is/');
      if (!locationResponse.ok) throw new Error('IP-Standortdienst nicht erreichbar');
      const ipLocation = await locationResponse.json();
      if (!ipLocation.success) throw new Error(ipLocation.message || 'IP-Standort konnte nicht ermittelt werden');
      latitudeValue = ipLocation.latitude;
      longitudeValue = ipLocation.longitude;
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : 'IP-Standort konnte nicht ermittelt werden.' });
    }
  }
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ error: 'Ungültige Koordinaten.' });
  const cacheKey = requestedCity ? `city:${requestedCity.toLocaleLowerCase('de-DE')}` : `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) return res.json(cached.value);
  try {
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'temperature_2m,apparent_temperature,weather_code', daily: 'temperature_2m_max,temperature_2m_min', timezone: 'auto', forecast_days: '1' });
    const placeUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    placeUrl.search = new URLSearchParams({ format: 'jsonv2', lat: String(latitude), lon: String(longitude), zoom: '10', addressdetails: '1', 'accept-language': 'de' });
    const [weatherResponse, placeResponse] = await Promise.all([
      fetch(weatherUrl),
      fetch(placeUrl, { headers: { 'User-Agent': 'HouseOS/0.1 (local household dashboard)' } }),
    ]);
    if (!weatherResponse.ok) throw new Error('Wetterdienst nicht erreichbar');
    const weather = await weatherResponse.json();
    const place = placeResponse.ok ? await placeResponse.json() : {};
    const address = place.address || {};
    const location = configuredLocation || address.city || address.town || address.village || address.municipality || address.county || 'Aktueller Standort';
    const value = { location, configuredCity: requestedCity, timezone: weather.timezone, weather: { temperature: weather.current?.temperature_2m, apparentTemperature: weather.current?.apparent_temperature, code: weather.current?.weather_code, minimum: weather.daily?.temperature_2m_min?.[0], maximum: weather.daily?.temperature_2m_max?.[0] } };
    contextCache.set(cacheKey, { createdAt: Date.now(), value });
    res.json(value);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Standortdaten nicht verfügbar.' });
  }
});

const collections = {
  members: {
    select: 'SELECT id, name, role, color, is_admin AS isAdmin FROM members ORDER BY is_admin DESC, created_at ASC',
    insert: db.prepare('INSERT INTO members (id, name, role, color, is_admin, pin_hash) VALUES (@id, @name, @role, @color, @isAdmin, @pinHash)'),
    normalize: (item) => ({ id: Number(item.id), name: String(item.name || '').trim(), role: String(item.role || 'Mitglied').trim(), color: String(item.color || '#007aff'), isAdmin: item.isAdmin ? 1 : 0, pinHash: '' }),
  },
  tasks: {
    select: 'SELECT id, text, done, person, time, due_date AS dueDate, recurrence, notes, recurrence_interval AS recurrenceInterval, recurrence_days AS recurrenceDays, rotation, checklist, points, parent_task_id AS parentTaskId, series_id AS seriesId FROM tasks ORDER BY done ASC, due_date ASC, time ASC, created_at ASC',
    insert: db.prepare('INSERT INTO tasks (id, text, done, person, time, due_date, recurrence, notes, recurrence_interval, recurrence_days, rotation, checklist, points, parent_task_id, series_id) VALUES (@id, @text, @done, @person, @time, @dueDate, @recurrence, @notes, @recurrenceInterval, @recurrenceDays, @rotation, @checklist, @points, @parentTaskId, @seriesId)'),
    normalize: (item) => ({
      id: Number(item.id), text: String(item.text || '').trim(), done: item.done ? 1 : 0,
      person: String(item.person || ''), time: String(item.time || ''), dueDate: String(item.dueDate || ''),
      recurrence: ['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(item.recurrence) ? item.recurrence : 'none',
      notes: String(item.notes || '').trim().slice(0, 1000),
      recurrenceInterval: Math.max(1, Math.min(30, Number(item.recurrenceInterval) || 1)),
      recurrenceDays: JSON.stringify((Array.isArray(item.recurrenceDays) ? item.recurrenceDays : []).map(Number).filter(day => day >= 1 && day <= 7)),
      rotation: JSON.stringify((Array.isArray(item.rotation) ? item.rotation : []).map(name => String(name).trim()).filter(Boolean).slice(0, 20)),
      checklist: JSON.stringify((Array.isArray(item.checklist) ? item.checklist : []).map((entry, index) => ({ id: String(entry?.id || index), text: String(entry?.text || '').trim(), done: Boolean(entry?.done) })).filter(entry => entry.text).slice(0, 30)),
      points: Math.max(0, Math.min(100, Number.isFinite(Number(item.points)) ? Number(item.points) : 10)),
      parentTaskId: Number(item.parentTaskId) || null,
      seriesId: String(item.seriesId || (item.recurrence && item.recurrence !== 'none' ? `series-${item.id}` : '')),
    }),
    deserialize: (row) => {
      const parse = (value) => { try { return JSON.parse(value || '[]'); } catch { return []; } };
      return { ...row, done: Boolean(row.done), recurrenceDays: parse(row.recurrenceDays), rotation: parse(row.rotation), checklist: parse(row.checklist) };
    },
  },
  shopping: {
    select: 'SELECT id, text, checked, category, quantity FROM shopping ORDER BY created_at ASC',
    insert: db.prepare('INSERT INTO shopping (id, text, checked, category, quantity) VALUES (@id, @text, @checked, @category, @quantity)'),
    normalize: (item) => ({ id: Number(item.id), text: String(item.text || '').trim(), checked: item.checked ? 1 : 0, category: String(item.category || 'Sonstiges'), quantity: String(item.quantity || '1 Stück').trim() }),
  },
  mealplans: {
    table: 'meal_plans',
    select: "SELECT id, date, meal_type AS mealType, name, ingredients, servings FROM meal_plans ORDER BY date ASC, CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END",
    insert: db.prepare('INSERT INTO meal_plans (id, date, meal_type, name, ingredients, servings) VALUES (@id, @date, @mealType, @name, @ingredients, @servings)'),
    normalize: (item) => ({
      id: Number(item.id),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : '',
      mealType: ['breakfast', 'lunch', 'dinner'].includes(item.mealType) ? item.mealType : 'lunch',
      name: String(item.name || '').trim(),
      servings: Math.max(1, Math.min(24, Number(item.servings) || 2)),
      ingredients: JSON.stringify((Array.isArray(item.ingredients) ? item.ingredients : []).map(ingredient => ({ name: String(ingredient?.name || '').trim(), quantity: String(ingredient?.quantity || '1 Stück').trim() })).filter(ingredient => ingredient.name).slice(0, 40)),
    }),
    deserialize: (row) => {
      try { return { ...row, ingredients: JSON.parse(row.ingredients || '[]') }; }
      catch { return { ...row, ingredients: [] }; }
    },
  },
  dishes: {
    select: 'SELECT id, name, ingredients, servings, steps, prep_minutes AS prepMinutes, category, favorite FROM dishes ORDER BY favorite DESC, name COLLATE NOCASE ASC',
    insert: db.prepare('INSERT INTO dishes (id, name, ingredients, servings, steps, prep_minutes, category, favorite) VALUES (@id, @name, @ingredients, @servings, @steps, @prepMinutes, @category, @favorite)'),
    normalize: (item) => ({
      id: Number(item.id),
      name: String(item.name || '').trim(),
      servings: Math.max(1, Math.min(24, Number(item.servings) || 2)),
      steps: JSON.stringify((Array.isArray(item.steps) ? item.steps : []).map(step => String(step || '').trim()).filter(Boolean).slice(0, 30)),
      prepMinutes: Math.max(0, Math.min(1440, Number(item.prepMinutes) || 0)),
      category: String(item.category || 'Hauptgericht').trim().slice(0, 40),
      favorite: item.favorite ? 1 : 0,
      ingredients: JSON.stringify((Array.isArray(item.ingredients) ? item.ingredients : []).map(ingredient => ({ name: String(ingredient?.name || '').trim(), quantity: String(ingredient?.quantity || '1 Stück').trim() })).filter(ingredient => ingredient.name).slice(0, 40)),
    }),
    deserialize: (row) => {
      try { return { ...row, favorite: Boolean(row.favorite), ingredients: JSON.parse(row.ingredients || '[]'), steps: JSON.parse(row.steps || '[]') }; }
      catch { return { ...row, favorite: Boolean(row.favorite), ingredients: [], steps: [] }; }
    },
  },
  calendar: {
    table: 'calendar_events',
    select: 'SELECT id, title, description, start_date AS startDate, start_time AS startTime, end_date AS endDate, end_time AS endTime, all_day AS allDay, location, participants, color, recurrence, reminder_minutes AS reminderMinutes, ical_uid AS icalUid, ical_source AS icalSource FROM calendar_events ORDER BY start_date ASC, start_time ASC',
    insert: db.prepare('INSERT INTO calendar_events (id, title, description, start_date, start_time, end_date, end_time, all_day, location, participants, color, recurrence, reminder_minutes, ical_uid, ical_source) VALUES (@id, @title, @description, @startDate, @startTime, @endDate, @endTime, @allDay, @location, @participants, @color, @recurrence, @reminderMinutes, @icalUid, @icalSource)'),
    normalize: (item) => ({
      id: Number(item.id), title: String(item.title || '').trim().slice(0, 120), description: String(item.description || '').trim().slice(0, 1000),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.startDate || '')) ? String(item.startDate) : '', startTime: String(item.startTime || ''),
      endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.endDate || '')) ? String(item.endDate) : String(item.startDate || ''), endTime: String(item.endTime || ''),
      allDay: item.allDay ? 1 : 0, location: String(item.location || '').trim().slice(0, 160),
      participants: JSON.stringify((Array.isArray(item.participants) ? item.participants : []).map(name => String(name).trim()).filter(Boolean).slice(0, 20)),
      color: /^#[0-9a-f]{6}$/i.test(String(item.color || '')) ? String(item.color) : '#0a84ff',
      recurrence: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(item.recurrence) ? item.recurrence : 'none',
      reminderMinutes: Math.max(0, Math.min(10080, Number(item.reminderMinutes) || 0)),
      icalUid: String(item.icalUid || '').trim().replace(/[\r\n]/g, '').slice(0, 255),
      icalSource: String(item.icalSource || '').trim().slice(0, 120),
    }),
    deserialize: (row) => { try { return { ...row, allDay: Boolean(row.allDay), participants: JSON.parse(row.participants || '[]') }; } catch { return { ...row, allDay: Boolean(row.allDay), participants: [] }; } },
  },
  shoppingcatalog: {
    table: 'shopping_catalog',
    select: 'SELECT id, text, category, quantity, favorite, usage_count AS usageCount FROM shopping_catalog ORDER BY favorite DESC, usage_count DESC, text COLLATE NOCASE ASC',
    insert: db.prepare('INSERT INTO shopping_catalog (id, text, category, quantity, favorite, usage_count) VALUES (@id, @text, @category, @quantity, @favorite, @usageCount)'),
    normalize: (item) => ({ id: Number(item.id), text: String(item.text || '').trim().slice(0, 100), category: String(item.category || 'Sonstiges').trim().slice(0, 50), quantity: String(item.quantity || '1 Stück').trim().slice(0, 50), favorite: item.favorite ? 1 : 0, usageCount: Math.max(0, Number(item.usageCount) || 0) }),
    deserialize: (row) => ({ ...row, favorite: Boolean(row.favorite) }),
  },
};

const addRoutineDate = (dateValue, task) => {
  const date = new Date(`${dateValue || new Date().toISOString().slice(0, 10)}T12:00:00`);
  const interval = Math.max(1, Number(task.recurrenceInterval) || 1);
  if (task.recurrence === 'daily') date.setDate(date.getDate() + interval);
  else if (task.recurrence === 'weekly') date.setDate(date.getDate() + 7 * interval);
  else if (task.recurrence === 'monthly') {
    const targetDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + interval);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(targetDay, lastDay));
  }
  else if (task.recurrence === 'weekdays') {
    let days = [];
    try { days = JSON.parse(task.recurrenceDays || '[]').map(Number); } catch {}
    if (!days.length) days = [1, 2, 3, 4, 5];
    do { date.setDate(date.getDate() + 1); } while (!days.includes(date.getDay() || 7));
  }
  return date.toISOString().slice(0, 10);
};

const nextRoutinePerson = (task) => {
  let rotation = [];
  try { rotation = JSON.parse(task.rotation || '[]'); } catch {}
  if (rotation.length < 2) return task.person;
  const index = rotation.findIndex(name => name.toLocaleLowerCase('de-DE') === String(task.person || '').toLocaleLowerCase('de-DE'));
  return rotation[(index + 1 + rotation.length) % rotation.length] || task.person;
};

const resetChecklist = (value) => {
  try { return JSON.stringify(JSON.parse(value || '[]').map(entry => ({ ...entry, done: false }))); }
  catch { return '[]'; }
};

const startOfWeek = (date) => {
  const value = new Date(`${date}T12:00:00`);
  const weekday = value.getDay() || 7;
  value.setDate(value.getDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
};

const progressPayload = (currentMemberId) => {
  const members = db.prepare(`
    SELECT m.id, m.name, m.color, COALESCE(SUM(c.points), 0) AS points,
      COUNT(c.task_id) AS completedTasks
    FROM members m
    LEFT JOIN task_completions c ON c.member_id = m.id
    GROUP BY m.id
    ORDER BY points DESC, completedTasks DESC, m.name ASC
  `).all();
  const completionDates = db.prepare('SELECT member_id AS memberId, completed_on AS completedOn FROM task_completions ORDER BY completed_on DESC').all();
  const currentWeek = startOfWeek(new Date().toISOString().slice(0, 10));
  const withStreaks = members.map(member => {
    const weeks = new Set(completionDates.filter(item => item.memberId === member.id).map(item => startOfWeek(item.completedOn)));
    let streak = 0;
    const cursor = new Date(`${currentWeek}T12:00:00`);
    if (!weeks.has(currentWeek)) cursor.setDate(cursor.getDate() - 7);
    while (weeks.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
    const awards = [
      member.completedTasks >= 1 && { id: 'first', title: 'Erster Schritt', icon: 'sparkles' },
      member.completedTasks >= 10 && { id: 'ten', title: 'Alltagsheld', icon: 'award' },
      member.points >= 250 && { id: 'points', title: 'Punkteprofi', icon: 'trophy' },
      streak >= 4 && { id: 'streak', title: 'Serienstar', icon: 'flame' },
    ].filter(Boolean);
    return { ...member, points: Number(member.points), completedTasks: Number(member.completedTasks), streak, awards };
  });
  return {
    members: withStreaks,
    householdPoints: withStreaks.reduce((sum, member) => sum + member.points, 0),
    currentMember: withStreaks.find(member => member.id === currentMemberId) || null,
  };
};

const collectionPayload = (name, config) => db.prepare(config.select).all().map((row) => config.deserialize ? config.deserialize(row) : ({ ...row, ...(name === 'members' && { isAdmin: Boolean(row.isAdmin) }), ...(name === 'tasks' && { done: Boolean(row.done) }), ...(name === 'shopping' && { checked: Boolean(row.checked) }) }));

for (const [name, config] of Object.entries(collections)) {
  app.get(`/api/${name}`, requireAuth, (_req, res) => {
    res.json(collectionPayload(name, config));
  });

  app.put(`/api/${name}`, requireAuth, (req, res) => {
    if (name === 'members' && !req.member.isAdmin) return res.status(403).json({ error: 'Nur Administratoren dürfen Mitglieder verwalten.' });
    if (!Array.isArray(req.body?.items)) return res.status(400).json({ error: 'Ungültige Daten.' });
    const previousItems = collectionPayload(name, config);
    const items = req.body.items.map(config.normalize);
    if (items.some((item) => !item.id || (!(item.name || item.text || item.title)))) return res.status(400).json({ error: 'Name oder Text fehlt.' });
    const replace = db.transaction(() => {
      const pinHashes = name === 'members' ? new Map(db.prepare('SELECT id, pin_hash AS pinHash FROM members').all().map(member => [member.id, member.pinHash])) : null;
      const previousTasks = name === 'tasks' ? new Map(db.prepare('SELECT id, done FROM tasks').all().map(task => [task.id, Boolean(task.done)])) : null;
      db.prepare(`DELETE FROM ${config.table || name}`).run();
      for (const item of items) config.insert.run(name === 'members' ? { ...item, pinHash: pinHashes.get(item.id) || '' } : item);
      if (name === 'tasks') {
        const validIds = new Set(items.map(item => item.id));
        for (const completion of db.prepare('SELECT task_id AS taskId FROM task_completions').all()) {
          if (!validIds.has(completion.taskId)) db.prepare('DELETE FROM task_completions WHERE task_id = ?').run(completion.taskId);
        }
        for (const item of items) {
          if (!item.done) {
            db.prepare('DELETE FROM task_completions WHERE task_id = ?').run(item.id);
            db.prepare('DELETE FROM tasks WHERE parent_task_id = ? AND done = 0').run(item.id);
          } else if (previousTasks.get(item.id) === false) {
            const assignee = db.prepare('SELECT id FROM members WHERE lower(name) = lower(?)').get(item.person);
            db.prepare("INSERT OR IGNORE INTO task_completions (task_id, member_id, person_name, points, completed_on) VALUES (?, ?, ?, ?, date('now', 'localtime'))").run(item.id, assignee?.id || req.member.id, item.person || req.member.name, item.points ?? 10);
          }
        }
        let nextId = Math.max(Date.now(), ...items.map(item => Number(item.id) || 0));
        for (const item of items) {
          if (!item.done || item.recurrence === 'none' || previousTasks.get(item.id) !== false) continue;
          const existingChild = db.prepare('SELECT id FROM tasks WHERE parent_task_id = ?').get(item.id);
          if (existingChild) continue;
          nextId += 1;
          config.insert.run({
            ...item,
            id: nextId,
            done: 0,
            person: nextRoutinePerson(item),
            dueDate: addRoutineDate(item.dueDate, item),
            checklist: resetChecklist(item.checklist),
            parentTaskId: item.id,
            seriesId: item.seriesId || `series-${item.id}`,
          });
        }
      }
    });
    replace();
    if (['tasks', 'shopping', 'mealplans', 'calendar'].includes(name)) queueCollectionPush(name, previousItems, collectionPayload(name, config), req.member);
    broadcastSync(name);
    res.json({ ok: true, ...(name === 'tasks' && { progress: progressPayload(req.member.id) }) });
  });
}

const calendarFeedResponse = (res, disposition = 'inline') => {
  const body = buildICalendar(collectionPayload('calendar', collections.calendar));
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `${disposition}; filename="houseos-familienkalender.ics"`);
  res.setHeader('Cache-Control', 'no-cache, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(body);
};
const calendarFeedUrl = req => {
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = /^(?:http|https)$/.test(forwardedProtocol) ? forwardedProtocol : req.protocol;
  return `${protocol}://${req.get('host')}/api/calendar/ical/feed/${encodeURIComponent(calendarIcalToken())}/calendar.ics`;
};
const validCalendarFeedToken = value => {
  const expected = Buffer.from(calendarIcalToken()); const actual = Buffer.from(String(value || ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

app.get('/api/calendar/ical/settings', requireAuth, (req, res) => {
  const counts = db.prepare("SELECT COUNT(*) AS eventCount, SUM(CASE WHEN ical_uid <> '' THEN 1 ELSE 0 END) AS importedCount FROM calendar_events").get();
  res.json({
    feedUrl: calendarFeedUrl(req),
    eventCount: Number(counts.eventCount) || 0,
    importedCount: Number(counts.importedCount) || 0,
    canRotate: req.member.isAdmin,
  });
});

app.get('/api/calendar/ical/download', requireAuth, (_req, res) => calendarFeedResponse(res, 'attachment'));
app.get('/api/calendar/ical/feed/:token/calendar.ics', (req, res) => validCalendarFeedToken(req.params.token) ? calendarFeedResponse(res) : res.status(404).send('Kalender nicht gefunden.'));

app.post('/api/calendar/ical/token', requireAdmin, (req, res) => {
  const token = randomBytes(32).toString('base64url');
  db.prepare('UPDATE device_settings SET calendar_ical_token = ? WHERE id = 1').run(token);
  res.json({ feedUrl: calendarFeedUrl(req) });
});

app.post('/api/calendar/ical/import', requireAuth, (req, res) => {
  const content = String(req.body?.content || '');
  const sourceName = String(req.body?.sourceName || 'iCal-Import').trim().slice(0, 120);
  if (!content || Buffer.byteLength(content) > 2 * 1024 * 1024) return res.status(400).json({ error: 'Bitte wähle eine iCal-Datei mit höchstens 2 MB.' });
  try {
    const parsed = parseICalendar(content, { sourceName });
    const events = [...new Map(parsed.map(event => [event.icalUid, event])).values()];
    const config = collections.calendar;
    const previousItems = collectionPayload('calendar', config);
    const previousById = new Map(previousItems.map(event => [Number(event.id), event]));
    let nextId = Math.max(Date.now(), Number(db.prepare('SELECT MAX(id) AS id FROM calendar_events').get()?.id || 0) + 1);
    const result = db.transaction(() => {
      let imported = 0; let updated = 0; let removed = 0; let unchanged = 0;
      for (const event of events) {
        let existing = db.prepare('SELECT id FROM calendar_events WHERE ical_uid = ?').get(event.icalUid);
        const internalId = Number(String(event.icalUid).match(/^houseos-(\d+)@houseos\.local$/)?.[1] || 0);
        if (!existing && internalId) existing = db.prepare('SELECT id FROM calendar_events WHERE id = ?').get(internalId);
        if (event.cancelled) {
          if (existing) {
            db.prepare('DELETE FROM calendar_reminders WHERE event_id = ?').run(existing.id);
            db.prepare('DELETE FROM calendar_events WHERE id = ?').run(existing.id);
            removed += 1;
          }
          continue;
        }
        const id = existing?.id || nextId++;
        const normalized = config.normalize({ ...event, id });
        if (existing) {
          const previous = previousById.get(Number(id));
          if (previous && JSON.stringify(config.normalize(previous)) === JSON.stringify(normalized)) { unchanged += 1; continue; }
          db.prepare('DELETE FROM calendar_reminders WHERE event_id = ?').run(id);
          db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
          updated += 1;
        } else imported += 1;
        config.insert.run(normalized);
      }
      return { imported, updated, removed, unchanged };
    })();
    const items = collectionPayload('calendar', config);
    const importedCount = Number(db.prepare("SELECT COUNT(*) AS count FROM calendar_events WHERE ical_uid <> ''").get()?.count) || 0;
    broadcastSync('calendar');
    const changes = [result.imported && `${result.imported} neu`, result.updated && `${result.updated} aktualisiert`, result.removed && `${result.removed} entfernt`].filter(Boolean).join(', ');
    if (changes) void sendPush({ title: 'iCal-Kalender importiert', body: `${req.member.name}: ${changes}.`, tag: 'calendar-import', url: '/?app=calendar', icon: '/icons/houseos-192.png' }, { excludeMemberId: req.member.id });
    const firstDate = events.filter(event => !event.cancelled).map(event => event.startDate).sort()[0] || '';
    res.json({ ok: true, ...result, total: events.length, importedCount, items, firstDate });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Der iCal-Kalender konnte nicht importiert werden.' });
  }
});

app.get('/api/progress', requireAuth, (req, res) => res.json(progressPayload(req.member.id)));

app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'sqlite', version: packageInfo.version }));

app.get('/api/bluetooth', requireAuth, async (_req, res) => res.json(await getBluetoothState()));

app.post('/api/bluetooth/power', requireAdmin, async (req, res) => {
  try { res.json(await setBluetoothPower(req.body?.powered === true)); }
  catch (error) { res.status(error?.code === 'UNSUPPORTED' ? 501 : 502).json({ error: error instanceof Error ? error.message : 'Bluetooth konnte nicht geschaltet werden.' }); }
});

app.post('/api/bluetooth/scan', requireAdmin, async (_req, res) => {
  try { res.json(await scanBluetoothDevices()); }
  catch (error) { res.status(error?.code === 'UNSUPPORTED' ? 501 : 502).json({ error: error instanceof Error ? error.message : 'Bluetooth-Suche fehlgeschlagen.' }); }
});

app.post('/api/bluetooth/devices/:address/:action', requireAdmin, async (req, res) => {
  try { res.json(await controlBluetoothDevice(req.params.address, req.params.action)); }
  catch (error) { res.status(['INVALID_ADDRESS','INVALID_ACTION'].includes(error?.code) ? 400 : error?.code === 'UNSUPPORTED' ? 501 : 502).json({ error: error instanceof Error ? error.message : 'Bluetooth-Gerät konnte nicht verwaltet werden.' }); }
});

app.get('/api/printers', requireAuth, async (_req, res) => res.json(await listPrinters()));

app.get('/api/print/settings', requireAuth, (_req, res) => {
  const row = db.prepare('SELECT printer_name AS printerName, paper_width AS paperWidth, auto_cut AS autoCut FROM print_settings WHERE id = 1').get();
  res.json({ ...row, autoCut: Boolean(row.autoCut) });
});

app.put('/api/print/settings', requireAuth, (req, res) => {
  const paperWidth = Number(req.body?.paperWidth);
  const printerName = String(req.body?.printerName || '').trim();
  const autoCut = req.body?.autoCut !== false ? 1 : 0;
  if (![58, 80].includes(paperWidth)) return res.status(400).json({ error: 'Papierbreite muss 58 oder 80 mm sein.' });
  db.prepare('UPDATE print_settings SET printer_name = ?, paper_width = ?, auto_cut = ? WHERE id = 1').run(printerName, paperWidth, autoCut);
  res.json({ ok: true, printerName, paperWidth, autoCut: Boolean(autoCut) });
});

app.post('/api/print', requireAuth, async (req, res) => {
  const type = ['daily', 'shopping', 'tasks'].includes(req.body?.type) ? req.body.type : 'daily';
  const settings = db.prepare('SELECT printer_name AS printerName, paper_width AS paperWidth, auto_cut AS autoCut FROM print_settings WHERE id = 1').get();
  const tasks = db.prepare(collections.tasks.select).all().map(item => ({ ...item, done: Boolean(item.done) }));
  const shopping = db.prepare(collections.shopping.select).all().map(item => ({ ...item, checked: Boolean(item.checked) }));
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  const result = await printHouseReceipt({ type, ...settings, autoCut: Boolean(settings.autoCut), tasks, shopping, context, dryRun: req.body?.dryRun === true });
  if (!req.body?.dryRun) db.prepare('INSERT INTO print_jobs (type, printer_name, paper_width, status, message) VALUES (?, ?, ?, ?, ?)').run(type, settings.printerName, settings.paperWidth, result.ok ? 'success' : 'error', result.message);
  res.status(result.ok ? 200 : 502).json(result);
});

app.get('/api/print/jobs', requireAuth, (_req, res) => res.json(db.prepare('SELECT id, type, printer_name AS printerName, paper_width AS paperWidth, status, message, created_at AS createdAt FROM print_jobs ORDER BY id DESC LIMIT 20').all()));

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next());
}

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => console.log(`HouseOS API läuft auf http://${host}:${port}`));

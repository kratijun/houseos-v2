import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
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
  CREATE TABLE IF NOT EXISTS print_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    printer_name TEXT NOT NULL DEFAULT '',
    paper_width INTEGER NOT NULL DEFAULT 58 CHECK (paper_width IN (58, 80)),
    auto_cut INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS device_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weather_city TEXT NOT NULL DEFAULT ''
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
`);

const ensureColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
ensureColumn('members', 'pin_hash', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tasks', 'due_date', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tasks', 'recurrence', "TEXT NOT NULL DEFAULT 'none'");
ensureColumn('shopping', 'quantity', "TEXT NOT NULL DEFAULT '1 Stück'");

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

const app = express();
app.use(express.json({ limit: '256kb' }));

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
  next();
};
const requireAdmin = (req, res, next) => requireAuth(req, res, () => req.member.isAdmin ? next() : res.status(403).json({ error: 'Administratorrechte erforderlich.' }));

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
    select: 'SELECT id, text, done, person, time, due_date AS dueDate, recurrence FROM tasks ORDER BY done ASC, due_date ASC, time ASC, created_at ASC',
    insert: db.prepare('INSERT INTO tasks (id, text, done, person, time, due_date, recurrence) VALUES (@id, @text, @done, @person, @time, @dueDate, @recurrence)'),
    normalize: (item) => ({ id: Number(item.id), text: String(item.text || '').trim(), done: item.done ? 1 : 0, person: String(item.person || ''), time: String(item.time || ''), dueDate: String(item.dueDate || ''), recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(item.recurrence) ? item.recurrence : 'none' }),
  },
  shopping: {
    select: 'SELECT id, text, checked, category, quantity FROM shopping ORDER BY created_at ASC',
    insert: db.prepare('INSERT INTO shopping (id, text, checked, category, quantity) VALUES (@id, @text, @checked, @category, @quantity)'),
    normalize: (item) => ({ id: Number(item.id), text: String(item.text || '').trim(), checked: item.checked ? 1 : 0, category: String(item.category || 'Sonstiges'), quantity: String(item.quantity || '1 Stück').trim() }),
  },
  mealplans: {
    table: 'meal_plans',
    select: "SELECT id, date, meal_type AS mealType, name, ingredients FROM meal_plans ORDER BY date ASC, CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END",
    insert: db.prepare('INSERT INTO meal_plans (id, date, meal_type, name, ingredients) VALUES (@id, @date, @mealType, @name, @ingredients)'),
    normalize: (item) => ({
      id: Number(item.id),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : '',
      mealType: ['breakfast', 'lunch', 'dinner'].includes(item.mealType) ? item.mealType : 'lunch',
      name: String(item.name || '').trim(),
      ingredients: JSON.stringify((Array.isArray(item.ingredients) ? item.ingredients : []).map(ingredient => ({ name: String(ingredient?.name || '').trim(), quantity: String(ingredient?.quantity || '1 Stück').trim() })).filter(ingredient => ingredient.name).slice(0, 40)),
    }),
    deserialize: (row) => {
      try { return { ...row, ingredients: JSON.parse(row.ingredients || '[]') }; }
      catch { return { ...row, ingredients: [] }; }
    },
  },
  dishes: {
    select: 'SELECT id, name, ingredients FROM dishes ORDER BY name COLLATE NOCASE ASC',
    insert: db.prepare('INSERT INTO dishes (id, name, ingredients) VALUES (@id, @name, @ingredients)'),
    normalize: (item) => ({
      id: Number(item.id),
      name: String(item.name || '').trim(),
      ingredients: JSON.stringify((Array.isArray(item.ingredients) ? item.ingredients : []).map(ingredient => ({ name: String(ingredient?.name || '').trim(), quantity: String(ingredient?.quantity || '1 Stück').trim() })).filter(ingredient => ingredient.name).slice(0, 40)),
    }),
    deserialize: (row) => {
      try { return { ...row, ingredients: JSON.parse(row.ingredients || '[]') }; }
      catch { return { ...row, ingredients: [] }; }
    },
  },
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
    if (items.some((item) => !item.id || (!(item.name || item.text)))) return res.status(400).json({ error: 'Name oder Text fehlt.' });
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
          } else if (previousTasks.get(item.id) === false) {
            const assignee = db.prepare('SELECT id FROM members WHERE lower(name) = lower(?)').get(item.person);
            db.prepare("INSERT OR IGNORE INTO task_completions (task_id, member_id, person_name, points, completed_on) VALUES (?, ?, ?, 10, date('now', 'localtime'))").run(item.id, assignee?.id || req.member.id, item.person || req.member.name);
          }
        }
      }
    });
    replace();
    if (['tasks', 'shopping', 'mealplans'].includes(name)) queueCollectionPush(name, previousItems, collectionPayload(name, config), req.member);
    res.json({ ok: true, ...(name === 'tasks' && { progress: progressPayload(req.member.id) }) });
  });
}

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

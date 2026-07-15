import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, CloudSun, Command,
  Delete, Home, ListTodo, LockKeyhole, MapPin, Maximize2, Minus, Minimize2,
  Plus, Printer, Repeat2, RotateCcw, Search, Settings, ShieldCheck, ShoppingBasket,
  Sparkles, Sun, Tag, Trash2, UserPlus, Users, X, Download, GitBranch, Server, Cpu,
  HardDrive, RefreshCw, MonitorCog,
  UserRound, Palette, Bell, Accessibility, Camera, Moon, Languages, Volume2,
  Info, KeyRound, Eye, Contrast, Smartphone, SlidersHorizontal,
  Power, PowerOff, Lock, Unlock, AlertTriangle, ExternalLink,
} from 'lucide-react';
import './styles.css';

const APP_DEFS = {
  today: { title: 'Heute', icon: Sun, color: '#ff9f0a', keywords: 'übersicht wetter standort uhrzeit' },
  tasks: { title: 'Aufgaben', icon: ListTodo, color: '#30b67a', keywords: 'todo erledigen termin zeit wiederholung' },
  shopping: { title: 'Einkauf', icon: ShoppingBasket, color: '#ff6259', keywords: 'liste artikel kategorie' },
  printer: { title: 'Print Center', icon: Printer, color: '#667eea', keywords: 'bon drucken vorschau' },
  settings: { title: 'Einstellungen', icon: Settings, color: '#636366', keywords: 'admin benutzer profil pin system update version github' },
};

const DEFAULT_PREFERENCES = {
  appearance: 'auto', accent: '#007aff', wallpaper: 'bloom', avatar: '',
  notifications: true, sounds: true, largeText: false, highContrast: false,
  reduceMotion: false, language: 'Deutsch',
};
const loadPreferences = (memberId) => {
  try { return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(`houseos.preferences.${memberId}`)) }; }
  catch { return { ...DEFAULT_PREFERENCES }; }
};

function ProfileAvatar({ member, preferences, className = '' }) {
  const avatar = preferences?.avatar || loadPreferences(member.id).avatar;
  return <span className={className} style={{ '--avatar': member.color, backgroundImage: avatar ? `url(${avatar})` : undefined }}>{avatar ? null : initials(member.name)}</span>;
}

const prepareAvatar = (file) => new Promise((resolve, reject) => {
  if (!file?.type.startsWith('image/')) return reject(new Error('Bitte wähle eine Bilddatei aus.'));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Das Bildformat wird nicht unterstützt.'));
    image.onload = () => {
      const size = Math.min(image.width, image.height); const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
      const context = canvas.getContext('2d'); context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 320, 320);
      resolve(canvas.toDataURL('image/jpeg', .86));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const defaultMembers = [
  { id: 1, name: 'Oliver', role: 'Haushaltsadmin', color: '#007aff', isAdmin: true },
  { id: 2, name: 'Mia', role: 'Mitglied', color: '#ff2d55', isAdmin: false },
];
const defaultTasks = [
  { id: 1, text: 'Pflanzen gießen', done: false, person: 'Oliver', time: '', dueDate: '', recurrence: 'weekly' },
  { id: 2, text: 'Spülmaschine ausräumen', done: true, person: 'Mia', time: '', dueDate: '', recurrence: 'none' },
  { id: 3, text: 'Papiermüll rausbringen', done: false, person: 'Oliver', time: '18:00', dueDate: '', recurrence: 'weekly' },
];
const defaultShopping = [
  { id: 1, text: 'Hafermilch', checked: false, category: 'Frühstück' },
  { id: 2, text: 'Tomaten', checked: false, category: 'Gemüse' },
  { id: 3, text: 'Kaffeebohnen', checked: true, category: 'Vorrat' },
];

const THOUGHTS = [
  'Zuhause ist dort, wo der Alltag leicht werden darf.',
  'Kleine Dinge, regelmäßig getan, machen den größten Unterschied.',
  'Gemeinsam geht vieles leichter – und manches wird überhaupt erst schön.',
  'Ordnung schafft Raum für die Dinge, die wirklich wichtig sind.',
  'Ein ruhiger Morgen beginnt oft schon am Abend davor.',
  'Heute ist ein guter Tag, um etwas Kleines fertigzumachen.',
  'Ein Zuhause lebt nicht von Perfektion, sondern von Aufmerksamkeit.',
  'Wer teilt, hat weniger Last und mehr Zeit füreinander.',
  'Ein leerer Wäschekorb ist auch eine Form von Glück.',
  'Gute Routinen sind Entscheidungen, die man nur einmal treffen muss.',
  'Mach es dir einfach – dein zukünftiges Ich wird es dir danken.',
  'Auch fünf Minuten Aufräumen verändern einen ganzen Raum.',
  'Ein gedeckter Tisch ist eine Einladung zum Zusammensein.',
  'Erledigt ist manchmal besser als perfekt.',
  'Die schönsten Erinnerungen entstehen oft ganz nebenbei.',
  'Ein gutes Zuhause passt sich den Menschen an, nicht umgekehrt.',
  'Heute zählt, was euch den Alltag ein kleines Stück leichter macht.',
  'Zuhause ist kein Projekt. Es ist ein Gefühl, das wachsen darf.',
];

const weatherText = (code) => {
  if (code === 0) return 'Klar';
  if ([1, 2].includes(code)) return 'Leicht bewölkt';
  if (code === 3) return 'Bewölkt';
  if ([45, 48].includes(code)) return 'Neblig';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Nieselregen';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Regen';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Schnee';
  if ([95, 96, 99].includes(code)) return 'Gewitter';
  return 'Wetter wird aktualisiert';
};
const greeting = (hour) => hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 14 ? 'Guten Mittag' : hour < 18 ? 'Guten Nachmittag' : hour < 23 ? 'Guten Abend' : 'Gute Nacht';
const localDateValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const repeatLabel = { none: '', daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich' };
const taskSchedule = (task) => {
  const parts = [];
  if (task.dueDate) parts.push(new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
  if (task.time && task.time !== 'Heute' && task.time !== 'Erledigt') parts.push(`${task.time} Uhr`);
  if (repeatLabel[task.recurrence]) parts.push(repeatLabel[task.recurrence]);
  return parts.join(' · ') || (task.time || 'Ohne Termin');
};

function useDatabaseCollection(resource, fallback, enabled) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`houseos.${resource}`)) ?? fallback; } catch { return fallback; }
  });
  const valueRef = useRef(value);
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!enabled) { setOnline(false); return; }
    fetch(`/api/${resource}`).then(response => response.ok ? response.json() : Promise.reject()).then(items => {
      valueRef.current = items; setValue(items); setOnline(true);
      localStorage.setItem(`houseos.${resource}`, JSON.stringify(items));
    }).catch(() => setOnline(false));
  }, [resource, enabled]);
  const update = (updater) => {
    const next = typeof updater === 'function' ? updater(valueRef.current) : updater;
    valueRef.current = next; setValue(next);
    localStorage.setItem(`houseos.${resource}`, JSON.stringify(next));
    fetch(`/api/${resource}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: next }) })
      .then(response => setOnline(response.ok)).catch(() => setOnline(false));
  };
  return [value, update, online];
}

function useDeviceContext(enabled) {
  const [context, setContext] = useState({ location: 'Standort wird ermittelt …', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, weather: null, status: 'loading' });
  const refresh = () => {
    if (!enabled) return;
    if (!navigator.geolocation) return setContext(current => ({ ...current, location: 'Standort nicht verfügbar', status: 'error' }));
    setContext(current => ({ ...current, status: 'loading' }));
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const response = await fetch(`/api/device-context?lat=${encodeURIComponent(position.coords.latitude)}&lon=${encodeURIComponent(position.coords.longitude)}`);
        if (!response.ok) throw new Error();
        setContext({ ...(await response.json()), status: 'ready' });
      } catch { setContext(current => ({ ...current, location: 'Aktueller Standort', status: 'error' })); }
    }, () => setContext(current => ({ ...current, location: 'Standort nicht freigegeben', status: 'denied' })), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  };
  useEffect(() => { refresh(); }, [enabled]);
  return [context, refresh];
}

function App() {
  const [booting, setBooting] = useState(true);
  const [users, setUsers] = useState([]);
  const [member, setMember] = useState(null);
  const [authError, setAuthError] = useState('');
  const refreshUsers = async () => {
    try { const response = await fetch('/api/auth/users'); setUsers(response.ok ? await response.json() : []); } catch { setUsers([]); }
  };
  useEffect(() => {
    const start = Date.now();
    Promise.allSettled([fetch('/api/auth/session'), fetch('/api/auth/users')]).then(async ([sessionResult, usersResult]) => {
      if (sessionResult.status === 'fulfilled' && sessionResult.value.ok) setMember((await sessionResult.value.json()).member);
      if (usersResult.status === 'fulfilled' && usersResult.value.ok) setUsers(await usersResult.value.json());
      setTimeout(() => setBooting(false), Math.max(0, 1850 - (Date.now() - start)));
    });
  }, []);
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); setMember(null); await refreshUsers(); };
  if (booting) return <BootScreen />;
  if (!member) return <LoginScreen users={users} onAuthenticated={setMember} onUsersChanged={refreshUsers} error={authError} setError={setAuthError} />;
  return <Desktop currentMember={member} onMemberChange={setMember} onLogout={logout} />;
}

function BootScreen() {
  return <div className="boot"><div className="boot-orbit"><Home size={36} /></div><div className="boot-logo"><span>house<b>os</b></span></div><p>RASPBERRY PI · SYSTEMSTART</p><div className="boot-line"><i /></div><div className="boot-status"><span>Benutzerprofile</span><span>Datenbank</span><span>Oberfläche</span></div></div>;
}

function LoginScreen({ users, onAuthenticated, onUsersChanged, error, setError }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [stage, setStage] = useState('login');
  const [busy, setBusy] = useState(false);
  const choose = (user) => { setSelected(user); setPin(''); setFirstPin(''); setStage(user.hasPin ? 'login' : 'create'); setError(''); };
  const digit = (value) => { if (!busy && pin.length < 6) { setPin(`${pin}${value}`); setError(''); } };
  const login = async (loginPin) => {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: selected.id, pin: loginPin }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Anmeldung fehlgeschlagen.');
    onAuthenticated(result.member);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pin.length < 4) return setError('Bitte mindestens vier Ziffern eingeben.');
    if (stage === 'create') { setFirstPin(pin); setPin(''); setStage('confirm'); setError(''); return; }
    if (stage === 'confirm' && pin !== firstPin) { setPin(''); return setError('Die beiden PINs stimmen nicht überein.'); }
    setBusy(true);
    try {
      if (stage === 'confirm') {
        const setup = await fetch('/api/auth/setup-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: selected.id, pin }) });
        const setupResult = await setup.json();
        if (!setup.ok) throw new Error(setupResult.error || 'PIN konnte nicht gespeichert werden.');
        await onUsersChanged();
      }
      await login(pin);
    } catch (loginError) { setError(loginError.message); setPin(''); }
    finally { setBusy(false); }
  };
  return <main className="login-screen">
    <div className="login-glow one" /><div className="login-glow two" />
    <section className={`login-panel ${selected ? 'pin-mode' : 'user-mode'}`}>
      <div className="login-brand"><span><Home size={19} /></span><strong>houseos</strong></div>
      {!selected ? <>
        <div className="login-copy"><small>WILLKOMMEN ZU HAUSE</small><h1>Wer bist du?</h1><p>Wähle dein persönliches HouseOS-Profil.</p></div>
        <div className="login-users">{users.map(user => <button key={user.id} onClick={() => choose(user)}><ProfileAvatar member={user} className="login-avatar profile-image" /><strong>{user.name}</strong><small>{user.role}</small></button>)}</div>
        {!users.length && <p className="login-error">Der HouseOS-Dienst ist nicht erreichbar.</p>}
      </> : <form onSubmit={submit} className="pin-login">
        <button type="button" className="login-back" onClick={() => setSelected(null)}><ChevronLeft size={17} /> Benutzer wechseln</button>
        <ProfileAvatar member={selected} className="login-avatar selected profile-image" />
        <h1>{stage === 'login' ? `Hallo, ${selected.name}` : stage === 'create' ? 'PIN einrichten' : 'PIN wiederholen'}</h1>
        <p>{stage === 'login' ? 'Gib deine PIN ein, um HouseOS zu entsperren.' : stage === 'create' ? 'Lege eine persönliche PIN mit 4 bis 6 Ziffern fest.' : 'Gib dieselbe PIN zur Bestätigung erneut ein.'}</p>
        <div className="pin-dots" aria-label={`${pin.length} Ziffern eingegeben`}>{Array.from({ length: 6 }, (_, index) => <i className={index < pin.length ? 'filled' : ''} key={index} />)}</div>
        <div className="pin-pad">{[1,2,3,4,5,6,7,8,9].map(number => <button type="button" key={number} onClick={() => digit(number)}>{number}</button>)}<span /><button type="button" onClick={() => digit(0)}>0</button><button type="button" aria-label="Letzte Ziffer löschen" onClick={() => setPin(pin.slice(0, -1))}><Delete size={20} /></button></div>
        {error && <p className="login-error">{error}</p>}
        <button className="unlock-button" disabled={busy || pin.length < 4}><LockKeyhole size={17} /> {busy ? 'Wird entsperrt …' : stage === 'create' ? 'Weiter' : 'Entsperren'}</button>
      </form>}
    </section>
    <div className="login-time"><Clock3 size={14} /> {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
  </main>;
}

function Desktop({ currentMember, onMemberChange, onLogout }) {
  const [time, setTime] = useState(new Date());
  const [activeApps, setActiveApps] = useState(['today']);
  const [minimizedApps, setMinimizedApps] = useState([]);
  const [focused, setFocused] = useState('today');
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [printType, setPrintType] = useState('daily');
  const [preferences, setPreferences] = useState(() => loadPreferences(currentMember.id));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [locked, setLocked] = useState(false);
  const [tasks, setTasks, tasksOnline] = useDatabaseCollection('tasks', defaultTasks, true);
  const [shopping, setShopping, shoppingOnline] = useDatabaseCollection('shopping', defaultShopping, true);
  const [members, setMembers, membersOnline] = useDatabaseCollection('members', defaultMembers, true);
  const [device, refreshDevice] = useDeviceContext(true);
  const databaseOnline = tasksOnline && shoppingOnline && membersOnline;
  useEffect(() => { const tick = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => { localStorage.setItem(`houseos.preferences.${currentMember.id}`, JSON.stringify(preferences)); }, [currentMember.id, preferences]);
  useEffect(() => { const query = window.matchMedia?.('(prefers-color-scheme: dark)'); if (!query) return; const update = event => setSystemDark(event.matches); query.addEventListener?.('change', update); return () => query.removeEventListener?.('change', update); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let timer;
    const armLock = () => { clearTimeout(timer); if (!locked) timer = setTimeout(() => setLocked(true), 90_000); };
    const events = ['pointerdown', 'keydown', 'touchstart']; events.forEach(name => window.addEventListener(name, armLock, { passive: true })); armLock();
    return () => { clearTimeout(timer); events.forEach(name => window.removeEventListener(name, armLock)); };
  }, [locked]);
  const openApp = (id) => { setActiveApps(apps => [...apps.filter(app => app !== id), id]); setMinimizedApps(apps => apps.filter(app => app !== id)); setFocused(id); setLauncherOpen(false); };
  const openPrint = (type) => { setPrintType(type); openApp('printer'); };
  const focusApp = (id) => { setActiveApps(apps => [...apps.filter(app => app !== id), id]); setFocused(id); };
  const closeApp = (id) => { setActiveApps(apps => { const remaining = apps.filter(app => app !== id); setFocused(current => current === id ? (remaining.filter(app => !minimizedApps.includes(app)).at(-1) ?? null) : current); return remaining; }); setMinimizedApps(apps => apps.filter(app => app !== id)); };
  const minimizeApp = (id) => { setMinimizedApps(apps => apps.includes(id) ? apps : [...apps, id]); setFocused(current => current === id ? (activeApps.filter(app => app !== id && !minimizedApps.includes(app)).at(-1) ?? null) : current); };
  const temp = device.weather?.temperature;
  const resolvedAppearance = preferences.appearance === 'auto' ? (systemDark ? 'dark' : 'light') : preferences.appearance;
  return <main className={`desktop theme-${resolvedAppearance} wallpaper-${preferences.wallpaper} ${preferences.largeText ? 'large-text' : ''} ${preferences.highContrast ? 'high-contrast' : ''} ${preferences.reduceMotion ? 'reduce-motion' : ''}`} style={{ '--blue': preferences.accent }} onClick={() => launcherOpen && setLauncherOpen(false)}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <button className="brand" onClick={event => { event.stopPropagation(); setLauncherOpen(!launcherOpen); }}><span className="brand-mark"><Home size={16} /></span><span>house<span>os</span></span></button>
      <button className="topbar-center location-button" onClick={refreshDevice} title="Standort und Wetter aktualisieren"><CloudSun size={16} /><span>{device.location}</span>{Number.isFinite(temp) && <strong>{Math.round(temp)}°</strong>}</button>
      <div className="topbar-actions"><span className={`system-ok ${databaseOnline ? '' : 'offline'}`}><i /> {databaseOnline ? 'Synchronisiert' : 'Nur lokal'}</span><span>{time.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}</span><strong>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong><button className="logout" onClick={() => setLocked(true)} title="HouseOS sperren" aria-label="HouseOS sperren"><Lock size={15} /></button></div>
    </header>
    <section className="welcome-copy"><p>{greeting(time.getHours())}, {currentMember.name}</p><h1>Dein Zuhause ist<br /><em>bereit für den Tag.</em></h1></section>
    <aside className="desktop-icons">{Object.entries(APP_DEFS).map(([id, app]) => <DesktopIcon key={id} app={app} onClick={() => openApp(id)} />)}</aside>
    {launcherOpen && <Launcher onOpen={openApp} onClose={() => setLauncherOpen(false)} currentMember={currentMember} />}
    <section className="window-layer">{Object.keys(APP_DEFS).filter(id => activeApps.includes(id)).map(id => <Window key={id} id={id} app={APP_DEFS[id]} onClose={() => closeApp(id)} onMinimize={() => minimizeApp(id)} onFocus={() => focusApp(id)} focused={focused === id} minimized={minimizedApps.includes(id)} z={20 + activeApps.indexOf(id)}>
      {id === 'today' && <Today tasks={tasks} shopping={shopping} onOpen={openApp} onPrint={() => openPrint('daily')} time={time} device={device} member={currentMember} />}
      {id === 'tasks' && <Tasks items={tasks} setItems={setTasks} members={members} currentMember={currentMember} />}
      {id === 'shopping' && <Shopping items={shopping} setItems={setShopping} onPrint={() => openPrint('shopping')} />}
      {id === 'printer' && <PrintCenter tasks={tasks} shopping={shopping} notify={setToast} initialType={printType} device={device} />}
      {id === 'settings' && <SettingsApp member={currentMember} onMemberChange={onMemberChange} preferences={preferences} setPreferences={setPreferences} items={members} setItems={setMembers} tasks={tasks} setTasks={setTasks} notify={setToast} />}
    </Window>)}</section>
    <nav className="dock"><button className="dock-home" onClick={event => { event.stopPropagation(); setLauncherOpen(!launcherOpen); }}><Command size={20} /></button><span className="dock-separator" />{Object.entries(APP_DEFS).map(([id, app]) => { const Icon = app.icon; return <button key={id} className={`dock-app ${focused === id ? 'focused' : ''}`} onClick={() => openApp(id)} style={{ '--app': app.color }} title={app.title}><Icon size={21} />{activeApps.includes(id) && <i />}</button>; })}</nav>
    {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={18} />{toast}</div>}
    {locked && <LockScreen member={currentMember} preferences={preferences} time={time} onUnlock={onLogout} />}
  </main>;
}

function LockScreen({ member, preferences, time, onUnlock }) {
  return <section className="lock-screen" onDoubleClick={onUnlock}>
    <div className="lock-orb lock-orb-one" /><div className="lock-orb lock-orb-two" />
    <header><Lock size={15} /><span>HouseOS ist gesperrt</span></header>
    <div className="lock-clock"><span>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span><strong>{time.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</strong></div>
    <div className="lock-owner"><ProfileAvatar member={member} preferences={preferences} className="lock-avatar profile-image" /><span><small>ANGEMELDET ALS</small><strong>{member.name}</strong></span></div>
    <button onClick={onUnlock}><Unlock size={16} /> Mit PIN entsperren</button><p>Doppelklicken oder Schaltfläche wählen, um fortzufahren</p>
  </section>;
}

function DesktopIcon({ app, onClick }) { const Icon = app.icon; return <button className="desktop-icon" onClick={onClick}><span style={{ '--app': app.color }}><Icon size={25} /></span><small>{app.title}</small></button>; }

function Launcher({ onOpen, onClose, currentMember }) {
  const [query, setQuery] = useState('');
  const matches = Object.entries(APP_DEFS).filter(([, app]) => `${app.title} ${app.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="launcher" onClick={event => event.stopPropagation()}>
    <div className="launcher-head"><div><small>HOUSEOS</small><h2>Was möchtest du tun?</h2></div><button onClick={onClose}><X size={18} /></button></div>
    <label className="search"><Search size={17} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && matches.length) onOpen(matches[0][0]); }} placeholder="Apps und Aktionen suchen …" /></label>
    <div className="launcher-grid">{matches.map(([id, app]) => { const Icon = app.icon; return <button key={id} onClick={() => onOpen(id)}><span style={{ '--app': app.color }}><Icon size={22} /></span><p>{app.title}</p><ChevronRight size={16} /></button>; })}</div>
    {!matches.length && <div className="launcher-empty"><Search size={20} /><strong>Keine Treffer</strong><small>Versuche einen anderen Suchbegriff.</small></div>}
    <div className="launcher-footer"><ProfileAvatar className="avatar profile-image" member={currentMember} /><span><strong>{currentMember.name}</strong><small>{currentMember.role}</small></span><span className="online">Angemeldet</span></div>
  </div>;
}

function Window({ id, app, children, onClose, onMinimize, onFocus, focused, minimized, z }) {
  const [pos, setPos] = useState(() => { const offset = Object.keys(APP_DEFS).indexOf(id); return { x: offset * 24, y: offset * 18 }; });
  const [mode, setMode] = useState('normal'); const [snapTarget, setSnapTarget] = useState(null); const snapTargetRef = useRef(null); const dragging = useRef(null); const Icon = app.icon;
  const detectSnapTarget = event => event.clientX <= 46 ? 'left' : event.clientX >= window.innerWidth - 46 ? 'right' : event.clientY <= 58 ? 'maximized' : null;
  const startDrag = event => { if (window.innerWidth < 780 || event.target.closest('.window-controls')) return; let dragPos = pos; if (mode !== 'normal') { const rect = event.currentTarget.closest('.window').getBoundingClientRect(); const normalWidth = Math.min(1020, window.innerWidth - 180); const normalHeight = Math.min(700, window.innerHeight - 130); const layerCenterY = 38 + (window.innerHeight - 38 - 74) / 2; const grabX = Math.max(80, Math.min(200, event.clientX - rect.left)); dragPos = { x: event.clientX - grabX + normalWidth / 2 - window.innerWidth / 2, y: Math.max(46, event.clientY - 25) + normalHeight / 2 - layerCenterY }; setMode('normal'); setPos(dragPos); } dragging.current = { x: event.clientX - dragPos.x, y: event.clientY - dragPos.y }; event.currentTarget.setPointerCapture(event.pointerId); };
  const moveDrag = event => { if (!dragging.current) return; setPos({ x: event.clientX - dragging.current.x, y: event.clientY - dragging.current.y }); const target = detectSnapTarget(event); snapTargetRef.current = target; setSnapTarget(target); };
  const finishDrag = event => { if (!dragging.current) return; const target = detectSnapTarget(event) || snapTargetRef.current; if (target) { setMode(target); setPos({ x: 0, y: 0 }); } setSnapTarget(null); snapTargetRef.current = null; dragging.current = null; };
  const cancelDrag = () => { setSnapTarget(null); snapTargetRef.current = null; dragging.current = null; };
  const toggleMaximize = () => { setMode(value => value === 'maximized' ? 'normal' : 'maximized'); setPos({ x: 0, y: 0 }); };
  const expanded = mode !== 'normal';
  return <>{snapTarget && <div className={`snap-preview snap-${snapTarget}`}><span>{snapTarget === 'left' ? 'Links anordnen' : snapTarget === 'right' ? 'Rechts anordnen' : 'Maximieren'}</span></div>}<article data-app={id} data-window-mode={mode} className={`window mode-${mode} ${focused ? 'focused-window' : 'inactive-window'} ${minimized ? 'minimized' : ''}`} onPointerDown={onFocus} style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: z }}>
    <div className="titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onDoubleClick={toggleMaximize}><div className="window-controls" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}><button className="control-close" onClick={onClose} aria-label="Fenster schließen"><X size={9} /></button><button className="control-minimize" onClick={onMinimize} aria-label="Fenster minimieren"><Minus size={9} /></button><button className="control-zoom" onClick={toggleMaximize} aria-label={expanded ? 'Fenster wiederherstellen' : 'Fenster maximieren'}>{expanded ? <Minimize2 size={8} /> : <Maximize2 size={8} />}</button></div><div className="window-title"><span style={{ '--app': app.color }}><Icon size={16} /></span><strong>{app.title}</strong></div><div className="titlebar-spacer" /></div>
    <div className="window-content">{children}</div></article></>;
}

function Today({ tasks, shopping, onOpen, onPrint, time, device, member }) {
  const openTasks = tasks.filter(task => !task.done); const items = shopping.filter(item => !item.checked);
  const todayLabel = time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase();
  const thought = useMemo(() => THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)], [todayLabel]);
  const weather = device.weather;
  return <div className="app-page today-page"><div className="app-heading"><div><span className="eyebrow">{todayLabel}</span><h2>{greeting(time.getHours())}, {member.name}!</h2><p>Hier ist dein Überblick für heute.</p></div><button className="primary" onClick={onPrint}><Printer size={17} /> Tagesbon</button></div>
    <div className="metric-grid"><div className={`weather-card ${weather ? '' : 'weather-pending'}`}><div><CloudSun size={34} /><span>{device.location}</span></div><strong>{Number.isFinite(weather?.temperature) ? `${Math.round(weather.temperature)}°` : '–°'}</strong><p>{weather ? `${weatherText(weather.code)} · ${Math.round(weather.minimum)}–${Math.round(weather.maximum)} °C · gefühlt ${Math.round(weather.apparentTemperature)} °C` : device.status === 'denied' ? 'Standortfreigabe für Wetter erforderlich' : 'Wetter wird geladen …'}</p></div>
      <div className="metric-card"><span className="icon-soft orange"><Clock3 size={20} /></span><div><small>LOKALE ZEIT</small><strong>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong><p>{device.timezone}</p></div></div>
      <div className="metric-card"><span className="icon-soft green"><MapPin size={20} /></span><div><small>STANDORT</small><strong>{device.location}</strong><p>{device.status === 'ready' ? 'Vom Gerät ermittelt' : 'Zum Aktualisieren oben tippen'}</p></div></div></div>
    <div className="two-columns"><section className="content-card"><header><div><ListTodo size={19} /><strong>Offene Aufgaben</strong></div><button onClick={() => onOpen('tasks')}>Alle anzeigen <ChevronRight size={15} /></button></header><div className="compact-list">{openTasks.slice(0, 3).map(task => <div key={task.id}><Circle size={17} /><span><strong>{task.text}</strong><small>{task.person} · {taskSchedule(task)}</small></span></div>)}{!openTasks.length && <div className="compact-empty">Alles erledigt.</div>}</div></section>
      <section className="content-card"><header><div><ShoppingBasket size={19} /><strong>Einkaufsliste</strong></div><button onClick={() => onOpen('shopping')}>Öffnen <ChevronRight size={15} /></button></header><div className="shopping-summary"><strong>{items.length}</strong><span>Artikel<br />stehen noch aus</span><div>{items.slice(0, 3).map(item => <i key={item.id}>{item.text.slice(0, 1)}</i>)}</div></div></section></div>
    <div className="thought"><Sparkles size={18} /><span><small>GEDANKE DES TAGES</small>„{thought}“</span></div></div>;
}

function Tasks({ items, setItems, members, currentMember }) {
  const [value, setValue] = useState(''); const [person, setPerson] = useState(currentMember.name); const [dueDate, setDueDate] = useState(localDateValue()); const [time, setTime] = useState(''); const [recurrence, setRecurrence] = useState('none');
  const add = event => { event.preventDefault(); if (!value.trim()) return; setItems([...items, { id: Date.now(), text: value.trim(), done: false, person, dueDate, time, recurrence }]); setValue(''); };
  const toggle = id => setItems(items.map(item => item.id === id ? { ...item, done: !item.done } : item));
  return <div className="app-page list-page"><div className="app-heading"><div><span className="eyebrow">HAUSHALT</span><h2>Aufgaben</h2><p>{items.filter(item => !item.done).length} Aufgaben warten auf euch.</p></div><div className="progress-ring">{items.length ? Math.round(items.filter(item => item.done).length / items.length * 100) : 0}%</div></div>
    <form className="add-form task-add-form" onSubmit={add}><div className="task-title-input"><Plus size={18} /><input value={value} onChange={event => setValue(event.target.value)} placeholder="Neue Aufgabe hinzufügen …" /></div><select aria-label="Zuständige Person" value={person} onChange={event => setPerson(event.target.value)}>{members.map(member => <option key={member.id}>{member.name}</option>)}</select><input aria-label="Fälligkeitsdatum" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /><input aria-label="Uhrzeit" type="time" value={time} onChange={event => setTime(event.target.value)} /><select aria-label="Wiederholung" value={recurrence} onChange={event => setRecurrence(event.target.value)}><option value="none">Einmalig</option><option value="daily">Täglich</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option></select><button>Hinzufügen</button></form>
    <div className="full-list">{items.map(item => <div className={item.done ? 'done' : ''} key={item.id}><button className="check" onClick={() => toggle(item.id)}>{item.done && <Check size={14} />}</button><span><strong>{item.text}</strong><small>{item.person} · {taskSchedule(item)}</small></span>{item.recurrence && item.recurrence !== 'none' && <Repeat2 className="row-meta-icon" size={14} />}<button className="delete" onClick={() => setItems(items.filter(candidate => candidate.id !== item.id))}><Trash2 size={16} /></button></div>)}</div></div>;
}

const CATEGORY_SUGGESTIONS = ['Backwaren', 'Drogerie', 'Frühstück', 'Getränke', 'Gemüse', 'Haushalt', 'Kühlregal', 'Obst', 'Tiefkühl', 'Vorrat'];
function Shopping({ items, setItems, onPrint }) {
  const [value, setValue] = useState(''); const [category, setCategory] = useState('Sonstiges');
  const add = event => { event.preventDefault(); if (!value.trim()) return; setItems([...items, { id: Date.now(), text: value.trim(), checked: false, category: category.trim() || 'Sonstiges' }]); setValue(''); };
  return <div className="app-page list-page"><div className="app-heading"><div><span className="eyebrow">GEMEINSAME LISTE</span><h2>Einkauf</h2><p>Mit frei wählbaren Kategorien organisiert.</p></div><button className="primary" onClick={onPrint}><Printer size={17} /> Liste drucken</button></div>
    <form className="add-form shopping-add-form" onSubmit={add}><ShoppingBasket size={18} /><input value={value} onChange={event => setValue(event.target.value)} placeholder="Was fehlt noch?" /><div className="category-input"><Tag size={14} /><input list="shopping-categories" value={category} onChange={event => setCategory(event.target.value)} placeholder="Kategorie" /><datalist id="shopping-categories">{CATEGORY_SUGGESTIONS.map(item => <option key={item} value={item} />)}</datalist></div><button>Hinzufügen</button></form>
    <div className="full-list">{items.map(item => <div className={item.checked ? 'done' : ''} key={item.id}><button className="check" onClick={() => setItems(items.map(candidate => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate))}>{item.checked && <Check size={14} />}</button><span><strong>{item.text}</strong><small>{item.category}</small></span><button className="delete" onClick={() => setItems(items.filter(candidate => candidate.id !== item.id))}><Trash2 size={16} /></button></div>)}</div></div>;
}

function SettingsApp({ member, onMemberChange, preferences, setPreferences, items, setItems, tasks, setTasks, notify }) {
  const [section, setSection] = useState('profile'); const [profileName, setProfileName] = useState(member.name); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const fileInput = useRef(null);
  const groups = [
    { label: 'PERSÖNLICH', items: [['profile','Profil',UserRound,'#8e8e93'],['appearance','Darstellung',Palette,'#007aff'],['notifications','Mitteilungen',Bell,'#ff3b30'],['accessibility','Bedienungshilfen',Accessibility,'#007aff']] },
    { label: 'ALLGEMEIN', items: [['general','Allgemein',SlidersHorizontal,'#8e8e93']] },
    ...(member.isAdmin ? [{ label: 'HOUSEOS ADMIN', items: [['users','Benutzer',Users,'#34c759'],['system','System',Server,'#5856d6'],['updates','Updates',Download,'#007aff']] }] : []),
  ];
  const updatePreference = (key, value) => setPreferences(current => ({ ...current, [key]: value }));
  const uploadAvatar = async event => { try { const avatar = await prepareAvatar(event.target.files?.[0]); updatePreference('avatar', avatar); notify('Profilbild aktualisiert'); } catch (uploadError) { setError(uploadError.message); } event.target.value = ''; };
  const saveProfile = async event => {
    event.preventDefault(); if (profileName.trim().length < 2) return setError('Bitte gib mindestens zwei Zeichen ein.');
    setSaving(true); setError('');
    try { const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profileName.trim(), color: preferences.accent }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); onMemberChange(result.member); notify('Profil gespeichert'); }
    catch (saveError) { setError(saveError.message || 'Profil konnte nicht gespeichert werden.'); } finally { setSaving(false); }
  };
  return <div className="settings-shell">
    <aside className="settings-sidebar">
      <label className="settings-search"><Search size={14} /><span>Einstellungen</span></label>
      <button className={`settings-account ${section === 'profile' ? 'selected' : ''}`} onClick={() => setSection('profile')}><ProfileAvatar member={member} preferences={preferences} className="settings-avatar profile-image" /><span><strong>{member.name}</strong><small>{member.role}</small></span><ChevronRight size={15} /></button>
      {groups.map(group => <div className="settings-group" key={group.label}><small>{group.label}</small>{group.items.filter(([id]) => id !== 'profile').map(([id,label,Icon,color]) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => setSection(id)}><i style={{ '--category': color }}><Icon size={14} /></i><span>{label}</span><ChevronRight size={14} /></button>)}</div>)}
    </aside>
    <main className="settings-detail">
      {section === 'profile' && <section className="preference-panel"><header><span className="settings-kicker">PERSÖNLICH</span><h2>Dein Profil</h2><p>So erscheinst du in HouseOS.</p></header><form className="profile-settings" onSubmit={saveProfile}><div className="profile-photo-wrap"><ProfileAvatar member={{ ...member, name: profileName }} preferences={preferences} className="profile-photo profile-image" /><button type="button" onClick={() => fileInput.current?.click()}><Camera size={15} /> Foto ändern</button><input ref={fileInput} hidden type="file" accept="image/*" onChange={uploadAvatar} /></div><div className="settings-card profile-fields"><label><span>Name</span><input value={profileName} onChange={event => setProfileName(event.target.value)} /></label><div className="settings-row"><span><strong>Rolle</strong><small>Vom Haushaltsadmin verwaltet</small></span><b>{member.role}</b></div></div><div className="profile-actions">{preferences.avatar && <button type="button" className="text-button danger" onClick={() => updatePreference('avatar', '')}>Foto entfernen</button>}<button className="settings-save" disabled={saving}>{saving ? 'Wird gespeichert …' : 'Änderungen sichern'}</button></div>{error && <p className="settings-error">{error}</p>}</form></section>}
      {section === 'appearance' && <AppearanceSettings preferences={preferences} updatePreference={updatePreference} />}
      {section === 'notifications' && <section className="preference-panel"><PreferenceHeader kicker="PERSÖNLICH" title="Mitteilungen" description="Lege fest, wie HouseOS dich informiert." /><div className="settings-card"><SettingSwitch icon={Bell} color="#ff3b30" title="Mitteilungen erlauben" subtitle="Hinweise zu Aufgaben und gemeinsamen Listen" checked={preferences.notifications} onChange={value => updatePreference('notifications', value)} /><SettingSwitch icon={Volume2} color="#ff9500" title="Töne" subtitle="Bei wichtigen Hinweisen einen Ton abspielen" checked={preferences.sounds} onChange={value => updatePreference('sounds', value)} /></div></section>}
      {section === 'accessibility' && <section className="preference-panel"><PreferenceHeader kicker="PERSÖNLICH" title="Bedienungshilfen" description="Passe Lesbarkeit und Bewegungen an deine Bedürfnisse an." /><div className="settings-card"><SettingSwitch icon={Eye} color="#007aff" title="Größerer Text" subtitle="Schrift in HouseOS etwas vergrößern" checked={preferences.largeText} onChange={value => updatePreference('largeText', value)} /><SettingSwitch icon={Contrast} color="#5856d6" title="Mehr Kontrast" subtitle="Trennlinien und Flächen deutlicher anzeigen" checked={preferences.highContrast} onChange={value => updatePreference('highContrast', value)} /><SettingSwitch icon={Accessibility} color="#34c759" title="Bewegung reduzieren" subtitle="Animationen und Übergänge minimieren" checked={preferences.reduceMotion} onChange={value => updatePreference('reduceMotion', value)} /></div></section>}
      {section === 'general' && <section className="preference-panel"><PreferenceHeader kicker="HOUSEOS" title="Allgemein" description="Grundlegende Einstellungen für dieses Gerät." /><div className="settings-card"><div className="settings-row icon-row"><i style={{ '--category': '#007aff' }}><Languages size={15} /></i><span><strong>Sprache</strong><small>Sprache der Oberfläche</small></span><select value={preferences.language} onChange={event => updatePreference('language', event.target.value)}><option>Deutsch</option><option>English</option></select></div><div className="settings-row icon-row"><i style={{ '--category': '#8e8e93' }}><Info size={15} /></i><span><strong>HouseOS</strong><small>Persönliches Zuhause-Dashboard</small></span><b>Version 0.2.0</b></div><div className="settings-row icon-row"><i style={{ '--category': '#5856d6' }}><KeyRound size={15} /></i><span><strong>PIN & Sicherheit</strong><small>Dein Profil wird beim Verlassen gesperrt</small></span><b>Aktiv</b></div></div></section>}
      {section === 'users' && member.isAdmin && <section className="admin-settings-panel"><Members embedded items={items} setItems={setItems} tasks={tasks} setTasks={setTasks} notify={notify} /></section>}
      {['system','updates'].includes(section) && member.isAdmin && <section className="admin-settings-panel"><SystemPanel section={section} notify={notify} /></section>}
    </main>
  </div>;
}

function PreferenceHeader({ kicker, title, description }) { return <header><span className="settings-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></header>; }

function SettingSwitch({ icon: Icon, color, title, subtitle, checked, onChange }) { return <label className="settings-row icon-row switch-row"><i style={{ '--category': color }}><Icon size={15} /></i><span><strong>{title}</strong><small>{subtitle}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><em /></label>; }

function AppearanceSettings({ preferences, updatePreference }) {
  const accents = ['#007aff','#5856d6','#af52de','#ff2d55','#ff3b30','#ff9500','#ffcc00','#34c759'];
  return <section className="preference-panel"><PreferenceHeader kicker="PERSÖNLICH" title="Darstellung" description="Wähle den Look, der zu dir und deinem Zuhause passt." /><h3 className="settings-section-title">Erscheinungsbild</h3><div className="appearance-options">{[['auto','Automatisch'],['light','Hell'],['dark','Dunkel']].map(([id,label]) => <button key={id} className={preferences.appearance === id ? 'selected' : ''} onClick={() => updatePreference('appearance', id)}><span className={`appearance-preview ${id}`}><i /><i /><i /></span><strong>{label}</strong>{preferences.appearance === id && <CheckCircle2 size={16} />}</button>)}</div><h3 className="settings-section-title">Akzentfarbe</h3><div className="settings-card color-settings"><div className="settings-row"><span><strong>Farbe</strong><small>Für Schaltflächen und Auswahlmarkierungen</small></span><div className="accent-picker">{accents.map(color => <button aria-label={`Akzentfarbe ${color}`} key={color} className={preferences.accent === color ? 'selected' : ''} style={{ '--accent': color }} onClick={() => updatePreference('accent', color)}>{preferences.accent === color && <Check size={13} />}</button>)}</div></div></div><h3 className="settings-section-title">Hintergrund</h3><div className="wallpaper-picker">{[['bloom','Bloom'],['ocean','Ozean'],['sunset','Abendrot'],['graphite','Graphit']].map(([id,label]) => <button key={id} className={preferences.wallpaper === id ? 'selected' : ''} onClick={() => updatePreference('wallpaper', id)}><i className={`wallpaper-swatch ${id}`} /> <span>{label}</span>{preferences.wallpaper === id && <CheckCircle2 size={15} />}</button>)}</div></section>;
}

function SystemPanel({ section, notify }) {
  const [info, setInfo] = useState(null); const [update, setUpdate] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const loadInfo = async () => { try { const response = await fetch('/api/system/info'); const result = await response.json(); if (!response.ok) throw new Error(result.error); setInfo(result); } catch (loadError) { setError(loadError.message || 'Systeminformationen konnten nicht geladen werden.'); } };
  const checkUpdate = async (force = false) => { setBusy(true); setError(''); try { const response = await fetch(`/api/updates/check${force ? '?force=1' : ''}`); const result = await response.json(); if (!response.ok) throw new Error(result.error); setUpdate(result); } catch (checkError) { setError(checkError.message || 'Updateprüfung fehlgeschlagen.'); } finally { setBusy(false); } };
  useEffect(() => { loadInfo(); checkUpdate(false); }, []);
  const install = async () => { setBusy(true); setError(''); try { const response = await fetch('/api/updates/install', { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); notify(result.message); setUpdate(current => ({ ...current, message: result.message, installing: true })); } catch (installError) { setError(installError.message || 'Update konnte nicht gestartet werden.'); } finally { setBusy(false); } };
  const uptime = info ? `${Math.floor(info.uptimeSeconds / 86400)} T · ${Math.floor(info.uptimeSeconds % 86400 / 3600)} Std` : '–';
  if (section === 'system') return <section className="system-section"><div className="section-heading"><div><h3>Raspberry Pi</h3><p>Technischer Zustand der HouseOS-Zentrale.</p></div><button onClick={loadInfo}><RefreshCw size={14} /> Aktualisieren</button></div>
    <div className="system-grid"><article><span><MonitorCog size={20} /></span><small>HOUSEOS</small><strong>Version {info?.version || '–'}</strong><p>{info?.hostname || 'Wird geladen …'}</p></article><article><span><Cpu size={20} /></span><small>PLATTFORM</small><strong>{info ? `${info.platform} · ${info.architecture}` : '–'}</strong><p>Node.js {info?.nodeVersion || '–'}</p></article><article><span><HardDrive size={20} /></span><small>LAUFZEIT</small><strong>{uptime}</strong><p>Systemdienst automatisch aktiv</p></article><article><span><GitBranch size={20} /></span><small>UPDATEQUELLE</small><strong>{info?.repository || 'Nicht konfiguriert'}</strong><p>{info?.installerReady ? 'Pi-Updater ist bereit' : 'Installation noch nicht eingerichtet'}</p></article></div>
    <DeviceControls supported={info?.deviceActionsSupported} notify={notify} />
    {info?.updateStatus && <div className={`update-state ${info.updateStatus.status}`}><strong>Letzter Updatestatus</strong><span>{info.updateStatus.message}</span></div>}{error && <p className="settings-error">{error}</p>}</section>;
  return <section className="system-section"><div className="section-heading"><div><h3>Softwareupdate</h3><p>Geprüfte Versionen direkt aus GitHub Releases installieren.</p></div><button onClick={() => checkUpdate(true)} disabled={busy}><RefreshCw size={14} /> {busy ? 'Prüfe …' : 'Neu prüfen'}</button></div>
    <article className="update-card"><div className="update-icon"><Download size={25} /></div><div className="update-copy"><small>INSTALLIERTE VERSION</small><h3>HouseOS {update?.currentVersion || info?.version || '–'}</h3><p>{update?.message || 'GitHub wird auf neue Releases geprüft …'}</p>{update?.hasUpdate && <div className="version-route"><span>v{update.currentVersion}</span><ChevronRight size={15} /><strong>v{update.latestVersion}</strong></div>}{update?.releaseUrl && <a href={update.releaseUrl} target="_blank" rel="noreferrer"><GitBranch size={13} /> Release auf GitHub ansehen</a>}</div><div className="update-actions">{update?.hasUpdate && update?.installable ? <button className="primary" disabled={busy || update.installing || !info?.installerReady} onClick={install}><Download size={15} />{update.installing ? 'Installation läuft …' : 'Update installieren'}</button> : <span className="up-to-date"><CheckCircle2 size={18} /> Aktuell</span>}</div></article>
    {!update?.configured && <div className="setup-hint"><GitBranch size={18} /><span><strong>GitHub noch verbinden</strong><small>Auf dem Pi in <code>/etc/houseos.env</code> den Wert <code>HOUSEOS_GITHUB_REPO=OWNER/REPO</code> setzen.</small></span></div>}{error && <p className="settings-error">{error}</p>}</section>;
}

const DEVICE_ACTIONS = {
  reboot: { title: 'Raspberry Pi neu starten?', description: 'HouseOS ist für ungefähr eine Minute nicht erreichbar.', confirm: 'Jetzt neu starten', icon: Power, tone: 'blue' },
  shutdown: { title: 'Raspberry Pi herunterfahren?', description: 'Das Gerät muss anschließend von Hand wieder eingeschaltet werden.', confirm: 'Herunterfahren', icon: PowerOff, tone: 'red' },
  exitKiosk: { title: 'Kiosk-Modus verlassen?', description: 'Chromium wird geschlossen und der Raspberry-Pi-Desktop wird sichtbar. Nach einem Neustart beginnt der Kiosk-Modus erneut.', confirm: 'Kiosk verlassen', icon: ExternalLink, tone: 'orange' },
};

function DeviceControls({ supported, notify }) {
  const [pending, setPending] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const action = pending && DEVICE_ACTIONS[pending]; const ActionIcon = action?.icon;
  const execute = async () => { setBusy(true); setError(''); try { const response = await fetch('/api/system/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: pending }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); notify(result.message); setPending(null); } catch (actionError) { setError(actionError.message || 'Aktion konnte nicht ausgeführt werden.'); } finally { setBusy(false); } };
  return <section className="device-controls"><div className="section-heading compact"><div><h3>Gerätesteuerung</h3><p>Direkte Aktionen für den Raspberry Pi.</p></div></div><div className="device-action-grid"><button onClick={() => setPending('reboot')} disabled={!supported}><i className="blue"><Power size={18} /></i><span><strong>Neu starten</strong><small>HouseOS sauber neu laden</small></span><ChevronRight size={15} /></button><button onClick={() => setPending('shutdown')} disabled={!supported}><i className="red"><PowerOff size={18} /></i><span><strong>Herunterfahren</strong><small>Raspberry Pi ausschalten</small></span><ChevronRight size={15} /></button><button onClick={() => setPending('exitKiosk')} disabled={!supported}><i className="orange"><ExternalLink size={18} /></i><span><strong>Kiosk verlassen</strong><small>Desktop für Admin-Tests öffnen</small></span><ChevronRight size={15} /></button></div>{!supported && <p className="device-hint">Diese Aktionen sind nur direkt auf dem Raspberry Pi verfügbar.</p>}{error && <p className="settings-error">{error}</p>}
    {action && <div className="confirm-backdrop" role="presentation" onPointerDown={event => event.target === event.currentTarget && !busy && setPending(null)}><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><i className={action.tone}><ActionIcon size={24} /></i><h3 id="confirm-title">{action.title}</h3><p>{action.description}</p><div><button disabled={busy} onClick={() => setPending(null)}>Abbrechen</button><button disabled={busy} className={`confirm-${action.tone}`} onClick={execute}>{busy ? 'Wird ausgeführt …' : action.confirm}</button></div></div></div>}
  </section>;
}

const MEMBER_COLORS = ['#007aff', '#af52de', '#ff2d55', '#ff9500', '#30b67a', '#5e5ce6'];
function Members({ items, setItems, tasks, setTasks, notify, embedded = false }) {
  const emptyForm = { name: '', role: 'Mitglied', color: MEMBER_COLORS[0], isAdmin: false }; const [form, setForm] = useState(emptyForm); const [editingId, setEditingId] = useState(null); const [error, setError] = useState('');
  const reset = () => { setForm(emptyForm); setEditingId(null); setError(''); };
  const submit = event => { event.preventDefault(); const name = form.name.trim(); if (name.length < 2) return setError('Bitte gib mindestens zwei Zeichen ein.'); if (items.some(member => member.id !== editingId && member.name.toLowerCase() === name.toLowerCase())) return setError('Dieses Mitglied gibt es bereits.'); if (editingId) { const previous = items.find(member => member.id === editingId); setItems(items.map(member => member.id === editingId ? { ...member, ...form, name } : member)); if (previous?.name !== name) setTasks(tasks.map(task => task.person === previous.name ? { ...task, person: name } : task)); notify(`${name} wurde aktualisiert`); } else { setItems([...items, { ...form, id: Date.now(), name }]); notify(`${name} kann beim nächsten Login eine PIN einrichten`); } reset(); };
  const edit = member => { setEditingId(member.id); setForm({ name: member.name, role: member.role, color: member.color, isAdmin: member.isAdmin }); setError(''); };
  const remove = member => { if (items.length === 1) return setError('Mindestens ein Haushaltsmitglied muss bleiben.'); const remaining = items.filter(item => item.id !== member.id); if (member.isAdmin && !remaining.some(item => item.isAdmin)) remaining[0] = { ...remaining[0], isAdmin: true, role: 'Haushaltsadmin' }; const replacement = remaining.find(item => item.isAdmin) || remaining[0]; setItems(remaining); setTasks(tasks.map(task => task.person === member.name ? { ...task, person: replacement.name } : task)); if (editingId === member.id) reset(); notify(`${member.name} wurde entfernt`); };
  return <div className={`${embedded ? '' : 'app-page '}members-page`}>{!embedded && <div className="app-heading"><div><span className="eyebrow">DEIN HAUSHALT</span><h2>Mitglieder</h2><p>Jede Person besitzt ein eigenes PIN-geschütztes Profil.</p></div><span className="member-count"><Users size={18} />{items.length}</span></div>}<div className="members-layout"><section className="member-list-panel"><header><h3>Haushaltsmitglieder</h3><span>{items.length} Profile · PIN-geschützt</span></header><div className="member-list">{items.map(member => <article className={`member-card ${editingId === member.id ? 'editing' : ''}`} key={member.id}><span className="member-avatar" style={{ '--avatar': member.color }}>{initials(member.name)}</span><span className="member-info"><strong>{member.name}</strong><small>{member.role}</small></span>{member.isAdmin && <span className="admin-badge"><ShieldCheck size={13} /> Admin</span>}<div className="member-actions"><button onClick={() => edit(member)}>Bearbeiten</button><button className="member-delete" onClick={() => remove(member)}><Trash2 size={15} /></button></div></article>)}</div></section>
    <form className="member-form" onSubmit={submit}><span className="form-icon"><UserPlus size={22} /></span><div><h3>{editingId ? 'Mitglied bearbeiten' : 'Mitglied hinzufügen'}</h3><p>{editingId ? 'Passe Name, Rolle oder Farbe an.' : 'Die PIN wird beim ersten Login eingerichtet.'}</p></div><label><span>Name</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Vor- und Nachname" /></label><label><span>Rolle im Haushalt</span><input value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} placeholder="z. B. Mitbewohnerin" /></label><fieldset><legend>Profilfarbe</legend><div className="color-picker">{MEMBER_COLORS.map(color => <button type="button" key={color} className={form.color === color ? 'selected' : ''} style={{ '--color': color }} onClick={() => setForm({ ...form, color })}><Check size={13} /></button>)}</div></fieldset><label className="admin-toggle"><input type="checkbox" checked={form.isAdmin} onChange={event => setForm({ ...form, isAdmin: event.target.checked, role: event.target.checked && form.role === 'Mitglied' ? 'Haushaltsadmin' : form.role })} /><span><strong>Administrator</strong><small>Darf Benutzer und Haushalt verwalten</small></span></label>{error && <p className="form-error">{error}</p>}<div className="form-actions">{editingId && <button type="button" onClick={reset}>Abbrechen</button>}<button className="primary">{editingId ? 'Änderungen sichern' : <><Plus size={16} /> Mitglied anlegen</>}</button></div></form></div></div>;
}

function PrintCenter({ tasks, shopping, notify, initialType, device }) {
  const [type, setType] = useState(initialType); const [printers, setPrinters] = useState([]); const [settings, setSettings] = useState({ printerName: '', paperWidth: 58, autoCut: true }); const [busy, setBusy] = useState(false); const [printStatus, setPrintStatus] = useState('');
  const date = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const context = { location: device.location, weatherText: device.weather ? `${weatherText(device.weather.code)}, ${Math.round(device.weather.temperature)} °C` : 'Wetterdaten nicht verfügbar' };
  useEffect(() => setType(initialType), [initialType]);
  const saveSettings = async next => { setSettings(next); try { const response = await fetch('/api/print/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }); if (!response.ok) throw new Error(); setPrintStatus('Druckeinstellungen gespeichert'); } catch { setPrintStatus('Einstellungen konnten nicht gespeichert werden'); } };
  const loadPrinterData = async () => { try { const [printerResponse, settingsResponse] = await Promise.all([fetch('/api/printers'), fetch('/api/print/settings')]); const printerItems = printerResponse.ok ? await printerResponse.json() : []; const saved = settingsResponse.ok ? await settingsResponse.json() : settings; setPrinters(printerItems); if (!saved.printerName && printerItems.length) { const preferred = printerItems.find(printer => printer.isDefault) || printerItems[0]; await saveSettings({ ...saved, printerName: preferred.name }); } else setSettings(saved); } catch { setPrintStatus('Lokaler Druckdienst ist nicht erreichbar'); } };
  useEffect(() => { loadPrinterData(); }, []);
  const sendPrint = async (dryRun = false) => { if (!dryRun && !settings.printerName) return notify('Bitte zuerst einen Drucker auswählen'); setBusy(true); setPrintStatus(dryRun ? 'Druckdaten werden geprüft …' : 'Bon wird direkt gesendet …'); try { const response = await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, dryRun, context }) }); const result = await response.json(); setPrintStatus(result.message); notify(result.message); } catch { setPrintStatus('Der lokale Druckdienst ist nicht erreichbar'); notify('Direktdruck nicht verfügbar'); } finally { setBusy(false); } };
  return <div className="app-page print-page"><div className="app-heading"><div><span className="eyebrow">HOUSEOS DIRECT PRINT</span><h2>Print Center</h2><p>Vorschau und Bondaten verwenden dieselben aktuellen Gerätedaten.</p></div><span className={`printer-status ${settings.printerName ? '' : 'not-ready'}`}><i /> {settings.printerName ? 'Direktdruck bereit' : 'Drucker wählen'}</span></div><div className="print-layout"><section className="print-options"><h3>Was möchtest du drucken?</h3>{[['daily','Tagesübersicht',Sun],['shopping','Einkaufsliste',ShoppingBasket],['tasks','Aufgabenliste',ListTodo]].map(([id,label,Icon]) => <button className={type === id ? 'selected' : ''} key={id} onClick={() => setType(id)}><span><Icon size={19} /></span><strong>{label}</strong>{type === id && <CheckCircle2 size={18} />}</button>)}<div className="printer-setup"><div className="setup-heading"><strong>Drucker</strong><button onClick={loadPrinterData}><RotateCcw size={13} /></button></div><select value={settings.printerName} onChange={event => saveSettings({ ...settings, printerName: event.target.value })}><option value="">Drucker auswählen …</option>{printers.map(printer => <option key={printer.name} value={printer.name}>{printer.name}{printer.isDefault ? ' · Standard' : ''}{printer.offline ? ' · Offline' : ''}</option>)}</select><strong className="setup-label">Papierbreite</strong><div className="paper-switch">{[58,80].map(width => <button key={width} className={settings.paperWidth === width ? 'selected' : ''} onClick={() => saveSettings({ ...settings, paperWidth: width })}>{width} mm</button>)}</div><label className="cut-toggle"><input type="checkbox" checked={settings.autoCut} onChange={event => saveSettings({ ...settings, autoCut: event.target.checked })} /><span>Bon automatisch abschneiden</span></label></div><button className="print-button" disabled={busy || !settings.printerName} onClick={() => sendPrint(false)}><Printer size={18} /> {busy ? 'Wird gesendet …' : `Direkt auf ${settings.paperWidth} mm drucken`}</button><button className="reset-button" disabled={busy} onClick={() => sendPrint(true)}><CheckCircle2 size={15} /> Druckdaten testen</button>{printStatus && <p className="print-feedback">{printStatus}</p>}</section>
    <section className="receipt-wrap"><span className="preview-label">VORSCHAU · {settings.paperWidth} MM</span><div className={`receipt paper-${settings.paperWidth}`} id="receipt"><div className="receipt-logo">⌂ HOUSEOS</div><p>{type === 'daily' ? 'TAGESÜBERSICHT' : type === 'shopping' ? 'EINKAUFSLISTE' : 'AUFGABENLISTE'}</p><div className="receipt-rule" /><small>{date}</small>{type === 'daily' && <><h4>STANDORT</h4><p>{context.location}</p><h4>WETTER</h4><p>{context.weatherText}</p><h4>AUFGABEN</h4>{tasks.filter(task => !task.done).map(task => <p key={task.id}>[ ] {task.text}<small> · {taskSchedule(task)}</small></p>)}<h4>EINKAUF</h4>{shopping.filter(item => !item.checked).map(item => <p key={item.id}>[ ] {item.text}</p>)}</>}{type === 'shopping' && shopping.filter(item => !item.checked).map(item => <p key={item.id}>[ ] {item.text} <small>({item.category})</small></p>)}{type === 'tasks' && tasks.filter(task => !task.done).map(task => <p key={task.id}>[ ] {task.text}<small> · {task.person} · {taskSchedule(task)}</small></p>)}<div className="receipt-rule" /><p className="receipt-center">Zuhause läuft alles.<br />houseos.local</p></div></section></div></div>;
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);

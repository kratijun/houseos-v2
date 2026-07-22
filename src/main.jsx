import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronUp, Circle, Clock3, CloudSun, Command,
  Delete, Home, ListTodo, LockKeyhole, MapPin, Maximize2, Minus, Minimize2,
  Plus, Printer, Repeat2, RotateCcw, Search, Settings, ShieldCheck, ShoppingBasket,
  Sparkles, Sun, Tag, Trash2, UserPlus, Users, X, Download, GitBranch, Server, Cpu,
  HardDrive, RefreshCw, MonitorCog,
  UserRound, Palette, Bell, Accessibility, Camera, Moon, Languages, Volume2,
  Info, KeyRound, Eye, Contrast, Smartphone, SlidersHorizontal,
  Power, PowerOff, Lock, AlertTriangle, ExternalLink, Pause, Play, Bluetooth,
  Speaker, Headphones, Keyboard, MousePointer2, MoreHorizontal, LoaderCircle,
  Trophy, Flame, Award, CalendarDays, Utensils, Heart, Cookie, Gamepad2,
  BedDouble, Shirt, Star, Gift, Smile, PawPrint, MessageCircle, Send,
  Pencil, Mic, Square, Reply, Upload, Copy, Link2,
} from 'lucide-react';
import packageInfo from '../package.json';
import './styles.css';

const APP_DEFS = {
  today: { title: 'Heute', icon: Sun, color: '#ff9f0a', keywords: 'übersicht wetter standort uhrzeit' },
  timer: { title: 'Timer', icon: Clock3, color: '#ff9500', keywords: 'küche kochen alarm wecker countdown' },
  tasks: { title: 'Aufgaben', icon: ListTodo, color: '#30b67a', keywords: 'todo erledigen termin zeit wiederholung' },
  calendar: { title: 'Kalender', icon: CalendarDays, color: '#0a84ff', keywords: 'familie termine geburtstag ereignis planung' },
  shopping: { title: 'Einkauf', icon: ShoppingBasket, color: '#ff6259', keywords: 'liste artikel kategorie' },
  meals: { title: 'Speiseplan', icon: Utensils, color: '#af52de', keywords: 'essen rezepte woche frühstück mittag abend zutaten' },
  messages: { title: 'Chats', icon: MessageCircle, color: '#0a84ff', keywords: 'nachrichten chat familie mitglieder schreiben' },
  printer: { title: 'Print Center', icon: Printer, color: '#667eea', keywords: 'bon drucken vorschau' },
  settings: { title: 'Einstellungen', icon: Settings, color: '#636366', keywords: 'admin benutzer profil pin system update version github' },
};

const DEFAULT_PREFERENCES = {
  appearance: 'auto', accent: '#007aff', wallpaper: 'bloom', avatar: '',
  notifications: true, sounds: true, largeText: false, highContrast: false,
  reduceMotion: false, performanceMode: false, language: 'Deutsch', ambientMode: true,
};
const loadPreferences = (memberId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(`houseos.preferences.${memberId}`)) || {};
    const devicePerformanceMode = localStorage.getItem('houseos.performanceMode');
    return { ...DEFAULT_PREFERENCES, ...saved, performanceMode: devicePerformanceMode === null ? Boolean(saved.performanceMode) : devicePerformanceMode === 'true' };
  }
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
  { id: 1, text: 'Hafermilch', checked: false, category: 'Frühstück', quantity: '1 Liter' },
  { id: 2, text: 'Tomaten', checked: false, category: 'Gemüse', quantity: '4 Stück' },
  { id: 3, text: 'Kaffeebohnen', checked: true, category: 'Vorrat', quantity: '500 g' },
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
const PET_MESSAGES = name => [`Hallo ${name}!`, 'Du machst das großartig!', 'Zeit für eine kleine Kuschelpause?', 'Ich passe auf HouseOS auf.', 'High Five!'];
const DEFAULT_PET_STATE = { fullness: 78, joy: 82, energy: 74, love: 55, xp: 0, sleeping: false, sleepStarted: null, outfits: [], busyUntil: 0, busyType: '', lastUpdated: Date.now() };
const PET_OUTFITS = [
  { id: 'none', label: 'Ohne', icon: Circle, level: 1 },
  { id: 'scarf', label: 'Schal', icon: Shirt, level: 2 },
  { id: 'bow', label: 'Masche', icon: Sparkles, points: 15 },
  { id: 'pajamas', label: 'Pyjama', icon: Moon, level: 3 },
  { id: 'crown', label: 'Krone', icon: Award, points: 40 },
];
const clampPetValue = value => Math.max(0, Math.min(100, Math.round(value)));
const petLevel = xp => Math.min(9, Math.floor(Math.max(0, xp || 0) / 45) + 1);
const agePetState = state => {
  const now = Date.now();
  const current = { ...DEFAULT_PET_STATE, ...state };
  const elapsedHours = Math.max(0, now - (current.lastUpdated || now)) / 3_600_000;
  const energy = elapsedHours < .01 ? clampPetValue(current.energy) : clampPetValue(current.energy + elapsedHours * (current.sleeping ? 22 : -2));
  const fullyRested = current.sleeping && energy >= 100;
  return {
    ...current,
    fullness: elapsedHours < .01 ? clampPetValue(current.fullness) : clampPetValue(current.fullness - elapsedHours * 4),
    joy: elapsedHours < .01 ? clampPetValue(current.joy) : clampPetValue(current.joy - elapsedHours * (current.sleeping ? .4 : 2.5)),
    energy,
    love: elapsedHours < .01 ? clampPetValue(current.love) : clampPetValue(current.love - elapsedHours * .6),
    sleeping: fullyRested ? false : current.sleeping,
    sleepStarted: fullyRested ? null : current.sleepStarted,
    busyUntil: current.busyUntil > now ? current.busyUntil : 0,
    busyType: current.busyUntil > now ? current.busyType : '',
    lastUpdated: elapsedHours < .01 ? current.lastUpdated : now,
  };
};
const loadPetState = memberId => {
  try {
    const saved = JSON.parse(localStorage.getItem(`houseos.pet.${memberId}`)) || {};
    const outfits = Array.isArray(saved.outfits) ? saved.outfits : saved.outfit && saved.outfit !== 'none' ? [saved.outfit] : [];
    return agePetState({ ...DEFAULT_PET_STATE, ...saved, outfits: [...new Set(outfits.filter(id => PET_OUTFITS.some(outfit => outfit.id === id && id !== 'none')))] });
  }
  catch { return { ...DEFAULT_PET_STATE }; }
};

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
const repeatLabel = { none: '', daily: 'Täglich', weekdays: 'An Wochentagen', weekly: 'Wöchentlich', monthly: 'Monatlich' };
const taskSchedule = (task) => {
  const parts = [];
  if (task.dueDate) parts.push(new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
  if (task.time && task.time !== 'Heute' && task.time !== 'Erledigt') parts.push(`${task.time} Uhr`);
  if (repeatLabel[task.recurrence]) parts.push(repeatLabel[task.recurrence]);
  return parts.join(' · ') || (task.time || 'Ohne Termin');
};

const collectionSyncListeners = new Map();
let collectionSyncSource = null;
const subscribeCollectionSync = (resource, listener) => {
  if (!collectionSyncListeners.has(resource)) collectionSyncListeners.set(resource, new Set());
  collectionSyncListeners.get(resource).add(listener);
  if (!collectionSyncSource && 'EventSource' in window) {
    collectionSyncSource = new EventSource('/api/sync/events');
    collectionSyncSource.addEventListener('collection', event => {
      try {
        const { resource: changedResource } = JSON.parse(event.data || '{}');
        collectionSyncListeners.get(changedResource)?.forEach(callback => callback());
      } catch {}
    });
  }
  return () => {
    const listeners = collectionSyncListeners.get(resource);
    listeners?.delete(listener);
    if (listeners && !listeners.size) collectionSyncListeners.delete(resource);
    if (!collectionSyncListeners.size && collectionSyncSource) { collectionSyncSource.close(); collectionSyncSource = null; }
  };
};

function useDatabaseCollection(resource, fallback, enabled) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`houseos.${resource}`)) ?? fallback; } catch { return fallback; }
  });
  const valueRef = useRef(value);
  const writeVersionRef = useRef(0);
  const pendingWritesRef = useRef(0);
  const requestIdRef = useRef(0);
  const writeQueueRef = useRef(Promise.resolve());
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!enabled) { setOnline(false); return; }
    let active = true;
    const refresh = async () => {
      const requestId = ++requestIdRef.current;
      const writeVersion = writeVersionRef.current;
      try {
        const response = await fetch(`/api/${resource}`, { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const items = await response.json();
        if (!active || requestId !== requestIdRef.current || writeVersion !== writeVersionRef.current || pendingWritesRef.current) return;
        valueRef.current = items; setValue(items); setOnline(true);
        localStorage.setItem(`houseos.${resource}`, JSON.stringify(items));
        if (resource === 'tasks') {
          fetch('/api/progress', { cache: 'no-store' }).then(progressResponse => progressResponse.ok ? progressResponse.json() : null)
            .then(progress => progress && window.dispatchEvent(new CustomEvent('houseos:progress', { detail: progress }))).catch(() => {});
        }
      } catch { if (active) setOnline(false); }
    };
    const unsubscribe = subscribeCollectionSync(resource, refresh);
    const interval = setInterval(refresh, 10_000);
    const refreshVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refreshVisible);
    refresh();
    return () => {
      active = false; clearInterval(interval); unsubscribe();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [resource, enabled]);
  const update = (updater) => {
    const next = typeof updater === 'function' ? updater(valueRef.current) : updater;
    writeVersionRef.current += 1; pendingWritesRef.current += 1;
    valueRef.current = next; setValue(next);
    localStorage.setItem(`houseos.${resource}`, JSON.stringify(next));
    writeQueueRef.current = writeQueueRef.current.catch(() => {}).then(async () => {
      try {
        const response = await fetch(`/api/${resource}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: next }) });
        setOnline(response.ok);
        if (response.ok && resource === 'tasks') {
          const result = await response.json();
          window.dispatchEvent(new CustomEvent('houseos:progress', { detail: result.progress }));
        }
      } catch { setOnline(false); }
      finally { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); }
    });
  };
  return [value, update, online];
}

const pushApplicationKey = value => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(`${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

function usePushNotifications(memberId) {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [state, setState] = useState({ status: supported ? 'loading' : 'unsupported', busy: false, message: '' });

  const refresh = async () => {
    if (!supported) return;
    try {
      const response = await fetch('/api/push/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('Push-Dienst ist nicht erreichbar.');
      const config = await response.json();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription }) });
      setState({ status: subscription ? 'subscribed' : Notification.permission === 'denied' ? 'denied' : 'available', busy: false, message: '', publicKey: config.publicKey });
    } catch (error) {
      setState(current => ({ ...current, status: 'error', busy: false, message: error.message || 'Mitteilungen konnten nicht geprüft werden.' }));
    }
  };

  useEffect(() => { refresh(); }, [memberId]);

  const enable = async () => {
    setState(current => ({ ...current, busy: true, message: '' }));
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Benachrichtigungen wurden im Browser nicht erlaubt.');
      const configResponse = await fetch('/api/push/status', { cache: 'no-store' });
      if (!configResponse.ok) throw new Error('Push-Dienst ist nicht erreichbar.');
      const config = await configResponse.json();
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushApplicationKey(config.publicKey) });
      const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Abonnement konnte nicht gespeichert werden.');
      setState({ status: 'subscribed', busy: false, message: 'Mitteilungen sind auf diesem Gerät aktiv.', publicKey: config.publicKey });
      return true;
    } catch (error) {
      setState(current => ({ ...current, status: Notification.permission === 'denied' ? 'denied' : 'error', busy: false, message: error.message || 'Mitteilungen konnten nicht aktiviert werden.' }));
      return false;
    }
  };

  const disable = async () => {
    setState(current => ({ ...current, busy: true, message: '' }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState(current => ({ ...current, status: 'available', busy: false, message: 'Mitteilungen sind auf diesem Gerät ausgeschaltet.' }));
      return true;
    } catch (error) {
      setState(current => ({ ...current, busy: false, message: error.message || 'Mitteilungen konnten nicht ausgeschaltet werden.' }));
      return false;
    }
  };

  const test = async () => {
    setState(current => ({ ...current, busy: true, message: '' }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('Dieses Gerät ist nicht mehr für Mitteilungen registriert.');
      const response = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      if (!response.ok) throw new Error('Testmitteilung konnte nicht gesendet werden.');
      setState(current => ({ ...current, busy: false, message: 'Testmitteilung wurde gesendet.' }));
    } catch (error) { setState(current => ({ ...current, busy: false, message: error.message })); }
  };

  return { ...state, supported, enable, disable, test };
}

function useDeviceContext(enabled) {
  const [context, setContext] = useState({ location: 'Standort wird ermittelt …', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, weather: null, status: 'loading' });
  const refresh = async (cityOverride) => {
    if (!enabled) return;
    setContext(current => ({ ...current, status: 'loading' }));
    let city = typeof cityOverride === 'string' ? cityOverride : '';
    if (cityOverride === undefined) {
      try {
        const settingsResponse = await fetch('/api/device/settings', { cache: 'no-store' });
        if (settingsResponse.ok) city = String((await settingsResponse.json()).city || '');
      } catch {}
    }
    const useServerLocation = async (configuredCity = '') => {
      try {
        const response = await fetch(`/api/device-context${configuredCity ? `?city=${encodeURIComponent(configuredCity)}` : ''}`, { cache: 'no-store' });
        if (!response.ok) throw new Error();
        setContext({ ...(await response.json()), status: 'ready' });
      } catch { setContext(current => ({ ...current, location: 'Standort nicht verfügbar', status: 'error' })); }
    };
    if (city) return useServerLocation(city);
    if (!navigator.geolocation) return useServerLocation();
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const response = await fetch(`/api/device-context?lat=${encodeURIComponent(position.coords.latitude)}&lon=${encodeURIComponent(position.coords.longitude)}`);
        if (!response.ok) throw new Error();
        setContext({ ...(await response.json()), status: 'ready' });
      } catch { setContext(current => ({ ...current, location: 'Aktueller Standort', status: 'error' })); }
    }, useServerLocation, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  };
  useEffect(() => { refresh(); }, [enabled]);
  return [context, refresh];
}

function App() {
  const [booting, setBooting] = useState(true);
  const [users, setUsers] = useState([]);
  const [member, setMember] = useState(null);
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    const root = document.documentElement;
    const enableTouchUi = () => root.classList.add('touch-ui');
    const detectTouchPointer = event => { if (event.pointerType === 'touch') enableTouchUi(); };
    const preventBrowserGesture = event => { if (root.classList.contains('touch-ui')) event.preventDefault(); };
    if (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches) enableTouchUi();
    window.addEventListener('touchstart', enableTouchUi, { passive: true, once: true });
    window.addEventListener('pointerdown', detectTouchPointer, { passive: true });
    window.addEventListener('contextmenu', preventBrowserGesture);
    window.addEventListener('dragstart', preventBrowserGesture);
    return () => {
      window.removeEventListener('touchstart', enableTouchUi);
      window.removeEventListener('pointerdown', detectTouchPointer);
      window.removeEventListener('contextmenu', preventBrowserGesture);
      window.removeEventListener('dragstart', preventBrowserGesture);
    };
  }, []);
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
  if (booting) return <BootScreen />;
  if (!member) return <LoginScreen users={users} onAuthenticated={setMember} onUsersChanged={refreshUsers} error={authError} setError={setAuthError} />;
  return <Desktop key={member.id} currentMember={member} onMemberChange={setMember} authUsers={users} onUsersChanged={refreshUsers} authError={authError} setAuthError={setAuthError} />;
}

function BootScreen() {
  return <div className="boot" role="status" aria-label="HouseOS wird gestartet"><div className="boot-orbit"><Home size={42} strokeWidth={1.65} /></div><div className="boot-logo">houseos</div><div className="boot-line"><i /></div><p>HouseOS wird gestartet …</p></div>;
}

function LoginScreen({ users, onAuthenticated, onUsersChanged, error, setError, embedded = false, onDismiss }) {
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
  const now = new Date();
  return <main className={`login-screen ${embedded ? 'session-login' : ''}`}>
    <div className="login-glow one" /><div className="login-glow two" />
    <div className="login-brand"><span><Home size={18} strokeWidth={1.8} /></span><strong>houseos</strong></div>
    <div className="login-time"><strong>{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong><span>{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <section className={`login-panel ${selected ? 'pin-mode' : 'user-mode'}`}>
      {embedded && <button type="button" className="session-login-close" aria-label="Zurück zum Ruhebildschirm" onClick={onDismiss}><ChevronLeft size={17} /> Ruhebildschirm</button>}
      {!selected ? <>
        <div className="login-copy"><small>{embedded ? 'HOUSEOS GESPERRT' : 'WILLKOMMEN ZU HAUSE'}</small><h1>Wer verwendet HouseOS?</h1><p>{embedded ? 'Melde dich an oder wechsle das Profil.' : 'Wähle dein Profil, um fortzufahren.'}</p></div>
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
    <div className="login-footer"><Lock size={12} /> Persönlich. Sicher. Zu Hause.</div>
  </main>;
}

let timerAudioContext;
const prepareTimerAudio = () => {
  try {
    timerAudioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    timerAudioContext.resume?.().catch?.(() => {});
  } catch {}
  return timerAudioContext;
};
const playTimerBell = () => {
  const context = prepareTimerAudio(); if (!context) return;
  const start = context.currentTime;
  [[0,880],[.16,1175],[.34,880]].forEach(([offset, frequency]) => {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start + offset);
    gain.gain.setValueAtTime(.0001, start + offset); gain.gain.exponentialRampToValueAtTime(.28, start + offset + .018); gain.gain.exponentialRampToValueAtTime(.0001, start + offset + .22);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start + offset); oscillator.stop(start + offset + .24);
  });
};
const loadKitchenTimers = () => {
  try { const value = JSON.parse(localStorage.getItem('houseos.kitchenTimers')); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
const formatTimer = milliseconds => {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(total / 3600); const minutes = Math.floor(total % 3600 / 60); const seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
};
const dateValue = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const weekStartValue = (value = localDateValue()) => {
  const date = new Date(`${value}T12:00:00`);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return dateValue(date);
};
const shiftDateValue = (value, days) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return dateValue(date); };
const shiftMonthValue = (value, months) => { const date = new Date(`${value}T12:00:00`); date.setDate(1); date.setMonth(date.getMonth() + months); return dateValue(date); };
const eventOccursOn = (event, value) => {
  if (!event?.startDate || value < event.startDate) return false;
  if (!event.recurrence || event.recurrence === 'none') return value >= event.startDate && value <= (event.endDate || event.startDate);
  const start = new Date(`${event.startDate}T12:00:00`); const current = new Date(`${value}T12:00:00`);
  const days = Math.round((current - start) / 86_400_000);
  if (event.recurrence === 'daily') return days >= 0;
  if (event.recurrence === 'weekly') return days >= 0 && days % 7 === 0;
  if (event.recurrence === 'monthly') return current.getDate() === start.getDate();
  if (event.recurrence === 'yearly') return current.getDate() === start.getDate() && current.getMonth() === start.getMonth();
  return false;
};
const eventsForDate = (events, value) => events.filter(event => eventOccursOn(event, value)).sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
const eventTimeLabel = event => event.allDay || !event.startTime ? 'Ganztägig' : `${event.startTime}${event.endTime ? `–${event.endTime}` : ''}`;

const loadWorkspace = memberId => {
  try {
    const saved = JSON.parse(localStorage.getItem(`houseos.workspace.${memberId}`));
    const requestedApp = new URLSearchParams(window.location.search).get('app');
    const focused = APP_DEFS[requestedApp] ? requestedApp : APP_DEFS[saved?.focused] ? saved.focused : 'today';
    const savedApps = Array.isArray(saved?.activeApps) && saved.activeApps.length ? saved.activeApps.filter(id => APP_DEFS[id]) : ['today'];
    return { activeApps: [...new Set([...savedApps, focused])], minimizedApps: Array.isArray(saved?.minimizedApps) ? saved.minimizedApps.filter(id => APP_DEFS[id] && id !== focused) : [], focused };
  } catch { return { activeApps: ['today'], minimizedApps: [], focused: 'today' }; }
};

const detectPhoneLayout = () => {
  const shortestViewport = Math.min(window.innerWidth, window.innerHeight);
  const phoneUserAgent = /iPhone|iPod|Android.+Mobile|Windows Phone/i.test(navigator.userAgent);
  return phoneUserAgent || shortestViewport <= 560;
};

function usePhoneLayout() {
  const [isPhone, setIsPhone] = useState(detectPhoneLayout);
  useEffect(() => {
    const update = () => setIsPhone(detectPhoneLayout());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return isPhone;
}

const detectTabletKeyboardLayout = () => {
  if (detectPhoneLayout()) return false;
  const shortestViewport = Math.min(window.innerWidth, window.innerHeight);
  const compactTabletViewport = shortestViewport > 560 && window.innerWidth <= 1100;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const finePointer = window.matchMedia?.('(pointer: fine)').matches;
  const touchFirstDevice = navigator.maxTouchPoints > 0 && !finePointer;
  const raspberryPi = /(?:aarch64|armv\d+l)/i.test(`${navigator.userAgent} ${navigator.platform}`);
  return Boolean(compactTabletViewport || coarsePointer || touchFirstDevice || raspberryPi);
};

function useTabletKeyboardLayout() {
  const [isTabletKeyboard, setIsTabletKeyboard] = useState(detectTabletKeyboardLayout);
  useEffect(() => {
    const update = () => setIsTabletKeyboard(detectTabletKeyboardLayout());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return isTabletKeyboard;
}

function Desktop({ currentMember, onMemberChange, authUsers, onUsersChanged, authError, setAuthError }) {
  const initialWorkspace = useMemo(() => loadWorkspace(currentMember.id), [currentMember.id]);
  const [time, setTime] = useState(new Date());
  const [activeApps, setActiveApps] = useState(initialWorkspace.activeApps);
  const [minimizedApps, setMinimizedApps] = useState(initialWorkspace.minimizedApps);
  const [focused, setFocused] = useState(initialWorkspace.focused);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [printType, setPrintType] = useState('daily');
  const [preferences, setPreferences] = useState(() => loadPreferences(currentMember.id));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState({ members: [], householdPoints: 0, currentMember: null });
  const [restartNotice, setRestartNotice] = useState(null);
  const [timers, setTimers] = useState(loadKitchenTimers);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [installPrompt, setInstallPrompt] = useState(null);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const isPhone = usePhoneLayout();
  const [tasks, setTasks, tasksOnline] = useDatabaseCollection('tasks', defaultTasks, true);
  const [calendarEvents, setCalendarEvents, calendarOnline] = useDatabaseCollection('calendar', [], true);
  const [shopping, setShopping, shoppingOnline] = useDatabaseCollection('shopping', defaultShopping, true);
  const [shoppingCatalog, setShoppingCatalog, shoppingCatalogOnline] = useDatabaseCollection('shoppingcatalog', [], true);
  const [mealPlans, setMealPlans, mealPlansOnline] = useDatabaseCollection('mealplans', [], true);
  const [savedDishes, setSavedDishes, savedDishesOnline] = useDatabaseCollection('dishes', [], true);
  const [members, setMembers, membersOnline] = useDatabaseCollection('members', defaultMembers, true);
  const [device, refreshDevice] = useDeviceContext(true);
  const databaseOnline = tasksOnline && calendarOnline && shoppingOnline && shoppingCatalogOnline && mealPlansOnline && savedDishesOnline && membersOnline;
  const refreshProgress = () => fetch('/api/progress', { cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject()).then(setProgress).catch(() => {});
  useEffect(() => { const tick = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => { localStorage.setItem(`houseos.workspace.${currentMember.id}`, JSON.stringify({ activeApps, minimizedApps, focused })); }, [currentMember.id, activeApps, minimizedApps, focused]);
  useEffect(() => { localStorage.setItem(`houseos.preferences.${currentMember.id}`, JSON.stringify(preferences)); }, [currentMember.id, preferences]);
  useEffect(() => { localStorage.setItem('houseos.kitchenTimers', JSON.stringify(timers)); }, [timers]);
  useEffect(() => {
    const tick = () => {
      const now = Date.now(); setTimerNow(now);
      setTimers(current => { let changed = false; const next = current.map(timer => { if (timer.status === 'running' && timer.endAt <= now) { changed = true; return { ...timer, status: 'ringing', remaining: 0 }; } return timer; }); return changed ? next : current; });
    };
    const interval = setInterval(tick, 500); tick(); return () => clearInterval(interval);
  }, []);
  const ringingTimers = timers.filter(timer => timer.status === 'ringing');
  useEffect(() => {
    if (!ringingTimers.length || !preferences.sounds) return;
    playTimerBell(); const bell = setInterval(playTimerBell, 2600); return () => clearInterval(bell);
  }, [ringingTimers.length, preferences.sounds]);
  useEffect(() => {
    if (!timers.some(timer => timer.status === 'running') || !navigator.wakeLock?.request) return;
    let wakeLock; navigator.wakeLock.request('screen').then(lock => { wakeLock = lock; }).catch(() => {});
    return () => wakeLock?.release?.().catch(() => {});
  }, [timers.some(timer => timer.status === 'running')]);
  useEffect(() => { const query = window.matchMedia?.('(prefers-color-scheme: dark)'); if (!query) return; const update = event => setSystemDark(event.matches); query.addEventListener?.('change', update); return () => query.removeEventListener?.('change', update); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    refreshProgress();
    const update = event => event.detail ? setProgress(event.detail) : refreshProgress();
    window.addEventListener('houseos:progress', update);
    return () => window.removeEventListener('houseos:progress', update);
  }, []);
  useEffect(() => {
    let active = true;
    const refreshUnread = () => fetch('/api/messages/conversations', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(result => active && setMessageUnreadCount(result.unreadCount || 0)).catch(() => {});
    refreshUnread();
    const interval = setInterval(refreshUnread, 5000);
    const update = event => setMessageUnreadCount(event.detail ?? 0);
    window.addEventListener('houseos:messages-unread', update);
    return () => { active = false; clearInterval(interval); window.removeEventListener('houseos:messages-unread', update); };
  }, [currentMember.id]);
  useEffect(() => {
    const showRestart = event => setRestartNotice(current => current || { title: event.detail?.title || 'Raspberry Pi startet neu', message: event.detail?.message || 'Der Raspberry Pi wird neu gestartet.', targetVersion: event.detail?.version || '' });
    window.addEventListener('houseos:restart', showRestart);
    return () => window.removeEventListener('houseos:restart', showRestart);
  }, []);
  useEffect(() => {
    let lockTimer;
    const armIdle = () => {
      clearTimeout(lockTimer);
      if (!locked) lockTimer = setTimeout(() => setLocked(true), preferences.ambientMode ? 60_000 : 15 * 60_000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart']; events.forEach(name => window.addEventListener(name, armIdle, { passive: true })); armIdle();
    return () => { clearTimeout(lockTimer); events.forEach(name => window.removeEventListener(name, armIdle)); };
  }, [locked, preferences.ambientMode]);
  useEffect(() => {
    const captureInstallPrompt = event => { event.preventDefault(); setInstallPrompt(event); };
    const clearInstallPrompt = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', clearInstallPrompt);
    return () => { window.removeEventListener('beforeinstallprompt', captureInstallPrompt); window.removeEventListener('appinstalled', clearInstallPrompt); };
  }, []);
  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  };
  const openApp = (id) => { setActiveApps(apps => [...apps.filter(app => app !== id), id]); setMinimizedApps(apps => apps.filter(app => app !== id)); setFocused(id); setLauncherOpen(false); };
  const openPrint = (type) => { setPrintType(type); openApp('printer'); };
  const focusApp = (id) => { setActiveApps(apps => [...apps.filter(app => app !== id), id]); setFocused(id); };
  const closeApp = (id) => { setActiveApps(apps => { const remaining = apps.filter(app => app !== id); setFocused(current => current === id ? (remaining.filter(app => !minimizedApps.includes(app)).at(-1) ?? null) : current); return remaining; }); setMinimizedApps(apps => apps.filter(app => app !== id)); };
  const minimizeApp = (id) => { setMinimizedApps(apps => apps.includes(id) ? apps : [...apps, id]); setFocused(current => current === id ? (activeApps.filter(app => app !== id && !minimizedApps.includes(app)).at(-1) ?? null) : current); };
  const addTimer = (seconds, label) => { prepareTimerAudio(); const duration = Math.max(1, Math.round(seconds)) * 1000; setTimers(current => [...current, { id: `${Date.now()}-${Math.random()}`, label: label.trim() || 'Küchentimer', duration, remaining: duration, endAt: Date.now() + duration, status: 'running' }]); };
  const pauseTimer = id => setTimers(current => current.map(timer => timer.id === id && timer.status === 'running' ? { ...timer, status: 'paused', remaining: Math.max(0, timer.endAt - Date.now()) } : timer));
  const resumeTimer = id => { prepareTimerAudio(); setTimers(current => current.map(timer => timer.id === id && timer.status === 'paused' ? { ...timer, status: 'running', endAt: Date.now() + timer.remaining } : timer)); };
  const removeTimer = id => setTimers(current => current.filter(timer => timer.id !== id));
  const temp = device.weather?.temperature;
  const resolvedAppearance = preferences.appearance === 'auto' ? (systemDark ? 'dark' : 'light') : preferences.appearance;
  return <main className={`desktop theme-${resolvedAppearance} wallpaper-${preferences.wallpaper} ${isPhone ? 'phone-layout' : 'tablet-layout'} ${preferences.largeText ? 'large-text' : ''} ${preferences.highContrast ? 'high-contrast' : ''} ${preferences.reduceMotion ? 'reduce-motion' : ''} ${preferences.performanceMode ? 'performance-mode' : ''}`} style={{ '--blue': preferences.accent }} onClick={() => launcherOpen && setLauncherOpen(false)}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <button className="brand" onClick={event => { event.stopPropagation(); setLauncherOpen(!launcherOpen); }}><span className="brand-mark"><Home size={16} /></span><span>house<span>os</span></span></button>
      <button className="topbar-center location-button" onClick={refreshDevice} title="Standort und Wetter aktualisieren"><CloudSun size={16} /><span>{device.location}</span>{Number.isFinite(temp) && <strong>{Math.round(temp)}°</strong>}</button>
      <div className="mobile-context"><small>{greeting(time.getHours())}</small><strong>{currentMember.name}</strong></div>
      <div className="topbar-actions">{installPrompt && <button className="install-pwa" onClick={installApp} title="HouseOS installieren" aria-label="HouseOS als App installieren"><Download size={15} /></button>}<span className={`system-ok ${databaseOnline ? '' : 'offline'}`}><i /> {databaseOnline ? 'Synchronisiert' : 'Nur lokal'}</span><span>{time.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}</span><strong>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong><button className="logout" onClick={() => setLocked(true)} title="HouseOS sperren" aria-label="HouseOS sperren"><Lock size={15} /></button></div>
    </header>
    <section className="welcome-copy"><p>{greeting(time.getHours())}, {currentMember.name}</p><h1>Dein Zuhause ist<br /><em>bereit für den Tag.</em></h1></section>
    <aside className="desktop-icons">{Object.entries(APP_DEFS).map(([id, app]) => <DesktopIcon key={id} app={app} onClick={() => openApp(id)} />)}</aside>
    <HousePet member={currentMember} householdPoints={progress.householdPoints || 0} />
    {launcherOpen && <Launcher onOpen={openApp} onClose={() => setLauncherOpen(false)} currentMember={currentMember} isPhone={isPhone} />}
    <section className="window-layer">{Object.keys(APP_DEFS).filter(id => activeApps.includes(id)).map(id => <Window key={id} id={id} workspaceKey={currentMember.id} app={APP_DEFS[id]} onClose={() => closeApp(id)} onMinimize={() => minimizeApp(id)} onFocus={() => focusApp(id)} focused={focused === id} minimized={minimizedApps.includes(id)} z={20 + activeApps.indexOf(id)}>
      {id === 'today' && <Today tasks={tasks} events={calendarEvents} shopping={shopping} mealPlans={mealPlans} onOpen={openApp} onPrint={() => openPrint('daily')} time={time} device={device} member={currentMember} progress={progress} />}
      {id === 'timer' && <KitchenTimers timers={timers} now={timerNow} onAdd={addTimer} onPause={pauseTimer} onResume={resumeTimer} onRemove={removeTimer} />}
      {id === 'tasks' && <Tasks items={tasks} setItems={setTasks} members={members} currentMember={currentMember} progress={progress} notify={setToast} />}
      {id === 'calendar' && <FamilyCalendar items={calendarEvents} setItems={setCalendarEvents} members={members} notify={setToast} />}
      {id === 'shopping' && <Shopping items={shopping} setItems={setShopping} catalog={shoppingCatalog} setCatalog={setShoppingCatalog} savedDishes={savedDishes} onPrint={() => openPrint('shopping')} notify={setToast} />}
      {id === 'meals' && <MealPlanner items={mealPlans} setItems={setMealPlans} savedDishes={savedDishes} setSavedDishes={setSavedDishes} shopping={shopping} setShopping={setShopping} catalog={shoppingCatalog} setCatalog={setShoppingCatalog} notify={setToast} />}
      {id === 'messages' && <MessagesApp currentMember={currentMember} notify={setToast} />}
      {id === 'printer' && <PrintCenter tasks={tasks} shopping={shopping} notify={setToast} initialType={printType} device={device} />}
      {id === 'settings' && <SettingsApp member={currentMember} onMemberChange={onMemberChange} preferences={preferences} setPreferences={setPreferences} items={members} setItems={setMembers} tasks={tasks} setTasks={setTasks} notify={setToast} device={device} refreshDevice={refreshDevice} />}
    </Window>)}</section>
    <nav className="dock" aria-label="Hauptnavigation"><button className="dock-home" onClick={event => { event.stopPropagation(); setLauncherOpen(!launcherOpen); }} aria-label="Weitere Apps"><Command size={20} /><span className="dock-label">Mehr</span></button><span className="dock-separator" />{Object.entries(APP_DEFS).map(([id, app]) => { const Icon = app.icon; const phonePrimary = ['today', 'tasks', 'shopping', 'messages'].includes(id); return <button key={id} className={`dock-app ${phonePrimary ? 'phone-primary' : 'phone-secondary'} ${focused === id ? 'focused' : ''}`} onClick={() => openApp(id)} style={{ '--app': app.color }} title={app.title} aria-current={focused === id ? 'page' : undefined}><Icon size={21} /><span className="dock-label">{id === 'meals' ? 'Essen' : app.title === 'Einstellungen' ? 'Setup' : app.title}</span>{id === 'messages' && messageUnreadCount > 0 && <b className="dock-badge">{messageUnreadCount > 9 ? '9+' : messageUnreadCount}</b>}{activeApps.includes(id) && <i />}</button>; })}</nav>
    {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={18} />{toast}</div>}
    {locked && !ringingTimers.length && <LockScreen time={time} device={device} tasks={tasks} mealPlans={mealPlans} progress={progress} users={authUsers} onUsersChanged={onUsersChanged} error={authError} setError={setAuthError} onAuthenticated={nextMember => nextMember.id === currentMember.id ? setLocked(false) : onMemberChange(nextMember)} />}
    {!!ringingTimers.length && <TimerAlarm timers={ringingTimers} onStop={removeTimer} />}
    {restartNotice && <RestartScreen title={restartNotice.title} message={restartNotice.message} targetVersion={restartNotice.targetVersion} />}
  </main>;
}

const CHAT_REACTIONS = ['❤️', '👍', '😂', '🥰', '🎉'];
const QUICK_MESSAGES = ['Bin gleich zu Hause 🏠', 'Bin gut angekommen ✨', 'Hab dich lieb ❤️', 'Braucht jemand etwas? 🛍️', 'Kannst du mich kurz anrufen? 📞'];
const prepareChatPhoto = file => new Promise((resolve, reject) => {
  if (!file?.type.startsWith('image/')) return reject(new Error('Bitte wähle ein Foto aus.'));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Dieses Bildformat wird nicht unterstützt.'));
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = .86; let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 1_850_000 && quality > .45) { quality -= .1; dataUrl = canvas.toDataURL('image/jpeg', quality); }
      if (dataUrl.length > 2_000_000) return reject(new Error('Das Foto ist auch nach dem Verkleinern noch zu groß.'));
      resolve(dataUrl);
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});
const prepareChatMedia = file => {
  if (file?.type !== 'image/gif') return prepareChatPhoto(file);
  return new Promise((resolve, reject) => {
    if (file.size > 4_000_000) return reject(new Error('Das GIF darf höchstens 4 MB groß sein.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Das GIF konnte nicht gelesen werden.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
};

function MessagesApp({ currentMember, notify }) {
  const requestedMember = new URLSearchParams(window.location.search).get('with');
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(requestedMember || 'family');
  const [messages, setMessages] = useState([]);
  const [typingMembers, setTypingMembers] = useState([]);
  const [presence, setPresence] = useState({ online: false, onlineCount: 0, lastSeenAt: null });
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [reactionMenu, setReactionMenu] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [lightbox, setLightbox] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const photoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingLimitRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    const response = await fetch('/api/messages/conversations', { cache: 'no-store' });
    if (!response.ok) throw new Error('Chats konnten nicht geladen werden.');
    const result = await response.json();
    const items = [result.family, ...(result.members || [])].filter(Boolean);
    setConversations(items);
    window.dispatchEvent(new CustomEvent('houseos:messages-unread', { detail: result.unreadCount || 0 }));
    setSelectedId(current => current && items.some(member => String(member.id) === String(current)) ? String(current) : (String(items[0]?.id || '') || null));
    return result;
  }, []);

  const loadMessages = useCallback(async (memberId, markRead = true) => {
    if (!memberId) { setMessages([]); return; }
    const response = await fetch(`/api/messages/${memberId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Nachrichten konnten nicht geladen werden.');
    const result = await response.json();
    setMessages(result.messages || []);
    setTypingMembers(result.typing || []);
    setPresence(result.presence || { online: false, onlineCount: 0, lastSeenAt: null });
    if (markRead) {
      await fetch(`/api/messages/${memberId}/read`, { method: 'POST' });
      await refreshConversations();
    }
  }, [refreshConversations]);

  useEffect(() => {
    let active = true;
    refreshConversations().catch(error => active && setError(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [currentMember.id, refreshConversations]);

  useEffect(() => {
    if (!selectedId) return;
    setError('');
    setReplyingTo(null);
    loadMessages(selectedId).catch(error => setError(error.message));
    const url = new URL(window.location.href); url.searchParams.set('app', 'messages'); url.searchParams.set('with', selectedId); window.history.replaceState({}, '', url);
    const interval = setInterval(() => loadMessages(selectedId, false).catch(() => {}), 1500);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages]);

  const postTyping = useCallback((typing, conversationId = selectedId) => {
    if (!conversationId) return;
    fetch('/api/messages/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ family: conversationId === 'family', recipientId: conversationId === 'family' ? undefined : Number(conversationId), typing }) }).catch(() => {});
  }, [selectedId]);

  useEffect(() => () => { clearTimeout(typingTimerRef.current); postTyping(false, selectedId); }, [selectedId, postTyping]);
  useEffect(() => () => {
    clearInterval(recordingTimerRef.current); clearTimeout(recordingLimitRef.current);
    if (mediaRecorderRef.current?.state === 'recording') { mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, selectedId, typingMembers.length]);

  const updateDraft = value => {
    setDraft(value); clearTimeout(typingTimerRef.current);
    if (!value.trim()) { postTyping(false); return; }
    postTyping(true);
    typingTimerRef.current = setTimeout(() => postTyping(false), 2_200);
  };

  const stopRecording = () => {
    clearInterval(recordingTimerRef.current); clearTimeout(recordingLimitRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecording(false);
  };
  const startRecording = async () => {
    if (recording) return stopRecording();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { audioInputRef.current?.click(); return; }
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); const chunks = [];
      recordingStreamRef.current = stream; mediaRecorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const plainType = String(recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks, { type: plainType });
        stream.getTracks().forEach(track => track.stop()); recordingStreamRef.current = null;
        if (!blob.size) return setError('Die Aufnahme ist leer. Bitte versuche es erneut.');
        if (blob.size > 5_000_000) return setError('Die Sprachnachricht darf höchstens 5 MB groß sein.');
        const reader = new FileReader(); reader.onerror = () => setError('Die Aufnahme konnte nicht vorbereitet werden.');
        reader.onload = () => setAttachment({ dataUrl: reader.result, name: 'Sprachnachricht', type: plainType, kind: 'audio' });
        reader.readAsDataURL(blob);
      };
      recorder.start(250); setAttachment(null); setRecordingSeconds(0); setRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(current => current + 1), 1_000);
      recordingLimitRef.current = setTimeout(stopRecording, 120_000);
    } catch { setError('Das Mikrofon konnte nicht geöffnet werden. Bitte erlaube den Zugriff in Chromium.'); }
  };

  const sendMessage = async event => {
    event?.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || !selectedId || sending || recording) return;
    clearTimeout(typingTimerRef.current); postTyping(false);
    setSending(true); setError('');
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: selectedId === 'family' ? undefined : Number(selectedId), family: selectedId === 'family', body, attachment: attachment?.dataUrl, replyTo: replyingTo ? { kind: replyingTo.kind, id: replyingTo.id } : undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nachricht konnte nicht gesendet werden.');
      setDraft(''); setAttachment(null); setReplyingTo(null); setMessages(current => [...current, result]); await refreshConversations();
    } catch (error) { setError(error.message); notify?.(error.message); }
    finally { setSending(false); }
  };

  const chooseMedia = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try { setAttachment({ dataUrl: await prepareChatMedia(file), name: file.name, type: file.type, kind: 'image' }); }
    catch (error) { setError(error.message); notify?.(error.message); }
  };
  const chooseAudio = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) return setError('Die Sprachnachricht darf höchstens 5 MB groß sein.');
    const type = ({ 'audio/x-m4a': 'audio/mp4', 'audio/mp3': 'audio/mpeg' })[file.type] || file.type;
    if (!['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'].includes(type)) return setError('Dieses Audioformat wird nicht unterstützt.');
    try {
      const blob = new Blob([await file.arrayBuffer()], { type }); const reader = new FileReader();
      reader.onerror = () => setError('Die Sprachnachricht konnte nicht gelesen werden.');
      reader.onload = () => setAttachment({ dataUrl: reader.result, name: file.name || 'Sprachnachricht', type, kind: 'audio' });
      reader.readAsDataURL(blob);
    } catch { setError('Die Sprachnachricht konnte nicht vorbereitet werden.'); }
  };
  const toggleReaction = async (message, emoji) => {
    try {
      const response = await fetch(`/api/messages/${message.kind}/${message.id}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Reaktion konnte nicht gespeichert werden.');
      setMessages(current => current.map(item => item.id === message.id ? { ...item, reactions: result.reactions } : item)); setReactionMenu(null);
    } catch (error) { notify?.(error.message); }
  };
  const saveEditedMessage = async () => {
    if (!editingMessage || editingMessage.saving) return;
    const body = editingMessage.body.trim();
    if (!body && !editingMessage.hasAttachment) return setError('Die Nachricht darf nicht leer sein.');
    setEditingMessage(current => ({ ...current, saving: true })); setError('');
    try {
      const response = await fetch(`/api/messages/${editingMessage.kind}/${editingMessage.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nachricht konnte nicht bearbeitet werden.');
      setMessages(current => current.map(item => item.kind === result.kind && item.id === result.id ? result : item));
      setEditingMessage(null); await refreshConversations(); notify?.('Nachricht bearbeitet');
    } catch (editError) { setError(editError.message); setEditingMessage(current => current ? { ...current, saving: false } : null); }
  };
  const deleteMessage = async message => {
    setMessageMenu(null);
    if (!window.confirm('Diese Nachricht wirklich löschen?')) return;
    try {
      const response = await fetch(`/api/messages/${message.kind}/${message.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nachricht konnte nicht gelöscht werden.');
      setMessages(current => current.filter(item => !(item.kind === message.kind && item.id === message.id)));
      if (editingMessage?.kind === message.kind && editingMessage?.id === message.id) setEditingMessage(null);
      await refreshConversations(); notify?.('Nachricht gelöscht');
    } catch (deleteError) { setError(deleteError.message); }
  };
  const selected = conversations.find(member => String(member.id) === String(selectedId));
  const formatMessageTime = value => new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const formatLastSeen = value => value ? new Date(value).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const latestOwnId = [...messages].reverse().find(message => message.senderId === currentMember.id)?.id;
  const typingLabel = typingMembers.length === 1 ? `${typingMembers[0].name} schreibt …` : typingMembers.length === 2 ? `${typingMembers[0].name} und ${typingMembers[1].name} schreiben …` : `${typingMembers.length} Personen schreiben …`;
  const presenceLabel = selected?.id === 'family' ? `${presence.onlineCount || 0} Familienmitglied${presence.onlineCount === 1 ? '' : 'er'} online` : presence.online ? 'Online' : presence.lastSeenAt ? `Zuletzt aktiv ${formatLastSeen(presence.lastSeenAt)}` : selected?.role;

  return <div className="messages-app">
    <aside className={`conversation-sidebar ${selected ? 'has-selection' : ''}`}>
      <header><span><MessageCircle size={22} /></span><div><h2>Chats</h2><p>Nachrichten im Haushalt</p></div></header>
      <div className="conversation-list">{conversations.map(member => <button key={member.id} className={String(selectedId) === String(member.id) ? 'selected' : ''} onClick={() => setSelectedId(String(member.id))}>
        <span className={`chat-avatar ${member.id === 'family' ? 'family-avatar' : ''}`} style={{ '--avatar': member.color }}>{member.id === 'family' ? <Users size={19} /> : initials(member.name)}</span>
        <span className="conversation-copy"><strong>{member.name}</strong><small>{member.lastMessage || member.role}</small></span>
        <span className="conversation-meta">{member.lastMessageAt && <time>{new Date(`${member.lastMessageAt.replace(' ', 'T')}Z`).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time>}{member.unreadCount > 0 && <b>{member.unreadCount}</b>}</span>
      </button>)}</div>
      {!loading && !conversations.length && <div className="chat-empty-small"><Users size={24} /><strong>Noch niemand da</strong><p>Lege in den Einstellungen ein weiteres Mitglied an.</p></div>}
    </aside>
    <section className={`chat-panel ${selected ? 'open' : ''}`}>
      {selected ? <>
        <header className="chat-header"><button className="chat-back" onClick={() => setSelectedId(null)} aria-label="Zurück zur Übersicht"><ChevronLeft size={22} /></button><span className={`chat-avatar ${selected.id === 'family' ? 'family-avatar' : ''}`} style={{ '--avatar': selected.color }}>{selected.id === 'family' ? <Users size={19} /> : initials(selected.name)}</span><span><strong>{selected.name}</strong><small className={presence.online ? 'chat-presence online-now' : 'chat-presence'}><i />{presenceLabel}</small></span></header>
        <div className="message-thread" aria-live="polite">{!messages.length && !loading && <div className="chat-welcome"><span className={`chat-avatar ${selected.id === 'family' ? 'family-avatar' : ''}`} style={{ '--avatar': selected.color }}>{selected.id === 'family' ? <Users size={22} /> : initials(selected.name)}</span><strong>{selected.id === 'family' ? 'Ein Chat für eure Lieblingsmenschen' : `Schreib ${selected.name} etwas Liebes`}</strong><p>{selected.id === 'family' ? 'Fotos, kleine Updates und liebe Grüße für alle.' : 'Diese Unterhaltung ist nur für euch beide sichtbar.'}</p></div>}{messages.map(message => {
          const own = message.senderId === currentMember.id;
          const mediaPlaceholder = message.attachmentType?.startsWith('audio/') ? '🎤 Sprachnachricht' : message.attachmentType === 'image/gif' ? 'GIF' : '📷 Foto';
          const showBody = message.body && !(message.attachmentUrl && message.body === mediaPlaceholder);
          return <div className={`message-row ${own ? 'own' : 'received'}`} key={`${message.kind}-${message.id}`}>
            <div className="message-bubble">{message.kind === 'family' && !own && <strong className="message-sender" style={{ color: message.senderColor }}>{message.senderName}</strong>}{message.reply && <blockquote className="message-reply-quote"><strong><Reply size={11} />{message.reply.senderName}</strong><span>{message.reply.body}</span></blockquote>}{message.attachmentUrl && message.attachmentType?.startsWith('audio/') ? <audio className="voice-message" controls preload="metadata" src={message.attachmentUrl}>Sprachnachricht</audio> : message.attachmentUrl && <button className="message-photo" onClick={() => setLightbox(message.attachmentUrl)} type="button"><img src={message.attachmentUrl} alt={message.attachmentType === 'image/gif' ? `GIF von ${message.senderName}` : `Foto von ${message.senderName}`} /></button>}{editingMessage?.kind === message.kind && editingMessage?.id === message.id ? <div className="message-editor"><textarea autoFocus maxLength={1000} value={editingMessage.body} onChange={event => setEditingMessage(current => ({ ...current, body: event.target.value }))} onKeyDown={event => { if (event.key === 'Escape') setEditingMessage(null); if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); saveEditedMessage(); } }} /><span><button type="button" onClick={() => setEditingMessage(null)}>Abbrechen</button><button type="button" disabled={editingMessage.saving} onClick={saveEditedMessage}>{editingMessage.saving ? 'Speichert …' : 'Speichern'}</button></span></div> : showBody && <p>{message.body}</p>}<span>{formatMessageTime(message.createdAt)}{message.editedAt ? ' · Bearbeitet' : ''}</span></div>
            <div className="message-reactions">{message.reactions?.map(item => <button type="button" className={item.reactedByMe ? 'mine' : ''} key={item.emoji} onClick={() => toggleReaction(message, item.emoji)}>{item.emoji}<b>{item.count}</b></button>)}<button type="button" className="reaction-add" onClick={() => setReactionMenu(reactionMenu === `${message.kind}-${message.id}` ? null : `${message.kind}-${message.id}`)} aria-label="Reaktion hinzufügen"><Smile size={13} /></button>{reactionMenu === `${message.kind}-${message.id}` && <span className="reaction-picker">{CHAT_REACTIONS.map(emoji => <button type="button" key={emoji} onClick={() => toggleReaction(message, emoji)}>{emoji}</button>)}</span>}<button type="button" className="message-reply-button" onClick={() => setReplyingTo({ kind: message.kind, id: message.id, senderName: message.senderName, body: showBody ? message.body : mediaPlaceholder })} aria-label="Auf Nachricht antworten"><Reply size={13} /></button>{own && <><button type="button" className="message-more" onClick={() => setMessageMenu(messageMenu === `${message.kind}-${message.id}` ? null : `${message.kind}-${message.id}`)} aria-label="Nachrichtenoptionen"><MoreHorizontal size={14} /></button>{messageMenu === `${message.kind}-${message.id}` && <span className="message-menu"><button type="button" onClick={() => { setEditingMessage({ kind: message.kind, id: message.id, body: showBody ? message.body : '', hasAttachment: Boolean(message.attachmentUrl), saving: false }); setMessageMenu(null); }}><Pencil size={13} /> Bearbeiten</button><button type="button" className="danger" onClick={() => deleteMessage(message)}><Trash2 size={13} /> Löschen</button></span>}</>}</div>
            {own && message.id === latestOwnId && <small className="read-receipt">{message.readAt ? 'Gelesen' : 'Gesendet'}</small>}
          </div>;
        })}{typingMembers.length > 0 && <div className="typing-indicator"><span><i /><i /><i /></span><small>{typingLabel}</small></div>}<div ref={endRef} /></div>
        <div className="quick-messages" aria-label="Schnellnachrichten">{QUICK_MESSAGES.map(text => <button type="button" key={text} onClick={() => updateDraft(text)}>{text}</button>)}</div>
        <form className="message-composer" onSubmit={sendMessage}>{replyingTo && <div className="reply-preview"><Reply size={15} /><span><strong>Antwort an {replyingTo.senderName}</strong><small>{replyingTo.body}</small></span><button type="button" onClick={() => setReplyingTo(null)} aria-label="Antwort verwerfen"><X size={14} /></button></div>}{recording && <div className="recording-preview"><i /><strong>Aufnahme läuft</strong><span>{String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}</span><small>Maximal 2 Minuten</small></div>}{attachment && <div className="photo-preview">{attachment.kind === 'audio' ? <audio controls preload="metadata" src={attachment.dataUrl}>Sprachnachricht</audio> : <img src={attachment.dataUrl} alt={attachment.type === 'image/gif' ? 'Ausgewähltes GIF' : 'Ausgewähltes Foto'} />}<span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Medium entfernen"><X size={14} /></button></div>}<input ref={photoInputRef} className="chat-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseMedia} /><input ref={audioInputRef} className="chat-photo-input" type="file" accept="audio/webm,audio/ogg,audio/mp4,audio/mpeg" capture="user" onChange={chooseAudio} /><button className="photo-button" type="button" disabled={recording} onClick={() => photoInputRef.current?.click()} aria-label="Foto oder GIF auswählen"><Camera size={19} /></button><button className={`voice-button ${recording ? 'recording' : ''}`} type="button" onClick={startRecording} aria-label={recording ? 'Aufnahme beenden' : 'Sprachnachricht aufnehmen'}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={19} />}</button><textarea value={draft} disabled={recording} onChange={event => updateDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} maxLength={1000} rows={1} placeholder={`Nachricht an ${selected.name} …`} /><button className="send-button" type="submit" disabled={(!draft.trim() && !attachment) || sending || recording} aria-label="Nachricht senden">{sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button></form>
      </> : <div className="chat-placeholder"><MessageCircle size={38} /><strong>Deine Nachrichten</strong><p>Wähle ein Haushaltsmitglied aus und sag kurz Hallo.</p></div>}
      {error && <p className="chat-error">{error}</p>}
    </section>
    {lightbox && <div className="chat-lightbox" role="dialog" aria-label="Fotoansicht" onClick={() => setLightbox('')}><button onClick={() => setLightbox('')} aria-label="Foto schließen"><X size={22} /></button><img src={lightbox} alt="Geteiltes Foto in Großansicht" onClick={event => event.stopPropagation()} /></div>}
  </div>;
}

function HousePet({ member, householdPoints }) {
  const [pet, setPet] = useState(() => loadPetState(member.id));
  const [menuOpen, setMenuOpen] = useState(false);
  const [reaction, setReaction] = useState({ message: '', action: 'idle', key: 0 });
  const [petNow, setPetNow] = useState(Date.now());
  const root = useRef(null); const reactionTimer = useRef(null); const actionTimer = useRef(null); const busyRef = useRef(0);
  useEffect(() => { const loaded = loadPetState(member.id); busyRef.current = loaded.busyUntil || 0; setPet(loaded); setPetNow(Date.now()); setMenuOpen(false); }, [member.id]);
  useEffect(() => { localStorage.setItem(`houseos.pet.${member.id}`, JSON.stringify(pet)); }, [member.id, pet]);
  useEffect(() => {
    const interval = setInterval(() => setPet(current => agePetState(current)), 60_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!pet.busyUntil) return;
    const tick = () => {
      const now = Date.now(); setPetNow(now);
      if (now >= pet.busyUntil) { busyRef.current = 0; setPet(current => ({ ...current, busyUntil: 0, busyType: '' })); }
    };
    const interval = setInterval(tick, 250); tick(); return () => clearInterval(interval);
  }, [pet.busyUntil]);
  useEffect(() => {
    const close = event => { if (!root.current?.contains(event.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => () => { clearTimeout(reactionTimer.current); clearTimeout(actionTimer.current); }, []);
  const level = petLevel(pet.xp);
  const busy = pet.busyUntil > petNow;
  const busySeconds = busy ? Math.max(1, Math.ceil((pet.busyUntil - petNow) / 1000)) : 0;
  const activityLabels = { feed: 'Bärli knabbert seinen Keks', cuddle: 'Bärli genießt die Kuscheleinheit', play: 'Bärli spielt gerade', dress: 'Bärli zieht sich um' };
  const unlocked = outfit => (!outfit.level || level >= outfit.level) && (!outfit.points || householdPoints >= outfit.points);
  const react = (message, action) => {
    clearTimeout(reactionTimer.current); clearTimeout(actionTimer.current);
    setReaction(current => ({ message, action, key: current.key + 1 }));
    actionTimer.current = setTimeout(() => setReaction(current => ({ ...current, action: 'idle' })), 900);
    reactionTimer.current = setTimeout(() => setReaction(current => ({ ...current, message: '' })), 3000);
  };
  const perform = action => {
    if (busyRef.current > Date.now() || pet.busyUntil > Date.now()) return react(`Einen Moment noch – Bärli ist noch ${Math.max(1, Math.ceil((Math.max(busyRef.current, pet.busyUntil) - Date.now()) / 1000))} Sek. beschäftigt.`, pet.busyType || 'hello');
    if (pet.sleeping && action !== 'sleep') return react('Pssst … ich schlafe gerade.', 'sleep');
    const actions = {
      feed: { duration: 6_000, message: 'Mmmh, lecker! Danke!', values: { fullness: 24, joy: 4, energy: 3, love: 2, xp: 5 } },
      cuddle: { duration: 5_000, message: `Kuscheln mit ${member.name}!`, values: { fullness: 0, joy: 14, energy: 2, love: 20, xp: 7 } },
      play: { duration: 8_000, message: 'Nochmal! Das macht Spaß!', values: { fullness: -8, joy: 25, energy: -12, love: 5, xp: 10 } },
    };
    if (action === 'sleep') {
      setPet(current => ({ ...agePetState(current), sleeping: !current.sleeping, sleepStarted: current.sleeping ? null : Date.now(), lastUpdated: Date.now() }));
      react(pet.sleeping ? 'Guten Morgen! Ich bin wieder wach.' : 'Gute Nacht … bis später.', pet.sleeping ? 'wake' : 'sleep');
      return;
    }
    const selected = actions[action]; if (!selected) return;
    const busyUntil = Date.now() + selected.duration; busyRef.current = busyUntil; setPetNow(Date.now());
    setPet(current => {
      const aged = agePetState(current); const values = selected.values;
      return { ...aged, fullness: clampPetValue(aged.fullness + values.fullness), joy: clampPetValue(aged.joy + values.joy), energy: clampPetValue(aged.energy + values.energy), love: clampPetValue(aged.love + values.love), xp: Math.max(0, aged.xp + values.xp), busyUntil, busyType: action, lastUpdated: Date.now() };
    });
    react(selected.message, action);
  };
  const chooseOutfit = outfit => {
    if (busyRef.current > Date.now() || pet.busyUntil > Date.now()) return react(`Bärli ist noch ${Math.max(1, Math.ceil((Math.max(busyRef.current, pet.busyUntil) - Date.now()) / 1000))} Sek. beschäftigt.`, pet.busyType || 'dress');
    if (!unlocked(outfit)) {
      const requirement = outfit.points ? `${outfit.points} Haushaltspunkte` : `Bärli-Level ${outfit.level}`;
      react(`Noch gesperrt: ${requirement}.`, 'no'); return;
    }
    const busyUntil = Date.now() + 1_000; busyRef.current = busyUntil; setPetNow(Date.now());
    setPet(current => {
      const currentOutfits = Array.isArray(current.outfits) ? current.outfits : [];
      const outfits = outfit.id === 'none' ? [] : currentOutfits.includes(outfit.id) ? currentOutfits.filter(id => id !== outfit.id) : [...currentOutfits, outfit.id];
      return { ...current, outfits, busyUntil, busyType: 'dress' };
    });
    react(outfit.id === 'none' ? 'Heute ganz natürlich!' : `${outfit.label} wird an- oder ausgezogen.`, 'dress');
  };
  const lowest = Math.min(pet.fullness, pet.joy, pet.energy, pet.love);
  const mood = pet.sleeping ? 'schläft' : lowest < 22 ? 'braucht dich' : lowest < 45 ? 'ein bisschen müde' : lowest > 85 ? 'überglücklich' : 'zufrieden';
  const stats = [
    { id: 'fullness', label: 'Satt', value: pet.fullness, icon: Cookie, color: '#ff9f0a' },
    { id: 'joy', label: 'Spaß', value: pet.joy, icon: Smile, color: '#af52de' },
    { id: 'energy', label: 'Energie', value: pet.energy, icon: BedDouble, color: '#5856d6' },
    { id: 'love', label: 'Liebe', value: pet.love, icon: Heart, color: '#ff2d55' },
  ];
  return <aside ref={root} className={`house-pet ${menuOpen ? 'menu-open' : ''} ${pet.sleeping ? 'sleeping' : ''}`} aria-label="HouseOS-Pet Bärli" onClick={event => event.stopPropagation()}>
    {reaction.message && <span className="house-pet-bubble" role="status" aria-live="polite">{reaction.message}</span>}
    {menuOpen && <section className="pet-context-menu" role="dialog" aria-label="Bärlis Pflege-Menü">
      <header><span className="pet-context-avatar"><PawPrint size={21} /></span><span><strong>Bärli</strong><small>Level {level} · {mood}</small></span><button aria-label="Bärli-Menü schließen" onClick={() => setMenuOpen(false)}><X size={15} /></button></header>
      {reaction.message && <p className="pet-menu-reaction" role="status">{reaction.message}</p>}
      {busy && <div className="pet-activity" role="status"><span><LoaderCircle size={13} />{activityLabels[pet.busyType] || 'Bärli ist beschäftigt'}</span><b>{busySeconds} Sek.</b><i><em style={{ width: `${Math.max(4, 100 - busySeconds / ({ feed: 6, cuddle: 5, play: 8, dress: 1 }[pet.busyType] || busySeconds) * 100)}%` }} /></i></div>}
      <div className="pet-level"><span><Star size={12} /> Freundschaft</span><b>{pet.xp % 45} / 45 XP</b><i><em style={{ width: `${pet.xp % 45 / 45 * 100}%` }} /></i></div>
      <div className="pet-stats">{stats.map(stat => { const StatIcon = stat.icon; return <div key={stat.id} title={`${stat.label}: ${stat.value}%`}><span><StatIcon size={13} style={{ color: stat.color }} />{stat.label}<b>{stat.value}%</b></span><i><em style={{ width: `${stat.value}%`, background: stat.color }} /></i></div>; })}</div>
      <div className="pet-actions">
        <button onClick={() => perform('feed')} disabled={pet.sleeping || busy}><Cookie size={18} /><span><strong>Füttern</strong><small>{busy && pet.busyType === 'feed' ? `Noch ${busySeconds} Sek.` : 'Dauert 6 Sek.'}</small></span></button>
        <button onClick={() => perform('cuddle')} disabled={pet.sleeping || busy}><Heart size={18} /><span><strong>Kuscheln</strong><small>{busy && pet.busyType === 'cuddle' ? `Noch ${busySeconds} Sek.` : 'Dauert 5 Sek.'}</small></span></button>
        <button onClick={() => perform('play')} disabled={pet.sleeping || busy}><Gamepad2 size={18} /><span><strong>Spielen</strong><small>{busy && pet.busyType === 'play' ? `Noch ${busySeconds} Sek.` : 'Dauert 8 Sek.'}</small></span></button>
        <button className={pet.sleeping ? 'wake' : ''} disabled={busy} onClick={() => perform('sleep')}><BedDouble size={18} /><span><strong>{pet.sleeping ? 'Aufwecken' : 'Schlafen'}</strong><small>{pet.sleeping ? 'Guten Morgen' : busy ? 'Bitte warten' : 'Energie tanken'}</small></span></button>
      </div>
      <div className="pet-wardrobe"><header><span><Shirt size={14} /> Anziehen</span><small><Gift size={12} /> mehrere kombinierbar</small></header><div>{PET_OUTFITS.map(outfit => { const selected = outfit.id === 'none' ? !pet.outfits?.length : pet.outfits?.includes(outfit.id); const OutfitIcon = outfit.icon; return <button key={outfit.id} disabled={busy} className={selected ? 'selected' : ''} onClick={() => chooseOutfit(outfit)} aria-pressed={selected} aria-label={`${outfit.label}${unlocked(outfit) ? '' : ' gesperrt'}`}><span><OutfitIcon size={19} /></span><small>{outfit.label}</small>{!unlocked(outfit) && <Lock size={10} />}</button>; })}</div></div>
      <p className="pet-task-hint"><Trophy size={12} /> {householdPoints} Haushaltspunkte · Erledigte Aufgaben schalten Extras frei.</p>
    </section>}
    <button type="button" className={`pet-touch-target action-${reaction.action} ${busy ? 'busy' : ''}`} onClick={() => { setMenuOpen(value => !value); if (!menuOpen) react(PET_MESSAGES(member.name)[reaction.key % PET_MESSAGES(member.name).length], 'hello'); }} aria-label={menuOpen ? 'Bärli-Menü schließen' : 'Bärli-Menü öffnen'} title="Bärli antippen">
      <span className="pet-shadow" />
      <span className={`pet-bear ${(pet.outfits || []).map(id => `outfit-${id}`).join(' ')}`} aria-hidden="true">
        <i className="pet-ear left" /><i className="pet-ear right" />
        <i className="pet-body"><b /></i>
        <i className="pet-arm left" /><i className="pet-arm right" />
        <i className="pet-leg left" /><i className="pet-leg right" />
        <i className="pet-head"><b className="pet-eye left" /><b className="pet-eye right" /><b className="pet-muzzle"><em /></b></i>
        {(pet.outfits || []).filter(id => id !== 'pajamas').map(id => <i className={`pet-accessory ${id}`} key={id} />)}
        {reaction.action === 'feed' && <Cookie className="pet-effect snack" size={20} />}{reaction.action === 'cuddle' && <Heart className="pet-effect hearts" size={21} fill="currentColor" />}{reaction.action === 'play' && <Star className="pet-effect stars" size={21} fill="currentColor" />}
      </span>
      {pet.sleeping && <span className="pet-sleep-symbol">Zzz</span>}
      <span className="pet-name">Bärli · Lv. {level}</span>
      {lowest < 35 && !pet.sleeping && <span className="pet-needs-dot" />}
    </button>
  </aside>;
}

function AmbientScreen({ time, device, tasks, mealPlans, progress, locked = false }) {
  const thought = THOUGHTS[time.getDate() % THOUGHTS.length];
  const upcoming = tasks.filter(task => !task.done).slice(0, 3);
  const leaders = progress.members.slice(0, 3);
  return <section className="ambient-screen" aria-label={locked ? 'Ruhe- und Sperrbildschirm' : 'Ambient-Modus'}>
    <div className="ambient-screen-orb one" /><div className="ambient-screen-orb two" />
    <header><span><Home size={17} /> houseos</span><small>{locked ? 'HouseOS ist gesperrt' : 'Zum Fortfahren Bildschirm berühren'}</small></header>
    <div className="ambient-clock"><strong>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong><span>{time.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div className="ambient-dashboard">
      <article className="ambient-weather"><CloudSun size={30} /><div><strong>{Number.isFinite(device.weather?.temperature) ? `${Math.round(device.weather.temperature)}°` : '–°'}</strong><span>{device.location} · {device.weather ? weatherText(device.weather.code) : 'Wetter wird geladen'}</span></div></article>
      <article><header><ListTodo size={18} /><strong>Als Nächstes</strong></header>{upcoming.map(task => <p key={task.id}><i style={{ '--person': progress.members.find(member => member.name === task.person)?.color }} /><span><strong>{task.text}</strong><small>{task.person} · {taskSchedule(task)}</small></span></p>)}{!upcoming.length && <div className="ambient-empty"><CheckCircle2 size={20} /> Für heute ist alles geschafft.</div>}</article>
      <article><header><Trophy size={18} /><strong>Haushaltspunkte</strong><b>{progress.householdPoints}</b></header>{leaders.map((member, index) => <p key={member.id}><em>{index + 1}</em><span><strong>{member.name}</strong><small>{member.streak ? `${member.streak} Wochen in Serie` : `${member.completedTasks} Aufgaben erledigt`}</small></span><b>{member.points}</b></p>)}</article>
    </div>
    <WeeklyMealOverview items={mealPlans} ambient />
    <blockquote>„{thought}“</blockquote>
  </section>;
}

function LockScreen({ time, device, tasks, mealPlans, progress, users, onAuthenticated, onUsersChanged, error, setError }) {
  const [availableUsers, setAvailableUsers] = useState(users);
  const [entering, setEntering] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStart = useRef(null);
  const dragOffsetRef = useRef(0);
  const refresh = async () => {
    await onUsersChanged();
    try { const response = await fetch('/api/auth/users', { cache: 'no-store' }); if (response.ok) setAvailableUsers(await response.json()); } catch {}
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const fallback = window.setTimeout(() => setEntering(false), 550);
    return () => window.clearTimeout(fallback);
  }, []);
  const moveSurface = offset => { dragOffsetRef.current = offset; setDragOffset(offset); };
  const startDrag = event => {
    if (entering || revealed) return;
    dragStart.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const dragSurface = event => {
    if (dragStart.current === null || revealed) return;
    moveSurface(Math.max(-window.innerHeight, Math.min(0, event.clientY - dragStart.current)));
  };
  const finishDrag = () => {
    if (dragStart.current === null) return;
    const shouldReveal = -dragOffsetRef.current > Math.min(150, window.innerHeight * .18);
    dragStart.current = null;
    setDragging(false);
    moveSurface(0);
    setRevealed(shouldReveal);
  };
  return <section className="session-lock" aria-label="HouseOS ist gesperrt">
    {!entering && <LoginScreen users={availableUsers} onAuthenticated={onAuthenticated} onUsersChanged={refresh} error={error} setError={setError} embedded onDismiss={() => { setRevealed(false); setError(''); }} />}
    <div className={`session-lock-surface ${entering ? 'entering' : ''} ${dragging ? 'dragging' : ''} ${revealed ? 'revealed' : ''}`} style={revealed || entering ? undefined : { transform: `translateY(${dragOffset}px)` }} role="button" tabIndex="0" aria-label="Sperrbildschirm nach oben ziehen" onAnimationEnd={() => setEntering(false)} onPointerDown={startDrag} onPointerMove={dragSurface} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={event => { if (!entering && event.key === 'ArrowUp') { event.preventDefault(); setRevealed(true); } }}>
      <AmbientScreen time={time} device={device} tasks={tasks} mealPlans={mealPlans} progress={progress} locked />
      <div className="ambient-unlock-hint" aria-hidden="true"><i /><span>Zum Anmelden nach oben ziehen</span><ChevronUp size={17} /></div>
    </div>
  </section>;
}

function KitchenTimers({ timers, now, onAdd, onPause, onResume, onRemove }) {
  const [label, setLabel] = useState(''); const [minutes, setMinutes] = useState(5); const [seconds, setSeconds] = useState(0);
  const submit = event => { event.preventDefault(); const duration = Number(minutes || 0) * 60 + Number(seconds || 0); if (duration < 1) return; onAdd(duration, label); setLabel(''); };
  const presets = [1,3,5,10,15,30];
  return <div className="app-page timer-page"><div className="app-heading"><div><span className="eyebrow">KÜCHENHELFER</span><h2>Timer</h2><p>Mehrere Zeiten gleichzeitig im Blick behalten.</p></div><span className={`timer-count ${timers.length ? 'active' : ''}`}><Clock3 size={18} />{timers.length} aktiv</span></div>
    <section className="timer-create-card"><div className="timer-presets">{presets.map(value => <button key={value} onClick={() => onAdd(value * 60, label || `${value}-Minuten-Timer`)}><strong>{value}</strong><small>Min.</small></button>)}</div>
      <form className="timer-custom" onSubmit={submit}><input className="timer-label-input" value={label} onChange={event => setLabel(event.target.value)} placeholder="Wofür? z. B. Nudeln" /><label><span>Minuten</span><input type="number" inputMode="numeric" min="0" max="999" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><label><span>Sekunden</span><input type="number" inputMode="numeric" min="0" max="59" value={seconds} onChange={event => setSeconds(event.target.value)} /></label><button className="primary"><Plus size={17} /> Timer starten</button></form>
    </section>
    <section className="timer-list">{timers.map(timer => { const remaining = timer.status === 'paused' ? timer.remaining : timer.status === 'ringing' ? 0 : Math.max(0, timer.endAt - now); const progress = timer.duration ? Math.max(0, Math.min(100, remaining / timer.duration * 100)) : 0; return <article className={`timer-card ${timer.status}`} key={timer.id}><div className="timer-card-icon">{timer.status === 'ringing' ? <Bell size={23} /> : <Clock3 size={23} />}</div><div className="timer-card-main"><span><strong>{timer.label}</strong><small>{timer.status === 'paused' ? 'Pausiert' : timer.status === 'ringing' ? 'Abgelaufen' : `Fertig um ${new Date(timer.endAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}</small></span><b>{formatTimer(remaining)}</b><div className="timer-progress"><i style={{ width: `${progress}%` }} /></div></div><div className="timer-card-actions">{timer.status === 'running' && <button onClick={() => onPause(timer.id)} aria-label={`${timer.label} pausieren`}><Pause size={18} /></button>}{timer.status === 'paused' && <button onClick={() => onResume(timer.id)} aria-label={`${timer.label} fortsetzen`}><Play size={18} /></button>}<button className="timer-remove" onClick={() => onRemove(timer.id)} aria-label={`${timer.label} löschen`}><X size={18} /></button></div></article>; })}{!timers.length && <div className="timer-empty"><Clock3 size={35} /><strong>Noch kein Timer aktiv</strong><p>Wähle oben eine Schnellzeit oder stelle eine eigene Zeit ein.</p></div>}</section>
  </div>;
}

function TimerAlarm({ timers, onStop }) {
  const stopAll = () => timers.forEach(timer => onStop(timer.id));
  return <section className="timer-alarm" role="alertdialog" aria-modal="true" aria-live="assertive"><div className="timer-alarm-bell"><Bell size={38} /></div><span>TIMER ABGELAUFEN</span><h2>{timers[0].label}</h2>{timers.length > 1 && <p>und {timers.length - 1} weitere Timer</p>}<button onClick={stopAll}><Check size={22} /> Bimmel stoppen</button></section>;
}

function DesktopIcon({ app, onClick }) { const Icon = app.icon; return <button className="desktop-icon" onClick={onClick}><span style={{ '--app': app.color }}><Icon size={25} /></span><small>{app.title}</small></button>; }

function Launcher({ onOpen, onClose, currentMember, isPhone = false }) {
  const [query, setQuery] = useState('');
  const matches = Object.entries(APP_DEFS).filter(([, app]) => `${app.title} ${app.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="launcher" onClick={event => event.stopPropagation()}>
    <div className="launcher-head"><div><small>HOUSEOS</small><h2>Was möchtest du tun?</h2></div><button onClick={onClose}><X size={18} /></button></div>
    <label className="search"><Search size={17} /><input autoFocus={!isPhone} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && matches.length) onOpen(matches[0][0]); }} placeholder="Apps und Aktionen suchen …" /></label>
    <div className="launcher-grid">{matches.map(([id, app]) => { const Icon = app.icon; return <button key={id} onClick={() => onOpen(id)}><span style={{ '--app': app.color }}><Icon size={22} /></span><p>{app.title}</p><ChevronRight size={16} /></button>; })}</div>
    {!matches.length && <div className="launcher-empty"><Search size={20} /><strong>Keine Treffer</strong><small>Versuche einen anderen Suchbegriff.</small></div>}
    <div className="launcher-footer"><ProfileAvatar className="avatar profile-image" member={currentMember} /><span><strong>{currentMember.name}</strong><small>{currentMember.role}</small></span><span className="online">Angemeldet</span></div>
  </div>;
}

const POINTER_SCROLL_SURFACES = '.meal-ingredient-list, .recipe-edit-section, .meal-editor, .task-editor-sheet, .event-editor-sheet, .recipe-editor-sheet, .recipe-detail-sheet, .ical-sheet, .settings-detail, .settings-sidebar, .receipt-wrap, .window-content';

function usePointerScroll() {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const findSurface = target => {
    let surface = target.closest?.(POINTER_SCROLL_SURFACES);
    while (surface && surface.scrollHeight <= surface.clientHeight + 1) surface = surface.parentElement?.closest?.(POINTER_SCROLL_SURFACES);
    return surface;
  };
  const onPointerDown = event => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    const surface = findSurface(event.target);
    if (!surface) return;
    gesture.current = { pointerId: event.pointerId, surface, startX: event.clientX, startY: event.clientY, scrollTop: surface.scrollTop, dragging: false };
  };
  const onPointerMove = event => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.startX; const deltaY = event.clientY - current.startY;
    if (!current.dragging) {
      if (Math.abs(deltaY) < 7 || Math.abs(deltaY) <= Math.abs(deltaX)) return;
      current.dragging = true; suppressClick.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      current.surface.classList.add('drag-scrolling');
    }
    event.preventDefault();
    current.surface.scrollTop = current.scrollTop - deltaY;
  };
  const finish = event => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.surface.classList.remove('drag-scrolling');
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = null;
    if (current.dragging) setTimeout(() => { suppressClick.current = false; }, 250);
  };
  const onClickCapture = event => {
    if (!suppressClick.current) return;
    event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
  };
  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, onClickCapture };
}

const loadWindowState = (memberId, id) => {
  const offset = Object.keys(APP_DEFS).indexOf(id); const fallback = { pos: { x: offset * 24, y: offset * 18 }, mode: 'normal' };
  try {
    const saved = JSON.parse(localStorage.getItem(`houseos.window.${memberId}.${id}`));
    const mode = ['normal', 'left', 'right', 'maximized'].includes(saved?.mode) ? saved.mode : fallback.mode;
    const pos = Number.isFinite(saved?.pos?.x) && Number.isFinite(saved?.pos?.y) ? saved.pos : fallback.pos;
    return { pos, mode };
  } catch { return fallback; }
};

function Window({ id, workspaceKey, app, children, onClose, onMinimize, onFocus, focused, minimized, z }) {
  const initialState = useMemo(() => loadWindowState(workspaceKey, id), [workspaceKey, id]);
  const [pos, setPos] = useState(initialState.pos);
  const [mode, setMode] = useState(initialState.mode); const [snapTarget, setSnapTarget] = useState(null); const snapTargetRef = useRef(null); const dragging = useRef(null); const Icon = app.icon;
  const pointerScroll = usePointerScroll();
  useEffect(() => {
    const timer = setTimeout(() => localStorage.setItem(`houseos.window.${workspaceKey}.${id}`, JSON.stringify({ pos, mode })), 120);
    return () => clearTimeout(timer);
  }, [workspaceKey, id, pos, mode]);
  const detectSnapTarget = event => event.clientX <= 46 ? 'left' : event.clientX >= window.innerWidth - 46 ? 'right' : event.clientY <= 58 ? 'maximized' : null;
  const startDrag = event => { if (window.innerWidth < 780 || event.target.closest('.window-controls')) return; let dragPos = pos; if (mode !== 'normal') { const rect = event.currentTarget.closest('.window').getBoundingClientRect(); const normalWidth = Math.min(1020, window.innerWidth - 180); const normalHeight = Math.min(700, window.innerHeight - 130); const layerCenterY = 38 + (window.innerHeight - 38 - 74) / 2; const grabX = Math.max(80, Math.min(200, event.clientX - rect.left)); dragPos = { x: event.clientX - grabX + normalWidth / 2 - window.innerWidth / 2, y: Math.max(46, event.clientY - 25) + normalHeight / 2 - layerCenterY }; setMode('normal'); setPos(dragPos); } dragging.current = { x: event.clientX - dragPos.x, y: event.clientY - dragPos.y }; event.currentTarget.setPointerCapture(event.pointerId); };
  const moveDrag = event => { if (!dragging.current) return; setPos({ x: event.clientX - dragging.current.x, y: event.clientY - dragging.current.y }); const target = detectSnapTarget(event); snapTargetRef.current = target; setSnapTarget(target); };
  const finishDrag = event => { if (!dragging.current) return; const target = detectSnapTarget(event) || snapTargetRef.current; if (target) { setMode(target); setPos({ x: 0, y: 0 }); } setSnapTarget(null); snapTargetRef.current = null; dragging.current = null; };
  const cancelDrag = () => { setSnapTarget(null); snapTargetRef.current = null; dragging.current = null; };
  const toggleMaximize = () => { setMode(value => value === 'maximized' ? 'normal' : 'maximized'); setPos({ x: 0, y: 0 }); };
  const expanded = mode !== 'normal';
  return <>{snapTarget && <div className={`snap-preview snap-${snapTarget}`}><span>{snapTarget === 'left' ? 'Links anordnen' : snapTarget === 'right' ? 'Rechts anordnen' : 'Maximieren'}</span></div>}<article data-app={id} data-window-mode={mode} className={`window mode-${mode} ${focused ? 'focused-window' : 'inactive-window'} ${minimized ? 'minimized' : ''}`} onPointerDown={onFocus} style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: z }}>
    <div className="titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onDoubleClick={toggleMaximize}><div className="window-controls" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}><button className="control-close" onClick={onClose} aria-label="Fenster schließen"><X size={9} /></button><button className="control-minimize" onClick={onMinimize} aria-label="Fenster minimieren"><Minus size={9} /></button><button className="control-zoom" onClick={toggleMaximize} aria-label={expanded ? 'Fenster wiederherstellen' : 'Fenster maximieren'}>{expanded ? <Minimize2 size={8} /> : <Maximize2 size={8} />}</button></div><div className="window-title"><span style={{ '--app': app.color }}><Icon size={16} /></span><strong>{app.title}</strong></div><div className="titlebar-spacer" /></div>
    <div className="window-content" {...pointerScroll}>{children}</div></article></>;
}

function Today({ tasks, events, shopping, mealPlans, onOpen, onPrint, time, device, member, progress }) {
  const openTasks = tasks.filter(task => !task.done); const items = shopping.filter(item => !item.checked);
  const todayLabel = time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase();
  const thought = useMemo(() => THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)], [todayLabel]);
  const weather = device.weather;
  const todayValue = localDateValue();
  const upcomingEvents = Array.from({ length: 31 }, (_, index) => shiftDateValue(todayValue, index)).flatMap(date => eventsForDate(events || [], date).map(event => ({ ...event, occurrenceDate: date }))).slice(0, 3);
  return <div className="app-page today-page"><div className="app-heading"><div><span className="eyebrow">{todayLabel}</span><h2>{greeting(time.getHours())}, {member.name}!</h2><p>Hier ist dein Überblick für heute.</p></div><button className="primary" onClick={onPrint}><Printer size={17} /> Tagesbon</button></div>
    <div className="metric-grid"><div className={`weather-card ${weather ? '' : 'weather-pending'}`}><div><CloudSun size={34} /><span>{device.location}</span></div><strong>{Number.isFinite(weather?.temperature) ? `${Math.round(weather.temperature)}°` : '–°'}</strong><p>{weather ? `${weatherText(weather.code)} · ${Math.round(weather.minimum)}–${Math.round(weather.maximum)} °C · gefühlt ${Math.round(weather.apparentTemperature)} °C` : device.status === 'denied' ? 'Standortfreigabe für Wetter erforderlich' : 'Wetter wird geladen …'}</p></div>
      <div className="metric-card"><span className="icon-soft orange"><Clock3 size={20} /></span><div><small>LOKALE ZEIT</small><strong>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong><p>{device.timezone}</p></div></div>
      <div className="metric-card"><span className="icon-soft green"><MapPin size={20} /></span><div><small>STANDORT</small><strong>{device.location}</strong><p>{device.status === 'ready' ? 'Vom Gerät ermittelt' : 'Zum Aktualisieren oben tippen'}</p></div></div></div>
    <ProgressStrip progress={progress} />
    <section className="today-calendar-card"><header><div><CalendarDays size={19} /><strong>Nächste Familientermine</strong></div><button onClick={() => onOpen('calendar')}>Kalender öffnen <ChevronRight size={15} /></button></header><div>{upcomingEvents.map(event => <article key={`${event.id}-${event.occurrenceDate}`}><i style={{ '--event-color': event.color }} /><time>{event.occurrenceDate === todayValue ? 'Heute' : new Date(`${event.occurrenceDate}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}<small>{eventTimeLabel(event)}</small></time><span><strong>{event.title}</strong><small>{event.location || event.participants?.join(', ') || 'Familie'}</small></span></article>)}{!upcomingEvents.length && <p>In den nächsten 30 Tagen sind noch keine Termine eingetragen.</p>}</div></section>
    <WeeklyMealOverview items={mealPlans} onOpen={() => onOpen('meals')} />
    <div className="two-columns"><section className="content-card"><header><div><ListTodo size={19} /><strong>Offene Aufgaben</strong></div><button onClick={() => onOpen('tasks')}>Alle anzeigen <ChevronRight size={15} /></button></header><div className="compact-list">{openTasks.slice(0, 3).map(task => <div key={task.id}><Circle size={17} /><span><strong>{task.text}</strong><small>{task.person} · {taskSchedule(task)}</small></span></div>)}{!openTasks.length && <div className="compact-empty">Alles erledigt.</div>}</div></section>
      <section className="content-card"><header><div><ShoppingBasket size={19} /><strong>Einkaufsliste</strong></div><button onClick={() => onOpen('shopping')}>Öffnen <ChevronRight size={15} /></button></header><div className="shopping-summary"><strong>{items.length}</strong><span>Artikel<br />stehen noch aus</span><div>{items.slice(0, 3).map(item => <i key={item.id}>{item.text.slice(0, 1)}</i>)}</div></div></section></div>
    <div className="thought"><Sparkles size={18} /><span><small>GEDANKE DES TAGES</small>„{thought}“</span></div></div>;
}

const awardIcon = icon => icon === 'flame' ? Flame : icon === 'trophy' ? Trophy : icon === 'award' ? Award : Sparkles;
function ProgressStrip({ progress, compact = false }) {
  const current = progress.currentMember;
  const latestAward = current?.awards?.at(-1);
  const AwardIcon = awardIcon(latestAward?.icon);
  return <section className={`progress-strip ${compact ? 'compact' : ''}`}><div><span className="points-icon"><Trophy size={18} /></span><span><small>DEINE PUNKTE</small><strong>{current?.points || 0}</strong></span></div><div><span className="streak-icon"><Flame size={18} /></span><span><small>WOCHEN-SERIE</small><strong>{current?.streak || 0} {current?.streak === 1 ? 'Woche' : 'Wochen'}</strong></span></div><div className="progress-award"><span><AwardIcon size={18} /></span><span><small>AUSZEICHNUNG</small><strong>{latestAward?.title || 'Noch offen'}</strong></span></div><b>{progress.householdPoints || 0}<small> Punkte gemeinsam</small></b></section>;
}

const CATEGORY_SUGGESTIONS = ['Backwaren', 'Drogerie', 'Frühstück', 'Getränke', 'Gemüse', 'Haushalt', 'Kühlregal', 'Obst', 'Tiefkühl', 'Vorrat'];
function Shopping({ items, setItems, catalog, setCatalog, savedDishes, onPrint, notify }) {
  const [value, setValue] = useState(''); const [quantity, setQuantity] = useState('1 Stück'); const [category, setCategory] = useState('Sonstiges'); const [showSuggestions, setShowSuggestions] = useState(true);
  const categoryRank = name => { const index = CATEGORY_SUGGESTIONS.indexOf(name); return index < 0 ? 999 : index; };
  const sortedItems = [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || categoryRank(a.category) - categoryRank(b.category) || a.text.localeCompare(b.text, 'de'));
  const recipeProducts = (savedDishes || []).flatMap(dish => dish.ingredients || []).map(ingredient => ({ id: `recipe-${ingredient.name}`, text: ingredient.name, quantity: ingredient.quantity, category: 'Speiseplan', favorite: false, usageCount: 0 }));
  const suggestions = [...catalog, ...recipeProducts].filter((product, index, all) => all.findIndex(item => item.text.toLocaleLowerCase('de-DE') === product.text.toLocaleLowerCase('de-DE')) === index).sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 10);
  const remember = product => {
    const known = catalog.find(item => item.text.toLocaleLowerCase('de-DE') === product.text.toLocaleLowerCase('de-DE'));
    const entry = { id: known?.id || Date.now(), text: product.text, quantity: product.quantity || '1 Stück', category: product.category || 'Sonstiges', favorite: known?.favorite || false, usageCount: (known?.usageCount || 0) + 1 };
    setCatalog([...catalog.filter(item => item.id !== known?.id), entry]);
  };
  const addProduct = product => {
    const text = String(product.text || '').trim(); if (!text) return;
    const existing = items.find(item => item.text.toLocaleLowerCase('de-DE') === text.toLocaleLowerCase('de-DE') && !item.checked);
    if (existing) { setItems(items.map(item => item.id === existing.id ? { ...item, quantity: product.quantity || item.quantity, category: product.category || item.category } : item)); notify(`${text} steht bereits auf der Liste`); }
    else { setItems([...items, { id: Date.now(), text, checked: false, category: product.category || 'Sonstiges', quantity: product.quantity || '1 Stück' }]); notify(`${text} hinzugefügt`); }
    remember({ ...product, text }); setValue(''); setQuantity('1 Stück');
  };
  const add = event => { event.preventDefault(); addProduct({ text: value, quantity, category: category.trim() || 'Sonstiges' }); };
  const toggleFavorite = product => {
    const known = catalog.find(item => item.text.toLocaleLowerCase('de-DE') === product.text.toLocaleLowerCase('de-DE'));
    const entry = { id: known?.id || Date.now(), text: product.text, quantity: product.quantity || '1 Stück', category: product.category || 'Sonstiges', favorite: !known?.favorite, usageCount: known?.usageCount || 0 };
    setCatalog([...catalog.filter(item => item.id !== known?.id), entry]);
  };
  const toggleChecked = item => setItems(items.map(candidate => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate));
  const openCount = items.filter(item => !item.checked).length; const checkedCount = items.length - openCount;
  return <div className="app-page shopping-assistant-page"><div className="app-heading"><div><span className="eyebrow">EINKAUFSASSISTENT</span><h2>{openCount} Artikel fehlen</h2><p>Favoriten, Rezeptzutaten und eine automatisch sortierte Einkaufsliste.</p></div><button className="primary" onClick={onPrint}><Printer size={17} /> Liste drucken</button></div><form className="add-form shopping-add-form" onSubmit={add}><ShoppingBasket size={18} /><input list="shopping-product-history" value={value} onChange={event => setValue(event.target.value)} placeholder="Was fehlt noch?" /><datalist id="shopping-product-history">{suggestions.map(item => <option key={item.id} value={item.text} />)}</datalist><input className="shopping-quantity-input" aria-label="Menge" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="Menge" /><div className="category-input"><Tag size={14} /><input list="shopping-categories" value={category} onChange={event => setCategory(event.target.value)} placeholder="Kategorie" /><datalist id="shopping-categories">{CATEGORY_SUGGESTIONS.map(item => <option key={item} value={item} />)}</datalist></div><button>Hinzufügen</button></form>
    <section className="shopping-suggestions"><header><span><Sparkles size={16} /><strong>Schnell hinzufügen</strong></span><button onClick={() => setShowSuggestions(value => !value)}>{showSuggestions ? 'Ausblenden' : 'Anzeigen'}</button></header>{showSuggestions && <div>{suggestions.map(product => <article key={product.id}><button className={product.favorite ? 'favorite active' : 'favorite'} onClick={() => toggleFavorite(product)} aria-label={`${product.text} als Favorit markieren`}><Star size={13} fill={product.favorite ? 'currentColor' : 'none'} /></button><span><strong>{product.text}</strong><small>{product.quantity || product.category}</small></span><button className="quick-add" onClick={() => addProduct(product)}><Plus size={14} /></button></article>)}{!suggestions.length && <p>Deine häufig gekauften Artikel erscheinen nach dem ersten Einkauf hier.</p>}</div>}</section>
    <div className="shopping-list-head"><span><strong>Nach Abteilung sortiert</strong><small>{checkedCount} von {items.length} erledigt</small></span>{checkedCount > 0 && <button onClick={() => { setItems(items.filter(item => !item.checked)); notify('Erledigte Artikel entfernt'); }}><Trash2 size={13} /> Erledigte entfernen</button>}</div>
    <div className="full-list shopping-list assistant-list">{sortedItems.map(item => {
      const product = catalog.find(entry => entry.text.toLocaleLowerCase('de-DE') === item.text.toLocaleLowerCase('de-DE'));
      return <div className={item.checked ? 'done' : ''} key={item.id}><button className="check" onClick={() => toggleChecked(item)}>{item.checked && <Check size={14} />}</button><button className={`row-favorite ${product?.favorite ? 'active' : ''}`} onClick={() => toggleFavorite({ ...item, favorite: product?.favorite })}><Star size={13} fill={product?.favorite ? 'currentColor' : 'none'} /></button><span><strong>{item.text}</strong><small>{item.category}</small></span><input className="shopping-row-quantity" aria-label={`Menge für ${item.text}`} value={item.quantity || '1 Stück'} onChange={event => setItems(items.map(candidate => candidate.id === item.id ? { ...candidate, quantity: event.target.value } : candidate))} /><button className="delete" onClick={() => setItems(items.filter(candidate => candidate.id !== item.id))}><Trash2 size={16} /></button></div>;
    })}{!items.length && <div className="shopping-empty"><ShoppingBasket size={25} /><span><strong>Die Liste ist leer</strong><small>Nutze deine Favoriten oder füge einen Artikel hinzu.</small></span></div>}</div></div>;
}

const WEEKDAYS = [{ id: 1, label: 'Mo' }, { id: 2, label: 'Di' }, { id: 3, label: 'Mi' }, { id: 4, label: 'Do' }, { id: 5, label: 'Fr' }, { id: 6, label: 'Sa' }, { id: 7, label: 'So' }];
const newTaskDraft = person => ({ id: null, text: '', notes: '', person, dueDate: localDateValue(), time: '', recurrence: 'none', recurrenceInterval: 1, recurrenceDays: [1, 2, 3, 4, 5], rotation: [], checklist: [], points: 10, done: false });

function Tasks({ items, setItems, members, currentMember, progress, notify }) {
  const [filter, setFilter] = useState('open'); const [query, setQuery] = useState(''); const [editor, setEditor] = useState(null);
  const openEditor = task => setEditor(task ? { ...newTaskDraft(currentMember.name), ...task, checklist: (task.checklist || []).map(entry => ({ ...entry })), rotation: [...(task.rotation || [])], recurrenceDays: [...(task.recurrenceDays || [])] } : newTaskDraft(currentMember.name));
  const save = event => {
    event.preventDefault(); if (!editor.text.trim()) return;
    const next = { ...editor, id: editor.id || Date.now(), text: editor.text.trim(), notes: editor.notes.trim(), checklist: editor.checklist.map(entry => ({ ...entry, text: entry.text.trim() })).filter(entry => entry.text), seriesId: editor.seriesId || (editor.recurrence !== 'none' ? `series-${editor.id || Date.now()}` : '') };
    setItems([...items.filter(item => item.id !== editor.id), next]); setEditor(null); notify(editor.id ? 'Aufgabe aktualisiert' : (next.recurrence === 'none' ? 'Aufgabe hinzugefügt' : 'Routine angelegt'));
  };
  const toggle = task => {
    if (!task.done && task.checklist?.length && task.checklist.some(entry => !entry.done)) return notify('Bitte zuerst alle Schritte der Checkliste erledigen');
    setItems(items.map(item => item.id === task.id ? { ...item, done: !item.done } : item));
    if (!task.done && task.recurrence !== 'none') notify('Erledigt – die nächste Routine wird automatisch geplant');
  };
  const toggleChecklist = (task, entryId) => setItems(items.map(item => item.id === task.id ? { ...item, checklist: (item.checklist || []).map(entry => entry.id === entryId ? { ...entry, done: !entry.done } : entry) } : item));
  const remove = (task, series = false) => { setItems(items.filter(item => series && task.seriesId ? item.seriesId !== task.seriesId : item.id !== task.id)); setEditor(null); notify(series ? 'Routine entfernt' : 'Aufgabe entfernt'); };
  const visible = items.filter(item => filter === 'open' ? !item.done : filter === 'done' ? item.done : filter === 'routines' ? item.recurrence !== 'none' : true).filter(item => `${item.text} ${item.person} ${item.notes || ''}`.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE')));
  const openCount = items.filter(item => !item.done).length; const routineCount = items.filter(item => !item.done && item.recurrence !== 'none').length;
  return <div className="app-page tasks-v2-page"><div className="app-heading"><div><span className="eyebrow">AUFGABEN & ROUTINEN</span><h2>Gemeinsam erledigen</h2><p>{openCount} offen · {routineCount} aktive Routinen</p></div><button className="primary" onClick={() => openEditor()}><Plus size={17} /> Neue Aufgabe</button></div>
    <ProgressStrip progress={progress} compact />
    <div className="task-toolbar"><div className="segmented-control">{[['open','Offen'],['routines','Routinen'],['done','Erledigt'],['all','Alle']].map(([id, label]) => <button className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div><label><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Aufgaben durchsuchen" /></label></div>
    <div className="task-v2-list">{visible.map(task => { const overdue = !task.done && task.dueDate && task.dueDate < localDateValue(); const doneSteps = (task.checklist || []).filter(entry => entry.done).length; return <article className={`${task.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`} key={task.id}><button className="task-check" onClick={() => toggle(task)} aria-label={task.done ? 'Wieder öffnen' : 'Erledigen'}>{task.done && <Check size={15} />}</button><div className="task-v2-copy"><header><strong>{task.text}</strong>{task.recurrence !== 'none' && <span className="routine-badge"><Repeat2 size={11} />{repeatLabel[task.recurrence]}</span>}</header><p>{task.person || 'Nicht zugewiesen'} · {taskSchedule(task)} · {task.points || 10} Punkte</p>{task.notes && <small>{task.notes}</small>}{task.checklist?.length > 0 && <div className="task-checklist">{task.checklist.map(entry => <button className={entry.done ? 'done' : ''} key={entry.id} onClick={() => toggleChecklist(task, entry.id)}><i>{entry.done && <Check size={9} />}</i>{entry.text}</button>)}<em>{doneSteps}/{task.checklist.length}</em></div>}</div><button className="task-edit" onClick={() => openEditor(task)} aria-label={`${task.text} bearbeiten`}><Pencil size={15} /></button></article>; })}{!visible.length && <div className="task-empty"><CheckCircle2 size={28} /><strong>Nichts zu tun</strong><span>Für diese Ansicht sind keine Aufgaben vorhanden.</span></div>}</div>
    {editor && <div className="sheet-backdrop" onPointerDown={event => event.target === event.currentTarget && setEditor(null)}><form className="task-editor-sheet" onSubmit={save}><header><div><span className="eyebrow">{editor.id ? 'AUFGABE BEARBEITEN' : 'NEU PLANEN'}</span><h3>{editor.id ? editor.text : 'Neue Aufgabe oder Routine'}</h3></div><button type="button" onClick={() => setEditor(null)}><X size={18} /></button></header><label className="wide"><span>Titel</span><input autoFocus value={editor.text} onChange={event => setEditor({ ...editor, text: event.target.value })} placeholder="Was soll erledigt werden?" /></label><div className="editor-grid"><label><span>Zuständig</span><select value={editor.person} onChange={event => setEditor({ ...editor, person: event.target.value })}>{members.map(member => <option key={member.id}>{member.name}</option>)}</select></label><label><span>Fällig am</span><input type="date" value={editor.dueDate} onChange={event => setEditor({ ...editor, dueDate: event.target.value })} /></label><label><span>Uhrzeit</span><input type="time" value={editor.time} onChange={event => setEditor({ ...editor, time: event.target.value })} /></label><label><span>Punkte</span><input type="number" min="0" max="100" value={editor.points} onChange={event => setEditor({ ...editor, points: Number(event.target.value) })} /></label></div><label className="wide"><span>Notiz</span><textarea value={editor.notes} onChange={event => setEditor({ ...editor, notes: event.target.value })} placeholder="Details oder Hinweise" /></label><section className="routine-options"><div><strong><Repeat2 size={15} /> Wiederholung</strong><select value={editor.recurrence} onChange={event => setEditor({ ...editor, recurrence: event.target.value })}><option value="none">Einmalig</option><option value="daily">Täglich</option><option value="weekdays">Bestimmte Wochentage</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option></select></div>{editor.recurrence !== 'none' && editor.recurrence !== 'weekdays' && <label><span>Alle</span><input type="number" min="1" max="30" value={editor.recurrenceInterval} onChange={event => setEditor({ ...editor, recurrenceInterval: Number(event.target.value) })} /><span>{editor.recurrence === 'daily' ? 'Tage' : editor.recurrence === 'weekly' ? 'Wochen' : 'Monate'}</span></label>}{editor.recurrence === 'weekdays' && <div className="weekday-picker">{WEEKDAYS.map(day => <button type="button" className={editor.recurrenceDays.includes(day.id) ? 'active' : ''} key={day.id} onClick={() => setEditor({ ...editor, recurrenceDays: editor.recurrenceDays.includes(day.id) ? editor.recurrenceDays.filter(id => id !== day.id) : [...editor.recurrenceDays, day.id] })}>{day.label}</button>)}</div>} {editor.recurrence !== 'none' && <div className="rotation-picker"><span>Zuständigkeit rotieren</span>{members.map(member => <button type="button" className={editor.rotation.includes(member.name) ? 'active' : ''} key={member.id} onClick={() => setEditor({ ...editor, rotation: editor.rotation.includes(member.name) ? editor.rotation.filter(name => name !== member.name) : [...editor.rotation, member.name] })}><i style={{ '--member': member.color }}>{editor.rotation.includes(member.name) && <Check size={9} />}</i>{member.name}</button>)}</div>}</section><section className="checklist-editor"><header><span><strong>Checkliste</strong><small>Die Aufgabe kann erst abgeschlossen werden, wenn alle Schritte erledigt sind.</small></span><button type="button" onClick={() => setEditor({ ...editor, checklist: [...editor.checklist, { id: `${Date.now()}-${editor.checklist.length}`, text: '', done: false }] })}><Plus size={13} /> Schritt</button></header>{editor.checklist.map((entry, index) => <div key={entry.id}><span>{index + 1}</span><input value={entry.text} onChange={event => setEditor({ ...editor, checklist: editor.checklist.map(item => item.id === entry.id ? { ...item, text: event.target.value } : item) })} placeholder="Arbeitsschritt" /><button type="button" onClick={() => setEditor({ ...editor, checklist: editor.checklist.filter(item => item.id !== entry.id) })}><Trash2 size={14} /></button></div>)}</section><footer>{editor.id && <button type="button" className="danger" onClick={() => remove(editor, editor.recurrence !== 'none')}>{editor.recurrence !== 'none' ? 'Routine löschen' : 'Löschen'}</button>}<button type="button" onClick={() => setEditor(null)}>Abbrechen</button><button className="primary" disabled={!editor.text.trim()}><Check size={15} /> Speichern</button></footer></form></div>}
  </div>;
}

const CALENDAR_COLORS = ['#0a84ff', '#30b67a', '#ff9f0a', '#af52de', '#ff375f', '#5e5ce6'];
const newEventDraft = date => ({ id: null, title: '', description: '', startDate: date, startTime: '09:00', endDate: date, endTime: '10:00', allDay: false, location: '', participants: [], color: '#0a84ff', recurrence: 'none', reminderMinutes: 30 });

function FamilyCalendar({ items, setItems, members, notify }) {
  const [month, setMonth] = useState(() => localDateValue().slice(0, 7) + '-01'); const [selected, setSelected] = useState(localDateValue()); const [editor, setEditor] = useState(null);
  const [icalOpen, setIcalOpen] = useState(false); const [icalInfo, setIcalInfo] = useState(null); const [icalBusy, setIcalBusy] = useState(''); const [icalMessage, setIcalMessage] = useState(''); const icalFileInput = useRef(null);
  const monthDate = new Date(`${month}T12:00:00`); const firstWeekday = monthDate.getDay() || 7; const gridStart = shiftDateValue(month, 1 - firstWeekday);
  const days = Array.from({ length: 42 }, (_, index) => shiftDateValue(gridStart, index)); const selectedEvents = eventsForDate(items, selected);
  const openEditor = (date = selected, event = null) => setEditor(event ? { ...event, participants: [...(event.participants || [])] } : newEventDraft(date));
  const save = event => { event.preventDefault(); if (!editor.title.trim()) return; const value = { ...editor, id: editor.id || Date.now(), title: editor.title.trim(), description: editor.description.trim(), location: editor.location.trim(), endDate: editor.endDate < editor.startDate ? editor.startDate : editor.endDate }; setItems([...items.filter(item => item.id !== editor.id), value]); setSelected(value.startDate); setMonth(`${value.startDate.slice(0, 7)}-01`); setEditor(null); notify(editor.id ? 'Termin aktualisiert' : 'Termin eingetragen'); };
  const remove = () => { setItems(items.filter(item => item.id !== editor.id)); setEditor(null); notify('Termin entfernt'); };
  const loadIcalInfo = async () => { setIcalOpen(true); setIcalBusy('load'); setIcalMessage(''); try { const response = await fetch('/api/calendar/ical/settings', { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setIcalInfo(result); } catch (error) { setIcalMessage(error.message || 'Die iCal-Einstellungen konnten nicht geladen werden.'); } finally { setIcalBusy(''); } };
  const copyFeedUrl = async () => { if (!icalInfo?.feedUrl) return; try { try { await navigator.clipboard.writeText(icalInfo.feedUrl); } catch { const field = document.createElement('textarea'); field.value = icalInfo.feedUrl; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove(); } setIcalMessage('Abo-Link kopiert.'); notify('iCal-Abo-Link kopiert'); } catch { setIcalMessage('Der Link konnte nicht kopiert werden.'); } };
  const importIcal = async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setIcalBusy('import'); setIcalMessage(''); try { const content = await file.text(); const response = await fetch('/api/calendar/ical/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, sourceName: file.name }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setItems(result.items); if (result.firstDate) { setSelected(result.firstDate); setMonth(`${result.firstDate.slice(0, 7)}-01`); } setIcalInfo(current => ({ ...current, eventCount: result.items.length, importedCount: result.importedCount })); const summary = [result.imported && `${result.imported} neu`, result.updated && `${result.updated} aktualisiert`, result.removed && `${result.removed} entfernt`, result.unchanged && `${result.unchanged} unverändert`].filter(Boolean).join(', ') || 'keine Änderungen'; setIcalMessage(`${file.name}: ${summary}.`); notify(`iCal importiert: ${summary}`); } catch (error) { setIcalMessage(error.message || 'Die iCal-Datei konnte nicht importiert werden.'); } finally { setIcalBusy(''); } };
  const rotateFeedUrl = async () => { if (!window.confirm('Der bisherige Abo-Link funktioniert danach nicht mehr. Neuen Link erstellen?')) return; setIcalBusy('rotate'); setIcalMessage(''); try { const response = await fetch('/api/calendar/ical/token', { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setIcalInfo(current => ({ ...current, feedUrl: result.feedUrl })); setIcalMessage('Ein neuer geschützter Abo-Link wurde erstellt.'); } catch (error) { setIcalMessage(error.message || 'Der Abo-Link konnte nicht erneuert werden.'); } finally { setIcalBusy(''); } };
  return <div className="app-page family-calendar-page"><div className="app-heading"><div><span className="eyebrow">FAMILIENKALENDER</span><h2>{monthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h2><p>Alle Termine der Familie an einem Ort.</p></div><div className="calendar-heading-actions"><button className="calendar-ical-button" onClick={loadIcalInfo}><Link2 size={16} /> iCal</button><button className="primary" onClick={() => openEditor()}><Plus size={17} /> Neuer Termin</button></div></div><div className="calendar-controls"><button aria-label="Vorheriger Monat" onClick={() => setMonth(shiftMonthValue(month, -1))}><ChevronLeft size={18} /></button><button onClick={() => { setMonth(localDateValue().slice(0, 7) + '-01'); setSelected(localDateValue()); }}>Heute</button><button aria-label="Nächster Monat" onClick={() => setMonth(shiftMonthValue(month, 1))}><ChevronRight size={18} /></button></div><div className="calendar-layout"><section className="month-calendar"><header>{WEEKDAYS.map(day => <span key={day.id}>{day.label}</span>)}</header><div>{days.map(day => { const dayEvents = eventsForDate(items, day); return <button className={`${day.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''} ${day === localDateValue() ? 'today' : ''} ${day === selected ? 'selected' : ''}`} key={day} onClick={() => setSelected(day)} onDoubleClick={() => openEditor(day)}><time>{Number(day.slice(-2))}</time><span>{dayEvents.slice(0, 3).map(event => <i style={{ '--event-color': event.color }} key={event.id}>{!event.allDay && event.startTime ? `${event.startTime} ` : ''}{event.title}</i>)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3} weitere</small>}</span></button>; })}</div></section><aside className="calendar-agenda"><header><span>{new Date(`${selected}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long' })}</span><strong>{new Date(`${selected}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}</strong><button onClick={() => openEditor(selected)}><Plus size={15} /></button></header><div>{selectedEvents.map(event => <button className="agenda-event" key={event.id} onClick={() => openEditor(selected, event)}><i style={{ '--event-color': event.color }} /><time>{eventTimeLabel(event)}</time><span><strong>{event.title}</strong><small>{event.location || event.participants?.join(', ') || 'Familie'}</small></span><ChevronRight size={14} /></button>)}{!selectedEvents.length && <div className="agenda-empty"><CalendarDays size={25} /><span>Noch keine Termine</span><button onClick={() => openEditor(selected)}>Termin hinzufügen</button></div>}</div></aside></div>
    {icalOpen && <div className="sheet-backdrop" onPointerDown={event => event.target === event.currentTarget && !icalBusy && setIcalOpen(false)}><section className="ical-sheet" role="dialog" aria-modal="true" aria-labelledby="ical-title"><header><div><span className="eyebrow">KALENDER VERBINDEN</span><h3 id="ical-title">iCal für HouseOS</h3><p>Termine importieren oder den Familienkalender auf anderen Geräten abonnieren.</p></div><button type="button" onClick={() => setIcalOpen(false)} disabled={Boolean(icalBusy)}><X size={18} /></button></header>{icalBusy === 'load' && !icalInfo ? <div className="ical-loading"><LoaderCircle className="spin" size={24} /> iCal-Einstellungen werden geladen …</div> : <div className="ical-options"><article><i><Link2 size={20} /></i><div><h4>Familienkalender abonnieren</h4><p>Diesen geschützten Link in Apple Kalender, Google Kalender oder Outlook als Kalender-Abo hinzufügen.</p><div className="ical-url"><input readOnly value={icalInfo?.feedUrl || ''} aria-label="iCal-Abo-Link" /><button type="button" onClick={copyFeedUrl} disabled={!icalInfo?.feedUrl}><Copy size={14} /> Kopieren</button></div><div className="ical-option-actions"><a href="/api/calendar/ical/download" download><Download size={14} /> .ics herunterladen</a>{icalInfo?.canRotate && <button type="button" onClick={rotateFeedUrl} disabled={Boolean(icalBusy)}><RefreshCw className={icalBusy === 'rotate' ? 'spin' : ''} size={13} /> Link erneuern</button>}</div><small>Der Link enthält einen geheimen Zugriffsschlüssel. Teile ihn nur mit Personen, die den Familienkalender sehen dürfen.</small></div></article><article><i><Upload size={20} /></i><div><h4>iCal-Datei importieren</h4><p>Importiert `.ics`-Dateien. Bereits importierte Termine werden anhand ihrer UID aktualisiert statt doppelt angelegt.</p><input ref={icalFileInput} hidden type="file" accept=".ics,text/calendar" onChange={importIcal} /><button type="button" className="ical-import-button" onClick={() => icalFileInput.current?.click()} disabled={Boolean(icalBusy)}>{icalBusy === 'import' ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} {icalBusy === 'import' ? 'Wird importiert …' : '.ics-Datei auswählen'}</button><small>{icalInfo?.eventCount || 0} Termine in HouseOS · {icalInfo?.importedCount || 0} über iCal verbunden</small></div></article></div>}{icalMessage && <p className="ical-feedback">{icalMessage}</p>}<footer><button type="button" onClick={() => setIcalOpen(false)} disabled={Boolean(icalBusy)}>Fertig</button></footer></section></div>}
    {editor && <div className="sheet-backdrop" onPointerDown={event => event.target === event.currentTarget && setEditor(null)}><form className="event-editor-sheet" onSubmit={save}><header><div><span className="eyebrow">FAMILIENTREFFPUNKT</span><h3>{editor.id ? 'Termin bearbeiten' : 'Neuer Termin'}</h3></div><button type="button" onClick={() => setEditor(null)}><X size={18} /></button></header><label className="wide"><span>Titel</span><input autoFocus value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} placeholder="z. B. Zahnarzt, Geburtstag oder Ausflug" /></label><label className="all-day-switch"><input type="checkbox" checked={editor.allDay} onChange={event => setEditor({ ...editor, allDay: event.target.checked })} /><span>Ganztägig</span></label><div className="editor-grid"><label><span>Beginn</span><input type="date" value={editor.startDate} onChange={event => setEditor({ ...editor, startDate: event.target.value, endDate: editor.endDate === editor.startDate ? event.target.value : editor.endDate })} /></label>{!editor.allDay && <label><span>Uhrzeit</span><input type="time" value={editor.startTime} onChange={event => setEditor({ ...editor, startTime: event.target.value })} /></label>}<label><span>Ende</span><input type="date" value={editor.endDate} onChange={event => setEditor({ ...editor, endDate: event.target.value })} /></label>{!editor.allDay && <label><span>Bis</span><input type="time" value={editor.endTime} onChange={event => setEditor({ ...editor, endTime: event.target.value })} /></label>}<label><span>Wiederholung</span><select value={editor.recurrence} onChange={event => setEditor({ ...editor, recurrence: event.target.value })}><option value="none">Einmalig</option><option value="daily">Täglich</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option><option value="yearly">Jährlich</option></select></label><label><span>Erinnerung</span><select value={editor.reminderMinutes} onChange={event => setEditor({ ...editor, reminderMinutes: Number(event.target.value) })}><option value="0">Keine</option><option value="10">10 Minuten vorher</option><option value="30">30 Minuten vorher</option><option value="60">1 Stunde vorher</option><option value="1440">1 Tag vorher</option><option value="10080">1 Woche vorher</option></select></label></div><label className="wide"><span><MapPin size={13} /> Ort</span><input value={editor.location} onChange={event => setEditor({ ...editor, location: event.target.value })} placeholder="Optionaler Treffpunkt" /></label><div className="event-participants"><span><Users size={13} /> Teilnehmer</span><div>{members.map(member => <button type="button" className={editor.participants.includes(member.name) ? 'active' : ''} key={member.id} onClick={() => setEditor({ ...editor, participants: editor.participants.includes(member.name) ? editor.participants.filter(name => name !== member.name) : [...editor.participants, member.name] })}><i style={{ '--member': member.color }}>{editor.participants.includes(member.name) && <Check size={9} />}</i>{member.name}</button>)}</div></div><div className="event-color-picker"><span>Farbe</span>{CALENDAR_COLORS.map(color => <button type="button" aria-label={`Farbe ${color}`} className={editor.color === color ? 'active' : ''} style={{ '--event-color': color }} key={color} onClick={() => setEditor({ ...editor, color })} />)}</div><label className="wide"><span>Notiz</span><textarea value={editor.description} onChange={event => setEditor({ ...editor, description: event.target.value })} placeholder="Weitere Informationen" /></label><footer>{editor.id && <button type="button" className="danger" onClick={remove}>Löschen</button>}<button type="button" onClick={() => setEditor(null)}>Abbrechen</button><button className="primary" disabled={!editor.title.trim()}><Check size={15} /> Speichern</button></footer></form></div>}
  </div>;
}

const scaleQuantityLabel = (label, factor) => {
  if (!Number.isFinite(factor) || factor === 1) return label;
  return String(label || '').replace(/^\s*(\d+(?:[.,]\d+)?)/, (_match, number) => {
    const value = Number(number.replace(',', '.')) * factor;
    return String(Math.round(value * 100) / 100).replace('.', ',');
  });
};

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Frühstück', icon: Sun },
  { id: 'lunch', label: 'Mittagessen', icon: Utensils },
  { id: 'dinner', label: 'Abendessen', icon: Moon },
];
function WeeklyMealOverview({ items = [], onOpen, ambient = false }) {
  const weekStart = weekStartValue();
  const days = Array.from({ length: 7 }, (_, index) => shiftDateValue(weekStart, index));
  const weekEnd = days.at(-1);
  const range = `${new Date(`${weekStart}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${new Date(`${weekEnd}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`;
  return <section className={`weekly-meal-overview ${ambient ? 'ambient-weekly-meals' : ''}`}><header><div><Utensils size={17} /><span><strong>Speiseplan dieser Woche</strong><small>{range}</small></span></div>{onOpen && <button onClick={onOpen}>Plan öffnen <ChevronRight size={14} /></button>}</header><div className="weekly-meal-scroll"><div className="weekly-meal-grid">{days.map(date => {
    const day = new Date(`${date}T12:00:00`);
    return <article className={date === localDateValue() ? 'today' : ''} key={date}><header><span>{day.toLocaleDateString('de-DE', { weekday: 'short' })}</span><b>{day.getDate()}</b></header>{MEAL_TYPES.map(type => {
      const meal = items.find(item => item.date === date && item.mealType === type.id);
      return <p className={meal ? 'planned' : ''} key={type.id} title={`${type.label}: ${meal?.name || 'Noch frei'}`}><i className={type.id} /><span>{meal?.name || (ambient ? '–' : 'Noch frei')}</span></p>;
    })}</article>;
  })}</div></div></section>;
}
function LegacyMealPlanner({ items, setItems, savedDishes, setSavedDishes, shopping, setShopping, notify, hubNav }) {
  const [weekStart, setWeekStart] = useState(() => weekStartValue());
  const [editor, setEditor] = useState(null);
  const days = Array.from({ length: 7 }, (_, index) => shiftDateValue(weekStart, index));
  const openEditor = (date, mealType, meal = null) => {
    const savedDish = meal ? savedDishes.find(dish => dish.name.toLocaleLowerCase('de-DE') === meal.name.toLocaleLowerCase('de-DE')) : null;
    setEditor({ id: meal?.id || null, savedDishId: savedDish?.id || '', date, mealType, name: meal?.name || '', servings: meal?.servings || savedDish?.servings || 2, ingredients: meal?.ingredients?.length ? meal.ingredients.map(ingredient => ({ ...ingredient })) : [{ name: '', quantity: '1 Stück' }] });
  };
  const updateIngredient = (index, key, value) => setEditor(current => ({ ...current, ingredients: current.ingredients.map((ingredient, ingredientIndex) => ingredientIndex === index ? { ...ingredient, [key]: value } : ingredient) }));
  const selectSavedDish = value => {
    const dish = savedDishes.find(candidate => String(candidate.id) === String(value));
    if (!dish) return setEditor(current => ({ ...current, savedDishId: '', name: '', servings: 2, ingredients: [{ name: '', quantity: '1 Stück' }] }));
    setEditor(current => ({ ...current, savedDishId: dish.id, name: dish.name, servings: dish.servings || 2, ingredients: dish.ingredients.length ? dish.ingredients.map(ingredient => ({ ...ingredient })) : [{ name: '', quantity: '1 Stück' }] }));
  };
  const saveMeal = event => {
    event.preventDefault();
    if (!editor.name.trim()) return;
    const ingredients = editor.ingredients.map(ingredient => ({ name: ingredient.name.trim(), quantity: ingredient.quantity.trim() || '1 Stück' })).filter(ingredient => ingredient.name);
    const meal = { id: editor.id || Date.now(), date: editor.date, mealType: editor.mealType, name: editor.name.trim(), servings: editor.servings || 2, ingredients };
    const knownDish = savedDishes.find(dish => dish.id === editor.savedDishId || dish.name.toLocaleLowerCase('de-DE') === meal.name.toLocaleLowerCase('de-DE'));
    const savedDish = { id: knownDish?.id || Date.now(), name: meal.name, ingredients, servings: meal.servings, steps: knownDish?.steps || [], prepMinutes: knownDish?.prepMinutes || 0, category: knownDish?.category || 'Hauptgericht', favorite: knownDish?.favorite || false };
    setItems([...items.filter(item => item.id !== editor.id && !(item.date === editor.date && item.mealType === editor.mealType)), meal]);
    setSavedDishes([...savedDishes.filter(dish => dish.id !== savedDish.id), savedDish]);
    setEditor(null);
    notify(`${meal.name} wurde gespeichert und eingeplant`);
  };
  const deleteMeal = () => { if (!editor?.id) return; setItems(items.filter(item => item.id !== editor.id)); setEditor(null); notify('Gericht aus dem Speiseplan entfernt'); };
  const addIngredients = mealOrMeals => {
    const meals = Array.isArray(mealOrMeals) ? mealOrMeals : [mealOrMeals];
    const ingredients = meals.flatMap(meal => meal.ingredients || []);
    if (!ingredients.length) return notify('Für diese Auswahl sind noch keine Zutaten eingetragen');
    const next = shopping.map(item => ({ ...item }));
    let added = 0;
    for (const ingredient of ingredients) {
      const existingIndex = next.findIndex(item => item.text.trim().toLocaleLowerCase('de-DE') === ingredient.name.trim().toLocaleLowerCase('de-DE'));
      if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], checked: false, quantity: ingredient.quantity || next[existingIndex].quantity || '1 Stück' };
      else { next.push({ id: Date.now() + added, text: ingredient.name, quantity: ingredient.quantity || '1 Stück', category: 'Speiseplan', checked: false }); added += 1; }
    }
    setShopping(next);
    notify(added ? `${added} Zutaten auf die Einkaufsliste gesetzt` : 'Zutaten auf der Einkaufsliste aktualisiert');
  };
  const weekEnd = days.at(-1);
  const plannedThisWeek = items.filter(item => item.date >= weekStart && item.date <= weekEnd);
  const weekTitle = `${new Date(`${weekStart}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${new Date(`${weekEnd}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  return <div className="app-page meal-planner-page"><div className="app-heading meal-planner-heading"><div><span className="eyebrow">WOCHENPLAN</span><h2>Speiseplan</h2><p>Frühstück, Mittag- und Abendessen gemeinsam planen.</p></div><div className="meal-heading-actions">{hubNav}<button className="week-shopping" disabled={!plannedThisWeek.length} onClick={() => addIngredients(plannedThisWeek)}><ShoppingBasket size={14} /> Wocheneinkauf</button><div className="meal-week-controls"><button aria-label="Vorherige Woche" onClick={() => setWeekStart(shiftDateValue(weekStart, -7))}><ChevronLeft size={18} /></button><button className="meal-today-button" onClick={() => setWeekStart(weekStartValue())}>Diese Woche</button><button aria-label="Nächste Woche" onClick={() => setWeekStart(shiftDateValue(weekStart, 7))}><ChevronRight size={18} /></button></div></div></div>
    <div className="meal-week-title"><CalendarDays size={18} /><strong>{weekTitle}</strong></div>
    <div className="meal-week-scroll"><div className="meal-week-grid">{days.map(date => {
      const day = new Date(`${date}T12:00:00`); const isToday = date === localDateValue();
      return <section className={`meal-day ${isToday ? 'today' : ''}`} key={date}><header><span>{day.toLocaleDateString('de-DE', { weekday: 'short' })}</span><strong>{day.getDate()}</strong><small>{day.toLocaleDateString('de-DE', { month: 'short' })}</small></header>{MEAL_TYPES.map(type => {
        const meal = items.find(item => item.date === date && item.mealType === type.id); const TypeIcon = type.icon;
        return meal ? <article className={`meal-slot filled ${type.id}`} key={type.id}><div><span><TypeIcon size={14} />{type.label}</span><button aria-label={`${meal.name} bearbeiten`} onClick={() => openEditor(date, type.id, meal)}><MoreHorizontal size={16} /></button></div><strong>{meal.name}</strong><small>{meal.servings || 2} Portionen · {meal.ingredients?.length || 0} Zutaten</small><button className="meal-shopping-button" onClick={() => addIngredients(meal)}><ShoppingBasket size={13} /> Auf Liste</button></article> : <button className={`meal-slot empty ${type.id}`} key={type.id} onClick={() => openEditor(date, type.id)}><span><TypeIcon size={14} />{type.label}</span><Plus size={17} /><small>Gericht planen</small></button>;
      })}</section>;
    })}</div></div>
    {editor && <div className="meal-editor-backdrop" onPointerDown={event => event.target === event.currentTarget && setEditor(null)}><form className="meal-editor" onSubmit={saveMeal}><header><div><span className="eyebrow">GERICHT PLANEN</span><h3>{MEAL_TYPES.find(type => type.id === editor.mealType)?.label} · {new Date(`${editor.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</h3></div><button type="button" aria-label="Editor schließen" onClick={() => setEditor(null)}><X size={18} /></button></header><label className="meal-saved-select"><span>Gespeicherte Speise auswählen</span><select aria-label="Gespeicherte Speise auswählen" value={editor.savedDishId} onChange={event => selectSavedDish(event.target.value)}><option value="">Neue Speise erstellen</option>{savedDishes.map(dish => <option key={dish.id} value={dish.id}>{dish.name}</option>)}</select><small>{savedDishes.length ? `${savedDishes.length} Speisen gespeichert` : 'Noch keine Speise gespeichert'}</small></label><label><span>Name des Gerichts</span><input value={editor.name} onChange={event => setEditor(current => ({ ...current, savedDishId: '', name: event.target.value }))} placeholder="z. B. Gemüse-Curry" /></label><label className="meal-servings"><span>Portionen</span><input type="number" min="1" max="24" value={editor.servings || 2} onChange={event => setEditor(current => { const servings = Math.max(1, Number(event.target.value) || 1); const factor = servings / (current.servings || 2); return { ...current, servings, ingredients: current.ingredients.map(ingredient => ({ ...ingredient, quantity: scaleQuantityLabel(ingredient.quantity, factor) })) }; })} /></label><div className="meal-ingredients-head"><span><strong>Zutaten</strong><small>Mit der benötigten Menge</small></span><button type="button" data-preserve-keyboard onClick={() => setEditor(current => ({ ...current, ingredients: [...current.ingredients, { name: '', quantity: '1 Stück' }] }))}><Plus size={14} /> Zutat</button></div><div className="meal-ingredient-list">{editor.ingredients.map((ingredient, index) => <div key={index}><input aria-label={`Zutat ${index + 1}`} value={ingredient.name} onChange={event => updateIngredient(index, 'name', event.target.value)} placeholder="Zutat" /><input aria-label={`Menge für Zutat ${index + 1}`} value={ingredient.quantity} onChange={event => updateIngredient(index, 'quantity', event.target.value)} placeholder="Menge" /><button type="button" data-preserve-keyboard aria-label={`Zutat ${index + 1} entfernen`} onClick={() => setEditor(current => ({ ...current, ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index) }))}><Trash2 size={15} /></button></div>)}</div><footer>{editor.id && <button type="button" className="meal-delete-button" onClick={deleteMeal}><Trash2 size={15} /> Löschen</button>}<button type="button" onClick={() => setEditor(null)}>Abbrechen</button><button className="primary" disabled={!editor.name.trim()}><Check size={15} /> Speichern</button></footer></form></div>}
  </div>;
}

const newRecipeDraft = () => ({ id: null, name: '', category: 'Hauptgericht', servings: 2, prepMinutes: 30, favorite: false, ingredients: [{ name: '', quantity: '1 Stück' }], steps: [''] });

function RecipeBook({ savedDishes, setSavedDishes, shopping, setShopping, catalog, setCatalog, notify, hubNav }) {
  const [query, setQuery] = useState(''); const [editor, setEditor] = useState(null); const [detail, setDetail] = useState(null);
  const visible = savedDishes.filter(dish => `${dish.name} ${dish.category || ''}`.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE')));
  const openEditor = dish => setEditor(dish ? { ...newRecipeDraft(), ...dish, ingredients: (dish.ingredients || []).map(item => ({ ...item })), steps: [...(dish.steps || [])] } : newRecipeDraft());
  const save = event => { event.preventDefault(); if (!editor.name.trim()) return; const recipe = { ...editor, id: editor.id || Date.now(), name: editor.name.trim(), category: editor.category.trim() || 'Hauptgericht', ingredients: editor.ingredients.map(item => ({ name: item.name.trim(), quantity: item.quantity.trim() || '1 Stück' })).filter(item => item.name), steps: editor.steps.map(step => step.trim()).filter(Boolean) }; setSavedDishes([...savedDishes.filter(dish => dish.id !== editor.id), recipe]); setEditor(null); notify(editor.id ? 'Rezept aktualisiert' : 'Rezept gespeichert'); };
  const addToShopping = recipe => {
    const next = shopping.map(item => ({ ...item })); let added = 0;
    for (const ingredient of recipe.ingredients || []) { const index = next.findIndex(item => item.text.toLocaleLowerCase('de-DE') === ingredient.name.toLocaleLowerCase('de-DE')); if (index >= 0) next[index] = { ...next[index], checked: false, quantity: ingredient.quantity || next[index].quantity }; else { next.push({ id: Date.now() + added, text: ingredient.name, quantity: ingredient.quantity || '1 Stück', category: 'Speiseplan', checked: false }); added += 1; } }
    setShopping(next);
    const additions = (recipe.ingredients || []).filter(ingredient => !catalog.some(item => item.text.toLocaleLowerCase('de-DE') === ingredient.name.toLocaleLowerCase('de-DE'))).map((ingredient, index) => ({ id: Date.now() + 100 + index, text: ingredient.name, quantity: ingredient.quantity || '1 Stück', category: 'Speiseplan', favorite: false, usageCount: 1 }));
    if (additions.length) setCatalog([...catalog, ...additions]); notify(`${recipe.name}: Zutaten auf die Einkaufsliste gesetzt`);
  };
  return <div className="app-page recipe-book-page"><div className="app-heading"><div><span className="eyebrow">REZEPTBUCH</span><h2>Lieblingsrezepte</h2><p>{savedDishes.length} {savedDishes.length === 1 ? 'Rezept' : 'Rezepte'} mit Portionen, Zutaten und Zubereitung.</p></div><div className="recipe-heading-actions">{hubNav}<button className="primary" onClick={() => openEditor()}><Plus size={16} /> Neues Rezept</button></div></div><label className="recipe-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rezepte durchsuchen" /></label><div className="recipe-grid">{visible.map(recipe => <article key={recipe.id}><header><span>{recipe.category || 'Rezept'}</span><button className={recipe.favorite ? 'active' : ''} onClick={() => setSavedDishes(savedDishes.map(item => item.id === recipe.id ? { ...item, favorite: !item.favorite } : item))}><Star size={15} fill={recipe.favorite ? 'currentColor' : 'none'} /></button></header><h3>{recipe.name}</h3><div className="recipe-meta"><span><Clock3 size={13} /> {recipe.prepMinutes || 0} Min.</span><span><Users size={13} /> {recipe.servings || 2} Portionen</span></div><p>{recipe.ingredients?.slice(0, 4).map(item => item.name).join(' · ') || 'Noch keine Zutaten'}{recipe.ingredients?.length > 4 ? ' …' : ''}</p><footer><button onClick={() => setDetail(recipe)}>Rezept öffnen</button><button onClick={() => addToShopping(recipe)}><ShoppingBasket size={13} /> Einkauf</button><button onClick={() => openEditor(recipe)} aria-label={`${recipe.name} bearbeiten`}><Pencil size={14} /></button></footer></article>)}{!visible.length && <div className="recipe-empty"><Utensils size={30} /><strong>Noch kein passendes Rezept</strong><span>Lege Gerichte mit Zutaten und einzelnen Kochschritten an.</span><button onClick={() => openEditor()}>Erstes Rezept erstellen</button></div>}</div>
    {detail && <div className="sheet-backdrop" onPointerDown={event => event.target === event.currentTarget && setDetail(null)}><section className="recipe-detail-sheet"><header><div><span className="eyebrow">{detail.category || 'REZEPT'}</span><h3>{detail.name}</h3><p><Clock3 size={13} /> {detail.prepMinutes || 0} Minuten · {detail.servings || 2} Portionen</p></div><button onClick={() => setDetail(null)}><X size={18} /></button></header><div className="recipe-detail-columns"><section><h4>Zutaten</h4>{detail.ingredients?.map((item, index) => <p key={index}><span>{item.name}</span><strong>{item.quantity}</strong></p>)}</section><section><h4>Zubereitung</h4>{detail.steps?.map((step, index) => <div key={index}><b>{index + 1}</b><p>{step}</p></div>)}{!detail.steps?.length && <p>Noch keine Zubereitungsschritte eingetragen.</p>}</section></div><footer><button onClick={() => { setDetail(null); openEditor(detail); }}><Pencil size={14} /> Bearbeiten</button><button className="primary" onClick={() => addToShopping(detail)}><ShoppingBasket size={14} /> Zutaten einkaufen</button></footer></section></div>}
    {editor && <div className="sheet-backdrop" onPointerDown={event => event.target === event.currentTarget && setEditor(null)}><form className="recipe-editor-sheet" onSubmit={save}><header><div><span className="eyebrow">REZEPTWERKSTATT</span><h3>{editor.id ? 'Rezept bearbeiten' : 'Neues Rezept'}</h3></div><button type="button" onClick={() => setEditor(null)}><X size={18} /></button></header><label className="wide"><span>Name</span><input autoFocus value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} placeholder="Name des Gerichts" /></label><div className="editor-grid"><label><span>Kategorie</span><input value={editor.category} onChange={event => setEditor({ ...editor, category: event.target.value })} placeholder="Hauptgericht" /></label><label><span>Portionen</span><input type="number" min="1" max="24" value={editor.servings} onChange={event => setEditor(current => { const servings = Math.max(1, Number(event.target.value) || 1); const factor = servings / (current.servings || 2); return { ...current, servings, ingredients: current.ingredients.map(item => ({ ...item, quantity: scaleQuantityLabel(item.quantity, factor) })) }; })} /></label><label><span>Zubereitungszeit</span><input type="number" min="0" max="1440" value={editor.prepMinutes} onChange={event => setEditor({ ...editor, prepMinutes: Number(event.target.value) })} /></label><label className="favorite-checkbox"><span>Favorit</span><input type="checkbox" checked={editor.favorite} onChange={event => setEditor({ ...editor, favorite: event.target.checked })} /></label></div><section className="recipe-edit-section"><header><span><strong>Zutaten</strong><small>Mengen beziehen sich auf die gewählten Portionen.</small></span><button type="button" onClick={() => setEditor({ ...editor, ingredients: [...editor.ingredients, { name: '', quantity: '1 Stück' }] })}><Plus size={13} /> Zutat</button></header>{editor.ingredients.map((item, index) => <div className="recipe-input-row" key={index}><input value={item.name} onChange={event => setEditor({ ...editor, ingredients: editor.ingredients.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry) })} placeholder="Zutat" /><input value={item.quantity} onChange={event => setEditor({ ...editor, ingredients: editor.ingredients.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: event.target.value } : entry) })} placeholder="Menge" /><button type="button" onClick={() => setEditor({ ...editor, ingredients: editor.ingredients.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></button></div>)}</section><section className="recipe-edit-section"><header><span><strong>Zubereitung</strong><small>Ein klarer Schritt nach dem anderen.</small></span><button type="button" onClick={() => setEditor({ ...editor, steps: [...editor.steps, ''] })}><Plus size={13} /> Schritt</button></header>{editor.steps.map((step, index) => <div className="recipe-step-row" key={index}><b>{index + 1}</b><textarea value={step} onChange={event => setEditor({ ...editor, steps: editor.steps.map((entry, stepIndex) => stepIndex === index ? event.target.value : entry) })} placeholder="Zubereitung beschreiben" /><button type="button" onClick={() => setEditor({ ...editor, steps: editor.steps.filter((_, stepIndex) => stepIndex !== index) })}><Trash2 size={14} /></button></div>)}</section><footer>{editor.id && <button type="button" className="danger" onClick={() => { setSavedDishes(savedDishes.filter(dish => dish.id !== editor.id)); setEditor(null); notify('Rezept gelöscht'); }}>Löschen</button>}<button type="button" onClick={() => setEditor(null)}>Abbrechen</button><button className="primary" disabled={!editor.name.trim()}><Check size={15} /> Rezept speichern</button></footer></form></div>}
  </div>;
}

function MealPlanner(props) {
  const [view, setView] = useState('plan');
  const hubNav = <nav className="meal-hub-tabs"><button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><CalendarDays size={14} /> Wochenplan</button><button className={view === 'recipes' ? 'active' : ''} onClick={() => setView('recipes')}><Utensils size={14} /> Rezepte</button></nav>;
  return view === 'plan' ? <LegacyMealPlanner {...props} hubNav={hubNav} /> : <RecipeBook {...props} hubNav={hubNav} />;
}

function NotificationSettings({ member, preferences, updatePreference }) {
  const push = usePushNotifications(member.id);
  const subscribed = push.status === 'subscribed';
  const toggle = async value => {
    const changed = value ? await push.enable() : await push.disable();
    if (changed) updatePreference('notifications', value);
  };
  const statusText = push.status === 'subscribed' ? 'Aktiv auf diesem Gerät' : push.status === 'denied' ? 'Im Browser blockiert' : push.status === 'unsupported' ? 'Auf diesem Gerät nicht verfügbar' : push.status === 'loading' ? 'Wird geprüft …' : 'Noch nicht aktiviert';
  return <section className="preference-panel"><PreferenceHeader kicker="PERSÖNLICH" title="Mitteilungen" description="Erhalte wichtige Änderungen auch bei geschlossener App." />
    <div className="settings-card push-settings">
      <SettingSwitch icon={Bell} color="#ff3b30" title="Push-Mitteilungen" subtitle={statusText} checked={subscribed} disabled={!push.supported || push.busy || push.status === 'denied'} onChange={toggle} />
      <SettingSwitch icon={Volume2} color="#ff9500" title="Töne" subtitle="Vom Betriebssystem abgespielte Hinweistöne erlauben" checked={preferences.sounds} onChange={value => updatePreference('sounds', value)} />
      <div className="settings-row push-actions"><span><strong>Funktion prüfen</strong><small>Sendet eine Testmitteilung an dieses Gerät</small></span><button className="settings-save" disabled={!subscribed || push.busy} onClick={push.test}>Test senden</button></div>
    </div>
    {push.status === 'unsupported' && <p className="device-hint">Auf iPhone und iPad muss HouseOS zuerst zum Home-Bildschirm hinzugefügt und von dort geöffnet werden.</p>}
    {push.status === 'denied' && <p className="settings-error">Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Website- oder App-Einstellungen.</p>}
    {push.message && <p className={push.status === 'error' ? 'settings-error' : 'device-hint'}>{push.message}</p>}
  </section>;
}

function SettingsApp({ member, onMemberChange, preferences, setPreferences, items, setItems, tasks, setTasks, notify, device, refreshDevice }) {
  const [section, setSection] = useState('profile'); const [profileName, setProfileName] = useState(member.name); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const fileInput = useRef(null);
  const groups = [
    { label: 'PERSÖNLICH', items: [['profile','Profil',UserRound,'#8e8e93'],['appearance','Darstellung',Palette,'#007aff'],['notifications','Mitteilungen',Bell,'#ff3b30'],['accessibility','Bedienungshilfen',Accessibility,'#007aff']] },
    { label: 'ALLGEMEIN', items: [['general','Allgemein',SlidersHorizontal,'#8e8e93'],['bluetooth','Bluetooth',Bluetooth,'#007aff']] },
    ...(member.isAdmin ? [{ label: 'HOUSEOS ADMIN', items: [['users','Benutzer',Users,'#34c759'],['system','System',Server,'#5856d6'],['updates','Updates',Download,'#007aff']] }] : []),
  ];
  const updatePreference = (key, value) => {
    if (key === 'performanceMode') localStorage.setItem('houseos.performanceMode', String(Boolean(value)));
    setPreferences(current => ({ ...current, [key]: value }));
  };
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
      <button aria-label="Profil" className={`settings-account ${section === 'profile' ? 'selected' : ''}`} onClick={() => setSection('profile')}><ProfileAvatar member={member} preferences={preferences} className="settings-avatar profile-image" /><span><strong>{member.name}</strong><small>{member.role}</small></span><ChevronRight size={15} /></button>
      {groups.map(group => <div className="settings-group" key={group.label}><small>{group.label}</small>{group.items.filter(([id]) => id !== 'profile').map(([id,label,Icon,color]) => <button aria-label={label} title={label} key={id} className={section === id ? 'selected' : ''} onClick={() => setSection(id)}><i style={{ '--category': color }}><Icon size={14} /></i><span>{label}</span><ChevronRight size={14} /></button>)}</div>)}
    </aside>
    <main className="settings-detail">
      {section === 'profile' && <section className="preference-panel"><header><span className="settings-kicker">PERSÖNLICH</span><h2>Dein Profil</h2><p>So erscheinst du in HouseOS.</p></header><form className="profile-settings" onSubmit={saveProfile}><div className="profile-photo-wrap"><ProfileAvatar member={{ ...member, name: profileName }} preferences={preferences} className="profile-photo profile-image" /><button type="button" onClick={() => fileInput.current?.click()}><Camera size={15} /> Foto ändern</button><input ref={fileInput} hidden type="file" accept="image/*" onChange={uploadAvatar} /></div><div className="settings-card profile-fields"><label><span>Name</span><input value={profileName} onChange={event => setProfileName(event.target.value)} /></label><div className="settings-row"><span><strong>Rolle</strong><small>Vom Haushaltsadmin verwaltet</small></span><b>{member.role}</b></div></div><div className="profile-actions">{preferences.avatar && <button type="button" className="text-button danger" onClick={() => updatePreference('avatar', '')}>Foto entfernen</button>}<button className="settings-save" disabled={saving}>{saving ? 'Wird gespeichert …' : 'Änderungen sichern'}</button></div>{error && <p className="settings-error">{error}</p>}</form></section>}
      {section === 'appearance' && <AppearanceSettings preferences={preferences} updatePreference={updatePreference} />}
      {section === 'notifications' && <NotificationSettings member={member} preferences={preferences} updatePreference={updatePreference} />}
      {section === 'accessibility' && <section className="preference-panel"><PreferenceHeader kicker="PERSÖNLICH" title="Bedienungshilfen" description="Passe Lesbarkeit und Bewegungen an deine Bedürfnisse an." /><div className="settings-card"><SettingSwitch icon={Eye} color="#007aff" title="Größerer Text" subtitle="Die gesamte HouseOS-Oberfläche deutlich vergrößern" checked={preferences.largeText} onChange={value => updatePreference('largeText', value)} /><SettingSwitch icon={Contrast} color="#5856d6" title="Mehr Kontrast" subtitle="Trennlinien und Flächen deutlicher anzeigen" checked={preferences.highContrast} onChange={value => updatePreference('highContrast', value)} /><SettingSwitch icon={Accessibility} color="#34c759" title="Bewegung reduzieren" subtitle="Animationen und Übergänge minimieren" checked={preferences.reduceMotion} onChange={value => updatePreference('reduceMotion', value)} /></div></section>}
      {section === 'general' && <GeneralSettings preferences={preferences} updatePreference={updatePreference} member={member} notify={notify} device={device} refreshDevice={refreshDevice} />}
      {section === 'bluetooth' && <BluetoothSettings member={member} notify={notify} />}
      {section === 'users' && member.isAdmin && <section className="admin-settings-panel"><Members embedded items={items} setItems={setItems} tasks={tasks} setTasks={setTasks} notify={notify} /></section>}
      {['system','updates'].includes(section) && member.isAdmin && <section className="admin-settings-panel"><SystemPanel section={section} notify={notify} /></section>}
    </main>
  </div>;
}

function RestartScreen({ title, message, targetVersion }) {
  const startedAt = useRef(Date.now()); const wasOffline = useRef(false);
  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(`/api/health?restart=${Date.now()}`, { cache: 'no-store' });
        const health = response.ok ? await response.json() : null;
        const updatedServiceReady = targetVersion && String(health?.version) === String(targetVersion);
        if (response.ok && (updatedServiceReady || wasOffline.current || Date.now() - startedAt.current > 20_000)) window.location.reload();
      } catch { wasOffline.current = true; }
    };
    const timer = setInterval(check, 1400); check();
    return () => clearInterval(timer);
  }, [targetVersion]);
  return <section className="restart-screen" role="status" aria-live="assertive"><div className="restart-spinner"><RefreshCw size={34} /></div><h2>{title}</h2><p>{message}</p><small>HouseOS verbindet sich automatisch wieder. Bitte das Gerät eingeschaltet lassen.</small></section>;
}

function GeneralSettings({ preferences, updatePreference, member, notify, device, refreshDevice }) {
  const [city, setCity] = useState(''); const [savingCity, setSavingCity] = useState(false); const [cityError, setCityError] = useState('');
  useEffect(() => {
    fetch('/api/device/settings', { cache: 'no-store' }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error); setCity(result.city || '');
    }).catch(error => setCityError(error.message || 'Wetterstadt konnte nicht geladen werden.'));
  }, []);
  const saveCity = async event => {
    event.preventDefault(); setSavingCity(true); setCityError('');
    try {
      const response = await fetch('/api/device/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city: city.trim() }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setCity(result.city); await refreshDevice(result.city); notify(result.city ? `Wetterstadt auf ${result.location || result.city} gesetzt` : 'Automatische Standorterkennung aktiviert');
    } catch (error) { setCityError(error.message || 'Wetterstadt konnte nicht gespeichert werden.'); }
    finally { setSavingCity(false); }
  };
  return <section className="preference-panel"><PreferenceHeader kicker="HOUSEOS" title="Allgemein" description="Grundlegende Einstellungen für dieses Gerät." />
    <h3 className="settings-section-title">Standort und Wetter</h3>
    <form className="settings-card city-settings" onSubmit={saveCity}><div className="settings-row icon-row"><i style={{ '--category': '#34c759' }}><MapPin size={15} /></i><span><strong>Wetterstadt</strong><small>{city ? `Wetter für ${device.location}` : 'Leer lassen für automatische Standorterkennung'}</small></span><input value={city} onChange={event => setCity(event.target.value)} placeholder="z. B. Wien" autoComplete="off" disabled={!member.isAdmin || savingCity} /><button className="settings-save" disabled={!member.isAdmin || savingCity}>{savingCity ? 'Prüfe …' : 'Speichern'}</button></div>{!member.isAdmin && <p className="device-hint">Nur der Haushaltsadmin kann die Wetterstadt ändern.</p>}{cityError && <p className="settings-error">{cityError}</p>}</form>
    <h3 className="settings-section-title">HouseOS</h3>
    <div className="settings-card"><div className="settings-row icon-row"><i style={{ '--category': '#007aff' }}><Languages size={15} /></i><span><strong>Sprache</strong><small>Sprache der Oberfläche</small></span><select value={preferences.language} onChange={event => updatePreference('language', event.target.value)}><option>Deutsch</option><option>English</option></select></div><SettingSwitch icon={Cpu} color="#34c759" title="Performance-Modus" subtitle="Reduziert Effekte und Grafiklast auf dem Raspberry Pi" checked={preferences.performanceMode} onChange={value => { updatePreference('performanceMode', value); notify(value ? 'Performance-Modus aktiviert' : 'Performance-Modus deaktiviert'); }} /><SettingSwitch icon={MonitorCog} color="#5e5ce6" title="Ruhe- und Sperrbildschirm" subtitle="Nach einer Minute Informationen anzeigen und Anmeldung verlangen" checked={preferences.ambientMode} onChange={value => updatePreference('ambientMode', value)} /><div className="settings-row icon-row"><i style={{ '--category': '#8e8e93' }}><Info size={15} /></i><span><strong>HouseOS</strong><small>Persönliches Zuhause-Dashboard</small></span><b>Version {packageInfo.version}</b></div><div className="settings-row icon-row"><i style={{ '--category': '#5856d6' }}><KeyRound size={15} /></i><span><strong>PIN & Sicherheit</strong><small>{preferences.ambientMode ? 'Automatische Sperre nach einer Minute' : 'Automatische Sperre nach 15 Minuten'}</small></span><b>Aktiv</b></div></div>
  </section>;
}

const bluetoothDeviceIcon = device => {
  const type = `${device.icon || ''} ${device.name || ''}`.toLowerCase();
  if (/head|airpod|buds|kopfhörer/.test(type)) return Headphones;
  if (/keyboard|tastatur/.test(type)) return Keyboard;
  if (/mouse|maus/.test(type)) return MousePointer2;
  if (/phone|tablet|iphone|ipad/.test(type)) return Smartphone;
  return Speaker;
};

function BluetoothSettings({ member, notify }) {
  const [state, setState] = useState({ available: true, powered: false, discovering: false, adapter: null, devices: [], message: '' });
  const [busy, setBusy] = useState('load'); const [error, setError] = useState(''); const [details, setDetails] = useState('');
  const request = async (url, options) => {
    const response = await fetch(url, { cache: 'no-store', ...options, headers: options?.body ? { 'Content-Type': 'application/json', ...options?.headers } : options?.headers });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Bluetooth-Aktion fehlgeschlagen.');
    setState(result); return result;
  };
  const load = async () => {
    try { setError(''); return await request('/api/bluetooth'); }
    catch (loadError) { setError(loadError.message); return null; }
    finally { setBusy(''); }
  };
  const scan = async (quiet = false) => {
    if (!member.isAdmin) return;
    setBusy('scan'); if (!quiet) setError('');
    try { await request('/api/bluetooth/scan', { method: 'POST' }); }
    catch (scanError) { setError(scanError.message); }
    finally { setBusy(''); }
  };
  useEffect(() => { let active = true; load().then(result => { if (active && result?.available && result.powered && member.isAdmin) scan(true); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!state.powered || busy === 'scan') return;
    const timer = setInterval(() => load(), 5000); return () => clearInterval(timer);
  }, [state.powered, busy]);
  const setPower = async powered => {
    setBusy('power'); setError('');
    try { const result = await request('/api/bluetooth/power', { method: 'POST', body: JSON.stringify({ powered }) }); notify(`Bluetooth ${result.powered ? 'aktiviert' : 'deaktiviert'}`); if (result.powered) await scan(true); }
    catch (powerError) { setError(powerError.message); }
    finally { setBusy(''); }
  };
  const control = async (device, action) => {
    setBusy(device.address); setError('');
    try {
      await request(`/api/bluetooth/devices/${encodeURIComponent(device.address)}/${action}`, { method: 'POST' });
      const messages = { pair: `${device.name} wurde gekoppelt`, connect: `${device.name} ist verbunden`, disconnect: `${device.name} wurde getrennt`, remove: `${device.name} wurde ignoriert` };
      notify(messages[action]); if (action === 'remove') setDetails('');
    } catch (deviceError) { setError(deviceError.message); }
    finally { setBusy(''); }
  };
  const paired = state.devices.filter(device => device.paired || device.bonded || device.trusted);
  const nearby = state.devices.filter(device => !device.paired && !device.bonded && !device.trusted && device.recent);
  const deviceList = (devices, empty) => <div className="bluetooth-list">{devices.map(device => {
    const Icon = bluetoothDeviceIcon(device); const deviceBusy = busy === device.address; const expanded = details === device.address;
    return <article className={`bluetooth-device ${device.connected ? 'connected' : ''} ${expanded ? 'expanded' : ''}`} key={device.address}>
      <div className="bluetooth-device-main"><i><Icon size={22} /></i><span><strong>{device.name}</strong><small>{device.connected ? 'Verbunden' : device.paired || device.trusted ? 'Nicht verbunden' : device.recent ? 'Gerade gefunden' : 'Nicht gekoppelt'}</small></span>
        <button className="bluetooth-connect" disabled={!member.isAdmin || deviceBusy} onClick={() => control(device, device.connected ? 'disconnect' : device.paired || device.trusted ? 'connect' : 'pair')}>{deviceBusy ? <LoaderCircle className="spin" size={14} /> : device.connected ? 'Trennen' : 'Verbinden'}</button>
        <button className="bluetooth-more" onClick={() => setDetails(expanded ? '' : device.address)} aria-label={`Details zu ${device.name}`}><MoreHorizontal size={17} /></button></div>
      {expanded && <div className="bluetooth-device-details"><span><small>Adresse</small><strong>{device.address}</strong></span><span><small>Typ</small><strong>{device.icon || 'Audiogerät'}</strong></span>{(device.paired || device.trusted) && <button disabled={!member.isAdmin || deviceBusy} onClick={() => control(device, 'remove')}>Dieses Gerät ignorieren …</button>}</div>}
    </article>;
  })}{!devices.length && <div className="bluetooth-empty">{empty}</div>}</div>;
  return <section className="preference-panel bluetooth-panel"><header className="bluetooth-header"><div><span className="settings-kicker">VERBINDUNGEN</span><h2>Bluetooth</h2><p>{state.powered ? `${state.adapter?.name || 'HouseOS'} ist als „${state.adapter?.name || 'Raspberry Pi'}“ sichtbar.` : 'Verbinde HouseOS mit Lautsprechern und anderem Zubehör.'}</p></div><label className="bluetooth-power"><input type="checkbox" checked={state.powered} disabled={!member.isAdmin || busy === 'power' || !state.available} onChange={event => setPower(event.target.checked)} /><em /></label></header>
    {!state.available ? <div className="bluetooth-unavailable"><Bluetooth size={28} /><strong>Bluetooth nicht verfügbar</strong><p>{state.message || 'Auf diesem Gerät wurde kein Bluetooth-Adapter gefunden.'}</p></div> : <>
      {state.powered && <><div className="bluetooth-scan-status"><span className={busy === 'scan' ? 'scanning' : state.scan?.found === 0 ? 'nothing-found' : ''}><Bluetooth size={14} />{busy === 'scan' ? 'Audiogeräte werden 20 Sekunden gesucht …' : state.scan ? state.scan.found ? `${state.scan.found} Gerät${state.scan.found === 1 ? '' : 'e'} bei der letzten Suche gefunden` : 'Kein Gerät hat auf die letzte Suche geantwortet' : 'Bereit für die Gerätesuche'}</span><button disabled={!member.isAdmin || busy === 'scan'} onClick={() => scan()}>{busy === 'scan' ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />} Erneut suchen</button></div><p className="bluetooth-scan-help">Sage zuerst „Alexa, Bluetooth koppeln“ und starte die Suche erst nach Alexas Bestätigung.</p></>}
      {state.powered ? <><h3 className="settings-section-title">Meine Geräte</h3>{deviceList(paired, 'Noch keine gekoppelten Geräte')}<h3 className="settings-section-title">Geräte in der Nähe</h3>{deviceList(nearby, busy === 'scan' ? 'Suche läuft …' : 'Keine weiteren Geräte gefunden')}</> : <div className="bluetooth-off"><span><Bluetooth size={30} /></span><h3>Bluetooth ist ausgeschaltet</h3><p>Aktiviere Bluetooth, um eine Alexa oder anderes Zubehör in der Nähe zu finden.</p></div>}
    </>}
    {!member.isAdmin && <p className="device-hint">Nur der Haushaltsadmin kann Bluetooth-Verbindungen ändern.</p>}{error && <p className="settings-error">{error}</p>}
  </section>;
}

function PreferenceHeader({ kicker, title, description }) { return <header><span className="settings-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></header>; }

function SettingSwitch({ icon: Icon, color, title, subtitle, checked, disabled = false, onChange }) { return <label className={`settings-row icon-row switch-row ${disabled ? 'disabled' : ''}`}><i style={{ '--category': color }}><Icon size={15} /></i><span><strong>{title}</strong><small>{subtitle}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><em /></label>; }

function AppearanceSettings({ preferences, updatePreference }) {
  const accents = ['#007aff','#5856d6','#af52de','#ff2d55','#ff3b30','#ff9500','#ffcc00','#34c759'];
  return <section className="preference-panel"><PreferenceHeader kicker="PERSÖNLICH" title="Darstellung" description="Wähle den Look, der zu dir und deinem Zuhause passt." /><h3 className="settings-section-title">Erscheinungsbild</h3><div className="appearance-options">{[['auto','Automatisch'],['light','Hell'],['dark','Dunkel']].map(([id,label]) => <button key={id} className={preferences.appearance === id ? 'selected' : ''} onClick={() => updatePreference('appearance', id)}><span className={`appearance-preview ${id}`}><i /><i /><i /></span><strong>{label}</strong>{preferences.appearance === id && <CheckCircle2 size={16} />}</button>)}</div><h3 className="settings-section-title">Akzentfarbe</h3><div className="settings-card color-settings"><div className="settings-row"><span><strong>Farbe</strong><small>Für Schaltflächen und Auswahlmarkierungen</small></span><div className="accent-picker">{accents.map(color => <button aria-label={`Akzentfarbe ${color}`} key={color} className={preferences.accent === color ? 'selected' : ''} style={{ '--accent': color }} onClick={() => updatePreference('accent', color)}>{preferences.accent === color && <Check size={13} />}</button>)}</div></div></div><h3 className="settings-section-title">Hintergrund</h3><div className="wallpaper-picker">{[['bloom','Bloom'],['ocean','Ozean'],['sunset','Abendrot'],['graphite','Graphit']].map(([id,label]) => <button key={id} className={preferences.wallpaper === id ? 'selected' : ''} onClick={() => updatePreference('wallpaper', id)}><i className={`wallpaper-swatch ${id}`} /> <span>{label}</span>{preferences.wallpaper === id && <CheckCircle2 size={15} />}</button>)}</div></section>;
}

const UPDATE_ACTIVE_STATES = ['queued','downloading','verifying','extracting','backup','installing','dependencies','restarting'];

const RELEASE_INLINE_PATTERN = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+))/g;
const renderReleaseInline = (text, keyPrefix) => {
  const nodes = []; let cursor = 0; let match;
  while ((match = RELEASE_INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (match[2]) nodes.push(<strong key={`${keyPrefix}-${match.index}`}>{match[2]}</strong>);
    else if (match[3]) nodes.push(<code key={`${keyPrefix}-${match.index}`}>{match[3]}</code>);
    else {
      const label = match[4] || match[6]; const href = match[5] || match[6];
      nodes.push(<a key={`${keyPrefix}-${match.index}`} href={href} target="_blank" rel="noreferrer">{label}</a>);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  RELEASE_INLINE_PATTERN.lastIndex = 0;
  return nodes;
};

function ReleaseChangelog({ notes, version, releaseName, releaseUrl, publishedAt }) {
  const lines = String(notes || '').replace(/\r\n?/g, '\n').split('\n'); const blocks = [];
  const startsBlock = line => /^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*|---+\s*$)/.test(line);
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim() || /^<!--/.test(line.trim())) { index += 1; continue; }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(4, heading[1].length + 2); const Heading = `h${level}`;
      blocks.push(<Heading key={`heading-${index}`}>{renderReleaseInline(heading[2], `heading-${index}`)}</Heading>); index += 1; continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      const items = []; const start = index;
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*+]\s+(.+)$/); if (!item) break;
        const clean = item[1].replace(/^\[[ xX]\]\s*/, ''); items.push(<li key={`item-${index}`}>{renderReleaseInline(clean, `item-${index}`)}</li>); index += 1;
      }
      blocks.push(<ul key={`list-${start}`}>{items}</ul>); continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      const items = []; const start = index;
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/); if (!item) break;
        items.push(<li key={`item-${index}`}>{renderReleaseInline(item[1], `item-${index}`)}</li>); index += 1;
      }
      blocks.push(<ol key={`list-${start}`}>{items}</ol>); continue;
    }
    const quote = line.match(/^\s*>\s*(.+)$/);
    if (quote) { blocks.push(<blockquote key={`quote-${index}`}>{renderReleaseInline(quote[1], `quote-${index}`)}</blockquote>); index += 1; continue; }
    if (/^\s*---+\s*$/.test(line)) { blocks.push(<hr key={`rule-${index}`} />); index += 1; continue; }
    const paragraph = [line.trim()]; const start = index; index += 1;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) { paragraph.push(lines[index].trim()); index += 1; }
    blocks.push(<p key={`paragraph-${start}`}>{renderReleaseInline(paragraph.join(' '), `paragraph-${start}`)}</p>);
  }
  if (!blocks.length) return null;
  const published = publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(publishedAt)) : '';
  return <section className="release-changelog" aria-label={`Changelog für HouseOS ${version || ''}`}><header><div><span>RELEASE-ÄNDERUNGEN</span><h3>{releaseName || `HouseOS ${version}`}</h3>{published && <small>Veröffentlicht am {published}</small>}</div>{releaseUrl && <a href={releaseUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Auf GitHub öffnen</a>}</header><div className="release-notes">{blocks}</div></section>;
}

function SystemPanel({ section, notify }) {
  const [info, setInfo] = useState(null); const [update, setUpdate] = useState(null); const [updateStatus, setUpdateStatus] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const loadInfo = async () => { try { const response = await fetch('/api/system/info'); const result = await response.json(); if (!response.ok) throw new Error(result.error); setInfo(result); } catch (loadError) { setError(loadError.message || 'Systeminformationen konnten nicht geladen werden.'); } };
  const checkUpdate = async (force = false) => { setBusy(true); setError(''); try { const response = await fetch(`/api/updates/check${force ? '?force=1' : ''}`); const result = await response.json(); if (!response.ok) throw new Error(result.error); setUpdate(result); } catch (checkError) { setError(checkError.message || 'Updateprüfung fehlgeschlagen.'); } finally { setBusy(false); } };
  const loadUpdateStatus = async () => { try { const response = await fetch('/api/updates/status', { cache: 'no-store' }); if (!response.ok) throw new Error(); const result = await response.json(); setUpdateStatus(result); if (result.status === 'restarting') window.dispatchEvent(new CustomEvent('houseos:restart', { detail: { title: 'HouseOS wird neu gestartet', message: result.message, version: result.version } })); if (result.status === 'installed') { setUpdate(current => ({ ...current, installing: false, message: result.message, currentVersion: result.version, hasUpdate: false })); } } catch { if (['dependencies','restarting'].includes(updateStatus?.status)) { const restarting = { ...updateStatus, status: 'restarting', message: 'Das Update ist installiert. Der HouseOS-Dienst startet neu …', progress: 100 }; setUpdateStatus(restarting); window.dispatchEvent(new CustomEvent('houseos:restart', { detail: { title: 'HouseOS wird neu gestartet', message: restarting.message, version: restarting.version } })); } } };
  useEffect(() => { loadInfo(); checkUpdate(false); loadUpdateStatus(); }, []);
  useEffect(() => { if (!UPDATE_ACTIVE_STATES.includes(updateStatus?.status)) return; const timer = setInterval(loadUpdateStatus, 1400); return () => clearInterval(timer); }, [updateStatus?.status]);
  const install = async () => { setBusy(true); setError(''); try { const response = await fetch('/api/updates/install', { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); notify(result.message); setUpdateStatus({ status: result.status || 'queued', version: result.version, progress: 5, message: result.message }); setUpdate(current => ({ ...current, message: result.message, installing: true })); } catch (installError) { setError(installError.message || 'Update konnte nicht gestartet werden.'); } finally { setBusy(false); } };
  const uptime = info ? `${Math.floor(info.uptimeSeconds / 86400)} T · ${Math.floor(info.uptimeSeconds % 86400 / 3600)} Std` : '–';
  if (section === 'system') return <section className="system-section"><div className="section-heading"><div><h3>Raspberry Pi</h3><p>Technischer Zustand der HouseOS-Zentrale.</p></div><button onClick={loadInfo}><RefreshCw size={14} /> Aktualisieren</button></div>
    <div className="system-grid"><article><span><MonitorCog size={20} /></span><small>HOUSEOS</small><strong>Version {info?.version || '–'}</strong><p>{info?.hostname || 'Wird geladen …'}</p></article><article><span><Cpu size={20} /></span><small>PLATTFORM</small><strong>{info ? `${info.platform} · ${info.architecture}` : '–'}</strong><p>Node.js {info?.nodeVersion || '–'}</p></article><article><span><HardDrive size={20} /></span><small>LAUFZEIT</small><strong>{uptime}</strong><p>Systemdienst automatisch aktiv</p></article><article><span><GitBranch size={20} /></span><small>UPDATEQUELLE</small><strong>{info?.repository || 'Nicht konfiguriert'}</strong><p>{info?.installerReady ? 'Pi-Updater ist bereit' : 'Installation noch nicht eingerichtet'}</p></article></div>
    <DeviceControls supported={info?.deviceActionsSupported} notify={notify} />
    {info?.updateStatus && <div className={`update-state ${info.updateStatus.status}`}><strong>Letzter Updatestatus</strong><span>{info.updateStatus.message}</span></div>}{error && <p className="settings-error">{error}</p>}</section>;
  return <section className="system-section"><div className="section-heading"><div><h3>Softwareupdate</h3><p>Geprüfte Versionen direkt aus GitHub Releases installieren.</p></div><button onClick={() => checkUpdate(true)} disabled={busy}><RefreshCw size={14} /> {busy ? 'Prüfe …' : 'Neu prüfen'}</button></div>
    <article className="update-card"><div className="update-icon"><Download size={25} /></div><div className="update-copy"><small>INSTALLIERTE VERSION</small><h3>HouseOS {update?.currentVersion || info?.version || '–'}</h3><p>{update?.message || 'GitHub wird auf neue Releases geprüft …'}</p>{update?.hasUpdate && <div className="version-route"><span>v{update.currentVersion}</span><ChevronRight size={15} /><strong>v{update.latestVersion}</strong></div>}</div><div className="update-actions">{update?.hasUpdate && update?.installable ? <button className="primary" disabled={busy || UPDATE_ACTIVE_STATES.includes(updateStatus?.status) || !info?.installerReady} onClick={install}>{UPDATE_ACTIVE_STATES.includes(updateStatus?.status) ? <RefreshCw className="spin" size={15} /> : <Download size={15} />}{UPDATE_ACTIVE_STATES.includes(updateStatus?.status) ? 'Installation läuft …' : 'Update installieren'}</button> : <span className="up-to-date"><CheckCircle2 size={18} /> Aktuell</span>}</div>{update?.notes && <ReleaseChangelog notes={update.notes} version={update.latestVersion} releaseName={update.releaseName} releaseUrl={update.releaseUrl} publishedAt={update.publishedAt} />}</article>
    {updateStatus && updateStatus.status !== 'idle' && <UpdateProgress status={updateStatus} />}
    {!update?.configured && <div className="setup-hint"><GitBranch size={18} /><span><strong>GitHub noch verbinden</strong><small>Auf dem Pi in <code>/etc/houseos.env</code> den Wert <code>HOUSEOS_GITHUB_REPO=OWNER/REPO</code> setzen.</small></span></div>}{error && <p className="settings-error">{error}</p>}</section>;
}

function UpdateProgress({ status }) {
  const failed = ['error','rolled-back'].includes(status.status); const complete = status.status === 'installed'; const progress = Number(status.progress ?? (complete ? 100 : failed ? 100 : 8));
  const label = failed ? 'Installation fehlgeschlagen' : complete ? 'Update abgeschlossen' : status.status === 'restarting' ? 'HouseOS startet neu' : 'Update wird installiert';
  return <section className={`update-progress ${failed ? 'failed' : complete ? 'complete' : ''}`} aria-live="polite"><div className="update-progress-head"><i>{failed ? <AlertTriangle size={18} /> : complete ? <CheckCircle2 size={18} /> : <RefreshCw className="spin" size={17} />}</i><span><strong>{label}</strong><small>{status.message}</small></span><b>{Math.max(0, Math.min(100, progress))}%</b></div><div className="update-progress-track"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div><div className="update-progress-note">{failed ? 'Öffne den Systemstatus oder installiere das Release per SSH.' : complete ? 'Die neue Version ist bereit. Die Oberfläche verbindet sich nach dem Neustart automatisch.' : 'Bitte Raspberry Pi eingeschaltet lassen und den Browser nicht schließen.'}</div></section>;
}

const DEVICE_ACTIONS = {
  reboot: { title: 'Raspberry Pi neu starten?', description: 'HouseOS ist für ungefähr eine Minute nicht erreichbar.', confirm: 'Jetzt neu starten', icon: Power, tone: 'blue' },
  shutdown: { title: 'Raspberry Pi herunterfahren?', description: 'Das Gerät muss anschließend von Hand wieder eingeschaltet werden.', confirm: 'Herunterfahren', icon: PowerOff, tone: 'red' },
  exitKiosk: { title: 'Kiosk-Modus verlassen?', description: 'Chromium wird geschlossen und der Raspberry-Pi-Desktop wird sichtbar. Nach einem Neustart beginnt der Kiosk-Modus erneut.', confirm: 'Kiosk verlassen', icon: ExternalLink, tone: 'orange' },
};

function DeviceControls({ supported, notify }) {
  const [pending, setPending] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const action = pending && DEVICE_ACTIONS[pending]; const ActionIcon = action?.icon;
  const execute = async () => { setBusy(true); setError(''); try { const selectedAction = pending; const response = await fetch('/api/system/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: selectedAction }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); notify(result.message); setPending(null); if (selectedAction === 'reboot') window.dispatchEvent(new CustomEvent('houseos:restart', { detail: { message: result.message } })); } catch (actionError) { setError(actionError.message || 'Aktion konnte nicht ausgeführt werden.'); } finally { setBusy(false); } };
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
    <section className="receipt-wrap"><span className="preview-label">VORSCHAU · {settings.paperWidth} MM</span><div className={`receipt paper-${settings.paperWidth}`} id="receipt"><div className="receipt-logo">⌂ HOUSEOS</div><p>{type === 'daily' ? 'TAGESÜBERSICHT' : type === 'shopping' ? 'EINKAUFSLISTE' : 'AUFGABENLISTE'}</p><div className="receipt-rule" /><small>{date}</small>{type === 'daily' && <><h4>STANDORT</h4><p>{context.location}</p><h4>WETTER</h4><p>{context.weatherText}</p><h4>AUFGABEN</h4>{tasks.filter(task => !task.done).map(task => <p key={task.id}>[ ] {task.text}<small> · {taskSchedule(task)}</small></p>)}<h4>EINKAUF</h4>{shopping.filter(item => !item.checked).map(item => <p key={item.id}>[ ] {item.quantity || '1 Stück'} {item.text}</p>)}</>}{type === 'shopping' && shopping.filter(item => !item.checked).map(item => <p key={item.id}>[ ] {item.quantity || '1 Stück'} {item.text} <small>({item.category})</small></p>)}{type === 'tasks' && tasks.filter(task => !task.done).map(task => <p key={task.id}>[ ] {task.text}<small> · {task.person} · {taskSchedule(task)}</small></p>)}<div className="receipt-rule" /><p className="receipt-center">Zuhause läuft alles.<br />houseos.local</p></div></section></div></div>;
}

const KEYBOARD_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0','ß'],
  ['q','w','e','r','t','z','u','i','o','p','ü'],
  ['a','s','d','f','g','h','j','k','l','ö','ä'],
  ['shift','y','x','c','v','b','n','m','backspace'],
  ['close',',','space','.','enter'],
];
const NUMERIC_KEYBOARD_ROWS = [['1','2','3'],['4','5','6'],['7','8','9'],['-','0','backspace'],['close',',','.','enter']];

function OnScreenKeyboard() {
  const [target, setTarget] = useState(null); const [shift, setShift] = useState(false);
  const preserveFocus = useRef(false);
  const virtualPointer = useRef(false);
  const isTabletKeyboard = useTabletKeyboardLayout();
  useEffect(() => {
    if (!isTabletKeyboard) { setTarget(null); return; }
    const editable = element => element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && !['button','checkbox','color','date','datetime-local','file','hidden','month','radio','range','reset','submit','time','week'].includes(element.type) && !element.readOnly && !element.disabled && !element.dataset.noVirtualKeyboard);
    const openFor = element => {
      if (!editable(element)) return;
      setTarget(element); setShift(false);
      if (element.closest?.('.meal-editor')) {
        const desktop = element.closest('.desktop');
        const desktopScroll = desktop?.scrollTop || 0;
        requestAnimationFrame(() => desktop?.scrollTo?.({ top: desktopScroll, behavior: 'instant' }));
      } else setTimeout(() => element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 80);
    };
    const focusIn = event => { if (virtualPointer.current) openFor(event.target); };
    const pointerDown = event => {
      if (event.target.closest?.('.screen-keyboard')) return;
      if (event.target.closest?.('[data-preserve-keyboard]')) {
        preserveFocus.current = true;
        setTimeout(() => { preserveFocus.current = false; }, 0);
        return;
      }
      virtualPointer.current = true;
      if (!editable(event.target)) return;
      if (event.target.closest?.('.meal-editor') && document.activeElement !== event.target) {
        event.preventDefault();
        event.target.focus({ preventScroll: true });
      }
      openFor(event.target);
    };
    const physicalKeyDown = () => { virtualPointer.current = false; setTarget(null); };
    const focusOut = event => { if (!preserveFocus.current && !event.relatedTarget?.closest?.('.screen-keyboard, [data-preserve-keyboard]')) setTimeout(() => { if (!document.activeElement?.closest?.('[data-preserve-keyboard]') && !editable(document.activeElement)) setTarget(null); }, 0); };
    document.addEventListener('pointerdown', pointerDown, true); document.addEventListener('keydown', physicalKeyDown, true); document.addEventListener('focusin', focusIn); document.addEventListener('focusout', focusOut);
    return () => { document.removeEventListener('pointerdown', pointerDown, true); document.removeEventListener('keydown', physicalKeyDown, true); document.removeEventListener('focusin', focusIn); document.removeEventListener('focusout', focusOut); };
  }, [isTabletKeyboard]);
  if (!isTabletKeyboard) return null;
  if (!target?.isConnected) return null;
  const isNumeric = ['number','tel'].includes(target.type) || target.inputMode === 'numeric' || target.inputMode === 'decimal';
  const updateValue = (value, cursor) => {
    const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus({ preventScroll: true });
    try { target.setSelectionRange(cursor, cursor); } catch {}
  };
  const applyKey = key => {
    if (key === 'close') { setTarget(null); target.blur(); return; }
    if (key === 'shift') { setShift(value => !value); return; }
    if (key === 'enter') {
      if (target instanceof HTMLTextAreaElement) key = '\n';
      else {
        const continueDefault = target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        if (continueDefault) target.form?.requestSubmit();
        setTarget(null); target.blur(); return;
      }
    }
    const value = String(target.value || ''); let start = value.length; let end = value.length;
    try { start = target.selectionStart ?? value.length; end = target.selectionEnd ?? start; } catch {}
    if (key === 'backspace') {
      if (start === end && start > 0) start -= 1;
      updateValue(`${value.slice(0, start)}${value.slice(end)}`, start); return;
    }
    const text = key === 'space' ? ' ' : shift ? key.toLocaleUpperCase('de-DE') : key;
    if (target.maxLength > -1 && value.length - (end - start) + text.length > target.maxLength) return;
    updateValue(`${value.slice(0, start)}${text}${value.slice(end)}`, start + text.length);
    if (shift) setShift(false);
  };
  const label = key => key === 'shift' ? (shift ? '⇧' : '⇧') : key === 'backspace' ? '⌫' : key === 'space' ? 'Leertaste' : key === 'enter' ? 'Enter' : key === 'close' ? 'Schließen' : shift ? key.toLocaleUpperCase('de-DE') : key;
  return <section className={`screen-keyboard ${isNumeric ? 'numeric' : ''}`} aria-label="Bildschirmtastatur" onPointerDown={event => event.preventDefault()}>
    <div className="screen-keyboard-grip" />
    {(isNumeric ? NUMERIC_KEYBOARD_ROWS : KEYBOARD_ROWS).map((row, rowIndex) => <div className="keyboard-row" key={rowIndex}>{row.map(key => <button type="button" key={key} className={`key-${key} ${key === 'shift' && shift ? 'active' : ''}`} onPointerDown={event => { event.preventDefault(); applyKey(key); }}>{label(key)}</button>)}</div>)}
  </section>;
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<><App /><OnScreenKeyboard /></>);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

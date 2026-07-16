import { execFile } from 'node:child_process';

const ADDRESS_PATTERN = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
const discoveryCache = new Map();
let lastScanAddresses = new Set();
let lastScan = null;
const cleanOutput = (value = '') => String(value).replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
const field = (output, name) => cleanOutput(output).match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'mi'))?.[1]?.trim() || '';
const booleanField = (output, name) => field(output, name).toLowerCase() === 'yes';
const readableName = (address, ...values) => values.map(value => String(value || '').trim()).find(value => value && value.toUpperCase() !== address.toUpperCase() && !ADDRESS_PATTERN.test(value)) || 'Unbekanntes Gerät';

const runBluetoothctl = (args, timeout = 12_000) => new Promise((resolve, reject) => {
  execFile('bluetoothctl', args, { timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    const output = cleanOutput(`${stdout || ''}\n${stderr || ''}`).trim();
    if (error) {
      const message = output || (error.code === 'ENOENT' ? 'Bluetooth-Werkzeuge sind nicht installiert.' : error.message);
      reject(new Error(message));
      return;
    }
    resolve(output);
  });
});

export const parseBluetoothDevice = (address, name, output = '') => ({
  address,
  name: readableName(address, field(output, 'Name'), field(output, 'Alias'), name),
  alias: field(output, 'Alias') || '',
  icon: field(output, 'Icon') || '',
  paired: booleanField(output, 'Paired'),
  bonded: booleanField(output, 'Bonded'),
  trusted: booleanField(output, 'Trusted'),
  connected: booleanField(output, 'Connected'),
  blocked: booleanField(output, 'Blocked'),
  rssi: Number(field(output, 'RSSI')) || null,
});

export const parseBluetoothScan = (output = '') => {
  const devices = new Map();
  for (const line of cleanOutput(output).split('\n')) {
    const property = line.match(/Device\s+((?:[0-9A-F]{2}:){5}[0-9A-F]{2})\s+(?:Name|Alias):\s*(.+)$/i);
    const discovered = line.match(/(?:^|\]\s+)Device\s+((?:[0-9A-F]{2}:){5}[0-9A-F]{2})\s+(.+)$/i);
    const match = property || discovered;
    if (!match) continue;
    const address = match[1].toUpperCase();
    const candidate = String(match[2] || '').trim();
    const propertyValue = /^(?:RSSI|TxPower|Class|Icon|UUIDs?|ManufacturerData|ServiceData|Connected|Paired|Bonded|Trusted|Blocked|ServicesResolved):/i.test(candidate) ? '' : candidate;
    const previous = devices.get(address);
    devices.set(address, { address, name: readableName(address, propertyValue, previous?.name) });
  }
  return [...devices.values()];
};

const assertSupported = () => {
  if (process.platform !== 'linux') throw Object.assign(new Error('Bluetooth-Geräte können nur auf dem Raspberry Pi verwaltet werden.'), { code: 'UNSUPPORTED' });
};

const assertAddress = (address) => {
  if (!ADDRESS_PATTERN.test(String(address || ''))) throw Object.assign(new Error('Ungültige Bluetooth-Adresse.'), { code: 'INVALID_ADDRESS' });
  return String(address).toUpperCase();
};

export async function getBluetoothState() {
  if (process.platform !== 'linux') return { available: false, powered: false, discovering: false, adapter: null, devices: [], message: 'Bluetooth ist in der Entwicklungsumgebung nicht verfügbar.' };
  try {
    const [showOutput, devicesOutput] = await Promise.all([runBluetoothctl(['show']), runBluetoothctl(['devices'])]);
    const address = cleanOutput(showOutput).match(/^Controller\s+((?:[0-9A-F]{2}:){5}[0-9A-F]{2})/mi)?.[1] || '';
    const rows = new Map(cleanOutput(devicesOutput).split('\n').map(line => line.match(/^Device\s+((?:[0-9A-F]{2}:){5}[0-9A-F]{2})\s+(.+)$/i)).filter(Boolean).map(match => [match[1].toUpperCase(), match[2].trim()]));
    for (const [deviceAddress, cached] of discoveryCache) rows.set(deviceAddress, readableName(deviceAddress, rows.get(deviceAddress), cached.name));
    const devices = await Promise.all([...rows].map(async ([deviceAddress, name]) => {
      let device;
      try { device = parseBluetoothDevice(deviceAddress, readableName(deviceAddress, discoveryCache.get(deviceAddress)?.name, name), await runBluetoothctl(['info', deviceAddress])); }
      catch { device = parseBluetoothDevice(deviceAddress, readableName(deviceAddress, discoveryCache.get(deviceAddress)?.name, name)); }
      return { ...device, recent: lastScanAddresses.has(deviceAddress), lastSeenAt: discoveryCache.get(deviceAddress)?.lastSeenAt || '' };
    }));
    devices.sort((a, b) => Number(b.connected) - Number(a.connected) || Number(b.paired) - Number(a.paired) || Number(b.recent) - Number(a.recent) || a.name.localeCompare(b.name, 'de'));
    return {
      available: Boolean(address),
      powered: booleanField(showOutput, 'Powered'),
      discovering: booleanField(showOutput, 'Discovering'),
      adapter: address ? { address: address.toUpperCase(), name: field(showOutput, 'Name') || field(showOutput, 'Alias') || 'Raspberry Pi' } : null,
      devices,
      scan: lastScan,
      message: address ? '' : 'Kein Bluetooth-Adapter wurde gefunden.',
    };
  } catch (error) {
    return { available: false, powered: false, discovering: false, adapter: null, devices: [], message: error instanceof Error ? error.message : 'Bluetooth-Status ist nicht verfügbar.' };
  }
}

export async function setBluetoothPower(powered) {
  assertSupported();
  await runBluetoothctl(['power', powered ? 'on' : 'off']);
  return getBluetoothState();
}

export async function scanBluetoothDevices() {
  assertSupported();
  await runBluetoothctl(['power', 'on']);
  let scanOutput = '';
  let mode = 'bredr';
  lastScanAddresses = new Set();
  try {
    try { scanOutput = await runBluetoothctl(['--timeout', '20', 'scan', 'bredr'], 24_000); }
    catch (error) {
      if (!/invalid|unknown|not available/i.test(error.message)) throw error;
      mode = 'auto';
      scanOutput = await runBluetoothctl(['--timeout', '20', 'scan', 'on'], 24_000);
    }
    const found = parseBluetoothScan(scanOutput);
    const lastSeenAt = new Date().toISOString();
    lastScanAddresses = new Set(found.map(device => device.address));
    for (const device of found) discoveryCache.set(device.address, { ...device, lastSeenAt });
    lastScan = { mode, found: found.length, named: found.filter(device => device.name !== 'Unbekanntes Gerät').length, completedAt: lastSeenAt };
  }
  finally { await runBluetoothctl(['scan', 'off']).catch(() => {}); }
  return getBluetoothState();
}

export async function controlBluetoothDevice(addressValue, action) {
  assertSupported();
  const address = assertAddress(addressValue);
  if (action === 'pair') {
    await runBluetoothctl(['power', 'on']);
    await runBluetoothctl(['--agent', 'NoInputNoOutput', 'pair', address], 30_000);
    await runBluetoothctl(['trust', address]);
    await runBluetoothctl(['connect', address], 20_000);
  } else if (action === 'connect') {
    await runBluetoothctl(['connect', address], 20_000);
  } else if (action === 'disconnect') {
    await runBluetoothctl(['disconnect', address]);
  } else if (action === 'remove') {
    await runBluetoothctl(['remove', address]);
  } else {
    throw Object.assign(new Error('Unbekannte Bluetooth-Aktion.'), { code: 'INVALID_ACTION' });
  }
  return getBluetoothState();
}

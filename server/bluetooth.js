import { execFile } from 'node:child_process';

const ADDRESS_PATTERN = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
const cleanOutput = (value = '') => String(value).replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
const field = (output, name) => cleanOutput(output).match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'mi'))?.[1]?.trim() || '';
const booleanField = (output, name) => field(output, name).toLowerCase() === 'yes';

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
  name: field(output, 'Name') || field(output, 'Alias') || name || 'Bluetooth-Gerät',
  alias: field(output, 'Alias') || '',
  icon: field(output, 'Icon') || '',
  paired: booleanField(output, 'Paired'),
  bonded: booleanField(output, 'Bonded'),
  trusted: booleanField(output, 'Trusted'),
  connected: booleanField(output, 'Connected'),
  blocked: booleanField(output, 'Blocked'),
  rssi: Number(field(output, 'RSSI')) || null,
});

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
    const deviceRows = cleanOutput(devicesOutput).split('\n').map(line => line.match(/^Device\s+((?:[0-9A-F]{2}:){5}[0-9A-F]{2})\s+(.+)$/i)).filter(Boolean);
    const devices = await Promise.all(deviceRows.map(async match => {
      try { return parseBluetoothDevice(match[1].toUpperCase(), match[2].trim(), await runBluetoothctl(['info', match[1]])); }
      catch { return parseBluetoothDevice(match[1].toUpperCase(), match[2].trim()); }
    }));
    devices.sort((a, b) => Number(b.connected) - Number(a.connected) || Number(b.paired) - Number(a.paired) || a.name.localeCompare(b.name, 'de'));
    return {
      available: Boolean(address),
      powered: booleanField(showOutput, 'Powered'),
      discovering: booleanField(showOutput, 'Discovering'),
      adapter: address ? { address: address.toUpperCase(), name: field(showOutput, 'Name') || field(showOutput, 'Alias') || 'Raspberry Pi' } : null,
      devices,
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
  try { await runBluetoothctl(['--timeout', '8', 'scan', 'on'], 11_000); }
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

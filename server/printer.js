import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const normalizeText = (value) => String(value ?? '')
  .replaceAll('€', 'EUR')
  .replaceAll('–', '-')
  .replaceAll('—', '-')
  .replaceAll('…', '...')
  .replace(/[^\x20-\x7eäöüÄÖÜß]/g, '')
  .trim();

function encodePrinterText(value) {
  const bytes = [];
  const special = { ä: 0x84, ö: 0x94, ü: 0x81, Ä: 0x8e, Ö: 0x99, Ü: 0x9a, ß: 0xe1 };
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 0x0a || code === 0x0d || code === 0x09 || (code >= 0x20 && code <= 0x7e)) bytes.push(code);
    else bytes.push(special[char] ?? 0x20);
  }
  return Buffer.from(bytes);
}

const center = (value, width) => {
  const text = normalizeText(value).slice(0, width);
  return `${' '.repeat(Math.max(0, Math.floor((width - text.length) / 2)))}${text}`;
};

function wrap(value, width) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current = `${current} ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function buildHouseReceipt({ type, paperWidth, autoCut, tasks, shopping, context = {} }) {
  const width = paperWidth === 80 ? 48 : 32;
  const lines = [center('HOUSEOS', width), center(type === 'daily' ? 'TAGESUEBERSICHT' : type === 'shopping' ? 'EINKAUFSLISTE' : 'AUFGABENLISTE', width), '-'.repeat(width), formatDate()];

  if (type === 'daily') {
    lines.push('', 'STANDORT', context.location || 'Standort nicht verfuegbar', '', 'WETTER');
    lines.push(...wrap(context.weatherText || 'Wetterdaten nicht verfuegbar', width));
    lines.push('', 'OFFENE AUFGABEN');
    for (const task of tasks.filter(item => !item.done)) {
      const schedule = [task.dueDate, task.time].filter(Boolean).join(' ');
      lines.push(...wrap(`[ ] ${task.text} - ${task.person}${schedule ? ` - ${schedule}` : ''}`, width));
    }
    lines.push('', 'EINKAUF');
    for (const item of shopping.filter(item => !item.checked)) lines.push(...wrap(`[ ] ${item.text}`, width));
  } else if (type === 'shopping') {
    for (const item of shopping.filter(item => !item.checked)) lines.push(...wrap(`[ ] ${item.text} (${item.category})`, width));
  } else {
    for (const task of tasks.filter(item => !item.done)) {
      const schedule = [task.dueDate, task.time].filter(Boolean).join(' ');
      lines.push(...wrap(`[ ] ${task.text} - ${task.person}${schedule ? ` - ${schedule}` : ''}`, width));
    }
  }

  lines.push('', '-'.repeat(width), center('Zuhause laeuft alles.', width), center('houseos.local', width), '', '', '');
  const commands = [
    Buffer.from([0x1b, 0x40]),
    Buffer.from([0x1b, 0x74, 0x02]),
    Buffer.from([0x1b, 0x4d, 0x00]),
    encodePrinterText(lines.join('\n')),
    encodePrinterText('\n'),
  ];
  if (autoCut) commands.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
  return { buffer: Buffer.concat(commands), lines, charactersPerLine: width };
}

export async function listPrinters() {
  if (process.platform !== 'win32') {
    try {
      const [{ stdout: printersOutput }, { stdout: defaultOutput }] = await Promise.all([
        execFileAsync('lpstat', ['-p'], { timeout: 10000 }),
        execFileAsync('lpstat', ['-d'], { timeout: 10000 }).catch(() => ({ stdout: '' })),
      ]);
      const defaultName = defaultOutput.match(/:\s*(.+)\s*$/)?.[1]?.trim() || '';
      return printersOutput.split(/\r?\n/).filter(line => line.startsWith('printer ')).map(line => {
        const name = line.match(/^printer\s+(\S+)/)?.[1] || '';
        return { name, isDefault: name === defaultName, offline: /disabled|not accepting/i.test(line) };
      }).filter(printer => printer.name);
    } catch { return []; }
  }
  const command = "Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline | ConvertTo-Json -Compress";
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, timeout: 10000 });
    const parsed = stdout.trim() ? JSON.parse(stdout.trim()) : [];
    return (Array.isArray(parsed) ? parsed : [parsed]).map(item => ({ name: item.Name, isDefault: Boolean(item.Default), offline: Boolean(item.WorkOffline) }));
  } catch {
    return [];
  }
}

async function printRawToWindowsPrinter(printerName, data) {
  const workDir = path.join(tmpdir(), `houseos-receipt-${randomUUID()}`);
  const dataPath = path.join(workDir, 'receipt.bin');
  const scriptPath = path.join(workDir, 'print-raw.ps1');
  const script = `
param([string]$PrinterName, [string]$DataPath)
$source = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class HouseOSRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)] public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)] public static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr printer);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)] public static extern bool StartDocPrinter(IntPtr printer, int level, [In] DOCINFOA info);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr printer);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr printer);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr printer);
  [DllImport("winspool.Drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr printer, byte[] bytes, int count, out int written);
  public static void Send(string printerName, string filePath) {
    IntPtr printer;
    if (!OpenPrinter(printerName, out printer, IntPtr.Zero)) throw new Exception("Drucker konnte nicht geöffnet werden: " + Marshal.GetLastWin32Error());
    try {
      byte[] bytes = File.ReadAllBytes(filePath);
      DOCINFOA info = new DOCINFOA(); info.pDocName = "HouseOS Bon"; info.pDataType = "RAW";
      if (!StartDocPrinter(printer, 1, info)) throw new Exception("Druckauftrag konnte nicht gestartet werden: " + Marshal.GetLastWin32Error());
      if (!StartPagePrinter(printer)) throw new Exception("Druckseite konnte nicht gestartet werden: " + Marshal.GetLastWin32Error());
      int written;
      if (!WritePrinter(printer, bytes, bytes.Length, out written) || written != bytes.Length) throw new Exception("Druckdaten konnten nicht vollständig gesendet werden: " + Marshal.GetLastWin32Error());
      EndPagePrinter(printer); EndDocPrinter(printer);
    } finally { ClosePrinter(printer); }
  }
}

"@
Add-Type -TypeDefinition $source
[HouseOSRawPrinter]::Send($PrinterName, $DataPath)
`;
  await mkdir(workDir, { recursive: true });
  await writeFile(dataPath, data);
  await writeFile(scriptPath, script);
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, printerName, dataPath], { windowsHide: true, timeout: 30000 });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function printRawToCups(printerName, data) {
  const workDir = path.join(tmpdir(), `houseos-receipt-${randomUUID()}`);
  const dataPath = path.join(workDir, 'receipt.bin');
  await mkdir(workDir, { recursive: true });
  await writeFile(dataPath, data);
  try {
    await execFileAsync('lp', ['-d', printerName, '-o', 'raw', dataPath], { timeout: 30000 });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function printHouseReceipt(options) {
  const receipt = buildHouseReceipt(options);
  if (options.dryRun) return { ok: true, message: `Trockenlauf erfolgreich: ${receipt.buffer.length} Bytes für ${options.paperWidth} mm erzeugt.`, bytes: receipt.buffer.length, charactersPerLine: receipt.charactersPerLine };
  if (!options.printerName?.trim()) return { ok: false, message: 'Bitte zuerst einen Drucker auswählen.' };
  try {
    if (process.platform === 'win32') await printRawToWindowsPrinter(options.printerName.trim(), receipt.buffer);
    else await printRawToCups(options.printerName.trim(), receipt.buffer);
    return { ok: true, message: `Bon wurde direkt an „${options.printerName.trim()}“ gesendet.`, bytes: receipt.buffer.length, charactersPerLine: receipt.charactersPerLine };
  } catch (error) {
    return { ok: false, message: `Direktdruck fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` };
  }
}

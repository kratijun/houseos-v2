import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const home = path.resolve(process.env.HOUSEOS_HOME || '/opt/houseos');
const dataDir = path.resolve(process.env.HOUSEOS_DATA_DIR || '/var/lib/houseos');
const pendingPath = path.join(dataDir, 'pending-update.json');
const statusPath = path.join(dataDir, 'update-status.json');
const workRoot = path.resolve(process.env.HOUSEOS_UPDATE_DIR || '/var/tmp/houseos-update');
const token = process.env.GITHUB_TOKEN || '';
const writeStatus = (status, message, extra = {}) => fs.writeFileSync(statusPath, JSON.stringify({ status, message, updatedAt: new Date().toISOString(), ...extra }, null, 2));
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options });

async function main() {
  if (!fs.existsSync(pendingPath)) throw new Error('Kein vorbereitetes Update gefunden.');
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(pending.repository || '')) throw new Error('Ungültiges Repository.');
  if (!/^https:\/\/api\.github\.com\/repos\//.test(pending.artifactApiUrl || '')) throw new Error('Ungültige Downloadquelle.');
  if (!/^[a-f0-9]{64}$/i.test(pending.digest || '')) throw new Error('SHA-256-Prüfsumme fehlt.');
  writeStatus('installing', `HouseOS ${pending.version} wird installiert.`, { version: pending.version });
  fs.rmSync(workRoot, { recursive: true, force: true });
  const stage = path.join(workRoot, 'stage');
  const backup = path.join(workRoot, 'backup');
  fs.mkdirSync(stage, { recursive: true });
  const response = await fetch(pending.artifactApiUrl, { headers: { Accept: 'application/octet-stream', 'User-Agent': 'HouseOS-Updater', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, redirect: 'follow' });
  if (!response.ok) throw new Error(`Download fehlgeschlagen: ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const actualDigest = createHash('sha256').update(archive).digest('hex');
  if (actualDigest.toLowerCase() !== pending.digest.toLowerCase()) throw new Error('SHA-256-Prüfung fehlgeschlagen.');
  const archivePath = path.join(workRoot, 'houseos.tar.gz');
  fs.writeFileSync(archivePath, archive);
  run('tar', ['-xzf', archivePath, '-C', stage]);
  const stagedPackage = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
  if (String(stagedPackage.version) !== String(pending.version)) throw new Error('Release-Version stimmt nicht mit dem Paket überein.');
  fs.mkdirSync(backup, { recursive: true });
  run('rsync', ['-a', '--delete', '--exclude', 'data', '--exclude', '.env', '--exclude', '.updates', `${home}/`, `${backup}/`]);
  try {
    run('rsync', ['-a', '--delete', '--exclude', 'data', '--exclude', '.env', '--exclude', '.updates', `${stage}/`, `${home}/`]);
    run('npm', ['ci', '--omit=dev'], { cwd: home });
    fs.rmSync(pendingPath, { force: true });
    writeStatus('installed', `HouseOS ${pending.version} wurde installiert und wird neu gestartet.`, { version: pending.version });
    run('systemctl', ['restart', 'houseos.service']);
  } catch (error) {
    run('rsync', ['-a', '--delete', `${backup}/`, `${home}/`]);
    writeStatus('rolled-back', `Update fehlgeschlagen, vorherige Version wiederhergestellt: ${error.message}`, { version: pending.version });
    run('systemctl', ['restart', 'houseos.service']);
    throw error;
  }
}

main().catch(error => {
  fs.mkdirSync(dataDir, { recursive: true });
  writeStatus('error', error instanceof Error ? error.message : 'Unbekannter Updatefehler.');
  process.exitCode = 1;
});

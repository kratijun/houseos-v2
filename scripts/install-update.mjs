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
  writeStatus('downloading', `HouseOS ${pending.version} wird heruntergeladen.`, { version: pending.version, progress: 12 });
  fs.rmSync(workRoot, { recursive: true, force: true });
  const stage = path.join(workRoot, 'stage');
  const backup = path.join(workRoot, 'backup');
  fs.mkdirSync(stage, { recursive: true });
  const response = await fetch(pending.artifactApiUrl, { headers: { Accept: 'application/octet-stream', 'User-Agent': 'HouseOS-Updater', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, redirect: 'follow' });
  if (!response.ok) throw new Error(`Download fehlgeschlagen: ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  writeStatus('verifying', 'Download wird mit der SHA-256-Prüfsumme verglichen.', { version: pending.version, progress: 30 });
  const actualDigest = createHash('sha256').update(archive).digest('hex');
  if (actualDigest.toLowerCase() !== pending.digest.toLowerCase()) throw new Error('SHA-256-Prüfung fehlgeschlagen.');
  const archivePath = path.join(workRoot, 'houseos.tar.gz');
  fs.writeFileSync(archivePath, archive);
  writeStatus('extracting', 'Updatepaket wird entpackt und geprüft.', { version: pending.version, progress: 45 });
  run('tar', ['-xzf', archivePath, '-C', stage]);
  const stagedPackage = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
  if (String(stagedPackage.version) !== String(pending.version)) throw new Error('Release-Version stimmt nicht mit dem Paket überein.');
  fs.mkdirSync(backup, { recursive: true });
  writeStatus('backup', 'Die aktuelle HouseOS-Installation wird gesichert.', { version: pending.version, progress: 58 });
  run('rsync', ['-a', '--delete', '--exclude', 'data', '--exclude', '.env', '--exclude', '.updates', `${home}/`, `${backup}/`]);
  try {
    writeStatus('installing', 'Neue Programmdateien werden installiert.', { version: pending.version, progress: 72 });
    run('rsync', ['-a', '--delete', '--exclude', 'data', '--exclude', '.env', '--exclude', '.updates', `${stage}/`, `${home}/`]);
    writeStatus('dependencies', 'Abhängigkeiten werden eingerichtet.', { version: pending.version, progress: 86 });
    run('npm', ['ci', '--omit=dev'], { cwd: home });
    run('bash', [path.join(home, 'deploy', 'optimize-kiosk-start.sh')]);
    fs.rmSync(pendingPath, { force: true });
  } catch (error) {
    run('rsync', ['-a', '--delete', `${backup}/`, `${home}/`]);
    writeStatus('rolled-back', `Update fehlgeschlagen, vorherige Version wiederhergestellt: ${error.message}`, { version: pending.version });
    run('systemctl', ['restart', 'houseos.service']);
    throw error;
  }
  writeStatus('restarting', `HouseOS ${pending.version} ist installiert. Der HouseOS-Dienst wird jetzt neu gestartet.`, { version: pending.version, progress: 100, restartTarget: 'houseos' });
  try { run('systemctl', ['restart', 'houseos.service']); }
  catch (error) {
    writeStatus('error', `HouseOS ${pending.version} wurde installiert, aber der HouseOS-Dienst konnte nicht neu gestartet werden: ${error.message}`, { version: pending.version, progress: 100 });
    process.exitCode = 1;
  }
}

main().catch(error => {
  fs.mkdirSync(dataDir, { recursive: true });
  writeStatus('error', error instanceof Error ? error.message : 'Unbekannter Updatefehler.');
  process.exitCode = 1;
});

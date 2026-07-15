const cleanVersion = (value = '') => String(value).trim().replace(/^v/i, '').split('-')[0];

export const compareVersions = (left, right) => {
  const a = cleanVersion(left).split('.').map(part => Number(part) || 0);
  const b = cleanVersion(right).split('.').map(part => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
};

export const validRepository = (repository = '') => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);

export async function getLatestRelease({ repository, currentVersion, token = '' }) {
  if (!validRepository(repository)) return { configured: false, currentVersion, message: 'GitHub-Repository ist noch nicht konfiguriert.' };
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'HouseOS-Updater',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, { headers });
  if (response.status === 404) return { configured: true, currentVersion, message: 'Noch kein veröffentlichtes Release gefunden.', hasUpdate: false };
  if (!response.ok) throw new Error(`GitHub antwortet mit Status ${response.status}.`);
  const release = await response.json();
  const version = cleanVersion(release.tag_name);
  const artifactName = `houseos-${version}.tar.gz`;
  const artifact = release.assets?.find(asset => asset.name === artifactName);
  const digest = artifact?.digest?.startsWith('sha256:') ? artifact.digest.slice(7) : '';
  const hasUpdate = compareVersions(version, currentVersion) > 0;
  return {
    configured: true,
    repository,
    currentVersion,
    latestVersion: version,
    releaseName: release.name || release.tag_name,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
    notes: String(release.body || '').slice(0, 1200),
    hasUpdate,
    installable: Boolean(artifact && digest),
    artifact: artifact ? { name: artifact.name, apiUrl: artifact.url, downloadUrl: artifact.browser_download_url, digest, size: artifact.size } : null,
    message: !hasUpdate ? 'HouseOS ist aktuell.' : artifact && digest ? `Version ${version} ist bereit.` : 'Release gefunden, aber das geprüfte Update-Artefakt fehlt.',
  };
}

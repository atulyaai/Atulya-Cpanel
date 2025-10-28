export type OsFamily = 'ubuntu' | 'debian' | 'rhel' | 'windows' | 'unknown';

export function detectOs(): OsFamily {
  if (process.platform === 'win32') return 'windows';
  try {
    const osRelease = require('fs').readFileSync('/etc/os-release', 'utf8');
    if (/ubuntu/i.test(osRelease)) return 'ubuntu';
    if (/debian/i.test(osRelease)) return 'debian';
    if (/centos|rhel|rocky|alma/i.test(osRelease)) return 'rhel';
  } catch {}
  return 'unknown';
}


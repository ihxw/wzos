/** Normalize path separators to forward slashes. */
export function normalizePath(path: string): string {
  if (!path) return path;
  return path.replace(/\\/g, '/');
}

/** Detect Windows-style drive paths (e.g. C:/ or C:). */
export function isWindowsDriveRoot(path: string): boolean {
  return /^[A-Za-z]:\/?$/.test(normalizePath(path));
}

function isLocalWindowsDev(): boolean {
  if (typeof location === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  return local && navigator.platform?.toLowerCase().includes('win');
}

/** Default root path for file browsing (server paths when using remote panel). */
export function defaultRootPath(): string {
  if (isLocalWindowsDev()) {
    return 'C:/';
  }
  return '/';
}

/** User home directory path used in sidebar shortcuts. */
export function defaultHomePath(): string {
  if (isLocalWindowsDev()) {
    return 'C:/Users';
  }
  return '/home';
}

/** Parent directory of the given path. */
export function getParentPath(path: string): string {
  const p = normalizePath(path);
  if (p === '/' || isWindowsDriveRoot(p)) return p;

  const idx = p.lastIndexOf('/');
  if (idx <= 0) {
    if (/^[A-Za-z]:/.test(p)) return p.slice(0, 2) + '/';
    return '/';
  }
  const parent = p.substring(0, idx);
  if (/^[A-Za-z]:$/.test(parent)) return parent + '/';
  return parent || '/';
}

/** Build breadcrumb segments for a path. */
export function pathToBreadcrumbs(path: string): { name: string; path: string }[] {
  const p = normalizePath(path);
  if (!p || p === '/') {
    return [{ name: '/', path: '/' }];
  }

  const crumbs: { name: string; path: string }[] = [];

  if (/^[A-Za-z]:/.test(p)) {
    const drive = p.slice(0, 2);
    crumbs.push({ name: drive, path: drive + '/' });
    const rest = p.slice(2).replace(/^\//, '');
    if (!rest) return crumbs;
    const parts = rest.split('/').filter(Boolean);
    let accumulated = drive + '/';
    for (const part of parts) {
      accumulated += part + '/';
      crumbs.push({ name: part, path: accumulated.replace(/\/$/, '') || accumulated });
    }
    // Fix last crumb path (no trailing slash except drive root)
    const last = crumbs[crumbs.length - 1];
    last.path = p;
    return crumbs;
  }

  const parts = p.split('/').filter(Boolean);
  crumbs.push({ name: '/', path: '/' });
  let accumulated = '';
  for (const part of parts) {
    accumulated += '/' + part;
    crumbs.push({ name: part, path: accumulated });
  }
  return crumbs;
}

/** Ancestor paths from root to target (inclusive). */
export function pathAncestors(targetPath: string): string[] {
  const crumbs = pathToBreadcrumbs(targetPath);
  return crumbs.map(c => c.path);
}

/** Desktop folder candidates for the current user. */
export function desktopPathCandidates(username?: string): string[] {
  const isWin = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('win');
  if (isWin) {
    const candidates: string[] = [];
    if (username) {
      candidates.push(`C:/Users/${username}/Desktop`);
    }
    candidates.push('C:/Users/Public/Desktop');
    return candidates;
  }

  const candidates = ['/home/yu/Desktop', '/home/yu/桌面'];
  if (username && username !== 'yu') {
    candidates.unshift(`/home/${username}/Desktop`, `/home/${username}/桌面`, `/home/${username}`);
  }
  candidates.push('/root/Desktop', '/root/桌面', '/root', '/home', '/');
  return candidates;
}

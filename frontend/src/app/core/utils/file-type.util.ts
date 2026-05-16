export type MediaType = 'image' | 'audio' | 'video';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'm4a', 'opus', 'aiff', 'ape']);
const VIDEO_EXTS = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'mpeg', 'mpg', '3gp']);
const PDF_EXTS = new Set(['pdf']);
const ARCHIVE_EXTS = new Set(['zip', 'rar', 'tar', 'gz', 'bz2', 'xz', '7z', 'tgz', 'tbz2', 'zst', 'deb', 'rpm']);

export function getExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function getMediaType(fileName: string): MediaType | null {
  const ext = getExtension(fileName);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return null;
}

export function isMediaFile(fileName: string): boolean {
  return getMediaType(fileName) !== null;
}

export function isPdfFile(fileName: string): boolean {
  return PDF_EXTS.has(getExtension(fileName));
}

export function isArchiveFile(fileName: string): boolean {
  return ARCHIVE_EXTS.has(getExtension(fileName));
}

export function parentDirectory(filePath: string): string {
  if (!filePath || filePath === '/') return '/';
  const normalized = filePath.replace(/\/+$/, '');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '/';
  return normalized.slice(0, idx) || '/';
}

export function fileViewUrl(filePath: string): string {
  return `/api/files/view?path=${encodeURIComponent(filePath)}`;
}

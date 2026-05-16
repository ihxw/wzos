import { FileInfo, FileMediaType, FileOpenWith } from '../services/file.service';
import { getMediaType, isArchiveFile, isMediaFile, isPdfFile } from './file-type.util';
import { isTextFile } from './text-file.util';

/** Resolve how to open a file; prefers server-provided openWith. */
export function resolveOpenWith(file: FileInfo): FileOpenWith {
  if (file.isDir || file.kind === 'directory') {
    return 'file-manager';
  }
  if (file.openWith) {
    return file.openWith;
  }
  if (file.kind === 'text') return 'text-editor';
  if (file.kind === 'media') return 'media-viewer';
  if (file.kind === 'pdf') return 'browser';
  if (file.kind === 'archive') return 'reveal';

  if (isMediaFile(file.name)) return 'media-viewer';
  if (isTextFile(file.name)) return 'text-editor';
  if (isPdfFile(file.name)) return 'browser';
  if (isArchiveFile(file.name)) return 'reveal';
  return 'reveal';
}

export function resolveMediaType(file: FileInfo): FileMediaType | null {
  if (file.mediaType) return file.mediaType;
  return getMediaType(file.name);
}

export function isMediaFileInfo(file: FileInfo): boolean {
  return file.kind === 'media' || file.openWith === 'media-viewer' || isMediaFile(file.name);
}

export function isTextFileInfo(file: FileInfo): boolean {
  return file.kind === 'text' || file.openWith === 'text-editor' || isTextFile(file.name);
}

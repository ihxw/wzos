import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { FileInfo } from './file.service';
import { WindowManagerService } from './window-manager.service';
import { FileManagerComponent } from '../../components/file-manager/file-manager';
import { MediaViewerComponent, MediaFile } from '../../components/media-viewer/media-viewer';
import { TextEditorComponent } from '../../components/text-editor/text-editor';
import { fileViewUrl, parentDirectory } from '../utils/file-type.util';
import { isMediaFileInfo, resolveMediaType, resolveOpenWith } from '../utils/file-open.util';

export interface FileNavigateRequest {
  path: string;
  selectPath?: string;
}

export interface OpenFileContext {
  /** Files in the same folder (for media browser). */
  siblingFiles?: FileInfo[];
}

@Injectable({ providedIn: 'root' })
export class FileOpenService {
  private readonly navigateSubject = new Subject<FileNavigateRequest>();
  readonly navigateRequest$ = this.navigateSubject.asObservable();

  constructor(private windowManager: WindowManagerService) {}

  open(file: FileInfo, context: OpenFileContext = {}): void {
    switch (resolveOpenWith(file)) {
      case 'file-manager':
        this.openFileManager(file.path);
        break;
      case 'text-editor':
        this.openTextEditor(file);
        break;
      case 'media-viewer':
        this.openMediaViewer(file, context.siblingFiles);
        break;
      case 'browser':
        this.openInBrowser(file);
        break;
      case 'reveal':
      default:
        this.revealInFileManager(file);
        break;
    }
  }

  openFileManager(folderPath: string, selectPath?: string): void {
    const title = folderPath === '/' ? 'Files' : folderPath.split('/').pop() || 'Files';
    this.windowManager.openWindow('file-manager', title, FileManagerComponent, {
      inputs: {
        initialPath: folderPath,
        selectPath: selectPath ?? '',
      },
    });
    this.navigateSubject.next({ path: folderPath, selectPath });
  }

  revealInFileManager(file: FileInfo): void {
    const folder = parentDirectory(file.path);
    this.openFileManager(folder, file.path);
  }

  openTextEditor(file: FileInfo): void {
    this.windowManager.openWindow('text-editor', file.name, TextEditorComponent, {
      size: { width: 920, height: 680 },
      position: { x: 140, y: 90 },
      inputs: {
        filePath: file.path,
        fileName: file.name,
        language: file.language ?? '',
      },
    });
  }

  openMediaViewer(file: FileInfo, siblings?: FileInfo[]): void {
    const pool = (siblings ?? []).filter(f => !f.isDir && isMediaFileInfo(f));
    const mediaFiles: MediaFile[] = [];
    for (const f of pool.length > 0 ? pool : [file]) {
      const type = resolveMediaType(f);
      if (!type) continue;
      mediaFiles.push({
        name: f.name,
        path: f.path,
        type,
        fileType: f.extension,
      });
    }

    if (mediaFiles.length === 0) {
      this.revealInFileManager(file);
      return;
    }

    const idx = mediaFiles.findIndex(f => f.path === file.path);

    this.windowManager.openWindow('image-viewer', file.name, MediaViewerComponent, {
      size: { width: 900, height: 640 },
      position: { x: 120, y: 80 },
      inputs: {
        files: mediaFiles,
        currentIndex: idx >= 0 ? idx : 0,
        windowTitle: file.name,
      },
    });
  }

  openInBrowser(file: FileInfo): void {
    window.open(fileViewUrl(file.path), '_blank', 'noopener,noreferrer');
  }
}

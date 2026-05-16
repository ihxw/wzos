import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type FileKind = 'directory' | 'text' | 'media' | 'pdf' | 'archive' | 'unknown';
export type FileOpenWith = 'file-manager' | 'text-editor' | 'media-viewer' | 'browser' | 'reveal';
export type FileMediaType = 'image' | 'audio' | 'video';

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
  permissions: string;
  /** From API — preferred for open-app routing */
  kind?: FileKind;
  openWith?: FileOpenWith;
  mimeType?: string;
  extension?: string;
  mediaType?: FileMediaType;
  /** Monaco language id */
  language?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = '/api/files';

  constructor(private http: HttpClient) {}

  listFiles(path: string): Observable<FileInfo[]> {
    return this.http.get<FileInfo[]>(`${this.apiUrl}/list?path=${encodeURIComponent(path)}`);
  }

  getFavorites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/favorites`);
  }

  deleteFile(path: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { path });
  }

  renameFile(oldPath: string, newPath: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/rename`, { oldPath, newPath });
  }

  createFileOrFolder(path: string, isDir: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, { path, isDir });
  }

  copyFile(src: string, dst: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/copy`, { src, dst });
  }

  addFavorite(name: string, path: string, icon: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/favorites/add`, { name, path, icon });
  }

  deleteFavorite(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/favorites/delete`, { id });
  }

  searchFiles(path: string, query: string): Observable<FileInfo[]> {
    return this.http.get<FileInfo[]>(`${this.apiUrl}/search?path=${encodeURIComponent(path)}&query=${encodeURIComponent(query)}`);
  }

  // Trash
  trashMove(path: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/trash/move`, { path });
  }
  trashList(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/trash/list`);
  }
  trashRestore(name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/trash/restore`, { name });
  }
  trashEmpty(): Observable<any> {
    return this.http.post(`${this.apiUrl}/trash/empty`, {});
  }

  // Duplicate
  duplicateFile(path: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/duplicate`, { path });
  }

  // Compress / Extract
  compressFile(path: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/compress`, { path });
  }
  extractFile(path: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/extract`, { path });
  }

  // Recent
  getRecent(): Observable<FileInfo[]> {
    return this.http.get<FileInfo[]>(`${this.apiUrl}/recent`);
  }
  addRecent(file: FileInfo): Observable<any> {
    return this.http.post(`${this.apiUrl}/recent/add`, file);
  }

  readContent(path: string): Observable<{ path: string; content: string; size: number }> {
    return this.http.get<{ path: string; content: string; size: number }>(
      `${this.apiUrl}/content?path=${encodeURIComponent(path)}`
    );
  }

  writeContent(path: string, content: string): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/content`, { path, content });
  }

  getDiskUsage(path: string): Observable<{ total: number; used: number; free: number }> {
    return this.http.get<{ total: number; used: number; free: number }>(
      `${this.apiUrl}/diskusage?path=${encodeURIComponent(path)}`
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
  permissions: string;
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
}

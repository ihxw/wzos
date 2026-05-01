import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { FileService, FileInfo } from '../../core/services/file.service';

@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NzTableModule, NzButtonModule, 
    NzIconModule, NzInputModule, NzDividerModule, NzDropDownModule
  ],
  templateUrl: './file-manager.html',
  styleUrls: ['./file-manager.scss']
})
export class FileManagerComponent implements OnInit {
  currentPath: string = '';
  files: FileInfo[] = [];
  selectedFile: FileInfo | null = null;
  
  // Quick windows check
  isWindows: boolean = navigator.platform.toLowerCase().includes('win');

  constructor(private fileService: FileService) {}

  ngOnInit(): void {
    this.currentPath = this.isWindows ? 'C:\\' : '/';
    this.loadFiles(this.currentPath);
  }

  loadFiles(path: string): void {
    if (!path) return;
    this.currentPath = path;
    this.fileService.listFiles(path).subscribe({
      next: (data) => {
        // Sort: directories first, then alphabetical
        this.files = (data || []).sort((a, b) => {
          if (a.isDir === b.isDir) {
            return a.name.localeCompare(b.name);
          }
          return a.isDir ? -1 : 1;
        });
      },
      error: (err) => {
        console.error('Failed to load files', err);
        alert('加载文件失败: ' + (err.error?.error || err.message));
      }
    });
  }

  open(file: FileInfo): void {
    if (file.isDir) {
      this.loadFiles(file.path);
    } else {
      alert('Open file not fully implemented yet: ' + file.name);
    }
  }

  goUp(): void {
    let parentPath = this.currentPath;
    if (this.isWindows) {
       let parts = parentPath.split('\\').filter(p => p);
       if (parts.length > 1) {
           parts.pop();
           parentPath = parts.join('\\') + '\\';
       } else if (parts.length === 1) {
           parentPath = parts[0] + '\\';
       }
    } else {
       let parts = parentPath.split('/').filter(p => p);
       if (parts.length > 0) {
           parts.pop();
           parentPath = '/' + parts.join('/');
       }
       if (parentPath === '') parentPath = '/';
    }
    this.loadFiles(parentPath);
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  createNew(isDir: boolean): void {
    const name = prompt(`请输入新${isDir ? '文件夹' : '文件'}名称:`);
    if (!name) return;
    const sep = this.isWindows ? '\\' : '/';
    // ensure no double slashes
    let path = this.currentPath.endsWith(sep) ? this.currentPath + name : this.currentPath + sep + name;
    
    this.fileService.createFileOrFolder(path, isDir).subscribe({
      next: () => this.loadFiles(this.currentPath),
      error: (err) => alert('创建失败: ' + err.error?.error)
    });
  }

  renameFile(): void {
    if (!this.selectedFile) return;
    const newName = prompt('输入新名称:', this.selectedFile.name);
    if (!newName || newName === this.selectedFile.name) return;
    
    const sep = this.isWindows ? '\\' : '/';
    const newPath = this.currentPath.endsWith(sep) ? this.currentPath + newName : this.currentPath + sep + newName;
    
    this.fileService.renameFile(this.selectedFile.path, newPath).subscribe({
      next: () => this.loadFiles(this.currentPath),
      error: (err) => alert('重命名失败: ' + err.error?.error)
    });
  }

  deleteFile(): void {
    if (!this.selectedFile) return;
    if (!confirm(`确定要删除 ${this.selectedFile.name} 吗?`)) return;
    
    this.fileService.deleteFile(this.selectedFile.path).subscribe({
      next: () => this.loadFiles(this.currentPath),
      error: (err) => alert('删除失败: ' + err.error?.error)
    });
  }
}

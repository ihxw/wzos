import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { FileService, FileInfo } from '../../core/services/file.service';

@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NzTableModule, NzButtonModule, 
    NzIconModule, NzInputModule, NzDividerModule, NzDropDownModule,
    NzBreadCrumbModule
  ],
  templateUrl: './file-manager.html',
  styleUrls: ['./file-manager.scss']
})
export class FileManagerComponent implements OnInit {
  currentPath: string = '';
  files: FileInfo[] = [];
  selectedFiles: Set<string> = new Set();
  
  viewMode: 'icon' | 'list' = 'icon';
  searchQuery: string = '';
  
  history: string[] = [];
  historyIndex: number = -1;
  
  isWindows: boolean = navigator.platform.toLowerCase().includes('win');

  // Sidebar shortcuts
  sidebarShortcuts = [
    { name: '桌面', icon: 'desktop', path: this.isWindows ? 'C:\\Users\\Administrator\\Desktop' : '/home/user/Desktop' },
    { name: '文档', icon: 'file-text', path: this.isWindows ? 'C:\\Users\\Administrator\\Documents' : '/home/user/Documents' },
    { name: '下载', icon: 'download', path: this.isWindows ? 'C:\\Users\\Administrator\\Downloads' : '/home/user/Downloads' },
    { name: '图片', icon: 'picture', path: this.isWindows ? 'C:\\Users\\Administrator\\Pictures' : '/home/user/Pictures' }
  ];

  locations = [
    { name: '本地磁盘', icon: 'hdd', path: this.isWindows ? 'C:\\' : '/' }
  ];

  constructor(
    private fileService: FileService,
    private nzContextMenuService: NzContextMenuService
  ) {}

  ngOnInit(): void {
    const defaultPath = this.isWindows ? 'C:\\' : '/';
    this.navigateTo(defaultPath);
  }

  get filteredFiles(): FileInfo[] {
    if (!this.searchQuery) return this.files;
    return this.files.filter(f => f.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
  }

  navigateTo(path: string, recordHistory: boolean = true): void {
    if (!path) return;
    
    this.fileService.listFiles(path).subscribe({
      next: (data) => {
        this.currentPath = path;
        this.selectedFiles.clear();
        
        this.files = (data || []).sort((a, b) => {
          if (a.isDir === b.isDir) {
            return a.name.localeCompare(b.name);
          }
          return a.isDir ? -1 : 1;
        });
        
        if (recordHistory) {
          // If we are not at the end of history, truncate the future
          if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
          }
          this.history.push(path);
          this.historyIndex++;
        }
      },
      error: (err) => {
        console.error('Failed to load files', err);
        alert('无法访问路径: ' + (err.error?.error || err.message));
      }
    });
  }

  goBack(): void {
    if (this.canGoBack()) {
      this.historyIndex--;
      this.navigateTo(this.history[this.historyIndex], false);
    }
  }

  goForward(): void {
    if (this.canGoForward()) {
      this.historyIndex++;
      this.navigateTo(this.history[this.historyIndex], false);
    }
  }

  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  open(file: FileInfo): void {
    if (file.isDir) {
      this.navigateTo(file.path);
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
    this.navigateTo(parentPath);
  }

  toggleSelection(file: FileInfo, event: MouseEvent): void {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      if (this.selectedFiles.has(file.path)) {
        this.selectedFiles.delete(file.path);
      } else {
        this.selectedFiles.add(file.path);
      }
    } else {
      this.selectedFiles.clear();
      this.selectedFiles.add(file.path);
    }
  }

  clearSelection(): void {
    this.selectedFiles.clear();
  }

  isSelected(file: FileInfo): boolean {
    return this.selectedFiles.has(file.path);
  }

  get selectedFile(): FileInfo | null {
    if (this.selectedFiles.size === 1) {
      const path = Array.from(this.selectedFiles)[0];
      return this.files.find(f => f.path === path) || null;
    }
    return null;
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getFileIcon(file: FileInfo): string {
    if (file.isDir) return 'folder-fill';
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': return 'picture';
      case 'mp4': case 'mkv': case 'avi': return 'video-camera';
      case 'mp3': case 'wav': return 'audio';
      case 'pdf': return 'file-pdf';
      case 'doc': case 'docx': return 'file-word';
      case 'xls': case 'xlsx': return 'file-excel';
      case 'zip': case 'rar': case 'tar': case 'gz': return 'file-zip';
      case 'txt': case 'md': return 'file-text';
      default: return 'file';
    }
  }

  getFileIconColor(file: FileInfo): string {
    if (file.isDir) return '#87c7ff'; // macOS light blue folder color
    return '#8c8c8c';
  }

  createNew(isDir: boolean): void {
    const name = prompt(`请输入新${isDir ? '文件夹' : '文件'}名称:`);
    if (!name) return;
    const sep = this.isWindows ? '\\' : '/';
    let path = this.currentPath.endsWith(sep) ? this.currentPath + name : this.currentPath + sep + name;
    
    this.fileService.createFileOrFolder(path, isDir).subscribe({
      next: () => this.navigateTo(this.currentPath, false),
      error: (err) => alert('创建失败: ' + err.error?.error)
    });
  }

  renameFile(): void {
    const target = this.selectedFile;
    if (!target) return;
    const newName = prompt('输入新名称:', target.name);
    if (!newName || newName === target.name) return;
    
    const sep = this.isWindows ? '\\' : '/';
    const newPath = this.currentPath.endsWith(sep) ? this.currentPath + newName : this.currentPath + sep + newName;
    
    this.fileService.renameFile(target.path, newPath).subscribe({
      next: () => this.navigateTo(this.currentPath, false),
      error: (err) => alert('重命名失败: ' + err.error?.error)
    });
  }

  deleteFile(): void {
    const target = this.selectedFile;
    if (!target) return;
    if (!confirm(`确定要删除 ${target.name} 吗?`)) return;
    
    this.fileService.deleteFile(target.path).subscribe({
      next: () => this.navigateTo(this.currentPath, false),
      error: (err) => alert('删除失败: ' + err.error?.error)
    });
  }

  contextMenu($event: MouseEvent, menu: NzDropdownMenuComponent, file: FileInfo): void {
    this.clearSelection();
    this.selectedFiles.add(file.path);
    this.nzContextMenuService.create($event, menu);
  }

  getBreadcrumbs(): string[] {
    const sep = this.isWindows ? '\\' : '/';
    return this.currentPath.split(sep).filter(p => p);
  }

  get currentDirName(): string {
    const sep = this.isWindows ? '\\' : '/';
    const parts = this.currentPath.split(sep).filter(p => p);
    if (parts.length === 0) return this.isWindows ? 'C:\\' : '/';
    return parts[parts.length - 1];
  }
}

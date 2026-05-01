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
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FileService, FileInfo } from '../../core/services/file.service';

@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NzTableModule, NzButtonModule, 
    NzIconModule, NzInputModule, NzDividerModule, NzDropDownModule,
    NzBreadCrumbModule, DragDropModule
  ],
  templateUrl: './file-manager.html',
  styleUrls: ['./file-manager.scss']
})
export class FileManagerComponent implements OnInit {
  currentPath: string = '';
  files: FileInfo[] = [];
  selectedFiles: Set<string> = new Set();
  
  viewMode: 'icon' | 'list' | 'column' = 'icon';
  searchQuery: string = '';
  
  history: string[] = [];
  historyIndex: number = -1;
  
  // Sorting
  sortKey: 'name' | 'size' | 'modTime' | 'type' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';

  // Quick Look
  showQuickLook: boolean = false;
  quickLookFile: FileInfo | null = null;
  
  isWindows: boolean = navigator.platform.toLowerCase().includes('win');

  // Sidebar shortcuts
  sidebarShortcuts: any[] = [];

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
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.fileService.getFavorites().subscribe({
      next: (data) => {
        this.sidebarShortcuts = data;
      },
      error: (err) => {
        console.error('Failed to load favorites', err);
      }
    });
  }

  get filteredFiles(): FileInfo[] {
    let result = this.files;
    if (this.searchQuery) {
      result = result.filter(f => f.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
    }
    
    return result.sort((a, b) => {
      // Directories always come first in macOS (unless sorted otherwise)
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      
      let comparison = 0;
      switch (this.sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'size': comparison = a.size - b.size; break;
        case 'modTime': comparison = new Date(a.modTime).getTime() - new Date(b.modTime).getTime(); break;
        case 'type': comparison = this.getFileIcon(a).localeCompare(this.getFileIcon(b)); break;
      }
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
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

  // Drag and Drop
  onDrop(event: any, targetFolder: FileInfo | null = null): void {
    const droppedFile: FileInfo = event.item.data;
    const targetPath = targetFolder ? targetFolder.path : this.currentPath;
    
    if (droppedFile.path === targetPath) return;
    
    const sep = this.isWindows ? '\\' : '/';
    const newPath = targetPath.endsWith(sep) ? targetPath + droppedFile.name : targetPath + sep + droppedFile.name;
    
    if (droppedFile.path === newPath) return;

    this.fileService.renameFile(droppedFile.path, newPath).subscribe({
      next: () => this.navigateTo(this.currentPath, false),
      error: (err) => alert('移动失败: ' + err.error?.error)
    });
  }

  // Sorting handlers
  setSort(key: any): void {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
  }

  // Quick Look
  toggleQuickLook(file: FileInfo): void {
    this.quickLookFile = file;
    this.showQuickLook = true;
  }

  closeQuickLook(): void {
    this.showQuickLook = false;
    this.quickLookFile = null;
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
    if (file.isDir) {
      // Special folder icons
      const lowerName = file.name.toLowerCase();
      if (lowerName === 'desktop' || lowerName === '桌面') return 'desktop';
      if (lowerName === 'documents' || lowerName === '文档') return 'file-text';
      if (lowerName === 'downloads' || lowerName === '下载') return 'download';
      if (lowerName === 'pictures' || lowerName === '图片') return 'picture';
      if (lowerName === 'music' || lowerName === '音乐') return 'audio';
      if (lowerName === 'movies' || lowerName === '视频') return 'video-camera';
      if (lowerName === 'applications' || lowerName === '应用程序') return 'appstore';
      return 'folder';
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return 'picture';
      case 'mp4': case 'mkv': case 'avi': case 'mov': return 'video-camera';
      case 'mp3': case 'wav': case 'flac': case 'ogg': return 'audio';
      case 'pdf': return 'file-pdf';
      case 'doc': case 'docx': return 'file-word';
      case 'xls': case 'xlsx': case 'csv': return 'file-excel';
      case 'ppt': case 'pptx': return 'file-ppt';
      case 'zip': case 'rar': case 'tar': case 'gz': case '7z': return 'file-zip';
      case 'txt': case 'md': case 'log': return 'file-text';
      case 'exe': case 'dmg': case 'app': return 'appstore';
      case 'js': case 'ts': case 'html': case 'css': case 'scss': case 'go': case 'py': return 'code';
      default: return 'file';
    }
  }

  getIconTheme(file: FileInfo): 'outline' | 'fill' | 'twotone' {
    const icon = this.getFileIcon(file);
    const twotoneIcons = [
      'folder', 'file', 'picture', 'video-camera', 'audio', 
      'file-pdf', 'file-word', 'file-excel', 'file-ppt', 
      'file-zip', 'file-text', 'appstore', 'code', 'hdd'
    ];
    return twotoneIcons.includes(icon) ? 'twotone' : 'outline';
  }

  getFileIconColor(file: FileInfo): string {
    if (file.isDir) return '#007aff';
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '#ff4d4f'; // Red
      case 'doc': case 'docx': return '#1890ff'; // Blue
      case 'xls': case 'xlsx': case 'csv': return '#52c41a'; // Green
      case 'ppt': case 'pptx': return '#fa8c16'; // Orange
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return '#722ed1'; // Purple
      case 'mp4': case 'mkv': case 'avi': case 'mov': return '#eb2f96'; // Magenta
      case 'mp3': case 'wav': case 'flac': case 'ogg': return '#13c2c2'; // Cyan
      case 'zip': case 'rar': case 'tar': case 'gz': case '7z': return '#faad14'; // Gold
      case 'js': case 'ts': case 'html': case 'css': case 'scss': case 'go': case 'py': return '#595959'; // Gray
      default: return '#8c8c8c';
    }
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

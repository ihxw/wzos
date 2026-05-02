import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { FileService, FileInfo } from '../../core/services/file.service';
import { Subject, debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

interface Breadcrumb { name: string; path: string; }
interface ColumnState { path: string; files: FileInfo[]; selectedPath?: string; }
interface ClipboardState { files: FileInfo[]; operation: 'copy' | 'cut'; }

const TAG_COLORS: Record<string, string> = {
  red: '#ff3b30', orange: '#ff9500', yellow: '#ffcc00',
  green: '#34c759', blue: '#007aff', purple: '#af52de', gray: '#8e8e93'
};

@Component({
  selector: 'app-file-manager',
  standalone: true,
  host: { 'style': 'display: block; width: 100%; height: 100%;' },
  imports: [
    CommonModule, FormsModule, NzTableModule, NzButtonModule,
    NzIconModule, NzInputModule, NzDropDownModule,
    NzBreadCrumbModule, NzTooltipModule, NzProgressModule,
    DragDropModule
  ],
  templateUrl: './file-manager.html',
  styleUrls: ['./file-manager.scss']
})
export class FileManagerComponent implements OnInit, OnDestroy {
  currentPath = '';
  files: FileInfo[] = [];
  selectedFiles: Set<string> = new Set();
  columns: ColumnState[] = [];
  private columnLoadGeneration = 0;

  viewMode: 'icon' | 'list' | 'column' = 'icon';
  searchQuery = '';
  private searchSubject = new Subject<string>();
  private searchSub: Subscription | null = null;

  history: string[] = [];
  historyIndex = -1;

  sortKey: 'name' | 'size' | 'modTime' | 'type' | 'permissions' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';

  showQuickLook = false;
  quickLookFile: FileInfo | null = null;

  sidebarShortcuts: any[] = [];
  locations = [
    { name: '根目录', icon: 'hdd', path: '/' },
    { name: '主目录', icon: 'home', path: '/home' },
  ];

  renamingPath: string | null = null;
  renameValue = '';

  clipboard: ClipboardState | null = null;

  tags: Record<string, string[]> = {};
  tagColors = TAG_COLORS;

  loading = false;
  errorMessage = '';

  // Upload state
  uploadProgress = 0;
  isUploading = false;

  // Subscriptions
  private subs: Subscription[] = [];

  @ViewChild('fileUploadInput') fileUploadInput!: ElementRef<HTMLInputElement>;

  constructor(
    private fileService: FileService,
    private nzContextMenuService: NzContextMenuService,
    private message: NzMessageService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Determine the best default path
    const defaultPath = '/';
    this.locations[1].path = this.detectHomeDir();
    this.navigateTo(defaultPath, true);
    this.loadFavorites();
    this.loadTags();

    this.searchSub = this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(query => {
      if (query.length > 2) {
        this.serverSearch(query);
      } else if (query.length === 0) {
        this.navigateTo(this.currentPath, false);
      }
    });
    this.subs.push(this.searchSub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private detectHomeDir(): string {
    // Try common home directories
    const candidates = ['/home/' + (typeof window !== 'undefined' ? '' : 'user'), '/root', '/home/user'];
    return '/home';
  }

  objectKeys(obj: Record<string, any>): string[] {
    return Object.keys(obj);
  }

  // ===== Navigation =====
  navigateTo(path: string, recordHistory = true): void {
    if (!path) return;
    path = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    this.columnLoadGeneration++;
    this.loading = true;
    this.errorMessage = '';

    const sub = this.fileService.listFiles(path).subscribe({
      next: (data) => {
        this.currentPath = path;
        this.selectedFiles.clear();
        this.renamingPath = null;
        this.errorMessage = '';

        const sorted = this.sortFiles(data || []);
        this.files = sorted;
        this.loading = false;

        if (recordHistory) {
          if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
          }
          this.history.push(path);
          this.historyIndex++;
        }

        if (this.viewMode === 'column') {
          this.rebuildColumns(path, sorted);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = '无法访问 ' + path + ' — ' + (err.error?.error || err.message || '未知错误');
        this.message.error(this.errorMessage);
      }
    });
    this.subs.push(sub);
  }

  private sortFiles(files: FileInfo[]): FileInfo[] {
    return [...files].filter(f => f != null).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
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

  canGoBack(): boolean { return this.historyIndex > 0; }
  canGoForward(): boolean { return this.historyIndex < this.history.length - 1; }

  open(file: FileInfo | null): void {
    if (!file) return;
    if (file.isDir) {
      this.navigateTo(file.path);
    } else {
      this.downloadFile(file);
    }
  }

  goUp(): void {
    const parentPath = this.getParentPath(this.currentPath);
    if (parentPath !== this.currentPath) {
      this.navigateTo(parentPath);
    }
  }

  private getParentPath(path: string): string {
    if (path === '/') return '/';
    const idx = path.lastIndexOf('/');
    if (idx <= 0) return '/';
    return path.substring(0, idx);
  }

  // ===== Breadcrumbs =====
  getBreadcrumbs(): Breadcrumb[] {
    if (!this.currentPath) return [{ name: '/', path: '/' }];
    const parts = this.currentPath.split('/').filter(p => p);
    const crumbs: Breadcrumb[] = [{ name: '/', path: '/' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += '/' + part;
      crumbs.push({ name: part, path: accumulated });
    }
    return crumbs;
  }

  navigateToCrumb(crumb: Breadcrumb): void {
    this.navigateTo(crumb.path);
  }

  get currentDirName(): string {
    const crumbs = this.getBreadcrumbs();
    const last = crumbs[crumbs.length - 1];
    return last ? last.name : '/';
  }

  // ===== Filtered & Sorted Files =====
  get filteredFiles(): FileInfo[] {
    let result = [...this.files];
    if (this.searchQuery && this.searchQuery.length <= 2) {
      result = result.filter(f => f.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
    }
    return result.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      switch (this.sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }); break;
        case 'size': cmp = a.size - b.size; break;
        case 'modTime': cmp = new Date(a.modTime).getTime() - new Date(b.modTime).getTime(); break;
        case 'type': cmp = this.getFileType(a).localeCompare(this.getFileType(b)); break;
        case 'permissions': cmp = (a.permissions || '').localeCompare(b.permissions || ''); break;
      }
      return this.sortOrder === 'asc' ? cmp : -cmp;
    });
  }

  setSort(key: any): void {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
  }

  // ===== Selection =====
  toggleSelection(file: FileInfo, event: MouseEvent): void {
    event.stopPropagation();
    this.renamingPath = null;
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

  selectAll(): void {
    this.selectedFiles.clear();
    this.filteredFiles.forEach(f => this.selectedFiles.add(f.path));
  }

  clearSelection(): void {
    this.selectedFiles.clear();
    this.renamingPath = null;
  }

  isSelected(file: FileInfo): boolean {
    return this.selectedFiles.has(file.path);
  }

  get selectedFile(): FileInfo | null {
    if (this.viewMode === 'column') {
      if (this.columns.length > 0) {
        const lastCol = this.columns[this.columns.length - 1];
        if (lastCol.selectedPath) {
          return lastCol.files.find(f => f.path === lastCol.selectedPath) || null;
        }
        for (let i = this.columns.length - 2; i >= 0; i--) {
          const col = this.columns[i];
          if (col.selectedPath) {
            const file = col.files.find(f => f.path === col.selectedPath);
            if (file && !file.isDir) return file;
          }
        }
      }
      return null;
    }
    if (this.selectedFiles.size === 1) {
      const path = Array.from(this.selectedFiles)[0];
      return this.files.find(f => f.path === path) || null;
    }
    return null;
  }

  get selectedFilesList(): FileInfo[] {
    return this.files.filter(f => this.selectedFiles.has(f.path));
  }

  // ===== Inline Rename =====
  startRename(file: FileInfo): void {
    this.renamingPath = file.path;
    this.renameValue = file.name;
    // Defer to next tick so the input renders
    setTimeout(() => {
      const inputs = document.querySelectorAll('.rename-input, .rename-input-inline, .rename-input-col');
      const el = inputs[inputs.length - 1] as HTMLInputElement;
      if (el) {
        el.focus();
        if (!file.isDir) {
          const dotIndex = file.name.lastIndexOf('.');
          if (dotIndex > 0) {
            el.setSelectionRange(0, dotIndex);
            return;
          }
        }
        el.select();
      }
    }, 0);
  }

  confirmRename(file: FileInfo): void {
    const newName = this.renameValue.trim();
    if (!newName || newName === file.name) {
      this.renamingPath = null;
      return;
    }
    if (newName.includes('/')) {
      this.message.error('文件名不能包含 /');
      this.renamingPath = null;
      return;
    }
    const parentDir = file.path.substring(0, file.path.lastIndexOf('/'));
    const newPath = parentDir + '/' + newName;
    const sub = this.fileService.renameFile(file.path, newPath).subscribe({
      next: () => {
        this.renamingPath = null;
        this.navigateTo(this.currentPath, false);
        this.message.success('重命名成功');
      },
      error: (err) => this.message.error('重命名失败: ' + (err.error?.error || err.message))
    });
    this.subs.push(sub);
  }

  cancelRename(): void {
    this.renamingPath = null;
  }

  onRenameKeydown(event: KeyboardEvent, file: FileInfo): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmRename(file);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    }
  }

  // ===== File Operations =====
  createNew(isDir: boolean): void {
    const label = isDir ? '文件夹' : '文件';
    const name = prompt(`请输入新${label}名称:`);
    if (!name || !name.trim()) return;
    const clean = name.trim();
    if (clean.includes('/')) {
      this.message.error('名称不能包含 /');
      return;
    }
    const path = this.currentPath === '/' ? '/' + clean : this.currentPath + '/' + clean;
    const sub = this.fileService.createFileOrFolder(path, isDir).subscribe({
      next: () => {
        this.navigateTo(this.currentPath, false);
        this.message.success(`已创建 ${clean}`);
      },
      error: (err) => this.message.error('创建失败: ' + (err.error?.error || err.message))
    });
    this.subs.push(sub);
  }

  deleteFile(): void {
    const targets = this.selectedFilesList;
    if (targets.length === 0) return;
    const names = targets.length === 1 ? targets[0].name : `${targets.length} 个项目`;
    if (!confirm(`确定要删除 ${names} 吗? 此操作不可撤销。`)) return;

    let completed = 0;
    let hasError = false;
    const total = targets.length;
    targets.forEach(file => {
      const sub = this.fileService.deleteFile(file.path).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.navigateTo(this.currentPath, false);
            if (!hasError) this.message.success('已删除');
          }
        },
        error: (err) => {
          if (!hasError) {
            hasError = true;
            this.message.error('删除失败: ' + (err.error?.error || err.message));
          }
        }
      });
      this.subs.push(sub);
    });
  }

  // ===== Clipboard =====
  copyFiles(): void {
    const list = this.selectedFilesList;
    if (list.length === 0) return;
    this.clipboard = { files: [...list], operation: 'copy' };
    this.message.info(`已复制 ${list.length} 个项目`);
  }

  cutFiles(): void {
    const list = this.selectedFilesList;
    if (list.length === 0) return;
    this.clipboard = { files: [...list], operation: 'cut' };
    this.message.info(`已剪切 ${list.length} 个项目`);
  }

  pasteFiles(): void {
    if (!this.clipboard) return;
    const { files, operation } = this.clipboard;

    if (operation === 'copy') {
      let completed = 0;
      const total = files.length;
      files.forEach(file => {
        const dst = this.currentPath === '/' ? '/' + file.name : this.currentPath + '/' + file.name;
        const sub = this.fileService.copyFile(file.path, dst).subscribe({
          next: () => {
            completed++;
            if (completed === total) {
              this.navigateTo(this.currentPath, false);
              this.message.success('粘贴完成');
            }
          },
          error: (err) => this.message.error('复制失败: ' + (err.error?.error || err.message))
        });
        this.subs.push(sub);
      });
    } else {
      let completed = 0;
      const total = files.length;
      files.forEach(file => {
        const dst = this.currentPath === '/' ? '/' + file.name : this.currentPath + '/' + file.name;
        const sub = this.fileService.renameFile(file.path, dst).subscribe({
          next: () => {
            completed++;
            if (completed === total) {
              this.clipboard = null;
              this.navigateTo(this.currentPath, false);
              this.message.success('移动完成');
            }
          },
          error: (err) => this.message.error('移动失败: ' + (err.error?.error || err.message))
        });
        this.subs.push(sub);
      });
    }
  }

  isCutFile(file: FileInfo): boolean {
    return this.clipboard?.operation === 'cut' && this.clipboard.files.some(f => f.path === file.path);
  }

  // ===== File Upload =====
  triggerUpload(): void {
    this.fileUploadInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    for (let i = 0; i < input.files.length; i++) {
      this.uploadFile(input.files[i]);
    }
    input.value = '';
  }

  private uploadFile(file: File): void {
    this.isUploading = true;
    this.uploadProgress = 0;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', this.currentPath);

    const sub = this.http.post('/api/files/upload', formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round(100 * event.loaded / (event.total || file.size));
        } else if (event.type === HttpEventType.Response) {
          this.isUploading = false;
          this.navigateTo(this.currentPath, false);
          this.message.success(`已上传 ${file.name}`);
        }
      },
      error: (err) => {
        this.isUploading = false;
        this.message.error('上传失败: ' + (err.error?.error || err.message));
      }
    });
    this.subs.push(sub);
  }

  // ===== File Download =====
  downloadFile(file: FileInfo): void {
    const link = document.createElement('a');
    link.href = `/api/files/download?path=${encodeURIComponent(file.path)}`;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ===== Tags =====
  loadTags(): void {
    try {
      const saved = localStorage.getItem('wzos-tags');
      this.tags = saved ? JSON.parse(saved) : {};
    } catch { this.tags = {}; }
  }

  saveTags(): void {
    localStorage.setItem('wzos-tags', JSON.stringify(this.tags));
  }

  toggleTag(filePath: string, color: string): void {
    if (!this.tags[color]) this.tags[color] = [];
    const idx = this.tags[color].indexOf(filePath);
    if (idx >= 0) {
      this.tags[color].splice(idx, 1);
    } else {
      this.tags[color].push(filePath);
    }
    this.saveTags();
  }

  hasTag(filePath: string, color: string): boolean {
    return this.tags[color]?.includes(filePath) || false;
  }

  getFileTags(filePath: string): string[] {
    return Object.keys(this.tags).filter(color => this.tags[color]?.includes(filePath));
  }

  filterByTag(color: string): void {
    const paths = this.tags[color] || [];
    if (paths.length === 0) {
      this.message.info('该标签下没有文件');
      return;
    }
    this.searchQuery = '';
    this.files = this.files.filter(f => paths.includes(f.path));
  }

  // ===== Favorites =====
  loadFavorites(): void {
    const sub = this.fileService.getFavorites().subscribe({
      next: (data) => {
        this.sidebarShortcuts = (data || []).filter(item => item != null);
      },
      error: (err) => {
        console.error('Failed to load favorites', err);
        this.sidebarShortcuts = [];
      }
    });
    this.subs.push(sub);
  }

  addToFavorites(): void {
    const file = this.selectedFile;
    if (!file) return;
    const icon = file.isDir ? 'folder' : 'file';
    const sub = this.fileService.addFavorite(file.name, file.path, icon).subscribe({
      next: () => {
        this.loadFavorites();
        this.message.success('已添加到收藏');
      },
      error: (err) => this.message.error('添加失败: ' + (err.error?.error || err.message))
    });
    this.subs.push(sub);
  }

  removeFavorite(item: any): void {
    const sub = this.fileService.deleteFavorite(item.id).subscribe({
      next: () => {
        this.loadFavorites();
        this.message.success('已移除收藏');
      },
      error: (err) => this.message.error('移除失败: ' + (err.error?.error || err.message))
    });
    this.subs.push(sub);
  }

  // ===== Search =====
  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  private serverSearch(query: string): void {
    this.loading = true;
    this.errorMessage = '';
    const sub = this.fileService.searchFiles(this.currentPath, query).subscribe({
      next: (data) => {
        this.files = this.sortFiles(data || []);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = '搜索失败';
        this.message.error('搜索失败');
      }
    });
    this.subs.push(sub);
  }

  // ===== Drag & Drop =====
  onDrop(event: any, targetFolder: FileInfo | null = null): void {
    const droppedFile: FileInfo = event.item.data;
    const targetPath = targetFolder ? targetFolder.path : this.currentPath;
    if (droppedFile.path === targetPath) return;

    const newPath = targetPath === '/' ? '/' + droppedFile.name : targetPath + '/' + droppedFile.name;
    if (droppedFile.path === newPath) return;

    const sub = this.fileService.renameFile(droppedFile.path, newPath).subscribe({
      next: () => {
        this.navigateTo(this.currentPath, false);
        this.message.success('移动成功');
      },
      error: (err) => this.message.error('移动失败: ' + (err.error?.error || err.message))
    });
    this.subs.push(sub);
  }

  // ===== Column View =====
  onColumnClick(file: FileInfo, columnIndex: number): void {
    // Set selected path in this column
    this.columns[columnIndex].selectedPath = file.path;

    // Remove columns after this one
    this.columns = this.columns.slice(0, columnIndex + 1);

    // Update history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(file.path);
    this.historyIndex++;
    this.currentPath = file.path;

    // Update selection
    this.selectedFiles.clear();
    this.selectedFiles.add(file.path);

    if (file.isDir) {
      const gen = ++this.columnLoadGeneration;
      const sub = this.fileService.listFiles(file.path).subscribe({
        next: (data) => {
          if (gen !== this.columnLoadGeneration) return;
          this.columns.push({
            path: file.path,
            files: this.sortFiles(data || [])
          });
        },
        error: (err) => {
          console.error('Failed to load column files', err);
          this.message.error('无法加载目录内容');
        }
      });
      this.subs.push(sub);
    }
  }

  isColumnItemSelected(file: FileInfo, columnIndex: number): boolean {
    return this.columns[columnIndex]?.selectedPath === file.path;
  }

  private rebuildColumns(targetPath: string, targetFiles?: FileInfo[]): void {
    const parts = targetPath.split('/').filter(p => p);
    const ancestors: string[] = ['/'];
    for (let i = 0; i < parts.length; i++) {
      ancestors.push('/' + parts.slice(0, i + 1).join('/'));
    }

    this.columns = [];
    this.loadColumnChain(ancestors, 0, targetFiles);
  }

  private loadColumnChain(paths: string[], index: number, targetFiles?: FileInfo[]): void {
    if (index >= paths.length) return;
    const path = paths[index];

    if (index === paths.length - 1 && targetFiles) {
      const col: ColumnState = { path, files: targetFiles };
      if (index > 0) col.selectedPath = paths[index];
      this.columns.push(col);
      return;
    }

    const sub = this.fileService.listFiles(path).subscribe({
      next: (data) => {
        const sorted = this.sortFiles(data || []);
        const col: ColumnState = { path, files: sorted };
        if (index + 1 < paths.length) col.selectedPath = paths[index + 1];
        this.columns.push(col);
        this.loadColumnChain(paths, index + 1, targetFiles);
      },
      error: (err) => {
        console.error('Failed to load column for path:', path, err);
        // Skip this path and continue
        this.loadColumnChain(paths, index + 1, targetFiles);
      }
    });
    this.subs.push(sub);
  }

  setViewMode(mode: 'icon' | 'list' | 'column'): void {
    this.viewMode = mode;
    if (mode === 'column') {
      this.rebuildColumns(this.currentPath, this.files);
    }
  }

  // ===== Quick Look =====
  toggleQuickLook(file: FileInfo): void {
    this.quickLookFile = file;
    this.showQuickLook = true;
  }

  closeQuickLook(): void {
    this.showQuickLook = false;
    this.quickLookFile = null;
  }

  // ===== Context Menu =====
  contextMenu($event: MouseEvent, menu: NzDropdownMenuComponent, file: FileInfo): void {
    this.clearSelection();
    this.selectedFiles.add(file.path);
    this.nzContextMenuService.create($event, menu);
  }

  onBlankAreaContextmenu($event: MouseEvent, menu: NzDropdownMenuComponent): void {
    $event.preventDefault();
    this.clearSelection();
    this.nzContextMenuService.create($event, menu);
  }

  // ===== Keyboard Shortcuts =====
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.renamingPath) return;

    const mod = event.metaKey || event.ctrlKey;

    if (mod && event.key === 'a') {
      event.preventDefault();
      this.selectAll();
    } else if (mod && event.key === 'c') {
      event.preventDefault();
      this.copyFiles();
    } else if (mod && event.key === 'x') {
      event.preventDefault();
      this.cutFiles();
    } else if (mod && event.key === 'v') {
      event.preventDefault();
      this.pasteFiles();
    } else if (event.key === 'Delete' || (mod && event.key === 'Backspace')) {
      if (this.selectedFiles.size > 0) {
        event.preventDefault();
        this.deleteFile();
      }
    } else if (event.key === 'Enter') {
      if (this.selectedFiles.size === 1) {
        event.preventDefault();
        const file = this.files.find(f => f.path === Array.from(this.selectedFiles)[0]);
        if (file) this.open(file);
      }
    } else if (event.key === ' ') {
      if (this.selectedFile) {
        event.preventDefault();
        this.toggleQuickLook(this.selectedFile);
      }
    } else if (event.key === 'F2') {
      if (this.selectedFile) {
        event.preventDefault();
        this.startRename(this.selectedFile);
      }
    } else if (mod && event.shiftKey && event.key === 'N') {
      event.preventDefault();
      this.createNew(true);
    } else if (event.key === 'Escape') {
      this.closeQuickLook();
    }
  }

  // ===== Get Info =====
  getInfo(): void {
    const file = this.selectedFile;
    if (!file) return;
    this.toggleQuickLook(file);
  }

  getFolderInfo(): void {
    const crumbs = this.getBreadcrumbs();
    const folderName = crumbs[crumbs.length - 1]?.name || '/';
    // Use a file-like structure for Quick Look
    const info: FileInfo = {
      name: folderName,
      path: this.currentPath,
      isDir: true,
      size: 0,
      modTime: new Date().toISOString(),
      permissions: ''
    };
    this.quickLookFile = info;
    this.showQuickLook = true;
  }

  // ===== Icon & Type Helpers =====
  getFileIcon(file: FileInfo): string {
    if (file.isDir) {
      const n = file.name.toLowerCase();
      if (n === 'desktop' || n === '桌面') return 'desktop';
      if (n === 'documents' || n === '文档') return 'file-text';
      if (n === 'downloads' || n === '下载') return 'download';
      if (n === 'pictures' || n === '图片') return 'picture';
      if (n === 'music' || n === '音乐') return 'audio';
      if (n === 'movies' || n === '视频' || n === 'videos') return 'video-camera';
      if (n === 'applications' || n === '应用程序') return 'appstore';
      if (n === 'public' || n === '公共') return 'global';
      if (n === 'templates' || n === '模板') return 'snippets';
      if (n === 'var' || n === 'tmp') return 'setting';
      return 'folder';
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg':
      case 'bmp': case 'ico': case 'tiff': return 'picture';
      case 'mp4': case 'mkv': case 'avi': case 'mov': case 'webm': return 'video-camera';
      case 'mp3': case 'wav': case 'flac': case 'ogg': case 'aac': case 'wma': return 'audio';
      case 'pdf': return 'file-pdf';
      case 'doc': case 'docx': return 'file-word';
      case 'xls': case 'xlsx': case 'csv': return 'file-excel';
      case 'ppt': case 'pptx': return 'file-ppt';
      case 'zip': case 'rar': case 'tar': case 'gz': case '7z': case 'bz2': case 'xz': return 'file-zip';
      case 'txt': case 'md': case 'log': case 'cfg': case 'conf': case 'ini': return 'file-text';
      case 'exe': case 'dmg': case 'app': case 'sh': case 'bash': return 'appstore';
      case 'js': case 'ts': case 'html': case 'css': case 'scss':
      case 'go': case 'py': case 'java': case 'rs': case 'c': case 'cpp':
      case 'h': case 'json': case 'xml': case 'yaml': case 'yml': case 'toml': return 'code';
      case 'iso': case 'img': return 'hdd';
      default: return 'file';
    }
  }

  getIconTheme(file: FileInfo): 'outline' | 'fill' | 'twotone' {
    const icon = this.getFileIcon(file);
    const twotone = [
      'folder', 'file', 'picture', 'video-camera', 'audio',
      'file-pdf', 'file-word', 'file-excel', 'file-ppt',
      'file-zip', 'file-text', 'appstore', 'code', 'hdd',
      'edit', 'delete', 'copy', 'scissor', 'check-square',
      'snippets', 'home', 'setting', 'warning', 'info-circle',
      'folder-open', 'star',
    ];
    return twotone.includes(icon) ? 'twotone' : 'outline';
  }

  getFileIconColor(file: FileInfo): string {
    if (file.isDir) return '#007aff';
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '#ff3b30';
      case 'doc': case 'docx': return '#007aff';
      case 'xls': case 'xlsx': case 'csv': return '#34c759';
      case 'ppt': case 'pptx': return '#ff9500';
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': return '#af52de';
      case 'mp4': case 'mkv': case 'avi': case 'mov': return '#ff2d55';
      case 'mp3': case 'wav': case 'flac': case 'ogg': return '#5ac8fa';
      case 'zip': case 'rar': case 'tar': case 'gz': case '7z': return '#ffcc00';
      case 'js': case 'ts': case 'html': case 'css': case 'scss':
      case 'go': case 'py': case 'java': case 'rs': return '#8e8e93';
      default: return '#8e8e93';
    }
  }

  getFileType(file: FileInfo): string {
    if (file.isDir) return '文件夹';
    const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
    const types: Record<string, string> = {
      'pdf': 'PDF 文稿', 'doc': 'Word 文稿', 'docx': 'Word 文稿',
      'xls': 'Excel 表格', 'xlsx': 'Excel 表格', 'csv': 'CSV 文件',
      'ppt': '演示文稿', 'pptx': '演示文稿',
      'jpg': 'JPEG 图像', 'jpeg': 'JPEG 图像', 'png': 'PNG 图像',
      'gif': 'GIF 图像', 'webp': 'WebP 图像', 'svg': 'SVG 图像', 'bmp': 'BMP 图像',
      'mp4': 'MPEG-4 视频', 'mkv': 'MKV 视频', 'avi': 'AVI 视频', 'mov': 'QuickTime 视频', 'webm': 'WebM 视频',
      'mp3': 'MP3 音频', 'wav': 'WAV 音频', 'flac': 'FLAC 音频', 'ogg': 'OGG 音频', 'aac': 'AAC 音频',
      'zip': 'ZIP 归档', 'rar': 'RAR 归档', 'tar': 'TAR 归档', 'gz': 'GZ 压缩', '7z': '7Z 归档', 'bz2': 'BZ2 压缩',
      'txt': '纯文本', 'md': 'Markdown', 'log': '日志文件', 'conf': '配置文件',
      'js': 'JavaScript', 'ts': 'TypeScript', 'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS',
      'go': 'Go 源文件', 'py': 'Python', 'java': 'Java', 'rs': 'Rust', 'c': 'C 源文件', 'cpp': 'C++ 源文件',
      'json': 'JSON', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YAML', 'toml': 'TOML',
      'sh': 'Shell 脚本', 'bash': 'Shell 脚本',
      'exe': '可执行文件', 'dmg': '磁盘映像', 'app': '应用程序',
      'iso': '磁盘映像', 'img': '磁盘映像',
      'deb': 'Debian 软件包', 'rpm': 'RPM 软件包',
    };
    return types[ext] || (ext.toUpperCase() + ' 文件');
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return 'Zero KB';
    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

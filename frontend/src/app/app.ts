import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TopBar } from './components/top-bar/top-bar';
import { Dock } from './components/dock/dock';
import { DesktopFileComponent } from './components/desktop-file/desktop-file';
import { DesktopApp } from './core/models/app.model';
import { FileInfo } from './core/services/file.service';
import { TerminalComponent } from './components/terminal/terminal';
import { FileManagerComponent } from './components/file-manager/file-manager';
import { MediaViewerComponent } from './components/media-viewer/media-viewer';
import { SystemSettingsComponent } from './apps/system-settings/system-settings';
import { AppManagerComponent } from './apps/app-manager/app-manager';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { WindowManagerService, WindowState } from './core/services/window-manager.service';
import { WindowWrapperComponent } from './shared/window-wrapper/window-wrapper';
import { AuthService } from './core/services/auth.service';
import { LoginComponent } from './components/login/login';

interface WallpaperPreset {
  id: string;
  name: string;
  css: string;
  type: 'gradient' | 'color' | 'image';
}

// Dominant colors for wallpaper presets (used for window tinting)
const WALLPAPER_TINT_COLORS: Record<string, string> = {
  sonoma: '#6b3fa0',
  ventura: '#f76b6b',
  monterey: '#d94e8c',
  bigsur: '#00a4e4',
  catalina: '#5a7394',
  mojave: '#c9a06c',
  'space-gray': '#2c2c2e',
  midnight: '#1a2332',
  ocean: '#0077b6',
  forest: '#2d5a27',
  rose: '#e8a0bf',
  sunset: '#e07040',
  lavender: '#b8a9c9',
  cream: '#f5f0e8',
  charcoal: '#1c1c1e',
  sky: '#87ceeb',
  sunrise: '#ff7e5f',
  twilight: '#e67e6e',
  aurora: '#2d8a7a',
  cherry: '#fcb69f',
  mint: '#a8e6cf',
  slate: '#4ca1af',
};

const WALLPAPER_PRESETS: WallpaperPreset[] = [
  // macOS-style gradients
  { id: 'sonoma', name: 'Sonoma', type: 'gradient', css: 'linear-gradient(135deg, #2c1b4d 0%, #6b3fa0 30%, #e67e6e 60%, #f3c46c 100%)' },
  { id: 'ventura', name: 'Ventura', type: 'gradient', css: 'linear-gradient(135deg, #f5a623 0%, #f76b6b 40%, #6e4a9e 70%, #3b2e5a 100%)' },
  { id: 'monterey', name: 'Monterey', type: 'gradient', css: 'linear-gradient(135deg, #e6644e 0%, #d94e8c 30%, #8b5cf6 60%, #4898e3 100%)' },
  { id: 'bigsur', name: 'Big Sur', type: 'gradient', css: 'linear-gradient(135deg, #125ec6 0%, #00a4e4 30%, #f87b5e 60%, #f6a355 100%)' },
  { id: 'catalina', name: 'Catalina', type: 'gradient', css: 'linear-gradient(135deg, #040b1e 0%, #143259 40%, #5a7394 70%, #9aafc5 100%)' },
  { id: 'mojave', name: 'Mojave', type: 'gradient', css: 'linear-gradient(135deg, #c9a06c 0%, #e0c28e 35%, #a89270 65%, #6b5b4a 100%)' },
  // Solid colors
  { id: 'space-gray', name: '深空灰', type: 'color', css: '#2c2c2e' },
  { id: 'midnight', name: '午夜蓝', type: 'color', css: '#1a2332' },
  { id: 'ocean', name: '海洋蓝', type: 'color', css: '#0077b6' },
  { id: 'forest', name: '森林绿', type: 'color', css: '#2d5a27' },
  { id: 'rose', name: '玫瑰粉', type: 'color', css: '#e8a0bf' },
  { id: 'sunset', name: '日落橙', type: 'color', css: '#e07040' },
  { id: 'lavender', name: '薰衣草', type: 'color', css: '#b8a9c9' },
  { id: 'cream', name: '奶油白', type: 'color', css: '#f5f0e8' },
  { id: 'charcoal', name: '炭黑', type: 'color', css: '#1c1c1e' },
  { id: 'sky', name: '天空蓝', type: 'color', css: '#87ceeb' },
  // Gradients
  { id: 'sunrise', name: '日出', type: 'gradient', css: 'linear-gradient(to bottom, #ff7e5f, #feb47b)' },
  { id: 'twilight', name: '暮光', type: 'gradient', css: 'linear-gradient(to bottom, #2c1b4d, #e67e6e, #f3c46c)' },
  { id: 'aurora', name: '极光', type: 'gradient', css: 'linear-gradient(135deg, #0c2340, #1b5e64, #2d8a7a, #6ec6a0)' },
  { id: 'cherry', name: '樱花', type: 'gradient', css: 'linear-gradient(to bottom, #ffecd2, #fcb69f, #e8a0bf)' },
  { id: 'mint', name: '薄荷', type: 'gradient', css: 'linear-gradient(135deg, #a8e6cf, #dcedc1, #ffd3b6)' },
  { id: 'slate', name: '石板', type: 'gradient', css: 'linear-gradient(135deg, #2c3e50, #4ca1af, #c0c0aa)' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, NzIconModule, TopBar, Dock, DesktopFileComponent, DragDropModule, NzDropDownModule, WindowWrapperComponent, LoginComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  isAuthenticated = false;

  apps: DesktopApp[] = [
    { id: 'file-manager', name: 'Files', icon: '/icon_files.png' },
    { id: 'image-viewer', name: '图片预览', icon: '/icon_preview.svg' },
    { id: 'terminal', name: 'Terminal', icon: '/icon_terminal.png' },
    { id: 'system-settings', name: 'System Settings', icon: '/icon_settings.png' },
    { id: 'firewall', name: 'Firewall', icon: '/icon_firewall.png' }
  ];

  appManagerEntry: DesktopApp = { id: 'app-manager', name: 'App Manager', icon: '/icon_app_manager.png' };

  desktopApps: DesktopApp[] = [];
  dockApps: DesktopApp[] = [];
  openWindows: WindowState[] = [];

  // Desktop files (from ~/Desktop folder)
  desktopFiles: FileInfo[] = [];
  desktopPath = '';
  selectedDesktopFiles: Set<string> = new Set();
  showHiddenDesktopFiles = false;
  desktopFilePositions: Record<string, { x: number; y: number }> = {};

  // Rubber-band selection
  rubberBand = { active: false, startX: 0, startY: 0, x: 0, y: 0, w: 0, h: 0 };

  get filteredDesktopFiles(): FileInfo[] {
    if (this.showHiddenDesktopFiles) return this.desktopFiles;
    return this.desktopFiles.filter(f => !f.name.startsWith('.'));
  }

  toggleHiddenDesktopFiles(): void {
    this.showHiddenDesktopFiles = !this.showHiddenDesktopFiles;
  }

  // ===== Desktop file selection & dragging =====

  onDesktopFileSelect(data: { file: FileInfo; event: MouseEvent }): void {
    const ctrl = data.event.ctrlKey || data.event.metaKey;
    if (ctrl) {
      if (this.selectedDesktopFiles.has(data.file.path)) {
        this.selectedDesktopFiles.delete(data.file.path);
      } else {
        this.selectedDesktopFiles.add(data.file.path);
      }
    } else {
      this.selectedDesktopFiles.clear();
      this.selectedDesktopFiles.add(data.file.path);
    }
    // Force change detection by creating new Set
    this.selectedDesktopFiles = new Set(this.selectedDesktopFiles);
  }

  onDesktopFileDragStart(data: { file: FileInfo; event: MouseEvent }): void {
    // Begin dragging the file icon
    const startX = data.event.clientX;
    const startY = data.event.clientY;
    const origPos = this.desktopFilePositions[data.file.path] || { x: 0, y: 0 };
    const startPosX = origPos.x;
    const startPosY = origPos.y;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.desktopFilePositions[data.file.path] = {
        x: startPosX + dx,
        y: startPosY + dy
      };
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  isDesktopFileSelected(file: FileInfo): boolean {
    return this.selectedDesktopFiles.has(file.path);
  }

  getDesktopFilePos(file: FileInfo): { x: number; y: number } {
    return this.desktopFilePositions[file.path] || { x: 0, y: 0 };
  }

  // ===== Rubber-band selection =====

  onDesktopMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    // Only start rubber-band when clicking on empty desktop
    const target = event.target as HTMLElement;
    if (target.closest('.desktop-file-item')) return;

    this.rubberBand.active = true;
    this.rubberBand.startX = event.clientX;
    this.rubberBand.startY = event.clientY;
    this.rubberBand.x = event.clientX;
    this.rubberBand.y = event.clientY;
    this.rubberBand.w = 0;
    this.rubberBand.h = 0;

    if (!(event.ctrlKey || event.metaKey)) {
      this.selectedDesktopFiles.clear();
      this.selectedDesktopFiles = new Set(this.selectedDesktopFiles);
    }

    const onMove = (e: MouseEvent) => {
      if (!this.rubberBand.active) return;
      const rx = Math.min(e.clientX, this.rubberBand.startX);
      const ry = Math.min(e.clientY, this.rubberBand.startY);
      this.rubberBand.x = rx;
      this.rubberBand.y = ry;
      this.rubberBand.w = Math.abs(e.clientX - this.rubberBand.startX);
      this.rubberBand.h = Math.abs(e.clientY - this.rubberBand.startY);
    };

    const onUp = () => {
      if (!this.rubberBand.active) return;
      this.rubberBand.active = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (this.rubberBand.w > 5 || this.rubberBand.h > 5) {
        const r = {
          left: this.rubberBand.x,
          top: this.rubberBand.y,
          right: this.rubberBand.x + this.rubberBand.w,
          bottom: this.rubberBand.y + this.rubberBand.h,
        };
        const container = document.querySelector('.desktop-content');
        if (container) {
          const cr = container.getBoundingClientRect();
          for (const file of this.filteredDesktopFiles) {
            const pos = this.desktopFilePositions[file.path] || { x: 0, y: 0 };
            const fx = cr.left + pos.x;
            const fy = cr.top + pos.y;
            if (fx + 88 > r.left && fx < r.right && fy + 80 > r.top && fy < r.bottom) {
              this.selectedDesktopFiles.add(file.path);
            }
          }
          this.selectedDesktopFiles = new Set(this.selectedDesktopFiles);
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Wallpaper
  wallpapers = WALLPAPER_PRESETS;
  showWallpaperPicker = false;
  currentWallpaperId = 'sonoma';
  customImageUrl = '';
  wallpaperType: 'builtin' | 'custom-image' | 'local-image' = 'builtin';
  // Local image browser
  wpLocalPath = '/home';
  wpLocalFiles: { name: string; path: string; isDir: boolean }[] = [];
  wpLocalLoading = false;

  constructor(
    private viewContainerRef: ViewContainerRef,
    private nzContextMenuService: NzContextMenuService,
    private windowManager: WindowManagerService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.isAuthenticated = this.authService.isAuthenticated();
    // Apps live in App Manager, not on desktop
    this.desktopApps = [];
    // Dock shows File Manager + App Manager + Terminal
    this.dockApps = [
      this.apps[0], // File Manager
      this.appManagerEntry, // App Manager
      this.apps[2], // Terminal
    ];

    this.windowManager.windows$.subscribe(windows => {
      this.openWindows = windows;
      // Update dock open indicators
      const openIds = new Set(windows.map(w => w.appId));
      for (const a of this.dockApps) {
        a.isOpen = openIds.has(a.id);
      }
    });

    this.loadWallpaper();
    this.initAppearance();
    this.loadDesktopFiles();

    window.addEventListener('wzos-launch-app', ((e: CustomEvent) => {
      this.openApp(e.detail);
    }) as EventListener);
  }

  onLoginSuccess(): void {
    this.isAuthenticated = true;
  }

  openApp(app: DesktopApp) {
    const componentMap: Record<string, any> = {
      'terminal': TerminalComponent,
      'file-manager': FileManagerComponent,
      'image-viewer': MediaViewerComponent,
      'system-settings': SystemSettingsComponent,
      'app-manager': AppManagerComponent
    };

    const componentType = componentMap[app.id];
    if (componentType) {
      const title = app.id === 'terminal' ? 'zsh' : app.name;
      const inputs: Record<string, any> = {};
      if (app.id === 'app-manager') {
        inputs['apps'] = this.apps;
      }
      this.windowManager.openWindow(app.id, title, componentType, { inputs });
    }
  }

  closeWindow(windowId: string) {
    this.windowManager.closeWindow(windowId);
  }

  minimizeWindow(windowId: string) {
    this.windowManager.minimizeWindow(windowId);
  }

  maximizeWindow(windowId: string) {
    this.windowManager.maximizeWindow(windowId);
  }

  focusWindow(windowId: string) {
    this.windowManager.focusWindow(windowId);
  }

  restoreWindow(windowId: string) {
    this.windowManager.restoreWindow(windowId);
  }

  contextMenu($event: MouseEvent, menu: NzDropdownMenuComponent): void {
    $event.preventDefault();
    this.nzContextMenuService.create($event, menu);
  }

  handleMenuAction(action: string): void {
    this.nzContextMenuService.close();
    if (action === 'Change Wallpaper') {
      this.openWallpaperPicker();
    } else if (action === 'Refresh') {
      this.loadDesktopFiles();
    } else if (action === 'Toggle Hidden') {
      this.toggleHiddenDesktopFiles();
    } else if (action === 'New Folder') {
      const name = prompt('请输入新文件夹名称:');
      if (name && name.trim()) {
        const path = this.desktopPath + '/' + name.trim();
        this.http.post('/api/files/create', { path, isDir: true }).subscribe({
          next: () => this.loadDesktopFiles(),
          error: (err) => alert('创建失败: ' + (err.error?.error || err.message))
        });
      }
    }
  }

  // ===== App icon context menus =====

  /** Store which app was right-clicked and show its context menu */
  openAppContextMenu(data: { app: DesktopApp; event: MouseEvent }, menu: NzDropdownMenuComponent): void {
    this.rightClickedApp = data.app;
    this.nzContextMenuService.create(data.event, menu);
  }

  /** Handle actions from app context menus */
  handleAppMenuAction(action: string): void {
    this.nzContextMenuService.close();
    const app = this.rightClickedApp;
    if (!app) return;

    switch (action) {
      case 'open':
        this.openApp(app);
        break;
      case 'new-window':
        this.openNewWindow(app);
        break;
      case 'show-info':
        // Placeholder — could show a dialog
        break;
      case 'remove-from-desktop':
        this.desktopApps = this.desktopApps.filter(a => a.id !== app.id);
        break;
      default:
        // Forward action to the focused window (e.g. 'new-tab', 'new-folder')
        const focused = this.windowManager.getFocusedWindow();
        if (focused) {
          this.windowManager.dispatchMenuAction(action);
        }
        break;
    }
  }

  openNewWindow(app: DesktopApp): void {
    const componentMap: Record<string, any> = {
      'terminal': TerminalComponent,
      'file-manager': FileManagerComponent,
      'image-viewer': MediaViewerComponent,
      'system-settings': SystemSettingsComponent,
      'app-manager': AppManagerComponent
    };
    const componentType = componentMap[app.id];
    if (!componentType) return;
    const inputs: Record<string, any> = {};
    if (app.id === 'app-manager') {
      inputs['apps'] = this.apps;
    }
    this.windowManager.openWindow(
      `${app.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      app.name,
      componentType,
      { inputs }
    );
  }

  rightClickedApp: DesktopApp | null = null;

  // ===== Wallpaper =====
  openWallpaperPicker(): void {
    this.showWallpaperPicker = true;
    this.wpNavigateLocal(this.wpLocalPath);
  }

  closeWallpaperPicker(): void {
    this.showWallpaperPicker = false;
  }

  selectWallpaper(id: string): void {
    this.currentWallpaperId = id;
    this.wallpaperType = 'builtin';
    this.applyWallpaper();
  }

  get currentWallpaper(): WallpaperPreset | undefined {
    return this.wallpapers.find(w => w.id === this.currentWallpaperId);
  }

  get desktopStyle(): Record<string, string> {
    if (this.wallpaperType === 'custom-image' && this.customImageUrl) {
      return {
        background: `url(${this.customImageUrl}) center/cover no-repeat`,
        backgroundColor: '#1c1c1e'
      };
    }
    if (this.wallpaperType === 'local-image' && this.customImageUrl) {
      return {
        background: `url(/api/files/view?path=${encodeURIComponent(this.customImageUrl)}) center/cover no-repeat`,
        backgroundColor: '#1c1c1e'
      };
    }
    const wp = this.currentWallpaper;
    if (!wp) {
      return { background: 'linear-gradient(135deg, #e0e7ef, #c5d1e0, #d4c5e0)' };
    }
    if (wp.type === 'color') {
      return { background: wp.css };
    }
    return { background: wp.css };
  }

  applyWallpaper(): void {
    this.saveWallpaper();
    this.applyWallpaperTint();
  }

  applyWallpaperTint(): void {
    let tintColor = '#6b3fa0'; // default
    if (this.wallpaperType === 'builtin') {
      tintColor = WALLPAPER_TINT_COLORS[this.currentWallpaperId] || '#6b3fa0';
    } else if (this.wallpaperType === 'custom-image' || this.wallpaperType === 'local-image') {
      tintColor = '#888888'; // neutral tint for custom images
    }
    document.documentElement.style.setProperty('--wzos-window-tint', tintColor);
  }

  applyCustomImage(): void {
    if (!this.customImageUrl.trim()) return;
    this.wallpaperType = 'custom-image';
    this.applyWallpaper();
    this.showWallpaperPicker = false;
  }

  resetWallpaper(): void {
    this.currentWallpaperId = 'sonoma';
    this.wallpaperType = 'builtin';
    this.customImageUrl = '';
    this.applyWallpaper();
  }

  // ===== Local Image Browser for Wallpaper =====
  isImageFile(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff'].includes(ext || '');
  }

  wpNavigateLocal(path: string): void {
    this.wpLocalPath = path;
    this.wpLocalLoading = true;
    this.http.get<any[]>(`/api/files/list?path=${encodeURIComponent(path)}`).subscribe({
      next: (data) => {
        this.wpLocalFiles = (data || [])
          .filter((f: any) => f != null && (f.isDir || this.isImageFile(f.name)))
          .sort((a: any, b: any) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        this.wpLocalLoading = false;
      },
      error: () => {
        this.wpLocalLoading = false;
      }
    });
  }

  wpGoUpLocal(): void {
    const parent = this.wpLocalPath.substring(0, this.wpLocalPath.lastIndexOf('/'));
    this.wpNavigateLocal(parent || '/');
  }

  selectLocalWallpaper(file: { name: string; path: string; isDir: boolean }): void {
    if (file.isDir) {
      this.wpNavigateLocal(file.path);
    } else {
      this.customImageUrl = file.path;
      this.wallpaperType = 'local-image';
      this.applyWallpaper();
      this.showWallpaperPicker = false;
    }
  }

  private saveWallpaper(): void {
    const data = {
      wallpaperId: this.currentWallpaperId,
      type: this.wallpaperType,
      customImageUrl: this.customImageUrl
    };
    localStorage.setItem('wzos-wallpaper', JSON.stringify(data));
  }

  private loadWallpaper(): void {
    try {
      const saved = localStorage.getItem('wzos-wallpaper');
      if (saved) {
        const data = JSON.parse(saved);
        this.currentWallpaperId = data.wallpaperId || 'sonoma';
        this.wallpaperType = data.type || 'builtin';
        this.customImageUrl = data.customImageUrl || '';
        if (data.localPath) this.wpLocalPath = data.localPath;
        this.applyWallpaper();
        this.applyWallpaperTint();
      } else {
        this.currentWallpaperId = 'sonoma';
        this.applyWallpaper();
        this.applyWallpaperTint();
      }
    } catch {
      this.currentWallpaperId = 'sonoma';
      this.applyWallpaper();
      this.applyWallpaperTint();
    }
  }

  // ===== Desktop Files =====

  loadDesktopFiles(): void {
    const u = this.authService.username;
    const candidates: string[] = [];
    if (u) {
      candidates.push(`/home/${u}`, `/home/${u}/Desktop`);
    }
    candidates.push('/root', '/root/Desktop', '/home', '/');

    const tryNext = (index: number) => {
      if (index >= candidates.length) {
        this.desktopFiles = [];
        return;
      }
      const path = candidates[index];
      this.http.get<any[]>('/api/files/list?path=' + encodeURIComponent(path)).subscribe({
        next: (data) => {
          if (data != null && Array.isArray(data)) {
            this.desktopPath = path;
            this.desktopFiles = (data as any[])
              .filter((f: any) => f != null)
              .sort((a: any, b: any) => {
                if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
                return a.name.localeCompare(b.name);
              });
            // Assign default positions for new files
            let col = 0, row = 0;
            for (const f of this.desktopFiles) {
              if (!this.desktopFilePositions[f.path]) {
                this.desktopFilePositions[f.path] = { x: col * 100 + 20, y: row * 94 + 10 };
                col++;
                if (col >= 8) { col = 0; row++; }
              }
            }
          } else {
            tryNext(index + 1);
          }
        },
        error: () => tryNext(index + 1)
      });
    };
    tryNext(0);
  }

  openDesktopFile(file: FileInfo): void {
    if (file.isDir) {
      // Open directory in file manager
      this.windowManager.openWindow('file-manager', file.name, FileManagerComponent);
    } else if (this.isMediaFile(file)) {
      // Open media in viewer
      const type = this.getDesktopMediaType(file);
      const mediaFiles = this.desktopFiles
        .filter(f => !f.isDir && this.isMediaFile(f))
        .map(f => ({ name: f.name, path: f.path, type: this.getDesktopMediaType(f)!, fileType: f.name.split('.').pop() }));
      const idx = mediaFiles.findIndex(f => f.path === file.path);
      this.windowManager.openWindow(
        'image-viewer',
        file.name,
        MediaViewerComponent,
        {
          size: { width: 900, height: 640 },
          position: { x: 120, y: 80 },
          inputs: {
            files: mediaFiles,
            currentIndex: idx >= 0 ? idx : 0,
            windowTitle: file.name
          }
        }
      );
    } else {
      // Download other file types
      const link = document.createElement('a');
      link.href = '/api/files/download?path=' + encodeURIComponent(file.path);
      link.download = file.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  isMediaFile(file: FileInfo): boolean {
    return this.getDesktopMediaType(file) !== null;
  }

  getDesktopMediaType(file: FileInfo): 'image' | 'audio' | 'video' | null {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'];
    const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'm4a', 'opus'];
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v'];
    if (imageExts.includes(ext || '')) return 'image';
    if (audioExts.includes(ext || '')) return 'audio';
    if (videoExts.includes(ext || '')) return 'video';
    return null;
  }

  private initAppearance(): void {
    const defaultAppearance = {
      appearanceMode: 'auto', accentColor: 'blue', highlightColor: 'accent',
      scrollBarBehavior: 'auto', scrollBarClickAction: 'next-page',
      preferHorizontalTabs: false, allowWallpaperTinting: true, defaultBrowser: 'safari',
    };
    const accentMap: Record<string, string> = {
      blue: '#007aff', purple: '#af52de', pink: '#ff2d55', red: '#ff3b30',
      orange: '#ff9500', yellow: '#ffcc00', green: '#34c759', graphite: '#8e8e93',
    };

    let settings = defaultAppearance;
    try {
      const saved = localStorage.getItem('wzos-appearance');
      if (saved) {
        settings = { ...defaultAppearance, ...JSON.parse(saved) };
      }
    } catch {}

    const root = document.documentElement;
    const accent = accentMap[settings.accentColor] || '#007aff';
    const highlight = settings.highlightColor === 'accent' ? accent : settings.highlightColor;

    root.style.setProperty('--wzos-accent-color', accent);
    root.style.setProperty('--wzos-accent-color-light', accent + '33');
    root.style.setProperty('--wzos-accent-color-medium', accent + '66');
    root.style.setProperty('--wzos-highlight-color', highlight);
    root.style.setProperty('--wzos-highlight-color-light', highlight + '33');

    root.classList.remove('wzos-light', 'wzos-dark');
    if (settings.appearanceMode === 'dark') {
      root.classList.add('wzos-dark');
    } else if (settings.appearanceMode === 'light') {
      root.classList.add('wzos-light');
    }

    if (settings.allowWallpaperTinting) {
      root.classList.add('wzos-tinted-windows');
    } else {
      root.classList.remove('wzos-tinted-windows');
    }

    if (settings.scrollBarBehavior === 'always') {
      root.classList.add('wzos-scrollbars-always');
    } else if (settings.scrollBarBehavior === 'when-scrolling') {
      root.classList.add('wzos-scrollbars-hidden');
    }

    if (settings.preferHorizontalTabs) {
      root.classList.add('wzos-horizontal-tabs');
    }
  }

  logout(): void {
    this.authService.logout();
    this.isAuthenticated = false;
    for (const w of [...this.openWindows]) {
      this.windowManager.closeWindow(w.id);
    }
  }
}

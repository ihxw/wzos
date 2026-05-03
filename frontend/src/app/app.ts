import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TopBar } from './components/top-bar/top-bar';
import { Dock } from './components/dock/dock';
import { DesktopIcon } from './components/desktop-icon/desktop-icon';
import { DesktopApp } from './core/models/app.model';
import { TerminalComponent } from './components/terminal/terminal';
import { FileManagerComponent } from './components/file-manager/file-manager';
import { MediaViewerComponent } from './components/media-viewer/media-viewer';
import { SystemSettingsComponent } from './apps/system-settings/system-settings';
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
  imports: [CommonModule, FormsModule, NzIconModule, TopBar, Dock, DesktopIcon, DragDropModule, NzDropDownModule, WindowWrapperComponent, LoginComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  isAuthenticated = false;

  apps: DesktopApp[] = [
    { id: 'file-manager', name: 'Files', icon: '/icon_files.png' },
    { id: 'image-viewer', name: '图片预览', icon: '/icon_preview.svg' },
    { id: 'terminal', name: 'Terminal', icon: '/icon_terminal.png' },
    { id: 'app-manager', name: 'App Manager', icon: '/icon_app_manager.png' },
    { id: 'system-settings', name: 'System Settings', icon: '/icon_settings.png' },
    { id: 'firewall', name: 'Firewall', icon: '/icon_firewall.png' }
  ];

  desktopApps: DesktopApp[] = [];
  dockApps: DesktopApp[] = [];
  openWindows: WindowState[] = [];

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
    this.desktopApps = [...this.apps];
    this.dockApps = [...this.apps];

    this.windowManager.windows$.subscribe(windows => {
      this.openWindows = windows;
    });

    this.loadWallpaper();
  }

  onLoginSuccess(): void {
    this.isAuthenticated = true;
  }

  openApp(app: DesktopApp) {
    const componentMap: Record<string, any> = {
      'terminal': TerminalComponent,
      'file-manager': FileManagerComponent,
      'image-viewer': MediaViewerComponent,
      'system-settings': SystemSettingsComponent
    };

    const componentType = componentMap[app.id];
    if (componentType) {
      const title = app.id === 'terminal' ? 'zsh' : app.name;
      this.windowManager.openWindow(app.id, title, componentType);
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
      'system-settings': SystemSettingsComponent
    };
    const componentType = componentMap[app.id];
    if (!componentType) return;
    // Always create a new window with a unique ID
    this.windowManager.openWindow(
      `${app.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      app.name,
      componentType
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
      } else {
        this.currentWallpaperId = 'sonoma';
        this.applyWallpaper();
      }
    } catch {
      this.currentWallpaperId = 'sonoma';
      this.applyWallpaper();
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

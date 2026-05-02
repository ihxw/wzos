import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBar } from './components/top-bar/top-bar';
import { Dock } from './components/dock/dock';
import { DesktopIcon } from './components/desktop-icon/desktop-icon';
import { DesktopApp } from './core/models/app.model';
import { TerminalComponent } from './components/terminal/terminal';
import { FileManagerComponent } from './components/file-manager/file-manager';
import { SystemSettingsComponent } from './apps/system-settings/system-settings';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import { WindowManagerService, WindowState } from './core/services/window-manager.service';
import { WindowWrapperComponent } from './shared/window-wrapper/window-wrapper';
import { AuthService } from './core/services/auth.service';
import { LoginComponent } from './components/login/login';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TopBar, Dock, DesktopIcon, DragDropModule, NzDropDownModule, WindowWrapperComponent, LoginComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  isAuthenticated = false;

  apps: DesktopApp[] = [
    { id: 'file-manager', name: 'Files', icon: '/icon_files.png' },
    { id: 'terminal', name: 'Terminal', icon: '/icon_terminal.png' },
    { id: 'app-manager', name: 'App Manager', icon: '/icon_app_manager.png' },
    { id: 'system-settings', name: 'System Settings', icon: '/icon_settings.png' },
    { id: 'firewall', name: 'Firewall', icon: '/icon_firewall.png' }
  ];

  desktopApps: DesktopApp[] = [];
  dockApps: DesktopApp[] = [];
  openWindows: WindowState[] = [];

  constructor(
    private viewContainerRef: ViewContainerRef,
    private nzContextMenuService: NzContextMenuService,
    private windowManager: WindowManagerService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.desktopApps = [...this.apps];
    this.dockApps = [...this.apps];

    this.windowManager.windows$.subscribe(windows => {
      this.openWindows = windows;
    });
  }

  onLoginSuccess(): void {
    this.isAuthenticated = true;
  }

  openApp(app: DesktopApp) {
    const componentMap: Record<string, any> = {
      'terminal': TerminalComponent,
      'file-manager': FileManagerComponent,
      'system-settings': SystemSettingsComponent
    };

    const componentType = componentMap[app.id];
    if (componentType) {
      this.windowManager.openWindow(app.id, app.name, componentType);
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
  }

  logout(): void {
    this.authService.logout();
    this.isAuthenticated = false;
    for (const w of [...this.openWindows]) {
      this.windowManager.closeWindow(w.id);
    }
  }
}

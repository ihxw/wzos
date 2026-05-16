import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { WindowManagerService } from '../../core/services/window-manager.service';
import { AuthService } from '../../core/services/auth.service';

interface GeneralUIPrefs {
  clock24h: boolean;
  showSeconds: boolean;
}

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzDropDownModule],
  templateUrl: './top-bar.html',
  styleUrls: ['./top-bar.scss']
})
export class TopBar implements OnInit, OnDestroy {
  currentTime: Date = new Date();
  activeAppName: string = 'WZOS';
  focusedAppId: string = '';
  username: string = '';
  clock24h = true;
  showSeconds = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private uiPrefsHandler = () => this.loadClockPrefs();

  constructor(
    private windowManager: WindowManagerService,
    private authService: AuthService
  ) {
    this.username = this.authService.username;
    this.windowManager.windows$.subscribe(() => {
      const focused = this.windowManager.getFocusedWindow();
      if (focused) {
        this.activeAppName = focused.title;
        this.focusedAppId = focused.appId;
      } else {
        this.activeAppName = 'WZOS';
        this.focusedAppId = '';
      }
    });
  }

  ngOnInit() {
    this.loadClockPrefs();
    window.addEventListener('wzos-general-ui-changed', this.uiPrefsHandler);
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener('wzos-general-ui-changed', this.uiPrefsHandler);
  }

  get timeFormat(): string {
    const h = this.clock24h ? 'HH' : 'hh';
    const a = this.clock24h ? '' : ' a';
    const s = this.showSeconds ? ':ss' : '';
    return `EEE MMM d ${h}:mm${s}${a}`;
  }

  private loadClockPrefs(): void {
    try {
      const raw = localStorage.getItem('wzos-general-ui');
      if (raw) {
        const prefs = JSON.parse(raw) as GeneralUIPrefs;
        this.clock24h = prefs.clock24h ?? true;
        this.showSeconds = prefs.showSeconds ?? false;
      }
    } catch {
      this.clock24h = true;
      this.showSeconds = false;
    }
  }

  onFileMenuClick(action: string): void {
    this.windowManager.dispatchMenuAction(action);
  }

  openSpotlight(): void {
    window.dispatchEvent(new CustomEvent('wzos-spotlight'));
  }

  shellMenu(action: string): void {
    window.dispatchEvent(new CustomEvent('wzos-shell-menu', { detail: action }));
  }

  logout(): void {
    this.authService.logout();
    window.location.reload();
  }
}

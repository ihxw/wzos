import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { WindowManagerService } from '../../core/services/window-manager.service';
import { AuthService } from '../../core/services/auth.service';

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
  private timer: any;

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
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  onFileMenuClick(action: string): void {
    this.windowManager.dispatchMenuAction(action);
  }

  logout(): void {
    this.authService.logout();
    window.location.reload();
  }
}

import { Component, OnInit } from '@angular/core';
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
export class TopBar implements OnInit {
  currentTime: Date = new Date();
  activeAppName: string = 'WZOS';
  username: string = '';
  private timer: any;

  constructor(
    private windowManager: WindowManagerService,
    private authService: AuthService
  ) {
    this.username = this.authService.username;
    this.windowManager.windows$.subscribe(windows => {
      const focused = windows.reduce((prev, curr) =>
        curr.zIndex > (prev?.zIndex ?? 0) ? curr : prev, null as any);
      if (focused) {
        this.activeAppName = focused.title;
      }
    });
  }

  ngOnInit() {
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  logout(): void {
    this.authService.logout();
    // Notify parent via window event
    window.location.reload();
  }
}

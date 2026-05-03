import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesktopApp } from '../../core/models/app.model';

@Component({
  selector: 'app-app-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-manager">
      <div class="am-toolbar">
        <span class="am-title">应用程序</span>
        <span class="am-count">{{ apps.length }} 个应用</span>
      </div>
      <div class="am-grid">
        <div class="am-item" *ngFor="let app of apps" (dblclick)="launchApp(app)">
          <div class="am-icon">
            <img [src]="app.icon" [alt]="app.name" />
          </div>
          <span class="am-name">{{ app.name }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-manager {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--wzos-bg-content);
      color: var(--wzos-text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    }
    .am-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      border-bottom: 1px solid var(--wzos-border-subtle);
      background: var(--wzos-bg-titlebar);
      flex-shrink: 0;
    }
    .am-title {
      font-size: 13px;
      font-weight: 700;
    }
    .am-count {
      font-size: 12px;
      color: var(--wzos-text-tertiary);
    }
    .am-grid {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 16px 8px;
      align-content: flex-start;
    }
    .am-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 10px 8px;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.1s;
      user-select: none;
    }
    .am-item:hover {
      background: var(--wzos-bg-hover);
    }
    .am-item:active {
      background: var(--wzos-accent-color-light);
    }
    .am-icon {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .am-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .am-name {
      font-size: 12px;
      font-weight: 500;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
  `]
})
export class AppManagerComponent {
  @Input() apps: DesktopApp[] = [];

  launchApp(app: DesktopApp) {
    window.dispatchEvent(new CustomEvent('wzos-launch-app', { detail: app }));
  }
}

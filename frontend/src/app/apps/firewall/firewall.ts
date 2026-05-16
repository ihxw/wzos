import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface FirewallStatus {
  enabled: boolean;
  status: string;
  backend: string;
  available: boolean;
}

@Component({
  selector: 'app-firewall',
  standalone: true,
  imports: [CommonModule],
  host: { style: 'display: block; width: 100%; height: 100%;' },
  template: `
    <div class="firewall-app">
      <header class="fw-header">
        <div class="fw-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#ff9500">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
        </div>
        <div class="fw-title">
          <h1>防火墙</h1>
          <p class="fw-sub" *ngIf="status">
            {{ status.available ? (status.enabled ? '已启用' : '已关闭') : '状态不可用' }}
            <span *ngIf="status.backend && status.backend !== 'none'"> · {{ status.backend }}</span>
          </p>
        </div>
        <button class="fw-refresh" (click)="loadStatus()" [disabled]="loading">刷新</button>
      </header>

      <div class="fw-body" *ngIf="!loading && status">
        <div class="fw-card" [class.enabled]="status.enabled" [class.disabled]="!status.enabled">
          <span class="fw-dot"></span>
          <span>{{ status.enabled ? '防火墙保护已开启' : '防火墙保护已关闭' }}</span>
        </div>
        <div class="fw-actions" *ngIf="status.available">
          <button class="fw-btn primary" (click)="setEnabled(true)" [disabled]="actionPending || status.enabled">启用防火墙</button>
          <button class="fw-btn" (click)="setEnabled(false)" [disabled]="actionPending || !status.enabled">关闭防火墙</button>
        </div>
        <pre class="fw-detail">{{ status.status }}</pre>
        <p class="fw-hint" *ngIf="!status.available">
          当前环境未检测到可管理的防火墙服务。在 Linux 上可安装 ufw 或 firewalld。
        </p>
        <p class="fw-hint" *ngIf="actionError">{{ actionError }}</p>
      </div>

      <div class="fw-loading" *ngIf="loading">正在读取防火墙状态…</div>
      <div class="fw-error" *ngIf="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .firewall-app {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 24px 28px;
      background: var(--wzos-window-bg, #f5f5f7);
      color: var(--wzos-text-primary, #1d1d1f);
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    }
    .fw-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .fw-title h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
    }
    .fw-sub {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--wzos-text-secondary, #6e6e73);
    }
    .fw-refresh {
      margin-left: auto;
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      background: rgba(0,0,0,0.06);
      cursor: pointer;
      font-size: 13px;
    }
    .fw-refresh:disabled { opacity: 0.5; cursor: default; }
    .fw-actions { display: flex; gap: 10px; margin-bottom: 16px; }
    .fw-btn {
      padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px;
      background: rgba(0,0,0,0.06);
    }
    .fw-btn.primary { background: #007aff; color: #fff; }
    .fw-btn:disabled { opacity: 0.5; cursor: default; }
    .fw-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 16px;
      font-weight: 500;
    }
    .fw-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ff3b30;
    }
    .fw-card.enabled .fw-dot { background: #34c759; }
    .fw-detail {
      margin: 0;
      padding: 16px;
      border-radius: 10px;
      background: rgba(0,0,0,0.04);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 320px;
      overflow: auto;
    }
    .fw-hint, .fw-error {
      margin-top: 12px;
      font-size: 13px;
      color: var(--wzos-text-secondary, #6e6e73);
    }
    .fw-error { color: #ff3b30; }
    .fw-loading { font-size: 14px; color: var(--wzos-text-secondary, #6e6e73); }
  `]
})
export class FirewallComponent implements OnInit {
  status: FirewallStatus | null = null;
  loading = false;
  actionPending = false;
  actionError = '';
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading = true;
    this.error = '';
    this.http.get<FirewallStatus>('/api/firewall/status').subscribe({
      next: (data) => {
        this.status = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || '无法获取防火墙状态';
      }
    });
  }

  setEnabled(enabled: boolean): void {
    this.actionPending = true;
    this.actionError = '';
    this.http.post<FirewallStatus>('/api/firewall/enable', { enabled }).subscribe({
      next: (data) => {
        this.status = data;
        this.actionPending = false;
      },
      error: (err) => {
        this.actionPending = false;
        this.actionError = err.error?.error || '操作失败（可能需要管理员权限）';
      }
    });
  }
}

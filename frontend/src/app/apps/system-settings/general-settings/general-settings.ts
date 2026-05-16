import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface GeneralCapabilities {
  canSetHostname: boolean;
  canSetTimezone: boolean;
  canSetNTP: boolean;
  canSetLocale: boolean;
  canManageWzos: boolean;
  hint: string;
}

export interface LocaleOption {
  code: string;
  label: string;
  active: boolean;
}

export interface GeneralSettings {
  hostname: string;
  timezone: string;
  localTime: string;
  ntpSync: boolean;
  locale: string;
  locales: LocaleOption[];
  wzosServiceEnabled: boolean;
  wzosServiceActive: boolean;
  timezones: string[];
  capabilities: GeneralCapabilities;
}

export interface GeneralUIPrefs {
  clock24h: boolean;
  showSeconds: boolean;
}

const UI_PREFS_KEY = 'wzos-general-ui';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './general-settings.html',
  styleUrls: ['./general-settings.scss']
})
export class GeneralSettingsComponent implements OnInit, OnDestroy {
  readonly t = {
    title: '通用',
    aboutDevice: '关于本机',
    computerName: '电脑名称',
    dateTime: '日期与时间',
    currentTime: '当前时间',
    timezone: '时区',
    ntpSync: '自动设置日期与时间',
    ntpSyncSub: '使用网络时间服务器保持系统时钟准确',
    language: '语言与地区',
    locale: '系统语言',
    localeHint: '更改后可能需要重新登录或重启部分应用后生效。',
    loginItems: '登录项',
    wzosPanel: 'WZOS 控制面板',
    wzosPanelSub: '开机时自动启动 wzos 服务',
    wzosRunning: '正在运行',
    wzosStopped: '未运行',
    menuBar: '菜单栏时钟',
    clock24h: '使用 24 小时制',
    showSeconds: '在菜单栏中显示秒',
    apply: '应用',
    loading: '正在加载…',
    retry: '重试',
    saved: '已保存',
    saveFailed: '保存失败'
  };

  settings: GeneralSettings | null = null;
  loading = false;
  saving = false;
  error = '';
  message = '';

  editHostname = '';
  editTimezone = '';
  editLocale = '';
  uiPrefs: GeneralUIPrefs = { clock24h: true, showSeconds: false };

  private clockTimer: ReturnType<typeof setInterval> | null = null;
  displayTime = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUIPrefs();
    this.loadSettings();
    this.startClockTick();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  get caps(): GeneralCapabilities | null {
    return this.settings?.capabilities ?? null;
  }

  get timezoneOptions(): string[] {
    if (!this.settings) return [];
    const set = new Set<string>(this.settings.timezones);
    if (this.settings.timezone) set.add(this.settings.timezone);
    return Array.from(set);
  }

  loadSettings(): void {
    this.loading = true;
    this.error = '';
    this.message = '';
    this.http.get<GeneralSettings>('/api/general/settings').subscribe({
      next: (data) => {
        this.settings = data;
        this.editHostname = data.hostname;
        this.editTimezone = data.timezone;
        this.editLocale = data.locale;
        this.displayTime = data.localTime;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || '无法加载通用设置';
        this.loading = false;
      }
    });
  }

  applyHostname(): void {
    const name = this.editHostname.trim();
    if (!name || !this.settings) return;
    this.put('/api/general/hostname', { hostname: name }, () => {
      this.settings!.hostname = name;
    });
  }

  onTimezoneChange(): void {
    if (!this.caps?.canSetTimezone) return;
    this.put('/api/general/timezone', { timezone: this.editTimezone }, () => {
      if (this.settings) this.settings.timezone = this.editTimezone;
      this.loadSettings();
    });
  }

  onNTPToggle(enabled: boolean): void {
    if (!this.settings || !this.caps?.canSetNTP) return;
    this.put('/api/general/ntp', { enabled }, () => {
      this.settings!.ntpSync = enabled;
    });
  }

  onLocaleChange(): void {
    if (!this.caps?.canSetLocale) return;
    this.put('/api/general/locale', { locale: this.editLocale }, () => {
      if (this.settings) this.settings.locale = this.editLocale;
    });
  }

  onWZOSToggle(enabled: boolean): void {
    if (!this.settings || !this.caps?.canManageWzos) return;
    this.put('/api/general/wzos-service', { enabled }, () => {
      this.settings!.wzosServiceEnabled = enabled;
    });
  }

  onUIPrefsChange(): void {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(this.uiPrefs));
    window.dispatchEvent(new CustomEvent('wzos-general-ui-changed', { detail: this.uiPrefs }));
  }

  private put(url: string, body: object, onOk: () => void): void {
    this.saving = true;
    this.message = '';
    this.error = '';
    this.http.put(url, body).subscribe({
      next: () => {
        this.saving = false;
        this.message = this.t.saved;
        onOk();
        setTimeout(() => (this.message = ''), 2000);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.error || this.t.saveFailed;
      }
    });
  }

  private loadUIPrefs(): void {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (raw) {
        this.uiPrefs = { clock24h: true, showSeconds: false, ...JSON.parse(raw) };
      }
    } catch {
      this.uiPrefs = { clock24h: true, showSeconds: false };
    }
  }

  private startClockTick(): void {
    this.clockTimer = setInterval(() => {
      this.displayTime = new Date().toLocaleString('zh-CN', {
        hour12: !this.uiPrefs.clock24h,
        hour: '2-digit',
        minute: '2-digit',
        second: this.uiPrefs.showSeconds ? '2-digit' : undefined,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }, 1000);
  }
}

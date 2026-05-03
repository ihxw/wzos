import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface SystemInfo {
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_usage: number;
  disk_total: number;
  disk_used: number;
  disk_usage: number;
  os: string;
  hostname: string;
  uptime: number;
  os_version: string;
  kernel: string;
  architecture: string;
  machine_model: string;
  cpu_brand: string;
  cpu_cores: number;
  gpu_info: string;
  serial_number: string;
}

interface MenuCategory {
  key: string;
  label: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-settings.html',
  styleUrls: ['./system-settings.scss']
})
export class SystemSettingsComponent implements OnInit {
  selectedMenu = 'about';
  systemInfo: SystemInfo | null = null;
  loading = false;
  searchText = '';
  showSystemReport = false;

  categories: MenuCategory[] = [
    { key: 'general', label: '通用', icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z', color: '#6e6e6e' },
    { key: 'network', label: '网络', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', color: '#007aff' },
    { key: 'appearance', label: '外观', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', color: '#af52de' },
    { key: 'services', label: '服务管理', icon: 'M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z', color: '#ff9500' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadSystemInfo();
  }

  selectMenu(key: string) {
    this.selectedMenu = key;
  }

  onSearch() {}

  loadSystemInfo() {
    this.loading = true;
    this.http.get<SystemInfo>('/api/sysinfo/overview').subscribe({
      next: (data) => {
        this.systemInfo = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
    if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
    return `${minutes} 分钟`;
  }

  formatSerial(sn: string): string {
    if (!sn) return '未知';
    if (sn.length <= 12) return sn;
    return sn.substring(0, 4) + '****' + sn.substring(sn.length - 4);
  }

  getChipLabel(): string {
    if (!this.systemInfo) return '';
    const arch = this.systemInfo.architecture || 'x86_64';
    const cores = this.systemInfo.cpu_cores || 0;
    let label = '';
    if (arch === 'amd64' || arch === 'x86_64') {
      label = 'x86_64';
    } else if (arch === 'arm64' || arch === 'aarch64') {
      label = 'ARM';
    }
    if (cores > 0) {
      label += ` (${cores} 核心)`;
    }
    return label;
  }
}

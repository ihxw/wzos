import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
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
}

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, NzMenuModule, NzTableModule, NzProgressModule, NzTagModule],
  templateUrl: './system-settings.html',
  styleUrls: ['./system-settings.scss']
})
export class SystemSettingsComponent implements OnInit {
  selectedMenu = 'about';
  systemInfo: SystemInfo | null = null;
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadSystemInfo();
  }

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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }
}

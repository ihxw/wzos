import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface SystemServiceItem {
  name: string;
  active: boolean;
  enabled: boolean;
  description: string;
}

@Component({
  selector: 'app-services-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services-settings.html',
  styleUrls: ['./services-settings.scss'],
})
export class ServicesSettingsComponent implements OnInit {
  services: SystemServiceItem[] = [];
  filter = '';
  loading = false;
  error = '';
  saving = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  get filtered(): SystemServiceItem[] {
    const q = this.filter.trim().toLowerCase();
    if (!q) return this.services;
    return this.services.filter(
      s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<SystemServiceItem[]>('/api/system/services').subscribe({
      next: data => {
        this.services = data ?? [];
        this.loading = false;
      },
      error: err => {
        this.error = err.error?.error || '无法加载服务列表';
        this.loading = false;
      },
    });
  }

  toggleActive(svc: SystemServiceItem): void {
    this.saving = true;
    const active = !svc.active;
    this.http.put('/api/system/services/active', { name: svc.name, active }).subscribe({
      next: () => {
        svc.active = active;
        this.saving = false;
      },
      error: err => {
        alert(err.error?.error || '操作失败');
        this.saving = false;
      },
    });
  }

  toggleEnabled(svc: SystemServiceItem): void {
    this.saving = true;
    const enabled = !svc.enabled;
    this.http.put('/api/system/services/enabled', { name: svc.name, enabled }).subscribe({
      next: () => {
        svc.enabled = enabled;
        this.saving = false;
      },
      error: err => {
        alert(err.error?.error || '操作失败');
        this.saving = false;
      },
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface NetworkCapabilities {
  backend: string;
  canToggle: boolean;
  canSetIPv4: boolean;
  canWiFi: boolean;
  readOnly: boolean;
  hint: string;
}

export interface NetworkOverview {
  connected: boolean;
  internetReach: boolean;
  hostname: string;
  primaryDevice: string;
  defaultGateway: string;
  services: NetworkServiceItem[];
  backend: string;
  capabilities: NetworkCapabilities;
}

export interface NetworkServiceItem {
  device: string;
  name: string;
  type: string;
  kind: string;
  state: string;
  connection: string;
  mac: string;
  ipv4: string[];
  ipv6: string[];
  signal?: number;
}

export interface NetworkDetail {
  device: string;
  connection: string;
  name: string;
  type: string;
  kind: string;
  state: string;
  ipv4Method: string;
  addresses: string[];
  gateway: string;
  dns: string[];
  subnetMask: string;
  searchDomain: string;
  mtu: number;
  mac: string;
}

export interface WiFiNetwork {
  ssid: string;
  signal: number;
  security: string;
  inUse: boolean;
}

@Component({
  selector: 'app-network-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './network-settings.html',
  styleUrls: ['./network-settings.scss']
})
export class NetworkSettingsComponent implements OnInit {
  overview: NetworkOverview | null = null;
  detail: NetworkDetail | null = null;
  selected: NetworkServiceItem | null = null;
  wifiNetworks: WiFiNetwork[] = [];

  loading = false;
  detailLoading = false;
  saving = false;
  scanning = false;
  error = '';
  detailError = '';
  showDetails = false;
  showWiFiPicker = false;

  ipv4Mode: 'auto' | 'manual' = 'auto';
  staticIP = '';
  staticPrefix = 24;
  staticGateway = '';
  staticDNS = '';

  wifiPassword = '';
  selectedSSID = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  get caps(): NetworkCapabilities | null {
    return this.overview?.capabilities ?? null;
  }

  get canToggle(): boolean {
    return this.caps?.canToggle ?? false;
  }

  get canSetIPv4(): boolean {
    return this.caps?.canSetIPv4 ?? false;
  }

  get canWiFi(): boolean {
    return this.caps?.canWiFi ?? false;
  }

  get statusText(): string {
    if (!this.overview) return '';
    if (this.overview.connected && this.overview.internetReach) {
      return '已连接互联网';
    }
    if (this.overview.connected) {
      return '已连接网络';
    }
    return '未连接';
  }

  loadOverview(): void {
    this.loading = true;
    this.error = '';
    this.http.get<NetworkOverview>('/api/network/overview').subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || '无法加载网络信息';
      }
    });
  }

  openService(svc: NetworkServiceItem): void {
    this.selected = svc;
    this.showDetails = false;
    this.showWiFiPicker = false;
    this.detail = null;
    this.detailError = '';
    this.loadDetail(svc.device);
    if (svc.kind === 'wifi' && this.canWiFi) {
      this.scanWiFi(svc.device);
    }
  }

  closeDetail(): void {
    this.selected = null;
    this.detail = null;
    this.showDetails = false;
    this.showWiFiPicker = false;
    this.wifiNetworks = [];
  }

  loadDetail(device: string): void {
    this.detailLoading = true;
    this.http.get<NetworkDetail>(`/api/network/device/${encodeURIComponent(device)}`).subscribe({
      next: (data) => {
        this.detail = data;
        this.detailLoading = false;
        this.ipv4Mode = data.ipv4Method === 'manual' ? 'manual' : 'auto';
        if (data.addresses?.length) {
          const [ip, prefix] = this.splitCIDR(data.addresses[0]);
          this.staticIP = ip;
          this.staticPrefix = prefix || 24;
        }
        this.staticGateway = data.gateway || '';
        this.staticDNS = (data.dns || []).join(', ');
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError = err.error?.error || '无法加载连接详情';
      }
    });
  }

  isConnected(svc: NetworkServiceItem): boolean {
    const s = svc.state.toLowerCase();
    return s.includes('connected') || s === 'up';
  }

  serviceSubtitle(svc: NetworkServiceItem): string {
    if (this.isConnected(svc)) {
      if (svc.ipv4?.length) {
        return this.splitCIDR(svc.ipv4[0])[0];
      }
      return svc.connection || '已连接';
    }
    if (svc.state === 'unavailable') return '不可用';
    return '未连接';
  }

  toggleService(enabled: boolean): void {
    if (!this.selected || !this.canToggle) return;
    this.saving = true;
    this.detailError = '';
    this.http.post(`/api/network/device/${encodeURIComponent(this.selected.device)}/enabled`, { enabled }).subscribe({
      next: () => {
        this.saving = false;
        this.loadOverview();
        this.loadDetail(this.selected!.device);
      },
      error: (err) => {
        this.saving = false;
        this.detailError = err.error?.error || '操作失败';
      }
    });
  }

  saveIPv4(): void {
    if (!this.selected || !this.canSetIPv4) return;
    this.saving = true;
    this.detailError = '';
    const body =
      this.ipv4Mode === 'auto'
        ? { method: 'auto' }
        : {
            method: 'manual',
            address: this.staticIP,
            prefix: this.staticPrefix,
            gateway: this.staticGateway,
            dns: this.staticDNS.split(/[,，\s]+/).filter(Boolean)
          };

    this.http.put(`/api/network/device/${encodeURIComponent(this.selected.device)}/ipv4`, body).subscribe({
      next: () => {
        this.saving = false;
        this.loadOverview();
        this.loadDetail(this.selected!.device);
      },
      error: (err) => {
        this.saving = false;
        this.detailError = err.error?.error || '保存失败';
      }
    });
  }

  scanWiFi(device: string): void {
    this.scanning = true;
    this.http.get<WiFiNetwork[]>(`/api/network/wifi/scan?device=${encodeURIComponent(device)}`).subscribe({
      next: (list) => {
        this.wifiNetworks = list;
        this.scanning = false;
      },
      error: () => {
        this.scanning = false;
      }
    });
  }

  connectWiFi(net: WiFiNetwork): void {
    if (!this.selected) return;
    this.selectedSSID = net.ssid;
    const needsPassword = net.security && net.security !== '--' && !net.security.includes('--');
    if (needsPassword && !this.wifiPassword) {
      this.showWiFiPicker = true;
      return;
    }
    this.doConnectWiFi(net.ssid);
  }

  doConnectWiFi(ssid: string): void {
    if (!this.selected) return;
    this.saving = true;
    this.http
      .post(`/api/network/wifi/${encodeURIComponent(this.selected.device)}/connect`, {
        ssid,
        password: this.wifiPassword
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.wifiPassword = '';
          this.showWiFiPicker = false;
          this.loadOverview();
          this.loadDetail(this.selected!.device);
          this.scanWiFi(this.selected!.device);
        },
        error: (err) => {
          this.saving = false;
          this.detailError = err.error?.error || '连接失败';
        }
      });
  }

  primaryAddress(detail: NetworkDetail): string {
    if (!detail.addresses?.length) return '—';
    return this.splitCIDR(detail.addresses[0])[0];
  }

  splitCIDR(addr: string): [string, number] {
    if (!addr) return ['', 24];
    const [ip, p] = addr.split('/');
    const prefix = parseInt(p, 10);
    return [ip, Number.isFinite(prefix) ? prefix : 24];
  }

  wifiBars(signal: number): number {
    if (signal >= 75) return 3;
    if (signal >= 50) return 2;
    if (signal >= 25) return 1;
    return 0;
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBar } from './components/top-bar/top-bar';
import { Dock } from './components/dock/dock';
import { DesktopIcon } from './components/desktop-icon/desktop-icon';
import { DesktopApp } from './core/models/app.model';
import 'winbox';

declare const WinBox: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TopBar, Dock, DesktopIcon],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  
  apps: DesktopApp[] = [
    { id: 'file-manager', name: 'Files', icon: 'ant-folder-open' },
    { id: 'terminal', name: 'Terminal', icon: 'ant-code' },
    { id: 'app-manager', name: 'App Manager', icon: 'ant-appstore' },
    { id: 'system-settings', name: 'Settings', icon: 'ant-setting' },
    { id: 'firewall', name: 'Firewall', icon: 'ant-security-scan' }
  ];

  desktopApps: DesktopApp[] = [];
  dockApps: DesktopApp[] = [];

  ngOnInit() {
    // For now, put all apps on desktop and dock
    this.desktopApps = [...this.apps];
    this.dockApps = [...this.apps];
  }

  openApp(app: DesktopApp) {
    app.isOpen = true;
    
    // Create WinBox instance
    new WinBox({
      title: app.name,
      background: "#1e1e1e",
      border: 1,
      class: ["modern"],
      x: "center",
      y: "center",
      width: "60%",
      height: "60%",
      html: `<div style="padding: 20px; color: white;"><h3>${app.name}</h3><p>Content for ${app.name} goes here. Angular component will be injected later.</p></div>`,
      onclose: () => {
        app.isOpen = false;
        return false; // allow closing
      }
    });
  }
}

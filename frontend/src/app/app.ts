import { Component, OnInit, ViewContainerRef, ComponentRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBar } from './components/top-bar/top-bar';
import { Dock } from './components/dock/dock';
import { DesktopIcon } from './components/desktop-icon/desktop-icon';
import { DesktopApp } from './core/models/app.model';
import { TerminalComponent } from './components/terminal/terminal';
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

  constructor(private viewContainerRef: ViewContainerRef) {}

  ngOnInit() {
    this.desktopApps = [...this.apps];
    this.dockApps = [...this.apps];
  }

  openApp(app: DesktopApp) {
    app.isOpen = true;
    
    let componentRef: ComponentRef<any> | null = null;

    const winbox = new WinBox({
      title: app.name,
      background: "#1e1e1e",
      border: 1,
      class: ["modern"],
      x: "center",
      y: "center",
      width: "60%",
      height: "60%",
      html: '',
      onclose: () => {
        app.isOpen = false;
        if (componentRef) {
          componentRef.destroy();
        }
        return false; 
      }
    });

    // Mount dynamic component based on app id
    if (app.id === 'terminal') {
      componentRef = this.viewContainerRef.createComponent(TerminalComponent);
      winbox.body.appendChild(componentRef.location.nativeElement);
    } else {
      winbox.body.innerHTML = `<div style="padding: 20px; color: white; font-family: sans-serif;">
                                <h3>${app.name}</h3>
                                <p>This application is under construction.</p>
                               </div>`;
    }
  }
}

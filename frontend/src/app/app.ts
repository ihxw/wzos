import { Component, OnInit, ViewContainerRef, ComponentRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBar } from './components/top-bar/top-bar';
import { Dock } from './components/dock/dock';
import { DesktopIcon } from './components/desktop-icon/desktop-icon';
import { DesktopApp } from './core/models/app.model';
import { TerminalComponent } from './components/terminal/terminal';
import { FileManagerComponent } from './components/file-manager/file-manager';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import 'winbox';

declare const WinBox: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TopBar, Dock, DesktopIcon, DragDropModule, NzDropDownModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  
  apps: DesktopApp[] = [
    { id: 'file-manager', name: 'Files', icon: '/icon_files.png' },
    { id: 'terminal', name: 'Terminal', icon: '/icon_terminal.png' },
    { id: 'app-manager', name: 'App Manager', icon: '/icon_app_manager.png' },
    { id: 'system-settings', name: 'System Settings', icon: '/icon_settings.png' },
    { id: 'firewall', name: 'Firewall', icon: '/icon_firewall.png' }
  ];

  desktopApps: DesktopApp[] = [];
  dockApps: DesktopApp[] = [];

  constructor(
    private viewContainerRef: ViewContainerRef,
    private nzContextMenuService: NzContextMenuService
  ) {}

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
    } else if (app.id === 'file-manager') {
      // Set white background for file manager instead of dark terminal bg
      winbox.setBackground('#f0f2f5'); 
      componentRef = this.viewContainerRef.createComponent(FileManagerComponent);
      winbox.body.appendChild(componentRef.location.nativeElement);
    } else {
      winbox.body.innerHTML = `<div style="padding: 20px; color: white; font-family: sans-serif;">
                                <h3>${app.name}</h3>
                                <p>This application is under construction.</p>
                               </div>`;
    }
  }

  contextMenu($event: MouseEvent, menu: NzDropdownMenuComponent): void {
    $event.preventDefault(); // Prevent default browser context menu
    this.nzContextMenuService.create($event, menu);
  }

  handleMenuAction(action: string): void {
    console.log('Action selected:', action);
    // Optionally trigger specific functionality here (e.g., refreshing, opening settings)
    this.nzContextMenuService.close();
  }
}

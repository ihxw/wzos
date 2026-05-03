import { Injectable, ComponentRef, ViewContainerRef, Type } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  componentRef?: ComponentRef<any>;
  componentType?: Type<any>;
  inputs?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class WindowManagerService {
  private windows: WindowState[] = [];
  private highestZIndex = 100;
  private windowsSubject = new BehaviorSubject<WindowState[]>([]);
  private menuActionSubject = new Subject<{ action: string; windowId: string }>();

  windows$ = this.windowsSubject.asObservable();
  menuAction$ = this.menuActionSubject.asObservable();

  constructor() {}

  openWindow(appId: string, title: string, componentType: Type<any>, options?: Partial<WindowState>): string {
    // For image-viewer, always open a new window
    const reuseWindow = appId !== 'image-viewer';
    if (reuseWindow) {
      const existingWindow = this.windows.find(w => w.appId === appId && !w.isMinimized);
      if (existingWindow) {
        this.focusWindow(existingWindow.id);
        return existingWindow.id;
      }
    }

    const windowId = `${appId}-${Date.now()}`;
    const newWindow: WindowState = {
      id: windowId,
      appId,
      title,
      zIndex: ++this.highestZIndex,
      isMinimized: false,
      isMaximized: false,
      position: { x: options?.position?.x ?? 100, y: options?.position?.y ?? 100 },
      size: { width: options?.size?.width ?? 800, height: options?.size?.height ?? 600 },
      componentType,
      inputs: options?.inputs,
    };

    this.windows.push(newWindow);
    this.notifyWindowsChanged();
    return windowId;
  }

  closeWindow(windowId: string): void {
    const index = this.windows.findIndex(w => w.id === windowId);
    if (index !== -1) {
      const window = this.windows[index];
      if (window.componentRef) {
        window.componentRef.destroy();
      }
      this.windows.splice(index, 1);
      this.notifyWindowsChanged();
    }
  }

  minimizeWindow(windowId: string): void {
    const window = this.windows.find(w => w.id === windowId);
    if (window) {
      window.isMinimized = true;
      this.notifyWindowsChanged();
    }
  }

  maximizeWindow(windowId: string): void {
    const window = this.windows.find(w => w.id === windowId);
    if (window) {
      window.isMaximized = !window.isMaximized;
      this.notifyWindowsChanged();
    }
  }

  restoreWindow(windowId: string): void {
    const window = this.windows.find(w => w.id === windowId);
    if (window) {
      window.isMinimized = false;
      this.focusWindow(windowId);
    }
  }

  focusWindow(windowId: string): void {
    const window = this.windows.find(w => w.id === windowId);
    if (window) {
      window.zIndex = ++this.highestZIndex;
      this.notifyWindowsChanged();
    }
  }

  dispatchMenuAction(action: string): void {
    const focused = this.getFocusedWindow();
    if (focused) {
      this.menuActionSubject.next({ action, windowId: focused.id });
    }
  }

  getFocusedWindow(): WindowState | null {
    return this.windows.reduce((prev, curr) =>
      curr.zIndex > (prev?.zIndex ?? 0) ? curr : prev, null as WindowState | null);
  }

  setComponentRef(windowId: string, componentRef: ComponentRef<any>): void {
    const window = this.windows.find(w => w.id === windowId);
    if (window) {
      window.componentRef = componentRef;
    }
  }

  getWindows(): WindowState[] {
    return this.windows;
  }

  private notifyWindowsChanged(): void {
    this.windowsSubject.next([...this.windows]);
  }
}

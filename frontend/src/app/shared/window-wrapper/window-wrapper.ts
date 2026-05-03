import { Component, Input, Output, EventEmitter, ViewChild, ViewContainerRef, OnInit, OnDestroy, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WindowState, WindowManagerService } from '../../core/services/window-manager.service';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type DragMode = 'drag' | ResizeDirection;

@Component({
  selector: 'app-window-wrapper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window-wrapper.html',
  styleUrls: ['./window-wrapper.scss']
})
export class WindowWrapperComponent implements OnInit, OnDestroy {
  @Input() windowState!: WindowState;
  @Output() close = new EventEmitter<string>();
  @Output() minimize = new EventEmitter<string>();
  @Output() maximize = new EventEmitter<string>();
  @Output() focus = new EventEmitter<string>();

  @ViewChild('contentHost', { read: ViewContainerRef, static: true })
  contentHost!: ViewContainerRef;

  @ViewChild('windowEl', { read: ElementRef, static: true })
  windowEl!: ElementRef;

  // Shared interaction state
  private mode: DragMode | null = null;
  private startMouseX = 0;
  private startMouseY = 0;
  private startW = 0;
  private startH = 0;
  private startX = 0;
  private startY = 0;

  private readonly MIN_W = 320;
  private readonly MIN_H = 240;
  private menuSub: Subscription | null = null;

  constructor(
    private windowManager: WindowManagerService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.menuSub = this.windowManager.menuAction$.subscribe(({ action, windowId }) => {
      if (windowId !== this.windowState?.id) return;
      if (action === 'file-close') {
        this.close.emit(this.windowState.id);
      }
    });
    if (this.windowState.componentType && this.contentHost) {
      const componentRef = this.contentHost.createComponent(this.windowState.componentType);
      // Always pass the window ID to the child component
      componentRef.setInput('windowId', this.windowState.id);
      // Set additional inputs if provided
      if (this.windowState.inputs) {
        for (const [key, value] of Object.entries(this.windowState.inputs)) {
          componentRef.setInput(key, value);
        }
      }
      this.windowManager.setComponentRef(this.windowState.id, componentRef);
    }
  }

  ngOnDestroy(): void {
    this.menuSub?.unsubscribe();
    if (this.windowState.componentRef) {
      this.windowState.componentRef.destroy();
    }
    this.endInteraction();
  }

  onClose(): void     { this.close.emit(this.windowState.id); }
  onMinimize(): void  { this.minimize.emit(this.windowState.id); }
  onMaximize(): void  { this.maximize.emit(this.windowState.id); }
  onFocus(): void     { this.focus.emit(this.windowState.id); }

  // ===== Drag =====
  onDragStart(event: MouseEvent): void {
    if (this.windowState.isMaximized) return;
    event.preventDefault();
    this.beginInteraction('drag', event.clientX, event.clientY);
  }

  // ===== Resize =====
  onResizeStart(event: MouseEvent, direction: ResizeDirection): void {
    event.preventDefault();
    event.stopPropagation();
    this.beginInteraction(direction, event.clientX, event.clientY);
  }

  private beginInteraction(mode: DragMode, mouseX: number, mouseY: number): void {
    this.mode = mode;
    this.startMouseX = mouseX;
    this.startMouseY = mouseY;
    this.startW = this.windowState.size.width;
    this.startH = this.windowState.size.height;
    this.startX = this.windowState.position.x;
    this.startY = this.windowState.position.y;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.mode) return;

    const dx = event.clientX - this.startMouseX;
    const dy = event.clientY - this.startMouseY;

    if (this.mode === 'drag') {
      this.ngZone.run(() => {
        this.windowState.position.x = this.startX + dx;
        this.windowState.position.y = this.startY + dy;
      });
      return;
    }

    // Resize
    let newW = this.startW;
    let newH = this.startH;
    let newX = this.startX;
    let newY = this.startY;

    if (this.mode.includes('e')) newW = Math.max(this.MIN_W, this.startW + dx);
    if (this.mode.includes('w')) {
      newW = Math.max(this.MIN_W, this.startW - dx);
      newX = this.startX + (this.startW - newW);
    }
    if (this.mode.includes('s')) newH = Math.max(this.MIN_H, this.startH + dy);
    if (this.mode.includes('n')) {
      newH = Math.max(this.MIN_H, this.startH - dy);
      newY = this.startY + (this.startH - newH);
    }

    this.ngZone.run(() => {
      this.windowState.size.width = newW;
      this.windowState.size.height = newH;
      this.windowState.position.x = newX;
      this.windowState.position.y = newY;
    });
  };

  private onMouseUp = (): void => {
    this.endInteraction();
  };

  private endInteraction(): void {
    this.mode = null;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}

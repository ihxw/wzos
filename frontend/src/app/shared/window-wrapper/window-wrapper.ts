import { Component, Input, Output, EventEmitter, ViewChild, ViewContainerRef, OnInit, OnDestroy, ElementRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WindowState, WindowManagerService } from '../../core/services/window-manager.service';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type DragMode = 'drag' | ResizeDirection;

// Easing functions
const easeIn = (t: number) => t * t * t;
const spring = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface DockMorphGeometry {
  deltaX: number;
  deltaY: number;
  centerRatio: number;
}

/** Get center of dock icon for given app ID */
function getDockCenter(appId: string): { x: number; y: number } | null {
  const wrapper = document.querySelector(`.dock-item-wrapper[data-app-id="${appId}"]`);
  if (!wrapper) return null;
  const r = wrapper.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

@Component({
  selector: 'app-window-wrapper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './window-wrapper.html',
  styleUrls: ['./window-wrapper.scss'],
  host: {
    // Keep element in DOM during animation even if minimized
    '[style.display]': 'isAnimating ? "flex" : (windowState.isMinimized ? "none" : "flex")',
  }
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

  private mode: DragMode | null = null;
  private startMouseX = 0;
  private startMouseY = 0;
  private startW = 0;
  private startH = 0;
  private startX = 0;
  private startY = 0;

  private readonly MIN_W = 320;
  private readonly MIN_H = 240;
  private readonly TITLEBAR_HEIGHT = 24;
  private readonly MENU_BAR_HEIGHT = 28;
  private readonly MIN_VISIBLE_WIDTH = 88;
  private readonly SCREEN_PADDING = 10;
  private menuSub: Subscription | null = null;
  private focusSub: Subscription | null = null;
  showEscHint = false;
  private escHintTimer: any = null;
  private frameAnimationTimer: any = null;
  isFocused = true;
  isClosing = false;
  isAnimating = false;
  isFrameAnimating = false;

  // Track minimized state to detect restore
  private wasMinimized = false;

  constructor(
    private windowManager: WindowManagerService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.focusSub = this.windowManager.windows$.subscribe(() => {
      const fw = this.windowManager.getFocusedWindow();
      this.isFocused = fw?.id === this.windowState.id;

      // Detect restore from minimize (state went true → false)
      if (this.wasMinimized && !this.windowState.isMinimized) {
        this.triggerRestoreFromDock();
      }
      this.wasMinimized = this.windowState.isMinimized;
    });

    this.menuSub = this.windowManager.menuAction$.subscribe(({ action, windowId }) => {
      if (windowId !== this.windowState?.id) return;
      if (action === 'file-close') {
        this.close.emit(this.windowState.id);
      }
    });

    if (this.windowState.componentType && this.contentHost) {
      const componentRef = this.contentHost.createComponent(this.windowState.componentType);
      componentRef.setInput('windowId', this.windowState.id);
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
    this.focusSub?.unsubscribe();
    clearTimeout(this.escHintTimer);
    clearTimeout(this.frameAnimationTimer);
    if (this.windowState.componentRef) {
      this.windowState.componentRef.destroy();
    }
    this.endInteraction();
  }

  onClose(): void {
    this.isClosing = true;
    setTimeout(() => this.close.emit(this.windowState.id), 200);
  }

  onMinimize(): void {
    this.animateMinimizeToDock();
  }

  /** Animate window shrinking into dock icon with a Genie-like morph. */
  private animateMinimizeToDock(): void {
    this.runDockMorphAnimation(true);
  }

  /** Animate window growing from dock icon back to normal with a Genie-like morph. */
  private triggerRestoreFromDock(): void {
    this.runDockMorphAnimation(false);
  }

  private runDockMorphAnimation(isMinimizing: boolean): void {
    const el = this.windowEl.nativeElement;
    if (!el) return;

    const runAnimation = () => {
      const rect = el.getBoundingClientRect();
      const geometry = this.getDockMorphGeometry(rect);
      this.isAnimating = true;

      const start = performance.now();
      const duration = isMinimizing ? 560 : 520;

      const frame = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = isMinimizing ? easeOutCubic(t) : spring(t);
        const morph = isMinimizing ? eased : Math.max(0, 1 - eased);

        this.applyDockMorphFrame(el, geometry, morph);

        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }

        this.resetDockMorphStyles(el);
        if (isMinimizing) {
          this.minimize.emit(this.windowState.id);
          requestAnimationFrame(() => {
            this.isAnimating = false;
          });
          return;
        }

        this.isAnimating = false;
      };

      requestAnimationFrame(frame);
    };

    if (isMinimizing) {
      runAnimation();
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(runAnimation);
    });
  }

  onMaximize(): void {
    const wasMaximized = this.windowState.isMaximized;
    this.startFrameAnimation();
    this.maximize.emit(this.windowState.id);
    if (!wasMaximized) {
      this.showEscHint = true;
      clearTimeout(this.escHintTimer);
      this.escHintTimer = setTimeout(() => this.showEscHint = false, 3000);
    } else {
      this.showEscHint = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.windowState.isMaximized) return;
    const focused = this.windowManager.getFocusedWindow();
    if (focused?.id !== this.windowState.id) return;
    this.showEscHint = false;
    this.startFrameAnimation();
    this.maximize.emit(this.windowState.id);
  }

  get frameLeft(): number {
    return this.windowState.isMaximized ? 0 : this.windowState.position.x;
  }

  get frameTop(): number {
    return this.windowState.isMaximized ? this.MENU_BAR_HEIGHT : this.windowState.position.y;
  }

  get frameWidth(): number {
    return this.windowState.isMaximized ? window.innerWidth : this.windowState.size.width;
  }

  get frameHeight(): number {
    return this.windowState.isMaximized ? Math.max(window.innerHeight - this.MENU_BAR_HEIGHT, this.MIN_H) : this.windowState.size.height;
  }

  onFocus(): void {
    this.focus.emit(this.windowState.id);
  }

  // ===== Drag =====
  onDragStart(event: MouseEvent): void {
    if (this.windowState.isMaximized) return;
    event.preventDefault();
    this.beginInteraction('drag', event.clientX, event.clientY);
  }

  onResizeStart(event: MouseEvent, direction: ResizeDirection): void {
    if (this.windowState.isMaximized) return;
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
      const nextPosition = this.clampDragPosition(this.startX + dx, this.startY + dy);
      this.ngZone.run(() => {
        this.windowState.position.x = nextPosition.x;
        this.windowState.position.y = nextPosition.y;
      });
      return;
    }

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

    const nextFrame = this.clampResizeFrame(newX, newY, newW, newH);

    this.ngZone.run(() => {
      this.windowState.size.width = nextFrame.width;
      this.windowState.size.height = nextFrame.height;
      this.windowState.position.x = nextFrame.x;
      this.windowState.position.y = nextFrame.y;
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

  private startFrameAnimation(): void {
    this.isFrameAnimating = true;
    clearTimeout(this.frameAnimationTimer);
    this.frameAnimationTimer = setTimeout(() => {
      this.isFrameAnimating = false;
    }, 280);
  }

  private getDockMorphGeometry(rect: DOMRect): DockMorphGeometry {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dock = getDockCenter(this.windowState.appId);
    const dockX = dock ? dock.x : window.innerWidth / 2;
    const dockY = dock ? dock.y : window.innerHeight - 50;
    const unclampedRatio = (dockX - rect.left) / Math.max(rect.width, 1);

    return {
      deltaX: dockX - centerX,
      deltaY: dockY - centerY,
      centerRatio: Math.min(0.92, Math.max(0.08, unclampedRatio)),
    };
  }

  private applyDockMorphFrame(el: HTMLElement, geometry: DockMorphGeometry, morph: number): void {
    const topWidth = Math.max(12, 100 - 72 * morph);
    const bottomWidth = Math.max(4, 100 - 97 * Math.pow(morph, 0.82));
    const centerPercent = geometry.centerRatio * 100;
    const topLeft = centerPercent - topWidth / 2;
    const topRight = centerPercent + topWidth / 2;
    const bottomLeft = centerPercent - bottomWidth / 2;
    const bottomRight = centerPercent + bottomWidth / 2;
    const scaleX = 1 - 0.18 * morph;
    const scaleY = Math.max(0.025, 1 - 0.93 * morph);
    const skewX = (geometry.centerRatio - 0.5) * 18 * morph;
    const blur = 8 * Math.pow(morph, 1.35);
    const opacity = Math.max(0.03, 1 - Math.pow(morph, 1.15));

    el.style.transformOrigin = `${centerPercent}% 100%`;
    el.style.transform = `translate(${geometry.deltaX * morph}px, ${geometry.deltaY * morph}px) scale(${scaleX}, ${scaleY}) skewX(${skewX}deg)`;
    el.style.clipPath = `polygon(${topLeft}% 0%, ${topRight}% 0%, ${bottomRight}% 100%, ${bottomLeft}% 100%)`;
    el.style.opacity = String(opacity);
    el.style.filter = `blur(${blur}px)`;
  }

  private resetDockMorphStyles(el: HTMLElement): void {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.clipPath = '';
    el.style.opacity = '';
    el.style.filter = '';
  }

  private clampDragPosition(x: number, y: number): { x: number; y: number } {
    const minX = -(this.windowState.size.width - this.MIN_VISIBLE_WIDTH);
    const maxX = window.innerWidth - this.MIN_VISIBLE_WIDTH;
    const minY = this.MENU_BAR_HEIGHT;
    const maxY = window.innerHeight - this.TITLEBAR_HEIGHT - this.SCREEN_PADDING;

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }

  private clampResizeFrame(x: number, y: number, width: number, height: number): { x: number; y: number; width: number; height: number } {
    const maxRight = window.innerWidth - this.SCREEN_PADDING;
    const maxBottom = window.innerHeight - this.SCREEN_PADDING;

    const clampedX = Math.min(Math.max(x, this.SCREEN_PADDING), maxRight - this.MIN_W);
    const clampedY = Math.min(Math.max(y, this.MENU_BAR_HEIGHT), maxBottom - this.MIN_H);
    const clampedWidth = Math.min(Math.max(width, this.MIN_W), maxRight - clampedX);
    const clampedHeight = Math.min(Math.max(height, this.MIN_H), maxBottom - clampedY);

    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
    };
  }
}

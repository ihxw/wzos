import { Component, ElementRef, Input, Output, EventEmitter, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import { DesktopApp } from '../../core/models/app.model';

@Component({
  selector: 'app-dock',
  standalone: true,
  imports: [CommonModule, NzDropDownModule],
  templateUrl: './dock.html',
  styleUrls: ['./dock.scss']
})
export class Dock {
  @Input() pinnedApps: DesktopApp[] = [];
  @Input() dynamicApps: DesktopApp[] = [];
  @Input() iconSize = 52;
  @Output() onOpen = new EventEmitter<DesktopApp>();
  @Output() onClose = new EventEmitter<DesktopApp>();
  @Output() iconSizeChange = new EventEmitter<number>();
  @ViewChildren('dockItemWrapper') dockItemWrappers!: QueryList<ElementRef<HTMLElement>>;

  hoveredIndex: number | null = null;
  bounceIndex: number | null = null;
  pointerX: number | null = null;
  showSizeControl = false;
  contextMenuApp: DesktopApp | null = null;

  constructor(private nzContextMenuService: NzContextMenuService) {}

  private readonly DOCK_MAGNIFICATION = 1.72;
  private readonly DOCK_LIFT = 18;
  private readonly DOCK_INFLUENCE_RADIUS = 112;

  get apps(): DesktopApp[] {
    return [...this.pinnedApps, ...this.dynamicApps];
  }

  open(app: DesktopApp) {
    // Bounce only if open and not minimized
    if (app.isOpen && !app.isMinimized) {
      this.triggerBounce(this.apps.indexOf(app));
    }
    this.onOpen.emit(app);
  }

  onMouseEnter(index: number) {
    this.hoveredIndex = index;
  }

  onContextMenu(event: MouseEvent, menu: NzDropdownMenuComponent, app: DesktopApp): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuApp = app;
    this.nzContextMenuService.create(event, menu);
  }

  handleMenuAction(action: string): void {
    this.nzContextMenuService.close();
    if (!this.contextMenuApp) return;
    
    if (action === 'open') {
      this.open(this.contextMenuApp);
    } else if (action === 'close') {
      this.onClose.emit(this.contextMenuApp);
    }
  }

  onDockMouseMove(event: MouseEvent) {
    this.pointerX = event.clientX;
  }

  onDockMouseLeave() {
    this.pointerX = null;
    this.hoveredIndex = null;
  }

  shouldRenderSeparator(index: number): boolean {
    return this.dynamicApps.length > 0 && index === this.pinnedApps.length;
  }

  toggleSizeControl(): void {
    this.showSizeControl = !this.showSizeControl;
  }

  setIconSize(nextSize: number): void {
    const clampedSize = Math.min(72, Math.max(40, Math.round(nextSize)));
    this.iconSizeChange.emit(clampedSize);
  }

  onSizeSliderInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.setIconSize(value);
  }

  getScale(index: number): number {
    const influence = this.getInfluence(index);
    return 1 + influence * (this.DOCK_MAGNIFICATION - 1);
  }

  getLift(index: number): number {
    return this.getInfluence(index) * this.DOCK_LIFT;
  }

  /** Trigger bounce animation for a dock item */
  private triggerBounce(index: number): void {
    this.bounceIndex = index;
    setTimeout(() => { this.bounceIndex = null; }, 800);
  }

  private getInfluence(index: number): number {
    if (this.pointerX === null) return 0;

    const wrapper = this.dockItemWrappers?.get(index)?.nativeElement;
    if (!wrapper) return 0;

    const rect = wrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const distance = Math.abs(this.pointerX - centerX);
    if (distance >= this.DOCK_INFLUENCE_RADIUS) return 0;

    const normalizedDistance = distance / this.DOCK_INFLUENCE_RADIUS;
    return Math.cos((normalizedDistance * Math.PI) / 2) ** 2;
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesktopApp } from '../../core/models/app.model';

@Component({
  selector: 'app-dock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dock.html',
  styleUrls: ['./dock.scss']
})
export class Dock {
  @Input() apps: DesktopApp[] = [];
  @Output() onOpen = new EventEmitter<DesktopApp>();

  hoveredIndex: number | null = null;

  open(app: DesktopApp) {
    this.onOpen.emit(app);
  }

  onMouseEnter(index: number) {
    this.hoveredIndex = index;
  }

  onMouseLeave() {
    this.hoveredIndex = null;
  }

  getScale(index: number): number {
    if (this.hoveredIndex === null) return 1;
    const distance = Math.abs(index - this.hoveredIndex);
    if (distance === 0) return 1.5;
    if (distance === 1) return 1.3;
    if (distance === 2) return 1.1;
    return 1;
  }
}

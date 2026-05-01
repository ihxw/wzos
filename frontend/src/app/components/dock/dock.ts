import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { DesktopApp } from '../../core/models/app.model';

@Component({
  selector: 'app-dock',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './dock.html',
  styleUrls: ['./dock.scss']
})
export class Dock {
  @Input() apps: DesktopApp[] = [];
  @Output() onOpen = new EventEmitter<DesktopApp>();

  open(app: DesktopApp) {
    this.onOpen.emit(app);
  }
}

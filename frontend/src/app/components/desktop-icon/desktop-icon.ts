import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { DesktopApp } from '../../core/models/app.model';

@Component({
  selector: 'app-desktop-icon',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './desktop-icon.html',
  styleUrls: ['./desktop-icon.scss']
})
export class DesktopIcon {
  @Input() app!: DesktopApp;
  @Output() onOpen = new EventEmitter<DesktopApp>();

  open() {
    this.onOpen.emit(this.app);
  }
}

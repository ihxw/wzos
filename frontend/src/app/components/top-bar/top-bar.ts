import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './top-bar.html',
  styleUrls: ['./top-bar.scss']
})
export class TopBar implements OnInit, OnDestroy {
  currentTime: Date = new Date();
  private timer: any;

  ngOnInit() {
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

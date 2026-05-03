import { Component, Input, Output, EventEmitter, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileInfo } from '../../core/services/file.service';

@Component({
  selector: 'app-desktop-file',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="desktop-file-item"
         [class.selected]="selected"
         [style.left.px]="position.x"
         [style.top.px]="position.y"
         (mousedown)="onMouseDown($event)"
         (dblclick)="onOpenFile.emit(file)">
      <div class="df-icon">{{ icon }}</div>
      <span class="df-name">{{ file.name }}</span>
    </div>
  `,
  styles: [`
    .desktop-file-item {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 88px;
      padding: 8px 6px;
      border-radius: 8px;
      cursor: default;
      user-select: none;
      border: 1px solid transparent;
      z-index: 1;
    }
    .desktop-file-item:hover {
      background: var(--wzos-accent-color-light, rgba(0,122,255,0.15));
      border-color: var(--wzos-accent-color-medium, rgba(0,122,255,0.3));
    }
    .desktop-file-item.selected {
      background: var(--wzos-accent-color, #007aff);
      border-color: var(--wzos-accent-color, #007aff);
      z-index: 2;
    }
    .desktop-file-item.selected .df-name {
      color: #fff;
    }
    .df-icon {
      font-size: 48px;
      line-height: 1;
      margin-bottom: 4px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
      pointer-events: none;
    }
    .df-name {
      font-size: 12px;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.4);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
      pointer-events: none;
    }
  `]
})
export class DesktopFileComponent {
  @Input() file!: FileInfo;
  @Input() selected = false;
  @Input() position = { x: 0, y: 0 };
  @Output() onOpenFile = new EventEmitter<FileInfo>();
  @Output() onSelect = new EventEmitter<{ file: FileInfo; event: MouseEvent }>();
  @Output() onDragStart = new EventEmitter<{ file: FileInfo; event: MouseEvent }>();

  private dragging = false;
  private hasMoved = false;

  constructor(private el: ElementRef) {}

  get icon(): string {
    if (!this.file) return '📄';
    if (this.file.isDir) {
      const n = this.file.name.toLowerCase();
      if (n === 'desktop' || n === '桌面') return '🖥️';
      if (n === 'documents' || n === '文档') return '📁';
      if (n === 'downloads' || n === '下载') return '📥';
      if (n === 'pictures' || n === '图片') return '🖼️';
      if (n === 'music' || n === '音乐') return '🎵';
      if (n === 'movies' || n === '视频' || n === 'videos') return '🎬';
      return '📁';
    }
    const ext = this.file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'bmp': return '🖼️';
      case 'mp4': case 'mkv': case 'avi': case 'mov': case 'webm': return '🎬';
      case 'mp3': case 'wav': case 'flac': case 'ogg': case 'aac': return '🎵';
      case 'pdf': return '📕';
      case 'doc': case 'docx': return '📝';
      case 'xls': case 'xlsx': case 'csv': return '📊';
      case 'ppt': case 'pptx': return '📽️';
      case 'zip': case 'rar': case 'tar': case 'gz': case '7z': case 'bz2': return '📦';
      case 'txt': case 'md': case 'log': return '📄';
      case 'js': case 'ts': case 'html': case 'css': case 'go': case 'py': case 'java': case 'rs': case 'json': return '💻';
      case 'sh': case 'bash': case 'exe': case 'app': return '⚙️';
      default: return '📄';
    }
  }

  onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    this.hasMoved = false;
    this.dragging = true;

    const startX = event.clientX;
    const startY = event.clientY;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.dragging) return;
      if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) {
        this.hasMoved = true;
        this.onDragStart.emit({ file: this.file, event });
        this.dragging = false;
        cleanup();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      this.dragging = false;
      if (!this.hasMoved) {
        this.onSelect.emit({ file: this.file, event: e });
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    event.preventDefault();
    event.stopPropagation();
  }
}

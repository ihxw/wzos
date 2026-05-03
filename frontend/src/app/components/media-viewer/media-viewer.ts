import { Component, Input, HostListener, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { Subscription } from 'rxjs';
import { WindowManagerService } from '../../core/services/window-manager.service';

export interface MediaFile {
  name: string;
  path: string;
  type: 'image' | 'audio' | 'video';
  fileType?: string;
}

type MarkupTool = 'pointer' | 'pen' | 'rect' | 'ellipse' | 'text' | 'line';

@Component({
  selector: 'app-media-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, NzIconModule, NzButtonModule, NzSliderModule, NzTooltipModule, NzDropDownModule],
  templateUrl: './media-viewer.html',
  styleUrls: ['./media-viewer.scss']
})
export class MediaViewerComponent implements OnDestroy {
  @Input() windowId = '';
  @Input() files: MediaFile[] = [];
  @Input() currentIndex = 0;
  @Input() windowTitle = '预览';

  @ViewChild('imageContainer') imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('mainImage') mainImage!: ElementRef<HTMLImageElement>;
  @ViewChild('markupCanvas') markupCanvas!: ElementRef<HTMLCanvasElement>;

  // --- Zoom ---
  zoomLevel = 1;
  fitToScreen = true;
  minZoom = 0.05;
  maxZoom = 20;

  // --- Rotation ---
  rotation = 0;

  // --- Pan ---
  panX = 0;
  panY = 0;
  isPanning = false;
  panStartX = 0;
  panStartY = 0;
  panOrigX = 0;
  panOrigY = 0;

  // --- Slideshow ---
  slideshowActive = false;
  slideshowInterval = 3;
  private slideshowTimer: any = null;

  // --- Sidebar ---
  showSidebar = false;

  // --- Image dimensions ---
  imageNaturalWidth = 0;
  imageNaturalHeight = 0;
  imageLoaded = false;

  // --- Markup ---
  showMarkupToolbar = false;
  markupTool: MarkupTool = 'pointer';
  markupColor = '#ff3b30';
  markupLineWidth = 3;
  markupFontSize = 24;
  private isDrawing = false;
  private drawStartX = 0;
  private drawStartY = 0;
  private undoStack: ImageData[] = [];
  markupTextInput = '';

  markupColors = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ffffff', '#000000'];

  private menuSub: Subscription;

  constructor(
    private windowManager: WindowManagerService,
    private http: HttpClient
  ) {
    this.menuSub = this.windowManager.menuAction$.subscribe(({ action, windowId }) => {
      if (windowId !== this.windowId) return;
      switch (action) {
        case 'file-open': this.openFile(); break;
        case 'file-close': this.closeWindow(); break;
      }
    });
  }

  // ===== Window Actions =====
  closeWindow(): void {
    this.stopSlideshow();
    if (this.windowId) {
      this.windowManager.closeWindow(this.windowId);
    }
  }

  minimizeWindow(): void {
    if (this.windowId) {
      this.windowManager.minimizeWindow(this.windowId);
    }
  }

  maximizeWindow(): void {
    if (this.windowId) {
      this.windowManager.maximizeWindow(this.windowId);
    }
  }

  // ===== Getters =====
  get currentFile(): MediaFile | null { return this.files[this.currentIndex] || null; }
  get isImage(): boolean { return this.currentFile?.type === 'image'; }
  get isAudio(): boolean { return this.currentFile?.type === 'audio'; }
  get isVideo(): boolean { return this.currentFile?.type === 'video'; }
  get canGoPrev(): boolean { return this.currentIndex > 0; }
  get canGoNext(): boolean { return this.currentIndex < this.files.length - 1; }
  get zoomPercent(): number { return Math.round(this.zoomLevel * 100); }

  getFileUrl(file: MediaFile): string {
    return `/api/files/view?path=${encodeURIComponent(file.path)}`;
  }

  // ===== Open File Dialog (server-side file browser) =====
  showOpenDialog = false;
  openPath = '/home';
  openFiles: { name: string; path: string; isDir: boolean }[] = [];
  openLoading = false;

  openFile(): void {
    this.showOpenDialog = true;
    this.openPath = '/home';
    this.browseOpenDir('/home');
  }

  closeOpenDialog(): void {
    this.showOpenDialog = false;
  }

  browseOpenDir(path: string): void {
    this.openPath = path;
    this.openLoading = true;
    this.http.get<any[]>(`/api/files/list?path=${encodeURIComponent(path)}`).subscribe({
      next: (data) => {
        const mediaExts = ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff',
                           'mp3','wav','flac','ogg','aac','wma','m4a','opus',
                           'mp4','mkv','avi','mov','webm','flv','wmv','m4v'];
        this.openFiles = (data || [])
          .filter((f: any) => f != null && (f.isDir || mediaExts.includes(f.name.split('.').pop()?.toLowerCase())))
          .sort((a: any, b: any) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        this.openLoading = false;
      },
      error: () => { this.openLoading = false; }
    });
  }

  openDirUp(): void {
    const parent = this.openPath.substring(0, this.openPath.lastIndexOf('/'));
    this.browseOpenDir(parent || '/');
  }

  selectOpenFile(file: { name: string; path: string; isDir: boolean }): void {
    if (file.isDir) {
      this.browseOpenDir(file.path);
      return;
    }
    // Open this single file
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mediaType = this.mediaTypeFromExt(ext);
    if (!mediaType) return;
    this.files = [{ name: file.name, path: file.path, type: mediaType, fileType: ext }];
    this.currentIndex = 0;
    this.showOpenDialog = false;
    this.resetView();
  }

  openAllMedia(): void {
    const mediaFiles: MediaFile[] = [];
    for (const f of this.openFiles) {
      if (f.isDir) continue;
      const ext = f.name.split('.').pop()?.toLowerCase();
      const mediaType = this.mediaTypeFromExt(ext);
      if (mediaType) {
        mediaFiles.push({ name: f.name, path: f.path, type: mediaType, fileType: ext });
      }
    }
    if (mediaFiles.length === 0) return;
    this.files = mediaFiles;
    this.currentIndex = 0;
    this.showOpenDialog = false;
    this.resetView();
  }

  private mediaTypeFromExt(ext?: string): 'image' | 'audio' | 'video' | null {
    const imageExts = ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff'];
    const audioExts = ['mp3','wav','flac','ogg','aac','wma','m4a','opus'];
    const videoExts = ['mp4','mkv','avi','mov','webm','flv','wmv','m4v'];
    if (imageExts.includes(ext || '')) return 'image';
    if (audioExts.includes(ext || '')) return 'audio';
    if (videoExts.includes(ext || '')) return 'video';
    return null;
  }

  // ===== Download =====
  downloadFile(): void {
    if (!this.currentFile) return;
    const a = document.createElement('a');
    a.href = this.getFileUrl(this.currentFile);
    a.download = this.currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ===== Navigation =====
  prev(): void {
    if (!this.canGoPrev) return;
    this.resetView();
    this.currentIndex--;
  }

  next(): void {
    if (!this.canGoNext) return;
    this.resetView();
    this.currentIndex++;
  }

  resetView(): void {
    this.zoomLevel = 1;
    this.fitToScreen = true;
    this.rotation = 0;
    this.panX = 0;
    this.panY = 0;
    this.imageLoaded = false;
    this.clearMarkup();
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.imageNaturalWidth = img.naturalWidth;
    this.imageNaturalHeight = img.naturalHeight;
    this.imageLoaded = true;
  }

  // ===== Zoom =====
  zoomIn(): void {
    this.fitToScreen = false;
    this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel * 1.25);
    this.clampPan();
  }

  zoomOut(): void {
    this.fitToScreen = false;
    this.zoomLevel = Math.max(this.minZoom, this.zoomLevel / 1.25);
    if (this.zoomLevel <= 1) { this.panX = 0; this.panY = 0; }
    this.clampPan();
  }

  zoomActual(): void {
    this.fitToScreen = false;
    this.zoomLevel = 1;
    this.panX = 0; this.panY = 0;
  }

  zoomToFit(): void {
    this.fitToScreen = true;
    this.zoomLevel = 1;
    this.panX = 0; this.panY = 0;
  }

  toggleZoomFit(): void {
    if (this.fitToScreen) { this.zoomActual(); } else { this.zoomToFit(); }
  }

  onZoomSliderChange(value: number): void {
    this.fitToScreen = false;
    this.zoomLevel = value / 100;
    this.clampPan();
  }

  onWheel(event: WheelEvent): void {
    if (!this.isImage) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = -event.deltaY * 0.005;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * (1 + delta)));
      if (!this.fitToScreen && Math.abs(newZoom - this.zoomLevel) > 0.001) {
        const rect = this.imageContainer!.nativeElement.getBoundingClientRect();
        const cx = event.clientX - rect.left - rect.width / 2;
        const cy = event.clientY - rect.top - rect.height / 2;
        const ratio = newZoom / this.zoomLevel;
        this.panX = cx - ratio * (cx - this.panX);
        this.panY = cy - ratio * (cy - this.panY);
      }
      this.zoomLevel = newZoom;
      this.fitToScreen = false;
      this.clampPan();
    }
  }

  // ===== Pan =====
  onMouseDown(event: MouseEvent): void {
    if (!this.isImage || this.fitToScreen || this.markupTool !== 'pointer') return;
    if (event.button !== 0) return;
    if ((event.target as HTMLElement)?.tagName === 'CANVAS') return;
    this.isPanning = true;
    this.panStartX = event.clientX; this.panStartY = event.clientY;
    this.panOrigX = this.panX; this.panOrigY = this.panY;
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    this.panX = this.panOrigX + (event.clientX - this.panStartX);
    this.panY = this.panOrigY + (event.clientY - this.panStartY);
  }

  onMouseUp(): void {
    if (this.isPanning) { this.isPanning = false; this.clampPan(); }
  }

  private clampPan(): void {
    if (!this.imageLoaded || this.fitToScreen || this.zoomLevel <= 1) {
      this.panX = 0; this.panY = 0;
      return;
    }
    const maxPan = 5000;
    this.panX = Math.max(-maxPan, Math.min(maxPan, this.panX));
    this.panY = Math.max(-maxPan, Math.min(maxPan, this.panY));
  }

  // ===== Rotate =====
  rotateLeft(): void { this.rotation = (this.rotation - 90) % 360; }
  rotateRight(): void { this.rotation = (this.rotation + 90) % 360; }

  // ===== Slideshow =====
  toggleSlideshow(): void {
    if (this.slideshowActive) { this.stopSlideshow(); } else { this.startSlideshow(); }
  }

  startSlideshow(): void {
    this.slideshowActive = true;
    this.zoomToFit();
    this.showSidebar = false;
    this.slideshowTimer = setInterval(() => {
      if (this.canGoNext) { this.next(); } else { this.currentIndex = 0; this.resetView(); }
    }, this.slideshowInterval * 1000);
  }

  stopSlideshow(): void {
    this.slideshowActive = false;
    if (this.slideshowTimer) { clearInterval(this.slideshowTimer); this.slideshowTimer = null; }
  }

  // ===== Markup =====
  toggleMarkupToolbar(): void {
    this.showMarkupToolbar = !this.showMarkupToolbar;
    if (!this.showMarkupToolbar) { this.markupTool = 'pointer'; }
  }

  selectMarkupTool(tool: MarkupTool): void { this.markupTool = tool; }

  onMarkupMouseDown(event: MouseEvent): void {
    if (this.markupTool === 'pointer') return;
    if (!this.showMarkupToolbar) return;
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.drawStartX = event.clientX - rect.left;
    this.drawStartY = event.clientY - rect.top;
    this.isDrawing = true;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      this.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (this.undoStack.length > 50) this.undoStack.shift();
    }
    if (this.markupTool === 'text') {
      const text = prompt('输入文字:', this.markupTextInput || '');
      if (text) {
        this.markupTextInput = text;
        if (ctx) {
          ctx.font = `${this.markupFontSize}px -apple-system, sans-serif`;
          ctx.fillStyle = this.markupColor;
          ctx.fillText(text, this.drawStartX, this.drawStartY + this.markupFontSize);
        }
      }
      this.isDrawing = false;
    }
  }

  onMarkupMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lastState = this.undoStack[this.undoStack.length - 1];
    if (lastState) { ctx.putImageData(lastState, 0, 0); }
    ctx.strokeStyle = this.markupColor;
    ctx.fillStyle = this.markupColor;
    ctx.lineWidth = this.markupLineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    switch (this.markupTool) {
      case 'pen':
        ctx.moveTo(this.drawStartX, this.drawStartY);
        ctx.lineTo(x, y); ctx.stroke();
        this.drawStartX = x; this.drawStartY = y;
        break;
      case 'rect':
        ctx.strokeRect(this.drawStartX, this.drawStartY, x - this.drawStartX, y - this.drawStartY);
        break;
      case 'ellipse':
        const cx = (this.drawStartX + x) / 2;
        const cy = (this.drawStartY + y) / 2;
        const rx = Math.abs(x - this.drawStartX) / 2;
        const ry = Math.abs(y - this.drawStartY) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'line':
        ctx.moveTo(this.drawStartX, this.drawStartY);
        ctx.lineTo(x, y); ctx.stroke();
        break;
    }
  }

  onMarkupMouseUp(): void { this.isDrawing = false; }

  clearMarkup(): void {
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); this.undoStack = []; }
  }

  undoMarkup(): void {
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx && this.undoStack.length > 0) {
      const prev = this.undoStack.pop()!;
      ctx.putImageData(prev, 0, 0);
    }
  }

  // ===== Copy Image =====
  copyImage(): void {
    if (!this.isImage) return;
    const img = this.mainImage?.nativeElement;
    if (!img) return;
    const canvas = document.createElement('canvas');
    const w = this.imageNaturalWidth;
    const h = this.imageNaturalHeight;
    const rot = ((this.rotation % 360) + 360) % 360;
    if (rot === 90 || rot === 270) { canvas.width = h; canvas.height = w; }
    else { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2);
    canvas.toBlob(blob => {
      if (blob) { navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
    });
  }

  // ===== Keyboard Shortcuts =====
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.target as HTMLElement)?.tagName === 'INPUT') return;
    const mod = event.metaKey || event.ctrlKey;

    switch (true) {
      case event.key === 'Escape':
        if (this.showOpenDialog) { this.closeOpenDialog(); return; }
        if (this.slideshowActive) { this.stopSlideshow(); return; }
        if (this.showMarkupToolbar) { this.showMarkupToolbar = false; this.markupTool = 'pointer'; return; }
        event.preventDefault(); this.closeWindow(); break;
      case event.key === 'ArrowLeft' && !mod: event.preventDefault(); this.prev(); break;
      case event.key === 'ArrowRight' && !mod: event.preventDefault(); this.next(); break;
      case mod && (event.key === '=' || event.key === '+'): event.preventDefault(); this.zoomIn(); break;
      case mod && event.key === '-': event.preventDefault(); this.zoomOut(); break;
      case mod && event.key === '0': event.preventDefault(); this.zoomActual(); break;
      case mod && event.key === 'r': if (this.isImage) { event.preventDefault(); this.rotateRight(); } break;
      case mod && event.key === 'l': if (this.isImage) { event.preventDefault(); this.rotateLeft(); } break;
      case mod && event.key === 'c': if (this.isImage) { event.preventDefault(); this.copyImage(); } break;
      case mod && event.key === 'z': if (this.showMarkupToolbar) { event.preventDefault(); this.undoMarkup(); } break;
      case event.key === ' ': event.preventDefault(); this.toggleSlideshow(); break;
    }
  }

  // ===== Image transform =====
  get imageTransform(): string {
    let t = '';
    if (!this.fitToScreen) {
      t += ` scale(${this.zoomLevel})`;
      if (this.zoomLevel > 1) { t += ` translate(${this.panX / this.zoomLevel}px, ${this.panY / this.zoomLevel}px)`; }
    }
    if (this.rotation !== 0) { t += ` rotate(${this.rotation}deg)`; }
    return t.trim();
  }

  get imageCursor(): string {
    if (this.markupTool !== 'pointer' && this.showMarkupToolbar) return 'crosshair';
    if (this.fitToScreen) return 'default';
    if (this.zoomLevel > 1) return this.isPanning ? 'grabbing' : 'grab';
    return 'default';
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '--';
    const k = 1000;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  onImageClick(): void {
    if (this.markupTool !== 'pointer' || !this.showMarkupToolbar) {
      if (!this.isPanning) { this.toggleZoomFit(); }
    }
  }

  syncCanvasSize(): void {
    setTimeout(() => {
      const container = this.imageContainer?.nativeElement;
      const canvas = this.markupCanvas?.nativeElement;
      if (container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    }, 100);
  }

  // Clean up on destroy
  ngOnDestroy(): void {
    this.stopSlideshow();
    this.menuSub.unsubscribe();
  }
}

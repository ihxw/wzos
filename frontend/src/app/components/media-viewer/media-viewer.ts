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

type MarkupTool = 'pointer' | 'pen' | 'rect' | 'ellipse' | 'text' | 'line' | 'signature';
type CropAction = 'new' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw';

interface NormalizedPoint {
  x: number;
  y: number;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignatureAsset {
  dataUrl: string;
  aspectRatio: number;
}

type MarkupElement =
  | {
      kind: 'pen';
      points: NormalizedPoint[];
      color: string;
      lineWidthRatio: number;
    }
  | {
      kind: 'rect' | 'ellipse' | 'line';
      from: NormalizedPoint;
      to: NormalizedPoint;
      color: string;
      lineWidthRatio: number;
    }
  | {
      kind: 'text';
      at: NormalizedPoint;
      text: string;
      color: string;
      fontSizeRatio: number;
    }
  | {
      kind: 'signature';
      at: NormalizedPoint;
      width: number;
      height: number;
      dataUrl: string;
    };

interface UndoState {
  elements: MarkupElement[];
  cropRect: CropRect;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

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
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;

  // --- Zoom ---
  zoomLevel = 1;
  fitToScreen = true;
  minZoom = 0.05;
  maxZoom = 20;

  // --- Rotation ---
  rotation = 0;
  flipX = false;
  flipY = false;

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
  displayImageFrame = { left: 0, top: 0, width: 0, height: 0 };

  // --- Crop ---
  cropMode = false;
  cropRect: CropRect = { x: 0, y: 0, width: 1, height: 1 };
  draftCropRect: CropRect | null = null;
  private cropAction: CropAction | null = null;
  private cropStartPoint: NormalizedPoint | null = null;
  private cropStartRect: CropRect | null = null;

  // --- Markup ---
  showMarkupToolbar = false;
  markupTool: MarkupTool = 'pointer';
  markupColor = '#ff3b30';
  markupLineWidth = 3;
  markupFontSize = 24;
  private isDrawing = false;
  private drawStartPoint: NormalizedPoint | null = null;
  private currentPenPoints: NormalizedPoint[] = [];
  private previewMarkupElement: MarkupElement | null = null;
  private undoStack: UndoState[] = [];
  private markupElements: MarkupElement[] = [];
  markupDirty = false;
  markupTextInput = '';
  private canvasSyncTimer: any = null;

  // --- Signature ---
  signatureModalVisible = false;
  private signatureAsset: SignatureAsset | null = null;
  private readonly signatureImageCache = new Map<string, HTMLImageElement>();
  private isSignatureDrawing = false;
  private signatureLastPoint: { x: number; y: number } | null = null;
  signatureDirty = false;

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
    this.flipX = false;
    this.flipY = false;
    this.panX = 0;
    this.panY = 0;
    this.imageLoaded = false;
    this.cropMode = false;
    this.cropRect = this.getFullCropRect();
    this.draftCropRect = null;
    this.cropAction = null;
    this.resetMarkupState();
    this.scheduleCanvasSync();
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.imageNaturalWidth = img.naturalWidth;
    this.imageNaturalHeight = img.naturalHeight;
    this.imageLoaded = true;
    this.scheduleCanvasSync();
  }

  // ===== Zoom =====
  zoomIn(): void {
    this.fitToScreen = false;
    this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel * 1.25);
    this.clampPan();
    this.scheduleCanvasSync();
  }

  zoomOut(): void {
    this.fitToScreen = false;
    this.zoomLevel = Math.max(this.minZoom, this.zoomLevel / 1.25);
    if (this.zoomLevel <= 1) { this.panX = 0; this.panY = 0; }
    this.clampPan();
    this.scheduleCanvasSync();
  }

  zoomActual(): void {
    this.fitToScreen = false;
    this.zoomLevel = 1;
    this.panX = 0; this.panY = 0;
    this.scheduleCanvasSync();
  }

  zoomToFit(): void {
    this.fitToScreen = true;
    this.zoomLevel = 1;
    this.panX = 0; this.panY = 0;
    this.scheduleCanvasSync();
  }

  toggleZoomFit(): void {
    if (this.fitToScreen) { this.zoomActual(); } else { this.zoomToFit(); }
  }

  onZoomSliderChange(value: number): void {
    this.fitToScreen = false;
    this.zoomLevel = value / 100;
    this.clampPan();
    this.scheduleCanvasSync();
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
      this.scheduleCanvasSync();
    }
  }

  // ===== Pan =====
  onMouseDown(event: MouseEvent): void {
    if (!this.isImage || this.fitToScreen || this.markupTool !== 'pointer' || this.cropMode) return;
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
  rotateLeft(): void {
    this.pushUndoSnapshot();
    this.rotation = (this.rotation - 90) % 360;
    this.scheduleCanvasSync();
  }

  rotateRight(): void {
    this.pushUndoSnapshot();
    this.rotation = (this.rotation + 90) % 360;
    this.scheduleCanvasSync();
  }

  flipHorizontal(): void {
    this.pushUndoSnapshot();
    this.flipX = !this.flipX;
    this.scheduleCanvasSync();
  }

  flipVertical(): void {
    this.pushUndoSnapshot();
    this.flipY = !this.flipY;
    this.scheduleCanvasSync();
  }

  toggleCropMode(): void {
    this.cropMode = !this.cropMode;
    this.draftCropRect = this.cropMode ? { ...this.cropRect } : null;
  }

  applyCrop(): void {
    if (!this.draftCropRect) return;
    this.pushUndoSnapshot();
    this.cropRect = this.normalizeCropRect(this.draftCropRect);
    this.cropMode = false;
    this.draftCropRect = null;
  }

  resetCrop(): void {
    const full = this.getFullCropRect();
    if (this.isFullCropRect(this.cropRect) && (!this.draftCropRect || this.isFullCropRect(this.draftCropRect))) return;
    this.pushUndoSnapshot();
    this.cropRect = full;
    this.draftCropRect = this.cropMode ? { ...full } : null;
  }

  startCropSelection(event: MouseEvent): void {
    if (!this.cropMode) return;
    const point = this.getNormalizedPointFromMouseEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    this.cropAction = 'new';
    this.cropStartPoint = point;
    this.cropStartRect = { x: point.x, y: point.y, width: 0, height: 0 };
    this.draftCropRect = { x: point.x, y: point.y, width: 0, height: 0 };
  }

  startCropMove(event: MouseEvent): void {
    if (!this.cropMode || !this.draftCropRect) return;
    const point = this.getNormalizedPointFromMouseEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    this.cropAction = 'move';
    this.cropStartPoint = point;
    this.cropStartRect = { ...this.draftCropRect };
  }

  startCropResize(event: MouseEvent, action: Extract<CropAction, 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw'>): void {
    if (!this.cropMode || !this.draftCropRect) return;
    const point = this.getNormalizedPointFromMouseEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    this.cropAction = action;
    this.cropStartPoint = point;
    this.cropStartRect = { ...this.draftCropRect };
  }

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
    this.scheduleCanvasSync();
  }

  selectMarkupTool(tool: MarkupTool): void {
    this.markupTool = tool;
    if (tool === 'signature' && !this.signatureAsset) {
      this.openSignatureModal();
    }
  }

  onMarkupMouseDown(event: MouseEvent): void {
    if (this.markupTool === 'pointer') return;
    if (!this.showMarkupToolbar || this.cropMode) return;
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas) return;

    const point = this.getNormalizedPointFromMouseEvent(event);
    if (!point) return;

    this.drawStartPoint = point;

    if (this.markupTool === 'text') {
      const text = prompt('输入文字:', this.markupTextInput || '');
      if (text) {
        this.markupTextInput = text;
        this.pushUndoSnapshot();
        this.markupElements.push({
          kind: 'text',
          at: point,
          text,
          color: this.markupColor,
          fontSizeRatio: this.markupFontSize / Math.max(canvas.height, 1),
        });
        this.renderMarkupCanvas();
      }
      return;
    }

    if (this.markupTool === 'signature') {
      if (!this.signatureAsset) {
        this.openSignatureModal();
        return;
      }

      const width = 0.24;
      const height = Math.min(0.38, Math.max(0.08, (width * canvas.width) / (this.signatureAsset.aspectRatio * Math.max(canvas.height, 1))));
      this.pushUndoSnapshot();
      this.markupElements.push({
        kind: 'signature',
        at: {
          x: Math.min(Math.max(point.x - width / 2, 0), 1 - width),
          y: Math.min(Math.max(point.y - height / 2, 0), 1 - height),
        },
        width,
        height,
        dataUrl: this.signatureAsset.dataUrl,
      });
      this.renderMarkupCanvas();
      return;
    }

    this.pushUndoSnapshot();
    this.isDrawing = true;

    if (this.markupTool === 'pen') {
      this.currentPenPoints = [point];
      this.previewMarkupElement = {
        kind: 'pen',
        points: [...this.currentPenPoints],
        color: this.markupColor,
        lineWidthRatio: this.markupLineWidth / Math.max(Math.min(canvas.width, canvas.height), 1),
      };
      this.renderMarkupCanvas();
      return;
    }

    this.previewMarkupElement = {
      kind: this.markupTool,
      from: point,
      to: point,
      color: this.markupColor,
      lineWidthRatio: this.markupLineWidth / Math.max(Math.min(canvas.width, canvas.height), 1),
    };
    this.renderMarkupCanvas();
  }

  onMarkupMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas || !this.drawStartPoint) return;

    const currentPoint = this.getNormalizedPointFromMouseEvent(event);
    if (!currentPoint) return;

    if (this.markupTool === 'pen') {
      this.currentPenPoints = [...this.currentPenPoints, currentPoint];
      this.previewMarkupElement = {
        kind: 'pen',
        points: [...this.currentPenPoints],
        color: this.markupColor,
        lineWidthRatio: this.markupLineWidth / Math.max(Math.min(canvas.width, canvas.height), 1),
      };
      this.renderMarkupCanvas();
      return;
    }

    const shapeTool = this.markupTool as 'rect' | 'ellipse' | 'line';
    const snappedPoint = event.shiftKey ? this.getSnappedPoint(this.drawStartPoint, currentPoint, shapeTool) : currentPoint;
    this.previewMarkupElement = {
      kind: shapeTool,
      from: this.drawStartPoint,
      to: snappedPoint,
      color: this.markupColor,
      lineWidthRatio: this.markupLineWidth / Math.max(Math.min(canvas.width, canvas.height), 1),
    };
    this.renderMarkupCanvas();
  }

  onMarkupMouseUp(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      if (this.previewMarkupElement) {
        this.markupElements.push(this.cloneMarkupElement(this.previewMarkupElement));
        this.previewMarkupElement = null;
      }
      this.currentPenPoints = [];
      this.drawStartPoint = null;
      this.renderMarkupCanvas();
    }
  }

  clearMarkup(): void {
    if (!this.markupElements.length) return;
    this.pushUndoSnapshot();
    this.resetMarkupState();
    this.renderMarkupCanvas();
  }

  undoMarkup(): void {
    if (this.undoStack.length === 0) return;
    const prev = this.undoStack.pop()!;
    this.markupElements = this.cloneMarkupElements(prev.elements);
    this.cropRect = { ...prev.cropRect };
    this.rotation = prev.rotation;
    this.flipX = prev.flipX;
    this.flipY = prev.flipY;
    this.cropMode = false;
    this.draftCropRect = null;
    this.renderMarkupCanvas();
    this.scheduleCanvasSync();
  }

  saveEditedImage(): void {
    if (!this.currentFile || !this.isImage) return;
    const canvas = this.buildEditedImageCanvas();
    if (!canvas) return;

    const baseName = this.currentFile.name.replace(/\.[^.]+$/, '');
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${baseName || 'preview'}-edited.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ===== Copy Image =====
  copyImage(): void {
    if (!this.isImage) return;
    const canvas = this.buildEditedImageCanvas();
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (blob) { navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
    });
  }

  openSignatureModal(): void {
    this.signatureModalVisible = true;
    setTimeout(() => this.prepareSignatureCanvas(), 0);
  }

  closeSignatureModal(): void {
    this.signatureModalVisible = false;
  }

  clearSignaturePad(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureDirty = false;
  }

  saveSignature(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas || !this.signatureDirty) return;
    const trimmedCanvas = this.trimCanvas(canvas);
    const dataUrl = trimmedCanvas.toDataURL('image/png');
    this.signatureAsset = {
      dataUrl,
      aspectRatio: trimmedCanvas.width / Math.max(trimmedCanvas.height, 1),
    };
    this.signatureImageCache.delete(dataUrl);
    this.signatureModalVisible = false;
    this.markupTool = 'signature';
    this.renderMarkupCanvas();
  }

  onSignatureMouseDown(event: MouseEvent): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const point = this.getCanvasPoint(event, canvas);
    this.isSignatureDrawing = true;
    this.signatureLastPoint = point;
    this.signatureDirty = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1c1c1e';
    ctx.lineWidth = 2.6 * (window.devicePixelRatio || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  onSignatureMouseMove(event: MouseEvent): void {
    if (!this.isSignatureDrawing) return;
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas || !this.signatureLastPoint) return;
    const point = this.getCanvasPoint(event, canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    this.signatureLastPoint = point;
  }

  onSignatureMouseUp(): void {
    this.isSignatureDrawing = false;
    this.signatureLastPoint = null;
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (this.cropAction) {
      this.updateCropDrag(event);
      return;
    }

    if (this.isSignatureDrawing && event.target !== this.signatureCanvas?.nativeElement) {
      this.onSignatureMouseMove(event);
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    if (this.cropAction) {
      this.cropAction = null;
      this.cropStartPoint = null;
      this.cropStartRect = null;
      if (this.draftCropRect) {
        this.draftCropRect = this.normalizeCropRect(this.draftCropRect);
      }
    }

    this.onMarkupMouseUp();
    if (this.isSignatureDrawing) {
      this.onSignatureMouseUp();
    }
  }

  // ===== Keyboard Shortcuts =====
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.target as HTMLElement)?.tagName === 'INPUT') return;
    const mod = event.metaKey || event.ctrlKey;

    switch (true) {
      case event.key === 'Escape':
        if (this.signatureModalVisible) { this.closeSignatureModal(); return; }
        if (this.showOpenDialog) { this.closeOpenDialog(); return; }
        if (this.slideshowActive) { this.stopSlideshow(); return; }
        if (this.cropMode) { this.cropMode = false; this.draftCropRect = null; return; }
        if (this.showMarkupToolbar) { this.showMarkupToolbar = false; this.markupTool = 'pointer'; return; }
        if (this.showSidebar) { event.preventDefault(); this.showSidebar = false; return; }
        return;
      case event.key === 'ArrowLeft' && !mod: event.preventDefault(); this.prev(); break;
      case event.key === 'ArrowRight' && !mod: event.preventDefault(); this.next(); break;
      case mod && (event.key === '=' || event.key === '+'): event.preventDefault(); this.zoomIn(); break;
      case mod && event.key === '-': event.preventDefault(); this.zoomOut(); break;
      case mod && event.key === '0': event.preventDefault(); this.zoomActual(); break;
      case mod && event.key.toLowerCase() === 's': if (this.isImage) { event.preventDefault(); this.saveEditedImage(); } break;
      case mod && event.key === 'r': if (this.isImage) { event.preventDefault(); this.rotateRight(); } break;
      case mod && event.key === 'l': if (this.isImage) { event.preventDefault(); this.rotateLeft(); } break;
      case mod && event.key === 'c': if (this.isImage) { event.preventDefault(); this.copyImage(); } break;
      case mod && event.key === 'z': if (this.showMarkupToolbar) { event.preventDefault(); this.undoMarkup(); } break;
      case event.key === ' ': event.preventDefault(); this.toggleSlideshow(); break;
    }
  }

  // ===== Image transform =====
  get imageTransform(): string {
    const transforms: string[] = [];

    if (!this.fitToScreen && this.zoomLevel > 1) {
      transforms.push(`translate(${this.panX}px, ${this.panY}px)`);
    }

    if (!this.fitToScreen || this.flipX || this.flipY) {
      const scaleX = (this.fitToScreen ? 1 : this.zoomLevel) * (this.flipX ? -1 : 1);
      const scaleY = (this.fitToScreen ? 1 : this.zoomLevel) * (this.flipY ? -1 : 1);
      transforms.push(`scale(${scaleX}, ${scaleY})`);
    }

    if (this.rotation !== 0) {
      transforms.push(`rotate(${this.rotation}deg)`);
    }

    return transforms.join(' ');
  }

  get imageCursor(): string {
    if (this.cropMode) return this.cropAction === 'move' ? 'grabbing' : 'crosshair';
    if (this.markupTool === 'signature' && this.showMarkupToolbar) return 'copy';
    if (this.markupTool !== 'pointer' && this.showMarkupToolbar) return 'crosshair';
    if (this.fitToScreen) return 'default';
    if (this.zoomLevel > 1) return this.isPanning ? 'grabbing' : 'grab';
    return 'default';
  }

  get hasEdits(): boolean {
    return this.markupDirty || this.rotation !== 0 || this.flipX || this.flipY || !this.isFullCropRect(this.cropRect);
  }

  get hasCrop(): boolean {
    return !this.isFullCropRect(this.cropRect);
  }

  get imageClipPath(): string {
    if (this.isFullCropRect(this.cropRect)) return 'none';
    const right = 1 - this.cropRect.x - this.cropRect.width;
    const bottom = 1 - this.cropRect.y - this.cropRect.height;
    return `inset(${this.cropRect.y * 100}% ${right * 100}% ${bottom * 100}% ${this.cropRect.x * 100}%)`;
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '--';
    const k = 1000;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  onImageClick(): void {
    if (this.cropMode || this.signatureModalVisible) return;
    if (this.markupTool !== 'pointer' || !this.showMarkupToolbar) {
      if (!this.isPanning) { this.toggleZoomFit(); }
    }
  }

  syncCanvasSize(): void {
    const container = this.imageContainer?.nativeElement;
    const canvas = this.markupCanvas?.nativeElement;
    const image = this.mainImage?.nativeElement;
    if (!container || !canvas || !image) return;

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const width = Math.max(1, Math.round(imageRect.width));
    const height = Math.max(1, Math.round(imageRect.height));
    const left = imageRect.left - containerRect.left;
    const top = imageRect.top - containerRect.top;

    this.displayImageFrame = { left, top, width, height };

    canvas.width = width;
    canvas.height = height;
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.renderMarkupCanvas();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleCanvasSync();
  }

  private scheduleCanvasSync(): void {
    clearTimeout(this.canvasSyncTimer);
    this.canvasSyncTimer = setTimeout(() => this.syncCanvasSize(), 40);
  }

  private updateMarkupDirtyState(): void {
    this.markupDirty = this.markupElements.length > 0;
  }

  private buildEditedImageCanvas(): HTMLCanvasElement | null {
    const image = this.mainImage?.nativeElement;
    if (!image || !this.imageLoaded) return null;

    const rot = ((this.rotation % 360) + 360) % 360;
    const orientedWidth = rot === 90 || rot === 270 ? this.imageNaturalHeight : this.imageNaturalWidth;
    const orientedHeight = rot === 90 || rot === 270 ? this.imageNaturalWidth : this.imageNaturalHeight;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, orientedWidth);
    exportCanvas.height = Math.max(1, orientedHeight);

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.translate(exportCanvas.width / 2, exportCanvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
    ctx.drawImage(image, -this.imageNaturalWidth / 2, -this.imageNaturalHeight / 2, this.imageNaturalWidth, this.imageNaturalHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    for (const element of this.markupElements) {
      this.drawMarkupElement(ctx, element, exportCanvas.width, exportCanvas.height);
    }

    if (this.isFullCropRect(this.cropRect)) {
      return exportCanvas;
    }

    const cropCanvas = document.createElement('canvas');
    const sx = Math.round(this.cropRect.x * exportCanvas.width);
    const sy = Math.round(this.cropRect.y * exportCanvas.height);
    const sw = Math.max(1, Math.round(this.cropRect.width * exportCanvas.width));
    const sh = Math.max(1, Math.round(this.cropRect.height * exportCanvas.height));
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    cropCanvas.getContext('2d')?.drawImage(exportCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropCanvas;
  }

  private renderMarkupCanvas(): void {
    const canvas = this.markupCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const element of this.markupElements) {
      this.drawMarkupElement(ctx, element, canvas.width, canvas.height);
    }

    if (this.previewMarkupElement) {
      this.drawMarkupElement(ctx, this.previewMarkupElement, canvas.width, canvas.height);
    }

    this.updateMarkupDirtyState();
  }

  private drawMarkupElement(ctx: CanvasRenderingContext2D, element: MarkupElement, width: number, height: number): void {
    if (element.kind === 'signature') {
      const signature = this.getSignatureImage(element.dataUrl);
      if (!signature) return;
      ctx.drawImage(signature, element.at.x * width, element.at.y * height, element.width * width, element.height * height);
      return;
    }

    ctx.save();
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (element.kind === 'text') {
      ctx.font = `${Math.max(12, element.fontSizeRatio * height)}px -apple-system, sans-serif`;
      ctx.fillText(element.text, element.at.x * width, element.at.y * height);
      ctx.restore();
      return;
    }

    ctx.lineWidth = Math.max(1, element.lineWidthRatio * Math.min(width, height));

    if (element.kind === 'pen') {
      if (element.points.length < 2) {
        ctx.beginPath();
        ctx.arc(element.points[0].x * width, element.points[0].y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(element.points[0].x * width, element.points[0].y * height);
      for (const point of element.points.slice(1)) {
        ctx.lineTo(point.x * width, point.y * height);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    const fromX = element.from.x * width;
    const fromY = element.from.y * height;
    const toX = element.to.x * width;
    const toY = element.to.y * height;

    if (element.kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const left = Math.min(fromX, toX);
    const top = Math.min(fromY, toY);
    const rectWidth = Math.abs(toX - fromX);
    const rectHeight = Math.abs(toY - fromY);

    if (element.kind === 'rect') {
      ctx.strokeRect(left, top, rectWidth, rectHeight);
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.ellipse(left + rectWidth / 2, top + rectHeight / 2, rectWidth / 2, rectHeight / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private getSignatureImage(dataUrl: string): HTMLImageElement | null {
    const existing = this.signatureImageCache.get(dataUrl);
    if (existing) {
      return existing.complete ? existing : null;
    }

    const image = new Image();
    image.onload = () => this.renderMarkupCanvas();
    image.src = dataUrl;
    this.signatureImageCache.set(dataUrl, image);
    return null;
  }

  private pushUndoSnapshot(): void {
    this.undoStack.push({
      elements: this.cloneMarkupElements(this.markupElements),
      cropRect: { ...this.cropRect },
      rotation: this.rotation,
      flipX: this.flipX,
      flipY: this.flipY,
    });

    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  }

  private resetMarkupState(): void {
    this.markupElements = [];
    this.previewMarkupElement = null;
    this.currentPenPoints = [];
    this.drawStartPoint = null;
    this.undoStack = [];
    this.updateMarkupDirtyState();
  }

  private cloneMarkupElements(elements: MarkupElement[]): MarkupElement[] {
    return elements.map(element => this.cloneMarkupElement(element));
  }

  private cloneMarkupElement(element: MarkupElement): MarkupElement {
    return JSON.parse(JSON.stringify(element)) as MarkupElement;
  }

  private getFullCropRect(): CropRect {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  private isFullCropRect(rect: CropRect): boolean {
    return Math.abs(rect.x) < 0.001 && Math.abs(rect.y) < 0.001 && Math.abs(rect.width - 1) < 0.001 && Math.abs(rect.height - 1) < 0.001;
  }

  private normalizeCropRect(rect: CropRect): CropRect {
    const minSize = 0.04;
    const width = Math.max(minSize, Math.min(1, rect.width));
    const height = Math.max(minSize, Math.min(1, rect.height));
    const x = Math.min(Math.max(rect.x, 0), 1 - width);
    const y = Math.min(Math.max(rect.y, 0), 1 - height);
    return { x, y, width, height };
  }

  private updateCropDrag(event: MouseEvent): void {
    const point = this.getNormalizedPointFromMouseEvent(event);
    if (!point || !this.cropAction || !this.cropStartPoint || !this.cropStartRect) return;

    const dx = point.x - this.cropStartPoint.x;
    const dy = point.y - this.cropStartPoint.y;

    switch (this.cropAction) {
      case 'new':
        this.draftCropRect = this.normalizeCropRect(this.rectFromPoints(this.cropStartPoint, point));
        return;
      case 'move':
        this.draftCropRect = this.normalizeCropRect({
          x: this.cropStartRect.x + dx,
          y: this.cropStartRect.y + dy,
          width: this.cropStartRect.width,
          height: this.cropStartRect.height,
        });
        return;
      case 'resize-nw':
        this.draftCropRect = this.normalizeCropRect(this.rectFromPoints(point, {
          x: this.cropStartRect.x + this.cropStartRect.width,
          y: this.cropStartRect.y + this.cropStartRect.height,
        }));
        return;
      case 'resize-ne':
        this.draftCropRect = this.normalizeCropRect(this.rectFromPoints({
          x: this.cropStartRect.x,
          y: this.cropStartRect.y + this.cropStartRect.height,
        }, {
          x: point.x,
          y: point.y,
        }));
        return;
      case 'resize-se':
        this.draftCropRect = this.normalizeCropRect(this.rectFromPoints({
          x: this.cropStartRect.x,
          y: this.cropStartRect.y,
        }, point));
        return;
      case 'resize-sw':
        this.draftCropRect = this.normalizeCropRect(this.rectFromPoints({
          x: this.cropStartRect.x + this.cropStartRect.width,
          y: this.cropStartRect.y,
        }, point));
        return;
    }
  }

  private rectFromPoints(a: NormalizedPoint, b: NormalizedPoint): CropRect {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  }

  private getNormalizedPointFromMouseEvent(event: MouseEvent): NormalizedPoint | null {
    if (!this.displayImageFrame.width || !this.displayImageFrame.height) return null;
    const containerRect = this.imageContainer?.nativeElement.getBoundingClientRect();
    if (!containerRect) return null;
    const x = (event.clientX - containerRect.left - this.displayImageFrame.left) / this.displayImageFrame.width;
    const y = (event.clientY - containerRect.top - this.displayImageFrame.top) / this.displayImageFrame.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }

  private getSnappedPoint(start: NormalizedPoint, end: NormalizedPoint, tool: MarkupTool): NormalizedPoint {
    if (tool === 'line') {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const step = Math.PI / 4;
      const snappedAngle = Math.round(angle / step) * step;
      return {
        x: start.x + Math.cos(snappedAngle) * distance,
        y: start.y + Math.sin(snappedAngle) * distance,
      };
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + Math.sign(dx || 1) * size,
      y: start.y + Math.sign(dy || 1) * size,
    };
  }

  private prepareSignatureCanvas(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.clearSignaturePad();
  }

  private getCanvasPoint(event: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  private trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = source.getContext('2d');
    if (!ctx) return source;
    const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha === 0) continue;
        hasPixels = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (!hasPixels) return source;

    const trimmed = document.createElement('canvas');
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;
    trimmed.getContext('2d')?.drawImage(source, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return trimmed;
  }

  // Clean up on destroy
  ngOnDestroy(): void {
    this.stopSlideshow();
    clearTimeout(this.canvasSyncTimer);
    this.menuSub.unsubscribe();
  }
}

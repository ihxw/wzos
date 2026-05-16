import { ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { monacoLanguageForFile } from '../../core/utils/text-file.util';
import { WindowManagerService } from '../../core/services/window-manager.service';

@Component({
  selector: 'app-text-editor',
  standalone: true,
  imports: [CommonModule, MonacoEditorComponent],
  templateUrl: './text-editor.html',
  styleUrls: ['./text-editor.scss'],
})
export class TextEditorComponent implements OnInit, OnDestroy {
  @Input() windowId = '';
  @Input() filePath = '';
  @Input() fileName = '';
  /** Monaco language id from API (file.language); falls back to extension. */
  @Input() language = '';

  content = '';
  savedContent = '';
  editorLanguage = 'plaintext';
  loading = false;
  saving = false;
  dirty = false;
  error = '';
  statusMessage = '';
  readOnly = false;
  editorTheme: 'vs' | 'vs-dark' = 'vs-dark';

  private themeObserver: MutationObserver | null = null;
  private menuSub: Subscription;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private windowManager: WindowManagerService
  ) {
    this.menuSub = this.windowManager.menuAction$.subscribe(({ action, windowId }) => {
      if (windowId !== this.windowId) return;
      if (action === 'file-save') this.save();
    });
  }

  ngOnInit(): void {
    this.editorLanguage =
      this.language?.trim() || (this.fileName ? monacoLanguageForFile(this.fileName) : 'plaintext');
    this.watchTheme();
    if (this.filePath) {
      this.reload();
    }
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
    this.menuSub.unsubscribe();
  }

  onContentChange(value: string): void {
    this.content = value;
    this.dirty = this.content !== this.savedContent;
  }

  reload(): void {
    if (!this.filePath) {
      this.error = '未指定文件路径';
      return;
    }
    this.loading = true;
    this.error = '';
    this.statusMessage = '';
    this.http
      .get<{ path: string; content: string; size: number }>(
        `/api/files/content?path=${encodeURIComponent(this.filePath)}`
      )
      .subscribe({
        next: (data) => {
          this.content = data.content;
          this.savedContent = data.content;
          this.dirty = false;
          this.loading = false;
          if (!this.language && this.fileName) {
            this.editorLanguage = monacoLanguageForFile(this.fileName);
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || '无法加载文件';
        },
      });
  }

  save(): void {
    if (!this.filePath || !this.dirty) return;
    this.saving = true;
    this.statusMessage = '';
    this.http.put('/api/files/content', { path: this.filePath, content: this.content }).subscribe({
      next: () => {
        this.savedContent = this.content;
        this.dirty = false;
        this.saving = false;
        this.statusMessage = '已保存';
        setTimeout(() => (this.statusMessage = ''), 2000);
      },
      error: (err) => {
        this.saving = false;
        this.statusMessage = err.error?.error || '保存失败';
      },
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key === 's') {
      event.preventDefault();
      this.save();
    }
  }

  private watchTheme(): void {
    this.updateEditorTheme();
    this.themeObserver = new MutationObserver(() => {
      this.updateEditorTheme();
      this.cdr.markForCheck();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private updateEditorTheme(): void {
    this.editorTheme = document.documentElement.classList.contains('wzos-light') ? 'vs' : 'vs-dark';
  }
}

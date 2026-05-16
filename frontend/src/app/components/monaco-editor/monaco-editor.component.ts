import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type * as Monaco from 'monaco-editor';

@Component({
  selector: 'app-monaco-editor',
  standalone: true,
  template: `<div class="monaco-host" #host></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .monaco-host {
      width: 100%;
      height: 100%;
    }
  `],
})
export class MonacoEditorComponent implements OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  @Input() value = '';
  @Input() language = 'plaintext';
  @Input() readOnly = false;
  @Input() theme: 'vs' | 'vs-dark' = 'vs-dark';

  @Output() valueChange = new EventEmitter<string>();
  @Output() ready = new EventEmitter<Monaco.editor.IStandaloneCodeEditor>();

  private editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  private monaco: typeof Monaco | null = null;
  private contentListener: Monaco.IDisposable | null = null;
  private suppressEmit = false;
  private initPromise: Promise<void> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['language'] || changes['readOnly'] || changes['theme']) {
      void this.ensureEditor().then(() => this.applyInputs(changes));
    }
  }

  ngOnDestroy(): void {
    this.contentListener?.dispose();
    this.contentListener = null;
    this.editor?.dispose();
    this.editor = null;
  }

  focus(): void {
    this.editor?.focus();
  }

  private async ensureEditor(): Promise<void> {
    if (this.editor) return;
    if (!this.initPromise) {
      this.initPromise = this.createEditor();
    }
    await this.initPromise;
  }

  private async createEditor(): Promise<void> {
    try {
      this.monaco = await import('monaco-editor');
    } catch (e) {
      console.error('Monaco load failed', e);
      return;
    }
    const monaco = this.monaco;

    this.editor = monaco.editor.create(this.host.nativeElement, {
      value: this.value,
      language: this.language,
      theme: this.theme,
      readOnly: this.readOnly,
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      fontFamily: "'SF Mono', Menlo, Monaco, 'Cascadia Code', Consolas, monospace",
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      renderWhitespace: 'selection',
      smoothScrolling: true,
      padding: { top: 8, bottom: 8 },
    });

    this.contentListener = this.editor.onDidChangeModelContent(() => {
      if (this.suppressEmit || !this.editor) return;
      this.valueChange.emit(this.editor.getValue());
    });

    this.ready.emit(this.editor);
  }

  private applyInputs(changes: SimpleChanges): void {
    if (!this.editor || !this.monaco) return;

    if (changes['theme']) {
      this.monaco.editor.setTheme(this.theme);
    }

    if (changes['readOnly']) {
      this.editor.updateOptions({ readOnly: this.readOnly });
    }

    if (changes['language']) {
      const model = this.editor.getModel();
      if (model) {
        this.monaco.editor.setModelLanguage(model, this.language);
      }
    }

    if (changes['value'] && !changes['value'].firstChange) {
      const current = this.editor.getValue();
      if (current !== this.value) {
        this.suppressEmit = true;
        this.editor.setValue(this.value);
        this.suppressEmit = false;
      }
    } else if (changes['value']?.firstChange) {
      this.suppressEmit = true;
      this.editor.setValue(this.value);
      this.suppressEmit = false;
    }
  }
}

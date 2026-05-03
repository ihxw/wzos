import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { NzDropDownModule, NzContextMenuService, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import 'xterm/css/xterm.css';
import { terminalThemes, DEFAULT_THEME, TerminalTheme } from './terminal-themes';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, NzDropDownModule],
  templateUrl: './terminal.html',
  styleUrls: ['./terminal.scss']
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef;
  @Input() windowId!: string;

  private term!: Terminal;
  private fitAddon!: FitAddon;
  private ws!: WebSocket;
  private resizeObserver!: ResizeObserver;

  // Connection state
  status: 'connecting' | 'connected' | 'disconnected' | 'error' = 'connecting';
  termSize = '80x24';
  currentThemeKey = DEFAULT_THEME;

  // Available themes
  themes = terminalThemes;
  themeKeys = Object.keys(terminalThemes);

  // Font settings
  fontSize = parseInt(localStorage.getItem('wzos_term_fontSize') ?? '14', 10);
  fontFamily = localStorage.getItem('wzos_term_fontFamily') ?? "'Menlo', 'Monaco', monospace";

  // Show font settings panel
  showFontPanel = false;

  constructor(
    private viewContainerRef: ViewContainerRef,
    private nzContextMenuService: NzContextMenuService
  ) {}

  get themeObj(): TerminalTheme {
    return this.themes[this.currentThemeKey] || this.themes[DEFAULT_THEME];
  }

  ngAfterViewInit() {
    this.initTerminal();
    this.connectWebSocket();
    window.addEventListener('wzos-open-terminal', this.onOpenTerminal as EventListener);
  }

  ngOnDestroy() {
    window.removeEventListener('wzos-open-terminal', this.onOpenTerminal as EventListener);
    this.resizeObserver?.disconnect();
    this.ws?.close();
    this.term?.dispose();
  }

  private initTerminal() {
    this.term = new Terminal({
      cursorBlink: true,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      theme: this.themeObj.colors,
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);

    this.term.open(this.terminalContainer.nativeElement);
    setTimeout(() => this.fitTerminal(), 100);

    this.term.onData((data) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.fitTerminal());
    this.resizeObserver.observe(this.terminalContainer.nativeElement);
  }

  private fitTerminal() {
    try {
      this.fitAddon.fit();
      this.termSize = `${this.term.cols}x${this.term.rows}`;
      this.sendResize();
    } catch { /* ignore */ }
  }

  private sendResize() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'resize',
        data: { cols: this.term.cols, rows: this.term.rows }
      }));
    }
  }

  private connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${window.location.host}/ws/terminal`);

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.term.write(event.data);
      } else {
        event.data.text().then((text: string) => this.term.write(text)).catch(() => {});
      }
    };

    this.ws.onopen = () => {
      this.status = 'connected';
      this.sendResize();
      this.term.focus();
    };

    this.ws.onclose = () => {
      this.status = 'disconnected';
    };

    this.ws.onerror = () => {
      this.status = 'error';
    };
  }

  /** Switch terminal theme */
  setTheme(key: string) {
    this.currentThemeKey = key;
    const theme = this.themes[key];
    if (theme && this.term) {
      this.term.options.theme = theme.colors;
    }
  }

  /** Apply font change */
  applyFont() {
    if (!this.term) return;
    this.term.options.fontSize = this.fontSize;
    this.term.options.fontFamily = this.fontFamily;
    localStorage.setItem('wzos_term_fontSize', String(this.fontSize));
    localStorage.setItem('wzos_term_fontFamily', this.fontFamily);
    setTimeout(() => this.fitTerminal(), 50);
  }

  toggleFontPanel() {
    this.showFontPanel = !this.showFontPanel;
  }

  setFontFamily(value: string) {
    this.fontFamily = value;
    this.applyFont();
  }

  setFontSize(value: string) {
    this.fontSize = parseInt(value, 10);
    this.applyFont();
  }

  // ===== Context Menu =====

  openContextMenu(event: MouseEvent, menu: NzDropdownMenuComponent) {
    event.preventDefault();
    event.stopPropagation();
    this.nzContextMenuService.create(event, menu);
  }

  /** Copy selected text to clipboard */
  copyText() {
    if (!this.term) return;
    const sel = this.term.getSelection();
    if (sel) {
      navigator.clipboard.writeText(sel);
    }
  }

  /** Paste from clipboard into terminal */
  async pasteText() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.ws.send(JSON.stringify({ type: 'input', data: text }));
        this.term.focus();
      }
    } catch { /* clipboard access denied */ }
  }

  /** Clear terminal (Ctrl+L) */
  clearTerminal() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'input', data: '\x0c' }));
    }
  }

  /** Reset xterm state */
  resetTerminal() {
    this.term?.reset();
  }

  /** Select all text */
  selectAll() {
    this.term?.selectAll();
  }

  /** Has selected text */
  get hasSelection(): boolean {
    return !!this.term?.getSelection();
  }

  private onOpenTerminal = (event: CustomEvent) => {
    const targetPath = event.detail?.path;
    if (targetPath && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'input', data: `cd "${targetPath}"\r` }));
    }
  };

  get statusText(): string {
    switch (this.status) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
    }
  }

  get statusClass(): string {
    return this.status;
  }
}

import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './terminal.html',
  styleUrls: ['./terminal.scss']
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef;
  
  private term!: Terminal;
  private fitAddon!: FitAddon;
  private ws!: WebSocket;

  ngAfterViewInit() {
    this.initTerminal();
    this.connectWebSocket();
    
    // Handle window resize
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.ws) {
      this.ws.close();
    }
    if (this.term) {
      this.term.dispose();
    }
  }

  private initTerminal() {
    this.term = new Terminal({
      cursorBlink: true,
      fontFamily: 'monospace',
      theme: {
        background: '#1e1e1e',
      }
    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    
    this.term.open(this.terminalContainer.nativeElement);
    setTimeout(() => {
        this.fitAddon.fit();
    }, 100);

    this.term.onData((data) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      }
    });
  }

  private connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:8080/api/ws/terminal');
    
    this.ws.onmessage = (event) => {
      event.data.text().then((text: string) => {
        this.term.write(text);
      }).catch((e: any) => {
        // If it's already a string
        if (typeof event.data === 'string') {
          this.term.write(event.data);
        }
      });
    };

    this.ws.onopen = () => {
      this.term.write('\r\n*** Connected to Backend ***\r\n');
    };

    this.ws.onclose = () => {
      this.term.write('\r\n*** Connection Closed ***\r\n');
    };
    
    this.ws.onerror = (err) => {
      this.term.write('\r\n*** Connection Error ***\r\n');
    }
  }

  private onResize = () => {
    if (this.fitAddon) {
      this.fitAddon.fit();
    }
  };
}

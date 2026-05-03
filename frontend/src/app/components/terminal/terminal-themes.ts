export interface TerminalTheme {
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
}

export const terminalThemes: Record<string, TerminalTheme> = {
  vscodeDark: {
    name: 'VS Code Dark',
    type: 'dark',
    colors: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#ffffff',
      selectionBackground: '#cccccc',
      selectionForeground: '#1e1e1e',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    }
  },
  vscodeLight: {
    name: 'VS Code Light',
    type: 'light',
    colors: {
      background: '#ffffff',
      foreground: '#333333',
      cursor: '#000000',
      selectionBackground: '#e5e5e5',
      selectionForeground: '#333333',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc3fbc',
      cyan: '#0598bc',
      white: '#555555',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#a5a5a5'
    }
  },
  monokai: {
    name: 'Monokai',
    type: 'dark',
    colors: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      selectionBackground: '#f8f8f2',
      selectionForeground: '#272822',
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#f4bf75',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#f4bf75',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5'
    }
  },
  githubDark: {
    name: 'GitHub Dark',
    type: 'dark',
    colors: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#c9d1d9',
      selectionBackground: '#c9d1d9',
      selectionForeground: '#0d1117',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d364',
      brightWhite: '#f0f6fc'
    }
  },
  macosProDark: {
    name: 'macOS Pro',
    type: 'dark',
    colors: {
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#505050',
      black: '#000000',
      red: '#ff5f56',
      green: '#28c840',
      yellow: '#ffbd2e',
      blue: '#5a9fff',
      magenta: '#ff6fa8',
      cyan: '#5ac8fa',
      white: '#ffffff',
      brightBlack: '#555555',
      brightRed: '#ff5f56',
      brightGreen: '#28c840',
      brightYellow: '#ffbd2e',
      brightBlue: '#5a9fff',
      brightMagenta: '#ff6fa8',
      brightCyan: '#5ac8fa',
      brightWhite: '#ffffff'
    }
  }
};

export const DEFAULT_THEME = 'macosProDark';

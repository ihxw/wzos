/** Extensions treated as editable text (Monaco). */
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'js', 'mjs', 'cjs', 'jsx',
  'ts', 'tsx', 'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
  'xml', 'svg', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config',
  'env', 'properties', 'gitignore', 'dockerignore', 'editorconfig',
  'go', 'mod', 'sum', 'py', 'pyw', 'rb', 'php', 'java', 'kt', 'kts',
  'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'cs', 'rs', 'swift', 'sql',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'lua', 'r',
  'vue', 'svelte', 'graphql', 'gql', 'proto', 'log', 'csv', 'tsv',
  'makefile', 'dockerfile', 'nginx', 'service', 'desktop', 'plist',
  'claude', 'cursorrules'
]);

const EXT_TO_LANGUAGE: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  json: 'json', jsonc: 'json',
  html: 'html', htm: 'html', xhtml: 'html',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  md: 'markdown', markdown: 'markdown',
  xml: 'xml', svg: 'xml',
  yaml: 'yaml', yml: 'yaml',
  py: 'python', pyw: 'python',
  go: 'go', mod: 'go', sum: 'go',
  rs: 'rust', java: 'java', kt: 'kotlin', kts: 'kotlin',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp', php: 'php', rb: 'ruby', swift: 'swift',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', bat: 'bat', cmd: 'bat',
  sql: 'sql', lua: 'lua', r: 'r',
  vue: 'html', svelte: 'html',
  graphql: 'graphql', gql: 'graphql',
  proto: 'protobuf',
  dockerfile: 'dockerfile',
  ini: 'ini', cfg: 'ini', conf: 'ini', properties: 'ini',
  env: 'shell', toml: 'ini',
  log: 'plaintext', txt: 'plaintext', csv: 'plaintext', tsv: 'plaintext',
  gitignore: 'plaintext', dockerignore: 'plaintext', editorconfig: 'ini',
};

export function isTextFile(fileName: string): boolean {
  const ext = getExtension(fileName);
  if (!ext) {
    const lower = fileName.toLowerCase();
    return lower === 'makefile' || lower === 'dockerfile' || lower === 'license' || lower === 'readme';
  }
  return TEXT_EXTENSIONS.has(ext);
}

export function monacoLanguageForFile(fileName: string): string {
  const ext = getExtension(fileName);
  if (!ext) {
    const lower = fileName.toLowerCase();
    if (lower === 'dockerfile') return 'dockerfile';
    if (lower === 'makefile') return 'makefile';
    return 'plaintext';
  }
  return EXT_TO_LANGUAGE[ext] ?? 'plaintext';
}

function getExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

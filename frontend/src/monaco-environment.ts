/** Configure Monaco web workers (assets copied to /monaco/vs from monaco-editor/min/vs). */
export function setupMonacoEnvironment(): void {
  const w = window as Window & {
    MonacoEnvironment?: { getWorkerUrl: (moduleId: string, label: string) => string };
  };
  if (w.MonacoEnvironment) return;

  w.MonacoEnvironment = {
    getWorkerUrl(_moduleId: string, label: string): string {
      if (label === 'json') {
        return '/monaco/vs/language/json/jsonWorker.js';
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return '/monaco/vs/language/css/cssWorker.js';
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return '/monaco/vs/language/html/htmlWorker.js';
      }
      if (label === 'typescript' || label === 'javascript') {
        return '/monaco/vs/language/typescript/tsWorker.js';
      }
      return '/monaco/vs/base/worker/workerMain.js';
    },
  };
}

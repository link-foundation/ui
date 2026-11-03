export interface EditorDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}
export interface EditorDocument {
  id: string;
  title: string;
  text: string;
  saved: string;
  language: string;
  dirty: boolean;
  incoming: string | null;
}
export interface EditorStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface DocumentsOptions {
  storage?: EditorStorage;
  key?: string;
  clock?: {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
  };
}
export interface DocumentsModel {
  readonly documents: EditorDocument[];
  readonly active: EditorDocument | null;
  get(id: string): EditorDocument | null;
  subscribe(fn: (event: { type: string; id: string }) => void): () => void;
  open(doc: {
    id: string;
    text?: string;
    title?: string;
    language?: string;
  }): EditorDocument;
  switch(id: string): void;
  edit(id: string, text: string): void;
  save(id: string): string;
  close(id: string, options?: { discard?: boolean }): 'closed' | 'unsaved';
  externalUpdate(
    id: string,
    text: string
  ): 'updated' | 'unchanged' | 'conflict';
  resolve(id: string, choice: 'mine' | 'theirs'): void;
  destroy(): void;
}
export interface EditorEngine {
  setDocument(
    document: Pick<EditorDocument, 'id' | 'text' | 'language'>
  ): void | Promise<void>;
  setDiagnostics(diagnostics: EditorDiagnostic[]): void;
  setReadOnly(readOnly: boolean): void;
  focus(offset?: number): void;
  destroy(): void;
}
export interface EditorOptions extends DocumentsOptions {
  model?: DocumentsModel;
  engine?: 'codemirror' | 'monaco';
  label?: string;
  confirmClose?: (document: EditorDocument) => boolean;
  engineOptions?: { loadMonaco?: () => Promise<unknown> };
}
export interface CodeEditorElement extends HTMLElement {
  editorOptions: EditorOptions;
  readonly model: DocumentsModel;
  readonly ready: Promise<void>;
  openDocument: DocumentsModel['open'];
  externalUpdate: DocumentsModel['externalUpdate'];
  focusEditor(offset?: number): void;
}
export function validateLino(text: string): {
  ok: boolean;
  diagnostics: EditorDiagnostic[];
};
export function diagnosticOffset(
  text: string,
  diagnostic: Pick<EditorDiagnostic, 'line' | 'column'>
): number;
export function highlightLino(text: string): {
  type: 'paren' | 'id' | 'colon' | 'string' | 'comment' | 'word';
  from: number;
  to: number;
}[];
export function linoStructure(text: string): {
  pairs: { from: number; to: number }[];
  folds: { from: number; to: number }[];
};
export function createDocumentsModel(
  options?: DocumentsOptions
): DocumentsModel;
export function createEditorEngine(
  name: 'codemirror' | 'monaco',
  parent: HTMLElement,
  options?: Record<string, unknown>
): Promise<EditorEngine>;
export function defineCodeEditor(window?: Window & typeof globalThis): void;
export function mountCodeEditor(
  host: HTMLElement,
  options?: EditorOptions
): {
  model: DocumentsModel;
  ready: Promise<void>;
  focus(offset?: number): void;
  destroy(): void;
};
export function registerEditor(
  target?: Map<string, object> | Record<string, object>
): object;

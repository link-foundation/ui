export interface ForeignStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}
export interface ForeignController {
  readonly host: HTMLElement;
  readonly isOpen: boolean;
  readonly storageError: string | null;
  readonly restoreError: string | null;
  readonly adapter: {
    tree(): object;
    nodeFor(id: string): Node | null;
    idFor(node: Node): string | null;
    applyProperty(id: string, name: string, value: string): { layer: string };
    observe(callback: () => void): () => void;
  };
  open(): Promise<boolean>;
  close(): void;
  toggle(): Promise<boolean>;
  select(id: string | null): string | null | undefined;
  getSelection(): { id: string; type: string } | null;
  setProperty(id: string, name: string, value: string): { layer: string };
  exportOverrides(): { text: string; count: number; links: unknown[] };
  exportSubtree(id?: string): string;
  whenSaved(): Promise<void>;
  destroy(): Promise<void>;
}
export function mountForeignDevMode(options?: {
  window?: Window;
  storage?: ForeignStorage;
  layout?: string;
}): Promise<ForeignController>;

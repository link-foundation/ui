import type {
  Diagnostic,
  Service,
} from '@link-foundation/ui-components/behavior';

export const FOCUSABLE: string;
export function tabbables(container: Element): HTMLElement[];
export function restoreFocus(previous: Element | null | undefined): boolean;
export function trapFocus(
  container: HTMLElement,
  options?: { initialFocus?: HTMLElement | null; restore?: boolean }
): () => void;

export interface RovingTabindex {
  readonly index: number;
  readonly item: HTMLElement | null;
  focus(index: number): boolean;
  update(): void;
  handleKeyDown(event: KeyboardEvent): boolean;
  attach(container: HTMLElement): () => void;
}

export function createRovingTabindex(
  items: HTMLElement[] | (() => HTMLElement[]),
  options?: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    initial?: number;
    rtl?: boolean;
    onChange?: (index: number, item: HTMLElement) => void;
  }
): RovingTabindex;

export interface Typeahead {
  readonly query: string;
  handleKey(key: string, current?: number): number;
  reset(): void;
}

export function createTypeahead(
  getLabels: () => readonly string[],
  options?: {
    timeout?: number;
    clock?: {
      setTimeout(fn: () => void, ms: number): unknown;
      clearTimeout(handle: unknown): void;
    };
    locale?: string;
  }
): Typeahead;

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export function keyOf(event: KeyLike): string;
export function normalizeKey(combo: string): string;
export function isTextField(element: EventTarget | null | undefined): boolean;
export function firesInField(combo: string): boolean;
export function bindKeys(
  element: EventTarget,
  map: Record<string, (event: KeyboardEvent) => unknown>,
  options?: { ignoreInFields?: boolean; type?: 'keydown' | 'keyup' }
): () => void;

export function liveRegion(document: Document): HTMLElement;
export function announce(
  message: string,
  options?: { politeness?: 'polite' | 'assertive'; document?: Document }
): HTMLElement;
export function clearAnnouncements(document?: Document): void;

export function bindMachine(
  root: HTMLElement,
  service: Service,
  parts?:
    | Record<string, HTMLElement | null | undefined>
    | ((part: string) => HTMLElement | null | undefined),
  options?: {
    onDiagnostic?: (diagnostic: Diagnostic) => void;
    ignoreInFields?: boolean;
  }
): () => void;

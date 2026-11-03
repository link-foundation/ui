export interface VirtualAnchor {
  getBoundingClientRect():
    | DOMRect
    | {
        x: number;
        y: number;
        top: number;
        right: number;
        bottom: number;
        left: number;
        width: number;
        height: number;
      };
  contextElement?: Element;
}
export interface PositionOptions {
  placement?: string;
  offset?: number;
  onUpdate?: (position: { x: number; y: number; placement: string }) => void;
}
export function positionFloating(
  anchor: Element | VirtualAnchor,
  floating: HTMLElement,
  options?: PositionOptions
): () => void;
export function createPositioner(
  dependencies?: object
): typeof positionFloating;
export function virtualAnchor(
  x: number,
  y: number,
  contextElement?: Element
): VirtualAnchor;
export function radialLayout(
  count: number,
  options?: { radius?: number; startAngle?: number }
): { x: number; y: number; angle: number }[];
export function sectorAt(
  dx: number,
  dy: number,
  count: number,
  startAngle?: number
): number;
export interface OverlayController {
  open(
    anchor?: Element | VirtualAnchor,
    context?: { target?: string; selection?: string[] }
  ): void;
  close(restore?: boolean): void;
  service?: import('@link-foundation/ui-components/behavior').Service;
  queue?: ReturnType<typeof createToastQueue>;
}
export function overlayController(node: Element): OverlayController | undefined;
export function overlayVocabulary(): import('@link-foundation/ui-core').Vocabulary;
export function createToastQueue(options: {
  max?: number;
  duration?: number;
  clock: { now?: number; setTimeout: Function; clearTimeout: Function };
  onChange?: (entries: object[]) => void;
}): {
  entries: Map<string, any>;
  push(id: string, options?: object): void;
  close(id: string): void;
  pause(id: string, reason?: string): void;
  resume(id: string, reason?: string): void;
  disconnect(): void;
};
export const SURFACE_MACHINE: string;
export const TOOLTIP_MACHINE: string;
export const TABS_MACHINE: string;
export const TOAST_MACHINE: string;

declare module '@link-foundation/ui-dom' {
  interface RenderOptions {
    overlays?: {
      clock?: import('@link-foundation/ui-components/behavior').Clock;
      selection?: () => readonly string[];
    };
  }
}

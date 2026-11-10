export interface AssetRecord {
  id: string;
  kind: string;
  files: string[];
  /** An SPDX expression. */
  license: string;
  /** `none` for our own public-domain icons. */
  copyright: string;
  source?: string;
  notice?: string;
  attribution?: 'required' | 'none';
  attributionText?: string;
  modified?: 'yes' | 'no';
}

export interface IconData {
  /** Library title, used by label=true. */
  title?: string;
  viewBox: string;
  /** SVG markup drawn in currentColor. */
  body: string;
  /** Flip horizontally in right-to-left text. */
  mirrorInRtl: boolean;
  record: AssetRecord | undefined;
}

export interface ResolvedIcon extends IconData {
  /** The set that supplied the icon. */
  set: string;
  name: string;
  placeholder?: boolean;
}

export interface IconSource {
  resolve(name: string): Promise<IconData | undefined>;
  records(): AssetRecord[];
  names?(): string[];
}

/** `close`, `lucide:check` or `{set: 'lucide', name: 'check'}`. */
export type IconRef = string | { set?: string; name: string };

/** A module written by scripts/build-icons.mjs (`dist/icons/<set>.js`). */
export interface StaticIconModule {
  set: string;
  icons: Record<
    string,
    {
      viewBox: string;
      body: string;
      title?: string;
      mirrorInRtl?: boolean;
      record: string;
    }
  >;
  records: AssetRecord[];
}

export const PLACEHOLDER_ICON: Readonly<
  IconData & { record: undefined; placeholder: true }
>;
export function registerIconSet(set: string, source: IconSource): () => void;
export function iconSets(): string[];
export function getIconSet(set: string): IconSource | undefined;
export function onIconSetsChange(listener: (set: string) => void): () => void;
export function parseIconRef(ref: IconRef): { set: string; name: string };
export function resolveIcon(ref: IconRef): Promise<ResolvedIcon>;
export function iconRecords(only?: string[]): AssetRecord[];
export function createStaticSource(
  module: StaticIconModule
): Readonly<IconSource & { names(): string[] }>;

export const DEFAULT_ICON_SET: 'own';
export const ICON_NAMES: readonly string[];
export const MIRROR_IN_RTL: ReadonlySet<string>;

export function splitSvg(
  text: string,
  options?: { defaults?: Record<string, string> }
): { viewBox: string; body: string; title?: string };
export function iconToSvg(
  icon: { viewBox: string; body: string },
  attributes?: Record<string, string>
): string;
export function iconNodeToSvg(node: unknown, root?: unknown): string;

export const ICON_TAG: 'ui-icon';
export const ICON_ATTRIBUTES: readonly [
  'name',
  'set',
  'label',
  'mirror',
  'fill',
  'stroke-width',
  'size',
];
export const ICON_CSS: string;
export const ICON_KIND_TEXT: string;
/** The ui-dialect/0 vocabulary plus the `icon` kind. */
export function iconVocabulary(): unknown;
export function defineIconElement(
  win?: Window
): CustomElementConstructor | undefined;
export function iconAttributes(el: {
  props: Map<string, unknown[]>;
  positional?: unknown[];
}): {
  name: string | undefined;
  set: string | undefined;
  label: string | undefined;
  mirror: string | undefined;
  fill: string | undefined;
  'stroke-width': string | undefined;
  size: string | undefined;
};

/** The `ui-icon` element. */
export interface UiIconElement extends HTMLElement {
  /** The icon data shown now (after `ready`). */
  readonly icon: ResolvedIcon | undefined;
  /** Settles with the icon data when the drawing is up to date. */
  readonly ready: Promise<ResolvedIcon | undefined>;
}

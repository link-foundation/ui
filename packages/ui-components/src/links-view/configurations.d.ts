export type Configuration = [number, number][];
export type ParseConfiguration =
  | { links: Configuration; error?: never }
  | { error: string; links?: never };
export interface ConfigurationOptions {
  real?: boolean;
}
export type ConfigurationIndex = bigint | string | number;
/** n >= 1. Unsafe Number indexes are refused; use BigInt or decimal strings. */
export function count(n: number, options?: ConfigurationOptions): bigint;
export function codeAt(
  n: number,
  index: ConfigurationIndex,
  options?: ConfigurationOptions
): string;
export function indexOf(
  links: Configuration,
  options?: ConfigurationOptions
): bigint;
export function encode(links: Configuration): string;
/** Throws on invalid input. Use parseCode for the {links}|{error} contract. */
export function decode(code: string): Configuration;
export function randomCode(
  n: number,
  options?: ConfigurationOptions & { random?: () => number }
): string;
export function parseCode(code: string): ParseConfiguration;
export function parseTheory(text: string): ParseConfiguration;
export function formatTheory(
  links: Configuration,
  options?: { set?: 'λ' | 'L' | 'R' }
): string;
export function parsePairs(text: string): ParseConfiguration;
export function formatPairs(links: Configuration): string;
export function parseNumber(text: string): ParseConfiguration;
export function formatNumber(links: Configuration): string;
export function parseDecimal(
  text: string,
  n: number,
  options?: ConfigurationOptions
): ParseConfiguration;
export function formatDecimal(
  links: Configuration,
  options?: ConfigurationOptions
): string;
export function parseLinks(text: string): ParseConfiguration;
export function formatLinks(links: Configuration): string;
export const configurationMessages: Record<'en' | 'ru', Record<string, string>>;
export function addLink(links: Configuration): Configuration;
export function removeLink(
  links: Configuration,
  k: number
): { links: Configuration; indexMap: Map<number, number> };
export function setReference(
  links: Configuration,
  k: number,
  end: 'source' | 'target' | 0 | 1,
  value: number
): Configuration;
export function step(links: Configuration, direction: 1 | -1): Configuration;
/** permutation[i] is the new one-based name of old link i+1. */
export function relabel(
  links: Configuration,
  permutation: number[]
): Configuration;
/** Minimum in numeric counting order. Practical up to n=7. */
export function canonical(links: Configuration): string;
/** Sorted representatives; intended for small networks. Allocates an orbit bitmap. */
export function representatives(
  n: number,
  options?: ConfigurationOptions
): Configuration[];
export function classCount(n: number, options?: ConfigurationOptions): bigint;

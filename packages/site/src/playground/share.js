/** Browser-native, bounded URL codec. No storage or network is used. */
export const URL_BUDGET = 8192;
export const MAX_INPUT_SIZE = 65536;
const bytes = (text) => new globalThis.TextEncoder().encode(text);
async function transform(input, stream, limit) {
  const reader = new globalThis.Blob([input])
    .stream()
    .pipeThrough(stream)
    .getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } finally {
    reader.releaseLock();
  }
}
export async function encodeShare(
  text,
  platform = globalThis,
  budget = URL_BUDGET
) {
  if (typeof text !== 'string' || text.length > MAX_INPUT_SIZE) {
    return { hash: '', tooLong: true };
  }
  let hash;
  try {
    hash = `#lino=${encodeURIComponent(text)}`;
  } catch {
    return { hash: '', tooLong: true };
  }
  if (hash.length <= budget) {
    return { hash, tooLong: false };
  }
  try {
    const compressed = await transform(
      bytes(text),
      new platform.CompressionStream('deflate-raw'),
      MAX_INPUT_SIZE * 4
    );
    if (compressed) {
      hash = `#lino-z=${globalThis
        .btoa(String.fromCharCode(...compressed))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '')}`;
    }
  } catch {
    /* Older browsers cannot compress; offer copying the source. */
  }
  return { hash, tooLong: hash.length > budget };
}
export async function decodeShare(hash, platform = globalThis) {
  if (typeof hash !== 'string' || hash.length > URL_BUDGET) {
    return null;
  }
  try {
    let text;
    if (hash.startsWith('#lino=')) {
      text = decodeURIComponent(hash.slice(6));
    } else if (hash.startsWith('#lino-z=')) {
      const encoded = hash.slice(8);
      if (!/^[\w-]+$/u.test(encoded)) {
        return null;
      }
      const binary = globalThis.atob(
        encoded.replaceAll('-', '+').replaceAll('_', '/')
      );
      const result = await transform(
        Uint8Array.from(binary, (c) => c.charCodeAt(0)),
        new platform.DecompressionStream('deflate-raw'),
        MAX_INPUT_SIZE * 4
      );
      if (!result) {
        return null;
      }
      text = new globalThis.TextDecoder('utf-8', { fatal: true }).decode(
        result
      );
    } else {
      return null;
    }
    return text.length <= MAX_INPUT_SIZE ? text : null;
  } catch {
    return null;
  }
}

/** Exact numeric model. Public parsers translate these exceptions to message keys. */
export function invalid(reason) {
  throw new RangeError(`configurations.${reason}`);
}

export function size(n) {
  if (!Number.isSafeInteger(n) || n < 1) {
    invalid('digits');
  }
  return n;
}

export function checked(links, { real = false } = {}) {
  if (!Array.isArray(links)) {
    invalid('digits');
  }
  const n = size(links.length);
  for (const pair of links) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      invalid('digits');
    }
    for (const digit of pair) {
      if (!Number.isSafeInteger(digit) || digit < (real ? 1 : 0) || digit > n) {
        invalid('reference');
      }
    }
  }
  return links;
}

export function integer(value) {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    return BigInt(value);
  }
  return invalid('index');
}

export function count(n, { real = false } = {}) {
  size(n);
  return BigInt(real ? n : n + 1) ** (2n * BigInt(n));
}

export function encode(links) {
  checked(links);
  return links.length <= 9
    ? links.map((pair) => pair.join('')).join(' ')
    : links.map((pair) => pair.join(',')).join(';');
}

export function fromDigits(digits) {
  if (!digits.length || digits.length % 2) {
    invalid('digits');
  }
  return checked(
    Array.from({ length: digits.length / 2 }, (_, i) =>
      digits.slice(i * 2, i * 2 + 2)
    )
  );
}

export function decode(text) {
  if (typeof text !== 'string') {
    invalid('syntax');
  }
  const source = text.trim();
  if (source.includes(',')) {
    const pairs = source.split(';').map((pair) => {
      if (!/^\d+\s*,\s*\d+$/u.test(pair.trim())) {
        invalid('syntax');
      }
      return pair.split(',').map(Number);
    });
    return checked(pairs);
  }
  if (!/^(?:\d{2}(?:[\s.-]*\d{2})*)$/u.test(source)) {
    if (/^[\d\s.-]*$/u.test(source)) {
      invalid('digits');
    }
    invalid('syntax');
  }
  return fromDigits([...source.replace(/[\s.-]/gu, '')].map(Number));
}

export function indexOf(links, { real = false } = {}) {
  checked(links, { real });
  const base = BigInt(real ? links.length : links.length + 1);
  let index = 0n;
  for (const pair of links) {
    for (const digit of pair) {
      index = index * base + BigInt(digit - (real ? 1 : 0));
    }
  }
  return index;
}

export function linksAt(n, index, { real = false } = {}) {
  const total = count(n, { real });
  let value = integer(index);
  if (value < 0n || value >= total) {
    invalid('index');
  }
  const base = BigInt(real ? n : n + 1);
  const digits = Array(2 * n);
  for (let i = digits.length - 1; i >= 0; i--) {
    digits[i] = Number(value % base) + (real ? 1 : 0);
    value /= base;
  }
  return fromDigits(digits);
}

export function codeAt(n, index, options) {
  return encode(linksAt(n, index, options));
}

/** Sample each small digit, never a floating point approximation of the index. */
export function randomCode(n, { real = false, random = Math.random } = {}) {
  size(n);
  const digits = Array.from({ length: 2 * n }, () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      invalid('index');
    }
    return Math.floor(value * (real ? n : n + 1)) + (real ? 1 : 0);
  });
  return encode(fromDigits(digits));
}

export function addLink(links) {
  checked(links);
  return [...links.map((pair) => [...pair]), [0, 0]];
}

/** k and indexMap use one-based link names; the removed name has no entry. */
export function removeLink(links, k) {
  checked(links);
  if (!Number.isInteger(k) || k < 1 || k > links.length) {
    invalid('name');
  }
  const indexMap = new Map();
  const keep = links.length === 1;
  links.forEach((_, i) => {
    if (keep || i + 1 !== k) {
      indexMap.set(i + 1, i + 1 - (i + 1 > k && !keep ? 1 : 0));
    }
  });
  return {
    links: links
      .filter((_, i) => keep || i + 1 !== k)
      .map((pair) =>
        pair.map((ref) =>
          keep ? ref : ref === k ? 0 : ref > k ? ref - 1 : ref
        )
      ),
    indexMap,
  };
}

export function setReference(links, k, end, value) {
  checked(links);
  if (!Number.isInteger(k) || k < 1 || k > links.length) {
    invalid('name');
  }
  const side = end === 'source' ? 0 : end === 'target' ? 1 : end;
  if (side !== 0 && side !== 1) {
    invalid('reference');
  }
  return checked(
    links.map((pair, i) =>
      pair.map((ref, j) => (i === k - 1 && j === side ? value : ref))
    )
  );
}

export function step(links, direction) {
  checked(links);
  if (direction !== 1 && direction !== -1) {
    invalid('index');
  }
  const n = links.length;
  const index = indexOf(links) + BigInt(direction);
  if (index < 0n) {
    return n === 1 ? linksAt(1, 0n) : linksAt(n - 1, count(n - 1) - 1n);
  }
  return index === count(n) ? linksAt(n + 1, 0n) : linksAt(n, index);
}

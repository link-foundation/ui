/** An inline, synchronous before-paint script. Storage is untrusted and optional. */
export function themeBootScript({ storageKey = 'ui-theme' } = {}) {
  const key = JSON.stringify(storageKey)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
  const script = `(function(){try{var v=JSON.parse(localStorage.getItem(${key})||'{}'),e=document.documentElement;if(typeof v.theme==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v.theme))e.setAttribute('data-theme',v.theme);if(['light','dark','system'].indexOf(v.scheme)>=0)e.setAttribute('data-scheme',v.scheme)}catch(e){}})();`;
  if (new TextEncoder().encode(script).length > 1024) {
    throw new RangeError('Boot script exceeds 1 KB');
  }
  return script;
}

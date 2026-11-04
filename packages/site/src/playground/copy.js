/** Encode and copy the exact editor document, with an address-bar fallback. */
import { encodeShare, URL_BUDGET } from './share.js';
export async function copyLink({ window, text, status, isCurrent }) {
  const base = window.location.href.split('#')[0];
  const { hash, tooLong } = await encodeShare(
    text,
    window,
    URL_BUDGET - base.length
  );
  if (!isCurrent()) {
    return;
  }
  const url = base + hash;
  if (tooLong || url.length > URL_BUDGET) {
    status.textContent = 'Too long, copy the text.';
    return;
  }
  window.history.replaceState(null, '', hash);
  try {
    await window.navigator.clipboard.writeText(url);
    status.textContent = 'Link copied.';
  } catch {
    status.textContent = 'Copy the link from the address bar.';
  }
}

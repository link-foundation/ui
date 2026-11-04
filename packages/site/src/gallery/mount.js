/** Load only expanded matrices. Reinserting native lazy frames can load hidden frames. */
export function mountGallery(gallery) {
  gallery.addEventListener(
    'toggle',
    (event) => {
      const details = event.target;
      const frame = details.querySelector('iframe');
      if (!frame) {
        return;
      }
      if (details.open) {
        const source = matrixSource(frame.getAttribute('data-src'));
        if (source) {
          frame.setAttribute('src', source);
        }
      } else {
        frame.removeAttribute('src');
      }
    },
    true
  );
}

/** Rebuild a relative asset path; DOM attributes cannot select executable URLs. */
function matrixSource(source) {
  const match = /^\.\.\/\.\.\/gallery\/(en|ru)\/([a-z0-9-]+\.html)$/.exec(
    source
  );
  return match
    ? `../../gallery/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`
    : null;
}

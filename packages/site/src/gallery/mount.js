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
        frame.setAttribute('src', frame.getAttribute('data-src'));
      } else {
        frame.removeAttribute('src');
      }
    },
    true
  );
}

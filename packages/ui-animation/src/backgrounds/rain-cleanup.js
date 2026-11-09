let nextFilterId = 0;

/** Remove quantization residue. The pixel path also covers engines without SVG filters. */
export function cleanupPixels(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] <= 9) {
      image.data[i] = 0;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function alphaCleanup(canvas, ctx) {
  const doc = canvas.ownerDocument;
  let svg, filterId;
  // An SVG table makes values 0..9/255 zero without blurring the glyphs.
  if (doc.createElementNS && 'filter' in ctx) {
    svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const filter = doc.createElementNS(svg.namespaceURI, 'filter');
    const transfer = doc.createElementNS(
      svg.namespaceURI,
      'feComponentTransfer'
    );
    const alpha = doc.createElementNS(svg.namespaceURI, 'feFuncA');
    filterId = `ui-rain-${++nextFilterId}`;
    svg.setAttribute('data-ui-rain-filter', '');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText =
      'position:absolute;width:0;height:0;pointer-events:none';
    filter.id = filterId;
    alpha.setAttribute('type', 'discrete');
    alpha.setAttribute(
      'tableValues',
      Array.from({ length: 256 }, (_, i) => (i <= 9 ? 0 : i / 255)).join(' ')
    );
    transfer.append(alpha);
    filter.append(transfer);
    svg.append(filter);
    doc.body.append(svg);
  }
  let filtered = false;
  if (svg) {
    const probe = doc.createElement('canvas');
    probe.width = probe.height = 1;
    const test = probe.getContext('2d');
    test.fillStyle = 'rgba(255,255,255,0.02)';
    test.fillRect(0, 0, 1, 1);
    test.filter = `url(#${filterId})`;
    test.globalCompositeOperation = 'copy';
    test.drawImage(probe, 0, 0);
    filtered = test.getImageData(0, 0, 1, 1).data[3] === 0;
  }
  return {
    run() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      try {
        if (filtered) {
          ctx.filter = `url(#${filterId})`;
          // copy replaces the source, so erased pixels cannot accumulate underneath.
          ctx.globalCompositeOperation = 'copy';
          ctx.globalAlpha = 1;
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';
        } else {
          cleanupPixels(ctx, canvas.width, canvas.height);
        }
      } finally {
        ctx.restore();
      }
    },
    dispose() {
      svg?.remove();
    },
  };
}

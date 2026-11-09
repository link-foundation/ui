/** Extended activity features use the accessible SVG renderer in every host. */
export const supportsECharts = (spec) =>
  ['line', 'area', 'bar', 'point', 'arc'].includes(spec.mark.type) &&
  !spec.cornerRadius &&
  !spec.labels &&
  !spec.emphasis &&
  !spec.tooltip &&
  !Object.values(spec.encoding).some((def) => def.scale);

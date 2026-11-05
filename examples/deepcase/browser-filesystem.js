// Upstream's browser bundle imports its optional Node package exporter.
// Node's filesystem is unavailable here; report unsupported calls explicitly.
const unavailable = () => {
  throw new Error('Filesystem export requires Node.js');
};
export default {
  writeFileSync: unavailable,
  readdirSync: unavailable,
  readFileSync: unavailable,
};

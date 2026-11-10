import { formatLinks } from '@link-foundation/ui-core';
import { createDoubletProvider } from '../doublet.js';
import { normalize, fromOptions } from './options.js';
import { networkOptionSchema } from './schema.js';

/** Translate the editor vocabulary into the built-in renderer's nested LiNo. */
export function rendererOptions(input, count) {
  const options = normalize(input),
    records = [],
    groups = new Map();
  for (const field of networkOptionSchema) {
    if (
      ['solver', 'palette'].includes(field.section) ||
      options[field.key] === field.default
    ) {
      continue;
    }
    const [group, key] = field.key.split('.');
    const entry = { id: key ?? group, values: [String(options[field.key])] };
    if (!key) {
      records.push(entry);
    } else {
      if (!groups.has(group)) {
        const node = { id: group, values: [] };
        groups.set(group, node);
        records.push(node);
      }
      groups.get(group).values.push(entry);
    }
  }
  const gaps = ['startGap', 'endGap', 'middleBefore', 'middleAfter'];
  // These editor keys are represented by the provider's single gaps vector.
  const filtered = records.filter((entry) => !gaps.includes(entry.id));
  if (gaps.some((key) => options[key] !== normalize({})[key])) {
    filtered.push({
      id: 'gaps',
      values: gaps.map((key) => String(options[key])),
    });
  }
  for (const key of ['frame', 'order']) {
    if (options[key]) {
      filtered.push({ id: key, values: options[key].map(String) });
    }
  }
  for (let i = 0; i < count; i++) {
    const values = [];
    if (options.turns[i]) {
      values.push({ id: 'turns', values: options.turns[i].map(String) });
    }
    if (options.linkGaps[i]) {
      values.push({
        id: 'gaps',
        values: options.linkGaps[i].map((v) => (v === null ? '~' : String(v))),
      });
    }
    if (values.length) {
      filtered.push({ values: ['link', String(i + 1), ...values] });
    }
  }
  return formatLinks(filtered);
}

/** Built-in doublet provider for the editor's full persisted state vocabulary. */
export function createNetworkEditorProvider(configuration = {}) {
  const provider = createDoubletProvider(configuration);
  return {
    geometry(context) {
      const options = fromOptions(context.input.options);
      const frame = provider.geometry({
        ...context,
        input: {
          ...context.input,
          options: rendererOptions(options, context.input.items.length),
        },
      });
      return { ...frame, linkColors: options.linkColors };
    },
    svg(context) {
      let svg = provider.svg(context);
      // The built-in renderer gives every link an identified group. Its paths
      // and markers inherit currentColor, so one group attribute colors both.
      context.frame.linkColors.forEach((color, i) => {
        if (color) {
          svg = svg.replace(
            `<g data-doublet="${i + 1}">`,
            `<g data-doublet="${i + 1}" color="${color}">`
          );
        }
      });
      return svg;
    },
  };
}

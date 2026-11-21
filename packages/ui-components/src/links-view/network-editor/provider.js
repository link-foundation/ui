import { createDoubletProvider } from '../doublet.js';
import { fromOptions, toOptions } from './options.js';
import { rendererOptions } from './renderer-options.js';

export { rendererOptions } from './renderer-options.js';

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
    async solve(context) {
      const { input } = context;
      const options = fromOptions(input.options);
      const renderer = rendererOptions(options, input.items.length);
      const result = await provider.solve({
        ...context,
        input: { ...input, options: renderer },
      });
      const {
        frame,
        frame: { solution },
      } = result;
      return {
        options:
          result.options === renderer
            ? input.options
            : toOptions({
                ...options,
                turns: solution.turns,
                linkGaps: solution.linkGaps,
                frame: solution.frame,
              }),
        frame: { ...frame, linkColors: options.linkColors },
      };
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

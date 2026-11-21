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
      return provider.geometry({
        ...context,
        input: {
          ...context.input,
          options: rendererOptions(options, context.input.items.length),
        },
      });
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
        frame,
      };
    },
    svg: provider.svg,
  };
}

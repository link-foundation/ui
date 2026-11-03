// Print the nested output of importJsx / importVue for test inputs (#133).
import { importJsx, importVue } from '../../packages/ui-convert/src/index.js';

const [kind, ...inputs] = process.argv.slice(2);
const read = kind === 'vue' ? importVue : importJsx;
for (const input of inputs) {
  console.log(`=== ${input}\n${read(input).text}`);
}

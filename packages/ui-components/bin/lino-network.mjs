#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { linoToNetwork } from '../src/links-view/lino-to-network.js';
import { buildNetwork } from '../src/links-view/network-model.js';
import { NETWORK_LAYOUTS } from '../src/links-view/layouts/index.js';
import { networkToSvg } from '../src/links-view/export.js';

function argumentsFor(argv) {
  const options = { layout: 'circle' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
    if (arg === '--layout' || arg === '--out') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} needs a value`);
      }
      options[arg.slice(2)] = value;
    } else if (arg.startsWith('-') || options.input) {
      throw new Error(`Unexpected argument: ${arg}`);
    } else {
      options.input = arg;
    }
  }
  if (!options.input) {
    throw new Error('An input .lino file is required');
  }
  if (!Object.hasOwn(NETWORK_LAYOUTS, options.layout)) {
    throw new Error(`Unknown layout: ${options.layout}`);
  }
  return options;
}

try {
  const options = argumentsFor(process.argv.slice(2));
  if (options.help) {
    console.log(
      'Usage: lino-network input.lino [--layout circle|grid|hex|spiral|force|layered] [--out network.svg]'
    );
  } else {
    if ((await stat(options.input)).size > 1024 * 1024) {
      throw new Error('Input exceeds 1 MiB');
    }
    const converted = linoToNetwork(await readFile(options.input, 'utf8'));
    for (const diagnostic of converted.diagnostics) {
      console.error(
        `${diagnostic.severity}: ${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`
      );
    }
    if (converted.diagnostics.some((d) => d.severity === 'error')) {
      process.exitCode = 1;
    } else {
      const network = buildNetwork(converted.links);
      const positions = NETWORK_LAYOUTS[options.layout](network, {
        width: 960,
        height: 600,
      });
      const svg = networkToSvg(network, positions, { width: 960, height: 600 });
      if (options.out) {
        await writeFile(options.out, `${svg}\n`, 'utf8');
      } else {
        console.log(svg);
      }
    }
  }
} catch (error) {
  console.error(`lino-network: ${error.message}`);
  process.exitCode = 1;
}

#!/usr/bin/env bun

/**
 * Merge multiple changeset files into a single changeset
 *
 * Key behavior:
 * - Combines all pending changesets into a single changeset file
 * - Uses the highest version bump type (major > minor > patch)
 * - Preserves all descriptions in chronological order (by file modification time)
 * - Removes the individual changeset files after merging
 * - Does nothing if there's only one or no changesets
 * - Fails if any changeset cannot be parsed
 *
 * This script is run before `changeset version` to ensure a clean release
 * even when multiple PRs have merged before a release cycle.
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
} from 'fs';
import { join } from 'path';

import { getChangesetDir, getJsRoot, parseJsRootConfig } from './js-paths.mjs';
import {
  formatChangesetHeader,
  getChangesetVersionTypeRegex,
  readReleasePackages,
} from './package-info.mjs';
import { printUntrusted } from './github-actions-log.mjs';

// Version bump type priority (higher number = higher priority)
const BUMP_PRIORITY = {
  patch: 1,
  minor: 2,
  major: 3,
};

/**
 * Generate a random changeset file name (similar to what @changesets/cli does)
 * @returns {string}
 */
function generateChangesetName() {
  const adjectives = [
    'bright',
    'calm',
    'cool',
    'cyan',
    'dark',
    'fast',
    'gold',
    'good',
    'green',
    'happy',
    'kind',
    'loud',
    'neat',
    'nice',
    'pink',
    'proud',
    'quick',
    'red',
    'rich',
    'safe',
    'shy',
    'soft',
    'sweet',
    'tall',
    'warm',
    'wise',
    'young',
  ];
  const nouns = [
    'apple',
    'bird',
    'book',
    'car',
    'cat',
    'cloud',
    'desk',
    'dog',
    'door',
    'fish',
    'flower',
    'frog',
    'grass',
    'house',
    'key',
    'lake',
    'leaf',
    'moon',
    'mouse',
    'owl',
    'park',
    'rain',
    'river',
    'rock',
    'sea',
    'star',
    'sun',
    'tree',
    'wave',
    'wind',
  ];

  const randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${randomAdjective}-${randomNoun}`;
}

/**
 * Parse a changeset file and extract its metadata. A changeset may bump
 * several release packages; `types` maps each one it names to its bump type.
 * @param {string} filePath
 * @param {string[]} packageNames
 * @returns {{types: Record<string, string>, description: string, mtime: Date}}
 */
function parseChangeset(filePath, packageNames) {
  let content;
  let stats;

  try {
    content = readFileSync(filePath, 'utf-8');
    stats = statSync(filePath);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`, {
      cause: error,
    });
  }

  // Extract version types - support both quoted and unquoted package names
  const types = {};
  for (const packageName of packageNames) {
    const versionTypeRegex = getChangesetVersionTypeRegex(packageName, {
      requireQuotes: false,
    });
    const versionTypeMatch = content.match(versionTypeRegex);
    if (versionTypeMatch) {
      types[packageName] = versionTypeMatch[1];
    }
  }

  if (Object.keys(types).length === 0) {
    throw new Error(
      `Could not parse version type from ${filePath}. Expected a changeset header like ${formatChangesetHeader(
        packageNames[0],
        'patch'
      )} with version type major, minor, or patch.`
    );
  }

  // Extract description
  const parts = content.split('---');
  const description =
    parts.length >= 3 ? parts.slice(2).join('---').trim() : '';

  return {
    types,
    description,
    mtime: stats.mtime,
  };
}

/**
 * Get the highest priority bump type
 * @param {string[]} types
 * @returns {string}
 */
function getHighestBumpType(types) {
  let highest = 'patch';
  for (const type of types) {
    if (BUMP_PRIORITY[type] > BUMP_PRIORITY[highest]) {
      highest = type;
    }
  }
  return highest;
}

/**
 * Create a merged changeset file
 * @param {Array<[string, string]>} bumps - [packageName, bump type] pairs
 * @param {string[]} descriptions
 * @returns {string}
 */
function createMergedChangeset(bumps, descriptions) {
  const combinedDescription = descriptions.join('\n\n');
  const headers = bumps.map(([packageName, type]) =>
    formatChangesetHeader(packageName, type)
  );

  return `---
${headers.join('\n')}
---

${combinedDescription}
`;
}

function main() {
  console.log('Checking for multiple changesets to merge...');
  const jsRootConfig = parseJsRootConfig();
  const jsRoot = getJsRoot({ jsRoot: jsRootConfig, verbose: true });
  const changesetDir = getChangesetDir({ jsRoot });
  const packageNames = readReleasePackages({ jsRoot }).map((pkg) => pkg.name);
  console.log(`Packages: ${packageNames.join(', ')}`);

  // Get all changeset files
  const changesetFiles = readdirSync(changesetDir).filter(
    (file) => file.endsWith('.md') && file !== 'README.md'
  );

  console.log(`Found ${changesetFiles.length} changeset file(s)`);

  // If 0 or 1 changesets, nothing to merge
  if (changesetFiles.length <= 1) {
    console.log('No merging needed (0 or 1 changeset found)');
    return;
  }

  console.log('Multiple changesets found, merging...');
  changesetFiles.forEach((file) => console.log(`  - ${file}`));

  // Parse all changesets
  const parsedChangesets = [];
  for (const file of changesetFiles) {
    const filePath = join(changesetDir, file);
    const parsed = parseChangeset(filePath, packageNames);
    if (parsed) {
      parsedChangesets.push({
        file,
        filePath,
        ...parsed,
      });
    }
  }

  if (parsedChangesets.length === 0) {
    console.error('Error: No valid changesets could be parsed');
    process.exit(1);
  }

  // Sort by modification time (oldest first) to preserve chronological order
  parsedChangesets.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  // Determine the highest bump type of every package the changesets name
  const bumps = [];
  console.log(`\nMerge summary:`);
  for (const packageName of packageNames) {
    const bumpTypes = parsedChangesets
      .map((c) => c.types[packageName])
      .filter(Boolean);
    if (bumpTypes.length === 0) {
      continue;
    }
    const highestBumpType = getHighestBumpType(bumpTypes);
    bumps.push([packageName, highestBumpType]);
    console.log(
      `  ${packageName}: found ${[...new Set(bumpTypes)].join(', ')}, using ${highestBumpType}`
    );
  }

  // Collect descriptions in chronological order
  const descriptions = parsedChangesets
    .filter((c) => c.description)
    .map((c) => c.description);

  console.log(`  Descriptions to merge: ${descriptions.length}`);

  // Create merged changeset content
  const mergedContent = createMergedChangeset(bumps, descriptions);

  // Generate a unique name for the merged changeset
  const mergedFileName = `merged-${generateChangesetName()}.md`;
  const mergedFilePath = join(changesetDir, mergedFileName);

  // Write the merged changeset
  writeFileSync(mergedFilePath, mergedContent);
  console.log(`\nCreated merged changeset: ${mergedFileName}`);

  // Remove the original changeset files
  console.log('\nRemoving original changeset files:');
  for (const changeset of parsedChangesets) {
    unlinkSync(changeset.filePath);
    console.log(`  Removed: ${changeset.file}`);
  }

  console.log('\nChangeset merge completed successfully');
  console.log('\nMerged changeset content:');
  printUntrusted(mergedContent);
}

try {
  main();
} catch (error) {
  console.error(`::error::${error.message}`);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}

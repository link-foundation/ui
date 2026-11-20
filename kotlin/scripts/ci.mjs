import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Adapted from the template's scripts/ci.py plan command. The PR checkout is
// GitHub's tested merge, whose first parent is the exact base it merged with.
export function planKotlinChecks({
  cwd,
  projectDirectory,
  additionalPaths,
  eventName,
  beforeSha,
}) {
  if (!['pull_request', 'push', 'merge_group'].includes(eventName)) {
    return true;
  }

  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const base = eventName === 'pull_request' ? 'HEAD^1' : beforeSha;
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch (error) {
    if (error.status !== 1) {
      throw error;
    }
    console.log('No comparable base commit. Running Kotlin checks.');
    return true;
  }

  const watchedPaths = [projectDirectory, ...additionalPaths.split('\n')]
    .map((path) => path.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  // --no-renames classifies both sides so moving a fixture out of scope
  // still runs the tests that used it.
  const changes = git(
    'diff',
    '--no-renames',
    '--name-only',
    '-z',
    base,
    'HEAD'
  );
  return changes
    .split('\0')
    .some((path) =>
      watchedPaths.some(
        (watched) =>
          watched === '.' || path === watched || path.startsWith(`${watched}/`)
      )
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const shouldRun = planKotlinChecks({
    projectDirectory: process.env.PROJECT_DIRECTORY,
    additionalPaths: process.env.ADDITIONAL_PATHS,
    eventName: process.env.EVENT_NAME,
    beforeSha: process.env.BEFORE_SHA,
  });
  console.log(
    shouldRun
      ? 'Kotlin checks selected.'
      : 'No Kotlin inputs changed. Skipping Gradle.'
  );
  appendFileSync(process.env.GITHUB_OUTPUT, `kotlin=${shouldRun}\n`);
}

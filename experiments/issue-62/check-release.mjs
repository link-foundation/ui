// Exercise release versioning without modifying the working tree.
import { cp, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const root = process.cwd();
const copy = await mkdtemp(path.join(tmpdir(), 'ui-62-release-'));
try {
  for (const name of ['package.json', 'package-lock.json', '.changeset']) {
    await cp(path.join(root, name), path.join(copy, name), { recursive: true });
  }
  for (const entry of await readdir(path.join(root, 'packages'), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dir = path.join('packages', entry.name);
    if (!existsSync(path.join(root, dir, 'package.json'))) {
      continue;
    }
    await mkdir(path.join(copy, dir), { recursive: true });
    await cp(
      path.join(root, dir, 'package.json'),
      path.join(copy, dir, 'package.json')
    );
  }
  for (const name of ['node_modules', 'scripts']) {
    await symlink(path.join(root, name), path.join(copy, name), 'dir');
  }
  execFileSync('npm', ['run', 'changeset:version'], {
    cwd: copy,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_offline: 'true',
      npm_config_ignore_scripts: 'true',
    },
  });
} finally {
  await rm(copy, { recursive: true, force: true });
}

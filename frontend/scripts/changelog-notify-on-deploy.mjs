#!/usr/bin/env node
/**
 * Auto-notify on Vercel production build / CI — only if changelog.json changed in this commit.
 * Manual: npm run changelog:notify (always posts).
 */
import { execSync, spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = 'src/data/changelog.json';

function exitLater(code) {
  setTimeout(() => process.exit(code), 50);
}

function fileInOutput(out) {
  return out.split(/\r?\n/).some((line) => line.replace(/\\/g, '/').endsWith(CHANGELOG));
}

function changelogChangedInCommit() {
  if (process.env.FORCE_CHANGELOG_NOTIFY === '1') return true;

  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const prev = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();

  const commands = [];
  if (sha && prev) {
    commands.push(`git diff --name-only ${prev} ${sha} -- ${CHANGELOG}`);
  }
  commands.push(`git diff --name-only HEAD^ HEAD -- ${CHANGELOG}`);
  // Vercel shallow clone (depth=1): files in current commit only
  commands.push(`git diff-tree --no-commit-id --name-only -r HEAD -- ${CHANGELOG}`);
  if (sha) {
    commands.push(`git diff-tree --no-commit-id --name-only -r ${sha} -- ${CHANGELOG}`);
  }

  for (const cmd of commands) {
    try {
      const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (fileInOutput(out)) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

function main() {
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'production') {
    console.log(`Пропуск Discord: Vercel env=${process.env.VERCEL_ENV || '?'} (нужен production).`);
    exitLater(0);
    return;
  }

  if (!changelogChangedInCommit()) {
    console.log(
      'Пропуск Discord: в этом коммите не менялся src/data/changelog.json.\n' +
        'Обновите changelog и push в main — пост уйдёт при production deploy.\n' +
        'Принудительно: FORCE_CHANGELOG_NOTIFY=1 npm run changelog:notify'
    );
    exitLater(0);
    return;
  }

  const r = spawnSync(process.execPath, [join(root, 'scripts', 'notify-changelog.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  exitLater(r.status ?? 1);
}

main();

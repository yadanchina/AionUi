#!/usr/bin/env node
/**
 * Package the bundled Vosk model directory into a tar.gz archive
 * so the web server can serve it to vosk-browser clients.
 *
 * Usage: node scripts/voice/package-model.js
 *
 * Input:  resources/vosk-model/          (directory, already in repo)
 * Output: resources/vosk-model.tar.gz    (archive served by web server)
 *
 * The `tar` command is available on macOS, Linux, and Windows 10 1803+.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const projectRoot = resolve(__dirname, '../..');
const modelDir = join(projectRoot, 'resources', 'vosk-model');
const outputFile = join(projectRoot, 'resources', 'vosk-model.tar.gz');

if (!existsSync(modelDir)) {
  console.error(`[package-model] Model directory not found: ${modelDir}`);
  process.exit(1);
}

console.log(`[package-model] Packaging ${modelDir} → ${outputFile}`);

// Pack with 'model/' prefix directory (vosk-browser expects model/am/, model/conf/, etc.)
// Use relative path as source to avoid ./ prefix in archive
const result = spawnSync(
  'tar',
  ['-czf', '../vosk-model.tar.gz', '--transform', 's,^vosk-model-small-cn-0.22,model,', 'vosk-model-small-cn-0.22'],
  {
    cwd: join(projectRoot, 'resources', 'vosk-model'),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

if (result.error) {
  console.error('[package-model] Failed to run tar:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[package-model] tar exited with status ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log('[package-model] Done.');

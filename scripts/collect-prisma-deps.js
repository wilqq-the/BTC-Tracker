#!/usr/bin/env node
/**
 * Collects all transitive runtime dependencies of the prisma CLI
 * by recursively reading each package's package.json dependencies field.
 *
 * Used in the Docker build (prisma-runtime stage) so the Dockerfile
 * needs no manually maintained dependency list. When prisma is upgraded,
 * this script automatically picks up any new transitive deps.
 *
 * Usage: node scripts/collect-prisma-deps.js <src-node-modules> <dest-dir>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const src = process.argv[2] || '/app/node_modules';
const dst = process.argv[3] || '/prisma-runtime/node_modules';

const seen = new Set();

function collect(name) {
  if (seen.has(name)) return;
  seen.add(name);
  try {
    const pkgPath = path.join(src, name, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    Object.keys(pkg.dependencies || {}).forEach(collect);
  } catch (_) {}
}

collect('prisma');

for (const name of seen) {
  const to = path.join(dst, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  execSync(
    'cp -r ' +
      JSON.stringify(path.join(src, name)) +
      ' ' +
      JSON.stringify(path.dirname(to))
  );
}

console.log('prisma-runtime: ' + seen.size + ' packages collected');

#!/usr/bin/env node
/**
 * Collects all transitive runtime dependencies of the prisma CLI.
 * Cross-platform (works on Windows and Unix).
 *
 * Usage: node scripts/collect-prisma-deps.js <src-node-modules> <dest-dir>
 */

const fs = require('fs');
const path = require('path');

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
  const from = path.join(src, name);
  const to = path.join(dst, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

console.log('prisma-runtime: ' + seen.size + ' packages collected');

import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// Never inspect repository internals, supplied inputs, secrets, or scratch files.
const excluded = new Set(['.git', '.github', '.imd', '.agents', '.codex', 'node_modules', '.vite', '.cache', '.playwright-mcp', 'coverage', 'playwright-report', 'test-results']);
const files = [];
async function walk(directory = '.') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (excluded.has(entry.name) || entry.name.startsWith('.env') || path === 'test/scratch') continue;
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${path}`);
    if (entry.isDirectory()) await walk(path);
    else files.push({ path, bytes: (await stat(path)).size });
  }
}
await walk();
const budget = JSON.parse(await readFile('artifacts/submission-budget.json', 'utf8'));
const categories = Object.fromEntries(Object.keys(budget.pathBudgets).map(k => [k, 0]));
for (const file of files) {
  const category = file.path === '.gitignore' ? '.gitignore' : file.path.startsWith('test/') ? 'test/ (excluding scratch)' : ['src/', 'public/', 'dist/', 'scripts/', 'artifacts/'].find(prefix => file.path.startsWith(prefix)) || 'root configuration, lockfile and documentation';
  categories[category] += file.bytes;
  assert.ok(!/\.(tgz|zip|deb|rpm|tar|gz)$/.test(file.path), `Unnecessary archive: ${file.path}`);
}
for (const [path, bytes] of Object.entries(categories)) assert.ok(bytes <= budget.pathBudgets[path], `${path}: ${bytes} bytes exceeds path budget ${budget.pathBudgets[path]}`);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
assert.ok(totalBytes < budget.maximumBytes, `Bundle ${totalBytes} exceeds ${budget.maximumBytes}`);
for (const path of ['dist/index.html', 'dist/favicon.svg', 'dist/share.png', 'README.md', 'DESIGN.md', 'package-lock.json']) assert.ok(files.some(f => f.path === path), `Required deliverable missing: ${path}`);
const html = await readFile('dist/index.html', 'utf8');
assert.ok(!/(?:src|href)="\/[^/]/.test(html), 'Export contains root-relative assets');
assert.match(html, /<title>Squeek Pouch<\/title>/);
console.log(JSON.stringify({ totalBytes, maximumBytes: budget.maximumBytes, fileCount: files.length, categories, requiredExport: 'present; relative assets verified' }, null, 2));

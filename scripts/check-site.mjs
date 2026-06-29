import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const conflictMarker = /^(<<<<<<<|=======|>>>>>>>)($|\s)/;

async function walk(dir, extensions) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, extensions));
    if (entry.isFile() && extensions.includes(path.extname(entry.name))) files.push(full);
  }
  return files;
}

async function assertNoConflictMarkers(files) {
  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const lineIndex = lines.findIndex((line) => conflictMarker.test(line));
    if (lineIndex !== -1) {
      throw new Error(`Unresolved merge conflict marker in ${file}:${lineIndex + 1}`);
    }
  }
}

await assertNoConflictMarkers(await walk('content', ['.md']));

const required = [
  'dist/index.html',
  'dist/style.css',
  'dist/app.js',
  'dist/notes.json',
  'dist/20-architecture/publishing-architecture.html'
];

for (const file of required) {
  await access(file);
}

const index = await readFile('dist/index.html', 'utf8');
for (const text of ['PUNNARAJ MUD', 'Browser Workspace', 'Project Charter']) {
  if (!index.includes(text)) throw new Error(`Missing expected text: ${text}`);
}

const notes = JSON.parse(await readFile('dist/notes.json', 'utf8'));
if (notes.length < 5) throw new Error('Expected at least 5 generated notes.');

await assertNoConflictMarkers(await walk('dist', ['.html']));

for (const note of notes) {
  const file = path.join('dist', note.url);
  const html = await readFile(file, 'utf8');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const target = path.normalize(path.join(path.dirname(file), href.split('#')[0]));
    await access(target);
  }
}

console.log(`Site check passed with ${notes.length} generated notes.`);

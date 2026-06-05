import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

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

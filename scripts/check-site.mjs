import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const conflictMarker = /^(<<<<<<<|=======|>>>>>>>)($|\s)/;
const classifications = new Map([
  ['public', 'P0'],
  ['developer', 'P1']
]);

async function walk(dir, extensions = null) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '.git') files.push(...await walk(full, extensions));
    if (entry.isFile() && (!extensions || extensions.includes(path.extname(entry.name)))) files.push(full);
  }
  return files;
}

async function assertNoConflictMarkers(files) {
  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const lineIndex = lines.findIndex((line) => conflictMarker.test(line));
    if (lineIndex !== -1) throw new Error(`Unresolved merge conflict marker in ${file}:${lineIndex + 1}`);
  }
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return {};
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return {};
  const data = {};
  for (const line of raw.slice(4, end).trim().split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) data[key.trim()] = rest.join(':').trim();
  }
  return data;
}

async function assertSourceClassification() {
  const files = await walk('content', ['.md']);
  for (const file of files) {
    const frontmatter = parseFrontmatter(await readFile(file, 'utf8'));
    if (!classifications.has(frontmatter.audience)) throw new Error(`Invalid audience in ${file}`);
    if (frontmatter.sensitivity !== classifications.get(frontmatter.audience)) throw new Error(`Invalid sensitivity in ${file}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.reviewed || '')) throw new Error(`Invalid reviewed date in ${file}`);
  }
}

async function assertNoTransientFiles() {
  const files = await walk('.');
  const rejected = files.filter((file) => /(^|\/)\._|(^|\/)\.DS_Store$|\.part$/.test(file));
  if (rejected.length) throw new Error(`Transient files present: ${rejected.join(', ')}`);
}

async function assertLinks(distDir) {
  const htmlFiles = await walk(distDir, ['.html']);
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    if (html.includes('href="#missing-')) throw new Error(`Unresolved wiki link in ${file}`);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    for (const href of hrefs) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const clean = href.split('#')[0].split('?')[0];
      if (!clean) continue;
      await access(path.normalize(path.join(path.dirname(file), clean)));
    }
  }
}

async function checkSurface(surface, expectedAudience) {
  const distDir = `dist-${surface}`;
  const required = [
    `${distDir}/index.html`,
    `${distDir}/style.css`,
    `${distDir}/app.js`,
    `${distDir}/notes.json`,
    `${distDir}/release.json`,
    `${distDir}/robots.txt`,
    `${distDir}/10-mud/project-charter.html`,
    `${distDir}/80-status/alpha-status.html`
  ];
  for (const file of required) await access(file);

  const index = await readFile(`${distDir}/index.html`, 'utf8');
  for (const text of [
    'A recovery-first project for keeping knowledge usable over time.',
    'One reviewed source, two public surfaces.',
    'Alpha now. Beta after evidence.',
    'What is verified today',
    'What is not proven yet'
  ]) {
    if (!index.includes(text)) throw new Error(`Missing ${surface} homepage text: ${text}`);
  }

  const notes = JSON.parse(await readFile(`${distDir}/notes.json`, 'utf8'));
  if (!notes.length) throw new Error(`No notes generated for ${surface}`);
  for (const note of notes) {
    if (!expectedAudience.includes(note.audience)) throw new Error(`${surface} contains disallowed audience: ${note.title}`);
    if (note.sensitivity !== classifications.get(note.audience)) throw new Error(`${surface} contains invalid classification: ${note.title}`);
  }

  if (surface === 'public') {
    if (index.includes('Local draft workspace') || index.includes('Developer record</h2>')) throw new Error('Public surface exposes developer workspace');
    if (notes.some((note) => note.audience === 'developer')) throw new Error('Public surface contains developer notes');
  } else {
    if (!index.includes('Developer record</h2>')) throw new Error('Developer record is missing');
    const workspace = await readFile(`${distDir}/20-architecture/publication-phases.html`, 'utf8');
    if (!workspace.includes('Local draft workspace')) throw new Error('Developer local workspace is missing');
  }

  const release = JSON.parse(await readFile(`${distDir}/release.json`, 'utf8'));
  if (release.surface !== surface || release.phase !== 'alpha' || !/^[0-9a-f]{40}$/.test(release.sourceCommit)) {
    throw new Error(`Invalid ${surface} release metadata`);
  }
  await assertLinks(distDir);
  await assertNoConflictMarkers(await walk(distDir, ['.html']));
  console.log(`${surface} surface passed with ${notes.length} classified notes.`);
}

await assertNoConflictMarkers(await walk('content', ['.md']));
await assertSourceClassification();
await assertNoTransientFiles();
await checkSurface('public', ['public']);
await checkSurface('developer', ['public', 'developer']);
console.log('Publication checks passed.');

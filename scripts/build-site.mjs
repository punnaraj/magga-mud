import { mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
const watch = process.argv.includes('--watch');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return [{}, raw];
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return [{}, raw];
  const block = raw.slice(4, end).trim();
  const body = raw.slice(end + 5).replace(/^\n/, '');
  const data = {};
  for (const line of block.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    const rawValue = rest.join(':').trim();
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      data[key.trim()] = rawValue.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean);
    } else {
      data[key.trim()] = rawValue;
    }
  }
  return [data, body];
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

function inlineMarkdown(text, notesByLookup, depth = '') {
  let value = escapeHtml(text);
  value = value.replace(/`([^`]+)`/g, '<code>$1</code>');
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  value = value.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => wikiLink(target, label, notesByLookup, depth));
  value = value.replace(/\[\[([^\]]+)\]\]/g, (_, target) => wikiLink(target, target.split('/').pop(), notesByLookup, depth));
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return value;
}

function wikiLink(target, label, notesByLookup, depth) {
  const normalized = slugify(target.replace(/^\.\.?\//, ''));
  const found = notesByLookup.get(normalized) || notesByLookup.get(normalized.split('/').pop());
  const href = found ? `${depth}${found.url}` : `#missing-${slugify(target)}`;
  const missing = found ? '' : ' class="missing"';
  return `<a${missing} href="${href}">${escapeHtml(label)}</a>`;
}

function renderMarkdown(markdown, notesByLookup, depth = '') {
  const lines = markdown.split('\n');
  const html = [];
  let listOpen = false;
  let table = [];
  let codeFence = null;
  const flushList = () => { if (listOpen) { html.push('</ul>'); listOpen = false; } };
  const flushTable = () => {
    if (table.length < 2) { table = []; return; }
    const headers = table[0].split('|').slice(1, -1).map((cell) => cell.trim());
    const rows = table.slice(2).map((row) => row.split('|').slice(1, -1).map((cell) => cell.trim()));
    html.push('<table><thead><tr>' + headers.map((h) => `<th>${inlineMarkdown(h, notesByLookup, depth)}</th>`).join('') + '</tr></thead><tbody>');
    for (const row of rows) html.push('<tr>' + row.map((cell) => `<td>${inlineMarkdown(cell, notesByLookup, depth)}</td>`).join('') + '</tr>');
    html.push('</tbody></table>');
    table = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushList(); flushTable();
      if (codeFence) {
        if (codeFence.lang === 'mermaid') html.push(`<pre class="mermaid">${escapeHtml(codeFence.body.join('\n'))}</pre>`);
        else html.push(`<pre><code>${escapeHtml(codeFence.body.join('\n'))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence = { lang: line.slice(3).trim(), body: [] };
      }
      continue;
    }
    if (codeFence) { codeFence.body.push(line); continue; }
    if (line.includes('|') && /^\s*\|/.test(line)) { flushList(); table.push(line); continue; }
    else flushTable();
    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#{1,6}\s/, '');
      const id = slugify(text);
      html.push(`<h${level} id="${id}">${inlineMarkdown(text, notesByLookup, depth)}</h${level}>`);
    } else if (/^-\s+/.test(line)) {
      if (!listOpen) { html.push('<ul>'); listOpen = true; }
      html.push(`<li>${inlineMarkdown(line.replace(/^-\s+/, ''), notesByLookup, depth)}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (!listOpen) { html.push('<ul>'); listOpen = true; }
      html.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ''), notesByLookup, depth)}</li>`);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      html.push(`<p>${inlineMarkdown(line, notesByLookup, depth)}</p>`);
    }
  }
  flushList(); flushTable();
  return html.join('\n');
}

async function copyStatic() {
  await mkdir(distDir, { recursive: true });
  for (const file of ['style.css', 'app.js']) {
    await copyFile(path.join(srcDir, file), path.join(distDir, file));
  }
}

function pageTemplate(note, allNotes, body) {
  const nav = allNotes.map((item) => `<a href="${note.depth}${item.url}" data-title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</a>`).join('');
  const tags = (note.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(note.title)} · PUNNARAJ MUD</title>
  <meta name="description" content="${escapeHtml(note.summary || 'PUNNARAJ Mutual Understanding Document')}">
  <link rel="stylesheet" href="${note.depth}style.css">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="${note.depth}index.html">PUNNARAJ MUD</a>
    <button class="menu-button" data-menu-toggle>Menu</button>
  </header>
  <div class="layout">
    <aside class="sidebar" data-sidebar>
      <label class="search-label">Search vault<input data-search placeholder="Search notes"></label>
      <nav>${nav}</nav>
    </aside>
    <main>
      <article class="note">
        <p class="eyebrow">${escapeHtml(note.status || 'note')}</p>
        <h1>${escapeHtml(note.title)}</h1>
        ${note.summary ? `<p class="summary">${escapeHtml(note.summary)}</p>` : ''}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        ${body}
      </article>
      <section class="workspace" id="workspace">
        <h2>Browser Workspace</h2>
        <p>Create, update, import, delete, and export local Markdown drafts. Drafts stay in this browser until exported and committed.</p>
        <div class="workspace-grid">
          <div>
            <input data-draft-title placeholder="Draft title">
            <textarea data-draft-body placeholder="# New note\n\nWrite Markdown here."></textarea>
            <div class="button-row">
              <button data-save-draft>Save draft</button>
              <button data-export-draft>Export .md</button>
              <label class="file-button">Import .md<input type="file" accept=".md,text/markdown,text/plain" data-import-draft></label>
            </div>
          </div>
          <div>
            <h3>Local drafts</h3>
            <ul data-draft-list></ul>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script type="application/json" id="site-data">${JSON.stringify(allNotes.map(({ title, url, summary, tags }) => ({ title, url, summary, tags })))}</script>
  <script src="${note.depth}app.js"></script>
</body>
</html>`;
}

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  const files = await walk(contentDir);
  const notes = [];
  for (const file of files) {
    const rel = path.relative(contentDir, file);
    const raw = await readFile(file, 'utf8');
    const [frontmatter, body] = parseFrontmatter(raw);
    const slug = slugify(rel).replace(/\/index$/, 'index');
    const outRel = rel.replace(/\.md$/, '.html');
    const depth = outRel.split(path.sep).length === 1 ? '' : '../'.repeat(outRel.split(path.sep).length - 1);
    const title = frontmatter.title || path.basename(rel, '.md').replace(/[-_]/g, ' ');
    notes.push({ file, rel, slug, outRel, url: outRel.split(path.sep).join('/'), depth, title, body, ...frontmatter });
  }
  notes.sort((a, b) => a.url.localeCompare(b.url));
  const lookup = new Map();
  for (const note of notes) {
    lookup.set(note.slug, note);
    lookup.set(path.basename(note.slug), note);
    lookup.set(slugify(note.title), note);
  }
  for (const note of notes) {
    const outFile = path.join(distDir, note.outRel);
    await mkdir(path.dirname(outFile), { recursive: true });
    const body = renderMarkdown(note.body, lookup, note.depth);
    await writeFile(outFile, pageTemplate(note, notes, body));
  }
  await copyStatic();
  await writeFile(path.join(distDir, 'notes.json'), JSON.stringify(notes.map(({ title, url, summary, tags, status }) => ({ title, url, summary, tags, status })), null, 2));
  await writeFile(path.join(distDir, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
  console.log(`Built ${notes.length} notes into dist/`);
}

await build();

if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  console.log('Watching content/ and src/ for changes...');
  for (const dir of [contentDir, srcDir]) {
    fsWatch(dir, { recursive: true }, async () => {
      try { await build(); } catch (error) { console.error(error); }
    });
  }
  setInterval(() => {}, 1000);
}

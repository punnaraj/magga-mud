import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const srcDir = path.join(root, 'src');
const surface = process.env.PUBLICATION_SURFACE || 'developer';
const allowedSurfaces = new Set(['public', 'developer']);

if (!allowedSurfaces.has(surface)) {
  throw new Error(`Unsupported PUBLICATION_SURFACE: ${surface}`);
}

const distDir = path.join(root, `dist-${surface}`);
const watch = process.argv.includes('--watch');

function commandOutput(command, args, fallback) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value = '') {
  return String(value)
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

function validateClassification(file, frontmatter) {
  const expectedSensitivity = frontmatter.audience === 'public' ? 'P0' : 'P1';
  if (!['public', 'developer'].includes(frontmatter.audience)) {
    throw new Error(`Missing or invalid audience in ${file}`);
  }
  if (frontmatter.sensitivity !== expectedSensitivity) {
    throw new Error(`Invalid sensitivity for ${frontmatter.audience} note in ${file}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.reviewed || '')) {
    throw new Error(`Missing or invalid reviewed date in ${file}`);
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '.obsidian') files.push(...await walk(full));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

function wikiLink(target, label, notesByLookup, depth) {
  const normalized = slugify(target.replace(/^\.\.?\//, ''));
  const found = notesByLookup.get(normalized) || notesByLookup.get(normalized.split('/').pop());
  const href = found ? `${depth}${found.url}` : `#missing-${slugify(target)}`;
  const missing = found ? '' : ' class="missing"';
  return `<a${missing} href="${href}">${escapeHtml(label)}</a>`;
}

function inlineMarkdown(text, notesByLookup, depth = '') {
  const codeSpans = [];
  let value = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(`<code>${code}</code>`);
    return token;
  });
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  value = value.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => wikiLink(target, label, notesByLookup, depth));
  value = value.replace(/\[\[([^\]]+)\]\]/g, (_, target) => wikiLink(target, target.split('/').pop(), notesByLookup, depth));
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  codeSpans.forEach((span, index) => { value = value.replace(`\u0000CODE${index}\u0000`, span); });
  return value;
}

function renderMarkdown(markdown, notesByLookup, depth = '') {
  const lines = markdown.split('\n');
  const html = [];
  let listType = null;
  let table = [];
  let codeFence = null;
  const flushList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };
  const openList = (type) => {
    if (listType === type) return;
    flushList();
    listType = type;
    html.push(`<${type}>`);
  };
  const flushTable = () => {
    if (table.length < 2) { table = []; return; }
    const headers = table[0].split('|').slice(1, -1).map((cell) => cell.trim());
    const rows = table.slice(2).map((row) => row.split('|').slice(1, -1).map((cell) => cell.trim()));
    html.push('<div class="table-wrap"><table><thead><tr>' + headers.map((header) => `<th>${inlineMarkdown(header, notesByLookup, depth)}</th>`).join('') + '</tr></thead><tbody>');
    for (const row of rows) html.push('<tr>' + row.map((cell) => `<td>${inlineMarkdown(cell, notesByLookup, depth)}</td>`).join('') + '</tr>');
    html.push('</tbody></table></div>');
    table = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushList(); flushTable();
      if (codeFence) {
        const className = codeFence.lang === 'mermaid' ? ' class="mermaid"' : '';
        html.push(`<pre${className}><code>${escapeHtml(codeFence.body.join('\n'))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence = { lang: line.slice(3).trim(), body: [] };
      }
      continue;
    }
    if (codeFence) { codeFence.body.push(line); continue; }
    if (line.includes('|') && /^\s*\|/.test(line)) { flushList(); table.push(line); continue; }
    flushTable();
    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#{1,6}\s/, '');
      html.push(`<h${level} id="${slugify(text)}">${inlineMarkdown(text, notesByLookup, depth)}</h${level}>`);
    } else if (/^-\s+/.test(line)) {
      openList('ul');
      html.push(`<li>${inlineMarkdown(line.replace(/^-\s+/, ''), notesByLookup, depth)}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      openList('ol');
      html.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ''), notesByLookup, depth)}</li>`);
    } else if (/^>\s?/.test(line)) {
      flushList();
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''), notesByLookup, depth)}</blockquote>`);
    } else if (/^---+$/.test(line.trim())) {
      flushList();
      html.push('<hr>');
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

function arrowIcon() {
  return '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6"/></svg>';
}

function checkIcon() {
  return '<svg class="status-icon" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 15l6 6L24 6"/></svg>';
}

function warningIcon() {
  return '<svg class="status-icon" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 3L26 25H2L14 3z"/><path d="M14 10v7M14 21h.01"/></svg>';
}

function flowIcon(type) {
  const paths = {
    human: '<circle cx="24" cy="14" r="7"/><path d="M10 42c1-10 6-15 14-15s13 5 14 15H10z"/>',
    document: '<path d="M13 5h18l7 7v31H13z"/><path d="M31 5v9h8"/><path d="M18 28l4 4 9-11"/>',
    verify: '<circle cx="21" cy="21" r="12"/><path d="M30 30l11 11"/><path d="M15 21l4 4 8-9"/>',
    book: '<path d="M5 9h15c5 0 7 3 7 7v27c0-4-3-6-7-6H5z"/><path d="M43 9H28c-5 0-7 3-7 7v27c0-4 3-6 7-6h15z"/>',
    recovery: '<rect x="7" y="9" width="34" height="31" rx="2"/><path d="M7 17h34"/><path d="M29 25a8 8 0 1 0 2 8"/><path d="M31 24v9h-9"/>',
    code: '<path d="M13 5h18l7 7v31H13z"/><path d="M31 5v9h8"/><path d="M21 23l-5 5 5 5M30 23l5 5-5 5"/>',
    shield: '<path d="M24 4l16 6v12c0 10-6 17-16 22C14 39 8 32 8 22V10z"/><path d="M16 24l6 6 11-13"/>',
    browser: '<rect x="5" y="8" width="38" height="32" rx="2"/><path d="M5 16h38"/><path d="M10 12h.01M15 12h.01M20 12h.01"/>',
    manifest: '<path d="M13 5h18l7 7v31H13z"/><path d="M31 5v9h8"/><path d="M19 23h13M19 29h13M19 35h9"/>',
    bucket: '<ellipse cx="24" cy="11" rx="15" ry="6"/><path d="M9 11l3 28c0 4 24 4 24 0l3-28"/><path d="M12 32c8 4 16 4 24 0"/>',
    lock: '<rect x="9" y="20" width="30" height="23" rx="2"/><path d="M15 20v-6a9 9 0 0 1 18 0v6"/><path d="M24 29v6"/>'
  };
  return `<svg class="flow-symbol" viewBox="0 0 48 48" aria-hidden="true">${paths[type]}</svg>`;
}

function siteHeader(data, prefix = '', developerHref = 'https://punnaraj.github.io/magga-mud/') {
  const nav = data.navigation.map((item) => `<a href="${prefix}index.html${item.href}">${escapeHtml(item.label)}</a>`).join('');
  return `<header class="site-header">
    <a class="site-wordmark" href="${prefix}index.html">PUNNARAJ</a>
    <nav class="site-nav" aria-label="Primary navigation">${nav}</nav>
    <a class="developer-link" href="${developerHref}">Developer record</a>
  </header>`;
}

function renderPublicHome(data, allNotes) {
  const developerHref = surface === 'developer' ? '#developer-record' : data.hero.secondaryLink.href;
  const continuityIcons = ['human', 'document', 'verify', 'book', 'recovery'];
  const continuity = data.hero.steps.map((step, index) => `<li>
    <span class="continuity-icon">${flowIcon(continuityIcons[index])}<span class="visually-hidden">Step ${escapeHtml(step.number)}</span></span>
    <strong>${escapeHtml(step.title)}</strong>
    <span>${escapeHtml(step.detail)}</span>
    ${index < data.hero.steps.length - 1 ? arrowIcon() : ''}
  </li>`).join('');
  const reasons = data.why.map((reason, index) => `<article>
    <h3><span>${index + 1}.</span> ${escapeHtml(reason.title)}</h3>
    <p>${escapeHtml(reason.body)}</p>
  </article>`).join('');
  const sourceIcons = ['human', 'code', 'shield'];
  const sourceRail = data.architecture.sourceSteps.map((step, index) => `<li><span class="source-icon">${flowIcon(sourceIcons[index])}</span><strong>${escapeHtml(step)}</strong>${index < data.architecture.sourceSteps.length - 1 ? arrowIcon() : ''}</li>`).join('');
  const surfaces = data.architecture.surfaces.map((item) => `<li>${flowIcon('browser')}<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.role)}</small></span></li>`).join('');
  const alphaItems = data.phases.alpha.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const betaItems = data.phases.beta.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const timeline = data.phases.timeline.map((item) => `<li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.detail)}</span></li>`).join('');
  const verified = data.evidence.verified.map((item) => `<li>${checkIcon()}<span>${escapeHtml(item)}</span></li>`).join('');
  const limits = data.evidence.limits.map((item) => `<li>${warningIcon()}<span>${escapeHtml(item)}</span></li>`).join('');
  const links = data.links.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('');
  const developerRecord = surface === 'developer' ? `<section class="developer-record" id="developer-record">
    <div class="section-heading"><h2>Developer record</h2><p>This surface includes every classified P0 and P1 note in the current public-safe source.</p></div>
    <ol class="developer-note-list">${allNotes.map((note) => `<li><a href="${note.url}"><strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.summary || note.status || '')}</span></a></li>`).join('')}</ol>
  </section>` : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PUNNARAJ · Public Alpha</title>
  <meta name="description" content="${escapeHtml(data.hero.summary)}">
  ${surface === 'developer' ? '<meta name="robots" content="noindex, nofollow">' : ''}
  <link rel="stylesheet" href="style.css">
</head>
<body class="surface-${surface}">
  ${siteHeader(data, '', developerHref)}
  <main class="public-home">
    <section class="hero-section" id="purpose">
      <div class="hero-copy">
        <h1>${escapeHtml(data.hero.heading)}</h1>
        <p>${escapeHtml(data.hero.summary)}</p>
        <div class="hero-links">
          <a href="${escapeHtml(data.hero.primaryLink.href)}">${escapeHtml(data.hero.primaryLink.label)} ${arrowIcon()}</a>
          <a class="secondary" href="${developerHref}">${escapeHtml(data.hero.secondaryLink.label)} ${arrowIcon()}</a>
        </div>
      </div>
      <ol class="continuity-rail" aria-label="PUNNARAJ continuity model">${continuity}</ol>
    </section>

    <section class="why-section" id="why">
      <h2>Why this exists</h2>
      <div class="reason-grid">${reasons}</div>
    </section>

    <section class="architecture-section" id="architecture">
      <div class="section-heading">
        <h2>${escapeHtml(data.architecture.heading)}</h2>
        <p>${escapeHtml(data.architecture.summary)}</p>
      </div>
      <div class="publication-flow">
        <ol class="source-rail">${sourceRail}</ol>
        <div class="flow-fork" aria-hidden="true"></div>
        <ul class="surface-list">${surfaces}</ul>
      </div>
      <div class="artifact-rail"><span>${flowIcon('manifest')}<strong>${escapeHtml(data.architecture.artifactFlow[0])}</strong></span>${arrowIcon()}<span>${flowIcon('bucket')}<strong>${escapeHtml(data.architecture.artifactFlow[1])}</strong></span></div>
      <div class="private-boundary">
        <strong>${flowIcon('lock')}${escapeHtml(data.architecture.privateBoundary)}</strong>
        <span>${escapeHtml(data.architecture.privateDetail)}</span>
        <p>${escapeHtml(data.architecture.databaseDecision)}</p>
      </div>
    </section>

    <section class="phase-section" id="phases">
      <h2>${escapeHtml(data.phases.heading)}</h2>
      <div class="phase-columns">
        <article><h3>Public alpha</h3><ul>${alphaItems}</ul></article>
        <article><h3>Beta entry gates</h3><ul>${betaItems}</ul></article>
      </div>
      <ol class="phase-line">${timeline}</ol>
    </section>

    <section class="evidence-section" id="evidence">
      <div class="evidence-columns">
        <article class="verified-list"><h2>${escapeHtml(data.evidence.heading)}</h2><p>${escapeHtml(data.evidence.observed)}</p><ul>${verified}</ul></article>
        <article class="limit-list"><h2>${escapeHtml(data.evidence.limitsHeading)}</h2><ul>${limits}</ul></article>
      </div>
      <nav class="evidence-links" aria-label="Evidence links">${links}</nav>
      <p class="disclaimer">${escapeHtml(data.disclaimer)}</p>
    </section>

    ${developerRecord}
  </main>
  <script type="application/json" id="site-data">${JSON.stringify(allNotes.map(({ title, url, summary, tags }) => ({ title, url, summary, tags })))}</script>
  <script src="app.js"></script>
</body>
</html>`;
}

function noteTemplate(note, allNotes, body, homeData) {
  const nav = allNotes.map((item) => `<a href="${note.depth}${item.url}" data-title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</a>`).join('');
  const tags = (note.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  const workspace = surface === 'developer' ? `<section class="workspace" id="workspace">
    <h2>Local draft workspace</h2>
    <p>Create or import a Markdown draft in this browser. Drafts stay local until exported and reviewed.</p>
    <div class="workspace-grid">
      <div>
        <input data-draft-title aria-label="Draft title" placeholder="Draft title">
        <textarea data-draft-body aria-label="Draft Markdown" placeholder="# New note\n\nWrite Markdown here."></textarea>
        <div class="button-row">
          <button data-save-draft>Save draft</button>
          <button data-export-draft>Export .md</button>
          <label class="file-button">Import .md<input type="file" accept=".md,text/markdown,text/plain" data-import-draft></label>
        </div>
      </div>
      <div><h3>Local drafts</h3><ul data-draft-list></ul></div>
    </div>
  </section>` : '';
  const shell = surface === 'developer' ? `<div class="note-layout">
    <aside class="sidebar" data-sidebar><label class="search-label">Search notes<input data-search placeholder="Search notes"></label><nav>${nav}</nav></aside>
    <main class="note-main">${renderNote()}${workspace}</main>
  </div>` : `<main class="note-main public-note-main">${renderNote()}</main>`;

  function renderNote() {
    return `<article class="note">
      <p class="note-status">${escapeHtml(note.status || 'note')} · ${escapeHtml(note.audience)} · reviewed ${escapeHtml(note.reviewed)}</p>
      <h1>${escapeHtml(note.title)}</h1>
      ${note.summary ? `<p class="summary">${escapeHtml(note.summary)}</p>` : ''}
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      <div class="note-body">${body}</div>
    </article>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(note.title)} · PUNNARAJ</title>
  <meta name="description" content="${escapeHtml(note.summary || 'PUNNARAJ public record')}">
  ${surface === 'developer' ? '<meta name="robots" content="noindex, nofollow">' : ''}
  <link rel="stylesheet" href="${note.depth}style.css">
</head>
<body class="surface-${surface}">
  ${siteHeader(homeData, note.depth, surface === 'developer' ? `${note.depth}index.html#developer-record` : homeData.hero.secondaryLink.href)}
  ${shell}
  <script type="application/json" id="site-data">${JSON.stringify(allNotes.map(({ title, url, summary, tags }) => ({ title, url, summary, tags })))}</script>
  <script src="${note.depth}app.js"></script>
</body>
</html>`;
}

async function loadNotes() {
  const files = await walk(contentDir);
  const notes = [];
  for (const file of files) {
    const rel = path.relative(contentDir, file);
    const raw = await readFile(file, 'utf8');
    const [frontmatter, body] = parseFrontmatter(raw);
    validateClassification(rel, frontmatter);
    if (surface === 'public' && frontmatter.audience !== 'public') continue;
    const outRel = rel.replace(/\.md$/, '.html');
    const depth = outRel.split(path.sep).length === 1 ? '' : '../'.repeat(outRel.split(path.sep).length - 1);
    const title = frontmatter.title || path.basename(rel, '.md').replace(/[-_]/g, ' ');
    notes.push({
      file,
      rel,
      slug: slugify(rel).replace(/\/index$/, 'index'),
      outRel,
      url: outRel.split(path.sep).join('/'),
      depth,
      title,
      body,
      ...frontmatter
    });
  }
  return notes.sort((a, b) => a.url.localeCompare(b.url));
}

async function copyStatic() {
  for (const file of ['style.css', 'app.js']) {
    await copyFile(path.join(srcDir, file), path.join(distDir, file));
  }
}

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  const homeData = JSON.parse(await readFile(path.join(contentDir, 'public-home.json'), 'utf8'));
  if (homeData.audience !== 'public' || homeData.sensitivity !== 'P0' || !/^\d{4}-\d{2}-\d{2}$/.test(homeData.reviewed || '')) {
    throw new Error('content/public-home.json has invalid publication classification');
  }
  const notes = await loadNotes();
  const lookup = new Map();
  for (const note of notes) {
    const relSlug = slugify(note.rel);
    lookup.set(note.slug, note);
    lookup.set(relSlug, note);
    lookup.set(relSlug.replace(/\/index$/, ''), note);
    lookup.set(path.basename(note.slug), note);
    lookup.set(slugify(note.title), note);
  }
  for (const note of notes) {
    const outFile = path.join(distDir, note.outRel);
    await mkdir(path.dirname(outFile), { recursive: true });
    const body = renderMarkdown(note.body, lookup, note.depth);
    await writeFile(outFile, noteTemplate(note, notes, body, homeData));
  }
  await writeFile(path.join(distDir, 'index.html'), renderPublicHome(homeData, notes));
  await copyStatic();
  await writeFile(path.join(distDir, 'notes.json'), JSON.stringify(notes.map(({ title, url, summary, tags, status, audience, sensitivity, reviewed }) => ({ title, url, summary, tags, status, audience, sensitivity, reviewed })), null, 2));
  const sourceCommit = commandOutput('git', ['rev-parse', 'HEAD'], 'unknown');
  const sourceDate = commandOutput('git', ['show', '-s', '--format=%cI', 'HEAD'], new Date(0).toISOString());
  const dirty = commandOutput('git', ['status', '--porcelain'], '') !== '';
  await writeFile(path.join(distDir, 'release.json'), JSON.stringify({
    schemaVersion: 1,
    releaseId: `punnaraj-public-alpha-${homeData.reviewed}`,
    phase: 'alpha',
    surface,
    sourceRepository: 'https://github.com/punnaraj/magga-mud',
    sourceCommit,
    sourceDate,
    sourceState: dirty ? 'working-tree' : 'clean',
    contentCount: notes.length,
    classification: surface === 'public' ? ['P0'] : ['P0', 'P1']
  }, null, 2) + '\n');
  await writeFile(path.join(distDir, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
  await writeFile(path.join(distDir, 'robots.txt'), surface === 'public' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
  console.log(`Built ${notes.length} ${surface} notes into ${path.basename(distDir)}/`);
}

await build();

if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  console.log(`Watching content/ and src/ for ${surface} changes...`);
  for (const dir of [contentDir, srcDir]) {
    fsWatch(dir, { recursive: true }, async () => {
      try { await build(); } catch (error) { console.error(error); }
    });
  }
  setInterval(() => {}, 1000);
}

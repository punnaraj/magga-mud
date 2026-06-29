const siteData = JSON.parse(document.querySelector('#site-data')?.textContent || '[]');
const searchInput = document.querySelector('[data-search]');
const navLinks = [...document.querySelectorAll('nav a')];
const sidebar = document.querySelector('[data-sidebar]');
const menuToggle = document.querySelector('[data-menu-toggle]');

menuToggle?.addEventListener('click', () => sidebar?.classList.toggle('open'));

searchInput?.addEventListener('input', (event) => {
  const query = event.target.value.toLowerCase();
  navLinks.forEach((link) => {
    const note = siteData.find((item) => item.title === link.dataset.title);
    const haystack = [note?.title, note?.summary, ...(note?.tags || [])].join(' ').toLowerCase();
    link.hidden = query && !haystack.includes(query);
  });
});

const titleInput = document.querySelector('[data-draft-title]');
const bodyInput = document.querySelector('[data-draft-body]');
const saveButton = document.querySelector('[data-save-draft]');
const exportButton = document.querySelector('[data-export-draft]');
const importInput = document.querySelector('[data-import-draft]');
const draftList = document.querySelector('[data-draft-list]');
const storageKey = 'punnaraj-mud-drafts';
const legacyStorageKey = 'punaraj-mud-drafts';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-note';
}

function readDrafts() {
  const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey) ?? '[]';
  try { return JSON.parse(stored); }
  catch { return []; }
}

function writeDrafts(drafts) {
  localStorage.setItem(storageKey, JSON.stringify(drafts));
  localStorage.removeItem(legacyStorageKey);
  renderDrafts();
}

function currentDraft() {
  const title = titleInput?.value.trim() || 'Untitled Note';
  const body = bodyInput?.value || `# ${title}\n`;
  return { id: slugify(title), title, body, updatedAt: new Date().toISOString() };
}

function renderDrafts() {
  if (!draftList) return;
  const drafts = readDrafts();
  draftList.innerHTML = '';
  if (!drafts.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No local drafts yet.';
    draftList.append(empty);
    return;
  }
  for (const draft of drafts) {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = draft.title;
    const meta = document.createElement('small');
    meta.textContent = `Updated ${new Date(draft.updatedAt).toLocaleString()}`;
    const actions = document.createElement('div');
    actions.className = 'draft-actions';
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => { titleInput.value = draft.title; bodyInput.value = draft.body; });
    const remove = document.createElement('button');
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => writeDrafts(readDrafts().filter((item) => item.id !== draft.id)));
    actions.append(edit, remove);
    item.append(label, meta, actions);
    draftList.append(item);
  }
}

saveButton?.addEventListener('click', () => {
  const draft = currentDraft();
  const drafts = readDrafts().filter((item) => item.id !== draft.id);
  drafts.unshift(draft);
  writeDrafts(drafts);
});

exportButton?.addEventListener('click', () => {
  const draft = currentDraft();
  const blob = new Blob([draft.body], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${draft.id}.md`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput?.addEventListener('change', async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  titleInput.value = file.name.replace(/\.md$/, '').replace(/[-_]/g, ' ');
  bodyInput.value = await file.text();
});

renderDrafts();

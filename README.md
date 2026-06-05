# magga-mud

MUD — **Mutual Understanding Document** — workspace and publication site for the PUNNARAJ project.

This repository keeps project memory in an Obsidian-friendly Markdown vault and publishes it as a static website for GitHub Pages or Cloudflare Pages.

## Repository shape

```text
content/              Markdown vault; open this folder in Obsidian
src/                  Static site styles and browser workspace script
scripts/              Build and verification scripts
dist/                 Generated site output; created by npm run build
.github/workflows/    GitHub Pages deployment workflow
```

## Quick start

```bash
npm run build
npm run check
npm run serve
```

Then open <http://localhost:4173>.

## Editing workflow

1. Create or update Markdown files in `content/`.
2. Use wiki links like `[[10-mud/project-charter|Project Charter]]` to connect notes.
3. Run `npm run build` to generate `dist/`.
4. Commit and push. GitHub Pages can publish automatically from the included workflow.

## Browser workspace

The generated site includes a local browser workspace for quick capture:

- create drafts
- update drafts
- import Markdown files
- delete local drafts
- export `.md` files for commit

Drafts remain in browser storage until exported. Static hosting cannot safely write directly to Git without an authenticated backend, so this starter keeps publication deliberate.

## Cloudflare Pages

Create a Cloudflare Pages project with:

- Build command: `npm run build`
- Build output directory: `dist`

The included `wrangler.toml` records the same output directory.

## Security model

Public Markdown belongs in `content/`. Sensitive notes should stay outside public publishing or be stored only as client-side encrypted ciphertext in a future Cloudflare Pages Function plus R2/D1 workflow.

---
title: Human Workspace
tags: [workflow, workspace, crud]
summary: How humans create, update, upload, delete, and publish MUD files.
status: active
---

# Human Workspace

The site includes a lightweight browser workspace for rapid Markdown capture.

## What works now

- Create local draft notes.
- Update local draft notes.
- Import Markdown files from the computer.
- Delete local drafts.
- Export drafts back to `.md` files.

These drafts live in browser storage until exported. This protects the published vault from accidental edits while still making capture fast.

## Publishing flow

1. Draft or edit notes locally.
2. Export Markdown from the browser workspace or save files directly in `content/`.
3. Commit changes to Git.
4. Let GitHub Pages or Cloudflare Pages run `npm run build`.
5. Review the published site.

## Obsidian compatibility

Use `content/` as an Obsidian vault. Wiki links such as `[[Memory Graph]]` and folder links such as `[[40-memory/memory-graph|Memory Graph]]` are supported by the static builder.

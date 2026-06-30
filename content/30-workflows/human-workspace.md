---
title: Human Workspace
tags: [workflow, workspace, crud]
summary: How humans create, update, import, delete, and publish MUD files.
status: active
audience: developer
sensitivity: P1
reviewed: 2026-06-30
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


## Public Summary Publishing Step

Use this workflow when the public homepage needs to reflect the latest public-safe project state without exposing private working memory.

1. Collect the latest reviewed notes from `content/mud/`, the current `content/10-mud/` folder, and any other relevant vault folders that contain project context.
2. Summarize the current project state, including what has changed, what is stable, and what still needs attention.
3. Extract only public-safe material: background, process, aim, and updates that can be shared without revealing private or sensitive details.
4. Update the root public homepage at `content/index.md` with the refined summary and links to the most useful public notes.
5. Commit the homepage and supporting note changes, then publish through GitHub Pages or Cloudflare Pages after the normal site build succeeds.

## Obsidian compatibility

Use `content/` as an Obsidian vault. Wiki links such as `[[Memory Graph]]` and folder links such as `[[40-memory/memory-graph|Memory Graph]]` are supported by the static builder.

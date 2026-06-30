---
title: Publication Security Model
tags: [security, classification, publishing]
summary: Deny-by-default classification for GitHub Pages, Cloudflare Pages, and public R2.
status: active
audience: developer
sensitivity: P1
reviewed: 2026-06-30
---

# Publication Security Model

Public hosting is never private storage. Content is classified before build time, and an absent classification is an error.

## Information classes

| Class | Meaning | GitHub developer | Cloudflare public | Public R2 |
| --- | --- | --- | --- | --- |
| P0 | Reviewed general information | Yes | Yes | When required |
| P1 | Technical detail safe for unrestricted reading | Yes | No | Release artifacts only |
| P2 | Restricted drafts, operational evidence, and private context | No | No | No |
| P3 | Credentials, keys, cookies, password-vault material | Never | Never | Never |

## Build enforcement

- Every Markdown note declares `audience`, `sensitivity`, and `reviewed`.
- Public notes must be P0.
- Developer notes must be P1.
- The public build excludes developer notes.
- Checks reject merge markers, unresolved wiki links, transient metadata, and unsafe classification.

## Storage boundary

The Zero Vault, raw private family material, credentials, `.env` files, browser state, ENPASS content, and archived worktrees stay outside all public paths.

R2 object names and release manifests must not reveal restricted internal paths or identities.

## Browser workspace

The developer surface may store local drafts in browser storage. It does not write to GitHub or Cloudflare. Drafts must be exported, reviewed, classified, and committed before publication.

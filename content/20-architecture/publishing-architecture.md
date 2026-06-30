---
title: Publishing Architecture
tags: [architecture, github-pages, cloudflare-pages, r2]
summary: One reviewed source produces separate developer and public projections.
status: active
audience: developer
sensitivity: P1
reviewed: 2026-06-30
---

# Publishing Architecture

The alpha uses one canonical source and two intentionally different public renderings.

```mermaid
flowchart LR
  H[Human review] --> G[Markdown and Git]
  G --> B[Dual build and checks]
  B --> GH[GitHub Pages developer alpha]
  B --> CF[Cloudflare Pages public alpha]
  G --> M[Release manifest]
  M --> R2[Public R2 release artifacts]
  Z[Zero Vault and private evidence] -. excluded .-> B
```

## GitHub Pages

GitHub Pages publishes the developer build from `dist-developer/`. It contains every classified P0 and P1 note, build logic, architecture, release metadata, and known gaps.

The Git repository is the canonical metadata and change-history layer.

## Cloudflare Pages

Cloudflare Pages publishes `dist-public/`. It contains only P0 material and the curated project explanation.

Cloudflare's Git integration and preview deployments support branch-specific previews without replacing the production deployment. Preview URLs are not canonical.

## R2

R2 stores immutable PUNNARAJ-authored artifacts listed by a release manifest. Git stores the metadata; R2 stores the bytes.

Proposed object keys:

```text
releases/<artifact>/<version>/<sha256>/<filename>
manifests/<release-id>.json
```

Upstream operating-system images remain referenced by official URL and checksum during alpha rather than copied into public R2.

## D1

D1 is deferred. Static content and release metadata do not yet require a second database. A dedicated database may be added later for verified dynamic requirements such as submissions, approval state, or queryable release status.

## Release rule

One commit must produce both surfaces. Each generated `release.json` records the source commit, source date, surface, classification set, and note count.

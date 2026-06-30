---
title: Alpha and Beta Publication Contract
tags: [architecture, alpha, beta, publication]
summary: Defines the developer and public surfaces, storage responsibilities, and beta gates.
status: active
audience: developer
sensitivity: P1
reviewed: 2026-06-30
---

# Alpha and Beta Publication Contract

PUNNARAJ uses one reviewed source to produce two public surfaces.

## Alpha surfaces

| Surface | Audience | Contents |
| --- | --- | --- |
| GitHub Pages | Developers and reviewers | Every P0 and P1 note, technical architecture, verification logic, and known gaps |
| Cloudflare Pages | Family members, non-members, and first-time readers | P0 material and a curated factual project explanation |
| Public R2 | People retrieving a specific release artifact | Immutable PUNNARAJ-authored artifacts listed in a release manifest |

The Zero Vault and private evidence are not publication inputs.

## Storage responsibilities

- Git and GitHub are the canonical source, metadata, history, and review system.
- Cloudflare Pages renders the curated public projection.
- R2 stores checksum-addressed release objects, not source-of-truth metadata.
- D1 is deferred until dynamic state or queries are necessary.

## Meaning of alpha

Alpha exposes the structure and procedure for inspection. Copy, schemas, and URLs may still change. Known gaps stay visible.

## Beta entry gates

- Every note has an explicit audience and sensitivity classification.
- Both builds reject unclassified and unsafe content.
- GitHub and Cloudflare report the same source release.
- R2 object hashes match the release manifest.
- Accessibility and mobile QA pass.
- Rollback and recovery are tested.
- The human owner reviews the public/private boundary.

Beta is a tested publication contract, not a claim that PUNNARAJ is finished.

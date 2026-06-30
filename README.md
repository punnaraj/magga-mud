# magga-mud

MUD — **Mutual Understanding Document** — workspace and dual publication source for the PUNNARAJ project.

One reviewed source produces two public surfaces:

- GitHub Pages: complete public-safe developer alpha (`P0` + `P1`).
- Cloudflare Pages: curated public alpha (`P0` only).

Private evidence, credentials, and the Zero Vault are not publication inputs.

## Repository shape

```text
content/                  Classified Markdown and public-home data
docs/design-concepts/     Accepted visual specifications
src/                      Shared styles and browser behavior
scripts/                  Dual builders and publication checks
dist-public/              Generated Cloudflare Pages output
dist-developer/           Generated GitHub Pages output
.github/workflows/        GitHub Pages developer deployment
wrangler.toml             Cloudflare Pages public deployment
```

## Build and verify

```bash
npm run build
npm run check
```

Run either surface locally:

```bash
npm run serve
npm run serve:developer
```

The public surface uses port 4173 and the developer surface uses port 4174.

## Publication classification

Every Markdown note must declare:

```yaml
audience: public
sensitivity: P0
reviewed: 2026-06-30
```

or:

```yaml
audience: developer
sensitivity: P1
reviewed: 2026-06-30
```

The builder rejects missing or mismatched classification. Public builds include only `P0`; developer builds include `P0` and `P1`.

## Deployment

GitHub Actions builds `dist-developer/` from `main` and publishes it through GitHub Pages.

Cloudflare Pages project `magga-gen-001` publishes `dist-public/`. Direct alpha preview:

```bash
npm run build:public
npx wrangler pages deploy dist-public --project-name magga-gen-001 --branch public-alpha
```

## Storage decision

- GitHub owns source, metadata, history, checks, and release manifests.
- Cloudflare Pages owns the curated public rendering.
- A dedicated R2 bucket stores immutable PUNNARAJ-authored release artifacts.
- D1 is deferred until dynamic state is required.

Upstream Ubuntu images are not duplicated into public R2 during alpha. Private and restricted material must never be uploaded to public GitHub, Pages, or R2.

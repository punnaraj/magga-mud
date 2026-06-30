# Public Alpha Design System

The accepted visual specification is stored in `docs/design-concepts/`:

1. `01-public-alpha-hero.png`
2. `02-publication-architecture.png`
3. `03-alpha-beta-gates.png`
4. `04-evidence-limits.png`

## Design Tokens

- Background: true white `#ffffff`
- Ink: `#111111`
- Muted text: `#5f6368`
- Deep blue: `#0b318f`
- Amber: `#c86f00`
- Rule: `#d7d9dd`
- Display face: Iowan Old Style / Palatino / Georgia fallback
- UI and body face: system sans-serif
- Content width: 1440px maximum
- Open bands and rails; no default card grid
- Thin rules and 1.5px outline icons
- Motion: short continuity-line reveal only, disabled for reduced motion

## Component Families

- Quiet site header with four anchor links and one developer-record link
- Editorial hero split between purpose statement and a five-step continuity rail
- Three-column problem statement band
- Open publication architecture rails with a visible private boundary
- Two-column alpha/beta comparison with phase line
- Verified/unknown evidence lists with check and warning glyphs
- Plain link rail and evidence disclaimer
- Developer note shell with searchable navigation and optional local draft workspace

## Copy Lock

The public copy is stored in `content/public-home.json`. It is code-native in the rendered site. The concept images are layout references, not production UI assets.

## Intentional Constraints

- No claims of completion, universal hardware support, permanent URLs, or production readiness.
- No fake metrics, testimonials, badges, pills, commercial calls to action, or decorative AI imagery.
- No private material, internal evidence paths, account identifiers, or credentials.

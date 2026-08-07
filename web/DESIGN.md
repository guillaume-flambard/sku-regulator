# DESIGN.md — sku-regulator semantic design system

Source of truth for generating screens with Google Stitch. Follow these rules
exactly — they keep the product looking premium, data-dense, and non-generic.
The app is a **regulatory / health-claims intelligence dashboard**: trust,
clarity and precision matter more than decoration.

---

## 1. Visual atmosphere

- **Density:** 6 / 10 — "Daily App Balanced" leaning data-dense. Real content,
  no decorative padding.
- **Variance:** 6 / 10 — asymmetric where it earns it (stat rows, status
  columns), otherwise a calm grid.
- **Motion:** 5 / 10 — fluid but restrained. Nothing animates without purpose.
- **Mood:** precise, calm, trustworthy, technical. A health-regulation product,
  not a consumer startup. Avoid playfulness, gradients, and "AI futurism".

## 2. Color palette (calibrated — do not drift)

One accent only. Neutral base with a single saturated-but-restrained green.

| Role | Name | Hex | Usage |
|---|---|---|---|
| Page background | mist | `#f7f8f6` | default canvas |
| Surface / cards | white | `#ffffff` | cards, panels, inputs |
| Hairline | line | `#e2e7e3` | borders, dividers (never pure grey `#ddd`) |
| Muted text | muted | `#5b6b63` | secondary labels, captions |
| Primary text | ink | `#18211d` | headings, body (off-black, **never** `#000`) |
| **Accent** | sage | `#0f6b4f` | CTAs, active states, links, selected items |
| Accent tint | sage-soft | `#e6f2ec` | accent backgrounds, chips, selected rows |
| Danger | brick | `#b3402e` | non-authorised, errors, destructive |
| Warning | amber | `#b7791f` | pending, review, warnings |

**Banned:** pure black `#000`, pure white `#fff` as a fill over other content,
purple/violet/neon-blue gradients, `#7c3aed`-style glows, rainbow badges.

## 3. Typography

- **Family:** Geist (sans) + Geist Mono (data/codes). **Never Inter.**
- **Display / H1:** 36–60px, `tracking-tight`, weight 600–700. Hierarchy by
  weight + color, not just size. No oversized screaming headlines.
- **Body:** 15–16px, relaxed leading, max ~65 characters per line.
- **Data / codes / stats:** Geist Mono, small (12–14px). Register codes like
  `POL-HC-6510`, `fts 0.21` and `vec 0.86` are mono.
- **Labels / eyebrows:** 11–12px, uppercase, `letter-spacing 0.12em`, muted
  color. Use sparingly — at most one per section.

## 4. Layout & spacing

- **Grid:** 12-col, `max-w-6xl` (1152px) content rail, generous `gap-6`.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. No fractional
  spacing.
- **Cards:** white surface, `border border-line`, `rounded-xl` (12px) radius
  **everywhere** (one radius scale — no mixing square + pill).
- **Status badges:** pill (`rounded-full`), 12px text, 2px padding; tinted
  background + matching text (e.g. sage on sage-soft). One icon + one word.
- **Data-heavy sections** (stats, scores, tables): hairline `divide-y` or
  `border-t` separators instead of boxes — keep it light.
- **Focus:** visible ring `ring-2 ring-accent/30` on interactive elements.

## 5. Components

### Buttons
- **Primary:** `bg-sage text-white`, `rounded-full`, py-2.5 px-5, 14px medium,
  hover `-translate-y-px`. Never a wrapped label (max 2–3 words).
- **Secondary / ghost:** transparent, `border border-line`, same radius; hover
  darkens border.
- Press state: `scale-0.98`.

### Search / inputs
- Label **above** field (never placeholder-as-label). Placeholder is an
  example (`e.g. Can I say vitamin C supports immunity?`).
- Input: white, `border border-line`, `rounded-full` for the search bar, py-3,
  pl-11 with a leading icon. Focus: `border-accent ring-2 ring-accent/20`.
- Helper text: one line, 13px, muted, under the field.

### Result cards (Explore)
- Card: white, `border border-line`, `rounded-xl`, p-4.
- Header row: register code (mono, sage chip) + **StatusBadge** + **CountryBadge**,
  claim type right-aligned in mono.
- Body: claim text 15px. Footer: `fts` / `vec` scores in mono, separated by
  `border-t border-line`.
- Selected card: `border-accent/50 bg-sage-soft/40`.

### Status badges
- `authorised` → sage on sage-soft, check icon.
- `non_authorised` → brick on brick-tint, x icon.
- `revoked` → muted on neutral, minus icon.
- Country verdict: "Allowed here" (sage) / "Not allowed" (brick) / "Restricted"
  (amber).

### Market map (EU)
- Simplified country outlines, `#ecefe9` neutral fill, accent stroke when a
  market is selected. Colored by verdict: sage `allowed`, amber `restricted`,
  brick `not_allowed`. Non-EU countries `#f3f4f1`. No gradients, no drop-shadow.

### Force graph
- Nodes colored by type: product = sage, claim = amber, ingredient = muted.
- Edges: faint ink at 15% opacity. Labels in small mono. Clean white canvas.

### Anomaly queue (Portfolio)
- Row: icon tile (severity tint), product name + claim code, reason text,
  right-aligned confidence bar + Resolve button.
- Confidence bar: 4px track, fill by threshold (≥90 sage, ≥70 amber, else brick).

## 6. Motion

- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` or `Easing.out(Easing.quad)`.
- **Duration:** 150–250ms for hover/active; 300–500ms for reveals.
- **Restraint:** animate only opacity + transform. Never loop decorative
  animations. `prefers-reduced-motion` collapses everything to static.

## 7. Anti-patterns (never)

- Purple / blue-violet / neon AI gradients, glassmorphism on everything.
- `Inter` font, centered hero over a mesh, three identical feature cards.
- Emoji as UI icons (use a consistent icon set, e.g. Phosphor, stroke 1.5–2).
- Fake data / invented precision: every number shown must be real from the
  pipeline. Don't round register counts, don't fake confidence values.
- Wrapped CTA labels, placeholder-as-label, unescaped entities.

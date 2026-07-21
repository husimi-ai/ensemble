# Ensemble UI — Design System (light / white only)

Reverse-engineered from the live ChatGPT web app on 2026-07-21 and rebuilt
clean-room. Values are the **design tokens** (colors, spacing, radii, type,
layout geometry) read from the running app's computed CSS — no proprietary code,
fonts, or trademarks are reused. This file is the single source of truth; the
`chatgpt-ui-clone` skill enforces it.

> Clean-room notes: the reference ships **OpenAI Sans** (proprietary) — we
> substitute a native/system stack. Never ship OpenAI's logo, wordmark, or the
> name "ChatGPT" in product surfaces. Only the light theme is in scope.

---

## 1. Color — primitives

Numbered scales lifted verbatim from the reference (kept for reference; product
code should use the **semantic** tokens in §2, not raw primitives).

| Scale | Key stops |
|-------|-----------|
| gray  | 0 `#fff` · 25 `#fcfcfc` · 50 `#f9f9f9` · 75 `#f2f2f2` · 100 `#ececec` · 150 `#e8e8e8` · 200 `#e3e3e3` · 300 `#cdcdcd` · 400 `#b4b4b4` · 500 `#5d5d5d` · 600 `#676767` · 700 `#424242` · 750 `#2f2f2f` · 800 `#212121` · 900 `#171717` · 950 `#0d0d0d` |
| blue  | 50 `#e8f3fe` · 200 `#63a8f8` · 300 `#539af8` · **400 `#3a83f7`** · 500 `#2c67c5` |
| green | 400 `#53b559` · 500 `#48a04c` |
| red   | 400 `#fa423e` · 500 `#ff002a` |
| orange| 400 `#ee7c37` · 500 `#d25e28` |
| yellow| 400 `#f6c543` |
| purple| 400 `#8952ee` |

Accent = **blue-400 `#3a83f7`**.

## 2. Color — semantic tokens (the ones you use)

| Token | Value | Use |
|-------|-------|-----|
| `--canvas` | `#ffffff` | page / main thread background |
| `--sidebar` | `#fcfcfc` | left sidebar background |
| `--elevated` | `#ffffff` | menus, popovers, composer surface |
| `--subtle` | `#f9f9f9` | subtle fill (hovered rows, secondary surface) |
| `--muted` | `#f3f3f3` | tertiary fill / chips |
| `--hover` | `rgba(0,0,0,.05)` | generic hover overlay on transparent controls |
| `--bubble` | `#f4f4f4` | user message bubble |
| `--fg` | `#0d0d0d` | primary text + icons |
| `--fg-secondary` | `#5d5d5d` | secondary text / inactive icons |
| `--fg-muted` | `#8f8f8f` | placeholder, tertiary text |
| `--fg-inverted` | `#ffffff` | text/icon on dark (primary) buttons |
| `--border` | `rgba(0,0,0,.10)` | default hairline border |
| `--border-light` | `rgba(0,0,0,.05)` | faint dividers |
| `--border-heavy` | `rgba(0,0,0,.15)` | emphasized border |
| `--accent` | `#3a83f7` | links, focused/selected accent |
| `--primary` | `#0d0d0d` | primary button fill (send, CTAs) |
| `--primary-hover` | `rgba(0,0,0,.80)` | primary button hover |

Rule: **near-black text (`#0d0d0d`), never pure `#000`.** Borders are always
*alpha black*, never solid gray — they must read correctly over any surface.

## 3. Typography

- **Family:** reference uses OpenAI Sans. We use a native grotesque stack:
  `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, "Inter", system-ui, sans-serif`
  (San Francisco on macOS renders very close to OpenAI Sans). Optional: self-host
  **Inter** for cross-platform consistency.
- **Base:** `16px` / line-height `1.5` (24px) / weight `400`. Composer input
  line-height `26px`.
- **Scale (Tailwind default, matches reference):** xs `.75rem` · sm `.875rem` ·
  base `1rem` · lg `1.125rem` · xl `1.25rem` · 2xl `1.5rem` · 3xl `1.875rem`.
- **Weights in use:** 400 body, 500 medium (nav items, buttons), 600 semibold
  (empty-state heading, model name).
- Antialiased (`-webkit-font-smoothing: antialiased`).

## 4. Spacing, radii, shadows

- **Spacing base = 4px** (Tailwind default scale). Composer inner gutter `12px`.
- **Radii:** sm `6px` · md `8px` · lg `12px` · xl `16px` · 2xl `24px` ·
  **composer `28px`** · full `9999px`. Buttons/chips ~`8–12px`; the big composer
  pill is `28px`; avatars/pills `full`.
- **Shadows:** sm `0 1px 2px rgba(0,0,0,.15)` · md `0 3px 8px rgba(0,0,0,.12)` ·
  lg `0 4px 16px rgba(0,0,0,.15)`. Elevation is *restrained* — surfaces sit on
  hairline borders far more than on shadow. The composer uses a soft md shadow.

## 5. Layout geometry (measured live)

| Region | Value |
|--------|-------|
| Sidebar width (expanded) | **260px** (measured 259) |
| Header height | **52px**, `8px` padding |
| Thread / composer max-width | **768px** (48rem), centered |
| Composer radius | **28px**; send button is a circular `32px` primary button |
| Base font | 16px / 1.5, weight 400 |

Structure: `[ sidebar 260px | main( header 52px · scrollable thread · composer ) ]`.
Sidebar collapses via a `PanelLeft` toggle. Thread and composer share the same
768px centered column.

## 6. Component anatomy

**Sidebar** (`--sidebar` bg): top row = brand mark + search + collapse toggle;
primary actions as full-width rows with a 20px leading icon, `500` weight,
`8–10px` radius, hover = `--hover`; active row uses `--muted` fill. User profile
pinned to the bottom (avatar + name + plan label in `--fg-muted`).

**Top bar** (transparent, 52px): left = product/model name with a `ChevronDown`
(a switcher); right = new-chat / share icon buttons. Icon buttons are `36px`
square, `full`/`8px` radius, hover `--hover`, icons `--fg` at ~`20px`.

**Empty state:** vertically centered `1.875rem`/`600` heading ("Ready when you
are.") with the composer directly beneath it in the same centered column.

**Composer:** `--elevated` surface, `1px --border`, `28px` radius, soft md
shadow; left `+` icon button, flexible `Ask anything` textarea (placeholder
`--fg-muted`), right circular **send** button — `--primary` fill / `--fg-inverted`
arrow, disabled/`--muted` when empty.

**Messages:** *user* = right-aligned `--bubble` pill, `~18px` radius, max ~70%
width, `8–12px` padding. *assistant* = full-width plain prose on `--canvas`, no
bubble, generous line-height for readability.

## 7. Interaction

- Transparent controls darken on hover with `--hover`; primary buttons go to
  `--primary-hover`.
- Focus: subtle ring using `rgba(13,13,13,.16)`; accent controls focus in blue.
- Motion is spring-based and quick (~0.2–0.4s ease-out); keep transitions subtle
  (opacity/transform), never bouncy on core chat surfaces.
- Scrollbars are thin (8px) with `rgba(0,0,0,.1)` thumbs.

## 8. Provenance

Raw extraction artifacts live beside this file: `raw-css/` (downloaded compiled
CSS), `tokens-light.json` (191 semantic tokens), `tokens-root.json`. Re-run the
browser extraction to refresh when the reference UI changes.

---
name: chatgpt-ui-clone
description: Enforce the Ensemble UI design system (a clean-room, light-theme ChatGPT-style interface) whenever building, editing, or reviewing any frontend in this project. Use for any component, page, layout, style, Tailwind class, color, spacing, radius, or typography work here. Keeps every surface on-token and on-layout.
---

# Ensemble UI rules

This project reproduces the ChatGPT web look-and-feel **clean-room**: only the
design tokens (color, type, spacing, geometry) were reverse-engineered; no
proprietary code, fonts, or trademarks are reused. Follow these rules for **all**
UI work. The full spec with provenance is `design-reference/design-system.md` —
read it before non-trivial work.

## Non-negotiables

- **Light / white theme only.** Never add dark-mode variants, `dark:` classes, or
  a theme toggle unless the user explicitly asks.
- **Clean-room.** Never use the name "ChatGPT", the OpenAI wordmark/blossom logo,
  or the OpenAI Sans font in product surfaces. The app is **Ensemble**; the brand
  mark is a plain monogram. Font is the native system stack (optionally Inter).
- **Tokens, not literals.** Never hardcode a hex color, `px` shadow, or ad-hoc
  radius in a component. Use the semantic Tailwind utilities below, which map to
  the CSS variables in `app/globals.css`. Add a new token there first if one is
  missing.

## Token utilities (defined in `tailwind.config.ts` → `app/globals.css`)

Backgrounds: `bg-canvas` (page/thread) · `bg-sidebar` · `bg-elevated`
(menus/composer) · `bg-subtle` · `bg-muted` (chips/active row) · `bg-bubble`
(user message) · `hover:bg-hover` (transparent-control hover).

Text/icons: `text-fg` (primary, `#0d0d0d` — never pure black) · `text-fg-secondary`
· `text-fg-muted` (placeholders/tertiary) · `text-fg-inverted` (on dark buttons).

Borders (always alpha-black): `border-line` · `border-line-light` ·
`border-line-heavy`.

Accent/actions: `text-accent`/`bg-accent` (`#3a83f7`, links & selection) ·
`bg-primary` + `hover:bg-primary-hover` (dark CTA / send button).

Shape & scale: `rounded-composer` (28px) · `max-w-thread` (768px) ·
`w-sidebar` (260px) · `h-header` (52px) · `shadow-composer`. Radii otherwise
`rounded-lg` (12px) for buttons/rows, `rounded-full` for avatars/circular
buttons.

## Layout contract

```
[ Sidebar 260px (bg-sidebar) | main( TopBar h-52 · thread scroll · Composer ) ]
```

- Thread **and** composer live in the same centered `max-w-thread` (768px) column.
- Header is 52px, transparent, `px-2`; icon buttons are 36px (`h-9 w-9`),
  `rounded-lg`, `hover:bg-hover`, icons ~20px.
- Empty state: vertically centered `text-3xl font-semibold` heading with the
  composer directly beneath it.
- Sidebar collapses via a `PanelLeft` toggle; when closed, show the toggle in the
  TopBar.

## Typography

- Base 16px / `leading-normal` (1.5), weight 400. Headings `font-semibold` (600);
  nav items and buttons `font-medium` (500).
- Scale = Tailwind default (`text-xs`…`text-3xl`) — it matches the reference.

## Components

- **Icon button:** reuse `components/ui/IconButton.tsx` — don't re-roll square
  hover buttons.
- **Composer:** `bg-elevated`, `border border-line`, `rounded-composer`,
  `shadow-composer`; `+` on the left, auto-growing textarea (max 200px,
  Enter=send / Shift+Enter=newline), circular `bg-primary` send button that goes
  `disabled:bg-muted` when empty.
- **Messages:** user = right-aligned `bg-bubble` pill, `rounded-[18px]`, max ~70%
  width; assistant = full-width plain prose on `bg-canvas`, no bubble,
  `leading-7`.
- Motion: subtle, quick ease-out on opacity/transform; never bouncy on the core
  chat surfaces. Prefer `transition-colors` for hover states.

## Structure & file discipline

- Components live under `components/<domain>/` (`sidebar/`, `chat/`, `composer/`,
  `layout/`, `ui/`). Keep files under ~200 lines; split by domain, don't dump.
- Client interactivity requires `"use client";`. Import via the `@/` alias.

## Checklist before finishing UI work

1. No raw hex / literal shadows / magic radii — only tokens.
2. No `dark:` classes; no OpenAI marks, name, or font.
3. Thread + composer share the 768px column; sidebar 260px; header 52px.
4. Hover/disabled/focus states present on every interactive control.
5. `pnpm build` (or `next lint`) passes.

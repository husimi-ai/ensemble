# Ensemble — UI Rules & Design System

**Ensemble** is a clean-room reproduction of the ChatGPT web interface, built to
be pixel- and motion-faithful. This file is the **authoritative UI spec**: every
component, style, and interaction built on top MUST follow it so the whole app
reads as one system. When a rule here and the code disagree, the code is the bug.

Raw provenance (downloaded CSS, extracted tokens, the icon sprite, per-icon
geometry) lives in `design-reference/`. A condensed enforcement checklist lives
in `.claude/skills/chatgpt-ui-clone/SKILL.md`. **This file is the long form.**

---

## 0. Golden rules (read first)

1. **Measure, don't guess.** Every value here was read off the *live* app's
   computed styles or its icon sprite — not eyeballed. When adding anything new,
   inspect the reference the same way (see §11) and match the number. "Looks
   about right" is not acceptable; this is an exact clone.
2. **Light / white theme only.** No dark mode, no `dark:` variants, no theme
   toggle. Ever, unless the user explicitly asks.
3. **Tokens, not literals.** Never hardcode a hex, shadow, or magic radius in a
   component. Use the semantic Tailwind utilities in §3. If a token is missing,
   add it to `app/globals.css` **and** `tailwind.config.ts` first.
4. **Clean-room, not counterfeit.** Reproduce layout, geometry, and motion
   exactly, but never ship OpenAI's **trademarks** (the blossom logo, the word
   "ChatGPT"), their proprietary **font** (OpenAI Sans), or wholesale-copied
   proprietary code. The product is **Ensemble**; the brand mark is a plain "E"
   monogram; the font is a native/system stack. Functional UI glyphs are matched
   exactly (§7); brand marks are substituted.
5. **Hovers snap, deliberate motions animate.** The single most-missed detail —
   see §6.

---

## 1. Stack & commands

- **Next.js 14** (App Router) · **React 18** · **Tailwind CSS v3** · **TypeScript** · **pnpm**.
- Icons: our own sprite-derived components (`components/icons/`) + `lucide-react`
  for generic controls not present in ChatGPT's set.
- Interactivity requires `"use client";`. Import via the `@/` alias.

```bash
pnpm dev                 # dev server (localhost:3000, or next free port)
pnpm exec tsc --noEmit   # typecheck — SAFE to run alongside the dev server
pnpm build               # production build
```

> **Never run `pnpm build` while `pnpm dev` is running** — they share `.next` and
> the build clobbers the dev server's assets (you'll get an unstyled page and
> 404'd chunks). To verify types without disrupting dev, use `pnpm exec tsc
> --noEmit`. If dev breaks this way: kill it, `rm -rf .next`, restart.

---

## 2. File organization

```
app/
  layout.tsx            # <html>/<body>, imports globals.css
  page.tsx              # holds app state (sidebar/settings open, messages)
  globals.css           # design tokens (:root) + base + keyframes
components/
  icons/index.tsx       # exact sprite-derived sidebar glyphs
  layout/               # TopBar, ModelSwitcher
  sidebar/              # Sidebar, SidebarRow, AccountMenu
  chat/                 # Thread, Message, MessageActions, EmptyState, Suggestions
  composer/             # Composer
  settings/             # SettingsModal, SettingRow, panels/
  ui/                   # Modal, Toggle, IconButton (reusable primitives)
design-reference/       # extraction artifacts (raw CSS, tokens, sprite, notes)
```

- **≤ ~200 lines per file**; split by domain into subfolders, never a flat dump.
- Reusable primitives live in `components/ui/`. Don't re-roll a hover icon
  button, modal, or toggle — reuse `IconButton`, `Modal`, `Toggle`.

---

## 3. Design tokens

Defined once in `app/globals.css` (`:root`), exposed as utilities in
`tailwind.config.ts`. Always use the utility, never the raw value.

### Surfaces
| Token | Value | Utility | Use |
|---|---|---|---|
| `--canvas` | `#ffffff` | `bg-canvas` | page / main thread |
| `--sidebar` | `#fcfcfc` | `bg-sidebar` | left sidebar |
| `--elevated` | `#ffffff` | `bg-elevated` | menus, popovers, composer, modal panel |
| `--subtle` | `#f9f9f9` | `bg-subtle` | secondary fill |
| `--muted` | `#f3f3f3` | `bg-muted` | active nav row / chips |
| `--hover` | `rgba(0,0,0,.05)` | `hover:bg-hover` | hover on transparent controls |
| `--selected` | `rgba(0,0,0,.04)` | `bg-selected` | selected item (settings tab) |
| `--scrim` | `rgba(0,0,0,.5)` | `bg-scrim` | modal backdrop |
| `--bubble` | `#f9f9f9` | `bg-bubble` | user message bubble |

### Text / icons
| Token | Value | Utility | Use |
|---|---|---|---|
| `--fg` | `#0d0d0d` | `text-fg` | primary text + icons (**never pure `#000`**) |
| `--fg-secondary` | `#5d5d5d` | `text-fg-secondary` | secondary text, inactive icons |
| `--fg-muted` | `#8f8f8f` | `text-fg-muted` | placeholders, tertiary, section-item meta |
| `--fg-inverted` | `#ffffff` | `text-fg-inverted` | text/icon on dark buttons |

### Borders (always alpha-black), accent, actions
| Token | Value | Utility |
|---|---|---|
| `--border` | `rgba(0,0,0,.10)` | `border-line` |
| `--border-light` | `rgba(0,0,0,.05)` | `border-line-light` |
| `--border-heavy` | `rgba(0,0,0,.15)` | `border-line-heavy` |
| `--accent` | `#3a83f7` | `text-accent` / `bg-accent` |
| `--danger` | `#e02e2a` | `text-danger` |
| `--primary` | `#0d0d0d` | `bg-primary` (dark CTA / send) |
| `--primary-hover` | `rgba(0,0,0,.80)` | `hover:bg-primary-hover` |

**Color rules:** text is near-black `#0d0d0d`, never `#000`. Borders are always
*alpha black*, never a solid gray, so they read over any surface.

---

## 4. Typography

- **Font stack** (`--font-sans`): `-apple-system, BlinkMacSystemFont, "Segoe UI",
  "Helvetica Neue", Helvetica, Arial, "Inter", system-ui, sans-serif`. The
  reference uses OpenAI Sans (proprietary); San Francisco on macOS renders very
  close. Optionally self-host **Inter** for cross-platform parity.
- **Base:** `16px` / line-height `1.5` (24px) / weight `400`. Composer input
  line-height `26px`. Assistant prose `leading-7` (28px).
- **Scale:** Tailwind default — `text-xs .75rem` · `sm .875rem` · `base 1rem` ·
  `lg 1.125rem` · `xl 1.25rem` · `2xl 1.5rem` · `3xl 1.875rem`.
- **Weights:** `400` body · `500` medium (buttons, account name) · `600`
  semibold (empty-state heading, section headers, model name, dialog title).
- Antialiased (`-webkit-font-smoothing: antialiased`).

---

## 5. Spacing, radii, shadows, geometry

- **Spacing base = 4px** (Tailwind default). Composer inner gutter `12px`.
- **Radii:** `sm 6px` · `md 8px` · `lg 12px` · **item/row `10px`** (`rounded-[10px]`)
  · `xl 16px` (menus/dialog) · `2xl 24px` (`rounded-3xl`, user bubble) ·
  **composer `28px`** (`rounded-composer`) · `full` (avatars, pills, circular btns).
- **Shadows:** `--shadow-sm 0 1px 2px rgba(0,0,0,.15)` (`shadow-card`) ·
  `--shadow-md 0 3px 8px rgba(0,0,0,.12)` (`shadow-composer`) · `--shadow-lg 0 4px
  16px rgba(0,0,0,.15)` (`shadow-pop`, menus/dialogs). Elevation is restrained —
  surfaces sit on hairline borders far more than on shadow.

### Measured layout geometry (authoritative)
| Region | Value | Utility |
|---|---|---|
| Sidebar width | **260px** (259 measured) | `w-sidebar` |
| Header height | **52px**, `px-2` | `h-header` |
| Thread + composer column | **768px** (48rem), centered | `max-w-thread` |
| Composer radius | **28px** | `rounded-composer` |
| Settings dialog | **680 × 600px**, `16px` radius | — |
| Settings tab rail | **200px** wide; items `36px` tall, `10px` radius, active `bg-selected` | — |
| Sidebar/nav/chat row | **min 36px** tall, `10px` radius, padding `6px 10px`, `14px` text | — |
| Section header ("Projects"/"Chats") | `14px` **semibold** `text-fg` | — |
| User bubble | `bg-bubble` (#f9f9f9), **max-width 512px**, `rounded-3xl`, `px-5 py-2.5`, right-aligned | — |
| Assistant message | full 768px, no bubble, `leading-7` | — |
| Toggle | 32 × 20px; knob 16px (see §6) | — |

Structure: `[ Sidebar 260 (bg-sidebar) | main( TopBar 52 · thread scroll · Composer ) ]`.
Thread and composer share the same centered `max-w-thread` column.

---

## 6. Motion & interaction (the details that sell it)

The reference is deliberate about what moves and what snaps. Match it exactly.

- **Hovers are INSTANT.** Nav items, icon buttons, rows, and menu items compute
  `transition-duration: 0s` in the reference. Do **not** add `transition-colors`
  to hover states — backgrounds snap. (This is the most common fidelity miss.)
- **Toggle** (`components/ui/Toggle.tsx`): track `32×20`, `rounded-full`,
  `bg-accent` on / `rgba(0,0,0,.2)` off — **track color changes instantly**.
  Knob: `16×16`, **white, NO shadow**, `2px` inset, travels **12px**
  (`left-0.5` + `translate-x-3`). Only the knob animates:
  **`0.1s cubic-bezier(0.4,0,0.2,1)`** = Tailwind `transition-transform duration-100 ease-in-out`.
- **Modals** (`components/ui/Modal.tsx`): scrim fades `opacity 200ms`; panel
  fades + scales from `0.98` over `200ms ease-out`. Enter and exit both animate
  (mount held 200ms on close). Closes on Escape and backdrop click.
- **Popover menus** (account, model switcher, row "…" menu): `.pop-in` keyframe
  — `opacity 0→1`, `scale .98→1 + translateY 4px→0` over `0.12s ease-out`.
  Dismiss via a fixed transparent backdrop (`fixed inset-0 z-40`) + click-away.
- **Sidebar collapse:** animate the wrapper's **width** `0↔260px`,
  `transition-[width] 200ms ease-out`, `overflow-hidden`.
- **Focus:** subtle ring `rgba(13,13,13,.16)`; accent controls focus blue.
- General: motion is quick and never bouncy on core chat surfaces. Prefer
  animating `opacity`/`transform`.

---

## 7. Icons

ChatGPT renders sidebar icons via `<use href=".../sprites-core-*.svg#hash">`.
We reproduce the exact glyphs as inline SVG components.

- **Source of truth:** `design-reference/raw-css/sprites-core.svg` (the downloaded
  public sprite) and `design-reference/sidebar-icons.json` (per-icon viewBox +
  geometry + fill/stroke flag).
- **Component pattern** (`components/icons/index.tsx`): a `make(viewBox, inner,
  stroked)` factory renders an `<svg>` with the raw markup via
  `dangerouslySetInnerHTML` (so `fill-rule` / `stroke-width` survive). Fill icons
  use `fill="currentColor"`; **stroked** icons (Library, Plugins) use
  `fill="none" stroke="currentColor"` at the sprite's `1.33` weight with round
  caps/joins. Every icon takes `{ size?, className? }` (so it drops into
  `IconButton` and lucide call-sites unchanged).
- **Confirmed-exact glyphs:** New chat (compose), Library, Plugins, Codex, More,
  Homework (blue cap), Search, PanelToggle.
- **Deviations:** the top-left **brand** stays the "E" monogram (the real one is
  OpenAI's blossom trademark — do not reproduce). The **folder** is a close
  hand-drawn match (the real one is a 1,783-char inline path past the extraction
  transport limit).
- **Adding a new icon:** find the element in the live app, read its
  `<use href>` hash, extract that `<symbol>` from the sprite, and add a `make()`
  entry. Don't substitute a lucide look-alike for an icon ChatGPT actually has.

---

## 8. Component inventory & anatomy

Each reproduces a measured reference surface. Reuse these; don't fork them.

- **Sidebar** (`sidebar/Sidebar.tsx`, `bg-sidebar`): brand monogram + Search +
  collapse (`IconPanelToggle`) top row; nav (New chat active `bg-muted`, Library,
  Plugins, Codex, More) as `36px`/`10px`-radius rows; **Projects** and **Chats**
  sections with `14px` semibold headers; rows via `SidebarRow`; bottom = account
  button (opens `AccountMenu`) + **Upgrade pill** (`rounded-full border-line`).
- **SidebarRow** (`sidebar/SidebarRow.tsx`): optional leading icon + truncated
  label; a "…" button reveals on `group-hover` (`opacity-0 group-hover:opacity-100`)
  and opens a menu — **Share / Rename / Archive / Delete** (Delete = `text-danger`).
- **AccountMenu** (`sidebar/AccountMenu.tsx`): `.pop-in` popover anchored above
  the account row — header (avatar/name/chevron) · Upgrade plan · Personalization
  · Profile · Settings (opens the modal) · Help · Log out.
- **TopBar** (`layout/TopBar.tsx`, 52px): left = `ModelSwitcher` (+ sidebar
  reopen button when collapsed); right = Upgrade (accent) + temporary-chat icon.
- **ModelSwitcher** (`layout/ModelSwitcher.tsx`): `Ensemble ▾` opens a `340px`
  `.pop-in` menu of model rows (name + description, checkmark on selected).
- **Composer** (`composer/Composer.tsx`): `bg-elevated`, `border-line`,
  `rounded-composer`, `shadow-composer`; `+` left, auto-grow textarea (max 200px,
  Enter=send / Shift+Enter=newline); right = send arrow when text present, else
  mic + circular voice button (`bg-primary`).
- **Thread / Message / MessageActions** (`chat/`): user = right-aligned
  `bg-bubble` pill (`rounded-3xl`, max 512px) with hover copy/edit; assistant =
  full-width prose with a permanent action row (copy / thumbs up / thumbs down /
  read-aloud / regenerate). Copy writes to clipboard and flips to a check 1.5s.
- **EmptyState / Suggestions** (`chat/`): centered `text-3xl font-semibold`
  heading + composer + suggestion rows (Create an image / Write or edit / Look
  something up).
- **SettingsModal** (`settings/`): 680×600 dialog, 14-item left rail, right pane
  header + rows via `SettingRow` (label/description + control) using
  `SelectControl` (dropdown-styled) and `Toggle`.
- **Primitives** (`ui/`): `Modal`, `Toggle`, `IconButton` (36px square,
  `rounded-lg`, instant `hover:bg-hover`).

---

## 9. Known intentional deviations from the reference

Keep these unless the user overrides — they are the responsible clean-room line:
1. Brand mark = "E" monogram (not OpenAI's blossom logo).
2. Product/model names = "Ensemble" (not "ChatGPT").
3. Font = native system stack (not OpenAI Sans).
4. Folder icon = close hand-drawn match (not the exact 1,783-char inline path).

---

## 10. Copy / sample data

Sidebar Projects/Chats and the account name mirror the reference account as
static sample data (they'd be dynamic in a real app). Match the reference's exact
labels when reproducing a surface; treat the data as placeholder, not product.

---

## 11. Fidelity workflow (how to extend this correctly)

1. **Open the reference** surface in the live app (browser automation).
2. **Read computed styles** with page JS: `getComputedStyle(el)` +
   `getBoundingClientRect()` for dimensions/colors/radii; read
   `transitionDuration` / `transitionTimingFunction` for motion.
3. **Icons:** read the element's `<use href>` hash → extract the `<symbol>` from
   `sprites-core.svg` → add a `make()` entry.
4. **Transport gotcha:** browser tool results cap near ~1KB. For long values,
   store on `window.__X` and read in slices, or download the asset with `curl`
   (public CDN assets work) and parse locally.
5. **Verify visually:** screenshot the running app and `zoom` into the surface;
   compare side-by-side with the reference. Confirm interactions live.
6. **Record the measured number here** (or in `design-reference/`) so the next
   change builds on fact, not memory.

# Squeek Pouch design system

## Overview

Squeek Pouch is a small packing game, composed like a tabletop activity: a stitched cloth pouch at the center, illustrated snacks to one side, and an original hamster holding a miniature pouch. The requested warm cream, dark brown and teal palette carries the whole interface. Open directly into the puzzle; there is no marketing hero or onboarding gate.

The source of truth is `src/style.css`, with SVG art in `src/art.ts`, translated copy in `src/i18n.ts`, and component markup/behavior in `src/main.ts`. The mobile priority is selecting, aiming and packing. Telemetry explains the game rules without taking over the play surface.

## Colors

Primitives and semantic roles are declared at the start of `src/style.css`. They use hexadecimal sRGB values; there is one light theme.

| Semantic token | Primitive / value | Use |
| --- | --- | --- |
| `--color-page` | `--cream-100`, `#f7f3e8` | Page and neutral controls |
| `--color-surface` | `--cream-50`, `#fffdf6` | Snack buttons, dialogs, text on primary buttons |
| `--color-inset` | `--cream-200`, `#eee6d5` | Hover and packed tray states |
| `--color-border` | `--cream-300`, `#d7c9ac` | Dividers and control structure |
| `--color-text` | `--brown-900`, `#352a20` | Primary text |
| `--color-muted` | `--brown-600`, `#77634e` | Supporting text and counters |
| `--color-accent` | `--teal-600`, `#286f60` | Pack button, selected item border, collected seeds |
| `--color-accent-hover` | `--teal-700`, `#205b4f` | Hover and link text |
| `--color-accent-soft` | `--teal-100`, `#e2eee3` | Instructional accents |
| `--color-focus` | `#145b75` | Three-pixel focus outline |
| `--color-warning` | `#914929` | Recoverable placement errors |

The pouch is `#e4cba2`, the stitched inset is `#a98b64`, and empty cells are `#f4e9d3`. Pouch labels use `#674d2e`. These illustration colors live with the game-specific selectors rather than pretending to be general UI status tokens. Snack colors are sunflower `#e9bf62`, hazelnut `#d3a071`, berry `#b6a0c6`, clover `#adc38c`, treasure `#8fbdb1`, and biscuit `#d9ac99`. Icons, names, shapes and accessible cell names supplement the colors. A dashed outline denotes a preview, a solid outline denotes a selected packed piece, and checks mark packed snacks.

The actual rendered contrast checks and measured correction are recorded in `artifacts/validation.md`. There are no gradients or gradients behind text.

## Typography

`--font-body` is `'Trebuchet MS', 'Avenir Next', 'Segoe UI', system-ui, sans-serif`; `--font-display` is `Georgia, 'Times New Roman', serif`. CJK glyphs use the browser's system fallback. All fonts are local system fonts; no font downloads are required and no specific installed face is guaranteed.

One six-size scale is declared: `--text-xs` 0.75rem, `--text-sm` 0.875rem, `--text-body` 1rem, `--text-lg` 1.25rem, `--text-title` 1.75rem, and `--text-display` 2.25rem. Weights are 400 and 700. Display headings use 1.15 line height, ordinary text 1.5, long dialog text 1.65, and wrapping snack names 1.4. The hamster's note and level number use Georgia italic.

The desktop wordmark and level title use the 1.75rem step; mobile uses 1.25rem. The desktop level numeral is 2.25rem. The wordmark has -0.035em tracking (-0.025em on mobile); other copy has natural spacing. Numeric counters use `tabular-nums`. Headings balance and prose uses `text-wrap: pretty`, with normal wrapping as the browser fallback. No critical text is ellipsized.

## Layout

The header is at most 1280px wide. Main content is at most 1200px, with 40px desktop side margins. The main desktop grid has a flexible companion column, a 310–440px pouch column, and a flexible tray column, separated by 40px. Spacing generally follows 4/8/12/16/24/32/40px increments, with 5–7px cell/tray gaps where the puzzle needs density.

At 1100px, columns and gaps tighten. At 900px, the decorative companion is hidden, leaving board and tray in two columns with 24px page margins. At 650px, the tray precedes the board, becomes four columns (five for nine or more pieces), and the layout has 16px margins and a 420px maximum. Live-source details move below the game. Below 360px, margins become 12px, the header's miniature hamster and nonessential tray caption are hidden, and snack names can wrap anywhere.

The board uses an aspect-ratio square and equal CSS-grid rows/columns, with the level size supplied by `--grid-size`. Larger levels grow cell count, not the width of the phone. The toolbar uses `auto-fit` and `minmax(min(100%, 5.5rem), 1fr)`, so enlarged text wraps controls into additional rows instead of overflowing. Text containers have natural height; primary buttons have minimum heights rather than fixed text boxes. No fixed/sticky bar obscures play. Safe-area bottom padding is included on phones.

The actual 320, 390, 768 and 1440px layouts, and 200% root text size, were checked. The initial product, selected snack, grid and **Pack piece** action fit the first 390 × 844 screen. Later, more crowded levels scroll naturally. A 320px grid cell may be below the 44px comfort target, but remains above the 24px minimum; the grid is a dense game surface.

## Elevation & Depth

The page, tray and game are flat tonal surfaces. Borders define controls and selection; they are not paired with decorative shadows. The pouch's dashed seam is original game artwork. Only the native dialog floats, using `0 20px 80px #352a2038` with no border. Its backdrop is `#352a2073` with 3px blur. The dialog's top layer provides modal stacking and background inertness.

## Shapes

Shared radius tokens are 8px, 14px and 24px. Buttons use 10px, tray items 14px (10px mobile), grid cells 7px (6px mobile), and dialogs 24px. The pouch has asymmetric 30px top / 56px bottom corners, reducing to 25px / 44px on mobile. Its inset seam follows the same curve with an 8px inset. Round seed markers and small grain dots belong only to the game illustration.

## Components

| Pattern and source | Behavior and states |
| --- | --- |
| `action()` / `.button` in `src/main.ts`, `src/style.css` | Teal primary pack action, quiet bordered tools, outlined finish option; hover, active, disabled and visible focus states. Minimum 44px height, 48px for the main pack button. |
| `trayMarkup()` / `.snack-button` | Native toggle buttons with `aria-pressed`, shape SVG, snack name, selection border and packed check. Keyboard numbers select pieces. Packed items remain selectable for unpacking. |
| `boardMarkup()` / `.pouch-grid` | ARIA grid with native button gridcells, row structure, one roving tab stop, row/column/occupant/preview labels. Arrows aim, R rotates, Enter packs, U undoes. Filled geometry does not override a legal bent-shape preview. |
| `.scoreboard`, `seedMarkup()` | Tabular move/fill values, labelled progressbar, target marker, seed arrival/collection graphics with text alternatives. Blocked corners are explicit and excluded from capacity. |
| `.pouch-label`, `.route-strip` | Attempt route visible directly on the board; explanatory copy and locked/unlocked state beneath. The live source panel is separate from frozen attempt rules. |
| `liveMarkup()` | Loading, fresh spinning, fresh idle, stale, missing-speed and failure states; observed timestamp, source link, and manual retry. Never presents fallback data as live. |
| `openModal()` and native `dialog` | Tutorial, level chooser, restart/change confirmation, About and results. Headings receive initial focus for reading; result buttons receive focus for continuing. Escape closes and trigger focus is restored. |
| Stable `#announcer` | Polite announcements for placement, invalid fits, undo and reaching the goal. Visible notice text stays until the next relevant action. |

Icons share a 24-unit viewBox, 1.8-unit rounded stroke and `currentColor`. Original art in `src/art.ts` includes the hamster, snack silhouettes and wheel. Reuse these functions rather than adding another icon family.

Motion is small: 120ms color/opacity/press transitions and 150ms progress updates. Press scales to 0.96. Dialogs appear immediately; their visibility does not depend on an animation finishing. Only a fresh spinning wheel animates its spokes, on an eight-second cycle. All animation and transitions are disabled for `prefers-reduced-motion: reduce`. Forced-colors mode restores system focus indicators and distinct grid borders. Sound is separately opt-in and is never the only feedback.

## Do's and Don'ts

- Start another game panel with existing spacing, body type and `.button` patterns. Keep instructions next to the relevant control and retain the board's initial-screen priority.
- Add complete English and Chinese message strings in `src/i18n.ts`; do not assemble prose from translated fragments. Set visible and accessible names together.
- Extend the snack art vocabulary and authored map format when adding levels. Verify connected pieces, full solutions, seed placement and attainable star tiers before publishing.
- Keep source freshness and attempt rules separate. Use `currentRules()` only when starting a new attempt, never to rewrite one in progress.
- Use the accent for the primary action and selection. Preserve visible shape/icon/text cues, the focus ring and reduced-motion behavior.
- Do not add a hero, a remote asset dependency, tiny tracked capitals, nested surface cards, a wallet flow or implied rewards.

## Guidance attribution

The six-domain review uses Jakub Krehel's [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT). This implemented-system documentation follows Paul Bakaus's [Impeccable documentation reference](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). Both were supplied as pinned assignment inputs. Retained license texts are in `artifacts/design-guidance-LICENSE.txt`. All game art and game implementation here are original.

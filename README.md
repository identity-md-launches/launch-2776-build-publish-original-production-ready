# Squeek Pouch

A cozy, original cheek-pouch packing puzzle for the [Squeekchain Genesis Code lane](https://squeekchain.com/genesis/d4sp8cje). Open the site and Level 1 is ready to play. Pack sunflower seeds, hazelnuts, berries, clover, tiny treasures and paw biscuits through twelve authored puzzles.

The complete static site is in **`dist/`**, alongside the TypeScript source and npm lockfile. It uses relative asset URLs and works below an IPFS gateway subpath. No backend, wallet, account, signing, tokens, payments, prizes, contracts or transactions are involved.

## Install, run and rebuild

Use Node **22.18 or newer** and npm.

```sh
npm ci
npm run dev
```

To check and rebuild the production site:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Preview opens a lightweight static server at `http://localhost:4173`. `npm run preview` serves the existing `dist/`; it does not rebuild. The production build is Vite with `base: './'`. There are no runtime npm dependencies, remote fonts or remote artwork. Modern browsers with native HTML dialogs, ES modules and CSS grid are supported.

## Play

- Select a snack in the tray, select a grid square for its bounding box's top-left corner, then **Pack piece**. Empty parts of bent shapes may sit over previously packed snacks.
- **Rotate** changes orientation for free. With grid focus, arrow keys aim, **R** rotates, **Enter** packs and **U** undoes. Number keys **1–9, 0** select the corresponding tray piece. All actions also have touch controls; dragging is not required.
- Each pack uses one move. Select a packed snack **in the tray** and choose **Unpack piece** to remove it for one move; replacing it uses another. **Undo** restores the previous board, move count and seed state for free.
- Reach the fill goal and choose **Finish pouch**, or keep packing for more stars. A full pouch finishes automatically. With no legal fit or no moves, undo or restart; there is no dead end that requires a live connection.
- Levels 1–11 support all three star ratings in both live routes. The last level is a deliberate 100% challenge. Fill percentages are rounded for display; scoring uses exact square counts. The [level table](artifacts/levels.md) records thresholds and puzzle intent.
- Finish a level to unlock the next. Levels 5 and 9 unlock 5 × 5 and 6 × 6 pouches. Best stars, English/Chinese preference, sound preference and tutorial completion are saved in this browser. Every fresh page load starts at Level 1; use the level chooser to revisit unlocked pouches.
- Help opens the tutorial and About panel. Sound starts off and is synthesized locally after a gesture. Restart asks before discarding a started attempt. Escape closes dialogs and returns focus.

## Live Squeekchain integration

`src/live.ts` fetches **https://api.squeekchain.com/v1/status** approximately every **15 seconds after completion**. Requests omit credentials, have a **5-second abort timeout**, and never overlap. Failures back off to **30, 60, then 120 seconds**; a successful response resets the interval. Retry and returning to a visible tab can request a fresh reading.

Only `measurement.coreStatus` supplies the route. Only a present, finite, nonnegative numeric `measurement.rpmMilli` supplies the displayed speed, divided by 1,000; missing speed is labelled, never replaced with an invented value. Speed does not determine status or the size of the bonus. No other blockchain, identity, signer, builder or settlement fields are used.

The parser requires a valid `measurement.observedAt`. When provided, `measurement.freshness` must be `online`. Freshness uses a positive `staleAfterSeconds`, capped at 120 seconds; if absent, it uses 45 seconds. Invalid states, old observations, timestamps over ten seconds in the future, errors and timeouts enter **Practice mode**. The UI labels stale readings, retains the last observed timestamp when available, and links the source. Browser local time is displayed; the full ISO timestamp is available on the time element. Device clock accuracy affects freshness checks.

| At the first valid pack | Rules for that attempt |
| --- | --- |
| Fresh `SPINNING` | Two extra packing moves. Special Squeek seeds drop on moves 0, 1 and 2 as required by the level. Cover all of them as well as meeting the fill goal. |
| Fresh `IDLE` | Complete nap route, normal move budget. Ordinary seeds drop on moves 0, 2 and 4; collecting them is optional. |
| Unavailable or stale | Explicitly labelled practice mode with the complete nap-route rules. Local stars and progression still work. |

The route is **copied into the attempt on the first valid pack**. Later wheel changes, API failures and undoing back to an empty board do not change it. Restart/new level samples the latest valid status. Live telemetry continues updating independently, so the live wheel and a locked attempt may intentionally differ.

Drops are **move-based**, not wall-clock waits. This fits a turn-based puzzle and permits unlimited thinking time. A dropped seed that lands on an already packed square is immediately collected. Undo deterministically rolls back both arrivals and collections. This preserves solvability regardless of placement order. The energy bonus is useful for unpacking and repositioning a snack while retaining enough moves to fill the pouch.

The endpoint returned a genuine fresh `IDLE` reading with zero reported RPM during validation. Deterministic browser fixtures separately exercise spinning, missing data, stale data, timeout, HTTP failure, recovery and status changes. They are confined to tests; there is no fake live-data fallback or production route switch.

## Tests and actual validation

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium webkit
npm run build
npm run test:browser
npm run check:budget
```

The browser suite starts and closes its own server, serves the **production export under `/preview/`**, and tests primary interactions rather than source-only snapshots. Set `SQUEEK_BROWSER=chromium` for the Chromium-only suite. In environments with externally installed tools, `SQUEEK_PLAYWRIGHT` and `SQUEEK_AXE` can identify their module entry points.

Actual results, browser evidence, findings and limitations are recorded in [artifacts/validation.md](artifacts/validation.md). The final implementation has **88 passing engine/live/storage tests**, a passing production build and typecheck, and **16/16 taste@1 design checks**. The suite proves full solutions in spinning, nap and practice, both forward and reverse placement order; it also proves attainable bronze/silver outcomes on the first eleven levels. Browser tests walk all twelve levels, verify desktop keyboard and mobile touch controls, local progress, dialogs, language, reduced motion, 320px reflow, 200% text enlargement, API recovery and frozen rules. See the validation report for the final per-engine results.

The pinned design probe can be rerun while its provided inputs are available:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Those inputs and scratch output are not runtime dependencies. A retained report and selected real screenshots live in `artifacts/`.

## Source and design

| Path | Purpose |
| --- | --- |
| `src/levels.ts` | Authored tilings, rotated pieces, stitched corners and attainable star thresholds |
| `src/engine.ts` | Pure placement, movement, undo, seed and scoring rules |
| `src/live.ts` | Validated telemetry, freshness, timeout, polling and backoff |
| `src/main.ts` | Accessible DOM game, keyboard/touch controls and dialogs |
| `src/art.ts`, `src/style.css` | Original SVG illustrations and cream/brown/teal design |
| `src/i18n.ts`, `src/storage.ts` | English/Chinese text and defensive local persistence |
| `test/` | Delivered repeatable tests; `test/scratch/` is disposable |
| `public/` | Local favicon, editable social SVG and rendered share PNG |
| `dist/` | Finished static export to publish |

[DESIGN.md](DESIGN.md) documents the final implemented tokens, typography, components and responsive behavior. `node scripts/assets.mjs` recreates the editable social SVG; its 1200 × 630 PNG is included so the build needs no image generator or image-rendering service.

## Delivery and limitations

The assignment's publisher pins the submitted `dist/` to IPFS and assigns its URL **after submission**. No CID or public URL is available inside this workspace, and none is invented here. Upload the contents of `dist/` as one directory; preserve its `assets/` paths. No server rewrite or environment file is needed. The local subpath preview verifies packaging, not subsequent public gateway availability.

Once loaded, the puzzle remains playable if telemetry is offline. A first visit still needs the static files; this is not a service-worker offline installer. Data is local to the browser origin, not shared or portable between gateways; clearing browser storage removes it. An active board is not restored after reload. No leaderboard, badge or whitelist is promised.

Touch and accessibility checks use browser automation and actual rendered inspection. They are not physical iPhone/Android tests, a screen-reader session, a native OS zoom test, or independent certification. English and Simplified Chinese are supplied; no native-speaker translation review was performed. The read-only API and eventual IPFS gateway are external services whose future availability cannot be guaranteed.

Submission path allocations, including an explicit **512-byte budget for `.gitignore`**, are in [artifacts/submission-budget.json](artifacts/submission-budget.json). Generated dependencies/caches are excluded at every depth; no vendored registry, dependency archive or submodule is delivered. `npm run check:budget` verifies the required files, relative export URLs and total bundle size against 8 MiB.

Design guidance attribution: Jakub Krehel's Better Interface (MIT) and Paul Bakaus's Impeccable documentation guidance (Apache-2.0), at the pinned revisions supplied with this task. See [DESIGN.md](DESIGN.md) and [the retained license texts](artifacts/design-guidance-LICENSE.txt).

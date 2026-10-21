# UNBLOCK accessibility planner (Vite + React + three.js)

- UNBLOCK lives in `src/unblock/`: `engine.ts` (pure graph maths: barriers, reach, ranking, optimizer; pilot barriers are seeded and made up), `graph.ts` (pedestrian graph from OSM streets), `store.ts` (zustand, derived state recomputed on every change), `three/` (street network ribbons, barrier posts, pins, routes; reuses the twin's surface components), `ui/` (header, panels), `demo.ts` (the `#demo` story). Styles: `src/styles/unblock.css`. Logo: `public/logo.png` (from `Neon Accessible Route U Icon 1.png`).
- The old UnderGrid twin (`src/app/App.tsx`, agents, overlays, pipes) is still in `src/` but not routed.

- Dev: `npm run dev` (http://localhost:5173) · Types: `npm run typecheck` · Build: `npm run build` · Deploy: `npm run deploy`
- Routes (hash): `/` landing page, `/#app` the planner (`#twin` still works), `/#demo` the planner with the story auto-playing (`src/app/Root.tsx`).
- Hosting: Cloudflare Worker `unblock` (`wrangler.jsonc`, Awaiz Account) serves `dist/` at https://unblock.kanbanstudios.ae; `worker/index.ts` handles `/api/*`. The Qwen call lives in `server/ask.ts`, shared with the Vite middleware. Set the key with `npx wrangler secret put DASHSCOPE_API_KEY`.
- UI copy rule: plain words for non-experts; no all-caps labels (the brand name UNBLOCK is the exception). Tokens live in `src/styles/tokens.css`, overrides in `src/styles/undergrid.css`, agents panel styles in `src/styles/agents.css`, maps in `src/styles/geo.css`.

## Tailwind + shadcn (landing page only)

- Tailwind v4 via `@tailwindcss/vite`; entry `src/styles/tailwind.css`. No preflight (the twin keeps its own reset), utilities unlayered, and `source(none)` + explicit `@source` so only `src/components/ui` and `src/components/landing` are scanned. Keep twin class names out of those folders' Tailwind namespace.
- shadcn semantic colours (`bg-background`, `text-muted-foreground`, …) map onto UnderGrid tokens in `tailwind.css`; don't add a second palette. UnderGrid radius tokens are `--radius-panel/card/chip` (renamed so Tailwind's `rounded-lg` keeps its own scale).
- `components.json` is set up (alias `@/` → `src/`). The shadcn CLI ran out of memory on the dev machine and tried to install an npm package literally named `cn`; registry items were installed by hand from their registry JSON instead (`rail-toc` from swamimalode07/rare-ui, `springs` from Fluid Functionalism). Check what a registry item installs before running `add`.
- Motion tokens: `@/lib/springs` (fast / moderate / slow). The app root is wrapped in `MotionConfig reducedMotion="user"`.
- The landing scroll container is `.landing` (body never scrolls); scoped preflight in `src/components/landing/landing.css` uses `:where()` so utilities always win.

## Real map (downtown Abu Dhabi)

- `src/data/abudhabi.json` is generated, do not hand-edit. Rebuild it with:
  `node scripts/fetch-abudhabi.mjs abudhabi-osm.json` then `node scripts/build-abudhabi.mjs abudhabi-osm.json`.
  The Overpass server is often busy; the fetch script retries.
- The build rotates the map (never mirrors it) so Khalifa Street runs along z = 0 through the origin, where the demo leak is. The Corniche sea is on +z. 1 unit = 10 m.
- `src/data/geo.ts` holds the exact scene ↔ lon/lat inverse of that build; the map intro and location card (from the Al Danah reframe) rely on it, so change both together.
- Map data © OpenStreetMap contributors (ODbL) · Natural Earth. Keep the on-screen credit (`MAP_CREDIT`).
- Streets, buildings, parks and the coast are real. Pipes are laid under real streets (`src/data/networks.ts`), but their routes, the sensors, the crews and the incident are made up.
- Money is in AED (`formatMoney`).

## Agents

- Decisions are pure functions in `src/agents/brain.ts` (team in `team.ts`, crews in `crews.ts`), so pause/seek/replay stay exact.
- While they work the agents ask three multiple-choice questions (`questionsFor`: the fix, the road closure, who to tell), each with their pick marked and ruled-out choices shown disabled. The answers change the plan (`buildRun(policy, answers)`).
- Autonomy: Full auto (no questions) / With limits (default, AED 1M: a 9 s countdown, then the agents go with their pick, unless it breaks a limit and the clock waits) / Ask me (every question waits). `SimulationDriver` holds the clock on each question; `seek` takes the agents' pick for countdown questions and stops at ones that wait.
- The agents panel is a dropdown that opens when a run starts and shows the live trace (each step's sub-steps appear as the clock runs). The camera views sit as a row above it (on the map in compact layouts).
- "Ask the agents": `POST /api/ask` is a Vite dev/preview middleware in `vite.config.ts`. It sends the run's facts to Qwen (Alibaba Cloud Model Studio) with the key from `.env.local` (`DASHSCOPE_API_KEY`, `DASHSCOPE_BASE_URL`, `QWEN_MODEL`; see `.env.example`). The key never reaches the browser. Without it, `src/agents/ask.ts` answers from built-in rules. Qwen explains; it never approves or changes a decision.

## Crew drive and traffic

- The crew route is the shortest drive on the real street graph (one-way streets cost 6×, never through the dig site), offset into the right-hand lane, slowing for corners (`src/data/incident.ts`, `src/three/RepairRoute.tsx`). The camera follows via `src/simulation/crew.ts`.
- Traffic (`src/three/AbuDhabiTraffic.tsx`) keeps right, follows one-way rules, turns at real junctions, avoids the dig site and speeds up during the fast-forwarded drive (`fastForwardAt`).

## Visual QA

- UNBLOCK: in dev, `await import('/src/unblock/store.ts')` gives `useUnblock` (wait for `ready`, then `setMode`, `focus(x,z,dist)`, `toggleRepair`, `runPlan`, `applyPlan`) and `world`.
- Headless screenshots need real-time waits (shader warm-up). Drive Chrome over CDP and use the dev hooks: `window.__dev.store.getState()` (`setBoot('ready')`, `run()`, `seek(t)`, `setSpendLimit(v)`), `__dev.runtime.t`, `__mapIntroAt(ms)` for the map intro.

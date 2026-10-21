# UNBLOCK

**Track 3: Geospatial Intelligence for Action**

> UNBLOCK finds the invisible barriers dividing our cities, and identifies the smallest infrastructure changes that unlock the greatest access to essential services.

Live: https://unblock.kanbanstudios.ae

---

## The problem

Someone using a wheelchair wants to reach a nearby hospital. The map shows a 600 m walk. But on that walk there is a flight of stairs, a missing curb ramp or a crossing with a high kerb. For that person the hospital might as well be miles away.

Now a city has money to fix only three barriers this year. Which three should it fix first? UNBLOCK answers that question.

## What it does

1. **Accessibility map.** A 3D map of downtown Abu Dhabi. Every street is coloured by whether a wheelchair user can reach a service (hospital, school, mosque, shops) step-free within the trip limit (800 m by default), is cut off by a barrier, or is too far anyway.
2. **Barrier intelligence.** 45 barriers in the pilot area: stairs with no ramp, missing curb ramps, crossings without a safe kerb, blocked or broken sidewalks. Each has a source: checked on site, reported by a resident, or flagged in a photo by AI and waiting for a person to check it.
3. **Counterfactual simulator.** Click **Repair** on any barrier. UNBLOCK recomputes every step-free route on the street graph and the network redraws, rippling out from the repair.
4. **Infrastructure optimizer.** Set a budget (AED 100K to 2M). The optimizer picks repairs by access gained per dirham. It re-runs the routes after every pick and tries nearby pairs, so it finds barriers that only matter together, then runs a swap pass. It is compared side by side with the common baseline, "cheapest first". In the pilot it gets about 2× the access for the same money.
5. **Impact dashboard.** Share of homes that can reach each kind of service (before → after), homes newly in reach of a hospital, average detour, services nobody can reach, and the uncertainty from unchecked reports.

### Demo flow (`/#demo` plays it automatically)

Journey check → a home 600 m from Al Ahalia Hospital → the step-free route is 1.7 km because of one flight of stairs → repair it → 600 m. Then the city planner → the top-ranked repair → the network redraws → set a budget → the optimizer picks a better combination than cheapest first.

## How the numbers are computed

- **Graph:** the real OpenStreetMap street network (887 segments, 750 junctions). Shared OSM node ids are real junctions. Tunnels are left out.
- **Barriers** block a junction (curb ramp, crossing) or one stretch of sidewalk (stairs, blocked sidewalk).
- **Reach:** Dijkstra from each of the 27 services with a trip-length cutoff. A home reaches a service if the step-free route is within the limit.
- **Access points:** each home scores hospital ×3 (first one), school ×2, mosque and shops ×1 (up to two each). With the fairness slider, homes with the least access today count up to 3× more.
- **Costs** are assumed ranges per barrier type, on screen under "Assumptions and data".

Everything is a pure function in [`src/unblock/engine.ts`](src/unblock/engine.ts), so results are exact and repeatable.

## What is real and what is not

- **Real:** streets, buildings, hospitals, schools, mosques and malls of downtown Abu Dhabi (© OpenStreetMap contributors, ODbL), and every route.
- **Made up for the pilot:** the barriers, their repair costs and who reported them, generated from a fixed seed. All results illustrate the method. They are not measured results. A real deployment would load survey data, resident reports or open data such as [Project Sidewalk](https://github.com/ProjectSidewalk/SidewalkWebpage).
- Accessible routing itself is not new: [AccessMap](https://www.accessmap.app/) by the Taskar Center already does personalised accessible navigation. UNBLOCK's contribution is deciding **what to repair** under a budget and measuring the improvement.

## Stack

Vite + React 19 + TypeScript, three.js via @react-three/fiber, zustand, Tailwind v4 (landing page). Served from a Cloudflare Worker.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
npm run deploy     # Cloudflare Worker "unblock"
```

Routes: `/` landing page · `/#app` the planner · `/#demo` the planner playing the story.

UNBLOCK grew out of UnderGrid, an earlier 3D twin of the same district. The `src/three` surface components (buildings, sea, palms, lights) are reused from it, and the original twin code is still in `src/` but no longer routed.

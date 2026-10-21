import { AD, type AdKind } from '../data/abudhabi';
import { mulberry32, hashString } from '../data/rng';
import { buildGraph, nearestNode, pathEdges, shortest, type PedGraph } from './graph';

/**
 * UNBLOCK engine: who can reach which essential services by wheelchair, which barriers stop them,
 * and which repairs give back the most access for the money.
 *
 * Streets, buildings, hospitals, schools, mosques and malls are real (OpenStreetMap). The barriers,
 * their costs and the survey status are a made-up pilot dataset, generated from a fixed seed so the
 * numbers are the same on every load. Everything here is a pure function of (repaired set, settings).
 */

/* ------------------------------------------------------------------ */
/* Settings and assumptions                                            */
/* ------------------------------------------------------------------ */

/** A trip counts as reachable when the step-free route is at most this long (about 13 minutes by wheelchair). */
export const DEFAULT_MAX_TRIP_M = 800;

export type Category = 'hospital' | 'school' | 'mosque' | 'mall';

export const CATEGORY: Record<Category, { label: string; plural: string; weight: number }> = {
  hospital: { label: 'Hospital', plural: 'Hospitals', weight: 3 },
  school: { label: 'School', plural: 'Schools', weight: 2 },
  mosque: { label: 'Mosque', plural: 'Mosques', weight: 1 },
  mall: { label: 'Shops', plural: 'Shops and malls', weight: 1 },
};

export type BarrierKind = 'stairs' | 'curb' | 'crossing' | 'blocked';

/** Unit costs are planning assumptions in AED, not quotes. */
export const BARRIER_KIND: Record<BarrierKind, { label: string; fix: string; cost: [number, number] }> = {
  stairs: { label: 'Stairs, no ramp', fix: 'Build a ramp', cost: [180_000, 320_000] },
  curb: { label: 'Missing curb ramp', fix: 'Cut a curb ramp', cost: [12_000, 26_000] },
  crossing: { label: 'Crossing without a safe kerb', fix: 'Raise the crossing', cost: [70_000, 140_000] },
  blocked: { label: 'Sidewalk blocked or broken', fix: 'Clear and resurface', cost: [35_000, 80_000] },
};

export type Source = 'survey' | 'report' | 'photo';

export const SOURCE: Record<Source, { label: string; verified: boolean }> = {
  survey: { label: 'Checked on site', verified: true },
  report: { label: 'Reported by a resident', verified: false },
  photo: { label: 'Flagged in a photo by AI, needs a check', verified: false },
};

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

export interface Destination {
  id: number;
  name: string;
  cat: Category;
  x: number;
  z: number;
  node: number;
}

export interface Home {
  id: number;
  x: number;
  z: number;
  node: number;
  /** how many households this building stands for (bigger towers count more) */
  w: number;
}

export interface Barrier {
  id: number;
  code: string;
  kind: BarrierKind;
  source: Source;
  /** blocks a junction (curb, crossing) or one stretch of sidewalk (stairs, blocked) */
  node: number;
  edge: number;
  x: number;
  z: number;
  street: string;
  cost: number;
}

export interface World {
  g: PedGraph;
  destinations: Destination[];
  homes: Home[];
  barriers: Barrier[];
  /** the demo journey: a home about 600 m from Al Ahalia Hospital, cut off by stairs */
  story: { home: number; destination: number; barrier: number };
}

const CAT_OF: Partial<Record<AdKind, Category>> = { hospital: 'hospital', school: 'school', mosque: 'mosque', mall: 'mall' };
const HOME_KINDS: AdKind[] = ['residential', 'house', 'tower'];

function buildWorld(): World {
  const g = buildGraph();
  const walkable = (n: { id: number }) => g.adj[n.id].length > 0;

  const destinations: Destination[] = [];
  for (const b of AD.buildings) {
    const cat = CAT_OF[b.k];
    if (!cat) continue;
    const name = b.n || `${CATEGORY[cat].label} on ${g.nodes[nearestNode(g, b.c[0], b.c[1], walkable)].streets[0] ?? 'a side street'}`;
    destinations.push({ id: destinations.length, name, cat, x: b.c[0], z: b.c[1], node: nearestNode(g, b.c[0], b.c[1], walkable) });
  }

  const homes: Home[] = [];
  for (const b of AD.buildings) {
    if (!HOME_KINDS.includes(b.k)) continue;
    homes.push({ id: homes.length, x: b.c[0], z: b.c[1], node: nearestNode(g, b.c[0], b.c[1], walkable), w: b.k === 'tower' ? 2 : 1 });
  }

  // --- the pilot barrier dataset (made up, seeded) ---
  const rng = mulberry32(hashString('unblock-pilot-v1'));
  const barriers: Barrier[] = [];
  const usedNodes = new Set<number>();
  const usedEdges = new Set<number>();
  const costOf = (kind: BarrierKind) => {
    const [lo, hi] = BARRIER_KIND[kind].cost;
    return Math.round((lo + (hi - lo) * rng()) / 1000) * 1000;
  };
  const sourceOf = (): Source => {
    const r = rng();
    return r < 0.55 ? 'survey' : r < 0.82 ? 'report' : 'photo';
  };
  const add = (kind: BarrierKind, node: number, edge: number, source = sourceOf()) => {
    const x = edge >= 0 ? (g.nodes[g.edges[edge].a].x + g.nodes[g.edges[edge].b].x) / 2 : g.nodes[node].x;
    const z = edge >= 0 ? (g.nodes[g.edges[edge].a].z + g.nodes[g.edges[edge].b].z) / 2 : g.nodes[node].z;
    const street = edge >= 0 ? g.edges[edge].street : g.nodes[node].streets.join(' / ');
    if (node >= 0) usedNodes.add(node);
    if (edge >= 0) usedEdges.add(edge);
    barriers.push({ id: barriers.length, code: `B-${String(barriers.length + 1).padStart(2, '0')}`, kind, source, node, edge, x, z, street: street || 'Side street', cost: costOf(kind) });
    return barriers.length - 1;
  };

  // junctions where three or more streets meet are where curb ramps and crossings go missing
  const junctions = g.nodes.filter((n) => g.adj[n.id].length >= 3);
  const majorAt = (id: number) => g.adj[id].some(([e]) => ['trunk', 'primary'].includes(g.edges[e].cls));
  for (const n of junctions) {
    if (usedNodes.has(n.id) || destinations.some((d) => d.node === n.id)) continue;
    if (rng() < 0.11) add(majorAt(n.id) ? 'crossing' : 'curb', n.id, -1);
  }
  for (const e of g.edges) {
    if (usedEdges.has(e.id) || e.len < 25) continue;
    if (rng() < 0.03) add(rng() < 0.2 ? 'stairs' : 'blocked', -1, e.id);
  }

  // the story: a home about 600 m from Al Ahalia Hospital whose only short route is cut by one flight of stairs
  const hospital = destinations.find((d) => /Al Ahalia/.test(d.name)) ?? destinations.find((d) => d.cat === 'hospital')!;
  const nodesOf = (list: Barrier[]) => {
    const n = new Uint8Array(g.nodes.length);
    const e = new Uint8Array(g.edges.length);
    for (const b of list) {
      if (b.node >= 0) n[b.node] = 1;
      if (b.edge >= 0) e[b.edge] = 1;
    }
    return { n, e };
  };
  const none = new Uint8Array(g.nodes.length);
  const noneE = new Uint8Array(g.edges.length);
  const prev = new Int32Array(g.nodes.length);
  const fromHospital = shortest(g, hospital.node, none, noneE, Infinity, prev);
  const current = nodesOf(barriers);
  let story = { home: homes[0].id, edge: -1, score: Infinity };
  for (const h of homes) {
    const walk = fromHospital[h.node];
    if (walk < 480 || walk > 700) continue;
    const path = pathEdges(g, prev, h.node);
    const pathNodes = path.flatMap((e) => [g.edges[e].a, g.edges[e].b]);
    if (path.some((e) => current.e[e]) || pathNodes.some((n) => current.n[n])) continue;
    if (shortest(g, hospital.node, current.n, current.e)[h.node] > walk + 1) continue;
    for (const e of path.slice(2, -2)) {
      if (g.edges[e].len < 20) continue;
      current.e[e] = 1;
      const cut = shortest(g, hospital.node, current.n, current.e)[h.node];
      current.e[e] = 0;
      if (cut <= DEFAULT_MAX_TRIP_M * 1.4) continue;
      const score = Math.abs(walk - 600) - Math.min(cut, 3000) / 100;
      if (score < story.score) story = { home: h.id, edge: e, score };
    }
  }
  const storyBarrier = add('stairs', -1, story.edge, 'survey');
  const storyHome = homes[story.home];

  return { g, destinations, homes, barriers, story: { home: storyHome.id, destination: hospital.id, barrier: storyBarrier } };
}

let world: World | null = null;
export function getWorld() {
  return (world ??= buildWorld());
}

/* ------------------------------------------------------------------ */
/* Access                                                              */
/* ------------------------------------------------------------------ */

export interface Settings {
  maxTripM: number;
  /** 0 = every household counts the same, 1 = households with the least access count up to 3× more */
  equity: number;
  /** count barriers nobody has checked on site yet */
  includeUnverified: boolean;
}

export const DEFAULT_SETTINGS: Settings = { maxTripM: DEFAULT_MAX_TRIP_M, equity: 0.5, includeUnverified: true };

function blocks(w: World, repaired: ReadonlySet<number>, s: Settings) {
  const nodes = new Uint8Array(w.g.nodes.length);
  const edges = new Uint8Array(w.g.edges.length);
  for (const b of w.barriers) {
    if (repaired.has(b.id)) continue;
    if (!s.includeUnverified && !SOURCE[b.source].verified) continue;
    if (b.node >= 0) nodes[b.node] = 1;
    if (b.edge >= 0) edges[b.edge] = 1;
  }
  return { nodes, edges };
}

export interface Access {
  /** per destination, step-free metres from every node (Infinity past the trip limit) */
  dist: Float64Array[];
  /** per home, how many destinations of each category are in reach */
  reach: Record<Category, number>[];
}

export function computeAccess(w: World, repaired: ReadonlySet<number>, s: Settings): Access {
  const bl = blocks(w, repaired, s);
  const dist = w.destinations.map((d) => shortest(w.g, d.node, bl.nodes, bl.edges, s.maxTripM));
  const reach = w.homes.map((h) => {
    const r: Record<Category, number> = { hospital: 0, school: 0, mosque: 0, mall: 0 };
    w.destinations.forEach((d, i) => {
      if (dist[i][h.node] <= s.maxTripM) r[d.cat]++;
    });
    return r;
  });
  return { dist, reach };
}

/** The same with no barriers at all: what an able-bodied walker gets. */
let openCache: { key: string; a: Access } | null = null;
export function openAccess(w: World, s: Settings) {
  const key = String(s.maxTripM);
  if (openCache?.key !== key) {
    const all = new Set(w.barriers.map((b) => b.id));
    openCache = { key, a: computeAccess(w, all, s) };
  }
  return openCache.a;
}

const homeScore = (r: Record<Category, number>) =>
  (Object.keys(CATEGORY) as Category[]).reduce((sum, c) => sum + CATEGORY[c].weight * Math.min(r[c], c === 'hospital' ? 1 : 2), 0);

/** Household weights for the equity setting: worst-served homes (under the current barriers) count more. */
export function homeWeights(w: World, s: Settings) {
  const base = computeAccess(w, new Set(), s);
  const open = openAccess(w, s);
  return w.homes.map((h, i) => {
    const have = homeScore(base.reach[i]);
    const could = Math.max(1, homeScore(open.reach[i]));
    return h.w * (1 + 2 * s.equity * (1 - have / could));
  });
}

/** Access score: weighted count of (household, service) links within the trip limit. Diminishing returns per category. */
export function scoreOf(a: Access, weights: number[]) {
  return a.reach.reduce((sum, r, i) => sum + weights[i] * homeScore(r), 0);
}

export interface Summary {
  score: number;
  /** share of households that can reach each category */
  share: Record<Category, number>;
  /** destinations no household can reach step-free */
  cutOff: number[];
  /** households that can reach at least one hospital */
  hospitalHomes: number;
  /** mean extra metres the step-free route adds, over trips that stay possible */
  detourM: number;
}

export function summarize(w: World, a: Access, weights: number[], s: Settings): Summary {
  const open = openAccess(w, s);
  const share = { hospital: 0, school: 0, mosque: 0, mall: 0 } as Record<Category, number>;
  let total = 0;
  w.homes.forEach((h, i) => {
    total += h.w;
    for (const c of Object.keys(share) as Category[]) if (a.reach[i][c] > 0) share[c] += h.w;
  });
  for (const c of Object.keys(share) as Category[]) share[c] /= total;
  const cutOff = w.destinations.filter((_, i) => !w.homes.some((h) => a.dist[i][h.node] <= s.maxTripM)).map((d) => d.id);
  let extra = 0;
  let trips = 0;
  w.destinations.forEach((_, i) => {
    for (const h of w.homes) {
      const d = a.dist[i][h.node];
      const o = open.dist[i][h.node];
      if (d <= s.maxTripM && o <= s.maxTripM) {
        extra += d - o;
        trips++;
      }
    }
  });
  return {
    score: scoreOf(a, weights),
    share,
    cutOff,
    hospitalHomes: w.homes.filter((_, i) => a.reach[i].hospital > 0).length,
    detourM: trips ? extra / trips : 0,
  };
}

/* ------------------------------------------------------------------ */
/* One journey                                                         */
/* ------------------------------------------------------------------ */

export interface Journey {
  /** the shortest walk, ignoring barriers */
  walkM: number;
  walkEdges: number[];
  /** the shortest step-free route (Infinity when there is none at any length) */
  stepFreeM: number;
  stepFreeEdges: number[];
  /** barriers on the plain walking route */
  blockers: number[];
}

export function journey(w: World, homeId: number, destId: number, repaired: ReadonlySet<number>, s: Settings): Journey {
  const g = w.g;
  const home = w.homes[homeId];
  const dest = w.destinations[destId];
  const prev = new Int32Array(g.nodes.length);
  const none = new Uint8Array(g.nodes.length);
  const noneE = new Uint8Array(g.edges.length);
  const walk = shortest(g, home.node, none, noneE, Infinity, prev);
  const walkEdges = pathEdges(g, prev, dest.node);
  const bl = blocks(w, repaired, s);
  const sf = shortest(g, home.node, bl.nodes, bl.edges, Infinity, prev);
  const stepFreeEdges = sf[dest.node] < Infinity ? pathEdges(g, prev, dest.node) : [];
  const onWalk = new Set(walkEdges);
  const walkNodes = new Set(walkEdges.flatMap((e) => [g.edges[e].a, g.edges[e].b]));
  const blockers = w.barriers
    .filter((b) => (b.edge >= 0 && onWalk.has(b.edge) && bl.edges[b.edge]) || (b.node >= 0 && walkNodes.has(b.node) && bl.nodes[b.node]))
    .map((b) => b.id);
  return { walkM: walk[dest.node], walkEdges, stepFreeM: sf[dest.node], stepFreeEdges, blockers };
}

/* ------------------------------------------------------------------ */
/* Ranking and the budget optimizer                                    */
/* ------------------------------------------------------------------ */

export interface Ranked {
  id: number;
  gain: number;
  perMillion: number;
}

/** Gain of each single repair on top of `repaired`, best value for money first. */
export function rankRepairs(w: World, repaired: ReadonlySet<number>, s: Settings, weights: number[]): Ranked[] {
  const base = scoreOf(computeAccess(w, repaired, s), weights);
  const out: Ranked[] = [];
  for (const b of w.barriers) {
    if (repaired.has(b.id)) continue;
    if (!s.includeUnverified && !SOURCE[b.source].verified) continue;
    const next = new Set(repaired);
    next.add(b.id);
    const gain = scoreOf(computeAccess(w, next, s), weights) - base;
    out.push({ id: b.id, gain, perMillion: (gain / b.cost) * 1e6 });
  }
  return out.sort((a, b) => b.perMillion - a.perMillion || b.gain - a.gain);
}

export interface Plan {
  method: string;
  picks: number[];
  cost: number;
  gain: number;
}

const planCost = (w: World, ids: Iterable<number>) => [...ids].reduce((c, id) => c + w.barriers[id].cost, 0);

/** What many cities do today: fix the cheapest problems first until the money runs out. */
export function cheapestFirst(w: World, budget: number, s: Settings, weights: number[], fixed: ReadonlySet<number> = new Set()): Plan {
  const base = scoreOf(computeAccess(w, fixed, s), weights);
  const picks: number[] = [];
  let spent = 0;
  const pool = w.barriers.filter((b) => !fixed.has(b.id) && (s.includeUnverified || SOURCE[b.source].verified)).sort((a, b) => a.cost - b.cost);
  for (const b of pool) {
    if (spent + b.cost > budget) continue;
    picks.push(b.id);
    spent += b.cost;
  }
  const gain = scoreOf(computeAccess(w, new Set([...fixed, ...picks]), s), weights) - base;
  return { method: 'Cheapest first', picks, cost: spent, gain };
}

/**
 * UNBLOCK's plan: greedy on access gained per dirham, recomputed on the real network after every pick
 * (so two repairs that only help together are found as a pair), then a swap pass that trades one
 * picked repair for one or two others when that buys more access for the same budget.
 */
export function optimize(w: World, budget: number, s: Settings, weights: number[], fixed: ReadonlySet<number> = new Set()): Plan {
  const pool = w.barriers.filter((b) => !fixed.has(b.id) && (s.includeUnverified || SOURCE[b.source].verified));
  const evalSet = (ids: number[]) => scoreOf(computeAccess(w, new Set([...fixed, ...ids]), s), weights);
  const base = evalSet([]);
  const near = (a: Barrier, b: Barrier) => Math.hypot(a.x - b.x, a.z - b.z) < 30;

  let picks: number[] = [];
  let score = base;
  let spent = 0;
  for (;;) {
    let best: { ids: number[]; score: number; ratio: number } | null = null;
    const free = pool.filter((b) => !picks.includes(b.id));
    for (const b of free) {
      if (spent + b.cost > budget) continue;
      const sc = evalSet([...picks, b.id]);
      const ratio = (sc - score) / b.cost;
      if (sc > score && (!best || ratio > best.ratio)) best = { ids: [b.id], score: sc, ratio };
    }
    // pairs of nearby barriers that block the same detour: neither helps alone
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i];
        const b = free[j];
        if (!near(a, b) || spent + a.cost + b.cost > budget) continue;
        const sc = evalSet([...picks, a.id, b.id]);
        const ratio = (sc - score) / (a.cost + b.cost);
        if (sc > score && (!best || ratio > best.ratio)) best = { ids: [a.id, b.id], score: sc, ratio };
      }
    }
    if (!best) break;
    picks = [...picks, ...best.ids];
    score = best.score;
    spent = planCost(w, picks);
  }

  // swap pass
  let improved = true;
  let rounds = 0;
  while (improved && rounds++ < 3) {
    improved = false;
    for (const out of [...picks]) {
      const rest = picks.filter((id) => id !== out);
      const room = budget - planCost(w, rest);
      for (const b of pool) {
        if (picks.includes(b.id) || b.cost > room) continue;
        const sc = evalSet([...rest, b.id]);
        if (sc > score + 1e-9) {
          picks = [...rest, b.id];
          score = sc;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return { method: 'UNBLOCK optimizer', picks, cost: planCost(w, picks), gain: score - base };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatAed(v: number) {
  if (v >= 1e6) return `AED ${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (v >= 1e3) return `AED ${Math.round(v / 1e3)}K`;
  return `AED ${Math.round(v)}`;
}

export const formatM = (m: number) => (m === Infinity ? 'no route' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

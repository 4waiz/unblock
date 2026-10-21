import { AD, type XZ } from '../data/abudhabi';

/**
 * Pedestrian network for UNBLOCK, built from the real OpenStreetMap streets of downtown Abu Dhabi.
 * Every street centreline is treated as walkable on its sidewalks; shared OSM node ids are real
 * junctions. Tunnels / underpasses are left out (no sidewalk). Scene units: 1 = 10 m.
 */

export interface PedNode {
  id: number;
  x: number;
  z: number;
  /** street names touching this node */
  streets: string[];
}

export interface PedEdge {
  id: number;
  a: number;
  b: number;
  /** metres */
  len: number;
  street: string;
  cls: string;
}

export interface PedGraph {
  nodes: PedNode[];
  edges: PedEdge[];
  /** node → [edge id, other node][] */
  adj: [number, number][][];
}

const M_PER_UNIT = AD.meta.unitMeters;

export function buildGraph(): PedGraph {
  const nodes: PedNode[] = [];
  const edges: PedEdge[] = [];
  const byKey = new Map<string, number>();

  const nodeFor = (key: string, p: XZ, street: string) => {
    let id = byKey.get(key);
    if (id === undefined) {
      id = nodes.length;
      byKey.set(key, id);
      nodes.push({ id, x: p[0], z: p[1], streets: [] });
    }
    const n = nodes[id];
    if (street && !n.streets.includes(street)) n.streets.push(street);
    return id;
  };

  for (const road of AD.roads) {
    if (road.t) continue;
    let prev = -1;
    road.p.forEach((p, i) => {
      const id = nodeFor(road.k[i], p, road.n);
      if (prev >= 0 && prev !== id) {
        const a = nodes[prev];
        const len = Math.hypot(a.x - p[0], a.z - p[1]) * M_PER_UNIT;
        edges.push({ id: edges.length, a: prev, b: id, len, street: road.n, cls: road.c });
      }
      prev = id;
    });
  }

  const adj: [number, number][][] = nodes.map(() => []);
  for (const e of edges) {
    adj[e.a].push([e.id, e.b]);
    adj[e.b].push([e.id, e.a]);
  }
  return { nodes, edges, adj };
}

export function nearestNode(g: PedGraph, x: number, z: number, usable?: (n: PedNode) => boolean) {
  let best = -1;
  let bestD = Infinity;
  for (const n of g.nodes) {
    if (g.adj[n.id].length === 0 || (usable && !usable(n))) continue;
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}

/** Binary-heap Dijkstra from one source. Blocked nodes / edges are impassable; stops past `cutoff` metres. */
export function shortest(
  g: PedGraph,
  src: number,
  blockedNodes: Uint8Array,
  blockedEdges: Uint8Array,
  cutoff = Infinity,
  prev?: Int32Array,
): Float64Array {
  const dist = new Float64Array(g.nodes.length).fill(Infinity);
  if (blockedNodes[src]) return dist;
  dist[src] = 0;
  if (prev) prev.fill(-1);
  const heap: number[] = [src];
  const hd: number[] = [0];
  const push = (n: number, d: number) => {
    let i = heap.length;
    heap.push(n);
    hd.push(d);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= d) break;
      heap[i] = heap[p];
      hd[i] = hd[p];
      i = p;
    }
    heap[i] = n;
    hd[i] = d;
  };
  const pop = () => {
    const top = heap[0];
    const topD = hd[0];
    const ln = heap.pop()!;
    const ld = hd.pop()!;
    if (heap.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= heap.length) break;
        const r = l + 1;
        const c = r < heap.length && hd[r] < hd[l] ? r : l;
        if (hd[c] >= ld) break;
        heap[i] = heap[c];
        hd[i] = hd[c];
        i = c;
      }
      heap[i] = ln;
      hd[i] = ld;
    }
    return [top, topD] as const;
  };
  while (heap.length) {
    const [n, d] = pop();
    if (d > dist[n]) continue;
    for (const [eid, m] of g.adj[n]) {
      if (blockedEdges[eid] || blockedNodes[m]) continue;
      const nd = d + g.edges[eid].len;
      if (nd < dist[m] && nd <= cutoff) {
        dist[m] = nd;
        if (prev) prev[m] = eid;
        push(m, nd);
      }
    }
  }
  return dist;
}

/** Edge ids from the Dijkstra source to `target`, using the `prev` array that `shortest` filled. */
export function pathEdges(g: PedGraph, prev: Int32Array, target: number) {
  const out: number[] = [];
  let n = target;
  while (prev[n] >= 0) {
    const e = g.edges[prev[n]];
    out.push(e.id);
    n = e.a === n ? e.b : e.a;
  }
  return out.reverse();
}

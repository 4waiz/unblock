import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OctahedronGeometry, Quaternion, RingGeometry, Vector3 } from 'three';
import { Accessibility, Footprints, GraduationCap, Hospital, House, Landmark, ShoppingBag } from 'lucide-react';
import { BARRIER_KIND, CATEGORY, SOURCE, type Category } from '../engine';
import { useUnblock, world } from '../store';

const OPEN = new Color('#ff6a4d');
const UNVERIFIED = new Color('#f5b544');
const FIXED = new Color('#34d399');
const PLANNED = new Color('#4fd1e8');

const m = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const sc = new Vector3();

/** One post per barrier on the street, coloured by status; click to inspect, the panel repairs it. */
export function Barriers() {
  const posts = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const repaired = useUnblock((s) => s.repaired);
  const selected = useUnblock((s) => s.selected);
  const hover = useUnblock((s) => s.hoverBarrier);
  const plan = useUnblock((s) => s.plan);
  const includeUnverified = useUnblock((s) => s.settings.includeUnverified);
  const select = useUnblock((s) => s.select);
  const setHover = useUnblock((s) => s.setHoverBarrier);
  const n = world.barriers.length;
  const postGeo = useMemo(() => new CylinderGeometry(0.32, 0.32, 4.2, 8).translate(0, 2.1, 0), []);
  const capGeo = useMemo(() => new OctahedronGeometry(1.15).translate(0, 5.2, 0), []);
  const mat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const capMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const pulse = useRef(0);

  useLayoutEffect(() => {
    const planned = new Set(plan?.optimizer.picks ?? []);
    const fixed = new Set(repaired);
    world.barriers.forEach((b, i) => {
      const ignored = !includeUnverified && !SOURCE[b.source].verified;
      const c = fixed.has(b.id) ? FIXED : planned.has(b.id) ? PLANNED : SOURCE[b.source].verified ? OPEN : UNVERIFIED;
      const col = ignored ? c.clone().multiplyScalar(0.25) : c;
      posts.current?.setColorAt(i, col);
      caps.current?.setColorAt(i, col.clone().multiplyScalar(1.6));
    });
    if (posts.current?.instanceColor) posts.current.instanceColor.needsUpdate = true;
    if (caps.current?.instanceColor) caps.current.instanceColor.needsUpdate = true;
  }, [repaired, plan, includeUnverified]);

  useFrame((_, dt) => {
    pulse.current += dt;
    world.barriers.forEach((b, i) => {
      const on = b.id === selected || b.id === hover;
      // a quick pop when a barrier gets repaired
      const at = useUnblock.getState().repairedAt[b.id];
      const age = at === undefined ? Infinity : performance.now() - at;
      const pop = age < 650 ? 1 + 0.9 * Math.sin((Math.PI * age) / 650) : 1;
      const s = (on ? 1.45 + Math.sin(pulse.current * 5) * 0.08 : 1) * pop;
      p.set(b.x, 0, b.z);
      sc.set(s, s, s);
      m.compose(p, q, sc);
      posts.current?.setMatrixAt(i, m);
      caps.current?.setMatrixAt(i, m);
    });
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
    if (caps.current) caps.current.instanceMatrix.needsUpdate = true;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined || e.delta > 4) return;
    e.stopPropagation();
    select(world.barriers[e.instanceId].id);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId === undefined) return;
    e.stopPropagation();
    setHover(world.barriers[e.instanceId].id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    setHover(null);
    document.body.style.cursor = '';
  };

  const mode = useUnblock((s) => s.mode);
  const blocker = useUnblock((s) => s.trip.blockers[0] ?? null);
  const label = hover ?? selected ?? (mode === 'journey' ? blocker : null);
  const lb = label !== null ? world.barriers[label] : null;

  return (
    <group>
      <instancedMesh ref={posts} args={[postGeo, mat, n]} onClick={onClick} onPointerMove={onMove} onPointerOut={onOut} frustumCulled={false} />
      <instancedMesh ref={caps} args={[capGeo, capMat, n]} onClick={onClick} onPointerMove={onMove} onPointerOut={onOut} frustumCulled={false} />
      {lb && (
        <Html position={[lb.x, 7.2, lb.z]} center zIndexRange={[30, 30]} style={{ pointerEvents: 'none' }}>
          <div className={`ub-tag ${repaired.includes(lb.id) ? 'is-fixed' : ''}`}>
            <b>{lb.code}</b> {repaired.includes(lb.id) ? 'Repaired' : BARRIER_KIND[lb.kind].label}
          </div>
        </Html>
      )}
    </group>
  );
}

const ICON: Record<Category, typeof Hospital> = { hospital: Hospital, school: GraduationCap, mosque: Landmark, mall: ShoppingBag };

/** Essential services as pins. In a journey the chosen one is highlighted; elsewhere they show if anyone can reach them. */
export function Places() {
  const mode = useUnblock((s) => s.mode);
  const coverage = useUnblock((s) => s.coverage);
  const destination = useUnblock((s) => s.destination);
  const access = useUnblock((s) => s.access);
  const maxTrip = useUnblock((s) => s.settings.maxTripM);
  const home = useUnblock((s) => s.home);
  const setDestination = useUnblock((s) => s.setDestination);
  const h = world.homes[home];

  return (
    <group>
      {world.destinations.map((d) => {
        if (mode === 'planner' && coverage !== 'all' && d.cat !== coverage) return null;
        if (mode === 'journey' && d.cat === 'mosque' && d.id !== destination) return null;
        const reach = mode === 'journey' ? access.dist[d.id][h.node] <= maxTrip : world.homes.some((x) => access.dist[d.id][x.node] <= maxTrip);
        const Icon = ICON[d.cat];
        const on = mode === 'journey' && d.id === destination;
        return (
          <Html key={d.id} position={[d.x, d.cat === 'hospital' ? 9 : 5, d.z]} center zIndexRange={[on ? 25 : 20, on ? 25 : 20]}>
            <button
              className={`ub-pin cat-${d.cat} ${reach ? 'is-reach' : 'is-cut'} ${on ? 'is-on' : ''}`}
              onClick={() => mode === 'journey' && setDestination(d.id)}
              title={`${d.name} · ${CATEGORY[d.cat].label}`}
            >
              <Icon size={on ? 15 : 12} />
              {(on || d.cat === 'hospital') && <span>{d.name}</span>}
            </button>
          </Html>
        );
      })}
    </group>
  );
}

/** The home the journey starts from. */
export function HomePin() {
  const mode = useUnblock((s) => s.mode);
  const home = useUnblock((s) => s.home);
  if (mode !== 'journey') return null;
  const h = world.homes[home];
  return (
    <Html position={[h.x, 5, h.z]} center zIndexRange={[26, 26]} style={{ pointerEvents: 'none' }}>
      <div className="ub-pin is-home is-on">
        <House size={14} />
        <span>Start</span>
        <Accessibility size={14} />
      </div>
    </Html>
  );
}

const edgePts = (ids: number[], y: number, startNode: number) => {
  const g = world.g;
  const out: [number, number, number][] = [];
  let at = startNode;
  out.push([g.nodes[at].x, y, g.nodes[at].z]);
  for (const id of ids) {
    const e = g.edges[id];
    at = e.a === at ? e.b : e.a;
    out.push([g.nodes[at].x, y, g.nodes[at].z]);
  }
  return out;
};

/** Walking route (dashed) against the step-free route (solid) for the selected journey. */
/** Polyline with cumulative lengths, for moving markers along a route at a steady speed. */
function track(pts: [number, number, number][]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
  const at = (d: number, out: Vector3) => {
    const L = cum[cum.length - 1];
    d = Math.max(0, Math.min(L, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const u = (d - cum[i - 1]) / seg;
    return out.set(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1], pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * u);
  };
  return { length: cum[cum.length - 1], at };
}

/** Scene units per second: 1 unit = 10 m, so 300 m of route per second of animation. */
const TRAVEL_SPEED = 30;

/**
 * Two travellers leave home together: someone walking takes the short route, someone in a wheelchair
 * the step-free one. With stairs on the short route the walker's line ends there in a red pulse and the
 * wheelchair goes the long way round. Loops.
 */
function Travellers({ walk, free, stopAt }: { walk: [number, number, number][]; free: [number, number, number][] | null; stopAt: number | null }) {
  const chair = useRef<Group>(null);
  const walker = useRef<Group>(null);
  const halo = useRef<Mesh>(null);
  const clock = useRef(0);
  const tw = useMemo(() => track(walk), [walk]);
  const tf = useMemo(() => (free ? track(free) : null), [free]);
  const p = useMemo(() => new Vector3(), []);
  useEffect(() => {
    clock.current = 0;
  }, [walk, free]);
  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.1);
    const total = (tf ? tf.length : tw.length) / TRAVEL_SPEED + 1.4;
    const t = clock.current % total;
    const d = t * TRAVEL_SPEED;
    if (chair.current && tf) chair.current.position.copy(tf.at(d, p)).setY(1.4);
    if (walker.current) {
      const lim = stopAt ?? tw.length;
      walker.current.visible = stopAt !== null;
      walker.current.position.copy(tw.at(Math.min(d, lim), p)).setY(1.2);
      if (halo.current) {
        const blocked = d >= lim;
        halo.current.visible = blocked;
        halo.current.scale.setScalar(blocked ? 1 + 0.35 * Math.sin(clock.current * 9) : 1);
      }
    }
  });
  return (
    <group>
      {tf && (
        <group ref={chair}>
          <mesh>
            <sphereGeometry args={[0.9, 16, 12]} />
            <meshBasicMaterial color={stopAt === null ? '#34d399' : '#f5b544'} toneMapped={false} />
          </mesh>
          <Html center position={[0, 3.2, 0]} zIndexRange={[28, 28]} style={{ pointerEvents: 'none' }}>
            <div className={`ub-traveller ${stopAt === null ? 'is-ok' : ''}`}>
              <Accessibility size={14} />
            </div>
          </Html>
        </group>
      )}
      <group ref={walker}>
        <mesh>
          <sphereGeometry args={[0.7, 16, 12]} />
          <meshBasicMaterial color="#eaf0f7" toneMapped={false} />
        </mesh>
        <mesh ref={halo} rotation-x={-Math.PI / 2} position={[0, -1.0, 0]}>
          <ringGeometry args={[1.6, 2.3, 32]} />
          <meshBasicMaterial color="#ff6a4d" toneMapped={false} transparent opacity={0.9} side={DoubleSide} />
        </mesh>
        <Html center position={[0, 2.8, 0]} zIndexRange={[27, 27]} style={{ pointerEvents: 'none' }}>
          <div className="ub-traveller is-walk">
            <Footprints size={13} />
          </div>
        </Html>
      </group>
    </group>
  );
}

/** Walking route (dashed) against the step-free route (solid) for the selected journey, with two travellers. */
export function JourneyRoutes() {
  const mode = useUnblock((s) => s.mode);
  const trip = useUnblock((s) => s.trip);
  const home = useUnblock((s) => s.home);
  const pts = useMemo(() => {
    const start = world.homes[home].node;
    const walk = edgePts(trip.walkEdges, 0.5, start);
    const free = trip.stepFreeEdges.length ? edgePts(trip.stepFreeEdges, 0.7, start) : null;
    // where the short route meets its first barrier
    let stopAt: number | null = null;
    if (trip.blockers.length) {
      const b = world.barriers[trip.blockers[0]];
      const t = track(walk);
      const q = new Vector3();
      let best = Infinity;
      for (let d = 0; d <= t.length; d += 0.5) {
        t.at(d, q);
        const dd = Math.hypot(q.x - b.x, q.z - b.z);
        if (dd < best) {
          best = dd;
          stopAt = d;
        }
      }
    }
    return { walk, free, stopAt };
  }, [trip, home]);
  if (mode !== 'journey') return null;
  const { walk, free, stopAt } = pts;
  const sameRoute = free && Math.abs(trip.stepFreeM - trip.walkM) < 1;
  return (
    <group>
      {walk.length > 1 && !sameRoute && <Line points={walk} color="#eaf0f7" lineWidth={3.5} dashed dashSize={1.8} gapSize={1.2} transparent opacity={0.9} toneMapped={false} />}
      {free && free.length > 1 && <Line points={free} color={sameRoute ? '#34d399' : '#f5b544'} lineWidth={7} toneMapped={false} />}
      {walk.length > 1 && <Travellers walk={walk} free={free} stopAt={sameRoute ? null : stopAt} />}
    </group>
  );
}

const PULSE = new Color('#34d399');

/** An expanding ring on the ground wherever a repair lands. */
export function RepairPulses() {
  const change = useUnblock((s) => s.change);
  const group = useRef<Group>(null);
  const rings = useRef<{ mesh: Mesh; born: number }[]>([]);
  const geo = useMemo(() => new RingGeometry(0.86, 1, 64), []);
  const clock = useRef(0);
  useEffect(() => {
    if (!change.nonce || !group.current) return;
    const mat = new MeshBasicMaterial({ color: PULSE, transparent: true, toneMapped: false, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(change.x, 0.3, change.z);
    mesh.renderOrder = 6;
    group.current.add(mesh);
    rings.current.push({ mesh, born: clock.current });
  }, [change, geo]);
  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.1);
    rings.current = rings.current.filter((r) => {
      const age = clock.current - r.born;
      if (age > 1.6) {
        r.mesh.removeFromParent();
        (r.mesh.material as MeshBasicMaterial).dispose();
        return false;
      }
      const u = age / 1.6;
      r.mesh.scale.setScalar(2 + 22 * (1 - Math.pow(1 - u, 3)));
      (r.mesh.material as MeshBasicMaterial).opacity = 0.95 * (1 - u);
      return true;
    });
  });
  return <group ref={group} />;
}

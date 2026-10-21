import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, ShaderMaterial } from 'three';
import { openAccess, type Access } from '../engine';
import { useUnblock, world, type Coverage } from '../store';

/** Street colours: in reach step-free, cut off by a barrier, too far even without barriers. */
const REACH = new Color('#4fd1e8');
const CUT = new Color('#ff5d52');
const FAR = new Color('#3a4656');
const Y = 0.14;
const painted = new WeakSet<BufferGeometry>();
const HALF = 0.2;

/** Per edge: 0 = reachable, 1 = cut off by barriers, 2 = out of range anyway. */
function edgeStates(access: Access, coverage: Coverage, maxTrip: number) {
  const g = world.g;
  const open = openAccess(world, useUnblock.getState().settings);
  const idx = world.destinations.filter((d) => coverage === 'all' || d.cat === coverage).map((d) => d.id);
  const minAt = (a: Access) => {
    const m = new Float64Array(g.nodes.length).fill(Infinity);
    for (const i of idx) {
      const d = a.dist[i];
      for (let n = 0; n < m.length; n++) if (d[n] < m[n]) m[n] = d[n];
    }
    return m;
  };
  const now = minAt(access);
  const could = minAt(open);
  return g.edges.map((e) => {
    if (Math.min(now[e.a], now[e.b]) <= maxTrip) return 0;
    if (Math.min(could[e.a], could[e.b]) <= maxTrip) return 1;
    return 2;
  });
}

const VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aDelay;
  uniform float uT;
  varying vec3 vColor;
  varying float vFlash;
  void main() {
    float k = clamp((uT - aDelay) / 0.45, 0.0, 1.0);
    vColor = mix(aFrom, aTo, k);
    float changed = step(0.01, distance(aFrom, aTo));
    vFlash = changed * exp(-pow((uT - aDelay - 0.25) * 2.2, 2.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uDim;
  varying vec3 vColor;
  varying float vFlash;
  void main() {
    vec3 c = vColor * 0.62 * uDim + vec3(0.2, 1.0, 0.55) * vFlash * 1.6;
    gl_FragColor = vec4(c, 0.55 + 0.4 * uDim);
  }
`;

export function AccessNetwork() {
  const access = useUnblock((s) => s.access);
  const coverage = useUnblock((s) => s.coverage);
  const maxTrip = useUnblock((s) => s.settings.maxTripM);
  const change = useUnblock((s) => s.change);
  const t0 = useRef(-100);
  const clock = useRef(0);

  const { geometry, material } = useMemo(() => {
    const g = world.g;
    const n = g.edges.length;
    const pos = new Float32Array(n * 4 * 3);
    const index: number[] = [];
    g.edges.forEach((e, i) => {
      const a = g.nodes[e.a];
      const b = g.nodes[e.b];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * HALF;
      const nz = (dx / len) * HALF;
      // extend a little past each node so junctions read as joined
      const ex = (dx / len) * HALF;
      const ez = (dz / len) * HALF;
      const v = [a.x - ex + nx, a.z - ez + nz, a.x - ex - nx, a.z - ez - nz, b.x + ex + nx, b.z + ez + nz, b.x + ex - nx, b.z + ez - nz];
      for (let k = 0; k < 4; k++) pos.set([v[k * 2], Y, v[k * 2 + 1]], (i * 4 + k) * 3);
      const o = i * 4;
      index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(pos, 3));
    geometry.setAttribute('aFrom', new BufferAttribute(new Float32Array(n * 12), 3));
    geometry.setAttribute('aTo', new BufferAttribute(new Float32Array(n * 12), 3));
    geometry.setAttribute('aDelay', new BufferAttribute(new Float32Array(n * 4), 1));
    geometry.setIndex(index);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uT: { value: 100 }, uDim: { value: 1 } },
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      toneMapped: false,
    });
    if (import.meta.env.DEV) Object.assign(window, { __ubNet: { geometry, material } });
    return { geometry, material };
  }, []);

  useEffect(() => {
    const states = edgeStates(access, coverage, maxTrip);
    const from = geometry.getAttribute('aFrom') as BufferAttribute;
    const to = geometry.getAttribute('aTo') as BufferAttribute;
    const delay = geometry.getAttribute('aDelay') as BufferAttribute;
    const first = !painted.has(geometry);
    painted.add(geometry);
    // start from what is on screen now: the previous target once its sweep has finished
    const settled = clock.current - t0.current > 2.5;
    states.forEach((st, i) => {
      const c = st === 0 ? REACH : st === 1 ? CUT : FAR;
      const e = world.g.edges[i];
      const mx = (world.g.nodes[e.a].x + world.g.nodes[e.b].x) / 2;
      const mz = (world.g.nodes[e.a].z + world.g.nodes[e.b].z) / 2;
      const d = Math.hypot(mx - change.x, mz - change.z) * 0.011;
      for (let v = 0; v < 4; v++) {
        const j = i * 4 + v;
        if (first) from.setXYZ(j, c.r, c.g, c.b);
        else if (settled) from.setXYZ(j, to.getX(j), to.getY(j), to.getZ(j));
        to.setXYZ(j, c.r, c.g, c.b);
        delay.setX(j, d);
      }
    });
    from.needsUpdate = to.needsUpdate = delay.needsUpdate = true;
    t0.current = clock.current;
  }, [access, coverage, maxTrip, change, geometry]);

  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.1);
    material.uniforms.uT.value = clock.current - t0.current;
    // the journey's two routes sit on top, so the network steps back there
    const dim = useUnblock.getState().mode === 'journey' ? 0.28 : 1;
    material.uniforms.uDim.value += (dim - material.uniforms.uDim.value) * Math.min(1, dt * 4);
  });

  return <mesh geometry={geometry} material={material} renderOrder={5} raycast={() => null} />;
}

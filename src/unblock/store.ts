import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  cheapestFirst,
  computeAccess,
  getWorld,
  homeWeights,
  journey,
  optimize,
  rankRepairs,
  summarize,
  type Access,
  type Category,
  type Journey,
  type Plan,
  type Ranked,
  type Settings,
  type Summary,
} from './engine';

export type Mode = 'journey' | 'planner';
export type Coverage = Category | 'all';

export interface PlanResult {
  budget: number;
  optimizer: Plan;
  baseline: Plan;
}

interface State {
  mode: Mode;
  coverage: Coverage;
  settings: Settings;
  /** barriers the planner has repaired in the simulation */
  repaired: number[];
  home: number;
  destination: number;
  selected: number | null;
  hoverBarrier: number | null;
  budget: number;
  plan: PlanResult | null;
  planning: boolean;

  // derived, recomputed on every change
  weights: number[];
  access: Access;
  before: Summary;
  after: Summary;
  ranked: Ranked[];
  trip: Journey;
  /** bumps every time the network changes; the 3D layer animates from `changeAt` */
  change: { nonce: number; x: number; z: number };
  camera: { nonce: number; x: number; z: number; dist: number };
  ready: boolean;

  setMode: (m: Mode) => void;
  setCoverage: (c: Coverage) => void;
  setSettings: (s: Partial<Settings>) => void;
  toggleRepair: (id: number) => void;
  applyPlan: (ids: number[]) => void;
  resetRepairs: () => void;
  setHome: (id: number) => void;
  setDestination: (id: number) => void;
  select: (id: number | null) => void;
  setHoverBarrier: (id: number | null) => void;
  setBudget: (v: number) => void;
  runPlan: () => void;
  focus: (x: number, z: number, dist?: number) => void;
  setReady: () => void;
}

const w = getWorld();

function derive(s: Pick<State, 'settings' | 'repaired' | 'home' | 'destination'>, weights?: number[]) {
  const set = new Set(s.repaired);
  const wts = weights ?? homeWeights(w, s.settings);
  const base = computeAccess(w, new Set(), s.settings);
  const access = set.size ? computeAccess(w, set, s.settings) : base;
  return {
    weights: wts,
    access,
    before: summarize(w, base, wts, s.settings),
    after: summarize(w, access, wts, s.settings),
    ranked: rankRepairs(w, set, s.settings, wts),
    trip: journey(w, s.home, s.destination, set, s.settings),
  };
}

const initial = { settings: DEFAULT_SETTINGS, repaired: [] as number[], home: w.story.home, destination: w.story.destination };

export const useUnblock = create<State>((set, get) => {
  const recompute = (patch: Partial<State>, at?: { x: number; z: number }, newWeights = false) => {
    const next = { ...get(), ...patch };
    const d = derive(next, newWeights ? undefined : next.weights);
    set({ ...patch, ...d, change: at ? { nonce: get().change.nonce + 1, x: at.x, z: at.z } : get().change });
  };

  return {
    mode: 'journey',
    coverage: 'hospital',
    ...initial,
    selected: null,
    hoverBarrier: null,
    budget: 500_000,
    plan: null,
    planning: false,
    ...derive(initial),
    change: { nonce: 0, x: 0, z: 0 },
    camera: { nonce: 0, x: 0, z: 0, dist: 0 },
    ready: false,

    setMode: (mode) => set({ mode }),
    setCoverage: (coverage) => set({ coverage }),
    setSettings: (s) => {
      const settings = { ...get().settings, ...s };
      // unverified barriers can't stay "repaired" once they're ignored; they simply don't count
      recompute({ settings, plan: null }, { x: 0, z: 0 }, true);
    },
    toggleRepair: (id) => {
      const r = get().repaired;
      const b = w.barriers[id];
      recompute({ repaired: r.includes(id) ? r.filter((x) => x !== id) : [...r, id] }, b);
    },
    applyPlan: (ids) => {
      const r = new Set(get().repaired);
      ids.forEach((id) => r.add(id));
      const pts = ids.map((id) => w.barriers[id]);
      const c = pts.length ? { x: pts.reduce((a, b) => a + b.x, 0) / pts.length, z: pts.reduce((a, b) => a + b.z, 0) / pts.length } : { x: 0, z: 0 };
      recompute({ repaired: [...r] }, c);
    },
    resetRepairs: () => recompute({ repaired: [], plan: null }, { x: 0, z: 0 }),
    setHome: (home) => recompute({ home }),
    setDestination: (destination) => recompute({ destination }),
    select: (selected) => set({ selected }),
    setHoverBarrier: (hoverBarrier) => set({ hoverBarrier }),
    setBudget: (budget) => set({ budget, plan: null }),
    runPlan: () => {
      set({ planning: true });
      // let the "working" state paint before the (sub-second) search blocks the thread
      setTimeout(() => {
        const s = get();
        const fixed = new Set(s.repaired);
        const optimizer = optimize(w, s.budget, s.settings, s.weights, fixed);
        const baseline = cheapestFirst(w, s.budget, s.settings, s.weights, fixed);
        set({ plan: { budget: s.budget, optimizer, baseline }, planning: false });
      }, 40);
    },
    focus: (x, z, dist = 60) => set({ camera: { nonce: get().camera.nonce + 1, x, z, dist } }),
    setReady: () => set({ ready: true }),
  };
});

export const world = w;

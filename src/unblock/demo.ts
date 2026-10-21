import { useUnblock, world } from './store';

/**
 * The 90-second story, played on `#demo`: a short trip to a hospital that a wheelchair can't make,
 * the one repair that fixes it, then the planner choosing what to fix under a budget.
 * Returns a function that cancels the remaining steps.
 */
export function playDemo() {
  const timers: number[] = [];
  const at = (s: number, fn: () => void) => timers.push(window.setTimeout(fn, s * 1000));
  const st = () => useUnblock.getState();
  const { story } = world;
  const home = world.homes[story.home];
  const hosp = world.destinations[story.destination];
  const stairs = world.barriers[story.barrier];

  at(0, () => {
    st().resetRepairs();
    st().setMode('journey');
    st().setHome(story.home);
    st().setDestination(story.destination);
    st().focus((home.x + hosp.x) / 2, (home.z + hosp.z) / 2, 95);
  });
  at(5, () => {
    st().select(stairs.id);
    st().focus(stairs.x, stairs.z, 45);
  });
  at(10, () => {
    st().toggleRepair(stairs.id);
    st().focus((home.x + hosp.x) / 2, (home.z + hosp.z) / 2, 95);
  });
  at(16, () => {
    st().select(null);
    st().setMode('planner');
    st().setCoverage('hospital');
    st().focus(0, 0, 0);
  });
  at(21, () => {
    const top = st().ranked[0];
    if (!top) return;
    const b = world.barriers[top.id];
    st().select(b.id);
    st().focus(b.x, b.z, 70);
  });
  at(25, () => {
    const top = st().ranked[0];
    if (top) st().toggleRepair(top.id);
  });
  at(29, () => {
    st().select(null);
    st().focus(0, 0, 0);
    st().setBudget(250_000);
    st().runPlan();
  });
  at(34, () => {
    const p = st().plan;
    if (p) st().applyPlan(p.optimizer.picks);
  });
  at(39, () => {
    st().setBudget(1_000_000);
    st().runPlan();
  });
  at(44, () => {
    const p = st().plan;
    if (p) st().applyPlan(p.optimizer.picks);
  });
  return () => timers.forEach((t) => clearTimeout(t));
}

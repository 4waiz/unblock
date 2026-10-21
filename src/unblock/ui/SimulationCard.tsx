import { Check, Play } from 'lucide-react';
import { BARRIER_KIND, formatAed } from '../engine';
import { useUnblock, world } from '../store';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Live progress of a simulation run, floating over the map. */
export function SimulationCard() {
  const sim = useUnblock((s) => s.sim);
  const before = useUnblock((s) => s.before);
  const after = useUnblock((s) => s.after);
  if (!sim) return null;
  const last = sim.step > 0 ? world.barriers[sim.ids[sim.step - 1]] : null;
  const spent = sim.ids.slice(0, sim.step).reduce((c, id) => c + world.barriers[id].cost, 0);
  const homes = after.hospitalHomes - before.hospitalHomes;

  return (
    <div className={`ub-sim ${sim.done ? 'is-done' : ''}`} role="status" aria-live="polite">
      <div className="ub-sim-top">
        {sim.done ? <Check size={15} /> : <Play size={14} />}
        <span>{sim.done ? 'Simulation finished' : 'Simulating the plan'}</span>
        <b className="tnum">
          {sim.step} / {sim.ids.length} repairs
        </b>
      </div>
      <span className="ub-sim-bar">
        <i style={{ width: `${(sim.step / Math.max(1, sim.ids.length)) * 100}%` }} />
      </span>
      <div className="ub-sim-row">
        <span className="ub-sim-what">{last ? `${last.code} ${BARRIER_KIND[last.kind].fix.toLowerCase()} · ${last.street}` : 'Starting…'}</span>
        <span className="tnum ub-sim-cost">{formatAed(spent)}</span>
      </div>
      <div className="ub-sim-stats">
        <span>
          Homes that can reach a hospital <b className="tnum">{pct(before.share.hospital)}</b> → <b className="tnum is-up">{pct(after.share.hospital)}</b>
        </span>
        {homes > 0 && <span className="is-up tnum">+{homes} homes</span>}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Accessibility, AlertTriangle, Check, ChevronDown, Footprints, Hammer, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { BARRIER_KIND, CATEGORY, SOURCE, formatAed, formatM, type Category } from '../engine';
import { useUnblock, world, type Coverage } from '../store';

const CATS = Object.keys(CATEGORY) as Category[];
const pct = (v: number) => `${Math.round(v * 100)}%`;

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function BarrierRow({ id, gain, rank }: { id: number; gain?: number; rank?: number }) {
  const b = world.barriers[id];
  const repaired = useUnblock((s) => s.repaired.includes(id));
  const selected = useUnblock((s) => s.selected === id);
  const toggle = useUnblock((s) => s.toggleRepair);
  const select = useUnblock((s) => s.select);
  const focus = useUnblock((s) => s.focus);
  const setHover = useUnblock((s) => s.setHoverBarrier);
  const src = SOURCE[b.source];
  return (
    <li
      className={`ub-row ${repaired ? 'is-fixed' : ''} ${selected ? 'is-on' : ''}`}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover(null)}
    >
      <button
        className="ub-row-main"
        onClick={() => {
          select(id);
          focus(b.x, b.z, 55);
        }}
      >
        {rank !== undefined && <span className="ub-rank tnum">{rank}</span>}
        <span className="ub-row-text">
          <span className="ub-row-title">
            <b>{b.code}</b> {BARRIER_KIND[b.kind].label}
          </span>
          <span className="ub-row-sub">
            {b.street} · {formatAed(b.cost)}
            {!src.verified && <em> · not checked yet</em>}
          </span>
        </span>
        {gain !== undefined && !repaired && <span className={`ub-gain tnum ${gain > 0 ? '' : 'is-zero'}`}>{gain > 0 ? `+${gain.toFixed(0)}` : '0'}</span>}
      </button>
      <button className={`ub-fix ${repaired ? 'is-fixed' : ''}`} onClick={() => toggle(id)} title={repaired ? 'Undo this repair' : 'Repair this barrier in the simulation'}>
        {repaired ? <Check size={14} /> : <Hammer size={14} />}
        {repaired ? 'Repaired' : 'Repair'}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Left rail                                                           */
/* ------------------------------------------------------------------ */

export function JourneyPanel() {
  const destination = useUnblock((s) => s.destination);
  const setDestination = useUnblock((s) => s.setDestination);
  const trip = useUnblock((s) => s.trip);
  const maxTrip = useUnblock((s) => s.settings.maxTripM);
  const home = useUnblock((s) => s.home);
  const setMode = useUnblock((s) => s.setMode);
  const toggle = useUnblock((s) => s.toggleRepair);
  const focus = useUnblock((s) => s.focus);
  const h = world.homes[home];
  const dest = world.destinations[destination];
  const detour = trip.stepFreeM - trip.walkM;
  const ok = trip.stepFreeM <= maxTrip;
  const sorted = useMemo(() => [...world.destinations].sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.name.localeCompare(b.name)), []);

  return (
    <div className="ub-panel">
      <div className="ub-head">
        <Accessibility size={15} />
        <h2>Journey check</h2>
      </div>
      <p className="ub-lede">Pick where to go. Click the map to move the start. We compare the shortest walk with the shortest step-free route.</p>

      <label className="ub-field">
        <span>Going to</span>
        <select value={destination} onChange={(e) => setDestination(Number(e.target.value))}>
          {sorted.map((d) => (
            <option key={d.id} value={d.id}>
              {CATEGORY[d.cat].label}: {d.name}
            </option>
          ))}
        </select>
      </label>

      <div className="ub-compare">
        <div className="ub-cmp">
          <Footprints size={14} />
          <span>Walking</span>
          <b className="tnum">{formatM(trip.walkM)}</b>
        </div>
        <div className={`ub-cmp ${ok ? 'is-ok' : 'is-bad'}`}>
          <Accessibility size={14} />
          <span>Wheelchair</span>
          <b className="tnum">{formatM(trip.stepFreeM)}</b>
        </div>
      </div>

      <div className={`ub-verdict ${ok ? 'is-ok' : 'is-bad'}`}>
        {trip.stepFreeM === Infinity
          ? `No step-free route reaches ${dest.name} at all.`
          : detour < 1
            ? `The short route is step-free. ${dest.name} is in reach.`
            : ok
              ? `A detour of ${formatM(detour)}, but still within ${formatM(maxTrip)}.`
              : `The short route is blocked. The step-free way round is ${formatM(trip.stepFreeM)}, ${(trip.stepFreeM / trip.walkM).toFixed(1)}× longer, past the ${formatM(maxTrip)} limit. For a wheelchair user, ${dest.name} is out of reach.`}
      </div>

      {trip.blockers.length > 0 && (
        <>
          <div className="ub-sub">On the short route</div>
          <ul className="ub-list">
            {trip.blockers.map((id) => (
              <BarrierRow key={id} id={id} />
            ))}
          </ul>
          <button
            className="ub-cta"
            onClick={() => {
              trip.blockers.forEach((id) => toggle(id));
              focus((h.x + dest.x) / 2, (h.z + dest.z) / 2, 110);
            }}
          >
            <Hammer size={14} /> Repair {trip.blockers.length > 1 ? 'these barriers' : 'this barrier'} and recheck
          </button>
        </>
      )}

      <button className="ub-link" onClick={() => setMode('planner')}>
        Open the city planner →
      </button>
    </div>
  );
}

export function RepairsPanel() {
  const ranked = useUnblock((s) => s.ranked);
  const repaired = useUnblock((s) => s.repaired);
  const reset = useUnblock((s) => s.resetRepairs);
  const [all, setAll] = useState(false);
  const useful = ranked.filter((r) => r.gain > 0);
  const shown = all ? ranked : useful.slice(0, 8);
  const kinds = useMemo(() => {
    const c: Record<string, number> = {};
    world.barriers.forEach((b) => (c[b.kind] = (c[b.kind] ?? 0) + 1));
    return c;
  }, []);
  const unverified = world.barriers.filter((b) => !SOURCE[b.source].verified).length;

  return (
    <div className="ub-panel">
      <div className="ub-head">
        <Hammer size={15} />
        <h2>Proposed repairs</h2>
      </div>
      <div className="ub-kinds">
        {Object.entries(kinds).map(([k, n]) => (
          <span key={k} className={`ub-kind k-${k}`}>
            <b className="tnum">{n}</b> {BARRIER_KIND[k as keyof typeof BARRIER_KIND].label.toLowerCase()}
          </span>
        ))}
      </div>
      <p className="ub-lede">
        {world.barriers.length} barriers in the pilot area. {unverified} are reports or AI photo flags that nobody has checked on site yet. Ranked by access gained per dirham. The number is access points gained.
      </p>
      <ul className="ub-list">
        {repaired.map((id) => (
          <BarrierRow key={id} id={id} />
        ))}
        {shown.map((r, i) => (
          <BarrierRow key={r.id} id={r.id} gain={r.gain} rank={i + 1} />
        ))}
      </ul>
      <div className="ub-row-actions">
        <button className="ub-link" onClick={() => setAll(!all)}>
          {all ? 'Show the top repairs' : `Show all ${ranked.length}, including ${ranked.length - useful.length} that change nothing alone`}
        </button>
        {repaired.length > 0 && (
          <button className="ub-link" onClick={reset}>
            <RotateCcw size={12} /> Undo all repairs
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Right rail                                                          */
/* ------------------------------------------------------------------ */

function Kpi({ label, from, to, fmt = pct, invert = false }: { label: string; from: number; to: number; fmt?: (v: number) => string; invert?: boolean }) {
  const d = to - from;
  const better = invert ? d < -0.0001 : d > 0.0001;
  return (
    <div className="ub-kpi">
      <span className="ub-kpi-label">{label}</span>
      <span className="ub-kpi-val tnum">
        {fmt(from)}
        {Math.abs(d) > 0.0001 && (
          <>
            <span className="ub-arrow">→</span>
            <b className={better ? 'is-up' : 'is-down'}>{fmt(to)}</b>
          </>
        )}
      </span>
      <span className="ub-kpi-bar">
        <i style={{ width: pct(Math.min(1, from)) }} />
        {to > from && <i className="is-gain" style={{ left: pct(Math.min(1, from)), width: pct(Math.min(1, to) - Math.min(1, from)) }} />}
      </span>
    </div>
  );
}

export function ImpactPanel() {
  const before = useUnblock((s) => s.before);
  const after = useUnblock((s) => s.after);
  const repaired = useUnblock((s) => s.repaired);
  const coverage = useUnblock((s) => s.coverage);
  const setCoverage = useUnblock((s) => s.setCoverage);
  const maxTrip = useUnblock((s) => s.settings.maxTripM);
  const cost = repaired.reduce((c, id) => c + world.barriers[id].cost, 0);
  const newlyReached = before.cutOff.filter((id) => !after.cutOff.includes(id));
  const scoreGain = after.score - before.score;

  return (
    <div className="ub-panel">
      <div className="ub-head">
        <Sparkles size={15} />
        <h2>Impact</h2>
        <span className="ub-chip">{repaired.length ? `${repaired.length} repairs · ${formatAed(cost)}` : 'Today'}</span>
      </div>
      <p className="ub-lede">Share of homes with a step-free route under {formatM(maxTrip)} to each kind of service.</p>
      {CATS.map((c) => (
        <Kpi key={c} label={CATEGORY[c].plural} from={before.share[c]} to={after.share[c]} />
      ))}
      <div className="ub-stats">
        <div>
          <b className="tnum">{scoreGain > 0 ? `+${scoreGain.toFixed(0)}` : '0'}</b>
          <span>access points gained</span>
        </div>
        <div>
          <b className="tnum">{after.hospitalHomes - before.hospitalHomes > 0 ? `+${after.hospitalHomes - before.hospitalHomes}` : '0'}</b>
          <span>homes newly in reach of a hospital</span>
        </div>
        <div>
          <b className="tnum">{formatM(after.detourM)}</b>
          <span>average extra distance on trips still possible</span>
        </div>
        <div>
          <b className="tnum">{after.cutOff.length}</b>
          <span>services no home can reach{newlyReached.length ? ` (${newlyReached.length} opened up)` : ''}</span>
        </div>
      </div>
      <p className="ub-note">
        Uncertainty: {world.barriers.filter((b) => !SOURCE[b.source].verified).length} of {world.barriers.length} barriers are unchecked reports or AI photo flags. Switch them off under Assumptions to see the low end.
      </p>
      <div className="ub-sub">Colour the streets by</div>
      <div className="ub-chips">
        {(['hospital', 'school', 'mall', 'mosque', 'all'] as Coverage[]).map((c) => (
          <button key={c} className={`ub-chip-btn ${coverage === c ? 'is-on' : ''}`} onClick={() => setCoverage(c)}>
            {c === 'all' ? 'Any service' : CATEGORY[c].plural}
          </button>
        ))}
      </div>
      <div className="ub-legend">
        <span>
          <i className="l-reach" /> in reach step-free
        </span>
        <span>
          <i className="l-cut" /> cut off by a barrier
        </span>
        <span>
          <i className="l-far" /> too far anyway
        </span>
      </div>
    </div>
  );
}

const BUDGETS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000];

export function OptimizerPanel() {
  const budget = useUnblock((s) => s.budget);
  const setBudget = useUnblock((s) => s.setBudget);
  const plan = useUnblock((s) => s.plan);
  const planning = useUnblock((s) => s.planning);
  const runPlan = useUnblock((s) => s.runPlan);
  const applyPlan = useUnblock((s) => s.applyPlan);
  const focus = useUnblock((s) => s.focus);
  const bi = Math.max(0, BUDGETS.indexOf(budget));
  const max = plan ? Math.max(plan.optimizer.gain, plan.baseline.gain, 1) : 1;

  return (
    <div className="ub-panel">
      <div className="ub-head">
        <Wand2 size={15} />
        <h2>Repair budget</h2>
        <span className="ub-chip tnum">{formatAed(budget)}</span>
      </div>
      <input
        className="ub-range"
        type="range"
        min={0}
        max={BUDGETS.length - 1}
        step={1}
        value={bi}
        onChange={(e) => setBudget(BUDGETS[Number(e.target.value)])}
        aria-label="Repair budget"
      />
      <div className="ub-range-ticks">
        {BUDGETS.map((b) => (
          <span key={b}>{formatAed(b).replace('AED ', '')}</span>
        ))}
      </div>
      <button className="ub-cta" onClick={runPlan} disabled={planning}>
        <Wand2 size={14} /> {planning ? 'Searching the network…' : 'Find the best repairs'}
      </button>

      {plan && (
        <div className="ub-plan">
          {[plan.optimizer, plan.baseline].map((p, i) => (
            <div key={p.method} className={`ub-plan-row ${i === 0 ? 'is-best' : ''}`}>
              <div className="ub-plan-top">
                <span>{p.method}</span>
                <span className="tnum">
                  {p.picks.length} repairs · {formatAed(p.cost)}
                </span>
              </div>
              <span className="ub-plan-bar">
                <i style={{ width: `${(p.gain / max) * 100}%` }} />
              </span>
              <span className="ub-plan-gain tnum">+{p.gain.toFixed(0)} access points</span>
            </div>
          ))}
          <p className="ub-note">
            {plan.baseline.gain > 0
              ? `${(plan.optimizer.gain / plan.baseline.gain).toFixed(1)}× the access of fixing the cheapest problems first, for the same money.`
              : 'Fixing the cheapest problems first opens up nothing here.'}{' '}
            The optimizer re-runs the routes after every pick and tries nearby pairs, so it finds barriers that only matter together.
          </p>
          <button
            className="ub-cta is-go"
            onClick={() => {
              applyPlan(plan.optimizer.picks);
              focus(0, 0, 0);
            }}
          >
            <Check size={14} /> Apply this plan to the map
          </button>
        </div>
      )}
    </div>
  );
}

export function AssumptionsPanel() {
  const settings = useUnblock((s) => s.settings);
  const setSettings = useUnblock((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  return (
    <div className="ub-panel ub-assume">
      <button className="ub-head ub-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <AlertTriangle size={15} />
        <h2>Assumptions and data</h2>
        <ChevronDown size={14} className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <div className="ub-assume-body">
          <label className="ub-field">
            <span>Longest trip that counts as in reach</span>
            <select value={settings.maxTripM} onChange={(e) => setSettings({ maxTripM: Number(e.target.value) })}>
              <option value={600}>600 m (about 10 minutes)</option>
              <option value={800}>800 m (about 13 minutes)</option>
              <option value={1000}>1 km (about 16 minutes)</option>
            </select>
          </label>
          <label className="ub-field">
            <span>Put the least-served homes first: {Math.round(settings.equity * 100)}%</span>
            <input type="range" min={0} max={1} step={0.25} value={settings.equity} onChange={(e) => setSettings({ equity: Number(e.target.value) })} />
          </label>
          <label className="ub-check">
            <input type="checkbox" checked={settings.includeUnverified} onChange={(e) => setSettings({ includeUnverified: e.target.checked })} />
            Count barriers nobody has checked on site yet
          </label>
          <table className="ub-costs">
            <tbody>
              {Object.values(BARRIER_KIND).map((k) => (
                <tr key={k.label}>
                  <td>{k.fix}</td>
                  <td className="tnum">
                    {formatAed(k.cost[0])}–{formatAed(k.cost[1]).replace('AED ', '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ub-note">
            Access points: each home scores hospital ×3 (first one), school ×2, mosque and shops ×1 (up to two each). Weights, unit costs and every barrier are made up for this pilot. Streets and places are real OpenStreetMap data.
          </p>
        </div>
      )}
    </div>
  );
}

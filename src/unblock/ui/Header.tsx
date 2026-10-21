import { useRef, useState } from 'react';
import { Accessibility, Info, LayoutGrid, Route } from 'lucide-react';
import { useDismiss } from '../../hooks/useDismiss';
import { MAP_CREDIT } from '../../data/abudhabi';
import { useUnblock } from '../store';
import { UnblockMark } from './UnblockMark';

export function Header() {
  const mode = useUnblock((s) => s.mode);
  const setMode = useUnblock((s) => s.setMode);
  const focus = useUnblock((s) => s.focus);
  const [info, setInfo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, info, () => setInfo(false), '[data-popover-toggle="ub-info"]');

  return (
    <header className="hdr panel-enter" style={{ ['--enter-delay' as string]: '0ms' }}>
      <a className="hdr-brand" href="#" aria-label="UNBLOCK home">
        <UnblockMark size={30} />
        <div>
          <div className="hdr-title">UNBLOCK</div>
          <div className="hdr-tagline">Fix one sidewalk, open up a neighbourhood</div>
        </div>
      </a>

      <div className="hdr-status tone-info">
        <Accessibility size={14} />
        <span className="hdr-live">Wheelchair profile</span>
        <span className="hdr-sep" aria-hidden />
        <span className="hdr-status-text">Step-free routes only, no stairs or high kerbs</span>
      </div>

      <div className="hdr-right">
        <nav className="seg" aria-label="Mode">
          <button className={`seg-btn ${mode === 'journey' ? 'is-on' : ''}`} onClick={() => setMode('journey')}>
            <Route size={14} />
            Journey check
          </button>
          <button className={`seg-btn ${mode === 'planner' ? 'is-on' : ''}`} onClick={() => setMode('planner')}>
            <LayoutGrid size={14} />
            City planner
          </button>
        </nav>
        <button className="seg-btn" onClick={() => focus(0, 0, 0)} title="Whole map">
          Overview
        </button>
        <div className="hdr-info">
          <button className="icon-btn" aria-label="About this pilot" aria-expanded={info} onClick={() => setInfo(!info)} data-popover-toggle="ub-info">
            <Info size={16} />
          </button>
          {info && (
            <div className="popover hdr-info-pop" role="dialog" ref={ref}>
              <div className="popover-title">About this pilot</div>
              <p>
                Streets, buildings, hospitals, schools, mosques and malls are real downtown Abu Dhabi from OpenStreetMap. The barriers, their repair costs and who reported them are a made-up pilot dataset, so every number here is an illustration of the method, not a measured result.
              </p>
              <p className="muted">Routes are real shortest paths on the street network. Accessible routing itself is not new (AccessMap does it); UNBLOCK is about choosing what to repair.</p>
              <p className="muted">{MAP_CREDIT}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EXPOSURE } from '../three/sceneConfig';
import { MAP_CREDIT } from '../data/abudhabi';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { UnblockScene, OVERVIEW } from './three/UnblockScene';
import { Header } from './ui/Header';
import { AssumptionsPanel, ImpactPanel, JourneyPanel, OptimizerPanel, RepairsPanel } from './ui/Panels';
import { useUnblock } from './store';
import '../styles/layout.css';
import '../styles/panels.css';
import '../styles/overlays.css';
import '../styles/world.css';
import '../styles/undergrid.css';
import '../styles/unblock.css';

export function UnblockApp() {
  const ready = useUnblock((s) => s.ready);
  const mode = useUnblock((s) => s.mode);
  const select = useUnblock((s) => s.select);
  const compact = useMediaQuery('(max-width: 1100px)');
  const [dpr, setDpr] = useState(() => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5));
  const [quality, setQuality] = useState<'high' | 'low'>('high');

  return (
    <div className={`app ub-app boot-${ready ? 'ready' : 'loading'} ${compact ? 'is-compact' : ''} mode-${mode}`}>
      <div className="stage" role="application" aria-label="3D map of downtown Abu Dhabi showing which streets a wheelchair user can reach essential services from">
        <Canvas
          shadows
          dpr={dpr}
          camera={{ fov: 34, near: 0.4, far: 2400, position: [...OVERVIEW.pos] }}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMappingExposure = EXPOSURE;
          }}
          onPointerMissed={() => select(null)}
        >
          <PerformanceMonitor
            bounds={() => [24, 50]}
            flipflops={2}
            onDecline={() => {
              setDpr(1);
              setQuality('low');
            }}
          />
          <UnblockScene quality={quality} />
        </Canvas>
      </div>

      <Header />

      <aside className="rail rail-l ub-rail panel-enter" style={{ ['--enter-delay' as string]: '80ms' }} aria-label={mode === 'journey' ? 'Journey check' : 'Proposed repairs'}>
        {mode === 'journey' ? <JourneyPanel /> : <RepairsPanel />}
      </aside>
      <aside className="rail rail-r ub-rail panel-enter" style={{ ['--enter-delay' as string]: '160ms' }} aria-label="Impact and budget">
        <ImpactPanel />
        {mode === 'planner' && <OptimizerPanel />}
        <AssumptionsPanel />
      </aside>

      <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        {MAP_CREDIT} · Barriers and costs: made-up pilot data
      </a>

      {!ready && (
        <div className="ub-loading" role="status">
          Loading the street network…
        </div>
      )}
    </div>
  );
}

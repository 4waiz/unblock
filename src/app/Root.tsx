import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { UnblockApp } from '../unblock/UnblockApp';
import { Landing } from '../components/landing/Landing';
import { useUnblock } from '../unblock/store';
import { playDemo } from '../unblock/demo';

type View = 'landing' | 'app' | 'demo';

const viewFromHash = (): View => (location.hash === '#app' || location.hash === '#twin' ? 'app' : location.hash === '#demo' ? 'demo' : 'landing');

/** `#app` opens the UNBLOCK planner, `#demo` opens it and plays the 90-second story, anything else is the landing page. */
export function Root() {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // the demo link plays the story once the map has loaded
  useEffect(() => {
    if (view !== 'demo') return;
    let stop: (() => void) | undefined;
    const start = () => (stop = playDemo());
    if (useUnblock.getState().ready) start();
    const unsub = useUnblock.subscribe((s, prev) => {
      if (s.ready && !prev.ready) start();
    });
    return () => {
      unsub();
      stop?.();
    };
  }, [view]);

  return <MotionConfig reducedMotion="user">{view === 'landing' ? <Landing /> : <UnblockApp />}</MotionConfig>;
}

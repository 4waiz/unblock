import { useEffect, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Box3, HalfFloatType, Vector3, WebGLRenderTarget } from 'three';
import { SceneEnvironment } from '../../three/SceneEnvironment';
import { Ground, Diorama } from '../../three/Ground';
import { AbuDhabiBuildings } from '../../three/AbuDhabiBuildings';
import { Mosques } from '../../three/Mosques';
import { Palms } from '../../three/Palms';
import { StreetLights } from '../../three/StreetLights';
import { MapLabels } from '../../three/MapLabels';
import { Sea } from '../../three/Sea';
import { Effects } from '../../three/Effects';
import { G } from '../../three/shaders/globals';
import { runtime } from '../../simulation/runtime';
import { AccessNetwork } from './AccessNetwork';
import { Barriers, HomePin, JourneyRoutes, Places, RepairPulses } from './Markers';
import { useUnblock, world } from '../store';

/** Overview: the whole downtown, inland up, the Corniche at the bottom. */
export const OVERVIEW = { pos: [6, 150, 128] as const, target: [2, 0, -6] as const };

function Camera() {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.minDistance = 12;
    c.maxDistance = 320;
    c.maxPolarAngle = Math.PI * 0.45;
    c.smoothTime = 0.45;
    c.dollyToCursor = true;
    c.setBoundary(new Box3(new Vector3(-96, -10, -86), new Vector3(96, 30, 104)));
    c.setLookAt(...OVERVIEW.pos, ...OVERVIEW.target, false);
    if (import.meta.env.DEV) (window as unknown as { __cc: unknown }).__cc = c;
    return useUnblock.subscribe((s, prev) => {
      if (s.camera.nonce === prev.camera.nonce) return;
      const { x, z, dist } = s.camera;
      if (dist === 0) c.setLookAt(...OVERVIEW.pos, ...OVERVIEW.target, true);
      else c.setLookAt(x + dist * 0.12, dist * 0.95, z + dist * 0.72, x, 0, z, true);
    });
  }, []);
  return <CameraControls ref={ref} makeDefault />;
}

/** Shader clock for the sea and the glow materials the twin's surface components share. */
function Clock() {
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    G.uTime.value += d;
    runtime.time += d;
  });
  return null;
}

/** Compile every material before the first visible frame so nothing hitches later. */
function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const ready = useUnblock((s) => s.ready);
  const setReady = useUnblock((s) => s.setReady);
  useFrame(() => {}, ready ? 0 : 1);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await new Promise((r) => setTimeout(r, 30));
      const rt = new WebGLRenderTarget(8, 8, { type: HalfFloatType });
      const prev = gl.getRenderTarget();
      try {
        gl.setRenderTarget(rt);
        const pending = gl.compileAsync(scene, camera);
        gl.setRenderTarget(prev);
        await pending;
      } catch (err) {
        console.warn('[unblock] shader warm-up failed', err);
      } finally {
        gl.setRenderTarget(prev);
        rt.dispose();
      }
      if (!cancelled) setReady();
    })();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, setReady]);
  return null;
}

/** In journey mode a click on the map moves the start to the nearest home. */
function PickPlane() {
  const mode = useUnblock((s) => s.mode);
  const setHome = useUnblock((s) => s.setHome);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (mode !== 'journey' || e.delta > 4) return;
    let best = 0;
    let bd = Infinity;
    for (const h of world.homes) {
      const d = (h.x - e.point.x) ** 2 + (h.z - e.point.z) ** 2;
      if (d < bd) {
        bd = d;
        best = h.id;
      }
    }
    setHome(best);
  };
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 10]} onClick={onClick} visible={false}>
      <planeGeometry args={[200, 180]} />
    </mesh>
  );
}

export function UnblockScene({ quality }: { quality: 'high' | 'low' }) {
  const ready = useUnblock((s) => s.ready);
  return (
    <>
      <Clock />
      <SceneEnvironment />
      <Camera />
      <Ground />
      <Sea />
      <AbuDhabiBuildings />
      <Mosques />
      <Palms />
      <StreetLights />
      <MapLabels />
      <Diorama />
      <AccessNetwork />
      <JourneyRoutes />
      <RepairPulses />
      <Barriers />
      <Places />
      <HomePin />
      <PickPlane />
      <Warmup />
      {ready && <Effects quality={quality} />}
    </>
  );
}

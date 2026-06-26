'use client';

// ───────────────────────────────────────────────────────────────
// COSMOS · SkyMap
// 3D celestial sphere. Device gyro drives the camera; a center
// raycaster fires haptics on lock; pinch adjusts FOV. Renders
// client-only — import this via next/dynamic with ssr:false.
// ───────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGesture } from '@use-gesture/react';
import { useCosmosStore } from '@/store/useCosmosStore';
import { resolveBodies } from '@/services/astronomyEngine';
import type { CelestialBody } from '@/types/cosmos';

const R = 100; // celestial sphere radius

// RA/Dec (deg) → point on the inside of the sphere
function radecToVec3(ra: number, dec: number, radius = R): THREE.Vector3 {
  const raR = (ra * Math.PI) / 180;
  const decR = (dec * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(decR) * Math.cos(raR),
    radius * Math.sin(decR),
    radius * Math.cos(decR) * Math.sin(raR),
  );
}

function Starfield() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ra = Math.random() * 360;
      const dec = (Math.acos(2 * Math.random() - 1) * 180) / Math.PI - 90;
      const v = radecToVec3(ra, dec, R - 2);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.5} color="#ffffff" sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

function Bodies({ bodies }: { bodies: CelestialBody[] }) {
  const setAimed = useCosmosStore((s) => s.setAimed);
  const aimed = useCosmosStore((s) => s.aimedObjectId);
  const refs = useRef<Record<string, THREE.Mesh>>({});
  const { camera } = useThree();
  const ray = useRef(new THREE.Raycaster());
  const lastLock = useRef<string | null>(null);

  useFrame(() => {
    // raycaster straight out of the camera center
    ray.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = Object.values(refs.current);
    const hits = ray.current.intersectObjects(meshes, false);
    const hitId = hits[0]?.object.userData.id ?? null;
    if (hitId !== lastLock.current) {
      lastLock.current = hitId;
      setAimed(hitId);
      if (hitId && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40]); // presence pulse
      }
    }
  });

  return (
    <>
      {bodies.map((b) => {
        const v = radecToVec3(b.ra, b.dec);
        const size = b.kind === 'sun' ? 4 : b.kind === 'moon' ? 3 : 2;
        const color =
          b.kind === 'sun' ? '#ffd66b'
          : b.kind === 'moon' ? '#dfe4ea'
          : '#b58cff';
        const locked = aimed === b.id;
        return (
          <mesh
            key={b.id}
            position={[v.x, v.y, v.z]}
            ref={(m) => {
              if (m) {
                m.userData.id = b.id;
                refs.current[b.id] = m;
              }
            }}
          >
            <sphereGeometry args={[size, 16, 16]} />
            <meshBasicMaterial color={color} />
            {locked && (
              <Html center distanceFactor={120}>
                <div className="whitespace-nowrap rounded-full border border-amber-300/50 bg-black/70 px-3 py-1 text-xs text-amber-100 backdrop-blur">
                  {b.glyph} {b.label} · {b.archetype}
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
    </>
  );
}

// Maps device orientation → camera quaternion each frame.
function GyroCamera({ fov }: { fov: number }) {
  const { camera } = useThree();
  const sensor = useCosmosStore((s) => s.sensor);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (sensor.available) {
      const z = THREE.MathUtils.degToRad(sensor.alpha);
      const x = THREE.MathUtils.degToRad(sensor.beta);
      const y = THREE.MathUtils.degToRad(sensor.gamma);
      const euler = new THREE.Euler(x, y, -z, 'YXZ');
      camera.quaternion.setFromEuler(euler);
    }
  });
  return null;
}

export default function SkyMap() {
  const now = useCosmosStore((s) => s.now);
  const sensor = useCosmosStore((s) => s.sensor);
  const requestSensors = useCosmosStore((s) => s.requestSensors);
  const bodies = useMemo(() => resolveBodies(now), [now]);
  const [fov, setFov] = useState(70);

  const bind = useGesture({
    onPinch: ({ offset: [d] }) => {
      // d grows as fingers spread; map to a 30–100° FOV band
      const next = THREE.MathUtils.clamp(70 - d * 0.05, 25, 100);
      setFov(next);
    },
  });

  return (
    <div {...bind()} className="relative h-[100dvh] w-full touch-none bg-black">
      <Canvas camera={{ fov, near: 0.1, far: 1000, position: [0, 0, 0.01] }}>
        <GyroCamera fov={fov} />
        <Starfield />
        <Bodies bodies={bodies} />
      </Canvas>

      {/* center crosshair */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border border-amber-300/40" />
        <div className="absolute h-px w-6 bg-amber-300/40" />
        <div className="absolute h-6 w-px bg-amber-300/40" />
      </div>

      {sensor.permission !== 'granted' && (
        <div className="absolute inset-x-0 bottom-32 flex justify-center">
          <button
            onClick={requestSensors}
            className="rounded-full border border-amber-300/50 bg-black/70 px-5 py-2.5 text-sm text-amber-100 backdrop-blur"
          >
            {sensor.permission === 'denied'
              ? 'motion blocked — tap to retry'
              : sensor.permission === 'unsupported'
                ? 'no motion sensor — drag to look (todo)'
                : 'enable motion to aim the sky'}
          </button>
        </div>
      )}
    </div>
  );
}

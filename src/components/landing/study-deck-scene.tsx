"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, RoundedBox } from "@react-three/drei";
import { useTheme } from "next-themes";
import * as THREE from "three";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

/** Subject colours, matching the folder palette (three.js can't read the app's oklch CSS vars). */
const SUBJECT_COLORS = ["#2a9d8f", "#e9a23b", "#6aa37a", "#e07a5f", "#8b7fd1"];

const CARD_W = 2.1;
const CARD_H = 2.8;
const CARD_D = 0.05;

/** Final fanned-out pose for each card: x, y, z, rotation around y and z. */
const FAN = [
  { x: -2.3, y: -0.15, z: -0.6, ry: 0.42, rz: 0.1 },
  { x: -1.15, y: 0.1, z: -0.3, ry: 0.22, rz: 0.05 },
  { x: 0, y: 0.2, z: 0, ry: 0, rz: 0 },
  { x: 1.15, y: 0.1, z: -0.3, ry: -0.22, rz: -0.05 },
  { x: 2.3, y: -0.15, z: -0.6, ry: -0.42, rz: -0.1 },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface Palette {
  card: string;
  line: string;
  check: string;
}

/**
 * A single note card: a rounded slab with a coloured subject tab and a few "lines of text".
 * The centre card is a checklist with a completed item, a nod to the roadmap/to-do features.
 */
function NoteCard({ index, palette, reduced }: { index: number; palette: Palette; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const pose = FAN[index];
  const accent = SUBJECT_COLORS[index];
  const isChecklist = index === 2;

  // Cards begin stacked in the middle and fan out, staggered — the page's one orchestrated moment.
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const delay = 0.25 + Math.abs(index - 2) * 0.12;
    const raw = reduced ? 1 : (clock.elapsedTime - start.current - delay) / 1.1;
    const t = easeOutCubic(THREE.MathUtils.clamp(raw, 0, 1));
    g.position.set(pose.x * t, pose.y * t - (1 - t) * 0.4, pose.z * t - index * 0.02);
    g.rotation.set(0, pose.ry * t, pose.rz * t);
  });

  const lines = isChecklist ? [0.9, 0.75, 0.85, 0.6] : [1.35, 1.1, 1.25, 0.85, 1.05];

  return (
    <group ref={ref}>
      <RoundedBox args={[CARD_W, CARD_H, CARD_D]} radius={0.09} smoothness={4}>
        <meshPhysicalMaterial color={palette.card} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.4} />
      </RoundedBox>

      {/* Subject tab */}
      <mesh position={[-CARD_W / 2 + 0.42, CARD_H / 2 - 0.3, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[0.5, 0.12, 0.01]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>

      {/* Title bar */}
      <mesh position={[-CARD_W / 2 + 0.85, CARD_H / 2 - 0.62, CARD_D / 2 + 0.005]}>
        <boxGeometry args={[1.3, 0.14, 0.01]} />
        <meshStandardMaterial color={palette.line} roughness={0.6} />
      </mesh>

      {lines.map((w, i) => {
        const y = CARD_H / 2 - 1.0 - i * 0.3;
        const x0 = -CARD_W / 2 + 0.2;
        return (
          <group key={i}>
            {isChecklist && (
              <mesh position={[x0 + 0.08, y, CARD_D / 2 + 0.006]}>
                <boxGeometry args={[0.16, 0.16, 0.012]} />
                <meshStandardMaterial color={i === 0 ? palette.check : palette.line} roughness={0.5} />
              </mesh>
            )}
            <mesh position={[x0 + (isChecklist ? 0.3 : 0) + w / 2, y, CARD_D / 2 + 0.005]}>
              <boxGeometry args={[w, 0.07, 0.01]} />
              <meshStandardMaterial color={palette.line} roughness={0.6} transparent opacity={i === 0 && isChecklist ? 0.45 : 1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Tilts the whole deck gently toward the pointer. */
function PointerTilt({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ pointer }) => {
    const g = ref.current;
    if (!g || reduced) return;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, pointer.x * 0.22, 0.06);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -pointer.y * 0.14, 0.06);
  });
  return <group ref={ref}>{children}</group>;
}

export default function StudyDeckScene() {
  const { resolvedTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const wrapper = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  // Stop rendering frames while the hero is scrolled out of view.
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const palette = useMemo<Palette>(
    () =>
      resolvedTheme === "dark"
        ? { card: "#2b2b2b", line: "#4b4b4b", check: "#6aa37a" }
        : { card: "#ffffff", line: "#dedcd8", check: "#6aa37a" },
    [resolvedTheme],
  );

  return (
    <div ref={wrapper} className="h-full w-full" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        frameloop={inView ? "always" : "never"}
        camera={{ position: [0, 0, 8.5], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        fallback={null}
      >
        <ambientLight intensity={resolvedTheme === "dark" ? 0.5 : 0.8} />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        {/* Local studio lighting for the clearcoat reflections — no HDR download needed. */}
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 4, 4]} scale={[8, 2, 1]} />
          <Lightformer intensity={0.8} position={[-5, 0, 2]} scale={[2, 6, 1]} />
          <Lightformer intensity={0.8} position={[5, 0, 2]} scale={[2, 6, 1]} />
        </Environment>
        <PointerTilt reduced={reduced}>
          {FAN.map((_, i) => (
            <Float
              key={i}
              enabled={!reduced}
              speed={1.2 + i * 0.15}
              rotationIntensity={0.15}
              floatIntensity={0.35}
              floatingRange={[-0.06, 0.06]}
            >
              <NoteCard index={i} palette={palette} reduced={reduced} />
            </Float>
          ))}
        </PointerTilt>
      </Canvas>
    </div>
  );
}

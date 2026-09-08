import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Mesh,
} from 'three';
import type { Line2 } from 'three-stdlib';
import {
  EXPLODE,
  representativeIsland,
  type GroupName,
  type Island,
  type System,
  type Vec3,
} from './layout';
import type { RefObject } from 'react';

type Part = { p: Vec3; s: Vec3; color: string };
type Layer =
  | 'hull'
  | 'compute'
  | 'cooling'
  | 'power'
  | 'network'
  | 'service'
  | 'shell'
  | 'lights';
const cube = new BoxGeometry(1, 1, 1);
const colors = {
  hull: '#3b535d',
  deck: '#b4b9b4',
  shell: '#c6cbc6',
  trim: '#e1e4d8',
  dark: '#26343a',
  teal: '#80d8cd',
  orange: '#dd9f53',
  violet: '#a6a1d6',
};
function createParts(layout: Island[]): Record<Layer, Part[]> {
  const b: Record<Layer, Part[]> = {
    hull: [],
    compute: [],
    cooling: [],
    power: [],
    network: [],
    service: [],
    shell: [],
    lights: [],
  };
  const add = (
    layer: Layer,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: string,
  ) => b[layer].push({ p: [x, y, z], s: [sx, sy, sz], color });
  for (const island of layout) {
    const { x, z } = island;
    // Twin pontoons, dark waterline, a recessed equipment deck and peripheral walkways.
    for (const dx of [-10.8, 10.8]) {
      add('hull', x + dx, 0.3, z, 5.7, 2.8, 32, colors.hull);
      add('hull', x + dx, -0.9, z, 5.9, 0.35, 31.4, '#132e3a');
      add('hull', x + dx, 0.3, z - 16.4, 4.8, 2.3, 1.3, colors.hull);
      add('hull', x + dx, 0.3, z + 16.4, 4.8, 2.3, 1.3, colors.hull);
    }
    add('hull', x, 1.8, z, 28, 0.9, 34, colors.deck);
    add('hull', x, 2.3, z, 27.1, 0.2, 33, '#7b8b8c');
    for (const dx of [-13.8, 13.8]) {
      add('service', x + dx, 3.1, z, 0.09, 0.09, 33.7, colors.trim);
      add('service', x + dx, 2.7, z, 0.07, 0.07, 33.7, colors.trim);
      for (let dz = -16; dz <= 16; dz += 2)
        add('service', x + dx, 2.8, z + dz, 0.08, 1.1, 0.08, colors.trim);
    }
    for (const dz of [-16.4, 16.4]) {
      add('service', x, 3.1, z + dz, 27.6, 0.09, 0.09, colors.trim);
      for (let dx = -12; dx <= 12; dx += 3)
        add('service', x + dx, 2.8, z + dz, 0.08, 1.1, 0.08, colors.trim);
    }
    // Central service spine and protected internal fiber tray.
    add('service', x, 2.65, z - 1.5, 2.5, 0.3, 28, '#d7d1ba');
    add('network', x, 6.1, z - 1.5, 0.5, 0.18, 28, colors.violet);
    for (const dz of [-12, -5, 2, 9]) {
      add('service', x - 1.3, 4.1, z + dz, 0.13, 3.1, 0.13, colors.trim);
      add('service', x + 1.3, 4.1, z + dz, 0.13, 3.1, 0.13, colors.trim);
      add('service', x, 5.65, z + dz, 3, 0.16, 0.18, colors.trim);
    }
    const displayed = Math.min(8, island.modules);
    for (let m = 0; m < displayed; m++) {
      const mx = x + (m % 2 === 0 ? -7 : 7);
      const mz = z - 11 + Math.floor(m / 2) * 6.5;
      add('compute', mx, 2.7, mz, 10.5, 0.25, 5.65, '#64777b');
      add('shell', mx, 5.7, mz, 10.6, 0.3, 5.8, colors.shell);
      // Long sides selectively disappear for the X-ray reveal; structural posts remain.
      add('shell', mx, 4.2, mz - 2.8, 10.3, 2.8, 0.15, colors.shell);
      add('shell', mx, 4.2, mz + 2.8, 10.3, 2.8, 0.15, colors.shell);
      for (const dx of [-5.1, 5.1]) {
        add('compute', mx + dx, 4.2, mz, 0.13, 3, 5.6, colors.trim);
        for (const dz of [-2.75, 2.75])
          add('compute', mx + dx, 4.15, mz + dz, 0.17, 3, 0.17, colors.trim);
      }
      // Roof panel seams and ventilation cassettes.
      for (let dx = -4; dx <= 4; dx += 2)
        add('shell', mx + dx, 5.87, mz, 0.04, 0.02, 5.65, '#879997');
      add('shell', mx, 5.99, mz - 1.1, 7.5, 0.32, 1.7, '#819494');
      for (let dx = -3.6; dx <= 3.6; dx += 0.45)
        add('shell', mx + dx, 6.16, mz - 1.1, 0.08, 0.025, 1.55, '#445e64');
      // Ten rack glyphs represent 80 real rack positions; the floor plan is schematic.
      for (const dz of [-1.75, 1.75])
        for (let r = 0; r < 5; r++) {
          const rx = mx - 4 + r * 2;
          add('compute', rx, 3.95, mz + dz, 1.4, 2.35, 1.25, colors.dark);
          for (let u = 0; u < 4; u++) {
            add(
              'compute',
              rx,
              3.1 + u * 0.55,
              mz + dz + (dz < 0 ? 0.64 : -0.64),
              1.15,
              0.38,
              0.04,
              '#42575b',
            );
            add(
              'lights',
              rx + 0.4,
              3.14 + u * 0.55,
              mz + dz + (dz < 0 ? 0.68 : -0.68),
              0.06,
              0.05,
              0.03,
              colors.teal,
            );
          }
        }
      add('compute', mx, 5.18, mz - 0.65, 9.6, 0.12, 0.12, colors.teal);
      add('compute', mx, 5.18, mz + 0.65, 9.6, 0.12, 0.12, '#d49b75');
      add('network', mx, 5.4, mz, 9.9, 0.13, 0.16, colors.violet);
    }
    // Power skids and UPS are distinct from the external energy supply.
    for (let j = 0; j < 3; j++) {
      add('power', x - 9 + j * 2.4, 3.65, z + 13, 1.8, 2.5, 3.7, '#6f817e');
      add('power', x - 9 + j * 2.4, 3.5, z + 15, 1.5, 1.6, 0.15, colors.dark);
      add(
        'power',
        x - 9 + j * 2.4,
        4.7,
        z + 15.1,
        1.5,
        0.12,
        0.04,
        colors.orange,
      );
    }
    add('cooling', x + 5, 3.4, z + 13, 2.2, 1.9, 4.2, '#799f9c');
    add('cooling', x + 9, 3.4, z + 13, 3, 1.9, 4.2, '#92aaa8');
    for (let dx = 7.7; dx <= 10.3; dx += 0.23)
      add('cooling', x + dx, 4.39, z + 13, 0.08, 0.04, 3.9, '#465f66');
    // Stern access gantry and a legible vertical silhouette.
    add('service', x + 12, 7.0, z + 12, 0.35, 9.5, 0.35, colors.trim);
    add('service', x + 9, 11.6, z + 12, 6.2, 0.24, 0.3, colors.trim);
    add('service', x + 6, 9.7, z + 12, 0.08, 3.6, 0.08, colors.dark);
    add('service', x - 11, 7, z + 12, 0.18, 5.2, 0.18, colors.trim);
    add('lights', x - 11, 9.7, z + 12, 0.22, 0.22, 0.22, '#e7ac77');
  }
  return b;
}
function Batch({
  parts,
  layer,
  cutaway,
  onSelect,
}: {
  parts: Part[];
  layer: Layer;
  cutaway: boolean;
  onSelect: (s: System) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const matrix = new Matrix4();
    parts.forEach((part, i) => {
      matrix.compose(
        new Vector3(...part.p),
        new Quaternion(),
        new Vector3(...part.s),
      );
      ref.current!.setMatrixAt(i, matrix);
      ref.current!.setColorAt(i, new Color(part.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts, cutaway]);
  if (!parts.length || (layer === 'shell' && cutaway)) return null;
  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(
      layer === 'shell' || layer === 'lights'
        ? 'compute'
        : layer === 'hull' || layer === 'service'
          ? 'overview'
          : layer,
    );
  };
  return (
    <instancedMesh
      ref={ref}
      args={[cube, undefined, parts.length]}
      onClick={pick}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      {layer === 'lights' ? (
        <meshBasicMaterial toneMapped={false} />
      ) : (
        <meshStandardMaterial roughness={0.64} metalness={0.23} />
      )}
    </instancedMesh>
  );
}
function AnimatedGroup({
  name,
  progress,
  children,
}: {
  name: GroupName;
  progress: RefObject<number>;
  children: React.ReactNode;
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current)
      ref.current.position.set(
        ...(EXPLODE[name].map((v) => v * progress.current) as Vec3),
      );
  });
  return (
    <group ref={ref} name={name}>
      {children}
    </group>
  );
}
type Anchor = { p: Vec3; group: GroupName };
function Flow({
  anchors,
  progress,
  color,
  dashed = false,
  animate,
}: {
  anchors: Anchor[];
  progress: RefObject<number>;
  color: string;
  dashed?: boolean;
  animate: boolean;
}) {
  const line = useRef<Line2>(null);
  const dot = useRef<Mesh>(null);
  const elapsed = useRef(0);
  useFrame((_, dt) => {
    const pts = anchors.map(
      (a) =>
        a.p.map((v, i) => v + EXPLODE[a.group][i] * progress.current) as Vec3,
    );
    line.current?.geometry.setPositions(pts.flat());
    if (dashed) line.current?.computeLineDistances();
    if (animate && !document.hidden) elapsed.current += Math.min(dt, 0.05);
    const t = (elapsed.current * 0.42) % (pts.length - 1);
    const i = Math.floor(t);
    dot.current?.position.lerpVectors(
      new Vector3(...pts[i]),
      new Vector3(...pts[i + 1]),
      t - i,
    );
  });
  return (
    <>
      <Line
        ref={line}
        points={anchors.map((a) => a.p)}
        color={color}
        lineWidth={3}
        dashed={dashed}
        dashSize={0.6}
        gapSize={0.4}
        transparent
        opacity={0.95}
      />
      <mesh ref={dot}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </>
  );
}
export function Facility({
  layout,
  xray,
  exploded,
  selected,
  inside,
  reducedMotion,
  onSelect,
}: {
  layout: Island[];
  xray: boolean;
  exploded: boolean;
  selected: System;
  inside: boolean;
  reducedMotion: boolean;
  onSelect: (s: System) => void;
}) {
  const parts = useMemo(() => createParts(layout), [layout]);
  const progress = useRef(0);
  useFrame((_, dt) => {
    progress.current +=
      ((exploded ? 1 : 0) - progress.current) *
      (reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 5));
  });
  const cutaway = !inside && (xray || selected !== 'overview');
  const p = representativeIsland(layout);
  const a = (x: number, y: number, z: number, group: GroupName): Anchor => ({
    p: [p.x + x, y, p.z + z],
    group,
  });
  const pipeMode = selected === 'cooling' || xray;
  return (
    <group>
      {(
        [
          'hull',
          'compute',
          'cooling',
          'power',
          'network',
          'service',
        ] as GroupName[]
      ).map((name) => (
        <AnimatedGroup key={name} name={name} progress={progress}>
          <Batch
            parts={parts[name]}
            layer={name}
            cutaway={cutaway}
            onSelect={onSelect}
          />
          {name === 'compute' && (
            <>
              <Batch
                parts={parts.shell}
                layer="shell"
                cutaway={cutaway}
                onSelect={onSelect}
              />
              <Batch
                parts={parts.lights}
                layer="lights"
                cutaway={cutaway}
                onSelect={onSelect}
              />
            </>
          )}
          {exploded && !inside && (
            <Html
              position={[
                p.x + (name === 'power' ? -10 : name === 'cooling' ? 9 : 0),
                name === 'hull' ? 1 : 5,
                p.z + 16,
              ]}
              center
              zIndexRange={[20, 0]}
            >
              <span className={`scene-tag ${name}`}>
                {name === 'network' ? 'NETWORKING' : name.toUpperCase()}
              </span>
            </Html>
          )}
        </AnimatedGroup>
      ))}
      {/* Moorings and inter-platform service bridges use canonical hull positions. */}
      {layout.map((island, i) => (
        <group key={island.id}>
          <Line
            points={[
              [island.x - 13, 0.1, island.z + 15],
              [island.x - 19, -1.3, island.z + 21],
              [island.x - 25, -3, island.z + 28],
            ]}
            color="#45616a"
            lineWidth={1.2}
          />
          {i > 0 && (
            <Line
              points={[
                [layout[i - 1].x, 1, layout[i - 1].z],
                [island.x, 1, island.z],
              ]}
              color="#546d74"
              lineWidth={4}
            />
          )}
        </group>
      ))}
      {(pipeMode || selected === 'power' || selected === 'network') &&
        !inside && (
          <>
            {pipeMode && (
              <>
                <Flow
                  anchors={[
                    a(9, 4.7, 12, 'cooling'),
                    a(5, 4.7, 12, 'cooling'),
                    a(5, 5.2, -11.7, 'compute'),
                    a(-7, 5.2, -11.7, 'compute'),
                  ]}
                  progress={progress}
                  color="#66efe4"
                  animate={!reducedMotion}
                />
                <Flow
                  anchors={[
                    a(-7, 5.2, -10.3, 'compute'),
                    a(3, 5.2, -10.3, 'compute'),
                    a(3, 4.7, 14, 'cooling'),
                    a(9, 4.7, 14, 'cooling'),
                  ]}
                  progress={progress}
                  color="#f4aa87"
                  animate={!reducedMotion}
                />
                <Flow
                  anchors={[
                    a(19, -1, 9, 'hull'),
                    a(12, 1, 9, 'hull'),
                    a(10.7, 4.6, 11.5, 'cooling'),
                  ]}
                  progress={progress}
                  color="#64c5f3"
                  dashed
                  animate={!reducedMotion}
                />
                <Flow
                  anchors={[
                    a(10.7, 4.6, 14.5, 'cooling'),
                    a(13, 1, 17, 'hull'),
                    a(23, -1, 20, 'hull'),
                  ]}
                  progress={progress}
                  color="#eba575"
                  dashed
                  animate={!reducedMotion}
                />
              </>
            )}
            {(selected === 'power' || xray) && (
              <Flow
                anchors={[
                  a(-32, -1, 26, 'hull'),
                  a(-14, 2.5, 15, 'power'),
                  a(-9, 4.9, 13, 'power'),
                  a(-2, 5.6, 9, 'compute'),
                  a(-2, 5.6, -11, 'compute'),
                  a(-7, 4.8, -11, 'compute'),
                ]}
                progress={progress}
                color="#ffc77c"
                animate={!reducedMotion}
              />
            )}
            {(selected === 'network' || xray) && (
              <Flow
                anchors={[
                  a(8, -1, -34, 'hull'),
                  a(0, 6.4, -15, 'network'),
                  a(0, 6.4, -11, 'network'),
                  a(-7, 5.5, -11, 'compute'),
                ]}
                progress={progress}
                color="#c6adff"
                dashed
                animate={!reducedMotion}
              />
            )}
          </>
        )}
      {selected === 'cooling' && !exploded && !inside && (
        <>
          <Html position={[p.x + 9, 6.5, p.z + 13]} center>
            <span className="scene-tag cooling">
              HEAT EXCHANGER · TWO CIRCUITS
            </span>
          </Html>
          <Html position={[p.x - 7, 8, p.z - 11]} center>
            <span className="scene-tag compute">CLOSED TECHNICAL LOOP</span>
          </Html>
        </>
      )}
      {selected === 'power' && !exploded && (
        <Html position={[p.x - 9, 7, p.z + 13]} center>
          <span className="scene-tag power">
            EXTERNAL SUPPLY → UPS → COMPUTE
          </span>
        </Html>
      )}
    </group>
  );
}

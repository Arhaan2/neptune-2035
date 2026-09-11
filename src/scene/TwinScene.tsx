import { activePowerDesign } from '../twin/transfer/topology';
import { engineeringIdentity } from '../twin/catalog/equipment';
import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import {
  BackSide,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type {
  Asset,
  Connection,
  Design,
  EquipmentState,
  ModuleSpec,
  SimulationState,
  Vec3,
} from '../twin/types';
import {
  connectionsForModule,
  loopRouteM,
  moduleAssets,
  resolveAsset,
} from '../twin/assets/design';
import {
  clampInterior,
  footprintBounds,
  interiorWaypoint,
  presentationOffset,
  presentedPosition,
  presentedRoute,
  selectedModule,
  upstreamConnections,
} from './twinGeometry';
import './twinScene.css';

export interface TwinSceneProps {
  design: Design;
  state: SimulationState;
  selectedId: string;
  onSelect: (id: string) => void;
  xray: boolean;
  exploded: boolean;
  dimensions: boolean;
  inside: boolean;
  onExitInterior: () => void;
  focus:
    | 'campus'
    | 'selection'
    | 'cooling'
    | 'top'
    | 'platform'
    | 'module'
    | 'rack';
  resetId: number;
  reducedMotion: boolean;
  onManual: () => void;
  onReady?: () => void;
}
const COLORS: Record<Asset['type'], string> = {
  platform: '#819899',
  hull: '#18353e',
  module: '#bfcdca',
  rack: '#203840',
  compute: '#41616b',
  cdu: '#3b9d91',
  exchanger: '#49b6a0',
  pump: '#3ba690',
  valve: '#b7cfd0',
  pipe: '#53c6b5',
  transformer: '#b4a484',
  switchboard: '#bdab8b',
  battery: '#c28d52',
  network: '#837aac',
  external: '#758f9f',
};
const MEDIUM_COLORS: Record<Connection['medium'], string> = {
  power: '#edb878',
  technical: '#64ebc5',
  seawater: '#57aeed',
  cluster: '#c3a2f1',
  'external-network': '#a298fb',
};
const UNIT_SCALE: Vec3 = [1, 1, 1];
function stateColor(state: EquipmentState | undefined, fallback: string) {
  if (state === 'failed') return '#ff5d52';
  if (state === 'maintenance' || state === 'isolated') return '#667882';
  if (state === 'starting') return '#ffd17c';
  if (state === 'standby') return '#7e9ba0';
  return fallback;
}
function Instances({
  assets,
  selectedId,
  onSelect,
  exploded,
  color,
  opacity = 1,
  states,
  scale = UNIT_SCALE,
  surface = false,
}: {
  assets: Asset[];
  selectedId: string;
  onSelect: (id: string) => void;
  exploded: boolean;
  color?: string;
  opacity?: number;
  states?: Record<string, EquipmentState>;
  scale?: Vec3;
  surface?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D(),
      tint = new Color();
    assets.forEach((asset, i) => {
      dummy.position.fromArray(presentedPosition(asset, exploded));
      dummy.scale.set(
        ...(asset.dimensionsM.map((d, j) =>
          Math.max(0.035, d * scale[j]),
        ) as Vec3),
      );
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      const base = stateColor(states?.[asset.id], color ?? COLORS[asset.type]);
      ref.current!.setColorAt(
        i,
        tint.set(
          asset.id === selectedId && !states?.[asset.id] ? '#edf5da' : base,
        ),
      );
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [assets, selectedId, exploded, color, states, scale]);
  if (!assets.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, assets.length]}
      castShadow
      receiveShadow
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (event.instanceId === undefined) return;
        event.stopPropagation();
        onSelect(assets[event.instanceId].id);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="white"
        roughness={0.73}
        metalness={0.25}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity > 0.7}
        polygonOffset={surface}
        polygonOffsetFactor={surface ? -1 : 0}
        polygonOffsetUnits={surface ? -1 : 0}
      />
    </instancedMesh>
  );
}
function ModuleEnvelopeDetails({
  assets,
  selectedModuleId,
  exploded,
  xray,
  onSelect,
}: {
  assets: Asset[];
  selectedModuleId?: string;
  exploded: boolean;
  xray: boolean;
  onSelect: (id: string) => void;
}) {
  const pieces = useMemo(() => {
    const roof: Asset[] = [],
      louvers: Asset[] = [],
      corners: Asset[] = [];
    for (const asset of assets) {
      const [x, y, z] = asset.positionM,
        [w, h, d] = asset.dimensionsM;
      const make = (positionM: Vec3, dimensionsM: Vec3): Asset => ({
        ...asset,
        positionM,
        dimensionsM,
      });
      const panelCount = Math.max(2, Math.round(w / 3));
      for (let i = 1; i < panelCount; i++)
        roof.push(
          make(
            [
              x - w / 2 + (i * w) / panelCount,
              y +
                h / 2 -
                0.012 +
                (exploded && asset.id === selectedModuleId ? 3 : 0),
              z,
            ],
            [0.075, 0.024, d - 0.16],
          ),
        );
      for (const side of [-1, 1]) {
        for (let row = 0; row < 4; row++)
          louvers.push(
            make(
              [x, y - 0.25 - row * 0.13, z + side * (d / 2 - 0.012)],
              [w - 0.65, 0.045, 0.024],
            ),
          );
        if (asset.id !== selectedModuleId)
          for (const end of [-1, 1])
            corners.push(
              make(
                [x + end * (w / 2 - 0.065), y, z + side * (d / 2 - 0.065)],
                [0.13, h, 0.13],
              ),
            );
      }
    }
    return { roof, louvers, corners };
  }, [assets, selectedModuleId, exploded]);
  const common = { exploded, onSelect, selectedId: '', surface: true };
  return (
    <group>
      <Instances
        assets={pieces.roof}
        {...common}
        color="#688991"
        opacity={xray ? 0.2 : 0.8}
      />
      <Instances
        assets={pieces.louvers}
        {...common}
        color="#426879"
        opacity={xray ? 0.16 : 0.8}
      />
      <Instances
        assets={pieces.corners}
        {...common}
        color="#72969b"
        opacity={xray ? 0.18 : 0.8}
      />
    </group>
  );
}
const waveVertex = `varying vec3 vWorld; uniform float time; void main(){ vec3 p=position; p.z += sin(p.x*.14+time*.4)*.13 + sin(p.y*.2+time*.3)*.08; vec4 world=modelMatrix*vec4(p,1.); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`;
const waveFragment = `varying vec3 vWorld; uniform float time; void main(){float wave=sin(vWorld.x*.6+vWorld.z*1.3+time*.8)*sin(vWorld.z*2.1-time*.5); float fine=pow(max(0.,sin(vWorld.x*1.4+vWorld.z*2.8+sin(vWorld.x*.2+time*.4)*2.+sin(vWorld.z*.23)*3.)),16.); float distanceFade=exp(-length(vWorld.xz)*.0025); float trail=exp(-pow((vWorld.x+55.)/24.,2.))*(1.-smoothstep(-250.,40.,vWorld.z)); vec3 c=mix(vec3(.055,.13,.17),vec3(.11,.23,.28),wave*.08+.2); c+=vec3(.22,.13,.075)*trail*(.23+fine*.45); c+=vec3(.14,.26,.3)*fine*.045*distanceFade; float horizon=smoothstep(10.,600.,length(vWorld.xz)); c=mix(c,vec3(.49,.29,.23),horizon*.82); gl_FragColor=vec4(c,1.); }`;
function SunsetSky({ radius }: { radius: number }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
        vertexShader:
          'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'varying vec3 vDirection; void main(){vec3 d=normalize(vDirection); float h=max(d.y,0.); vec3 c=mix(vec3(.77,.40,.26),vec3(.14,.23,.31),smoothstep(0.,.45,h)); c=mix(vec3(.45,.28,.24),c,smoothstep(-.1,.015,d.y)); vec3 sun=normalize(vec3(-150.,3.,-100.)); float sd=dot(d,sun); float glow=pow(max(0.,sd),100.); c+=vec3(.27,.13,.035)*glow; float disk=smoothstep(.99993,.99996,sd); c=mix(c,vec3(1.,.82,.52),disk); gl_FragColor=vec4(c,1.);}',
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-100}>
      <sphereGeometry args={[Math.max(1800, radius * 15), 32, 16]} />
    </mesh>
  );
}
function Water({ quiet, radius }: { quiet: boolean; radius: number }) {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: waveVertex,
        fragmentShader: waveFragment,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    const current = ref.current?.material as ShaderMaterial | undefined;
    if (current && !quiet && !document.hidden)
      current.uniforms.time.value += Math.min(0.05, dt);
  });
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      material={material}
    >
      <planeGeometry
        args={[
          Math.max(3000, radius * 12),
          Math.max(3000, radius * 12),
          96,
          96,
        ]}
      />
    </mesh>
  );
}
function ModuleStructure({
  asset,
  exploded,
  xray,
  inside,
}: {
  asset: Asset;
  exploded: boolean;
  xray: boolean;
  inside: boolean;
}) {
  const p = presentedPosition(asset, exploded),
    [w, h, d] = asset.dimensionsM;
  // Every structural face lies on the canonical envelope; wall thickness is an illustrative 80 mm.
  const wall = (position: Vec3, dimensions: Vec3, key: string, opacity = 1) => (
    <mesh key={key} position={position} receiveShadow castShadow>
      <boxGeometry args={dimensions} />
      <meshStandardMaterial
        color="#bacdca"
        roughness={0.72}
        metalness={0.25}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity > 0.7}
      />
    </mesh>
  );
  return (
    <group position={p}>
      {wall([0, -h / 2 + 0.04, 0], [w, 0.08, d], 'floor')}
      {wall(
        [0, h / 2 - 0.04 + (exploded ? 3 : 0), 0],
        [w, 0.08, d],
        'roof',
        inside ? 0.05 : xray ? 0.09 : 0.75,
      )}
      {[-1, 1].map((side) =>
        wall(
          [0, 0, side * (d / 2 - 0.04)],
          [w, h, 0.08],
          `wall-${side}`,
          inside || xray || exploded ? 0.06 : 0.22,
        ),
      )}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) =>
          wall(
            [x * (w / 2 - 0.09), 0, z * (d / 2 - 0.09)],
            [0.18, h, 0.18],
            `${x}/${z}`,
          ),
        ),
      )}
      {wall([0, -h / 2 + 0.052, 0], [18.8, 0.015, 2.6], 'aisle')}
      <mesh
        position={[-1.5, -h / 2 + 0.065, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[19, 0.06]} />
        <meshBasicMaterial color="#4dc3a6" />
      </mesh>
    </group>
  );
}
function PumpEnvelope({
  asset,
  state,
  exploded,
  onSelect,
}: {
  asset: Asset;
  state?: EquipmentState;
  exploded: boolean;
  onSelect: (id: string) => void;
}) {
  const [w, h, d] = asset.dimensionsM;
  const color = stateColor(state, COLORS.pump);
  return (
    <group
      position={presentedPosition(asset, exploded)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(asset.id);
      }}
    >
      <mesh position={[0, -h / 2 + 0.07, 0]}>
        <boxGeometry args={[w, 0.14, d]} />
        <meshStandardMaterial color="#29464d" roughness={0.7} metalness={0.6} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[w * 0.08, -h * 0.07, 0]}>
        <cylinderGeometry args={[d * 0.44, d * 0.44, w * 0.7, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[-w * 0.36, -h * 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[d * 0.46, d * 0.46, w * 0.18, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[-w * 0.35, h * 0.3, 0]}>
        <cylinderGeometry args={[d * 0.17, d * 0.17, h * 0.35, 12]} />
        <meshStandardMaterial color="#a5b9b7" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[w * 0.19, h * 0.18, 0]}>
        <boxGeometry args={[w * 0.22, h * 0.14, d * 0.42]} />
        <meshStandardMaterial
          color={color}
          emissive={state === 'running' ? '#36836f' : '#000000'}
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
}
function SelectionOutline({
  asset,
  exploded,
}: {
  asset: Asset;
  exploded: boolean;
}) {
  return (
    <mesh
      position={presentedPosition(asset, exploded)}
      scale={asset.dimensionsM.map((d) => d + 0.045) as Vec3}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color="#eaffd5"
        wireframe
        transparent
        opacity={0.8}
        depthTest={false}
      />
    </mesh>
  );
}
function PipeRoutes({
  connections,
  assetMap,
  exploded,
  selectedId,
}: {
  connections: Connection[];
  assetMap: Map<string, Asset>;
  exploded: boolean;
  selectedId: string;
}) {
  const lines = useMemo(
    () =>
      Object.entries(MEDIUM_COLORS).map(([medium, color]) => {
        const points: number[] = [];
        connections
          .filter((c) => c.medium === medium && c.enabled)
          .forEach((connection) => {
            const route = presentedRoute(connection, assetMap, exploded);
            route.slice(1).forEach((p, i) => points.push(...route[i], ...p));
          });
        return { medium, color, points: new Float32Array(points) };
      }),
    [connections, assetMap, exploded],
  );
  const selected = connections
    .filter((c) => c.from === selectedId || c.to === selectedId)
    .slice(0, 20);
  return (
    <group>
      {lines
        .filter((l) => l.points.length)
        .map((l) => (
          <lineSegments key={l.medium}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[l.points, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={l.color} transparent opacity={0.64} />
          </lineSegments>
        ))}
      {selected.map((c) => (
        <Line
          key={c.id}
          points={presentedRoute(c, assetMap, exploded)}
          color={MEDIUM_COLORS[c.medium]}
          lineWidth={2.3}
          dashed={!c.enabled}
          dashSize={0.22}
          gapSize={0.12}
        />
      ))}
    </group>
  );
}
function CanonicalPipes({
  moduleSpec,
  details,
  exploded,
  onSelect,
}: {
  moduleSpec: ModuleSpec;
  details: Asset[];
  exploded: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  const technical = details.find((a) => a.id.endsWith('/pipe-tech'));
  const sea = details.filter((a) => a.id.endsWith('/pipe-sea'));
  const segments = useMemo(() => {
    const route = loopRouteM(moduleSpec),
      offset = presentationOffset('pipe', exploded);
    return route.slice(1).map((p, i) => {
      const a = new Vector3(...route[i]).add(new Vector3(...offset)),
        b = new Vector3(...p).add(new Vector3(...offset));
      return {
        position: a.clone().lerp(b, 0.5),
        length: a.distanceTo(b),
        rotation: new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          b.clone().sub(a).normalize(),
        ),
      };
    });
  }, [moduleSpec, exploded]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const obj = new Object3D();
    segments.forEach((segment, i) => {
      obj.position.copy(segment.position);
      obj.quaternion.copy(segment.rotation);
      obj.scale.set(
        (technical?.ratings.diameterM ?? 0.18) / 2,
        segment.length,
        (technical?.ratings.diameterM ?? 0.18) / 2,
      );
      obj.updateMatrix();
      ref.current!.setMatrixAt(i, obj.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [segments, technical]);
  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, segments.length]}
        onClick={(e) => {
          e.stopPropagation();
          if (technical) onSelect(technical.id);
        }}
      >
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial
          color={MEDIUM_COLORS.technical}
          roughness={0.42}
          metalness={0.6}
        />
      </instancedMesh>
      <Instances
        assets={sea}
        exploded={exploded}
        selectedId=""
        onSelect={onSelect}
        color={MEDIUM_COLORS.seawater}
      />
    </group>
  );
}
function AssetDimensions({
  asset,
  exploded,
}: {
  asset: Asset;
  exploded: boolean;
}) {
  const [x, y, z] = presentedPosition(asset, exploded),
    [w, h, d] = asset.dimensionsM;
  const corner: Vec3 = [x - w / 2, y - h / 2, z - d / 2 - 0.7];
  const end: Vec3 = [x + w / 2, corner[1], corner[2]];
  return (
    <group>
      <Line points={[corner, end]} color="#d3e1ca" lineWidth={1} />
      <Line
        points={[
          [x + w / 2 + 0.6, y - h / 2, z - d / 2],
          [x + w / 2 + 0.6, y - h / 2, z + d / 2],
        ]}
        color="#d3e1ca"
      />
      <Line
        points={[
          [x - w / 2 - 0.5, y - h / 2, z - d / 2],
          [x - w / 2 - 0.5, y + h / 2, z - d / 2],
        ]}
        color="#d3e1ca"
      />
      <Html
        center
        position={[x, corner[1], corner[2]]}
        className="twin-dimension"
      >
        <span>{w.toFixed(2)} m</span>
      </Html>
      <Html
        center
        position={[x + w / 2 + 0.6, y - h / 2, z]}
        className="twin-dimension"
      >
        <span>{d.toFixed(2)} m</span>
      </Html>
      <Html
        center
        position={[x - w / 2 - 0.5, y, z - d / 2]}
        className="twin-dimension"
      >
        <span>{h.toFixed(2)} m</span>
      </Html>
    </group>
  );
}
function FlowArrow({ route, color }: { route: Vec3[]; color: string }) {
  const geometry = useMemo(() => {
    if (route.length < 2) return null;
    const a = new Vector3(...route[0]),
      b = new Vector3(...route[1]);
    const direction = b.clone().sub(a);
    if (direction.length() < 0.1) return null;
    return {
      position: a.lerp(b, 0.5),
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.normalize(),
      ),
    };
  }, [route]);
  return geometry ? (
    <mesh position={geometry.position} quaternion={geometry.quaternion}>
      <coneGeometry args={[0.11, 0.35, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  ) : null;
}
function TwinFacility({
  props,
  moduleSpec,
  details,
  active,
}: {
  props: TwinSceneProps;
  moduleSpec?: ModuleSpec;
  details: Asset[];
  active?: Asset;
}) {
  const envelopes = useMemo(
    () => props.design.assets.filter((a) => a.type === 'module'),
    [props.design],
  );
  const shells = useMemo(
    () =>
      props.design.assets.filter(
        (a) => a.type === 'module' && a.id !== moduleSpec?.id,
      ),
    [props.design, moduleSpec],
  );
  const platforms = useMemo(
    () => props.design.assets.filter((a) => a.type === 'platform'),
    [props.design],
  );
  const hulls = useMemo(
    () => props.design.assets.filter((a) => a.type === 'hull'),
    [props.design],
  );
  const globals = useMemo(
    () =>
      props.design.assets.filter(
        (a) => !['module', 'platform', 'hull', 'pipe'].includes(a.type),
      ),
    [props.design],
  );
  const moduleAsset = moduleSpec
    ? resolveAsset(props.design, moduleSpec.id)
    : undefined;
  const racks = useMemo(
    () => details.filter((a) => a.type === 'rack'),
    [details],
  );
  const nodes = useMemo(
    () => details.filter((a) => a.type === 'compute'),
    [details],
  );
  const equipment = useMemo(
    () =>
      details.filter(
        (a) => !['rack', 'compute', 'module', 'pipe', 'pump'].includes(a.type),
      ),
    [details],
  );
  const connections = useMemo(() => {
    if (!moduleSpec) return [];
    const local = connectionsForModule(props.design, moduleSpec.id);
    const rackId = props.selectedId.includes('/rack-')
      ? props.selectedId.split('/node-')[0]
      : '';
    // Trunk routes and the exact selected rack branches remain visible; other node branches are LOD-hidden.
    return [
      ...upstreamConnections(props.design.connections, [
        moduleSpec.powerDomainId,
        moduleSpec.networkDomainId,
      ]),
      ...local,
    ]
      .filter((c, i, a) => a.findIndex((other) => other.id === c.id) === i)
      .filter((c) => !c.from.includes('/node-') && !c.to.includes('/node-'))
      .filter(
        (c) =>
          (!c.from.includes('/rack-') && !c.to.includes('/rack-')) ||
          c.from.startsWith(rackId || '\0') ||
          c.to.startsWith(rackId || '\0'),
      );
  }, [props.design, props.selectedId, moduleSpec]);
  const assetMap = useMemo(
    () => new Map([...props.design.assets, ...details].map((a) => [a.id, a])),
    [props.design, details],
  );
  const states = props.state.modules.find(
    (m) => m.id === moduleSpec?.id,
  )?.states;
  const common = {
    selectedId: props.selectedId,
    onSelect: props.onSelect,
    exploded: props.exploded,
  };
  const selectedState = props.state.modules.find(
    (m) => m.id === moduleSpec?.id,
  );
  const unavailable = (id: string) =>
    props.state.failedAssetIds.includes(id) ||
    ['failed', 'isolated', 'maintenance'].includes(states?.[id] ?? '');
  const visualConnections = connections.map((connection) => ({
    ...connection,
    enabled:
      connection.enabled &&
      !unavailable(connection.from) &&
      !unavailable(connection.to) &&
      !(moduleSpec && unavailable(moduleSpec.id)),
  }));
  const pumpInactive = (id: string) =>
    assetMap.get(id)?.type === 'pump' && states?.[id] !== 'running';
  return (
    <group>
      <Instances assets={hulls} {...common} />
      <Instances assets={platforms} {...common} />
      <Instances assets={shells} {...common} opacity={props.xray ? 0.35 : 1} />
      <ModuleEnvelopeDetails
        assets={envelopes}
        selectedModuleId={moduleSpec?.id}
        exploded={props.exploded}
        xray={props.xray}
        onSelect={props.onSelect}
      />
      <Instances assets={globals} {...common} />
      {moduleAsset && (
        <ModuleStructure
          asset={moduleAsset}
          exploded={props.exploded}
          xray={props.xray}
          inside={props.inside}
        />
      )}
      <Instances
        assets={racks}
        {...common}
        opacity={props.xray || props.inside ? 0.17 : 0.75}
      />
      <Instances assets={nodes} {...common} states={states} />
      <Instances assets={equipment} {...common} states={states} />
      {details
        .filter((a) => a.type === 'pump')
        .map((asset) => (
          <PumpEnvelope
            key={asset.id}
            asset={asset}
            state={states?.[asset.id]}
            exploded={props.exploded}
            onSelect={props.onSelect}
          />
        ))}
      {moduleSpec && (
        <CanonicalPipes
          moduleSpec={moduleSpec}
          details={details}
          exploded={props.exploded}
          onSelect={props.onSelect}
        />
      )}
      <PipeRoutes
        connections={visualConnections}
        assetMap={assetMap}
        exploded={props.exploded}
        selectedId={props.selectedId}
      />
      {visualConnections
        .filter(
          (c) =>
            c.enabled &&
            !pumpInactive(c.from) &&
            !pumpInactive(c.to) &&
            ((c.medium === 'technical' &&
              (selectedState?.technicalFlowM3S ?? 0) > 0) ||
              (c.medium === 'seawater' &&
                (selectedState?.seawaterFlowM3S ?? 0) > 0)),
        )
        .slice(0, 14)
        .map((c) => (
          <FlowArrow
            key={`arrow-${c.id}`}
            route={presentedRoute(c, assetMap, props.exploded)}
            color={MEDIUM_COLORS[c.medium]}
          />
        ))}
      {active && <SelectionOutline asset={active} exploded={props.exploded} />}
      {props.dimensions && (active ?? moduleAsset) && (
        <AssetDimensions
          asset={(active ?? moduleAsset)!}
          exploded={props.exploded}
        />
      )}
      {active && props.focus !== 'campus' && (
        <Html
          position={
            presentedPosition(active, props.exploded).map(
              (v, i) => v + (i === 1 ? active.dimensionsM[1] / 2 + 0.4 : 0),
            ) as Vec3
          }
          center
          className="twin-asset-label"
        >
          <span>{active.name}</span>
          <small>{active.id}</small>
        </Html>
      )}
    </group>
  );
}
interface CameraPose {
  position: Vector3;
  target: Vector3;
}
function CameraRig({
  props,
  moduleSpec,
  active,
  waypoint,
}: {
  props: TwinSceneProps;
  moduleSpec?: ModuleSpec;
  active?: Asset;
  waypoint: number;
}) {
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<CameraPose>({
    position: new Vector3(),
    target: new Vector3(),
  });
  const transitioning = useRef(true),
    wasInside = useRef(false);
  const exterior = useRef<CameraPose | null>(null);
  const keys = useRef(new Set<string>()),
    yaw = useRef(Math.PI / 2),
    pitch = useRef(0);
  const diagnosticAt = useRef(0);
  const snapshots = useRef(new Map<string, CameraPose>()),
    lastContext = useRef('');
  const moduleId = moduleSpec?.id;
  const bounds = useMemo(
    () =>
      footprintBounds(props.design.assets.filter((a) => a.type === 'platform')),
    [props.design],
  );
  const inside = props.inside && !!moduleSpec;
  // Use a stable current-props ref for DOM event handlers, avoiding resubscription on solver ticks.
  const current = useRef({ props, moduleSpec, inside });
  useLayoutEffect(() => {
    current.current = { props, moduleSpec, inside };
  });
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const context = `${props.focus}:${props.focus === 'campus' || props.focus === 'top' ? props.design.revision : props.focus === 'module' || props.focus === 'cooling' ? moduleId : props.selectedId}`;
    if (lastContext.current && !wasInside.current && !inside)
      snapshots.current.set(lastContext.current, {
        position: camera.position.clone(),
        target: c.target.clone(),
      });
    if (inside && moduleSpec) {
      if (!wasInside.current)
        exterior.current = {
          position: camera.position.clone(),
          target: c.target.clone(),
        };
      const p = interiorWaypoint(moduleSpec, 0);
      goal.current.position.fromArray(p);
      goal.current.target.set(p[0] + 4, p[1], p[2]);
      yaw.current = Math.PI / 2;
      pitch.current = 0;
    } else if (wasInside.current && exterior.current) {
      goal.current = {
        position: exterior.current.position.clone(),
        target: exterior.current.target.clone(),
      };
    } else {
      let subject = active;
      if (props.focus === 'platform')
        subject = resolveAsset(
          props.design,
          moduleSpec?.platformId ?? props.selectedId,
        );
      if (props.focus === 'module')
        subject = resolveAsset(props.design, moduleId ?? props.selectedId);
      if (props.focus === 'rack')
        subject = resolveAsset(
          props.design,
          props.selectedId.includes('/rack-')
            ? props.selectedId.split('/node-')[0]
            : `${moduleId}/rack-01`,
        );
      if (props.focus === 'cooling')
        subject = resolveAsset(props.design, `${moduleId}/hx`);
      const campus =
        props.focus === 'campus' || props.focus === 'top' || !subject;
      const center = campus
        ? bounds.center
        : presentedPosition(subject!, props.exploded);
      let distance = campus
        ? bounds.radius * 2.5
        : Math.max(
            3.5,
            Math.hypot(subject!.dimensionsM[0], subject!.dimensionsM[2]) * 1.55,
          );
      if (props.focus === 'cooling') distance = 12;
      const aspectFactor = Math.max(
        1,
        1.3 / Math.max(0.4, size.width / size.height),
      );
      distance *= aspectFactor;
      goal.current.target.fromArray(center);
      if (props.focus === 'cooling' && moduleSpec) {
        goal.current.target.set(
          moduleSpec.positionM[0] + 9.5,
          moduleSpec.positionM[1] - 0.9,
          moduleSpec.positionM[2],
        );
        goal.current.target.add(
          new Vector3(...presentationOffset('exchanger', props.exploded)),
        );
        goal.current.position
          .copy(goal.current.target)
          .add(new Vector3(-7.5, 4.8, 1.2).multiplyScalar(aspectFactor));
      } else if (props.focus === 'top')
        goal.current.position.set(center[0], distance, center[2] + 0.02);
      else
        goal.current.position.set(
          center[0] + distance * 0.55,
          center[1] + distance * (campus ? 0.28 : 0.55),
          center[2] + distance * 0.8,
        );
      const saved = snapshots.current.get(context);
      if (
        saved &&
        lastContext.current !== context &&
        props.focus !== 'cooling' &&
        props.focus !== 'selection'
      ) {
        goal.current = {
          position: saved.position.clone(),
          target: saved.target.clone(),
        };
      }
    }
    wasInside.current = inside;
    lastContext.current = context;
    transitioning.current = true;
  }, [
    props.focus,
    props.selectedId,
    props.resetId,
    props.exploded,
    props.design,
    inside,
    moduleSpec,
    moduleId,
    active,
    bounds,
    camera,
    size.width,
    size.height,
  ]);
  useEffect(() => {
    if (!inside || !moduleSpec) return;
    const p = interiorWaypoint(moduleSpec, waypoint % 3);
    goal.current.position.fromArray(p);
    goal.current.target.set(p[0] + 4, p[1], p[2]);
    yaw.current = Math.PI / 2;
    pitch.current = 0;
    transitioning.current = true;
  }, [waypoint, inside, moduleSpec]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute(
      'aria-label',
      'Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits.',
    );
    let drag: { x: number; y: number; pointerId: number } | null = null;
    const down = (event: KeyboardEvent) => {
      const { props: p, inside: interior } = current.current;
      if (event.key === 'Escape' && interior) {
        event.preventDefault();
        p.onExitInterior();
        return;
      }
      const k = event.key.toLowerCase();
      if (
        ![
          'w',
          'a',
          's',
          'd',
          'arrowleft',
          'arrowright',
          'arrowup',
          'arrowdown',
          '+',
          '=',
          '-',
        ].includes(k)
      )
        return;
      event.preventDefault();
      p.onManual();
      transitioning.current = false;
      if (interior) {
        keys.current.add(k);
        return;
      }
      const c = controls.current;
      if (!c) return;
      if (k === 'arrowleft' || k === 'arrowright')
        c.setAzimuthalAngle(
          c.getAzimuthalAngle() + (k === 'arrowleft' ? 0.12 : -0.12),
        );
      if (k === 'arrowup' || k === 'arrowdown')
        c.setPolarAngle(
          Math.max(
            0.02,
            Math.min(
              Math.PI * 0.49,
              c.getPolarAngle() + (k === 'arrowup' ? -0.1 : 0.1),
            ),
          ),
        );
      if (['+', '=', '-'].includes(k))
        camera.position.copy(c.target).add(
          camera.position
            .clone()
            .sub(c.target)
            .multiplyScalar(k === '-' ? 1.1 : 0.9),
        );
      c.update();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => {
      keys.current.clear();
      drag = null;
    };
    const pointerDown = (e: PointerEvent) => {
      if (!current.current.inside) return;
      canvas.focus();
      drag = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
    };
    const pointerMove = (e: PointerEvent) => {
      if (!drag || !current.current.inside) return;
      yaw.current -= (e.clientX - drag.x) * 0.004;
      pitch.current = Math.max(
        -0.65,
        Math.min(0.65, pitch.current - (e.clientY - drag.y) * 0.004),
      );
      drag.x = e.clientX;
      drag.y = e.clientY;
      transitioning.current = false;
      current.current.props.onManual();
    };
    const pointerUp = () => {
      if (drag) {
        try {
          canvas.releasePointerCapture(drag.pointerId);
        } catch {
          /* pointer may already be released */
        }
      }
      drag = null;
    };
    canvas.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    canvas.addEventListener('blur', clear);
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    return () => {
      canvas.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      canvas.removeEventListener('blur', clear);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
    };
  }, [gl, camera]);
  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(delta, 0.05);
    if (transitioning.current) {
      const t = props.reducedMotion ? 1 : 1 - Math.exp(-delta * 5);
      camera.position.lerp(goal.current.position, t);
      c.target.lerp(goal.current.target, t);
      if (camera.position.distanceTo(goal.current.position) < 0.015)
        transitioning.current = false;
      c.update();
    } else if (inside && moduleSpec) {
      const pressed = keys.current;
      const forward =
        Number(pressed.has('w') || pressed.has('arrowup')) -
        Number(pressed.has('s') || pressed.has('arrowdown'));
      const side = Number(pressed.has('d')) - Number(pressed.has('a'));
      yaw.current +=
        (Number(pressed.has('arrowleft')) - Number(pressed.has('arrowright'))) *
        dt *
        1.4;
      const position = camera.position.toArray() as Vec3;
      position[0] +=
        (Math.sin(yaw.current) * forward + Math.cos(yaw.current) * side) *
        dt *
        2.2;
      position[2] +=
        (Math.cos(yaw.current) * forward - Math.sin(yaw.current) * side) *
        dt *
        2.2;
      camera.position.fromArray(clampInterior(position, moduleSpec));
      c.target
        .copy(camera.position)
        .add(
          new Vector3(
            Math.sin(yaw.current) * Math.cos(pitch.current),
            Math.sin(pitch.current),
            Math.cos(yaw.current) * Math.cos(pitch.current),
          ),
        );
      camera.lookAt(c.target);
    }
    diagnosticAt.current += delta;
    if (diagnosticAt.current > 0.25) {
      diagnosticAt.current = 0;
      window.__NEPTUNE_TWIN_SCENE__ = {
        camera: camera.position.toArray(),
        target: c.target.toArray(),
        drawCalls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        selectedId: props.selectedId,
        selectedSpecification: active?{id:active.catalogId,version:active.revision,dimensionsM:[...active.dimensionsM],operationalMassKg:active.operationalMassKg}:null,
        renderedModules: props.design.modules.length,
        totalModules: props.design.modules.length,
        renderedPlatforms: props.design.assets.filter(
          (a) => a.type === 'platform',
        ).length,
        detailModuleId: moduleSpec?.id ?? '',
        renderedRacks: moduleSpec?.rackCount ?? 0,
        renderedNodes: moduleSpec?.nodeCount ?? 0,
        worldUnitsPerMeter: 1,
        inside,
        focus: props.focus,
        exploded: props.exploded,
        simulationTimeS: props.state.timeS,
      };
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!inside}
      enablePan
      minDistance={0.7}
      maxDistance={Math.max(100, bounds.radius * 8)}
      minPolarAngle={0.001}
      maxPolarAngle={Math.PI * 0.495}
      enableDamping={!props.reducedMotion}
      onStart={() => {
        transitioning.current = false;
        props.onManual();
      }}
    />
  );
}
declare global {
  interface Window {
    __NEPTUNE_TWIN_SCENE__?: {
      camera: number[];
      target: number[];
      drawCalls: number;
      geometries: number;
      textures: number;
      selectedId: string;
      selectedSpecification: {id:string;version:string;dimensionsM:number[];operationalMassKg:number|null}|null;
      renderedModules: number;
      totalModules: number;
      renderedPlatforms: number;
      detailModuleId: string;
      renderedRacks: number;
      renderedNodes: number;
      worldUnitsPerMeter: number;
      inside: boolean;
      focus: string;
      exploded: boolean;
      simulationTimeS: number;
    };
  }
}
class TwinBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG groups have no native button equivalent; Enter/Space and focus are implemented. */
export function TwinFallback(props: TwinSceneProps) {
  const moduleSpec = selectedModule(props.design, props.selectedId);
  const details = useMemo(
    () =>
      moduleSpec
        ? moduleAssets(props.design, moduleSpec.id).filter(
            (a) => a.type !== 'compute' && a.type !== 'pipe',
          )
        : [],
    [props.design, moduleSpec],
  );
  const platforms = props.design.assets.filter((a) => a.type === 'platform');
  const bounds = footprintBounds(platforms);
  const b =
    props.focus === 'campus' || !moduleSpec
      ? bounds
      : footprintBounds([resolveAsset(props.design, moduleSpec.id)!]);
  const objects =
    props.focus === 'campus' || !moduleSpec
      ? props.design.assets.filter(
          (a) => a.type === 'module' || a.type === 'platform',
        )
      : details;
  const states = props.state.modules.find(
    (m) => m.id === moduleSpec?.id,
  )?.states;
  const onReady = props.onReady;
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return (
    <div className="twin-fallback" data-testid="twin-fallback">
      <div className="twin-fallback-heading">
        <span className="twin-map-eyebrow">
          DIMENSIONED FOOTPRINT · ACCESSIBLE FALLBACK
        </span>
        <h3>
          {props.focus === 'campus'
            ? 'The complete campus'
            : 'Selected module plan'}
        </h3>
        <p>
          One coordinate unit = one meter. Select equipment in the plan or asset
          tree.
        </p>
      </div>
      <svg
        viewBox={`${b.minX - 2} ${b.minZ - 2} ${b.maxX - b.minX + 4} ${b.maxZ - b.minZ + 4}`}
        aria-label="Dimensioned asset footprint"
        role="group"
      >
        {objects.map((a) => (
          <g
            key={a.id}
            role="button"
            tabIndex={0}
            aria-label={`${a.name}, ${a.id}`}
            onClick={() => props.onSelect(a.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                props.onSelect(a.id);
              }
            }}
          >
            <rect
              x={a.positionM[0] - a.dimensionsM[0] / 2}
              y={a.positionM[2] - a.dimensionsM[2] / 2}
              width={a.dimensionsM[0]}
              height={a.dimensionsM[2]}
              rx={0.04}
              fill={stateColor(states?.[a.id], COLORS[a.type])}
              fillOpacity={a.type === 'platform' ? 0.22 : 0.85}
              stroke={a.id === props.selectedId ? '#efffd4' : '#8ca9ac'}
              strokeWidth={a.id === props.selectedId ? 0.1 : 0.025}
            />
            <title>
              {a.id} · {a.dimensionsM.join(' × ')} m
            </title>
          </g>
        ))}
      </svg>
      <p className="twin-fallback-note">
        WebGL is unavailable or fallback was requested. Operations, asset
        identities, connections and results use the same model.
      </p>
      {props.inside && (
        <button
          type="button"
          className="twin-exit"
          onClick={props.onExitInterior}
        >
          Exit interior plan
        </button>
      )}
    </div>
  );
}
/* oxlint-enable jsx-a11y/prefer-tag-over-role */
export default function TwinScene(input: TwinSceneProps) {
  const supplyProjection=useMemo(()=>activePowerDesign(input.design,input.state),[input.design,input.state]);
  const props={...input,design:supplyProjection};
  const sceneProps = props.inside ? { ...props, exploded: false } : props;
  const moduleSpec = useMemo(
    () => selectedModule(props.design, props.selectedId),
    [props.design, props.selectedId],
  );
  const details = useMemo(
    () => (moduleSpec ? moduleAssets(props.design, moduleSpec.id) : []),
    [props.design, moduleSpec],
  );
  const active = useMemo(
    () => resolveAsset(props.design, props.selectedId),
    [props.design, props.selectedId],
  );
  const radius = useMemo(
    () =>
      footprintBounds(props.design.assets.filter((a) => a.type === 'platform'))
        .radius,
    [props.design],
  );
  const [supported] = useState(() => {
    if (new URLSearchParams(location.search).get('fallback') === '1')
      return false;
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ok = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return ok;
    } catch {
      return false;
    }
  });
  const [lost, setLost] = useState(false),
    [visible, setVisible] = useState(!document.hidden),
    [waypoint, setWaypoint] = useState(0);
  useEffect(() => {
    const listener = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', listener);
    return () => {
      document.removeEventListener('visibilitychange', listener);
      delete window.__NEPTUNE_TWIN_SCENE__;
    };
  }, []);
  const fallback = <TwinFallback {...props} />;
  if (!supported || lost) return fallback;
  return (
    <div
      className="twin-scene"
      data-testid="twin-scene"
      data-inside={props.inside}
    >
      <TwinBoundary fallback={fallback}>
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{
            position: [radius * 1.4, radius * 1.3, radius * 1.9],
            fov: 46,
            near: 0.03,
            far: Math.max(8000, radius * 20),
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0a1920');
            gl.domElement.setAttribute('role', 'img');
            gl.domElement.addEventListener(
              'webglcontextlost',
              (event) => {
                event.preventDefault();
                setLost(true);
              },
              { once: true },
            );
            props.onReady?.();
          }}
        >
          <SunsetSky radius={radius} />
          <fog
            attach="fog"
            args={['#0a1920', radius * 3.5, radius * 9 + 1000]}
          />
          <ambientLight intensity={1.1} color="#b7d3d4" />
          <hemisphereLight args={['#d4eef0', '#203941', 2.3]} />
          <directionalLight
            position={[-80, 110, -40]}
            intensity={3.5}
            color="#ffc899"
          />
          <directionalLight
            position={[70, 50, 80]}
            intensity={1.4}
            color="#c0ebf2"
          />
          <Water quiet={props.reducedMotion} radius={radius} />
          <TwinFacility
            props={sceneProps}
            moduleSpec={moduleSpec}
            details={details}
            active={active}
          />
          <CameraRig
            props={sceneProps}
            moduleSpec={moduleSpec}
            active={active}
            waypoint={waypoint}
          />
        </Canvas>
      </TwinBoundary>
      <div className="twin-scale-caption">
        <span>1 UNIT = 1 m</span>
        <span>
          {props.design.modules.length.toLocaleString()} /{' '}
          {props.design.modules.length.toLocaleString()} modules
        </span>
        <span>
          LOD: {moduleSpec?.rackCount ?? 0} racks · {moduleSpec?.nodeCount ?? 0}{' '}
          nodes · 1 selected module
        </span>
      </div>
      <div className="twin-route-legend" aria-label="Connection colors">
        <span style={{ color: MEDIUM_COLORS.technical }}>
          — Technical coolant
        </span>
        <span style={{ color: MEDIUM_COLORS.seawater }}>— Seawater</span>
        <span style={{ color: MEDIUM_COLORS.power }}>— Power</span>
        <span style={{ color: MEDIUM_COLORS.cluster }}>— Network</span>
      </div>
      {props.exploded && !props.inside && (
        <div className="twin-presentation-note">
          Exploded offsets are presentation only · physical routes and solver
          dimensions unchanged
        </div>
      )}
      {props.inside && (
        <div className="twin-interior-controls">
          <div>
            <strong>Inside {moduleSpec?.id}</strong>
            <small>
              WASD to move · drag to look · arrows turn · central aisle bounds
            </small>
          </div>
          <div className="twin-waypoints">
            {['Entrance', 'Rack aisle', 'Cooling bay'].map((label, index) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  props.onManual();
                  setWaypoint((n) => (Math.floor(n / 3) + 1) * 3 + index);
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="twin-exit"
              onClick={props.onExitInterior}
            >
              Exit interior <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Dimensioned visual mesh export. Exact instance inventory, one meter per unit.
 * This is a visual glTF envelope, not manufacturing CAD or a routed fabrication model. */
export async function geometryGLTF(design: Design): Promise<object> {
  if (
    design.nodeCount +
      design.rackCount +
      design.modules.length * 15 +
      design.assets.length >
    30_000
  )
    throw Error(
      'glTF visual export is limited to 30,000 asset meshes. Export the inventory/project or choose a smaller design.',
    );
  const group = new Group();
  group.name = 'NEPTUNE design-stage dimensioned geometry';
  group.userData = {
    designRevision: design.revision,
    engineeringIdentity: engineeringIdentity(design),
    schemaVersion: 2,
    units: 'meters',
    evidence: 'assumed design geometry',
    scope:
      'All platform/module envelopes and exact rack/node/support geometry; visual meshes, not manufacturing CAD.',
  };
  const geometry = new BoxGeometry(1, 1, 1),
    pipeGeometry = new CylinderGeometry(1, 1, 1, 10),
    materials = new Map<Asset['type'], MeshStandardMaterial>();
  for (const type of Object.keys(COLORS) as Asset['type'][])
    materials.set(type, new MeshStandardMaterial({ color: COLORS[type] }));
  const add = (asset: Asset) => {
    if (asset.id.endsWith('/pipe-tech')) {
      const spec = design.modules.find((m) => m.id === asset.parentId);
      if (spec) {
        const assembly = new Group();
        assembly.name = asset.id;
        assembly.userData = {
          assetId: asset.id,
          parentId: asset.parentId,
          catalogId: asset.catalogId,
          assetRevision: asset.revision,
      operationalMassKg: asset.operationalMassKg,
      ratings: asset.ratings,
          dimensionsM: asset.dimensionsM,
          positionM: asset.positionM,
        };
        const points = loopRouteM(spec);
        points.slice(1).forEach((p, i) => {
          const a = new Vector3(...points[i]),
            b = new Vector3(...p);
          const segment = new Mesh(pipeGeometry, materials.get('pipe'));
          segment.name = `Visual pipe segment ${i + 1}`;
          segment.position.copy(a.clone().lerp(b, 0.5));
          segment.quaternion.setFromUnitVectors(
            new Vector3(0, 1, 0),
            b.clone().sub(a).normalize(),
          );
          segment.scale.set(
            asset.ratings.diameterM / 2,
            a.distanceTo(b),
            asset.ratings.diameterM / 2,
          );
          assembly.add(segment);
        });
        group.add(assembly);
        return;
      }
    }
    const mesh = new Mesh(geometry, materials.get(asset.type));
    mesh.name = asset.id;
    mesh.position.fromArray(asset.positionM);
    mesh.scale.fromArray(asset.dimensionsM);
    mesh.userData = {
      assetId: asset.id,
      parentId: asset.parentId,
      catalogId: asset.catalogId,
      assetRevision: asset.revision,
      operationalMassKg: asset.operationalMassKg,
      ratings: asset.ratings,
      dimensionsM: asset.dimensionsM,
      positionM: asset.positionM,
    };
    group.add(mesh);
  };
  design.assets.forEach(add);
  for (const moduleSpec of design.modules)
    moduleAssets(design, moduleSpec.id).forEach(add);
  try {
    const result = await new GLTFExporter().parseAsync(group, {
      binary: false,
      onlyVisible: false,
      trs: true,
    });
    if (result instanceof ArrayBuffer)
      throw Error('Unexpected binary glTF result.');
    return result;
  } finally {
    geometry.dispose();
    pipeGeometry.dispose();
    materials.forEach((material) => material.dispose());
  }
}

import { deliverPresentationReport, initialPresentationDelivery } from './presentationDelivery';
import { presentationDiagnostic, presentationDiagnosticChange, presentationDiagnosticIdentity, presentationDiagnosticsEnabled } from '../twin/presentation/diagnostics';
import { visualAssetStates } from '../twin/presentation/assets';
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
  addAfterEffect,
  useFrame,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  type ShaderMaterial,
  BoxGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BlueHourEnvironment } from './visuals/DuskEnvironment';
import { coolingViewDirection, equipmentFrame } from './visuals/equipmentFraming';
import { BLUE_HOUR, assetSurface, stateColor } from './visuals/materials';
import { VisualKitCache } from './visuals/kitCache';
import { AuthoredEquipment, visualKitDiagnostic, type KitDiagnostic, type KitStatus } from './visuals/AuthoredEquipment';
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
import { updatePresentationFlight, presentationFrame, presentationRequestKey, PresentationSettling, sampleCameraFlight, type CameraFlight, type CameraPose, type PresentationCameraRequest, type PresentationSceneReadiness } from './presentationCamera';
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
  presentation?: PresentationCameraRequest;
  presentationPending?: boolean;
  onPresentationReadiness?: (report: PresentationSceneReadiness) => boolean;
  onPresentationTakeover?: (reason: 'pointer' | 'keyboard' | 'context-loss') => void;
}
const COLORS = Object.fromEntries(
  (['platform', 'hull', 'module', 'rack', 'compute', 'cdu', 'exchanger', 'pump', 'valve', 'pipe', 'transformer', 'switchboard', 'battery', 'network', 'external'] as Asset['type'][]).map(type => [type, assetSurface(type).color]),
) as Record<Asset['type'], string>;
const MEDIUM_COLORS: Record<Connection['medium'], string> = {
  power: '#edb878',
  technical: '#64ebc5',
  seawater: '#57aeed',
  cluster: '#c3a2f1',
  'external-network': '#a298fb',
};
const UNIT_SCALE: Vec3 = [1, 1, 1];
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
  interactive = true,
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
  interactive?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const material = assetSurface(surface ? 'valve' : assets[0]?.type ?? 'module');
  const bevel = !surface && ['module', 'cdu', 'exchanger', 'transformer', 'switchboard', 'battery'].includes(assets[0]?.type);
  const geometry = useMemo(() => bevel ? new RoundedBoxGeometry(1, 1, 1, 1, 0.018) : new BoxGeometry(1, 1, 1), [bevel]);
  useEffect(() => () => geometry.dispose(), [geometry]);
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
        tint.set(base),
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
      args={[geometry, undefined, assets.length]}
      castShadow
      receiveShadow
      onClick={!interactive || (surface && opacity < 0.5) ? undefined : (event: ThreeEvent<MouseEvent>) => {
        if (event.instanceId === undefined) return;
        event.stopPropagation();
        onSelect(assets[event.instanceId].id);
      }}
    >
      <meshStandardMaterial
        key={opacity < 1 ? 'transparent' : 'opaque'}
        color="white"
        roughness={material.roughness}
        metalness={material.metalness}
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
function EquipmentInstances(props: Parameters<typeof Instances>[0]) {
  const groups = useMemo(() => {
    const byType = new Map<Asset['type'], Asset[]>();
    for (const asset of props.assets) {
      const group = byType.get(asset.type) ?? [];
      group.push(asset);
      byType.set(asset.type, group);
    }
    return [...byType.entries()];
  }, [props.assets]);
  return <>{groups.map(([type, assets]) => <Instances key={type} {...props} assets={assets} />)}</>;
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
        color={BLUE_HOUR.silver}
        opacity={xray ? 0.2 : 0.8}
      />
      <Instances
        assets={pieces.louvers}
        {...common}
        color={BLUE_HOUR.structure}
        opacity={xray ? 0.16 : 0.8}
      />
      <Instances
        assets={pieces.corners}
        {...common}
        color={BLUE_HOUR.silver}
        opacity={xray ? 0.18 : 0.8}
      />
    </group>
  );
}
function ModuleStructure({
  asset,
  state,
  exploded,
  xray,
  inside,
}: {
  asset: Asset;
  state?: EquipmentState;
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
        key={opacity < 1 ? 'transparent' : 'opaque'}
        {...assetSurface(key === 'floor' || key === 'aisle' ? 'platform' : 'module')}
        color={stateColor(state, assetSurface(key === 'floor' || key === 'aisle' ? 'platform' : 'module').color)}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity > 0.7}
      />
    </mesh>
  );
  return (
    <group position={p}>
      {wall([0, -h / 2 + 0.04, 0], [w, 0.08, d], 'floor', inside ? 1 : xray || exploded ? 0.1 : 1)}
      {wall(
        [0, h / 2 - 0.04 + (exploded ? 3 : 0), 0],
        [w, 0.08, d],
        'roof',
        inside ? 0.05 : xray ? 0.09 : 1,
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
      {wall([0, -h / 2 + 0.052, 0], [18.8, 0.015, 2.6], 'aisle', inside ? 1 : xray || exploded ? 0.1 : 1)}
      <mesh
        position={[-1.5, -h / 2 + 0.065, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[19, 0.06]} />
        <meshBasicMaterial color={BLUE_HOUR.pearl} />
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
        <meshStandardMaterial {...assetSurface('hull')} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[w * 0.08, -h * 0.07, 0]}>
        <cylinderGeometry args={[d * 0.44, d * 0.44, w * 0.7, 16]} />
        <meshStandardMaterial {...assetSurface('pump')} color={color} />
      </mesh>
      <mesh position={[-w * 0.36, -h * 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[d * 0.46, d * 0.46, w * 0.18, 16]} />
        <meshStandardMaterial {...assetSurface('pump')} color={color} />
      </mesh>
      <mesh position={[-w * 0.35, h * 0.3, 0]}>
        <cylinderGeometry args={[d * 0.17, d * 0.17, h * 0.35, 12]} />
        <meshStandardMaterial {...assetSurface('valve')} />
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
function SelectionOutline({ asset, exploded }: { asset: Asset; exploded: boolean }) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(1, 1, 1);
    const edges = new EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments
      geometry={geometry}
      position={presentedPosition(asset, exploded)}
      scale={asset.dimensionsM.map((d) => d + 0.045) as Vec3}
    >
      <lineBasicMaterial color={BLUE_HOUR.selection} transparent opacity={0.9} depthTest={false} />
    </lineSegments>
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
  kitCache,
}: {
  props: TwinSceneProps;
  moduleSpec?: ModuleSpec;
  details: Asset[];
  active?: Asset;
  kitCache: VisualKitCache;
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
        (a) => !['rack', 'compute', 'module', 'pipe', 'pump', 'exchanger', 'cdu'].includes(a.type),
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
      // Isolation stops upstream traversal, but the selected failed feeder's
      // real incident edges still belong in its inspection. Their projected
      // enabled state remains authoritative; inactive highlights stay dashed.
      ...props.design.connections.filter(connection => connection.from === props.selectedId || connection.to === props.selectedId),
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
  const states = useMemo(() => visualAssetStates(props.state), [props.state]);
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
  const detailEnabled = props.focus === 'cooling' || props.inside ||
    (props.focus === 'selection' && ['pump', 'exchanger', 'cdu'].includes(active?.type ?? '')) || (props.xray && props.exploded);
  return (
    <group>
      <Instances assets={hulls} {...common} />
      <Instances assets={platforms} {...common} />
      <Instances assets={shells} {...common} states={states} opacity={props.xray && props.focus !== 'cooling' ? 0.35 : 1} />
      <ModuleEnvelopeDetails
        assets={envelopes}
        selectedModuleId={moduleSpec?.id}
        exploded={props.exploded}
        xray={props.xray}
        onSelect={props.onSelect}
      />
      <EquipmentInstances assets={globals} {...common} states={states} />
      {moduleAsset && (
        <ModuleStructure
          asset={moduleAsset}
          state={states?.[moduleAsset.id]}
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
      <EquipmentInstances
        assets={equipment}
        {...common}
        states={states}
        opacity={props.xray && detailEnabled && !props.inside ? 0.12 : 1}
        interactive={!(props.xray && detailEnabled && !props.inside)}
      />
      {details
        .filter((a) => a.type === 'pump' || a.type === 'exchanger' || a.type === 'cdu')
        .map((asset) => (
          <AuthoredEquipment
            key={asset.id}
            asset={asset}
            connections={connections}
            identity={props.design.revision}
            cache={kitCache}
            enabled={detailEnabled}
            selected={props.selectedId === asset.id}
            state={states?.[asset.id]}
            exploded={props.exploded}
            onSelect={props.onSelect}
          >
            {asset.type === 'pump' ? <PumpEnvelope asset={asset} state={states?.[asset.id]} exploded={props.exploded} onSelect={props.onSelect} /> :
              <Instances assets={[asset]} {...common} states={states} />}
          </AuthoredEquipment>
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

    </group>
  );
}
function CameraRig({
  props,
  moduleSpec,
  active,
  waypoint,
  kitCache,
  onKitStatus,
}: {
  props: TwinSceneProps;
  moduleSpec?: ModuleSpec;
  active?: Asset;
  waypoint: number;
  kitCache: VisualKitCache;
  onKitStatus: (status: KitStatus) => void;
}) {
  const { camera, gl, size, scene, get, setSize } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<CameraPose>({
    position: new Vector3(),
    target: new Vector3(),
  });
  const transitioning = useRef(true),
    wasInside = useRef(false);
  const exterior = useRef<(CameraPose & { manual: boolean }) | null>(null);
  const manual = useRef(false);
  const ready = useRef(false);
  const lastRequest = useRef('');
  const flight = useRef<CameraFlight | null>(null);
  const guidanceOwner = useRef('');
  const pendingGuidance = useRef(false);
  const cancelledGuidance = useRef('');
  const guidanceLayout = useRef('');
  const settled = useRef(new PresentationSettling());
  const guidanceDelivery = useRef(initialPresentationDelivery);
  const keys = useRef(new Set<string>()),
    yaw = useRef(Math.PI / 2),
    pitch = useRef(0);
  const inside = props.inside && !!moduleSpec;
  // Use a stable current-props ref for DOM event handlers, avoiding resubscription on solver ticks.
  const current = useRef({ props, moduleSpec, inside });
  useLayoutEffect(() => {
    current.current = { props, moduleSpec, inside };
  });
  const diagnosticAt = useRef(0);
  const renderEpoch = useRef(0);
  const pendingDiagnostic = useRef<Window['__NEPTUNE_TWIN_SCENE__']>(undefined);
  const layoutRevision = useRef(0);
  const meaningfulLayoutRevision = useRef(0);
  const diagnosticLayout = useRef<number[]>([]);
  const lastCompletedFrame = useRef(0);
  const lastRendererFrame = useRef(gl.info.render.frame);
  const diagnose = (reason: string, kind: 'camera' | 'settling' | 'layout' = 'camera') => {
    if (!presentationDiagnosticsEnabled()) return;
    const request = current.current.props.presentation;
    presentationDiagnosticChange('camera-boundary', JSON.stringify([reason, presentationDiagnosticIdentity(guidanceOwner.current), request?.token, layoutRevision.current, transitioning.current]), kind, {
      reason, source: presentationDiagnosticIdentity(request?.sourceKey), owner: presentationDiagnosticIdentity(guidanceOwner.current), token: request?.token ?? '', step: request?.stepId ?? '', shot: request?.shot ?? '',
      elapsedS: flight.current?.elapsedS ?? 0, durationS: flight.current?.durationS ?? 0, camera: camera.position.toArray(), target: controls.current?.target.toArray() ?? [], goalCamera: goal.current.position.toArray(), goalTarget: goal.current.target.toArray(), transitioning: transitioning.current,
      r3fWidth: get().size.width, r3fHeight: get().size.height, parentWidth: gl.domElement.parentElement?.clientWidth ?? 0, parentHeight: gl.domElement.parentElement?.clientHeight ?? 0, canvasWidth: gl.domElement.clientWidth, canvasHeight: gl.domElement.clientHeight,
      layoutRevision: layoutRevision.current, meaningfulLayoutRevision: meaningfulLayoutRevision.current, settledFrames: settled.current.frames, renderEpoch: renderEpoch.current, lastCompletedFrameMs: lastCompletedFrame.current, rendererFrame: lastRendererFrame.current, visible: !document.hidden, contextLost: gl.getContext().isContextLost(),
    });
  };
  const diagnoseRef = useRef(diagnose);
  useLayoutEffect(() => { diagnoseRef.current = diagnose; });
  useEffect(() => addAfterEffect(() => {
    // The callback follows all automatic root renders. Never read the previous
    // frame's GPU allocation counters from a pre-render useFrame callback.
    if (presentationDiagnosticsEnabled() && gl.info.render.frame !== lastRendererFrame.current) {
      lastRendererFrame.current = gl.info.render.frame;
      lastCompletedFrame.current = performance.now();
      window.__NEPTUNE_V5_LAST_FRAME__ = lastCompletedFrame.current;
    }
    if (!pendingDiagnostic.current) return;
    const observed = pendingDiagnostic.current;
    pendingDiagnostic.current = undefined;
    // R3F's ResizeObserver owns measurement/projection. Do not announce a frame
    // that still uses its previous drawing size while the surrounding UI reflows.
    const viewport = gl.domElement.parentElement;
    if (!viewport || Math.abs(viewport.clientWidth - observed.canvasSize.width) > 1 ||
        Math.abs(viewport.clientHeight - observed.canvasSize.height) > 1 ||
        Math.abs(gl.domElement.clientWidth - observed.canvasSize.width) > 1 ||
        Math.abs(gl.domElement.clientHeight - observed.canvasSize.height) > 1) {
      if (presentationDiagnosticsEnabled()) presentationDiagnosticChange('size-blocker', JSON.stringify([presentationDiagnosticIdentity(guidanceOwner.current), observed.canvasSize, viewport?.clientWidth, viewport?.clientHeight, gl.domElement.clientWidth, gl.domElement.clientHeight]), 'layout', { reason: 'css-r3f-mismatch', token: current.current.props.presentation?.token ?? '', r3fWidth: observed.canvasSize.width, r3fHeight: observed.canvasSize.height, parentWidth: viewport?.clientWidth ?? 0, parentHeight: viewport?.clientHeight ?? 0, canvasWidth: gl.domElement.clientWidth, canvasHeight: gl.domElement.clientHeight, renderEpoch: renderEpoch.current, lastCompletedFrameMs: lastCompletedFrame.current });
      settled.current.reset();
      // A missed native resize notification must not leave drawing/projection
      // at a transient layout forever. Repair through the existing R3F store,
      // then require a later real render to pass this same size guard. Comparing
      // current store dimensions avoids repeated updates while React catches up.
      const measured = viewport?.getBoundingClientRect();
      const currentSize = get().size;
      if (measured && [measured.width, measured.height, measured.top, measured.left].every(Number.isFinite) &&
          measured.width > 0 && measured.height > 0 &&
          (currentSize.width !== measured.width || currentSize.height !== measured.height)) {
        setSize(measured.width, measured.height, measured.top, measured.left);
      }
      return;
    }
    if (presentationDiagnosticsEnabled()) presentationDiagnosticChange('size-blocker', `${presentationDiagnosticIdentity(guidanceOwner.current)}:matched`, 'layout', { reason: 'css-r3f-matched', owner: presentationDiagnosticIdentity(guidanceOwner.current), token: current.current.props.presentation?.token ?? '', renderEpoch: renderEpoch.current, rendererFrame: lastRendererFrame.current, lastCompletedFrameMs: lastCompletedFrame.current });
    const visualKit = visualKitDiagnostic(scene, camera, kitCache, observed.detailModuleId, gl.info.render.frame);
    window.__NEPTUNE_TWIN_SCENE__ = {
      ...observed,
      renderEpoch: ++renderEpoch.current,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      visualKit,
    };
    onKitStatus(visualKit.status);
    const request = current.current.props.presentation;
    if (request && guidanceOwner.current === presentationRequestKey(request) && cancelledGuidance.current !== guidanceOwner.current) {
      const matching = observed.presentationKey === guidanceOwner.current && observed.selectedId === request.selectedId && observed.simulationTimeS === request.timeS;
      const detail = request.authoredKind ? visualKit.assets.find(asset => asset.assetId === request.selectedId && asset.kind === request.authoredKind) : undefined;
      const terminal = request.authoredKind ? !!detail && detail.status !== 'loading' && detail.status !== 'idle' : visualKit.status !== 'loading';
      const rendered = !detail || detail.status !== 'ready' || (detail.renderedMeshes > 0 && !!detail.childWorldPoint);
      const previousFrames = settled.current.frames;
      const isSettled = settled.current.observe([...observed.camera, ...observed.target, observed.canvasSize.width, observed.canvasSize.height], matching && terminal && rendered && !observed.cameraTransitioning);
      if (presentationDiagnosticsEnabled()) {
        const blockers = [!matching && 'identity', !terminal && 'asset-pending', !rendered && 'authored-not-rendered', observed.cameraTransitioning && 'transition', !isSettled && 'three-stable-frames'].filter(Boolean).join(',');
        presentationDiagnosticChange('render-blocker', JSON.stringify([request.token, guidanceLayout.current, blockers, Math.min(3, settled.current.frames), detail?.status, visualKit.status]), 'render', {
          token: request.token, source: presentationDiagnosticIdentity(request.sourceKey), owner: presentationDiagnosticIdentity(guidanceOwner.current), step: request.stepId, shot: request.shot, blockers,
          assetStatus: detail?.status ?? visualKit.status, renderedMeshes: detail?.renderedMeshes ?? 0, authoredSurfaceVisible: !!detail?.childWorldPoint, selectedId: observed.selectedId, displayedTimeS: observed.simulationTimeS,
          settledFrames: settled.current.frames, resetReason: previousFrames > 0 && settled.current.frames <= 1 ? (matching && terminal && rendered && !observed.cameraTransitioning ? 'pose-or-layout-changed' : blockers) : '',
          renderEpoch: renderEpoch.current, lastCompletedFrameMs: lastCompletedFrame.current, rendererFrame: lastRendererFrame.current, camera: observed.camera, target: observed.target, elapsedS: flight.current?.elapsedS ?? 0, durationS: flight.current?.durationS ?? 0, transitioning: observed.cameraTransitioning,
          r3fWidth: observed.canvasSize.width, r3fHeight: observed.canvasSize.height, parentWidth: viewport.clientWidth, parentHeight: viewport.clientHeight, canvasWidth: gl.domElement.clientWidth, canvasHeight: gl.domElement.clientHeight, layoutRevision: layoutRevision.current, meaningfulLayoutRevision: meaningfulLayoutRevision.current, visible: !document.hidden, contextLost: gl.getContext().isContextLost(),
        });
      }
      const fallback = detail?.status === 'fallback' || visualKit.status === 'fallback';
      const representation = detail?.status === 'ready' || (!request.authoredKind && visualKit.status === 'ready') ? 'authored' : 'procedural';
      const report: PresentationSceneReadiness = {
        token: request.token, sourceKey: request.sourceKey, stepId: request.stepId, shot: request.shot,
        selectedId: observed.selectedId, timeS: observed.simulationTimeS,
        status: isSettled ? fallback ? 'fallback' : 'ready' : 'settling', representation,
        settledFrames: settled.current.frames, camera: observed.camera, target: observed.target,
        canvasSize: observed.canvasSize, renderEpoch: renderEpoch.current,
      };
      window.__NEPTUNE_TWIN_SCENE__!.presentation = report;
      const reportKey = `${guidanceOwner.current}:${guidanceLayout.current}:${report.status}:${report.representation}`;
      const delivery = deliverPresentationReport(guidanceDelivery.current, reportKey, performance.now(), () => {
        if (presentationDiagnosticsEnabled()) presentationDiagnostic('readiness', { outcome: 'sent', token: report.token, source: presentationDiagnosticIdentity(report.sourceKey), step: report.stepId, shot: report.shot, status: report.status, representation: report.representation, renderEpoch: report.renderEpoch, layoutRevision: layoutRevision.current });
        return current.current.props.onPresentationReadiness?.(report) ?? false;
      });
      guidanceDelivery.current = delivery.state;
    }
    if (!ready.current && !observed.cameraTransitioning) {
      ready.current = true;
      current.current.props.onReady?.();
    }
  }), [camera, gl, scene, kitCache, onKitStatus, get, setSize]);
  const snapshots = useRef(new Map<string, CameraPose & { manual: boolean }>()),
    lastContext = useRef('');
  const moduleId = moduleSpec?.id;
  const bounds = useMemo(
    () =>
      footprintBounds(props.design.assets.filter((a) => a.type === 'platform')),
    [props.design],
  );
  useLayoutEffect(() => {
    const c = controls.current;
    // A hidden workspace may transiently measure zero. Preserve both its pose
    // and saved contexts until R3F reports a usable visible canvas again.
    if (!c || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return;
    const view = `${props.design.revision}:${props.exploded ? 'exploded' : 'assembled'}:${props.focus}:${props.focus === 'campus' || props.focus === 'top' ? props.design.revision : props.focus === 'module' || props.focus === 'cooling' ? moduleId : props.selectedId}`;
    const request = `${view}:${props.resetId}:${inside}`;
    const context = `${size.width}x${size.height}:${view}`;
    const guidance = props.presentation;
    if (props.presentationPending) {
      // Selection/history may change in separate React commits. Retain the last
      // displayed pose until the matching canonical boundary supplies its shot.
      // Neither an ordinary focus effect nor a stale flight owns this interval.
      diagnoseRef.current('history-pending', 'settling');
      flight.current = null;
      transitioning.current = false;
      settled.current.reset();
      pendingGuidance.current = true;
      guidanceOwner.current = '';
      guidanceLayout.current = '';
      cancelledGuidance.current = '';
      c.enabled = false;
      c.enableDamping = false;
      lastRequest.current = request;
      lastContext.current = context;
      return;
    }
    if (pendingGuidance.current) {
      pendingGuidance.current = false;
      c.enabled = !inside;
      c.enableDamping = !props.reducedMotion;
      if (!guidance) {
        guidanceOwner.current = '';
        guidanceLayout.current = '';
        cancelledGuidance.current = '';
        manual.current = true;
        lastRequest.current = request;
        lastContext.current = context;
        return;
      }
    }
    if (guidance && !inside) {
      const key = presentationRequestKey(guidance);
      if (cancelledGuidance.current === key) return;
      if (guidanceOwner.current === key && guidanceLayout.current === context) return;
      // Flush old OrbitControls inertia once before taking ownership. Its frame
      // writer stays disabled throughout the directed flight; real DOM input
      // releases ownership before OrbitControls handles that input.
      c.enableDamping = false;
      c.update();
      c.enabled = false;
      const sameOwner = guidanceOwner.current === key;
      guidanceOwner.current = key;
      guidanceLayout.current = context;
      layoutRevision.current++;
      cancelledGuidance.current = '';
      settled.current.reset();
      guidanceDelivery.current = initialPresentationDelivery;
      manual.current = false;
      goal.current = presentationFrame(props.design, guidance, props.exploded, size.width / size.height);
      if (presentationDiagnosticsEnabled()) {
        const nextLayout = [size.width, size.height, ...goal.current.position.toArray(), ...goal.current.target.toArray()];
        if (!diagnosticLayout.current.length || nextLayout.some((value, index) => Math.abs(value - diagnosticLayout.current[index]) > (index < 2 ? 1 : 1e-5))) meaningfulLayoutRevision.current++;
        diagnosticLayout.current = nextLayout;
      }
      // Reflow belongs to this navigation: it may retarget the destination,
      // but cannot buy another full flight or revive a cancelled owner.
      flight.current = updatePresentationFlight(flight.current, sameOwner, { position: camera.position, target: c.target }, goal.current, guidance.transitionMs);
      const immediate = props.reducedMotion || !flight.current || flight.current.durationS === 0;
      transitioning.current = !immediate;
      if (immediate) {
        camera.position.copy(goal.current.position);
        c.target.copy(goal.current.target);
        camera.up.set(0, 1, 0);
        camera.lookAt(c.target);
        flight.current = null;
        c.enabled = true;
      }
      diagnoseRef.current(sameOwner ? 'same-owner-layout-refit' : 'new-owner-flight', 'layout');
      lastRequest.current = request;
      lastContext.current = context;
      if (presentationDiagnosticsEnabled()) presentationDiagnostic('readiness', { outcome: 'sent', token: guidance.token, source: presentationDiagnosticIdentity(guidance.sourceKey), status: 'settling', renderEpoch: renderEpoch.current, layoutRevision: layoutRevision.current });
      current.current.props.onPresentationReadiness?.({
        token: guidance.token, sourceKey: guidance.sourceKey, stepId: guidance.stepId, shot: guidance.shot,
        selectedId: props.selectedId, timeS: current.current.props.state.timeS, status: 'settling', representation: 'procedural', settledFrames: 0,
        camera: camera.position.toArray(), target: c.target.toArray(), canvasSize: { width: size.width, height: size.height }, renderEpoch: renderEpoch.current,
      });
      return;
    }
    if (guidanceOwner.current) {
      diagnoseRef.current('guidance-released', 'settling');
      // Pause/exit releases guidance immediately and keeps the actual visible
      // pose. A later explicit request can safely start there.
      flight.current = null;
      transitioning.current = false;
      guidanceOwner.current = '';
      guidanceLayout.current = '';
      cancelledGuidance.current = '';
      settled.current.reset();
      c.enabled = !inside;
      c.enableDamping = !props.reducedMotion;
      if (lastRequest.current === request) {
        manual.current = true;
        lastContext.current = context;
        return;
      }
      // A simultaneous explicit ordinary view/selection request still runs.
      // Only pause alone preserves the guided pose.
      manual.current = false;
    }
    c.enabled = !inside;
    c.enableDamping = !props.reducedMotion;
    // Layout changes refit named views. Pointer/keyboard takeover persists across
    // reflow and hidden-panel restoration until an explicit view/reset request.
    if (lastRequest.current === request && (manual.current || inside)) {
      lastContext.current = context;
      return;
    }
    const priorManual = manual.current;
    manual.current = false;
    lastRequest.current = request;
    if (lastContext.current && !wasInside.current && !inside)
      snapshots.current.set(lastContext.current, {
        position: camera.position.clone(),
        target: c.target.clone(),
        manual: priorManual,
      });
    if (inside && moduleSpec) {
      if (!wasInside.current)
        exterior.current = {
          position: camera.position.clone(),
          target: c.target.clone(),
          manual: priorManual,
        };
      const p = interiorWaypoint(moduleSpec, 0);
      goal.current.position.fromArray(p);
      goal.current.target.set(p[0] + 4, p[1], p[2]);
      yaw.current = Math.PI / 2;
      pitch.current = 0;
    } else if (wasInside.current && exterior.current?.manual) {
      manual.current = true;
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
      const aspect = size.width / size.height;
      if (props.focus === 'cooling' && moduleSpec) {
        const equipment = moduleAssets(props.design, moduleSpec.id)
          .filter(asset => ['pump', 'exchanger', 'cdu'].includes(asset.type));
        goal.current = equipmentFrame(equipment, props.exploded, aspect, coolingViewDirection(props.exploded));
      } else if (props.focus === 'selection' && subject && ['pump', 'exchanger', 'cdu'].includes(subject.type)) {
        goal.current = equipmentFrame([subject], props.exploded, aspect, [0.65, 0.32, -0.69]);
      } else {
        const subjects = campus
          ? props.design.assets.filter(asset => ['platform', 'hull', 'module'].includes(asset.type))
          : [subject!];
        goal.current = equipmentFrame(subjects, props.exploded, aspect,
          props.focus === 'top' ? [0, 1, 0.0001] : [0.55, campus ? 0.28 : 0.55, 0.8]);
      }
      // Only a user-owned pose is a meaningful saved view. A named view may
      // have been saved mid-transition; recompute its fit for this actual size.
      const saved = snapshots.current.get(context);
      if (
        saved?.manual &&
        lastContext.current !== context &&
        props.focus !== 'cooling' &&
        props.focus !== 'selection'
      ) {
        goal.current = {
          position: saved.position.clone(),
          target: saved.target.clone(),
        };
        manual.current = saved.manual;
      }
    }
    while (snapshots.current.size > 24) snapshots.current.delete(snapshots.current.keys().next().value!);
    const initial = !lastContext.current;
    wasInside.current = inside;
    lastContext.current = context;
    if (initial || props.reducedMotion) {
      camera.position.copy(goal.current.position);
      c.target.copy(goal.current.target);
      c.update();
    }
    transitioning.current = !initial && !props.reducedMotion;
  }, [
    props.presentation,
    props.presentationPending,
    props.focus,
    props.selectedId,
    props.resetId,
    props.reducedMotion,
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
  const takeOver = (reason: 'pointer' | 'keyboard') => {
    const request = current.current.props.presentation;
    if (current.current.props.presentationPending && !manual.current) current.current.props.onPresentationTakeover?.(reason);
    if (request && guidanceOwner.current && cancelledGuidance.current !== guidanceOwner.current) {
      diagnoseRef.current(`takeover-${reason}`, 'settling');
      cancelledGuidance.current = guidanceOwner.current;
      flight.current = null;
      settled.current.reset();
      current.current.props.onPresentationTakeover?.(reason);
    }
    transitioning.current = false;
    manual.current = true;
    if (controls.current) {
      controls.current.enabled = !current.current.inside;
      controls.current.enableDamping = !current.current.props.reducedMotion;
    }
    current.current.props.onManual();
  };
  const takeOverRef = useRef(takeOver);
  useLayoutEffect(() => { takeOverRef.current = takeOver; });
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute(
      'aria-label',
      'Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits.',
    );
    let drag: { x: number; y: number; pointerId: number } | null = null;
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
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
      takeOverRef.current('keyboard');
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
      takeOverRef.current('pointer');
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
    const presentationPointer = () => {
      if (current.current.props.presentationPending || (current.current.props.presentation && cancelledGuidance.current !== guidanceOwner.current)) takeOverRef.current('pointer');
    };
    canvas.addEventListener('pointerdown', presentationPointer, true);
    canvas.addEventListener('wheel', presentationPointer, { capture: true, passive: true });
    canvas.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    canvas.addEventListener('blur', clear);
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', presentationPointer, true);
      canvas.removeEventListener('wheel', presentationPointer, true);
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
    if (!c || size.width <= 0 || size.height <= 0) return;
    const dt = Math.min(delta, 0.05);
    if (flight.current && transitioning.current) {
      // Hidden scenes do not render. The foreground presentation owner also
      // removes its request on hide, so no hidden wall time is caught up here.
      flight.current.elapsedS += Math.max(0, delta);
      const pose = sampleCameraFlight(flight.current, props.reducedMotion ? flight.current.durationS : flight.current.elapsedS);
      camera.position.copy(pose.position);
      c.target.copy(pose.target);
      camera.up.set(0, 1, 0);
      camera.lookAt(c.target);
      if (props.reducedMotion || flight.current.elapsedS >= flight.current.durationS) {
        diagnoseRef.current('flight-completed');
        flight.current = null;
        transitioning.current = false;
        c.enabled = true;
      }
    } else if (transitioning.current) {
      const t = props.reducedMotion ? 1 : 1 - Math.exp(-delta * 5);
      camera.position.lerp(goal.current.position, t);
      c.target.lerp(goal.current.target, t);
      if (camera.position.distanceTo(goal.current.position) < 0.015 && c.target.distanceTo(goal.current.target) < 0.015) {
        camera.position.copy(goal.current.position);
        c.target.copy(goal.current.target);
        transitioning.current = false;
      }
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
    if (diagnosticAt.current > 0.25 || !ready.current || (props.presentation && !transitioning.current && settled.current.frames < 3)) {
      diagnosticAt.current = 0;
      pendingDiagnostic.current = {
        camera: camera.position.toArray(),
        target: c.target.toArray(),
        canvasSize: { width: size.width, height: size.height },
        cameraAspect: camera instanceof PerspectiveCamera ? camera.aspect : size.width / size.height,
        cameraControl: manual.current ? 'manual' : 'named',
        cameraTransitioning: transitioning.current,
        presentationKey: guidanceOwner.current,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        pixelRatio: gl.getPixelRatio(),
        visualSystem: 'blue-hour-v1',
        renderEpoch: renderEpoch.current,
        visualKit: { version: 'systems-reveal-v3', moduleId: moduleSpec?.id ?? '', status: 'idle', assets: [], cache: kitCache.inventory() },
        reducedMotion: props.reducedMotion,
        oceanTimeS: ((scene.getObjectByName('blue-hour-ocean') as Mesh | undefined)?.material as ShaderMaterial | undefined)?.uniforms.time.value ?? 0,
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
      enableDamping={!props.reducedMotion && !props.presentation}
      onStart={() => {
        if (!manual.current) takeOverRef.current('pointer');
      }}
    />
  );
}
declare global {
  interface Window {
    __NEPTUNE_TWIN_SCENE__?: {
      camera: number[];
      target: number[];
      canvasSize: { width: number; height: number };
      cameraAspect: number;
      cameraControl: 'named' | 'manual';
      cameraTransitioning: boolean;
      presentationKey?: string;
      presentation?: PresentationSceneReadiness;
      drawCalls: number;
      triangles: number;
      pixelRatio: number;
      visualSystem: string;
      renderEpoch: number;
      visualKit: KitDiagnostic;
      reducedMotion: boolean;
      oceanTimeS: number;
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
      : footprintBounds([resolveAsset(props.design, props.selectedId) ?? resolveAsset(props.design, moduleSpec.id)!]);
  const objects =
    props.focus === 'campus' || !moduleSpec
      ? props.design.assets.filter(
          (a) => a.type === 'module' || a.type === 'platform',
        )
      : moduleSpec.id === props.selectedId || props.selectedId.startsWith(`${moduleSpec.id}/`) ? details : props.design.assets.filter(asset => asset.parentId === resolveAsset(props.design, props.selectedId)?.parentId || asset.id === props.selectedId);
  const states = useMemo(() => visualAssetStates(props.state), [props.state]);
  const onReady = props.onReady;
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  const fallbackRoot = useRef<HTMLDivElement>(null);
  const fallbackCurrent = useRef(props);
  useLayoutEffect(() => { fallbackCurrent.current = props; });
  const fallbackRequestKey = props.presentation ? presentationRequestKey(props.presentation) : '';
  useEffect(() => {
    const element = fallbackRoot.current;
    if (!element || !fallbackRequestKey) return;
    let frame = 0;
    const stability = new PresentationSettling();
    let deliveryState = initialPresentationDelivery;
    const publish = (status: 'settling' | 'fallback') => {
      const currentProps = fallbackCurrent.current, request = currentProps.presentation;
      if (!request || presentationRequestKey(request) !== fallbackRequestKey) return false;
      const report: PresentationSceneReadiness = {
        token: request.token, sourceKey: request.sourceKey, stepId: request.stepId, shot: request.shot,
        selectedId: currentProps.selectedId, timeS: currentProps.state.timeS,
        status, representation: 'plan', settledFrames: stability.frames,
        camera: [], target: [], canvasSize: { width: element.clientWidth, height: element.clientHeight }, renderEpoch: 0,
      };
      const delivery = deliverPresentationReport(deliveryState, status, performance.now(), () => {
        if (presentationDiagnosticsEnabled()) presentationDiagnostic('readiness', { outcome: 'sent', token: request.token, source: presentationDiagnosticIdentity(request.sourceKey), step: request.stepId, shot: request.shot, status, representation: 'plan', settledFrames: stability.frames, canvasWidth: element.clientWidth, canvasHeight: element.clientHeight, visible: !document.hidden });
        return currentProps.onPresentationReadiness?.(report) ?? false;
      });
      deliveryState = delivery.state;
      return delivery.accepted;
    };
    const sample = () => {
      const currentProps = fallbackCurrent.current, request = currentProps.presentation;
      if (!request || presentationRequestKey(request) !== fallbackRequestKey) return;
      const valid = !document.hidden && element.clientWidth > 0 && element.clientHeight > 0 && currentProps.selectedId === request.selectedId && currentProps.state.timeS === request.timeS;
      // A rejected stable report is sampled again while this request still
      // owns the visible plan. Delivery is throttled; the existing playback
      // watchdog removes unresolved requests, and cleanup cancels this sampler.
      if (stability.observe([element.clientWidth, element.clientHeight], valid) && publish('fallback')) return;
      frame = requestAnimationFrame(sample);
    };
    const resize = () => {
      cancelAnimationFrame(frame);
      if (presentationDiagnosticsEnabled()) presentationDiagnostic('settling', { reason: 'fallback-layout', token: fallbackCurrent.current.presentation?.token ?? '', canvasWidth: element.clientWidth, canvasHeight: element.clientHeight, visible: !document.hidden });
      stability.reset();
      deliveryState = initialPresentationDelivery;
      publish('settling');
      frame = requestAnimationFrame(sample);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [fallbackRequestKey]);
  return (
    <div ref={fallbackRoot} className="twin-fallback" data-testid="twin-fallback">
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
            aria-label={`${a.name}, ${a.id}, ${states?.[a.id] ?? 'status unknown'}${a.id === props.selectedId ? ', selected' : ''}`}
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
              stroke={a.id === props.selectedId ? BLUE_HOUR.selection : BLUE_HOUR.silver}
              strokeWidth={a.id === props.selectedId ? 0.1 : 0.025}
            />
            <title>
              {a.id} · {states?.[a.id] ?? 'status unknown'} · {a.dimensionsM.join(' × ')} m
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
  const inputRef = useRef(input);
  useLayoutEffect(() => { inputRef.current = input; });
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
  const [kitCache, setKitCache] = useState(() => new VisualKitCache());
  const [kitStatus, setKitStatus] = useState<KitStatus>('idle');
  useEffect(() => supported && !lost ? kitCache.retain() : undefined, [kitCache, supported, lost]);
  useEffect(() => {
    const listener = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', listener);
    return () => {
      document.removeEventListener('visibilitychange', listener);
      delete window.__NEPTUNE_TWIN_SCENE__;
    };
  }, []);
  const fallback = <TwinFallback {...props} />;
  if (!supported || lost) return <>{fallback}{lost && <button className="twin-restore" onClick={() => { setKitCache(new VisualKitCache()); setKitStatus('idle'); setLost(false); }}>Restore 3D view</button>}</>;
  return (
    <div
      className="twin-scene"
      data-testid="twin-scene"
      data-inside={props.inside}
      data-detail-view={!props.inside && (props.focus === 'cooling' || (props.focus === 'selection' && ['pump', 'exchanger', 'cdu'].includes(active?.type ?? '')))}
    >
      <div className="twin-canvas-viewport">
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
            gl.setClearColor(BLUE_HOUR.ocean);
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1;
            gl.outputColorSpace = SRGBColorSpace;
            gl.domElement.setAttribute('role', 'img');
            gl.domElement.addEventListener(
              'webglcontextlost',
              (event) => {
                event.preventDefault();
                presentationDiagnostic('context', { reason: 'webgl-context-lost', visible: !document.hidden });
                delete window.__NEPTUNE_TWIN_SCENE__;
                inputRef.current.onPresentationTakeover?.('context-loss');
                setLost(true);
              },
              { once: true },
            );
          }}
        >
          <BlueHourEnvironment radius={radius} quiet={props.reducedMotion} />
          <TwinFacility
            props={sceneProps}
            moduleSpec={moduleSpec}
            details={details}
            active={active}
            kitCache={kitCache}
          />
          <CameraRig
            props={sceneProps}
            moduleSpec={moduleSpec}
            active={active}
            waypoint={waypoint}
            kitCache={kitCache}
            onKitStatus={setKitStatus}
          />
        </Canvas>
      </TwinBoundary>
      </div>
      <div className="twin-scene-information">
      {kitStatus !== 'idle' && kitStatus !== 'ready' && <output className="twin-kit-status" data-testid="visual-kit-status" data-status={kitStatus}>
        {kitStatus === 'loading' ? 'Loading equipment detail · envelopes remain interactive' : 'Equipment detail unavailable for some assets · procedural view active'}
      </output>}
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
        {kitStatus === 'ready' && <output data-testid="visual-kit-status" data-status="ready">Authored equipment · illustrative exterior</output>}
      </div>
      <details className="twin-route-legend" aria-label="Connection colors">
        <summary>Circuit legend</summary>
        <div>
        <span style={{ color: MEDIUM_COLORS.technical }}>
          — Technical coolant
        </span>
        <span style={{ color: MEDIUM_COLORS.seawater }}>— Seawater</span>
        <span style={{ color: MEDIUM_COLORS.power }}>— Power</span>
        <span style={{ color: MEDIUM_COLORS.cluster }}>— Network</span>
        </div>
      </details>
      {props.exploded && !props.inside && (
        <div className="twin-presentation-note">
          Exploded offsets are presentation only · physical routes and solver
          dimensions unchanged
        </div>
      )}
      </div>
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
    materials.set(type, new MeshStandardMaterial(assetSurface(type)));
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

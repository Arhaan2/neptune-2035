import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BackSide, Color, ShaderMaterial, Vector3, type Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Facility } from './Facility';
import {
  layoutRadius,
  makeLayout,
  representativeIsland,
  type System,
} from './layout';
import { fmt, type Model, type Scenario } from '../domain/model';
export interface SceneProps {
  scenario: Scenario;
  model: Model;
  xray: boolean;
  exploded: boolean;
  selected: System;
  inside: boolean;
  resetId: number;
  lowEffects: boolean;
  reducedMotion: boolean;
  demo: boolean;
  onSelect: (s: System) => void;
  onManual: () => void;
  onReady: () => void;
}
const oceanVertex = `varying vec3 vWorld; uniform float time; void main(){ vec3 p=position; p.z += sin(p.x*.14+time*.4)*.13 + sin(p.y*.2+time*.3)*.08; vec4 world=modelMatrix*vec4(p,1.); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`;
const oceanFragment = `varying vec3 vWorld; uniform float time; void main(){float wave=sin(vWorld.x*.6+vWorld.z*1.3+time*.8)*sin(vWorld.z*2.1-time*.5); float fine=pow(max(0.,sin(vWorld.x*1.4+vWorld.z*2.8+sin(vWorld.x*.2+time*.4)*2.+sin(vWorld.z*.23)*3.)),16.); float distanceFade=exp(-length(vWorld.xz)*.0025); float trail=exp(-pow((vWorld.x+55.)/24.,2.))*(1.-smoothstep(-250.,40.,vWorld.z)); vec3 c=mix(vec3(.055,.13,.17),vec3(.11,.23,.28),wave*.08+.2); c+=vec3(.22,.13,.075)*trail*(.23+fine*.45); c+=vec3(.14,.26,.3)*fine*.045*distanceFade; float horizon=smoothstep(10.,600.,length(vWorld.xz)); c=mix(c,vec3(.49,.29,.23),horizon*.82); gl_FragColor=vec4(c,1.); }`;
function SunsetSky() {
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
      <sphereGeometry args={[1800, 32, 16]} />
    </mesh>
  );
}
function Ocean({ quiet }: { quiet: boolean }) {
  const ref = useRef<Mesh>(null);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: oceanVertex,
        fragmentShader: oceanFragment,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    const material = ref.current?.material as ShaderMaterial | undefined;
    if (material && !quiet && !document.hidden)
      material.uniforms.time.value += Math.min(dt, 0.05);
  });
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -1.3, 0]}
      material={mat}
    >
      <planeGeometry args={[2400, 2400, 160, 160]} />
    </mesh>
  );
}
function CameraRig({
  radius,
  props,
  firstX,
  firstZ,
}: {
  radius: number;
  props: SceneProps;
  firstX: number;
  firstZ: number;
}) {
  const { camera, size, gl, scene } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const destination = useRef(new Vector3());
  const target = useRef(new Vector3());
  const transitioning = useRef(true);
  const exterior = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  const wasInside = useRef(false);
  const angle = useRef(0);
  const portraitFactor = Math.max(1.15, 1.65 / (size.width / size.height));
  const onManual = props.onManual;
  const isInside = props.inside;
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute(
      'aria-label',
      'Interactive offshore compute platform. Drag or use arrow keys to orbit; plus and minus to zoom.',
    );
    const key = (e: KeyboardEvent) => {
      const c = controls.current;
      if (
        !c ||
        isInside ||
        ![
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          '+',
          '-',
          '=',
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      onManual();
      transitioning.current = false;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        c.setAzimuthalAngle(
          c.getAzimuthalAngle() + (e.key === 'ArrowLeft' ? 0.15 : -0.15),
        );
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
        c.setPolarAngle(
          Math.max(
            0.18,
            Math.min(
              Math.PI * 0.475,
              c.getPolarAngle() + (e.key === 'ArrowUp' ? -0.1 : 0.1),
            ),
          ),
        );
      else {
        const direction = camera.position.clone().sub(c.target);
        direction.setLength(
          Math.max(
            radius * 0.35,
            Math.min(
              radius * 3.5,
              direction.length() * (e.key === '-' ? 1.1 : 0.9),
            ),
          ),
        );
        camera.position.copy(c.target).add(direction);
      }
      c.update();
    };
    canvas.addEventListener('keydown', key);
    return () => canvas.removeEventListener('keydown', key);
  }, [gl, camera, radius, onManual, isInside]);
  useEffect(() => {
    const c = controls.current;
    if (props.inside) {
      if (!wasInside.current)
        exterior.current = {
          pos: camera.position.clone(),
          target: c?.target.clone() ?? new Vector3(),
        };
      destination.current.set(firstX - 11.7, 4.15, firstZ - 11);
      target.current.set(firstX - 2.1, 4.1, firstZ - 11);
    } else if (wasInside.current && exterior.current) {
      destination.current.copy(exterior.current.pos);
      target.current.copy(exterior.current.target);
    } else {
      const d = radius * portraitFactor;
      destination.current.set(d * 1.04, d * 0.6, d * 1.22);
      target.current.set(0, props.exploded ? 5 : 0, 0);
    }
    wasInside.current = props.inside;
    transitioning.current = true;
    angle.current = 0;
  }, [
    radius,
    props.resetId,
    props.inside,
    props.exploded,
    portraitFactor,
    firstX,
    firstZ,
    camera,
  ]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (transitioning.current) {
      const t = props.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4);
      camera.position.lerp(destination.current, t);
      c.target.lerp(target.current, t);
      if (camera.position.distanceTo(destination.current) < 0.025)
        transitioning.current = false;
      c.update();
    } else if (props.demo && !props.reducedMotion) {
      angle.current += Math.min(dt, 0.05) * 0.055;
      const d = radius * portraitFactor;
      camera.position.set(
        Math.cos(0.85 + angle.current) * d * 1.65,
        d * 0.6,
        Math.sin(0.85 + angle.current) * d * 1.65,
      );
      c.update();
    }
    // A small read-only inspection surface for repeatable acceptance and recording.
    window.__NEPTUNE_SCENE__ = {
      camera: camera.position.toArray(),
      target: c.target.toArray(),
      calls: gl.info.render.calls,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      objects: scene.children.length,
    };
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!props.inside && !props.demo}
      enablePan={false}
      minDistance={props.inside ? 0.05 : radius * 0.35}
      maxDistance={radius * 3.5}
      minPolarAngle={0.18}
      maxPolarAngle={props.inside ? Math.PI : Math.PI * 0.475}
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
    __NEPTUNE_SCENE__?: {
      camera: number[];
      target: number[];
      calls: number;
      geometries: number;
      textures: number;
      objects: number;
    };
  }
}
class SceneBoundary extends Component<
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
export function Fallback({ model }: { model: Model }) {
  return (
    <div
      className="fallback"
      aria-label="Accessible schematic of compute modules connected to power and two cooling circuits"
    >
      <span className="eyebrow">SCHEMATIC VIEW · WEBGL2 UNAVAILABLE</span>
      <h2>Infrastructure, connected.</h2>
      <div className="schematic">
        <div>
          External power
          <br />
          <strong>{fmt(model.facilityPeakMW)} MW peak</strong>
        </div>
        <span>↓ distribution + UPS</span>
        <div className="schematic-compute">
          {fmt(model.provisionedGpuCount, 0)} accelerators
          <br />
          <small>{model.moduleCount} compute modules</small>
        </div>
        <span>↕ closed technical coolant</span>
        <div>CDU ↔ heat exchanger</div>
        <span>↕ separate seawater circuit</span>
        <div>
          Ocean heat sink
          <br />
          <strong>{fmt(model.operatingFlowM3PerS)} m³/s operating</strong>
        </div>
      </div>
      <p>
        Your device could not initialize the 3D scene. All scenario controls and
        calculations remain available.
      </p>
    </div>
  );
}
export default function Scene(props: SceneProps) {
  const moduleCount = props.model.moduleCount;
  const platformCount = props.model.platformCount;
  const generation = props.scenario.generation;
  const layout = useMemo(
    () => makeLayout({ moduleCount, platformCount }, generation),
    [moduleCount, platformCount, generation],
  );
  const radius = layoutRadius(layout);
  const [supported] = useState(() => {
    if (new URLSearchParams(location.search).get('fallback') === '1')
      return false;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      const ok = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return ok;
    } catch {
      return false;
    }
  });
  const [lost, setLost] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  const fallback = <Fallback model={props.model} />;
  if (!supported || lost) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <Canvas
        shadows={!props.lowEffects}
        dpr={props.lowEffects ? 1 : [1, 1.6]}
        frameloop={visible ? 'always' : 'never'}
        camera={{
          position: [radius * 1.04, radius * 0.6, radius * 1.22],
          fov: 48,
          near: 0.1,
          far: 3000,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new Color('#102531'), 0);
          gl.domElement.setAttribute(
            'aria-label',
            'Interactive offshore compute platform. Drag to orbit; scroll to zoom.',
          );
          gl.domElement.setAttribute('role', 'img');
          gl.domElement.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault();
              setLost(true);
            },
            { once: true },
          );
          props.onReady();
        }}
      >
        <SunsetSky />
        <fog attach="fog" args={['#314953', 220, 1000]} />
        <ambientLight intensity={1.2} color="#bedcde" />
        <hemisphereLight args={['#d3e5e6', '#233e49', 1.7]} />
        <directionalLight
          position={[-70, 55, -45]}
          intensity={3.5}
          color="#ffc899"
          castShadow={!props.lowEffects}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-150}
          shadow-camera-right={150}
          shadow-camera-top={150}
          shadow-camera-bottom={-150}
          shadow-camera-far={400}
          shadow-bias={-0.0006}
        />
        <directionalLight
          position={[40, 25, 50]}
          intensity={1}
          color="#c2e8ef"
        />
        <Ocean quiet={props.reducedMotion || props.lowEffects} />
        <Facility
          layout={layout}
          xray={props.xray}
          exploded={props.exploded}
          selected={props.selected}
          inside={props.inside}
          reducedMotion={props.reducedMotion || props.lowEffects}
          onSelect={props.onSelect}
        />
        <CameraRig
          radius={radius}
          props={props}
          firstX={representativeIsland(layout).x}
          firstZ={representativeIsland(layout).z}
        />
      </Canvas>
    </SceneBoundary>
  );
}

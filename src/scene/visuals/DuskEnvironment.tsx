import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  Color,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { BLUE_HOUR } from './materials';

// Colors enter as sRGB CSS values and Color converts them to the renderer's linear
// working space. Both custom shaders use Three's tone/output chunks exactly once.
const skyRadiance = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 lowSky;
  vec3 duskRadiance(vec3 direction) {
    float height = max(direction.y, 0.0);
    vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.7, height));
    sky = mix(lowSky, sky, smoothstep(-0.16, 0.02, direction.y));
    // A broad cool afterglow; no bright sun disk or orange sunset.
    float glow = pow(max(dot(direction, normalize(vec3(-0.7, 0.08, -0.6))), 0.0), 8.0);
    sky += vec3(0.035, 0.04, 0.045) * glow * exp(-height * 6.0);
    return sky;
  }
`;

const skyVertex = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function makeSkyMaterial(reflectionFill = false) {
  return new ShaderMaterial({
    name: reflectionFill ? 'BlueHourReflectionEnvironment' : 'BlueHourSky',
    side: BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new Color(BLUE_HOUR.skyZenith) },
      horizon: { value: new Color(BLUE_HOUR.skyHorizon) },
      lowSky: { value: new Color(BLUE_HOUR.skyLow) },
      reflectionFill: { value: reflectionFill ? 1 : 0 },
    },
    vertexShader: skyVertex,
    fragmentShader: /* glsl */ `
      varying vec3 vDirection;
      uniform float reflectionFill;
      ${skyRadiance}
      void main() {
        vec3 direction = normalize(vDirection);
        vec3 radiance = duskRadiance(direction);
        // Wide, soft studio-like sky fill gives brushed metal a readable highlight.
        // This is prepared once in the local reflection map, never rendered per asset.
        float softbox = pow(max(dot(direction, normalize(vec3(-0.6, 0.75, 0.25))), 0.0), 10.0);
        radiance += reflectionFill * (vec3(0.12, 0.16, 0.21) + vec3(1.3, 1.38, 1.45) * softbox);
        gl_FragColor = vec4(radiance, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function ReflectionEnvironment() {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const capture = new Scene();
    const geometry = new SphereGeometry(10, 24, 12);
    const material = makeSkyMaterial(true);
    capture.add(new Mesh(geometry, material));
    const generator = new PMREMGenerator(gl);
    // One bounded local 128px capture. PMREM captures linear radiance, without
    // display tone mapping; the final standard materials apply that conversion.
    const environment = generator.fromScene(capture, 0.06, 0.1, 30, {
      size: 128,
    });
    generator.dispose();
    geometry.dispose();
    material.dispose();
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.95;
    return () => {
      if (scene.environment === environment.texture) {
        scene.environment = previousEnvironment;
        scene.environmentIntensity = previousIntensity;
      }
      environment.dispose();
    };
  }, [get]);
  return null;
}

function DuskSky({ radius }: { radius: number }) {
  const material = useMemo(() => makeSkyMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-100} name="blue-hour-sky">
      <sphereGeometry args={[Math.max(1800, radius * 15), 32, 16]} />
    </mesh>
  );
}

const oceanVertex = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const oceanFragment = /* glsl */ `
  uniform float time;
  uniform vec3 waterTint;
  varying vec3 vWorldPosition;
  ${skyRadiance}
  // Analytic ripple slopes avoid textures, noisy vertex displacement, and moving
  // the canonical waterline. Fade frequencies before they become subpixel.
  float filteredWave(vec2 direction, float frequency, float speed, float strength) {
    vec2 perpendicular = vec2(-direction.y, direction.x);
    float meander = sin(dot(vWorldPosition.xz, perpendicular) * 0.23 + time * 0.035) * 3.5;
    meander += sin(dot(vWorldPosition.xz, direction + perpendicular) * 0.117 - time * 0.017) * 2.0;
    float phase = dot(vWorldPosition.xz, direction) * frequency + meander + time * speed;
    float filtering = 1.0 - smoothstep(0.45, 2.0, fwidth(phase));
    return cos(phase) * strength * filtering;
  }
  void main() {
    float a = filteredWave(vec2(0.94, 0.34), 1.3, 0.32, 0.016);
    float b = filteredWave(vec2(-0.4, 0.92), 2.1, -0.24, 0.012);
    float c = filteredWave(vec2(0.7, -0.71), 3.8, 0.42, 0.008);
    vec3 normal = normalize(vec3(a * 0.94 - b * 0.4 + c * 0.7, 1.0, a * 0.34 + b * 0.92 - c * 0.71));
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 reflected = reflect(-viewDirection, normal);
    float fresnel = 0.035 + 0.5 * pow(1.0 - max(dot(viewDirection, normal), 0.0), 4.0);
    vec3 reflection = duskRadiance(reflected);
    vec3 color = mix(waterTint * (0.85 + normal.y * 0.3), reflection, fresnel);
    // Restrained broad sheen, with no hard mirror or synthetic reflected campus.
    vec3 halfVector = normalize(viewDirection + normalize(vec3(-0.6, 0.8, 0.3)));
    color += vec3(0.035, 0.048, 0.058) * pow(max(dot(normal, halfVector), 0.0), 90.0);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function DuskOcean({ radius, quiet }: { radius: number; quiet: boolean }) {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        name: 'BlueHourOcean',
        uniforms: {
          time: { value: 0 },
          waterTint: { value: new Color(BLUE_HOUR.ocean) },
          zenith: { value: new Color(BLUE_HOUR.skyZenith) },
          horizon: { value: new Color(BLUE_HOUR.skyHorizon) },
          lowSky: { value: new Color(BLUE_HOUR.skyLow) },
        },
        vertexShader: oceanVertex,
        fragmentShader: oceanFragment,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    const current = ref.current?.material as ShaderMaterial | undefined;
    if (current && !quiet && !document.hidden)
      current.uniforms.time.value += Math.min(dt, 0.05);
  });
  return (
    <mesh
      ref={ref}
      name="blue-hour-ocean"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      material={material}
    >
      <planeGeometry
        args={[Math.max(20000, radius * 50), Math.max(20000, radius * 50)]}
      />
    </mesh>
  );
}

/** Cosmetic environment only. No resource, motion, or timing enters the solver. */
export function BlueHourEnvironment({
  radius,
  quiet,
}: {
  radius: number;
  quiet: boolean;
}) {
  return (
    <>
      <ReflectionEnvironment />
      <DuskSky radius={radius} />
      <DuskOcean radius={radius} quiet={quiet} />
      <hemisphereLight args={['#D4E3F0', '#3D5366', 1.15]} />
      <directionalLight
        position={[-80, 110, 40]}
        intensity={2.2}
        color="#EDF3F7"
      />
      <directionalLight
        position={[70, 35, -80]}
        intensity={0.9}
        color="#91ADC9"
      />
    </>
  );
}

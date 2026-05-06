"use client";

/**
 * Local fork of @react-three/drei's ContactShadows: the depth pass used to run
 * with stale world matrices (same-frame useFrame order + Suspense) so contact
 * puddles lagged 1+ frames behind moving props. We call updateMatrixWorld before
 * the offscreen gl.render, and the scene mounts this after all desk Suspense
 * children so the useFrame subscription runs last (priority 0, stable order).
 * @see node_modules/@react-three/drei/core/ContactShadows.js
 */
import { type ThreeElements, useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { HorizontalBlurShader, VerticalBlurShader } from "three-stdlib";

type ContactShadowsProps = Omit<ThreeElements["group"], "ref"> & {
  scale?: number | [number, number, number];
  frames?: number;
  opacity?: number;
  width?: number;
  height?: number;
  blur?: number;
  near?: number;
  far?: number;
  resolution?: number;
  smooth?: boolean;
  /** When true, depth+blur passes run every other R3F frame (~half GPU cost vs continuous). */
  halfRate?: boolean;
  color?: string;
  depthWrite?: boolean;
  renderOrder?: number;
  /**
   * Multiplier each frame: `opacity * ref.current`. Lets parents fade contact shadows during
   * intro without React rerenders (`useFrame` updates the ref).
   */
  opacityMultiplierRef?: React.RefObject<number>;
};

const ContactShadows = React.forwardRef<THREE.Group, ContactShadowsProps>(function ContactShadows(
  {
    scale = 10,
    frames = Infinity,
    opacity = 1,
    width = 1,
    height = 1,
    blur = 1,
    near = 0,
    far = 10,
    resolution = 512,
    smooth = false,
    halfRate = false,
    color = "#000000",
    depthWrite = false,
    renderOrder,
    opacityMultiplierRef,
    ...props
  },
  fref,
) {
  const ref = React.useRef<THREE.Group | null>(null);
  const shadowMatRef = React.useRef<THREE.MeshBasicMaterial | null>(null);
  /** Keeps Scene-panel `opacity` in sync without JSX overwriting imperative `opacity * multiplier` each render. */
  const baseOpacityRef = React.useRef(opacity);
  React.useLayoutEffect(() => {
    baseOpacityRef.current = opacity;
    const m = shadowMatRef.current;
    if (m) {
      m.opacity = opacity * (opacityMultiplierRef?.current ?? 1);
    }
  }, [opacity]);

  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const shadowCamera = React.useRef<THREE.OrthographicCamera | null>(null);
  const w = width * (Array.isArray(scale) ? scale[0] : scale || 1);
  const h = height * (Array.isArray(scale) ? scale[1] : scale || 1);
  const [renderTarget, planeGeometry, depthMaterial, blurPlane, horizontalBlurMaterial, verticalBlurMaterial, renderTargetBlur] =
    React.useMemo(() => {
      const rt = new THREE.WebGLRenderTarget(resolution, resolution);
      const rtBlur = new THREE.WebGLRenderTarget(resolution, resolution);
      rtBlur.texture.generateMipmaps = rt.texture.generateMipmaps = false;
      const pg = new THREE.PlaneGeometry(w, h).rotateX(Math.PI / 2);
      const bp = new THREE.Mesh(pg);
      const dm = new THREE.MeshDepthMaterial();
      dm.depthTest = dm.depthWrite = false;
      dm.onBeforeCompile = (shader) => {
        shader.uniforms = {
          ...shader.uniforms,
          ucolor: { value: new THREE.Color(color) },
        };
        shader.fragmentShader = shader.fragmentShader.replace(
          "void main() {",
          `uniform vec3 ucolor;
           void main() {
          `,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec4( vec3( 1.0 - fragCoordZ ), opacity );",
          "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );",
        );
      };
      const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
      const vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
      vBlur.depthTest = hBlur.depthTest = false;
      return [rt, pg, dm, bp, hBlur, vBlur, rtBlur] as const;
    }, [resolution, w, h, color]);

  const blurShadows = (b: number) => {
    blurPlane.visible = true;
    blurPlane.material = horizontalBlurMaterial;
    horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
    horizontalBlurMaterial.uniforms.h.value = b * (1 / 256);
    gl.setRenderTarget(renderTargetBlur);
    gl.render(blurPlane, shadowCamera.current!);
    blurPlane.material = verticalBlurMaterial;
    verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
    verticalBlurMaterial.uniforms.v.value = b * (1 / 256);
    gl.setRenderTarget(renderTarget);
    gl.render(blurPlane, shadowCamera.current!);
    blurPlane.visible = false;
  };
  const countRef = React.useRef(0);
  let initialBackground: typeof scene.background;
  let initialOverrideMaterial: typeof scene.overrideMaterial;

  /** Skip every other shadow update when {@link halfRate} is enabled. */
  const halfRatePingRef = React.useRef(0);

  /**
   * Must stay at default priority (`0`). In R3F, **any** `useFrame(..., n)` with `n > 0`
   * increments `internal.priority`, which **disables** the built-in `gl.render(scene, camera)`
   * until manual subscribers render — leaving the canvas blank unless we render the whole scene here.
   */
  useFrame((state) => {
    const mult = opacityMultiplierRef?.current ?? 1;
    const shadowMat = shadowMatRef.current;
    if (shadowMat) {
      shadowMat.opacity = baseOpacityRef.current * mult;
    }

    const count = countRef.current;
    if (shadowCamera.current && (frames === Infinity || count < frames)) {
      halfRatePingRef.current += 1;
      if (halfRate && halfRatePingRef.current % 2 === 0) {
        return;
      }
      countRef.current += 1;
      initialBackground = scene.background;
      initialOverrideMaterial = scene.overrideMaterial;
      if (ref.current) {
        ref.current.visible = false;
      }
      scene.background = null;
      scene.overrideMaterial = depthMaterial;
      // Critical: all locals were applied in this tick's useFrames, but
      // matrixWorld is usually updated at render. Force a full world update
      // before the extra depth `gl.render` so contact puddles match the mesh.
      state.scene.updateMatrixWorld(true);
      gl.setRenderTarget(renderTarget);
      gl.render(scene, shadowCamera.current);
      blurShadows(blur);
      if (smooth) {
        blurShadows(blur * 0.4);
      }
      gl.setRenderTarget(null);
      if (ref.current) {
        ref.current.visible = true;
      }
      scene.overrideMaterial = initialOverrideMaterial;
      scene.background = initialBackground;
    }
  });
  React.useImperativeHandle(fref, () => ref.current!, []);

  return (
    <group rotation-x={Math.PI / 2} {...(props as object)} ref={ref}>
      <mesh
        renderOrder={renderOrder}
        geometry={planeGeometry}
        scale={[1, -1, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          ref={shadowMatRef}
          transparent
          map={renderTarget.texture}
          depthWrite={depthWrite}
        />
      </mesh>
      <orthographicCamera ref={shadowCamera} args={[-w / 2, w / 2, h / 2, -h / 2, near, far]} />
    </group>
  );
});

export { ContactShadows };

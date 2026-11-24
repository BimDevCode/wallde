import * as THREE from 'three';
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { RenderPass, ToneMappingMode } from 'postprocessing';
import { useStore } from '../state/store';
import { QUALITY, SOLID_LAYER } from './quality';
import { sceneRegistry } from './registry';

/**
 * Apple's graphics chips (and the PowerVR designs they descend from) work out
 * which surface is in front before shading anything, so a depth pre-pass only
 * adds work there. Everything else shades whatever it is given, in the order given.
 */
function hidesSurfacesItself(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /Apple|PowerVR/i.test(name);
}

/**
 * Draws the scene, on most graphics cards laying down depth for all solid
 * geometry first.
 *
 * Indoors a view ray crosses many walls and floors. Drawn naively, every one of
 * those surfaces is fully lit and then painted over by the one in front — five
 * to nine times per pixel in this flat. With depth already in place the card
 * rejects the hidden ones early and each pixel is lit once.
 */
class ScenePass extends RenderPass {
  /** Decided on the first frame from the graphics card; can be forced either way to measure it. */
  prePass: boolean | null = null;

  private readonly depthOnly = new THREE.MeshBasicMaterial({
    colorWrite: false,
    // Nudged a hair further away so the real pass, drawn with different shaders, never loses a tie.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
  });

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super(scene, camera);
    sceneRegistry.scenePass = this;
  }

  render(
    renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget,
    outputBuffer: THREE.WebGLRenderTarget,
    deltaTime?: number,
    stencilTest?: boolean,
  ): void {
    const scene = this.scene, camera = this.camera;
    this.prePass ??= !hidesSurfacesItself(renderer);
    // The pre-pass clears the buffer itself; the scene pass must then keep that depth.
    this.clearPass.enabled = !this.prePass;
    if (this.prePass) {
      const layers = camera.layers.mask;
      const override = scene.overrideMaterial;
      const background = scene.background;
      const shadows = renderer.shadowMap.needsUpdate;

      camera.layers.set(SOLID_LAYER);
      scene.overrideMaterial = this.depthOnly;
      scene.background = null;
      // Shadow maps belong to the real pass, which sees every object.
      renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(this.renderToScreen ? null : inputBuffer);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      camera.layers.mask = layers;
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.shadowMap.needsUpdate = shadows;
    }
    super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
  }

  dispose(): void {
    this.depthOnly.dispose();
    super.dispose();
  }
}

const createScenePass = (scene: THREE.Scene, camera: THREE.Camera) => new ScenePass(scene, camera);

/**
 * The frame pipeline: depth pre-pass, the scene itself, optional ambient
 * occlusion (which darkens corners and does most of the work of making plain
 * interiors read as rooms), then tone mapping.
 */
export function Effects() {
  const ao = useStore((s) => s.ao);
  const quality = useStore((s) => QUALITY[s.quality]);
  return (
    <EffectComposer renderPass={createScenePass} multisampling={4} enableNormalPass={false}>
      {ao ? <N8AO ref={(pass: unknown) => { sceneRegistry.ao = pass; }} aoRadius={0.9} distanceFalloff={0.8} intensity={3.2} quality={quality.ao} halfRes /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface ThreeSceneResources {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  geometries: { box: THREE.BoxGeometry; sphere: THREE.SphereGeometry };
  materials: THREE.MeshStandardMaterial[];
  dispose(): void;
}

/** Three.js-only resource construction. No Rapier or scheduling knowledge. */
export function createScene(container: HTMLElement): ThreeSceneResources {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10192b);
  scene.fog = new THREE.Fog(0x10192b, 18, 36);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(9, 7, 12);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xadc9ff, 0x29314c, 2.5));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(5, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0002;
  scene.add(sun);

  const groundGeometry = new THREE.BoxGeometry(10, 0.5, 10);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x263c50, roughness: 0.94 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(10, 20, 0x7295b5, 0x45596d);
  grid.position.y = 0.008;
  scene.add(grid);

  const geometries = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(0.5, 20, 14) };
  const materials = [0x78aafa, 0xf7b46c, 0x75d5c2].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.target.set(0, 2, 0);
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return {
    scene, camera, renderer, controls, geometries, materials,
    dispose() {
      observer.disconnect();
      controls.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      geometries.box.dispose();
      geometries.sphere.dispose();
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

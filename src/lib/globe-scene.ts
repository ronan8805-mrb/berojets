import * as THREE from "three";
import { PLACES } from "@/lib/places";

export type Geo = { lat: number; lng: number };

type Idle = { mode: "idle" };
type Flight = {
  mode: "flight";
  from: Geo;
  to: Geo;
  onDone: () => void;
  onPhase?: (phase: "fly" | "land") => void;
};

function ll(lat: number, lng: number, r: number) {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(phi) * Math.sin(theta),
    r * Math.sin(phi),
    r * Math.cos(phi) * Math.cos(theta),
  );
}

function slerp(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  const dot = THREE.MathUtils.clamp(an.dot(bn), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-4) return an.lerp(bn, t);
  const s = Math.sin(omega);
  return an
    .multiplyScalar(Math.sin((1 - t) * omega) / s)
    .add(bn.multiplyScalar(Math.sin(t * omega) / s));
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function makeJet() {
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({
    color: 0xf4f1ea,
    metalness: 0.45,
    roughness: 0.38,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2a2422,
    metalness: 0.55,
    roughness: 0.4,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0xe23b2b,
    metalness: 0.2,
    roughness: 0.45,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.35, 4, 10), bone);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 12), bone);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.02;
  g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.42), bone);
  wing.position.set(0, -0.02, 0.05);
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.28), bone);
  tail.position.set(0, 0.04, -0.86);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.38, 0.32), bone);
  fin.position.set(0, 0.22, -0.9);
  g.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 1.35), red);
  stripe.position.set(0.2, 0.12, 0.05);
  g.add(stripe);
  for (const x of [-0.42, 0.42]) {
    const eng = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.36, 3, 8), dark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -0.16, -0.12);
    g.add(eng);
  }
  g.scale.setScalar(0.2);
  return g;
}

export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function mountGlobe(canvas: HTMLCanvasElement, opts: Idle | Flight): (() => void) | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(0, 1.15, 6.3);

  scene.add(new THREE.AmbientLight(0xf4f1ea, 0.55));
  const key = new THREE.DirectionalLight(0xfff6ea, 1.35);
  key.position.set(4, 3.2, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe23b2b, 0.28);
  rim.position.set(-5, -1, -3);
  scene.add(rim);

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(2, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0x171a14, roughness: 0.94, metalness: 0.06 }),
  );
  earthGroup.add(earth);
  const graticule = new THREE.Mesh(
    new THREE.SphereGeometry(2.012, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x8d9378, wireframe: true, transparent: true, opacity: 0.14 }),
  );
  earthGroup.add(graticule);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(2.16, 40, 32),
    new THREE.MeshBasicMaterial({ color: 0xc5d2a4, transparent: true, opacity: 0.07, side: THREE.BackSide }),
  );
  earthGroup.add(atmo);

  const cityPos = new Float32Array(PLACES.length * 3);
  PLACES.forEach((p, i) => {
    const v = ll(p.lat, p.lng, 2.02);
    cityPos[i * 3] = v.x;
    cityPos[i * 3 + 1] = v.y;
    cityPos[i * 3 + 2] = v.z;
  });
  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute("position", new THREE.BufferAttribute(cityPos, 3));
  const cities = new THREE.Points(
    cityGeo,
    new THREE.PointsMaterial({ color: 0xf4f1ea, size: 0.028, sizeAttenuation: true }),
  );
  earthGroup.add(cities);

  const jet = makeJet();
  scene.add(jet);

  const N = 96;
  const trailPos = new Float32Array(N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ color: 0xe23b2b, transparent: true, opacity: 0.9 }),
  );
  scene.add(trail);

  let ring: THREE.Mesh | null = null;
  let fromV = ll(12, -20, 1);
  let toV = ll(28, 40, 1);
  if (opts.mode === "flight") {
    fromV = ll(opts.from.lat, opts.from.lng, 1);
    toV = ll(opts.to.lat, opts.to.lng, 1);
    const mid = slerp(fromV, toV, 0.35);
    camera.position.copy(mid.clone().normalize().multiplyScalar(6.1).add(new THREE.Vector3(0, 0.7, 0)));
    camera.lookAt(0, 0, 0);
    ring = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.09, 40),
      new THREE.MeshBasicMaterial({ color: 0xe23b2b, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
    );
    const dest = toV.clone().normalize().multiplyScalar(2.03);
    ring.position.copy(dest);
    ring.lookAt(dest.clone().multiplyScalar(2));
    earthGroup.add(ring);
  }

  let raf = 0;
  let dead = false;
  let finished = false;
  let landed = false;
  const t0 = performance.now();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduce ? 900 : 5200;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const tick = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    const elapsed = now - t0;
    if (opts.mode === "idle") {
      earthGroup.rotation.y = elapsed * 0.00008;
      const ang = elapsed * 0.00022;
      const lat = 16 * Math.sin(elapsed * 0.00015);
      const lng = (ang * 180) / Math.PI;
      const pos = ll(lat, lng, 2.32);
      const ahead = ll(lat, lng + 6, 2.32);
      jet.position.copy(pos);
      jet.lookAt(ahead);
    } else {
      const raw = Math.min(1, elapsed / duration);
      const e = ease(raw);
      const lift = 2.03 + Math.sin(Math.PI * e) * 0.26;
      const pos = slerp(fromV, toV, e).multiplyScalar(lift);
      const e2 = Math.min(0.985, e + 0.02);
      const ahead = slerp(fromV, toV, e2).multiplyScalar(lift);
      jet.position.copy(pos);
      if (ahead.distanceTo(pos) > 0.01) jet.lookAt(ahead);
      const samples = Math.max(2, Math.floor(e * (N - 1)));
      for (let i = 0; i <= samples; i += 1) {
        const p = slerp(fromV, toV, (i / (N - 1)) * Math.max(e, 0.001)).multiplyScalar(
          2.03 + Math.sin(Math.PI * ((i / (N - 1)) * e)) * 0.26,
        );
        trailPos[i * 3] = p.x;
        trailPos[i * 3 + 1] = p.y;
        trailPos[i * 3 + 2] = p.z;
      }
      trailGeo.setDrawRange(0, samples + 1);
      (trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const focus = slerp(fromV, toV, Math.min(1, e * 1.05)).normalize();
      const want = focus.clone().multiplyScalar(5.5).add(new THREE.Vector3(0, 0.85, 0));
      camera.position.lerp(want, 0.045);
      camera.lookAt(0, 0.1, 0);
      if (ring) ring.scale.setScalar(1 + Math.sin(elapsed * 0.008) * 0.18);
      if (e > 0.9 && !landed) {
        landed = true;
        opts.onPhase?.("land");
      }
      if (raw >= 1 && !finished) {
        finished = true;
        window.setTimeout(() => {
          if (!dead) opts.onDone();
        }, reduce ? 120 : 650);
      }
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    trailGeo.dispose();
    cityGeo.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  };
}

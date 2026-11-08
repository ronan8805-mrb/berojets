import * as THREE from "three";
import { PLACES } from "@/lib/places";

export type Geo = { lat: number; lng: number; label?: string };

type Idle = { mode: "idle" };
type Flight = {
  mode: "flight";
  from: Geo;
  to: Geo;
  onDone: () => void;
  onPhase?: (phase: "fly" | "land") => void;
};

const R = 2;

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

function smooth(x: number) {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

function makeJetSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 270);
  ctx.fillStyle = "#e7edf2";
  ctx.beginPath();
  ctx.moveTo(0, -230);
  ctx.bezierCurveTo(22, -150, 26, -20, 22, 150);
  ctx.lineTo(14, 196);
  ctx.lineTo(-14, 196);
  ctx.lineTo(-22, 150);
  ctx.bezierCurveTo(-26, -20, -22, -150, 0, -230);
  ctx.fill();
  ctx.fillStyle = "#f7f4ee";
  ctx.beginPath();
  ctx.moveTo(0, -230);
  ctx.bezierCurveTo(16, -150, 18, -20, 16, 150);
  ctx.lineTo(10, 188);
  ctx.lineTo(-14, 188);
  ctx.lineTo(-22, 140);
  ctx.bezierCurveTo(-26, -20, -22, -150, 0, -230);
  ctx.fill();
  const wing = (sign: number) => {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.moveTo(sign * 12, -10);
    ctx.lineTo(sign * 168, 78);
    ctx.lineTo(sign * 150, 112);
    ctx.lineTo(sign * 10, 48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d5dbe3";
    ctx.beginPath();
    ctx.ellipse(sign * 62, 36, 13, 26, sign * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c2833";
    ctx.beginPath();
    ctx.ellipse(sign * 62, 30, 6, 10, sign * 0.55, 0, Math.PI * 2);
    ctx.fill();
  };
  wing(-1);
  wing(1);
  ctx.fillStyle = "#f7f4ee";
  ctx.beginPath();
  ctx.moveTo(-8, 150);
  ctx.lineTo(-62, 210);
  ctx.lineTo(-46, 222);
  ctx.lineTo(-6, 176);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 150);
  ctx.lineTo(62, 210);
  ctx.lineTo(46, 222);
  ctx.lineTo(6, 176);
  ctx.fill();
  ctx.fillStyle = "#e23b2b";
  ctx.fillRect(-3, 120, 6, 70);
  ctx.fillStyle = "#14202b";
  ctx.beginPath();
  ctx.ellipse(0, -168, 11, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#243140";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(-16, -120 + i * 28, 7, 6);
    ctx.fillRect(9, -120 + i * 28, 7, 6);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }),
  );
  return sprite;
}

function cityLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = "rgba(8,12,18,0.78)";
  ctx.beginPath();
  ctx.roundRect(16, 28, 480, 104, 52);
  ctx.fill();
  ctx.fillStyle = "#f4f1ea";
  const label = text.trim().toUpperCase();
  let size = 54;
  ctx.font = `600 ${size}px Outfit, sans-serif`;
  while (ctx.measureText(label).width > 430 && size > 28) {
    size -= 4;
    ctx.font = `600 ${size}px Outfit, sans-serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 82);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
  sprite.scale.set(0.4, 0.125, 1);
  return sprite;
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
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x070b14, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  camera.position.set(0, 1.2, 6.1);

  scene.add(new THREE.AmbientLight(0xb7c4d6, 0.55));
  scene.add(new THREE.HemisphereLight(0xd5e6ff, 0x1a140e, 0.45));
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.35);
  sun.position.set(5, 3.2, 4);
  scene.add(sun);

  const starPos = new Float32Array(420 * 3);
  for (let i = 0; i < 420; i += 1) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(28 + Math.random() * 8);
    starPos[i * 3] = v.x;
    starPos[i * 3 + 1] = v.y;
    starPos[i * 3 + 2] = v.z;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(
    new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf4f1ea, size: 0.045, sizeAttenuation: true })),
  );

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const earthMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.04,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), earthMat);
  earth.rotation.y = -Math.PI / 2;
  earthGroup.add(earth);

  const borderMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const borders = new THREE.Mesh(new THREE.SphereGeometry(R + 0.012, 96, 64), borderMat);
  borders.rotation.y = -Math.PI / 2;
  earthGroup.add(borders);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.08, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(mv.xyz);
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(0.68 - dot(normalize(vNormal), normalize(-vView)), 2.6);
          gl_FragColor = vec4(0.45, 0.78, 1.0, clamp(rim, 0.0, 1.0) * 0.95);
        }
      `,
    }),
  );
  earthGroup.add(atmo);

  let started = 0;
  const loader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  const colorMap = loader.load("/globe/earth.jpg", () => {
    if (!started) started = performance.now();
  });
  const bumpMap = loader.load("/globe/earth-topo.png");
  const borderMap = loader.load("/globe/borders.png");
  colorMap.colorSpace = THREE.SRGBColorSpace;
  borderMap.colorSpace = THREE.SRGBColorSpace;
  bumpMap.colorSpace = THREE.NoColorSpace;
  colorMap.anisotropy = 8;
  borderMap.anisotropy = 8;
  earthMat.map = colorMap;
  earthMat.bumpMap = bumpMap;
  earthMat.bumpScale = 0.045;
  borderMat.map = borderMap;
  textures.push(colorMap, bumpMap, borderMap);

  const jet = makeJetSprite();
  earthGroup.add(jet);

  const arcAlt = (u: number) => 0.055 + Math.sin(Math.PI * u) * 0.2;
  const N = 28;
  const trailPos = new Float32Array(N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ color: 0xfff4ea, transparent: true, opacity: 0.9 }),
  );
  earthGroup.add(trail);

  let fromV = ll(20, -30, 1);
  let toV = ll(35, 20, 1);
  let omega = 0.8;
  let pin: THREE.Group | null = null;
  if (opts.mode === "flight") {
    fromV = ll(opts.from.lat, opts.from.lng, 1);
    toV = ll(opts.to.lat, opts.to.lng, 1);
    omega = Math.acos(THREE.MathUtils.clamp(fromV.dot(toV), -1, 1));
    const steps = 96;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      pts.push(slerp(fromV, toV, u).multiplyScalar(R + arcAlt(u)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 140, 0.011, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xe23b2b }),
    );
    earthGroup.add(tube);
    const glowTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.026, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0xff6a4a,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(glowTube);
    const dotCount = 48;
    const dotPos = new Float32Array(dotCount * 3);
    for (let i = 0; i < dotCount; i += 1) {
      const u = i / (dotCount - 1);
      const p = slerp(fromV, toV, u).multiplyScalar(R + arcAlt(u) + 0.01);
      dotPos[i * 3] = p.x;
      dotPos[i * 3 + 1] = p.y;
      dotPos[i * 3 + 2] = p.z;
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
    earthGroup.add(
      new THREE.Points(
        dotGeo,
        new THREE.PointsMaterial({
          color: 0xfff7f2,
          size: 0.055,
          transparent: true,
          depthWrite: false,
          opacity: 0.95,
        }),
      ),
    );

    const dest = toV.clone().normalize();
    pin = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8),
      new THREE.MeshBasicMaterial({ color: 0xe23b2b }),
    );
    stem.position.y = 0.05;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff4ea }),
    );
    head.position.y = 0.11;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.1, 48),
      new THREE.MeshBasicMaterial({ color: 0xe23b2b, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
    );
    ring.rotation.x = -Math.PI / 2;
    pin.add(stem, head, ring);
    pin.position.copy(dest.clone().multiplyScalar(R + 0.015));
    pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dest);
    earthGroup.add(pin);
    const label = opts.to.label ? cityLabel(opts.to.label) : null;
    if (label) {
      label.position.copy(dest.clone().multiplyScalar(R + 0.12).add(new THREE.Vector3(0, 0.16, 0)));
      earthGroup.add(label);
    }
    const lit = slerp(fromV, toV, 0.45);
    sun.position.copy(lit.multiplyScalar(8).add(new THREE.Vector3(1.5, 2.2, 0.6)));
    const half = Math.min(1.2, omega * 0.5 + 0.48);
    const dist0 = THREE.MathUtils.clamp((R + 0.15) / Math.max(0.34, Math.cos(half)), 3.15, 5.35);
    const focus0 = slerp(fromV, toV, 0.35).normalize();
    camera.position.copy(focus0.clone().add(new THREE.Vector3(0, 0.16, 0)).normalize().multiplyScalar(dist0));
    camera.lookAt(focus0.clone().multiplyScalar(0.08));
  }

  let raf = 0;
  let dead = false;
  let finished = false;
  let landed = false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduce ? 900 : 15000;
  const arm = window.setTimeout(() => {
    if (!started) started = performance.now();
  }, 900);

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 46 : 36;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const tmp = new THREE.Vector3();
  const camWant = new THREE.Vector3();
  const lookWant = new THREE.Vector3();
  const ndcA = new THREE.Vector3();
  const ndcB = new THREE.Vector3();
  let last = performance.now();

  function place(u: number, alt: number) {
    return slerp(fromV, toV, THREE.MathUtils.clamp(u, 0, 1)).multiplyScalar(R + alt);
  }

  function aimJet(pos: THREE.Vector3, next: THREE.Vector3, factor = 0.12) {
    jet.position.copy(pos);
    camera.updateMatrixWorld();
    earthGroup.updateMatrixWorld();
    ndcA.copy(pos);
    ndcB.copy(next);
    earthGroup.localToWorld(ndcA);
    earthGroup.localToWorld(ndcB);
    const dist = Math.max(0.4, camera.position.distanceTo(ndcA));
    const size = dist * factor;
    jet.scale.set(size, size, 1);
    ndcA.project(camera);
    ndcB.project(camera);
    const ang = Math.atan2(ndcB.y - ndcA.y, ndcB.x - ndcA.x);
    const mat = jet.material as THREE.SpriteMaterial;
    mat.rotation = ang - Math.PI / 2;
  }

  const tick = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (opts.mode === "idle") {
      earthGroup.rotation.y = now * 0.00007;
      const ang = now * 0.00018;
      const lat = 18 * Math.sin(now * 0.00012);
      const lng = (ang * 180) / Math.PI;
      const pos = ll(lat, lng, R + 0.18);
      const next = ll(lat, lng + 4, R + 0.18);
      camera.position.lerp(tmp.set(0.4, 1.35, 5.7), 0.04);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      aimJet(pos, next);
    } else if (started) {
      const t = Math.min(1, (now - started) / duration);
      const route =
        t < 0.12
          ? smooth(t / 0.12) * 0.06
          : t > 0.8
            ? 0.9 + 0.1 * smooth((t - 0.8) / 0.2)
            : 0.06 + 0.84 * smooth((t - 0.12) / 0.68);
      const alt = arcAlt(route) + 0.045;
      const pos = place(route, alt);
      const next = place(Math.min(0.995, route + 0.02), alt);

      for (let i = 0; i < N; i += 1) {
        const u = Math.max(0, route - (i / (N - 1)) * 0.14);
        const p = place(u, arcAlt(u));
        trailPos[i * 3] = p.x;
        trailPos[i * 3 + 1] = p.y;
        trailPos[i * 3 + 2] = p.z;
      }
      trailGeo.setDrawRange(0, N);
      (trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      if (pin) {
        const ring = pin.children[2] as THREE.Mesh;
        const s = 1 + Math.sin(now * 0.006) * 0.18;
        ring.scale.set(s, s, 1);
      }

      const mid = slerp(fromV, toV, 0.5).normalize();
      const followU = t < 0.2 ? 0.14 : THREE.MathUtils.clamp(route * 0.5 + 0.22, 0, 1);
      const follow = slerp(fromV, toV, followU).normalize();
      const trackAmt = t < 0.2 ? 0.85 : THREE.MathUtils.clamp((omega - 0.35) / 1.1, 0, 0.55);
      const focus = mid.lerp(follow, trackAmt).normalize();
      const half = Math.min(1.2, omega * 0.5 + 0.48);
      const dist = THREE.MathUtils.clamp((R + 0.15) / Math.max(0.34, Math.cos(half)), 3.15, 5.35);
      camWant.copy(focus.clone().add(new THREE.Vector3(0, 0.16, 0)).normalize()).multiplyScalar(dist);
      lookWant.copy(focus).multiplyScalar(0.08);
      if (t > 0.6) {
        const u = smooth((t - 0.6) / 0.4);
        const destN = toV.clone().normalize();
        const side = new THREE.Vector3().crossVectors(destN, new THREE.Vector3(0, 1, 0));
        if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
        side.normalize();
        camWant.lerp(destN.clone().multiplyScalar(3.15).addScaledVector(side, 0.35).add(new THREE.Vector3(0, 0.42, 0)), u);
        lookWant.lerp(destN.clone().multiplyScalar(R * 0.98), u);
      }
      const k = 1 - Math.exp(-dt * 1.25);
      camera.position.lerp(camWant, k);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookWant);
      aimJet(pos, next, t > 0.72 ? 0.085 : 0.12);

      if (t > 0.86 && !landed) {
        landed = true;
        opts.onPhase?.("land");
      }
      if (t >= 1 && !finished) {
        finished = true;
        window.setTimeout(() => {
          if (!dead) opts.onDone();
        }, reduce ? 80 : 1400);
      }
    }
    renderer.render(scene, camera);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(arm);
    ro.disconnect();
    trailGeo.dispose();
    starGeo.dispose();
    textures.forEach((tex) => tex.dispose());
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

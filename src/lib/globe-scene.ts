import * as THREE from "three";

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
  renderer.toneMappingExposure = 1.2;

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
  const jetMap = loader.load("/globe/jet.png");
  colorMap.colorSpace = THREE.SRGBColorSpace;
  jetMap.colorSpace = THREE.SRGBColorSpace;
  bumpMap.colorSpace = THREE.NoColorSpace;
  colorMap.anisotropy = 8;
  earthMat.map = colorMap;
  earthMat.bumpMap = bumpMap;
  earthMat.bumpScale = 0.035;
  textures.push(colorMap, bumpMap, jetMap);

  const jet = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: jetMap, transparent: true, depthWrite: false }),
  );
  earthGroup.add(jet);

  let borderGeo: THREE.BufferGeometry | null = null;
  void fetch("/globe/countries.json")
    .then((r) => r.json() as Promise<number[][]>)
    .then((rings) => {
      const pos: number[] = [];
      for (const ring of rings) {
        for (let i = 0; i < ring.length - 3; i += 2) {
          const a = ll(ring[i + 1], ring[i], R + 0.012);
          const b = ll(ring[i + 3], ring[i + 2], R + 0.012);
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      borderGeo = new THREE.BufferGeometry();
      borderGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      earthGroup.add(
        new THREE.LineSegments(
          borderGeo,
          new THREE.LineBasicMaterial({
            color: 0xf7f4ee,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
          }),
        ),
      );
    })
    .catch(() => {});

  const arcAlt = (u: number) => 0.04 + Math.sin(Math.PI * u) * 0.16;

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
    earthGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 160, 0.0065, 6, false),
        new THREE.MeshBasicMaterial({ color: 0xff3b2a }),
      ),
    );
    earthGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 80, 0.02, 6, false),
        new THREE.MeshBasicMaterial({
          color: 0xff5a3c,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    const dest = toV.clone().normalize();
    pin = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.062, 48),
      new THREE.MeshBasicMaterial({ color: 0xe23b2b, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
    );
    ring.rotation.x = -Math.PI / 2;
    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff4ea }),
    );
    pearl.position.y = 0.02;
    pin.add(ring, pearl);
    pin.position.copy(dest.clone().multiplyScalar(R + 0.012));
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
  const duration = reduce ? 700 : 6800;
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
    // Nose sits at the top of the texture. +π puts that nose on the route
    // instead of trailing it, which was drawing the jet upside down.
    mat.rotation = ang + Math.PI / 2;
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
      const alt = arcAlt(route) + 0.06;
      const pos = place(route, alt);
      const next = place(Math.min(0.995, route + 0.02), alt);
      if (pin) {
        const ring = pin.children[0] as THREE.Mesh;
        const s = 1 + Math.sin(now * 0.008) * 0.12;
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
      if (t > 0.72) {
        const u = smooth((t - 0.72) / 0.28);
        const destN = toV.clone().normalize();
        camWant.lerp(destN.clone().multiplyScalar(3.7).add(new THREE.Vector3(0, 0.28, 0)), u);
        lookWant.lerp(destN.clone().multiplyScalar(R * 0.9), u);
      }
      const k = 1 - Math.exp(-dt * 2.4);
      camera.position.lerp(camWant, k);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookWant);
      aimJet(pos, next, t > 0.8 ? 0.16 : 0.22);

      if (t > 0.86 && !landed) {
        landed = true;
        opts.onPhase?.("land");
      }
      if (t >= 1 && !finished) {
        finished = true;
        window.setTimeout(() => {
          if (!dead) opts.onDone();
        }, reduce ? 60 : 700);
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
    borderGeo?.dispose();
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

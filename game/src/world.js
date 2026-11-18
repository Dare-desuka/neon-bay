// Neon Bay itself: the street grid, the buildings with lit windows, the
// palms, the beach and the ocean, the sun and the sky. All geometry is
// built from a seeded RNG, so the same seed builds the same city. The
// world also owns collision: building footprints and the road network.

import * as THREE from 'three';
import { BEACH_X0, BLOCK, CITY_X, CITY_Z, PALETTE, ROADS_X, ROADS_Z, SEA_X0, STREET_W } from './config.js';
import { int, pick, range } from './random.js';

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const lit = Math.random() < 0.28;
      c.fillStyle = lit ? '#ffd27a' : '#2a3a4a';
      c.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function waterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#1e7fa8';
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    const y = 8 + i * 13;
    c.beginPath();
    for (let x = 0; x <= 128; x += 8) c.lineTo(x, y + Math.sin(x * 0.2 + i) * 3);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(48, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(rng) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyBottom);
  scene.fog = new THREE.Fog(0xbfd9e8, 220, 700);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1));

  // Sun disc and a few clouds.
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  sunMesh.position.set(180, 150, -260);
  scene.add(sunMesh);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    const puffs = int(rng, 3, 5);
    for (let j = 0; j < puffs; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 12), 10, 8), cloudMat);
      puff.position.set(j * 9 - puffs * 4, range(rng, -2, 2), range(rng, -3, 3));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(range(rng, -260, 260), range(rng, 90, 130), range(rng, -260, 220));
    scene.add(cloud);
  }

  // Ground: sidewalk grey across the city, sand on the east edge.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_X * 2 + 60, CITY_Z * 2 + 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, CITY_Z * 2 + 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X0 + 21, 0.01, 0);
  scene.add(sand);

  const waterTex = waterTexture();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(600, CITY_Z * 2 + 400),
    new THREE.MeshLambertMaterial({ map: waterTex }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X0 + 300, 0.02, 0);
  scene.add(sea);

  // Roads: dark strips along every grid line, with dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 3);
  const dashes = [];
  for (const x of ROADS_X) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET_W, CITY_Z * 2 + 20), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.03, 0);
    scene.add(road);
    for (let z = -CITY_Z; z < CITY_Z; z += 9) dashes.push([x, z]);
  }
  for (const z of ROADS_Z) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_X * 2 + 20, STREET_W), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, z);
    scene.add(road);
    for (let x = -CITY_X; x < CITY_X; x += 9) dashes.push([x, z, true]);
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const rotY = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  dashes.forEach(([x, z, across], i) => {
    m4.compose(new THREE.Vector3(x, 0.05, z), across ? rotY : quat, new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(i, m4);
  });
  scene.add(dashMesh);

  // Buildings: one box per building, heights taller toward the centre.
  const winTex = windowTexture();
  const buildingMats = PALETTE.building.map((color) => new THREE.MeshLambertMaterial({ color, map: winTex }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0); // origin at the base, so scale.y is the height
  const buildings = []; // {minX, maxX, minZ, maxZ, height, cx, cz}
  const blockCenters = [];
  for (let i = 0; i < ROADS_X.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Z.length - 1; j += 1) {
      const cx = (ROADS_X[i] + ROADS_X[i + 1]) / 2;
      const cz = (ROADS_Z[j] + ROADS_Z[j + 1]) / 2;
      blockCenters.push([cx, cz]);
    }
  }
  for (const [cx, cz] of blockCenters) {
    const dist = Math.hypot(cx / CITY_X, cz / CITY_Z);
    const count = rng() < 0.55 ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const w = count === 1 ? BLOCK - 8 : (BLOCK - 10) / 2;
      const d = count === 1 ? BLOCK - 8 : BLOCK - 8;
      const ox = count === 1 ? 0 : (k === 0 ? -w / 2 - 1 : w / 2 + 1);
      const height = Math.round(range(rng, 10, 16) + (1 - dist) * range(rng, 14, 58));
      const mesh = new THREE.Mesh(boxGeo, pick(rng, buildingMats));
      mesh.scale.set(w, height, d);
      mesh.position.set(cx + ox, 0, cz);
      scene.add(mesh);
      // Rooftop box, for a skyline that is not flat.
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6a6f76 }));
      roof.scale.set(w * 0.4, 2, d * 0.4);
      roof.position.set(cx + ox, height, cz);
      scene.add(roof);
      buildings.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height, cx: cx + ox, cz });
    }
  }

  // Palms along the beach and a few on the sidewalks.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const crownGeo = new THREE.ConeGeometry(3.2, 2.2, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  function addPalm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    scene.add(trunk);
    for (let i = 0; i < 3; i += 1) {
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(x, 7.2 + i * 0.4, z);
      crown.scale.set(1, 0.5, 1);
      crown.rotation.y = (i * Math.PI * 2) / 3;
      scene.add(crown);
    }
  }
  for (let z = -CITY_Z; z <= CITY_Z; z += 22) addPalm(BEACH_X0 + 12, z + range(rng, -4, 4));
  for (let i = 0; i < 14; i += 1) {
    const roadX = pick(rng, ROADS_X);
    const z = range(rng, -CITY_Z + 10, CITY_Z - 10);
    addPalm(roadX + STREET_W / 2 + 3, z);
  }

  // Street lights at intersections.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of ROADS_X) {
    for (const z of ROADS_Z) {
      if (rng() > 0.5) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + STREET_W / 2 + 1, 3.5, z + STREET_W / 2 + 1);
      scene.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + STREET_W / 2 + 1, 7.1, z + STREET_W / 2 + 1);
      scene.add(lamp);
    }
  }

  // --- Collision and road helpers -------------------------------------
  function onRoad(x, z, margin = 0) {
    const hw = STREET_W / 2 + margin;
    for (const rx of ROADS_X) if (Math.abs(x - rx) <= hw && Math.abs(z) <= CITY_Z + 10) return true;
    for (const rz of ROADS_Z) if (Math.abs(z - rz) <= hw && Math.abs(x) <= CITY_X + 10) return true;
    return false;
  }

  function nearestRoadPoint(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, z, axis: 'z' }; }
    }
    for (const rz of ROADS_Z) {
      const d = Math.abs(z - rz);
      if (d < bestD) { bestD = d; best = { x, z: rz, axis: 'x' }; }
    }
    return best;
  }

  function nearestIntersection(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_X) {
      for (const rz of ROADS_Z) {
        const d = Math.hypot(x - rx, z - rz);
        if (d < bestD) { bestD = d; best = { x: rx, z: rz }; }
      }
    }
    return best;
  }

  /** Push a circle (x, z, radius) out of every building it overlaps. */
  function resolveCircle(pos, radius) {
    for (const b of buildings) {
      const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest exit.
        const exits = [
          [b.minX - radius - pos.x, 0],
          [b.maxX + radius - pos.x, 0],
          [0, b.minZ - radius - pos.z],
          [0, b.maxZ + radius - pos.z],
        ];
        let bestExit = exits[0];
        let bestLen = Math.abs(bestExit[0]) + Math.abs(bestExit[1]);
        for (const e of exits) {
          const len = Math.abs(e[0]) + Math.abs(e[1]);
          if (len < bestLen) { bestLen = len; bestExit = e; }
        }
        pos.x += bestExit[0];
        pos.z += bestExit[1];
      }
    }
    pos.x = Math.max(-CITY_X - 4, Math.min(BEACH_X0 + 30, pos.x));
    pos.z = Math.max(-CITY_Z - 4, Math.min(CITY_Z + 4, pos.z));
  }

  function randomRoadPoint() {
    if (rng() < 0.5) return { x: pick(rng, ROADS_X), z: range(rng, -CITY_Z + 8, CITY_Z - 8) };
    return { x: range(rng, -CITY_X + 8, CITY_X - 8), z: pick(rng, ROADS_Z) };
  }

  return {
    scene,
    buildings,
    onRoad,
    nearestRoadPoint,
    nearestIntersection,
    resolveCircle,
    randomRoadPoint,
    update(dt, time) {
      waterTex.offset.x = (time * 0.008) % 1;
      waterTex.offset.y = (time * 0.005) % 1;
    },
  };
}

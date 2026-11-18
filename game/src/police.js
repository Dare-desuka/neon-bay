// The law: a wanted level from 0 to 5 stars, police cars that chase and
// ram, and foot cops who chase the player on foot and arrest them. The
// wanted level rises on crimes and falls when the player stays out of
// sight; police spawn at the city edge and drive the roads toward the
// player, turning at intersections toward them.

import * as THREE from 'three';
import { CITY_X, CITY_Z, PALETTE, POLICE_CAR_MAX, WANTED } from './config.js';
import { createCarState } from './vehicles.js';
import { pick, range } from './random.js';

export function createPolice(scene, world, rng) {
  const cars = [];
  const cops = [];
  let wanted = 0;
  let decayTimer = 0;
  let lightTimer = 0;
  let lightsOn = false;

  function spawnCar(x, z) {
    const car = createCarState(x, z, 0, PALETTE.policeCar, true);
    car.speed = 0;
    scene.add(car.mesh);
    cars.push(car);
    return car;
  }

  function spawnCop(x, z) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: PALETTE.copShirt });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x1a2433 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
    body.position.y = 1.15;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
    head.position.y = 1.72;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), pants);
    cap.position.y = 1.92;
    group.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
    legL.position.set(0, 0.35, 0.14);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
    legR.position.set(0, 0.35, -0.14);
    group.add(legR);
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { group, legL, legR, x, z, heading: 0, walkPhase: 0, holdTimer: 0, alive: true };
    cops.push(cop);
    return cop;
  }

  function edgePoint() {
    const side = pick(rng, ['n', 's', 'e', 'w']);
    if (side === 'n') return { x: range(rng, -CITY_X + 20, CITY_X - 20), z: -CITY_Z + 6 };
    if (side === 's') return { x: range(rng, -CITY_X + 20, CITY_X - 20), z: CITY_Z - 6 };
    if (side === 'e') return { x: CITY_X - 6, z: range(rng, -CITY_Z + 20, CITY_Z - 20) };
    return { x: -CITY_X + 6, z: range(rng, -CITY_Z + 20, CITY_Z - 20) };
  }

  function wantedCarCount() {
    return Math.min(POLICE_CAR_MAX, Math.ceil(wanted / 1.5));
  }

  return {
    get wanted() { return wanted; },
    get cars() { return cars; },
    get cops() { return cops; },
    addWanted(n) {
      wanted = Math.max(0, Math.min(5, wanted + n));
      decayTimer = 0;
    },
    setWanted(n) { wanted = Math.max(0, Math.min(5, n)); decayTimer = 0; },
    clear() {
      wanted = 0;
      for (const car of cars) scene.remove(car.mesh);
      cars.length = 0;
      for (const cop of cops) scene.remove(cop.group);
      cops.length = 0;
    },
    /** Distance from the player to the nearest police unit, or Infinity. */
    nearestDistance(px, pz) {
      let best = Infinity;
      for (const car of cars) best = Math.min(best, Math.hypot(car.x - px, car.z - pz));
      for (const cop of cops) best = Math.min(best, Math.hypot(cop.x - px, cop.z - pz));
      return best;
    },
    /**
     * Advance the police. Returns 'arrested' when a foot cop holds the
     * player, else null. `player` is {x, z, inCar, speed}.
     */
    update(dt, player, world) {
      lightTimer += dt;
      if (lightTimer > 0.35) {
        lightTimer = 0;
        lightsOn = !lightsOn;
        for (const car of cars) {
          if (!car.lightR || !car.lightB) continue;
          car.lightR.visible = lightsOn;
          car.lightB.visible = !lightsOn;
        }
      }
      if (wanted === 0) {
        // No heat: the force stands down, cars drive off and despawn.
        for (let i = cars.length - 1; i >= 0; i -= 1) {
          const car = cars[i];
          car.drive(0.5, 0, dt);
          if (Math.abs(car.x) > CITY_X + 40 || Math.abs(car.z) > CITY_Z + 40) {
            scene.remove(car.mesh);
            cars.splice(i, 1);
          }
        }
        for (let i = cops.length - 1; i >= 0; i -= 1) {
          scene.remove(cops[i].group);
          cops.splice(i, 1);
        }
        return null;
      }
      // Spawn police cars up to the wanted count.
      while (cars.length < wantedCarCount()) {
        const p = edgePoint();
        spawnCar(p.x, p.z);
      }
      // On foot with heat 2+: foot cops join the chase.
      if (!player.inCar && wanted >= 2 && cops.length < wanted - 1) {
        const p = { x: player.x + range(rng, -18, 18), z: player.z + range(rng, -18, 18) };
        spawnCop(p.x, p.z);
      }
      // Wanted decays when no unit can see the player.
      const near = this.nearestDistance(player.x, player.z);
      if (near > WANTED.sightRange) {
        decayTimer += dt;
        if (decayTimer >= WANTED.decaySeconds) {
          decayTimer = 0;
          wanted -= 1;
        }
      } else {
        decayTimer = 0;
      }
      // Police cars: road-following pursuit of the player.
      for (const car of cars) {
        const target = world.nearestIntersection(player.x, player.z);
        const dx = target.x - car.x;
        const dz = target.z - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(-dz, dx);
        let diff = wantHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // If the player is close and on the same road, ram straight at them.
        const pdx = player.x - car.x;
        const pdz = player.z - car.z;
        const pdist = Math.hypot(pdx, pdz);
        let steer = Math.max(-1, Math.min(1, diff * 2));
        let throttle = 0.9;
        if (pdist < 25 && Math.abs(diff) < 0.6) {
          steer = Math.max(-1, Math.min(1, (Math.atan2(-pdz, pdx) - car.heading) * 2));
          throttle = 1;
        }
        if (dist < 4) throttle = 0.9; // keep rolling through intersections
        car.drive(throttle, steer, dt);
        world.resolveCircle(car, 1.4);
        // Ram: a police car hitting the player's car hard is a crime too.
        if (player.inCar && pdist < 3.4 && Math.abs(car.speed) > 6) {
          player.rammed = true;
        }
      }
      // Foot cops: run at the player; hold them to arrest.
      for (const cop of cops) {
        if (!cop.alive) continue;
        const dx = player.x - cop.x;
        const dz = player.z - cop.z;
        const d = Math.hypot(dx, dz);
        if (player.inCar) {
          // Cops on foot cannot catch a car: stand their ground.
          continue;
        }
        if (d < 1.4) {
          cop.holdTimer += dt;
          if (cop.holdTimer > 1.2) return 'arrested';
        } else {
          cop.holdTimer = 0;
          const heading = Math.atan2(-dz, dx);
          cop.heading = heading;
          cop.x += Math.cos(heading) * 5.2 * dt;
          cop.z -= Math.sin(heading) * 5.2 * dt;
          world.resolveCircle(cop, 0.4);
          cop.walkPhase += dt * 9;
          const swing = Math.sin(cop.walkPhase) * 0.55;
          cop.legL.rotation.x = swing;
          cop.legR.rotation.x = -swing;
          cop.group.position.set(cop.x, 0, cop.z);
          cop.group.rotation.y = heading;
        }
      }
      return null;
    },
  };
}

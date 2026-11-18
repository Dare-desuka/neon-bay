// Traffic: cars that drive the road grid, plus the parked cars the
// player can steal. A traffic car picks a road, drives its lane, and at
// each intersection chooses to go straight, left or right — never a
// U-turn. Parked cars sit at the kerb until the player (or a mission)
// takes one.

import { CAR, CITY_X, CITY_Z, PALETTE, ROADS_X, ROADS_Z, STREET_W, TRAFFIC_COUNT } from './config.js';
import { createCarState } from './vehicles.js';
import { pick, range } from './random.js';

export function createTraffic(scene, world, rng) {
  const cars = [];
  const parked = [];

  function spawnTrafficCar() {
    const vertical = rng() < 0.5;
    let x;
    let z;
    let heading;
    if (vertical) {
      const roadX = pick(rng, ROADS_X);
      const dir = rng() < 0.5 ? 1 : -1; // +z or -z, right-hand lane
      x = roadX + (dir > 0 ? 4 : -4);
      z = range(rng, -CITY_Z + 10, CITY_Z - 10);
      heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      const roadZ = pick(rng, ROADS_Z);
      const dir = rng() < 0.5 ? 1 : -1; // +x or -x, right-hand lane
      z = roadZ + (dir > 0 ? -4 : 4);
      x = range(rng, -CITY_X + 10, CITY_X - 10);
      heading = dir > 0 ? 0 : Math.PI;
    }
    const car = createCarState(x, z, heading, pick(rng, PALETTE.carColors));
    car.speed = range(rng, 7, 12);
    car.vertical = vertical;
    scene.add(car.mesh);
    return car;
  }

  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(spawnTrafficCar());

  // Parked cars along the kerbs.
  for (let i = 0; i < 10; i += 1) {
    const vertical = rng() < 0.5;
    let x;
    let z;
    let heading;
    if (vertical) {
      x = pick(rng, ROADS_X) + (rng() < 0.5 ? 6.5 : -6.5);
      z = range(rng, -CITY_Z + 20, CITY_Z - 20);
      heading = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      z = pick(rng, ROADS_Z) + (rng() < 0.5 ? 6.5 : -6.5);
      x = range(rng, -CITY_X + 20, CITY_X - 20);
      heading = rng() < 0.5 ? 0 : Math.PI;
    }
    const car = createCarState(x, z, heading, pick(rng, PALETTE.carColors));
    car.parked = true;
    scene.add(car.mesh);
    parked.push(car);
  }

  /** Steer a traffic car along its road; turn at intersections. */
  function updateCar(car, dt) {
    const near = world.nearestIntersection(car.x, car.z);
    const dist = Math.hypot(car.x - near.x, car.z - near.z);
    // At an intersection, pick a new heading: straight, left or right.
    if (dist < 3 && !car.turnedAt) {
      car.turnedAt = `${near.x},${near.z}`;
      const options = [0, Math.PI / 2, -Math.PI / 2];
      const turn = pick(rng, options);
      car.heading += turn;
      // Snap into the new lane, on the right-hand side of the road.
      if (Math.abs(Math.sin(car.heading)) > 0.5) {
        // Now travelling north/south: pick the nearest vertical road.
        const roadX = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
        car.x = roadX + (Math.sin(car.heading) < 0 ? -4 : 4);
        car.vertical = true;
      } else {
        // Now travelling east/west: pick the nearest horizontal road.
        const roadZ = ROADS_Z.reduce((a, b) => (Math.abs(b - car.z) < Math.abs(a - car.z) ? b : a));
        car.z = roadZ + (Math.cos(car.heading) > 0 ? 4 : -4);
        car.vertical = false;
      }
    } else if (dist >= 6) {
      car.turnedAt = null;
    }
    // Slow down for the car ahead.
    let target = range(rng, 8, 12);
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = dx * Math.cos(car.heading) - dz * Math.sin(car.heading);
      const side = Math.abs(dx * Math.sin(car.heading) + dz * Math.cos(car.heading));
      if (ahead > 0 && ahead < 9 && side < 3) { target = 0; break; }
    }
    const throttle = car.speed < target ? 0.6 : -0.4;
    car.drive(throttle, 0, dt);
    // Keep it on the road if the maths drifted.
    if (!world.onRoad(car.x, car.z, 2)) {
      const p = world.nearestRoadPoint(car.x, car.z);
      car.x = p.x;
      car.z = p.z;
    }
  }

  return {
    cars,
    parked,
    update(dt) {
      for (const car of cars) updateCar(car, dt);
    },
    /** Take a parked car out of the parked pool (it is stolen now). */
    steal(parkedCar) {
      const i = parked.indexOf(parkedCar);
      if (i >= 0) parked.splice(i, 1);
    },
    /** The nearest parked car within `range` of a point, or null. */
    nearestParked(x, z, rangeM) {
      let best = null;
      let bestD = rangeM;
      for (const car of parked) {
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best;
    },
    /** The nearest traffic car within `rangeM` of a point, or null. */
    nearestTraffic(x, z, rangeM) {
      let best = null;
      let bestD = rangeM;
      for (const car of cars) {
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best;
    },
    /** Respawn a traffic car that left the city, so the roads stay busy. */
    respawnIfFar(car) {
      if (Math.abs(car.x) > CITY_X + 30 || Math.abs(car.z) > CITY_Z + 30) {
        const fresh = spawnTrafficCar();
        car.setPose(fresh.x, fresh.z, fresh.heading);
        car.speed = fresh.speed;
        scene.remove(fresh.mesh);
      }
    },
  };
}

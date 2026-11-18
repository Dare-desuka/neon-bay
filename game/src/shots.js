// The screenshot scenes behind ?shot=start|drive|chase|mission. Each
// one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { pick } from './random.js';

/**
 * Drive a car along the roads: steer toward a waypoint 60 m along a
 * road from the nearest intersection, and pick a new one on arrival.
 * Slows down for sharp turns so the car stays on the asphalt.
 */
function autodrive(game, dt, rng) {
  const car = game.currentCar;
  if (!car) return;
  if (!game.autoTarget || Math.hypot(car.x - game.autoTarget.x, car.z - game.autoTarget.z) < 8) {
    const near = game.world.nearestIntersection(car.x, car.z);
    const [dx, dz] = pick(rng, [[60, 0], [-60, 0], [0, 60], [0, -60]]);
    game.autoTarget = {
      x: Math.max(-235, Math.min(235, near.x + dx)),
      z: Math.max(-173, Math.min(173, near.z + dz)),
    };
  }
  const t = game.autoTarget;
  const want = Math.atan2(-(t.z - car.z), t.x - car.x);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const throttle = Math.abs(diff) > 1.1 ? 0.35 : 1;
  game.driveCar(throttle, steer, dt);
}

export function stageShot(name, game, rng) {
  const seconds = (s) => Math.floor(s / STEP);
  if (name === 'start') {
    game.setScreen('title');
    game.camera.position.set(70, 60, 150);
    game.camera.lookAt(0, 10, -20);
    for (let i = 0; i < seconds(5); i += 1) game.stepAmbient(STEP);
    return;
  }
  if (name === 'drive') {
    game.startNewGame();
    const car = game.traffic.nearestParked(-31, -100, 60) || game.traffic.parked[0];
    game.warpPlayerTo(car.x + 2, car.z);
    game.enterCar(car);
    for (let i = 0; i < seconds(9); i += 1) {
      autodrive(game, STEP, rng);
      game.stepAmbient(STEP);
      game.updateCamera(STEP);
    }
    game.updateCamera(1);
    return;
  }
  if (name === 'chase') {
    game.startNewGame();
    const car = game.traffic.nearestParked(31, 60, 60) || game.traffic.parked[0];
    game.warpPlayerTo(car.x + 2, car.z);
    game.enterCar(car);
    game.setWanted(3);
    for (let i = 0; i < seconds(11); i += 1) {
      autodrive(game, STEP, rng);
      game.stepAmbient(STEP);
      game.updateCamera(STEP);
    }
    // Show the full three stars even though the heat may have cooled.
    game.setWanted(3);
    game.updateCamera(1);
    return;
  }
  // mission (the default): on foot at the marina pickup, mission 1 live.
  game.startNewGame();
  game.warpPlayerTo(240, 2);
  game.missions.start(0);
  // A few beachgoers near the pickup, so the shot shows pedestrians too.
  game.pedestrians.spawnAt(246, -3);
  game.pedestrians.spawnAt(236, 8);
  game.pedestrians.spawnAt(250, 10);
  game.cameraYaw = 0; // face east, toward the marker and the sea
  game.cameraPitch = -0.12;
  for (let i = 0; i < seconds(3); i += 1) {
    game.stepAmbient(STEP);
    game.updateCamera(STEP);
  }
  game.updateCamera(1);
}

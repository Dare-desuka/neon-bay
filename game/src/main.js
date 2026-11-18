// Boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.

import * as THREE from 'three';
import { CAR, CITY_X, CITY_Z, MONEY, PLAYER, ROADS_X, ROADS_Z, STEP, WANTED } from './config.js';
import { makeRng } from './random.js';
import { createWorld } from './world.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createPlayer } from './player.js';
import { MISSIONS, createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { ACT_ATTACK, ACT_HORN, ACT_INTERACT, ACT_PAUSE, ACT_WEAPON, createInput } from './input.js';
import { clearSave, readSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

export function createGame() {
  const rng = makeRng(seed);
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const world = createWorld(rng);
  const scene = world.scene;
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(40, 40, 80);

  const traffic = createTraffic(scene, world, rng);
  const pedestrians = createPedestrians(scene, world, rng);
  const police = createPolice(scene, world, rng);
  const player = createPlayer(scene);
  const hud = createHud();
  const audio = createAudio();
  const input = createInput(canvas);

  const game = {
    world, scene, camera, renderer, traffic, pedestrians, police, player,
    currentCar: null,
    screen: 'title',
    money: MONEY.start,
    timeOfDay: 9 * 60, // minutes since midnight
    clock: 0,
    cameraYaw: Math.PI * 0.75,
    cameraPitch: -0.18,
    cameraDist: 8,
    shake: 0,
    overReason: '',
    ramCooldown: 0,
    saveExists: readSave() !== null,
    // Missions, with hooks back into the game.
    missions: null,
    setScreen(name) {
      this.screen = name;
      document.getElementById('title-screen').style.display = name === 'title' ? 'flex' : 'none';
      document.getElementById('pause-screen').style.display = name === 'paused' ? 'flex' : 'none';
      document.getElementById('over-screen').style.display = name === 'over' ? 'flex' : 'none';
      document.getElementById('hud').style.display = name === 'play' ? 'block' : 'none';
    },
    warpPlayerTo(x, z) {
      player.setPose(x, z, player.heading);
    },
    setWanted(n) { police.setWanted(n); },
    /** Drive the player's car with throttle (-1..1) and steer (-1..1). */
    driveCar(throttle, steer, dt) {
      if (!this.currentCar) return;
      this.currentCar.drive(throttle, steer, dt);
      world.resolveCircle(this.currentCar, 1.6);
      player.x = this.currentCar.x;
      player.z = this.currentCar.z;
      player.heading = this.currentCar.heading;
      this.carHits(dt);
    },
    enterCar(car) {
      if (this.currentCar) return false;
      this.currentCar = car;
      player.group.visible = false;
      if (!car.stolen) {
        car.stolen = true;
        police.addWanted(WANTED.stealCar);
      }
      traffic.steal(car);
      const i = traffic.cars.indexOf(car);
      if (i >= 0) traffic.cars.splice(i, 1);
      this.missions.onEnterCar();
      audio.horn();
      return true;
    },
    exitCar() {
      if (!this.currentCar) return;
      const car = this.currentCar;
      car.speed = 0;
      this.currentCar = null;
      player.group.visible = true;
      const side = 2.2;
      player.setPose(
        car.x + Math.sin(car.heading) * side,
        car.z + Math.cos(car.heading) * side,
        car.heading,
      );
      if (!traffic.parked.includes(car)) traffic.parked.push(car);
    },
    /** Collisions while driving: traffic, pedestrians, buildings. */
    carHits(dt) {
      const car = this.currentCar;
      if (!car) return;
      for (const other of traffic.cars) {
        const d = Math.hypot(other.x - car.x, other.z - car.z);
        if (d < 3.6 && d > 0.01) {
          const push = (3.6 - d) / 2;
          const nx = (car.x - other.x) / d;
          const nz = (car.z - other.z) / d;
          car.x += nx * push;
          car.z += nz * push;
          other.x -= nx * push;
          other.z -= nz * push;
          car.speed *= 0.6;
          other.speed *= 0.6;
        }
      }
      const ped = pedestrians.nearest(car.x, car.z, 2.6);
      if (ped && Math.abs(car.speed) > 3) {
        pedestrians.remove(ped);
        police.addWanted(WANTED.hitPed);
        car.speed *= 0.7;
        this.shake = 0.4;
      }
      for (const cop of police.cars) {
        const d = Math.hypot(cop.x - car.x, cop.z - car.z);
        if (d < 3.6 && Math.abs(car.speed) > 5 && this.ramCooldown <= 0) {
          police.addWanted(WANTED.ramPolice);
          this.ramCooldown = 2;
          car.speed *= 0.5;
        }
      }
    },
    /** Advance the ambient world one step (traffic, peds, police, clock). */
    stepAmbient(dt) {
      if (this.ramCooldown > 0) this.ramCooldown -= dt;
      this.clock += dt;
      this.timeOfDay = (this.timeOfDay + dt / 2) % (24 * 60);
      world.update(dt, this.clock);
      traffic.update(dt);
      const danger = this.currentCar
        ? { x: this.currentCar.x, z: this.currentCar.z, speed: Math.abs(this.currentCar.speed) }
        : { x: player.x, z: player.z, speed: 0 };
      pedestrians.update(dt, danger.speed > 4 || this.shotFired ? danger : null);
      const playerState = {
        x: player.x, z: player.z, inCar: !!this.currentCar, speed: this.currentCar ? this.currentCar.speed : 0,
        rammed: false,
      };
      const arrested = police.update(dt, playerState, world);
      if (playerState.rammed) this.hurtPlayer(4);
      if (arrested === 'arrested') this.gameOver('BUSTED');
      this.missions.update(dt, {
        player, inCar: !!this.currentCar, police, world,
        hurtPlayer: (n) => this.hurtPlayer(n),
      }, this.clock);
      audio.setEngine(this.currentCar ? Math.abs(this.currentCar.speed) / CAR.maxSpeed : 0, !!this.currentCar);
      audio.setSiren(police.wanted > 0 && police.nearestDistance(player.x, player.z) < 70, dt);
    },
    hurtPlayer(amount) {
      if (player.hurt(amount)) {
        this.shake = 0.5;
        if (player.health <= 0) this.gameOver('WASTED');
      }
    },
    gameOver(reason) {
      if (this.screen !== 'play') return;
      this.overReason = reason;
      const fine = reason === 'BUSTED' ? MONEY.arrestFine : 100;
      this.money = Math.max(0, this.money - fine);
      audio.busted();
      police.clear();
      if (this.currentCar) this.exitCar();
      player.health = PLAYER.health;
      document.getElementById('over-title').textContent = reason;
      document.getElementById('over-text').textContent =
        reason === 'BUSTED'
          ? `The Neon Bay police caught you. You paid $${fine} in fines.`
          : `You woke up at the hospital, $${fine} lighter.`;
      this.setScreen('over');
      this.saveGame();
    },
    startNewGame() {
      this.money = MONEY.start;
      player.health = PLAYER.health;
      player.pistolUnlocked = false;
      player.pistolEquipped = false;
      player.gun.visible = false;
      police.clear();
      player.setPose(0, 0, Math.PI / 2);
      this.currentCar = null;
      player.group.visible = true;
      this.missions.start(0);
      this.setScreen('play');
      this.saveGame();
    },
    continueGame() {
      const save = readSave();
      if (!save) return this.startNewGame();
      this.money = save.money;
      player.health = save.health;
      player.pistolUnlocked = !!save.pistol;
      player.pistolEquipped = false;
      player.gun.visible = false;
      police.clear();
      player.setPose(save.x, save.z, save.heading);
      this.currentCar = null;
      player.group.visible = true;
      if (save.mission >= MISSIONS.length) this.missions.setFreeRoam();
      else this.missions.start(save.mission);
      this.setScreen('play');
    },
    saveGame() {
      writeSave({
        mission: this.missions.state.index,
        money: this.money,
        health: player.health,
        x: player.x,
        z: player.z,
        heading: player.heading,
        pistol: player.pistolUnlocked,
      });
    },
    /** Place the camera behind the player (or the car) and look ahead. */
    updateCamera(dt) {
      const mouse = input.takeMouse();
      this.cameraYaw -= mouse.dx * 0.004;
      this.cameraPitch = Math.max(-0.6, Math.min(0.35, this.cameraPitch - mouse.dy * 0.003));
      const focus = this.currentCar || player;
      const heading = this.currentCar ? this.currentCar.heading : this.cameraYaw;
      // In a car the camera trails the car; on foot it orbits freely.
      const yaw = this.currentCar ? heading : this.cameraYaw;
      const dist = this.currentCar ? 11 : 8;
      const height = this.currentCar ? 4.5 : 3.2;
      const tx = focus.x - Math.cos(yaw) * dist;
      const tz = focus.z + Math.sin(yaw) * dist;
      const lerp = Math.min(1, dt * 6);
      camera.position.x += (tx - camera.position.x) * lerp;
      camera.position.y += (height - camera.position.y) * lerp;
      camera.position.z += (tz - camera.position.z) * lerp;
      let sx = 0;
      let sy = 0;
      if (this.shake > 0) {
        this.shake -= dt;
        sx = (Math.random() - 0.5) * this.shake * 0.6;
        sy = (Math.random() - 0.5) * this.shake * 0.6;
      }
      camera.lookAt(focus.x + sx, 1.6 + sy, focus.z);
    },
    /** Punch or shoot toward the centre of the screen. */
    attack() {
      if (this.currentCar) return;
      if (player.pistolEquipped) {
        if (!player.canShoot()) return;
        player.shoot();
        audio.shoot();
        this.shotFired = true;
        window.setTimeout(() => { this.shotFired = false; }, 500);
        // Hitscan: the nearest target near the camera's centre line.
        const origin = camera.position.clone();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const targets = [];
        for (const thug of this.missions.thugs) if (thug.alive) targets.push({ x: thug.x, z: thug.z, y: 1.2, r: 0.9, kind: 'thug', ref: thug });
        for (const cop of police.cops) if (cop.alive) targets.push({ x: cop.x, z: cop.z, y: 1.2, r: 0.9, kind: 'cop', ref: cop });
        for (const ped of pedestrians.people) if (ped.alive) targets.push({ x: ped.x, z: ped.z, y: 1.2, r: 0.9, kind: 'ped', ref: ped });
        let best = null;
        let bestD = PLAYER.pistolRange;
        for (const t of targets) {
          const vx = t.x - origin.x;
          const vy = t.y - origin.y;
          const vz = t.z - origin.z;
          const along = vx * dir.x + vy * dir.y + vz * dir.z;
          if (along < 1 || along > bestD) continue;
          const px = vx - dir.x * along;
          const py = vy - dir.y * along;
          const pz = vz - dir.z * along;
          const off = Math.sqrt(px * px + py * py + pz * pz);
          if (off < t.r + along * 0.02) { bestD = along; best = t; }
        }
        if (best) {
          this.tracer(origin, new THREE.Vector3(best.x, best.y, best.z));
          if (best.kind === 'thug') {
            if (this.missions.damageThug(best.ref, PLAYER.pistolDamage)) audio.pickup();
          } else if (best.kind === 'cop') {
            best.ref.alive = false;
            scene.remove(best.ref.group);
            police.cops.splice(police.cops.indexOf(best.ref), 1);
            police.addWanted(WANTED.shoot);
          } else {
            pedestrians.remove(best.ref);
            police.addWanted(WANTED.shoot);
          }
        } else {
          this.tracer(origin, origin.clone().add(dir.clone().multiplyScalar(50)));
        }
      } else {
        if (!player.canPunch()) return;
        player.punch();
        audio.punch();
        const fx = Math.cos(player.heading);
        const fz = -Math.sin(player.heading);
        const hit = (list, onHit) => {
          for (const t of list) {
            if (t.alive === false) continue;
            const dx = t.x - player.x;
            const dz = t.z - player.z;
            const d = Math.hypot(dx, dz);
            if (d < PLAYER.punchRange && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
              onHit(t);
              return true;
            }
          }
          return false;
        };
        if (hit(this.missions.thugs, (t) => this.missions.damageThug(t, PLAYER.punchDamage))) return;
        if (hit(police.cops, (t) => {
          t.alive = false;
          scene.remove(t.group);
          police.cops.splice(police.cops.indexOf(t), 1);
          police.addWanted(WANTED.shoot);
        })) return;
        hit(pedestrians.people, (t) => {
          pedestrians.remove(t);
          police.addWanted(WANTED.hitPed);
        });
      }
    },
    tracer(from, to) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
      scene.add(line);
      window.setTimeout(() => { scene.remove(line); geo.dispose(); }, 70);
    },
    /** One fixed step of play with the current input. */
    step(dt) {
      if (this.screen !== 'play') return;
      const actions = input.takeActions();
      if (actions & ACT_PAUSE) {
        this.saveGame();
        this.setScreen('paused');
        return;
      }
      if (actions & ACT_WEAPON) player.toggleWeapon();
      if (actions & ACT_HORN && this.currentCar) audio.horn();
      if (actions & ACT_ATTACK) this.attack();
      if (actions & ACT_INTERACT) {
        if (this.currentCar) this.exitCar();
        else {
          const parked = traffic.nearestParked(player.x, player.z, 4);
          const moving = traffic.nearestTraffic(player.x, player.z, 4);
          const car = parked || (moving && Math.abs(moving.speed) < 2 ? moving : null);
          if (car) this.enterCar(car);
        }
      }
      // Movement: WASD relative to the camera yaw.
      const fwd = input.forward();
      const strafe = input.strafe();
      if (this.currentCar) {
        const throttle = fwd;
        const steer = -strafe;
        this.driveCar(throttle, steer, dt);
      } else {
        const cy = this.cameraYaw;
        const fx = Math.cos(cy) * fwd + Math.sin(cy) * strafe;
        const fz = -Math.sin(cy) * fwd + Math.cos(cy) * strafe;
        player.move(fx, fz, input.run(), dt, world);
        // A traffic car can run the player over.
        for (const car of traffic.cars) {
          const d = Math.hypot(car.x - player.x, car.z - player.z);
          if (d < 2.1 && Math.abs(car.speed) > 2) {
            this.hurtPlayer(15);
            player.x += (player.x - car.x) * 0.8;
            player.z += (player.z - car.z) * 0.8;
            car.speed *= 0.4;
          }
        }
      }
      this.stepAmbient(dt);
      this.updateCamera(dt);
      this.updateHud();
    },
    updateHud() {
      const mark = this.missions.marker();
      const dist = mark ? Math.round(Math.hypot(player.x - mark.x, player.z - mark.z)) : 0;
      const hh = Math.floor(this.timeOfDay / 60);
      const mm = Math.floor(this.timeOfDay % 60);
      hud.update({
        health: player.health,
        wanted: police.wanted,
        money: this.money,
        clock: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
        objective: this.missions.objectiveText(),
        objectiveDist: mark ? dist + ' m' : '',
        inCar: !!this.currentCar,
        speed: this.currentCar ? this.currentCar.speed : 0,
        subtitle: this.missions.state.subtitle,
        hint: this.missions.state.hint,
        pistolEquipped: player.pistolEquipped,
        time: this.clock,
        roadsX: ROADS_X,
        roadsZ: ROADS_Z,
        marker: mark,
        traffic: traffic.cars,
        police: [...police.cars, ...police.cops],
        player: { x: player.x, z: player.z, heading: this.currentCar ? this.currentCar.heading : player.heading },
      });
    },
    render() {
      renderer.render(scene, camera);
    },
  };

  // Missions with their hooks.
  game.missions = createMissions(scene, rng, {
    onObjective: () => {},
    onMoney: (amount) => { game.money += amount; },
    onCash: () => audio.cash(),
    onMissionComplete: (mission) => {
      game.saveGame();
      if (game.missions.state.index >= MISSIONS.length) {
        // All four done: free roam, the city is yours.
      } else {
        window.setTimeout(() => {
          if (game.screen === 'play') game.missions.start(game.missions.state.index);
        }, 9000);
      }
    },
    onMissionFailed: (reason) => {
      document.getElementById('over-title').textContent = 'MISSION FAILED';
      document.getElementById('over-text').textContent = reason + ' Try again — the job is still open.';
      game.setScreen('over');
      game.overReason = 'FAILED';
    },
    onPistolUnlocked: () => {
      player.pistolUnlocked = true;
      game.missions.state.subtitleQueue.push({ speaker: 'Marnie', text: 'Pistol unlocked — press Q to draw it.', dur: 4 });
    },
    onPickup: () => audio.pickup(),
    onWanted: (n) => police.setWanted(n),
  });

  // Buttons.
  const $ = (id) => document.getElementById(id);
  $('new-game').addEventListener('click', () => {
    audio.start();
    game.startNewGame();
  });
  $('continue-game').addEventListener('click', () => {
    audio.start();
    game.continueGame();
  });
  $('resume').addEventListener('click', () => game.setScreen('play'));
  $('save-quit').addEventListener('click', () => {
    game.saveGame();
    game.setScreen('title');
    $('continue-game').style.display = 'inline-block';
  });
  $('restart').addEventListener('click', () => game.startNewGame());
  $('quit-title').addEventListener('click', () => {
    game.saveGame();
    game.setScreen('title');
    $('continue-game').style.display = 'inline-block';
  });
  $('retry').addEventListener('click', () => {
    if (game.overReason === 'FAILED') {
      player.health = PLAYER.health;
      police.clear();
      player.setPose(0, 0, Math.PI / 2);
      if (game.currentCar) game.exitCar();
      game.missions.start(game.missions.state.index);
      game.setScreen('play');
    } else {
      player.health = PLAYER.health;
      police.clear();
      player.setPose(0, 0, Math.PI / 2);
      if (game.currentCar) game.exitCar();
      game.setScreen('play');
    }
  });
  $('over-title-btn').addEventListener('click', () => {
    game.saveGame();
    game.setScreen('title');
  });
  $('music-toggle').addEventListener('click', () => {
    const on = $('music-toggle').textContent.includes('ON');
    audio.setMusic(!on);
    $('music-toggle').textContent = 'Music: ' + (!on ? 'ON' : 'OFF');
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) $('music-toggle').click();
  });
  if (!game.saveExists) $('continue-game').style.display = 'none';
  $('title-hint').textContent = game.saveExists ? 'Save found — Continue picks up where you left off.' : 'New to Neon Bay? Start a new game.';

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.saveGame();
      game.setScreen('paused');
    }
  });

  return game;
}

function runShot(name) {
  const game = createGame();
  stageShot(name, game, makeRng(seed));
  game.updateHud();
  game.render();
  // Paint twice so the first frame is not a half-drawn one.
  requestAnimationFrame(() => {
    game.render();
    window.__shotReady = true;
  });
}

function runGame() {
  const game = createGame();
  window.__neonBay = game; // debug handle for automated playtests
  game.setScreen('title');
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && game.screen === 'play') {
      game.step(STEP);
      accumulator -= STEP;
    }
    if (game.screen === 'title') {
      // The city lives behind the title: traffic and pedestrians move.
      while (accumulator >= STEP) {
        game.stepAmbient(STEP);
        accumulator -= STEP;
      }
      game.updateCamera(STEP);
    } else {
      accumulator = 0;
    }
    if (game.screen === 'paused' || game.screen === 'over') game.updateHud();
    game.render();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

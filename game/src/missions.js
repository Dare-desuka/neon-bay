// The story: four chained missions for Rex, a newcomer in Neon Bay
// working for the fixer Marnie Voss. Each mission is a list of steps —
// walk somewhere, steal a car, lose the cops, drive a getaway, defend a
// turf — with an objective marker, on-screen text and dialogue lines.
// The manager owns the marker beacon and the turf-defense thugs.

import * as THREE from 'three';
import { MONEY } from './config.js';
import { pick, range } from './random.js';

export const MISSIONS = [
  {
    name: 'The Package',
    reward: MONEY.mission1,
    intro: [
      ['Marnie', 'Rex. New in town, huh? First job is simple.'],
      ['Marnie', 'A package is waiting at the marina, east end of the beach.'],
      ['Marnie', 'Pick it up and bring it to my garage. No trouble, no cops.'],
    ],
    steps: [
      { type: 'goto', x: 252, z: 0, radius: 4, text: 'Pick up the package at the marina' },
      { type: 'goto', x: -31, z: 31, radius: 5, text: 'Bring the package to the garage' },
    ],
    complete: [
      ['Marnie', 'Clean. Here is your pay — and a pistol. You will need it.'],
    ],
  },
  {
    name: 'Hot Wheels',
    reward: MONEY.mission2,
    intro: [
      ['Marnie', 'I need a car that cannot be traced. Any car. Steal one.'],
      ['Marnie', 'Bring it to the chop shop, north-west corner.'],
      ['Marnie', 'Stealing brings heat — lose the cops before you arrive.'],
    ],
    steps: [
      { type: 'enterCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'driveTo', x: -217, z: -155, radius: 6, needWanted0: true, text: 'Get to the chop shop — lose the cops first' },
    ],
    complete: [
      ['Marnie', 'Nice ride. The plates are already gone.'],
    ],
  },
  {
    name: 'The Getaway',
    reward: MONEY.mission3,
    intro: [
      ['Vic', 'Rex, my friend! I am at the bank, and the cops know my face.'],
      ['Vic', 'Pick me up in a car, then drive us to the safehouse, south-east.'],
      ['Vic', 'Be quick. And do not stop for anyone.'],
    ],
    steps: [
      { type: 'driveTo', x: 31, z: -31, radius: 6, text: 'Drive to the bank' },
      { type: 'pickup', x: 31, z: -31, radius: 4, text: 'Pick up Vic (drive close to him)' },
      { type: 'timedDrive', x: 217, z: 155, radius: 6, seconds: 150, text: 'Drive Vic to the safehouse — fast!' },
    ],
    complete: [
      ['Vic', 'We made it! You drive like the bay itself is on fire.'],
    ],
  },
  {
    name: 'Turf War',
    reward: MONEY.mission4,
    intro: [
      ['Marnie', 'The Red Dogs think the west side is theirs. It is ours.'],
      ['Marnie', 'Go to the turf and hold it. They will come in waves.'],
      ['Marnie', 'Finish this and Neon Bay knows your name.'],
    ],
    steps: [
      { type: 'goto', x: -217, z: 93, radius: 6, text: 'Go to the turf on the west side' },
      { type: 'defend', x: -217, z: 93, radius: 18, waves: 3, perWave: 4, text: 'Defend the turf — beat back the Red Dogs' },
    ],
    complete: [
      ['Marnie', 'The west side is yours, Rex. Welcome to Neon Bay.'],
    ],
  },
];

function buildThug(scene, rng, x, z) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x7a1f3d });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b98a, 0xc98d5f]) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.36), shirt);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.75;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(0, 0.36, 0.15);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legR.position.set(0, 0.36, -0.15);
  group.add(legR);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group, legL, legR, x, z, health: 50, alive: true, walkPhase: rng() * 6,
    punchTimer: 0, hitTimer: 0,
  };
}

export function createMissions(scene, rng, hooks) {
  // The objective beacon: a glowing pillar and a ring on the ground.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  beacon.visible = false;
  ring.visible = false;
  scene.add(beacon);
  scene.add(ring);

  const state = {
    index: 0,
    step: 0,
    active: false,
    done: false,
    subtitle: null, // {speaker, text, until}
    subtitleQueue: [],
    timer: 0,
    timerLimit: 0,
    wave: 0,
    waveTimer: 0,
    thugs: [],
    passenger: null,
    hint: '',
    hintUntil: 0,
  };

  function showSubtitle(speaker, text, dur = 4) {
    state.subtitleQueue.push({ speaker, text, dur });
  }

  function startMission(index) {
    state.index = index;
    state.step = 0;
    state.active = true;
    state.done = false;
    state.timer = 0;
    state.timerLimit = 0;
    state.wave = 0;
    state.thugs = [];
    state.passenger = null;
    // A new job starts clean: the heat from the last one has died down.
    hooks.onWanted(0);
    const mission = MISSIONS[index];
    for (const line of mission.intro) showSubtitle(line[0], line[1], 4.5);
    hooks.onObjective(mission.steps[0].text);
  }

  function currentStep() {
    const mission = MISSIONS[state.index];
    return mission ? mission.steps[state.step] : null;
  }

  function advance() {
    const mission = MISSIONS[state.index];
    state.step += 1;
    state.timer = 0;
    state.timerLimit = 0;
    if (state.step >= mission.steps.length) {
      // Mission complete: move the index on to the next mission
      // (or past the last one, which means free roam).
      const completedIndex = state.index;
      state.index += 1;
      state.active = false;
      state.done = true;
      hooks.onMoney(mission.reward);
      hooks.onCash();
      for (const line of mission.complete) showSubtitle(line[0], line[1], 4.5);
      hooks.onMissionComplete(mission);
      if (completedIndex === 0) hooks.onPistolUnlocked();
      return;
    }
    const step = mission.steps[state.step];
    if (step.type === 'timedDrive') {
      state.timerLimit = step.seconds;
      state.timer = step.seconds;
      hooks.onWanted(2);
    }
    hooks.onObjective(step.text);
  }

  function fail(reason) {
    if (!state.active) return;
    state.active = false;
    for (const thug of state.thugs) scene.remove(thug.group);
    state.thugs = [];
    if (state.passenger) { scene.remove(state.passenger.group); state.passenger = null; }
    hooks.onMissionFailed(reason);
  }

  function spawnWave(centerX, centerZ, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = range(rng, 0, Math.PI * 2);
      const dist = range(rng, 14, 20);
      const thug = buildThug(scene, rng, centerX + Math.cos(angle) * dist, centerZ + Math.sin(angle) * dist);
      state.thugs.push(thug);
    }
    state.wave += 1;
  }

  return {
    state,
    start: startMission,
    /** All missions done: free roam, no active mission. */
    setFreeRoam() {
      state.index = MISSIONS.length;
      state.step = 0;
      state.active = false;
      state.done = true;
    },
    currentStep,
    marker() {
      const step = currentStep();
      if (!state.active || !step || step.x === undefined) return null;
      return { x: step.x, z: step.z, radius: step.radius };
    },
    /** The step's objective text, or the mission name when idle. */
    objectiveText() {
      if (!state.active) {
        if (state.index >= MISSIONS.length) return 'Neon Bay is yours — free roam';
        return 'Press E near the marker to start: ' + MISSIONS[state.index].name;
      }
      const step = currentStep();
      return step ? step.text : '';
    },
    missionName() {
      return state.index < MISSIONS.length ? MISSIONS[state.index].name : 'Free Roam';
    },
    fail,
    /** Called when the player enters a car (for the steal-a-car step). */
    onEnterCar() {
      if (!state.active) return;
      const step = currentStep();
      if (step && step.type === 'enterCar') advance();
    },
    /** Called when the player picks up the passenger in mission 3. */
    onPassengerPickup() {
      if (!state.active) return;
      const step = currentStep();
      if (step && step.type === 'pickup') {
        if (state.passenger) { scene.remove(state.passenger.group); state.passenger = null; }
        advance();
      }
    },
    update(dt, ctx, time) {
      // Subtitle queue.
      if (!state.subtitle && state.subtitleQueue.length > 0) {
        const next = state.subtitleQueue.shift();
        state.subtitle = { ...next, until: time + next.dur };
      }
      if (state.subtitle && time > state.subtitle.until) state.subtitle = null;
      if (state.hint && time > state.hintUntil) state.hint = '';

      // Beacon follows the current step's marker.
      const mark = this.marker();
      if (mark) {
        beacon.visible = true;
        ring.visible = true;
        beacon.position.set(mark.x, 30, mark.z);
        ring.position.set(mark.x, 0.06, mark.z);
        const pulse = 1 + Math.sin(time * 3) * 0.12;
        ring.scale.set(pulse, pulse, 1);
      } else {
        beacon.visible = false;
        ring.visible = false;
      }

      if (!state.active) return;
      const step = currentStep();
      if (!step) return;
      const px = ctx.player.x;
      const pz = ctx.player.z;

      if (step.type === 'goto' || step.type === 'driveTo') {
        const d = Math.hypot(px - step.x, pz - step.z);
        if (d < step.radius) {
          if (step.needWanted0 && ctx.police.wanted > 0) {
            if (!state.hint) {
              state.hint = 'Too hot — lose the cops first!';
              state.hintUntil = time + 3;
            }
          } else {
            hooks.onPickup();
            advance();
          }
        }
      } else if (step.type === 'pickup') {
        // Vic waits at the bank; drive close in a car to pick him up.
        if (!state.passenger) {
          const built = buildThug(scene, rng, step.x + 3, step.z + 2);
          built.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0x2c6fd3 });
          state.passenger = built;
        }
        const d = Math.hypot(px - step.x, pz - step.z);
        if (ctx.inCar && d < step.radius) {
          showSubtitle('Vic', 'That is my ride! Go, go, go!', 3.5);
          this.onPassengerPickup();
        }
      } else if (step.type === 'timedDrive') {
        state.timer -= dt;
        if (state.timer <= 0) {
          fail('Too slow — Vic missed his window.');
          return;
        }
        const d = Math.hypot(px - step.x, pz - step.z);
        if (d < step.radius) {
          hooks.onPickup();
          advance();
        }
      } else if (step.type === 'defend') {
        // Waves of thugs rush the player.
        if (state.thugs.length === 0 && state.wave < step.waves) {
          state.waveTimer -= dt;
          if (state.waveTimer <= 0) {
            spawnWave(step.x, step.z, step.perWave);
            state.waveTimer = 2.5;
            showSubtitle('Red Dogs', 'This turf is ours, outsider!', 3);
          }
        } else if (state.thugs.length === 0 && state.wave >= step.waves) {
          advance();
        }
        // Thugs chase and punch the player.
        for (const thug of state.thugs) {
          if (!thug.alive) continue;
          const dx = px - thug.x;
          const dz = pz - thug.z;
          const d = Math.hypot(dx, dz);
          if (thug.hitTimer > 0) thug.hitTimer -= dt;
          if (thug.punchTimer > 0) thug.punchTimer -= dt;
          if (d > 1.6) {
            const heading = Math.atan2(-dz, dx);
            thug.x += Math.cos(heading) * 4.6 * dt;
            thug.z -= Math.sin(heading) * 4.6 * dt;
            thug.walkPhase += dt * 9;
            const swing = Math.sin(thug.walkPhase) * 0.55;
            thug.legL.rotation.x = swing;
            thug.legR.rotation.x = -swing;
            thug.group.position.set(thug.x, 0, thug.z);
            thug.group.rotation.y = heading;
          } else if (thug.punchTimer <= 0) {
            thug.punchTimer = 1.1;
            ctx.hurtPlayer(9);
          }
        }
      }
    },
    /** Damage a thug (punch or bullet); returns true if it died. */
    damageThug(thug, amount) {
      if (!thug.alive) return false;
      thug.health -= amount;
      thug.hitTimer = 0.15;
      if (thug.health <= 0) {
        thug.alive = false;
        scene.remove(thug.group);
        state.thugs = state.thugs.filter((t) => t !== thug);
        return true;
      }
      return false;
    },
    get thugs() { return state.thugs; },
  };
}

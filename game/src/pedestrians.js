// Pedestrians: low-poly people strolling the sidewalks. They walk a
// block edge, turn at the corners, and run away from a speeding car, a
// punch or a gunshot. Hitting one is a crime the police notice.

import * as THREE from 'three';
import { CITY_X, CITY_Z, PALETTE, PED_COUNT } from './config.js';
import { pick, range } from './random.js';

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf2c9a0];
const SHIRTS = [0x4a90d9, 0xe8e8e8, 0x37b24d, 0xf2c230, 0xef7d1a, 0x8e44ad, 0x20b2aa];

function buildPerson(rng, shirtColor) {
  const group = new THREE.Group();
  const skin = pick(rng, SKINS);
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  head.position.y = 1.72;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pantsMat);
  legL.position.set(0, 0.35, 0.14);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pantsMat);
  legR.position.set(0, 0.35, -0.14);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), shirt);
  armL.position.set(0, 1.15, 0.26);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), shirt);
  armR.position.set(0, 1.15, -0.26);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function createPedestrians(scene, world, rng) {
  const people = [];

  function spawnPerson(x, z) {
    const built = buildPerson(rng, pick(rng, SHIRTS));
    built.group.position.set(x, 0, z);
    scene.add(built.group);
    const heading = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const person = {
      ...built,
      x, z, heading,
      speed: range(rng, 0.9, 1.6),
      walkPhase: rng() * Math.PI * 2,
      flee: 0, // seconds left of fleeing
      alive: true,
      update(dt, danger) {
        if (!this.alive) return;
        // Run from danger: a fast car, a punch or a shot nearby.
        if (danger && Math.hypot(danger.x - this.x, danger.z - this.z) < 12) {
          this.flee = 2.5;
        }
        let speed = this.speed;
        let heading = this.heading;
        if (this.flee > 0) {
          this.flee -= dt;
          speed = 4.2;
          if (danger) heading = Math.atan2(-(danger.z - this.z), danger.x - this.x);
        } else if (rng() < dt * 0.08) {
          heading += pick(rng, [Math.PI / 2, -Math.PI / 2]);
        }
        this.heading = heading;
        this.x += Math.cos(heading) * speed * dt;
        this.z -= Math.sin(heading) * speed * dt;
        // Stay inside the city and off the roads where possible.
        if (Math.abs(this.x) > CITY_X + 4 || Math.abs(this.z) > CITY_Z + 4) {
          this.heading += Math.PI;
          this.x = Math.max(-CITY_X - 4, Math.min(CITY_X + 4, this.x));
          this.z = Math.max(-CITY_Z - 4, Math.min(CITY_Z + 4, this.z));
        }
        world.resolveCircle(this, 0.4);
        this.walkPhase += dt * speed * 3;
        const swing = Math.sin(this.walkPhase) * 0.5;
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
        this.armL.rotation.x = -swing * 0.7;
        this.armR.rotation.x = swing * 0.7;
        this.group.position.set(this.x, 0, this.z);
        this.group.rotation.y = heading;
      },
    };
    return person;
  }

  for (let i = 0; i < PED_COUNT; i += 1) {
    const p = world.randomRoadPoint();
    // Pedestrians walk on the sidewalk, just off the road.
    const x = p.x + range(rng, -10, 10);
    const z = p.z + range(rng, -10, 10);
    people.push(spawnPerson(x, z));
  }

  return {
    people,
    spawnAt(x, z) {
      const person = spawnPerson(x, z);
      people.push(person);
      return person;
    },
    update(dt, danger) {
      for (const person of people) person.update(dt, danger);
    },
    /** The nearest living pedestrian within rangeM of a point, or null. */
    nearest(x, z, rangeM) {
      let best = null;
      let bestD = rangeM;
      for (const person of people) {
        if (!person.alive) continue;
        const d = Math.hypot(person.x - x, person.z - z);
        if (d < bestD) { bestD = d; best = person; }
      }
      return best;
    },
    /** Remove a person from the scene (run over, or shot). */
    remove(person) {
      person.alive = false;
      scene.remove(person.group);
    },
  };
}

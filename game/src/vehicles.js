// Cars: one low-poly model builder and the arcade driving model shared
// by the player's car, the traffic and the police. A car is a group with
// a body, a cabin, four wheels and lights; its state is a position, a
// heading, a speed and a steering angle.

import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';

const bodyGeo = new THREE.BoxGeometry(CAR.length, 0.75, CAR.width);
const cabinGeo = new THREE.BoxGeometry(CAR.length * 0.45, 0.65, CAR.width * 0.82);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const lightGeo = new THREE.BoxGeometry(0.12, 0.18, 0.3);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2b3a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const bodyMats = new Map();

function bodyMaterial(color) {
  if (!bodyMats.has(color)) bodyMats.set(color, new THREE.MeshLambertMaterial({ color }));
  return bodyMats.get(color);
}

/** Build a car mesh. `police` adds a white body and a light bar. */
export function buildCarMesh(color, police = false) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, bodyMaterial(police ? PALETTE.policeCar : color));
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(-0.25, 1.2, 0);
  group.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[1.4, 0.85], [1.4, -0.85], [-1.4, 0.85], [-1.4, -0.85]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  for (const wz of [0.6, -0.6]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(CAR.length / 2 + 0.02, 0.6, wz);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(-CAR.length / 2 - 0.02, 0.6, wz);
    group.add(tail);
  }
  let lightBar = null;
  let lightR = null;
  let lightB = null;
  if (police) {
    lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    lightBar.position.set(-0.25, 1.62, 0);
    group.add(lightBar);
    lightR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.55), new THREE.MeshBasicMaterial({ color: PALETTE.policeLightR }));
    lightR.position.set(-0.25, 1.76, 0.32);
    group.add(lightR);
    lightB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.55), new THREE.MeshBasicMaterial({ color: PALETTE.policeLightB }));
    lightB.position.set(-0.25, 1.76, -0.32);
    group.add(lightB);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.length * 0.98, 0.2, CAR.width + 0.02), new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  return { group, wheels, lightR, lightB };
}

/** Arcade car state: heading in radians (0 = +x), speed in m/s. */
export function createCarState(x, z, heading, color, police = false) {
  const mesh = buildCarMesh(color, police);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = heading;
  return {
    x, z, heading, speed: 0, steer: 0, color, police,
    mesh: mesh.group, wheels: mesh.wheels, lightR: mesh.lightR, lightB: mesh.lightB,
    // Drive with throttle (-1..1) and steer (-1..1) for dt seconds.
    drive(throttle, steerInput, dt) {
      const targetSteer = steerInput * CAR.steer;
      this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
      if (throttle > 0) this.speed += CAR.accel * throttle * dt;
      else if (throttle < 0) {
        if (this.speed > 0.5) this.speed -= CAR.brake * dt;
        else this.speed += CAR.reverseAccel * throttle * dt;
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
      }
      this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
      const turn = this.steer * (this.speed / CAR.maxSpeed) * (this.speed >= 0 ? 1 : -1);
      this.heading += turn * dt * 2.2;
      this.x += Math.cos(this.heading) * this.speed * dt;
      this.z -= Math.sin(this.heading) * this.speed * dt;
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      const spin = (this.speed * dt) / 0.36;
      for (const wheel of this.wheels) wheel.rotation.y += spin;
    },
    setPose(x, z, heading) {
      this.x = x;
      this.z = z;
      this.heading = heading;
      this.speed = 0;
      this.mesh.position.set(x, 0, z);
      this.mesh.rotation.y = heading;
    },
  };
}

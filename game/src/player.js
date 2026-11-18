// The player on foot: a low-poly person with a walk cycle, a punch, and
// a pistol once it is unlocked. The camera follows behind and orbits
// with the mouse drag; WASD moves relative to the camera.

import * as THREE from 'three';
import { PALETTE, PLAYER } from './config.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: PALETTE.playerShirt });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.36), shirt);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.75;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.96;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(0, 0.36, 0.15);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legR.position.set(0, 0.36, -0.15);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), shirt);
  armL.position.set(0, 1.15, 0.28);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), shirt);
  armR.position.set(0, 1.15, -0.28);
  group.add(armR);
  // The pistol, hidden until it is unlocked and equipped.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.12), new THREE.MeshLambertMaterial({ color: 0x14161a }));
  gun.position.set(0.1, 1.05, -0.34);
  gun.visible = false;
  group.add(gun);
  scene.add(group);

  const player = {
    group, legL, legR, armL, armR, gun,
    x: 0, z: 0, heading: 0, // heading: 0 = +x
    health: PLAYER.health,
    walkPhase: 0,
    punchTimer: 0,
    shootTimer: 0,
    pistolUnlocked: false,
    pistolEquipped: false,
    invulnerable: 0,
    setPose(x, z, heading) {
      this.x = x;
      this.z = z;
      this.heading = heading;
      this.group.position.set(x, 0, z);
      this.group.rotation.y = heading;
    },
    /** Move with a WASD direction (fx, fz) in world space. */
    move(fx, fz, run, dt, world) {
      const len = Math.hypot(fx, fz);
      if (len < 0.01) {
        this.walkPhase += dt * 2;
      } else {
        const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const nx = fx / len;
        const nz = fz / len;
        this.x += nx * speed * dt;
        this.z += nz * speed * dt;
        const targetHeading = Math.atan2(-nz, nx);
        let diff = targetHeading - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += diff * Math.min(1, dt * 12);
        this.walkPhase += dt * speed * 1.6;
      }
      world.resolveCircle(this, PLAYER.radius);
      const swing = Math.sin(this.walkPhase) * (len > 0.01 ? 0.55 : 0.08);
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = this.pistolEquipped ? -1.2 : -swing * 0.7;
      this.armR.rotation.x = this.pistolEquipped ? -1.2 : swing * 0.7;
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.heading;
      if (this.punchTimer > 0) this.punchTimer -= dt;
      if (this.shootTimer > 0) this.shootTimer -= dt;
      if (this.invulnerable > 0) this.invulnerable -= dt;
    },
    canPunch() { return this.punchTimer <= 0; },
    punch() { this.punchTimer = PLAYER.punchCooldown; },
    canShoot() { return this.pistolEquipped && this.shootTimer <= 0; },
    shoot() { this.shootTimer = PLAYER.pistolCooldown; },
    hurt(amount) {
      if (this.invulnerable > 0) return false;
      this.health -= amount;
      this.invulnerable = 0.8;
      return true;
    },
    toggleWeapon() {
      if (!this.pistolUnlocked) return false;
      this.pistolEquipped = !this.pistolEquipped;
      this.gun.visible = this.pistolEquipped;
      return true;
    },
  };
  player.setPose(0, 0, 0);
  return player;
}

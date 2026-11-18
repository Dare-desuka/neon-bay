// Every tuning number and colour for Neon Bay in one place.
// World units are metres. The city is a street grid; the beach and the
// ocean sit on the east (+x) side. Nothing here depends on screen size.

export const STEP = 1 / 60; // fixed simulation step, seconds

// Street grid: vertical roads at these x, horizontal roads at these z.
export const ROADS_X = [-217, -155, -93, -31, 31, 93, 155, 217];
export const ROADS_Z = [-155, -93, -31, 31, 93, 155];
export const STREET_W = 16;
export const BLOCK = 46; // building block size between streets
export const CITY_X = 240; // half extent of the city in x
export const CITY_Z = 178; // half extent of the city in z
export const BEACH_X0 = 240; // sand starts here
export const SEA_X0 = 282; // water starts here
export const WORLD_R = 420; // soft play boundary radius-ish (x/z clamp)

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.55,
  health: 100,
  punchRange: 2.2,
  punchDamage: 25,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolCooldown: 0.28,
  pistolRange: 60,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38, // ~137 km/h
  maxReverse: 10,
  steer: 1.9, // rad/s at full lock, scaled by speed
  grip: 6,
  length: 4.4,
  width: 1.9,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const POLICE_CAR_MAX = 4;

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  ramPolice: 1,
  shoot: 1,
  decaySeconds: 7, // no cop near: lose one star per this many seconds
  sightRange: 55,
};

export const MONEY = {
  start: 120,
  mission1: 200,
  mission2: 350,
  mission3: 500,
  mission4: 800,
  arrestFine: 150,
};

export const SAVE_KEY = 'neon-bay.save.v1';

export const PALETTE = {
  skyTop: 0x3d8fd1,
  skyBottom: 0xffe3b3,
  sun: 0xfff2cc,
  ground: 0x8a8f98, // sidewalk / base ground
  road: 0x2e3138,
  roadLine: 0xf5f0e1,
  sand: 0xe8d29a,
  sea: 0x1e7fa8,
  seaDeep: 0x0d5a80,
  building: [0xcfd6dd, 0xe8dcc8, 0xb9c8d8, 0xd8c0b0, 0xaebfd0, 0xe0e4e8],
  windowLit: 0xffd27a,
  windowDark: 0x2a3a4a,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x2fae62,
  playerShirt: 0xff5a3c,
  playerPants: 0x2b3a55,
  copShirt: 0x1d4ed8,
  thugShirt: 0x7a1f3d,
  carColors: [0xd33a2c, 0x2c6fd3, 0xf2c230, 0x37b24d, 0x8e44ad, 0xe8e8e8, 0x222831, 0xef7d1a],
  policeCar: 0xf2f2f2,
  policeLightR: 0xff2222,
  policeLightB: 0x2244ff,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

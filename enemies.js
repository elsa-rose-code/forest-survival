// ============================================
// ENEMIES.JS - All the forest creatures!
// Wolves, creepy deer, alpha wolves, bears,
// cultists, and cute bunnies!
// ============================================

// --- ENEMY SETTINGS ---
// Each enemy type has different stats
const ENEMY_TYPES = {
  bunny: {
    name: 'Bunny',
    health: 20,           // Easy to kill
    damage: 0,            // Bunnies are harmless!
    speed: 12,            // FAST - hard to catch!
    detectRange: 10,      // Notices you from 10 away
    attackRange: 0,       // Never attacks
    attackCooldown: 99,   // Never attacks
    color: 0xddccbb,     // Light tan/white
    passive: true,        // THIS IS THE KEY! Bunnies run AWAY
    loot: { type: 'meat', amount: 1 },
    pelt: 'bunnyFoot',   // Drops a bunny foot for the trader!
    minDist: 12,
    maxDist: 60           // Zones 1-2
  },
  wolf: {
    name: 'Wolf',
    health: 60,
    damage: 5,           // Reduced so health doesn't drop so fast!
    speed: 8,
    detectRange: 25,    // How far away they spot you
    attackRange: 2.2,   // How close to bite
    attackCooldown: 1.5, // Seconds between bites
    color: 0x666666,    // Gray
    loot: { type: 'fangs', amount: 1 },
    pelt: 'wolfPelt',   // Drops a wolf pelt for the trader!
    // Zone: spawns anywhere, more in center
    minDist: 20,  // Minimum distance from center to spawn
    maxDist: 120  // Maximum distance from center to spawn
  },
  deer: {
    name: 'Creepy Deer',
    health: 80,
    damage: 8,           // Reduced damage
    speed: 10,          // Fast and scary!
    detectRange: 30,
    attackRange: 2.5,
    attackCooldown: 1.2,
    color: 0x8B6914,    // Brown
    loot: { type: 'bones', amount: 2 },
    minDist: 25,
    maxDist: 130
  },
  alphaWolf: {
    name: 'Alpha Wolf',
    health: 120,
    damage: 10,          // Reduced damage
    speed: 9,
    detectRange: 30,
    attackRange: 2.5,
    attackCooldown: 1.3,
    color: 0x222222,    // Dark/black
    loot: { type: 'fangs', amount: 3 },
    pelt: 'alphaWolfPelt', // Drops an alpha wolf pelt!
    minDist: 80,        // Only near edges!
    maxDist: 160
  },
  bear: {
    name: 'Bear',
    health: 200,
    damage: 15,          // Reduced damage (was 30!)
    speed: 5,           // Slow but hits HARD
    detectRange: 20,
    attackRange: 3,
    attackCooldown: 2,
    color: 0x4a3728,    // Brown
    loot: { type: 'meat', amount: 3 },
    pelt: 'bearPelt',   // Drops a bear pelt!
    minDist: 80,
    maxDist: 160
  },
  cultist: {
    name: 'Cultist',
    health: 70,
    damage: 7,           // Reduced damage
    speed: 6,
    detectRange: 15,    // Don't notice you until you're close
    attackRange: 2.5,
    attackCooldown: 1.8,
    color: 0x440044,    // Dark purple robes
    loot: { type: 'gems', amount: 2 },
    minDist: 40,
    maxDist: 140
  }
};

// All active enemies in the game
const enemies = [];

// ============================================
// CREATE ENEMY 3D MODELS
// Each enemy is built from simple box shapes!
// ============================================

// --- WOLF MODEL ---
// Made from boxes: body, head, 4 legs, tail
function createWolfMesh(color, scale = 1) {
  const wolf = new THREE.Group();

  const mat = new THREE.MeshLambertMaterial({ color });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.6 * scale, 1.4 * scale), mat);
  body.position.y = 0.7 * scale;
  body.castShadow = true;
  wolf.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.6 * scale), mat);
  head.position.set(0, 0.9 * scale, -0.9 * scale);
  head.castShadow = true;
  wolf.add(head);

  // Snout (nose area)
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.25 * scale, 0.4 * scale), mat);
  snout.position.set(0, 0.8 * scale, -1.25 * scale);
  wolf.add(snout);

  // Eyes - glowing red!
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), eyeMat);
  eyeL.position.set(-0.15 * scale, 0.95 * scale, -1.15 * scale);
  wolf.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), eyeMat);
  eyeR.position.set(0.15 * scale, 0.95 * scale, -1.15 * scale);
  wolf.add(eyeR);

  // Legs (4)
  const legGeom = new THREE.BoxGeometry(0.2 * scale, 0.6 * scale, 0.2 * scale);
  const positions = [
    [-0.25, 0.3, -0.45],
    [0.25, 0.3, -0.45],
    [-0.25, 0.3, 0.45],
    [0.25, 0.3, 0.45]
  ];
  const legs = [];
  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(legGeom, mat);
    leg.position.set(x * scale, y * scale, z * scale);
    leg.castShadow = true;
    wolf.add(leg);
    legs.push(leg);
  }

  // Tail
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15 * scale, 0.15 * scale, 0.5 * scale), mat);
  tail.position.set(0, 0.85 * scale, 0.9 * scale);
  tail.rotation.x = -0.5;
  wolf.add(tail);

  wolf.userData.legs = legs;
  return wolf;
}

// --- CREEPY DEER MODEL ---
// Tall, walks on two legs - super creepy!
function createDeerMesh(color) {
  const deer = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });

  // Tall thin body (walks upright - creepy!)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.5), mat);
  body.position.y = 2;
  body.castShadow = true;
  deer.add(body);

  // Long neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), mat);
  neck.position.set(0, 3.1, -0.1);
  deer.add(neck);

  // Head (deer-shaped)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.7), mat);
  head.position.set(0, 3.7, -0.2);
  head.castShadow = true;
  deer.add(head);

  // Antlers! (two branching things on top)
  const antlerMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  // Left antler
  const antlerL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), antlerMat);
  antlerL.position.set(-0.2, 4.2, -0.1);
  antlerL.rotation.z = 0.3;
  deer.add(antlerL);
  const antlerL2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), antlerMat);
  antlerL2.position.set(-0.35, 4.4, -0.1);
  antlerL2.rotation.z = 0.8;
  deer.add(antlerL2);
  // Right antler
  const antlerR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), antlerMat);
  antlerR.position.set(0.2, 4.2, -0.1);
  antlerR.rotation.z = -0.3;
  deer.add(antlerR);
  const antlerR2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), antlerMat);
  antlerR2.position.set(0.35, 4.4, -0.1);
  antlerR2.rotation.z = -0.8;
  deer.add(antlerR2);

  // Glowing white eyes (ghostly!)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.08), eyeMat);
  eyeL.position.set(-0.12, 3.75, -0.55);
  deer.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.08), eyeMat);
  eyeR.position.set(0.12, 3.75, -0.55);
  deer.add(eyeR);

  // Two legs (walks upright like a person - SO creepy)
  const legGeom = new THREE.BoxGeometry(0.2, 1.2, 0.2);
  const legL = new THREE.Mesh(legGeom, mat);
  legL.position.set(-0.2, 0.6, 0);
  deer.add(legL);
  const legR = new THREE.Mesh(legGeom, mat);
  legR.position.set(0.2, 0.6, 0);
  deer.add(legR);

  deer.userData.legs = [legL, legR];
  return deer;
}

// --- BEAR MODEL ---
// Big and chunky!
function createBearMesh(color) {
  const bear = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });

  // Big round body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.8), mat);
  body.position.y = 1;
  body.castShadow = true;
  bear.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), mat);
  head.position.set(0, 1.5, -1.1);
  head.castShadow = true;
  bear.add(head);

  // Ears
  const earMat = new THREE.MeshLambertMaterial({ color: 0x3a2512 });
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), earMat);
  earL.position.set(-0.3, 1.9, -1);
  bear.add(earL);
  const earR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), earMat);
  earR.position.set(0.3, 1.9, -1);
  bear.add(earR);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x331111 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), eyeMat);
  eyeL.position.set(-0.2, 1.55, -1.45);
  bear.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), eyeMat);
  eyeR.position.set(0.2, 1.55, -1.45);
  bear.add(eyeR);

  // 4 thick legs
  const legGeom = new THREE.BoxGeometry(0.35, 0.7, 0.35);
  const legs = [];
  const positions = [[-0.4, 0.35, -0.55], [0.4, 0.35, -0.55], [-0.4, 0.35, 0.55], [0.4, 0.35, 0.55]];
  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(legGeom, mat);
    leg.position.set(x, y, z);
    bear.add(leg);
    legs.push(leg);
  }

  bear.userData.legs = legs;
  return bear;
}

// --- BUNNY MODEL ---
// Small, cute, white/tan with long ears!
function createBunnyMesh(color) {
  const bunny = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });

  // Body (small round-ish)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), mat);
  body.position.y = 0.3;
  body.castShadow = true;
  bunny.add(body);

  // Head (slightly smaller)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.28), mat);
  head.position.set(0, 0.4, -0.32);
  head.castShadow = true;
  bunny.add(head);

  // EARS - tall and thin! (the best part!)
  const earMat = new THREE.MeshLambertMaterial({ color: 0xeeddcc });
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), earMat);
  earL.position.set(-0.08, 0.72, -0.3);
  earL.rotation.z = 0.15; // Slightly tilted outward
  bunny.add(earL);
  const earR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), earMat);
  earR.position.set(0.08, 0.72, -0.3);
  earR.rotation.z = -0.15;
  bunny.add(earR);

  // Inner ear (pink!)
  const innerEarMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
  const innerL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.06), innerEarMat);
  innerL.position.set(-0.08, 0.72, -0.31);
  bunny.add(innerL);
  const innerR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.06), innerEarMat);
  innerR.position.set(0.08, 0.72, -0.31);
  bunny.add(innerR);

  // Eyes - cute black dots
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), eyeMat);
  eyeL.position.set(-0.08, 0.43, -0.45);
  bunny.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), eyeMat);
  eyeR.position.set(0.08, 0.43, -0.45);
  bunny.add(eyeR);

  // Nose (tiny pink dot)
  const noseMat = new THREE.MeshBasicMaterial({ color: 0xff8888 });
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), noseMat);
  nose.position.set(0, 0.38, -0.47);
  bunny.add(nose);

  // Front legs (tiny!)
  const legGeom = new THREE.BoxGeometry(0.08, 0.2, 0.08);
  const legFL = new THREE.Mesh(legGeom, mat);
  legFL.position.set(-0.1, 0.1, -0.15);
  bunny.add(legFL);
  const legFR = new THREE.Mesh(legGeom, mat);
  legFR.position.set(0.1, 0.1, -0.15);
  bunny.add(legFR);

  // Back legs (slightly bigger - bunnies have strong back legs!)
  const backLegGeom = new THREE.BoxGeometry(0.1, 0.22, 0.12);
  const legBL = new THREE.Mesh(backLegGeom, mat);
  legBL.position.set(-0.12, 0.11, 0.15);
  bunny.add(legBL);
  const legBR = new THREE.Mesh(backLegGeom, mat);
  legBR.position.set(0.12, 0.11, 0.15);
  bunny.add(legBR);

  // Fluffy tail (little white puff!)
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), tailMat);
  tail.position.set(0, 0.35, 0.3);
  bunny.add(tail);

  bunny.userData.legs = [legFL, legFR, legBL, legBR];
  return bunny;
}

// --- CULTIST MODEL ---
// A robed figure - dark and mysterious!
function createCultistMesh(color) {
  const cultist = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });

  // Robe body (tall cone shape)
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 8), mat);
  robe.position.y = 0.9;
  robe.castShadow = true;
  cultist.add(robe);

  // Head (hidden in hood)
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x220022 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), hoodMat);
  hood.position.set(0, 2, 0);
  cultist.add(hood);

  // Glowing eyes peeking from the hood
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Purple glow
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), eyeMat);
  eyeL.position.set(-0.1, 2, -0.2);
  cultist.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), eyeMat);
  eyeR.position.set(0.1, 2, -0.2);
  cultist.add(eyeR);

  // Staff weapon
  const staffMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), staffMat);
  staff.position.set(0.4, 1.0, 0);
  cultist.add(staff);
  // Glowing orb on top of staff
  const orbMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), orbMat);
  orb.position.set(0.4, 2.1, 0);
  cultist.add(orb);

  cultist.userData.legs = [];
  return cultist;
}

// ============================================
// HEALTH BAR (floating above enemies)
// A colored bar that shrinks as they take damage
// ============================================

function createHealthBar() {
  const group = new THREE.Group();

  // Background (dark)
  const bgGeom = new THREE.PlaneGeometry(1, 0.12);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
  const bg = new THREE.Mesh(bgGeom, bgMat);
  group.add(bg);

  // Health fill (red)
  const fillGeom = new THREE.PlaneGeometry(0.96, 0.08);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(fillGeom, fillMat);
  fill.position.z = 0.01; // Slightly in front of background
  group.add(fill);

  group.userData.fill = fill;
  return group;
}

// ============================================
// SPAWN ENEMIES
// ============================================

function spawnEnemy(scene, typeName, x, z) {
  const type = ENEMY_TYPES[typeName];
  if (!type) return;

  // Create the right 3D model based on type
  let mesh;
  const scale = typeName === 'alphaWolf' ? 1.4 : 1;
  if (typeName === 'bunny') {
    mesh = createBunnyMesh(type.color);
  } else if (typeName === 'wolf' || typeName === 'alphaWolf') {
    mesh = createWolfMesh(type.color, scale);
  } else if (typeName === 'deer') {
    mesh = createDeerMesh(type.color);
  } else if (typeName === 'bear') {
    mesh = createBearMesh(type.color);
  } else if (typeName === 'cultist') {
    mesh = createCultistMesh(type.color);
  }

  mesh.position.set(x, 0, z);
  scene.add(mesh);

  // Create health bar floating above
  const healthBar = createHealthBar();
  const barHeight = typeName === 'deer' ? 5 : typeName === 'bear' ? 2.5 : typeName === 'bunny' ? 1.2 : 2;
  healthBar.position.y = barHeight;
  mesh.add(healthBar);

  // Create the enemy data object
  const enemy = {
    type: typeName,
    mesh: mesh,
    healthBar: healthBar,
    health: type.health,
    maxHealth: type.health,
    damage: type.damage,
    speed: type.speed,
    detectRange: type.detectRange,
    attackRange: type.attackRange,
    attackCooldown: type.attackCooldown,
    attackTimer: 0,
    loot: type.loot,
    passive: type.passive || false, // Bunnies are passive!
    // AI state
    state: 'idle',     // idle, chasing, attacking, fleeing (bunnies!)
    walkAngle: Math.random() * Math.PI * 2, // Random starting direction
    idleTimer: Math.random() * 3, // Wander timer
    animTime: Math.random() * 10  // For leg animation
  };

  // Assign a bunny color variant for the census! (collecting.js)
  if (typeName === 'bunny' && typeof assignBunnyVariant === 'function') {
    assignBunnyVariant(enemy);
  }

  enemies.push(enemy);
  return enemy;
}

// Spawn initial enemies when the game starts
// Enemies match the grass color zones:
//   Zone 1 (bright green, 0-30): Wolves only
//   Zone 2 (medium green, 30-60): Wolves + Alpha Wolves
//   Zone 3 (dark green, 60-90): Bears + Alpha Wolves
//   Deer and cultists roam across zones 2-3
function spawnInitialEnemies(scene) {
  // At start, the map is SMALL (radius 35) - only zone 1!
  // More enemies get added when you upgrade the campfire

  // --- BUNNIES! Cute and harmless, hop around zone 1 ---
  for (let i = 0; i < 5; i++) {
    const pos = randomPositionInZone(SAFE_ZONE_RADIUS + 3, 33);
    spawnEnemy(scene, 'bunny', pos.x, pos.z);
  }

  // --- ZONE 1: Just regular wolves to start ---
  for (let i = 0; i < 5; i++) {
    const pos = randomPositionInZone(SAFE_ZONE_RADIUS + 5, 33);
    spawnEnemy(scene, 'wolf', pos.x, pos.z);
  }
}

// Spawn new enemies when the map expands from campfire upgrades!
function spawnEnemiesForNewZone(level) {
  if (level === 2) {
    // Zone 2 unlocked! Add wolves, alpha wolves, bunnies
    for (let i = 0; i < 4; i++) {
      const pos = randomPositionInZone(30, 60);
      spawnEnemy(scene, 'wolf', pos.x, pos.z);
    }
    for (let i = 0; i < 2; i++) {
      const pos = randomPositionInZone(30, 60);
      spawnEnemy(scene, 'alphaWolf', pos.x, pos.z);
    }
    for (let i = 0; i < 3; i++) {
      const pos = randomPositionInZone(30, 55);
      spawnEnemy(scene, 'bunny', pos.x, pos.z);
    }
    // Deer only come out at night! (spawned in spawnNightEnemies)
  } else if (level === 3) {
    // Zone 3 unlocked! Bears, more alpha wolves
    for (let i = 0; i < 3; i++) {
      const pos = randomPositionInZone(60, 100);
      spawnEnemy(scene, 'bear', pos.x, pos.z);
    }
    for (let i = 0; i < 3; i++) {
      const pos = randomPositionInZone(60, 100);
      spawnEnemy(scene, 'alphaWolf', pos.x, pos.z);
    }
    // Cultist camp
    const campCenter = randomPositionInZone(50, 90);
    for (let i = 0; i < 4; i++) {
      const ox = (Math.random() - 0.5) * 8;
      const oz = (Math.random() - 0.5) * 8;
      spawnEnemy(scene, 'cultist', campCenter.x + ox, campCenter.z + oz);
    }
  } else if (level === 4) {
    // Deep forest! More of everything
    for (let i = 0; i < 3; i++) {
      const pos = randomPositionInZone(100, 140);
      spawnEnemy(scene, 'bear', pos.x, pos.z);
    }
    for (let i = 0; i < 2; i++) {
      const pos = randomPositionInZone(100, 140);
      spawnEnemy(scene, 'alphaWolf', pos.x, pos.z);
    }
    // Deer only come out at night! (spawned in spawnNightEnemies)
  } else if (level === 5) {
    // Full map! The toughest enemies at the very edge
    for (let i = 0; i < 4; i++) {
      const pos = randomPositionInZone(130, 170);
      spawnEnemy(scene, 'bear', pos.x, pos.z);
    }
    for (let i = 0; i < 3; i++) {
      const pos = randomPositionInZone(130, 170);
      spawnEnemy(scene, 'alphaWolf', pos.x, pos.z);
    }
    // Extra cultist camp at the edge
    const campCenter = randomPositionInZone(120, 155);
    for (let i = 0; i < 5; i++) {
      const ox = (Math.random() - 0.5) * 8;
      const oz = (Math.random() - 0.5) * 8;
      spawnEnemy(scene, 'cultist', campCenter.x + ox, campCenter.z + oz);
    }
  }
}

// Spawn extra enemies at night (gets scarier!)
// They follow the same zone rules
function spawnNightEnemies(scene) {
  const mapR = campfireState.mapRadius; // Only spawn within unlocked area!

  // Extra wolves in zone 1 (always available)
  const extraWolves = 2 + Math.floor(dayNightState.nightCount / 2);
  for (let i = 0; i < extraWolves; i++) {
    const pos = randomPositionInZone(SAFE_ZONE_RADIUS + 5, Math.min(30, mapR - 2));
    spawnEnemy(scene, 'wolf', pos.x, pos.z);
  }

  // Extra alpha wolves in zone 2 (if unlocked)
  if (dayNightState.nightCount >= 2 && mapR > 40) {
    const pos = randomPositionInZone(30, Math.min(60, mapR - 2));
    spawnEnemy(scene, 'alphaWolf', pos.x, pos.z);
  }

  // Extra bears in zone 3 on later nights (if unlocked)
  if (dayNightState.nightCount >= 3 && mapR > 70) {
    const pos = randomPositionInZone(60, Math.min(130, mapR - 2));
    spawnEnemy(scene, 'bear', pos.x, pos.z);
  }

  // Deer only come out at night! Creepy bipedal deer roaming the darkness
  if (mapR > 40) {
    const deerCount = 2 + Math.floor(dayNightState.nightCount / 3);
    for (let i = 0; i < Math.min(deerCount, 6); i++) {
      const pos = randomPositionInZone(25, Math.min(120, mapR - 2));
      const deer = spawnEnemy(scene, 'deer', pos.x, pos.z);
      if (deer) deer.nightOnly = true; // Mark for despawn at dawn
    }
  }
}

// Helper: get a random position between minDist and maxDist from center
function randomPositionInZone(minDist, maxDist) {
  const angle = Math.random() * Math.PI * 2;
  const dist = minDist + Math.random() * (maxDist - minDist);
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist
  };
}

// Despawn night-only enemies (deer) when dawn arrives
function despawnNightOnlyEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.nightOnly && enemy.health > 0) {
      // Fade away into the fog
      if (enemy.mesh && enemy.mesh.parent) {
        enemy.mesh.parent.remove(enemy.mesh);
      }
      enemies.splice(i, 1);
    }
  }
}

// ============================================
// ENEMY AI (how enemies think and act!)
// ============================================

function updateEnemies(delta, playerPosition) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    // Skip dead enemies
    if (enemy.health <= 0) continue;

    // Distance to player
    const dx = playerPosition.x - enemy.mesh.position.x;
    const dz = playerPosition.z - enemy.mesh.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    // Count down attack timer
    if (enemy.attackTimer > 0) {
      enemy.attackTimer -= delta;
    }

    // --- CHECK IF PLAYER IS IN SAFE ZONE ---
    // Enemies won't attack or chase if the player is safe!
    const playerInSafe = isInSafeZone(playerPosition.x, playerPosition.z);

    // --- CHECK IF ENEMY IS WANDERING INTO SAFE ZONE ---
    // Push enemies away if they get too close to camp
    const enemyDistFromCenter = Math.sqrt(
      enemy.mesh.position.x ** 2 + enemy.mesh.position.z ** 2
    );
    if (enemyDistFromCenter < SAFE_ZONE_RADIUS + 2) {
      // Run away from camp!
      const awayX = enemy.mesh.position.x / enemyDistFromCenter;
      const awayZ = enemy.mesh.position.z / enemyDistFromCenter;
      enemy.mesh.position.x += awayX * enemy.speed * delta;
      enemy.mesh.position.z += awayZ * enemy.speed * delta;
      enemy.state = 'idle';
    }

    // --- PASSIVE AI (bunnies!) ---
    // Passive animals RUN AWAY from the player instead of chasing!
    else if (enemy.passive) {
      if (distToPlayer < enemy.detectRange && playerState.alive) {
        // FLEE! Run in the OPPOSITE direction from the player
        enemy.state = 'fleeing';
        const fleeX = (-dx / distToPlayer) * enemy.speed * delta;
        const fleeZ = (-dz / distToPlayer) * enemy.speed * delta;
        enemy.mesh.position.x += fleeX;
        enemy.mesh.position.z += fleeZ;
        // Face away from player (running away!)
        enemy.mesh.rotation.y = Math.atan2(-dx, -dz);
        // Bunny hop! Bob up and down while running
        enemy.mesh.position.y = Math.abs(Math.sin(enemy.animTime * 2)) * 0.3;
      } else {
        // Idle - hop around peacefully
        enemy.state = 'idle';
        enemy.idleTimer -= delta;
        if (enemy.idleTimer <= 0) {
          enemy.walkAngle = Math.random() * Math.PI * 2;
          enemy.idleTimer = 1 + Math.random() * 3; // Bunnies change direction more often
        }
        const wanderSpeed = enemy.speed * 0.2;
        enemy.mesh.position.x += Math.sin(enemy.walkAngle) * wanderSpeed * delta;
        enemy.mesh.position.z += Math.cos(enemy.walkAngle) * wanderSpeed * delta;
        enemy.mesh.rotation.y = enemy.walkAngle;
        // Gentle hop while idle
        enemy.mesh.position.y = Math.abs(Math.sin(enemy.animTime * 1.5)) * 0.15;
      }
    }

    // --- AGGRESSIVE AI (wolves, bears, etc.) ---
    // This is how enemy "thinks"!
    else if (distToPlayer < enemy.attackRange && playerState.alive && !playerInSafe) {
      // ATTACK - close enough to bite/hit!
      enemy.state = 'attacking';
      if (enemy.attackTimer <= 0) {
        damagePlayer(enemy.damage);
        enemy.attackTimer = enemy.attackCooldown;
      }
    } else if (distToPlayer < enemy.detectRange && playerState.alive && !playerInSafe) {
      // CHASE - spotted the player!
      enemy.state = 'chasing';

      // Move toward player
      const moveX = (dx / distToPlayer) * enemy.speed * delta;
      const moveZ = (dz / distToPlayer) * enemy.speed * delta;
      enemy.mesh.position.x += moveX;
      enemy.mesh.position.z += moveZ;

      // Face the player
      enemy.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      // IDLE - wander around randomly
      enemy.state = 'idle';
      enemy.idleTimer -= delta;

      if (enemy.idleTimer <= 0) {
        // Pick a new random direction
        enemy.walkAngle = Math.random() * Math.PI * 2;
        enemy.idleTimer = 2 + Math.random() * 3;
      }

      // Wander slowly
      const wanderSpeed = enemy.speed * 0.3;
      enemy.mesh.position.x += Math.sin(enemy.walkAngle) * wanderSpeed * delta;
      enemy.mesh.position.z += Math.cos(enemy.walkAngle) * wanderSpeed * delta;
      enemy.mesh.rotation.y = enemy.walkAngle;
    }

    // --- ANIMATE LEGS ---
    enemy.animTime += delta * (enemy.state === 'chasing' || enemy.state === 'fleeing' ? 8 : 3);
    if (enemy.mesh.userData.legs) {
      for (let j = 0; j < enemy.mesh.userData.legs.length; j++) {
        const leg = enemy.mesh.userData.legs[j];
        if (enemy.state !== 'idle' || enemy.idleTimer < 2) {
          // Alternate legs swinging back and forth
          const offset = j % 2 === 0 ? 0 : Math.PI;
          leg.rotation.x = Math.sin(enemy.animTime + offset) * 0.4;
        } else {
          leg.rotation.x = 0;
        }
      }
    }

    // --- UPDATE HEALTH BAR ---
    if (enemy.healthBar) {
      const fill = enemy.healthBar.userData.fill;
      const healthPercent = enemy.health / enemy.maxHealth;
      fill.scale.x = healthPercent;
      fill.position.x = -(1 - healthPercent) * 0.48; // Keep bar left-aligned

      // Make health bar face the camera (billboard effect)
      enemy.healthBar.lookAt(playerPosition.x, enemy.healthBar.position.y + enemy.mesh.position.y, playerPosition.z);

      // Only show health bar when damaged
      enemy.healthBar.visible = (enemy.health < enemy.maxHealth);
    }
  }
}

// ============================================
// DAMAGE & DEATH FOR ENEMIES
// ============================================

function damageEnemy(enemy, amount) {
  enemy.health -= amount;

  // Flash the enemy white briefly to show they got hit
  enemy.mesh.traverse((child) => {
    if (child.isMesh && child.material.color) {
      const originalColor = child.material.color.getHex();
      child.material.color.setHex(0xffffff);
      setTimeout(() => {
        child.material.color.setHex(originalColor);
      }, 100);
    }
  });

  if (enemy.health <= 0) {
    killEnemy(enemy);
  }
}

function killEnemy(enemy) {
  enemy.health = 0;

  // Track bunny kills for the bunny friend system
  if (enemy.type === 'bunny' && typeof onBunnyKilled === 'function') {
    onBunnyKilled();
  }

  // Track kill in bestiary & maybe drop a charm (collecting.js)
  if (typeof recordBestiaryKill === 'function') recordBestiaryKill(enemy.type);
  if (typeof updateCharmDrops === 'function') updateCharmDrops(enemy.type, enemy.mesh.position.clone());

  // Drop loot! Must be holding the sack (slot 2) to pick up!
  if (enemy.loot) {
    const lootType = enemy.loot.type;
    const lootAmount = enemy.loot.amount;
    if (playerState.selectedSlot !== 2) {
      showLootText('Hold your sack to collect loot! (press 2)');
    } else if (sackHasRoom(lootAmount)) {
      playerState.inventory[lootType] += lootAmount;
      updateInventoryUI();
      showLootText('+' + lootAmount + ' ' + lootType);
    } else {
      showLootText('Sack is full!');
    }
  }

  // Maybe drop a pelt! (random chance - not every time!)
  // Pelts now DROP ON THE GROUND as a physical object and stay there!
  if (enemy.pelt) {
    const dropChances = {
      bunnyFoot: 0.4,      // 40% chance - bunnies are common
      wolfPelt: 0.3,       // 30% chance
      alphaWolfPelt: 0.25, // 25% chance - harder to get
      bearPelt: 0.2        // 20% chance - rarest drop!
    };
    const chance = dropChances[enemy.pelt] || 0.3;

    if (Math.random() < chance) {
      // Spawn a physical pelt on the ground!
      spawnPeltDrop(enemy.pelt, enemy.mesh.position.clone());
    }
  }

  // Drop scrap! (crafting material)
  const scrapDrops = {
    cultist: 2,    // Cultists drop 2 scrap
    wolf: 1,       // Wolves drop 1 scrap
    alphaWolf: 2,  // Alpha wolves drop 2 scrap
    bear: 2,       // Bears drop 2 scrap
    deer: 1        // Deer drop 1 scrap
  };
  const scrapAmount = scrapDrops[enemy.type] || 0;
  if (scrapAmount > 0) {
    if (playerState.selectedSlot === 2 && sackHasRoom(scrapAmount)) {
      playerState.inventory.scrap += scrapAmount;
      updateInventoryUI();
      showLootText('+' + scrapAmount + ' scrap');
    }
  }

  // Remove the 3D model after a brief delay (so you see it fall)
  enemy.mesh.rotation.x = Math.PI / 2; // Tip over!
  enemy.mesh.position.y = 0.3;

  setTimeout(() => {
    if (enemy.mesh.parent) {
      enemy.mesh.parent.remove(enemy.mesh);
    }
    // Remove from enemies array
    const index = enemies.indexOf(enemy);
    if (index > -1) {
      enemies.splice(index, 1);
    }
  }, 1500);
}

// ============================================
// PELT DROPS - Physical pelts on the ground!
// They stay there until you pick them up
// ============================================

const droppedPelts = []; // Array of all pelts on the ground
const PELT_PICKUP_RANGE = 2.5; // How close to auto-pickup

const PELT_INFO = {
  bunnyFoot:     { name: 'Bunny Foot',      color: 0xddccbb, glowColor: 0xddccbb },
  wolfPelt:      { name: 'Wolf Pelt',        color: 0x666666, glowColor: 0x888888 },
  alphaWolfPelt: { name: 'Alpha Wolf Pelt',  color: 0x222222, glowColor: 0x886644 },
  bearPelt:      { name: 'Bear Pelt',        color: 0x4a3728, glowColor: 0x664422 }
};

function spawnPeltDrop(peltType, position) {
  const info = PELT_INFO[peltType];
  if (!info) return;

  const pelt = new THREE.Group();

  // Flat pelt shape (like a hide lying on the ground)
  const peltMat = new THREE.MeshLambertMaterial({ color: info.color, side: THREE.DoubleSide });
  const peltMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), peltMat);
  peltMesh.rotation.x = -Math.PI / 2; // Lay flat
  peltMesh.position.y = 0.05; // Just above ground
  pelt.add(peltMesh);

  // Slight wrinkle bump in the middle (makes it look 3D)
  const bumpMat = new THREE.MeshLambertMaterial({ color: info.color });
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), bumpMat);
  bump.position.y = 0.08;
  pelt.add(bump);

  // Glowing light so you can spot it!
  const glow = new THREE.PointLight(info.glowColor, 0.6, 6);
  glow.position.y = 0.5;
  pelt.add(glow);

  // Position where the enemy died
  pelt.position.set(position.x, 0, position.z);

  scene.add(pelt);

  droppedPelts.push({
    mesh: pelt,
    glow: glow,
    peltType: peltType,
    position: pelt.position
  });

  showLootText(info.name + ' dropped!');
}

// Called every frame from the game loop
function updatePeltDrops(playerPos) {
  for (let i = droppedPelts.length - 1; i >= 0; i--) {
    const pelt = droppedPelts[i];

    // Pulse the glow
    if (pelt.glow) {
      pelt.glow.intensity = 0.4 + Math.sin(totalTime * 3 + i) * 0.3;
    }

    // Auto-pickup if player is close and holding sack
    const dist = playerPos.distanceTo(pelt.position);
    if (dist < PELT_PICKUP_RANGE && playerState.selectedSlot === 2) {
      if (sackHasRoom(1)) {
        // Pick it up!
        playerState.inventory[pelt.peltType] = (playerState.inventory[pelt.peltType] || 0) + 1;
        updateInventoryUI();
        const info = PELT_INFO[pelt.peltType];
        showLootText('+1 ' + info.name + '!');

        // Remove from scene
        scene.remove(pelt.mesh);
        droppedPelts.splice(i, 1);
      }
    }
  }
}

// --- SHOW LOOT TEXT ---
// Shows floating text like "+2 fangs" when you pick up loot
function showLootText(text) {
  const lootEl = document.createElement('div');
  lootEl.className = 'loot-popup';
  lootEl.textContent = text;
  document.body.appendChild(lootEl);

  // Remove after animation finishes
  setTimeout(() => {
    lootEl.remove();
  }, 1500);
}

// ============================================
// PELT TRADER - A mysterious trader NPC!
// Shows up every 4 days, stands next to your base.
// Asks for pelts in order, gives better rewards
// for harder pelts!
// ============================================

// The trader's requests (in order!)
const TRADER_REQUESTS = [
  {
    pelt: 'bunnyFoot',
    peltName: 'Bunny Foot',
    message: '"Got any bunny feet? I collect the lucky ones..."',
    reward: 'goodAxe',        // Good Axe from wooden tier
    rewardName: 'Good Axe'
  },
  {
    pelt: 'wolfPelt',
    peltName: 'Wolf Pelt',
    message: '"A fine wolf pelt would make a warm coat..."',
    reward: 'strongAxe',      // Strong Axe from gold tier!
    rewardName: 'Strong Axe'
  },
  {
    pelt: 'alphaWolfPelt',
    peltName: 'Alpha Wolf Pelt',
    message: '"The alpha\'s pelt... dark and powerful..."',
    reward: 'katana',         // Katana from gold tier!
    rewardName: 'Katana'
  },
  {
    pelt: 'bearPelt',
    peltName: 'Bear Pelt',
    message: '"A bear pelt! Only the bravest can get one..."',
    reward: 'tacticalShotgun', // Tactical Shotgun from ruby tier!!
    rewardName: 'Tactical Shotgun'
  }
];

// Trader state
const traderState = {
  isHere: false,          // Is the trader currently at base?
  mesh: null,             // The trader's 3D model
  currentRequest: 0,      // Which pelt they want (0-3)
  allDone: false,         // Has the player traded all 4 pelts?
  lastVisitDay: 0         // Track when they last showed up
};

// The trader visits every 4 days
const TRADER_INTERVAL = 4;
const TRADER_STAY_DURATION = 0.5; // Stays for half a day cycle (1 full day/night)

// Create the trader's 3D model - a hooded figure with a big backpack!
function createTraderMesh() {
  const trader = new THREE.Group();

  // Cloak/robe (brown, like a traveling merchant)
  const cloakMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 8), cloakMat);
  cloak.position.y = 1;
  cloak.castShadow = true;
  trader.add(cloak);

  // Hood
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), hoodMat);
  hood.position.set(0, 2.15, 0);
  trader.add(hood);

  // Face (darker, mysterious)
  const faceMat = new THREE.MeshLambertMaterial({ color: 0xcc9966 });
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), faceMat);
  face.position.set(0, 2.1, -0.25);
  trader.add(face);

  // Eyes (warm yellow - friendly!)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), eyeMat);
  eyeL.position.set(-0.08, 2.15, -0.3);
  trader.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), eyeMat);
  eyeR.position.set(0.08, 2.15, -0.3);
  trader.add(eyeR);

  // Big backpack (full of goods!)
  const packMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), packMat);
  pack.position.set(0, 1.5, 0.4);
  trader.add(pack);

  // Pack straps
  const strapMat = new THREE.MeshLambertMaterial({ color: 0x3a2512 });
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), strapMat);
  strapL.position.set(-0.2, 1.6, 0.15);
  trader.add(strapL);
  const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), strapMat);
  strapR.position.set(0.2, 1.6, 0.15);
  trader.add(strapR);

  // Pelts hanging off the backpack (decorative)
  const peltMat = new THREE.MeshLambertMaterial({ color: 0x888877 });
  const pelt1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.08), peltMat);
  pelt1.position.set(-0.3, 1.2, 0.45);
  pelt1.rotation.z = 0.2;
  trader.add(pelt1);
  const pelt2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.08), peltMat);
  pelt2.position.set(0.35, 1.3, 0.45);
  pelt2.rotation.z = -0.15;
  trader.add(pelt2);

  // Warm lantern light (so you can spot them!)
  const light = new THREE.PointLight(0xffaa44, 1, 10);
  light.position.y = 2.5;
  trader.add(light);

  return trader;
}

// Spawn the trader next to base (just outside the gate)
function spawnTrader() {
  if (traderState.isHere || traderState.allDone) return;

  traderState.mesh = createTraderMesh();
  // Position right outside the gate of the safe zone
  traderState.mesh.position.set(4, 0, -(SAFE_ZONE_RADIUS + 3));
  // Face toward the camp
  traderState.mesh.rotation.y = Math.PI;
  scene.add(traderState.mesh);

  traderState.isHere = true;

  // Show announcement!
  const announce = document.getElementById('trader-announce');
  if (announce) {
    announce.textContent = 'A Pelt Trader has arrived!';
    announce.style.display = 'block';
    setTimeout(() => { announce.style.display = 'none'; }, 4000);
  }
}

// Remove the trader (they leave)
function despawnTrader() {
  if (!traderState.isHere) return;

  if (traderState.mesh && traderState.mesh.parent) {
    traderState.mesh.parent.remove(traderState.mesh);
  }
  traderState.mesh = null;
  traderState.isHere = false;

  // Hide dialog
  const dialog = document.getElementById('trader-dialog');
  if (dialog) dialog.style.display = 'none';
}

// Check if the trader should appear (every 4 days)
function updateTrader() {
  if (traderState.allDone) return;

  // Check if it's time for the trader to visit
  if (dayNightState.justBecameDay) {
    if (dayNightState.dayCount % TRADER_INTERVAL === 0 && dayNightState.dayCount !== traderState.lastVisitDay) {
      traderState.lastVisitDay = dayNightState.dayCount;
      spawnTrader();
    }
  }

  // If trader leaves when night comes
  if (dayNightState.justBecameNight && traderState.isHere) {
    despawnTrader();
    const announce = document.getElementById('trader-announce');
    if (announce) {
      announce.textContent = 'The Pelt Trader has left...';
      announce.style.display = 'block';
      setTimeout(() => { announce.style.display = 'none'; }, 3000);
    }
  }

  // If trader is here, check if player is near
  if (traderState.isHere && traderState.mesh) {
    const dx = playerState.position.x - traderState.mesh.position.x;
    const dz = playerState.position.z - traderState.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const dialog = document.getElementById('trader-dialog');

    if (dist < 4) {
      // Show the trade dialog!
      if (dialog) {
        dialog.style.display = 'block';
        updateTraderDialog();
      }
    } else {
      if (dialog) dialog.style.display = 'none';
    }
  }
}

// Update what the trader dialog shows
function updateTraderDialog() {
  const req = TRADER_REQUESTS[traderState.currentRequest];
  if (!req) return;

  const msgEl = document.getElementById('trader-message');
  const reqEl = document.getElementById('trader-request');
  const btn = document.getElementById('trader-trade-btn');

  if (msgEl) msgEl.textContent = req.message;

  const hasPelt = (playerState.inventory[req.pelt] || 0) >= 1;

  if (reqEl) {
    reqEl.innerHTML = 'Wants: <strong>' + req.peltName + '</strong>' +
      ' (you have: ' + (playerState.inventory[req.pelt] || 0) + ')' +
      '<br>Reward: <strong style="color:#ffcc44">' + req.rewardName + '</strong>';
  }

  if (btn) {
    btn.disabled = !hasPelt;
    btn.textContent = hasPelt ? 'Trade!' : 'Need ' + req.peltName;
  }
}

// Do the trade!
function tradeWithTrader() {
  if (!traderState.isHere || traderState.allDone) return;

  const req = TRADER_REQUESTS[traderState.currentRequest];
  if (!req) return;

  // Check if player has the pelt
  if ((playerState.inventory[req.pelt] || 0) < 1) {
    showLootText('Need a ' + req.peltName + '!');
    return;
  }

  // Take the pelt
  playerState.inventory[req.pelt] -= 1;
  updateInventoryUI();

  // Give the reward (equip the item!)
  const success = equipItem(req.reward);
  if (success) {
    showLootText('Traded! Got ' + req.rewardName + '!');
  } else {
    showLootText('Traded! But inventory full - ' + req.rewardName + ' lost!');
  }

  // Move to next request
  traderState.currentRequest++;

  // All done?
  if (traderState.currentRequest >= TRADER_REQUESTS.length) {
    traderState.allDone = true;
    const msgEl = document.getElementById('trader-message');
    if (msgEl) msgEl.textContent = '"Thank you for all the pelts! Until we meet again..."';
    const reqEl = document.getElementById('trader-request');
    if (reqEl) reqEl.innerHTML = '<strong style="color:#4ade80">All trades complete!</strong>';
    const btn = document.getElementById('trader-trade-btn');
    if (btn) btn.style.display = 'none';

    // Trader leaves after final trade
    setTimeout(() => { despawnTrader(); }, 3000);
  } else {
    updateTraderDialog();
  }
}

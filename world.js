// ============================================
// WORLD.JS - Builds the 3D forest world!
// This creates the ground, trees, sky,
// and the day/night cycle
// ============================================

// --- WORLD SETTINGS ---
// Change these numbers to make the world different!
const WORLD_SIZE = 200;       // How big the map is
const TREE_COUNT = 150;       // How many trees to place
const TREE_MIN_DISTANCE = 10; // Minimum space between trees (so they don't overlap)
const CLEARING_RADIUS = 15;   // Open area around spawn with no trees

// --- DAY/NIGHT SETTINGS ---
const DAY_LENGTH = 120;       // How many seconds a full day lasts (2 minutes)
// Time goes from 0.0 to 1.0:
//   0.00 = midnight    0.25 = sunrise
//   0.50 = noon        0.75 = sunset

// Keeps track of the day/night cycle
const dayNightState = {
  time: 0.3,       // Start just after sunrise so you can see!
  nightCount: 1,   // What night we're on
  dayCount: 1,     // What day we're on (for the trader!)
  isNight: false,   // Is it currently nighttime?
  justBecameNight: false, // Did night JUST start this frame? (for spawning enemies)
  justBecameDay: false    // Did day JUST start? (for the trader!)
};

// --- CREATE THE GROUND ---
// The ground changes color as you go farther from center!
// Center = bright green (safe), edges = dark/dead grass (dangerous)
function createGround(scene) {
  const groundGroup = new THREE.Group();

  // We make rings of ground, each a slightly different color
  // Think of it like a bullseye target!
  const zones = [
    { radius: 30,  color: 0x3a7a2e },  // Center - bright green (safe zone!)
    { radius: 60,  color: 0x2d6a1e },  // Inner forest - green
    { radius: 90,  color: 0x245515 },  // Mid forest - darker green
    { radius: 130, color: 0x1a3d0e },  // Outer forest - dark green
    { radius: 170, color: 0x1a2a0a },  // Edge - very dark, almost dead
    { radius: 400, color: 0x111a06 }   // Beyond map - darkest (dead grass)
  ];

  // Draw zones from largest to smallest (so small ones layer on top)
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i];
    const geometry = new THREE.CircleGeometry(zone.radius, 64);
    const material = new THREE.MeshLambertMaterial({ color: zone.color });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01 * i; // Stack slightly to avoid z-fighting (flickering)
    ring.receiveShadow = true;
    groundGroup.add(ring);
  }

  scene.add(groundGroup);
  return groundGroup;
}

// --- CREATE A SINGLE TREE ---
function createTree(x, z) {
  const tree = new THREE.Group();

  // TRUNK - brown cylinder
  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  tree.add(trunk);

  // LEAVES - green cone on top
  const leafHeight = 4 + Math.random() * 3;
  const leafRadius = 1.5 + Math.random() * 1.5;
  const leavesGeometry = new THREE.ConeGeometry(leafRadius, leafHeight, 8);
  const greenShade = 0x1a6b1a + Math.floor(Math.random() * 0x002200);
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: greenShade });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.position.y = 3 + leafHeight / 2;
  leaves.castShadow = true;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  return tree;
}

// --- SCATTER TREES ACROSS THE MAP ---
function createForest(scene) {
  const trees = [];

  for (let i = 0; i < TREE_COUNT; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;

    // Don't place trees in the spawn clearing
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < CLEARING_RADIUS) continue;

    // Don't place trees too close to each other
    let tooClose = false;
    for (const existingTree of trees) {
      const dx = x - existingTree.position.x;
      const dz = z - existingTree.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < TREE_MIN_DISTANCE) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const tree = createTree(x, z);
    scene.add(tree);
    trees.push(tree);
  }

  return trees;
}

// --- CREATE THE SKY ---
function createSky(scene) {
  const skyGeometry = new THREE.SphereGeometry(WORLD_SIZE * 2, 32, 32);
  const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0x87ceeb,
    side: THREE.BackSide
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);
  return sky;
}

// --- SET UP LIGHTING ---
function createLighting(scene) {
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.camera.left = -100;
  sunLight.shadow.camera.right = 100;
  sunLight.shadow.camera.top = 100;
  sunLight.shadow.camera.bottom = -100;
  scene.add(sunLight);

  return { ambientLight, sunLight };
}

// --- FOG ---
function createFog(scene) {
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);
}

// --- SAFE ZONE SETTINGS ---
const SAFE_ZONE_RADIUS = 10; // How big the safe zone is
const HEAL_RATE = 8;         // Health per second when inside safe zone

// ============================================
// CAMPFIRE LEVELING SYSTEM
// Feed the fire to unlock more of the map!
// ============================================

const CAMPFIRE_LEVELS = [
  // Level 1: Starting area - just zone 1
  { radius: 35, cost: null, label: 'Small Camp' },
  // Level 2: Unlock zone 2 - just need some wood!
  { radius: 65, cost: { wood: 5 }, label: 'Growing Camp' },
  // Level 3: Unlock zone 3 + gold chests - need wood and coal
  { radius: 100, cost: { wood: 8, coal: 3 }, label: 'Strong Camp' },
  // Level 4: Most of the map - need fuel too!
  { radius: 140, cost: { wood: 10, coal: 5, fuel: 3 }, label: 'Blazing Camp' },
  // Level 5: FULL MAP unlocked! - need fuel canisters (rare!)
  { radius: 170, cost: { wood: 12, coal: 6, fuel: 5, fuelCanister: 2 }, label: 'Inferno Camp' }
];

// Current campfire state
const campfireState = {
  level: 1,                          // Start at level 1
  mapRadius: CAMPFIRE_LEVELS[0].radius,  // Starting map size
  maxLevel: CAMPFIRE_LEVELS.length,
  nearFire: false                    // Is the player close to the campfire?
};

// The dark fog wall mesh (will be created in startGame)
let fogWall = null;

// --- CREATE THE SAFE ZONE CAMP (spawn point!) ---
// A cozy camp with a fence, campfire, tent, and log seats.
// Enemies can't come inside! You heal slowly here.
function createCampfire(scene) {
  const camp = new THREE.Group();

  // === WOODEN FENCE around the camp ===
  const fencePosts = 16; // How many fence posts in the circle
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });

  for (let i = 0; i < fencePosts; i++) {
    const angle = (i / fencePosts) * Math.PI * 2;
    const x = Math.cos(angle) * SAFE_ZONE_RADIUS;
    const z = Math.sin(angle) * SAFE_ZONE_RADIUS;

    // Vertical post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.8, 6), fenceMat);
    post.position.set(x, 0.9, z);
    post.castShadow = true;
    camp.add(post);

    // Horizontal rail between posts
    const nextAngle = ((i + 1) / fencePosts) * Math.PI * 2;
    const nx = Math.cos(nextAngle) * SAFE_ZONE_RADIUS;
    const nz = Math.sin(nextAngle) * SAFE_ZONE_RADIUS;
    const midX = (x + nx) / 2;
    const midZ = (z + nz) / 2;
    const railLength = Math.sqrt((nx - x) ** 2 + (nz - z) ** 2);
    const railAngle = Math.atan2(nz - z, nx - x);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.1, 0.08), fenceMat);
    rail.position.set(midX, 1.2, midZ);
    rail.rotation.y = -railAngle;
    camp.add(rail);

    // Lower rail
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.1, 0.08), fenceMat);
    rail2.position.set(midX, 0.6, midZ);
    rail2.rotation.y = -railAngle;
    camp.add(rail2);
  }

  // === GATE (opening in the fence) ===
  // We'll remove 2 fence sections at the front by just leaving a visual gap
  // The gate posts are slightly taller with a crossbeam
  const gateMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const gatePost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.5, 6), gateMat);
  gatePost1.position.set(-2, 1.25, -SAFE_ZONE_RADIUS);
  camp.add(gatePost1);
  const gatePost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.5, 6), gateMat);
  gatePost2.position.set(2, 1.25, -SAFE_ZONE_RADIUS);
  camp.add(gatePost2);
  // Crossbeam over the gate
  const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.15, 0.15), gateMat);
  crossbeam.position.set(0, 2.5, -SAFE_ZONE_RADIUS);
  camp.add(crossbeam);

  // === CAMPFIRE in the center ===
  // Ring of stones
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const stoneGeometry = new THREE.SphereGeometry(0.3, 6, 4);
    const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
    stone.position.set(Math.cos(angle) * 1.2, 0.15, Math.sin(angle) * 1.2);
    stone.scale.y = 0.6;
    camp.add(stone);
  }

  // Logs
  const logMaterial = new THREE.MeshLambertMaterial({ color: 0x3a2512 });
  const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), logMaterial);
  log1.rotation.z = Math.PI / 6;
  log1.position.y = 0.2;
  camp.add(log1);
  const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), logMaterial);
  log2.rotation.z = -Math.PI / 6;
  log2.rotation.y = Math.PI / 2;
  log2.position.y = 0.2;
  camp.add(log2);

  // Fire
  const fireGeometry = new THREE.ConeGeometry(0.4, 1.2, 6);
  const fireMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const fire = new THREE.Mesh(fireGeometry, fireMaterial);
  fire.position.y = 0.8;
  camp.add(fire);

  // Firelight
  const fireLight = new THREE.PointLight(0xff6622, 1.5, 25);
  fireLight.position.y = 1.5;
  camp.add(fireLight);

  // === LOG SEATS around the fire ===
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const seatPositions = [
    { x: 3, z: 0, rot: 0 },
    { x: -3, z: 0, rot: 0 },
    { x: 0, z: 3, rot: Math.PI / 2 },
  ];
  for (const pos of seatPositions) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.8, 8), seatMat);
    seat.position.set(pos.x, 0.3, pos.z);
    seat.rotation.z = Math.PI / 2;
    seat.rotation.y = pos.rot;
    seat.castShadow = true;
    camp.add(seat);
  }

  // === TENT (little A-frame shelter) ===
  const tentMat = new THREE.MeshLambertMaterial({ color: 0x886644, side: THREE.DoubleSide });
  // Left side
  const tentSide1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.5), tentMat);
  tentSide1.position.set(5, 1.1, 4);
  tentSide1.rotation.y = 0.3;
  tentSide1.rotation.z = 0.5;
  camp.add(tentSide1);
  // Right side
  const tentSide2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.5), tentMat);
  tentSide2.position.set(5, 1.1, 6);
  tentSide2.rotation.y = -0.3;
  tentSide2.rotation.z = -0.5;
  camp.add(tentSide2);
  // Tent pole
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), poleMat);
  pole.position.set(5, 1.4, 5);
  camp.add(pole);

  // === "SAFE ZONE" sign on the gate ===
  // Small wooden board
  const signMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.08), signMat);
  signBoard.position.set(0, 2.1, -SAFE_ZONE_RADIUS - 0.1);
  camp.add(signBoard);

  // Save references
  camp.userData = { fire, fireLight };

  scene.add(camp);
  return camp;
}

// Check if a position is inside the safe zone
function isInSafeZone(x, z) {
  return Math.sqrt(x * x + z * z) < SAFE_ZONE_RADIUS;
}

// ============================================
// GROUND PICKUPS - Coal, Fuel, Fuel Canisters!
// Scattered around the map for campfire upgrades
// ============================================

const groundPickups = []; // All pickups in the world

const PICKUP_TYPES = {
  coal: {
    name: 'Coal',
    resource: 'coal',
    color: 0x222222,        // Dark black
    glowColor: 0x443322,    // Warm glow
    size: 0.3,
    minDist: 15,            // Near base
    maxDist: 80
  },
  fuel: {
    name: 'Fuel',
    resource: 'fuel',
    color: 0xcc8800,        // Amber/orange
    glowColor: 0xff6600,    // Orange glow
    size: 0.25,
    minDist: 40,            // Medium distance
    maxDist: 120
  },
  fuelCanister: {
    name: 'Fuel Canister',
    resource: 'fuelCanister',
    color: 0xcc2222,        // Red canister
    glowColor: 0xff4444,    // Red glow
    size: 0.35,
    minDist: 80,            // Far from base (rare!)
    maxDist: 160
  }
};

// Create a ground pickup 3D model
function createPickupMesh(type) {
  const config = PICKUP_TYPES[type];
  const group = new THREE.Group();

  if (type === 'coal') {
    // Coal - small dark rock
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const rock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), mat);
    rock.position.y = 0.1;
    rock.rotation.y = Math.random() * Math.PI;
    group.add(rock);
  } else if (type === 'fuel') {
    // Fuel - small bottle/can
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 6), mat);
    bottle.position.y = 0.18;
    group.add(bottle);
    // Cap
    const capMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), capMat);
    cap.position.y = 0.4;
    group.add(cap);
  } else if (type === 'fuelCanister') {
    // Fuel canister - red metal can
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const can = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), mat);
    can.position.y = 0.2;
    group.add(can);
    // Handle on top
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), handleMat);
    handle.position.y = 0.44;
    group.add(handle);
    // Label
    const labelMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.22), labelMat);
    label.position.set(0, 0.2, 0);
    group.add(label);
  }

  // Glowing light so you can spot them!
  const glow = new THREE.PointLight(config.glowColor, 0.6, 5);
  glow.position.y = 0.3;
  group.add(glow);
  group.userData.glow = glow;

  return group;
}

// Spawn pickups across the map
function spawnGroundPickups(scene) {
  // Coal - most common, near base
  for (let i = 0; i < 12; i++) {
    spawnPickup(scene, 'coal');
  }
  // Fuel - medium, further out
  for (let i = 0; i < 8; i++) {
    spawnPickup(scene, 'fuel');
  }
  // Fuel canisters - rare, far from base
  for (let i = 0; i < 4; i++) {
    spawnPickup(scene, 'fuelCanister');
  }
}

function spawnPickup(scene, type) {
  const config = PICKUP_TYPES[type];
  const angle = Math.random() * Math.PI * 2;
  // Only spawn within current map radius
  const maxDist = Math.min(config.maxDist, campfireState.mapRadius - 5);
  if (maxDist <= config.minDist) return; // Zone not unlocked yet
  const dist = config.minDist + Math.random() * (maxDist - config.minDist);
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  if (isInSafeZone(x, z)) return;

  const mesh = createPickupMesh(type);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  groundPickups.push({
    type: type,
    resource: config.resource,
    mesh: mesh,
    collected: false
  });
}

// Check if player is near a pickup (auto-collect!)
const PICKUP_RANGE = 2.5;

function updateGroundPickups(playerPosition) {
  for (let i = groundPickups.length - 1; i >= 0; i--) {
    const pickup = groundPickups[i];
    if (pickup.collected) continue;

    const dx = playerPosition.x - pickup.mesh.position.x;
    const dz = playerPosition.z - pickup.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Glow pulse animation
    if (pickup.mesh.userData.glow) {
      pickup.mesh.userData.glow.intensity = 0.4 + Math.sin(totalTime * 4) * 0.3;
    }

    // Pick up when walking over it - must be holding the sack!
    if (dist < PICKUP_RANGE) {
      if (playerState.selectedSlot !== 2) {
        // Show a hint if they're close but not holding sack
        continue;
      }
      if (!sackHasRoom(1)) {
        // Don't spam the message
        continue;
      }

      pickup.collected = true;
      playerState.inventory[pickup.resource] += 1;
      updateInventoryUI();

      const name = PICKUP_TYPES[pickup.type].name;
      showLootText('+1 ' + name);

      // Remove from scene
      if (pickup.mesh.parent) pickup.mesh.parent.remove(pickup.mesh);
      groundPickups.splice(i, 1);
    }
  }
}

// Spawn NEW pickups when the map expands
function spawnPickupsForNewZone(level) {
  // Spawn more pickups in the newly unlocked area
  for (let i = 0; i < 6; i++) spawnPickup(scene, 'coal');
  for (let i = 0; i < 4; i++) spawnPickup(scene, 'fuel');
  if (level >= 3) {
    for (let i = 0; i < 2; i++) spawnPickup(scene, 'fuelCanister');
  }
}

// ============================================
// DAY/NIGHT CYCLE
// This is the coolest part - the world changes
// over time! Daytime is bright and safe,
// nighttime is dark and scary.
// ============================================

function updateDayNight(delta, sunLight, ambientLight, sky, scene) {
  const wasNight = dayNightState.isNight;

  // Advance time (0.0 to 1.0, wraps around)
  dayNightState.time += delta / DAY_LENGTH;
  if (dayNightState.time >= 1.0) {
    dayNightState.time -= 1.0;
  }

  const t = dayNightState.time;

  // Figure out if it's night (between 0.75 sunset and 0.25 sunrise)
  dayNightState.isNight = (t > 0.75 || t < 0.25);

  // Did night JUST start? (for enemy spawning)
  dayNightState.justBecameNight = (!wasNight && dayNightState.isNight);
  // Did day JUST start? (for the pelt trader!)
  dayNightState.justBecameDay = (wasNight && !dayNightState.isNight);

  // Increment night counter when night begins
  if (dayNightState.justBecameNight) {
    dayNightState.nightCount++;
    document.getElementById('night-counter').textContent = 'Night ' + dayNightState.nightCount;
  }

  // Increment day counter when day begins
  if (dayNightState.justBecameDay) {
    dayNightState.dayCount++;
  }

  // --- CALCULATE SUN POSITION ---
  // The sun moves in a circle across the sky
  const sunAngle = t * Math.PI * 2; // Full circle
  const sunHeight = Math.sin(sunAngle - Math.PI * 0.5);
  sunLight.position.set(
    Math.cos(sunAngle) * 100,
    Math.max(sunHeight * 100, -20), // Don't go too far below
    50
  );

  // --- ADJUST BRIGHTNESS ---
  // smoothDay goes from 0 (midnight) to 1 (noon) smoothly
  // We use this to control how bright everything is
  let smoothDay;
  if (t >= 0.25 && t <= 0.75) {
    // Daytime: ramp up from sunrise, peak at noon, ramp down to sunset
    smoothDay = Math.sin((t - 0.25) / 0.5 * Math.PI);
  } else {
    // Nighttime
    smoothDay = 0;
  }

  // Sun brightness (brighter during the day!)
  sunLight.intensity = smoothDay * 1.8;

  // Ambient light - brighter at night so you can still see!
  ambientLight.intensity = 0.4 + smoothDay * 0.6;

  // --- SKY COLOR ---
  // Daytime: light blue | Sunset: orange | Night: dark blue
  const dayColor = new THREE.Color(0x87ceeb);   // Light blue
  const sunsetColor = new THREE.Color(0xff7744); // Orange
  const nightColor = new THREE.Color(0x1a1a3a);  // Dark blue (but not pitch black!)

  let skyColor;
  if (t >= 0.25 && t <= 0.75) {
    // Daytime
    skyColor = dayColor.clone();
    // Add sunset tint near sunrise/sunset
    if (t < 0.35) {
      // Sunrise fade
      const blend = (0.35 - t) / 0.1;
      skyColor.lerp(sunsetColor, blend * 0.5);
    } else if (t > 0.65) {
      // Sunset fade
      const blend = (t - 0.65) / 0.1;
      skyColor.lerp(sunsetColor, blend * 0.5);
    }
  } else {
    skyColor = nightColor.clone();
  }
  sky.material.color.copy(skyColor);

  // --- FOG ---
  // Slightly thicker fog at night but not too much
  const fogDensity = dayNightState.isNight ? 0.012 : 0.006;
  scene.fog.density += (fogDensity - scene.fog.density) * 0.02; // Smooth transition
  scene.fog.color.copy(skyColor); // Fog matches sky color

  // --- UPDATE NIGHT COUNTER DISPLAY ---
  const counterEl = document.getElementById('night-counter');
  if (dayNightState.isNight) {
    counterEl.style.color = '#ff6644';
    counterEl.textContent = 'Night ' + dayNightState.nightCount;
  } else {
    counterEl.style.color = 'white';
    counterEl.textContent = 'Day ' + dayNightState.nightCount;
  }
}

// Animate the campfire (make the fire flicker!)
function updateCampfire(campfire, time) {
  if (!campfire || !campfire.userData) return;
  const { fire, fireLight } = campfire.userData;

  // Fire gets BIGGER at higher levels! Looks awesome!
  const levelScale = 1 + (campfireState.level - 1) * 0.3;

  // Make the fire flicker by changing its size and light intensity
  const flicker = Math.sin(time * 10) * 0.1 + Math.sin(time * 15.7) * 0.05;
  fire.scale.set(
    (1 + flicker) * levelScale,
    (1 + flicker * 0.5) * levelScale,
    (1 + flicker) * levelScale
  );
  // Light gets brighter and reaches further at higher levels
  fireLight.intensity = (1.5 + flicker * 3) * levelScale;
  fireLight.distance = 25 + (campfireState.level - 1) * 10;
}

// ============================================
// FOG WALL - The dark barrier at the map edge
// You can't go past it until you level the fire!
// ============================================

function createFogWall(scene) {
  // A big dark cylinder around the playable area
  // It looks like a wall of dark mist/fog
  const geometry = new THREE.CylinderGeometry(
    campfireState.mapRadius,  // Top radius
    campfireState.mapRadius,  // Bottom radius
    30,                       // Height (tall wall!)
    64,                       // Segments (smooth circle)
    1,                        // Height segments
    true                      // Open ended (hollow tube)
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0x0a0a12,
    side: THREE.BackSide,    // We see it from INSIDE
    transparent: true,
    opacity: 0.85
  });

  fogWall = new THREE.Mesh(geometry, material);
  fogWall.position.y = 10; // Center it vertically
  scene.add(fogWall);

  return fogWall;
}

// Update the fog wall when the map expands
function updateFogWallRadius() {
  if (!fogWall) return;

  // Remove old fog wall and create a new one with bigger radius
  const parent = fogWall.parent;
  if (parent) parent.remove(fogWall);

  const geometry = new THREE.CylinderGeometry(
    campfireState.mapRadius,
    campfireState.mapRadius,
    30, 64, 1, true
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0x0a0a12,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.85
  });

  fogWall = new THREE.Mesh(geometry, material);
  fogWall.position.y = 10;
  if (parent) parent.add(fogWall);
}

// ============================================
// CAMPFIRE UPGRADE - Press E near the fire!
// ============================================

function checkCampfireUpgrade() {
  // Only check if player is near the campfire (center of map)
  const px = playerState.position.x;
  const pz = playerState.position.z;
  const distToFire = Math.sqrt(px * px + pz * pz);

  campfireState.nearFire = (distToFire < 5); // Within 5 units of center

  // Show/hide the upgrade prompt
  const prompt = document.getElementById('fire-upgrade-prompt');
  const levelUI = document.getElementById('fire-level-ui');

  if (campfireState.nearFire && campfireState.level < campfireState.maxLevel) {
    if (prompt) prompt.style.display = 'block';
    if (levelUI) levelUI.style.display = 'block';
    updateFireUpgradeUI();
  } else {
    if (prompt) prompt.style.display = 'none';
    if (levelUI) levelUI.style.display = 'none';
  }
}

// Try to upgrade the campfire!
function tryUpgradeCampfire() {
  if (!campfireState.nearFire) return;
  if (campfireState.level >= campfireState.maxLevel) return;

  const nextLevel = CAMPFIRE_LEVELS[campfireState.level]; // Next level (0-indexed, level 1 = index 1)
  const cost = nextLevel.cost;

  // Check if player has enough resources
  const inv = playerState.inventory;
  for (const [resource, amount] of Object.entries(cost)) {
    if ((inv[resource] || 0) < amount) {
      showLootText('Need more ' + resource + '!');
      return;
    }
  }

  // Spend the resources!
  for (const [resource, amount] of Object.entries(cost)) {
    inv[resource] -= amount;
  }
  updateInventoryUI();

  // LEVEL UP!
  campfireState.level++;
  campfireState.mapRadius = nextLevel.radius;

  // Update the fog wall
  updateFogWallRadius();

  // Spawn new enemies, chests, and pickups in the newly unlocked area!
  spawnEnemiesForNewZone(campfireState.level);
  spawnChestsForNewZone(campfireState.level);
  spawnPickupsForNewZone(campfireState.level);

  // Show celebration text!
  showLootText('Fire Level ' + campfireState.level + '! ' + nextLevel.label + '!');

  // Update UI
  updateFireUpgradeUI();
}

// Update the fire upgrade UI to show costs
function updateFireUpgradeUI() {
  const costEl = document.getElementById('fire-cost');
  if (!costEl) return;

  if (campfireState.level >= campfireState.maxLevel) {
    costEl.textContent = 'MAX LEVEL!';
    return;
  }

  const nextLevel = CAMPFIRE_LEVELS[campfireState.level];
  const cost = nextLevel.cost;
  const inv = playerState.inventory;

  // Build cost text like "5 bones, 3 fangs"
  let parts = [];
  for (const [resource, amount] of Object.entries(cost)) {
    const have = inv[resource] || 0;
    const color = have >= amount ? '#4ade80' : '#ff4444';
    parts.push('<span style="color:' + color + '">' + have + '/' + amount + ' ' + resource + '</span>');
  }
  costEl.innerHTML = parts.join(' &nbsp; ');

  // Update level display
  const levelEl = document.getElementById('fire-level');
  if (levelEl) levelEl.textContent = 'Fire Lv.' + campfireState.level;
}

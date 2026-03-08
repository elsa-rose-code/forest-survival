// ============================================
// CHESTS.JS - Loot chests scattered around!
// The farther from camp, the better the loot!
//
// 3 tiers:
//   Wooden (brown) - near base, basic loot
//   Gold - medium distance, good loot
//   Ruby (red) - far from base, best loot!
// ============================================

// --- CHEST SETTINGS ---
const CHEST_TYPES = {
  wooden: {
    name: 'Wooden Chest',
    color: 0x6b4423,       // Brown wood
    trimColor: 0x4a3020,   // Darker brown trim
    lockColor: 0x888888,   // Gray lock
    glowColor: null,       // No glow
    minDist: 15,           // Spawns near base
    maxDist: 50,
    // Wooden chests give basic EQUIPMENT!
    loot: [],
    equipmentLoot: ['oldFlashlight', 'giantSack', 'goodSack', 'goodAxe']
  },
  gold: {
    name: 'Gold Chest',
    color: 0xdaa520,       // Gold
    trimColor: 0xb8860b,   // Darker gold trim
    lockColor: 0xffd700,   // Shiny gold lock
    glowColor: 0xffdd44,   // Yellow glow
    minDist: 50,
    maxDist: 100,
    // Gold chests give EQUIPMENT too!
    loot: [],
    equipmentLoot: ['strongAxe', 'infernalSack', 'strongFlashlight', 'katana']
  },
  ruby: {
    name: 'Ruby Chest',
    color: 0xcc1144,       // Deep red
    trimColor: 0x990033,   // Dark red trim
    lockColor: 0xff2255,   // Bright red lock
    glowColor: 0xff4466,   // Red glow
    minDist: 100,
    maxDist: 160,
    // Ruby chests give EQUIPMENT instead of resources!
    loot: [],
    equipmentLoot: ['rubyArmor', 'tacticalShotgun', 'infernalHelmet', 'kunai']
  }
};

// All chests in the world
const chests = [];

// ============================================
// CREATE CHEST 3D MODEL
// A box with a lid, trim, and a lock!
// ============================================

function createChestMesh(type) {
  const chest = new THREE.Group();
  const config = CHEST_TYPES[type];

  const mainMat = new THREE.MeshLambertMaterial({ color: config.color });
  const trimMat = new THREE.MeshLambertMaterial({ color: config.trimColor });
  const lockMat = new THREE.MeshLambertMaterial({ color: config.lockColor });

  // BOTTOM half of the chest (the box part)
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.7), mainMat);
  bottom.position.y = 0.25;
  bottom.castShadow = true;
  chest.add(bottom);

  // Trim strips on the bottom
  const stripFront = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.04), trimMat);
  stripFront.position.set(0, 0.25, -0.36);
  chest.add(stripFront);
  const stripBack = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.04), trimMat);
  stripBack.position.set(0, 0.25, 0.36);
  chest.add(stripBack);

  // LID (top half - slightly curved look with a box)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.3, 0.74), mainMat);
  lid.position.y = 0.65;
  lid.castShadow = true;
  chest.add(lid);

  // Trim on top of lid
  const topStrip = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.04, 0.78), trimMat);
  topStrip.position.y = 0.81;
  chest.add(topStrip);

  // Side trims (vertical bands like metal straps)
  const bandL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.78), trimMat);
  bandL.position.set(-0.35, 0.41, 0);
  chest.add(bandL);
  const bandR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.78), trimMat);
  bandR.position.set(0.35, 0.41, 0);
  chest.add(bandR);

  // LOCK on the front
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.08), lockMat);
  lock.position.set(0, 0.45, -0.38);
  chest.add(lock);
  // Keyhole (tiny dark square)
  const keyhole = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.06, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
  );
  keyhole.position.set(0, 0.44, -0.43);
  chest.add(keyhole);

  // GLOW effect for gold and ruby chests
  if (config.glowColor) {
    const glow = new THREE.PointLight(config.glowColor, 0.8, 8);
    glow.position.y = 0.5;
    chest.add(glow);
    chest.userData.glow = glow;
  }

  return chest;
}

// ============================================
// SPAWN CHESTS ACROSS THE MAP
// ============================================

function spawnChests(scene) {
  // At start, map is small - only spawn wooden chests in zone 1!
  // More chests get added when you upgrade the campfire
  for (let i = 0; i < 5; i++) {
    spawnChest(scene, 'wooden');
  }
  // Gold and ruby chests will spawn when the map expands!
}

// Spawn new chests when the map expands!
function spawnChestsForNewZone(level) {
  if (level === 2) {
    // Zone 2: More wooden chests
    for (let i = 0; i < 4; i++) spawnChest(scene, 'wooden');
  } else if (level === 3) {
    // Zone 3: Gold chests appear!
    for (let i = 0; i < 3; i++) spawnChest(scene, 'wooden');
    for (let i = 0; i < 4; i++) spawnChest(scene, 'gold');
  } else if (level === 4) {
    // Deep forest: Ruby chests appear!
    for (let i = 0; i < 3; i++) spawnChest(scene, 'gold');
    for (let i = 0; i < 2; i++) spawnChest(scene, 'ruby');
  } else if (level === 5) {
    // Full map: More ruby chests
    for (let i = 0; i < 2; i++) spawnChest(scene, 'gold');
    for (let i = 0; i < 3; i++) spawnChest(scene, 'ruby');
  }
}

function spawnChest(scene, type) {
  const config = CHEST_TYPES[type];

  // Find a random position in the right distance zone
  const angle = Math.random() * Math.PI * 2;
  // Clamp to current map radius so chests don't spawn outside the fog wall
  const maxDist = Math.min(config.maxDist, campfireState.mapRadius - 5);
  if (maxDist <= config.minDist) return; // This zone isn't unlocked yet!
  const dist = config.minDist + Math.random() * (maxDist - config.minDist);
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  // Don't spawn inside the safe zone
  if (isInSafeZone(x, z)) return;

  const mesh = createChestMesh(type);
  mesh.position.set(x, 0, z);
  // Random rotation so they're not all facing the same way
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  chests.push({
    type: type,
    mesh: mesh,
    opened: false,
    config: config
  });
}

// ============================================
// OPEN CHESTS (press E when nearby!)
// ============================================

const CHEST_OPEN_RANGE = 3; // How close you need to be

function checkChestOpen() {
  for (const chest of chests) {
    if (chest.opened) continue;

    const dx = playerState.position.x - chest.mesh.position.x;
    const dz = playerState.position.z - chest.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < CHEST_OPEN_RANGE) {
      openChest(chest);
      return; // Only open one at a time
    }
  }
}

function openChest(chest) {
  chest.opened = true;

  // Animate the lid opening (tilt it back)
  // Find the lid mesh (the one at y=0.65)
  chest.mesh.children.forEach(child => {
    if (child.position.y >= 0.6 && child.position.y <= 0.7) {
      // This is the lid - tilt it back to "open"
      child.rotation.x = -1.2;
      child.position.y = 0.8;
      child.position.z = 0.3;
    }
  });

  // Remove glow
  if (chest.mesh.userData.glow) {
    chest.mesh.userData.glow.intensity = 0;
  }

  // Give the player loot!
  let lootText = '';

  // Ruby chests give EQUIPMENT items
  if (chest.config.equipmentLoot && chest.config.equipmentLoot.length > 0) {
    // Pick a random item from the equipment pool
    const pool = chest.config.equipmentLoot;
    const itemId = pool[Math.floor(Math.random() * pool.length)];
    const item = ITEMS[itemId];

    if (item) {
      const success = equipItem(itemId);
      if (success) {
        lootText = item.name + '!';
      } else {
        lootText = 'Inventory full!';
      }
    }
  } else {
    // Normal resource loot (wooden/gold chests)
    const lootTable = chest.config.loot;
    for (const item of lootTable) {
      const amount = item.min + Math.floor(Math.random() * (item.max - item.min + 1));
      if (amount > 0) {
        playerState.inventory[item.type] += amount;
        if (lootText) lootText += ', ';
        lootText += '+' + amount + ' ' + item.type;
      }
    }
    updateInventoryUI();
  }

  // Show what you got!
  showLootText(chest.config.name + '! ' + lootText);

  // Fade out the chest after a few seconds
  setTimeout(() => {
    if (chest.mesh.parent) {
      chest.mesh.parent.remove(chest.mesh);
    }
  }, 3000);
}

// ============================================
// UPDATE CHESTS (glow animation + "Press E" prompt)
// ============================================

function updateChests(delta, playerPosition) {
  let nearChest = false;

  for (const chest of chests) {
    if (chest.opened) continue;

    // Distance to player
    const dx = playerPosition.x - chest.mesh.position.x;
    const dz = playerPosition.z - chest.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Glow pulse animation for gold/ruby chests
    if (chest.mesh.userData.glow) {
      chest.mesh.userData.glow.intensity = 0.5 + Math.sin(totalTime * 3) * 0.3;
    }

    // Show "Press E" prompt when nearby
    if (dist < CHEST_OPEN_RANGE) {
      nearChest = true;
    }
  }

  // Show/hide the "Press E to open" prompt
  const prompt = document.getElementById('chest-prompt');
  if (prompt) {
    prompt.style.display = nearChest ? 'block' : 'none';
  }
}

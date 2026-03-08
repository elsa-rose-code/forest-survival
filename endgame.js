// ============================================
// ENDGAME.JS - Late-game features!
// Night ranks, crafted weapons, dawn chests,
// difficulty modes, the 99th night, victory
// parade, music box, and torch relay.
// ============================================

// ============================================
// ENDGAME STATE
// Central state for all endgame systems
// ============================================

const endgameState = {
  // Night ranks (#35)
  currentRank: 'Newcomer',
  rankColor: '#ffffff',
  previousRank: '',

  // Crafted weapons (#36)
  projectiles: [],

  // Dawn chest (#37)
  dawnChest: null,
  dawnChestOpened: false,
  dawnChestSparkles: [],

  // Difficulty (#38)
  difficulty: 'normal',
  difficultyMultipliers: { damage: 1, chests: 1, dayLength: 1, healRate: 1, enemySpeed: 1 },

  // Night 99 (#39)
  night99Active: false,
  night99FogTimer: 0,
  night99OriginalRadius: 0,

  // Victory parade (#40)
  fireworks: [],
  victoryTriggered: false,
  victoryTimer: 0,
  victoryCamPullback: false,
  stats: { enemiesKilled: 0, chestsOpened: 0, distanceWalked: 0 },
  lastPlayerPos: null,

  // Music box (#44)
  musicBoxActive: false,
  musicBoxCooldown: 0,
  musicBoxSlowZone: null,
  musicBoxTimer: 0,
  musicBoxNotes: [],
  audioCtx: null,

  // Torch relay (#22-torch)
  torchRelay: {
    active: false,
    beacons: [],
    playerHasFlame: false,
    flameMesh: null,
    flameLight: null,
    lastRelayNight: 0,
    allLitThisRelay: false
  }
};


// ============================================
// ENDGAME INIT
// Call once after the scene is ready
// ============================================

function initEndgame() {
  injectEndgameCSS();
  injectEndgameDOMElements();

  // Hook into the kill function to track stats
  const originalKillEnemy = window.killEnemy;
  window.killEnemy = function(enemy) {
    endgameState.stats.enemiesKilled++;
    originalKillEnemy(enemy);
  };

  // Hook into chest opening to track stats
  const originalOpenChest = window.openChest;
  window.openChest = function(chest) {
    endgameState.stats.chestsOpened++;
    originalOpenChest(chest);
  };

  // Register crafted weapon recipes
  registerEndgameRecipes();

  console.log('Endgame systems initialized.');
}


// ============================================
// ENDGAME UPDATE
// Call every frame from the game loop
// ============================================

function updateEndgame(delta) {
  // Track distance walked
  if (endgameState.lastPlayerPos) {
    const dx = playerState.position.x - endgameState.lastPlayerPos.x;
    const dz = playerState.position.z - endgameState.lastPlayerPos.z;
    endgameState.stats.distanceWalked += Math.sqrt(dx * dx + dz * dz);
  }
  endgameState.lastPlayerPos = { x: playerState.position.x, z: playerState.position.z };

  // #35 - Night ranks
  updateNightRank();

  // #36 - Projectiles from crafted weapons
  updateProjectiles(delta);

  // #37 - Dawn reward chest
  updateDawnChest(delta);

  // #39 - The 99th night
  updateNight99(delta);

  // #40 - Victory parade
  updateVictoryParade(delta);

  // #44 - Music box
  updateMusicBox(delta);

  // #22-torch - Torch relay
  updateTorchRelay(delta);
}


// ============================================
// #35 - NIGHT RANK TITLES
// The higher the night count, the more
// impressive your rank title becomes.
// ============================================

const NIGHT_RANKS = [
  { min: 99, name: 'The Undying',         color: '#ff0000', glow: true, pulse: true },
  { min: 75, name: 'Nightmare Survivor',  color: '#ff4444', glow: false, pulse: false },
  { min: 50, name: 'Dark Forest Legend',  color: '#ffd700', glow: true, pulse: false },
  { min: 30, name: 'Shadow Dancer',       color: '#aa44ff', glow: false, pulse: false },
  { min: 15, name: 'Night Walker',        color: '#4488ff', glow: false, pulse: false },
  { min: 5,  name: 'Forest Newbie',       color: '#ffffff', glow: false, pulse: false },
  { min: 1,  name: 'Newcomer',            color: '#ffffff', glow: false, pulse: false }
];

function updateNightRank() {
  const count = dayNightState.nightCount;

  // Determine current rank based on night count
  let newRank = NIGHT_RANKS[NIGHT_RANKS.length - 1]; // default: Newcomer
  for (const rank of NIGHT_RANKS) {
    if (count >= rank.min) {
      newRank = rank;
      break;
    }
  }

  const oldRank = endgameState.currentRank;
  endgameState.currentRank = newRank.name;
  endgameState.rankColor = newRank.color;

  // Update the rank display element
  const rankEl = document.getElementById('rank-display');
  if (rankEl) {
    rankEl.textContent = newRank.name;
    rankEl.style.color = newRank.color;

    // Glow effect for high ranks
    if (newRank.glow) {
      rankEl.style.textShadow = '0 0 12px ' + newRank.color + ', 0 0 24px ' + newRank.color;
    } else {
      rankEl.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';
    }

    // Pulsing animation for The Undying
    if (newRank.pulse) {
      rankEl.classList.add('rank-pulse');
    } else {
      rankEl.classList.remove('rank-pulse');
    }
  }

  // Rank-up announcement when the rank changes
  if (oldRank !== '' && oldRank !== newRank.name && endgameState.previousRank !== '') {
    showRankUpAnnouncement(newRank.name, newRank.color);
  }
  endgameState.previousRank = newRank.name;

  // Sync rank with multiplayer (display above other player meshes)
  syncRankMultiplayer(newRank);
}

function showRankUpAnnouncement(rankName, color) {
  const el = document.getElementById('rank-announce');
  if (!el) return;

  el.innerHTML = 'Rank up! <span style="color:' + color + '">' + rankName + '</span>';
  el.style.display = 'block';
  el.classList.add('rank-announce-active');

  setTimeout(() => {
    el.classList.remove('rank-announce-active');
    el.style.display = 'none';
  }, 3500);
}

function syncRankMultiplayer(rank) {
  // If multiplayer is active, send rank to server for display above player mesh
  if (typeof socket !== 'undefined' && mpState && mpState.inGame) {
    socket.emit('playerUpdate', {
      x: playerState.position.x,
      y: 0,
      z: playerState.position.z,
      rotationY: playerState.mesh ? playerState.mesh.rotation.y : playerState.yaw,
      isSwinging: playerState.isSwinging,
      rank: rank.name,
      rankColor: rank.color
    });
  }
}


// ============================================
// #36 - CRAFT-A-WEAPON WORKSHOP
// New recipes for the crafting table.
// Bone Bow, Gem Staff, Fang Dagger, Crystal Torch
// ============================================

function registerEndgameRecipes() {
  // --- Register new items in the ITEMS object ---
  ITEMS.boneBow = {
    name: 'Bone Bow',
    type: 'weapon',
    description: 'A bow carved from bones. Fires arrows at range.',
    damage: 25,
    range: 15,
    cooldown: 0.8,
    ranged: true,
    projectileType: 'arrow',
    color: '#ddccaa',
    iconClass: 'icon-bonebow'
  };

  ITEMS.gemStaff = {
    name: 'Gem Staff',
    type: 'weapon',
    description: 'A staff topped with a glowing gem. Fires magic bolts.',
    damage: 20,
    range: 12,
    cooldown: 0.6,
    ranged: true,
    projectileType: 'magic',
    color: '#4488ff',
    iconClass: 'icon-gemstaff'
  };

  ITEMS.fangDagger = {
    name: 'Fang Dagger',
    type: 'weapon',
    description: 'A dagger made from wolf fangs. Incredibly fast.',
    damage: 18,
    range: 2.5,
    cooldown: 0.2,
    color: '#cccccc',
    iconClass: 'icon-fangdagger'
  };

  ITEMS.crystalTorch = {
    name: 'Crystal Torch',
    type: 'weapon',
    description: 'A torch infused with crystal light. Burns and illuminates.',
    damage: 22,
    range: 3.5,
    cooldown: 0.5,
    emitsLight: true,
    color: '#ff6644',
    iconClass: 'icon-crystaltorch'
  };

  ITEMS.musicBox = {
    name: 'Music Box',
    type: 'utility',
    description: 'A delicate music box. Plays a lullaby that slows nearby enemies.',
    color: '#eedd88',
    iconClass: 'icon-musicbox'
  };

  // --- Register crafting recipes ---
  CRAFT_RECIPES.boneBow = {
    name: 'Bone Bow',
    grinderLevel: 2,
    cost: { bones: 5, wood: 2 },
    description: 'Ranged bow. 25 dmg, fires arrows.',
    maxCount: 1,
    isEquipment: true,
    itemId: 'boneBow'
  };

  CRAFT_RECIPES.gemStaff = {
    name: 'Gem Staff',
    grinderLevel: 2,
    cost: { gems: 3, wood: 1 },
    description: 'Magic staff. 20 dmg, fires bolts.',
    maxCount: 1,
    isEquipment: true,
    itemId: 'gemStaff'
  };

  CRAFT_RECIPES.fangDagger = {
    name: 'Fang Dagger',
    grinderLevel: 2,
    cost: { fangs: 4, wood: 1 },
    description: 'Fastest weapon. 18 dmg, 0.2s cooldown.',
    maxCount: 1,
    isEquipment: true,
    itemId: 'fangDagger'
  };

  CRAFT_RECIPES.crystalTorch = {
    name: 'Crystal Torch',
    grinderLevel: 2,
    cost: { gems: 2, coal: 2 },
    description: 'Burns enemies and emits light. 22 dmg.',
    maxCount: 1,
    isEquipment: true,
    itemId: 'crystalTorch'
  };

  // Initialize craft counts for new recipes
  craftCounts.boneBow = 0;
  craftCounts.gemStaff = 0;
  craftCounts.fangDagger = 0;
  craftCounts.crystalTorch = 0;

  // Override the craftItem function to handle equipment recipes
  const originalCraftItem = window.craftItem;
  window.craftItem = function(itemId) {
    const recipe = CRAFT_RECIPES[itemId];
    if (recipe && recipe.isEquipment) {
      // Custom crafting logic for equipment recipes
      if (recipe.grinderLevel > craftingState.grinderLevel) {
        showLootText('Upgrade your Grinder first!');
        return;
      }
      if (craftCounts[itemId] >= recipe.maxCount) {
        showLootText(recipe.name + ' already crafted!');
        return;
      }
      if (!checkCanAfford(recipe.cost)) {
        showLootText('Not enough resources!');
        return;
      }

      spendResources(recipe.cost);
      craftCounts[itemId]++;

      // Equip the crafted weapon/item
      const success = equipItem(recipe.itemId);
      if (success) {
        showLootText(recipe.name + ' crafted and equipped!');
      } else {
        showLootText(recipe.name + ' crafted but inventory full!');
      }
      updateCraftingUI();
      return;
    }

    // Fall through to original for beds, sundial, map, etc.
    originalCraftItem(itemId);
  };

  // Add crafting buttons to the UI dynamically
  addCraftingButtons();

  // Override useEquippedWeapon to support ranged projectiles
  const originalUseEquippedWeapon = window.useEquippedWeapon;
  window.useEquippedWeapon = function() {
    const slot = playerState.selectedSlot;
    const equip = playerState.equipment[slot];

    // Handle ranged weapons (bow and staff)
    if (equip && equip.ranged) {
      if (playerState.swingCooldown > 0) return;
      if (!playerState.alive) return;

      playerState.swingCooldown = equip.cooldown;

      // Fire a projectile
      fireProjectile(equip);

      // Animate arm
      if (playerState.mesh && playerState.mesh.userData.armR) {
        playerState.mesh.userData.armR.rotation.x = -1.2;
        setTimeout(() => {
          if (playerState.mesh && playerState.mesh.userData.armR) {
            playerState.mesh.userData.armR.rotation.x = 0;
          }
        }, 200);
      }
      return;
    }

    // Fall through for melee weapons
    originalUseEquippedWeapon();
  };

  // Override createWeaponMesh to handle new weapon types
  const originalCreateWeaponMesh = window.createWeaponMesh;
  window.createWeaponMesh = function(itemId) {
    if (itemId === 'boneBow') {
      return createBoneBowMesh();
    } else if (itemId === 'gemStaff') {
      return createGemStaffMesh();
    } else if (itemId === 'fangDagger') {
      return createFangDaggerMesh();
    } else if (itemId === 'crystalTorch') {
      return createCrystalTorchMesh();
    } else if (itemId === 'musicBox') {
      return createMusicBoxMesh();
    }
    return originalCreateWeaponMesh(itemId);
  };
}

// --- Crafting button injection ---
function addCraftingButtons() {
  const recipesContainer = document.querySelector('.crafting-recipes');
  if (!recipesContainer) return;

  const weaponRecipes = ['boneBow', 'gemStaff', 'fangDagger', 'crystalTorch'];
  for (const id of weaponRecipes) {
    const recipe = CRAFT_RECIPES[id];
    if (!recipe) continue;
    // Check if button already exists
    if (document.getElementById('craft-' + id)) continue;

    const btn = document.createElement('button');
    btn.id = 'craft-' + id;
    btn.className = 'craft-btn';
    btn.textContent = recipe.name + ' - ' + formatCost(recipe.cost);
    btn.onclick = () => craftItem(id);
    recipesContainer.appendChild(btn);
  }
}

// --- New weapon 3D meshes ---

function createBoneBowMesh() {
  const weapon = new THREE.Group();
  // Bow body (curved bone shape approximated with a torus arc)
  const bowMat = new THREE.MeshLambertMaterial({ color: 0xddccaa });
  const bowBody = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 12, Math.PI), bowMat);
  bowBody.position.set(0, 0.3, -0.2);
  bowBody.rotation.z = Math.PI / 2;
  weapon.add(bowBody);
  // Bowstring
  const stringMat = new THREE.MeshBasicMaterial({ color: 0x886644 });
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.7, 0.01), stringMat);
  string.position.set(0, 0.3, -0.2);
  weapon.add(string);
  // Arrow notched
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0x554433 });
  const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.5), arrowMat);
  arrow.position.set(0, 0.3, -0.2);
  weapon.add(arrow);
  // Arrow tip
  const tipMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), tipMat);
  tip.position.set(0, 0.3, -0.47);
  tip.rotation.x = Math.PI / 2;
  weapon.add(tip);

  weapon.position.set(0.46, 1.0, -0.2);
  return weapon;
}

function createGemStaffMesh() {
  const weapon = new THREE.Group();
  // Staff shaft
  const shaftMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 6), shaftMat);
  shaft.position.set(0, 0.3, -0.15);
  weapon.add(shaft);
  // Gem on top (glowing blue sphere)
  const gemMat = new THREE.MeshBasicMaterial({ color: 0x4488ff });
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), gemMat);
  gem.position.set(0, 0.92, -0.15);
  weapon.add(gem);
  // Gem glow light
  const gemLight = new THREE.PointLight(0x4488ff, 0.6, 5);
  gemLight.position.set(0, 0.92, -0.15);
  weapon.add(gemLight);
  // Prongs holding the gem
  const prongMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), prongMat);
    prong.position.set(Math.cos(angle) * 0.05, 0.85, -0.15 + Math.sin(angle) * 0.05);
    prong.rotation.z = Math.cos(angle) * 0.3;
    weapon.add(prong);
  }

  weapon.position.set(0.46, 1.0, -0.2);
  return weapon;
}

function createFangDaggerMesh() {
  const weapon = new THREE.Group();
  // Blade (fang-shaped, white and curved)
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 4), bladeMat);
  blade.position.set(0, 0.35, -0.15);
  blade.rotation.x = -Math.PI / 2;
  weapon.add(blade);
  // Handle (wrapped in leather)
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x553322 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), handleMat);
  handle.position.set(0, 0.08, -0.15);
  weapon.add(handle);
  // Guard (small cross piece made from a fang)
  const guardMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.06), guardMat);
  guard.position.set(0, 0.18, -0.15);
  weapon.add(guard);

  weapon.position.set(0.46, 1.0, -0.2);
  return weapon;
}

function createCrystalTorchMesh() {
  const weapon = new THREE.Group();
  // Handle
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.6, 6), handleMat);
  handle.position.set(0, 0.1, -0.15);
  weapon.add(handle);
  // Crystal head (orange emissive)
  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xff6644 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), crystalMat);
  crystal.position.set(0, 0.5, -0.15);
  weapon.add(crystal);
  // Flame-like glow above
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.7 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), flameMat);
  flame.position.set(0, 0.7, -0.15);
  weapon.add(flame);
  // PointLight for illumination (the special feature of crystal torch)
  const torchLight = new THREE.PointLight(0xff6644, 1.2, 15);
  torchLight.position.set(0, 0.6, -0.15);
  weapon.add(torchLight);
  weapon.userData.torchLight = torchLight;

  weapon.position.set(0.46, 1.0, -0.2);
  return weapon;
}

function createMusicBoxMesh() {
  const weapon = new THREE.Group();
  // Box body (small ornate wooden box)
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.15), boxMat);
  box.position.set(0, 0.15, -0.15);
  weapon.add(box);
  // Lid (slightly open)
  const lidMat = new THREE.MeshLambertMaterial({ color: 0xa0822a });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.15), lidMat);
  lid.position.set(0, 0.23, -0.12);
  lid.rotation.x = -0.4;
  weapon.add(lid);
  // Gold trim
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xeedd88 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.17), trimMat);
  trim.position.set(0, 0.21, -0.15);
  weapon.add(trim);
  // Tiny gem on the lid
  const gemMat = new THREE.MeshBasicMaterial({ color: 0x44ddff });
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), gemMat);
  gem.position.set(0, 0.25, -0.18);
  weapon.add(gem);

  weapon.position.set(0.46, 1.0, -0.2);
  return weapon;
}


// --- Projectile system ---

function fireProjectile(equip) {
  if (!scene) return;

  const lookDir = new THREE.Vector3(
    -Math.sin(playerState.yaw), 0, -Math.cos(playerState.yaw)
  );

  // Spawn position slightly in front of the player
  const startPos = playerState.position.clone();
  startPos.y = 1.2;
  startPos.add(lookDir.clone().multiplyScalar(1.5));

  let mesh;
  if (equip.projectileType === 'arrow') {
    // Arrow projectile: thin brown cylinder
    const mat = new THREE.MeshLambertMaterial({ color: 0x554433 });
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), mat);
    // Arrow tip
    const tipMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), tipMat);
    tip.position.z = -0.35;
    tip.rotation.x = Math.PI / 2;
    mesh.add(tip);
  } else if (equip.projectileType === 'magic') {
    // Magic bolt: glowing blue sphere
    const mat = new THREE.MeshBasicMaterial({ color: 0x4488ff });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
    // Glow light
    const light = new THREE.PointLight(0x4488ff, 0.8, 6);
    mesh.add(light);
  }

  if (!mesh) return;

  mesh.position.copy(startPos);
  // Rotate to face forward
  mesh.rotation.y = playerState.yaw;
  scene.add(mesh);

  endgameState.projectiles.push({
    mesh: mesh,
    velocity: lookDir.clone().multiplyScalar(30), // Speed of the projectile
    damage: equip.damage,
    maxRange: equip.range,
    distanceTraveled: 0,
    origin: startPos.clone()
  });
}

function updateProjectiles(delta) {
  for (let i = endgameState.projectiles.length - 1; i >= 0; i--) {
    const proj = endgameState.projectiles[i];

    // Move the projectile forward
    const move = proj.velocity.clone().multiplyScalar(delta);
    proj.mesh.position.add(move);
    proj.distanceTraveled += move.length();

    // Check if max range exceeded
    if (proj.distanceTraveled >= proj.maxRange) {
      removeProjectile(i);
      continue;
    }

    // Check for enemy hits
    let hit = false;
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;

      const dx = enemy.mesh.position.x - proj.mesh.position.x;
      const dz = enemy.mesh.position.z - proj.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Hit detection radius (generous for arrows/bolts)
      if (dist < 1.5) {
        damageEnemy(enemy, proj.damage);
        hit = true;
        break;
      }
    }

    if (hit) {
      removeProjectile(i);
    }
  }
}

function removeProjectile(index) {
  const proj = endgameState.projectiles[index];
  if (proj.mesh.parent) {
    proj.mesh.parent.remove(proj.mesh);
  }
  endgameState.projectiles.splice(index, 1);
}


// ============================================
// #37 - DAWN REWARD CHEST
// A golden-orange chest appears near the
// campfire when day breaks. Sparkles and all.
// ============================================

function updateDawnChest(delta) {
  // Spawn chest when day breaks
  if (dayNightState.justBecameDay && !endgameState.dawnChest) {
    spawnDawnChest();
  }

  // Despawn chest when night falls
  if (dayNightState.justBecameNight && endgameState.dawnChest) {
    despawnDawnChest();
  }

  // Animate sparkle particles
  if (endgameState.dawnChest && endgameState.dawnChestSparkles.length > 0) {
    for (let i = 0; i < endgameState.dawnChestSparkles.length; i++) {
      const sparkle = endgameState.dawnChestSparkles[i];
      // Orbit around the chest
      sparkle.angle += delta * (2 + i * 0.5);
      sparkle.mesh.position.x = endgameState.dawnChest.mesh.position.x + Math.cos(sparkle.angle) * 0.8;
      sparkle.mesh.position.z = endgameState.dawnChest.mesh.position.z + Math.sin(sparkle.angle) * 0.8;
      sparkle.mesh.position.y = 0.6 + Math.sin(sparkle.angle * 2 + i) * 0.3;
      // Rotate the sparkle
      sparkle.mesh.rotation.y += delta * 3;
      sparkle.mesh.rotation.x += delta * 2;
    }
  }

  // Check for player interaction (Press E to open)
  if (endgameState.dawnChest && !endgameState.dawnChestOpened) {
    const dx = playerState.position.x - endgameState.dawnChest.mesh.position.x;
    const dz = playerState.position.z - endgameState.dawnChest.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const prompt = document.getElementById('dawn-chest-prompt');
    if (dist < 3 && prompt) {
      prompt.style.display = 'block';
    } else if (prompt) {
      prompt.style.display = 'none';
    }
  }
}

function spawnDawnChest() {
  if (!scene) return;

  const chestGroup = new THREE.Group();

  // Chest body (golden-orange)
  const mainMat = new THREE.MeshLambertMaterial({ color: 0xff8844 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xcc6633 });

  // Bottom
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), mainMat);
  bottom.position.y = 0.2;
  bottom.castShadow = true;
  chestGroup.add(bottom);

  // Lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.25, 0.64), mainMat);
  lid.position.y = 0.52;
  lid.castShadow = true;
  chestGroup.add(lid);

  // Trim bands
  const bandL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.64), trimMat);
  bandL.position.set(-0.28, 0.33, 0);
  chestGroup.add(bandL);
  const bandR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.64), trimMat);
  bandR.position.set(0.28, 0.33, 0);
  chestGroup.add(bandR);

  // Lock (shiny gold)
  const lockMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), lockMat);
  lock.position.set(0, 0.38, -0.32);
  chestGroup.add(lock);

  // Sparkle PointLight
  const sparkleLight = new THREE.PointLight(0xff8844, 1.0, 8);
  sparkleLight.position.y = 0.8;
  chestGroup.add(sparkleLight);

  // Position near campfire
  chestGroup.position.set(2, 0, -2);
  scene.add(chestGroup);

  // Create orbiting sparkle particles (3-4 small meshes)
  const sparkles = [];
  for (let i = 0; i < 4; i++) {
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: [0xffd700, 0xff8844, 0xffee88, 0xffcc44][i],
      transparent: true,
      opacity: 0.8
    });
    const sparkleMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.06, 0),
      sparkleMat
    );
    sparkleMesh.position.set(
      chestGroup.position.x + Math.cos(i) * 0.8,
      0.6,
      chestGroup.position.z + Math.sin(i) * 0.8
    );
    scene.add(sparkleMesh);
    sparkles.push({
      mesh: sparkleMesh,
      angle: (i / 4) * Math.PI * 2
    });
  }

  endgameState.dawnChest = {
    mesh: chestGroup,
    sparkleLight: sparkleLight
  };
  endgameState.dawnChestSparkles = sparkles;
  endgameState.dawnChestOpened = false;

  showLootText('A Dawn Chest has appeared near the campfire!');
}

function despawnDawnChest() {
  if (!endgameState.dawnChest) return;

  // Remove the chest mesh
  if (endgameState.dawnChest.mesh && endgameState.dawnChest.mesh.parent) {
    endgameState.dawnChest.mesh.parent.remove(endgameState.dawnChest.mesh);
  }

  // Remove sparkles
  for (const sparkle of endgameState.dawnChestSparkles) {
    if (sparkle.mesh.parent) sparkle.mesh.parent.remove(sparkle.mesh);
  }
  endgameState.dawnChestSparkles = [];
  endgameState.dawnChest = null;

  const prompt = document.getElementById('dawn-chest-prompt');
  if (prompt) prompt.style.display = 'none';
}

function openDawnChest() {
  if (!endgameState.dawnChest || endgameState.dawnChestOpened) return;

  const dx = playerState.position.x - endgameState.dawnChest.mesh.position.x;
  const dz = playerState.position.z - endgameState.dawnChest.mesh.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 3) return;

  endgameState.dawnChestOpened = true;
  endgameState.stats.chestsOpened++;

  // Hide prompt
  const prompt = document.getElementById('dawn-chest-prompt');
  if (prompt) prompt.style.display = 'none';

  // Remove sparkle light
  if (endgameState.dawnChest.sparkleLight) {
    endgameState.dawnChest.sparkleLight.intensity = 0;
  }

  // Random loot table
  const lootTable = [
    { resource: 'wood', amount: 3, text: '+3 wood' },
    { resource: 'coal', amount: 2, text: '+2 coal' },
    { resource: 'gems', amount: 1, text: '+1 gem' },
    { resource: 'wood', amount: 5, text: '+5 wood' },
    { resource: 'meat', amount: 2, text: '+2 meat' }
  ];

  // 20% chance of a random pelt instead
  if (Math.random() < 0.2) {
    const pelts = ['bunnyFoot', 'wolfPelt', 'alphaWolfPelt'];
    const peltType = pelts[Math.floor(Math.random() * pelts.length)];
    playerState.inventory[peltType] = (playerState.inventory[peltType] || 0) + 1;
    const peltNames = { bunnyFoot: 'Bunny Foot', wolfPelt: 'Wolf Pelt', alphaWolfPelt: 'Alpha Wolf Pelt' };
    showLootText('Dawn Chest! +1 ' + (peltNames[peltType] || peltType));
  } else {
    const loot = lootTable[Math.floor(Math.random() * lootTable.length)];
    playerState.inventory[loot.resource] += loot.amount;
    showLootText('Dawn Chest! ' + loot.text);
  }

  updateInventoryUI();

  // Fade out chest after a moment
  setTimeout(() => {
    despawnDawnChest();
  }, 2000);
}


// ============================================
// #38 - DIFFICULTY MODES
// Three modes: cozy, normal, eternal
// Applied at game start, affects multipliers
// ============================================

function applyDifficultyMode(mode) {
  endgameState.difficulty = mode || 'normal';

  switch (endgameState.difficulty) {
    case 'cozy':
      endgameState.difficultyMultipliers = {
        damage: 0.5,
        chests: 2,
        dayLength: 1.5,
        healRate: 1.5,
        enemySpeed: 1
      };
      break;

    case 'eternal':
      endgameState.difficultyMultipliers = {
        damage: 1.5,
        chests: 0.5,
        dayLength: 0.7,
        healRate: 1,
        enemySpeed: 1.2
      };
      break;

    case 'normal':
    default:
      endgameState.difficultyMultipliers = {
        damage: 1,
        chests: 1,
        dayLength: 1,
        healRate: 1,
        enemySpeed: 1
      };
      break;
  }

  // Apply the difficulty badge in the HUD
  const badge = document.getElementById('difficulty-badge');
  if (badge) {
    const labels = {
      cozy: 'COZY',
      normal: 'NORMAL',
      eternal: 'ETERNAL'
    };
    const colors = {
      cozy: '#88ddaa',
      normal: '#ffffff',
      eternal: '#ff4444'
    };
    badge.textContent = labels[endgameState.difficulty] || 'NORMAL';
    badge.style.color = colors[endgameState.difficulty] || '#ffffff';
    badge.style.display = 'block';

    if (endgameState.difficulty === 'eternal') {
      badge.style.textShadow = '0 0 8px #ff4444, 0 0 16px #ff0000';
    } else if (endgameState.difficulty === 'cozy') {
      badge.style.textShadow = '0 0 8px #88ddaa';
    } else {
      badge.style.textShadow = 'none';
    }
  }

  // Override damagePlayer to apply damage multiplier
  const originalDamagePlayer = window.damagePlayer;
  window.damagePlayer = function(amount) {
    originalDamagePlayer(amount * endgameState.difficultyMultipliers.damage);
  };

  // Apply enemy speed multiplier by patching updateEnemies
  // (enemies will check endgameState.difficultyMultipliers.enemySpeed for their speed)
  if (endgameState.difficulty === 'eternal') {
    // Increase all existing enemy speeds by 20%
    for (const enemy of enemies) {
      enemy.speed *= 1.2;
    }
  }
}


// ============================================
// #39 - THE 99TH NIGHT
// When nightCount reaches 99, all hell breaks
// loose. Blood-red sky, closing fog wall,
// double enemy spawns, campfire flickers.
// ============================================

function updateNight99(delta) {
  // Trigger on night 99
  if (dayNightState.nightCount === 99 && dayNightState.isNight && !endgameState.night99Active) {
    startNight99();
  }

  // Deactivate when night 99 ends (dawn arrives)
  if (endgameState.night99Active && dayNightState.justBecameDay) {
    endNight99();
    return;
  }

  if (!endgameState.night99Active) return;

  // --- Blood-red sky override ---
  if (sky && sky.material) {
    sky.material.color.setHex(0x330000);
  }

  // --- Fog wall closing in ---
  endgameState.night99FogTimer += delta;
  campfireState.mapRadius = Math.max(
    SAFE_ZONE_RADIUS + 5,
    endgameState.night99OriginalRadius - (endgameState.night99FogTimer * 0.1)
  );
  // Update the fog wall visually
  updateFogWallRadius();

  // --- Campfire flickers dangerously ---
  if (campfire && campfire.userData && campfire.userData.fireLight) {
    campfire.userData.fireLight.intensity = 0.3 + Math.random() * 1.5;
  }

  // --- Check for special golden victory during night 99 ---
  if (kidState.rescued >= kidState.totalKids && !endgameState.victoryTriggered) {
    triggerNight99Victory();
  }
}

function startNight99() {
  endgameState.night99Active = true;
  endgameState.night99FogTimer = 0;
  endgameState.night99OriginalRadius = campfireState.mapRadius;

  // Show the ominous message
  const msgEl = document.getElementById('night99-message');
  if (msgEl) {
    msgEl.textContent = 'THE FOREST IS WAKING UP';
    msgEl.style.display = 'block';
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 5000);
  }

  // Double enemy spawn rate by spawning a huge wave
  if (scene) {
    const mapR = campfireState.mapRadius;
    for (let i = 0; i < 10; i++) {
      const pos = randomPositionInZone(SAFE_ZONE_RADIUS + 5, Math.max(SAFE_ZONE_RADIUS + 10, mapR - 5));
      const types = ['wolf', 'alphaWolf', 'deer', 'bear', 'cultist'];
      const type = types[Math.floor(Math.random() * types.length)];
      spawnEnemy(scene, type, pos.x, pos.z);
    }
  }
}

function endNight99() {
  endgameState.night99Active = false;

  // Restore the map radius
  campfireState.mapRadius = endgameState.night99OriginalRadius;
  updateFogWallRadius();

  // Restore campfire light
  if (campfire && campfire.userData && campfire.userData.fireLight) {
    const levelScale = 1 + (campfireState.level - 1) * 0.3;
    campfire.userData.fireLight.intensity = 1.5 * levelScale;
  }
}

function triggerNight99Victory() {
  // Special golden victory for rescuing the last kid on night 99
  const victory = document.getElementById('victory-screen');
  if (victory) {
    victory.style.display = 'flex';
    const sub = victory.querySelector('.victory-sub');
    if (sub) {
      sub.textContent = 'All kids rescued on the 99th Night! A true legend!';
      sub.style.color = '#ffd700';
    }
    const text = victory.querySelector('.victory-text');
    if (text) {
      text.style.color = '#ffd700';
      text.style.textShadow = '0 0 30px #ffd700, 0 0 60px #ff8800';
    }
  }
  triggerVictoryParade();
}


// ============================================
// #40 - VICTORY PARADE
// When the game is won, camera pulls back,
// fireworks launch, kids jump, stats appear.
// ============================================

function triggerVictoryParade() {
  if (endgameState.victoryTriggered) return;
  endgameState.victoryTriggered = true;
  endgameState.victoryTimer = 0;
  endgameState.victoryCamPullback = true;
}

function updateVictoryParade(delta) {
  if (!endgameState.victoryTriggered) return;

  endgameState.victoryTimer += delta;

  // --- Camera pull-back over 3 seconds ---
  if (endgameState.victoryCamPullback && camera) {
    // Smoothly increase camera distance to 20
    const targetDist = 20;
    const currentDist = camera.position.distanceTo(playerState.position);
    if (currentDist < targetDist) {
      const pullSpeed = (targetDist - currentDist) * delta * 1.5;
      const camDir = camera.position.clone().sub(playerState.position).normalize();
      camera.position.add(camDir.multiplyScalar(pullSpeed));
    }
    if (endgameState.victoryTimer > 3) {
      endgameState.victoryCamPullback = false;
    }
  }

  // --- Spawn fireworks over 5 seconds ---
  // 5 fireworks, one every second starting at t=0.5
  const fireworkTimes = [0.5, 1.5, 2.5, 3.5, 4.5];
  for (const ft of fireworkTimes) {
    if (endgameState.victoryTimer >= ft && endgameState.victoryTimer < ft + delta + 0.01) {
      if (endgameState.fireworks.filter(f => f.launchTime === ft).length === 0) {
        launchFirework(ft);
      }
    }
  }

  // --- Update fireworks ---
  updateFireworks(delta);

  // --- Make kid meshes at camp jump ---
  for (const cave of kidCaves) {
    if (cave.rescued && cave.mesh && cave.mesh.userData.kidMesh) {
      const kid = cave.mesh.userData.kidMesh;
      kid.position.y = Math.abs(Math.sin(endgameState.victoryTimer * 4 + cave.id.length)) * 0.5;
    }
  }

  // --- Show stats overlay after 5 seconds ---
  if (endgameState.victoryTimer >= 5) {
    showVictoryStats();
  }
}

function launchFirework(launchTime) {
  if (!scene) return;

  // Player colors for fireworks
  const colors = [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff];
  const colorIndex = Math.floor((launchTime - 0.5)) % colors.length;
  const color = colors[colorIndex];

  // Launch position: random near center
  const launchX = (Math.random() - 0.5) * 10;
  const launchZ = (Math.random() - 0.5) * 10;

  // Create the launcher projectile (rises up)
  const launcherMat = new THREE.MeshBasicMaterial({ color: color });
  const launcher = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), launcherMat);
  launcher.position.set(launchX, 0, launchZ);
  scene.add(launcher);

  // Trail light
  const trailLight = new THREE.PointLight(color, 1, 8);
  launcher.add(trailLight);

  const firework = {
    mesh: launcher,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      15 + Math.random() * 5,
      (Math.random() - 0.5) * 2
    ),
    color: color,
    phase: 'rising',
    timer: 0,
    explodeHeight: 12 + Math.random() * 8,
    particles: [],
    launchTime: launchTime
  };

  endgameState.fireworks.push(firework);
}

function updateFireworks(delta) {
  for (let i = endgameState.fireworks.length - 1; i >= 0; i--) {
    const fw = endgameState.fireworks[i];
    fw.timer += delta;

    if (fw.phase === 'rising') {
      // Rising phase: move upward
      fw.mesh.position.add(fw.velocity.clone().multiplyScalar(delta));
      fw.velocity.y -= 5 * delta; // Gravity slows the rise

      // Explode when reaching peak height or velocity reverses
      if (fw.mesh.position.y >= fw.explodeHeight || fw.velocity.y <= 0) {
        explodeFirework(fw);
      }
    } else if (fw.phase === 'exploding') {
      // Update explosion particles
      let allDead = true;
      for (const particle of fw.particles) {
        particle.velocity.y -= 8 * delta; // Gravity pulls them down
        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta));
        particle.life -= delta;

        // Fade out as life decreases
        if (particle.mesh.material.opacity !== undefined) {
          particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
        }

        // Shrink slightly
        const scale = Math.max(0.1, particle.life / particle.maxLife);
        particle.mesh.scale.set(scale, scale, scale);

        if (particle.life > 0) {
          allDead = false;
        } else {
          if (particle.mesh.parent) particle.mesh.parent.remove(particle.mesh);
        }
      }

      // Remove firework entirely when all particles are dead
      if (allDead) {
        // Clean up any remaining particles
        for (const p of fw.particles) {
          if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        }
        endgameState.fireworks.splice(i, 1);
      }
    }
  }
}

function explodeFirework(fw) {
  fw.phase = 'exploding';

  // Remove the launcher mesh
  if (fw.mesh.parent) fw.mesh.parent.remove(fw.mesh);

  // Spawn 12-18 explosion particles
  const particleCount = 12 + Math.floor(Math.random() * 7);
  const explodePos = fw.mesh.position.clone();

  // Create a bright flash at the explosion point
  if (scene) {
    const flashLight = new THREE.PointLight(fw.color, 3, 30);
    flashLight.position.copy(explodePos);
    scene.add(flashLight);
    setTimeout(() => {
      if (flashLight.parent) flashLight.parent.remove(flashLight);
    }, 300);
  }

  for (let j = 0; j < particleCount; j++) {
    // Random spherical velocity for a nice burst
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 3 + Math.random() * 5;
    const vx = Math.sin(phi) * Math.cos(theta) * speed;
    const vy = Math.sin(phi) * Math.sin(theta) * speed + 2; // slight upward bias
    const vz = Math.cos(phi) * speed;

    // Vary the color slightly for a rich look
    const baseColor = new THREE.Color(fw.color);
    const hsl = {};
    baseColor.getHSL(hsl);
    hsl.h += (Math.random() - 0.5) * 0.08;
    hsl.l = Math.min(1, hsl.l + Math.random() * 0.2);
    const particleColor = new THREE.Color();
    particleColor.setHSL(hsl.h, hsl.s, hsl.l);

    const mat = new THREE.MeshBasicMaterial({
      color: particleColor,
      transparent: true,
      opacity: 1.0
    });
    const size = 0.08 + Math.random() * 0.1;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 4, 4), mat);
    mesh.position.copy(explodePos);
    scene.add(mesh);

    const maxLife = 1.2 + Math.random() * 1.0;
    fw.particles.push({
      mesh: mesh,
      velocity: new THREE.Vector3(vx, vy, vz),
      life: maxLife,
      maxLife: maxLife
    });
  }
}

function showVictoryStats() {
  const overlay = document.getElementById('victory-stats');
  if (!overlay || overlay.style.display === 'flex') return;

  overlay.innerHTML = `
    <div class="stats-title">ADVENTURE COMPLETE</div>
    <div class="stats-line">Enemies defeated: <span class="stats-value">${endgameState.stats.enemiesKilled}</span></div>
    <div class="stats-line">Chests opened: <span class="stats-value">${endgameState.stats.chestsOpened}</span></div>
    <div class="stats-line">Nights survived: <span class="stats-value">${dayNightState.nightCount}</span></div>
    <div class="stats-line">Distance walked: <span class="stats-value">${Math.round(endgameState.stats.distanceWalked)}m</span></div>
    <button class="stats-replay-btn" onclick="location.reload()">Play Again?</button>
  `;
  overlay.style.display = 'flex';
}


// ============================================
// #44 - NIGHTTIME LULLABY / MUSIC BOX
// A rare item from gold chests that plays a
// gentle melody using Web Audio API. Slows
// nearby enemies and spawns musical note
// particles around the player.
// ============================================

function activateMusicBox() {
  // Check if player has the music box equipped and selected
  const slot = playerState.selectedSlot;
  const equip = playerState.equipment[slot];
  if (!equip || equip.id !== 'musicBox') return;
  if (!playerState.alive) return;
  if (endgameState.musicBoxCooldown > 0) {
    showLootText('Music Box cooling down... ' + Math.ceil(endgameState.musicBoxCooldown) + 's');
    return;
  }

  endgameState.musicBoxActive = true;
  endgameState.musicBoxTimer = 0;
  endgameState.musicBoxCooldown = 15; // 15 second cooldown

  // Play the melody using Web Audio API
  playLullabyMelody();

  // Create the slow zone
  createMusicBoxSlowZone();

  // Spawn floating musical note particles
  spawnMusicNoteParticles();

  showLootText('Lullaby plays... enemies slowed!');

  // Check for harmony bonus (multiple players using music boxes)
  checkMusicBoxHarmony();
}

function playLullabyMelody() {
  // Create or reuse Audio Context
  if (!endgameState.audioCtx) {
    endgameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const ctx = endgameState.audioCtx;

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  // Pentatonic scale: C4, D4, E4, G4, A4
  const noteFreqs = {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    G4: 392.00,
    A4: 440.00
  };

  // A gentle 8-note lullaby sequence
  const melody = ['C4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4'];
  const noteDuration = 0.3;

  melody.forEach((noteName, index) => {
    const freq = noteFreqs[noteName];
    const startTime = ctx.currentTime + index * noteDuration;

    // Create a gentle sine wave oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Create a gain node for smooth envelope (attack/release)
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    // Gentle attack
    gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
    // Sustain
    gainNode.gain.setValueAtTime(0.12, startTime + noteDuration * 0.6);
    // Gentle release
    gainNode.gain.linearRampToValueAtTime(0, startTime + noteDuration);

    // Add a very subtle second harmonic for warmth
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(0.03, startTime + 0.05);
    gain2.gain.linearRampToValueAtTime(0, startTime + noteDuration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + noteDuration + 0.05);
    osc2.start(startTime);
    osc2.stop(startTime + noteDuration + 0.05);
  });
}

function createMusicBoxSlowZone() {
  // The slow zone affects enemies within 8 units for 10 seconds
  endgameState.musicBoxSlowZone = {
    position: playerState.position.clone(),
    radius: 8,
    duration: 10,
    timer: 0,
    slowFactor: 0.3 // Enemies slow to 30% speed
  };
}

function checkMusicBoxHarmony() {
  // Check if any other player nearby is also using a music box
  if (typeof mpState === 'undefined' || !mpState.inGame) return;

  for (const [id, other] of Object.entries(mpState.otherPlayers)) {
    if (!other.mesh) continue;
    const dx = playerState.position.x - other.mesh.position.x;
    const dz = playerState.position.z - other.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // If another player is close (within 12 units), they might be using their music box too
    // For simplicity we double the radius when players are nearby
    if (dist < 12 && endgameState.musicBoxSlowZone) {
      endgameState.musicBoxSlowZone.radius = 16; // Doubled!
      showLootText('Harmony! Lullaby radius doubled!');
      break;
    }
  }
}

function spawnMusicNoteParticles() {
  if (!scene) return;

  // Create floating musical note planes around the player
  const noteChars = ['\u266A', '\u266B']; // musical note symbols
  for (let i = 0; i < 6; i++) {
    const noteGroup = new THREE.Group();

    // Small colored plane that looks like a musical note
    const colors = [0xeedd88, 0xffcc44, 0xddbb66, 0xffee88, 0xccaa44, 0xeecc66];
    const noteMat = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    // Use a small plane as the note shape
    const noteMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), noteMat);
    noteGroup.add(noteMesh);

    const angle = (i / 6) * Math.PI * 2;
    noteGroup.position.set(
      playerState.position.x + Math.cos(angle) * 1.5,
      1.5 + Math.random() * 0.5,
      playerState.position.z + Math.sin(angle) * 1.5
    );

    scene.add(noteGroup);

    endgameState.musicBoxNotes.push({
      mesh: noteGroup,
      angle: angle,
      speed: 1.5 + Math.random() * 0.5,
      yOffset: Math.random() * Math.PI * 2,
      life: 10 // matches slow zone duration
    });
  }
}

function updateMusicBox(delta) {
  // Cooldown timer
  if (endgameState.musicBoxCooldown > 0) {
    endgameState.musicBoxCooldown -= delta;
  }

  // Update the slow zone
  if (endgameState.musicBoxSlowZone) {
    endgameState.musicBoxSlowZone.timer += delta;

    if (endgameState.musicBoxSlowZone.timer >= endgameState.musicBoxSlowZone.duration) {
      // Slow zone expired, restore enemy speeds
      endgameState.musicBoxSlowZone = null;
      endgameState.musicBoxActive = false;
    } else {
      // Apply slow to enemies within range
      const zone = endgameState.musicBoxSlowZone;
      for (const enemy of enemies) {
        if (enemy.health <= 0) continue;
        const dx = enemy.mesh.position.x - zone.position.x;
        const dz = enemy.mesh.position.z - zone.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < zone.radius) {
          // Temporarily reduce speed (stored as base speed on first slow)
          if (!enemy._originalSpeed) {
            enemy._originalSpeed = enemy.speed;
          }
          enemy.speed = enemy._originalSpeed * zone.slowFactor;
        } else if (enemy._originalSpeed) {
          // Restore speed when out of range
          enemy.speed = enemy._originalSpeed;
          delete enemy._originalSpeed;
        }
      }
    }
  } else {
    // Restore any slowed enemies when zone is gone
    for (const enemy of enemies) {
      if (enemy._originalSpeed) {
        enemy.speed = enemy._originalSpeed;
        delete enemy._originalSpeed;
      }
    }
  }

  // Update floating musical note particles
  for (let i = endgameState.musicBoxNotes.length - 1; i >= 0; i--) {
    const note = endgameState.musicBoxNotes[i];
    note.life -= delta;
    note.angle += note.speed * delta;

    if (note.life <= 0) {
      if (note.mesh.parent) note.mesh.parent.remove(note.mesh);
      endgameState.musicBoxNotes.splice(i, 1);
      continue;
    }

    // Float upward and orbit
    note.mesh.position.x = playerState.position.x + Math.cos(note.angle) * (1.5 + note.life * 0.1);
    note.mesh.position.z = playerState.position.z + Math.sin(note.angle) * (1.5 + note.life * 0.1);
    note.mesh.position.y = 1.5 + Math.sin(totalTime * 2 + note.yOffset) * 0.3 + (10 - note.life) * 0.15;

    // Billboard: face the camera
    if (camera) {
      note.mesh.lookAt(camera.position);
    }

    // Fade out as life decreases
    const opacity = Math.min(1, note.life / 2);
    note.mesh.children[0].material.opacity = opacity;
  }
}


// ============================================
// #22-torch - TORCH RELAY
// Every 10th night, players must carry flames
// from the campfire to 4 beacons at map edges
// before dawn. Urgent and collaborative.
// ============================================

function initTorchRelay() {
  // Check if this is a relay night (every 10th night: 10, 20, 30...)
  const nightNum = dayNightState.nightCount;
  if (nightNum % 10 !== 0 || nightNum === 0) return;
  if (endgameState.torchRelay.lastRelayNight === nightNum) return;

  endgameState.torchRelay.lastRelayNight = nightNum;
  endgameState.torchRelay.active = true;
  endgameState.torchRelay.playerHasFlame = false;
  endgameState.torchRelay.allLitThisRelay = false;

  // Clear any old beacons
  for (const beacon of endgameState.torchRelay.beacons) {
    if (beacon.mesh && beacon.mesh.parent) beacon.mesh.parent.remove(beacon.mesh);
  }
  endgameState.torchRelay.beacons = [];

  // Remove old flame mesh if lingering
  if (endgameState.torchRelay.flameMesh) {
    if (endgameState.torchRelay.flameMesh.parent) {
      endgameState.torchRelay.flameMesh.parent.remove(endgameState.torchRelay.flameMesh);
    }
    endgameState.torchRelay.flameMesh = null;
  }
  if (endgameState.torchRelay.flameLight) {
    if (endgameState.torchRelay.flameLight.parent) {
      endgameState.torchRelay.flameLight.parent.remove(endgameState.torchRelay.flameLight);
    }
    endgameState.torchRelay.flameLight = null;
  }

  // Spawn 4 beacons at N/S/E/W edges of the map
  const beaconDist = campfireState.mapRadius - 5;
  const directions = [
    { name: 'North', x: 0, z: -beaconDist },
    { name: 'South', x: 0, z: beaconDist },
    { name: 'East',  x: beaconDist, z: 0 },
    { name: 'West',  x: -beaconDist, z: 0 }
  ];

  for (const dir of directions) {
    const beacon = createBeaconMesh(dir);
    beacon.mesh.position.set(dir.x, 0, dir.z);
    scene.add(beacon.mesh);
    endgameState.torchRelay.beacons.push(beacon);
  }

  // Show announcement
  showLootText('The Eternal Flame dims... Light the 4 beacons before dawn!');

  const announceEl = document.getElementById('torch-relay-announce');
  if (announceEl) {
    announceEl.textContent = 'TORCH RELAY - Light all beacons before dawn!';
    announceEl.style.display = 'block';
    setTimeout(() => { announceEl.style.display = 'none'; }, 4000);
  }
}

function createBeaconMesh(dir) {
  const group = new THREE.Group();

  // Stone ring base (circle of small stone meshes)
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), stoneMat);
    stone.position.set(Math.cos(angle) * 0.8, 0.15, Math.sin(angle) * 0.8);
    stone.scale.y = 0.5;
    group.add(stone);
  }

  // Central pedestal
  const pedestalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), pedestalMat);
  pedestal.position.y = 0.6;
  pedestal.castShadow = true;
  group.add(pedestal);

  // Unlit torch cylinder on top
  const torchMat = new THREE.MeshLambertMaterial({ color: 0x332211 });
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), torchMat);
  torch.position.y = 1.45;
  group.add(torch);

  // Small direction marker (so players know which beacon this is)
  // Glowing dim indicator
  const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x442200 });
  const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), indicatorMat);
  indicator.position.y = 1.8;
  group.add(indicator);

  return {
    mesh: group,
    name: dir.name,
    lit: false,
    torch: torch,
    indicator: indicator
  };
}

function updateTorchRelay(delta) {
  // Check if a relay should start this night
  if (dayNightState.justBecameNight) {
    initTorchRelay();
  }

  if (!endgameState.torchRelay.active) return;

  // If dawn arrives and not all beacons are lit, relay fails
  if (dayNightState.justBecameDay) {
    const allLit = endgameState.torchRelay.beacons.every(b => b.lit);
    if (allLit && !endgameState.torchRelay.allLitThisRelay) {
      // Should not reach here because we handle success immediately when last beacon is lit
    }
    // Clean up beacons
    endTorchRelay(!allLit);
    return;
  }

  // Animate beacons (pulse unlit ones dimly, lit ones glow bright)
  for (const beacon of endgameState.torchRelay.beacons) {
    if (beacon.lit) {
      beacon.indicator.material.color.setHex(0xff6622);
      // Already has a fire mesh, pulse its light
      if (beacon.fireLight) {
        beacon.fireLight.intensity = 1.0 + Math.sin(totalTime * 3) * 0.3;
      }
    } else {
      // Dim pulse to show it is unlit
      const pulse = 0.15 + Math.sin(totalTime * 2) * 0.1;
      beacon.indicator.material.opacity = pulse;
    }
  }

  // Animate player flame if they are carrying one
  if (endgameState.torchRelay.playerHasFlame && endgameState.torchRelay.flameMesh) {
    // Keep the flame attached to the player position
    endgameState.torchRelay.flameMesh.position.set(
      playerState.position.x,
      2.5,
      playerState.position.z
    );
    if (endgameState.torchRelay.flameLight) {
      endgameState.torchRelay.flameLight.position.copy(endgameState.torchRelay.flameMesh.position);
      endgameState.torchRelay.flameLight.intensity = 1.2 + Math.sin(totalTime * 5) * 0.4;
    }
  }

  // Show prompt when near campfire or beacons
  const promptEl = document.getElementById('torch-relay-prompt');
  if (promptEl) {
    const distToFire = playerState.position.distanceTo(new THREE.Vector3(0, 0, 0));

    if (distToFire < 5 && !endgameState.torchRelay.playerHasFlame) {
      promptEl.textContent = 'Press F to pick up the Eternal Flame';
      promptEl.style.display = 'block';
    } else {
      let nearBeacon = null;
      for (const beacon of endgameState.torchRelay.beacons) {
        if (beacon.lit) continue;
        const dx = playerState.position.x - beacon.mesh.position.x;
        const dz = playerState.position.z - beacon.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 4) {
          nearBeacon = beacon;
          break;
        }
      }

      if (nearBeacon && endgameState.torchRelay.playerHasFlame) {
        promptEl.textContent = 'Press F to light the ' + nearBeacon.name + ' beacon!';
        promptEl.style.display = 'block';
      } else if (endgameState.torchRelay.playerHasFlame) {
        promptEl.textContent = 'Carrying flame! Go to a beacon. Taking damage extinguishes it!';
        promptEl.style.display = 'block';
      } else {
        promptEl.style.display = 'none';
      }
    }
  }
}

function torchRelayInteract() {
  if (!endgameState.torchRelay.active) return;

  const distToFire = playerState.position.distanceTo(new THREE.Vector3(0, 0, 0));

  // Pick up flame from campfire
  if (distToFire < 5 && !endgameState.torchRelay.playerHasFlame) {
    endgameState.torchRelay.playerHasFlame = true;

    // Create a flame mesh attached to the player
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), flameMat);
    flame.position.set(playerState.position.x, 2.5, playerState.position.z);
    scene.add(flame);
    endgameState.torchRelay.flameMesh = flame;

    // Flame light
    const flameLight = new THREE.PointLight(0xff6622, 1.5, 12);
    flameLight.position.copy(flame.position);
    scene.add(flameLight);
    endgameState.torchRelay.flameLight = flameLight;

    showLootText('You carry the Eternal Flame!');

    // Hook into damagePlayer to extinguish flame when hit
    if (!endgameState.torchRelay._damageHooked) {
      endgameState.torchRelay._damageHooked = true;
      const prevDamagePlayer = window.damagePlayer;
      window.damagePlayer = function(amount) {
        prevDamagePlayer(amount);
        // Extinguish the flame on any damage
        if (endgameState.torchRelay.playerHasFlame) {
          extinguishFlame();
        }
      };
    }
    return;
  }

  // Light a beacon
  if (endgameState.torchRelay.playerHasFlame) {
    for (const beacon of endgameState.torchRelay.beacons) {
      if (beacon.lit) continue;
      const dx = playerState.position.x - beacon.mesh.position.x;
      const dz = playerState.position.z - beacon.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 4) {
        // Light this beacon!
        beacon.lit = true;

        // Visual: add fire to the beacon
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), fireMat);
        fire.position.y = 1.8;
        beacon.mesh.add(fire);

        // Add a point light
        const fireLight = new THREE.PointLight(0xff6622, 1.2, 15);
        fireLight.position.y = 2;
        beacon.mesh.add(fireLight);
        beacon.fireLight = fireLight;

        // Update the indicator
        beacon.indicator.material.color.setHex(0xff6622);

        showLootText(beacon.name + ' beacon lit!');

        // Extinguish player flame (must go back for another)
        extinguishFlame();

        // Check if all beacons are lit
        const allLit = endgameState.torchRelay.beacons.every(b => b.lit);
        if (allLit) {
          torchRelaySuccess();
        }
        return;
      }
    }
  }
}

function extinguishFlame() {
  endgameState.torchRelay.playerHasFlame = false;

  if (endgameState.torchRelay.flameMesh) {
    if (endgameState.torchRelay.flameMesh.parent) {
      endgameState.torchRelay.flameMesh.parent.remove(endgameState.torchRelay.flameMesh);
    }
    endgameState.torchRelay.flameMesh = null;
  }
  if (endgameState.torchRelay.flameLight) {
    if (endgameState.torchRelay.flameLight.parent) {
      endgameState.torchRelay.flameLight.parent.remove(endgameState.torchRelay.flameLight);
    }
    endgameState.torchRelay.flameLight = null;
  }
}

function torchRelaySuccess() {
  endgameState.torchRelay.allLitThisRelay = true;

  // Reward: 5 gems
  playerState.inventory.gems += 5;
  updateInventoryUI();

  showLootText('All beacons lit! +5 gems! Torch Master!');

  const announceEl = document.getElementById('torch-relay-announce');
  if (announceEl) {
    announceEl.textContent = 'TORCH MASTER! All beacons lit before dawn!';
    announceEl.style.color = '#ffd700';
    announceEl.style.display = 'block';
    setTimeout(() => {
      announceEl.style.display = 'none';
      announceEl.style.color = '';
    }, 5000);
  }
}

function endTorchRelay(failed) {
  endgameState.torchRelay.active = false;
  extinguishFlame();

  // Remove beacon meshes
  for (const beacon of endgameState.torchRelay.beacons) {
    if (beacon.mesh && beacon.mesh.parent) {
      beacon.mesh.parent.remove(beacon.mesh);
    }
  }
  endgameState.torchRelay.beacons = [];

  if (failed) {
    showLootText('Torch Relay failed... try again next time.');
  }

  // Hide prompts
  const promptEl = document.getElementById('torch-relay-prompt');
  if (promptEl) promptEl.style.display = 'none';
}


// ============================================
// INPUT HOOKS
// Extend keyboard controls for endgame features
// ============================================

function setupEndgameControls() {
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyE':
        // Also try to open the dawn chest
        openDawnChest();
        break;
      case 'KeyF':
        // Torch relay interaction (pick up flame, light beacon)
        if (endgameState.torchRelay.active) {
          torchRelayInteract();
        }
        break;
      case 'KeyQ':
        // Activate music box (use key)
        activateMusicBox();
        break;
    }
  });
}

// NOTE: initEndgame() and setupEndgameControls() are called from game.js startGame()
// NOTE: updateEndgame(delta) is called from game.js gameLoop()


// ============================================
// INJECTED CSS
// Styles for all endgame HUD elements
// ============================================

function injectEndgameCSS() {
  if (document.getElementById('endgame-styles')) return;

  const style = document.createElement('style');
  style.id = 'endgame-styles';
  style.textContent = `

    /* --- Night Rank Display --- */
    #rank-display {
      position: fixed;
      top: 40px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffffff;
      font-size: 13px;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 50;
    }

    .rank-pulse {
      animation: rankPulse 1s ease-in-out infinite alternate;
    }

    @keyframes rankPulse {
      from { opacity: 0.7; transform: translateX(-50%) scale(1); }
      to   { opacity: 1; transform: translateX(-50%) scale(1.1); }
    }

    /* --- Rank Up Announcement --- */
    #rank-announce {
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      font-size: 28px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 0 0 15px rgba(255,255,255,0.5), 2px 2px 4px black;
      pointer-events: none;
      z-index: 80;
      display: none;
      opacity: 0;
    }

    #rank-announce.rank-announce-active {
      animation: rankAnnounce 3.5s ease-out forwards;
    }

    @keyframes rankAnnounce {
      0%   { opacity: 0; transform: translateX(-50%) scale(0.8); }
      15%  { opacity: 1; transform: translateX(-50%) scale(1.1); }
      70%  { opacity: 1; transform: translateX(-50%) scale(1); }
      100% { opacity: 0; transform: translateX(-50%) scale(1.05); }
    }

    /* --- Dawn Chest Prompt --- */
    #dawn-chest-prompt {
      position: fixed;
      bottom: 160px;
      left: 50%;
      transform: translateX(-50%);
      color: #ff8844;
      font-size: 16px;
      font-family: 'Courier New', monospace;
      text-shadow: 1px 1px 3px black;
      pointer-events: none;
      z-index: 50;
      display: none;
    }

    /* --- Difficulty Badge --- */
    #difficulty-badge {
      position: fixed;
      top: 12px;
      right: 15px;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      letter-spacing: 2px;
      padding: 3px 8px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 3px;
      pointer-events: none;
      z-index: 50;
      display: none;
    }

    /* --- Night 99 Message --- */
    #night99-message {
      position: fixed;
      top: 35%;
      left: 50%;
      transform: translateX(-50%);
      color: #ff0000;
      font-size: 48px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      text-shadow: 0 0 30px rgba(255,0,0,0.8), 0 0 60px rgba(200,0,0,0.5), 3px 3px 6px black;
      pointer-events: none;
      z-index: 80;
      display: none;
      animation: night99Pulse 0.5s ease-in-out infinite alternate;
    }

    @keyframes night99Pulse {
      from { transform: translateX(-50%) scale(1); opacity: 0.8; }
      to   { transform: translateX(-50%) scale(1.05); opacity: 1; }
    }

    /* --- Victory Stats Overlay --- */
    #victory-stats {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 200;
      color: white;
      font-family: 'Courier New', monospace;
    }

    .stats-title {
      font-size: 36px;
      font-weight: bold;
      color: #ffd700;
      text-shadow: 0 0 20px rgba(255,215,0,0.5);
      margin-bottom: 30px;
    }

    .stats-line {
      font-size: 18px;
      margin: 8px 0;
      color: #cccccc;
    }

    .stats-value {
      color: #ffffff;
      font-weight: bold;
    }

    .stats-replay-btn {
      margin-top: 30px;
      padding: 12px 32px;
      font-size: 18px;
      font-family: 'Courier New', monospace;
      background: #ffd700;
      color: #222;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
    }

    .stats-replay-btn:hover {
      background: #ffee88;
      transform: scale(1.05);
    }

    /* --- Torch Relay Announcement --- */
    #torch-relay-announce {
      position: fixed;
      top: 22%;
      left: 50%;
      transform: translateX(-50%);
      font-size: 22px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #ff8844;
      text-shadow: 0 0 12px rgba(255,136,68,0.6), 2px 2px 4px black;
      pointer-events: none;
      z-index: 80;
      display: none;
    }

    /* --- Torch Relay Prompt --- */
    #torch-relay-prompt {
      position: fixed;
      bottom: 180px;
      left: 50%;
      transform: translateX(-50%);
      color: #ff8844;
      font-size: 14px;
      font-family: 'Courier New', monospace;
      text-shadow: 1px 1px 3px black;
      pointer-events: none;
      z-index: 50;
      display: none;
    }

  `;

  document.head.appendChild(style);
}


// ============================================
// INJECTED DOM ELEMENTS
// Create HTML elements needed by endgame features
// ============================================

function injectEndgameDOMElements() {
  // #35 - Rank display (below night counter)
  if (!document.getElementById('rank-display')) {
    const el = document.createElement('div');
    el.id = 'rank-display';
    el.textContent = 'Newcomer';
    document.body.appendChild(el);
  }

  // #35 - Rank up announcement
  if (!document.getElementById('rank-announce')) {
    const el = document.createElement('div');
    el.id = 'rank-announce';
    document.body.appendChild(el);
  }

  // #37 - Dawn chest prompt
  if (!document.getElementById('dawn-chest-prompt')) {
    const el = document.createElement('div');
    el.id = 'dawn-chest-prompt';
    el.textContent = 'Press E to open Dawn Chest';
    document.body.appendChild(el);
  }

  // #38 - Difficulty badge
  if (!document.getElementById('difficulty-badge')) {
    const el = document.createElement('div');
    el.id = 'difficulty-badge';
    document.body.appendChild(el);
  }

  // #39 - Night 99 message
  if (!document.getElementById('night99-message')) {
    const el = document.createElement('div');
    el.id = 'night99-message';
    document.body.appendChild(el);
  }

  // #40 - Victory stats overlay
  if (!document.getElementById('victory-stats')) {
    const el = document.createElement('div');
    el.id = 'victory-stats';
    document.body.appendChild(el);
  }

  // #22-torch - Torch relay announcement
  if (!document.getElementById('torch-relay-announce')) {
    const el = document.createElement('div');
    el.id = 'torch-relay-announce';
    document.body.appendChild(el);
  }

  // #22-torch - Torch relay prompt
  if (!document.getElementById('torch-relay-prompt')) {
    const el = document.createElement('div');
    el.id = 'torch-relay-prompt';
    document.body.appendChild(el);
  }
}

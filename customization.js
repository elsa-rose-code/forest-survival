// ============================================
// CUSTOMIZATION.JS - Player customization!
// Features:
//   #6  - Animal Hat Unlocks (rescue kids -> wear their hats!)
//   #7  - Player Outfit Themes (5 color palettes)
//   #13 - Forest Garden (plant seeds, grow magical plants)
//
// Globals used: scene, camera, totalTime, playerState,
//   dayNightState, campfireState, SAFE_ZONE_RADIUS,
//   kidState, showLootText, sackHasRoom, updateInventoryUI,
//   mpState, socket, trees, enemies, isInSafeZone
// ============================================


// ============================================
// STATE
// ============================================

const customState = {
  // --- Hats ---
  unlockedHats: { dino: false, kraken: false, squid: false, koala: false },
  currentHat: null,    // Currently equipped hat ID (or null)
  hatMesh: null,       // The THREE.Group currently on the player's head

  // --- Outfits ---
  outfit: 'ranger',    // Default outfit

  // --- Garden ---
  garden: [],          // Array of plant data objects
  maxPlants: 8
};


// ============================================
// ============================================
//
//   #6 - ANIMAL HAT UNLOCKS
//
//   When you rescue a kid, their hat unlocks!
//   Press H to cycle through unlocked hats.
//   Hats appear on top of the player's head mesh.
//
// ============================================
// ============================================

// List of hat IDs in cycle order
const HAT_CYCLE_ORDER = ['dino', 'kraken', 'squid', 'koala'];

// ============================================
// UNLOCK A HAT (called after rescuing a kid)
// ============================================

function unlockHat(kidId) {
  if (!customState.unlockedHats.hasOwnProperty(kidId)) return;
  customState.unlockedHats[kidId] = true;
  showLootText('Hat unlocked: ' + kidId.charAt(0).toUpperCase() + kidId.slice(1) + ' Hat!');
}

// ============================================
// EQUIP A HAT by ID (or null to remove)
// ============================================

function equipHat(hatId) {
  // Remove existing hat mesh from the player's head
  if (customState.hatMesh) {
    const headMesh = getPlayerHeadMesh(playerState.mesh);
    if (headMesh && customState.hatMesh.parent === headMesh) {
      headMesh.remove(customState.hatMesh);
    } else if (customState.hatMesh.parent) {
      customState.hatMesh.parent.remove(customState.hatMesh);
    }
    customState.hatMesh = null;
  }

  customState.currentHat = hatId;

  if (!hatId) return; // Just removing the hat

  // Create the new hat mesh and attach it to the player's head
  const hat = createHatMesh(hatId);
  if (!hat) return;

  const headMesh = getPlayerHeadMesh(playerState.mesh);
  if (headMesh) {
    hat.position.set(0, 0.3, 0); // On top of head
    headMesh.add(hat);
    customState.hatMesh = hat;
  }
}

// ============================================
// CYCLE HATS (press H)
// Goes: none -> first unlocked -> next unlocked -> ... -> none
// ============================================

function cycleHat() {
  // Build a list of unlocked hat IDs
  const unlocked = HAT_CYCLE_ORDER.filter(id => customState.unlockedHats[id]);

  if (unlocked.length === 0) {
    showLootText('No hats unlocked yet! Rescue kids to get hats.');
    return;
  }

  // Find the current hat's index in the unlocked list
  const currentIndex = customState.currentHat
    ? unlocked.indexOf(customState.currentHat)
    : -1;

  // Next index: if at end (or none), go to null (remove); else go to next
  let nextHatId = null;
  if (currentIndex < unlocked.length - 1) {
    nextHatId = unlocked[currentIndex + 1];
  }
  // If currentIndex is -1 (none), nextHatId = unlocked[0]
  if (currentIndex === -1) {
    nextHatId = unlocked[0];
  }

  equipHat(nextHatId);

  if (nextHatId) {
    showLootText('Wearing: ' + nextHatId.charAt(0).toUpperCase() + nextHatId.slice(1) + ' Hat');
  } else {
    showLootText('Hat removed');
  }
}

// ============================================
// GET PLAYER HEAD MESH
// Head is child index 1 of the player group
// (body=0, head=1, hair=2)
// ============================================

function getPlayerHeadMesh(meshGroup) {
  if (!meshGroup || !meshGroup.children) return null;
  return meshGroup.children[1] || null; // Index 1 = head
}

// ============================================
// CREATE HAT MESHES
// Recreates the kid hat designs from kids.js,
// but as standalone groups positioned at origin
// (will be placed at y=0.3 on the head)
// ============================================

function createHatMesh(hatId) {
  const group = new THREE.Group();

  if (hatId === 'dino') {
    // --- DINO HAT ---
    // Red box on top of head
    const hatMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
    const hatBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), hatMat);
    hatBox.castShadow = true;
    group.add(hatBox);

    // White teeth along the front bottom edge
    const teethMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -1; i <= 1; i++) {
      // Front teeth (triangular look - small pointed boxes)
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), teethMat);
      tooth.position.set(i * 0.12, -0.14, -0.18);
      group.add(tooth);
    }
    // Back teeth
    for (let i = -1; i <= 1; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), teethMat);
      tooth.position.set(i * 0.12, -0.13, 0.18);
      group.add(tooth);
    }

    // Small eye dots on the hat
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
    eyeL.position.set(-0.1, 0.04, -0.21);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
    eyeR.position.set(0.1, 0.04, -0.21);
    group.add(eyeR);

    // Dino ridge spikes along the top (3 small bumps)
    const ridgeMat = new THREE.MeshLambertMaterial({ color: 0xaa1111 });
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), ridgeMat);
      spike.position.set(0, 0.14, i * 0.1);
      group.add(spike);
    }

  } else if (hatId === 'kraken') {
    // --- KRAKEN HAT ---
    // Blue box on top of head
    const hatMat = new THREE.MeshLambertMaterial({ color: 0x2244cc });
    const hatBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), hatMat);
    hatBox.castShadow = true;
    group.add(hatBox);

    // 4 dangling tentacle cylinders (darker blue)
    const tentMat = new THREE.MeshLambertMaterial({ color: 0x1133aa });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const tent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.03, 0.3, 6),
        tentMat
      );
      tent.position.set(
        Math.cos(angle) * 0.2,
        -0.25,
        Math.sin(angle) * 0.16
      );
      // Slight outward tilt
      tent.rotation.z = Math.cos(angle) * 0.3;
      tent.rotation.x = Math.sin(angle) * 0.2;
      group.add(tent);
    }

    // Kraken eyes on the front
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff66 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
    eyeL.position.set(-0.1, 0.02, -0.21);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
    eyeR.position.set(0.1, 0.02, -0.21);
    group.add(eyeR);

  } else if (hatId === 'squid') {
    // --- SQUID HAT ---
    // Tan box on top of head
    const hatMat = new THREE.MeshLambertMaterial({ color: 0xccaa77 });
    const hatBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.35), hatMat);
    hatBox.castShadow = true;
    group.add(hatBox);

    // Two side flap planes (hanging down)
    const flapMat = new THREE.MeshLambertMaterial({
      color: 0xbbaa66,
      side: THREE.DoubleSide
    });
    const flapL = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.22), flapMat);
    flapL.position.set(-0.25, -0.1, 0);
    flapL.rotation.z = 0.2;
    group.add(flapL);
    const flapR = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.22), flapMat);
    flapR.position.set(0.25, -0.1, 0);
    flapR.rotation.z = -0.2;
    group.add(flapR);

    // Little squid eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), eyeMat);
    eyeL.position.set(-0.08, 0.0, -0.18);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), eyeMat);
    eyeR.position.set(0.08, 0.0, -0.18);
    group.add(eyeR);

  } else if (hatId === 'koala') {
    // --- KOALA HAT ---
    // Pink box on top of head
    const hatMat = new THREE.MeshLambertMaterial({ color: 0xeeccdd });
    const hatBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.35), hatMat);
    hatBox.castShadow = true;
    group.add(hatBox);

    // Round ear cylinders on sides
    const earMat = new THREE.MeshLambertMaterial({ color: 0xeeccdd });
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8), earMat);
    earL.position.set(-0.25, 0.08, 0);
    earL.rotation.z = Math.PI / 2; // Lay flat so disc faces outward
    group.add(earL);
    const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8), earMat);
    earR.position.set(0.25, 0.08, 0);
    earR.rotation.z = Math.PI / 2;
    group.add(earR);

    // Inner ear (brown)
    const innerMat = new THREE.MeshLambertMaterial({ color: 0x886655 });
    const innerL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 8), innerMat);
    innerL.position.set(-0.25, 0.08, 0);
    innerL.rotation.z = Math.PI / 2;
    group.add(innerL);
    const innerR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 8), innerMat);
    innerR.position.set(0.25, 0.08, 0);
    innerR.rotation.z = Math.PI / 2;
    group.add(innerR);

    // Brown nose dot on the front
    const noseMat = new THREE.MeshBasicMaterial({ color: 0x664433 });
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.04), noseMat);
    nose.position.set(0, -0.04, -0.18);
    group.add(nose);

  } else {
    return null; // Unknown hat
  }

  return group;
}

// ============================================
// APPLY HAT TO ANOTHER PLAYER'S MESH
// Used for multiplayer hat sync
// ============================================

function applyHatToMesh(meshGroup, hatId) {
  // Remove any existing hat on this mesh
  const head = getPlayerHeadMesh(meshGroup);
  if (!head) return;

  // Look for an existing hat group (tagged with userData.isHat)
  for (let i = head.children.length - 1; i >= 0; i--) {
    if (head.children[i].userData && head.children[i].userData.isHat) {
      head.remove(head.children[i]);
    }
  }

  if (!hatId) return; // No hat to apply

  const hat = createHatMesh(hatId);
  if (!hat) return;
  hat.userData.isHat = true;
  hat.position.set(0, 0.3, 0);
  head.add(hat);
}


// ============================================
// ============================================
//
//   #7 - PLAYER OUTFIT THEMES
//
//   5 color themes for the player character.
//   Selected before the game starts (lobby).
//   Changes body and leg material colors.
//
// ============================================
// ============================================

const OUTFIT_THEMES = {
  ranger: {
    label: 'Forest Ranger',
    body: 0x3a6b3a,
    pants: 0x554433,
    flashlightTint: 0xffffcc  // Warm white
  },
  moonlight: {
    label: 'Moonlight Explorer',
    body: 0x8888bb,
    pants: 0x444466,
    flashlightTint: 0xccccff  // Cool blue-white
  },
  scout: {
    label: 'Campfire Scout',
    body: 0xbb7733,
    pants: 0x554422,
    flashlightTint: 0xffddaa  // Warm amber
  },
  starlight: {
    label: 'Starlight Seeker',
    body: 0x334477,
    pants: 0x222244,
    flashlightTint: 0xaabbff  // Pale starlight blue
  },
  berry: {
    label: 'Berry Picker',
    body: 0xcc6688,
    pants: 0xaa4466,
    flashlightTint: 0xffccdd  // Soft pink
  }
};

// ============================================
// SELECT OUTFIT (called from lobby or menu)
// ============================================

function selectOutfit(outfitId) {
  if (!OUTFIT_THEMES[outfitId]) return;
  customState.outfit = outfitId;
  showLootText('Outfit: ' + OUTFIT_THEMES[outfitId].label);

  // Apply to local player if mesh exists
  if (playerState.mesh) {
    applyOutfit(playerState.mesh, outfitId);
  }
}

// ============================================
// APPLY OUTFIT TO A MESH
// Changes body and legs material colors.
// Body = children[0], Legs = children[5] and [6]
// Arms match body color = children[7] and [8]
// Player mesh child order:
//   0=body, 1=head, 2=hair, 3=eyeL, 4=eyeR,
//   5=legL, 6=legR, 7=armL, 8=armR, 9=bootL, 10=bootR
// BUT we use userData refs for legs/arms to be safe.
// ============================================

function applyOutfit(mesh, outfitId) {
  const theme = OUTFIT_THEMES[outfitId];
  if (!theme || !mesh) return;

  // Body is child index 0
  const body = mesh.children[0];
  if (body && body.material) {
    body.material.color.setHex(theme.body);
  }

  // Legs via userData
  const ud = mesh.userData;
  if (ud.legL && ud.legL.material) ud.legL.material.color.setHex(theme.pants);
  if (ud.legR && ud.legR.material) ud.legR.material.color.setHex(theme.pants);

  // Arms match body color
  if (ud.armL && ud.armL.material) ud.armL.material.color.setHex(theme.body);
  if (ud.armR && ud.armR.material) ud.armR.material.color.setHex(theme.body);

  // Apply flashlight tint if player has a flashlight equipped
  applyFlashlightTint(outfitId);
}

// ============================================
// APPLY FLASHLIGHT TINT
// Colors the flashlight spotlight to match outfit
// ============================================

function applyFlashlightTint(outfitId) {
  const theme = OUTFIT_THEMES[outfitId];
  if (!theme) return;

  // Check all equipment slots for flashlights
  for (const [slot, item] of Object.entries(playerState.equipment)) {
    if ((item.id === 'strongFlashlight' || item.id === 'oldFlashlight') &&
        item.weaponMesh && item.weaponMesh.userData.spotlight) {
      item.weaponMesh.userData.spotlight.color.setHex(theme.flashlightTint);
    }
  }
}

// ============================================
// APPLY OUTFIT TO OTHER PLAYER MESH
// For multiplayer - other players' meshes use
// the same child structure from createOtherPlayerMesh
// Other player: 0=body, 1=head, 2=legL, 3=legR, 4=armL, 5=armR
// ============================================

function applyOutfitToOtherPlayer(mesh, outfitId) {
  const theme = OUTFIT_THEMES[outfitId];
  if (!theme || !mesh) return;

  // Body is child 0
  if (mesh.children[0] && mesh.children[0].material) {
    mesh.children[0].material.color.setHex(theme.body);
  }

  // Legs from userData.legs array
  if (mesh.userData.legs) {
    for (const leg of mesh.userData.legs) {
      if (leg && leg.material) leg.material.color.setHex(theme.pants);
    }
  }

  // Arms - child 4 and 5 in createOtherPlayerMesh
  if (mesh.children[4] && mesh.children[4].material) {
    mesh.children[4].material.color.setHex(theme.body);
  }
  if (mesh.children[5] && mesh.children[5].material) {
    mesh.children[5].material.color.setHex(theme.body);
  }
}


// ============================================
// ============================================
//
//   #13 - FOREST GARDEN
//
//   Chop trees for seeds. Plant seeds in the
//   safe zone. Watch them grow over 2 day/night
//   cycles into magical plants with unique effects.
//
// ============================================
// ============================================

// --- PLANT TYPES ---
// Each has a unique visual and gameplay effect
const PLANT_TYPES = {
  glowingMushroom: {
    name: 'Glowing Mushroom',
    description: 'Emits a soft blue light',
    effectType: 'decorative'
  },
  sunflower: {
    name: 'Sunflower',
    description: 'Heals nearby players 2 HP/sec',
    effectType: 'heal',
    healRate: 2,
    healRadius: 3
  },
  fireRose: {
    name: 'Fire Rose',
    description: 'Slows enemies near camp by 20%',
    effectType: 'slow',
    slowFactor: 0.8,
    slowRadius: 5
  },
  moonflower: {
    name: 'Moonflower',
    description: 'Only visible at night. Harvest for gems!',
    effectType: 'gem'
  },
  berryBush: {
    name: 'Berry Bush',
    description: 'Produces 1 meat per day cycle',
    effectType: 'meat'
  }
};

const PLANT_TYPE_KEYS = Object.keys(PLANT_TYPES);

// Growth stages: sprout (0), growing (1), mature (2)
// Full growth takes 2 complete day/night cycles
// A cycle is DAY_LENGTH seconds (120s), so 2 full cycles = 4 * 120 = 480s
const GROWTH_DURATION = 480; // Seconds for full growth (2 day/night cycles)
const STAGE_1_TIME = GROWTH_DURATION * 0.33;  // Sprout -> Growing
const STAGE_2_TIME = GROWTH_DURATION * 0.66;  // Growing -> Mature

// ============================================
// SEED DROP HOOK
// Call this from checkTreeChop in player.js
// after a tree is successfully chopped.
// 10% chance to drop a seed.
// ============================================

function tryDropSeed() {
  if (Math.random() > 0.1) return; // 90% chance: no seed

  // Initialize the seeds field if it doesn't exist
  if (typeof playerState.inventory.seeds === 'undefined') {
    playerState.inventory.seeds = 0;
  }

  playerState.inventory.seeds += 1;
  showLootText('+1 Seed! (Press G in safe zone to plant)');
}

// ============================================
// PLANT A SEED (press G in safe zone)
// ============================================

function plantSeed() {
  // Must be in safe zone
  const px = playerState.position.x;
  const pz = playerState.position.z;
  if (!isInSafeZone(px, pz)) {
    showLootText('You can only plant in the safe zone!');
    return;
  }

  // Check for seeds
  if (!playerState.inventory.seeds || playerState.inventory.seeds <= 0) {
    showLootText('No seeds! Chop trees for a chance to get seeds.');
    return;
  }

  // Check plant limit
  if (customState.garden.length >= customState.maxPlants) {
    showLootText('Garden is full! (Max ' + customState.maxPlants + ' plants)');
    return;
  }

  // Check not too close to another plant
  for (const plant of customState.garden) {
    const dx = px - plant.position.x;
    const dz = pz - plant.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
      showLootText('Too close to another plant! Move a bit.');
      return;
    }
  }

  // Spend the seed
  playerState.inventory.seeds -= 1;

  // Pick a random plant type
  const typeKey = PLANT_TYPE_KEYS[Math.floor(Math.random() * PLANT_TYPE_KEYS.length)];
  const plantConfig = PLANT_TYPES[typeKey];

  // Create the plant data
  const plantData = {
    type: typeKey,
    config: plantConfig,
    position: { x: px, z: pz },
    plantTime: totalTime,
    stage: 0,         // 0=sprout, 1=growing, 2=mature
    mesh: null,        // 3D mesh group (created below)
    light: null,       // Optional light (for mushroom, etc.)
    harvested: false,  // Whether mature plant has been harvested
    lastMeatDrop: 0,   // For berry bush timing
    lastDayCycle: dayNightState.dayCount  // Track day cycles for berry bush
  };

  // Create initial mesh (stage 0 = sprout)
  plantData.mesh = createPlantMesh(typeKey, 0);
  plantData.mesh.position.set(px, 0, pz);
  scene.add(plantData.mesh);

  customState.garden.push(plantData);
  showLootText('Planted a seed! It will grow into a ' + plantConfig.name + '.');
}

// ============================================
// CREATE PLANT MESH for a given type and stage
// ============================================

function createPlantMesh(typeKey, stage) {
  const group = new THREE.Group();

  if (stage === 0) {
    // --- SPROUT (all types look similar) ---
    // Tiny green cone poking out of the ground
    const sproutMat = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
    const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 6), sproutMat);
    sprout.position.y = 0.05;
    group.add(sprout);

    // Tiny dirt mound
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 8), dirtMat);
    dirt.position.y = 0.02;
    group.add(dirt);

    return group;
  }

  if (stage === 1) {
    // --- GROWING (medium, type-specific hints) ---
    // Dirt mound
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.05, 8), dirtMat);
    dirt.position.y = 0.025;
    group.add(dirt);

    if (typeKey === 'glowingMushroom') {
      // Medium mushroom cap forming
      const capMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.15, 8), capMat);
      cap.position.y = 0.2;
      group.add(cap);
      // Stem
      const stemMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.15, 6), stemMat);
      stem.position.y = 0.1;
      group.add(stem);
    } else if (typeKey === 'sunflower') {
      // Growing stem with leaf buds
      const stemMat = new THREE.MeshLambertMaterial({ color: 0x338833 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), stemMat);
      stem.position.y = 0.15;
      group.add(stem);
      // Leaf boxes
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
      const leaf1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), leafMat);
      leaf1.position.set(0.06, 0.15, 0);
      leaf1.rotation.z = -0.3;
      group.add(leaf1);
      const leaf2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), leafMat);
      leaf2.position.set(-0.06, 0.2, 0);
      leaf2.rotation.z = 0.3;
      group.add(leaf2);
    } else if (typeKey === 'fireRose') {
      // Growing bush, orange tinted
      const bushMat = new THREE.MeshLambertMaterial({ color: 0x447733 });
      const bush = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.25, 8), bushMat);
      bush.position.y = 0.15;
      group.add(bush);
      // Small orange bud
      const budMat = new THREE.MeshLambertMaterial({ color: 0xcc6633 });
      const bud = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), budMat);
      bud.position.y = 0.3;
      group.add(bud);
    } else if (typeKey === 'moonflower') {
      // Pale stem growing
      const stemMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 6), stemMat);
      stem.position.y = 0.13;
      group.add(stem);
      // Silver leaf
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x8899aa });
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.06), leafMat);
      leaf.position.set(0.05, 0.12, 0);
      leaf.rotation.z = -0.4;
      group.add(leaf);
    } else if (typeKey === 'berryBush') {
      // Small bush forming
      const bushMat = new THREE.MeshLambertMaterial({ color: 0x336633 });
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), bushMat);
      bush.position.y = 0.15;
      group.add(bush);
      // Leaf boxes sticking out
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x44aa33 });
      const leaf1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), leafMat);
      leaf1.position.set(0.1, 0.15, 0.05);
      group.add(leaf1);
      const leaf2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), leafMat);
      leaf2.position.set(-0.08, 0.18, -0.04);
      group.add(leaf2);
    }

    return group;
  }

  // --- STAGE 2: MATURE ---
  // Full-size plant with unique look per type

  // Dirt mound base (all mature plants)
  const dirtMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.06, 8), dirtMat);
  dirt.position.y = 0.03;
  group.add(dirt);

  if (typeKey === 'glowingMushroom') {
    // --- GLOWING MUSHROOM (mature) ---
    // Thick stem
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xddddbb });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8), stemMat);
    stem.position.y = 0.15;
    group.add(stem);

    // Large mushroom cap (blue, glowing)
    const capMat = new THREE.MeshLambertMaterial({ color: 0x4488ff });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 10), capMat);
    cap.position.y = 0.35;
    group.add(cap);

    // Spots on the cap
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x66aaff });
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const spot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), spotMat);
      spot.position.set(
        Math.cos(angle) * 0.1,
        0.32,
        Math.sin(angle) * 0.1 - 0.02
      );
      group.add(spot);
    }

    // Blue point light for the glow effect
    const glow = new THREE.PointLight(0x4488ff, 0.5, 4);
    glow.position.y = 0.3;
    group.add(glow);
    group.userData.light = glow;

  } else if (typeKey === 'sunflower') {
    // --- SUNFLOWER (mature) ---
    // Tall stem
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x338833 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6), stemMat);
    stem.position.y = 0.3;
    group.add(stem);

    // Two leaves on the stem
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
    const leaf1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.08), leafMat);
    leaf1.position.set(0.08, 0.25, 0);
    leaf1.rotation.z = -0.4;
    group.add(leaf1);
    const leaf2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.08), leafMat);
    leaf2.position.set(-0.08, 0.35, 0);
    leaf2.rotation.z = 0.4;
    group.add(leaf2);

    // Flower disc (yellow center cone + outer petals)
    const discMat = new THREE.MeshLambertMaterial({ color: 0x886622 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), discMat);
    disc.position.y = 0.62;
    group.add(disc);

    // Yellow petal ring (flattened boxes around the disc)
    const petalMat = new THREE.MeshLambertMaterial({ color: 0xffcc22 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.05), petalMat);
      petal.position.set(
        Math.cos(angle) * 0.14,
        0.62,
        Math.sin(angle) * 0.14
      );
      petal.rotation.y = -angle;
      group.add(petal);
    }

    // Warm glow
    const glow = new THREE.PointLight(0xffee44, 0.3, 4);
    glow.position.y = 0.6;
    group.add(glow);
    group.userData.light = glow;

  } else if (typeKey === 'fireRose') {
    // --- FIRE ROSE (mature) ---
    // Bush base
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x335522 });
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bushMat);
    bush.position.y = 0.2;
    group.add(bush);

    // Thorny stem
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x223311 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 6), stemMat);
    stem.position.y = 0.35;
    group.add(stem);

    // Fire rose bloom - layers of orange/red petals
    const innerMat = new THREE.MeshLambertMaterial({ color: 0xff3311 });
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), innerMat);
    inner.position.y = 0.52;
    group.add(inner);

    const outerMat = new THREE.MeshLambertMaterial({ color: 0xff6622 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), outerMat);
      petal.position.set(
        Math.cos(angle) * 0.08,
        0.52,
        Math.sin(angle) * 0.08
      );
      petal.rotation.y = -angle;
      group.add(petal);
    }

    // Fire glow
    const glow = new THREE.PointLight(0xff4422, 0.4, 5);
    glow.position.y = 0.5;
    group.add(glow);
    group.userData.light = glow;

  } else if (typeKey === 'moonflower') {
    // --- MOONFLOWER (mature) ---
    // Pale silver stem
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x889999 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.45, 6), stemMat);
    stem.position.y = 0.25;
    group.add(stem);

    // Silver-white bloom (sphere + petals)
    const bloomMat = new THREE.MeshLambertMaterial({ color: 0xccddee });
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bloomMat);
    bloom.position.y = 0.5;
    group.add(bloom);

    // Ethereal petals
    const petalMat = new THREE.MeshLambertMaterial({
      color: 0xeeeeff,
      transparent: true,
      opacity: 0.8
    });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.04), petalMat);
      petal.position.set(
        Math.cos(angle) * 0.1,
        0.5,
        Math.sin(angle) * 0.1
      );
      petal.rotation.y = -angle;
      group.add(petal);
    }

    // Pale moonlight glow
    const glow = new THREE.PointLight(0xaaccff, 0.4, 4);
    glow.position.y = 0.5;
    group.add(glow);
    group.userData.light = glow;

    // Curling leaf
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.06), leafMat);
    leaf.position.set(0.06, 0.2, 0);
    leaf.rotation.z = -0.5;
    group.add(leaf);

  } else if (typeKey === 'berryBush') {
    // --- BERRY BUSH (mature) ---
    // Full leafy bush
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x336633 });
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), bushMat);
    bush.position.y = 0.28;
    group.add(bush);

    // Extra leaf clumps
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x44aa33 });
    const clump1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), leafMat);
    clump1.position.set(0.15, 0.35, 0.1);
    group.add(clump1);
    const clump2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), leafMat);
    clump2.position.set(-0.12, 0.32, -0.08);
    group.add(clump2);

    // Berries! (small red/purple spheres)
    const berryMat = new THREE.MeshLambertMaterial({ color: 0xcc2266 });
    const berryPositions = [
      { x: 0.1, y: 0.4, z: 0.15 },
      { x: -0.08, y: 0.38, z: -0.1 },
      { x: 0.15, y: 0.3, z: -0.05 },
      { x: -0.12, y: 0.42, z: 0.08 },
      { x: 0.0, y: 0.45, z: 0.0 }
    ];
    for (const bp of berryPositions) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), berryMat);
      berry.position.set(bp.x, bp.y, bp.z);
      group.add(berry);
    }
  }

  return group;
}

// ============================================
// UPDATE GARDEN (called every frame)
// Grows plants, applies effects, handles harvest
// ============================================

function updateGarden(delta) {
  if (customState.garden.length === 0) return;

  for (let i = customState.garden.length - 1; i >= 0; i--) {
    const plant = customState.garden[i];
    const age = totalTime - plant.plantTime;

    // --- GROWTH STAGES ---
    let targetStage = 0;
    if (age >= STAGE_2_TIME) {
      targetStage = 2;
    } else if (age >= STAGE_1_TIME) {
      targetStage = 1;
    }

    // Upgrade mesh if stage changed
    if (targetStage > plant.stage) {
      plant.stage = targetStage;

      // Remove old mesh
      if (plant.mesh && plant.mesh.parent) {
        plant.mesh.parent.remove(plant.mesh);
      }

      // Create new mesh for the new stage
      plant.mesh = createPlantMesh(plant.type, plant.stage);
      plant.mesh.position.set(plant.position.x, 0, plant.position.z);
      scene.add(plant.mesh);

      if (targetStage === 2) {
        showLootText(plant.config.name + ' is fully grown!');
      }
    }

    // --- MATURE PLANT EFFECTS ---
    if (plant.stage === 2) {
      applyPlantEffect(plant, delta);
    }

    // --- ANIMATE LIGHTS (gentle pulse) ---
    if (plant.mesh && plant.mesh.userData.light) {
      const light = plant.mesh.userData.light;
      const baseIntensity = (plant.type === 'glowingMushroom') ? 0.5 :
                            (plant.type === 'fireRose') ? 0.4 : 0.3;
      light.intensity = baseIntensity + Math.sin(totalTime * 2 + i) * 0.15;
    }

    // --- MOONFLOWER VISIBILITY ---
    // Only visible at night
    if (plant.type === 'moonflower' && plant.mesh) {
      if (plant.stage === 2) {
        plant.mesh.visible = dayNightState.isNight;
      }
    }
  }
}

// ============================================
// APPLY PLANT EFFECTS (per-frame for mature plants)
// ============================================

function applyPlantEffect(plant, delta) {
  const pType = PLANT_TYPES[plant.type];
  if (!pType) return;

  if (pType.effectType === 'heal') {
    // --- SUNFLOWER: Heal nearby players ---
    const dx = playerState.position.x - plant.position.x;
    const dz = playerState.position.z - plant.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < pType.healRadius && playerState.alive) {
      playerState.health = Math.min(
        playerState.maxHealth,
        playerState.health + pType.healRate * delta
      );
    }
  }

  if (pType.effectType === 'slow') {
    // --- FIRE ROSE: Slow enemies near camp ---
    // We mark enemies that are near any fire rose for speed reduction
    // The actual slow is applied in the enemy update loop via a flag
    if (typeof enemies !== 'undefined') {
      for (const enemy of enemies) {
        if (enemy.health <= 0) continue;
        const dx = enemy.mesh.position.x - plant.position.x;
        const dz = enemy.mesh.position.z - plant.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < pType.slowRadius) {
          // Mark as slowed this frame (will reset next frame naturally)
          enemy._fireRoseSlowed = pType.slowFactor;
        }
      }
    }
  }

  if (pType.effectType === 'meat') {
    // --- BERRY BUSH: Produce 1 meat per day cycle ---
    if (dayNightState.dayCount > plant.lastDayCycle && !plant.harvested) {
      plant.lastDayCycle = dayNightState.dayCount;

      // Auto-drop a meat pickup near the plant
      createBerryDrop(plant.position.x, plant.position.z);
      showLootText('Berry Bush produced meat!');
    }
  }
}

// ============================================
// CREATE A BERRY DROP (meat pickup on the ground)
// ============================================

function createBerryDrop(x, z) {
  const group = new THREE.Group();

  // Small red berry cluster
  const mat = new THREE.MeshLambertMaterial({ color: 0xcc3355 });
  const berry = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat);
  berry.position.y = 0.12;
  group.add(berry);

  // Glow
  const glow = new THREE.PointLight(0xff6688, 0.4, 3);
  glow.position.y = 0.2;
  group.add(glow);

  group.position.set(x + (Math.random() - 0.5) * 0.8, 0, z + (Math.random() - 0.5) * 0.8);
  scene.add(group);

  // Track it as a pickup that can be auto-collected
  if (typeof gardenPickups === 'undefined') {
    // Create the array on first use (avoids top-level issues)
    window.gardenPickups = [];
  }
  gardenPickups.push({
    mesh: group,
    resource: 'meat',
    amount: 1,
    collected: false
  });
}

// Track garden pickups (berries on the ground)
const gardenPickups = [];

// ============================================
// UPDATE GARDEN PICKUPS (auto-collect berries)
// ============================================

function updateGardenPickups() {
  if (gardenPickups.length === 0) return;

  for (let i = gardenPickups.length - 1; i >= 0; i--) {
    const pickup = gardenPickups[i];
    if (pickup.collected) continue;

    const dx = playerState.position.x - pickup.mesh.position.x;
    const dz = playerState.position.z - pickup.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Auto-collect when within 2 units (must have sack selected)
    if (dist < 2 && playerState.selectedSlot === 2) {
      if (!sackHasRoom(1)) continue;

      pickup.collected = true;
      playerState.inventory[pickup.resource] += pickup.amount;
      updateInventoryUI();
      showLootText('+' + pickup.amount + ' meat (Berry)');

      if (pickup.mesh.parent) pickup.mesh.parent.remove(pickup.mesh);
      gardenPickups.splice(i, 1);
    }
  }
}

// ============================================
// HARVEST A MATURE PLANT (press E near it)
// Only moonflower produces gems on harvest.
// ============================================

function harvestPlant(index) {
  if (index < 0 || index >= customState.garden.length) return;

  const plant = customState.garden[index];
  if (plant.stage < 2) return;  // Not mature yet

  if (plant.type === 'moonflower') {
    // Moonflower: harvest for 1 gem, then regrow
    if (!dayNightState.isNight) {
      showLootText('Moonflower can only be harvested at night!');
      return;
    }
    if (!sackHasRoom(1)) {
      showLootText('Sack is full!');
      return;
    }

    playerState.inventory.gems += 1;
    updateInventoryUI();
    showLootText('+1 Gem from Moonflower!');

    // Regrow: reset to stage 0
    plant.stage = 0;
    plant.plantTime = totalTime;
    if (plant.mesh && plant.mesh.parent) {
      plant.mesh.parent.remove(plant.mesh);
    }
    plant.mesh = createPlantMesh(plant.type, 0);
    plant.mesh.position.set(plant.position.x, 0, plant.position.z);
    scene.add(plant.mesh);
  }
}

// ============================================
// CHECK HARVEST (called when E is pressed)
// Looks for a mature harvestable plant nearby
// ============================================

function checkGardenHarvest() {
  const px = playerState.position.x;
  const pz = playerState.position.z;

  for (let i = 0; i < customState.garden.length; i++) {
    const plant = customState.garden[i];
    if (plant.stage < 2) continue;
    if (plant.type !== 'moonflower') continue; // Only moonflowers are manually harvested

    const dx = px - plant.position.x;
    const dz = pz - plant.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.5) {
      harvestPlant(i);
      return;
    }
  }
}


// ============================================
// ============================================
//
//   MULTIPLAYER SYNC
//
//   Send hat and outfit data with position
//   updates, and apply them to other players.
//
// ============================================
// ============================================

// ============================================
// PATCH: Extend sendPlayerPosition to include
// hat and outfit data. We wrap the original.
// ============================================

const _originalSendPlayerPosition = (typeof sendPlayerPosition !== 'undefined')
  ? sendPlayerPosition
  : null;

function sendPlayerPositionWithCustomization() {
  if (!mpState.inGame) return;

  socket.emit('playerUpdate', {
    x: playerState.position.x,
    y: 0,
    z: playerState.position.z,
    rotationY: playerState.mesh ? playerState.mesh.rotation.y : playerState.yaw,
    isSwinging: playerState.isSwinging,
    // Customization data
    hat: customState.currentHat,
    outfit: customState.outfit
  });
}

// Replace the global sendPlayerPosition if it exists
if (_originalSendPlayerPosition) {
  // Override the global function
  window.sendPlayerPosition = sendPlayerPositionWithCustomization;
}

// ============================================
// PATCH: Extend updateOtherPlayer to apply
// hat and outfit to other player meshes.
// ============================================

const _originalUpdateOtherPlayer = (typeof updateOtherPlayer !== 'undefined')
  ? updateOtherPlayer
  : null;

function updateOtherPlayerWithCustomization(data) {
  // Call original first
  if (_originalUpdateOtherPlayer) {
    _originalUpdateOtherPlayer(data);
  }

  // Now apply customization
  const other = mpState.otherPlayers[data.id];
  if (!other || !other.mesh) return;

  // Apply hat if it changed
  if (data.hat !== undefined && other._lastHat !== data.hat) {
    other._lastHat = data.hat;
    applyHatToMesh(other.mesh, data.hat);
  }

  // Apply outfit if it changed
  if (data.outfit !== undefined && other._lastOutfit !== data.outfit) {
    other._lastOutfit = data.outfit;
    applyOutfitToOtherPlayer(other.mesh, data.outfit);
  }
}

// Replace global if it exists
if (_originalUpdateOtherPlayer) {
  window.updateOtherPlayer = updateOtherPlayerWithCustomization;
}


// ============================================
// ============================================
//
//   KEYBOARD HOOKS
//
//   H = cycle hats
//   G = plant seed
//   E = also check garden harvest
//
// ============================================
// ============================================

// We add a new keydown listener for H and G keys,
// and also hook into E for garden harvest.
document.addEventListener('keydown', (event) => {
  if (!playerState.isPlaying) return;

  switch (event.code) {
    case 'KeyH':
      cycleHat();
      break;
    case 'KeyG':
      plantSeed();
      break;
    case 'KeyE':
      // Check garden harvest in addition to existing E actions
      checkGardenHarvest();
      break;
  }
});


// ============================================
// ============================================
//
//   TREE CHOP HOOK
//
//   Monkey-patch checkTreeChop to add seed drops.
//   We wrap the original function.
//
// ============================================
// ============================================

const _originalCheckTreeChop = (typeof checkTreeChop !== 'undefined')
  ? checkTreeChop
  : null;

if (_originalCheckTreeChop) {
  window.checkTreeChop = function(lookDir) {
    // Count trees before to detect if one was chopped
    const treesCountBefore = (typeof trees !== 'undefined' && trees) ? trees.length : 0;

    // Call original
    _originalCheckTreeChop(lookDir);

    // Check if a tree was actually chopped (trees array got shorter)
    const treesCountAfter = (typeof trees !== 'undefined' && trees) ? trees.length : 0;
    if (treesCountAfter < treesCountBefore) {
      tryDropSeed();
    }
  };
}


// ============================================
// ============================================
//
//   RESCUE HOOK
//
//   Monkey-patch rescueKid to unlock hats.
//
// ============================================
// ============================================

const _originalRescueKid = (typeof rescueKid !== 'undefined')
  ? rescueKid
  : null;

if (_originalRescueKid) {
  window.rescueKid = function(cave) {
    // Call original rescue logic
    _originalRescueKid(cave);

    // Unlock the hat for this kid!
    if (cave && cave.id) {
      unlockHat(cave.id);
    }
  };
}


// ============================================
// ============================================
//
//   INITIALIZATION & MAIN UPDATE
//
//   initCustomization() - call once after game starts
//   updateCustomization(delta) - call every frame
//
// ============================================
// ============================================

function initCustomization() {
  // Initialize seeds in inventory if not present
  if (typeof playerState.inventory.seeds === 'undefined') {
    playerState.inventory.seeds = 0;
  }

  // Apply default outfit to the player
  if (playerState.mesh) {
    applyOutfit(playerState.mesh, customState.outfit);
  }

  // Inject CSS for garden/hat prompts
  injectCustomizationCSS();

  console.log('Customization systems initialized.');
}

function updateCustomization(delta) {
  // Update garden plants (growth, effects)
  updateGarden(delta);

  // Update garden berry pickups
  updateGardenPickups();

  // Show garden plant prompts when near
  updateGardenPrompts();
}

// ============================================
// GARDEN PROMPTS (show "Press E to harvest")
// ============================================

function updateGardenPrompts() {
  const px = playerState.position.x;
  const pz = playerState.position.z;

  let showPrompt = false;
  let promptText = '';

  for (const plant of customState.garden) {
    const dx = px - plant.position.x;
    const dz = pz - plant.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.5) {
      if (plant.stage < 2) {
        const stageNames = ['Sprout', 'Growing', 'Mature'];
        promptText = plant.config.name + ' (' + stageNames[plant.stage] + ')';
        showPrompt = true;
      } else if (plant.type === 'moonflower') {
        if (dayNightState.isNight) {
          promptText = 'Press E to harvest ' + plant.config.name;
        } else {
          promptText = plant.config.name + ' (harvest at night)';
        }
        showPrompt = true;
      } else {
        promptText = plant.config.name + ' - ' + plant.config.description;
        showPrompt = true;
      }
      break; // Only show one prompt at a time
    }
  }

  const el = document.getElementById('garden-prompt');
  if (el) {
    if (showPrompt) {
      el.textContent = promptText;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }
}


// ============================================
// INJECTED CSS & DOM
// ============================================

function injectCustomizationCSS() {
  if (document.getElementById('customization-styles')) return;

  const style = document.createElement('style');
  style.id = 'customization-styles';
  style.textContent = `
    /* Garden prompt */
    #garden-prompt {
      position: fixed;
      bottom: 140px;
      left: 50%;
      transform: translateX(-50%);
      color: #88dd88;
      font-size: 14px;
      font-family: 'Courier New', monospace;
      text-shadow: 0 0 8px rgba(100,200,100,0.5), 1px 1px 2px black;
      pointer-events: none;
      z-index: 40;
      display: none;
      white-space: nowrap;
      background: rgba(0,0,0,0.4);
      padding: 4px 12px;
      border-radius: 4px;
    }

    /* Seed count in sack (if visible) */
    .seed-count {
      color: #88cc44;
    }
  `;

  document.head.appendChild(style);

  // Create garden prompt element
  if (!document.getElementById('garden-prompt')) {
    const el = document.createElement('div');
    el.id = 'garden-prompt';
    document.body.appendChild(el);
  }
}

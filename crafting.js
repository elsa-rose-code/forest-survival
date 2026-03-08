// ============================================
// CRAFTING.JS - Crafting Table & Grinder!
// Build beds to create a safe shelter and WIN!
// Press C near the crafting table to open the menu
// ============================================

const CRAFTING_TABLE_RANGE = 5; // How close you need to be to use it

// --- CRAFTING STATE ---
const craftingState = {
  tableMesh: null,
  grinderLevel: 1,       // Grinder starts at level 1
  maxGrinderLevel: 3,
  bedsBuilt: 0,
  maxBeds: 4,
  bedMeshes: [],
  menuOpen: false,
  won: false              // Once 4 beds built, no more crafting
};

// --- GRINDER UPGRADE COSTS ---
const GRINDER_UPGRADES = {
  2: { scrap: 5, wood: 5, label: 'Lv.2 Grinder (5 Scrap + 5 Wood)' },
  3: { scrap: 10, wood: 8, coal: 3, label: 'Lv.3 Grinder (10 Scrap + 8 Wood + 3 Coal)' }
};

// --- RECIPES (unlocked by grinder level) ---
const CRAFT_RECIPES = {
  bed: {
    name: 'Bed',
    grinderLevel: 1,
    cost: { wood: 4, bones: 2 },
    description: 'A cozy bed. Build 4 to win!',
    maxCount: 4
  },
  sundial: {
    name: 'Sundial',
    grinderLevel: 1,
    cost: { scrap: 3, wood: 2 },
    description: 'Shows day/night progress',
    maxCount: 1
  },
  map: {
    name: 'Map',
    grinderLevel: 2,
    cost: { scrap: 4, wood: 2, bones: 1 },
    description: 'Shows a compass pointing to camp',
    maxCount: 1
  }
};

// Track how many of each item we've crafted
const craftCounts = {
  bed: 0,
  sundial: 0,
  map: 0
};

// ============================================
// CREATE THE CRAFTING TABLE + GRINDER MESH
// Placed near the campfire in the camp
// ============================================
function createCraftingTable(scene) {
  const group = new THREE.Group();

  // --- CRAFTING TABLE (wooden workbench) ---
  const tableMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x4a2f15 });

  // Table top
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 1.2), tableMat);
  top.position.y = 1.0;
  top.castShadow = true;
  group.add(top);

  // 4 Legs
  const legGeo = new THREE.BoxGeometry(0.15, 1.0, 0.15);
  const positions = [
    [-0.7, 0.5, -0.4], [0.7, 0.5, -0.4],
    [-0.7, 0.5, 0.4],  [0.7, 0.5, 0.4]
  ];
  for (const p of positions) {
    const leg = new THREE.Mesh(legGeo, darkWoodMat);
    leg.position.set(p[0], p[1], p[2]);
    leg.castShadow = true;
    group.add(leg);
  }

  // Tools on top (little hammer shape)
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), handleMat);
  handle.position.set(0.3, 1.25, 0);
  handle.rotation.z = 0.3;
  group.add(handle);

  const headMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), headMat);
  hammerHead.position.set(0.42, 1.42, 0);
  group.add(hammerHead);

  // --- GRINDER (stone cylinder next to table) ---
  const grinderMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const grinder = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.8, 12), grinderMat);
  grinder.position.set(-0.2, 1.45, 0);
  grinder.castShadow = true;
  group.add(grinder);

  // Grinder handle (crank)
  const crankMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const crank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), crankMat);
  crank.position.set(-0.2, 1.9, 0);
  group.add(crank);
  group.userData.crank = crank;

  // Glow light so players can find it
  const glow = new THREE.PointLight(0xffaa44, 0.6, 8);
  glow.position.y = 1.5;
  group.add(glow);
  group.userData.glow = glow;

  // Position: near the tent, opposite side from logs
  group.position.set(-5, 0, 5);

  scene.add(group);
  craftingState.tableMesh = group;

  return group;
}

// ============================================
// BED MESH - Cozy little bed placed in camp
// ============================================
function createBedMesh(index) {
  const bed = new THREE.Group();

  // Bed frame (dark wood)
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 2.0), frameMat);
  frame.position.y = 0.25;
  frame.castShadow = true;
  bed.add(frame);

  // Mattress (soft white-ish)
  const mattressMat = new THREE.MeshLambertMaterial({ color: 0xddccbb });
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 1.8), mattressMat);
  mattress.position.y = 0.48;
  bed.add(mattress);

  // Pillow
  const pillowMat = new THREE.MeshLambertMaterial({ color: 0xeeeedd });
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), pillowMat);
  pillow.position.set(0, 0.6, -0.65);
  bed.add(pillow);

  // Blanket (cozy colored — each bed gets a different color!)
  const blanketColors = [0xcc4444, 0x4488cc, 0x44aa44, 0xddaa22];
  const blanketMat = new THREE.MeshLambertMaterial({ color: blanketColors[index % 4] });
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.2), blanketMat);
  blanket.position.set(0, 0.58, 0.2);
  bed.add(blanket);

  // Headboard
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.1), frameMat);
  headboard.position.set(0, 0.55, -0.95);
  bed.add(headboard);

  // Position beds in a row inside the camp
  const bedPositions = [
    { x: -6, z: -3, rot: 0.3 },
    { x: -7, z: 0, rot: 0 },
    { x: -6, z: 3, rot: -0.3 },
    { x: -4, z: 5, rot: -0.6 }
  ];
  const pos = bedPositions[index];
  bed.position.set(pos.x, 0, pos.z);
  bed.rotation.y = pos.rot;

  return bed;
}

// ============================================
// OPEN / CLOSE CRAFTING MENU
// ============================================
function toggleCraftingMenu() {
  // Can't craft if you already won by beds!
  if (craftingState.won) {
    showLootText('All beds built! Rest well...');
    return;
  }

  // Check if player is near the crafting table
  if (!craftingState.tableMesh) return;
  const dist = playerState.position.distanceTo(craftingState.tableMesh.position);
  if (dist > CRAFTING_TABLE_RANGE) {
    showLootText('Get closer to the Crafting Table!');
    return;
  }

  craftingState.menuOpen = !craftingState.menuOpen;
  const menu = document.getElementById('crafting-menu');
  if (menu) {
    menu.style.display = craftingState.menuOpen ? 'flex' : 'none';
    if (craftingState.menuOpen) {
      updateCraftingUI();
    }
  }
}

// ============================================
// UPDATE CRAFTING UI
// ============================================
function updateCraftingUI() {
  const menu = document.getElementById('crafting-menu');
  if (!menu) return;

  // Update grinder level display
  const grinderEl = document.getElementById('grinder-level');
  if (grinderEl) {
    grinderEl.textContent = 'Grinder Lv.' + craftingState.grinderLevel;
  }

  // Update bed counter
  const bedCountEl = document.getElementById('bed-count');
  if (bedCountEl) {
    bedCountEl.textContent = craftingState.bedsBuilt + ' / ' + craftingState.maxBeds;
  }

  // Update recipe buttons
  for (const [id, recipe] of Object.entries(CRAFT_RECIPES)) {
    const btn = document.getElementById('craft-' + id);
    if (!btn) continue;

    const locked = recipe.grinderLevel > craftingState.grinderLevel;
    const maxed = craftCounts[id] >= recipe.maxCount;
    const canAfford = checkCanAfford(recipe.cost);

    btn.disabled = locked || maxed || !canAfford;

    if (locked) {
      btn.textContent = recipe.name + ' (Grinder Lv.' + recipe.grinderLevel + ')';
      btn.classList.add('recipe-locked');
    } else if (maxed) {
      btn.textContent = recipe.name + ' (BUILT)';
      btn.classList.add('recipe-locked');
    } else {
      btn.textContent = recipe.name + ' - ' + formatCost(recipe.cost);
      btn.classList.remove('recipe-locked');
    }
  }

  // Update grinder upgrade button
  const upgradeBtn = document.getElementById('craft-upgrade-grinder');
  if (upgradeBtn) {
    const nextLevel = craftingState.grinderLevel + 1;
    if (nextLevel > craftingState.maxGrinderLevel) {
      upgradeBtn.textContent = 'Grinder MAX';
      upgradeBtn.disabled = true;
    } else {
      const upgradeCost = GRINDER_UPGRADES[nextLevel];
      const canAfford = checkCanAfford(upgradeCost);
      upgradeBtn.textContent = upgradeCost.label;
      upgradeBtn.disabled = !canAfford;
    }
  }
}

// ============================================
// CHECK IF PLAYER CAN AFFORD A RECIPE
// ============================================
function checkCanAfford(cost) {
  const inv = playerState.inventory;
  for (const [resource, amount] of Object.entries(cost)) {
    if (resource === 'label') continue; // skip labels in grinder upgrades
    if ((inv[resource] || 0) < amount) return false;
  }
  return true;
}

// ============================================
// SPEND RESOURCES
// ============================================
function spendResources(cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    if (resource === 'label') continue;
    playerState.inventory[resource] -= amount;
  }
  updateSackUI();
}

// ============================================
// FORMAT COST FOR DISPLAY
// ============================================
function formatCost(cost) {
  const parts = [];
  for (const [resource, amount] of Object.entries(cost)) {
    if (resource === 'label') continue;
    parts.push(amount + ' ' + resource);
  }
  return parts.join(' + ');
}

// ============================================
// CRAFT AN ITEM!
// ============================================
function craftItem(itemId) {
  if (craftingState.won) return;

  const recipe = CRAFT_RECIPES[itemId];
  if (!recipe) return;

  // Check grinder level
  if (recipe.grinderLevel > craftingState.grinderLevel) {
    showLootText('Upgrade your Grinder first!');
    return;
  }

  // Check max count
  if (craftCounts[itemId] >= recipe.maxCount) {
    showLootText(recipe.name + ' already built!');
    return;
  }

  // Check resources
  if (!checkCanAfford(recipe.cost)) {
    showLootText('Not enough resources!');
    return;
  }

  // Spend resources and craft!
  spendResources(recipe.cost);
  craftCounts[itemId]++;

  // --- ITEM-SPECIFIC EFFECTS ---
  if (itemId === 'bed') {
    craftBed();
  } else if (itemId === 'sundial') {
    craftSundial();
  } else if (itemId === 'map') {
    craftMap();
  }

  showLootText(recipe.name + ' crafted!');
  updateCraftingUI();
}

// ============================================
// CRAFT A BED
// ============================================
function craftBed() {
  craftingState.bedsBuilt++;

  // Create and place the bed mesh
  const bed = createBedMesh(craftingState.bedsBuilt - 1);
  scene.add(bed);
  craftingState.bedMeshes.push(bed);

  // Update bed counter in the crafting UI
  const bedCountEl = document.getElementById('bed-count');
  if (bedCountEl) {
    bedCountEl.textContent = craftingState.bedsBuilt + ' / ' + craftingState.maxBeds;
  }

  // CHECK WIN CONDITION: 4 beds = victory!
  if (craftingState.bedsBuilt >= craftingState.maxBeds) {
    craftingState.won = true;

    // Close the crafting menu
    craftingState.menuOpen = false;
    const menu = document.getElementById('crafting-menu');
    if (menu) menu.style.display = 'none';

    // Show victory!
    setTimeout(() => {
      showBedVictoryScreen();
    }, 1500);
  }
}

// ============================================
// BED VICTORY SCREEN
// ============================================
function showBedVictoryScreen() {
  const victory = document.getElementById('victory-screen');
  if (victory) {
    // Update text for bed victory
    const sub = victory.querySelector('.victory-sub');
    if (sub) sub.textContent = 'You built a shelter! The forest can\'t hurt you anymore.';
    const kids = victory.querySelector('.victory-kids');
    if (kids) kids.textContent = '4 cozy beds - A safe home in the forest';
    victory.style.display = 'flex';
  }
}

// ============================================
// CRAFT SUNDIAL (shows day/night timer)
// ============================================
function craftSundial() {
  // Show the sundial HUD element
  const el = document.getElementById('sundial-hud');
  if (el) el.style.display = 'block';
}

// ============================================
// CRAFT MAP (compass pointing to camp)
// ============================================
function craftMap() {
  // Show the compass HUD element
  const el = document.getElementById('map-compass');
  if (el) el.style.display = 'block';
}

// ============================================
// UPGRADE THE GRINDER
// ============================================
function upgradeGrinder() {
  const nextLevel = craftingState.grinderLevel + 1;
  if (nextLevel > craftingState.maxGrinderLevel) return;

  const cost = GRINDER_UPGRADES[nextLevel];
  if (!checkCanAfford(cost)) {
    showLootText('Not enough resources!');
    return;
  }

  spendResources(cost);
  craftingState.grinderLevel = nextLevel;

  showLootText('Grinder upgraded to Lv.' + nextLevel + '!');

  // Visual: make grinder glow brighter
  if (craftingState.tableMesh && craftingState.tableMesh.userData.glow) {
    craftingState.tableMesh.userData.glow.intensity = 0.6 + (nextLevel - 1) * 0.4;
  }

  updateCraftingUI();
}

// ============================================
// PROMPT (shows "Press C" when near table)
// ============================================
function updateCraftingPrompt(playerPos) {
  const prompt = document.getElementById('crafting-prompt');
  if (!prompt || !craftingState.tableMesh) return;

  const dist = playerPos.distanceTo(craftingState.tableMesh.position);

  if (dist < CRAFTING_TABLE_RANGE && !craftingState.menuOpen) {
    prompt.style.display = 'block';
  } else {
    prompt.style.display = 'none';
  }

  // Animate the grinder crank
  if (craftingState.tableMesh.userData.crank) {
    craftingState.tableMesh.userData.crank.rotation.y = Math.sin(totalTime * 2) * 0.3;
  }
}

// ============================================
// UPDATE SUNDIAL HUD (if crafted)
// ============================================
function updateSundialHUD() {
  const el = document.getElementById('sundial-hud');
  if (!el || el.style.display === 'none') return;

  const progress = Math.round(dayNightState.time * 100);
  const isNight = dayNightState.isNight;
  el.textContent = (isNight ? 'Night' : 'Day') + ' ' + progress + '%';
  el.style.color = isNight ? '#ff6644' : '#ffcc44';
}

// ============================================
// UPDATE MAP COMPASS (if crafted)
// ============================================
function updateMapCompass() {
  const el = document.getElementById('map-compass');
  if (!el || el.style.display === 'none') return;

  // Arrow pointing toward camp center (0,0,0)
  const dx = -playerState.position.x;
  const dz = -playerState.position.z;
  const angle = Math.atan2(dx, dz) - playerState.yaw;
  const dist = Math.round(playerState.position.distanceTo(new THREE.Vector3(0, 0, 0)));

  const arrow = el.querySelector('.compass-arrow');
  if (arrow) {
    arrow.style.transform = 'rotate(' + (-angle * 180 / Math.PI) + 'deg)';
  }
  const distEl = el.querySelector('.compass-dist');
  if (distEl) {
    distEl.textContent = dist + 'm';
  }
}

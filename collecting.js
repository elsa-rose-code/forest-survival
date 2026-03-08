// ============================================
// COLLECTING.JS - Discovery & Collection Systems
// 7 features for "99 Nights in the Forest":
//   #16 - Firefly Jar (collect 20 fireflies at night)
//   #17 - Bunny Census (12 color variants)
//   #18 - Monster Bestiary (kill tracking + J key)
//   #19 - Constellation Map (8 night sky patterns)
//   #21 - Whispering Journal (20 lore pages + L key)
//   #23 - Secret Cave Paintings (8 paintings)
//   #8  - Creature Charm Necklace (5 charm types)
//
// Globals used (from other files via shared scope):
//   scene, camera, totalTime, playerState,
//   dayNightState, campfireState, enemies[],
//   kidCaves[], SAFE_ZONE_RADIUS,
//   showLootText(), sackHasRoom(), updateInventoryUI()
// ============================================


// ============================================
// UNIFIED COLLECT STATE
// Every collection system stores its data here.
// ============================================

const collectState = {
  // #16 Firefly Jar
  fireflies: [],
  firefliesCollected: 0,
  fireflyJarActive: false,

  // #17 Bunny Census
  bunnyBook: {},          // { variantName: true }
  bunnyCensusCount: 0,

  // #18 Bestiary
  bestiary: {},           // { wolf: { kills: 0, seen: false }, ... }

  // #19 Constellation Map
  constellations: {},     // { 'The Wolf': true, ... }
  starMapComplete: false,

  // #21 Whispering Journal
  journalPages: [],       // Indices of collected pages
  journalPageMeshes: [],  // { group, glow, pageIndex } for each page in the world

  // #23 Cave Paintings
  paintings: [],          // Indices of found paintings
  paintingsComplete: false,

  // #8 Creature Charm Necklace
  charms: { wolf: false, bear: false, deer: false, bunny: false, cultist: false },
  charmMeshes: [],        // Ground pickups awaiting collection
  forestGuardian: false,
  droppedCharms: []       // Alias for charmMeshes (legacy compat)
};


// ============================================
// #16 - FIREFLY JAR
// At night, 15-20 point-light fireflies spawn
// within map radius. Walk through them with
// sack equipped to auto-collect. 20 completes
// the jar, giving a permanent player glow and
// a 4-unit safe aura that slows enemies to 30%.
// ============================================

// Global flag — enemy AI reads this to slow movement
let fireflyJarActive = false;

const FIREFLY_COLLECT_DIST = 2;
const FIREFLY_SPAWN_COUNT = 18;  // Between 15-20
const FIREFLY_TARGET = 20;
const FIREFLY_SLOW_RADIUS = 4;
const FIREFLY_SLOW_FACTOR = 0.3; // 30% speed

// Internal firefly state for meshes and lights
let _fireflyJarLight = null;

// --- INIT FIREFLIES ---
// Call once from startGame() after scene is ready.
function initFireflies(scene) {
  // Nothing to pre-build; fireflies are spawned dynamically at night.
  // We just make sure the state is clean.
  collectState.fireflies = [];
  collectState.firefliesCollected = 0;
  collectState.fireflyJarActive = false;
  fireflyJarActive = false;
  _fireflyJarLight = null;
}

// --- UPDATE FIREFLIES EACH FRAME ---
function updateFireflies(delta) {
  const t = totalTime || 0;
  const playerPos = playerState.position;

  // --- Despawn at dawn ---
  if (!dayNightState.isNight) {
    for (const ff of collectState.fireflies) {
      if (ff.group && ff.group.parent) ff.group.parent.remove(ff.group);
    }
    collectState.fireflies = [];
    return;
  }

  // --- Respawn at night (if jar not yet complete) ---
  if (!collectState.fireflyJarActive && collectState.fireflies.length < FIREFLY_SPAWN_COUNT) {
    const toSpawn = FIREFLY_SPAWN_COUNT - collectState.fireflies.length;
    for (let s = 0; s < Math.min(toSpawn, 3); s++) {
      _spawnFirefly();
    }
  }

  // --- Animate and collect ---
  for (let i = collectState.fireflies.length - 1; i >= 0; i--) {
    const ff = collectState.fireflies[i];
    if (!ff || !ff.group) continue;

    // Floating sin-wave movement (unique phase per firefly)
    ff.group.position.x += ff.vel.x * delta;
    ff.group.position.z += ff.vel.z * delta;
    ff.group.position.y = 1.0
      + Math.sin(t * 1.8 + ff.phase) * 0.6
      + Math.sin(t * 0.9 + ff.phase * 2) * 0.3;

    // Organic drift via sine nudge
    ff.vel.x += Math.sin(t * 0.7 + ff.phase) * 0.3 * delta;
    ff.vel.z += Math.cos(t * 0.5 + ff.phase) * 0.3 * delta;
    const spd = Math.sqrt(ff.vel.x ** 2 + ff.vel.z ** 2);
    if (spd > 2) { ff.vel.x /= spd / 2; ff.vel.z /= spd / 2; }

    // Pulse the point light glow
    ff.light.intensity = 0.2 + Math.abs(Math.sin(t * 3 + ff.phase)) * 0.25;

    // Wrap fireflies that drift beyond map radius
    const maxR = campfireState ? (campfireState.mapRadius - 5) : 75;
    const dist = Math.sqrt(ff.group.position.x ** 2 + ff.group.position.z ** 2);
    if (dist > maxR) {
      ff.group.position.set(
        (Math.random() - 0.5) * 40,
        1,
        (Math.random() - 0.5) * 40
      );
    }

    // Auto-collect when player walks through with sack equipped
    if (!collectState.fireflyJarActive && playerState.selectedSlot === 2) {
      const dx = playerPos.x - ff.group.position.x;
      const dz = playerPos.z - ff.group.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < FIREFLY_COLLECT_DIST) {
        collectState.firefliesCollected++;
        if (ff.group.parent) ff.group.parent.remove(ff.group);
        collectState.fireflies.splice(i, 1);

        showLootText('Firefly! (' + collectState.firefliesCollected + '/' + FIREFLY_TARGET + ')');

        if (collectState.firefliesCollected >= FIREFLY_TARGET) {
          _activateFireflyJar();
        }
        continue;
      }
    }
  }

  // Pulse the jar light if active
  if (collectState.fireflyJarActive && _fireflyJarLight && playerState.mesh) {
    _fireflyJarLight.intensity = 0.8 + Math.sin(t * 1.2) * 0.2;
  }

  // --- Firefly jar enemy slow aura ---
  // Enemies within FIREFLY_SLOW_RADIUS of the player hesitate (30% speed).
  // This is applied here so enemy AI doesn't need to know about collecting.js.
  if (collectState.fireflyJarActive) {
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;
      const dx = playerPos.x - enemy.mesh.position.x;
      const dz = playerPos.z - enemy.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < FIREFLY_SLOW_RADIUS) {
        // Mark enemy as slowed this frame (reset each frame in the main loop
        // or just directly reduce speed here). We use a flag so AI can check.
        enemy._fireflySlowed = true;
      } else {
        enemy._fireflySlowed = false;
      }
    }
  }
}

// Spawn a single firefly at a random position within map radius
function _spawnFirefly() {
  const mapR = campfireState ? (campfireState.mapRadius - 5) : 75;
  const angle = Math.random() * Math.PI * 2;
  const dist = SAFE_ZONE_RADIUS + 3 + Math.random() * (mapR - SAFE_ZONE_RADIUS - 5);
  const cx = Math.cos(angle) * dist;
  const cz = Math.sin(angle) * dist;

  const group = new THREE.Group();
  group.position.set(cx, 1, cz);

  // Tiny green emissive sphere (spec: SphereGeometry(0.05, 4, 4))
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xaaffaa })
  );
  group.add(mesh);

  // Point light (spec: 0xaaffaa, 0.3, 3)
  const light = new THREE.PointLight(0xaaffaa, 0.3, 3);
  group.add(light);

  scene.add(group);

  collectState.fireflies.push({
    group,
    mesh,
    light,
    phase: Math.random() * Math.PI * 2,
    vel: {
      x: (Math.random() - 0.5) * 1.5,
      z: (Math.random() - 0.5) * 1.5
    }
  });
}

// Called when 20 fireflies have been collected
function _activateFireflyJar() {
  collectState.fireflyJarActive = true;
  fireflyJarActive = true;

  showLootText('Firefly Jar complete! You glow with forest light!');

  // Despawn remaining world fireflies
  for (const ff of collectState.fireflies) {
    if (ff.group && ff.group.parent) ff.group.parent.remove(ff.group);
  }
  collectState.fireflies = [];

  // Permanent glow on player mesh
  if (playerState.mesh) {
    const jarLight = new THREE.PointLight(0x88ff88, 1.0, 8);
    jarLight.position.set(0, 1.5, 0);
    playerState.mesh.add(jarLight);
    _fireflyJarLight = jarLight;
  }
}


// ============================================
// #17 - BUNNY CENSUS
// 12 bunny color variants with rarity weights.
// When the player is within 10 units of a new
// variant, it gets logged in the bunny book.
// ============================================

// --- VARIANT DEFINITIONS ---
// Weights within each tier:
//   common (70%):   normal, snow, chocolate, spotted
//   uncommon (22%): golden, pink, lavender, mint
//   rare (7%):      midnight, sunset, calico
//   legendary (1%): galaxy
//   + ghost (0.5%): special overlay
const BUNNY_VARIANTS = [
  // Common (70% total = 17.5% each)
  { name: 'Normal',    color: 0xddccbb, rarity: 'common',    weight: 0.175, sparkle: false },
  { name: 'Snow',      color: 0xffffff, rarity: 'common',    weight: 0.175, sparkle: false },
  { name: 'Chocolate', color: 0x6b3a2a, rarity: 'common',    weight: 0.175, sparkle: false },
  { name: 'Spotted',   color: 0xccaa88, rarity: 'common',    weight: 0.175, sparkle: false },
  // Uncommon (22% total = 5.5% each)
  { name: 'Golden',    color: 0xffd700, rarity: 'uncommon',  weight: 0.055, sparkle: false },
  { name: 'Pink',      color: 0xffaacc, rarity: 'uncommon',  weight: 0.055, sparkle: false },
  { name: 'Lavender',  color: 0xccaaff, rarity: 'uncommon',  weight: 0.055, sparkle: false },
  { name: 'Mint',      color: 0xaaffcc, rarity: 'uncommon',  weight: 0.055, sparkle: false },
  // Rare (7% total ~ 2.33% each)
  { name: 'Midnight',  color: 0x111122, rarity: 'rare',      weight: 0.023, sparkle: false },
  { name: 'Sunset',    color: 0xff8844, rarity: 'rare',      weight: 0.023, sparkle: false },
  { name: 'Calico',    color: 0xccaa88, rarity: 'rare',      weight: 0.024, sparkle: false, calico: true },
  // Legendary (1%)
  { name: 'Galaxy',    color: 0x4422aa, rarity: 'legendary', weight: 0.01,  sparkle: true }
];

// Ghost bunny: 0.5% chance override applied separately
const GHOST_BUNNY_CHANCE = 0.005;

// --- getBunnyVariant() ---
// Returns { color, name, rarity, sparkle } for a new bunny.
// Called by the enemy spawn system when spawning a bunny.
function getBunnyVariant() {
  // Check for ghost bunny first (0.5% chance)
  if (Math.random() < GHOST_BUNNY_CHANCE) {
    return {
      color: 0xffffff,
      name: 'Ghost',
      rarity: 'ghost',
      sparkle: false,
      ghost: true
    };
  }

  // Weighted random from BUNNY_VARIANTS
  const totalWeight = BUNNY_VARIANTS.reduce((sum, v) => sum + v.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = BUNNY_VARIANTS[0];
  for (const variant of BUNNY_VARIANTS) {
    roll -= variant.weight;
    if (roll <= 0) { chosen = variant; break; }
  }

  return {
    color: chosen.color,
    name: chosen.name,
    rarity: chosen.rarity,
    sparkle: chosen.sparkle,
    calico: chosen.calico || false,
    ghost: false
  };
}

// --- Apply variant visuals to a bunny enemy ---
// Called after spawnEnemy() creates a bunny.
function assignBunnyVariant(enemy) {
  if (!enemy || enemy.type !== 'bunny') return;

  const variant = getBunnyVariant();
  enemy.variant = variant;

  if (!enemy.mesh) return;

  // Recolor every mesh child
  enemy.mesh.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const hex = child.material.color ? child.material.color.getHex() : -1;

    // Inner ears (originally 0xffaaaa in createBunnyMesh)
    if (hex === 0xffaaaa) {
      child.material = child.material.clone();
      // Slightly lighter version of the main color for inner ear
      const earColor = new THREE.Color(variant.color);
      earColor.offsetHSL(0, -0.1, 0.15);
      child.material.color.copy(earColor);
    }
    // Main body parts (not eyes 0x111111, not nose 0xff8888, not tail 0xffffff)
    else if (hex !== 0x111111 && hex !== 0xff8888 && hex !== 0xffffff) {
      child.material = child.material.clone();
      child.material.color.setHex(variant.color);
    }

    // Calico: multi-colored patch effect — alternate some children
    if (variant.calico && hex !== 0x111111 && hex !== 0xff8888) {
      const patchColors = [0xccaa88, 0x8b6914, 0xffffff, 0x6b3a2a];
      if (Math.random() > 0.5) {
        child.material = child.material.clone();
        child.material.color.setHex(patchColors[Math.floor(Math.random() * patchColors.length)]);
      }
    }

    // Ghost bunny: translucent with opacity 0.4
    if (variant.ghost) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.4;
    }
  });

  // Galaxy bunny: sparkle PointLight
  if (variant.sparkle) {
    const galaxyLight = new THREE.PointLight(0x4422aa, 0.5, 4);
    galaxyLight.position.set(0, 0.5, 0);
    enemy.mesh.add(galaxyLight);
  }

  // Ghost bunny: white glow
  if (variant.ghost) {
    const ghostLight = new THREE.PointLight(0xffffff, 0.4, 3);
    ghostLight.position.set(0, 0.4, 0);
    enemy.mesh.add(ghostLight);
  }
}

// --- UPDATE BUNNY CENSUS ---
// Called each frame. Detects new variants within 10 units.
function updateBunnyCensus() {
  const playerPos = playerState.position;

  for (const enemy of enemies) {
    if (enemy.type !== 'bunny' || !enemy.variant || enemy.health <= 0) continue;

    const dx = playerPos.x - enemy.mesh.position.x;
    const dz = playerPos.z - enemy.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 10 && !collectState.bunnyBook[enemy.variant.name]) {
      collectState.bunnyBook[enemy.variant.name] = true;
      collectState.bunnyCensusCount++;
      showLootText('New bunny discovered: ' + enemy.variant.name + '!');
    }
  }
}

// --- TOGGLE THE CENSUS BOOK OVERLAY ---
function toggleCensusBook() {
  let overlay = document.getElementById('census-book');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'census-book';
    overlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'background:rgba(20,10,30,0.95)',
      'border:2px solid #8855cc',
      'border-radius:12px',
      'padding:24px 32px',
      'color:#eeddff',
      'font-family:monospace',
      'z-index:1000',
      'min-width:320px',
      'max-height:80vh',
      'overflow-y:auto',
      'display:none'
    ].join(';');
    document.body.appendChild(overlay);
  }

  if (overlay.style.display !== 'none') {
    overlay.style.display = 'none';
    return;
  }

  // Rebuild content
  const found = collectState.bunnyCensusCount;
  // Total = 12 base variants + ghost = 13 possible
  const total = BUNNY_VARIANTS.length + 1; // +1 for ghost
  let html = '<h2 style="margin:0 0 12px;color:#cc99ff;text-align:center">Bunny Census</h2>';
  html += '<p style="text-align:center;margin:0 0 16px;color:#aa88cc">Discovered: ' + found + ' / ' + total + '</p>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  // Show all base variants
  const allVariants = [...BUNNY_VARIANTS, { name: 'Ghost', color: 0xffffff, rarity: 'ghost', sparkle: false }];
  for (const variant of allVariants) {
    const seen = collectState.bunnyBook[variant.name];
    const hex6 = '#' + variant.color.toString(16).padStart(6, '0');
    const rarityColors = {
      common: '#aaaaaa', uncommon: '#44cc44', rare: '#4488ff', legendary: '#ffaa00', ghost: '#ddddff'
    };
    const rarityCol = rarityColors[variant.rarity] || '#aaaaaa';

    if (seen) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;'
            + 'background:rgba(255,255,255,0.06);border-radius:6px">'
            + '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;'
            + 'background:' + hex6 + ';border:1px solid #ffffff33;flex-shrink:0"></span>'
            + '<span>' + variant.name + '</span>'
            + '<span style="font-size:0.7em;color:' + rarityCol + '">(' + variant.rarity + ')</span>'
            + '</div>';
    } else {
      html += '<div style="padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:6px;'
            + 'color:#554466">???</div>';
    }
  }

  html += '</div>';
  html += '<p style="text-align:center;margin:16px 0 0;color:#7755aa;font-size:0.8em">'
        + 'Get within 10 units of a bunny to discover it</p>';
  html += '<button onclick="toggleCensusBook()" style="display:block;margin:12px auto 0;'
        + 'background:#5522aa;border:none;color:#eeddff;padding:6px 20px;'
        + 'border-radius:6px;cursor:pointer">Close</button>';

  overlay.innerHTML = html;
  overlay.style.display = 'block';
}


// ============================================
// #18 - MONSTER BESTIARY
// Track kills per enemy type. Silver badge at
// 10 kills, gold at 25. Press J to open overlay.
// ============================================

// Lore, danger ratings (1-5 stars), per type
const BESTIARY_ENTRIES = {
  bunny: {
    name: 'Forest Bunny',
    danger: 1,
    lore: 'Harmless? Or watching...'
  },
  wolf: {
    name: 'Cursed Wolf',
    danger: 2,
    lore: 'Pack hunters that grow bolder each night.'
  },
  deer: {
    name: 'Creepy Deer',
    danger: 3,
    lore: 'They were not always like this...'
  },
  alphaWolf: {
    name: 'Alpha Wolf',
    danger: 4,
    lore: 'The pack follows their howl.'
  },
  bear: {
    name: 'Forest Bear',
    danger: 5,
    lore: 'Ancient guardians of the deep forest.'
  },
  cultist: {
    name: 'Forest Cultist',
    danger: 3,
    lore: 'They serve something in the fog.'
  }
};

// Initialize bestiary state entries
function _initBestiary() {
  const types = ['bunny', 'wolf', 'deer', 'alphaWolf', 'bear', 'cultist'];
  for (const t of types) {
    if (!collectState.bestiary[t]) {
      collectState.bestiary[t] = { kills: 0, seen: false };
    }
  }
}
_initBestiary();

// --- RECORD A KILL ---
// Hook into killEnemy() — call recordBestiaryKill(enemy.type) from there.
function recordBestiaryKill(enemyType) {
  if (!collectState.bestiary[enemyType]) {
    collectState.bestiary[enemyType] = { kills: 0, seen: false };
  }
  collectState.bestiary[enemyType].kills++;
  collectState.bestiary[enemyType].seen = true;

  const count = collectState.bestiary[enemyType].kills;
  const entry = BESTIARY_ENTRIES[enemyType];
  if (entry) {
    if (count === 10) showLootText('Silver badge: ' + entry.name + ' (10 kills)');
    if (count === 25) showLootText('Gold badge: ' + entry.name + ' (25 kills)');
  }
}

// --- UPDATE BESTIARY ---
// Called each frame. Records encounters when player is within 15 units.
function updateBestiary() {
  const playerPos = playerState.position;

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const type = enemy.type;
    if (!collectState.bestiary[type]) {
      collectState.bestiary[type] = { kills: 0, seen: false };
    }
    if (collectState.bestiary[type].seen) continue;

    const dx = playerPos.x - enemy.mesh.position.x;
    const dz = playerPos.z - enemy.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 15) {
      collectState.bestiary[type].seen = true;
      const entry = BESTIARY_ENTRIES[type];
      if (entry) showLootText('New encounter: ' + entry.name + '!');
    }
  }
}

// --- TOGGLE BESTIARY OVERLAY (Press J) ---
function toggleBestiary() {
  let overlay = document.getElementById('bestiary-menu');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bestiary-menu';
    overlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'background:rgba(15,5,5,0.95)',
      'border:2px solid #882222',
      'border-radius:12px',
      'padding:24px 32px',
      'color:#ffdddd',
      'font-family:monospace',
      'z-index:1000',
      'min-width:360px',
      'max-height:80vh',
      'overflow-y:auto',
      'display:none'
    ].join(';');
    document.body.appendChild(overlay);
  }

  if (overlay.style.display !== 'none') {
    overlay.style.display = 'none';
    return;
  }

  const types = ['bunny', 'wolf', 'deer', 'alphaWolf', 'bear', 'cultist'];
  let html = '<h2 style="margin:0 0 12px;color:#ff8888;text-align:center">Monster Bestiary</h2>';

  for (const type of types) {
    const entry = BESTIARY_ENTRIES[type];
    const data = collectState.bestiary[type] || { kills: 0, seen: false };
    const kills = data.kills;
    const seen = data.seen;
    const stars = entry.danger;
    const starStr = '<span style="color:#ff6666">'
                  + '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars)
                  + '</span>';

    // Badge: silver at 10, gold at 25
    let badge = '';
    if (kills >= 25) badge = ' <span style="color:#ffd700" title="Gold Badge">\u2666</span>';
    else if (kills >= 10) badge = ' <span style="color:#aaaaaa" title="Silver Badge">\u2666</span>';

    if (seen) {
      html += '<div style="margin-bottom:14px;padding:10px 12px;'
            + 'background:rgba(255,100,100,0.07);border-radius:8px;border-left:3px solid #882222">'
            + '<div style="display:flex;justify-content:space-between;align-items:center">'
            + '<strong>' + entry.name + badge + '</strong>'
            + starStr
            + '</div>'
            + '<div style="font-size:0.8em;color:#bb9999;margin:4px 0">Kills: ' + kills + '</div>'
            + '<div style="font-size:0.78em;color:#998888;font-style:italic">' + entry.lore + '</div>'
            + '</div>';
    } else {
      html += '<div style="margin-bottom:14px;padding:10px 12px;'
            + 'background:rgba(0,0,0,0.3);border-radius:8px;border-left:3px solid #441111;'
            + 'color:#553333">??? - Not yet encountered</div>';
    }
  }

  html += '<button onclick="toggleBestiary()" style="display:block;margin:8px auto 0;'
        + 'background:#661111;border:none;color:#ffdddd;padding:6px 20px;'
        + 'border-radius:6px;cursor:pointer">Close (J)</button>';

  overlay.innerHTML = html;
  overlay.style.display = 'block';
}


// ============================================
// #19 - CONSTELLATION MAP
// 8 constellations on the sky dome, only
// visible at night when looking up (pitch > 0.8)
// and the player is in the correct map zone.
// ============================================

const CONSTELLATIONS = [
  {
    name: 'The Wolf',
    // NE quadrant
    zone: { x: 50, z: -50, radius: 30 },
    stars: [[0, 0], [1, 0.5], [2, 0.3], [3, 1], [2.5, 2]],
    skyAngle: 0.4  // azimuth offset on sky dome
  },
  {
    name: 'The Great Bear',
    // NW quadrant
    zone: { x: -50, z: -50, radius: 30 },
    stars: [[0, 0], [1, 0.2], [2, 0], [3, 0.5], [3, 1.5], [2, 2], [1, 1.5]],
    skyAngle: 1.2
  },
  {
    name: 'The Campfire',
    // Near center
    zone: { x: 0, z: 0, radius: 15 },
    stars: [[0, 0], [0.5, 1], [1, 0], [-0.5, 1], [-1, 0]],
    skyAngle: 2.0
  },
  {
    name: 'The Four Kids',
    // SE quadrant
    zone: { x: 50, z: 50, radius: 30 },
    stars: [[0, 0], [2, 0], [4, 0], [6, 0]],
    skyAngle: 2.8
  },
  {
    name: 'The Axe',
    // SW quadrant
    zone: { x: -50, z: 50, radius: 30 },
    stars: [[0, 0], [0, 1], [0, 2], [1, 2.5], [-1, 2.5]],
    skyAngle: 3.6
  },
  {
    name: 'The Ancient Tree',
    // Far N
    zone: { x: 0, z: -80, radius: 25 },
    stars: [[0, 0], [0, 1], [0, 2], [0, 3], [-1, 3.5], [1, 3.5]],
    skyAngle: 4.4
  },
  {
    name: 'The Cultist Moon',
    // Far E
    zone: { x: 80, z: 0, radius: 25 },
    stars: [[0, 0], [0.5, 0.8], [0.3, 1.8], [0, 2.5], [-0.5, 1.8], [-0.3, 0.8]],
    skyAngle: 5.2
  },
  {
    name: 'The Hidden Path',
    // Far S
    zone: { x: 0, z: 80, radius: 25 },
    stars: [[0, 0], [1, 0.5], [2, 1.5], [3, 3], [4, 3.5]],
    skyAngle: 6.0
  }
];

// Internal constellation rendering state
const _constellationState = {
  starField: null,          // General starfield Points object
  groups: [],               // Per-constellation THREE.Group
  lines: [],                // Per-constellation THREE.Line for connections
  initialized: false
};

// --- INIT CONSTELLATIONS ---
// Creates the general starfield and constellation highlight meshes.
function initConstellations(scene) {
  if (_constellationState.initialized) return;
  _constellationState.initialized = true;

  const SKY_RADIUS = 380;

  // --- General starfield (200 random stars on upper hemisphere) ---
  const positions = [];
  for (let i = 0; i < 200; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const r = SKY_RADIUS * (0.85 + Math.random() * 0.15);
    positions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true });
  const stars = new THREE.Points(geom, mat);
  stars.visible = false;
  scene.add(stars);
  _constellationState.starField = stars;

  // --- Per-constellation star points and connecting lines ---
  for (const con of CONSTELLATIONS) {
    const group = new THREE.Group();
    group.visible = false;

    const starPositions = [];

    for (const [sx, sy] of con.stars) {
      // Project each star onto the sky dome using the constellation's sky angle
      const azimuth = con.skyAngle + sx * 0.08;
      const elevation = Math.PI * 0.25 + sy * 0.05;
      const R = SKY_RADIUS * 0.88;

      const px = R * Math.sin(elevation) * Math.cos(azimuth);
      const py = R * Math.cos(elevation);
      const pz = R * Math.sin(elevation) * Math.sin(azimuth);

      // Bright star point (PointLight at size 0.1 equivalent)
      const starMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      starMesh.position.set(px, py, pz);
      group.add(starMesh);

      starPositions.push(new THREE.Vector3(px, py, pz));
    }

    // Faint connecting lines between stars
    if (starPositions.length > 1) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints(starPositions);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x6688cc,
        transparent: true,
        opacity: 0.3
      });
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);
    }

    scene.add(group);
    _constellationState.groups.push(group);
  }
}

// --- UPDATE CONSTELLATIONS EACH FRAME ---
function updateConstellations() {
  // Hide everything during the day
  if (!dayNightState.isNight) {
    for (const grp of _constellationState.groups) grp.visible = false;
    if (_constellationState.starField) _constellationState.starField.visible = false;
    return;
  }

  // Show general starfield at night
  if (_constellationState.starField) _constellationState.starField.visible = true;

  const px = playerState.position.x;
  const pz = playerState.position.z;
  const lookingUp = playerState.pitch > 0.8;

  for (let i = 0; i < CONSTELLATIONS.length; i++) {
    const con = CONSTELLATIONS[i];
    const grp = _constellationState.groups[i];
    if (!grp) continue;

    // Is the player inside this constellation's required zone?
    const dx = px - con.zone.x;
    const dz = pz - con.zone.z;
    const inZone = Math.sqrt(dx * dx + dz * dz) < con.zone.radius;

    if (inZone && lookingUp) {
      grp.visible = true;

      // Discover this constellation
      if (!collectState.constellations[con.name]) {
        collectState.constellations[con.name] = true;
        showLootText('Constellation found: ' + con.name + '!');

        // Check if all 8 are found
        if (Object.keys(collectState.constellations).length >= CONSTELLATIONS.length) {
          if (!collectState.starMapComplete) {
            collectState.starMapComplete = true;
            showLootText('Star Map complete! The Ancient Chest reveals itself...');
          }
        }
      }
    } else {
      grp.visible = false;
    }
  }
}

// --- TOGGLE STAR MAP OVERLAY ---
function toggleStarMap() {
  let overlay = document.getElementById('star-map');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'star-map';
    overlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'background:rgba(5,5,20,0.97)',
      'border:2px solid #4466cc',
      'border-radius:12px',
      'padding:24px 32px',
      'color:#ccddff',
      'font-family:monospace',
      'z-index:1000',
      'min-width:340px',
      'max-height:80vh',
      'overflow-y:auto',
      'display:none'
    ].join(';');
    document.body.appendChild(overlay);
  }

  if (overlay.style.display !== 'none') {
    overlay.style.display = 'none';
    return;
  }

  const found = Object.keys(collectState.constellations).length;
  let html = '<h2 style="margin:0 0 4px;color:#88aaff;text-align:center">Constellation Map</h2>';
  html += '<p style="text-align:center;margin:0 0 16px;color:#6688cc">Found: ' + found + ' / 8</p>';
  html += '<p style="font-size:0.78em;color:#445588;margin:0 0 12px;text-align:center">'
        + 'Find each zone at night and look up (pitch > 0.8) to discover</p>';

  for (const con of CONSTELLATIONS) {
    const seen = collectState.constellations[con.name];
    if (seen) {
      html += '<div style="margin-bottom:8px;padding:8px 10px;'
            + 'background:rgba(80,100,200,0.15);border-radius:6px;border-left:3px solid #4466cc">'
            + '<strong>\u2726 ' + con.name + '</strong>'
            + '<span style="float:right;color:#446699;font-size:0.8em">'
            + con.stars.length + ' stars</span>'
            + '</div>';
    } else {
      html += '<div style="margin-bottom:8px;padding:8px 10px;'
            + 'background:rgba(0,0,0,0.3);border-radius:6px;border-left:3px solid #223366;'
            + 'color:#334466">??? - Not yet discovered</div>';
    }
  }

  if (collectState.starMapComplete) {
    html += '<p style="text-align:center;color:#88ccff;margin-top:12px">'
          + '\u2726 Star Map Complete! The Ancient Chest awaits... \u2726</p>';
  }

  html += '<button onclick="toggleStarMap()" style="display:block;margin:12px auto 0;'
        + 'background:#223388;border:none;color:#ccddff;padding:6px 20px;'
        + 'border-radius:6px;cursor:pointer">Close</button>';

  overlay.innerHTML = html;
  overlay.style.display = 'block';
}


// ============================================
// #21 - WHISPERING JOURNAL
// 20 glowing page meshes across the map.
// Pickup on proximity (2 units) with sack
// equipped. Press L to open journal overlay.
// The 20 entries tell the story of WHY the
// cult kidnapped the kids who wear magical
// animal hats.
// ============================================

const JOURNAL_ENTRIES = [
  // Page 1-5: Setting the scene, the expedition arrives
  "I found this journal near the old campfire. Someone was here before us.",

  "The cultists arrived three moons ago. They seek the children's power.",

  "Each child wears a hat of power. The animals chose them.",

  "Before the fog, this forest was a sanctuary. The Ancient Tree at its heart kept the balance. "
  + "Its roots connected every living thing here. The animals could speak, in their way.",

  "The Tree chose four children to be its voices -- one for each season. It gave each child "
  + "a hat woven from the fur and feathers of the forest's guardian animals. Dino for strength, "
  + "Kraken for wisdom, Squid for cunning, Koala for compassion.",

  // Page 6-10: The cult's arrival and motivation
  "The cultists came from beyond the mountains. They worship an old darkness -- something that "
  + "existed before the Tree, before the forest, before the animals had names.",

  "They believe the hats contain fragments of the Tree's soul. If they take all four, they can "
  + "feed them to the darkness and it will swallow the forest whole. A new kingdom of fog.",

  "I watched them set up their camps at night. They don't build fires. They build circles "
  + "of silence. Even the wind stops where they stand.",

  "The children didn't run when the cultists came. They couldn't. The hats rooted them to "
  + "the forest. To leave would be to abandon everything the Tree gave them.",

  "One by one the cultists lured the guardian animals away. The wolves turned feral first. "
  + "Then the deer began walking upright, their eyes hollow. The bears grew silent and angry.",

  // Page 11-15: The kidnapping and its aftermath
  "They took the children at dawn, when the Tree sleeps. Four colored tents in four corners "
  + "of the forest. Gates locked with keys forged from the Tree's own bark.",

  "The animals that once protected the children now guard their prisons. The cultists put "
  + "collars on them -- collars that twist loyalty into obedience.",

  "The fog came the same night the last child was taken. It rolled in from every direction "
  + "at once, like the forest was holding its breath and never letting go.",

  "I found bunny tracks leading to each cave. The bunnies are the only animals the cultists "
  + "couldn't corrupt. Too small, too quick, too stubborn. They still remember.",

  "The campfire is the last gift the Tree gave before it went quiet. A flame that holds back "
  + "the darkness. Feed it, and the forest opens. Let it die, and everything closes.",

  // Page 16-20: Hope and the path forward
  "Someone painted the old stories on cave walls near where the children are held. Eight "
  + "paintings. I think the Tree put them there -- a record in case no one survived to tell it.",

  "At night the stars rearrange themselves into patterns. Constellations that weren't there "
  + "before. I think the Tree is trying to show us something. A map written in the sky.",

  "The fireflies gather around those who carry hope. Twenty of them, and their light can "
  + "make even the wolves hesitate. The forest remembers kindness.",

  "Each creature in this forest carries a fragment of what it was before the corruption. "
  + "A fang, a claw, an antler -- charms of the old world. Collect them all, and the forest "
  + "will know you as its guardian.",

  "If you're reading this, you are the one the Tree has been waiting for. Find the four "
  + "children. Break their cages. Return the hats to the light. The forest can heal, but "
  + "only if someone is brave enough to walk into the dark. Don't let the fire go out."
];

// --- INIT JOURNAL PAGES ---
// Spawns 20 glowing page meshes across the map.
function initJournalPages(scene) {
  collectState.journalPages = [];
  collectState.journalPageMeshes = [];

  const mapR = campfireState ? (campfireState.mapRadius || 80) : 80;

  for (let i = 0; i < 20; i++) {
    // Scatter pages, avoiding the safe zone
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * (mapR - 20);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Page mesh: PlaneGeometry 0.4 x 0.3, pale blue glow
    const pageMat = new THREE.MeshLambertMaterial({
      color: 0xf0f0e0,
      side: THREE.DoubleSide,
      emissive: 0x334466,
      emissiveIntensity: 0.3
    });
    const pageMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), pageMat);
    pageMesh.rotation.x = -Math.PI / 2;

    const group = new THREE.Group();
    group.position.set(x, 0.15, z);
    group.add(pageMesh);

    // Soft blue glow
    const glow = new THREE.PointLight(0x8888ff, 0.5, 6);
    glow.position.y = 0.5;
    group.add(glow);

    scene.add(group);

    collectState.journalPageMeshes.push({ group, glow, pageIndex: i });
  }
}

// --- UPDATE JOURNAL PAGES ---
// Hover animation + auto-collect within 2 units with sack equipped.
function updateJournalPages() {
  const t = totalTime || 0;
  const playerPos = playerState.position;

  for (let i = collectState.journalPageMeshes.length - 1; i >= 0; i--) {
    const item = collectState.journalPageMeshes[i];
    if (!item || !item.group) continue;
    if (collectState.journalPages.includes(item.pageIndex)) continue;

    // Hover bob
    item.group.position.y = 0.15 + Math.sin(t * 1.5 + i * 0.7) * 0.08;

    // Glow pulse
    if (item.glow) {
      item.glow.intensity = 0.3 + Math.sin(t * 2 + i) * 0.2;
    }

    // Auto-collect on proximity (2 units) with sack equipped
    const dx = playerPos.x - item.group.position.x;
    const dz = playerPos.z - item.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2 && playerState.selectedSlot === 2) {
      collectState.journalPages.push(item.pageIndex);
      const num = item.pageIndex + 1;
      showLootText('Journal Page ' + num + ' collected! (' + collectState.journalPages.length + '/20)');

      // Remove from scene
      if (item.group.parent) item.group.parent.remove(item.group);
      collectState.journalPageMeshes.splice(i, 1);

      // Check for all 20
      if (collectState.journalPages.length >= 20) {
        showLootText('The True Story unlocked! Press L to read.');
        collectState.journalComplete = true;
      }
    }
  }
}

// --- TOGGLE JOURNAL OVERLAY (Press L) ---
function toggleJournal() {
  let overlay = document.getElementById('journal-menu');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'journal-menu';
    overlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'background:rgba(10,8,20,0.96)',
      'border:2px solid #5555aa',
      'border-radius:12px',
      'padding:24px 32px',
      'color:#ddddff',
      'font-family:Georgia,serif',
      'z-index:1000',
      'min-width:380px',
      'max-width:520px',
      'max-height:80vh',
      'overflow-y:auto',
      'display:none'
    ].join(';');
    document.body.appendChild(overlay);
  }

  if (overlay.style.display !== 'none') {
    overlay.style.display = 'none';
    return;
  }

  const sorted = [...collectState.journalPages].sort((a, b) => a - b);
  let html = '<h2 style="margin:0 0 4px;color:#aaaaee;text-align:center;font-family:monospace">'
           + 'Whispering Journal</h2>';
  html += '<p style="text-align:center;margin:0 0 16px;color:#7777aa;font-family:monospace">'
        + 'Pages: ' + sorted.length + ' / 20</p>';

  if (sorted.length === 0) {
    html += '<p style="color:#554466;text-align:center">No pages found yet. '
          + 'Explore the forest with your sack equipped.</p>';
  } else {
    for (const idx of sorted) {
      html += '<div style="margin-bottom:14px;padding:12px;'
            + 'background:rgba(100,100,180,0.08);border-radius:8px;'
            + 'border-left:3px solid #5555aa">'
            + '<div style="font-size:0.75em;color:#7777aa;margin-bottom:6px;font-family:monospace">'
            + 'Page ' + (idx + 1) + '</div>'
            + '<em style="color:#ccccee;line-height:1.5">' + JOURNAL_ENTRIES[idx] + '</em>'
            + '</div>';
    }
  }

  if (collectState.journalComplete) {
    html += '<p style="text-align:center;color:#88aaff;margin-top:12px;font-family:monospace">'
          + 'The True Story has been revealed. The forest remembers.</p>';
  }

  html += '<button onclick="toggleJournal()" style="display:block;margin:8px auto 0;'
        + 'background:#333388;border:none;color:#ddddff;padding:6px 20px;'
        + 'border-radius:6px;cursor:pointer;font-family:monospace">Close (L)</button>';

  overlay.innerHTML = html;
  overlay.style.display = 'block';
}


// ============================================
// #23 - SECRET CAVE PAINTINGS
// 8 paintings at fixed positions near kid caves
// and cultist areas. Each painting is a
// PlaneGeometry(1.5, 1) with a CanvasTexture
// showing simple pixel art, plus a faint glow.
// All 8 found spawns a 5th "Ancient Chest" cave.
// ============================================

const PAINTING_SUBJECTS = [
  { title: 'The Forest Before the Curse',  desc: 'Trees full of light, animals at peace. A world before the fog.' },
  { title: 'Four Kids Playing',            desc: 'Four children with animal hats, laughing in a sun-lit clearing.' },
  { title: 'The Cult Ritual',              desc: 'Robed figures around a dark flame. Their faces are hidden.' },
  { title: 'The Ancient Tree',             desc: 'A massive trunk with roots stretching across the entire world.' },
  { title: 'The First Campfire',           desc: 'A single flame ignited by a stranger\'s hand. The darkness retreats.' },
  { title: 'The Fog\'s Origin',            desc: 'Darkness rolling in from every direction. The forest holds its breath.' },
  { title: 'The Deer Transformation',      desc: 'An ordinary deer rising onto two legs. Its eyes go white.' },
  { title: 'The Hidden Path',              desc: 'A winding trail leading somewhere the map doesn\'t show.' }
];

const _paintingState = {
  meshes: [],       // { mesh, index, position, glow }
  initialized: false
};

// --- DRAW PIXEL ART ON A CANVAS TEXTURE ---
function createPaintingTexture(paintingIndex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 42;
  const ctx = canvas.getContext('2d');

  // Cave-stone background
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(0, 0, 64, 42);

  // Color palettes per subject
  const palettes = [
    ['#44bb44', '#228822', '#88ffaa', '#ddffdd'],  // 0: forest greens
    ['#ff8844', '#ffcc88', '#dd6622', '#ffeecc'],  // 1: kids warmth
    ['#440044', '#882288', '#aa00aa', '#cc44cc'],  // 2: cult purples
    ['#224400', '#446600', '#88aa22', '#ccdd66'],  // 3: tree olives
    ['#ff6600', '#ffaa00', '#ffdd44', '#ff3300'],  // 4: campfire flames
    ['#111133', '#224466', '#336699', '#aaccff'],  // 5: fog blues
    ['#8B6914', '#aa8822', '#ffffff', '#ff0000'],  // 6: deer transformation
    ['#885533', '#aa7744', '#ccaa66', '#eecc88']   // 7: hidden path earths
  ];

  const cols = palettes[paintingIndex % palettes.length];

  switch (paintingIndex) {
    case 0: // Forest before curse — happy trees
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[1];
        ctx.fillRect(8 + i * 9, 26, 4, 12);
        ctx.fillStyle = cols[0];
        ctx.fillRect(6 + i * 9, 14, 8, 14);
      }
      // Sun
      ctx.fillStyle = '#ffdd44';
      ctx.beginPath();
      ctx.arc(52, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 1: // Four kids playing
      [[10, 20, '#cc2222'], [22, 20, '#2244cc'], [34, 20, '#ddcc22'], [46, 20, '#8844aa']].forEach(([x, y, c]) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 10, 14);
        ctx.fillStyle = '#ffdd88';
        ctx.fillRect(x + 2, y - 7, 6, 6);
      });
      break;

    case 2: // Cult ritual — circle of figures around a flame
      ctx.fillStyle = cols[2];
      for (let a = 0; a < 6; a++) {
        const ax = 32 + Math.cos((a / 6) * Math.PI * 2) * 12;
        const ay = 21 + Math.sin((a / 6) * Math.PI * 2) * 10;
        ctx.fillRect(ax - 2, ay - 5, 4, 9);
      }
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(29, 17, 6, 8);
      break;

    case 3: // Ancient tree — massive central trunk
      ctx.fillStyle = cols[1];
      ctx.fillRect(26, 10, 12, 30);
      ctx.fillStyle = cols[0];
      ctx.fillRect(10, 6, 44, 20);
      for (let rx = 0; rx < 64; rx += 8) {
        ctx.fillStyle = cols[1];
        ctx.fillRect(rx, 36, 4, 6);
      }
      break;

    case 4: // First campfire
      ctx.fillStyle = cols[3];
      ctx.fillRect(28, 30, 8, 8);
      ctx.fillStyle = cols[2];
      ctx.fillRect(26, 20, 12, 12);
      ctx.fillStyle = cols[1];
      ctx.fillRect(28, 10, 8, 12);
      ctx.fillStyle = cols[0];
      ctx.fillRect(30, 4, 4, 8);
      break;

    case 5: // Fog's origin — dark bottom, wisps rising
      ctx.fillStyle = cols[0];
      ctx.fillRect(0, 28, 64, 14);
      ctx.fillStyle = cols[1];
      for (let w = 0; w < 8; w++) ctx.fillRect(w * 8, 20 - (w % 3) * 4, 6, 10);
      ctx.fillStyle = cols[2];
      for (let w = 0; w < 8; w++) ctx.fillRect(w * 8 + 2, 12 - (w % 2) * 4, 4, 10);
      break;

    case 6: // Deer transformation — deer figure rising
      ctx.fillStyle = cols[0];
      ctx.fillRect(28, 10, 8, 24); // body
      ctx.fillRect(24, 34, 4, 8);  // left leg
      ctx.fillRect(36, 34, 4, 8);  // right leg
      ctx.fillStyle = cols[2];
      ctx.fillRect(30, 4, 4, 6);   // head
      // Eyes
      ctx.fillStyle = cols[3];
      ctx.fillRect(29, 5, 2, 2);
      ctx.fillRect(33, 5, 2, 2);
      // Antlers
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(26, 0, 2, 6);
      ctx.fillRect(36, 0, 2, 6);
      break;

    case 7: // Hidden path — winding dotted line
      ctx.fillStyle = cols[2];
      let px2 = 4, py2 = 36;
      for (let s = 0; s < 16; s++) {
        ctx.fillRect(px2, py2, 3, 3);
        px2 += 3 + Math.round(Math.sin(s * 0.9) * 2);
        py2 -= 2;
      }
      break;
  }

  return new THREE.CanvasTexture(canvas);
}

// --- INIT CAVE PAINTINGS ---
// Places 8 paintings. 4 near kid caves, 4 in deep forest.
function initCavePaintings(scene) {
  if (_paintingState.initialized) return;
  _paintingState.initialized = true;

  let spawnCount = 0;

  // 1-4: Near kid caves (offset slightly)
  for (let i = 0; i < Math.min(kidCaves.length, 4); i++) {
    if (spawnCount >= 4) break;
    const cave = kidCaves[i];
    const offset = { x: cave.position.x + 5, z: cave.position.z + 3 };
    _placePainting(offset, spawnCount);
    spawnCount++;
  }

  // Fill remaining cave-adjacent paintings with fixed positions if caves not yet spawned
  while (spawnCount < 4) {
    const fallbackPositions = [
      { x: 40, z: 30 }, { x: -35, z: 45 },
      { x: 50, z: -40 }, { x: -45, z: -35 }
    ];
    _placePainting(fallbackPositions[spawnCount], spawnCount);
    spawnCount++;
  }

  // 5-8: Deep forest / cultist area fixed positions
  const deepPositions = [
    { x: -60, z: -60 }, { x: 60, z: -60 },
    { x: -40, z: 80 },  { x: 70, z: 40 }
  ];
  for (let i = 0; i < 4; i++) {
    _placePainting(deepPositions[i], spawnCount);
    spawnCount++;
  }
}

// Place a single painting in the world
function _placePainting(position, paintingIndex) {
  const tex = createPaintingTexture(paintingIndex);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), mat);

  mesh.position.set(position.x, 1.2, position.z);
  mesh.rotation.y = Math.atan2(-position.x, -position.z);

  // Faint glow PointLight (0.3 intensity)
  const glow = new THREE.PointLight(0xffaa66, 0.3, 6);
  glow.position.set(0, 0.5, 0);
  mesh.add(glow);

  scene.add(mesh);

  _paintingState.meshes.push({
    mesh,
    glow,
    index: paintingIndex,
    position: mesh.position
  });
}

// --- UPDATE CAVE PAINTINGS ---
// Auto-collect within 2.5 units, shows description text.
function updateCavePaintings() {
  const playerPos = playerState.position;
  const t = totalTime || 0;

  for (let i = _paintingState.meshes.length - 1; i >= 0; i--) {
    const item = _paintingState.meshes[i];
    if (!item || !item.mesh) continue;
    if (collectState.paintings.includes(item.index)) continue;

    // Pulse glow
    if (item.glow) {
      item.glow.intensity = 0.2 + Math.sin(t * 2 + item.index) * 0.15;
    }

    const dx = playerPos.x - item.position.x;
    const dz = playerPos.z - item.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.5) {
      collectState.paintings.push(item.index);
      const subject = PAINTING_SUBJECTS[item.index];
      const total = collectState.paintings.length;
      showLootText('Cave Painting: ' + subject.title + ' (' + total + '/8)');

      // Check for all 8
      if (total >= 8 && !collectState.paintingsComplete) {
        collectState.paintingsComplete = true;
        showLootText('All 8 paintings found! A 5th cave with the Ancient Chest has appeared...');
        _spawnAncientChestCave();
      }
    }
  }
}

// Spawn the 5th cave with the "Ancient Chest" when all paintings are found
function _spawnAncientChestCave() {
  // Place it at a dramatic deep-forest location
  const angle = Math.random() * Math.PI * 2;
  const dist = 90 + Math.random() * 30;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  // Simple cave structure (reuses the tent/cave style)
  const cave = new THREE.Group();
  const caveMat = new THREE.MeshLambertMaterial({ color: 0x886644, side: THREE.DoubleSide });

  // Back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), caveMat);
  backWall.position.set(0, 2, 2);
  cave.add(backWall);

  // Side walls
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), caveMat);
  leftWall.position.set(-2.5, 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  cave.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), caveMat);
  rightWall.position.set(2.5, 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  cave.add(rightWall);

  // Roof
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.5), caveMat);
  roof.position.set(0, 4.1, 0);
  roof.rotation.x = -Math.PI / 2;
  cave.add(roof);

  // Golden chest inside
  const chestMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), chestMat);
  chest.position.set(0, 0.4, 0.5);
  cave.add(chest);

  // Chest glow
  const chestGlow = new THREE.PointLight(0xffdd44, 1.0, 12);
  chestGlow.position.set(0, 2, 0);
  cave.add(chestGlow);

  cave.position.set(x, 0, z);
  cave.rotation.y = Math.atan2(-x, -z);
  scene.add(cave);

  showLootText('The Ancient Chest cave has appeared in the deep forest!');
}


// ============================================
// #8 - CREATURE CHARM NECKLACE
// 5% chance on any enemy kill to drop a charm.
// 5 types: wolf fang, bear claw, deer antler,
// bunny paw, cultist crystal.
// Tiny glowing meshes on ground, auto-pickup
// within 2 units. All 5 = "Forest Guardian"
// title + 10% speed boost.
// ============================================

// Charm visual info per type
const CHARM_INFO = {
  wolf:    { name: 'Wolf Fang',       color: 0x666688, glowColor: 0x8888aa },
  bear:    { name: 'Bear Claw',       color: 0x4a3728, glowColor: 0x664433 },
  deer:    { name: 'Deer Antler',     color: 0x8B6914, glowColor: 0xaa8822 },
  bunny:   { name: 'Bunny Paw',       color: 0xddccbb, glowColor: 0xeeddcc },
  cultist: { name: 'Cultist Crystal', color: 0x440044, glowColor: 0xaa00aa }
};

// Internal necklace display meshes
let _necklaceMeshes = [];

// --- updateCharmDrops ---
// Called from killEnemy hook. 5% chance to drop a charm.
function updateCharmDrops(enemyType, deathPosition) {
  // Map alphaWolf to wolf for charm purposes
  const charmType = (enemyType === 'alphaWolf') ? 'wolf' : enemyType;

  // Only the 5 tracked types
  if (!collectState.charms.hasOwnProperty(charmType)) return;

  // Already collected this type? Don't drop
  if (collectState.charms[charmType]) return;

  // 5% chance
  if (Math.random() > 0.05) return;

  const info = CHARM_INFO[charmType];
  if (!info) return;

  // Tiny glowing mesh on the ground
  const geo = new THREE.SphereGeometry(0.12, 6, 6);
  const mat = new THREE.MeshLambertMaterial({ color: info.color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(deathPosition.x, 0.2, deathPosition.z);

  const light = new THREE.PointLight(info.glowColor, 0.8, 4);
  light.position.set(0, 0.3, 0);
  mesh.add(light);

  scene.add(mesh);

  collectState.charmMeshes.push({
    mesh,
    light,
    type: charmType,
    position: mesh.position
  });

  showLootText(info.name + ' charm dropped!');
}

// --- updateCharmNecklace ---
// Called each frame. Handles pickup, necklace orbit, and speed boost.
function updateCharmNecklace() {
  const t = totalTime || 0;
  const playerPos = playerState.position;

  // --- Ground pickup ---
  for (let i = collectState.charmMeshes.length - 1; i >= 0; i--) {
    const item = collectState.charmMeshes[i];
    if (!item || !item.mesh) continue;

    // Slow spin and bob
    item.mesh.rotation.y = t * 2 + i;
    item.mesh.position.y = 0.2 + Math.sin(t * 2 + i) * 0.06;

    // Already collected this type? Remove from world
    if (collectState.charms[item.type]) {
      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
      collectState.charmMeshes.splice(i, 1);
      continue;
    }

    // Auto-pickup within 2 units
    const dx = playerPos.x - item.position.x;
    const dz = playerPos.z - item.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2) {
      collectState.charms[item.type] = true;
      const info = CHARM_INFO[item.type];
      showLootText('Charm collected: ' + info.name + '!');

      if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
      collectState.charmMeshes.splice(i, 1);

      // Rebuild necklace display
      _rebuildNecklace();

      // Check if all 5 are collected
      const allCollected = Object.values(collectState.charms).every(v => v);
      if (allCollected && !collectState.forestGuardian) {
        collectState.forestGuardian = true;
        showLootText('Forest Guardian! All charms collected! +10% speed!');
      }
    }
  }

  // --- Animate necklace meshes ---
  _updateNecklaceOrbit(t);
}

// Build/rebuild the tiny charm spheres orbiting at the player's neck
function _rebuildNecklace() {
  // Remove old meshes
  for (const nm of _necklaceMeshes) {
    if (nm.parent) nm.parent.remove(nm);
  }
  _necklaceMeshes = [];

  if (!playerState.mesh) return;

  const collected = Object.entries(collectState.charms)
    .filter(([, v]) => v)
    .map(([k]) => k);

  for (let i = 0; i < collected.length; i++) {
    const type = collected[i];
    const info = CHARM_INFO[type];
    if (!info) continue;

    const geo = new THREE.SphereGeometry(0.07, 5, 5);
    const mat = new THREE.MeshLambertMaterial({ color: info.color });
    const nm = new THREE.Mesh(geo, mat);

    nm.position.set(0.3, 1.5, 0);
    nm.userData.orbitIndex = i;
    nm.userData.orbitTotal = collected.length;

    playerState.mesh.add(nm);
    _necklaceMeshes.push(nm);
  }
}

// Orbit charms around the player's neck area
function _updateNecklaceOrbit(t) {
  const total = _necklaceMeshes.length;
  if (total === 0) return;

  for (let i = 0; i < total; i++) {
    const nm = _necklaceMeshes[i];
    const angle = ((i / total) * Math.PI * 2) + t * 1.2;
    nm.position.set(
      Math.cos(angle) * 0.28,
      1.4 + Math.sin(t * 2 + i) * 0.05,
      Math.sin(angle) * 0.28
    );
  }
}


// ============================================
// KEYBOARD HOOKS
// J = Bestiary, L = Journal
// These listeners are set up once.
// ============================================

document.addEventListener('keydown', (event) => {
  if (!playerState.isPlaying) return;

  switch (event.code) {
    case 'KeyJ':
      toggleBestiary();
      break;
    case 'KeyL':
      toggleJournal();
      break;
  }
});


// ============================================
// INJECTED CSS FOR COLLECTION OVERLAYS
// ============================================

function injectCollectingCSS() {
  if (document.getElementById('collecting-styles')) return;

  const style = document.createElement('style');
  style.id = 'collecting-styles';
  style.textContent = `
    /* All collection overlays share a backdrop blur */
    #bestiary-menu,
    #journal-menu,
    #census-book,
    #star-map {
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    /* Smooth scroll for long content */
    #bestiary-menu,
    #journal-menu {
      scroll-behavior: smooth;
    }

    /* Subtle hover on close buttons */
    #bestiary-menu button:hover,
    #journal-menu button:hover,
    #census-book button:hover,
    #star-map button:hover {
      filter: brightness(1.3);
    }
  `;

  document.head.appendChild(style);
}

// Auto-inject CSS on load
injectCollectingCSS();


// ============================================
// MASTER INIT - called once from startGame()
// Sets up all collection systems.
// ============================================

function initCollecting(sceneRef) {
  initFireflies(sceneRef);
  initConstellations(sceneRef);
  initJournalPages(sceneRef);
  // Cave paintings are deferred until kid caves exist
  // (call initCavePaintings(scene) after checkKidCaveSpawns)
}


// ============================================
// MASTER UPDATE - called every frame from
// the game loop. One call runs everything.
// ============================================

function updateCollecting(delta) {
  const playerPos = playerState.position;

  // #16 - Firefly Jar
  updateFireflies(delta);

  // #17 - Bunny Census
  updateBunnyCensus();

  // #18 - Monster Bestiary (encounter tracking)
  updateBestiary();

  // #19 - Constellation Map
  updateConstellations();

  // #21 - Whispering Journal
  updateJournalPages();

  // #23 - Cave Paintings (init lazily once caves exist)
  if (!_paintingState.initialized && kidCaves.length > 0) {
    initCavePaintings(scene);
  }
  updateCavePaintings();

  // #8 - Creature Charm Necklace
  updateCharmNecklace();
}

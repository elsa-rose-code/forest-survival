// ============================================
// KIDS.JS - The Four Missing Kids!
// This is the MAIN GOAL of the game!
// Find and rescue all 4 kids to WIN!
//
// Each kid is locked in a cave somewhere on
// the map, guarded by enemies. Kill the
// guardians, grab the key, and unlock the gate!
//
// Kids unlock as your campfire levels up:
//   Dino Kid    - Campfire Level 2 (closest)
//   Kraken Kid  - Campfire Level 3
//   Squid Kid   - Campfire Level 4
//   Koala Kid   - Campfire Level 5 (farthest!)
// ============================================

// --- THE FOUR KIDS ---
const MISSING_KIDS = [
  {
    name: 'Dino Kid',
    id: 'dino',
    tentColor: 0xcc2222,      // Red tent
    keyColor: 0xcc2222,       // Red key
    gateColor: 0xcc2222,      // Red gate
    hatColor: 0xcc2222,       // Red dino hat
    shirtColor: 0xffffff,     // White T-shirt
    pantsColor: 0x4466aa,     // Blue jeans
    campfireLevel: 2,         // Unlocked at level 2
    distance: 45,             // How far from center
    guardians: { type: 'wolf', count: 5, collarColor: 0xcc2222 },
    message: '"Thank you for saving me! I was so scared..."'
  },
  {
    name: 'Kraken Kid',
    id: 'kraken',
    tentColor: 0x2244cc,      // Blue tent
    keyColor: 0x2244cc,       // Blue key
    gateColor: 0x2244cc,      // Blue gate
    hatColor: 0x2244cc,       // Blue kraken hat
    shirtColor: 0x44aaff,     // Light blue shirt
    pantsColor: 0x334455,     // Dark pants
    campfireLevel: 3,         // Unlocked at level 3
    distance: 75,             // Medium distance
    guardians: { type: 'alphaWolf', count: 4, collarColor: 0x2244cc },
    message: '"I knew someone would come! You\'re so brave!"'
  },
  {
    name: 'Squid Kid',
    id: 'squid',
    tentColor: 0xddcc22,      // Yellow tent
    keyColor: 0xddcc22,       // Yellow key
    gateColor: 0xddcc22,      // Yellow gate
    hatColor: 0xccaa77,       // Tan squid hat
    shirtColor: 0x223366,     // Navy striped shirt
    pantsColor: 0xccbb88,     // Pale brown pants
    campfireLevel: 4,         // Unlocked at level 4
    distance: 115,            // Far
    guardians: { type: 'bear', count: 2, collarColor: 0xddcc22 },
    message: '"I thought I\'d be stuck here forever! Thank you!"'
  },
  {
    name: 'Koala Kid',
    id: 'koala',
    tentColor: 0x8844aa,      // Purple tent
    keyColor: 0x222222,       // Black key
    gateColor: 0x8844aa,      // Purple gate
    hatColor: 0xeeccdd,       // Pale pink koala hat
    shirtColor: 0x886644,     // Brown dress
    pantsColor: 0x886644,     // Same (dress)
    campfireLevel: 5,         // Unlocked at level 5 (final!)
    distance: 150,            // Very far!
    guardians: { type: 'bear', count: 6, collarColor: 0x222222 },
    message: '"You found me! I can\'t believe it! Let\'s go home!"'
  }
];

// Track all kid caves in the world
const kidCaves = [];

// Track how many kids have been rescued
const kidState = {
  rescued: 0,        // How many kids saved so far
  totalKids: 4,      // Need to save all 4 to win!
  keys: {}           // Which keys the player has (e.g., { dino: true })
};

// ============================================
// CREATE A KID'S 3D MODEL
// Small character with a fun animal hat!
// ============================================

function createKidMesh(config) {
  const kid = new THREE.Group();

  // BODY (small!)
  const bodyMat = new THREE.MeshLambertMaterial({ color: config.shirtColor });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  kid.add(body);

  // HEAD (yellow skin)
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffdd88 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), headMat);
  head.position.y = 1.15;
  head.castShadow = true;
  kid.add(head);

  // EYES (big, cute, black)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
  eyeL.position.set(-0.08, 1.18, -0.18);
  kid.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
  eyeR.position.set(0.08, 1.18, -0.18);
  kid.add(eyeR);

  // LEGS
  const legMat = new THREE.MeshLambertMaterial({ color: config.pantsColor });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.18), legMat);
  legL.position.set(-0.1, 0.2, 0);
  kid.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.18), legMat);
  legR.position.set(0.1, 0.2, 0);
  kid.add(legR);

  // ANIMAL HAT! (each kid has a unique one)
  const hatMat = new THREE.MeshLambertMaterial({ color: config.hatColor });

  if (config.id === 'dino') {
    // Dino hat - round with teeth and eyes
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), hatMat);
    hat.position.y = 1.45;
    kid.add(hat);
    // Dino teeth (white spikes along bottom)
    const teethMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -1; i <= 1; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), teethMat);
      tooth.position.set(i * 0.1, 1.28, -0.2);
      kid.add(tooth);
    }
    // Dino eyes on hat
    const hatEyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const hatEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), hatEyeMat);
    hatEyeL.position.set(-0.1, 1.5, -0.21);
    kid.add(hatEyeL);
    const hatEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), hatEyeMat);
    hatEyeR.position.set(0.1, 1.5, -0.21);
    kid.add(hatEyeR);

  } else if (config.id === 'kraken') {
    // Kraken hat - blue with tentacles
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), hatMat);
    hat.position.y = 1.45;
    kid.add(hat);
    // Tentacles hanging down the sides
    const tentMat = new THREE.MeshLambertMaterial({ color: 0x1133aa });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const tent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), tentMat);
      tent.position.set(Math.cos(angle) * 0.18, 1.25, Math.sin(angle) * 0.18);
      tent.rotation.z = Math.cos(angle) * 0.3;
      kid.add(tent);
    }

  } else if (config.id === 'squid') {
    // Squid hat - tan with droopy sides
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.4), hatMat);
    hat.position.y = 1.42;
    kid.add(hat);
    // Squid flaps hanging down
    const flapMat = new THREE.MeshLambertMaterial({ color: 0xbbaa66 });
    const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.15), flapMat);
    flapL.position.set(-0.22, 1.28, 0);
    kid.add(flapL);
    const flapR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.15), flapMat);
    flapR.position.set(0.22, 1.28, 0);
    kid.add(flapR);

  } else if (config.id === 'koala') {
    // Koala hat - pale pink with round ears
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.38), hatMat);
    hat.position.y = 1.44;
    kid.add(hat);
    // Round koala ears
    const earMat = new THREE.MeshLambertMaterial({ color: 0xeeccdd });
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.08), earMat);
    earL.position.set(-0.22, 1.55, 0);
    kid.add(earL);
    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.08), earMat);
    earR.position.set(0.22, 1.55, 0);
    kid.add(earR);
    // Inner ears (brown)
    const innerMat = new THREE.MeshLambertMaterial({ color: 0x886655 });
    const innerL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.09), innerMat);
    innerL.position.set(-0.22, 1.55, 0);
    kid.add(innerL);
    const innerR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.09), innerMat);
    innerR.position.set(0.22, 1.55, 0);
    kid.add(innerR);
    // Koala nose (brown dot)
    const noseMat = new THREE.MeshBasicMaterial({ color: 0x664433 });
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), noseMat);
    nose.position.set(0, 1.48, -0.2);
    kid.add(nose);
  }

  return kid;
}

// ============================================
// CREATE A KID'S CAVE
// A tent with a colored gate, the kid inside!
// ============================================

function createCave(config) {
  const cave = new THREE.Group();

  // === TENT / SHELTER (colored!) ===
  const tentMat = new THREE.MeshLambertMaterial({ color: config.tentColor, side: THREE.DoubleSide });

  // Back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), tentMat);
  backWall.position.set(0, 1.5, 1.5);
  cave.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), tentMat);
  leftWall.position.set(-2, 1.5, 0);
  leftWall.rotation.y = Math.PI / 2;
  cave.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), tentMat);
  rightWall.position.set(2, 1.5, 0);
  rightWall.rotation.y = -Math.PI / 2;
  cave.add(rightWall);

  // Roof (slanted)
  const roofMat = new THREE.MeshLambertMaterial({ color: config.tentColor, side: THREE.DoubleSide });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.5), roofMat);
  roof.position.set(0, 3.1, 0);
  roof.rotation.x = -Math.PI / 2;
  cave.add(roof);

  // === COLORED GATE (front - blocks entry until you have the key!) ===
  const gateMat = new THREE.MeshLambertMaterial({ color: config.gateColor });
  const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), gateMat);
  gateLeft.position.set(-1.5, 1.5, -1.5);
  cave.add(gateLeft);
  const gateRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), gateMat);
  gateRight.position.set(1.5, 1.5, -1.5);
  cave.add(gateRight);
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.2), gateMat);
  gateTop.position.set(0, 3, -1.5);
  cave.add(gateTop);

  // Gate bars (the actual lock!)
  const barMat = new THREE.MeshLambertMaterial({ color: config.gateColor });
  const bars = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), barMat);
    bar.position.set(i * 0.6, 1.4, -1.5);
    bars.add(bar);
  }
  cave.add(bars);

  // Lock on the gate (shiny!)
  const lockMat = new THREE.MeshBasicMaterial({ color: config.keyColor });
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.15), lockMat);
  lock.position.set(0, 1.5, -1.6);
  cave.add(lock);

  // Glow around the cave so you can find it!
  const glow = new THREE.PointLight(config.keyColor, 0.8, 15);
  glow.position.set(0, 2, 0);
  cave.add(glow);

  // === THE KID INSIDE (hidden behind the gate) ===
  const kidMesh = createKidMesh(config);
  kidMesh.position.set(0, 0, 0.5); // Inside the cave
  kidMesh.visible = true;
  cave.add(kidMesh);

  // Save references
  cave.userData = {
    config: config,
    bars: bars,       // The gate bars (removed when unlocked)
    lock: lock,       // The lock (removed when unlocked)
    glow: glow,
    kidMesh: kidMesh,
    unlocked: false,
    rescued: false,
    guardiansSpawned: false,
    guardiansAlive: 0
  };

  return cave;
}

// ============================================
// SPAWN KID CAVES AROUND THE MAP
// Each cave spawns when the campfire reaches
// the right level
// ============================================

function spawnKidCave(kidConfig) {
  // Pick a random angle for this cave
  const angle = Math.random() * Math.PI * 2;
  const x = Math.cos(angle) * kidConfig.distance;
  const z = Math.sin(angle) * kidConfig.distance;

  const caveMesh = createCave(kidConfig);
  caveMesh.position.set(x, 0, z);
  // Face toward center
  caveMesh.rotation.y = Math.atan2(-x, -z);
  scene.add(caveMesh);

  // Spawn the guardian enemies around the cave!
  const guardians = [];
  const gConfig = kidConfig.guardians;
  for (let i = 0; i < gConfig.count; i++) {
    const gAngle = (i / gConfig.count) * Math.PI * 2;
    const gx = x + Math.cos(gAngle) * 6;
    const gz = z + Math.sin(gAngle) * 6;
    const enemy = spawnEnemy(scene, gConfig.type, gx, gz);
    if (enemy) {
      // Give guardian a colored collar!
      const collarMat = new THREE.MeshBasicMaterial({ color: gConfig.collarColor });
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), collarMat);
      collar.position.y = 0.9;
      enemy.mesh.add(collar);
      // Mark this enemy as a cave guardian
      enemy.isGuardian = true;
      enemy.caveId = kidConfig.id;
      guardians.push(enemy);
    }
  }

  const caveData = {
    id: kidConfig.id,
    config: kidConfig,
    mesh: caveMesh,
    guardians: guardians,
    position: { x, z },
    unlocked: false,
    rescued: false
  };

  kidCaves.push(caveData);
  return caveData;
}

// Check if caves should be spawned (based on campfire level)
function checkKidCaveSpawns() {
  for (const kidConfig of MISSING_KIDS) {
    // Already spawned?
    if (kidCaves.find(c => c.id === kidConfig.id)) continue;

    // Campfire high enough?
    if (campfireState.level >= kidConfig.campfireLevel) {
      spawnKidCave(kidConfig);

      // Announce!
      const announce = document.getElementById('trader-announce');
      if (announce) {
        announce.textContent = 'A cry for help echoes from the forest... (' + kidConfig.name + ')';
        announce.style.display = 'block';
        setTimeout(() => { announce.style.display = 'none'; }, 4000);
      }
    }
  }
}

// ============================================
// UPDATE KIDS (check guardians, keys, rescue)
// ============================================

const KID_INTERACT_RANGE = 4;

function updateKids(playerPosition) {
  for (const cave of kidCaves) {
    if (cave.rescued) continue;

    const dx = playerPosition.x - cave.position.x;
    const dz = playerPosition.z - cave.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Glow pulse animation
    if (cave.mesh.userData.glow && !cave.unlocked) {
      cave.mesh.userData.glow.intensity = 0.5 + Math.sin(totalTime * 2) * 0.3;
    }

    // Count how many guardians are still alive
    cave.guardians = cave.guardians.filter(g => g.health > 0);

    // If all guardians are dead, drop the key!
    if (cave.guardians.length === 0 && !cave.unlocked && !kidState.keys[cave.id]) {
      kidState.keys[cave.id] = true;
      showLootText('Got the ' + cave.config.name + ' Key!');
      // Change glow to green (unlockable!)
      if (cave.mesh.userData.glow) {
        cave.mesh.userData.glow.color.setHex(0x44ff44);
      }
    }

    // Show prompt when near cave
    const prompt = document.getElementById('kid-prompt');
    if (dist < KID_INTERACT_RANGE && !cave.rescued) {
      if (prompt) {
        if (kidState.keys[cave.id]) {
          prompt.textContent = 'Press E to rescue ' + cave.config.name + '!';
          prompt.style.color = '#4ade80';
        } else if (cave.guardians.length > 0) {
          prompt.textContent = cave.config.name + ' - Defeat ' + cave.guardians.length + ' guardians!';
          prompt.style.color = '#ff6644';
        } else {
          prompt.textContent = 'Finding key...';
          prompt.style.color = '#ffcc44';
        }
        prompt.style.display = 'block';
      }
    } else if (prompt && dist >= KID_INTERACT_RANGE) {
      // Only hide if no other cave is nearby
      let anyNear = false;
      for (const c of kidCaves) {
        if (c.rescued) continue;
        const d = Math.sqrt(
          (playerPosition.x - c.position.x) ** 2 +
          (playerPosition.z - c.position.z) ** 2
        );
        if (d < KID_INTERACT_RANGE) anyNear = true;
      }
      if (!anyNear) prompt.style.display = 'none';
    }
  }
}

// Try to rescue a kid (called when pressing E near a cave)
function checkKidRescue() {
  for (const cave of kidCaves) {
    if (cave.rescued) continue;

    const dx = playerState.position.x - cave.position.x;
    const dz = playerState.position.z - cave.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < KID_INTERACT_RANGE && kidState.keys[cave.id]) {
      rescueKid(cave);
      return;
    }
  }
}

function rescueKid(cave) {
  cave.rescued = true;
  cave.unlocked = true;
  kidState.rescued++;

  // Remove the gate bars and lock (door opens!)
  if (cave.mesh.userData.bars) {
    cave.mesh.userData.bars.visible = false;
  }
  if (cave.mesh.userData.lock) {
    cave.mesh.userData.lock.visible = false;
  }

  // Change glow to bright green
  if (cave.mesh.userData.glow) {
    cave.mesh.userData.glow.color.setHex(0x44ff44);
    cave.mesh.userData.glow.intensity = 1.5;
  }

  // Show rescue message!
  showLootText(cave.config.name + ' rescued! ' + cave.config.message);

  // Update the kid counter UI
  updateKidCounterUI();

  // Rescuing a kid advances time by 2 days!
  dayNightState.dayCount += 2;
  dayNightState.nightCount += 2;
  const counterEl = document.getElementById('night-counter');
  if (counterEl) {
    if (dayNightState.isNight) {
      counterEl.textContent = 'Night ' + dayNightState.nightCount;
    } else {
      counterEl.textContent = 'Day ' + dayNightState.nightCount;
    }
  }
  showLootText('+2 Days! The forest grows darker...');

  // Make the kid mesh walk out and wave (simple animation)
  const kidMesh = cave.mesh.userData.kidMesh;
  if (kidMesh) {
    // Move kid forward (out of cave)
    kidMesh.position.z = -2;
  }

  // Check if all kids are rescued - YOU WIN!
  if (kidState.rescued >= kidState.totalKids) {
    setTimeout(() => {
      showVictoryScreen();
    }, 2000);
  }
}

// ============================================
// VICTORY SCREEN - You saved all the kids!
// ============================================

function showVictoryScreen() {
  const victory = document.getElementById('victory-screen');
  if (victory) {
    victory.style.display = 'flex';
  }
}

// ============================================
// UI UPDATES
// ============================================

function updateKidCounterUI() {
  const counter = document.getElementById('kid-counter');
  if (counter) {
    counter.textContent = 'Kids: ' + kidState.rescued + '/' + kidState.totalKids;
    if (kidState.rescued >= kidState.totalKids) {
      counter.style.color = '#4ade80';
      counter.textContent = 'All Kids Rescued!';
    }
  }
}

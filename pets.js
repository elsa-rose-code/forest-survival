// ============================================
// PETS.JS - The Pet System for 99 Nights!
// Three features:
//   #11 - Tamed Pets (bunny, wolf pup)
//   #15 - Bunny Friends (a friendly follower bunny)
//   #43 - The Wandering Cat (mysterious guide)
// ============================================

// ============================================
// PET STATE
// ============================================

const petState = {
  pets: [],           // Array of { mesh, type, glow, followTarget }
  feedCount: {},      // enemyId -> feed count
  maxPets: 3,
  // Bunny friend
  bunnyKillsThisCycle: 0,
  peacefulDays: 0,
  bunnyFriend: null,  // { mesh, state, animTime } or null
  bunnyFriendLost: false,
  // Wandering cat
  cat: null,          // { mesh, state, timer, targetPos }
  catSpawnTimer: 0,
  catEncounters: 0,
  catTamed: false
};

// ============================================
// FEATURE #11: TAMED PETS
// ============================================

// --- checkPetFeed() --- called on G keypress
// Checks if the player is near a tameable bunny or wolf
// and has meat in their sack
function checkPetFeed() {
  if (!playerState.alive) return;

  // Must be holding the sack (slot 2)
  if (playerState.selectedSlot !== 2) {
    return;
  }

  // Check meat
  if ((playerState.inventory.meat || 0) < 1) {
    return;
  }

  // Find nearest feedable enemy within 3 units
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.health <= 0) continue;
    if (enemy.type !== 'bunny' && enemy.type !== 'wolf') continue;

    const dx = playerState.position.x - enemy.mesh.position.x;
    const dz = playerState.position.z - enemy.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 3) continue;

    // Feed this enemy
    feedBunny(enemy);
    return; // Only feed one per press
  }
}

// --- feedBunny(enemy) --- works for both bunnies and wolves
function feedBunny(enemy) {
  const enemyId = enemy.mesh.id;
  const feedsNeeded = enemy.type === 'wolf' ? 5 : 3;

  // Consume 1 meat
  playerState.inventory.meat -= 1;
  if (typeof updateInventoryUI === 'function') updateInventoryUI();

  // Increment feed count
  if (!petState.feedCount[enemyId]) {
    petState.feedCount[enemyId] = 0;
  }
  petState.feedCount[enemyId]++;

  const count = petState.feedCount[enemyId];

  if (count >= feedsNeeded) {
    // Tame it!
    tamePet(enemy);
  } else {
    showLootText('Fed ' + enemy.type + '! (' + count + '/' + feedsNeeded + ')');

    // Visual feedback: flash green briefly
    enemy.mesh.traverse(function(child) {
      if (child.isMesh && child.material && child.material.color) {
        const orig = child.material.color.getHex();
        child.material.color.setHex(0x88ff88);
        setTimeout(function() { child.material.color.setHex(orig); }, 200);
      }
    });
  }
}

// --- tamePet(enemy) --- turn an enemy into a pet
function tamePet(enemy) {
  if (petState.pets.length >= petState.maxPets) {
    showLootText('Can\'t have more than ' + petState.maxPets + ' pets!');
    return;
  }

  var petType = enemy.type === 'wolf' ? 'wolfPup' : 'bunny';
  var petMesh;

  if (enemy.type === 'bunny') {
    petMesh = createPetBunnyMesh();
  } else {
    petMesh = createPetWolfMesh();
  }

  // Place at the enemy's position
  petMesh.position.copy(enemy.mesh.position);
  scene.add(petMesh);

  // Night glow light (starts off)
  var glow = new THREE.PointLight(0xaaffaa, 0, 5);
  glow.position.set(0, 0.6, 0);
  petMesh.add(glow);

  var petData = {
    mesh: petMesh,
    type: petType,
    glow: glow,
    followTarget: playerState.position,
    animTime: Math.random() * 10
  };

  petState.pets.push(petData);

  // Remove enemy from enemies array and scene
  if (enemy.mesh && enemy.mesh.parent) {
    enemy.mesh.parent.remove(enemy.mesh);
  }
  var idx = enemies.indexOf(enemy);
  if (idx > -1) enemies.splice(idx, 1);

  // Clean up feed progress
  delete petState.feedCount[enemy.mesh.id];

  showLootText('You tamed a ' + enemy.type + '!');
}

// ============================================
// PET MESHES
// ============================================

// --- Pet bunny mesh ---
// Slightly smaller than enemy bunny, with a red heart above head
function createPetBunnyMesh() {
  var group = new THREE.Group();
  var mat = new THREE.MeshLambertMaterial({ color: 0xddccbb });

  // Body
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.4), mat);
  body.position.y = 0.27;
  body.castShadow = true;
  group.add(body);

  // Head
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat);
  head.position.set(0, 0.43, -0.28);
  head.castShadow = true;
  group.add(head);

  // Ears
  var earMat = new THREE.MeshLambertMaterial({ color: 0xeeddcc });
  var earL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.08), earMat);
  earL.position.set(-0.07, 0.68, -0.26);
  earL.rotation.z = 0.12;
  group.add(earL);

  var earR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.08), earMat);
  earR.position.set(0.07, 0.68, -0.26);
  earR.rotation.z = -0.12;
  group.add(earR);

  // Inner ear (pink)
  var innerMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
  var innerL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.05), innerMat);
  innerL.position.set(-0.07, 0.68, -0.27);
  group.add(innerL);
  var innerR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.05), innerMat);
  innerR.position.set(0.07, 0.68, -0.27);
  group.add(innerR);

  // Eyes
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  var eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.04), eyeMat);
  eyeL.position.set(-0.07, 0.46, -0.41);
  group.add(eyeL);
  var eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.04), eyeMat);
  eyeR.position.set(0.07, 0.46, -0.41);
  group.add(eyeR);

  // Pink nose
  var noseMat = new THREE.MeshBasicMaterial({ color: 0xff8888 });
  var nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), noseMat);
  nose.position.set(0, 0.4, -0.42);
  group.add(nose);

  // Fluffy tail (white)
  var tailMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  var tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.09), tailMat);
  tail.position.set(0, 0.32, 0.26);
  group.add(tail);

  // Tiny red heart above head
  var heartMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  var heartBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), heartMat);
  heartBody.position.set(0, 0.95, -0.26);
  group.add(heartBody);
  var heartBL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), heartMat);
  heartBL.position.set(-0.05, 1.0, -0.26);
  group.add(heartBL);
  var heartBR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), heartMat);
  heartBR.position.set(0.05, 1.0, -0.26);
  group.add(heartBR);

  group.userData.heartParts = [heartBody, heartBL, heartBR];

  return group;
}

// --- Pet wolf pup mesh ---
// Smaller wolf, lighter gray, cute
function createPetWolfMesh() {
  var group = new THREE.Group();
  var mat = new THREE.MeshLambertMaterial({ color: 0x999999 });

  // Body
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), mat);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  // Head
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), mat);
  head.position.set(0, 0.54, -0.44);
  head.castShadow = true;
  group.add(head);

  // Snout
  var snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.2), mat);
  snout.position.set(0, 0.49, -0.6);
  group.add(snout);

  // Pointy ears
  var earMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  var earL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.06), earMat);
  earL.position.set(-0.09, 0.65, -0.38);
  earL.rotation.z = 0.2;
  group.add(earL);
  var earR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.06), earMat);
  earR.position.set(0.09, 0.65, -0.38);
  earR.rotation.z = -0.2;
  group.add(earR);

  // Eyes (amber, friendly)
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
  var eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
  eyeL.position.set(-0.08, 0.57, -0.57);
  group.add(eyeL);
  var eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
  eyeR.position.set(0.08, 0.57, -0.57);
  group.add(eyeR);

  // Legs (4)
  var legGeom = new THREE.BoxGeometry(0.1, 0.28, 0.1);
  var legPositions = [
    [-0.13, 0.14, -0.2],
    [0.13, 0.14, -0.2],
    [-0.13, 0.14, 0.2],
    [0.13, 0.14, 0.2]
  ];
  var legs = [];
  for (var li = 0; li < legPositions.length; li++) {
    var lp = legPositions[li];
    var leg = new THREE.Mesh(legGeom, mat);
    leg.position.set(lp[0], lp[1], lp[2]);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }

  // Little tail
  var tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.22), mat);
  tail.position.set(0, 0.52, 0.38);
  tail.rotation.x = -0.4;
  group.add(tail);

  group.userData.legs = legs;
  return group;
}

// ============================================
// updatePets(delta) - Main pet update loop
// Follow AI, animations, flee from enemies,
// night glow, wolf pup speed perk
// ============================================

function updatePets(delta) {
  var isNight = (typeof dayNightState !== 'undefined') && dayNightState.isNight;

  // Wolf pup speed perk: +5% player speed when nearby
  var hasWolfPup = false;
  for (var wi = 0; wi < petState.pets.length; wi++) {
    if (petState.pets[wi].type === 'wolfPup') {
      hasWolfPup = true;
      break;
    }
  }
  // Store on playerState so player.js can use it
  playerState._petSpeedBonus = hasWolfPup ? 0.05 : 0;

  for (var i = 0; i < petState.pets.length; i++) {
    var pet = petState.pets[i];
    var petPos = pet.mesh.position;
    var playerPos = playerState.position;

    pet.animTime += delta;

    // --- Check if any enemy is within 8 units (flee!) ---
    var fleeX = 0;
    var fleeZ = 0;
    var fleeing = false;

    for (var ei = 0; ei < enemies.length; ei++) {
      var e = enemies[ei];
      if (e.health <= 0 || e.passive) continue;

      var ex = e.mesh.position.x - petPos.x;
      var ez = e.mesh.position.z - petPos.z;
      var eDist = Math.sqrt(ex * ex + ez * ez);

      if (eDist < 8 && eDist > 0) {
        // Flee opposite direction
        fleeX -= ex / eDist;
        fleeZ -= ez / eDist;
        fleeing = true;
      }
    }

    if (fleeing) {
      // Normalize flee direction
      var fleeLen = Math.sqrt(fleeX * fleeX + fleeZ * fleeZ);
      if (fleeLen > 0) {
        fleeX /= fleeLen;
        fleeZ /= fleeLen;
      }
      petPos.x += fleeX * 8 * delta;
      petPos.z += fleeZ * 8 * delta;
      pet.mesh.rotation.y = Math.atan2(fleeX, fleeZ);
    } else {
      // --- Follow player at distance of 3 units, smooth lerp (10% per frame) ---
      var dx = playerPos.x - petPos.x;
      var dz = playerPos.z - petPos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 3) {
        // Target position: 3 units from player toward pet's current pos
        var targetX = playerPos.x - (dx / dist) * 3;
        var targetZ = playerPos.z - (dz / dist) * 3;

        // Smooth lerp 10% per frame
        petPos.x += (targetX - petPos.x) * 0.1;
        petPos.z += (targetZ - petPos.z) * 0.1;
      }

      // Face player direction
      if (dist > 0.5) {
        pet.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }

    // --- Hop animation ---
    petPos.y = Math.abs(Math.sin(totalTime * 4)) * 0.3;

    // --- Heart bob for bunnies ---
    if (pet.type === 'bunny' && pet.mesh.userData.heartParts) {
      var bobY = Math.sin(totalTime * 3) * 0.05;
      var parts = pet.mesh.userData.heartParts;
      for (var hi = 0; hi < parts.length; hi++) {
        if (parts[hi].userData.baseY === undefined) {
          parts[hi].userData.baseY = parts[hi].position.y;
        }
        parts[hi].position.y = parts[hi].userData.baseY + bobY;
      }
    }

    // --- Wolf pup leg animation ---
    if (pet.type === 'wolfPup' && pet.mesh.userData.legs) {
      var legMoving = fleeing || (dist > 3);
      for (var j = 0; j < pet.mesh.userData.legs.length; j++) {
        if (legMoving) {
          var offset = j % 2 === 0 ? 0 : Math.PI;
          pet.mesh.userData.legs[j].rotation.x = Math.sin(pet.animTime * 8 + offset) * 0.35;
        } else {
          pet.mesh.userData.legs[j].rotation.x = 0;
        }
      }
    }

    // --- Night glow ---
    if (pet.glow) {
      if (isNight) {
        pet.glow.intensity = 0.3;
      } else {
        pet.glow.intensity = 0;
      }
    }
  }
}

// ============================================
// FEATURE #15: BUNNY FRIENDS
// ============================================

// --- Track bunny kills (call from killEnemy in enemies.js) ---
function onBunnyKilled() {
  petState.bunnyKillsThisCycle++;
}

// --- Called if player attacks the bunny friend ---
function onFriendBunnyAttacked() {
  if (!petState.bunnyFriend || petState.bunnyFriendLost) return;

  petState.bunnyFriendLost = true;
  var mesh = petState.bunnyFriend.mesh;

  showLootText('The friendly bunny ran away and won\'t come back...');

  // Animate fleeing
  petState.bunnyFriend.state = 'fleeing';

  // Remove after a moment
  setTimeout(function() {
    if (mesh && mesh.parent) mesh.parent.remove(mesh);
    petState.bunnyFriend = null;
  }, 3000);
}

// --- Create friend bunny mesh ---
// Lighter colored with a tiny flower on head
function createFriendBunnyMesh() {
  var group = new THREE.Group();
  var mat = new THREE.MeshLambertMaterial({ color: 0xffeedd });

  // Body
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), mat);
  body.position.y = 0.3;
  body.castShadow = true;
  group.add(body);

  // Head
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.28), mat);
  head.position.set(0, 0.4, -0.32);
  head.castShadow = true;
  group.add(head);

  // Ears
  var earMat = new THREE.MeshLambertMaterial({ color: 0xffddd0 });
  var earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), earMat);
  earL.position.set(-0.08, 0.72, -0.3);
  earL.rotation.z = 0.15;
  group.add(earL);
  var earR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), earMat);
  earR.position.set(0.08, 0.72, -0.3);
  earR.rotation.z = -0.15;
  group.add(earR);

  // Inner ears (pink)
  var innerMat = new THREE.MeshLambertMaterial({ color: 0xffbbbb });
  var innerL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.06), innerMat);
  innerL.position.set(-0.08, 0.72, -0.31);
  group.add(innerL);
  var innerR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.06), innerMat);
  innerR.position.set(0.08, 0.72, -0.31);
  group.add(innerR);

  // Eyes
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x443333 });
  var eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), eyeMat);
  eyeL.position.set(-0.08, 0.43, -0.45);
  group.add(eyeL);
  var eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), eyeMat);
  eyeR.position.set(0.08, 0.43, -0.45);
  group.add(eyeR);

  // Fluffy tail
  var tailMat = new THREE.MeshLambertMaterial({ color: 0xfffaf5 });
  var tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), tailMat);
  tail.position.set(0, 0.35, 0.3);
  group.add(tail);

  // Tiny flower on head (yellow center + pink petals)
  var flowerCenterMat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  var flowerCenter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), flowerCenterMat);
  flowerCenter.position.set(0, 0.6, -0.3);
  group.add(flowerCenter);

  var petalMat = new THREE.MeshLambertMaterial({ color: 0xff88bb });
  var petalOffsets = [
    [0.07, 0, 0], [-0.07, 0, 0],
    [0, 0, 0.07], [0, 0, -0.07]
  ];
  for (var pi = 0; pi < petalOffsets.length; pi++) {
    var po = petalOffsets[pi];
    var petal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), petalMat);
    petal.position.set(po[0], 0.6, -0.3 + po[2]);
    group.add(petal);
  }

  return group;
}

// --- Spawn the friend bunny near camp ---
function spawnFriendBunny() {
  if (petState.bunnyFriendLost) return;
  if (petState.bunnyFriend) return;

  var angle = Math.random() * Math.PI * 2;
  var dist = SAFE_ZONE_RADIUS + 3 + Math.random() * 4;
  var x = Math.cos(angle) * dist;
  var z = Math.sin(angle) * dist;

  var mesh = createFriendBunnyMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  petState.bunnyFriend = {
    mesh: mesh,
    state: 'following',
    animTime: 0
  };

  showLootText('A friendly bunny appeared near camp!');
}

// --- updateBunnyFriend(delta) ---
// Manages kill tracking, dawn resets, spawning, following, fleeing
function updateBunnyFriend(delta) {
  if (petState.bunnyFriendLost) return;

  // --- Track dawn transitions for kill-free day cycles ---
  if (typeof dayNightState !== 'undefined' && dayNightState.justBecameDay) {
    if (petState.bunnyKillsThisCycle === 0) {
      petState.peacefulDays++;
      // One full peaceful day cycle -> spawn a friend bunny
      if (petState.peacefulDays >= 1 && !petState.bunnyFriend) {
        spawnFriendBunny();
      }
    } else {
      // Reset peaceful streak
      petState.peacefulDays = 0;
    }
    // Reset kill count for new cycle
    petState.bunnyKillsThisCycle = 0;
  }

  // --- Update the friend bunny if it exists ---
  var friend = petState.bunnyFriend;
  if (!friend) return;

  // Handle flee animation if lost
  if (friend.state === 'fleeing') {
    var mesh = friend.mesh;
    var awayAngle = Math.atan2(mesh.position.z, mesh.position.x);
    mesh.position.x += Math.cos(awayAngle) * 10 * delta;
    mesh.position.z += Math.sin(awayAngle) * 10 * delta;
    mesh.position.y = Math.abs(Math.sin(friend.animTime * 6)) * 0.4;
    friend.animTime += delta;
    return;
  }

  friend.animTime += delta;
  var fMesh = friend.mesh;

  // --- Flee from nearby enemies (within 8 units) ---
  var enemyTooClose = false;
  for (var ei = 0; ei < enemies.length; ei++) {
    var e = enemies[ei];
    if (e.health <= 0 || e.passive) continue;
    var ex = e.mesh.position.x - fMesh.position.x;
    var ez = e.mesh.position.z - fMesh.position.z;
    if (Math.sqrt(ex * ex + ez * ez) < 8) {
      enemyTooClose = true;
      break;
    }
  }

  if (enemyTooClose) {
    // Flee away from center temporarily
    var fleeAngle = Math.atan2(fMesh.position.z, fMesh.position.x);
    fMesh.position.x += Math.cos(fleeAngle) * 6 * delta;
    fMesh.position.z += Math.sin(fleeAngle) * 6 * delta;
    fMesh.position.y = Math.abs(Math.sin(friend.animTime * 5)) * 0.3;
    return;
  }

  // --- Follow player at distance 5 units ---
  var dx = playerState.position.x - fMesh.position.x;
  var dz = playerState.position.z - fMesh.position.z;
  var dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 5) {
    var speed = 8 * delta;
    fMesh.position.x += (dx / dist) * speed;
    fMesh.position.z += (dz / dist) * speed;
    fMesh.rotation.y = Math.atan2(dx, dz);
  }

  // Hop animation
  fMesh.position.y = Math.abs(Math.sin(friend.animTime * 3)) * 0.25;
}

// ============================================
// FEATURE #43: THE WANDERING CAT
// ============================================

// --- createCatMesh() ---
// Cute blocky black cat with pointed ears, green eyes,
// long curved tail, and whiskers
function createCatMesh() {
  var group = new THREE.Group();
  var bodyMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

  // Body (low, sleek)
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.8), bodyMat);
  body.position.y = 0.32;
  body.castShadow = true;
  group.add(body);

  // Head (0.3 cube)
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), bodyMat);
  head.position.set(0, 0.45, -0.45);
  head.castShadow = true;
  group.add(head);

  // Pointed ear triangles (small cones)
  var earMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  var earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), earMat);
  earL.position.set(-0.1, 0.68, -0.43);
  earL.rotation.z = 0.15;
  group.add(earL);
  var earR = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), earMat);
  earR.position.set(0.1, 0.68, -0.43);
  earR.rotation.z = -0.15;
  group.add(earR);

  // Inner ear (pinkish dark)
  var innerEarMat = new THREE.MeshLambertMaterial({ color: 0x332222 });
  var innerEarL = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), innerEarMat);
  innerEarL.position.set(-0.1, 0.66, -0.44);
  innerEarL.rotation.z = 0.15;
  group.add(innerEarL);
  var innerEarR = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), innerEarMat);
  innerEarR.position.set(0.1, 0.66, -0.44);
  innerEarR.rotation.z = -0.15;
  group.add(innerEarR);

  // Green glowing eyes (tiny boxes)
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
  var eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), eyeMat);
  eyeL.position.set(-0.08, 0.48, -0.61);
  group.add(eyeL);
  var eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), eyeMat);
  eyeR.position.set(0.08, 0.48, -0.61);
  group.add(eyeR);

  // Nose (tiny pink)
  var noseMat = new THREE.MeshBasicMaterial({ color: 0x664444 });
  var nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.03), noseMat);
  nose.position.set(0, 0.43, -0.62);
  group.add(nose);

  // Whiskers (thin boxes, 3 on each side)
  var whiskerMat = new THREE.MeshBasicMaterial({ color: 0x555555 });

  // Left whiskers
  var wL1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), whiskerMat);
  wL1.position.set(-0.16, 0.44, -0.58);
  wL1.rotation.z = 0.1;
  group.add(wL1);
  var wL2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), whiskerMat);
  wL2.position.set(-0.16, 0.42, -0.58);
  group.add(wL2);
  var wL3 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), whiskerMat);
  wL3.position.set(-0.16, 0.40, -0.58);
  wL3.rotation.z = -0.1;
  group.add(wL3);

  // Right whiskers
  var wR1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), whiskerMat);
  wR1.position.set(0.16, 0.44, -0.58);
  wR1.rotation.z = -0.1;
  group.add(wR1);
  var wR2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), whiskerMat);
  wR2.position.set(0.16, 0.42, -0.58);
  group.add(wR2);
  var wR3 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), whiskerMat);
  wR3.position.set(0.16, 0.40, -0.58);
  wR3.rotation.z = 0.1;
  group.add(wR3);

  // Legs (4 thin ones)
  var legGeom = new THREE.BoxGeometry(0.08, 0.24, 0.08);
  var legPositions = [
    [-0.15, 0.12, -0.28],
    [0.15, 0.12, -0.28],
    [-0.15, 0.12, 0.28],
    [0.15, 0.12, 0.28]
  ];
  var legs = [];
  for (var li = 0; li < legPositions.length; li++) {
    var lp = legPositions[li];
    var leg = new THREE.Mesh(legGeom, bodyMat);
    leg.position.set(lp[0], lp[1], lp[2]);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }

  // Paws (tiny lighter colored boxes at feet)
  var pawMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (var pi = 0; pi < legPositions.length; pi++) {
    var pp = legPositions[pi];
    var paw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.1), pawMat);
    paw.position.set(pp[0], 0.02, pp[2]);
    group.add(paw);
  }

  // Long tail (thin cylinder, curved upward via rotation)
  var tailMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 6), tailMat);
  tail.position.set(0, 0.45, 0.5);
  tail.rotation.x = -0.6;
  group.add(tail);

  // Tail tip (slightly thinner, for the curve)
  var tailTip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 6), tailMat);
  tailTip.position.set(0, 0.62, 0.68);
  tailTip.rotation.x = -1.2;
  group.add(tailTip);

  // Store references for animation
  group.userData.tail = tail;
  group.userData.tailTip = tailTip;
  group.userData.eyeL = eyeL;
  group.userData.eyeR = eyeR;
  group.userData.legs = legs;

  return group;
}

// --- Find the cat's guide target ---
// Nearest unrescued kid cave, or unopened chest, or journal page,
// or fallback to a random direction
function findCatGuideTarget(catPos) {
  var bestTarget = null;
  var bestDist = Infinity;

  // Check kid caves for unrescued ones
  if (typeof kidCaves !== 'undefined') {
    for (var ci = 0; ci < kidCaves.length; ci++) {
      var cave = kidCaves[ci];
      if (cave.rescued) continue;
      var dx = catPos.x - cave.position.x;
      var dz = catPos.z - cave.position.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = new THREE.Vector3(cave.position.x, 0, cave.position.z);
      }
    }
  }

  // Check chests for unopened ones
  if (typeof chests !== 'undefined') {
    for (var chi = 0; chi < chests.length; chi++) {
      var chest = chests[chi];
      if (chest.opened) continue;
      var cx = chest.mesh.position.x;
      var cz = chest.mesh.position.z;
      var cdx = catPos.x - cx;
      var cdz = catPos.z - cz;
      var cd = Math.sqrt(cdx * cdx + cdz * cdz);
      if (cd < bestDist) {
        bestDist = cd;
        bestTarget = new THREE.Vector3(cx, 0, cz);
      }
    }
  }

  // Check journal pages for uncollected ones
  if (typeof journalState !== 'undefined' && journalState.pages) {
    for (var ji = 0; ji < journalState.pages.length; ji++) {
      var page = journalState.pages[ji];
      if (journalState.collected && journalState.collected.includes(page.index)) continue;
      var px = page.position.x;
      var pz = page.position.z;
      var pdx = catPos.x - px;
      var pdz = catPos.z - pz;
      var pd = Math.sqrt(pdx * pdx + pdz * pdz);
      if (pd < bestDist) {
        bestDist = pd;
        bestTarget = new THREE.Vector3(px, 0, pz);
      }
    }
  }

  // Fallback: random direction
  if (!bestTarget) {
    var angle = Math.random() * Math.PI * 2;
    var radius = 20 + Math.random() * 20;
    bestTarget = new THREE.Vector3(
      catPos.x + Math.cos(angle) * radius,
      0,
      catPos.z + Math.sin(angle) * radius
    );
  }

  return bestTarget;
}

// --- Spawn the wandering cat at a random map location ---
function spawnWanderingCat() {
  if (petState.cat) return;
  if (petState.catTamed) return;

  var mesh = createCatMesh();

  // Random position somewhere within the map but not too close to camp
  var angle = Math.random() * Math.PI * 2;
  var minR = SAFE_ZONE_RADIUS + 8;
  var maxR = (typeof campfireState !== 'undefined' ? campfireState.mapRadius : 60) * 0.85;
  var radius = minR + Math.random() * (maxR - minR);
  var x = Math.cos(angle) * radius;
  var z = Math.sin(angle) * radius;

  mesh.position.set(x, 0, z);
  scene.add(mesh);

  petState.cat = {
    mesh: mesh,
    state: 'idle',
    timer: 3 + Math.random() * 2, // Idle wander direction timer
    targetPos: null,
    wanderAngle: Math.random() * Math.PI * 2,
    orbitAngle: 0,
    orbitTimer: 0,
    guideTimer: 0,
    fadeTimer: 0
  };
}

// --- Despawn the cat (remove from scene, reset timer) ---
function despawnWanderingCat() {
  if (petState.cat && petState.cat.mesh && petState.cat.mesh.parent) {
    petState.cat.mesh.parent.remove(petState.cat.mesh);
  }
  petState.cat = null;
  // Next spawn in 60-120 seconds
  petState.catSpawnTimer = 60 + Math.random() * 60;
}

// --- Make cat a permanent pet ---
function makeCatPermanent() {
  if (!petState.cat) return;
  if (petState.pets.length >= petState.maxPets) {
    showLootText('Can\'t have more than ' + petState.maxPets + ' pets!');
    despawnWanderingCat();
    return;
  }

  petState.catTamed = true;

  var catMesh = petState.cat.mesh;

  // Night glow (green)
  var glow = new THREE.PointLight(0x44ff44, 0, 5);
  glow.position.set(0, 0.5, 0);
  catMesh.add(glow);

  petState.pets.push({
    mesh: catMesh,
    type: 'cat',
    glow: glow,
    followTarget: playerState.position,
    animTime: Math.random() * 10
  });

  // Cat is no longer managed by updateWanderingCat
  petState.cat = null;

  showLootText('The wandering cat has decided to stay with you!');
}

// --- initWanderingCat() --- start the spawn timer
function initWanderingCat() {
  petState.catSpawnTimer = 60 + Math.random() * 60;
}

// --- updateWanderingCat(delta) ---
function updateWanderingCat(delta) {
  // If cat is tamed (now a pet), nothing to do here
  if (petState.catTamed) return;

  // --- Spawn timer ---
  if (!petState.cat) {
    petState.catSpawnTimer -= delta;
    if (petState.catSpawnTimer <= 0) {
      spawnWanderingCat();
    }
    return;
  }

  var cat = petState.cat;
  var mesh = cat.mesh;
  if (!mesh) return;

  var catPos = mesh.position;
  var playerPos = playerState.position;

  var dx = playerPos.x - catPos.x;
  var dz = playerPos.z - catPos.z;
  var distToPlayer = Math.sqrt(dx * dx + dz * dz);

  // --- Tail wave animation (always) ---
  if (mesh.userData.tail) {
    mesh.userData.tail.rotation.z = Math.sin(totalTime * 2) * 0.4;
  }
  if (mesh.userData.tailTip) {
    mesh.userData.tailTip.rotation.z = Math.sin(totalTime * 2.5 + 1) * 0.3;
  }

  // --- Eye pulse animation (always) ---
  if (mesh.userData.eyeL) {
    var pulse = 0.8 + Math.sin(totalTime * 3) * 0.2;
    mesh.userData.eyeL.material.color.setRGB(0.27 * pulse, 1.0 * pulse, 0.27 * pulse);
    mesh.userData.eyeR.material.color.setRGB(0.27 * pulse, 1.0 * pulse, 0.27 * pulse);
  }

  // --- Leg animation when moving ---
  var isMoving = (cat.state === 'idle' || cat.state === 'guiding');
  if (mesh.userData.legs && isMoving) {
    for (var li = 0; li < mesh.userData.legs.length; li++) {
      var legOffset = li % 2 === 0 ? 0 : Math.PI;
      mesh.userData.legs[li].rotation.x = Math.sin(totalTime * 6 + legOffset) * 0.25;
    }
  }

  // ============================================
  // Cat state machine
  // ============================================

  // --- IDLE: wander around, wait for player ---
  if (cat.state === 'idle') {
    cat.timer -= delta;

    // Pick new random direction every 3-5 seconds
    if (cat.timer <= 0) {
      cat.wanderAngle = Math.random() * Math.PI * 2;
      cat.timer = 3 + Math.random() * 2;
    }

    // Wander slowly
    var wanderSpeed = 2 * delta;
    catPos.x += Math.sin(cat.wanderAngle) * wanderSpeed;
    catPos.z += Math.cos(cat.wanderAngle) * wanderSpeed;
    mesh.rotation.y = cat.wanderAngle;

    // Gentle idle bob
    catPos.y = Math.sin(totalTime * 1.5) * 0.03;

    // Player gets within 3 units -> noticed!
    if (distToPlayer < 3) {
      cat.state = 'noticed';
      petState.catEncounters++;
      cat.orbitAngle = Math.atan2(catPos.z - playerPos.z, catPos.x - playerPos.x);
      cat.orbitTimer = 0;

      showLootText('Meow!');

      // At 5 encounters, cat becomes permanent
      if (petState.catEncounters >= 5) {
        showLootText('The cat seems to have grown fond of you...');
        setTimeout(function() { makeCatPermanent(); }, 2500);
        cat.state = 'guiding';
        cat.targetPos = findCatGuideTarget(catPos);
        cat.guideTimer = 0;
        return;
      }
    }

    // Despawn if wandered too long (120 seconds since spawn)
    // Cat has a natural lifespan to prevent accumulation
  }

  // --- NOTICED: circle player once, then guide ---
  else if (cat.state === 'noticed') {
    cat.orbitTimer += delta;
    var orbitRadius = 2;
    var orbitSpeed = Math.PI; // Full circle in ~2 seconds

    cat.orbitAngle += orbitSpeed * delta;

    catPos.x = playerPos.x + Math.cos(cat.orbitAngle) * orbitRadius;
    catPos.z = playerPos.z + Math.sin(cat.orbitAngle) * orbitRadius;
    catPos.y = 0;

    // Face toward player
    mesh.rotation.y = Math.atan2(
      playerPos.x - catPos.x,
      playerPos.z - catPos.z
    );

    // After one full circle (~2 sec), start guiding
    if (cat.orbitTimer >= 2) {
      cat.targetPos = findCatGuideTarget(catPos);
      cat.state = 'guiding';
      cat.guideTimer = 0;
    }
  }

  // --- GUIDING: walk toward point of interest for 5 seconds, then vanish ---
  else if (cat.state === 'guiding') {
    cat.guideTimer += delta;

    if (cat.targetPos) {
      var tx = cat.targetPos.x - catPos.x;
      var tz = cat.targetPos.z - catPos.z;
      var td = Math.sqrt(tx * tx + tz * tz);

      if (td > 0.5) {
        var guideSpeed = 5 * delta;
        catPos.x += (tx / td) * guideSpeed;
        catPos.z += (tz / td) * guideSpeed;
        mesh.rotation.y = Math.atan2(tx, tz);
      }

      // Walk bob
      catPos.y = Math.abs(Math.sin(totalTime * 5)) * 0.06;
    }

    // After 5 seconds, fade out and vanish
    if (cat.guideTimer >= 5) {
      cat.state = 'fading';
      cat.fadeTimer = 0;
    }
  }

  // --- FADING: fade out then remove ---
  else if (cat.state === 'fading') {
    cat.fadeTimer += delta;
    var fadeProgress = cat.fadeTimer / 1.0; // 1 second fade

    // Fade all materials
    mesh.traverse(function(child) {
      if (child.isMesh && child.material) {
        if (!child.material._origOpacity) {
          child.material._origOpacity = child.material.opacity;
          child.material.transparent = true;
        }
        child.material.opacity = Math.max(0, 1 - fadeProgress);
      }
    });

    if (cat.fadeTimer >= 1.0) {
      despawnWanderingCat();
    }
  }
}

// ============================================
// INITIALIZATION
// Call initPets() once after scene is set up
// ============================================

function initPets() {
  // Start the wandering cat spawn timer
  initWanderingCat();

  // Bunny friend peaceful day tracking starts at 0
  petState.peacefulDays = 0;
  petState.bunnyKillsThisCycle = 0;
}

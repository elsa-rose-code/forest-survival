// ============================================
// PLAYER.JS - Everything about the player!
// THIRD PERSON camera - you can see your character!
// Movement, the old axe, combat, and inventory
// ============================================

// --- PLAYER SETTINGS ---
const PLAYER_SPEED = 15;         // How fast you walk
const PLAYER_HEIGHT = 0;         // Player is on the ground (y=0)
const MOUSE_SENSITIVITY = 0.003; // How fast the camera orbits
const AXE_DAMAGE = 25;           // How much damage your axe does
const AXE_RANGE = 3.5;           // How far your axe can reach
const AXE_COOLDOWN = 0.5;        // Seconds between swings

// --- CAMERA SETTINGS ---
const CAM_DISTANCE = 8;          // How far the camera is behind the player
const CAM_HEIGHT = 5;            // How high the camera is above the player
const CAM_MIN_PITCH = 0.1;       // Minimum look angle (don't go underground)
const CAM_MAX_PITCH = 1.2;       // Maximum look angle (don't go straight up)

// --- PLAYER STATE ---
const playerState = {
  health: 100,
  maxHealth: 100,
  alive: true,
  // Movement keys
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  // Camera rotation (orbiting around the player)
  yaw: 0,       // Left/right orbit angle
  pitch: 0.5,   // Up/down angle (start slightly above)
  // Position (this is the CHARACTER's position now, not the camera)
  position: new THREE.Vector3(0, 0, 0),
  // The 3D character mesh
  mesh: null,
  // Game active?
  isPlaying: false,
  // Combat
  isSwinging: false,
  swingTimer: 0,
  swingCooldown: 0,
  // Inventory (the old sack!)
  inventory: {
    gems: 0,
    meat: 0,
    fangs: 0,
    bones: 0,
    wood: 0,       // From chopping trees!
    coal: 0,       // Found on the ground
    fuel: 0,       // Found in the forest
    fuelCanister: 0, // Rare! Found far from base
    scrap: 0,        // From enemies! Used for crafting
    // Pelts - for the trader!
    bunnyFoot: 0,
    wolfPelt: 0,
    alphaWolfPelt: 0,
    bearPelt: 0
  },
  sackCapacity: 5,      // Old Sack holds 5 items. Upgrades increase this!
  sackName: 'Old Sack', // Name shown in the popup
  // Hotbar - slots 1-5, each can hold an item
  // slot 1 = Old Axe (always), slot 2 = Sack (always), 3-5 = equipment from chests
  selectedSlot: 1,
  equipment: {
    // slot number -> item info
    // 3, 4, 5 start empty, get filled from chests
  },
  // Armor stats (from equipment)
  damageReduction: 0, // Percentage of damage blocked (0 to 1)
  // Respawn timer
  respawnTimer: 0,
  // Animation
  animTime: 0,
  isMoving: false
};

// ============================================
// CREATE THE PLAYER CHARACTER
// A visible 3D person you can see from behind!
// ============================================

function createPlayerMesh() {
  const player = new THREE.Group();

  // BODY - main torso
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a }); // Green shirt
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.45), bodyMat);
  body.position.y = 1.35;
  body.castShadow = true;
  player.add(body);

  // HEAD
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 }); // Skin
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), headMat);
  head.position.y = 2.1;
  head.castShadow = true;
  player.add(head);

  // HAIR
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 }); // Brown hair
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), hairMat);
  hair.position.y = 2.4;
  player.add(hair);

  // EYES
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
  eyeL.position.set(-0.12, 2.12, -0.23);
  player.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
  eyeR.position.set(0.12, 2.12, -0.23);
  player.add(eyeR);

  // LEGS
  const legMat = new THREE.MeshLambertMaterial({ color: 0x445566 }); // Dark pants
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.35), legMat);
  legL.position.set(-0.18, 0.5, 0);
  legL.castShadow = true;
  player.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.35), legMat);
  legR.position.set(0.18, 0.5, 0);
  legR.castShadow = true;
  player.add(legR);

  // ARMS
  const armMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a }); // Same green as body
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.28), armMat);
  armL.position.set(-0.46, 1.3, 0);
  armL.castShadow = true;
  player.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.28), armMat);
  armR.position.set(0.46, 1.3, 0);
  armR.castShadow = true;
  player.add(armR);

  // BOOTS
  const bootMat = new THREE.MeshLambertMaterial({ color: 0x3a2512 });
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.42), bootMat);
  bootL.position.set(-0.18, 0.1, -0.03);
  player.add(bootL);
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.42), bootMat);
  bootR.position.set(0.18, 0.1, -0.03);
  player.add(bootR);

  // Save references for animation
  player.userData = { legL, legR, armL, armR };

  return player;
}

// ============================================
// THE OLD AXE
// Now attached to the player's right hand!
// ============================================

function createAxe() {
  const axe = new THREE.Group();

  // HANDLE - long brown box
  const handleGeometry = new THREE.BoxGeometry(0.08, 0.7, 0.08);
  const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.position.y = 0.1;
  axe.add(handle);

  // BLADE - gray metal
  const bladeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.05);
  const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.position.set(0.12, 0.45, 0);
  axe.add(blade);

  // Rust spot
  const rustGeometry = new THREE.BoxGeometry(0.1, 0.12, 0.06);
  const rustMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const rust = new THREE.Mesh(rustGeometry, rustMaterial);
  rust.position.set(0.14, 0.4, 0);
  axe.add(rust);

  // Position on the player's right hand
  axe.position.set(0.46, 1.0, -0.2);
  axe.rotation.z = -0.3;

  return axe;
}

// --- SWING THE AXE ---
function swingAxe() {
  if (!playerState.alive) return;
  if (playerState.selectedSlot !== 1) return; // Only swing if axe is selected!
  if (playerState.swingCooldown > 0) return;
  if (playerState.isSwinging) return;

  playerState.isSwinging = true;
  playerState.swingTimer = 0.3;
  playerState.swingCooldown = AXE_COOLDOWN;

  checkAxeHit();
}

// --- CHECK IF AXE HITS AN ENEMY OR A TREE ---
function checkAxeHit() {
  // The player faces the direction of playerState.yaw
  const lookDir = new THREE.Vector3(
    -Math.sin(playerState.yaw),
    0,
    -Math.cos(playerState.yaw)
  );

  // Check enemies first
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    const dx = enemy.mesh.position.x - playerState.position.x;
    const dz = enemy.mesh.position.z - playerState.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > AXE_RANGE) continue;

    const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
    const dot = lookDir.dot(toEnemy);
    if (dot < 0.3) continue;

    damageEnemy(enemy, AXE_DAMAGE);
  }

  // Check if we hit a tree to chop it for WOOD!
  checkTreeChop(lookDir);
}

// --- CHOP TREES FOR WOOD! ---
// Swing your axe at a tree to get wood for the campfire
function checkTreeChop(lookDir) {
  if (!trees) return;

  for (let i = trees.length - 1; i >= 0; i--) {
    const tree = trees[i];
    const dx = tree.position.x - playerState.position.x;
    const dz = tree.position.z - playerState.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > AXE_RANGE + 1) continue; // Trees are a bit bigger so give extra range

    const toTree = new THREE.Vector3(dx, 0, dz).normalize();
    const dot = lookDir.dot(toTree);
    if (dot < 0.3) continue;

    // HIT A TREE! Drop wood on the ground!
    spawnWoodDrop(tree.position.clone());

    // Remove the tree from the scene (it's been chopped down!)
    if (tree.parent) tree.parent.remove(tree);
    trees.splice(i, 1);

    return; // Only chop one tree per swing
  }
}

// --- ANIMATE THE AXE SWING (on the player model) ---
function updateAxeSwing(axe, delta) {
  if (playerState.swingCooldown > 0) {
    playerState.swingCooldown -= delta;
  }

  if (playerState.isSwinging) {
    playerState.swingTimer -= delta;

    const progress = playerState.swingTimer / 0.3;
    const swingAngle = Math.sin((1 - progress) * Math.PI) * 1.5;

    // Swing the axe AND the right arm together
    axe.rotation.x = -swingAngle;
    if (playerState.mesh && playerState.mesh.userData.armR) {
      playerState.mesh.userData.armR.rotation.x = -swingAngle;
    }

    if (playerState.swingTimer <= 0) {
      playerState.isSwinging = false;
      axe.rotation.x = 0;
      if (playerState.mesh && playerState.mesh.userData.armR) {
        playerState.mesh.userData.armR.rotation.x = 0;
      }
    }
  }
}

// ============================================
// KEYBOARD & MOUSE CONTROLS
// ============================================

function setupKeyboardControls() {
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyW': playerState.moveForward = true; break;
      case 'KeyS': playerState.moveBackward = true; break;
      case 'KeyA': playerState.moveLeft = true; break;
      case 'KeyD': playerState.moveRight = true; break;
      // Number keys 1-5 switch hotbar slots
      case 'Digit1': selectHotbarSlot(1); break;
      case 'Digit2': selectHotbarSlot(2); break;
      case 'Digit3': selectHotbarSlot(3); break;
      case 'Digit4': selectHotbarSlot(4); break;
      case 'Digit5': selectHotbarSlot(5); break;
      case 'KeyE': checkChestOpen(); checkKidRescue(); break;  // E = open chest or rescue kid!
      case 'KeyF': tryUpgradeCampfire(); break; // F = upgrade campfire!
      case 'KeyT': tradeWithTrader(); break;  // T = trade with trader!
      case 'KeyC': toggleCraftingMenu(); break; // C = open crafting table!
      case 'KeyG': checkPetFeed(); break; // G = feed nearby animal to tame!
    }
  });

  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'KeyW': playerState.moveForward = false; break;
      case 'KeyS': playerState.moveBackward = false; break;
      case 'KeyA': playerState.moveLeft = false; break;
      case 'KeyD': playerState.moveRight = false; break;
    }
  });
}

// --- HOTBAR SLOT SELECTION ---
// Press 1-5 to switch between items
function selectHotbarSlot(num) {
  playerState.selectedSlot = num;

  // Update the UI - remove 'selected' from all slots, add to the chosen one
  document.querySelectorAll('.hotbar-slot').forEach(slot => {
    slot.classList.remove('selected');
  });
  const slotEl = document.getElementById('slot-' + num);
  if (slotEl) slotEl.classList.add('selected');

  // Show/hide the sack popup when slot 2 (sack) is selected
  const sackPopup = document.getElementById('sack-popup');
  if (num === 2) {
    sackPopup.style.display = 'block';
  } else {
    sackPopup.style.display = 'none';
  }

  // Show/hide axe on the player based on selection
  if (axe) {
    axe.visible = (num === 1);
  }

  // If selecting an equipment slot, check what's there
  const equip = playerState.equipment[num];
  if (equip && (equip.type === 'weapon' || equip.type === 'utility')) {
    // Show this item's mesh if it has one
    if (equip.weaponMesh) equip.weaponMesh.visible = true;
    if (axe) axe.visible = false;
  }
  // Hide other weapon/utility meshes and turn off flashlights when not selected
  for (const [slot, item] of Object.entries(playerState.equipment)) {
    if (parseInt(slot) !== num && item.weaponMesh) {
      item.weaponMesh.visible = false;
      // Turn off any flashlight when switching away
      if ((item.id === 'strongFlashlight' || item.id === 'oldFlashlight') && item.weaponMesh.userData.spotlight) {
        item.weaponMesh.userData.spotlight.intensity = 0;
      }
    }
  }
  // Turn ON flashlight when selected (strong = bright, old = dim)
  if (equip && equip.id === 'strongFlashlight' && equip.weaponMesh && equip.weaponMesh.userData.spotlight) {
    equip.weaponMesh.userData.spotlight.intensity = 2;
  }
  if (equip && equip.id === 'oldFlashlight' && equip.weaponMesh && equip.weaponMesh.userData.spotlight) {
    equip.weaponMesh.userData.spotlight.intensity = 1.2;
  }
}

function setupMouseLook(camera) {
  const gameUI = document.getElementById('game-ui');

  // Start playing right away! No pointer lock needed.
  playerState.isPlaying = true;
  gameUI.style.display = 'block';

  // Track mouse position for camera orbit (no pointer lock!)
  let lastMouseX = null;
  let lastMouseY = null;
  let isRightMouseDown = false;

  // RIGHT CLICK + DRAG = orbit camera around the player
  document.addEventListener('mousedown', (event) => {
    if (!playerState.isPlaying) return;
    if (event.button === 2) {
      // Right click - start orbiting
      isRightMouseDown = true;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      event.preventDefault();
    }
    if (event.button === 0) {
      // LEFT CLICK = attack with current weapon!
      if (playerState.selectedSlot === 1) {
        swingAxe(); // Slot 1 = old axe
      } else if (playerState.equipment[playerState.selectedSlot]) {
        const equip = playerState.equipment[playerState.selectedSlot];
        if (equip.type === 'weapon') {
          useEquippedWeapon(); // Weapons attack enemies
        } else if (equip.id === 'infernalSack') {
          useInfernalSack(); // Cook and eat meat to heal!
        }
      }
    }
  });

  document.addEventListener('mouseup', (event) => {
    if (event.button === 2) {
      isRightMouseDown = false;
      lastMouseX = null;
      lastMouseY = null;
    }
  });

  // Mouse moves the camera AROUND the player when right-click is held
  document.addEventListener('mousemove', (event) => {
    if (!playerState.isPlaying) return;
    if (!isRightMouseDown) return;

    if (lastMouseX !== null) {
      const dx = event.clientX - lastMouseX;
      const dy = event.clientY - lastMouseY;
      playerState.yaw -= dx * MOUSE_SENSITIVITY;
      playerState.pitch += dy * MOUSE_SENSITIVITY * 0.5;
      // Clamp pitch so camera doesn't go underground or straight up
      playerState.pitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, playerState.pitch));
    }
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  });

  // Disable the right-click menu so right-drag works for camera
  document.addEventListener('contextmenu', (event) => {
    if (playerState.isPlaying) event.preventDefault();
  });
}

// ============================================
// MOBILE TOUCH CONTROLS
// Virtual joystick + touch look + buttons!
// ============================================

// Detect if we're on a touch device (phone/tablet)
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function setupMobileControls() {
  if (!isMobile) return; // Only on phones/tablets!

  const mobileUI = document.getElementById('mobile-controls');
  if (!mobileUI) return;
  mobileUI.style.display = 'block';

  // --- VIRTUAL JOYSTICK ---
  const joystickZone = document.getElementById('joystick-zone');
  const joystickBase = document.getElementById('joystick-base');
  const joystickStick = document.getElementById('joystick-stick');
  let joystickTouchId = null;
  const joyCenter = { x: 60, y: 60 }; // Center of the joystick base
  const joyMaxDist = 35; // How far the stick can move

  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
  }, { passive: false });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joystickTouchId) continue;
      const rect = joystickBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > joyMaxDist) {
        dx = (dx / dist) * joyMaxDist;
        dy = (dy / dist) * joyMaxDist;
      }
      // Move the stick visually
      joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
      // Set movement direction (normalize to -1 to 1)
      const nx = dx / joyMaxDist;
      const ny = dy / joyMaxDist;
      // Forward/back is up/down, left/right is left/right
      playerState.moveForward = ny < -0.3;
      playerState.moveBackward = ny > 0.3;
      playerState.moveLeft = nx < -0.3;
      playerState.moveRight = nx > 0.3;
    }
  }, { passive: false });

  const resetJoystick = (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joystickTouchId) continue;
      joystickTouchId = null;
      joystickStick.style.transform = 'translate(0, 0)';
      playerState.moveForward = false;
      playerState.moveBackward = false;
      playerState.moveLeft = false;
      playerState.moveRight = false;
    }
  };
  joystickZone.addEventListener('touchend', resetJoystick, { passive: false });
  joystickZone.addEventListener('touchcancel', resetJoystick, { passive: false });

  // --- LOOK ZONE (right side of screen) ---
  const lookZone = document.getElementById('look-zone');
  let lookTouchId = null;
  let lookLastX = 0;
  let lookLastY = 0;

  lookZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    lookTouchId = touch.identifier;
    lookLastX = touch.clientX;
    lookLastY = touch.clientY;
  }, { passive: false });

  lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier !== lookTouchId) continue;
      const dx = touch.clientX - lookLastX;
      const dy = touch.clientY - lookLastY;
      playerState.yaw -= dx * MOUSE_SENSITIVITY * 2;
      playerState.pitch += dy * MOUSE_SENSITIVITY;
      playerState.pitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, playerState.pitch));
      lookLastX = touch.clientX;
      lookLastY = touch.clientY;
    }
  }, { passive: false });

  lookZone.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === lookTouchId) lookTouchId = null;
    }
  }, { passive: false });

  // --- BUTTONS ---
  // Attack button
  const atkBtn = document.getElementById('mobile-attack-btn');
  atkBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (playerState.selectedSlot === 1) {
      swingAxe();
    } else if (playerState.equipment[playerState.selectedSlot]) {
      const equip = playerState.equipment[playerState.selectedSlot];
      if (equip.type === 'weapon') useEquippedWeapon();
      else if (equip.id === 'infernalSack') useInfernalSack();
    }
  }, { passive: false });

  // Action button (E - open chests, rescue kids)
  const actionBtn = document.getElementById('mobile-action-btn');
  actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    checkChestOpen();
    checkKidRescue();
  }, { passive: false });

  // Fire upgrade button (F)
  const fireBtn = document.getElementById('mobile-fire-btn');
  fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    tryUpgradeCampfire();
  }, { passive: false });

  // Trade button (T)
  const tradeBtn = document.getElementById('mobile-trade-btn');
  tradeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    tradeWithTrader();
  }, { passive: false });

  // Craft button (C)
  const craftBtn = document.getElementById('mobile-craft-btn');
  if (craftBtn) {
    craftBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      toggleCraftingMenu();
    }, { passive: false });
  }

  // Hotbar slot buttons (1-5)
  document.querySelectorAll('.mobile-slot-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const slot = parseInt(btn.dataset.slot);
      selectHotbarSlot(slot);
    }, { passive: false });
  });
}

// ============================================
// PLAYER MOVEMENT (Third Person!)
// The character moves, camera follows behind
// ============================================

function updatePlayer(camera, delta, trees) {
  if (!playerState.isPlaying) return;

  // If dead, count down respawn timer
  if (!playerState.alive) {
    playerState.respawnTimer -= delta;
    if (playerState.respawnTimer <= 0) {
      respawnPlayer();
    }
    return;
  }

  // --- MOVE THE CHARACTER ---
  // Forward is based on camera yaw (the direction you're looking)
  const direction = new THREE.Vector3();
  const forward = new THREE.Vector3(
    -Math.sin(playerState.yaw), 0, -Math.cos(playerState.yaw)
  );
  const right = new THREE.Vector3(
    Math.cos(playerState.yaw), 0, -Math.sin(playerState.yaw)
  );

  if (playerState.moveForward) direction.add(forward);
  if (playerState.moveBackward) direction.sub(forward);
  if (playerState.moveLeft) direction.sub(right);
  if (playerState.moveRight) direction.add(right);

  playerState.isMoving = direction.length() > 0;
  if (playerState.isMoving) direction.normalize();

  const newX = playerState.position.x + direction.x * PLAYER_SPEED * delta;
  const newZ = playerState.position.z + direction.z * PLAYER_SPEED * delta;

  // Tree collision
  let blocked = false;
  if (trees) {
    for (const tree of trees) {
      const dx = newX - tree.position.x;
      const dz = newZ - tree.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.5) {
        blocked = true;
        break;
      }
    }
  }

  if (!blocked) {
    // Clamp player to the fog wall (map radius) - not the full map!
    const mapLimit = campfireState.mapRadius - 2; // Can't go past the fog wall
    const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
    if (distFromCenter > mapLimit) {
      // Push back toward center
      const angle = Math.atan2(newX, newZ);
      playerState.position.x = Math.sin(angle) * mapLimit;
      playerState.position.z = Math.cos(angle) * mapLimit;
    } else {
      playerState.position.x = newX;
      playerState.position.z = newZ;
    }
  }

  // --- UPDATE CHARACTER MESH ---
  if (playerState.mesh) {
    playerState.mesh.position.x = playerState.position.x;
    playerState.mesh.position.z = playerState.position.z;
    playerState.mesh.position.y = 0;

    // Rotate character to face movement direction
    if (playerState.isMoving) {
      // Smoothly turn toward the movement direction
      const targetYaw = Math.atan2(-direction.x, -direction.z);
      let diff = targetYaw - playerState.mesh.rotation.y;
      // Handle wrapping around (-PI to PI)
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      playerState.mesh.rotation.y += diff * 0.15; // Smooth turning
    }

    // --- WALK ANIMATION ---
    if (playerState.isMoving) {
      playerState.animTime += delta * 8;
      const { legL, legR, armL } = playerState.mesh.userData;
      if (legL && legR) {
        legL.rotation.x = Math.sin(playerState.animTime) * 0.5;
        legR.rotation.x = Math.sin(playerState.animTime + Math.PI) * 0.5;
      }
      // Left arm swings opposite to right leg (natural walk)
      if (armL && !playerState.isSwinging) {
        armL.rotation.x = Math.sin(playerState.animTime + Math.PI) * 0.4;
      }
    } else {
      // Standing still - reset limbs
      const { legL, legR, armL } = playerState.mesh.userData;
      if (legL) legL.rotation.x = 0;
      if (legR) legR.rotation.x = 0;
      if (armL && !playerState.isSwinging) armL.rotation.x = 0;
    }
  }

  // --- SAFE ZONE HEALING ---
  // If you're inside the camp, slowly heal up!
  if (isInSafeZone(playerState.position.x, playerState.position.z)) {
    if (playerState.health < playerState.maxHealth) {
      playerState.health = Math.min(
        playerState.maxHealth,
        playerState.health + HEAL_RATE * delta
      );
      // Show healing indicator
      const safeText = document.getElementById('safe-zone-text');
      if (safeText) safeText.style.display = 'block';
    }
  } else {
    const safeText = document.getElementById('safe-zone-text');
    if (safeText) safeText.style.display = 'none';
  }

  // --- POSITION CAMERA BEHIND THE PLAYER ---
  // The camera orbits around the player based on yaw and pitch
  const camX = playerState.position.x + Math.sin(playerState.yaw) * CAM_DISTANCE * Math.cos(playerState.pitch);
  const camZ = playerState.position.z + Math.cos(playerState.yaw) * CAM_DISTANCE * Math.cos(playerState.pitch);
  const camY = CAM_HEIGHT + Math.sin(playerState.pitch) * CAM_DISTANCE;

  camera.position.set(camX, camY, camZ);
  // Look at the player (slightly above their feet, at chest level)
  camera.lookAt(playerState.position.x, 1.5, playerState.position.z);
}

// ============================================
// DAMAGE & DEATH
// ============================================

function damagePlayer(amount) {
  if (!playerState.alive) return;
  // Armor reduces damage!
  const reduced = Math.floor(amount * (1 - playerState.damageReduction));
  playerState.health -= reduced;

  const overlay = document.getElementById('damage-overlay');
  overlay.style.opacity = '0.4';
  setTimeout(() => { overlay.style.opacity = '0'; }, 200);

  if (playerState.health <= 0) {
    playerState.health = 0;
    killPlayer();
  }
}

function killPlayer() {
  playerState.alive = false;
  playerState.respawnTimer = 3;
  document.getElementById('death-screen').style.display = 'flex';
  // Tip the player mesh over
  if (playerState.mesh) {
    playerState.mesh.rotation.x = Math.PI / 2;
    playerState.mesh.position.y = 0.5;
  }
}

function respawnPlayer() {
  playerState.alive = true;
  playerState.health = playerState.maxHealth;
  playerState.position.set(0, 0, 0);
  playerState.yaw = 0;
  playerState.pitch = 0.5;
  // Stand back up
  if (playerState.mesh) {
    playerState.mesh.rotation.x = 0;
    playerState.mesh.position.y = 0;
  }
  document.getElementById('death-screen').style.display = 'none';
}

// ============================================
// HEALTH BAR & UI
// ============================================

function updateHealthBar() {
  const healthBar = document.getElementById('health-bar');
  const percent = (playerState.health / playerState.maxHealth) * 100;
  healthBar.style.width = percent + '%';

  if (percent > 50) {
    healthBar.style.background = '#ff4444';
  } else if (percent > 25) {
    healthBar.style.background = '#ff8844';
  } else {
    healthBar.style.background = '#ff2222';
  }
}

function updateInventoryUI() {
  const inv = playerState.inventory;
  document.getElementById('gem-count').textContent = inv.gems;
  document.getElementById('meat-count').textContent = inv.meat;
  document.getElementById('fang-count').textContent = inv.fangs;
  document.getElementById('bone-count').textContent = inv.bones;
  document.getElementById('wood-count').textContent = inv.wood;
  document.getElementById('coal-count').textContent = inv.coal;
  document.getElementById('fuel-count').textContent = inv.fuel;
  document.getElementById('canister-count').textContent = inv.fuelCanister;
  const scrapEl = document.getElementById('scrap-count');
  if (scrapEl) scrapEl.textContent = inv.scrap;
  document.getElementById('bunnyfoot-count').textContent = inv.bunnyFoot;
  document.getElementById('wolfpelt-count').textContent = inv.wolfPelt;
  document.getElementById('alphapelt-count').textContent = inv.alphaWolfPelt;
  document.getElementById('bearpelt-count').textContent = inv.bearPelt;
  // Update sack capacity display
  const totalItems = inv.gems + inv.meat + inv.fangs + inv.bones + inv.wood + inv.coal + inv.fuel + inv.fuelCanister + inv.scrap + inv.bunnyFoot + inv.wolfPelt + inv.alphaWolfPelt + inv.bearPelt;
  const usedEl = document.getElementById('sack-used');
  const maxEl = document.getElementById('sack-max');
  if (usedEl) usedEl.textContent = totalItems;
  if (maxEl) maxEl.textContent = playerState.sackCapacity;
}

// Check if sack has room for more items
function sackHasRoom(amount) {
  const inv = playerState.inventory;
  const totalItems = inv.gems + inv.meat + inv.fangs + inv.bones + inv.wood + inv.coal + inv.fuel + inv.fuelCanister + inv.scrap + inv.bunnyFoot + inv.wolfPelt + inv.alphaWolfPelt + inv.bearPelt;
  return (totalItems + amount) <= playerState.sackCapacity;
}

// ============================================
// EQUIPMENT SYSTEM
// Items from chests go into hotbar slots 3-5
// ============================================

// All the possible equipment items
const ITEMS = {
  rubyArmor: {
    name: 'Ruby Armor',
    type: 'armor',
    description: 'Blocks 40% of damage',
    damageReduction: 0.4,
    color: '#cc1144',
    iconClass: 'icon-armor'
  },
  tacticalShotgun: {
    name: 'Tactical Shotgun',
    type: 'weapon',
    description: 'Ranged weapon - high damage',
    damage: 45,
    range: 20,
    cooldown: 1.0,
    color: '#666',
    iconClass: 'icon-shotgun'
  },
  infernalHelmet: {
    name: 'Infernal Helmet',
    type: 'armor',
    description: 'Blocks 25% of damage + looks awesome',
    damageReduction: 0.25,
    color: '#ff4400',
    iconClass: 'icon-helmet'
  },
  kunai: {
    name: 'Kunai',
    type: 'weapon',
    description: 'Fast throwing knife',
    damage: 30,
    range: 15,
    cooldown: 0.3,
    color: '#aaa',
    iconClass: 'icon-kunai'
  },

  // ---- GOLD CHEST ITEMS ----
  strongAxe: {
    name: 'Strong Axe',
    type: 'weapon',
    description: 'A powerful axe - much better than the old one!',
    damage: 40,           // Way more than the old axe (25)
    range: 4.5,           // Slightly longer reach too
    cooldown: 0.4,        // Faster than old axe
    color: '#daa520',
    iconClass: 'icon-strongaxe'
  },
  infernalSack: {
    name: 'Infernal Sack',
    type: 'utility',      // Special! Cooks food AND upgrades storage!
    description: 'A magic sack that cooks meat! Click to eat cooked meat and heal. Holds 20 items!',
    healAmount: 30,       // Each cooked meat heals 30 HP!
    storage: 20,          // Also upgrades your sack to 20 storage!
    color: '#ff6600',
    iconClass: 'icon-infernalsack'
  },
  strongFlashlight: {
    name: 'Strong Flashlight',
    type: 'utility',      // Special! Creates a spotlight
    description: 'A bright flashlight - lights up the dark forest at night!',
    color: '#ffee88',
    iconClass: 'icon-flashlight'
  },
  katana: {
    name: 'Katana',
    type: 'weapon',
    description: 'A sharp katana sword - fast and deadly!',
    damage: 35,           // Good damage
    range: 5,             // Long reach (it\'s a sword!)
    cooldown: 0.35,       // Pretty fast
    color: '#ccccee',
    iconClass: 'icon-katana'
  },

  // ---- WOODEN CHEST ITEMS ----
  oldFlashlight: {
    name: 'Old Flashlight',
    type: 'utility',
    description: 'A dim flashlight - better than nothing in the dark!',
    color: '#bbaa66',
    iconClass: 'icon-flashlight-old'
  },
  giantSack: {
    name: 'Giant Sack',
    type: 'sack',         // Special sack type - upgrades your storage!
    description: 'A huge sack! Holds 25 items total.',
    storage: 25,          // Max items you can carry
    color: '#8B6914',
    iconClass: 'icon-giantsack'
  },
  goodSack: {
    name: 'Good Sack',
    type: 'sack',
    description: 'A nice sack! Holds 15 items total.',
    storage: 15,
    color: '#a0822a',
    iconClass: 'icon-goodsack'
  },
  goodAxe: {
    name: 'Good Axe',
    type: 'weapon',
    description: 'A solid axe - better than the old rusty one!',
    damage: 32,           // Better than old axe (25) but not as good as strong axe (40)
    range: 4,             // Slightly better range
    cooldown: 0.45,       // Slightly faster
    color: '#999',
    iconClass: 'icon-goodaxe'
  }
};

// Equip an item into the first empty hotbar slot (3-5)
function equipItem(itemId) {
  const item = ITEMS[itemId];
  if (!item) return false;

  // Find the first empty slot (3, 4, or 5)
  let targetSlot = null;
  for (let s = 3; s <= 5; s++) {
    if (!playerState.equipment[s]) {
      targetSlot = s;
      break;
    }
  }

  if (targetSlot === null) {
    showLootText('Inventory full!');
    return false;
  }

  // Create the item data
  const equipped = { ...item, id: itemId };

  // If it's a weapon, create a 3D model on the player
  if (item.type === 'weapon' && playerState.mesh) {
    const weaponMesh = createWeaponMesh(itemId);
    weaponMesh.visible = false; // Hidden until selected
    playerState.mesh.add(weaponMesh);
    equipped.weaponMesh = weaponMesh;
  }

  // If it's a utility item (flashlight, infernal sack), create its mesh too
  if (item.type === 'utility' && playerState.mesh) {
    const weaponMesh = createWeaponMesh(itemId);
    weaponMesh.visible = false;
    playerState.mesh.add(weaponMesh);
    equipped.weaponMesh = weaponMesh;
  }

  // If it's armor, apply the damage reduction
  if (item.type === 'armor') {
    playerState.damageReduction = Math.min(0.6, playerState.damageReduction + item.damageReduction);
  }

  // If it's the infernal sack, upgrade storage too (but keep it in equipment slot for cooking!)
  if (itemId === 'infernalSack' && item.storage) {
    playerState.sackCapacity = item.storage;
    playerState.sackName = item.name;
    const sackTitle = document.querySelector('.sack-title');
    if (sackTitle) sackTitle.textContent = item.name;
    const sackSlot = document.getElementById('slot-2');
    if (sackSlot) {
      const label = sackSlot.querySelector('.slot-label');
      if (label) label.textContent = item.name;
    }
    updateInventoryUI();
  }

  // If it's a sack upgrade, increase storage capacity!
  if (item.type === 'sack') {
    playerState.sackCapacity = item.storage;
    playerState.sackName = item.name;
    // Update the sack popup title
    const sackTitle = document.querySelector('.sack-title');
    if (sackTitle) sackTitle.textContent = item.name;
    // Update the sack label in hotbar slot 2
    const sackSlot = document.getElementById('slot-2');
    if (sackSlot) {
      const label = sackSlot.querySelector('.slot-label');
      if (label) label.textContent = item.name;
    }
    // Sacks don't take up equipment slots - they upgrade slot 2!
    // So free up the slot we just used
    delete playerState.equipment[targetSlot];
    // Re-mark the slot as empty in the UI
    const slotEl = document.getElementById('slot-' + targetSlot);
    if (slotEl) {
      slotEl.classList.add('empty');
      const lbl = slotEl.querySelector('.slot-label');
      if (lbl) lbl.textContent = 'Empty';
      const ico = slotEl.querySelector('.slot-icon');
      if (ico) ico.className = 'slot-icon';
    }
    showLootText(item.name + '! Storage: ' + item.storage);
    return true;
  }

  playerState.equipment[targetSlot] = equipped;

  // Update the hotbar UI to show the item
  updateHotbarSlot(targetSlot, item);

  return true;
}

// Create 3D weapon meshes for the player to hold
function createWeaponMesh(itemId) {
  const weapon = new THREE.Group();

  if (itemId === 'tacticalShotgun') {
    // SHOTGUN - barrel + stock
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), barrelMat);
    barrel.position.set(0, 0.1, -0.4);
    weapon.add(barrel);
    // Stock
    const stockMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.4), stockMat);
    stock.position.set(0, 0.05, 0.3);
    weapon.add(stock);
    // Pump
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.25), barrelMat);
    pump.position.set(0, -0.02, -0.15);
    weapon.add(pump);
  } else if (itemId === 'kunai') {
    // KUNAI - blade + handle + ring
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 4), bladeMat);
    blade.position.set(0, 0.35, -0.15);
    blade.rotation.x = -Math.PI / 2;
    weapon.add(blade);
    // Handle
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), handleMat);
    handle.position.set(0, 0.1, -0.15);
    weapon.add(handle);
    // Ring at end
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 8), handleMat);
    ring.position.set(0, -0.02, -0.15);
    weapon.add(ring);

  } else if (itemId === 'strongAxe') {
    // STRONG AXE - bigger, shinier, golden!
    // Handle (thicker than old axe)
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), handleMat);
    handle.position.y = 0.1;
    weapon.add(handle);
    // Big golden blade
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xdaa520 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.06), bladeMat);
    blade.position.set(0.17, 0.5, 0);
    weapon.add(blade);
    // Shiny edge on the blade
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.07), edgeMat);
    edge.position.set(0.38, 0.5, 0);
    weapon.add(edge);

  } else if (itemId === 'katana') {
    // KATANA - long curved sword!
    // Long blade (slightly tilted for the curve look)
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xccccdd });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.03), bladeMat);
    blade.position.set(0, 0.55, -0.15);
    weapon.add(blade);
    // Sharp edge (white shine on one side)
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.1, 0.035), edgeMat);
    edge.position.set(0.035, 0.55, -0.15);
    weapon.add(edge);
    // Guard (the tsuba - cross piece)
    const guardMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.12), guardMat);
    guard.position.set(0, 0.02, -0.15);
    weapon.add(guard);
    // Handle wrap (dark red)
    const wrapMat = new THREE.MeshLambertMaterial({ color: 0x661122 });
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.05), wrapMat);
    wrap.position.set(0, -0.15, -0.15);
    weapon.add(wrap);

  } else if (itemId === 'strongFlashlight') {
    // STRONG FLASHLIGHT - cylinder body + lens + BRIGHT spotlight
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 8), bodyMat);
    body.position.set(0, 0.15, -0.15);
    weapon.add(body);
    // Lens (bright yellow front)
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), lensMat);
    lens.position.set(0, 0.37, -0.15);
    weapon.add(lens);
    // Spotlight! This is the actual light it shines (BRIGHT!)
    const spotlight = new THREE.SpotLight(0xffee88, 2, 40, Math.PI / 6, 0.3);
    spotlight.position.set(0, 0.4, -0.15);
    spotlight.target.position.set(0, 0.2, -5);
    weapon.add(spotlight);
    weapon.add(spotlight.target);
    weapon.userData.spotlight = spotlight;

  } else if (itemId === 'oldFlashlight') {
    // OLD FLASHLIGHT - smaller, dimmer, a bit rusty
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x555544 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.3, 8), bodyMat);
    body.position.set(0, 0.15, -0.15);
    weapon.add(body);
    // Dim lens
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xbbaa66 });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), lensMat);
    lens.position.set(0, 0.32, -0.15);
    weapon.add(lens);
    // Dimmer spotlight (less range, less bright)
    const spotlight = new THREE.SpotLight(0xbbaa66, 1.2, 20, Math.PI / 7, 0.4);
    spotlight.position.set(0, 0.35, -0.15);
    spotlight.target.position.set(0, 0.2, -5);
    weapon.add(spotlight);
    weapon.add(spotlight.target);
    weapon.userData.spotlight = spotlight;

  } else if (itemId === 'goodAxe') {
    // GOOD AXE - nicer than old axe, silver blade
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), handleMat);
    handle.position.y = 0.1;
    weapon.add(handle);
    // Silver blade (shinier than old axe)
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.05), bladeMat);
    blade.position.set(0.14, 0.47, 0);
    weapon.add(blade);
  }

  // Position in the player's right hand
  weapon.position.set(0.46, 1.0, -0.2);

  return weapon;
}

// Update a hotbar slot's appearance when an item is equipped
function updateHotbarSlot(slotNum, item) {
  const slotEl = document.getElementById('slot-' + slotNum);
  if (!slotEl) return;

  slotEl.classList.remove('empty');
  // Update label
  const label = slotEl.querySelector('.slot-label');
  if (label) label.textContent = item.name;

  // Add icon
  let iconEl = slotEl.querySelector('.slot-icon');
  if (!iconEl) {
    iconEl = document.createElement('div');
    iconEl.className = 'slot-icon';
    slotEl.appendChild(iconEl);
  }
  iconEl.className = 'slot-icon ' + item.iconClass;
  iconEl.innerHTML = '';

  // Add colored indicator
  iconEl.style.color = item.color;
}

// Use the equipped weapon (called on click if slot 3-5 selected)
function useEquippedWeapon() {
  const slot = playerState.selectedSlot;
  const equip = playerState.equipment[slot];
  if (!equip || equip.type !== 'weapon') return;
  if (playerState.swingCooldown > 0) return;
  if (!playerState.alive) return;

  playerState.isSwinging = true;
  playerState.swingTimer = 0.2;
  playerState.swingCooldown = equip.cooldown;

  // Check for hits (like axe but with different range/damage)
  const lookDir = new THREE.Vector3(
    -Math.sin(playerState.yaw), 0, -Math.cos(playerState.yaw)
  );

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const dx = enemy.mesh.position.x - playerState.position.x;
    const dz = enemy.mesh.position.z - playerState.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > equip.range) continue;

    const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
    const dot = lookDir.dot(toEnemy);
    if (dot < 0.5) continue; // Tighter aim needed for ranged

    damageEnemy(enemy, equip.damage);

    // Shotgun hits multiple enemies, kunai only hits one
    if (equip.id === 'kunai') break;
  }

  // Animate right arm
  if (playerState.mesh && playerState.mesh.userData.armR) {
    playerState.mesh.userData.armR.rotation.x = -1.5;
    setTimeout(() => {
      if (playerState.mesh && playerState.mesh.userData.armR) {
        playerState.mesh.userData.armR.rotation.x = 0;
      }
    }, 200);
  }
}

// ============================================
// INFERNAL SACK - Cook meat to heal!
// Click to cook 1 meat and heal 30 HP
// ============================================

let infernalSackCooldown = 0; // So you can't spam-click

function useInfernalSack() {
  if (!playerState.alive) return;
  if (infernalSackCooldown > 0) return;

  // Need meat to cook!
  if (playerState.inventory.meat <= 0) {
    showLootText('No meat to cook!');
    return;
  }

  // Cook 1 meat
  playerState.inventory.meat -= 1;
  infernalSackCooldown = 1.0; // 1 second cooldown between cooking

  // Heal the player!
  const healAmt = ITEMS.infernalSack.healAmount; // 30 HP
  playerState.health = Math.min(playerState.maxHealth, playerState.health + healAmt);

  // Update the UI
  updateInventoryUI();
  showLootText('Cooked meat! +' + healAmt + ' HP');

  // Animate right arm (eating motion)
  if (playerState.mesh && playerState.mesh.userData.armR) {
    playerState.mesh.userData.armR.rotation.x = -0.8;
    setTimeout(() => {
      if (playerState.mesh && playerState.mesh.userData.armR) {
        playerState.mesh.userData.armR.rotation.x = 0;
      }
    }, 400);
  }
}

// Update infernal sack cooldown (called from game loop)
function updateInfernalSackCooldown(delta) {
  if (infernalSackCooldown > 0) {
    infernalSackCooldown -= delta;
  }
}

// ============================================
// WOOD DROPS - Physical wood on the ground!
// Chop a tree -> wood drops -> walk over to pick up
// ============================================

const droppedWood = [];
const WOOD_PICKUP_RANGE = 2.5;

function spawnWoodDrop(position) {
  const wood = new THREE.Group();

  // Log shape (brown cylinder lying on its side)
  const logMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), logMat);
  log.rotation.z = Math.PI / 2; // Lay on side
  log.position.y = 0.12;
  wood.add(log);

  // Second smaller log crossed on top
  const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), logMat);
  log2.rotation.x = Math.PI / 2;
  log2.position.y = 0.25;
  wood.add(log2);

  // Gentle glow so you can spot it
  const glow = new THREE.PointLight(0x88cc44, 0.4, 5);
  glow.position.y = 0.5;
  wood.add(glow);

  wood.position.set(position.x, 0, position.z);
  scene.add(wood);

  droppedWood.push({
    mesh: wood,
    glow: glow,
    position: wood.position
  });

  showLootText('Wood dropped!');
}

// Called every frame from the game loop
function updateWoodDrops(playerPos) {
  for (let i = droppedWood.length - 1; i >= 0; i--) {
    const w = droppedWood[i];

    // Pulse the glow
    if (w.glow) {
      w.glow.intensity = 0.3 + Math.sin(totalTime * 3 + i * 0.7) * 0.2;
    }

    // Auto-pickup if player is close and holding sack
    const dist = playerPos.distanceTo(w.position);
    if (dist < WOOD_PICKUP_RANGE && playerState.selectedSlot === 2) {
      if (sackHasRoom(1)) {
        playerState.inventory.wood += 1;
        updateInventoryUI();
        showLootText('+1 wood!');

        // Remove from scene
        scene.remove(w.mesh);
        droppedWood.splice(i, 1);
      }
    }
  }
}

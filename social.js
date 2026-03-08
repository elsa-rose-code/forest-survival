// ============================================
// SOCIAL.JS - Multiplayer social features!
// 9 features that make playing with friends
// more fun and expressive.
//
// Features implemented:
//   #1  - Friendship Bracelets
//   #2  - Campfire Singalong
//   #3  - SOS Flare
//   #4  - Co-op Compass
//   #5  - Camp Bulletin Board
//   #9  - Photo Mode
//   #10 - Player Emotes
//   #12 - Camp Decorator
//   #33 - Glowing Trails
//
// All features integrate with globals from:
//   game.js       -> scene, camera, renderer, totalTime
//   player.js     -> playerState
//   multiplayer.js -> mpState, socket
//   world.js      -> dayNightState, campfireState, SAFE_ZONE_RADIUS
// ============================================


// --- SOCIAL STATE ---
const socialState = {
  // Friendship bracelets
  braceletTimers: {},   // { playerId: seconds near them }
  bracelets: {},        // { playerId: true } when forged
  damageBoost: 0,       // Bonus damage from bracelets (0.1 = 10%)
  braceletMeshes: [],   // Torus meshes on wrist

  // Campfire singalong
  singalongActive: false,

  // SOS flares
  flares: [],           // Active flare objects { mesh, light, timer, color, startPos }
  flareCooldown: 0,     // Cooldown before next flare

  // Bulletin board
  messages: [],         // { text, author, time }
  boardMesh: null,      // 3D bulletin board mesh

  // Photo mode
  photoMode: false,
  photos: [],           // Saved photo data URLs
  photoCamera: null,    // Detached camera state for photo mode

  // Player emotes
  currentEmote: null,   // 'wave' | 'celebrate' | 'dance' | 'huddle'
  emoteTimer: 0,        // Time remaining on current emote

  // Camp decorations
  decorations: [],      // { type, mesh } placed items

  // Glowing trails
  footprints: [],       // { mesh, age, baseOpacity }
  footprintTimer: 0     // Timer for spawning footprints
};


// ============================================
// FEATURE #1 - FRIENDSHIP BRACELETS
// Spend 30 seconds near a teammate to forge
// a bond and gain a 10% damage bonus.
// ============================================

const BRACELET_FORGE_TIME = 30;  // Seconds of proximity to forge
const BRACELET_RANGE = 5;        // How close you need to be

// Sets up the bracelet mesh group on the player's left arm
function initBracelets() {
  if (!playerState.mesh || !playerState.mesh.userData.armL) return;

  // Bracelet anchor point at the wrist of the left arm
  const braceletGroup = new THREE.Group();
  braceletGroup.position.set(0, -0.3, 0); // Bottom of the arm = wrist
  playerState.mesh.userData.armL.add(braceletGroup);
  playerState.mesh.userData.braceletGroup = braceletGroup;
}

// Called every frame from the game loop
function updateFriendshipBracelets(delta) {
  if (!playerState.mesh) return;

  let hasBond = false;

  for (const [id, other] of Object.entries(mpState.otherPlayers)) {
    if (!other.mesh) continue;

    // Already bonded - just track that a bond exists
    if (socialState.bracelets[id]) {
      hasBond = true;
      continue;
    }

    // Measure horizontal distance between local player and this teammate
    const dx = playerState.position.x - other.mesh.position.x;
    const dz = playerState.position.z - other.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < BRACELET_RANGE) {
      // Accumulate proximity time
      socialState.braceletTimers[id] = (socialState.braceletTimers[id] || 0) + delta;

      if (socialState.braceletTimers[id] >= BRACELET_FORGE_TIME) {
        // --- FORGE THE BOND ---
        socialState.bracelets[id] = true;
        hasBond = true;

        // Attach a bracelet torus to our left wrist
        _attachBracelet(other.color || '#44aaff');

        showLootText('Friendship bracelet forged with ' + (other.name || 'teammate') + '!');
      }
    } else {
      // Reset timer when out of range (must be continuous)
      socialState.braceletTimers[id] = 0;
    }
  }

  // Set damage boost: 10% if any bond exists
  socialState.damageBoost = hasBond ? 0.1 : 0;
}

// Attaches a small torus bracelet to the local player's left wrist
function _attachBracelet(colorStr) {
  if (!playerState.mesh) return;

  const colorHex = _colorToHex(colorStr);
  const geo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
  const mat = new THREE.MeshLambertMaterial({ color: colorHex });
  const bracelet = new THREE.Mesh(geo, mat);
  bracelet.rotation.x = Math.PI / 2;

  // Stack bracelets vertically if multiple bonds
  bracelet.position.y = socialState.braceletMeshes.length * 0.06;

  const braceletGroup = playerState.mesh.userData.braceletGroup;
  if (braceletGroup) {
    braceletGroup.add(bracelet);
  } else {
    // Fallback: add directly to the left arm
    const armL = playerState.mesh.userData.armL;
    if (armL) {
      bracelet.position.set(0, -0.2 + socialState.braceletMeshes.length * 0.06, 0);
      armL.add(bracelet);
    }
  }

  socialState.braceletMeshes.push(bracelet);
}

// Convert a CSS hex string like '#44aaff' to a THREE-compatible integer
function _colorToHex(colorStr) {
  return parseInt(colorStr.replace('#', ''), 16);
}


// ============================================
// FEATURE #2 - CAMPFIRE SINGALONG
// If ALL players are in the safe zone at night,
// the campfire burns brighter together.
// ============================================

// Cached reference to the campfire's PointLight so we can tweak intensity
let _singalongFireLight = null;
let _singalongBaseIntensity = 1.5; // Match world.js fireLight intensity

// Call this once after the scene is created to grab the fire light reference
function _initSingalong() {
  if (!campfire || !campfire.userData) return;
  _singalongFireLight = campfire.userData.fireLight || null;
  if (_singalongFireLight) {
    _singalongBaseIntensity = _singalongFireLight.intensity;
  }
}

function updateCampfireSingalong() {
  if (!dayNightState.isNight) {
    // Daytime - deactivate if running
    if (socialState.singalongActive) _deactivateSingalong();
    return;
  }

  // Check local player is in safe zone
  if (!isInSafeZone(playerState.position.x, playerState.position.z)) {
    if (socialState.singalongActive) _deactivateSingalong();
    return;
  }

  // Check all remote players are in safe zone too
  for (const other of Object.values(mpState.otherPlayers)) {
    if (!other.mesh) continue;
    if (!isInSafeZone(other.mesh.position.x, other.mesh.position.z)) {
      if (socialState.singalongActive) _deactivateSingalong();
      return;
    }
  }

  // Everyone is in camp at night!
  if (!socialState.singalongActive) _activateSingalong();
}

function _activateSingalong() {
  socialState.singalongActive = true;

  // Boost campfire light by 50%
  if (_singalongFireLight) {
    _singalongFireLight.intensity = _singalongBaseIntensity * 1.5;
  }

  // Show UI elements
  const text = document.getElementById('singalong-text');
  const overlay = document.getElementById('singalong-overlay');
  if (text) text.style.display = 'block';
  if (overlay) overlay.style.display = 'block';
}

function _deactivateSingalong() {
  socialState.singalongActive = false;

  // Restore campfire light
  if (_singalongFireLight) {
    _singalongFireLight.intensity = _singalongBaseIntensity;
  }

  const text = document.getElementById('singalong-text');
  const overlay = document.getElementById('singalong-overlay');
  if (text) text.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
}


// ============================================
// FEATURE #3 - SOS FLARE
// Press Q to launch a glowing flare into the
// sky. Costs 1 coal + 1 fuel. Other players
// can see it via socket events.
// ============================================

const FLARE_RISE_DURATION = 2;    // Seconds to fly upward
const FLARE_HANG_DURATION = 10;   // Seconds hanging in the sky
const FLARE_TOTAL_DURATION = 12;  // Total lifetime
const FLARE_COOLDOWN_TIME = 15;   // Seconds between flares

// Called when Q key is pressed
function launchFlare() {
  if (!playerState.alive) return;

  if (socialState.flareCooldown > 0) {
    showLootText('Flare on cooldown!');
    return;
  }

  // Check inventory cost: 1 coal + 1 fuel
  if (playerState.inventory.coal < 1 || playerState.inventory.fuel < 1) {
    showLootText('Need 1 coal + 1 fuel for flare!');
    return;
  }

  // Deduct resources
  playerState.inventory.coal -= 1;
  playerState.inventory.fuel -= 1;
  updateInventoryUI();

  // Player's multiplayer color (default blue for solo)
  const color = mpState.playerColor || '#44aaff';

  // Create the flare locally
  _spawnFlare(playerState.position.x, playerState.position.z, color);

  // Start cooldown
  socialState.flareCooldown = FLARE_COOLDOWN_TIME;

  showLootText('Flare launched!');

  // Tell other players
  if (typeof socket !== 'undefined') {
    socket.emit('flareLaunched', {
      x: playerState.position.x,
      z: playerState.position.z,
      color: color
    });
  }
}

// Creates a flare mesh + point light and adds it to socialState.flares
function _spawnFlare(x, z, colorStr) {
  const colorHex = _colorToHex(colorStr);

  // Small bright sphere
  const geo = new THREE.SphereGeometry(0.3, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 2, z);

  // Attached point light - intensity 3, range 50
  const light = new THREE.PointLight(colorHex, 3, 50);
  mesh.add(light);

  scene.add(mesh);

  socialState.flares.push({
    mesh: mesh,
    light: light,
    timer: 0,
    color: colorStr,
    startX: x,
    startZ: z
  });
}

// Every frame - move flares, fade them out, remove dead ones
function updateFlares(delta) {
  // Cooldown timer
  if (socialState.flareCooldown > 0) {
    socialState.flareCooldown -= delta;
  }

  for (let i = socialState.flares.length - 1; i >= 0; i--) {
    const f = socialState.flares[i];
    f.timer += delta;

    if (f.timer < FLARE_RISE_DURATION) {
      // Rising phase - fly upward over 2 seconds
      const progress = f.timer / FLARE_RISE_DURATION;
      f.mesh.position.y = 2 + progress * 40; // Rise to y=42
      // Flicker the light
      f.light.intensity = 3 + Math.sin(f.timer * 20) * 0.5;

    } else if (f.timer < FLARE_TOTAL_DURATION) {
      // Hanging phase - hover in sky, slowly dim
      const hangProgress = (f.timer - FLARE_RISE_DURATION) / FLARE_HANG_DURATION;
      f.mesh.position.y = 42 - hangProgress * 2; // Drift down slightly
      f.light.intensity = 3 * (1 - hangProgress * 0.7);
      // Pulsate the mesh
      const scale = 1 + Math.sin(f.timer * 5) * 0.1;
      f.mesh.scale.set(scale, scale, scale);

    } else {
      // Expired - remove from scene
      scene.remove(f.mesh);
      socialState.flares.splice(i, 1);
    }
  }

  // Update flare indicator on HUD
  _updateFlareIndicator();
}

// Show compass arrows pointing toward active flares
function _updateFlareIndicator() {
  const indicator = document.getElementById('flare-indicator');
  if (!indicator) return;

  if (socialState.flares.length === 0) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';
  indicator.innerHTML = '';

  for (const flare of socialState.flares) {
    // Calculate angle from player to flare
    const dx = flare.mesh.position.x - playerState.position.x;
    const dz = flare.mesh.position.z - playerState.position.z;
    const angle = Math.atan2(dx, dz) - playerState.yaw;

    const arrow = document.createElement('div');
    arrow.className = 'flare-arrow';
    arrow.style.color = flare.color;
    arrow.style.textShadow = '0 0 8px ' + flare.color;
    arrow.textContent = '\u25B2'; // Triangle arrow
    arrow.style.transform = 'rotate(' + (angle * 180 / Math.PI) + 'deg)';
    arrow.style.fontSize = '18px';
    indicator.appendChild(arrow);
  }
}

// Listen for other players' flares
if (typeof socket !== 'undefined') {
  socket.on('flareLaunched', function(data) {
    if (!mpState.inGame || !scene) return;
    _spawnFlare(data.x, data.z, data.color || '#44aaff');
  });
}


// ============================================
// FEATURE #4 - CO-OP COMPASS
// On-screen arrows pointing toward each
// teammate. Flashes red when they are hurt.
// ============================================

// Tracks which arrow elements exist: { socketId: divElement }
const _compassArrows = {};

function updateCoopCompass() {
  const container = document.getElementById('coop-compass');
  if (!container) return;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  const cy = H / 2;

  // Forward direction from camera
  const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  camForward.y = 0;
  camForward.normalize();

  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  camRight.y = 0;
  camRight.normalize();

  const playerIds = Object.keys(mpState.otherPlayers);

  // Remove arrows for players who left
  for (const id of Object.keys(_compassArrows)) {
    if (!mpState.otherPlayers[id]) {
      container.removeChild(_compassArrows[id]);
      delete _compassArrows[id];
    }
  }

  for (const id of playerIds) {
    const other = mpState.otherPlayers[id];
    if (!other.mesh) continue;

    // Lazy-create an arrow element for this player
    if (!_compassArrows[id]) {
      const arrow = document.createElement('div');
      arrow.className = 'coop-arrow';
      arrow.style.cssText =
        'position:fixed;' +
        'width:0;height:0;' +
        'border-left:8px solid transparent;' +
        'border-right:8px solid transparent;' +
        'border-bottom:18px solid ' + (other.color || '#44aaff') + ';' +
        'pointer-events:none;' +
        'z-index:50;' +
        'transition:border-bottom-color 0.2s;' +
        'filter:drop-shadow(0 0 4px ' + (other.color || '#44aaff') + ');';
      container.appendChild(arrow);
      _compassArrows[id] = arrow;
    }

    const arrow = _compassArrows[id];

    // Direction from local player to teammate (flat)
    const toOther = new THREE.Vector3(
      other.mesh.position.x - playerState.position.x,
      0,
      other.mesh.position.z - playerState.position.z
    );

    if (toOther.length() < 0.1) {
      arrow.style.display = 'none';
      continue;
    }

    toOther.normalize();

    // Project onto camera forward/right to get screen-space angle
    const dotForward = toOther.dot(camForward);
    const dotRight = toOther.dot(camRight);
    const angle = Math.atan2(dotRight, dotForward); // Angle from top, clockwise

    // Place arrow at the edge of a safe margin inside the screen
    const margin = 60;
    const edgeX = cx + Math.sin(angle) * (cx - margin);
    const edgeY = cy - Math.cos(angle) * (cy - margin);

    arrow.style.display = 'block';
    arrow.style.left = (edgeX - 8) + 'px';
    arrow.style.top = (edgeY - 9) + 'px';
    arrow.style.transform = 'rotate(' + angle + 'rad)';

    // Flash red if teammate health is low (< 30%)
    const health = other.health !== undefined ? other.health : 100;
    const maxHealth = other.maxHealth !== undefined ? other.maxHealth : 100;
    const pct = health / maxHealth;

    if (pct < 0.3) {
      const flash = Math.sin(totalTime * 8) > 0;
      arrow.style.borderBottomColor = flash ? '#ff2222' : (other.color || '#44aaff');
    } else {
      arrow.style.borderBottomColor = other.color || '#44aaff';
    }
  }
}


// ============================================
// FEATURE #5 - CAMP BULLETIN BOARD
// A wooden board inside camp where players
// can post short messages to the team.
// ============================================

const BULLETIN_PROMPT_DISTANCE = 4;
const BULLETIN_MAX_MESSAGES = 8;
const BULLETIN_PRESETS = [
  'Found gold chest NE!',
  'Need help!',
  'Trader is here!',
  'Meet at camp!'
];

// Creates the wooden board mesh and adds it inside the safe zone
function initBulletinBoard(sceneRef) {
  const boardGroup = new THREE.Group();

  // Left post
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 3, 6);
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const postL = new THREE.Mesh(postGeo, woodMat);
  postL.position.set(-0.9, 1.5, 0);
  postL.castShadow = true;
  boardGroup.add(postL);

  // Right post
  const postR = new THREE.Mesh(postGeo, woodMat);
  postR.position.set(0.9, 1.5, 0);
  postR.castShadow = true;
  boardGroup.add(postR);

  // Wooden board face
  const boardGeo = new THREE.BoxGeometry(2.0, 1.4, 0.1);
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 2.0;
  board.castShadow = true;
  boardGroup.add(board);

  // Header strip (darker wood)
  const headerMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.12), headerMat);
  header.position.set(0, 2.55, 0);
  boardGroup.add(header);

  // Small paper notes on the board (decorative)
  const noteMat = new THREE.MeshLambertMaterial({ color: 0xf5e6c8 });
  for (let i = 0; i < 3; i++) {
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.02), noteMat);
    note.position.set(-0.5 + i * 0.5, 2.0 + (i % 2) * 0.3, 0.07);
    note.rotation.z = (Math.random() - 0.5) * 0.2;
    boardGroup.add(note);
  }

  // Place it inside camp near the gate
  boardGroup.position.set(3, 0, -(SAFE_ZONE_RADIUS - 2));
  boardGroup.rotation.y = Math.PI;

  sceneRef.add(boardGroup);
  socialState.boardMesh = boardGroup;
}

function toggleBulletinBoard() {
  if (!playerState.alive) return;

  const menu = document.getElementById('bulletin-menu');
  if (!menu) return;

  // If already open, close it
  if (menu.style.display === 'block') {
    menu.style.display = 'none';
    return;
  }

  // Must be near the board to open
  if (!socialState.boardMesh) return;
  const bx = socialState.boardMesh.position.x - playerState.position.x;
  const bz = socialState.boardMesh.position.z - playerState.position.z;
  const dist = Math.sqrt(bx * bx + bz * bz);

  if (dist > BULLETIN_PROMPT_DISTANCE) {
    showLootText('Get closer to the bulletin board!');
    return;
  }

  menu.style.display = 'block';
  _refreshBulletinUI();
}

function postMessage(text) {
  if (!text || !text.trim()) return;
  text = text.trim().substring(0, 40); // Max 40 chars

  const author = mpState.playerName || 'You';
  _addBulletinMessage(author, text);

  // Broadcast to other players
  if (typeof socket !== 'undefined') {
    socket.emit('bulletinPost', { author: author, text: text });
  }

  showLootText('Message posted!');
}

function _addBulletinMessage(author, text) {
  socialState.messages.push({ author: author, text: text, time: Date.now() });

  // Cap at max messages (remove oldest)
  while (socialState.messages.length > BULLETIN_MAX_MESSAGES) {
    socialState.messages.shift();
  }

  // Refresh the UI if the menu is open
  _refreshBulletinUI();
}

function _refreshBulletinUI() {
  const list = document.getElementById('bulletin-messages');
  if (!list) return;

  list.innerHTML = '';
  if (socialState.messages.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#999';
    empty.style.fontStyle = 'italic';
    empty.textContent = 'No messages yet.';
    list.appendChild(empty);
  } else {
    for (const msg of socialState.messages) {
      const div = document.createElement('div');
      div.className = 'bulletin-message';
      div.textContent = '[' + msg.author + ']: ' + msg.text;
      list.appendChild(div);
    }
  }

  // Clear the custom input
  const input = document.getElementById('bulletin-input');
  if (input) input.value = '';
}

// Shows or hides the "Press B" prompt based on proximity to the board
function _updateBulletinPrompt() {
  const prompt = document.getElementById('bulletin-prompt');
  if (!prompt || !socialState.boardMesh) return;

  const bx = socialState.boardMesh.position.x - playerState.position.x;
  const bz = socialState.boardMesh.position.z - playerState.position.z;
  const dist = Math.sqrt(bx * bx + bz * bz);

  prompt.style.display = dist < BULLETIN_PROMPT_DISTANCE ? 'block' : 'none';
}

// Listen for bulletin updates from other players
if (typeof socket !== 'undefined') {
  socket.on('bulletinUpdate', function(data) {
    _addBulletinMessage(data.author || 'Someone', (data.text || '').substring(0, 40));
    showLootText((data.author || 'Someone') + ' posted on the board!');
  });
}


// ============================================
// FEATURE #9 - PHOTO MODE
// Press P to detach the camera and freely
// frame a screenshot of the world.
// ============================================

let _photoModeKeys = { w: false, a: false, s: false, d: false };
let _photoCamPos = new THREE.Vector3();
let _photoCamYaw = 0;
let _photoCamPitch = 0;

function togglePhotoMode() {
  if (!playerState.isPlaying) return;

  socialState.photoMode = !socialState.photoMode;

  if (socialState.photoMode) {
    _enterPhotoMode();
  } else {
    _exitPhotoMode();
  }
}

function _enterPhotoMode() {
  socialState.photoMode = true;

  // Save current camera position so we start from there
  _photoCamPos.copy(camera.position);
  _photoCamYaw = playerState.yaw;
  _photoCamPitch = playerState.pitch;

  // Hide all game UI
  const ui = document.getElementById('game-ui');
  const mobile = document.getElementById('mobile-controls');
  if (ui) ui.style.display = 'none';
  if (mobile) mobile.style.display = 'none';

  // Show photo frame border
  const frame = document.getElementById('photo-frame');
  if (frame) frame.style.display = 'block';

  showLootText('Photo Mode - WASD to move, click to capture, P to exit');
}

function _exitPhotoMode() {
  socialState.photoMode = false;

  // Restore UI
  const ui = document.getElementById('game-ui');
  if (ui) ui.style.display = 'block';

  // Restore mobile controls if on a touch device
  if (isMobile) {
    const mobile = document.getElementById('mobile-controls');
    if (mobile) mobile.style.display = 'block';
  }

  // Hide photo frame
  const frame = document.getElementById('photo-frame');
  if (frame) frame.style.display = 'none';
}

// Capture a screenshot and save it
function _capturePhoto() {
  if (!socialState.photoMode || !renderer) return;

  // Grab the canvas data
  var dataURL;
  try {
    dataURL = renderer.domElement.toDataURL('image/png');
  } catch (e) {
    console.warn('Screenshot capture failed:', e);
    return;
  }

  // Save to photos array
  socialState.photos.push(dataURL);

  // Flash effect
  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;opacity:0.8;z-index:9999;pointer-events:none;';
  document.body.appendChild(flash);

  var flashOpacity = 0.8;
  var flashInterval = setInterval(function() {
    flashOpacity -= 0.05;
    if (flashOpacity <= 0) {
      clearInterval(flashInterval);
      flash.remove();
    } else {
      flash.style.opacity = flashOpacity;
    }
  }, 16);

  // Show "Photo saved!" text for 2 seconds
  var textEl = document.getElementById('photo-taken-text');
  if (textEl) {
    textEl.style.display = 'block';
    textEl.textContent = 'Photo saved!';
    setTimeout(function() {
      textEl.style.display = 'none';
    }, 2000);
  }
}

// Free-fly camera movement for photo mode - called from game loop
function updatePhotoMode(delta) {
  if (!socialState.photoMode) return;

  var PHOTO_SPEED = 10;
  var forward = new THREE.Vector3(
    -Math.sin(_photoCamYaw) * Math.cos(_photoCamPitch),
     Math.sin(_photoCamPitch),
    -Math.cos(_photoCamYaw) * Math.cos(_photoCamPitch)
  );
  var right = new THREE.Vector3(Math.cos(_photoCamYaw), 0, -Math.sin(_photoCamYaw));

  if (_photoModeKeys.w) _photoCamPos.addScaledVector(forward,  PHOTO_SPEED * delta);
  if (_photoModeKeys.s) _photoCamPos.addScaledVector(forward, -PHOTO_SPEED * delta);
  if (_photoModeKeys.a) _photoCamPos.addScaledVector(right,   -PHOTO_SPEED * delta);
  if (_photoModeKeys.d) _photoCamPos.addScaledVector(right,    PHOTO_SPEED * delta);

  camera.position.copy(_photoCamPos);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = _photoCamYaw;
  camera.rotation.x = _photoCamPitch;
}


// ============================================
// FEATURE #10 - PLAYER EMOTES
// Hold Alt + 1/2/3/4 to trigger emotes.
// Each emote animates the player's limbs
// for 2 seconds.
// ============================================

const EMOTE_DURATION = 2; // Seconds per emote

// Emote definitions
const EMOTES = {
  wave:      { id: 1, name: 'Wave' },
  celebrate: { id: 2, name: 'Celebrate' },
  dance:     { id: 3, name: 'Dance' },
  huddle:    { id: 4, name: 'Huddle' }
};

// Trigger an emote by its ID (1-4)
function triggerEmote(emoteId) {
  if (!playerState.alive || !playerState.mesh) return;
  if (socialState.currentEmote) return; // Already emoting

  var emoteName = null;
  for (var key in EMOTES) {
    if (EMOTES[key].id === emoteId) {
      emoteName = key;
      break;
    }
  }
  if (!emoteName) return;

  socialState.currentEmote = emoteName;
  socialState.emoteTimer = EMOTE_DURATION;

  // Save base Y for celebrate bounce
  playerState.mesh.userData._baseY = playerState.mesh.position.y;

  showLootText(EMOTES[emoteName].name + '!');

  // Broadcast emote to other players
  if (typeof socket !== 'undefined') {
    socket.emit('playerEmote', { emote: emoteName });
  }
}

// Called every frame to animate the current emote on the local player
function updateEmotes(delta) {
  if (!socialState.currentEmote || !playerState.mesh) return;

  socialState.emoteTimer -= delta;

  // Expire after duration
  if (socialState.emoteTimer <= 0) {
    _resetEmotePose(playerState.mesh);
    socialState.currentEmote = null;
    socialState.emoteTimer = 0;
    return;
  }

  var t = (EMOTE_DURATION - socialState.emoteTimer); // Time elapsed
  _applyEmotePose(playerState.mesh, socialState.currentEmote, t);
}

// Apply limb rotations for a given emote and elapsed time t
function _applyEmotePose(mesh, emoteName, t) {
  var ud = mesh.userData;
  if (!ud) return;

  var armL = ud.armL;
  var armR = ud.armR;
  var legL = ud.legL || (ud.legs ? ud.legs[0] : null);
  var legR = ud.legR || (ud.legs ? ud.legs[1] : null);

  switch (emoteName) {
    case 'wave':
      // Right arm waves up and down
      if (armR) {
        armR.rotation.z = -1.8 + Math.sin(t * 8) * 0.4;
        armR.rotation.x = 0;
      }
      if (armL) armL.rotation.z = 0;
      break;

    case 'celebrate':
      // Player jumps + arms up
      if (armL) { armL.rotation.z = 1.8 + Math.sin(t * 6) * 0.2; armL.rotation.x = 0; }
      if (armR) { armR.rotation.z = -1.8 + Math.sin(t * 6) * 0.2; armR.rotation.x = 0; }
      mesh.position.y = (ud._baseY || 0) + Math.abs(Math.sin(t * 5)) * 0.4;
      break;

    case 'dance':
      // Body sways side to side, arms move
      mesh.rotation.z = Math.sin(t * 4) * 0.05;
      if (armL) {
        armL.rotation.z = Math.sin(t * 5) * 1.0;
        armL.rotation.x = Math.cos(t * 5) * 0.3;
      }
      if (armR) {
        armR.rotation.z = -Math.sin(t * 5) * 1.0;
        armR.rotation.x = Math.cos(t * 5 + Math.PI) * 0.3;
      }
      if (legL) legL.rotation.x = Math.sin(t * 4) * 0.3;
      if (legR) legR.rotation.x = Math.sin(t * 4 + Math.PI) * 0.3;
      break;

    case 'huddle':
      // Crouch down, arms wrap around body
      mesh.scale.y = 0.8;
      if (armL) { armL.rotation.z = 0.8; armL.rotation.x = 0.6; }
      if (armR) { armR.rotation.z = -0.8; armR.rotation.x = 0.6; }
      break;
  }
}

// Return limbs to neutral positions
function _resetEmotePose(mesh) {
  var ud = mesh.userData;
  if (!ud) return;

  if (ud.armL) { ud.armL.rotation.set(0, 0, 0); }
  if (ud.armR) { ud.armR.rotation.set(0, 0, 0); }

  var legL = ud.legL || (ud.legs ? ud.legs[0] : null);
  var legR = ud.legR || (ud.legs ? ud.legs[1] : null);
  if (legL) { legL.rotation.set(0, 0, 0); }
  if (legR) { legR.rotation.set(0, 0, 0); }

  mesh.scale.y = 1;
  mesh.rotation.z = 0;
  mesh.position.y = ud._baseY || 0;
}

// Also animate other players' emotes when they broadcast one
function _applyRemoteEmote(playerId, emoteName) {
  var other = mpState.otherPlayers[playerId];
  if (!other || !other.mesh) return;

  other.emote = emoteName;
  other.emoteTimer = 0;
  other.mesh.userData._baseY = other.mesh.position.y;
}

function updateRemoteEmotes(delta) {
  for (var id in mpState.otherPlayers) {
    var other = mpState.otherPlayers[id];
    if (!other.mesh || !other.emote) continue;

    other.emoteTimer = (other.emoteTimer || 0) + delta;

    if (other.emoteTimer > EMOTE_DURATION) {
      _resetEmotePose(other.mesh);
      other.emote = null;
      other.emoteTimer = 0;
    } else {
      _applyEmotePose(other.mesh, other.emote, other.emoteTimer);
    }
  }
}

// Listen for remote emote events
if (typeof socket !== 'undefined') {
  socket.on('playerEmote', function(data) {
    if (!mpState.inGame) return;
    _applyRemoteEmote(data.id, data.emote);
  });
}


// ============================================
// FEATURE #12 - CAMP DECORATOR
// Press V in safe zone to open the decorate
// menu. Place decorations that cost resources.
// ============================================

const DECORATION_MAX = 10;

const DECOR_CATALOG = [
  {
    name: 'Flower Patch',
    cost: { wood: 2 },
    description: '2 wood',
    create: _createFlowerPatch
  },
  {
    name: 'Hammock',
    cost: { wood: 3, bones: 1 },
    description: '3 wood + 1 bone',
    create: _createHammock
  },
  {
    name: 'Fairy Lights',
    cost: { gems: 2 },
    description: '2 gems',
    create: _createFairyLights
  },
  {
    name: 'Cooking Spit',
    cost: { wood: 3, coal: 1 },
    description: '3 wood + 1 coal',
    create: _createCookingSpit
  }
];

function toggleDecorateMode() {
  if (!playerState.alive) return;

  var menu = document.getElementById('decorate-menu');
  if (!menu) return;

  // If already open, close it
  if (menu.style.display === 'block') {
    menu.style.display = 'none';
    return;
  }

  // Must be in the safe zone
  if (!isInSafeZone(playerState.position.x, playerState.position.z)) {
    showLootText('Must be inside the camp to decorate!');
    return;
  }

  menu.style.display = 'block';
  _updateDecorateUI();
}

function _updateDecorateUI() {
  var menu = document.getElementById('decorate-menu');
  if (!menu) return;

  var html = '<div class="decorate-title">Camp Decorator</div>';
  html += '<div class="decorate-count">' + socialState.decorations.length + '/' + DECORATION_MAX + ' placed</div>';

  for (var i = 0; i < DECOR_CATALOG.length; i++) {
    var deco = DECOR_CATALOG[i];

    // Check if player can afford it
    var canAfford = true;
    for (var resource in deco.cost) {
      if ((playerState.inventory[resource] || 0) < deco.cost[resource]) {
        canAfford = false;
        break;
      }
    }

    var atMax = socialState.decorations.length >= DECORATION_MAX;
    var disabled = (!canAfford || atMax) ? ' disabled' : '';
    html += '<button class="decorate-btn' + disabled + '" onclick="placeDecoration(\'' + DECOR_CATALOG[i].name + '\')"' + disabled + '>';
    html += deco.name + ' - ' + deco.description;
    html += '</button>';
  }

  html += '<button class="decorate-close-btn" onclick="toggleDecorateMode()">Close (V)</button>';
  menu.innerHTML = html;
}

function placeDecoration(typeName) {
  if (socialState.decorations.length >= DECORATION_MAX) {
    showLootText('Max decorations reached!');
    return;
  }

  if (!isInSafeZone(playerState.position.x, playerState.position.z)) {
    showLootText('Must be inside the camp!');
    return;
  }

  // Find the decoration by name
  var catalog = null;
  for (var i = 0; i < DECOR_CATALOG.length; i++) {
    if (DECOR_CATALOG[i].name === typeName) {
      catalog = DECOR_CATALOG[i];
      break;
    }
  }
  if (!catalog) return;

  // Check cost
  for (var resource in catalog.cost) {
    if ((playerState.inventory[resource] || 0) < catalog.cost[resource]) {
      showLootText('Not enough ' + resource + '!');
      return;
    }
  }

  // Deduct cost
  for (var resource in catalog.cost) {
    playerState.inventory[resource] -= catalog.cost[resource];
  }
  updateInventoryUI();

  // Build the decoration mesh at player position
  var mesh = catalog.create();
  mesh.position.set(playerState.position.x, 0, playerState.position.z);
  mesh.rotation.y = playerState.yaw;
  scene.add(mesh);

  socialState.decorations.push({ type: typeName, mesh: mesh });
  showLootText(catalog.name + ' placed!');

  // Refresh the menu
  _updateDecorateUI();
}

// --- Decoration mesh builders ---

function _createFlowerPatch() {
  var group = new THREE.Group();
  var colors = [0xff4466, 0xffdd44, 0xff88ee, 0x66ddff, 0xaaffaa];

  for (var i = 0; i < 7; i++) {
    var color = colors[i % colors.length];
    // Stem
    var stemMat = new THREE.MeshLambertMaterial({ color: 0x228833 });
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), stemMat);
    stem.position.set(
      (Math.random() - 0.5) * 1.2,
      0.15,
      (Math.random() - 0.5) * 1.2
    );
    group.add(stem);

    // Bloom
    var bloomMat = new THREE.MeshLambertMaterial({ color: color });
    var bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), bloomMat);
    bloom.position.set(stem.position.x, 0.32, stem.position.z);
    group.add(bloom);
  }

  return group;
}

function _createHammock() {
  var group = new THREE.Group();
  var woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });

  // Two support posts
  var post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 6), woodMat);
  post1.position.set(-1, 1.25, 0);
  post1.castShadow = true;
  group.add(post1);

  var post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 6), woodMat);
  post2.position.set(1, 1.25, 0);
  post2.castShadow = true;
  group.add(post2);

  // Hammock fabric
  var fabricMat = new THREE.MeshLambertMaterial({ color: 0xcc9966, side: THREE.DoubleSide });
  var fabric = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.6), fabricMat);
  fabric.position.set(0, 1.2, 0);
  group.add(fabric);

  return group;
}

function _createFairyLights() {
  var group = new THREE.Group();

  // Two small support posts
  var postMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  var post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), postMat);
  post1.position.set(-1.2, 0.75, 0);
  group.add(post1);

  var post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), postMat);
  post2.position.set(1.2, 0.75, 0);
  group.add(post2);

  // Wire
  var wireMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  var wire = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.02), wireMat);
  wire.position.set(0, 1.45, 0);
  group.add(wire);

  // Bulbs
  var bulbColors = [0xffee88, 0xff8844, 0x88eeff, 0xff88cc, 0x88ff88];
  for (var i = 0; i < 6; i++) {
    var x = (i / 5) * 2.2 - 1.1;
    var bulbColor = bulbColors[i % bulbColors.length];
    var bulbMat = new THREE.MeshBasicMaterial({ color: bulbColor });
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), bulbMat);
    bulb.position.set(x, 1.35, 0);
    group.add(bulb);

    // Small glow light per bulb
    var pl = new THREE.PointLight(bulbColor, 0.3, 2.5);
    pl.position.set(x, 1.35, 0);
    group.add(pl);
  }

  return group;
}

function _createCookingSpit() {
  var group = new THREE.Group();
  var woodMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });

  // Left support
  var supportL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), woodMat);
  supportL.position.set(-0.6, 0.75, 0);
  supportL.castShadow = true;
  group.add(supportL);

  // Fork on left support
  var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), woodMat);
  forkL.position.set(-0.5, 1.5, 0);
  forkL.rotation.z = 0.5;
  group.add(forkL);

  // Right support
  var supportR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), woodMat);
  supportR.position.set(0.6, 0.75, 0);
  supportR.castShadow = true;
  group.add(supportR);

  // Fork on right support
  var forkR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), woodMat);
  forkR.position.set(0.5, 1.5, 0);
  forkR.rotation.z = -0.5;
  group.add(forkR);

  // Horizontal spit rod
  var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), woodMat);
  rod.position.set(0, 1.4, 0);
  rod.rotation.z = Math.PI / 2;
  group.add(rod);

  // Meat on the spit
  var meatMat = new THREE.MeshLambertMaterial({ color: 0x993322 });
  var meat = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), meatMat);
  meat.position.set(0, 1.4, 0);
  meat.scale.set(1.3, 0.8, 0.8);
  group.add(meat);

  return group;
}


// ============================================
// FEATURE #33 - GLOWING TRAILS
// Players leave fading ground circles as they
// move, leaving a colorful trail in the world.
// ============================================

const TRAIL_SPAWN_INTERVAL = 0.3;   // Seconds between new trail points
const TRAIL_FADE_DURATION = 20;     // Seconds to fully fade
const TRAIL_MAX_FOOTPRINTS = 200;   // Max footprints in the world

function updateGlowingTrails(delta) {
  socialState.footprintTimer += delta;

  // --- SPAWN NEW TRAIL POINTS ---
  if (socialState.footprintTimer >= TRAIL_SPAWN_INTERVAL) {
    socialState.footprintTimer = 0;

    // Local player footprint (only if moving)
    if (playerState.alive && playerState.isMoving && playerState.mesh) {
      var color = mpState.playerColor || '#44aaff';
      var hasGems = playerState.inventory.gems > 0;
      _spawnFootprint(playerState.position.x, playerState.position.z, color, hasGems);
    }

    // Remote players' footprints
    for (var id in mpState.otherPlayers) {
      var other = mpState.otherPlayers[id];
      if (!other.mesh) continue;
      _spawnFootprint(other.mesh.position.x, other.mesh.position.z, other.color || '#44aaff', false);
    }
  }

  // --- FADE AND REMOVE OLD TRAIL POINTS ---
  for (var i = socialState.footprints.length - 1; i >= 0; i--) {
    var fp = socialState.footprints[i];
    fp.age += delta;

    // Reduce opacity over lifetime
    var fadeProgress = fp.age / TRAIL_FADE_DURATION;
    fp.mesh.material.opacity = Math.max(0, (1 - fadeProgress) * fp.baseOpacity);

    // Remove when fully faded
    if (fp.mesh.material.opacity < 0.01) {
      scene.remove(fp.mesh);
      socialState.footprints.splice(i, 1);
    }
  }
}

function _spawnFootprint(x, z, colorStr, sparkle) {
  // Cap total footprints
  if (socialState.footprints.length >= TRAIL_MAX_FOOTPRINTS) {
    var oldest = socialState.footprints.shift();
    scene.remove(oldest.mesh);
  }

  var colorHex = _colorToHex(colorStr);
  var baseOpacity = sparkle ? 0.6 : 0.4;

  var geo = new THREE.PlaneGeometry(0.3, 0.3);
  var mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: baseOpacity,
    depthWrite: false,  // Prevents Z-fighting with the ground
    side: THREE.DoubleSide
  });

  var mesh = new THREE.Mesh(geo, mat);
  // Lay flat on the ground, slightly above to avoid z-fighting
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.02, z);
  scene.add(mesh);

  socialState.footprints.push({
    mesh: mesh,
    age: 0,
    baseOpacity: baseOpacity
  });
}


// ============================================
// KEY BINDINGS FOR SOCIAL FEATURES
// These hook into the document to handle
// all social feature inputs.
// ============================================

function _initSocialKeyBindings() {
  // --- KEYDOWN ---
  document.addEventListener('keydown', function(e) {
    if (!playerState.isPlaying) return;

    // Photo mode WASD (intercept before normal movement in photo mode)
    if (socialState.photoMode) {
      if (e.key === 'w' || e.key === 'W') _photoModeKeys.w = true;
      if (e.key === 'a' || e.key === 'A') _photoModeKeys.a = true;
      if (e.key === 's' || e.key === 'S') _photoModeKeys.s = true;
      if (e.key === 'd' || e.key === 'D') _photoModeKeys.d = true;
    }

    // P key - toggle photo mode
    if (e.code === 'KeyP') {
      togglePhotoMode();
      return;
    }

    // Escape exits photo mode
    if (e.key === 'Escape' && socialState.photoMode) {
      _exitPhotoMode();
      return;
    }

    // Don't process other social keys while in photo mode
    if (socialState.photoMode) return;

    // Q key - launch flare
    if (e.code === 'KeyQ') {
      launchFlare();
    }

    // B key - bulletin board
    if (e.code === 'KeyB') {
      if (socialState.boardMesh) {
        var bx = socialState.boardMesh.position.x - playerState.position.x;
        var bz = socialState.boardMesh.position.z - playerState.position.z;
        var dist = Math.sqrt(bx * bx + bz * bz);
        if (dist < BULLETIN_PROMPT_DISTANCE || document.getElementById('bulletin-menu').style.display === 'block') {
          toggleBulletinBoard();
        }
      }
    }

    // V key - camp decorator
    if (e.code === 'KeyV') {
      toggleDecorateMode();
    }

    // Alt + 1/2/3/4 - emotes
    if (e.altKey) {
      switch (e.code) {
        case 'Digit1': triggerEmote(1); e.preventDefault(); break;
        case 'Digit2': triggerEmote(2); e.preventDefault(); break;
        case 'Digit3': triggerEmote(3); e.preventDefault(); break;
        case 'Digit4': triggerEmote(4); e.preventDefault(); break;
      }
    }
  });

  // --- KEYUP (photo mode WASD release) ---
  document.addEventListener('keyup', function(e) {
    if (e.key === 'w' || e.key === 'W') _photoModeKeys.w = false;
    if (e.key === 'a' || e.key === 'A') _photoModeKeys.a = false;
    if (e.key === 's' || e.key === 'S') _photoModeKeys.s = false;
    if (e.key === 'd' || e.key === 'D') _photoModeKeys.d = false;
  });

  // --- MOUSE MOVE (photo mode free-look) ---
  document.addEventListener('mousemove', function(e) {
    if (!socialState.photoMode) return;
    _photoCamYaw -= e.movementX * 0.003;
    _photoCamPitch -= e.movementY * 0.003;
    _photoCamPitch = Math.max(-1.4, Math.min(1.4, _photoCamPitch));
  });

  // --- CLICK (photo mode capture) ---
  document.addEventListener('mousedown', function(e) {
    if (socialState.photoMode && e.button === 0) {
      _capturePhoto();
    }
  });
}


// ============================================
// INJECT DOM ELEMENTS
// Creates the HTML elements needed by social
// features if they aren't already in index.html
// ============================================

function _injectSocialDOM() {
  // --- Co-op compass container ---
  if (!document.getElementById('coop-compass')) {
    var cc = document.createElement('div');
    cc.id = 'coop-compass';
    cc.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;';
    document.body.appendChild(cc);
  }

  // --- Singalong text ---
  if (!document.getElementById('singalong-text')) {
    var st = document.createElement('div');
    st.id = 'singalong-text';
    st.textContent = 'The fire burns brighter with friends.';
    st.style.cssText =
      'display:none;position:fixed;bottom:130px;left:50%;transform:translateX(-50%);' +
      'color:#ffcc44;font-family:"Courier New",monospace;font-size:18px;' +
      'text-shadow:0 0 12px #ff8800;pointer-events:none;z-index:60;';
    document.body.appendChild(st);
  }

  // --- Singalong warm vignette overlay ---
  if (!document.getElementById('singalong-overlay')) {
    var so = document.createElement('div');
    so.id = 'singalong-overlay';
    so.style.cssText =
      'display:none;position:fixed;inset:0;pointer-events:none;z-index:45;' +
      'background:radial-gradient(ellipse at center, transparent 40%, rgba(255, 120, 0, 0.18) 100%);';
    document.body.appendChild(so);
  }

  // --- Flare indicator ---
  if (!document.getElementById('flare-indicator')) {
    var fi = document.createElement('div');
    fi.id = 'flare-indicator';
    fi.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'pointer-events:none;z-index:55;font-size:24px;';
    document.body.appendChild(fi);
  }

  // --- Photo frame overlay ---
  if (!document.getElementById('photo-frame')) {
    var pf = document.createElement('div');
    pf.id = 'photo-frame';
    pf.style.cssText =
      'display:none;position:fixed;inset:0;pointer-events:none;z-index:80;' +
      'border:4px solid rgba(255,255,255,0.7);' +
      'box-shadow:inset 0 0 0 2px rgba(255,255,255,0.3);';
    var pfLabel = document.createElement('div');
    pfLabel.style.cssText =
      'position:absolute;top:12px;left:50%;transform:translateX(-50%);' +
      'color:rgba(255,255,255,0.85);font-family:"Courier New",monospace;' +
      'font-size:13px;letter-spacing:4px;text-shadow:0 1px 4px #000;';
    pfLabel.textContent = 'PHOTO MODE \u2014 Click to capture, P to exit';
    pf.appendChild(pfLabel);
    document.body.appendChild(pf);
  }

  // --- Photo taken text ---
  if (!document.getElementById('photo-taken-text')) {
    var pt = document.createElement('div');
    pt.id = 'photo-taken-text';
    pt.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fff;font-family:"Courier New",monospace;font-size:24px;font-weight:bold;' +
      'text-shadow:0 0 20px #fff;pointer-events:none;z-index:90;';
    pt.textContent = 'Photo saved!';
    document.body.appendChild(pt);
  }

  // --- Bulletin board menu ---
  if (!document.getElementById('bulletin-menu')) {
    var bm = document.createElement('div');
    bm.id = 'bulletin-menu';
    bm.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(60,35,15,0.95);border:2px solid #8b5e3c;border-radius:8px;' +
      'padding:20px;min-width:320px;z-index:70;font-family:"Courier New",monospace;color:#e8d0a0;';

    bm.innerHTML =
      '<div style="font-size:18px;font-weight:bold;margin-bottom:12px;text-align:center;">' +
        'Camp Bulletin Board' +
      '</div>' +
      '<div id="bulletin-messages" style="' +
        'max-height:150px;overflow-y:auto;background:rgba(0,0,0,0.3);' +
        'padding:8px;border-radius:4px;margin-bottom:12px;font-size:13px;min-height:40px;' +
      '"></div>' +
      '<div id="bulletin-templates" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;"></div>' +
      '<div style="display:flex;gap:8px;">' +
        '<input id="bulletin-input" type="text" maxlength="40" placeholder="Custom message (40 chars)..." style="' +
          'flex:1;padding:6px;background:rgba(0,0,0,0.5);border:1px solid #8b5e3c;' +
          'color:#e8d0a0;border-radius:4px;font-family:\'Courier New\',monospace;' +
        '"/>' +
        '<button id="bulletin-submit" style="' +
          'padding:6px 12px;background:#8b5e3c;border:none;border-radius:4px;' +
          'color:#fff;cursor:pointer;font-family:\'Courier New\',monospace;' +
        '">Post</button>' +
      '</div>' +
      '<button id="bulletin-close" style="' +
        'margin-top:10px;width:100%;padding:6px;background:rgba(0,0,0,0.4);' +
        'border:1px solid #8b5e3c;color:#aaa;cursor:pointer;border-radius:4px;' +
        'font-family:\'Courier New\',monospace;' +
      '">Close (B)</button>';

    document.body.appendChild(bm);
  }

  // --- Bulletin board proximity prompt ---
  if (!document.getElementById('bulletin-prompt')) {
    var bp = document.createElement('div');
    bp.id = 'bulletin-prompt';
    bp.textContent = 'Press B to use bulletin board';
    bp.style.cssText =
      'display:none;position:fixed;bottom:180px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.7);color:#e8d0a0;padding:6px 16px;border-radius:6px;' +
      'font-family:"Courier New",monospace;font-size:14px;pointer-events:none;z-index:55;';
    document.body.appendChild(bp);
  }

  // --- Decorate menu ---
  if (!document.getElementById('decorate-menu')) {
    var dm = document.createElement('div');
    dm.id = 'decorate-menu';
    dm.style.cssText =
      'display:none;position:fixed;top:50%;right:20px;transform:translateY(-50%);' +
      'background:rgba(30,50,25,0.95);border:2px solid #4a7a2a;border-radius:8px;' +
      'padding:16px;min-width:240px;z-index:70;font-family:"Courier New",monospace;color:#c8e8a0;';
    document.body.appendChild(dm);
  }
}

// Wire up bulletin board UI buttons after DOM injection
function _setupBulletinUI() {
  // Template preset buttons
  var templateContainer = document.getElementById('bulletin-templates');
  if (templateContainer) {
    templateContainer.innerHTML = '';
    for (var i = 0; i < BULLETIN_PRESETS.length; i++) {
      (function(preset) {
        var btn = document.createElement('button');
        btn.className = 'bulletin-template-btn';
        btn.textContent = preset;
        btn.style.cssText =
          'padding:4px 10px;background:rgba(139,94,60,0.6);border:1px solid #8b5e3c;' +
          'border-radius:4px;color:#e8d0a0;cursor:pointer;font-family:"Courier New",monospace;font-size:12px;';
        btn.onclick = function() { postMessage(preset); };
        templateContainer.appendChild(btn);
      })(BULLETIN_PRESETS[i]);
    }
  }

  // Custom message submit button
  var submitBtn = document.getElementById('bulletin-submit');
  if (submitBtn) {
    submitBtn.onclick = function() {
      var input = document.getElementById('bulletin-input');
      if (!input) return;
      var text = input.value.trim().substring(0, 40);
      if (text) {
        postMessage(text);
        input.value = '';
      }
    };
  }

  // Close button
  var closeBtn = document.getElementById('bulletin-close');
  if (closeBtn) {
    closeBtn.onclick = toggleBulletinBoard;
  }
}


// ============================================
// INIT & MAIN UPDATE
// Call initSocialFeatures() once after startGame().
// Call updateSocialFeatures(delta) every frame.
// ============================================

function initSocialFeatures() {
  // Inject required DOM elements
  _injectSocialDOM();

  // Set up bulletin board UI buttons
  _setupBulletinUI();

  // Set up bracelet mesh group on player
  initBracelets();

  // Create bulletin board 3D mesh in camp
  initBulletinBoard(scene);

  // Grab campfire light reference for singalong
  _initSingalong();

  // Set up all key bindings
  _initSocialKeyBindings();
}

// Master update - call this every frame from game.js gameLoop()
function updateSocialFeatures(delta) {
  // Photo mode has its own update path
  if (socialState.photoMode) {
    updatePhotoMode(delta);
    return;
  }

  // Friendship bracelets
  updateFriendshipBracelets(delta);

  // Campfire singalong
  updateCampfireSingalong();

  // SOS flares
  updateFlares(delta);

  // Co-op compass
  updateCoopCompass();

  // Bulletin board proximity prompt
  _updateBulletinPrompt();

  // Player emotes (local + remote)
  updateEmotes(delta);
  updateRemoteEmotes(delta);

  // Glowing trails
  updateGlowingTrails(delta);
}

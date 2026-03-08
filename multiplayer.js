// ============================================
// MULTIPLAYER.JS - Lobby & online play!
// Handles the lobby UI, connecting to rooms,
// and showing other players in the 3D world
// ============================================

// Connect to the server
const socket = io();

// --- MULTIPLAYER STATE ---
const mpState = {
  playerName: '',
  roomCode: '',
  inGame: false,
  otherPlayers: {} // { socketId: { mesh, name, color } }
};

// ============================================
// LOBBY UI LOGIC
// All the button clicks and screen switching
// ============================================

// Helper: add both touch and click support for buttons (fixes iPad 300ms delay)
function onTap(element, callback) {
  let touched = false;
  element.addEventListener('touchstart', (e) => {
    touched = true;
    e.preventDefault();
    callback(e);
  }, { passive: false });
  element.addEventListener('click', (e) => {
    if (!touched) callback(e); // Only fire click if no touch happened
    touched = false;
  });
}

function setupLobby() {
  const lobby = document.getElementById('lobby');
  const lobbyChoice = document.getElementById('lobby-choice');
  const lobbyCreate = document.getElementById('lobby-create');
  const lobbyJoin = document.getElementById('lobby-join');
  const lobbyWaiting = document.getElementById('lobby-waiting');
  const nameInput = document.getElementById('name-input');

  // --- CREATE ROOM BUTTON ---
  onTap(document.getElementById('btn-create'), () => {
    if (!nameInput.value.trim()) {
      nameInput.style.border = '2px solid #ff4444';
      nameInput.placeholder = 'Type your name first!';
      return;
    }
    mpState.playerName = nameInput.value.trim();
    lobbyChoice.style.display = 'none';
    lobbyCreate.style.display = 'block';
  });

  // --- JOIN ROOM BUTTON ---
  onTap(document.getElementById('btn-join'), () => {
    if (!nameInput.value.trim()) {
      nameInput.style.border = '2px solid #ff4444';
      nameInput.placeholder = 'Type your name first!';
      return;
    }
    mpState.playerName = nameInput.value.trim();
    lobbyChoice.style.display = 'none';
    lobbyJoin.style.display = 'block';
  });

  // --- BACK BUTTONS ---
  onTap(document.getElementById('btn-back-create'), () => {
    lobbyCreate.style.display = 'none';
    lobbyChoice.style.display = 'block';
  });
  onTap(document.getElementById('btn-back-join'), () => {
    lobbyJoin.style.display = 'none';
    lobbyChoice.style.display = 'block';
  });

  // --- PLAYER COUNT BUTTONS (1-5) ---
  document.querySelectorAll('.count-btn').forEach(btn => {
    onTap(btn, () => {
      const count = parseInt(btn.dataset.count);
      socket.emit('createRoom', {
        name: mpState.playerName,
        maxPlayers: count
      });
    });
  });

  // --- SUBMIT JOIN CODE ---
  onTap(document.getElementById('btn-submit-code'), submitJoinCode);
  document.getElementById('code-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') submitJoinCode();
  });

  function submitJoinCode() {
    const code = document.getElementById('code-input').value;
    if (!code.trim()) return;
    document.getElementById('join-error').textContent = '';
    socket.emit('joinRoom', {
      name: mpState.playerName,
      code: code
    });
  }

  // --- READY BUTTON ---
  onTap(document.getElementById('btn-ready'), () => {
    socket.emit('playerReady');
    document.getElementById('btn-ready').textContent = 'Waiting...';
    document.getElementById('btn-ready').disabled = true;
  });

  // Reset name input style when typing
  nameInput.addEventListener('input', () => {
    nameInput.style.border = '2px solid #4ade80';
  });
}

// ============================================
// SOCKET.IO EVENT HANDLERS
// Messages from the server
// ============================================

// Room was created successfully
socket.on('roomCreated', (data) => {
  mpState.roomCode = data.code;
  showWaitingRoom(data);
});

// Room updated (player joined/readied up)
socket.on('roomUpdate', (data) => {
  showWaitingRoom(data);
});

// Error joining a room
socket.on('joinError', (msg) => {
  document.getElementById('join-error').textContent = msg;
});

// GAME START! Everyone is ready!
socket.on('gameStart', (data) => {
  mpState.inGame = true;
  // Hide lobby, start the game right away!
  document.getElementById('lobby').style.display = 'none';
  // Start the 3D game
  startGame(data.players);
});

// Another player moved - update their position in 3D
socket.on('playerMoved', (data) => {
  if (!mpState.inGame) return;
  updateOtherPlayer(data);
});

// A player left the game
socket.on('playerLeft', (data) => {
  removeOtherPlayer(data.id);
});

// ============================================
// WAITING ROOM DISPLAY
// Shows who's in the room and their status
// ============================================

function showWaitingRoom(data) {
  // Switch to waiting screen
  document.getElementById('lobby-choice').style.display = 'none';
  document.getElementById('lobby-create').style.display = 'none';
  document.getElementById('lobby-join').style.display = 'none';
  document.getElementById('lobby-waiting').style.display = 'block';

  // Show room code
  document.getElementById('room-code').textContent = data.code;
  mpState.roomCode = data.code;

  // Show player list
  const listEl = document.getElementById('player-list');
  listEl.innerHTML = '';

  const playerIds = Object.keys(data.players);
  for (const id of playerIds) {
    const p = data.players[id];
    const div = document.createElement('div');
    div.className = 'player-entry';

    const dot = document.createElement('span');
    dot.className = 'player-dot';
    dot.style.background = p.color;

    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = p.name;

    const status = document.createElement('span');
    status.className = 'player-status';
    status.textContent = p.ready ? 'Ready!' : 'Waiting...';
    status.style.color = p.ready ? '#4ade80' : '#aaa';

    div.appendChild(dot);
    div.appendChild(name);
    div.appendChild(status);
    listEl.appendChild(div);
  }

  // Update waiting status
  const count = playerIds.length;
  const statusEl = document.getElementById('waiting-status');
  if (count < data.maxPlayers) {
    statusEl.textContent = `${count}/${data.maxPlayers} players - Share code: ${data.code}`;
  } else {
    statusEl.textContent = `${count}/${data.maxPlayers} players - Everyone press Ready!`;
  }
}

// ============================================
// OTHER PLAYERS IN 3D WORLD
// Creates 3D character meshes for teammates
// ============================================

// Create a simple 3D person for another player
function createOtherPlayerMesh(color) {
  const player = new THREE.Group();
  const colorHex = parseInt(color.replace('#', '0x'));
  const mat = new THREE.MeshLambertMaterial({ color: colorHex });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.4), mat);
  body.position.y = 1.35;
  body.castShadow = true;
  player.add(body);

  // Head
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 }); // Skin color
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), headMat);
  head.position.y = 2.1;
  head.castShadow = true;
  player.add(head);

  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.3), legMat);
  legL.position.set(-0.15, 0.55, 0);
  player.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.3), legMat);
  legR.position.set(0.15, 0.55, 0);
  player.add(legR);

  // Arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.25), mat);
  armL.position.set(-0.4, 1.3, 0);
  player.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.25), mat);
  armR.position.set(0.4, 1.3, 0);
  player.add(armR);

  // Name tag (we'll use a sprite later, for now just the mesh)
  player.userData.legs = [legL, legR];
  player.userData.armR = armR;

  return player;
}

// Update another player's position in the 3D world
function updateOtherPlayer(data) {
  if (!mpState.otherPlayers[data.id]) {
    // First time seeing this player - create their mesh
    // Find their color from room data
    const color = data.color || '#44aaff';
    const mesh = createOtherPlayerMesh(color);
    if (typeof scene !== 'undefined') {
      scene.add(mesh);
    }
    mpState.otherPlayers[data.id] = { mesh: mesh };
  }

  const other = mpState.otherPlayers[data.id];
  // Smooth movement (lerp = move 20% of the way each update)
  other.mesh.position.x += (data.x - other.mesh.position.x) * 0.2;
  other.mesh.position.z += (data.z - other.mesh.position.z) * 0.2;
  other.mesh.position.y = 0;
  other.mesh.rotation.y = data.rotationY || 0;

  // Animate swing
  if (data.isSwinging && other.mesh.userData.armR) {
    other.mesh.userData.armR.rotation.x = -1.5;
  } else if (other.mesh.userData.armR) {
    other.mesh.userData.armR.rotation.x = 0;
  }
}

// Remove a player who left
function removeOtherPlayer(id) {
  if (mpState.otherPlayers[id]) {
    if (mpState.otherPlayers[id].mesh.parent) {
      mpState.otherPlayers[id].mesh.parent.remove(mpState.otherPlayers[id].mesh);
    }
    delete mpState.otherPlayers[id];
  }
}

// Send our position to other players (called from game loop)
function sendPlayerPosition() {
  if (!mpState.inGame) return;
  socket.emit('playerUpdate', {
    x: playerState.position.x,
    y: 0,
    z: playerState.position.z,
    rotationY: playerState.mesh ? playerState.mesh.rotation.y : playerState.yaw,
    isSwinging: playerState.isSwinging
  });
}

// Set up the lobby when the page loads
setupLobby();

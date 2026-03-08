// ============================================
// NARRATIVE.JS - Story, lore, and atmosphere!
//
// Features:
//   #22 - Kid Backstory Comics (unlocked on rescue)
//   #24 - The Trader's Stories (cycling dialogue)
//   #25 - Cave Echoes (directional color tint)
//   #41 - The Cultist Circle (creepy ritual ring)
//
// Globals used from other files:
//   scene, totalTime, playerState, dayNightState,
//   campfireState, enemies[], kidCaves[], kidState,
//   traderState, showLootText()
// ============================================

// --- NARRATIVE STATE ---
const narrativeState = {
  // #22 - Kid Comics
  unlockedComics: { dino: false, kraken: false, squid: false, koala: false },

  // #24 - Trader dialogue cycling
  traderDialogueIndex: 0,

  // #25 - Cave echoes
  caveEchoOverlayActive: false,

  // #41 - Cultist circle
  cultistCircle: null,         // { stones: [], candles: [], lights: [], cultists: [], centerLight: null }
  cultistCircleTriggered: false
};


// ============================================
// #22 - KID BACKSTORY COMICS
// After rescuing each kid, a 4-panel comic
// is unlocked. Press K to view them.
// ============================================

// The comic data for each kid - 4 panels of story
const KID_COMICS = {
  dino: {
    name: 'Dino Kid',
    color: '#cc2222',
    panels: [
      { text: 'Dino Kid loved exploring caves...', scene: 'cave' },
      { text: 'One day she found a cave that glowed red...', scene: 'glow' },
      { text: 'The wolves were waiting inside.', scene: 'wolves' },
      { text: "She put on her bravest face and waited... 'Someone will come.'", scene: 'waiting' }
    ]
  },
  kraken: {
    name: 'Kraken Kid',
    color: '#2244cc',
    panels: [
      { text: 'Kraken Kid heard crying near the stream...', scene: 'stream' },
      { text: 'A tiny fish was trapped between rocks.', scene: 'fish' },
      { text: 'While helping the fish, shadows surrounded her...', scene: 'shadows' },
      { text: "'The forest won't keep me forever,' she whispered.", scene: 'whisper' }
    ]
  },
  squid: {
    name: 'Squid Kid',
    color: '#ddcc22',
    panels: [
      { text: 'Squid Kid found an old treasure map at camp...', scene: 'map' },
      { text: 'She followed it deep into the forest...', scene: 'forest' },
      { text: 'The map led to a cage, not treasure.', scene: 'cage' },
      { text: "She held her hat tight. 'My friends will find me.'", scene: 'hope' }
    ]
  },
  koala: {
    name: 'Koala Kid',
    color: '#8844aa',
    panels: [
      { text: "Koala Kid couldn't sleep. The stars were too beautiful.", scene: 'stars' },
      { text: 'She snuck past the campfire to watch them...', scene: 'sneak' },
      { text: 'The bears found her sitting alone, looking up.', scene: 'bears' },
      { text: "'I just wanted to see the stars,' she said softly.", scene: 'soft' }
    ]
  }
};

// Simple CSS art shapes for each scene type (drawn with divs)
const PANEL_ART = {
  // Dino Kid panels
  cave:    '<div style="position:relative;height:60px;margin:8px 0"><div style="width:50px;height:40px;background:#555;border-radius:25px 25px 0 0;margin:auto"></div><div style="width:30px;height:15px;background:#333;margin:-5px auto 0"></div></div>',
  glow:    '<div style="position:relative;height:60px;margin:8px 0"><div style="width:50px;height:40px;background:#555;border-radius:25px 25px 0 0;margin:auto;box-shadow:0 0 20px #cc2222"></div><div style="width:8px;height:8px;background:#ff4444;border-radius:50%;position:absolute;left:50%;top:15px;transform:translateX(-50%);box-shadow:0 0 15px #ff4444"></div></div>',
  wolves:  '<div style="position:relative;height:60px;margin:8px 0;display:flex;justify-content:center;gap:8px;align-items:flex-end"><div style="width:12px;height:20px;background:#666;border-radius:3px 3px 0 0"></div><div style="width:14px;height:24px;background:#555;border-radius:3px 3px 0 0"></div><div style="width:12px;height:20px;background:#666;border-radius:3px 3px 0 0"></div><div style="width:4px;height:4px;background:#ff0000;border-radius:50%;position:absolute;left:calc(50% - 9px);top:34px"></div><div style="width:4px;height:4px;background:#ff0000;border-radius:50%;position:absolute;left:calc(50% + 5px);top:34px"></div></div>',
  waiting: '<div style="position:relative;height:60px;margin:8px 0"><div style="width:20px;height:25px;background:#cc2222;border-radius:5px 5px 0 0;margin:auto"></div><div style="width:16px;height:18px;background:#ffdd88;border-radius:4px;margin:-2px auto 0"></div><div style="width:12px;height:20px;background:#fff;margin:-2px auto 0;border-radius:0 0 3px 3px"></div></div>',

  // Kraken Kid panels
  stream:  '<div style="position:relative;height:60px;margin:8px 0"><div style="width:80%;height:12px;background:linear-gradient(90deg,#2244cc,#44aaff,#2244cc);margin:auto;margin-top:30px;border-radius:6px;opacity:0.7"></div><div style="width:60%;height:8px;background:linear-gradient(90deg,#44aaff,#2244cc,#44aaff);margin:4px auto 0;border-radius:4px;opacity:0.5"></div></div>',
  fish:    '<div style="position:relative;height:60px;margin:8px 0;display:flex;justify-content:center;align-items:center"><div style="width:40px;height:30px;background:#888;border-radius:3px;display:flex;align-items:center;justify-content:center;gap:3px"><div style="width:6px;height:6px;background:#888;border-radius:3px"></div></div><div style="width:14px;height:8px;background:#44aaff;border-radius:50%;position:absolute;top:28px"></div></div>',
  shadows: '<div style="position:relative;height:60px;margin:8px 0;display:flex;justify-content:center;align-items:flex-end;gap:4px"><div style="width:15px;height:40px;background:#222;border-radius:4px 4px 0 0;opacity:0.6"></div><div style="width:12px;height:30px;background:#222;border-radius:4px 4px 0 0;opacity:0.5"></div><div style="width:10px;height:12px;background:#2244cc;border-radius:3px;position:absolute;bottom:5px"></div><div style="width:15px;height:35px;background:#222;border-radius:4px 4px 0 0;opacity:0.6"></div><div style="width:12px;height:45px;background:#222;border-radius:4px 4px 0 0;opacity:0.5"></div></div>',
  whisper: '<div style="position:relative;height:60px;margin:8px 0"><div style="width:18px;height:14px;background:#2244cc;border-radius:5px 5px 0 0;margin:auto;margin-top:12px"></div><div style="width:14px;height:16px;background:#ffdd88;border-radius:4px;margin:-2px auto 0"></div><div style="width:10px;height:18px;background:#44aaff;margin:-2px auto 0;border-radius:0 0 3px 3px"></div><div style="font-size:8px;color:#aaa;text-align:center;margin-top:4px;font-style:italic">...</div></div>',

  // Squid Kid panels
  map:     '<div style="position:relative;height:60px;margin:8px 0"><div style="width:40px;height:30px;background:#d4b873;border:1px solid #a08040;margin:auto;margin-top:10px;border-radius:2px;position:relative"><div style="width:1px;height:20px;background:#884422;position:absolute;left:10px;top:5px;transform:rotate(20deg)"></div><div style="width:1px;height:15px;background:#884422;position:absolute;left:20px;top:3px;transform:rotate(-10deg)"></div><div style="width:6px;height:6px;background:#cc0000;border-radius:50%;position:absolute;right:5px;bottom:5px"></div></div></div>',
  forest:  '<div style="position:relative;height:60px;margin:8px 0;display:flex;justify-content:center;align-items:flex-end;gap:2px"><div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:25px solid #1a5a1a"></div><div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:35px solid #1a6b1a"></div><div style="width:8px;height:10px;background:#ddcc22;border-radius:3px;position:absolute;bottom:2px"></div><div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:30px solid #1a5a1a"></div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:20px solid #1a6b1a"></div></div>',
  cage:    '<div style="position:relative;height:60px;margin:8px 0"><div style="width:40px;height:35px;border:2px solid #888;margin:auto;margin-top:10px;position:relative"><div style="width:1px;height:35px;background:#888;position:absolute;left:8px"></div><div style="width:1px;height:35px;background:#888;position:absolute;left:18px"></div><div style="width:1px;height:35px;background:#888;position:absolute;left:28px"></div></div></div>',
  hope:    '<div style="position:relative;height:60px;margin:8px 0"><div style="width:18px;height:14px;background:#ccaa77;border-radius:5px 5px 0 0;margin:auto;margin-top:12px"></div><div style="width:14px;height:16px;background:#ffdd88;border-radius:4px;margin:-2px auto 0"></div><div style="width:10px;height:18px;background:#223366;margin:-2px auto 0;border-radius:0 0 3px 3px"></div><div style="width:4px;height:4px;background:#ffee88;border-radius:50%;position:absolute;right:25%;top:5px;box-shadow:0 0 6px #ffee88"></div></div>',

  // Koala Kid panels
  stars:   '<div style="position:relative;height:60px;margin:8px 0;background:linear-gradient(180deg,#111133,#222244);border-radius:4px;overflow:hidden"><div style="width:3px;height:3px;background:#fff;border-radius:50%;position:absolute;left:15%;top:10%;box-shadow:0 0 4px #fff"></div><div style="width:2px;height:2px;background:#fff;border-radius:50%;position:absolute;left:40%;top:20%;box-shadow:0 0 3px #fff"></div><div style="width:3px;height:3px;background:#fff;border-radius:50%;position:absolute;left:70%;top:8%;box-shadow:0 0 4px #fff"></div><div style="width:2px;height:2px;background:#fff;border-radius:50%;position:absolute;left:55%;top:30%;box-shadow:0 0 3px #fff"></div><div style="width:4px;height:4px;background:#ffffaa;border-radius:50%;position:absolute;left:85%;top:15%;box-shadow:0 0 6px #ffffaa"></div><div style="width:2px;height:2px;background:#fff;border-radius:50%;position:absolute;left:25%;top:35%;box-shadow:0 0 3px #fff"></div></div>',
  sneak:   '<div style="position:relative;height:60px;margin:8px 0"><div style="width:20px;height:15px;background:#ff6622;border-radius:50%;margin:auto;margin-top:30px;box-shadow:0 0 15px #ff4400,0 -5px 10px #ffaa00;opacity:0.8"></div><div style="width:10px;height:16px;background:#eeccdd;border-radius:3px;position:absolute;left:65%;top:15px"></div><div style="font-size:7px;position:absolute;left:62%;top:10px;color:#aaa">tip-toe</div></div>',
  bears:   '<div style="position:relative;height:60px;margin:8px 0;display:flex;justify-content:center;align-items:flex-end;gap:6px"><div style="width:20px;height:25px;background:#4a3728;border-radius:5px 5px 0 0"></div><div style="width:8px;height:12px;background:#eeccdd;border-radius:3px;margin-bottom:0"></div><div style="width:20px;height:28px;background:#4a3728;border-radius:5px 5px 0 0"></div></div>',
  soft:    '<div style="position:relative;height:60px;margin:8px 0;background:linear-gradient(180deg,#111133 60%,#222244);border-radius:4px;overflow:hidden"><div style="width:3px;height:3px;background:#fff;border-radius:50%;position:absolute;left:20%;top:12%;box-shadow:0 0 4px #fff"></div><div style="width:2px;height:2px;background:#fff;border-radius:50%;position:absolute;left:50%;top:8%;box-shadow:0 0 3px #fff"></div><div style="width:3px;height:3px;background:#fff;border-radius:50%;position:absolute;left:75%;top:18%;box-shadow:0 0 4px #fff"></div><div style="width:12px;height:14px;background:#eeccdd;border-radius:4px 4px 0 0;position:absolute;bottom:8px;left:50%;transform:translateX(-50%)"></div><div style="width:8px;height:10px;background:#ffdd88;border-radius:3px;position:absolute;bottom:0;left:50%;transform:translateX(-50%)"></div></div>'
};

// Create the comic viewer overlay (injected into the DOM once)
function createComicViewerDOM() {
  // Skip if already created
  if (document.getElementById('comic-viewer')) return;

  const overlay = document.createElement('div');
  overlay.id = 'comic-viewer';
  overlay.style.cssText = `
    display: none;
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
  `;

  // Title bar
  const title = document.createElement('div');
  title.style.cssText = `
    text-align: center;
    color: #ddd;
    font-size: 24px;
    font-family: monospace;
    margin-bottom: 20px;
    letter-spacing: 2px;
  `;
  title.textContent = 'Kid Backstory Comics';
  overlay.appendChild(title);

  // Hint text
  const hint = document.createElement('div');
  hint.style.cssText = `
    text-align: center;
    color: #777;
    font-size: 13px;
    font-family: monospace;
    margin-bottom: 24px;
  `;
  hint.textContent = 'Press K to close  |  Rescue kids to unlock their stories';
  overlay.appendChild(hint);

  // Container for all 4 kid comics
  const comicsContainer = document.createElement('div');
  comicsContainer.id = 'comics-container';
  comicsContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
    max-width: 1100px;
    margin: 0 auto;
  `;
  overlay.appendChild(comicsContainer);

  // Build a comic strip for each kid
  const kidOrder = ['dino', 'kraken', 'squid', 'koala'];
  for (const kidId of kidOrder) {
    const comic = KID_COMICS[kidId];
    const strip = document.createElement('div');
    strip.id = 'comic-strip-' + kidId;
    strip.style.cssText = `
      width: 240px;
      background: #1a1a1a;
      border: 3px solid ${comic.color};
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 0 15px ${comic.color}44;
      position: relative;
    `;

    // Kid name header
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      text-align: center;
      color: ${comic.color};
      font-size: 16px;
      font-weight: bold;
      font-family: monospace;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    nameEl.textContent = comic.name;
    strip.appendChild(nameEl);

    // Lock overlay (shown when comic is not unlocked)
    const lockOverlay = document.createElement('div');
    lockOverlay.id = 'comic-lock-' + kidId;
    lockOverlay.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      z-index: 2;
    `;
    const lockText = document.createElement('div');
    lockText.style.cssText = `
      color: #666;
      font-size: 14px;
      font-family: monospace;
      text-align: center;
      padding: 20px;
    `;
    lockText.innerHTML = '&#128274;<br>Rescue ' + comic.name + '<br>to unlock';
    lockOverlay.appendChild(lockText);
    strip.appendChild(lockOverlay);

    // 4 panels
    for (let p = 0; p < 4; p++) {
      const panel = comic.panels[p];
      const panelEl = document.createElement('div');
      panelEl.style.cssText = `
        background: #222;
        border: 1px solid ${comic.color}66;
        border-radius: 4px;
        padding: 8px;
        margin-bottom: ${p < 3 ? '8px' : '0'};
      `;

      // Panel number
      const panelNum = document.createElement('div');
      panelNum.style.cssText = `
        color: ${comic.color}88;
        font-size: 9px;
        font-family: monospace;
        margin-bottom: 4px;
      `;
      panelNum.textContent = 'PANEL ' + (p + 1);
      panelEl.appendChild(panelNum);

      // Simple CSS art scene
      const artEl = document.createElement('div');
      artEl.innerHTML = PANEL_ART[panel.scene] || '';
      panelEl.appendChild(artEl);

      // Story text
      const textEl = document.createElement('div');
      textEl.style.cssText = `
        color: #ccc;
        font-size: 12px;
        font-family: monospace;
        line-height: 1.4;
        text-align: center;
        font-style: italic;
      `;
      textEl.textContent = panel.text;
      panelEl.appendChild(textEl);

      strip.appendChild(panelEl);
    }

    comicsContainer.appendChild(strip);
  }

  document.body.appendChild(overlay);
}

// Called after rescuing a kid - unlock their comic
function showKidComic(kidId) {
  narrativeState.unlockedComics[kidId] = true;

  // Remove the lock overlay for this kid's comic
  const lockEl = document.getElementById('comic-lock-' + kidId);
  if (lockEl) {
    lockEl.style.display = 'none';
  }

  // Show a hint that a comic was unlocked
  showLootText('Comic unlocked! Press K to read ' + (KID_COMICS[kidId] ? KID_COMICS[kidId].name : kidId) + "'s story.");
}

// Toggle the comic viewer overlay (K key)
function toggleComicViewer() {
  // Ensure the DOM is built
  createComicViewerDOM();

  const viewer = document.getElementById('comic-viewer');
  if (!viewer) return;

  if (viewer.style.display === 'none' || viewer.style.display === '') {
    // Opening - refresh lock states
    for (const kidId of ['dino', 'kraken', 'squid', 'koala']) {
      const lockEl = document.getElementById('comic-lock-' + kidId);
      if (lockEl) {
        lockEl.style.display = narrativeState.unlockedComics[kidId] ? 'none' : 'flex';
      }
    }
    viewer.style.display = 'block';
  } else {
    viewer.style.display = 'none';
  }
}


// ============================================
// #24 - THE TRADER'S STORIES
// Each visit, the trader says something
// different - cycling through lore lines.
// ============================================

const TRADER_STORIES = [
  "I've walked these woods longer than the trees remember...",
  "The children's hats... they are not just hats, you know.",
  "The fog was not always here. Something called it.",
  "I once knew a camp like yours. It didn't survive Night 50.",
  "The deer... they used to walk on four legs.",
  "Every campfire pushes the darkness back a little further.",
  "The cultists serve something older than the forest itself.",
  "You remind me of someone I knew... before the first night.",
  "Trade well, young one. Not everything of value fits in a sack.",
  "When the aurora comes, even the wolves look up in wonder."
];

const TRADER_FINAL_LINE = "My work here is done. May the stars remember your name.";

// Returns a dialogue line for the trader, cycling through the pool
function getTraderDialogue() {
  // If all trades are done, always return the farewell
  if (traderState.allDone) {
    return TRADER_FINAL_LINE;
  }

  // Cycle through stories in order, wrapping around
  const line = TRADER_STORIES[narrativeState.traderDialogueIndex % TRADER_STORIES.length];
  narrativeState.traderDialogueIndex++;
  return line;
}


// ============================================
// #25 - CAVE ECHOES
// When near an unrescued kid cave, the screen
// gets a colored border-glow that pulses like
// a heartbeat, guiding you toward the child.
// ============================================

// Kid color map for echoes (matches kid tent/key colors)
const CAVE_ECHO_COLORS = {
  dino:   '#cc2222',
  kraken: '#2244cc',
  squid:  '#ddcc22',
  koala:  '#8844aa'
};

const CAVE_ECHO_RANGE = 30; // Max range to feel the echo

// Create the echo overlay div (injected once)
function createCaveEchoDOM() {
  if (document.getElementById('cave-echo-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'cave-echo-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 100;
    border: 8px solid transparent;
    box-sizing: border-box;
    border-radius: 0;
    transition: border-color 0.3s ease;
    opacity: 0;
  `;
  document.body.appendChild(overlay);
}

// Called every frame from the game loop integration
function updateCaveEchoes() {
  // Ensure overlay exists
  createCaveEchoDOM();

  const overlay = document.getElementById('cave-echo-overlay');
  if (!overlay) return;

  // Find the nearest unrescued cave
  let nearestCave = null;
  let nearestDist = Infinity;

  for (const cave of kidCaves) {
    if (cave.rescued) continue;

    const dx = playerState.position.x - cave.position.x;
    const dz = playerState.position.z - cave.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < nearestDist && dist < CAVE_ECHO_RANGE) {
      nearestDist = dist;
      nearestCave = cave;
    }
  }

  // No cave in range? Hide overlay
  if (!nearestCave) {
    if (narrativeState.caveEchoOverlayActive) {
      overlay.style.opacity = '0';
      overlay.style.borderColor = 'transparent';
      overlay.style.boxShadow = 'none';
      narrativeState.caveEchoOverlayActive = false;
    }
    return;
  }

  narrativeState.caveEchoOverlayActive = true;

  // Get kid color
  const kidId = nearestCave.config ? nearestCave.config.id : nearestCave.id;
  const echoColor = CAVE_ECHO_COLORS[kidId] || '#ffffff';

  // Calculate intensity based on distance (closer = stronger)
  // At distance 0: intensity = 0.3 (max), at distance 30: intensity = 0.05 (min)
  const t = Math.max(0, Math.min(1, nearestDist / CAVE_ECHO_RANGE)); // 0 (close) to 1 (far)
  const baseOpacity = 0.3 - (t * 0.25); // 0.3 at close, 0.05 at far

  // Heartbeat pulse: period scales with distance
  // Close (5 units): 0.5s period, Far (30 units): 3s period
  // Clamp distance to [5, 30] for pulse calculation
  const clampedDist = Math.max(5, Math.min(30, nearestDist));
  const pulsePeriod = 0.5 + ((clampedDist - 5) / 25) * 2.5; // 0.5s to 3s

  // Heartbeat uses a sharper wave: two quick bumps like a real heartbeat
  const pulsePhase = (totalTime % pulsePeriod) / pulsePeriod; // 0 to 1
  let heartbeat;
  if (pulsePhase < 0.15) {
    // First beat (sharp bump)
    heartbeat = Math.sin(pulsePhase / 0.15 * Math.PI);
  } else if (pulsePhase < 0.25) {
    // Brief pause between beats
    heartbeat = 0;
  } else if (pulsePhase < 0.40) {
    // Second beat (slightly weaker)
    heartbeat = Math.sin((pulsePhase - 0.25) / 0.15 * Math.PI) * 0.7;
  } else {
    // Resting phase
    heartbeat = 0;
  }

  // Final opacity combines base + heartbeat modulation
  const finalOpacity = baseOpacity + heartbeat * baseOpacity * 0.8;

  // Apply the glow
  overlay.style.opacity = String(Math.max(0, Math.min(1, finalOpacity)));
  overlay.style.borderColor = echoColor;
  overlay.style.boxShadow = `inset 0 0 40px ${echoColor}, inset 0 0 80px ${echoColor}44`;
}


// ============================================
// #41 - THE CULTIST CIRCLE
// When cultists spawn at campfire level 3,
// arrange them in a ritual circle with
// standing stones, candles, and a purple glow.
// The synchronized head-turn is the scare.
// ============================================

// Initialize the cultist circle at a given position in the world
function initCultistCircle(targetScene, position) {
  if (narrativeState.cultistCircle) return; // Already exists

  const circleRadius = 4;
  const stoneCount = 6;

  const stones = [];
  const candles = [];
  const lights = [];

  // --- STANDING STONES: tall thin monoliths in a ring ---
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2;
    const sx = position.x + Math.cos(angle) * circleRadius;
    const sz = position.z + Math.sin(angle) * circleRadius;

    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2, 0.3),
      stoneMat
    );
    stone.position.set(sx, 1, sz);
    // Slightly tilt each stone for an ancient, weathered look
    stone.rotation.x = (Math.random() - 0.5) * 0.1;
    stone.rotation.z = (Math.random() - 0.5) * 0.1;
    stone.castShadow = true;
    targetScene.add(stone);
    stones.push(stone);

    // --- DARK CANDLE between this stone and the next ---
    const nextAngle = ((i + 1) / stoneCount) * Math.PI * 2;
    const midAngle = (angle + nextAngle) / 2;
    const cx = position.x + Math.cos(midAngle) * (circleRadius - 0.5);
    const cz = position.z + Math.sin(midAngle) * (circleRadius - 0.5);

    // Candle body (small dark cylinder)
    const candleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6),
      candleMat
    );
    candle.position.set(cx, 0.15, cz);
    targetScene.add(candle);
    candles.push(candle);

    // Tiny flame on top (orange glow)
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    const flame = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.08, 0.04),
      flameMat
    );
    flame.position.set(cx, 0.35, cz);
    targetScene.add(flame);
    candles.push(flame);

    // Small orange point light for each candle
    const candleLight = new THREE.PointLight(0xff6600, 0.3, 3);
    candleLight.position.set(cx, 0.5, cz);
    targetScene.add(candleLight);
    lights.push(candleLight);
  }

  // --- PURPLE AMBIENT LIGHT in the center ---
  const centerLight = new THREE.PointLight(0x8844aa, 0.8, 10);
  centerLight.position.set(position.x, 1.5, position.z);
  targetScene.add(centerLight);

  // --- GROUND MARKING: a dark circle on the ground ---
  const groundMark = new THREE.Mesh(
    new THREE.CircleGeometry(circleRadius - 0.5, 24),
    new THREE.MeshLambertMaterial({ color: 0x220022, transparent: true, opacity: 0.6 })
  );
  groundMark.rotation.x = -Math.PI / 2;
  groundMark.position.set(position.x, 0.02, position.z);
  targetScene.add(groundMark);

  narrativeState.cultistCircle = {
    position: { x: position.x, z: position.z },
    stones: stones,
    candles: candles,
    lights: lights,
    centerLight: centerLight,
    groundMark: groundMark,
    cultists: [],          // Will be populated with enemy references
    triggered: false,
    triggerStartTime: 0,   // When the scare started
    triggerPhase: 'none'   // 'none' -> 'turning' -> 'staring' -> 'chasing'
  };
}

// Register cultists that belong to the circle (call after spawning them)
function addCultistToCircle(enemy) {
  if (!narrativeState.cultistCircle) return;
  narrativeState.cultistCircle.cultists.push(enemy);
}

// Position cultists in a circle facing the center (call after spawning)
function arrangeCultistsInCircle() {
  const circle = narrativeState.cultistCircle;
  if (!circle || circle.cultists.length === 0) return;

  const count = circle.cultists.length;
  const radius = 3; // Slightly inside the stone circle

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = circle.position.x + Math.cos(angle) * radius;
    const z = circle.position.z + Math.sin(angle) * radius;

    const enemy = circle.cultists[i];
    if (enemy.mesh) {
      enemy.mesh.position.set(x, 0, z);
      // Face the center of the circle
      const toCenter = Math.atan2(
        circle.position.x - x,
        circle.position.z - z
      );
      enemy.mesh.rotation.y = toCenter;
      // Store original facing for the turn animation
      enemy._circleAngle = toCenter;
      enemy._circlePos = { x, z };
    }
  }
}

// Called every frame to update the cultist circle behavior
function updateCultistCircle() {
  const circle = narrativeState.cultistCircle;
  if (!circle) return;

  // Filter out dead cultists
  circle.cultists = circle.cultists.filter(c => c.health > 0);

  // Candle flicker animation
  for (let i = 0; i < circle.lights.length; i++) {
    const light = circle.lights[i];
    light.intensity = 0.2 + Math.sin(totalTime * 5 + i * 1.7) * 0.15;
  }

  // Purple center light pulse (slow, ominous throb)
  if (circle.centerLight) {
    circle.centerLight.intensity = 0.6 + Math.sin(totalTime * 1.2) * 0.3;
  }

  // If already fully triggered (all chasing), nothing more to do
  if (narrativeState.cultistCircleTriggered && circle.triggerPhase === 'chasing') {
    return;
  }

  // If no cultists left, nothing to trigger
  if (circle.cultists.length === 0) return;

  // --- IDLE BEHAVIOR: cultists face center, override normal AI ---
  if (!circle.triggered) {
    // Keep cultists facing center and idle
    for (const cultist of circle.cultists) {
      if (cultist.state === 'idle' && cultist._circleAngle !== undefined) {
        cultist.mesh.rotation.y = cultist._circleAngle;
        // Keep them in position (override wandering)
        if (cultist._circlePos) {
          cultist.mesh.position.x = cultist._circlePos.x;
          cultist.mesh.position.z = cultist._circlePos.z;
        }
      }
    }

    // Check if player has entered detect range of ANY circle cultist
    let playerDetected = false;
    for (const cultist of circle.cultists) {
      const dx = playerState.position.x - cultist.mesh.position.x;
      const dz = playerState.position.z - cultist.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < cultist.detectRange) {
        playerDetected = true;
        break;
      }
    }

    if (playerDetected) {
      // --- THE SCARE BEGINS ---
      circle.triggered = true;
      circle.triggerStartTime = totalTime;
      circle.triggerPhase = 'turning';

      // Record starting rotation for each cultist (for smooth turn)
      for (const cultist of circle.cultists) {
        cultist._startRotY = cultist.mesh.rotation.y;

        // Calculate target rotation: face the player
        const dx = playerState.position.x - cultist.mesh.position.x;
        const dz = playerState.position.z - cultist.mesh.position.z;
        cultist._targetRotY = Math.atan2(dx, dz);
      }
    }
  }

  // --- TRIGGER ANIMATION PHASES ---
  if (circle.triggered) {
    const elapsed = totalTime - circle.triggerStartTime;

    if (circle.triggerPhase === 'turning') {
      // Phase 1: All cultists simultaneously turn to face the player (0.5 seconds)
      const turnProgress = Math.min(1, elapsed / 0.5);

      // Smooth easing (ease-out for a snappy, creepy feel)
      const eased = 1 - Math.pow(1 - turnProgress, 3);

      for (const cultist of circle.cultists) {
        if (cultist._startRotY !== undefined && cultist._targetRotY !== undefined) {
          // Compute shortest rotation path
          let diff = cultist._targetRotY - cultist._startRotY;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          cultist.mesh.rotation.y = cultist._startRotY + diff * eased;
        }
      }

      // After 0.5 seconds, move to the stare phase
      if (turnProgress >= 1) {
        circle.triggerPhase = 'staring';
        circle.stareStartTime = totalTime;
      }
    }

    if (circle.triggerPhase === 'staring') {
      // Phase 2: They just STARE at you for 0.5 seconds (the scary moment)
      const stareElapsed = totalTime - circle.stareStartTime;

      // Keep facing the player while staring
      for (const cultist of circle.cultists) {
        const dx = playerState.position.x - cultist.mesh.position.x;
        const dz = playerState.position.z - cultist.mesh.position.z;
        cultist.mesh.rotation.y = Math.atan2(dx, dz);
      }

      // Intensify the purple light during the stare (dramatic!)
      if (circle.centerLight) {
        circle.centerLight.intensity = 1.5 + Math.sin(totalTime * 10) * 0.5;
      }

      // After 0.5 seconds of staring, ATTACK!
      if (stareElapsed >= 0.5) {
        circle.triggerPhase = 'chasing';
        narrativeState.cultistCircleTriggered = true;

        // All cultists switch to chasing simultaneously
        for (const cultist of circle.cultists) {
          cultist.state = 'chasing';
          // Clear circle position overrides so normal AI takes over
          delete cultist._circleAngle;
          delete cultist._circlePos;
          delete cultist._startRotY;
          delete cultist._targetRotY;
        }

        // Fade the center light back to normal
        if (circle.centerLight) {
          circle.centerLight.intensity = 0.8;
        }
      }
    }
  }
}


// ============================================
// INTEGRATION HOOKS
// These wire narrative features into the
// existing game systems via global scope.
// ============================================

// Hook into the existing rescueKid function to unlock comics.
// We wrap the original function if it exists.
(function hookRescueKid() {
  // Wait for the DOM to be ready (scripts load in order,
  // kids.js is loaded before narrative.js)
  const _originalRescueKid = typeof rescueKid === 'function' ? rescueKid : null;

  if (_originalRescueKid) {
    // Override rescueKid to also unlock the comic
    window.rescueKid = function(cave) {
      _originalRescueKid(cave);

      // Unlock the comic for this kid
      const kidId = cave.config ? cave.config.id : (cave.id || null);
      if (kidId && KID_COMICS[kidId]) {
        showKidComic(kidId);
      }
    };
  }
})();

// Hook into updateTraderDialog to inject story lines
(function hookTraderDialog() {
  const _originalUpdateTraderDialog = typeof updateTraderDialog === 'function' ? updateTraderDialog : null;

  if (_originalUpdateTraderDialog) {
    window.updateTraderDialog = function() {
      _originalUpdateTraderDialog();

      // Add a story line below the trade request
      const msgEl = document.getElementById('trader-message');
      if (msgEl) {
        const storyLine = getTraderDialogue();
        // Append the story as a secondary line
        const storyEl = document.createElement('div');
        storyEl.style.cssText = `
          color: #aa8855;
          font-size: 11px;
          font-style: italic;
          margin-top: 6px;
          font-family: monospace;
        `;
        storyEl.textContent = '"' + storyLine + '"';
        storyEl.id = 'trader-story-line';

        // Remove old story line if present
        const old = document.getElementById('trader-story-line');
        if (old) old.remove();

        msgEl.parentElement.insertBefore(storyEl, msgEl.nextSibling);
      }
    };
  }
})();

// Hook into spawnEnemiesForNewZone to set up the cultist circle at level 3
(function hookCultistSpawn() {
  const _originalSpawnForZone = typeof spawnEnemiesForNewZone === 'function' ? spawnEnemiesForNewZone : null;

  if (_originalSpawnForZone) {
    window.spawnEnemiesForNewZone = function(level) {
      // For level 3, we intercept the cultist camp spawn to make it a circle
      if (level === 3) {
        // Spawn the normal zone enemies EXCEPT the cultist camp
        // We replicate the level 3 logic without the random cultist camp
        for (let i = 0; i < 3; i++) {
          const pos = randomPositionInZone(60, 100);
          spawnEnemy(scene, 'bear', pos.x, pos.z);
        }
        for (let i = 0; i < 3; i++) {
          const pos = randomPositionInZone(60, 100);
          spawnEnemy(scene, 'alphaWolf', pos.x, pos.z);
        }

        // Now spawn the cultist circle instead of the random camp
        const campCenter = randomPositionInZone(50, 90);
        initCultistCircle(scene, { x: campCenter.x, z: campCenter.z });

        // Spawn 4 cultists and add them to the circle
        for (let i = 0; i < 4; i++) {
          const enemy = spawnEnemy(scene, 'cultist', campCenter.x, campCenter.z);
          if (enemy) {
            addCultistToCircle(enemy);
          }
        }

        // Arrange them in the ritual formation
        arrangeCultistsInCircle();
      } else {
        // All other levels use the original behavior
        _originalSpawnForZone(level);
      }
    };
  }
})();

// Register the K key for the comic viewer
(function hookKeyboard() {
  document.addEventListener('keydown', function(event) {
    if (event.code === 'KeyK') {
      toggleComicViewer();
    }
  });
})();

// Create the cave echo overlay immediately so it is ready
createCaveEchoDOM();

// Create the comic viewer DOM structure
createComicViewerDOM();

console.log('narrative.js loaded - Comics, Trader Stories, Cave Echoes, Cultist Circle');

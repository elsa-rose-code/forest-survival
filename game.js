// ============================================
// GAME.JS - The main game file!
// The game only starts AFTER the lobby
// THIRD PERSON - camera follows behind player
// ============================================

// These will be set up when the game starts
let scene, camera, renderer;
let ground, sky, sunLight, ambientLight, trees, campfire, axe;
let clock, totalTime;
let positionUpdateTimer = 0;

// ============================================
// START GAME - called from multiplayer.js
// when all players are ready!
// ============================================
function startGame(players) {
  // --- CREATE THE 3D SCENE ---
  scene = new THREE.Scene();

  // --- CAMERA (now follows behind the player!) ---
  camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 0.1, 1000
  );

  // --- RENDERER ---
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // --- BUILD WORLD ---
  ground = createGround(scene);
  sky = createSky(scene);
  const lighting = createLighting(scene);
  ambientLight = lighting.ambientLight;
  sunLight = lighting.sunLight;
  trees = createForest(scene);
  createFog(scene);
  campfire = createCampfire(scene);

  // --- CREATE PLAYER CHARACTER ---
  // In third person, we can see our character!
  playerState.mesh = createPlayerMesh();
  scene.add(playerState.mesh);

  // --- PLAYER'S AXE (attached to the character, not the camera) ---
  axe = createAxe();
  playerState.mesh.add(axe);

  // --- SPAWN ENEMIES ---
  spawnInitialEnemies(scene);

  // --- SPAWN CHESTS ---
  spawnChests(scene);

  // --- SPAWN GROUND PICKUPS (coal, fuel, fuel canisters) ---
  spawnGroundPickups(scene);

  // --- CREATE THE FOG WALL (dark barrier at map edge) ---
  createFogWall(scene);

  // --- CREATE CRAFTING TABLE ---
  createCraftingTable(scene);

  // --- CONTROLS ---
  setupKeyboardControls();
  setupMouseLook(camera);
  setupMobileControls(); // Touch controls for phones/tablets!

  // --- CLOCK ---
  clock = new THREE.Clock();
  totalTime = 0;

  // --- WINDOW RESIZE ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- PETS ---
  initPets();

  // --- ATMOSPHERE (whispers, golden hour, weather, fog breathing, etc.) ---
  initAtmosphere(scene);

  // --- SOCIAL FEATURES (bracelets, singalong, flares, bulletin, emotes, etc.) ---
  initSocialFeatures();

  // --- COLLECTING (fireflies, bunny census, bestiary, constellations, journal, paintings, charms) ---
  initCollecting(scene);

  // --- CUSTOMIZATION (hats, outfits, garden) ---
  initCustomization();

  // --- ENDGAME (night ranks, weapons, dawn chest, difficulty, night 99, victory parade, torch relay) ---
  initEndgame();
  setupEndgameControls();

  // --- START THE LOOP! ---
  console.log('🌲 99 Nights in the Forest - Game starting!');
  gameLoop();
}

// ============================================
// THE GAME LOOP
// ============================================
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const delta = clock.getDelta();
  totalTime += delta;

  // Player movement & third person camera
  updatePlayer(camera, delta, trees);

  // Axe swing animation
  updateAxeSwing(axe, delta);

  // Day/night cycle
  updateDayNight(delta, sunLight, ambientLight, sky, scene);

  // Spawn enemies when night begins
  if (dayNightState.justBecameNight) {
    spawnNightEnemies(scene);
  }

  // Pelt trader (checks if they should arrive/leave, shows dialog)
  updateTrader();

  // Enemy AI
  updateEnemies(delta, playerState.position);

  // UI
  updateHealthBar();

  // Campfire
  updateCampfire(campfire, totalTime);

  // Chests (glow animation + "Press E" prompt)
  updateChests(delta, playerState.position);

  // Ground pickups (coal, fuel, fuel canisters)
  updateGroundPickups(playerState.position);

  // Campfire upgrade check (shows prompt when near fire)
  checkCampfireUpgrade();

  // Infernal sack cooking cooldown
  updateInfernalSackCooldown(delta);

  // Kid caves (spawn when campfire levels up, track guardians, show prompts)
  checkKidCaveSpawns();
  updateKids(playerState.position);

  // Pets (tamed pets follow AI, bunny friend, wandering cat)
  updatePets(delta);
  updateBunnyFriend(delta);
  updateWanderingCat(delta);

  // Pelt drops on the ground (glow + auto-pickup)
  updatePeltDrops(playerState.position);

  // Wood drops on the ground (glow + auto-pickup)
  updateWoodDrops(playerState.position);

  // Crafting table (prompt + sundial + compass updates)
  updateCraftingPrompt(playerState.position);
  updateSundialHUD();
  updateMapCompass();

  // Narrative features (cave echoes, cultist circle)
  if (typeof updateCaveEchoes === 'function') updateCaveEchoes();
  if (typeof updateCultistCircle === 'function') updateCultistCircle();

  // Atmosphere (whispers, golden hour, heartbeat, weather, fog, aurora, etc.)
  updateAtmosphere(delta, sunLight, ambientLight, sky);

  // Social features (bracelets, singalong, flares, compass, emotes, trails)
  updateSocialFeatures(delta);

  // Collecting (fireflies, bunny census, bestiary, constellations, journal, paintings, charms)
  updateCollecting(delta);

  // Customization (hats, outfits, garden)
  updateCustomization(delta);

  // Endgame (night ranks, weapons, dawn chest, difficulty, night 99, victory, torch relay)
  updateEndgame(delta);

  // Multiplayer position sync (~15 times per second)
  positionUpdateTimer += delta;
  if (positionUpdateTimer > 0.066) {
    sendPlayerPosition();
    positionUpdateTimer = 0;
  }

  // Draw!
  renderer.render(scene, camera);
}

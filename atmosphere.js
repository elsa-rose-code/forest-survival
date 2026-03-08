/* ============================================
   ATMOSPHERE.JS - Ambient effects, weather,
   overlays, and atmospheric dread systems
   for 99 Nights in the Forest
   ============================================ */


// ============================================
// STATE OBJECT
// Tracks everything for all atmosphere systems
// ============================================

const atmosphereState = {
  // Whispers (#20)
  lastWhisperTime: 0,
  nextWhisperDelay: 20,
  whisperActive: false,

  // Golden hour (#26)
  isGoldenHour: false,

  // First night (#27)
  firstNightDone: false,

  // Dawn relief (#28)
  dawnFlashed: false,

  // Aurora (#29)
  auroraActive: false,

  // Heartbeat (#30)
  heartbeatActive: false,

  // Weather (#31)
  weather: 'clear',
  weatherTimer: 0,
  raindrops: [],
  lastLightning: 0,
  starPoints: [],

  // Fog breathing (#32)
  fogShadows: [],

  // Parallax fog (#34)
  fogPlanes: [],

  // Storm flag for other systems
  stormActive: false
};


// ============================================
// WHISPER MESSAGES
// Cryptic text that appears during nighttime
// ============================================

const WHISPER_MESSAGES = [
  "they took us deeper...",
  "the fire remembers...",
  "four hats, four hearts, four doors.",
  "don't trust the deer...",
  "we can hear you...",
  "the fog is not fog...",
  "find us before night 99...",
  "the cultists know your name..."
];


// ============================================
// #20 - WHISPERS IN THE WOODS
// Random cryptic text at the top of screen
// during nighttime. Fades in over 2s, out over 2s.
// One whisper every 20-40 seconds.
// ============================================

function updateWhispers() {
  // Only whisper at night
  if (!dayNightState.isNight) {
    atmosphereState.whisperActive = false;
    return;
  }

  // Grab the whisper element, bail if it doesn't exist yet
  var whisperEl = document.getElementById('whisper-text');
  if (!whisperEl) return;

  // If a whisper is currently showing, let CSS handle the fade
  if (atmosphereState.whisperActive) return;

  // Check if enough time has passed since last whisper
  var elapsed = totalTime - atmosphereState.lastWhisperTime;
  if (elapsed < atmosphereState.nextWhisperDelay) return;

  // Time to show a whisper!
  atmosphereState.whisperActive = true;
  atmosphereState.lastWhisperTime = totalTime;

  // Pick a random delay for the NEXT whisper (20-40 seconds)
  atmosphereState.nextWhisperDelay = 20 + Math.random() * 20;

  // Pick a random message
  var msg = WHISPER_MESSAGES[Math.floor(Math.random() * WHISPER_MESSAGES.length)];
  whisperEl.textContent = msg;

  // Fade in over 2 seconds
  whisperEl.style.transition = 'opacity 2s ease-in';
  whisperEl.style.opacity = '1';
  whisperEl.style.display = 'block';

  // After 2s fully visible, then fade out over 2s
  setTimeout(function() {
    whisperEl.style.transition = 'opacity 2s ease-out';
    whisperEl.style.opacity = '0';

    // After fade out completes, hide and unlock
    setTimeout(function() {
      whisperEl.style.display = 'none';
      atmosphereState.whisperActive = false;
    }, 2000);
  }, 2000);
}


// ============================================
// #26 - GOLDEN HOUR
// Warm amber tint during pre-sunset window
// (dayNightState.time between 0.65 and 0.75).
// Boosts sunLight toward warm orange, ambientLight
// toward golden. Sets atmosphereState.isGoldenHour.
// ============================================

function updateGoldenHour(delta, sunLight, ambientLight, sky) {
  var t = dayNightState.time;

  // Check if we are in the golden hour window
  if (t >= 0.65 && t < 0.75) {
    atmosphereState.isGoldenHour = true;

    // How deep into golden hour are we? 0 at start, 1 at peak (0.75)
    var progress = (t - 0.65) / 0.10;

    // Warm orange tint for the sun - lerp from white toward warm amber
    // Base sun color: roughly (1.0, 0.95, 0.85)
    // Target golden color: (1.0, 0.65, 0.3) - deep warm amber
    var sunR = 1.0;
    var sunG = 0.95 - progress * 0.30;  // 0.95 -> 0.65
    var sunB = 0.85 - progress * 0.55;  // 0.85 -> 0.30

    sunLight.color.setRGB(sunR, sunG, sunB);

    // Boost sun intensity slightly during golden hour
    sunLight.intensity = 1.0 + progress * 0.15;

    // Warm golden tint for ambient light
    var ambR = 0.4 + progress * 0.25;   // slight warm push
    var ambG = 0.4 + progress * 0.10;
    var ambB = 0.4 - progress * 0.15;   // reduce blue

    ambientLight.color.setRGB(ambR, ambG, ambB);

    // Tint the sky mesh material if it exists
    if (sky && sky.material) {
      sky.material.color.setRGB(
        1.0,
        0.85 - progress * 0.15,
        0.7 - progress * 0.30
      );
    }

  } else {
    // Not golden hour anymore - reset sky tint if we were just in it
    if (atmosphereState.isGoldenHour) {
      if (sky && sky.material) {
        sky.material.color.setRGB(1, 1, 1);
      }
    }
    atmosphereState.isGoldenHour = false;
  }
}


// ============================================
// #27 - FIRST NIGHT PANIC
// One-time event: huge red flickering "NIGHT 1"
// text with screen shake on the very first night.
// Shows #first-night-overlay for 3 seconds.
// ============================================

function checkFirstNightPanic() {
  // Already triggered? Bail out
  if (atmosphereState.firstNightDone) return;

  // Only trigger on the FIRST justBecameNight when nightCount === 1
  if (!dayNightState.justBecameNight) return;
  if (dayNightState.nightCount !== 1) return;

  // Mark as done so this never fires again
  atmosphereState.firstNightDone = true;

  var overlay = document.getElementById('first-night-overlay');
  if (!overlay) return;

  // Show the overlay with huge red text
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.innerHTML = '<div class="first-night-text">NIGHT 1</div>';

  // Screen shake effect - rapidly offset the overlay div
  var shakeCount = 0;
  var shakeInterval = setInterval(function() {
    var offsetX = (Math.random() - 0.5) * 20;
    var offsetY = (Math.random() - 0.5) * 14;
    overlay.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px)';
    shakeCount++;

    // Stop shaking after ~1 second (about 20 shakes at 50ms interval)
    if (shakeCount > 20) {
      clearInterval(shakeInterval);
      overlay.style.transform = 'translate(0, 0)';
    }
  }, 50);

  // Flicker the text opacity rapidly for dramatic effect
  var flickerCount = 0;
  var flickerInterval = setInterval(function() {
    var textEl = overlay.querySelector('.first-night-text');
    if (textEl) {
      textEl.style.opacity = Math.random() > 0.3 ? '1' : '0.3';
    }
    flickerCount++;
    if (flickerCount > 40) {
      clearInterval(flickerInterval);
      if (textEl) textEl.style.opacity = '1';
    }
  }, 60);

  // Auto-hide after 3 seconds
  setTimeout(function() {
    overlay.style.transition = 'opacity 0.5s ease-out';
    overlay.style.opacity = '0';
    setTimeout(function() {
      overlay.style.display = 'none';
      overlay.style.transition = '';
    }, 500);
  }, 3000);
}


// ============================================
// #28 - DAWN RELIEF
// When dayNightState.time crosses 0.25 (dawn),
// flash a warm golden overlay #dawn-overlay
// from opacity 0.3 to 0 over 2 seconds.
// Only triggers once per dawn, resets at night.
// ============================================

function updateDawnRelief() {
  // Reset the flag when night falls so we can trigger again next dawn
  if (dayNightState.isNight) {
    atmosphereState.dawnFlashed = false;
    return;
  }

  // Already flashed this dawn cycle? Done
  if (atmosphereState.dawnFlashed) return;

  // Wait for the dawn crossing - justBecameDay is the signal
  if (!dayNightState.justBecameDay) return;

  // Trigger the dawn flash!
  atmosphereState.dawnFlashed = true;

  var dawnOverlay = document.getElementById('dawn-overlay');
  if (!dawnOverlay) return;

  // Show the warm golden overlay at partial opacity
  dawnOverlay.style.display = 'block';
  dawnOverlay.style.opacity = '0.3';
  dawnOverlay.style.transition = 'opacity 2s ease-out';

  // Use double-rAF to ensure the initial opacity is painted before fading
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      dawnOverlay.style.opacity = '0';
    });
  });

  // Hide the element after the fade completes
  setTimeout(function() {
    dawnOverlay.style.display = 'none';
    dawnOverlay.style.transition = '';
  }, 2100);
}


// ============================================
// #29 - AURORA NIGHT
// Every 10th night (nightCount 10, 20, 30...)
// show an aurora borealis CSS gradient overlay
// (green/purple bands). Announce "AURORA NIGHT"
// when it starts. Hide at dawn.
// ============================================

function updateAuroraNight() {
  var auroraOverlay = document.getElementById('aurora-overlay');
  if (!auroraOverlay) return;

  var nightCount = dayNightState.nightCount;

  // Is this an aurora night? Every 10th night, only active during that night
  var isAuroraNight = (nightCount > 0) && (nightCount % 10 === 0) && dayNightState.isNight;

  if (isAuroraNight && !atmosphereState.auroraActive) {
    // Aurora just started!
    atmosphereState.auroraActive = true;

    // Show the aurora overlay with animated gradient
    auroraOverlay.style.display = 'block';
    auroraOverlay.classList.add('aurora-active');

    // Show announcement text
    if (typeof showLootText === 'function') {
      showLootText("AURORA NIGHT");
    }

  } else if (!isAuroraNight && atmosphereState.auroraActive) {
    // Aurora night is over (dawn came or nightCount changed)
    atmosphereState.auroraActive = false;

    auroraOverlay.style.display = 'none';
    auroraOverlay.classList.remove('aurora-active');
  }
}


// ============================================
// #30 - HEARTBEAT HUD
// When playerState.health < 25% of maxHealth,
// show a pulsing red vignette. Pulse speed
// increases as health decreases. Fades out
// with relief when health recovers.
// ============================================

function updateHeartbeat() {
  var heartbeatOverlay = document.getElementById('heartbeat-overlay');
  if (!heartbeatOverlay) return;

  var healthRatio = playerState.health / playerState.maxHealth;
  var threshold = 0.25;

  if (healthRatio < threshold && playerState.alive) {
    // Low health - show heartbeat vignette!
    if (!atmosphereState.heartbeatActive) {
      atmosphereState.heartbeatActive = true;
      heartbeatOverlay.style.display = 'block';
      heartbeatOverlay.style.transition = '';
      heartbeatOverlay.style.opacity = '';
    }

    // Urgency: 0 at threshold, 1 at near-zero health
    var urgency = 1.0 - (healthRatio / threshold);

    // Pulse speed: faster as health drops (1.5s at threshold -> 0.4s at near-death)
    var pulseSpeed = 1.5 - urgency * 1.1;
    if (pulseSpeed < 0.4) pulseSpeed = 0.4;

    // Calculate pulse using sin wave
    var pulse = (Math.sin(totalTime * (Math.PI * 2 / pulseSpeed)) + 1) / 2;

    // Max opacity increases with urgency (0.3 at threshold -> 0.7 at near-death)
    var maxOpacity = 0.3 + urgency * 0.4;

    heartbeatOverlay.style.opacity = (pulse * maxOpacity).toFixed(3);

  } else if (atmosphereState.heartbeatActive) {
    // Health recovered or player died - fade out with relief effect
    atmosphereState.heartbeatActive = false;

    heartbeatOverlay.style.transition = 'opacity 0.8s ease-out';
    heartbeatOverlay.style.opacity = '0';

    setTimeout(function() {
      heartbeatOverlay.style.display = 'none';
      heartbeatOverlay.style.transition = '';
    }, 800);
  }
}


// ============================================
// #31 - WEATHER EVENTS
// Random weather that changes every 2-3
// day/night cycle transitions.
// States: 'clear', 'rain', 'storm', 'fog', 'starry'
// ============================================

// All possible weather states
var WEATHER_STATES = ['clear', 'rain', 'storm', 'fog', 'starry'];

// Rain particle count
var RAIN_PARTICLE_COUNT = 100;

// Lightning timing bounds (seconds)
var LIGHTNING_MIN_INTERVAL = 5;
var LIGHTNING_MAX_INTERVAL = 15;

// Saved base fog density so we can restore after weather changes
var _baseFogDensity = 0;
var _fogDensitySaved = false;

// How many day/night transitions until next weather change (randomized 2-3)
var _weatherChangeCycles = 2 + Math.floor(Math.random() * 2);


function updateWeather(delta) {
  // Save the base fog density on first call
  if (!_fogDensitySaved && scene.fog) {
    _baseFogDensity = scene.fog.density || 0.015;
    _fogDensitySaved = true;
  }

  // Track day/night transitions to know when to change weather
  if (dayNightState.justBecameDay || dayNightState.justBecameNight) {
    atmosphereState.weatherTimer++;
  }

  // Time to pick new weather?
  if (atmosphereState.weatherTimer >= _weatherChangeCycles) {
    atmosphereState.weatherTimer = 0;

    // Pick the next change threshold (2 or 3 cycles)
    _weatherChangeCycles = 2 + Math.floor(Math.random() * 2);

    // Clean up the old weather effects
    _cleanupWeather();

    // Pick a new weather state (avoid same one twice in a row)
    var newWeather;
    do {
      newWeather = WEATHER_STATES[Math.floor(Math.random() * WEATHER_STATES.length)];
    } while (newWeather === atmosphereState.weather && WEATHER_STATES.length > 1);

    atmosphereState.weather = newWeather;

    // Initialize the new weather
    _initWeatherState(newWeather);
  }

  // Update the active weather each frame
  switch (atmosphereState.weather) {
    case 'rain':
      _updateRain(delta);
      atmosphereState.stormActive = false;
      break;
    case 'storm':
      _updateRain(delta);
      _updateLightning();
      atmosphereState.stormActive = true;
      break;
    case 'fog':
      _updateFogWeather();
      atmosphereState.stormActive = false;
      break;
    case 'starry':
      _updateStarryNight();
      atmosphereState.stormActive = false;
      break;
    case 'clear':
    default:
      atmosphereState.stormActive = false;
      break;
  }
}


// Set up a new weather state when it begins
function _initWeatherState(weather) {
  switch (weather) {
    case 'rain':
      _createRaindrops();
      break;
    case 'storm':
      _createRaindrops();
      atmosphereState.lastLightning = totalTime;
      break;
    case 'fog':
      // Increase fog density
      if (scene.fog) {
        scene.fog.density = _baseFogDensity * 2.5;
      }
      break;
    case 'starry':
      // Decrease fog for clearer skies
      if (scene.fog) {
        scene.fog.density = _baseFogDensity * 0.4;
      }
      _createStarPoints();
      break;
  }
}


// Tear down old weather effects before switching
function _cleanupWeather() {
  // Remove rain particles from scene
  for (var i = 0; i < atmosphereState.raindrops.length; i++) {
    scene.remove(atmosphereState.raindrops[i]);
  }
  atmosphereState.raindrops = [];

  // Remove star points from scene
  for (var i = 0; i < atmosphereState.starPoints.length; i++) {
    scene.remove(atmosphereState.starPoints[i]);
  }
  atmosphereState.starPoints = [];

  // Reset fog density to baseline
  if (scene.fog) {
    scene.fog.density = _baseFogDensity;
  }

  // Clear storm flag
  atmosphereState.stormActive = false;
}


// Create ~100 small box meshes as rain particles
function _createRaindrops() {
  var rainGeo = new THREE.BoxGeometry(0.02, 0.4, 0.02);
  var rainMat = new THREE.MeshBasicMaterial({
    color: 0x8899bb,
    transparent: true,
    opacity: 0.4
  });

  for (var i = 0; i < RAIN_PARTICLE_COUNT; i++) {
    var drop = new THREE.Mesh(rainGeo, rainMat);

    // Spread around the player in a 40x40 area, random height
    drop.position.set(
      (Math.random() - 0.5) * 40,
      Math.random() * 25 + 5,
      (Math.random() - 0.5) * 40
    );

    scene.add(drop);
    atmosphereState.raindrops.push(drop);
  }
}


// Move rain particles downward, recycle when they hit the ground
function _updateRain(delta) {
  var drops = atmosphereState.raindrops;
  var playerPos = playerState.position;

  for (var i = 0; i < drops.length; i++) {
    var drop = drops[i];

    // Fall downward
    drop.position.y -= 18 * delta;

    // Hit the ground? Recycle to the top near the player
    if (drop.position.y < 0) {
      drop.position.y = 25 + Math.random() * 5;
      drop.position.x = playerPos.x + (Math.random() - 0.5) * 40;
      drop.position.z = playerPos.z + (Math.random() - 0.5) * 40;
    }
  }
}


// Occasional white ambient light flash (lightning) every 5-15 seconds
function _updateLightning() {
  var timeSinceLast = totalTime - atmosphereState.lastLightning;

  // Pick a random interval for the next strike
  // We check against a consistent threshold derived from lastLightning
  var nextStrike = LIGHTNING_MIN_INTERVAL + Math.random() * (LIGHTNING_MAX_INTERVAL - LIGHTNING_MIN_INTERVAL);

  if (timeSinceLast >= nextStrike) {
    atmosphereState.lastLightning = totalTime;

    // Flash the ambient light white briefly
    var originalColor = ambientLight.color.clone();
    var originalIntensity = ambientLight.intensity;

    ambientLight.color.setHex(0xffffff);
    ambientLight.intensity = 3.0;

    // Return to normal after a brief flash
    setTimeout(function() {
      ambientLight.color.copy(originalColor);
      ambientLight.intensity = originalIntensity;
    }, 100);

    // Second flash for realism (double-strike effect)
    setTimeout(function() {
      ambientLight.color.setHex(0xffffff);
      ambientLight.intensity = 2.0;
      setTimeout(function() {
        ambientLight.color.copy(originalColor);
        ambientLight.intensity = originalIntensity;
      }, 60);
    }, 200);
  }
}


// Fog weather - maintain increased density with subtle breathing
function _updateFogWeather() {
  if (scene.fog) {
    var breath = Math.sin(totalTime * 0.5) * 0.003;
    scene.fog.density = _baseFogDensity * 2.5 + breath;
  }
}


// Create firefly-like star points for starry weather
function _createStarPoints() {
  var starGeo = new THREE.SphereGeometry(0.06, 4, 4);
  var starMat = new THREE.MeshBasicMaterial({
    color: 0xffffcc,
    transparent: true,
    opacity: 0.7
  });

  // Spawn ~30 extra firefly-star points around the area
  for (var i = 0; i < 30; i++) {
    var star = new THREE.Mesh(starGeo, starMat.clone());
    star.position.set(
      (Math.random() - 0.5) * 60,
      3 + Math.random() * 10,
      (Math.random() - 0.5) * 60
    );
    // Random phase so each star flickers differently
    star.userData.phase = Math.random() * Math.PI * 2;
    star.userData.speed = 0.5 + Math.random() * 1.5;

    scene.add(star);
    atmosphereState.starPoints.push(star);
  }
}


// Animate starry night firefly-stars with bobbing and twinkling
function _updateStarryNight() {
  var stars = atmosphereState.starPoints;

  for (var i = 0; i < stars.length; i++) {
    var star = stars[i];
    var phase = star.userData.phase;
    var speed = star.userData.speed;

    // Gentle bobbing motion
    star.position.y += Math.sin(totalTime * speed + phase) * 0.003;
    star.position.x += Math.cos(totalTime * speed * 0.7 + phase) * 0.002;

    // Twinkle by modulating opacity
    star.material.opacity = 0.3 + 0.5 * Math.abs(Math.sin(totalTime * speed + phase));
  }

  // Decrease fog density for clearer skies (already set in init, maintain it)
  if (scene.fog) {
    scene.fog.density = _baseFogDensity * 0.4;
  }
}


// ============================================
// #32 - FOG BREATHES
// Fog wall opacity pulses between 0.75 and 0.90
// using a sin wave. Shadow sphere meshes orbit
// slowly inside the fog wall.
// ============================================

// Call once at startup to create 3-5 shadow meshes inside the fog wall
function initFogShadows(sceneRef) {
  var shadowGeo = new THREE.SphereGeometry(2, 8, 8);
  var shadowMat = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 0.4
  });

  // Create 3-5 shadow spheres
  var shadowCount = 3 + Math.floor(Math.random() * 3);

  for (var i = 0; i < shadowCount; i++) {
    var shadow = new THREE.Mesh(shadowGeo, shadowMat.clone());

    // Store orbit data for animation
    shadow.userData.orbitAngle = (i / shadowCount) * Math.PI * 2;  // evenly spaced
    shadow.userData.orbitSpeed = 0.05 + Math.random() * 0.05;      // slow orbit
    shadow.userData.orbitRadius = 48;  // roughly where the fog wall sits
    shadow.userData.yBob = Math.random() * Math.PI * 2;            // vertical bob phase

    shadow.position.y = 2;
    sceneRef.add(shadow);
    atmosphereState.fogShadows.push(shadow);
  }
}


function updateFogBreathing() {
  // Pulse the fog wall opacity using a sin wave
  // Traverse the scene looking for the fog wall mesh
  scene.traverse(function(child) {
    if (child.isMesh && child.userData && child.userData.isFogWall) {
      // Pulse opacity between 0.75 and 0.90
      var pulse = Math.sin(totalTime * 0.8);
      var opacity = 0.825 + pulse * 0.075;  // center 0.825, range +/- 0.075
      if (child.material) {
        child.material.opacity = opacity;
      }
    }
  });

  // Animate the shadow spheres orbiting inside the fog
  var shadows = atmosphereState.fogShadows;
  for (var i = 0; i < shadows.length; i++) {
    var shadow = shadows[i];
    var data = shadow.userData;

    // Advance orbit angle slowly
    data.orbitAngle += data.orbitSpeed * 0.016;  // ~60fps normalized

    // Position on the circular orbit
    shadow.position.x = Math.cos(data.orbitAngle) * data.orbitRadius;
    shadow.position.z = Math.sin(data.orbitAngle) * data.orbitRadius;

    // Gentle vertical bobbing
    data.yBob += 0.01;
    shadow.position.y = 2 + Math.sin(data.yBob) * 1.5;

    // Eerie fade in/out as they orbit
    shadow.material.opacity = 0.25 + Math.abs(Math.sin(data.orbitAngle * 0.5)) * 0.25;
  }
}


// ============================================
// #34 - PARALLAX FOG LAYERS
// 3 large semi-transparent planes at y=1, y=2,
// y=3 that drift slowly on sin/cos waves at
// different speeds. Opacity adjusts for day/night.
// ============================================

// Call once at startup to create the parallax fog planes
function initParallaxFog(sceneRef) {
  var fogColors = [0x334433, 0x2a3a2a, 0x3a4a3a];
  var heights = [1, 2, 3];

  for (var i = 0; i < 3; i++) {
    var planeGeo = new THREE.PlaneGeometry(80, 80);
    var planeMat = new THREE.MeshBasicMaterial({
      color: fogColors[i],
      transparent: true,
      opacity: 0.08,   // daytime default
      side: THREE.DoubleSide,
      depthWrite: false
    });

    var fogPlane = new THREE.Mesh(planeGeo, planeMat);
    fogPlane.rotation.x = -Math.PI / 2;  // lay flat (horizontal)
    fogPlane.position.y = heights[i];

    // Each layer drifts at its own pace for parallax effect
    fogPlane.userData.driftSpeedX = 0.1 + i * 0.08;   // layer 0: 0.10, 1: 0.18, 2: 0.26
    fogPlane.userData.driftSpeedZ = 0.07 + i * 0.06;
    fogPlane.userData.phaseX = i * 1.2;
    fogPlane.userData.phaseZ = i * 0.8;
    fogPlane.userData.layerIndex = i;

    sceneRef.add(fogPlane);
    atmosphereState.fogPlanes.push(fogPlane);
  }
}


function updateParallaxFog() {
  var planes = atmosphereState.fogPlanes;

  for (var i = 0; i < planes.length; i++) {
    var plane = planes[i];
    var data = plane.userData;

    // Drift position on sin/cos waves
    plane.position.x = Math.sin(totalTime * data.driftSpeedX + data.phaseX) * 8;
    plane.position.z = Math.cos(totalTime * data.driftSpeedZ + data.phaseZ) * 6;

    // Adjust opacity: 0.08 during day, 0.15 at night
    // smoothDay: 1 = full day, 0 = full night
    var dayOpacity = 0.08;
    var nightOpacity = 0.15;
    var smooth = (dayNightState.smoothDay !== undefined) ? dayNightState.smoothDay : 1;
    plane.material.opacity = nightOpacity + smooth * (dayOpacity - nightOpacity);
  }
}


// ============================================
// #42 - NIGHT COUNTER DREAD
// Visual effects on the #night-counter element
// when night falls. Milestones get ember effect.
// Night 99 gets permanent pulsing red.
// ============================================

// Milestone nights that get the ember effect
var MILESTONE_NIGHTS = [10, 25, 50, 75, 99];

function updateNightCounterDread() {
  if (!dayNightState.justBecameNight) return;

  var counterEl = document.getElementById('night-counter');
  if (!counterEl) return;

  var nightNum = dayNightState.nightCount;

  // Night 99 - permanent pulsing red (the final night)
  if (nightNum === 99) {
    counterEl.classList.remove('night-shatter', 'night-ember');
    counterEl.classList.add('night-99');
    return;  // permanent, no timeout needed
  }

  // Milestone nights (10, 25, 50, 75) get the ember effect
  if (MILESTONE_NIGHTS.indexOf(nightNum) !== -1) {
    counterEl.classList.add('night-ember');
    setTimeout(function() {
      counterEl.classList.remove('night-ember');
    }, 1000);
    return;
  }

  // Regular nights get the shatter effect
  counterEl.classList.add('night-shatter');
  setTimeout(function() {
    counterEl.classList.remove('night-shatter');
  }, 1000);
}


// ============================================
// MASTER UPDATE FUNCTION
// Call this from the game loop each frame.
// Runs all atmosphere systems in order.
// ============================================

function updateAtmosphere(delta, sunLight, ambientLight, sky) {
  // #20 - Whispers in the woods
  updateWhispers();

  // #26 - Golden hour lighting
  updateGoldenHour(delta, sunLight, ambientLight, sky);

  // #27 - First night panic (one-time check)
  checkFirstNightPanic();

  // #28 - Dawn relief flash
  updateDawnRelief();

  // #29 - Aurora night
  updateAuroraNight();

  // #30 - Heartbeat HUD
  updateHeartbeat();

  // #31 - Weather events
  updateWeather(delta);

  // #32 - Fog wall breathing + shadow orbiters
  updateFogBreathing();

  // #34 - Parallax fog layers
  updateParallaxFog();

  // #42 - Night counter dread effects
  updateNightCounterDread();
}


// ============================================
// INITIALIZATION
// Call once after the scene is set up.
// Creates persistent meshes and objects.
// ============================================

function initAtmosphere(sceneRef) {
  // Create shadow spheres inside the fog wall (#32)
  initFogShadows(sceneRef);

  // Create parallax fog planes (#34)
  initParallaxFog(sceneRef);
}

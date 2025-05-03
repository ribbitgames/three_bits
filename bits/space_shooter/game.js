import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

// Game state
let score = 0;
let lives = 3;
let gameOver = false;
let gameStarted = false;
let enemies = [];
let bullets = [];
let powerUps = [];
let particles = [];
let lastEnemySpawn = 0;
let lastPowerUpSpawn = 0;
let level = 1;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// DOM elements
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const gameOverElement = document.getElementById('game-over');
const levelElement = document.getElementById('level');
const startScreenElement = document.getElementById('start-screen');

// Mobile controls
let virtualJoystick = null;
let fireButton = null;
let autoFire = false;
let lastAutoFireTime = 0;

// Game settings
const settings = {
  enemySpawnRate: 1500,
  powerUpSpawnRate: 10000,
  enemySpeed: 0.05,
  playerSpeed: 0.15,
  bulletSpeed: 0.4,
  particleLifespan: 1000,
  invincibleTime: 2000,
  autoFireRate: 400 // Time in ms between auto-fire shots
};

// Create mobile controls
function createMobileControls() {
  if (!isMobile) return;
  
  // Create joystick container
  virtualJoystick = document.createElement('div');
  virtualJoystick.id = 'virtual-joystick';
  document.body.appendChild(virtualJoystick);
  
  // Create joystick inner pad
  const joystickInner = document.createElement('div');
  joystickInner.id = 'joystick-inner';
  virtualJoystick.appendChild(joystickInner);
  
  // Create fire button
  fireButton = document.createElement('div');
  fireButton.id = 'fire-button';
  fireButton.innerHTML = '🔥';
  document.body.appendChild(fireButton);
  
  // Create auto-fire toggle
  const autoFireToggle = document.createElement('div');
  autoFireToggle.id = 'auto-fire-toggle';
  autoFireToggle.innerHTML = 'AUTO: OFF';
  autoFireToggle.addEventListener('click', () => {
    autoFire = !autoFire;
    autoFireToggle.innerHTML = autoFire ? 'AUTO: ON' : 'AUTO: OFF';
    autoFireToggle.classList.toggle('active', autoFire);
  });
  document.body.appendChild(autoFireToggle);
  
  // Joystick variables
  let joystickActive = false;
  let joystickOrigin = { x: 0, y: 0 };
  let joystickPosition = { x: 0, y: 0 };
  const joystickRadius = parseInt(getComputedStyle(virtualJoystick).width) / 2;
  
  // Joystick touch events
  virtualJoystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const touch = e.touches[0];
    const rect = virtualJoystick.getBoundingClientRect();
    joystickOrigin.x = rect.left + rect.width / 2;
    joystickOrigin.y = rect.top + rect.height / 2;
    updateJoystickPosition(touch);
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    e.preventDefault();
    const touch = Array.from(e.touches).find(t => {
      const rect = virtualJoystick.getBoundingClientRect();
      return t.clientX > rect.left - 50 && t.clientX < rect.right + 50 &&
             t.clientY > rect.top - 50 && t.clientY < rect.bottom + 50;
    });
    if (touch) updateJoystickPosition(touch);
  }, { passive: false });
  
  document.addEventListener('touchend', (e) => {
    if (!joystickActive) return;
    
    // Check if the joystick touch ended
    let joystickTouchStillActive = false;
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const rect = virtualJoystick.getBoundingClientRect();
      if (touch.clientX > rect.left - 50 && touch.clientX < rect.right + 50 &&
          touch.clientY > rect.top - 50 && touch.clientY < rect.bottom + 50) {
        joystickTouchStillActive = true;
        break;
      }
    }
    
    if (!joystickTouchStillActive) {
      joystickActive = false;
      joystickInner.style.transform = `translate(0px, 0px)`;
      playerInput.x = 0;
    }
  });
  
  // Update joystick position and player input
  function updateJoystickPosition(touch) {
    let dx = touch.clientX - joystickOrigin.x;
    let dy = touch.clientY - joystickOrigin.y;
    
    // Calculate distance from origin
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize if outside radius
    if (distance > joystickRadius) {
      dx = dx * joystickRadius / distance;
      dy = dy * joystickRadius / distance;
    }
    
    // Update joystick visuals
    joystickInner.style.transform = `translate(${dx}px, ${dy}px)`;
    
    // Map to player input (-1 to 1 range)
    playerInput.x = dx / joystickRadius * 3; // Amplify for better control
  }
  
  // Fire button events
  fireButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (player && Date.now() - player.lastShot > (player.rapidFire ? 200 : 400)) {
      createBullet(player);
      player.lastShot = Date.now();
    }
  });
  
  // Fire button continuous press
  let firePressInterval = null;
  
  fireButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleFireButtonPress();
    
    // Start interval for continuous fire
    if (!autoFire) {
      firePressInterval = setInterval(handleFireButtonPress, player.rapidFire ? 200 : 400);
    }
  });
  
  fireButton.addEventListener('touchend', () => {
    clearInterval(firePressInterval);
  });
  
  function handleFireButtonPress() {
    if (!gameStarted || gameOver) return;
    if (player && Date.now() - player.lastShot > (player.rapidFire ? 200 : 400)) {
      createBullet(player);
      player.lastShot = Date.now();
      
      // Add haptic feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  }
}

// Create starfield background
function createStarfield() {
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true
  });
  
  const starPositions = [];
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100 - 50; // Push stars behind camera
    starPositions.push(x, y, z);
  }
  
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
  return stars;
}

// Create textures
function createTexture(emoji, size = 64, bgColor = null) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 128;
  
  // Clear the canvas with transparency
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);
  }
  
  ctx.font = `${size}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

// Create player ship
function createPlayer() {
  const playerTexture = createTexture('🚀', 64);
  const playerMaterial = new THREE.SpriteMaterial({ map: playerTexture });
  const player = new THREE.Sprite(playerMaterial);
  player.scale.set(1, 1, 1);
  // Position player higher on screen to be fully visible
  player.position.set(0, -3, 0);
  player.lastShot = 0;
  player.isInvincible = false;
  player.invincibleStartTime = 0;
  scene.add(player);
  return player;
}

// Create enemy
function createEnemy(type = Math.floor(Math.random() * 3)) {
  const enemyEmojis = ['👾', '👹', '👻'];
  const enemyTexture = createTexture(enemyEmojis[type], 48);
  const enemyMaterial = new THREE.SpriteMaterial({ map: enemyTexture });
  const enemy = new THREE.Sprite(enemyMaterial);
  
  const aspectRatio = window.innerWidth / window.innerHeight;
  const spawnWidth = aspectRatio * 7 - 1;
  
  enemy.scale.set(0.8, 0.8, 1);
  enemy.position.set(
    (Math.random() - 0.5) * spawnWidth,
    6,
    0
  );
  
  enemy.velocity = {
    x: (Math.random() - 0.5) * 0.05,
    y: -settings.enemySpeed * (1 + Math.random() * 0.5)
  };
  
  enemy.health = type + 1;
  enemy.points = (type + 1) * 10;
  enemy.type = type;
  
  scene.add(enemy);
  enemies.push(enemy);
}

// Create bullet
function createBullet(originObject, direction = 1, isEnemy = false) {
  const bulletTexture = createTexture(isEnemy ? '🔴' : '🔵', 32);
  const bulletMaterial = new THREE.SpriteMaterial({ map: bulletTexture });
  const bullet = new THREE.Sprite(bulletMaterial);
  
  bullet.scale.set(0.5, 0.5, 1);
  bullet.position.copy(originObject.position);
  bullet.position.y += direction * 0.6;
  bullet.isEnemy = isEnemy;
  bullet.velocity = settings.bulletSpeed * direction;
  
  scene.add(bullet);
  bullets.push(bullet);
}

// Create power-up
function createPowerUp() {
  const powerUpTypes = [
    { emoji: '❤️', type: 'health' },
    { emoji: '⚡', type: 'speed' },
    { emoji: '🛡️', type: 'shield' },
    { emoji: '🔥', type: 'rapid' }
  ];
  
  const typeIndex = Math.floor(Math.random() * powerUpTypes.length);
  const powerUpInfo = powerUpTypes[typeIndex];
  
  const powerUpTexture = createTexture(powerUpInfo.emoji, 48);
  const powerUpMaterial = new THREE.SpriteMaterial({ 
    map: powerUpTexture,
    transparent: true
  });
  const powerUp = new THREE.Sprite(powerUpMaterial);
  
  const aspectRatio = window.innerWidth / window.innerHeight;
  const spawnWidth = aspectRatio * 7 - 1;
  
  powerUp.scale.set(0.7, 0.7, 1);
  powerUp.position.set(
    (Math.random() - 0.5) * spawnWidth,
    6,
    0
  );
  
  powerUp.velocity = {
    y: -0.03
  };
  
  powerUp.type = powerUpInfo.type;
  powerUp.startTime = Date.now();
  
  scene.add(powerUp);
  powerUps.push(powerUp);
}

// Create explosion particles
function createExplosion(position, color = 0xffff00) {
  // Reduce particles on mobile for better performance
  const particleCount = isMobile ? 10 : 20;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    
    particle.position.copy(position);
    particle.velocity = {
      x: (Math.random() - 0.5) * 0.2,
      y: (Math.random() - 0.5) * 0.2,
      z: (Math.random() - 0.5) * 0.2
    };
    
    particle.startTime = Date.now();
    
    scene.add(particle);
    particles.push(particle);
  }
  
  // Add haptic feedback on mobile
  if (isMobile && navigator.vibrate) {
    navigator.vibrate(50);
  }
}

// Create floating text
function createFloatingText(text, position, color = 'white') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;
  
  ctx.font = '24px Arial';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  
  sprite.scale.set(1, 0.5, 1);
  sprite.position.copy(position);
  sprite.position.y += 0.5;
  sprite.startTime = Date.now();
  
  scene.add(sprite);
  particles.push(sprite);
}

// Input handlers
let playerInput = { x: 0, y: 0 };

function handleMouseMove(event) {
  if (!gameStarted || gameOver || isMobile) return;
  
  const aspectRatio = window.innerWidth / window.innerHeight;
  const viewWidth = aspectRatio * 9;
  
  playerInput.x = (event.clientX / window.innerWidth) * viewWidth - (viewWidth / 2);
}

function handleTouchMove(event) {
  if (!gameStarted || gameOver || !isMobile) return;
  event.preventDefault();
  
  // Touch movement now handled by virtual joystick
}

function handleTap(event) {
  if (gameOver) {
    restartGame();
    return;
  }
  
  if (!gameStarted) {
    startGame();
    return;
  }
  
  // Don't process taps if they're on control elements
  if (isMobile) {
    const target = event.target;
    if (target.id === 'virtual-joystick' || target.id === 'joystick-inner' ||
        target.id === 'fire-button' || target.id === 'auto-fire-toggle') {
      return;
    }
  }
  
  // Fire bullet (only for non-mobile or when controls aren't showing yet)
  if (player && !isMobile && Date.now() - player.lastShot > (player.rapidFire ? 200 : 400)) {
    createBullet(player);
    player.lastShot = Date.now();
  }
}

// Window event listeners
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('mousedown', handleTap);
document.addEventListener('touchstart', handleTap);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') handleTap();
});

// Pause game when tab loses focus
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameStarted && !gameOver) {
    // Create pause overlay if it doesn't exist
    let pauseOverlay = document.getElementById('pause-overlay');
    if (!pauseOverlay) {
      pauseOverlay = document.createElement('div');
      pauseOverlay.id = 'pause-overlay';
      pauseOverlay.innerHTML = 'PAUSED<br>Tap to Resume';
      document.body.appendChild(pauseOverlay);
    }
    pauseOverlay.style.display = 'block';
  }
});

// Resume game when tapping on pause overlay
document.addEventListener('click', (event) => {
  const pauseOverlay = document.getElementById('pause-overlay');
  if (pauseOverlay && pauseOverlay.style.display === 'block') {
    pauseOverlay.style.display = 'none';
  }
});

// Setup game
camera.position.z = 5;
const starfield = createStarfield();
const player = createPlayer();

// Update game state
function updateGame() {
  if (!gameStarted || gameOver) return;
  
  // Check for pause overlay
  const pauseOverlay = document.getElementById('pause-overlay');
  if (pauseOverlay && pauseOverlay.style.display === 'block') {
    return; // Game is paused
  }
  
  const currentTime = Date.now();
  
  // Handle auto-fire
  if (autoFire && player && currentTime - lastAutoFireTime > (player.rapidFire ? 200 : settings.autoFireRate)) {
    createBullet(player);
    lastAutoFireTime = currentTime;
  }
  
  // Update player position with smoothing
  const targetX = THREE.MathUtils.clamp(
    playerInput.x, 
    -(window.innerWidth / window.innerHeight) * 4.5 + 0.5, 
    (window.innerWidth / window.innerHeight) * 4.5 - 0.5
  );
  
  player.position.x += (targetX - player.position.x) * settings.playerSpeed;
  
  // Handle player invincibility
  if (player.isInvincible && currentTime - player.invincibleStartTime > settings.invincibleTime) {
    player.isInvincible = false;
    player.material.opacity = 1.0;
  } else if (player.isInvincible) {
    // Flash effect
    player.material.opacity = Math.sin(currentTime * 0.01) * 0.5 + 0.5;
  }
  
  // Spawn enemies
  if (currentTime - lastEnemySpawn > settings.enemySpawnRate / level) {
    createEnemy();
    lastEnemySpawn = currentTime;
  }
  
  // Spawn power-ups
  if (currentTime - lastPowerUpSpawn > settings.powerUpSpawnRate) {
    createPowerUp();
    lastPowerUpSpawn = currentTime;
  }
  
  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    
    // Move enemy
    enemy.position.x += enemy.velocity.x;
    enemy.position.y += enemy.velocity.y;
    
    // Enemy out of bounds
    if (enemy.position.y < -6) {
      scene.remove(enemy);
      enemies.splice(i, 1);
      continue;
    }
    
    // Enemy shooting (based on type)
    if (enemy.type === 2 && Math.random() < 0.005) {
      createBullet(enemy, -1, true);
    }
    
    // Enemy collisions with player
    if (!player.isInvincible && Math.abs(enemy.position.x - player.position.x) < 0.7 && 
        Math.abs(enemy.position.y - player.position.y) < 0.7) {
      createExplosion(enemy.position);
      scene.remove(enemy);
      enemies.splice(i, 1);
      
      lives--;
      livesElement.innerText = `Lives: ${lives}`;
      
      if (lives <= 0) {
        endGame();
      } else {
        player.isInvincible = true;
        player.invincibleStartTime = currentTime;
      }
    }
  }
  
  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    
    // Move bullet
    bullet.position.y += bullet.velocity;
    
    // Bullet out of bounds
    if (bullet.position.y > 6 || bullet.position.y < -6) {
      scene.remove(bullet);
      bullets.splice(i, 1);
      continue;
    }
    
    // Bullet collisions
    if (bullet.isEnemy) {
      // Enemy bullet hitting player
      if (!player.isInvincible && Math.abs(bullet.position.x - player.position.x) < 0.5 && 
          Math.abs(bullet.position.y - player.position.y) < 0.5) {
        scene.remove(bullet);
        bullets.splice(i, 1);
        
        lives--;
        livesElement.innerText = `Lives: ${lives}`;
        
        if (lives <= 0) {
          endGame();
        } else {
          player.isInvincible = true;
          player.invincibleStartTime = currentTime;
        }
      }
    } else {
      // Player bullet hitting enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        
        if (Math.abs(bullet.position.x - enemy.position.x) < 0.5 && 
            Math.abs(bullet.position.y - enemy.position.y) < 0.5) {
          scene.remove(bullet);
          bullets.splice(i, 1);
          
          enemy.health--;
          
          if (enemy.health <= 0) {
            createExplosion(enemy.position);
            createFloatingText(`+${enemy.points}`, enemy.position);
            
            score += enemy.points;
            scoreElement.innerText = `Score: ${score}`;
            
            // Level up based on score
            const newLevel = Math.floor(score / 500) + 1;
            if (newLevel > level) {
              level = newLevel;
              levelElement.innerText = `Level: ${level}`;
              createFloatingText(`LEVEL ${level}!`, { x: 0, y: 0 }, '#ffff00');
            }
            
            scene.remove(enemy);
            enemies.splice(j, 1);
          }
          
          break;
        }
      }
    }
  }
  
  // Update power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];
    
    // Move power-up
    powerUp.position.y += powerUp.velocity.y;
    
    // Power-up out of bounds
    if (powerUp.position.y < -6) {
      scene.remove(powerUp);
      powerUps.splice(i, 1);
      continue;
    }
    
    // Power-up collisions with player
    if (Math.abs(powerUp.position.x - player.position.x) < 0.7 && 
        Math.abs(powerUp.position.y - player.position.y) < 0.7) {
      
      // Apply power-up effect
      switch (powerUp.type) {
        case 'health':
          lives = Math.min(lives + 1, 5);
          livesElement.innerText = `Lives: ${lives}`;
          createFloatingText('+1 LIFE', powerUp.position, '#ff00ff');
          break;
        case 'speed':
          settings.playerSpeed = 0.25;
          setTimeout(() => { settings.playerSpeed = 0.15; }, 10000);
          createFloatingText('SPEED UP!', powerUp.position, '#00ffff');
          break;
        case 'shield':
          player.isInvincible = true;
          player.invincibleStartTime = currentTime;
          settings.invincibleTime = 8000;
          setTimeout(() => { settings.invincibleTime = 2000; }, 8000);
          createFloatingText('SHIELD!', powerUp.position, '#00ff00');
          break;
        case 'rapid':
          player.rapidFire = true;
          setTimeout(() => { player.rapidFire = false; }, 8000);
          createFloatingText('RAPID FIRE!', powerUp.position, '#ff0000');
          break;
      }
      
      // Add haptic feedback on power-up collection
      if (isMobile && navigator.vibrate) {
        navigator.vibrate([30, 30, 30]);
      }
      
      scene.remove(powerUp);
      powerUps.splice(i, 1);
    }
  }
  
  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    // Particle lifespan
    if (currentTime - particle.startTime > settings.particleLifespan) {
      scene.remove(particle);
      particles.splice(i, 1);
      continue;
    }
    
    // Floating text rises and fades
    if (particle.isSprite) {
      particle.position.y += 0.03;
      const age = (currentTime - particle.startTime) / settings.particleLifespan;
      particle.material.opacity = 1 - age;
    } else {
      // Move explosion particles
      particle.position.x += particle.velocity.x;
      particle.position.y += particle.velocity.y;
      particle.position.z += particle.velocity.z;
      
      // Fade out
      const age = (currentTime - particle.startTime) / settings.particleLifespan;
      particle.material.opacity = 1 - age;
    }
  }
  
  // Rotate starfield for subtle movement
  starfield.rotation.z += 0.0005;
}

// Start the game
function startGame() {
  gameStarted = true;
  startScreenElement.style.display = 'none';
  scoreElement.style.display = 'block';
  livesElement.style.display = 'block';
  levelElement.style.display = 'block';
  
  if (isMobile) {
    createMobileControls();
  }
}

// End the game
function endGame() {
  gameOver = true;
  gameOverElement.innerHTML = `Game Over!<br>Score: ${score}<br>Level: ${level}<br>Tap to Restart`;
  gameOverElement.style.display = 'block';
  
  // Clean up mobile controls
  if (isMobile) {
    if (virtualJoystick) virtualJoystick.style.display = 'none';
    if (fireButton) fireButton.style.display = 'none';
    const autoFireToggle = document.getElementById('auto-fire-toggle');
    if (autoFireToggle) autoFireToggle.style.display = 'none';
  }
}

// Restart the game
function restartGame() {
  // Reset variables
  score = 0;
  lives = 3;
  level = 1;
  gameOver = false;
  lastEnemySpawn = 0;
  lastPowerUpSpawn = 0;
  
  // Update UI
  scoreElement.innerText = `Score: ${score}`;
  livesElement.innerText = `Lives: ${lives}`;
  levelElement.innerText = `Level: ${level}`;
  gameOverElement.style.display = 'none';
  
  // Clear game objects
  enemies.forEach(enemy => scene.remove(enemy));
  bullets.forEach(bullet => scene.remove(bullet));
  powerUps.forEach(powerUp => scene.remove(powerUp));
  particles.forEach(particle => scene.remove(particle));
  
  enemies = [];
  bullets = [];
  powerUps = [];
  particles = [];
  
  // Reset player
  player.position.set(0, -4, 0);
  player.isInvincible = false;
  player.rapidFire = false;
  player.material.opacity = 1.0;
  
  // Show mobile controls
  if (isMobile) {
    if (virtualJoystick) virtualJoystick.style.display = 'block';
    if (fireButton) fireButton.style.display = 'block';
    const autoFireToggle = document.getElementById('auto-fire-toggle');
    if (autoFireToggle) autoFireToggle.style.display = 'block';
  }
}

// Resize handler
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Reposition mobile controls
  if (isMobile && gameStarted && !gameOver) {
    if (virtualJoystick) {
      virtualJoystick.style.left = '20px';
      virtualJoystick.style.bottom = '20px';
    }
    if (fireButton) {
      fireButton.style.right = '20px';
      fireButton.style.bottom = '20px';
    }
  }
}

window.addEventListener('resize', handleResize);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  updateGame();
  renderer.render(scene, camera);
}

animate();
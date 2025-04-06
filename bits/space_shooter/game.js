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

// Game settings
const settings = {
  enemySpawnRate: 1500,
  powerUpSpawnRate: 10000,
  enemySpeed: 0.05,
  playerSpeed: 0.15,
  bulletSpeed: 0.4,
  particleLifespan: 1000,
  invincibleTime: 2000
};

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
  
  const powerUpTexture = createTexture(powerUpInfo.emoji, 48, 'rgba(255,255,255,0.2)');
  const powerUpMaterial = new THREE.SpriteMaterial({ map: powerUpTexture });
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
  for (let i = 0; i < 20; i++) {
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
  if (!gameStarted || gameOver) return;
  
  const aspectRatio = window.innerWidth / window.innerHeight;
  const viewWidth = aspectRatio * 9;
  
  playerInput.x = (event.clientX / window.innerWidth) * viewWidth - (viewWidth / 2);
}

function handleTouchMove(event) {
  if (!gameStarted || gameOver) return;
  event.preventDefault();
  
  const aspectRatio = window.innerWidth / window.innerHeight;
  const viewWidth = aspectRatio * 9;
  
  playerInput.x = (event.touches[0].clientX / window.innerWidth) * viewWidth - (viewWidth / 2);
}

function handleDeviceOrientation(event) {
  if (!gameStarted || gameOver || !isMobile) return;
  
  // Use gamma (left/right tilt) for horizontal movement
  // Convert degrees to normalized value
  const tiltSensitivity = 0.1;
  playerInput.x = event.gamma * tiltSensitivity;
}

function handleTap() {
  if (gameOver) {
    restartGame();
    return;
  }
  
  if (!gameStarted) {
    startGame();
    return;
  }
  
  // Fire bullet
  if (player && Date.now() - player.lastShot > (player.rapidFire ? 200 : 400)) {
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

// Request device orientation permission on iOS
function requestDeviceOrientationPermission() {
  if (isMobile && typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleDeviceOrientation);
        }
      })
      .catch(console.error);
  } else {
    window.addEventListener('deviceorientation', handleDeviceOrientation);
  }
}

// Setup game
camera.position.z = 5;
const starfield = createStarfield();
const player = createPlayer();

// Update game state
function updateGame() {
  if (!gameStarted || gameOver) return;
  
  const currentTime = Date.now();
  
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
  
  requestDeviceOrientationPermission();
}

// End the game
function endGame() {
  gameOver = true;
  gameOverElement.innerHTML = `Game Over!<br>Score: ${score}<br>Level: ${level}<br>Tap to Restart`;
  gameOverElement.style.display = 'block';
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
}

// Resize handler
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', handleResize);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  updateGame();
  renderer.render(scene, camera);
}

animate();
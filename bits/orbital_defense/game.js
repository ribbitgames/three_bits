// Orbital Defense Game
// A simple three.js game where you defend a planet from asteroids

// Global variables
let scene, camera, renderer;
let planet, defender, orbitAngle = 0;
let projectiles = [], asteroids = [];
let isPlaying = false, isPaused = false;
let score = 0, health = 100, wave = 1;
let lastFrameTime = 0, asteroidSpawnTimer = 0;
let mouseX = 0, mouseY = 0, isMouseDown = false;
let difficulty = 1;
let particleSystems = [];
let autoFireInterval = null;
let isVerticalMode = window.innerHeight > window.innerWidth;

// DOM Elements
const menuElement = document.getElementById('menu');
const gameOverElement = document.getElementById('game-over');
const scoreElement = document.getElementById('score');
const healthElement = document.getElementById('health');
const waveElement = document.getElementById('wave');
const finalScoreElement = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

// Game settings - adjusted for vertical screen
const PLANET_RADIUS = 8; // Smaller planet
const ORBIT_RADIUS = 14; // Ship closer to planet
const DEFENDER_SIZE = 2.5;
const PROJECTILE_SPEED = 100;
const BASE_ASTEROID_SPEED = 30;
const ASTEROID_SPAWN_DELAY = 1.2; // seconds
const WAVE_DURATION = 20; // seconds
const WAVE_DIFFICULTY_MULTIPLIER = 1.25;

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera (perspective for 3D look and field of view)
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(90, aspect, 0.1, 1000);
    
    // Adjust camera distance based on screen aspect ratio
    // For vertical screens, move camera further
    if (aspect < 1) { // vertical orientation
        camera.position.z = 120;
    } else {
        camera.position.z = 150;
    }
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('game-canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add starfield background
    createStarfield();
    
    // Create planet
    createPlanet();
    
    // Create defender
    createDefender();
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);
    
    // Start button event listener
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
    
    // Start animation loop
    animate(0);
}

// Create starfield background
function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true
    });
    
    const starVertices = [];
    for (let i = 0; i < 3000; i++) { // Added more stars
        const x = (Math.random() - 0.5) * 3000;
        const y = (Math.random() - 0.5) * 3000;
        const z = (Math.random() - 0.5) * 3000;
        starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// Create planet
function createPlanet() {
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 32, 32);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x4fc3f7,
        specular: 0x333333,
        shininess: 5,
        flatShading: false
    });
    
    planet = new THREE.Mesh(geometry, material);
    scene.add(planet);
    
    // Add atmosphere
    const atmosphereGeometry = new THREE.SphereGeometry(PLANET_RADIUS + 0.5, 32, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x81d4fa,
        transparent: true,
        opacity: 0.3
    });
    
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    planet.add(atmosphere);
    
    // Add rotation animation
    planet.rotation.x = 0.1;
}

// Create defender (player's ship)
function createDefender() {
    const geometry = new THREE.ConeGeometry(DEFENDER_SIZE, DEFENDER_SIZE * 2, 8);
    geometry.rotateX(Math.PI / 2);
    
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xf44336,
        specular: 0x111111,
        shininess: 30
    });
    
    defender = new THREE.Mesh(geometry, material);
    scene.add(defender);
    
    // Set initial position
    updateDefenderPosition();
}

// Update defender position based on orbit angle
function updateDefenderPosition() {
    const x = Math.cos(orbitAngle) * ORBIT_RADIUS;
    const y = Math.sin(orbitAngle) * ORBIT_RADIUS;
    
    defender.position.set(x, y, 0);
    // Point defender toward the orbit center
    defender.lookAt(0, 0, 0);
    // Rotate defender to face outward from planet
    defender.rotateY(Math.PI);
}

// Shoot projectile from defender - now shotgun style
function shootProjectile() {
    // Number of projectiles in the shotgun blast
    const spreadCount = 5;
    const spreadAngle = Math.PI / 8; // Total spread angle
    
    // Get defender's direction (away from planet center)
    const defenderPos = defender.position.clone();
    const baseDirection = defenderPos.clone().normalize();
    
    for (let i = 0; i < spreadCount; i++) {
        // Create projectile
        const geometry = new THREE.SphereGeometry(0.6, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
        const projectile = new THREE.Mesh(geometry, material);
        
        // Set position to defender's position
        projectile.position.copy(defenderPos);
        
        // Calculate spread angle for this projectile
        const angleOffset = spreadAngle * (i / (spreadCount - 1) - 0.5);
        
        // Create spread direction by rotating base direction
        const direction = baseDirection.clone();
        
        // Apply rotation in 3D space
        const rotationAxis = new THREE.Vector3(0, 0, 1);
        direction.applyAxisAngle(rotationAxis, angleOffset);
        
        // Add slight random variation
        direction.x += (Math.random() - 0.5) * 0.05;
        direction.y += (Math.random() - 0.5) * 0.05;
        direction.normalize();
        
        // Set velocity
        const speedVariation = 0.85 + Math.random() * 0.3; // 85% to 115% of base speed
        projectile.userData = {
            velocity: direction.multiplyScalar(PROJECTILE_SPEED * speedVariation),
            lifeTime: 0
        };
        
        scene.add(projectile);
        projectiles.push(projectile);
    }
    
    // Add muzzle flash effect
    createMuzzleFlash(defenderPos);
}

// Create muzzle flash effect
function createMuzzleFlash(position) {
    const particleCount = 30; // More particles for shotgun effect
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xffeb3b,
        size: 1.2,
        transparent: true,
        opacity: 0.8
    });
    
    const particleSystem = new THREE.Points(geometry, material);
    
    // Add velocity to each particle
    const velocities = [];
    const lifeSpans = [];
    
    for (let i = 0; i < particleCount; i++) {
        // Calculate velocity in direction of defender but with spread
        const vel = defender.position.clone().normalize().multiplyScalar(15);
        
        // Add random spread - wider spread for shotgun effect
        vel.x += (Math.random() - 0.5) * 30;
        vel.y += (Math.random() - 0.5) * 30;
        vel.z += (Math.random() - 0.5) * 30;
        
        velocities.push(vel);
        lifeSpans.push(0.3 + Math.random() * 0.4); // Random lifespan between 0.3 and 0.7 seconds
    }
    
    particleSystem.userData = {
        velocities: velocities,
        lifeSpans: lifeSpans,
        age: 0
    };
    
    scene.add(particleSystem);
    particleSystems.push(particleSystem);
}

// Spawn asteroid
function spawnAsteroid() {
    // Create asteroid
    const size = 2 + Math.random() * 4; // Random size between 2 and 6
    const geometry = new THREE.IcosahedronGeometry(size, 0);
    
    // Create a slightly varied color
    const colorVariation = Math.random() * 0.2 - 0.1;
    const color = new THREE.Color(0.5 + colorVariation, 0.3 + colorVariation, 0.2 + colorVariation);
    
    const material = new THREE.MeshPhongMaterial({
        color: color,
        flatShading: true
    });
    
    const asteroid = new THREE.Mesh(geometry, material);
    
    // Set random position outside the play area
    const angle = Math.random() * Math.PI * 2;
    
    // Adjust spawn distance based on screen orientation
    const isVertical = window.innerHeight > window.innerWidth;
    const distance = isVertical ? 
        (130 + Math.random() * 30) : // Vertical: spawn between 130 and 160 units away
        (160 + Math.random() * 40); // Horizontal: spawn between 160 and 200 units away
    
    asteroid.position.set(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        0
    );
    
    // Set velocity toward planet with some variance
    const direction = new THREE.Vector3().copy(asteroid.position).normalize().negate();
    
    // Add some randomness to direction
    direction.x += (Math.random() - 0.5) * 0.2;
    direction.y += (Math.random() - 0.5) * 0.2;
    direction.normalize();
    
    // Speed based on wave difficulty
    const speed = BASE_ASTEROID_SPEED * (0.8 + Math.random() * 0.4) * difficulty;
    
    asteroid.userData = {
        velocity: direction.multiplyScalar(speed),
        rotationSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ),
        health: size * 5, // Health based on size
        size: size
    };
    
    scene.add(asteroid);
    asteroids.push(asteroid);
}

// Create explosion effect
function createExplosion(position, size, color) {
    const particleCount = Math.floor(size * 15);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: color || 0xff7700,
        size: 1.2,
        transparent: true,
        opacity: 0.8
    });
    
    const particleSystem = new THREE.Points(geometry, material);
    
    // Add velocity to each particle
    const velocities = [];
    const lifeSpans = [];
    
    for (let i = 0; i < particleCount; i++) {
        // Random direction
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        
        vel.normalize().multiplyScalar(10 + Math.random() * 20 * size / 5);
        velocities.push(vel);
        lifeSpans.push(0.5 + Math.random() * 1.0); // Random lifespan between 0.5 and 1.5 seconds
    }
    
    particleSystem.userData = {
        velocities: velocities,
        lifeSpans: lifeSpans,
        age: 0
    };
    
    scene.add(particleSystem);
    particleSystems.push(particleSystem);
}

// Update particle systems
function updateParticleSystems(deltaTime) {
    for (let i = particleSystems.length - 1; i >= 0; i--) {
        const ps = particleSystems[i];
        ps.userData.age += deltaTime;
        
        const positions = ps.geometry.attributes.position.array;
        let removeSystem = true;
        
        for (let j = 0; j < positions.length / 3; j++) {
            if (ps.userData.age < ps.userData.lifeSpans[j]) {
                removeSystem = false;
                
                // Update position based on velocity
                positions[j * 3] += ps.userData.velocities[j].x * deltaTime;
                positions[j * 3 + 1] += ps.userData.velocities[j].y * deltaTime;
                positions[j * 3 + 2] += ps.userData.velocities[j].z * deltaTime;
                
                // Fade out particle
                const lifeRatio = ps.userData.age / ps.userData.lifeSpans[j];
                if (lifeRatio > 0.7) {
                    ps.material.opacity = 0.8 * (1 - (lifeRatio - 0.7) / 0.3);
                }
            }
        }
        
        ps.geometry.attributes.position.needsUpdate = true;
        
        if (removeSystem) {
            scene.remove(ps);
            particleSystems.splice(i, 1);
        }
    }
}

// Update game state
function update(deltaTime) {
    if (!isPlaying || isPaused) return;
    
    // Rotate planet
    planet.rotation.y += 0.1 * deltaTime;
    
    // Update defender position based on orbit angle
    updateDefenderPosition();
    
    // Update projectiles
    updateProjectiles(deltaTime);
    
    // Update asteroids
    updateAsteroids(deltaTime);
    
    // Update particle systems
    updateParticleSystems(deltaTime);
    
    // Check for wave completion
    asteroidSpawnTimer += deltaTime;
    if (asteroidSpawnTimer >= ASTEROID_SPAWN_DELAY) {
        spawnAsteroid();
        asteroidSpawnTimer = 0;
    }
    
    // Increase difficulty over time
    const waveDuration = WAVE_DURATION / difficulty;
    if (isPlaying && lastFrameTime >= waveDuration) {
        wave++;
        difficulty *= WAVE_DIFFICULTY_MULTIPLIER;
        waveElement.textContent = `Wave: ${wave}`;
        lastFrameTime = 0;
    } else {
        lastFrameTime += deltaTime;
    }
}

// Update projectiles
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Update position
        projectile.position.add(projectile.userData.velocity.clone().multiplyScalar(deltaTime));
        
        // Remove if too far from center
        if (projectile.position.length() > 150) {
            scene.remove(projectile);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Increment lifetime
        projectile.userData.lifeTime += deltaTime;
        if (projectile.userData.lifeTime > 3) {
            scene.remove(projectile);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check for collisions with asteroids
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            const distance = projectile.position.distanceTo(asteroid.position);
            
            if (distance < asteroid.userData.size + 0.8) {
                // Hit asteroid
                asteroid.userData.health -= 10;
                
                // Create small impact effect
                createExplosion(projectile.position, 0.5, 0xffeb3b);
                
                // Remove projectile
                scene.remove(projectile);
                projectiles.splice(i, 1);
                
                // Check if asteroid is destroyed
                if (asteroid.userData.health <= 0) {
                    // Increase score - higher score bonus for vertical orientation
                    const isVertical = window.innerHeight > window.innerWidth;
                    const scoreMultiplier = isVertical ? 15 : 10; // Higher score for vertical to make it more engaging
                    const scoreValue = Math.floor(asteroid.userData.size * scoreMultiplier);
                    score += scoreValue;
                    scoreElement.textContent = `Score: ${score}`;
                    
                    // Create explosion
                    createExplosion(asteroid.position, asteroid.userData.size, 0xff4500);
                    
                    // Remove asteroid
                    scene.remove(asteroid);
                    asteroids.splice(j, 1);
                }
                
                break;
            }
        }
    }
}

// Update asteroids
function updateAsteroids(deltaTime) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        
        // Update position
        asteroid.position.add(asteroid.userData.velocity.clone().multiplyScalar(deltaTime));
        
        // Update rotation
        asteroid.rotation.x += asteroid.userData.rotationSpeed.x * deltaTime;
        asteroid.rotation.y += asteroid.userData.rotationSpeed.y * deltaTime;
        asteroid.rotation.z += asteroid.userData.rotationSpeed.z * deltaTime;
        
        // Check for collision with planet
        const distanceToPlanet = asteroid.position.length();
        if (distanceToPlanet < PLANET_RADIUS + asteroid.userData.size * 0.5) {
            // Planet hit
            health -= Math.floor(asteroid.userData.size * 5);
            
            if (health < 0) health = 0;
            healthElement.textContent = `Health: ${health}%`;
            
            // Create explosion
            createExplosion(asteroid.position, asteroid.userData.size, 0xff0000);
            
            // Remove asteroid
            scene.remove(asteroid);
            asteroids.splice(i, 1);
            
            // Check game over
            if (health <= 0) {
                gameOver();
            }
            
            continue;
        }
        
        // Check for collision with defender
        const distanceToDefender = asteroid.position.distanceTo(defender.position);
        if (distanceToDefender < asteroid.userData.size + DEFENDER_SIZE) {
            // Defender hit
            health -= Math.floor(asteroid.userData.size * 10);
            
            if (health < 0) health = 0;
            healthElement.textContent = `Health: ${health}%`;
            
            // Create explosion
            createExplosion(defender.position, 2, 0xff0000);
            
            // Remove asteroid
            scene.remove(asteroid);
            asteroids.splice(i, 1);
            
            // Check game over
            if (health <= 0) {
                gameOver();
            }
        }
    }
}

// Animation loop
function animate(time) {
    requestAnimationFrame(animate);
    
    const now = time / 1000; // Convert to seconds
    const deltaTime = Math.min(0.1, now - (lastTime || now)); // Cap delta at 0.1 seconds
    lastTime = now;
    
    update(deltaTime);
    renderer.render(scene, camera);
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Detect orientation change
    const newIsVerticalMode = window.innerHeight > window.innerWidth;
    
    // If orientation changed, update game parameters
    if (newIsVerticalMode !== isVerticalMode) {
        isVerticalMode = newIsVerticalMode;
        
        // Clear auto-fire when switching orientation
        if (autoFireInterval) {
            clearInterval(autoFireInterval);
            autoFireInterval = null;
        }
    }
    
    // Adjust camera distance based on screen orientation
    if (isVerticalMode) {
        camera.position.z = 120;
    } else {
        camera.position.z = 150;
    }
}

// Mouse event handlers
function onMouseMove(event) {
    event.preventDefault();
    
    if (!isPlaying || isPaused) return;
    
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // For vertical screens, adjust sensitivity for better control
    if (window.innerHeight > window.innerWidth) {
        // Make orbital movement smoother on vertical screens
        // by dampening the angle changes slightly
        const targetAngle = Math.atan2(mouseY, mouseX);
        const angleDiff = targetAngle - orbitAngle;
        
        // Handle angle wrapping
        if (angleDiff > Math.PI) orbitAngle += 2 * Math.PI;
        if (angleDiff < -Math.PI) orbitAngle -= 2 * Math.PI;
        
        // Smooth transition (30% of the way to target angle)
        orbitAngle += (targetAngle - orbitAngle) * 0.3;
    } else {
        // Regular movement for landscape
        orbitAngle = Math.atan2(mouseY, mouseX);
    }
}

function onMouseDown() {
    if (!isPlaying || isPaused) return;
    
    isMouseDown = true;
    shootProjectile();
    
    // Set up auto-fire for vertical mode to make it more fun
    if (window.innerHeight > window.innerWidth && !autoFireInterval) {
        autoFireInterval = setInterval(() => {
            if (isMouseDown && isPlaying && !isPaused) {
                shootProjectile();
            }
        }, 400); // Fire every 400ms
    }
}

function onMouseUp() {
    isMouseDown = false;
    
    // Clear auto-fire interval
    if (autoFireInterval) {
        clearInterval(autoFireInterval);
        autoFireInterval = null;
    }
}

// Touch event handlers
function onTouchMove(event) {
    event.preventDefault();
    
    if (!isPlaying || isPaused) return;
    
    const touch = event.touches[0];
    mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    // For vertical screens, apply same smoothing as mouse movement
    if (window.innerHeight > window.innerWidth) {
        const targetAngle = Math.atan2(mouseY, mouseX);
        const angleDiff = targetAngle - orbitAngle;
        
        // Handle angle wrapping
        if (angleDiff > Math.PI) orbitAngle += 2 * Math.PI;
        if (angleDiff < -Math.PI) orbitAngle -= 2 * Math.PI;
        
        // Smooth transition (30% of the way to target angle)
        orbitAngle += (targetAngle - orbitAngle) * 0.3;
    } else {
        orbitAngle = Math.atan2(mouseY, mouseX);
    }
}

function onTouchStart(event) {
    if (!isPlaying || isPaused) return;
    
    isMouseDown = true;
    shootProjectile();
    
    // Set up auto-fire for vertical mode
    if (window.innerHeight > window.innerWidth && !autoFireInterval) {
        autoFireInterval = setInterval(() => {
            if (isMouseDown && isPlaying && !isPaused) {
                shootProjectile();
            }
        }, 400); // Fire every 400ms
    }
}

function onTouchEnd() {
    isMouseDown = false;
    
    // Clear auto-fire interval
    if (autoFireInterval) {
        clearInterval(autoFireInterval);
        autoFireInterval = null;
    }
}

// Start game
function startGame() {
    menuElement.classList.add('hidden');
    isPlaying = true;
    lastFrameTime = 0;
}

// Game over
function gameOver() {
    isPlaying = false;
    finalScoreElement.textContent = `Final Score: ${score}`;
    gameOverElement.classList.remove('hidden');
}

// Restart game
function restartGame() {
    // Reset game state
    score = 0;
    health = 100;
    wave = 1;
    difficulty = 1;
    orbitAngle = 0;
    lastFrameTime = 0;
    asteroidSpawnTimer = 0;
    
    // Clear any auto-fire interval
    if (autoFireInterval) {
        clearInterval(autoFireInterval);
        autoFireInterval = null;
    }
    
    // Update UI
    scoreElement.textContent = `Score: ${score}`;
    healthElement.textContent = `Health: ${health}%`;
    waveElement.textContent = `Wave: ${wave}`;
    
    // Remove all projectiles and asteroids
    for (let i = projectiles.length - 1; i >= 0; i--) {
        scene.remove(projectiles[i]);
    }
    projectiles = [];
    
    for (let i = asteroids.length - 1; i >= 0; i--) {
        scene.remove(asteroids[i]);
    }
    asteroids = [];
    
    // Remove all particle systems
    for (let i = particleSystems.length - 1; i >= 0; i--) {
        scene.remove(particleSystems[i]);
    }
    particleSystems = [];
    
    // Reset defender position
    updateDefenderPosition();
    
    // Hide game over screen and start game
    gameOverElement.classList.add('hidden');
    isPlaying = true;
}

// Global time tracking
let lastTime = null;

// Initialize the game when the page loads
window.addEventListener('load', init);
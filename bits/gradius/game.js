/**
 * Gradius Clone using Three.js
 * Optimized for vertical phone screens, with touch/mouse controls
 */

// Game state and constants
const GAME_STATE = {
    INIT: 0,
    PLAYING: 1,
    GAME_OVER: 2
};

// Game configuration
const CONFIG = {
    playerSpeed: 0.15,         // Base player movement speed
    bulletSpeed: 0.5,          // Player bullet speed
    enemySpeed: 0.05,          // Base enemy movement speed
    powerUpChance: 0.2,        // Chance of enemy dropping power-up (0-1)
    enemySpawnRate: 1000,      // Time between enemy spawns in ms
    maxPlayerLives: 3,         // Starting player lives
    playerInvincibleTime: 2000, // Invincibility time after hit in ms
    fireRate: 200              // Time between auto-fire shots in ms
};

// Game objects and variables
let scene, camera, renderer, raycaster;
let gameState = GAME_STATE.INIT;
let lastTime = 0;
let score = 0;
let lives = CONFIG.maxPlayerLives;
let powerLevel = 0;
let selectedPowerUp = -1;
let player, playerLight;
let playerPowerUps = {
    speed: 0,
    missile: false,
    double: false,
    laser: false,
    shield: false
};

// Game object collections
let bullets = [];
let enemies = [];
let powerUps = [];
let explosions = [];
let obstacles = [];

// Timers and flags
let lastEnemySpawn = 0;
let lastFireTime = 0;
let isPointerDown = false;
let playerInvincible = false;
let playerInvincibleTimer = 0;
let gameInitialized = false;

/**
 * Wait for DOM to be ready before initializing
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Document loaded");
    
    // Set up button handlers
    const startButton = document.getElementById('start-button');
    if (startButton) {
        startButton.addEventListener('click', () => {
            console.log("Start button clicked");
            if (gameState === GAME_STATE.INIT) {
                startGame();
            }
        });
    }
    
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            resetGame();
        });
    }
    
    // Initialize game only once
    if (!gameInitialized) {
        init();
        gameInitialized = true;
    }
});

/**
 * Initializes the game, sets up Three.js scene
 */
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000025);
    
    // Setup camera for vertical orientation
    const aspect = window.innerWidth / window.innerHeight;
    // Using orthographic camera for 2D-like gameplay
    const frustumSize = 10;
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, 
        frustumSize * aspect / 2, 
        frustumSize / 2, 
        frustumSize / -2, 
        1, 
        1000
    );
    camera.position.z = 10;
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas').appendChild(renderer.domElement);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    // Add distant directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 0, 5);
    scene.add(dirLight);
    
    // Create raycaster for input handling
    raycaster = new THREE.Raycaster();
    
    // Setup event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Touch and mouse events for mobile-friendly controls
    renderer.domElement.addEventListener('mousedown', onPointerDown);
    renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: false });
    
    renderer.domElement.addEventListener('mousemove', onPointerMove);
    renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
    
    renderer.domElement.addEventListener('mouseup', onPointerUp);
    renderer.domElement.addEventListener('touchend', onPointerUp);
    
    renderer.domElement.addEventListener('mouseleave', onPointerUp);
    renderer.domElement.addEventListener('touchcancel', onPointerUp);
    
    // Create player spaceship
    createPlayer();
    
    // Add background stars
    createStarfield();
    
    // Show start screen
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // Update UI
    updateScoreDisplay();
    updateLivesDisplay();
    updatePowerMeterDisplay();
    
    // Start animation loop
    animate(0);
}

/**
 * Creates the player ship with lights and effects
 */
function createPlayer() {
    // Create a better spaceship model using merged geometries
    const shipGroup = new THREE.Group();
    
    // Main body - elongated shape (using cylinder instead of capsule)
    const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8);
    bodyGeometry.rotateZ(Math.PI / 2); // Orient horizontally
    
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x3030ff,
        emissive: 0x101080,
        shininess: 50,
        flatShading: false
    });
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    shipGroup.add(body);
    
    // Front nose cone
    const noseGeometry = new THREE.ConeGeometry(0.15, 0.2, 8);
    noseGeometry.rotateZ(-Math.PI / 2); // Point forward
    
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(0.3, 0, 0);
    shipGroup.add(nose);
    
    // Cockpit - slightly elevated and darker blue
    const cockpitGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    const cockpitMaterial = new THREE.MeshPhongMaterial({
        color: 0x2020a0,
        emissive: 0x101060,
        shininess: 80,
        flatShading: false
    });
    
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0.05, 0, 0.05);
    cockpit.scale.set(1, 0.7, 0.7);
    shipGroup.add(cockpit);
    
    // Wings - using simple box geometries
    const wingGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.5);
    
    const wingMaterial = new THREE.MeshPhongMaterial({
        color: 0x3040c0,
        emissive: 0x101060,
        shininess: 30,
        flatShading: true
    });
    
    // Top wing
    const topWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topWing.position.set(-0.05, 0.15, 0);
    shipGroup.add(topWing);
    
    // Bottom wing
    const bottomWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomWing.position.set(-0.05, -0.15, 0);
    shipGroup.add(bottomWing);
    
    // Engines - glowing thrusters at the back
    const engineGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.1, 8);
    engineGeometry.rotateX(Math.PI / 2);
    
    const engineMaterial = new THREE.MeshPhongMaterial({
        color: 0xff5500,
        emissive: 0xff2200,
        shininess: 100,
        flatShading: false
    });
    
    // Top engine
    const topEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    topEngine.position.set(-0.25, 0.1, 0);
    shipGroup.add(topEngine);
    
    // Bottom engine
    const bottomEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    bottomEngine.position.set(-0.25, -0.1, 0);
    shipGroup.add(bottomEngine);
    
    // Add engine glow
    const engineLight = new THREE.PointLight(0xff5500, 1, 1);
    engineLight.position.set(-0.3, 0, 0);
    shipGroup.add(engineLight);
    
    // Set up the final player object
    player = shipGroup;
    player.position.set(-3, 0, 0);
    scene.add(player);
    
    // Add point light attached to player
    playerLight = new THREE.PointLight(0x3030ff, 1, 3);
    playerLight.position.copy(player.position);
    scene.add(playerLight);
    
    // Add shield visual (initially invisible)
    const shieldGeometry = new THREE.SphereGeometry(0.4, 8, 8);
    const shieldMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        wireframe: true
    });
    
    player.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    player.shield.visible = false;
    player.add(player.shield);
}

/**
 * Creates a starfield background using particle system
 */
function createStarfield() {
    // Create scrolling star layers for parallax effect
    const layerCount = 3;
    const starCounts = [100, 80, 60]; // More stars in distant layers
    const starSpeeds = [0.02, 0.05, 0.1]; // Different scroll speeds
    const starSizes = [0.02, 0.03, 0.05]; // Larger stars in closer layers
    
    // Store stars in an array for animation
    window.starLayers = [];
    
    for (let layer = 0; layer < layerCount; layer++) {
        const starCount = starCounts[layer];
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            // Position stars randomly across the view width and height
            starPositions[i3] = Math.random() * 20 - 10;     // X: -10 to 10
            starPositions[i3 + 1] = Math.random() * 16 - 8;  // Y: -8 to 8
            starPositions[i3 + 2] = -5 - layer * 2;          // Z: different depths
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: starSizes[layer],
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        stars.scrollSpeed = starSpeeds[layer];
        stars.positions = starPositions;
        scene.add(stars);
        window.starLayers.push(stars);
    }
    
    // Remove static wall obstacles and create moving obstacles instead
    obstacles.forEach(obstacle => scene.remove(obstacle));
    obstacles = [];
    
    // Create obstacles that will scroll with background
    createScrollingObstacles();
}

/**
 * Creates scrolling obstacles
 */
function createScrollingObstacles() {
    // Create top and bottom wall patterns
    const wallGeometry = new THREE.BoxGeometry(0.5, 2, 0.5);
    const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0x707070,
        emissive: 0x202020,
        shininess: 30
    });
    
    // Create walls that will appear to scroll
    for (let x = -6; x < 20; x += 4) {
        // Top wall section
        const topWall = new THREE.Mesh(wallGeometry, wallMaterial);
        topWall.position.set(x, 4, 0);
        topWall.scrollSpeed = 0.1;
        scene.add(topWall);
        obstacles.push(topWall);
        
        // Bottom wall section
        const bottomWall = new THREE.Mesh(wallGeometry, wallMaterial);
        bottomWall.position.set(x, -4, 0);
        bottomWall.scrollSpeed = 0.1;
        scene.add(bottomWall);
        obstacles.push(bottomWall);
    }
    
    // Create some floating obstacles
    const obstacleCount = 8;
    const obstacleGeometry = new THREE.TetrahedronGeometry(0.3);
    const obstacleMaterial = new THREE.MeshPhongMaterial({
        color: 0xa04040,
        emissive: 0x401010
    });
    
    for (let i = 0; i < obstacleCount; i++) {
        const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
        obstacle.position.set(
            Math.random() * 20 - 5,      // Spread across visible area and beyond
            Math.random() * 6 - 3,       // Random Y position
            0
        );
        obstacle.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        obstacle.scrollSpeed = 0.08 + Math.random() * 0.04; // Variable scroll speed
        scene.add(obstacle);
        obstacles.push(obstacle);
    }
}

/**
 * Window resize handler
 */
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Pointer down event handler (both mouse and touch)
 */
function onPointerDown(event) {
    event.preventDefault();
    
    if (gameState === GAME_STATE.PLAYING) {
        isPointerDown = true;
        updatePlayerTarget(event);
        // Initial weapon fire
        firePlayerWeapon();
        lastFireTime = performance.now();
    }
}

/**
 * Pointer move event handler (both mouse and touch)
 */
function onPointerMove(event) {
    event.preventDefault();
    
    if (gameState !== GAME_STATE.PLAYING || !isPointerDown) return;
    
    updatePlayerTarget(event);
}

/**
 * Pointer up event handler (both mouse and touch)
 */
function onPointerUp(event) {
    if (event.preventDefault) {
        event.preventDefault();
    }
    
    isPointerDown = false;
}

/**
 * Update player target position from pointer event
 */
function updatePlayerTarget(event) {
    // Get normalized coordinates
    const pointer = {};
    
    if (event.type.startsWith('touch')) {
        pointer.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    // Convert to world coordinates
    const vector = new THREE.Vector3(pointer.x, pointer.y, 0);
    vector.unproject(camera);
    
    // Update player target position
    player.targetY = vector.y;
}

/**
 * Starts the game
 */
function startGame() {
    console.log("startGame called, changing state to PLAYING");
    gameState = GAME_STATE.PLAYING;
    score = 0;
    lives = CONFIG.maxPlayerLives;
    powerLevel = 0;
    selectedPowerUp = -1;
    
    // Reset power-ups
    playerPowerUps = {
        speed: 0,
        missile: false,
        double: false,
        laser: false,
        shield: false
    };
    
    // Clear objects
    clearGameObjects();
    
    // Reset player position
    player.position.set(-3, 0, 0);
    player.shield.visible = false;
    
    // Update UI
    updateScoreDisplay();
    updateLivesDisplay();
    updatePowerMeterDisplay();
    
    // Hide start screen
    document.getElementById('start-screen').classList.add('hidden');
}

/**
 * Resets the game after game over
 */
function resetGame() {
    startGame();
}

/**
 * Clears all game objects for reset
 */
function clearGameObjects() {
    // Remove all bullets
    bullets.forEach(bullet => scene.remove(bullet));
    bullets = [];
    
    // Remove all enemies
    enemies.forEach(enemy => scene.remove(enemy));
    enemies = [];
    
    // Remove all power-ups
    powerUps.forEach(powerUp => scene.remove(powerUp));
    powerUps = [];
    
    // Remove all explosions
    explosions.forEach(explosion => scene.remove(explosion));
    explosions = [];
    
    // Remove obstacles (except initial ones)
    for (let i = obstacles.length - 1; i >= 10; i--) {
        scene.remove(obstacles[i]);
        obstacles.splice(i, 1);
    }
}

/**
 * Game over handler
 */
function gameOver() {
    gameState = GAME_STATE.GAME_OVER;
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

/**
 * Update score display
 */
function updateScoreDisplay() {
    document.getElementById('score').textContent = `Score: ${score}`;
}

/**
 * Update lives display
 */
function updateLivesDisplay() {
    document.getElementById('lives').textContent = `Lives: ${lives}`;
}

/**
 * Update power meter display
 */
function updatePowerMeterDisplay() {
    const powerItems = document.querySelectorAll('.power-item');
    
    powerItems.forEach((item, index) => {
        // Reset classes
        item.classList.remove('active', 'selected');
        
        // Mark as active if the power-up is enabled
        const powerType = item.dataset.power;
        if (playerPowerUps[powerType] === true || 
            (powerType === 'speed' && playerPowerUps.speed > 0)) {
            item.classList.add('active');
        }
        
        // Mark next power-up to be collected
        if (index === powerLevel) {
            item.classList.add('selected');
        }
    });
}

/**
 * Creates an enemy at a random position
 */
function spawnEnemy() {
    // Different enemy types
    const enemyTypes = [
        { 
            geometry: new THREE.BoxGeometry(0.3, 0.3, 0.3),
            color: 0xff0000,
            emissive: 0x500000,
            health: 1,
            score: 100
        },
        { 
            geometry: new THREE.SphereGeometry(0.2, 8, 8),
            color: 0xff5500,
            emissive: 0x551500,
            health: 2,
            score: 200
        },
        { 
            geometry: new THREE.TetrahedronGeometry(0.25),
            color: 0xff0055,
            emissive: 0x550015,
            health: 3,
            score: 300
        }
    ];
    
    // Select random enemy type
    const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    
    // Create enemy
    const material = new THREE.MeshPhongMaterial({
        color: enemyType.color,
        emissive: enemyType.emissive,
        shininess: 30
    });
    
    const enemy = new THREE.Mesh(enemyType.geometry, material);
    
    // Set random position on right side of screen
    enemy.position.set(
        5 + Math.random() * 2, // Right side, slightly off-screen
        Math.random() * 8 - 4, // Random Y position
        0
    );
    
    // Set enemy properties
    enemy.health = enemyType.health;
    enemy.score = enemyType.score;
    enemy.speed = CONFIG.enemySpeed;
    
    // Add to scene and enemy list
    scene.add(enemy);
    enemies.push(enemy);
}

/**
 * Fire player weapon based on current power-ups
 */
function firePlayerWeapon() {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    
    // Standard bullet
    function createBullet(offsetY = 0) {
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.set(player.position.x + 0.3, player.position.y + offsetY, 0);
        bullet.speed = CONFIG.bulletSpeed;
        bullet.power = playerPowerUps.laser ? 2 : 1;
        scene.add(bullet);
        bullets.push(bullet);
    }
    
    // Create standard bullet
    createBullet();
    
    // If double power-up is active, create second bullet
    if (playerPowerUps.double) {
        createBullet(0.2);
        createBullet(-0.2);
    }
    
    // If missile power-up is active, create missile
    if (playerPowerUps.missile) {
        const missileGeometry = new THREE.ConeGeometry(0.1, 0.2, 4);
        missileGeometry.rotateZ(Math.PI / 2);
        const missileMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        
        const missile = new THREE.Mesh(missileGeometry, missileMaterial);
        missile.position.set(player.position.x, player.position.y - 0.3, 0);
        missile.speed = CONFIG.bulletSpeed * 0.7;
        missile.power = 3;
        missile.isMissile = true;
        
        scene.add(missile);
        bullets.push(missile);
    }
}

/**
 * Collect power-up and apply effect
 */
function collectPowerUp(powerUp) {
    // Increase power level
    powerLevel++;
    
    // Automatically apply power-up based on current count
    const powerItems = document.querySelectorAll('.power-item');
    if (powerLevel <= powerItems.length) {
        // Apply power-up directly (zero-indexed)
        const powerType = powerItems[powerLevel - 1].dataset.power;
        applyPowerUp(powerType);
    }
    
    // Update UI
    updatePowerMeterDisplay();
    
    // Remove power-up object
    scene.remove(powerUp);
    powerUps.splice(powerUps.indexOf(powerUp), 1);
}

/**
 * Apply power-up effect
 */
function applyPowerUp(powerType) {
    switch (powerType) {
        case 'speed':
            playerPowerUps.speed = Math.min(playerPowerUps.speed + 1, 3);
            break;
        case 'missile':
            playerPowerUps.missile = true;
            break;
        case 'double':
            playerPowerUps.double = true;
            break;
        case 'laser':
            playerPowerUps.laser = true;
            break;
        case 'shield':
            playerPowerUps.shield = true;
            player.shield.visible = true;
            break;
    }
}

/**
 * Create explosion effect at position
 */
function createExplosion(position, size = 1, color = 0xffaa00) {
    const particleCount = 10;
    const explosionGeometry = new THREE.BufferGeometry();
    const explosionPositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        explosionPositions[i3] = position.x;
        explosionPositions[i3 + 1] = position.y;
        explosionPositions[i3 + 2] = position.z;
    }
    
    explosionGeometry.setAttribute('position', new THREE.BufferAttribute(explosionPositions, 3));
    
    const explosionMaterial = new THREE.PointsMaterial({
        color: color,
        size: 0.1 * size,
        transparent: true,
        opacity: 1
    });
    
    const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
    explosion.userData.age = 0;
    explosion.userData.size = size;
    explosion.userData.particlePositions = explosionPositions;
    
    scene.add(explosion);
    explosions.push(explosion);
}

/**
 * Check collisions between game objects
 */
function checkCollisions() {
    // Check bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            
            // Simple distance check for collision
            const distance = bullet.position.distanceTo(enemy.position);
            if (distance < 0.3) {
                // Reduce enemy health
                enemy.health -= bullet.power;
                
                // Remove bullet
                scene.remove(bullet);
                bullets.splice(i, 1);
                
                // Create hit effect
                createExplosion(bullet.position, 0.5, 0x00ffff);
                
                // Check if enemy destroyed
                if (enemy.health <= 0) {
                    // Add score
                    score += enemy.score;
                    updateScoreDisplay();
                    
                    // Create explosion
                    createExplosion(enemy.position);
                    
                    // Chance to drop power-up
                    if (Math.random() < CONFIG.powerUpChance) {
                        createPowerUp(enemy.position);
                    }
                    
                    // Remove enemy
                    scene.remove(enemy);
                    enemies.splice(j, 1);
                }
                
                break;
            }
        }
        
        // Check bullets vs obstacles
        for (let j = obstacles.length - 1; j >= 0; j--) {
            const obstacle = obstacles[j];
            
            // Simple distance check for collision
            const distance = bullet.position.distanceTo(obstacle.position);
            if (distance < 0.4) {
                // Missiles destroy obstacles
                if (bullet.isMissile) {
                    // Create explosion
                    createExplosion(obstacle.position, 1.5, 0xff5500);
                    
                    // Remove obstacle
                    scene.remove(obstacle);
                    obstacles.splice(j, 1);
                }
                
                // Remove bullet
                scene.remove(bullet);
                bullets.splice(i, 1);
                
                // Create hit effect
                createExplosion(bullet.position, 0.5, 0x00ffff);
                
                break;
            }
        }
    }
    
    // Skip player collision check if invincible
    if (playerInvincible) return;
    
    // Check player vs enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const distance = player.position.distanceTo(enemy.position);
        
        if (distance < 0.4) {
            // Create explosion
            createExplosion(enemy.position);
            
            // Remove enemy
            scene.remove(enemy);
            enemies.splice(i, 1);
            
            // Handle player hit
            handlePlayerHit();
            
            break;
        }
    }
    
    // Check player vs obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        const distance = player.position.distanceTo(obstacle.position);
        
        if (distance < 0.4) {
            // Handle player hit
            handlePlayerHit();
            break;
        }
    }
    
    // Check player vs power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        const distance = player.position.distanceTo(powerUp.position);
        
        if (distance < 0.4) {
            collectPowerUp(powerUp);
        }
    }
}

/**
 * Handle player being hit
 */
function handlePlayerHit() {
    // If shield is active, just remove it
    if (playerPowerUps.shield) {
        playerPowerUps.shield = false;
        player.shield.visible = false;
        
        // Create shield breaking effect
        createExplosion(player.position, 1, 0x00ffff);
        
        // Set brief invincibility
        playerInvincible = true;
        playerInvincibleTimer = CONFIG.playerInvincibleTime / 2;
        
        return;
    }
    
    // Reduce lives
    lives--;
    updateLivesDisplay();
    
    // Create explosion effect
    createExplosion(player.position, 1.5, 0x3030ff);
    
    // Game over if no lives left
    if (lives <= 0) {
        gameOver();
        return;
    }
    
    // Set player invincible temporarily
    playerInvincible = true;
    playerInvincibleTimer = CONFIG.playerInvincibleTime;
    
    // Reset player position
    player.position.set(-3, 0, 0);
}

/**
 * Create power-up pickup
 */
function createPowerUp(position) {
    const powerUpGeometry = new THREE.OctahedronGeometry(0.15);
    const powerUpMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00,
        emissive: 0x555500,
        shininess: 80
    });
    
    const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUp.position.copy(position);
    
    scene.add(powerUp);
    powerUps.push(powerUp);
}

/**
 * Main animation loop
 */
function animate(time) {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const delta = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;
    
    // Update only if playing
    if (gameState === GAME_STATE.PLAYING) {
        updateGame(delta, time);
    }
    
    // Render scene
    renderer.render(scene, camera);
}

/**
 * Update game state
 */
function updateGame(delta, time) {
    // Update player position
    if (player.targetY !== undefined) {
        const playerSpeedFactor = 1 + (playerPowerUps.speed * 0.5);
        const targetDistance = player.targetY - player.position.y;
        const moveStep = CONFIG.playerSpeed * playerSpeedFactor * delta * 60;
        
        if (Math.abs(targetDistance) > moveStep) {
            player.position.y += Math.sign(targetDistance) * moveStep;
        } else {
            player.position.y = player.targetY;
        }
        
        // Keep player within bounds
        player.position.y = Math.max(-4.5, Math.min(4.5, player.position.y));
    }
    
    // Update player light position
    playerLight.position.copy(player.position);
    
    // Auto-fire weapon if pointer is down
    if (isPointerDown && gameState === GAME_STATE.PLAYING) {
        const currentTime = performance.now();
        if (currentTime - lastFireTime >= CONFIG.fireRate) {
            firePlayerWeapon();
            lastFireTime = currentTime;
        }
    }
    
    // Player invincibility effect
    if (playerInvincible) {
        playerInvincibleTimer -= delta * 1000;
        
        // Flash player visibility
        player.visible = Math.floor(time / 100) % 2 === 0;
        
        if (playerInvincibleTimer <= 0) {
            playerInvincible = false;
            player.visible = true;
        }
    }
    
    // Update scrolling stars for parallax effect
    if (window.starLayers) {
        window.starLayers.forEach(starLayer => {
            const positions = starLayer.positions;
            const count = positions.length / 3;
            
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                // Move star to the left
                positions[i3] -= starLayer.scrollSpeed * delta * 60;
                
                // Wrap around when star goes off-screen
                if (positions[i3] < -10) {
                    positions[i3] = 10;
                    positions[i3 + 1] = Math.random() * 16 - 8; // Randomize Y when wrapping
                }
            }
            
            // Update buffer
            starLayer.geometry.attributes.position.needsUpdate = true;
        });
    }
    
    // Update scrolling obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        
        // Move obstacle to the left
        obstacle.position.x -= obstacle.scrollSpeed * delta * 60;
        
        // Slowly rotate obstacles for visual effect
        obstacle.rotation.x += delta * 0.2;
        obstacle.rotation.z += delta * 0.3;
        
        // Wrap around when obstacle goes off-screen
        if (obstacle.position.x < -10) {
            // For wall obstacles, just move them back to the right
            if (Math.abs(obstacle.position.y) === 4) {
                obstacle.position.x = 14; // Move to far right
            } else {
                // For floating obstacles, randomize position
                obstacle.position.x = 10 + Math.random() * 5;
                obstacle.position.y = Math.random() * 6 - 3;
                
                // Randomize rotation
                obstacle.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
            }
        }
    }
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Move bullet forward
        bullet.position.x += bullet.speed * delta * 60;
        
        // Missile seeking behavior
        if (bullet.isMissile && enemies.length > 0) {
            // Find closest enemy
            let closestEnemy = null;
            let closestDistance = Infinity;
            
            for (const enemy of enemies) {
                if (enemy.position.x > bullet.position.x) {
                    const distance = bullet.position.distanceTo(enemy.position);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }
            }
            
            // Seek towards closest enemy
            if (closestEnemy && closestDistance < 5) {
                const targetY = closestEnemy.position.y;
                const yDiff = targetY - bullet.position.y;
                bullet.position.y += Math.sign(yDiff) * bullet.speed * 0.5 * delta * 60;
            }
        }
        
        // Remove bullets that go off-screen
        if (bullet.position.x > 6) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Move enemy
        enemy.position.x -= enemy.speed * delta * 60;
        
        // Simple sinusoidal movement
        enemy.position.y += Math.sin(time * 0.001 + enemy.position.x) * enemy.speed * 0.5 * delta * 60;
        
        // Rotate enemy for visual effect
        enemy.rotation.x += delta;
        enemy.rotation.z += delta * 0.5;
        
        // Remove enemies that go off-screen
        if (enemy.position.x < -6) {
            scene.remove(enemy);
            enemies.splice(i, 1);
        }
    }
    
    // Update power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        
        // Move power-up slowly to the left
        powerUp.position.x -= CONFIG.enemySpeed * 0.5 * delta * 60;
        
        // Rotate power-up for visual effect
        powerUp.rotation.x += delta * 2;
        powerUp.rotation.y += delta * 2;
        powerUp.rotation.z += delta * 2;
        
        // Remove power-ups that go off-screen
        if (powerUp.position.x < -6) {
            scene.remove(powerUp);
            powerUps.splice(i, 1);
        }
    }
    
    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        explosion.userData.age += delta;
        
        // Update explosion particles
        const positions = explosion.userData.particlePositions;
        const particleCount = positions.length / 3;
        
        for (let j = 0; j < particleCount; j++) {
            const j3 = j * 3;
            
            // Random spread
            positions[j3] += (Math.random() - 0.5) * explosion.userData.size * delta * 2;
            positions[j3 + 1] += (Math.random() - 0.5) * explosion.userData.size * delta * 2;
            positions[j3 + 2] += (Math.random() - 0.5) * explosion.userData.size * delta * 0.5;
        }
        
        // Update buffer
        explosion.geometry.attributes.position.needsUpdate = true;
        
        // Fade out
        explosion.material.opacity = 1 - (explosion.userData.age * 2);
        
        // Remove old explosions
        if (explosion.userData.age > 0.5) {
            scene.remove(explosion);
            explosions.splice(i, 1);
        }
    }
    
    // Check collisions
    checkCollisions();
    
    // Spawn enemies
    if (time - lastEnemySpawn > CONFIG.enemySpawnRate) {
        spawnEnemy();
        lastEnemySpawn = time;
        
        // Increase difficulty over time
        CONFIG.enemySpawnRate = Math.max(300, CONFIG.enemySpawnRate - 5);
    }
}
/**
 * Marble Madness using Three.js
 * Controls: Touch or mouse to directly control the marble
 */

// Game constants
const GAME_STATE = {
    MENU: 0,          // Main menu
    PLAYING: 1,       // Actively playing
    GAME_OVER: 2,     // Lost
    WIN: 3            // Won
};

// Game settings
const SETTINGS = {
    marbleRadius: 0.5,        // Radius of the marble
    cameraDistance: 15,       // Distance of camera from the scene
    timeLimit: 60,            // Time limit in seconds
    gravity: 0.015,           // Gravity when falling
    iceMultiplier: 1.5,       // Speed multiplier on ice
    stickyMultiplier: 0.5,    // Speed multiplier on sticky surfaces
    enemyStartLevel: 2        // Level at which enemies first appear
};

// Surface types
const SURFACE = {
    NONE: 0,       // Empty space/hole
    NORMAL: 1,     // Regular surface
    START: 2,      // Starting position
    GOAL: 3,       // Goal/finish
    ICE: 4,        // Slippery ice surface
    STICKY: 5,     // Sticky/slow surface
    ENEMY: 6,      // Enemy position
    ACID: 7        // Acid pool (damaging)
};

// Game variables
let renderer, scene, camera;
let marble;
let level, levelGroup;
let startTime, timeLeft;
let gameState = GAME_STATE.MENU;
let marbleVelocity = { x: 0, z: 0, y: 0 };
let isPointerDown = false;
let lastPointerPosition = { x: 0, y: 0 };
let enemies = [];
let isJumping = false;
let isFalling = false;
let currentLevel = 1;
let enemySpeed = 0.05;

// DOM elements
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const endMessage = document.getElementById('end-message');
const timeValue = document.getElementById('time-value');
const statusEl = document.getElementById('status');

/**
 * Initialize the game
 */
function init() {
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('game-canvas'),
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000); // Black background
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera (isometric view)
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -5 * aspect, 5 * aspect, 5, -5, 0.1, 1000
    );
    
    // Position the camera for isometric view (45° around Y and 35.264° around X)
    camera.position.set(SETTINGS.cameraDistance, SETTINGS.cameraDistance, SETTINGS.cameraDistance);
    camera.lookAt(0, 0, 0);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Set up event listeners
    setupEventListeners();
    
    // Start animation loop
    animate();
}

/**
 * Create the level based on the current level number
 */
function createLevel() {
    // Create a group to hold all level elements
    levelGroup = new THREE.Group();
    scene.add(levelGroup);
    
    // Define level layout based on current level
    let levelDefinition;
    
    if (currentLevel === 1) {
        levelDefinition = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 4, 4, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 4, 4, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 5, 5, 5, 1, 0, 0, 0],
            [0, 0, 1, 1, 5, 5, 5, 5, 1, 0, 0, 0],
            [0, 0, 1, 1, 5, 7, 7, 5, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 3, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ];
    } else {
        // Level 2 - more complex with more hazards
        levelDefinition = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 2, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 6, 1, 6, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 4, 4, 4, 4, 4, 4, 1, 0, 0],
            [0, 0, 1, 4, 4, 4, 4, 4, 4, 1, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 7, 7, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 7, 7, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 5, 5, 5, 5, 1, 1, 0, 0],
            [0, 0, 1, 6, 5, 5, 5, 5, 6, 1, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ];
    }
    
    // Materials for different surfaces
    const materials = {
        [SURFACE.NORMAL]: new THREE.MeshPhongMaterial({ color: 0x4682B4 }), // Steel blue
        [SURFACE.START]: new THREE.MeshPhongMaterial({ color: 0x32CD32 }),  // Lime green
        [SURFACE.GOAL]: new THREE.MeshPhongMaterial({ color: 0xFF4500 }),   // Orange red
        [SURFACE.ICE]: new THREE.MeshPhongMaterial({ color: 0xADD8E6 }),    // Light blue
        [SURFACE.STICKY]: new THREE.MeshPhongMaterial({ color: 0x8B4513 }), // Brown
        [SURFACE.ACID]: new THREE.MeshPhongMaterial({ 
            color: 0x00FF00,
            transparent: true,
            opacity: 0.8
        })
    };
    
    // Level dimensions
    const levelWidth = levelDefinition[0].length;
    const levelHeight = levelDefinition.length;
    
    // Center the level
    const offsetX = -levelWidth / 2 + 0.5;
    const offsetZ = -levelHeight / 2 + 0.5;
    
    // Clear enemies array
    enemies = [];
    
    // Create floor tiles based on level definition
    for (let z = 0; z < levelHeight; z++) {
        for (let x = 0; x < levelWidth; x++) {
            const tileType = levelDefinition[z][x];
            
            if (tileType > 0) { // Not a hole
                // Create tile with different height based on type
                let tileHeight = 0.5;
                
                // Use different material based on tile type
                let material = materials[tileType] || materials[SURFACE.NORMAL];
                
                // Create the tile
                const geometry = new THREE.BoxGeometry(1, tileHeight, 1);
                const tile = new THREE.Mesh(geometry, material);
                tile.position.set(x + offsetX, -tileHeight/2, z + offsetZ);
                tile.userData = { type: tileType }; // Store the surface type
                
                // Add to level group
                levelGroup.add(tile);
                
                // If it's the start position, place the marble there
                if (tileType === SURFACE.START) {
                    marble.position.set(x + offsetX, SETTINGS.marbleRadius, z + offsetZ);
                }
                
                // If it's an enemy position AND we're at/past the enemy start level, create an enemy
                if (tileType === SURFACE.ENEMY && currentLevel >= SETTINGS.enemyStartLevel) {
                    createEnemy(x + offsetX, z + offsetZ);
                }
                
                // If it's acid, add a special effect
                if (tileType === SURFACE.ACID) {
                    // Add a small animation to the acid
                    const acidTile = tile;
                    acidTile.userData.animOffset = Math.random() * Math.PI * 2;
                }
            }
        }
    }
}

/**
 * Create an enemy at the specified position
 * @param {number} x - X position
 * @param {number} z - Z position
 */
function createEnemy(x, z) {
    const enemyGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const enemyMaterial = new THREE.MeshPhongMaterial({ color: 0xFF0000 }); // Red
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    
    enemy.position.set(x, 0.4, z);
    enemy.userData = {
        direction: new THREE.Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize(),
        timeSinceDirectionChange: 0
    };
    
    levelGroup.add(enemy);
    enemies.push(enemy);
}

/**
 * Create the marble with physics properties
 */
function createMarble() {
    // Create marble geometry and material
    const geometry = new THREE.SphereGeometry(SETTINGS.marbleRadius, 32, 32);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xFFFFFF,
        specular: 0x111111,
        shininess: 100
    });
    
    // Create marble mesh
    marble = new THREE.Mesh(geometry, material);
    scene.add(marble);
    
    // Reset marble velocity
    marbleVelocity = { x: 0, y: 0, z: 0 };
    isJumping = false;
    isFalling = false;
}

/**
 * Set up event listeners for user input
 */
function setupEventListeners() {
    // Mouse events
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    
    // Touch events
    window.addEventListener('touchstart', handleTouch(onPointerDown));
    window.addEventListener('touchmove', handleTouch(onPointerMove));
    window.addEventListener('touchend', onPointerUp);
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Button events
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
}

/**
 * Helper function to handle touch events
 * @param {Function} callback - The callback function to execute
 * @returns {Function} - A function that handles the touch event
 */
function handleTouch(callback) {
    return function(event) {
        event.preventDefault();
        if (event.touches.length > 0) {
            event.clientX = event.touches[0].clientX;
            event.clientY = event.touches[0].clientY;
            callback(event);
        }
    };
}

/**
 * Handle pointer down event
 * @param {Event} event - The pointer event
 */
function onPointerDown(event) {
    if (gameState === GAME_STATE.PLAYING) {
        isPointerDown = true;
        lastPointerPosition.x = event.clientX;
        lastPointerPosition.y = event.clientY;
    }
}

/**
 * Handle pointer move event to control the marble
 * @param {Event} event - The pointer event
 */
function onPointerMove(event) {
    if (gameState === GAME_STATE.PLAYING && isPointerDown) {
        // Calculate movement direction
        const deltaX = event.clientX - lastPointerPosition.x;
        const deltaY = event.clientY - lastPointerPosition.y;
        
        // Calculate total distance moved for this swipe
        const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Check if the swipe passes through the marble
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Create a raycaster to check for marble intersection
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        
        const intersects = raycaster.intersectObject(marble);
        const isPassingThroughMarble = intersects.length > 0;
        
        // Only apply a force if we've moved a certain minimum distance and
        // the swipe passes over the marble
        if (totalDistance > 5 && isPassingThroughMarble) {
            // Calculate swipe force based on distance
            const swipeForce = totalDistance * 0.0015;
            
            // Get camera directions for mapping screen moves to world moves
            const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const cameraDown = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
            
            // Calculate impulse in world space based on screen movement direction (normalized)
            const normalizedDeltaX = deltaX / totalDistance;
            const normalizedDeltaY = deltaY / totalDistance;
            
            const impulseX = (normalizedDeltaX * cameraRight.x + normalizedDeltaY * cameraDown.x) * swipeForce;
            const impulseZ = (normalizedDeltaX * cameraRight.z + normalizedDeltaY * cameraDown.z) * swipeForce;
            
            // Calculate dot product to check if swipe direction is opposing current velocity
            const currentDirection = new THREE.Vector2(marbleVelocity.x, marbleVelocity.z).normalize();
            const swipeDirection = new THREE.Vector2(impulseX, impulseZ).normalize();
            const dotProduct = currentDirection.dot(swipeDirection);
            
            // If swipe direction is opposing current motion (dot product < 0)
            if (dotProduct < 0) {
                // Apply countering force to current velocity
                marbleVelocity.x += impulseX * 0.5; // Reduce effect for opposing direction
                marbleVelocity.z += impulseZ * 0.5;
            } else {
                // Add to current velocity for same direction
                marbleVelocity.x += impulseX;
                marbleVelocity.z += impulseZ;
            }
            
            // Cap maximum velocity
            const maxVelocity = 0.12;
            marbleVelocity.x = Math.max(-maxVelocity, Math.min(maxVelocity, marbleVelocity.x));
            marbleVelocity.z = Math.max(-maxVelocity, Math.min(maxVelocity, marbleVelocity.z));
            
            // End the swipe after applying force
            isPointerDown = false;
        }
        
        // Update last position
        lastPointerPosition.x = event.clientX;
        lastPointerPosition.y = event.clientY;
    }
}

/**
 * Handle pointer up event
 */
function onPointerUp() {
    isPointerDown = false;
}

/**
 * Handle window resize
 */
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    
    // Update orthographic camera
    camera.left = -5 * aspect;
    camera.right = 5 * aspect;
    camera.updateProjectionMatrix();
    
    // Update renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Start a new game
 */
function startGame() {
    // Reset game state
    gameState = GAME_STATE.PLAYING;
    currentLevel = 1;
    
    // Hide menus
    startScreen.style.display = 'none';
    endScreen.style.display = 'none';
    
    // Reset timer
    startTime = Date.now();
    timeLeft = SETTINGS.timeLimit;
    updateTimer();
    
    // Clear previous level if exists
    if (levelGroup) {
        scene.remove(levelGroup);
    }
    
    // Clear previous marble if exists
    if (marble) {
        scene.remove(marble);
    }
    
    // Create new marble and level
    createMarble();
    createLevel();
    
    showStatus('Level ' + currentLevel + ' - Go!');
}

/**
 * Restart the game after game over
 */
function restartGame() {
    startGame();
}

/**
 * Advance to the next level
 */
function nextLevel() {
    // Increase level number
    currentLevel++;
    
    // Check if all levels are completed
    if (currentLevel > 2) { // We have 2 levels total
        endGame(true);
        return;
    }
    
    // Remove old level
    scene.remove(levelGroup);
    
    // Reset marble velocity
    marbleVelocity = { x: 0, y: 0, z: 0 };
    isJumping = false;
    isFalling = false;
    
    // Create new level
    createLevel();
    
    // Add some time for the next level
    timeLeft += 30;
    
    showStatus('Level ' + currentLevel + ' - Go!');
}

/**
 * End the game with a specified result
 * @param {boolean} isVictory - Whether the player won
 */
function endGame(isVictory) {
    gameState = isVictory ? GAME_STATE.WIN : GAME_STATE.GAME_OVER;
    
    // Show end screen
    endScreen.style.display = 'flex';
    endMessage.textContent = isVictory ? 'Victory!' : 'Game Over!';
}

/**
 * Update timer display and check for time out
 */
function updateTimer() {
    if (gameState === GAME_STATE.PLAYING) {
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
        timeLeft = Math.max(0, SETTINGS.timeLimit + 30 * (currentLevel - 1) - elapsedSeconds);
        
        // Update timer display
        timeValue.textContent = timeLeft;
        
        // Check for time out
        if (timeLeft <= 0) {
            endGame(false);
        }
    }
}

/**
 * Show a status message
 * @param {string} message - The message to display
 */
function showStatus(message) {
    statusEl.textContent = message;
    statusEl.style.opacity = 1;
    
    // Hide after 2 seconds
    setTimeout(() => {
        statusEl.style.opacity = 0;
    }, 2000);
}

/**
 * Check which type of surface the marble is currently on
 * @returns {number} - The surface type from SURFACE enum
 */
function getMarbleSurface() {
    // Raycasting from the marble downward
    const raycaster = new THREE.Raycaster(
        marble.position.clone(),
        new THREE.Vector3(0, -1, 0)
    );
    
    const intersects = raycaster.intersectObjects(levelGroup.children);
    
    if (intersects.length > 0 && intersects[0].distance < SETTINGS.marbleRadius + 0.1) {
        return intersects[0].object.userData.type || SURFACE.NORMAL;
    }
    
    return SURFACE.NONE;
}

/**
 * Check if the marble has reached the goal
 * @returns {boolean} - Whether the marble is at the goal
 */
function isMarbleAtGoal() {
    return getMarbleSurface() === SURFACE.GOAL;
}

/**
 * Check if the marble is touching an enemy
 * @returns {boolean} - Whether the marble is touching an enemy
 */
function isMarbleTouchingEnemy() {
    for (const enemy of enemies) {
        const distance = marble.position.distanceTo(enemy.position);
        if (distance < SETTINGS.marbleRadius + 0.4) { // Enemy radius is 0.4
            return true;
        }
    }
    
    return false;
}

/**
 * Update the enemies' positions and behaviors
 */
function updateEnemies() {
    for (const enemy of enemies) {
        // Move in current direction
        enemy.position.x += enemy.userData.direction.x * enemySpeed;
        enemy.position.z += enemy.userData.direction.y * enemySpeed;
        
        // Check for collision with level boundaries
        const raycaster = new THREE.Raycaster(
            enemy.position.clone(),
            new THREE.Vector3(
                enemy.userData.direction.x,
                0,
                enemy.userData.direction.y
            ).normalize()
        );
        
        const intersects = raycaster.intersectObjects(levelGroup.children);
        
        // Change direction if hitting a wall or if it's time to change
        enemy.userData.timeSinceDirectionChange += 1/60;
        
        if (intersects.length > 0 && intersects[0].distance < 0.5 || 
            enemy.userData.timeSinceDirectionChange > 3) {
            
            // Pick a new random direction
            enemy.userData.direction = new THREE.Vector2(
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();
            
            enemy.userData.timeSinceDirectionChange = 0;
        }
    }
}

/**
 * Update marble physics
 */
function updateMarblePhysics() {
    if (gameState === GAME_STATE.PLAYING) {
        // Get current surface type
        const surfaceType = getMarbleSurface();
        
        // Apply surface-specific effects
        let frictionFactor = 0.98; // Default friction
        let speedMultiplier = 1.0;
        
        if (surfaceType === SURFACE.ICE) {
            // Less friction on ice
            frictionFactor = 0.995;
            speedMultiplier = SETTINGS.iceMultiplier;
        } else if (surfaceType === SURFACE.STICKY) {
            // More friction on sticky surfaces
            frictionFactor = 0.94;
            speedMultiplier = SETTINGS.stickyMultiplier;
        } else if (surfaceType === SURFACE.ACID) {
            // Damage from acid
            endGame(false);
            showStatus('Dissolved in acid!');
            return;
        }
        
        // Apply movement with continuous physics
        if (surfaceType !== SURFACE.NONE && !isJumping && !isFalling) {
            // Apply velocity
            marble.position.x += marbleVelocity.x * speedMultiplier * 0.95;
            marble.position.z += marbleVelocity.z * speedMultiplier * 0.95;
            
            // Apply friction to gradually slow down
            marbleVelocity.x *= frictionFactor;
            marbleVelocity.z *= frictionFactor;
            
            // Stop completely if velocity is very small
            if (Math.abs(marbleVelocity.x) < 0.001) marbleVelocity.x = 0;
            if (Math.abs(marbleVelocity.z) < 0.001) marbleVelocity.z = 0;
        }
        
        // Apply gravity if in air
        if (surfaceType === SURFACE.NONE || isJumping) {
            marbleVelocity.y -= SETTINGS.gravity;
            isFalling = true;
        } else {
            // Reset vertical velocity when on surface
            marbleVelocity.y = 0;
            isFalling = false;
        }
        
        // Update vertical position
        marble.position.y += marbleVelocity.y;
        
        // Check for falling off
        if (marble.position.y < -5) {
            showStatus('Fell off the level!');
            endGame(false);
            return;
        }
        
        // Check for reaching the goal
        if (isMarbleAtGoal()) {
            showStatus('Level ' + currentLevel + ' completed!');
            nextLevel();
        }
        
        // Check for enemy collision
        if (isMarbleTouchingEnemy()) {
            showStatus('Hit by an enemy!');
            endGame(false);
        }
    }
}
        
/**
 * Update acid pool animation
 */
function updateAcidAnimation() {
    if (gameState === GAME_STATE.PLAYING) {
        levelGroup.children.forEach(child => {
            if (child.userData && child.userData.type === SURFACE.ACID) {
                // Make acid surface undulate
                const time = Date.now() * 0.001;
                const offset = child.userData.animOffset || 0;
                child.position.y = -0.25 + Math.sin(time + offset) * 0.05;
            }
        });
    }
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    
    // Update game logic
    if (gameState === GAME_STATE.PLAYING) {
        updateMarblePhysics();
        updateEnemies();
        updateAcidAnimation();
        updateTimer();
    }
    
    // Animate marble rotation based on movement
    if (marble) {
        marble.rotation.x += marbleVelocity.z * 2;
        marble.rotation.z -= marbleVelocity.x * 2;
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Initialize the game when the page loads
window.addEventListener('load', init);
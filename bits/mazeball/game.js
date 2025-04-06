/**
 * Maze Runner Game
 * A 3D maze game where players navigate through increasingly complex mazes.
 */

// Game constants
const CELL_SIZE = 2; // Size of each maze cell
const WALL_HEIGHT = 1.5; // Height of maze walls
const PLAYER_SPEED = 4.5; // Player movement speed (increased)
const PLAYER_RADIUS = 0.3; // Player collision radius
const LEVELS = 5; // Total number of levels

// Game state variables
let scene, camera, renderer, player, goalMarker;
let mazeCells = [];
let mazeWidth = 5; // Starting maze width
let mazeHeight = 5; // Starting maze height
let currentLevel = 1;
let startTime;
let isGameRunning = false;
let isLevelComplete = false;
let isDead = false; // Track if player has died
let touchStartX, touchStartY;
let targetX, targetZ; // Target position for continuous movement
let isMoving = false; // Flag to track if player is moving
let isMouseDown = false; // Track if mouse is being held down
let mouseDirection = { x: 0, z: 0 }; // Direction of mouse movement

// DOM elements
const levelNumber = document.getElementById('level-number');
const timeCounter = document.getElementById('time-counter');
const gameMessage = document.getElementById('game-message');

/**
 * Initialize the game setup
 */
function init() {
    // Create Three.js scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Setup camera for top-down view
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 10;
    camera.rotation.x = -Math.PI / 2; // Perfect top-down angle
    
    // Setup renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4A7023 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create player
    const playerGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, 32, 32);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xFF5500 });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.castShadow = true;
    player.position.y = PLAYER_RADIUS;
    scene.add(player);
    
    // Create goal marker
    const goalGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const goalMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00, emissive: 0x00FF00, emissiveIntensity: 0.5 });
    goalMarker = new THREE.Mesh(goalGeometry, goalMaterial);
    goalMarker.position.y = 0.05;
    scene.add(goalMarker);
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchmove', onTouchMove);
    
    // Start the first level
    startLevel(currentLevel);
    
    // Start animation loop
    animate();
}

/**
 * Generate a random maze using the Depth-First Search algorithm
 * @param {number} width - Maze width in cells
 * @param {number} height - Maze height in cells
 * @returns {Array} 2D array representing the maze (1=wall, 0=path)
 */
function generateMaze(width, height) {
    // Initialize maze with all walls
    const maze = Array(height).fill().map(() => Array(width).fill(1));
    
    // Stack for DFS algorithm
    const stack = [];
    
    // Random starting point (must be odd coordinates)
    const startX = 1;
    const startY = 1;
    
    // Mark starting cell as path
    maze[startY][startX] = 0;
    
    // Push starting cell to stack
    stack.push([startX, startY]);
    
    // Define directions: [dx, dy]
    const directions = [
        [0, -2], // Up
        [2, 0],  // Right
        [0, 2],  // Down
        [-2, 0]  // Left
    ];
    
    // Continue until stack is empty
    while (stack.length > 0) {
        // Get current cell
        const [x, y] = stack[stack.length - 1];
        
        // Get unvisited neighbors
        const neighbors = [];
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            // Check if neighbor is inside the maze and unvisited
            if (nx >= 1 && nx < width - 1 && ny >= 1 && ny < height - 1 && maze[ny][nx] === 1) {
                neighbors.push([nx, ny, dx / 2, dy / 2]);
            }
        }
        
        if (neighbors.length > 0) {
            // Choose random neighbor
            const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            
            // Carve passage
            maze[y + wy][x + wx] = 0; // Wall between current and neighbor
            maze[ny][nx] = 0; // Neighbor cell
            
            // Push neighbor to stack
            stack.push([nx, ny]);
        } else {
            // Backtrack
            stack.pop();
        }
    }

    // Create start and end points
    maze[1][1] = 0; // Start
    maze[height - 2][width - 2] = 0; // End
    
    return maze;
}

/**
 * Build the 3D maze from the maze data
 * @param {Array} mazeData - 2D array representing the maze
 */
function buildMaze(mazeData) {
    // Clear old maze
    mazeCells.forEach(cell => scene.remove(cell));
    mazeCells = [];
    
    // Wall geometry and material
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    
    // Create walls
    for (let y = 0; y < mazeData.length; y++) {
        for (let x = 0; x < mazeData[y].length; x++) {
            if (mazeData[y][x] === 1) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(
                    x * CELL_SIZE - (mazeData[y].length * CELL_SIZE) / 2 + CELL_SIZE / 2,
                    WALL_HEIGHT / 2,
                    y * CELL_SIZE - (mazeData.length * CELL_SIZE) / 2 + CELL_SIZE / 2
                );
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                mazeCells.push(wall);
            }
        }
    }
    
    // Reset player
    player.material.color.set(0xFF5500); // Reset player color
    
    // Set player start position
    player.position.x = 1 * CELL_SIZE - (mazeData[0].length * CELL_SIZE) / 2 + CELL_SIZE / 2;
    player.position.z = 1 * CELL_SIZE - (mazeData.length * CELL_SIZE) / 2 + CELL_SIZE / 2;
    player.position.y = PLAYER_RADIUS;
    
    // Set goal position
    goalMarker.position.x = (mazeData[0].length - 2) * CELL_SIZE - (mazeData[0].length * CELL_SIZE) / 2 + CELL_SIZE / 2;
    goalMarker.position.z = (mazeData.length - 2) * CELL_SIZE - (mazeData.length * CELL_SIZE) / 2 + CELL_SIZE / 2;
}

/**
 * Start a new level
 * @param {number} level - Level number
 */
function startLevel(level) {
    // Update level display
    currentLevel = level;
    levelNumber.textContent = level;
    
    // Clear game message
    gameMessage.textContent = '';
    
    // Calculate maze size based on level (increases with level)
    mazeWidth = 5 + (level * 2);
    mazeHeight = 5 + (level * 2);
    
    // Generate and build maze
    const mazeData = generateMaze(mazeWidth, mazeHeight);
    buildMaze(mazeData);
    
    // Reset game state
    isGameRunning = true;
    isLevelComplete = false;
    isDead = false;
    startTime = Date.now();
    
    // Center camera on player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
}

/**
 * Check if player has reached the goal
 */
function checkGoal() {
    const distanceToGoal = Math.sqrt(
        Math.pow(player.position.x - goalMarker.position.x, 2) +
        Math.pow(player.position.z - goalMarker.position.z, 2)
    );
    
    if (distanceToGoal < 0.5) {
        levelComplete();
    }
}

/**
 * Handle level completion
 */
function levelComplete() {
    isLevelComplete = true;
    isGameRunning = false;
    
    if (currentLevel < LEVELS) {
        gameMessage.textContent = `Level ${currentLevel} Complete! Tap to continue`;
    } else {
        gameMessage.textContent = 'Congratulations! You completed all levels! Tap to restart';
    }
}

/**
 * Move player towards target position
 * @param {number} tX - Target X position
 * @param {number} tZ - Target Z position
 */
function movePlayerTowards(tX, tZ) {
    if (!isGameRunning) return;
    
    // Set the target and start continuous movement
    targetX = tX;
    targetZ = tZ;
    isMoving = true;
}

/**
 * Update player position each frame toward target
 * @returns {boolean} - Whether player reached destination or hit obstacle
 */
function updatePlayerPosition() {
    if (!isGameRunning || !isMoving) return false;
    
    // Calculate direction vector
    const directionX = targetX - player.position.x;
    const directionZ = targetZ - player.position.z;
    
    // Calculate distance to target
    const distanceToTarget = Math.sqrt(directionX * directionX + directionZ * directionZ);
    
    // If player is very close to target, stop moving
    if (distanceToTarget < 0.1) {
        isMoving = false;
        return true;
    }
    
    // Normalize direction vector
    const normalizedDirX = directionX / distanceToTarget;
    const normalizedDirZ = directionZ / distanceToTarget;
    
    // Calculate potential new position with speed
    const deltaTime = 0.016; // Approximately 60fps
    const newX = player.position.x + normalizedDirX * PLAYER_SPEED * deltaTime;
    const newZ = player.position.z + normalizedDirZ * PLAYER_SPEED * deltaTime;
    
    // Check collisions with walls
    let collision = false;
    
    mazeCells.forEach(wall => {
        const wallMinX = wall.position.x - CELL_SIZE / 2;
        const wallMaxX = wall.position.x + CELL_SIZE / 2;
        const wallMinZ = wall.position.z - CELL_SIZE / 2;
        const wallMaxZ = wall.position.z + CELL_SIZE / 2;
        
        // Check if player would collide with this wall
        if (
            newX + PLAYER_RADIUS > wallMinX &&
            newX - PLAYER_RADIUS < wallMaxX &&
            newZ + PLAYER_RADIUS > wallMinZ &&
            newZ - PLAYER_RADIUS < wallMaxZ
        ) {
            collision = true;
        }
    });
    
    // Update position if no collision
    if (!collision) {
        player.position.x = newX;
        player.position.z = newZ;
    } else {
        // Stop moving if collision
        isMoving = false;
        return true;
    }
    
    // Update camera position to follow player (top-down)
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
    
    // Check if player reached goal
    checkGoal();
    
    return false;
}

/**
 * Handle window resize
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Handle player death
 */
function playerDeath() {
    console.log("Player died!");
    isGameRunning = false;
    isDead = true;
    isMoving = false;
    isMouseDown = false;
    
    // Change player color to red to indicate death
    player.material.color.set(0xFF0000);
    
    // Show message
    gameMessage.textContent = 'You died! Tap to restart level';
}

/**
 * Handle mouse down events
 * @param {MouseEvent} event - Mouse event
 */
function onMouseDown(event) {
    if (isLevelComplete) {
        // Go to next level or restart game
        if (currentLevel < LEVELS) {
            startLevel(currentLevel + 1);
        } else {
            startLevel(1);
        }
        return;
    }
    
    if (isDead) {
        // Restart current level
        startLevel(currentLevel);
        return;
    }
    
    isMouseDown = true;
    
    // Calculate target position based on mouse position
    updateMouseDirection(event);
}

/**
 * Handle mouse up events
 * @param {MouseEvent} event - Mouse event
 */
function onMouseUp(event) {
    isMouseDown = false;
    isMoving = false;
}

/**
 * Handle mouse move events
 * @param {MouseEvent} event - Mouse event
 */
function onMouseMove(event) {
    if (isMouseDown) {
        updateMouseDirection(event);
    }
}

/**
 * Update the mouse direction for continuous movement
 * @param {MouseEvent} event - Mouse event
 */
function updateMouseDirection(event) {
    // Calculate target position based on mouse position
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Find intersections with ground
    const groundObjects = scene.children.filter(child => 
        child.geometry instanceof THREE.PlaneGeometry
    );
    
    const intersects = raycaster.intersectObjects(groundObjects);
    
    if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        
        // Calculate direction from player to hit point
        const dirX = hitPoint.x - player.position.x;
        const dirZ = hitPoint.z - player.position.z;
        
        // Normalize direction
        const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
        
        if (length > 0.001) {
            mouseDirection.x = dirX / length;
            mouseDirection.z = dirZ / length;
            isMoving = true;
        }
    }
}

/**
 * Handle touch start events
 * @param {TouchEvent} event - Touch event
 */
function onTouchStart(event) {
    event.preventDefault();
    
    if (isLevelComplete) {
        // Go to next level or restart game
        if (currentLevel < LEVELS) {
            startLevel(currentLevel + 1);
        } else {
            startLevel(1);
        }
        return;
    }
    
    if (isDead) {
        // Restart current level
        startLevel(currentLevel);
        return;
    }
    
    // Store touch start position
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    
    isMouseDown = true; // Use the same flag for touch and mouse
    updateTouchDirection(event);
}

/**
 * Handle touch end events
 * @param {TouchEvent} event - Touch event
 */
function onTouchEnd(event) {
    event.preventDefault();
    isMouseDown = false;
    isMoving = false;
}

/**
 * Handle touch move events
 * @param {TouchEvent} event - Touch event
 */
function onTouchMove(event) {
    event.preventDefault();
    
    if (!isGameRunning) return;
    
    updateTouchDirection(event);
}

/**
 * Update direction based on touch movement
 * @param {TouchEvent} event - Touch event
 */
function updateTouchDirection(event) {
    if (!isGameRunning) return;
    
    // Get touch position
    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    
    // Calculate direction relative to screen center for more intuitive control
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const dirX = touchX - centerX;
    const dirY = touchY - centerY;
    
    // Normalize direction
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    
    if (length > 20) { // Only move if touch is far enough from center
        mouseDirection.x = dirX / length;
        mouseDirection.z = dirY / length;
        isMoving = true;
    } else {
        isMoving = false;
    }
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    
    // Update timer
    if (isGameRunning) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        timeCounter.textContent = elapsed;
        
        // Update player position based on mouse direction if mouse is down
        if (isMouseDown && isMoving) {
            moveInMouseDirection();
        }
        // Update player position if moving to target
        else if (isMoving) {
            updatePlayerPosition();
        }
    }
    
    // Render scene
    renderer.render(scene, camera);
}

/**
 * Move player in the current mouse direction
 */
function moveInMouseDirection() {
    if (!isGameRunning || !isMoving || isDead) return;
    
    // Calculate potential new position with speed
    const deltaTime = 0.016; // Approximately 60fps
    const newX = player.position.x + mouseDirection.x * PLAYER_SPEED * deltaTime;
    const newZ = player.position.z + mouseDirection.z * PLAYER_SPEED * deltaTime;
    
    // Check collisions with walls
    for (const wall of mazeCells) {
        const wallMinX = wall.position.x - CELL_SIZE / 2;
        const wallMaxX = wall.position.x + CELL_SIZE / 2;
        const wallMinZ = wall.position.z - CELL_SIZE / 2;
        const wallMaxZ = wall.position.z + CELL_SIZE / 2;
        
        // Check if player would collide with this wall
        if (
            newX + PLAYER_RADIUS > wallMinX &&
            newX - PLAYER_RADIUS < wallMaxX &&
            newZ + PLAYER_RADIUS > wallMinZ &&
            newZ - PLAYER_RADIUS < wallMaxZ
        ) {
            playerDeath();
            return;
        }
    }
    
    // Update position if no collision
    player.position.x = newX;
    player.position.z = newZ;
    
    // Update camera position to follow player (top-down)
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
    
    // Check if player reached goal
    checkGoal();
}

// Start the game when page loads
window.onload = init;
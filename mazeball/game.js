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
let scene, camera, renderer, player, goalMarker, goalParticles, playerLight;
let mazeCells = [];
let mazeWidth = 5; // Starting maze width
let mazeHeight = 5; // Starting maze height
let currentLevel = 1;
let completedLevels = 0; // Track how many levels the player has completed
let startTime;
let isGameRunning = false;
let isLevelComplete = false;
let isDead = false; // Track if player has died
let touchStartX, touchStartY;
let targetX, targetZ; // Target position for continuous movement
let isMoving = false; // Flag to track if player is moving
let isMouseDown = false; // Track if mouse is being held down
let mouseDirection = { x: 0, z: 0 }; // Direction of mouse movement
let animationTime = 0; // For animations
let currentMazeData = null; // Store current maze data for restarting levels

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
    
    // Add fog for atmosphere and distance perception
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.02);
    
    // Setup camera for top-down view
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 10;
    camera.rotation.x = -Math.PI / 2; // Perfect top-down angle
    
    // Setup renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);
    
    // Add point light at player position
    playerLight = new THREE.PointLight(0xFF9900, 1, 6);
    playerLight.castShadow = true;
    scene.add(playerLight);
    
    // Add ground with material
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4A7023,
        roughness: 0.8,
        metalness: 0.2
    });
    
    // Add a checkerboard pattern
    const gridSize = 20;
    const gridSegments = 100;
    const gridGeometry = new THREE.PlaneGeometry(gridSize * 2, gridSize * 2, gridSegments, gridSegments);
    const gridMaterial = new THREE.MeshStandardMaterial({
        color: 0x4A7023,
        roughness: 0.7,
        metalness: 0.1,
        wireframe: false
    });
    
    // Create grid lines
    const lineGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(gridSize * 2, gridSize * 2, 20, 20));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x5A8033, linewidth: 1 });
    const gridLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    gridLines.rotation.x = -Math.PI / 2;
    gridLines.position.y = 0.01; // Slightly above ground to avoid z-fighting
    scene.add(gridLines);
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create player with glow effect
    const playerGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, 32, 32);
    const playerMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF5500,
        emissive: 0xFF5500,
        emissiveIntensity: 0.2,
        metalness: 0.8,
        roughness: 0.2
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.castShadow = true;
    player.position.y = PLAYER_RADIUS;
    scene.add(player);
    
    // Create goal marker with animation
    const goalGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const goalMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00FF00, 
        emissive: 0x00FF00, 
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    goalMarker = new THREE.Mesh(goalGeometry, goalMaterial);
    goalMarker.position.y = 0.05;
    scene.add(goalMarker);
    
    // Create particles for goal marker
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const posArray = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 2;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    goalParticles = new THREE.Points(particleGeometry, particleMaterial);
    goalParticles.position.y = 0.5;
    goalMarker.add(goalParticles);
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchmove', onTouchMove);
    
    // Reset game values
    currentMazeData = null;
    completedLevels = 0;
    
    // Start the first level
    startLevel(currentLevel, true);
    
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
    
    // Random starting point (must be odd coordinates to maintain grid structure)
    // Choose odd numbers between 1 and width/height - 2
    let startX, startY;
    
    do {
        startX = Math.floor(Math.random() * Math.floor((width - 2) / 2)) * 2 + 1;
        startY = Math.floor(Math.random() * Math.floor((height - 2) / 2)) * 2 + 1;
    } while (startX >= width - 1 || startY >= height - 1);
    
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
    
    // Ensure there are multiple pathways by randomly opening some walls
    const extraPaths = Math.floor(Math.sqrt(width * height) / 2);
    for (let i = 0; i < extraPaths; i++) {
        let wx = Math.floor(Math.random() * (width - 2)) + 1;
        let wy = Math.floor(Math.random() * (height - 2)) + 1;
        if (maze[wy][wx] === 1) {
            // Only open this wall if it doesn't create a 2x2 open space
            let openNeighbors = 0;
            if (wx > 0 && maze[wy][wx-1] === 0) openNeighbors++;
            if (wx < width-1 && maze[wy][wx+1] === 0) openNeighbors++;
            if (wy > 0 && maze[wy-1][wx] === 0) openNeighbors++;
            if (wy < height-1 && maze[wy+1][wx] === 0) openNeighbors++;
            
            if (openNeighbors <= 2) {
                maze[wy][wx] = 0;
            }
        }
    }
    
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
    
    // Wall geometry and materials
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    
    // Create multiple materials for varied wall appearance
    const wallMaterials = [
        new THREE.MeshStandardMaterial({ 
            color: 0x8B4513, // Brown
            roughness: 0.7,
            metalness: 0.1
        }),
        new THREE.MeshStandardMaterial({ 
            color: 0x964B00, // Slightly different brown
            roughness: 0.8,
            metalness: 0.05
        }),
        new THREE.MeshStandardMaterial({ 
            color: 0x7D4427, // Yet another brown
            roughness: 0.6,
            metalness: 0.15
        })
    ];
    
    // Create walls
    for (let y = 0; y < mazeData.length; y++) {
        for (let x = 0; x < mazeData[y].length; x++) {
            if (mazeData[y][x] === 1) {
                // Select random material for variety
                const wallMaterial = wallMaterials[Math.floor(Math.random() * wallMaterials.length)];
                
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
    player.material.emissive.set(0xFF5500);
    player.material.emissiveIntensity = 0.2;
    player.visible = true; // Make sure player is visible
    
    // Find all possible empty cells for player start and goal positions
    const emptyCells = [];
    for (let y = 1; y < mazeData.length - 1; y++) {
        for (let x = 1; x < mazeData[y].length - 1; x++) {
            if (mazeData[y][x] === 0) {
                emptyCells.push({x, y});
            }
        }
    }
    
    // We need at least 2 empty cells for start and goal
    if (emptyCells.length < 2) {
        console.error("Not enough empty cells in maze");
        return;
    }
    
    // Store the start and goal positions if this is the first time building the maze
    if (!isDead) {
        // Randomly select start position from empty cells
        const startIndex = Math.floor(Math.random() * emptyCells.length);
        const startCell = emptyCells[startIndex];
        
        // Remove the start cell from the array
        emptyCells.splice(startIndex, 1);
        
        // Randomly select goal position from remaining empty cells
        // Make sure goal is at least 3 cells away from start
        let validGoalCells = emptyCells.filter(cell => {
            const distance = Math.abs(cell.x - startCell.x) + Math.abs(cell.y - startCell.y);
            return distance > 3; // Manhattan distance > 3
        });
        
        // If no valid goal cells found, use any remaining empty cell
        if (validGoalCells.length === 0) {
            validGoalCells = emptyCells;
        }
        
        const goalCell = validGoalCells[Math.floor(Math.random() * validGoalCells.length)];
        
        // Store these positions for reuse
        window.startPosition = {
            x: startCell.x * CELL_SIZE - (mazeData[0].length * CELL_SIZE) / 2 + CELL_SIZE / 2,
            z: startCell.y * CELL_SIZE - (mazeData.length * CELL_SIZE) / 2 + CELL_SIZE / 2
        };
        
        window.goalPosition = {
            x: goalCell.x * CELL_SIZE - (mazeData[0].length * CELL_SIZE) / 2 + CELL_SIZE / 2,
            z: goalCell.y * CELL_SIZE - (mazeData.length * CELL_SIZE) / 2 + CELL_SIZE / 2
        };
    }
    
    // Set player start position using the stored position
    player.position.x = window.startPosition.x;
    player.position.z = window.startPosition.z;
    player.position.y = PLAYER_RADIUS;
    
    // Set goal position using the stored position
    goalMarker.position.x = window.goalPosition.x;
    goalMarker.position.z = window.goalPosition.z;
}

/**
 * Start a new level
 * @param {number} level - Level number
 * @param {boolean} regenerateMaze - Whether to generate a new maze or reuse existing one
 */
function startLevel(level, regenerateMaze = true) {
    // Update level display
    currentLevel = level;
    levelNumber.textContent = level;
    
    // Clear game message
    gameMessage.textContent = '';
    gameMessage.style.display = 'none';
    
    // Calculate maze size based on level (increases with level)
    mazeWidth = 5 + (level * 2);
    mazeHeight = 5 + (level * 2);
    
    // Generate and build maze
    if (regenerateMaze || currentMazeData === null) {
        // Store the new maze data
        currentMazeData = generateMaze(mazeWidth, mazeHeight);
        console.log("New maze generated");
    } else {
        console.log("Reusing existing maze");
    }
    buildMaze(currentMazeData);
    
    // Reset game state
    isGameRunning = true;
    isLevelComplete = false;
    isDead = false;
    startTime = Date.now();
    
    // Center camera on player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
    
    // Adjust lighting based on level and completion progress
    const ambientLights = scene.children.filter(child => child instanceof THREE.AmbientLight);
    const directionalLights = scene.children.filter(child => child instanceof THREE.DirectionalLight);
    
    // Reset scene background to sky blue for normal levels
    scene.background = new THREE.Color(0x87CEEB);
    
    // Every 5th level is pitch black (but only after completing at least 3 levels)
    if (completedLevels >= 3 && level % 5 === 0) {
        // Pitch black level - almost no ambient or directional light
        ambientLights.forEach(light => light.intensity = 0.01);
        directionalLights.forEach(light => light.intensity = 0.05);
        // Very strong player light
        playerLight.intensity = 3.5;
        playerLight.distance = 12;
        playerLight.color.set(0xFFBB33); // Warmer light color
        
        // Reduce fog to allow for true darkness
        scene.fog.density = 0.04;
        // Change scene background to black for true darkness
        scene.background = new THREE.Color(0x000000);
    } 
    // Odd levels are darker
    else if (level % 2 === 1) {
        ambientLights.forEach(light => light.intensity = 0.2);
        directionalLights.forEach(light => light.intensity = 0.4);
        playerLight.intensity = 1.5;
        playerLight.distance = 8;
        playerLight.color.set(0xFF9900); // Reset to original color
        scene.fog.density = 0.02; // Reset fog
    } 
    // Even levels are brighter
    else {
        ambientLights.forEach(light => light.intensity = 0.5);
        directionalLights.forEach(light => light.intensity = 0.8);
        playerLight.intensity = 1.0;
        playerLight.distance = 6;
        playerLight.color.set(0xFF9900); // Reset to original color
        scene.fog.density = 0.02; // Reset fog
    }
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
    
    // Increment completed levels counter
    completedLevels++;
    
    // Reset current maze data so a new maze will be generated for next level
    currentMazeData = null;
    
    // Create completion effect
    createCompletionEffect();
    
    if (currentLevel < LEVELS) {
        gameMessage.textContent = `Level ${currentLevel} Complete! Tap to continue`;
    } else {
        gameMessage.textContent = 'Congratulations! You completed all levels! Tap to restart';
    }
    
    // Center the message
    centerGameMessage();
}

/**
 * Center the game message on screen
 */
function centerGameMessage() {
    // First reset any existing styles
    gameMessage.style = '';
    
    // Then apply new styles
    gameMessage.style.position = 'fixed'; // Use fixed instead of absolute for better centering
    gameMessage.style.top = '50%';
    gameMessage.style.left = '50%';
    gameMessage.style.transform = 'translate(-50%, -50%)';
    gameMessage.style.display = 'inline-block'; // Make the background fit the text
    gameMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    gameMessage.style.color = 'white';
    gameMessage.style.padding = '15px 25px';
    gameMessage.style.borderRadius = '8px';
    gameMessage.style.fontWeight = 'bold';
    gameMessage.style.fontSize = '28px';
    gameMessage.style.textAlign = 'center';
    gameMessage.style.maxWidth = '80%';
    gameMessage.style.zIndex = '1000';
    gameMessage.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    gameMessage.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
}

/**
 * Create level completion effect
 */
function createCompletionEffect() {
    // Create ring of particles around player
    const particleCount = 80;
    const completionGeometry = new THREE.BufferGeometry();
    const completionParticles = new Float32Array(particleCount * 3);
    const completionColors = new Float32Array(particleCount * 3);
    
    // Generate particles in a ring
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 1.5;
        
        const i3 = i * 3;
        completionParticles[i3] = Math.cos(angle) * radius;
        completionParticles[i3 + 1] = 0.2;
        completionParticles[i3 + 2] = Math.sin(angle) * radius;
        
        // Golden color
        completionColors[i3] = 1.0;
        completionColors[i3 + 1] = 0.8 + Math.random() * 0.2;
        completionColors[i3 + 2] = 0.0;
    }
    
    completionGeometry.setAttribute('position', new THREE.BufferAttribute(completionParticles, 3));
    completionGeometry.setAttribute('color', new THREE.BufferAttribute(completionColors, 3));
    
    const completionMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    
    const completionEffect = new THREE.Points(completionGeometry, completionMaterial);
    completionEffect.position.copy(player.position);
    scene.add(completionEffect);
    
    // Animate completion effect
    const effectDuration = 2.0; // seconds
    const startTime = Date.now();
    
    function animateCompletionEffect() {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = elapsed / effectDuration;
        
        if (progress >= 1.0) {
            scene.remove(completionEffect);
            return;
        }
        
        // Update particle positions
        const positions = completionEffect.geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const angle = (i / particleCount) * Math.PI * 2 + progress * Math.PI;
            const radius = 1.5 + progress * 2;
            
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = 0.2 + progress * 3;
            positions[i3 + 2] = Math.sin(angle) * radius;
        }
        
        completionEffect.geometry.attributes.position.needsUpdate = true;
        
        // Fade out opacity
        completionMaterial.opacity = 1.0 - progress;
        
        requestAnimationFrame(animateCompletionEffect);
    }
    
    animateCompletionEffect();
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
    player.material.emissive.set(0xFF0000);
    player.material.emissiveIntensity = 0.5;
    
    // Create explosion effect
    createExplosionEffect(player.position.x, player.position.z);
    
    // Make player disappear after a short delay
    setTimeout(() => {
        player.visible = false;
    }, 300);
    
    // Show message in center of screen
    gameMessage.textContent = 'You died! Tap to restart level';
    gameMessage.style.display = 'block'; // Ensure it's visible
    centerGameMessage();
    
    // Add slight camera shake effect
    const shakeDuration = 500; // ms
    const startTime = Date.now();
    const originalCameraY = camera.position.y;
    
    function shakeCamera() {
        const elapsed = Date.now() - startTime;
        if (elapsed < shakeDuration) {
            const intensity = 0.1 * (1 - elapsed / shakeDuration);
            camera.position.y = originalCameraY + (Math.random() - 0.5) * intensity;
            requestAnimationFrame(shakeCamera);
        } else {
            camera.position.y = originalCameraY;
        }
    }
    
    shakeCamera();
    
    // Debug log to verify maze data is preserved
    console.log("Current maze data preserved for restart:", currentMazeData);
}

/**
 * Create explosion particle effect at position
 * @param {number} x - X position
 * @param {number} z - Z position
 */
function createExplosionEffect(x, z) {
    const particleCount = 100;
    const explosionGeometry = new THREE.BufferGeometry();
    const explosionParticles = new Float32Array(particleCount * 3);
    const explosionColors = new Float32Array(particleCount * 3);
    const explosionSizes = new Float32Array(particleCount);
    
    // Generate random positions, colors and sizes
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        explosionParticles[i3] = 0;
        explosionParticles[i3 + 1] = 0;
        explosionParticles[i3 + 2] = 0;
        
        // Red to orange colors
        explosionColors[i3] = 1.0;
        explosionColors[i3 + 1] = Math.random() * 0.5;
        explosionColors[i3 + 2] = 0;
        
        explosionSizes[i] = Math.random() * 0.05 + 0.05;
    }
    
    explosionGeometry.setAttribute('position', new THREE.BufferAttribute(explosionParticles, 3));
    explosionGeometry.setAttribute('color', new THREE.BufferAttribute(explosionColors, 3));
    explosionGeometry.setAttribute('size', new THREE.BufferAttribute(explosionSizes, 1));
    
    const explosionMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    
    const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
    explosion.position.set(x, PLAYER_RADIUS, z);
    scene.add(explosion);
    
    // Animate explosion
    const explosionDuration = 1.0; // seconds
    const startTime = Date.now();
    
    function animateExplosion() {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = elapsed / explosionDuration;
        
        if (progress >= 1.0) {
            scene.remove(explosion);
            return;
        }
        
        // Update particle positions
        const positions = explosion.geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const radius = progress * 3.0;
            
            positions[i3] = Math.cos(angle) * radius * Math.random();
            positions[i3 + 1] = progress * 2.0;
            positions[i3 + 2] = Math.sin(angle) * radius * Math.random();
        }
        
        explosion.geometry.attributes.position.needsUpdate = true;
        
        // Fade out opacity
        explosionMaterial.opacity = 1.0 - progress;
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

/**
 * Handle mouse down events
 * @param {MouseEvent} event - Mouse event
 */
function onMouseDown(event) {
    if (isLevelComplete) {
        // Hide game message
        gameMessage.style.display = 'none';
        
        // Go to next level or restart game
        if (currentLevel < LEVELS) {
            startLevel(currentLevel + 1, true); // Generate new maze
        } else {
            completedLevels = 0; // Reset completed levels counter when restarting
            startLevel(1, true); // Generate new maze
        }
        return;
    }
    
    if (isDead) {
        // Hide game message
        gameMessage.style.display = 'none';
        
        // Restart current level without generating a new maze
        startLevel(currentLevel, false);
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
        // Hide game message
        gameMessage.style.display = 'none';
        
        // Go to next level or restart game
        if (currentLevel < LEVELS) {
            startLevel(currentLevel + 1, true); // Generate new maze
        } else {
            completedLevels = 0; // Reset completed levels counter when restarting
            startLevel(1, true); // Generate new maze
        }
        return;
    }
    
    if (isDead) {
        // Hide game message
        gameMessage.style.display = 'none';
        
        // Restart current level without generating a new maze
        startLevel(currentLevel, false);
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
    
    // Update animation time
    animationTime += 0.016;
    
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
        
        // Update player light position
        playerLight.position.copy(player.position);
        playerLight.position.y = PLAYER_RADIUS * 2;
        
        // Animate goal marker
        if (goalMarker) {
            goalMarker.rotation.y += 0.02;
            goalMarker.position.y = 0.05 + Math.sin(animationTime * 2) * 0.05;
            
            // Animate goal particles
            if (goalParticles) {
                goalParticles.rotation.y += 0.01;
                goalParticles.rotation.x += 0.005;
                
                // Move particles in circular pattern
                const particles = goalParticles.geometry.attributes.position.array;
                for (let i = 0; i < particles.length; i += 3) {
                    const x = particles[i];
                    const z = particles[i + 2];
                    const angle = Math.atan2(z, x) + 0.01;
                    const radius = Math.sqrt(x * x + z * z);
                    
                    particles[i] = Math.cos(angle) * radius;
                    particles[i + 1] = Math.sin(animationTime * 3 + i/3) * 0.2;
                    particles[i + 2] = Math.sin(angle) * radius;
                }
                
                goalParticles.geometry.attributes.position.needsUpdate = true;
            }
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
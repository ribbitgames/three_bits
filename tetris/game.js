// Game constants
const GRID_WIDTH = 10; // Width of the Tetris grid
const GRID_HEIGHT = 20; // Height of the Tetris grid
const BLOCK_SIZE = 30; // Size of each block in pixels
const COLORS = [
    0xff0000, // Red - I
    0x00ff00, // Green - J
    0x0000ff, // Blue - L
    0xffff00, // Yellow - O
    0xff00ff, // Magenta - S
    0x00ffff, // Cyan - T
    0xffa500  // Orange - Z
];

// Tetromino shapes - each defined by [x, y] coordinates relative to center
const SHAPES = [
    // I
    [[-1, 0], [0, 0], [1, 0], [2, 0]],
    // J
    [[-1, -1], [-1, 0], [0, 0], [1, 0]],
    // L
    [[-1, 0], [0, 0], [1, 0], [1, -1]],
    // O
    [[0, 0], [1, 0], [0, -1], [1, -1]],
    // S
    [[-1, 0], [0, 0], [0, -1], [1, -1]],
    // T
    [[-1, 0], [0, 0], [1, 0], [0, -1]],
    // Z
    [[-1, -1], [0, -1], [0, 0], [1, 0]]
];

// Game state variables
let renderer, scene, camera;
let grid = [];
let currentPiece = null;
let currentType = 0;
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let dropInterval = 1000; // Initial drop interval in ms
let lastDropTime = 0;
let isPaused = false;
let touchStartX = 0;
let touchStartY = 0;
let isDownKeyPressed = false; // Track if down key is being held
let fastDropInterval = 50; // Fast drop speed in ms

// DOM elements
let scoreElement, levelElement, linesElement, finalScoreElement;
let leftBtn, rightBtn, downBtn, rotateBtn, restartBtn, gameOverElement;

/**
 * Initialize the game
 * Set up Three.js renderer, scene, camera, and event listeners
 */
function init() {
    // Get DOM elements
    scoreElement = document.getElementById('score');
    levelElement = document.getElementById('level');
    linesElement = document.getElementById('lines');
    leftBtn = document.getElementById('left-btn');
    rightBtn = document.getElementById('right-btn');
    downBtn = document.getElementById('down-btn');
    rotateBtn = document.getElementById('rotate-btn');
    restartBtn = document.getElementById('restart-btn');
    gameOverElement = document.getElementById('game-over');
    finalScoreElement = document.getElementById('final-score');
    
    // Set up Three.js
    setupThreeJs();
    
    // Initialize the game grid
    createGrid();
    
    // Create initial piece
    createNewPiece();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start the game loop
    lastDropTime = Date.now();
    requestAnimationFrame(gameLoop);
}

/**
 * Set up Three.js renderer, scene, and camera
 */
function setupThreeJs() {
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    
    // Determine the size based on screen orientation
    let width, height;
    if (window.innerWidth < window.innerHeight) {
        // Mobile portrait
        width = Math.min(window.innerWidth * 0.9, BLOCK_SIZE * GRID_WIDTH);
        height = (GRID_HEIGHT / GRID_WIDTH) * width;
    } else {
        // Desktop or landscape
        height = Math.min(window.innerHeight * 0.7, BLOCK_SIZE * GRID_HEIGHT);
        width = (GRID_WIDTH / GRID_HEIGHT) * height;
    }
    
    renderer.setSize(width, height);
    
    // Add the renderer to the DOM
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Create camera
    camera = new THREE.OrthographicCamera(
        -GRID_WIDTH / 2, 
        GRID_WIDTH / 2, 
        GRID_HEIGHT / 2, 
        -GRID_HEIGHT / 2, 
        1, 
        1000
    );
    camera.position.z = 10;
    
    // Create grid lines manually for better control
    for (let x = 0; x <= GRID_WIDTH; x++) {
        const geometry = new THREE.BufferGeometry();
        const points = [];
        points.push(new THREE.Vector3(x - GRID_WIDTH/2, -GRID_HEIGHT/2, 0));
        points.push(new THREE.Vector3(x - GRID_WIDTH/2, GRID_HEIGHT/2, 0));
        geometry.setFromPoints(points);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x444444 }));
        scene.add(line);
    }
    
    for (let y = 0; y <= GRID_HEIGHT; y++) {
        const geometry = new THREE.BufferGeometry();
        const points = [];
        points.push(new THREE.Vector3(-GRID_WIDTH/2, y - GRID_HEIGHT/2, 0));
        points.push(new THREE.Vector3(GRID_WIDTH/2, y - GRID_HEIGHT/2, 0));
        geometry.setFromPoints(points);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x444444 }));
        scene.add(line);
    }
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
}

/**
 * Create an empty grid
 */
function createGrid() {
    grid = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            grid[y][x] = null; // null represents an empty cell
        }
    }
}

/**
 * Create a new tetromino piece
 */
function createNewPiece() {
    currentType = Math.floor(Math.random() * SHAPES.length);
    const shape = SHAPES[currentType];
    const color = COLORS[currentType];
    
    // Create a group to hold the blocks
    currentPiece = new THREE.Group();
    // Position at center of grid, near the top
    currentPiece.position.set(0, GRID_HEIGHT/2 - 2, 0);
    
    // Create each block in the tetromino
    for (let i = 0; i < shape.length; i++) {
        const [x, y] = shape[i];
        const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const material = new THREE.MeshLambertMaterial({ color: color });
        const cube = new THREE.Mesh(geometry, material);
        // Add 0.5 offset to each block to center in grid cells
        cube.position.set(x + 0.5, y + 0.5, 0);
        currentPiece.add(cube);
    }
    
    scene.add(currentPiece);
    
    // Check if the new piece can be placed
    if (!isValidPosition()) {
        endGame();
    }
}

/**
 * Move the current piece left
 */
function moveLeft() {
    if (gameOver || isPaused) return;
    
    currentPiece.position.x -= 1;
    if (!isValidPosition()) {
        currentPiece.position.x += 1;
    }
}

/**
 * Move the current piece right
 */
function moveRight() {
    if (gameOver || isPaused) return;
    
    currentPiece.position.x += 1;
    if (!isValidPosition()) {
        currentPiece.position.x -= 1;
    }
}

/**
 * Move the current piece down
 * Returns true if the piece was moved, false if it landed
 */
function moveDown() {
    if (gameOver || isPaused) return false;
    
    currentPiece.position.y -= 1;
    if (!isValidPosition()) {
        currentPiece.position.y += 1; // Move back up
        placePiece();
        return false;
    }
    return true;
}

/**
 * Drop the current piece instantly to the lowest possible position
 */
function hardDrop() {
    if (gameOver || isPaused) return;
    
    while(moveDown()) {
        // Keep moving down until it can't move anymore
    }
}

/**
 * Rotate the current piece clockwise
 */
function rotatePiece() {
    if (gameOver || isPaused) return;
    
    // O piece doesn't rotate
    if (currentType === 3) return;
    
    currentPiece.rotation.z -= Math.PI / 2;
    
    // If the rotation makes the piece invalid, rotate back
    if (!isValidPosition()) {
        currentPiece.rotation.z += Math.PI / 2;
    }
}

/**
 * Check if the current piece is in a valid position
 * Returns true if valid, false if colliding or out of bounds
 */
function isValidPosition() {
    // Get the position of each block in the piece
    const blocks = [];
    currentPiece.children.forEach(block => {
        // Get world position of the block
        const worldPos = new THREE.Vector3();
        block.getWorldPosition(worldPos);
        
        // Convert to grid positions (accounting for the camera offset)
        const x = Math.floor(worldPos.x + GRID_WIDTH/2);
        const y = Math.floor(-worldPos.y + GRID_HEIGHT/2);
        
        blocks.push({ x, y });
    });
    
    // Check if any block is out of bounds or overlapping with placed blocks
    for (const { x, y } of blocks) {
        // Check boundaries
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
            return false;
        }
        
        // Check collision with placed blocks
        if (grid[y][x] !== null) {
            return false;
        }
    }
    
    return true;
}

/**
 * Place the current piece permanently on the grid
 */
function placePiece() {
    // Get the position of each block in the piece
    const blocks = [];
    currentPiece.children.forEach(block => {
        // Get world position of the block
        const worldPos = new THREE.Vector3();
        block.getWorldPosition(worldPos);
        
        // Convert to grid positions (accounting for the camera offset)
        const x = Math.floor(worldPos.x + GRID_WIDTH/2);
        const y = Math.floor(-worldPos.y + GRID_HEIGHT/2);
        
        // Keep track of block and its position
        blocks.push({ x, y, mesh: block });
    });
    
    // Place each block on the grid
    blocks.forEach(({ x, y, mesh }) => {
        // Place block on the grid if within bounds
        if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
            // Position the mesh exactly in the grid cell
            mesh.position.set(
                x - GRID_WIDTH/2 + 0.5, 
                -(y - GRID_HEIGHT/2 + 0.5), 
                0
            );
            
            // Remove from current piece and add directly to scene
            currentPiece.remove(mesh);
            scene.add(mesh);
            
            // Store in grid
            grid[y][x] = {
                mesh: mesh,
                color: COLORS[currentType]
            };
        }
    });
    
    // Remove the empty piece group
    scene.remove(currentPiece);
    currentPiece = null;
    
    // Check for completed lines
    checkLines();
    
    // Create a new piece
    createNewPiece();
}

/**
 * Check for and clear completed lines
 */
function checkLines() {
    let linesCleared = 0;
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
        let complete = true;
        
        // Check if row is complete
        for (let x = 0; x < GRID_WIDTH; x++) {
            if (grid[y][x] === null) {
                complete = false;
                break;
            }
        }
        
        if (complete) {
            linesCleared++;
            
            // Remove blocks from the scene
            for (let x = 0; x < GRID_WIDTH; x++) {
                scene.remove(grid[y][x].mesh);
                grid[y][x] = null;
            }
            
            // Move all rows above down
            for (let yy = y; yy > 0; yy--) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    grid[yy][x] = grid[yy - 1][x];
                    
                    if (grid[yy][x] !== null) {
                        // Update the visual position of the block
                        const newY = -(yy - GRID_HEIGHT/2 + 0.5);
                        grid[yy][x].mesh.position.y = newY;
                    }
                }
            }
            
            // Clear the top row
            for (let x = 0; x < GRID_WIDTH; x++) {
                grid[0][x] = null;
            }
            
            // Check the same row again
            y--;
        }
    }
    
    if (linesCleared > 0) {
        // Update score and level
        updateScore(linesCleared);
    }
}

/**
 * Update the score based on lines cleared
 */
function updateScore(linesCleared) {
    // Score calculation based on classic Tetris
    const linePoints = [0, 40, 100, 300, 1200];
    score += linePoints[linesCleared] * level;
    lines += linesCleared;
    
    // Level up every 10 lines
    level = Math.floor(lines / 10) + 1;
    
    // Update drop speed based on level
    dropInterval = Math.max(100, 1000 - ((level - 1) * 100));
    
    // Update UI
    scoreElement.textContent = `Score: ${score}`;
    levelElement.textContent = `Level: ${level}`;
    linesElement.textContent = `Lines: ${lines}`;
}

/**
 * End the game
 */
function endGame() {
    gameOver = true;
    finalScoreElement.textContent = `Score: ${score}`;
    gameOverElement.classList.remove('hidden');
}

/**
 * Reset and restart the game
 */
function restartGame() {
    // Reset game state
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    dropInterval = 1000;
    
    // Clear the scene
    while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    
    // Rebuild the scene
    setupThreeJs();
    createGrid();
    createNewPiece();
    
    // Update UI
    scoreElement.textContent = `Score: ${score}`;
    levelElement.textContent = `Level: ${level}`;
    linesElement.textContent = `Lines: ${lines}`;
    gameOverElement.classList.add('hidden');
    
    // Reset timer
    lastDropTime = Date.now();
}

/**
 * Process touch start event
 */
function handleTouchStart(event) {
    if (event.touches.length > 0) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }
}

/**
 * Process touch end event
 */
function handleTouchEnd(event) {
    if (gameOver || isPaused) return;
    
    // Don't process if the touch was on a button
    if (event.target.tagName === 'BUTTON') return;
    
    // Calculate swipe distance
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Determine swipe direction based on which axis had greater movement
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 50) {
            moveRight();
        } else if (diffX < -50) {
            moveLeft();
        }
    } else {
        if (diffY > 50) {
            // Swipe down - soft drop
            moveDown();
        } else if (diffY < -50) {
            // Swipe up - rotate
            rotatePiece();
        }
    }
}

/**
 * Process key presses
 */
function handleKeyDown(event) {
    if (gameOver) {
        if (event.key === 'Enter' || event.key === ' ') {
            restartGame();
        }
        return;
    }
    
    if (isPaused) {
        if (event.key === 'p' || event.key === 'P') {
            isPaused = false;
        }
        return;
    }
    
    switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            moveLeft();
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            moveRight();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            moveDown();
            isDownKeyPressed = true;
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
            rotatePiece();
            break;
        case ' ':
            hardDrop();
            break;
        case 'p':
        case 'P':
            isPaused = true;
            break;
    }
}

/**
 * Process key releases
 */
function handleKeyUp(event) {
    switch (event.key) {
        case 'ArrowDown':
        case 's':
        case 'S':
            isDownKeyPressed = false;
            break;
    }
}

/**
 * Handle window resize events
 */
function handleResize() {
    // Determine the size based on screen orientation
    let width, height;
    if (window.innerWidth < window.innerHeight) {
        // Mobile portrait
        width = Math.min(window.innerWidth * 0.9, BLOCK_SIZE * GRID_WIDTH);
        height = (GRID_HEIGHT / GRID_WIDTH) * width;
    } else {
        // Desktop or landscape
        height = Math.min(window.innerHeight * 0.7, BLOCK_SIZE * GRID_HEIGHT);
        width = (GRID_WIDTH / GRID_HEIGHT) * height;
    }
    
    renderer.setSize(width, height);
    
    // Update camera
    camera.left = -GRID_WIDTH / 2;
    camera.right = GRID_WIDTH / 2;
    camera.top = GRID_HEIGHT / 2;
    camera.bottom = -GRID_HEIGHT / 2;
    camera.updateProjectionMatrix();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Button controls
    leftBtn.addEventListener('click', moveLeft);
    rightBtn.addEventListener('click', moveRight);
    downBtn.addEventListener('mousedown', () => { isDownKeyPressed = true; });
    downBtn.addEventListener('mouseup', () => { isDownKeyPressed = false; });
    downBtn.addEventListener('touchstart', () => { isDownKeyPressed = true; });
    downBtn.addEventListener('touchend', () => { isDownKeyPressed = false; });
    rotateBtn.addEventListener('click', rotatePiece);
    restartBtn.addEventListener('click', restartGame);
    
    // Touch controls
    window.addEventListener('touchstart', handleTouchStart, false);
    window.addEventListener('touchend', handleTouchEnd, false);
    
    // Keyboard controls
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Window resize
    window.addEventListener('resize', handleResize);
}

/**
 * Main game loop
 */
function gameLoop() {
    // Request next frame
    requestAnimationFrame(gameLoop);
    
    // Skip update if game is over or paused
    if (gameOver || isPaused) {
        renderer.render(scene, camera);
        return;
    }
    
    // Handle normal piece dropping
    const currentTime = Date.now();
    
    // If down key is pressed, use fast drop interval
    const currentInterval = isDownKeyPressed ? fastDropInterval : dropInterval;
    
    if (currentTime - lastDropTime > currentInterval) {
        moveDown();
        lastDropTime = currentTime;
    }
    
    // Render the scene
    renderer.render(scene, camera);
}

// Initialize the game when the window loads
window.addEventListener('load', init);
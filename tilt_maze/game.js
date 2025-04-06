// Game configuration
const config = {
    // Physics settings
    gravity: -9.8,
    ballRadius: 0.25,
    ballMass: 1,
    wallHeight: 0.5,
    wallThickness: 0.1,
    
    // Game settings
    maxTiltAngle: Math.PI / 4, // 45 degrees - increased
    tiltSensitivity: 0.015,    // increased sensitivity
    tiltDamping: 0.95,
    
    // Camera settings
    cameraHeight: 10,
    cameraFov: 60,
    
    // Levels
    levels: [
        {
            width: 7,
            height: 7,
            startPosition: [0.5, 0.5],
            goalPosition: [5.5, 5.5],
            walls: [
                // Horizontal walls
                [1, 0, 3, 1], // [x, y, width, isHorizontal]
                [0, 2, 2, 1],
                [3, 2, 4, 1],
                [1, 4, 2, 1],
                [5, 4, 2, 1],
                
                // Vertical walls
                [2, 0, 2, 0], // [x, y, height, isHorizontal]
                [4, 0, 3, 0],
                [2, 3, 2, 0],
                [4, 2, 3, 0]
            ]
        },
        {
            width: 8,
            height: 8,
            startPosition: [0.5, 0.5],
            goalPosition: [6.5, 6.5],
            walls: [
                // More complex maze pattern
                [0, 2, 3, 1],
                [4, 2, 4, 1],
                [2, 4, 4, 1],
                [0, 6, 2, 1],
                [3, 6, 5, 1],
                
                [2, 0, 3, 0],
                [4, 0, 3, 0],
                [2, 3, 2, 0],
                [4, 3, 4, 0],
                [6, 1, 3, 0]
            ]
        },
        {
            width: 9,
            height: 9,
            startPosition: [0.5, 0.5],
            goalPosition: [7.5, 7.5],
            walls: [
                // Even more complex pattern
                [1, 1, 3, 1],
                [5, 1, 4, 1],
                [0, 3, 2, 1],
                [3, 3, 5, 1],
                [1, 5, 3, 1],
                [5, 5, 4, 1],
                [2, 7, 5, 1],
                
                [2, 1, 3, 0],
                [4, 0, 2, 0],
                [6, 2, 2, 0],
                [2, 4, 3, 0],
                [4, 3, 3, 0],
                [6, 4, 4, 0],
                [2, 6, 2, 0]
            ]
        }
    ]
};

// Game state
const state = {
    currentLevel: 0,
    isPlaying: false,
    startTime: 0,
    lastTime: 0,
    timeElapsed: 0,
    
    // Tilt control
    targetTiltX: 0,
    targetTiltY: 0,
    currentTiltX: 0,
    currentTiltY: 0,
    
    // Mouse/touch tracking
    pointerDown: false,
    lastPointerX: 0,
    lastPointerY: 0,
    
    // References
    scene: null,
    camera: null,
    renderer: null,
    physics: {
        world: null,
        bodies: {
            ball: null,
            walls: [],
            floor: null,
            goal: null
        }
    },
    meshes: {
        board: null,
        ball: null,
        walls: [],
        goal: null
    }
};

// DOM elements
let elements = {};

// Initialize the game
function init() {
    // Get DOM elements
    elements = {
        gameContainer: document.getElementById('game-container'),
        gameCanvas: document.getElementById('game-canvas'),
        startScreen: document.getElementById('start-screen'),
        startButton: document.getElementById('start-button'),
        levelNum: document.getElementById('level-num'),
        timeValue: document.getElementById('time-value'),
        message: document.getElementById('message')
    };

    // Initialize Three.js
    initThree();
    
    // Initialize Cannon.js physics
    initPhysics();
    
    // Set up event listeners
    initEventListeners();
    
    // Start animation loop
    animate();
}

// Initialize Three.js scene
function initThree() {
    // Initialize Three.js scene
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Create camera with angled perspective
    const aspectRatio = window.innerWidth / window.innerHeight;
    state.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
    state.camera.position.set(6, 8, 6); // Angled view
    state.camera.lookAt(0, 0, 0);
    
    // Create renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.shadowMap.enabled = true;
    elements.gameCanvas.appendChild(state.renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    state.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    state.scene.add(directionalLight);
    
    // Add a skybox
    const geometry = new THREE.BoxGeometry(1000, 1000, 1000);
    const materialArray = [];
    const skyboxColor = new THREE.Color(0xB0E2FF);
    for (let i = 0; i < 6; i++) {
        materialArray.push(new THREE.MeshBasicMaterial({
            color: skyboxColor,
            side: THREE.BackSide
        }));
    }
    const skybox = new THREE.Mesh(geometry, materialArray);
    state.scene.add(skybox);
}

// Initialize physics world
function initPhysics() {
    // Create physics world
    state.physics.world = new CANNON.World();
    state.physics.world.gravity.set(0, config.gravity, 0);
    state.physics.world.broadphase = new CANNON.NaiveBroadphase();
    state.physics.world.solver.iterations = 10;
    state.physics.world.defaultContactMaterial.friction = 0.2;
}

// Initialize event listeners
function initEventListeners() {
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Mouse/Touch controls
    elements.gameCanvas.addEventListener('mousedown', onPointerDown);
    elements.gameCanvas.addEventListener('mousemove', onPointerMove);
    elements.gameCanvas.addEventListener('mouseup', onPointerUp);
    elements.gameCanvas.addEventListener('touchstart', onPointerDown);
    elements.gameCanvas.addEventListener('touchmove', onPointerMove);
    elements.gameCanvas.addEventListener('touchend', onPointerUp);
    
    // Start button
    elements.startButton.addEventListener('click', startGame);
}

// Handle window resize
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    
    state.renderer.setSize(width, height);
}

// Handle pointer down
function onPointerDown(event) {
    state.pointerDown = true;
    state.lastPointerX = getPointerX(event);
    state.lastPointerY = getPointerY(event);
}

// Handle pointer move
function onPointerMove(event) {
    if (!state.pointerDown || !state.isPlaying) return;
    
    const x = getPointerX(event);
    const y = getPointerY(event);
    
    const deltaX = x - state.lastPointerX;
    const deltaY = y - state.lastPointerY;
    
    state.targetTiltY += deltaX * config.tiltSensitivity;
    state.targetTiltX -= deltaY * config.tiltSensitivity;
    
    // Limit tilt angle
    state.targetTiltX = Math.max(-config.maxTiltAngle, Math.min(config.maxTiltAngle, state.targetTiltX));
    state.targetTiltY = Math.max(-config.maxTiltAngle, Math.min(config.maxTiltAngle, state.targetTiltY));
    
    state.lastPointerX = x;
    state.lastPointerY = y;
    
    // Prevent default to avoid scrolling on mobile
    event.preventDefault();
}

// Handle pointer up
function onPointerUp() {
    state.pointerDown = false;
}

// Get pointer X position
function getPointerX(event) {
    return (event.touches ? event.touches[0].clientX : event.clientX);
}

// Get pointer Y position
function getPointerY(event) {
    return (event.touches ? event.touches[0].clientY : event.clientY);
}

// Start the game
function startGame() {
    state.isPlaying = true;
    state.currentLevel = 0;
    state.startTime = Date.now();
    state.timeElapsed = 0;
    
    elements.startScreen.classList.add('hidden');
    
    loadLevel(state.currentLevel);
}

// Load a level
function loadLevel(levelIndex) {
    // Update level display
    elements.levelNum.textContent = levelIndex + 1;
    
    // Clear previous level objects
    clearLevel();
    
    // Get level data
    const level = config.levels[levelIndex];
    
    // Create board
    createBoard(level.width, level.height);
    
    // Create ball
    createBall(level.startPosition[0], level.startPosition[1]);
    
    // Create goal
    createGoal(level.goalPosition[0], level.goalPosition[1]);
    
    // Create walls
    level.walls.forEach(wall => {
        if (wall[3]) { // Horizontal wall
            createWall(wall[0], wall[1], wall[2], config.wallThickness);
        } else { // Vertical wall
            createWall(wall[0], wall[1], config.wallThickness, wall[2]);
        }
    });
    
    // Create outer walls (border)
    createWall(0, 0, config.wallThickness, level.height); // Left
    createWall(level.width - config.wallThickness, 0, config.wallThickness, level.height); // Right
    createWall(0, 0, level.width, config.wallThickness); // Bottom
    createWall(0, level.height - config.wallThickness, level.width, config.wallThickness); // Top
    
    // Update camera position for this level
    const halfWidth = level.width/2;
    const halfHeight = level.height/2;
    state.camera.position.set(halfWidth + 4, 8, halfHeight + 4);
    state.camera.lookAt(halfWidth, 0, halfHeight);
}

// Clear the current level
function clearLevel() {
    // Clear physics bodies
    if (state.physics.bodies.ball) {
        state.physics.world.remove(state.physics.bodies.ball);
        state.physics.bodies.ball = null;
    }
    
    if (state.physics.bodies.floor) {
        state.physics.world.remove(state.physics.bodies.floor);
        state.physics.bodies.floor = null;
    }
    
    if (state.physics.bodies.goal) {
        state.physics.world.remove(state.physics.bodies.goal);
        state.physics.bodies.goal = null;
    }
    
    state.physics.bodies.walls.forEach(wall => {
        state.physics.world.remove(wall);
    });
    state.physics.bodies.walls = [];
    
    // Clear meshes
    if (state.meshes.ball) {
        state.scene.remove(state.meshes.ball);
        state.meshes.ball.geometry.dispose();
        state.meshes.ball.material.dispose();
        state.meshes.ball = null;
    }
    
    if (state.meshes.board) {
        state.scene.remove(state.meshes.board);
        state.meshes.board.geometry.dispose();
        state.meshes.board.material.dispose();
        state.meshes.board = null;
    }
    
    if (state.meshes.goal) {
        state.scene.remove(state.meshes.goal);
        state.meshes.goal.geometry.dispose();
        state.meshes.goal.material.dispose();
        state.meshes.goal = null;
    }
    
    state.meshes.walls.forEach(wall => {
        state.scene.remove(wall);
        wall.geometry.dispose();
        wall.material.dispose();
    });
    state.meshes.walls = [];
    
    // Reset tilt
    state.currentTiltX = 0;
    state.currentTiltY = 0;
    state.targetTiltX = 0;
    state.targetTiltY = 0;
}

// Create the game board
function createBoard(width, height) {
    // Create board mesh and physics body
    const boardGroup = new THREE.Group();
    state.meshes.board = boardGroup;
    boardGroup.position.set(width/2, 0, height/2);
    state.scene.add(boardGroup);
    
    // Create floor mesh
    const floorGeometry = new THREE.BoxGeometry(width, 0.1, height);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513, // Brown
        roughness: 0.8,
        metalness: 0.2
    });
    
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.set(0, -0.05, 0);
    floorMesh.receiveShadow = true;
    boardGroup.add(floorMesh);
    
    // Create floor physics body
    const floorShape = new CANNON.Box(new CANNON.Vec3(width/2, 0.05, height/2));
    state.physics.bodies.floor = new CANNON.Body({
        mass: 0, // static body
        position: new CANNON.Vec3(width/2, -0.05, height/2),
        shape: floorShape
    });
    state.physics.world.addBody(state.physics.bodies.floor);
}

// Create a ball
function createBall(x, y) {
    // Adjust coordinates relative to board center
    const relX = x - config.levels[state.currentLevel].width/2;
    const relY = y - config.levels[state.currentLevel].height/2;
    
    // Create ball mesh
    const ballGeometry = new THREE.SphereGeometry(config.ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({
        color: 0xCC0000, // Red
        roughness: 0.3,
        metalness: 0.7
    });
    
    state.meshes.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    state.meshes.ball.position.set(relX, config.ballRadius, relY);
    state.meshes.ball.castShadow = true;
    state.scene.add(state.meshes.ball);
    
    // Create ball physics body
    const ballShape = new CANNON.Sphere(config.ballRadius);
    state.physics.bodies.ball = new CANNON.Body({
        mass: config.ballMass,
        position: new CANNON.Vec3(x, config.ballRadius, y),
        shape: ballShape,
        linearDamping: 0.3, // Add some friction
        angularDamping: 0.3
    });
    state.physics.world.addBody(state.physics.bodies.ball);
}

// Create a goal
function createGoal(x, y) {
    // Adjust coordinates relative to board center
    const relX = x - config.levels[state.currentLevel].width/2;
    const relY = y - config.levels[state.currentLevel].height/2;
    
    // Create goal mesh (a hole in the ground)
    const goalGeometry = new THREE.CylinderGeometry(config.ballRadius * 1.2, config.ballRadius * 1.2, 0.1, 32);
    const goalMaterial = new THREE.MeshStandardMaterial({
        color: 0x00CC00, // Green
        roughness: 0.8,
        metalness: 0.2
    });
    
    state.meshes.goal = new THREE.Mesh(goalGeometry, goalMaterial);
    state.meshes.goal.position.set(relX, -0.05, relY);
    state.meshes.goal.rotation.x = -Math.PI / 2; // Orient horizontally
    
    // Add goal to the board so it tilts with the board
    state.meshes.board.add(state.meshes.goal);
    
    // Create goal physics body (just for collision detection, not physical)
    const goalShape = new CANNON.Cylinder(
        config.ballRadius * 1.2,
        config.ballRadius * 1.2,
        0.1,
        16
    );
    state.physics.bodies.goal = new CANNON.Body({
        mass: 0, // static body
        position: new CANNON.Vec3(x, -0.05, y),
        shape: goalShape,
        isTrigger: true // Make it a trigger (no physical collision)
    });
    state.physics.bodies.goal.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    state.physics.world.addBody(state.physics.bodies.goal);
    
    // Set collision callback
    state.physics.bodies.goal.addEventListener('collide', onGoalCollision);
}

// Create a wall
function createWall(x, y, width, height) {
    // Adjust coordinates relative to board center
    const relX = x - config.levels[state.currentLevel].width/2;
    const relY = y - config.levels[state.currentLevel].height/2;
    
    // Create wall mesh
    const wallGeometry = new THREE.BoxGeometry(width, config.wallHeight, height);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444, // Dark gray
        roughness: 0.7,
        metalness: 0.3
    });
    
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    // Position wall with correct offset
    wall.position.set(relX + width/2, config.wallHeight/2, relY + height/2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    
    // Add wall to board so it tilts together
    state.meshes.board.add(wall);
    state.meshes.walls.push(wall);
    
    // Create wall physics body
    const wallShape = new CANNON.Box(new CANNON.Vec3(width/2, config.wallHeight/2, height/2));
    const wallBody = new CANNON.Body({
        mass: 0, // static body
        position: new CANNON.Vec3(x + width/2, config.wallHeight/2, y + height/2),
        shape: wallShape
    });
    state.physics.world.addBody(wallBody);
    state.physics.bodies.walls.push(wallBody);
}

// Handle collision with goal
function onGoalCollision(event) {
    // Check if the collision is with the ball
    if (event.body === state.physics.bodies.ball) {
        // Level completed
        onLevelComplete();
    }
}

// Handle level completion
function onLevelComplete() {
    state.currentLevel++;
    
    if (state.currentLevel < config.levels.length) {
        // Show level completion message
        showMessage(`Level ${state.currentLevel} Completed!`, 1500);
        
        // Load next level after a short delay
        setTimeout(() => {
            loadLevel(state.currentLevel);
        }, 1500);
    } else {
        // Game completed
        state.isPlaying = false;
        
        // Calculate total time
        const totalTime = formatTime(state.timeElapsed);
        
        // Show game completion message
        showMessage(`Congratulations! You completed all levels!\nTotal time: ${totalTime}`, 3000);
        
        // Show start screen after a delay
        setTimeout(() => {
            elements.startScreen.classList.remove('hidden');
        }, 3000);
    }
}

// Show a message
function showMessage(text, duration = 2000) {
    elements.message.textContent = text;
    elements.message.classList.remove('hidden');
    
    setTimeout(() => {
        elements.message.classList.add('hidden');
    }, duration);
}

// Format time in MM:SS format
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (state.isPlaying) {
        // Update time
        const currentTime = Date.now();
        const deltaTime = currentTime - state.lastTime;
        state.lastTime = currentTime;
        
        if (state.lastTime === 0) {
            state.lastTime = currentTime;
            return;
        }
        
        state.timeElapsed = currentTime - state.startTime;
        elements.timeValue.textContent = formatTime(state.timeElapsed);
        
        // Update physics
        updatePhysics(deltaTime);
        
        // Update tilt
        updateTilt();
    }
    
    // Render scene
    state.renderer.render(state.scene, state.camera);
}

// Update physics
function updatePhysics(deltaTime) {
    // Step physics world
    state.physics.world.step(1/60, deltaTime/1000, 3);
    
    // Update ball position
    if (state.physics.bodies.ball && state.meshes.ball) {
        state.meshes.ball.position.copy(state.physics.bodies.ball.position);
        state.meshes.ball.quaternion.copy(state.physics.bodies.ball.quaternion);
        
        // Check if ball fell off the board
        if (state.meshes.ball.position.y < -5) {
            // Reset ball position
            resetBall();
        }
    }
}

// Reset ball to starting position
function resetBall() {
    const level = config.levels[state.currentLevel];
    const x = level.startPosition[0];
    const y = level.startPosition[1];
    
    state.physics.bodies.ball.position.set(x, config.ballRadius, y);
    state.physics.bodies.ball.velocity.set(0, 0, 0);
    state.physics.bodies.ball.angularVelocity.set(0, 0, 0);
}

// Update board tilt
function updateTilt() {
    // Only apply damping when not touching the screen
    if (!state.pointerDown) {
        // Apply damping
        state.targetTiltX *= config.tiltDamping;
        state.targetTiltY *= config.tiltDamping;
    }
    
    // Smooth tilt transitions
    state.currentTiltX += (state.targetTiltX - state.currentTiltX) * 0.1;
    state.currentTiltY += (state.targetTiltY - state.currentTiltY) * 0.1;
    
    // Apply tilt to the board and physics world
    if (state.meshes.board) {
        state.meshes.board.rotation.x = state.currentTiltX;
        state.meshes.board.rotation.z = state.currentTiltY;
    }
    
    // Update gravity direction based on tilt
    // Use a consistent coordinate system
    const gravityZ = -Math.sin(state.currentTiltX) * config.gravity * 2;
    const gravityY = Math.cos(state.currentTiltX) * Math.cos(state.currentTiltY) * config.gravity;
    const gravityX = Math.sin(state.currentTiltY) * config.gravity * 2;
    
    // Apply gravity with consistent directions
    state.physics.world.gravity.set(gravityX, gravityY, gravityZ);
    
    // Update physics bodies to match visual positions
    if (state.physics.bodies.floor) {
        const boardWorldPos = new THREE.Vector3();
        state.meshes.board.getWorldPosition(boardWorldPos);
        
        state.physics.bodies.floor.position.copy(boardWorldPos);
        state.physics.bodies.floor.quaternion.copy(state.meshes.board.quaternion);
    }
    
    // Update goal physics body
    if (state.physics.bodies.goal && state.meshes.goal) {
        const goalWorldPos = new THREE.Vector3();
        const goalWorldQuat = new THREE.Quaternion();
        
        state.meshes.goal.getWorldPosition(goalWorldPos);
        state.meshes.goal.getWorldQuaternion(goalWorldQuat);
        
        state.physics.bodies.goal.position.copy(goalWorldPos);
        state.physics.bodies.goal.quaternion.copy(goalWorldQuat);
    }
    
    // Update wall physics bodies
    state.physics.bodies.walls.forEach((wall, index) => {
        const mesh = state.meshes.walls[index];
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        
        mesh.getWorldPosition(worldPos);
        mesh.getWorldQuaternion(worldQuat);
        
        wall.position.copy(worldPos);
        wall.quaternion.copy(worldQuat);
    });
}

// Initialize the game when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', init);
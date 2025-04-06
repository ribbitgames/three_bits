// Game state constants and variables
const TRACK_RADIUS = 100; // Track radius
const TRACK_WIDTH = 30; // Width of the track
const CAR_SPEED = 0.8; // Base car speed
const ACCELERATION = 0.02; // Speed increase per frame
const DECELERATION = 0.03; // Speed decrease per frame
const MAX_SPEED = 2.0; // Maximum speed
const TURNING_SPEED = 0.04; // How fast the car turns
const CHECKPOINT_COUNT = 8; // Number of checkpoints around the track
const TOTAL_LAPS = 3; // Number of laps to complete

// Game variables
let scene, camera, renderer;
let track, car, targetPoint;
let carSpeed = 0;
let carAngle = 0;
let carPosition = new THREE.Vector3(0, 0.5, TRACK_RADIUS);
let gameStarted = false;
let gamePaused = false;
let gameOver = false;
let inputPosition = { x: 0, y: 0 };
let isPointerDown = false;
let checkpoints = [];
let nextCheckpoint = 0;
let lapCount = 0;
let startTime = 0;
let currentTime = 0;
let gameTime = 0;

// DOM elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const speedValue = document.getElementById('speed-value');
const lapValue = document.getElementById('lap-value');
const timeValue = document.getElementById('time-value');
const finalTimeValue = document.getElementById('final-time-value');
const finishMessage = document.getElementById('finish-message');

/**
 * Initialize the game and set up the Three.js scene
 */
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(0, 30, -20);
    camera.lookAt(0, 0, TRACK_RADIUS);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
    
    // Create track and car
    createTrack();
    createCar();
    createCheckpoints();
    
    // Create target point (invisible, used for steering)
    targetPoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false })
    );
    scene.add(targetPoint);
    targetPoint.position.set(0, 0.5, 0);
    
    // Set up keyboard controls as alternative
    setupKeyboardControls();
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    
    // Add button event listeners
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
    
    // Start animation loop
    animate();
}

/**
 * Set up keyboard controls
 */
function setupKeyboardControls() {
    window.addEventListener('keydown', function(event) {
        // Space bar or up arrow to accelerate
        if (event.code === 'Space' || event.code === 'ArrowUp') {
            isPointerDown = true;
        }
        
        // Left/right arrows to steer
        if (event.code === 'ArrowLeft') {
            inputPosition.x = -0.5;
        } else if (event.code === 'ArrowRight') {
            inputPosition.x = 0.5;
        }
    });
    
    window.addEventListener('keyup', function(event) {
        // Space bar or up arrow to stop accelerating
        if (event.code === 'Space' || event.code === 'ArrowUp') {
            isPointerDown = false;
        }
        
        // Stop steering when keys are released
        if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
            inputPosition.x = 0;
        }
    });
}

/**
 * Create the racing track with inner and outer boundaries
 */
function createTrack() {
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228B22,  // Green
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create track
    const trackShape = new THREE.Shape();
    trackShape.absarc(0, 0, TRACK_RADIUS + TRACK_WIDTH/2, 0, Math.PI * 2, false);
    
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, TRACK_RADIUS - TRACK_WIDTH/2, 0, Math.PI * 2, true);
    trackShape.holes.push(holePath);
    
    const trackGeometry = new THREE.ShapeGeometry(trackShape);
    const trackMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,  // Dark gray
        roughness: 0.7,
        metalness: 0.2
    });
    
    track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.1;
    track.receiveShadow = true;
    scene.add(track);
    
    // Add track markings (center line dashes)
    const centerRadius = TRACK_RADIUS;
    const dashCount = 60;
    const dashAngle = (Math.PI * 2) / dashCount;
    
    for (let i = 0; i < dashCount; i++) {
        if (i % 2 === 0) {
            const angle = i * dashAngle;
            const x = centerRadius * Math.cos(angle);
            const z = centerRadius * Math.sin(angle);
            
            const dashGeometry = new THREE.PlaneGeometry(3, 1);
            const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
            const dash = new THREE.Mesh(dashGeometry, dashMaterial);
            
            dash.position.set(x, 0.15, z);
            dash.rotation.x = -Math.PI / 2;
            dash.rotation.z = angle + Math.PI / 2;
            scene.add(dash);
        }
    }
    
    // Add start/finish line
    const startLineGeometry = new THREE.PlaneGeometry(TRACK_WIDTH, 3);
    const startLineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        side: THREE.DoubleSide
    });
    const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
    startLine.position.set(0, 0.15, TRACK_RADIUS);
    startLine.rotation.x = -Math.PI / 2;
    scene.add(startLine);
}

/**
 * Create the player's car
 */
function createCar() {
    // Car body
    const carBodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
    const carBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
    const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
    carBody.castShadow = true;
    
    // Car roof
    const carRoofGeometry = new THREE.BoxGeometry(1.8, 0.5, 2);
    const carRoofMaterial = new THREE.MeshStandardMaterial({ color: 0xDD0000 });
    const carRoof = new THREE.Mesh(carRoofGeometry, carRoofMaterial);
    carRoof.position.y = 0.5;
    carRoof.castShadow = true;
    
    // Windshield
    const windshieldGeometry = new THREE.BoxGeometry(1.7, 0.4, 0.1);
    const windshieldMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8AADE3, 
        transparent: true,
        opacity: 0.7
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 0.5, 0.95);
    windshield.rotation.x = Math.PI / 8;
    
    // Headlights
    const headlightGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.1);
    const headlightMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFFF00,
        emissive: 0xFFFF00,
        emissiveIntensity: 0.5
    });
    
    const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlightLeft.position.set(-0.6, 0, 2);
    
    const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlightRight.position.set(0.6, 0, 2);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelFL.position.set(-1.1, -0.25, 1.2);
    wheelFL.rotation.z = Math.PI / 2;
    wheelFL.castShadow = true;
    
    const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelFR.position.set(1.1, -0.25, 1.2);
    wheelFR.rotation.z = Math.PI / 2;
    wheelFR.castShadow = true;
    
    const wheelBL = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelBL.position.set(-1.1, -0.25, -1.2);
    wheelBL.rotation.z = Math.PI / 2;
    wheelBL.castShadow = true;
    
    const wheelBR = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheelBR.position.set(1.1, -0.25, -1.2);
    wheelBR.rotation.z = Math.PI / 2;
    wheelBR.castShadow = true;
    
    // Create car object and add components
    car = new THREE.Group();
    car.add(carBody);
    car.add(carRoof);
    car.add(windshield);
    car.add(headlightLeft);
    car.add(headlightRight);
    car.add(wheelFL);
    car.add(wheelFR);
    car.add(wheelBL);
    car.add(wheelBR);
    
    // Position car at start
    car.position.copy(carPosition);
    car.rotation.y = Math.PI; // Face backward at start
    carAngle = Math.PI;
    
    scene.add(car);
}

/**
 * Create checkpoints around the track for lap counting
 */
function createCheckpoints() {
    for (let i = 0; i < CHECKPOINT_COUNT; i++) {
        const angle = (i / CHECKPOINT_COUNT) * Math.PI * 2;
        const x = TRACK_RADIUS * Math.cos(angle);
        const z = TRACK_RADIUS * Math.sin(angle);
        
        checkpoints.push({ x, z, angle });
        
        // Invisible checkpoint markers (for debugging)
        /*
        const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, 1, z);
        scene.add(marker);
        */
    }
}

/**
 * Handle window resize to maintain aspect ratio
 */
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

/**
 * Handle pointer (mouse/touch) down events
 * @param {Event} event - The pointer event
 */
function onPointerDown(event) {
    event.preventDefault();
    isPointerDown = true;
    updateInputPosition(event);
}

/**
 * Handle pointer (mouse/touch) move events
 * @param {Event} event - The pointer event
 */
function onPointerMove(event) {
    event.preventDefault();
    if (isPointerDown) {
        updateInputPosition(event);
    }
}

/**
 * Handle pointer (mouse/touch) up events
 * @param {Event} event - The pointer event
 */
function onPointerUp(event) {
    event.preventDefault();
    isPointerDown = false;
}

/**
 * Update the stored input position based on pointer coordinates
 * @param {Event} event - The pointer event
 */
function updateInputPosition(event) {
    // Get normalized device coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    inputPosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    inputPosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Calculate the target point based on user input
 */
function calculateTargetPoint() {
    // Convert 2D input to 3D point on ground plane
    const vector = new THREE.Vector3(inputPosition.x, inputPosition.y, 0.5);
    vector.unproject(camera);
    
    const cameraPosition = camera.position.clone();
    const direction = vector.sub(cameraPosition).normalize();
    
    // Find intersection with y=0 plane (ground)
    const distance = -cameraPosition.y / direction.y;
    const targetPosition = cameraPosition.clone().add(direction.multiplyScalar(distance));
    
    // Update target point position
    targetPoint.position.copy(targetPosition);
}

/**
 * Update car position and rotation based on input and physics
 */
function updateCar() {
    if (!gameStarted || gamePaused || gameOver) return;
    
    // Calculate target for car to steer towards
    calculateTargetPoint();
    
    // Get direction from car to target
    const targetDirection = new THREE.Vector3()
        .subVectors(targetPoint.position, car.position)
        .normalize();
    
    // Calculate angle to target
    const targetAngle = Math.atan2(targetDirection.x, targetDirection.z);
    
    // Smoothly rotate car towards target
    let angleDiff = targetAngle - carAngle;
    
    // Handle angle wrapping
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    // Apply steering based on current speed
    carAngle += angleDiff * TURNING_SPEED * (carSpeed / CAR_SPEED);
    
    // Accelerate when pointer is down, decelerate when not
    if (isPointerDown) {
        carSpeed += ACCELERATION;
        if (carSpeed > MAX_SPEED) carSpeed = MAX_SPEED;
    } else {
        carSpeed -= DECELERATION;
        if (carSpeed < 0) carSpeed = 0;
    }
    
    // Calculate new position
    carPosition.x += Math.sin(carAngle) * carSpeed;
    carPosition.z += Math.cos(carAngle) * carSpeed;
    
    // Apply position and rotation to car
    car.position.copy(carPosition);
    car.rotation.y = carAngle;
    
    // Check if car is on track
    const distanceFromCenter = Math.sqrt(carPosition.x * carPosition.x + carPosition.z * carPosition.z);
    const isOnTrack = distanceFromCenter > (TRACK_RADIUS - TRACK_WIDTH/2) && 
                      distanceFromCenter < (TRACK_RADIUS + TRACK_WIDTH/2);
    
    // Slow down car if off track
    if (!isOnTrack) {
        carSpeed *= 0.95;
    }
    
    // Update camera to follow car
    updateCamera();
    
    // Update UI
    updateSpeedometer();
    checkCheckpoints();
}

/**
 * Update camera position to follow the car
 */
function updateCamera() {
    // Calculate camera position behind and above car
    const cameraOffset = new THREE.Vector3(
        -Math.sin(carAngle) * 15,  // Position behind car
        10,                        // Height above car
        -Math.cos(carAngle) * 15   // Position behind car
    );
    
    // Create a target camera position by adding offset to car position
    const targetCameraPos = carPosition.clone().add(cameraOffset);
    
    // Smoothly move camera to new position
    camera.position.lerp(targetCameraPos, 0.1);
    
    // Look at position slightly ahead of car
    const lookAtPos = new THREE.Vector3(
        carPosition.x + Math.sin(carAngle) * 10,
        carPosition.y,
        carPosition.z + Math.cos(carAngle) * 10
    );
    
    camera.lookAt(lookAtPos);
}

/**
 * Update the speedometer display
 */
function updateSpeedometer() {
    // Convert speed to MPH for display (arbitrary conversion)
    const displaySpeed = Math.floor(carSpeed * 60);
    speedValue.textContent = displaySpeed;
}

/**
 * Check if the car has passed through checkpoints and count laps
 */
function checkCheckpoints() {
    // Get current checkpoint
    const checkpoint = checkpoints[nextCheckpoint];
    
    // Calculate distance to checkpoint
    const dx = carPosition.x - checkpoint.x;
    const dz = carPosition.z - checkpoint.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Check if passed through checkpoint
    if (distance < 10) {
        // Move to next checkpoint
        nextCheckpoint = (nextCheckpoint + 1) % CHECKPOINT_COUNT;
        
        // If back at first checkpoint, increment lap counter
        if (nextCheckpoint === 0) {
            lapCount++;
            lapValue.textContent = lapCount;
            
            // Check if race is complete
            if (lapCount >= TOTAL_LAPS) {
                endGame();
            }
        }
    }
}

/**
 * Update game timer
 */
function updateTimer() {
    if (gameStarted && !gamePaused && !gameOver) {
        currentTime = Date.now();
        gameTime = (currentTime - startTime) / 1000;
        
        // Format time as MM:SS
        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        timeValue.textContent = formattedTime;
    }
}

/**
 * Start the game
 */
function startGame() {
    gameStarted = true;
    gamePaused = false;
    gameOver = false;
    
    // Hide start screen and ensure game over screen is hidden too
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Reset car position and speed
    carPosition.set(0, 0.5, TRACK_RADIUS);
    carSpeed = 0;
    carAngle = Math.PI;
    car.position.copy(carPosition);
    car.rotation.y = carAngle;
    
    // Reset checkpoints and laps
    nextCheckpoint = 0;
    lapCount = 0;
    lapValue.textContent = lapCount;
    
    // Start timer
    startTime = Date.now();
    
    // Reset the timer display
    timeValue.textContent = "0:00";
    speedValue.textContent = "0";
}

/**
 * End the game
 */
function endGame() {
    gameOver = true;
    
    // Show game over screen
    gameOverScreen.classList.remove('hidden');
    
    // Set final time
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    finalTimeValue.textContent = formattedTime;
    
    // Set appropriate message
    finishMessage.textContent = "Race Complete!";
}

/**
 * Restart the game
 */
function restartGame() {
    // Hide game over screen
    gameOverScreen.classList.add('hidden');
    
    // Reset and start game
    startGame();
}

/**
 * Main animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    
    updateCar();
    updateTimer();
    
    renderer.render(scene, camera);
}

/**
 * Handle clicks on the game container
 * @param {Event} event - The click event
 */
function onGameContainerClick(event) {
    // Prevent event from bubbling to parent elements
    event.stopPropagation();
    
    // If clicking on a button, let the button handle it
    if (event.target.tagName === 'BUTTON') {
        return;
    }
    
    // Otherwise, if overlay is visible, start the game
    if (!gameStarted && !startScreen.classList.contains('hidden')) {
        startGame();
    }
}

// Initialize the game when the page loads
window.addEventListener('load', init);
document.getElementById('game-container').addEventListener('click', onGameContainerClick);
/**
 * Isometric Racing - Inspired by Rock N' Roll Racing and RC Pro-Am
 * A Three.js racing game with isometric view and touch/mouse controls
 */

// Game constants
const TRACK_WIDTH = 10;
const TRACK_SEGMENTS = 24;
const TRACK_RADIUS = 35;
const MAX_SPEED = 0.3;
const ACCELERATION = 0.005;
const DECELERATION = 0.008;
const FRICTION = 0.98;
const STEERING_SPEED = 0.04;
const TRACK_TILT = 0;
const GRAVITY = 0.01;
const TOTAL_LAPS = 3;
const NUM_AI_CARS = 3;
const AI_SPEED_FACTOR = 0.05; // 5% of player speed

// Game state
let scene, camera, renderer;
let playerCar, track, obstacles = [];
let aiCars = [];
let isLoading = true;
let isRaceStarted = false;
let isRaceFinished = false;
let speed = 0;
let currentLap = 1;
let playerPosition = 1;
let trackProgress = 0;
let playerPositions = [];
let carColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
let joystick = null;
let joystickData = {
    forward: 0,
    turn: 0
};

// Event listeners for window resize
window.addEventListener('resize', onWindowResize);

// Initialize game on load
window.onload = init;

/**
 * Initialize the game
 */
function init() {
    setupScene();
    setupLighting();
    createTrack();
    createPlayerCar();
    createAICars();
    createObstacles();
    setupVirtualJoystick();

    // Set up the race
    document.getElementById('loading').style.display = 'none';
    document.getElementById('start-button').addEventListener('click', startRace);
    document.getElementById('restart-button').addEventListener('click', restartRace);

    // Start the render loop
    animate();
}

/**
 * Set up the Three.js scene, camera, and renderer
 */
function setupScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Create camera with isometric view
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -30 * aspect, 30 * aspect,
        30, -30,
        1, 1000
    );
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-container').appendChild(renderer.domElement);
}

/**
 * Set up the scene lighting
 */
function setupLighting() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x666666);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
}

/**
 * Create the race track
 */
function createTrack() {
    const trackGroup = new THREE.Group();

    // Create the track segments
    for (let i = 0; i < TRACK_SEGMENTS; i++) {
        const angle = (i / TRACK_SEGMENTS) * Math.PI * 2;
        const nextAngle = ((i + 1) / TRACK_SEGMENTS) * Math.PI * 2;

        const innerRadius = TRACK_RADIUS - TRACK_WIDTH / 2;
        const outerRadius = TRACK_RADIUS + TRACK_WIDTH / 2;

        const x1 = Math.cos(angle) * innerRadius;
        const z1 = Math.sin(angle) * innerRadius;
        const x2 = Math.cos(nextAngle) * innerRadius;
        const z2 = Math.sin(nextAngle) * innerRadius;
        const x3 = Math.cos(nextAngle) * outerRadius;
        const z3 = Math.sin(nextAngle) * outerRadius;
        const x4 = Math.cos(angle) * outerRadius;
        const z4 = Math.sin(angle) * outerRadius;

        // Segment height (flat for now)
        const segmentHeight = 0;

        const segmentGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            x1, segmentHeight, z1,
            x2, segmentHeight, z2,
            x3, segmentHeight, z3,

            x1, segmentHeight, z1,
            x3, segmentHeight, z3,
            x4, segmentHeight, z4
        ]);

        segmentGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        segmentGeometry.computeVertexNormals();

        const segmentMaterial = new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0x333333 : 0x555555,
            roughness: 0.8
        });

        const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
        trackGroup.add(segmentMesh);
    }

    // Create the ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x005500,
        roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    trackGroup.add(ground);

    scene.add(trackGroup);
    track = trackGroup;
}

/**
 * Create the player's car for isometric view
 */
function createPlayerCar() {
    const carGroup = new THREE.Group();
    const carMesh = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(2, 0.7, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.7;
    carMesh.add(body);

    const roofGeometry = new THREE.BoxGeometry(1.5, 0.5, 1.5);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.3;
    roof.position.z = -0.2;
    carMesh.add(roof);

    addWheel(carMesh, 0.8, 0.4, 1);
    addWheel(carMesh, -0.8, 0.4, 1);
    addWheel(carMesh, 0.8, 0.4, -1);
    addWheel(carMesh, -0.8, 0.4, -1);

    carMesh.rotation.y = 0; // Local forward is Z-axis
    carGroup.add(carMesh);

    carGroup.position.set(TRACK_RADIUS, 0.2, 0);
    carGroup.rotation.y = 0; // Face positive Z (tangent at start)

    scene.add(carGroup);
    playerCar = carGroup;
    playerCar.carMesh = carMesh;
}

/**
 * Add a wheel to a car
 */
function addWheel(carGroup, x, y, z) {
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
    wheelGeometry.rotateX(Math.PI / 2);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(x, y, z);
    carGroup.add(wheel);
}

/**
 * Create AI-controlled cars for isometric view
 */
function createAICars() {
    for (let i = 0; i < NUM_AI_CARS; i++) {
        const aiCarGroup = new THREE.Group();
        const carMesh = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(2, 0.7, 3);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: carColors[i + 1] });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.7;
        carMesh.add(body);

        const roofGeometry = new THREE.BoxGeometry(1.5, 0.5, 1.5);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 1.3;
        roof.position.z = -0.2;
        carMesh.add(roof);

        addWheel(carMesh, 0.8, 0.4, 1);
        addWheel(carMesh, -0.8, 0.4, 1);
        addWheel(carMesh, 0.8, 0.4, -1);
        addWheel(carMesh, -0.8, 0.4, -1);

        carMesh.rotation.y = 0;
        aiCarGroup.add(carMesh);

        const angle = (i + 1) * (Math.PI / 6);
        aiCarGroup.position.set(
            Math.cos(angle) * TRACK_RADIUS,
            0.2,
            Math.sin(angle) * TRACK_RADIUS
        );
        aiCarGroup.rotation.y = -angle; // Face tangent to track

        aiCarGroup.speed = 0;
        aiCarGroup.trackPosition = (i + 1) * (2 * Math.PI / (NUM_AI_CARS + 1));
        aiCarGroup.lap = 1;
        aiCarGroup.difficulty = 0.6 + (i * 0.1);
        aiCarGroup.carMesh = carMesh;

        scene.add(aiCarGroup);
        aiCars.push(aiCarGroup);
    }
}

/**
 * Create obstacles on the track
 */
function createObstacles() {
    // Create oil slicks
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const radius = TRACK_RADIUS + (Math.random() - 0.5) * (TRACK_WIDTH * 0.8);

        const obstacleGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 16);
        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: 0x000077,
            transparent: true,
            opacity: 0.7
        });
        const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);

        obstacle.position.set(
            Math.cos(angle) * radius,
            0.05,
            Math.sin(angle) * radius
        );

        obstacle.userData = { type: 'oil', radius: 1 };
        scene.add(obstacle);
        obstacles.push(obstacle);
    }

    // Create speed boosts
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + (Math.PI / 6);
        const radius = TRACK_RADIUS + (Math.random() - 0.5) * (TRACK_WIDTH * 0.5);

        const obstacleGeometry = new THREE.BoxGeometry(1.5, 0.1, 1.5);
        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7
        });
        const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);

        obstacle.position.set(
            Math.cos(angle) * radius,
            0.05,
            Math.sin(angle) * radius
        );

        obstacle.userData = { type: 'boost', radius: 1 };
        scene.add(obstacle);
        obstacles.push(obstacle);
    }
}

/**
 * Set up virtual joystick using nipplejs
 */
function setupVirtualJoystick() {
    // Make controls div visible
    document.getElementById('controls').style.display = 'flex';
    
    // Position the joystick at the bottom of the screen
    const joystickContainer = document.getElementById('joystick-zone');
    joystickContainer.style.position = 'absolute';
    joystickContainer.style.bottom = '20px';
    joystickContainer.style.left = '20px';
    joystickContainer.style.width = '120px';
    joystickContainer.style.height = '120px';
    joystickContainer.style.background = 'rgba(255, 255, 255, 0.3)';
    joystickContainer.style.borderRadius = '50%';
    joystickContainer.style.zIndex = '999';
    joystickContainer.style.display = 'block';
    
    // Set up boost button
    const boostButton = document.getElementById('boost-button');
    boostButton.style.position = 'absolute';
    boostButton.style.bottom = '20px';
    boostButton.style.right = '20px';
    boostButton.style.width = '80px';
    boostButton.style.height = '80px';
    boostButton.style.borderRadius = '50%';
    boostButton.style.background = 'rgba(255, 0, 0, 0.6)';
    boostButton.style.color = 'white';
    boostButton.style.display = 'flex';
    boostButton.style.justifyContent = 'center';
    boostButton.style.alignItems = 'center';
    boostButton.style.fontWeight = 'bold';
    boostButton.style.zIndex = '999';
    
    // Initialize nipplejs
    joystick = nipplejs.create({
        zone: joystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'rgba(255, 255, 255, 0.8)',
        size: 100
    });
    
    // Joystick event handlers
    joystick.on('move', (event, data) => {
        if (!isRaceStarted || isRaceFinished) return;
        
        // Get the input values normalized from -1 to 1
        const angle = data.angle.radian;
        const force = Math.min(1, data.force / 50); // Normalize force between 0 and 1
        
        // Forward/backward (y-axis)
        joystickData.forward = Math.cos(angle - Math.PI/2) * force;
        
        // Left/right (x-axis)
        joystickData.turn = Math.sin(angle - Math.PI/2) * force;
    });
    
    joystick.on('end', () => {
        // Reset joystick data when released
        joystickData.forward = 0;
        joystickData.turn = 0;
    });
    
    // Boost button functionality
    let boostActive = false;
    let boostTimeout = null;
    let boostCooldownTimeout = null;
    let boostAvailable = true;
    
    boostButton.addEventListener('click', () => {
        if (!isRaceStarted || isRaceFinished || !boostAvailable) return;
        
        // Activate boost
        boostActive = true;
        boostAvailable = false;
        
        // Visual feedback
        boostButton.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        
        // Boost effect
        speed *= 1.5;
        
        // Boost duration
        boostTimeout = setTimeout(() => {
            boostActive = false;
            
            // Cooldown period
            boostCooldownTimeout = setTimeout(() => {
                boostAvailable = true;
                boostButton.style.backgroundColor = 'rgba(255, 0, 0, 0.6)';
            }, 5000); // 5 second cooldown
            
        }, 2000); // 2 second boost duration
    });
    
    // Add these variables to window for updatePlayerCar
    window.boostActive = boostActive;
    window.boostTimeout = boostTimeout;
    window.boostCooldownTimeout = boostCooldownTimeout;
    window.boostAvailable = boostAvailable;
}

/**
 * Update player car position and rotation based on joystick input
 */
function updatePlayerCar() {
    // Process joystick input
    if (joystickData.forward !== 0) {
        // Accelerate based on forward input
        const acceleration = joystickData.forward > 0 ? 
            ACCELERATION * joystickData.forward * 2 : // Forward
            DECELERATION * Math.abs(joystickData.forward) * 2; // Backward/brake
        
        if (joystickData.forward > 0) {
            // Accelerate forward
            speed = Math.min(MAX_SPEED, speed + acceleration);
        } else {
            // Brake/reverse
            speed = Math.max(0, speed - acceleration);
        }
    } else {
        // Apply friction when no input
        speed *= FRICTION;
    }
    
    // Apply steering from joystick
    if (joystickData.turn !== 0) {
        playerCar.rotation.y += joystickData.turn * STEERING_SPEED;
    }
    
    // Clamp speed
    speed = Math.max(0, Math.min(MAX_SPEED, speed));
    if (speed < 0.001) speed = 0; // Stop completely at very low speeds
    
    // Move along the direction the car is facing
    const moveX = Math.sin(playerCar.rotation.y) * speed;
    const moveZ = Math.cos(playerCar.rotation.y) * speed;
    
    playerCar.position.x += moveX;
    playerCar.position.z += moveZ;
    
    // Visual car body tilt effect during turning
    if (playerCar.carMesh) {
        // Reset tilt
        playerCar.carMesh.rotation.z = 0;
        
        // Apply tilt based on turning
        const turnRate = joystickData.turn * speed * 5;
        playerCar.carMesh.rotation.z = -turnRate * 0.2; // Tilt factor
    }

    // Track boundary handling and lap counting logic
    const distanceFromCenter = Math.sqrt(
        playerCar.position.x * playerCar.position.x +
        playerCar.position.z * playerCar.position.z
    );
    const angleToCenter = Math.atan2(playerCar.position.z, playerCar.position.x);

    if (distanceFromCenter > TRACK_RADIUS + TRACK_WIDTH / 2) {
        playerCar.position.x -= Math.cos(angleToCenter) * GRAVITY;
        playerCar.position.z -= Math.sin(angleToCenter) * GRAVITY;
        speed *= 0.95;
    } else if (distanceFromCenter < TRACK_RADIUS - TRACK_WIDTH / 2) {
        playerCar.position.x += Math.cos(angleToCenter) * GRAVITY;
        playerCar.position.z += Math.sin(angleToCenter) * GRAVITY;
        speed *= 0.95;
    }

    const prevAngle = trackProgress;
    trackProgress = (Math.atan2(playerCar.position.z, playerCar.position.x) + Math.PI) / (Math.PI * 2);

    if (prevAngle > 0.9 && trackProgress < 0.1) {
        currentLap++;
        if (currentLap > TOTAL_LAPS) {
            finishRace();
        }
    }
}

/**
 * Handle window resize
 */
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -30 * aspect;
    camera.right = 30 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Start the race
 */
function startRace() {
    isRaceStarted = true;
    document.getElementById('start-screen').classList.add('hidden');

    // Initialize player positions array
    playerPositions = [
        { car: playerCar, position: 0, lap: 1 },
        ...aiCars.map(car => ({ car, position: car.trackPosition, lap: 1 }))
    ];
}

/**
 * Restart the race
 */
function restartRace() {
    isRaceFinished = false;
    document.getElementById('end-screen').classList.add('hidden');

    playerCar.position.set(TRACK_RADIUS, 0.2, 0); // Adjusted y to match creation
    playerCar.rotation.y = 0;
    speed = 0;
    currentLap = 1;
    trackProgress = 0;

    for (let i = 0; i < aiCars.length; i++) {
        const angle = (i + 1) * (Math.PI / 6);
        aiCars[i].position.set(
            Math.cos(angle) * TRACK_RADIUS,
            0.2, // Adjusted y to match creation
            Math.sin(angle) * TRACK_RADIUS
        );
        aiCars[i].rotation.y = -angle; // Face tangent
        aiCars[i].speed = 0;
        aiCars[i].trackPosition = (i + 1) * (2 * Math.PI / (NUM_AI_CARS + 1));
        aiCars[i].lap = 1;
    }

    if (window.boostTimeout) clearTimeout(window.boostTimeout);
    if (window.boostCooldownTimeout) clearTimeout(window.boostCooldownTimeout);
    window.boostActive = false;
    window.boostAvailable = true;
    document.getElementById('boost-button').style.backgroundColor = 'rgba(255, 0, 0, 0.6)';

    startRace();
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);

    if (isRaceStarted && !isRaceFinished) {
        updatePlayerCar();
        updateAICars();
        checkCollisions();
        updatePositions();
        updateHUD();
    }

    // Fixed isometric camera - doesn't follow player
    if (playerCar) {
        const offsetX = playerCar.position.x;
        const offsetZ = playerCar.position.z;
        camera.position.set(offsetX + 50, 50, offsetZ + 50);
        camera.lookAt(offsetX, 0, offsetZ);
    }

    renderer.render(scene, camera);
}

/**
 * Update AI car positions using a movement system comparable to the player's
 */
function updateAICars() {
    aiCars.forEach(car => {
        const prevPosition = car.trackPosition;
        
        // Calculate equivalent angular speed based on track radius to match player's linear speed
        const equivalentAngularSpeed = (MAX_SPEED / TRACK_RADIUS) * car.difficulty;
        car.speed = equivalentAngularSpeed;
        
        // Advance position using the recalibrated speed
        car.trackPosition += car.speed;

        if (car.trackPosition >= Math.PI * 2) {
            car.trackPosition -= Math.PI * 2;
            car.lap++;
            if (car.lap > TOTAL_LAPS) {
                finishRace();
            }
        }

        // Allow AI cars to move slightly toward or away from track center
        const radius = TRACK_RADIUS + (Math.sin(car.trackPosition * 5) * TRACK_WIDTH * 0.3);
        car.position.x = Math.cos(car.trackPosition) * radius;
        car.position.z = Math.sin(car.trackPosition) * radius;

        // Face tangent direction
        car.rotation.y = -car.trackPosition;

        // Add some randomness to AI driving behavior
        if (Math.random() < 0.02) {
            car.speed *= 0.8;
        }
    });
}

/**
 * Check for collisions with obstacles and other cars
 */
function checkCollisions() {
    // Check collisions with obstacles
    for (const obstacle of obstacles) {
        const distance = Math.sqrt(
            Math.pow(playerCar.position.x - obstacle.position.x, 2) +
            Math.pow(playerCar.position.z - obstacle.position.z, 2)
        );

        if (distance < obstacle.userData.radius + 1.5) {
            if (obstacle.userData.type === 'oil') {
                // Oil slick - lose control temporarily
                joystickData.turn = (Math.random() - 0.5) * 2; // Random steering
                speed *= 0.8;
            } else if (obstacle.userData.type === 'boost') {
                // Boost pad - temporary speed boost
                speed = MAX_SPEED * 1.2;
            }
        }
    }

    // Check collisions with AI cars
    for (const aiCar of aiCars) {
        const distance = Math.sqrt(
            Math.pow(playerCar.position.x - aiCar.position.x, 2) +
            Math.pow(playerCar.position.z - aiCar.position.z, 2)
        );

        if (distance < 3) {
            // Collision with AI car - both cars slow down
            speed *= 0.5;
            aiCar.speed *= 0.5;

            // Push cars away from each other
            const angle = Math.atan2(
                playerCar.position.z - aiCar.position.z,
                playerCar.position.x - aiCar.position.x
            );

            playerCar.position.x += Math.cos(angle) * 0.5;
            playerCar.position.z += Math.sin(angle) * 0.5;
            aiCar.position.x -= Math.cos(angle) * 0.5;
            aiCar.position.z -= Math.sin(angle) * 0.5;
        }
    }
}

/**
 * Update race positions
 */
function updatePositions() {
    // Update player position in the array
    playerPositions[0].position = trackProgress;
    playerPositions[0].lap = currentLap;

    // Sort positions by lap and progress
    playerPositions.sort((a, b) => {
        if (a.lap !== b.lap) {
            return b.lap - a.lap;
        }
        return b.position - a.position;
    });

    // Find player position
    playerPosition = playerPositions.findIndex(p => p.car === playerCar) + 1;
}

/**
 * Update the HUD with current game state
 */
function updateHUD() {
    document.getElementById('speed').textContent = `Speed: ${Math.floor(speed * 100)}`;
    document.getElementById('lap').textContent = `Lap: ${currentLap}/${TOTAL_LAPS}`;
    document.getElementById('position').textContent = `Position: ${playerPosition}/${NUM_AI_CARS + 1}`;
}

/**
 * Finish the race
 */
function finishRace() {
    isRaceFinished = true;

    document.getElementById('end-screen').classList.remove('hidden');
    document.getElementById('final-position').textContent =
        `You finished in position ${playerPosition} of ${NUM_AI_CARS + 1}`;
}
/**
 * Balloon Pop Game
 * A fun game where you pop colorful balloons before they float away
 */

// Game state variables
let score = 0;                  // Current player score
let timeRemaining = 60;         // Game time in seconds
let gameActive = false;         // Whether game is currently running
let highScore = 0;              // Highest score achieved

// Three.js variables
let scene, camera, renderer;    // Basic Three.js components
let balloons = [];              // Array of balloon objects in the scene
let popSound;                   // Sound effect for balloon popping
let raycaster, mouse;           // For handling mouse/touch interaction

// Screen boundaries (will be set in init)
let screenBounds = {
    left: -15,
    right: 15,
    bottom: -15,
    top: 15
};

// HTML Elements
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');
const gameOverlay = document.getElementById('game-overlay');
const gameMenu = document.getElementById('game-menu');
const gameOver = document.getElementById('game-over');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const finalScoreElement = document.getElementById('final-score');
const highScoreElement = document.getElementById('high-score');

// Check for saved high score in local storage
if (localStorage.getItem('balloonPopHighScore')) {
    highScore = parseInt(localStorage.getItem('balloonPopHighScore'));
    highScoreElement.textContent = `High Score: ${highScore}`;
}

/**
 * Initialize the game scene, camera, and renderer
 */
function initGame() {
    // Create a new scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a);
    
    // Set up camera with perspective appropriate for the game
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 20;
    
    // Initialize renderer with antialiasing for smoother edges
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);
    
    // Create ambient light for basic scene illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add directional light to create highlights on balloons
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    // Initialize raycaster for detecting balloon clicks/taps
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Calculate screen boundaries based on camera position and field of view
    calculateScreenBounds();
    
    // Event listeners for window resize and mouse/touch interactions
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
    
    // Better touch event handling
    const gameContainer = document.getElementById('game-container');
    gameContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    
    // Make sure buttons work on mobile 
    startButton.addEventListener('click', startGame);
    startButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        startGame();
    });
    
    restartButton.addEventListener('click', startGame);
    restartButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        startGame();
    });
    
    // Start the animation loop
    animate();
}

/**
 * Calculate the screen boundaries in 3D space
 */
function calculateScreenBounds() {
    // Calculate visible width and height at z=0 plane based on FOV and camera distance
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const visibleWidth = visibleHeight * camera.aspect;
    
    // Set screen boundaries with some padding
    const padding = 1.5;
    screenBounds = {
        left: -visibleWidth / 2 + padding,
        right: visibleWidth / 2 - padding,
        bottom: -visibleHeight / 2 + padding,
        top: visibleHeight / 2 - padding
    };
}

function startGame() {
    // Reset game state
    score = 0;
    timeRemaining = 60;
    gameActive = true;
    
    // Update UI elements
    scoreElement.textContent = score;
    timeElement.textContent = timeRemaining;
    gameOverlay.classList.remove('visible');
    gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    gameMenu.classList.add('hidden');
    gameOver.classList.add('hidden');
    
    // Clear any existing balloons
    balloons.forEach(balloon => scene.remove(balloon.mesh));
    balloons = [];
    
    // Start the game timer
    const gameTimer = setInterval(() => {
        timeRemaining--;
        timeElement.textContent = timeRemaining;
        
        if (timeRemaining <= 0) {
            clearInterval(gameTimer);
            endGame();
        }
    }, 1000);
}

/**
 * End the current game
 */
function endGame() {
    gameActive = false;
    
    // Update high score if needed
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('balloonPopHighScore', highScore);
        highScoreElement.textContent = `High Score: ${highScore}`;
    }
    
    // Show game over screen
    finalScoreElement.textContent = `Score: ${score}`;
    gameOverlay.classList.add('visible');
    gameOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    gameMenu.classList.remove('visible');
    gameMenu.classList.add('hidden');
    gameOver.classList.remove('hidden');
    gameOver.classList.add('visible');
}

/**
 * Create a balloon with random properties
 */
function createBalloon() {
    // Only create balloons if the game is active
    if (!gameActive) return;
    
    // Balloon colors available in the game (red balloons are negative targets)
    const colors = [0x2196f3, 0x4caf50, 0xffeb3b, 0x9c27b0];
    
    // Decide if this should be a regular balloon or a red (negative) balloon
    const isRedBalloon = Math.random() < 0.2; // 20% chance of red balloon
    const color = isRedBalloon ? 0xff0000 : colors[Math.floor(Math.random() * colors.length)];
    
    // Random balloon properties
    const radius = Math.random() * 0.5 + 0.7;
    const xPosition = Math.random() * (screenBounds.right - screenBounds.left) + screenBounds.left;
    const yPosition = screenBounds.bottom - radius * 2; // Start below the screen
    
    // Create balloon geometry and material
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: color,
        specular: 0x111111,
        shininess: 30
    });
    
    // Create the balloon mesh
    const balloonMesh = new THREE.Mesh(geometry, material);
    balloonMesh.position.set(xPosition, yPosition, 0);
    
    // Add small knot at bottom of balloon
    const knotGeometry = new THREE.CylinderGeometry(radius * 0.2, radius * 0.1, radius * 0.3, 8);
    const knotMaterial = new THREE.MeshPhongMaterial({ color: color });
    const knot = new THREE.Mesh(knotGeometry, knotMaterial);
    knot.position.y = -radius - radius * 0.15;
    balloonMesh.add(knot);
    
    // Add invisible larger hitbox for better touch detection on mobile
    const hitboxGeometry = new THREE.SphereGeometry(radius * 1.5, 8, 8);
    const hitboxMaterial = new THREE.MeshBasicMaterial({ 
        transparent: true, 
        opacity: 0 
    });
    const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
    balloonMesh.add(hitbox);
    
    // Create balloon object with properties needed for game
    const balloon = {
        mesh: balloonMesh,
        speed: Math.random() * 0.05 + 0.03,
        points: isRedBalloon ? -10 : Math.ceil(10 / radius), // Red balloons negative points, smaller balloons worth more
        popped: false,
        type: isRedBalloon ? 'red' : 'normal',
        userData: { horizontalVelocity: 0 }
    };
    
    // Add to scene and balloon array
    scene.add(balloonMesh);
    balloons.push(balloon);
}

/**
 * Create a pop effect at the balloon's position
 * @param {Object} position - Position vector of the balloon
 * @param {number} color - Color of the balloon
 */
function createPopEffect(position, color) {
    // Create particles for the pop effect
    const particleCount = 15;
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: color
    });
    
    // Create particle group
    const particles = new THREE.Group();
    
    // Add particles in a star pattern
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Set random directions for particles
        const angle = (i / particleCount) * Math.PI * 2;
        particle.userData = {
            velocity: new THREE.Vector3(
                Math.cos(angle) * (Math.random() * 0.1 + 0.05),
                Math.sin(angle) * (Math.random() * 0.1 + 0.05),
                (Math.random() - 0.5) * 0.1
            ),
            time: 0
        };
        
        particles.add(particle);
    }
    
    // Position and add the particle group to the scene
    particles.position.copy(position);
    scene.add(particles);
    
    // Remove particles after animation
    setTimeout(() => {
        scene.remove(particles);
    }, 1000);
    
    return particles;
}

/**
 * Handle window resize events
 */
function onWindowResize() {
    // Update camera aspect ratio to match new window size
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Recalculate screen boundaries
    calculateScreenBounds();
}

/**
 * Handle mouse click events
 * @param {Event} event - Mouse event
 */
function onMouseDown(event) {
    event.preventDefault();
    
    // Convert mouse coordinates to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    checkBalloonCollision();
}

/**
 * Handle touch events for mobile devices
 * @param {Event} event - Touch event
 */
function onTouchStart(event) {
    // Only prevent default if we're in the game
    if (gameActive) {
        event.preventDefault();
    }
    
    // Use the first touch point
    const touch = event.touches[0];
    
    // Convert touch coordinates to normalized device coordinates (-1 to +1)
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    // Check for balloon collision
    checkBalloonCollision();
}

/**
 * Check if a balloon was clicked/tapped
 */
function checkBalloonCollision() {
    // Only check collisions if the game is active
    if (!gameActive) return;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Get balloon meshes for intersection testing
    const balloonMeshes = balloons
        .filter(balloon => !balloon.popped)
        .map(balloon => balloon.mesh);
    
    // Use a slightly larger threshold for touch interfaces
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const intersects = raycaster.intersectObjects(balloonMeshes, true);
    
    if (intersects.length > 0) {
        // Find the balloon that was hit
        const hitMesh = intersects[0].object;
        let hitBalloon;
        
        // Check if we hit the main mesh or one of its children
        for (const balloon of balloons) {
            if (balloon.mesh === hitMesh || hitMesh.parent === balloon.mesh) {
                hitBalloon = balloon;
                break;
            }
        }
        
        if (hitBalloon && !hitBalloon.popped) {
            popBalloon(hitBalloon);
        }
    }
}

/**
 * Pop a balloon and update the score
 * @param {Object} balloon - The balloon object to pop
 */
function popBalloon(balloon) {
    // Mark as popped so it doesn't get checked again
    balloon.popped = true;
    
    // Create pop effect
    createPopEffect(balloon.mesh.position.clone(), balloon.mesh.children[0].material.color.getHex());
    
    // Update score
    score += balloon.points;
    scoreElement.textContent = score;
    
    // If it's a bad balloon that was clicked, show a warning
    if (balloon.type === 'red') {
        // Create warning text that fades out
        const warningElement = document.createElement('div');
        warningElement.textContent = '-10 Points!';
        warningElement.style.position = 'absolute';
        warningElement.style.color = 'red';
        warningElement.style.fontWeight = 'bold';
        warningElement.style.fontSize = '24px';
        
        // Position near the bad balloon
        const canvasRect = renderer.domElement.getBoundingClientRect();
        const vector = balloon.mesh.position.clone();
        vector.project(camera);
        
        warningElement.style.left = ((vector.x + 1) / 2 * canvasRect.width) + 'px';
        warningElement.style.top = (-(vector.y - 1) / 2 * canvasRect.height) + 'px';
        
        document.body.appendChild(warningElement);
        
        // Fade out and remove
        setTimeout(() => {
            document.body.removeChild(warningElement);
        }, 1000);
    }
    
    // Remove balloon from scene
    scene.remove(balloon.mesh);
}

/**
 * Update balloon positions and animations
 */
function updateBalloons() {
    // Create new balloons at random intervals
    if (gameActive && Math.random() < 0.03) {
        createBalloon();
    }
    
    // Update existing balloons
    const balloonsToRemove = [];
    
    // Check for collisions between balloons
    for (let i = 0; i < balloons.length; i++) {
        const balloonA = balloons[i];
        if (balloonA.popped) continue;
        
        for (let j = i + 1; j < balloons.length; j++) {
            const balloonB = balloons[j];
            if (balloonB.popped) continue;
            
            // Get balloon positions and combined radius
            const posA = balloonA.mesh.position;
            const posB = balloonB.mesh.position;
            const radiusA = balloonA.mesh.geometry.parameters.radius;
            const radiusB = balloonB.mesh.geometry.parameters.radius;
            const combinedRadius = radiusA + radiusB;
            
            // Calculate distance between balloons
            const distance = posA.distanceTo(posB);
            
            // If balloons are colliding
            if (distance < combinedRadius * 0.8) {
                // Calculate collision response
                const overlap = combinedRadius - distance;
                const direction = new THREE.Vector3().subVectors(posA, posB).normalize();
                
                // Move balloons apart based on their relative sizes (smaller balloon moves more)
                const totalRadius = radiusA + radiusB;
                const moveRatioA = radiusB / totalRadius;
                const moveRatioB = radiusA / totalRadius;
                
                // Apply movement
                posA.add(direction.clone().multiplyScalar(overlap * moveRatioA * 0.5));
                posB.add(direction.clone().multiplyScalar(-overlap * moveRatioB * 0.5));
                
                // Add horizontal velocity changes for more natural bouncing
                // Store horizontal velocities in userData if they don't exist yet
                if (!balloonA.userData) balloonA.userData = { horizontalVelocity: 0 };
                if (!balloonB.userData) balloonB.userData = { horizontalVelocity: 0 };
                
                // Calculate new horizontal velocities based on collision
                const velocityChangeA = direction.x * 0.03;
                const velocityChangeB = -direction.x * 0.03;
                
                // Apply the velocity changes
                balloonA.userData.horizontalVelocity = velocityChangeA;
                balloonB.userData.horizontalVelocity = velocityChangeB;
            }
        }
        
        // Update balloon position
        balloonA.mesh.position.y += balloonA.speed;
        
        // Apply horizontal velocity if it exists
        if (balloonA.userData && balloonA.userData.horizontalVelocity) {
            balloonA.mesh.position.x += balloonA.userData.horizontalVelocity;
            
            // Gradually reduce horizontal velocity (damping)
            balloonA.userData.horizontalVelocity *= 0.98;
            
            // If velocity becomes very small, zero it out
            if (Math.abs(balloonA.userData.horizontalVelocity) < 0.001) {
                balloonA.userData.horizontalVelocity = 0;
            }
        } else {
            // Make balloon sway slightly for more natural movement if not affected by collision
            balloonA.mesh.position.x += Math.sin(Date.now() * 0.001 + i) * 0.01;
        }
        
        // Keep balloon within side boundaries
        if (balloonA.mesh.position.x < screenBounds.left) {
            balloonA.mesh.position.x = screenBounds.left;
        } else if (balloonA.mesh.position.x > screenBounds.right) {
            balloonA.mesh.position.x = screenBounds.right;
        }
        
        // Remove balloons that have floated too high
        if (balloonA.mesh.position.y > screenBounds.top) {
            scene.remove(balloonA.mesh);
            balloonsToRemove.push(i);
        }
    }
    
    // Remove balloons from the array (in reverse order)
    for (let i = balloonsToRemove.length - 1; i >= 0; i--) {
        balloons.splice(balloonsToRemove[i], 1);
    }
}

/**
 * Animation loop for the game
 */
function animate() {
    requestAnimationFrame(animate);
    
    // Update balloon positions
    updateBalloons();
    
    // Update any pop effects
    scene.children.forEach(child => {
        // Check if object is a particle group
        if (child.isGroup) {
            child.children.forEach(particle => {
                if (particle.userData && particle.userData.velocity) {
                    // Update particle position based on velocity
                    particle.position.x += particle.userData.velocity.x;
                    particle.position.y += particle.userData.velocity.y;
                    particle.position.z += particle.userData.velocity.z;
                    
                    // Apply slight gravity to particles
                    particle.userData.velocity.y -= 0.001;
                    
                    // Fade particles over time
                    particle.userData.time += 0.01;
                    if (particle.material && particle.userData.time < 1) {
                        particle.material.opacity = 1 - particle.userData.time;
                    }
                }
            });
        }
    });
    
    // Render the scene
    renderer.render(scene, camera);
}

// Initialize the game when the page loads
initGame();
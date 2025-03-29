/**
 * Balloon Pop Game
 * A 3D game where players pop balloons to score points within a time limit
 */

// Check if Three.js and GSAP are loaded
console.log("Three.js loaded:", typeof THREE !== 'undefined');
console.log("GSAP loaded:", typeof gsap !== 'undefined');

// Wait for Three.js and GSAP to load
window.addEventListener('load', () => {
    // Game state variables
    let scene, camera, renderer;
    let balloons = [];
    let score = 0;
    let timeRemaining = 60;
    let gameActive = false;
    let gameInterval;
    let raycaster, mouse;
    let particles = [];

    // DOM elements
    const gameContainer = document.getElementById('game-container');
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    const gameOverElement = document.getElementById('game-over');
    const finalScoreElement = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');

    // Balloon types with properties
    const balloonTypes = [
        { color: 0xff4081, points: 10, scale: 1.0, speed: 1.0, size: 1.0 },     // Pink - common, easy
        { color: 0x3f51b5, points: 20, scale: 0.9, speed: 1.2, size: 0.9 },     // Indigo - medium
        { color: 0x00bcd4, points: 30, scale: 0.8, speed: 1.3, size: 0.8 },     // Cyan - medium
        { color: 0xffeb3b, points: 50, scale: 0.7, speed: 1.4, size: 0.7 },     // Yellow - rare
        { color: 0x8bc34a, points: 15, scale: 0.95, speed: 1.1, size: 0.95 },   // Light Green - common
        { color: 0xff9800, points: 100, scale: 0.6, speed: 1.6, size: 0.5 }     // Orange - very rare, hard
    ];

    /**
     * Initialize the game scene, camera, and renderer
     */
    function init() {
        // Create the scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000033); // Dark blue background

        // Create the camera with parameters suitable for both desktop and mobile
        const aspectRatio = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
        camera.position.z = 20;

        // Create the renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        gameContainer.appendChild(renderer.domElement);

        // Setup raycaster for balloon interaction
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Add subtle ambient lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Add directional light for better 3D effect
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 10, 10);
        scene.add(directionalLight);

        // Add a water plane
        const waterGeometry = new THREE.PlaneGeometry(100, 100, 20, 20);
        const waterMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1E90FF,
            roughness: 0.2,
            metalness: 0.9,
            transparent: true,
            opacity: 0.8
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -10;
        scene.add(water);
        
        // Animate water
        const waterVertices = waterGeometry.attributes.position;
        
        // Water animation function
        function animateWater() {
            const time = Date.now() * 0.003;
            for (let i = 0; i < waterVertices.count; i++) {
                const x = waterVertices.getX(i);
                const z = waterVertices.getZ(i);
                const waveHeight = 0.2;
                
                waterVertices.setY(
                    i,
                    Math.sin(x / 2 + time) * waveHeight + 
                    Math.sin(z / 3 + time) * waveHeight
                );
            }
            
            waterGeometry.attributes.position.needsUpdate = true;
            requestAnimationFrame(animateWater);
        }
        
        animateWater();

        // Event listeners
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('touchstart', onTouchStart, { passive: false });
        
        // Event listeners for UI buttons
        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', restartGame);
        
        console.log("Button listeners attached", startButton, restartButton);

        // Start the animation loop
        animate();
    }

    /**
     * Handle window resize events
     */
    function onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
    }

    /**
     * Handle mouse click events
     * @param {MouseEvent} event - The mouse event
     */
    function onMouseDown(event) {
        if (!gameActive) return;
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        checkBalloonPop();
    }

    /**
     * Handle touch events for mobile devices
     * @param {TouchEvent} event - The touch event
     */
    function onTouchStart(event) {
        if (!gameActive) return;
        
        // Prevent default behavior to avoid scrolling
        event.preventDefault();
        
        const touch = event.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        checkBalloonPop();
    }

    /**
     * Check if a balloon has been popped by the player
     */
    function checkBalloonPop() {
        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);
        
        // Calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(scene.children);
        
        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;
            
            // Check if the intersected object is a balloon
            const balloonIndex = balloons.findIndex(balloon => balloon === object);
            
            if (balloonIndex !== -1) {
                popBalloon(object, balloonIndex);
                break; // Only pop one balloon per click
            }
        }
    }

    /**
     * Create a new balloon at a random position
     */
    function createBalloon() {
        // Don't create new balloons if game is over
        if (!gameActive) return;
        
        // Choose balloon type with weighted randomness
        let balloonType;
        const rand = Math.random();
        if (rand < 0.05) {
            balloonType = balloonTypes[5]; // Very rare (5%)
        } else if (rand < 0.15) {
            balloonType = balloonTypes[3]; // Rare (10%)
        } else if (rand < 0.40) {
            balloonType = balloonTypes[1] || balloonTypes[2]; // Medium (25%)
        } else {
            // Common (60%)
            balloonType = rand < 0.70 ? balloonTypes[0] : balloonTypes[4];
        }
        
        // Create realistic balloon shape
        const balloonGeometry = createRealisticBalloon(balloonType.size);
        
        // Create shiny material with highlight
        const balloonMaterial = new THREE.MeshPhongMaterial({
            color: balloonType.color,
            specular: 0xffffff,
            shininess: 100,
            emissive: balloonType.color,
            emissiveIntensity: 0.1
        });
        
        // Create the balloon mesh
        const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial);
        balloon.scale.set(balloonType.scale, balloonType.scale, balloonType.scale);
        
        // Store points value with the balloon
        balloon.userData.points = balloonType.points;
        
        // Set random position
        const posX = Math.random() * 30 - 15;
        const posY = -15; // Start below the screen
        const posZ = Math.random() * 10 - 20;
        balloon.position.set(posX, posY, posZ);
        
        // Add slight wobble rotation animation
        const rotationSpeed = (Math.random() * 0.01) - 0.005;
        balloon.userData.rotationSpeed = rotationSpeed;
        
        // Make higher point balloons move faster and more erratically
        const speedMultiplier = balloonType.speed;
        
        // Add to scene and balloons array
        scene.add(balloon);
        balloons.push(balloon);
        
        // Animate the balloon rising with some randomness based on difficulty
        gsap.to(balloon.position, {
            y: 20, // Final y position (above the screen)
            x: balloon.position.x + (Math.random() * 10 - 5) * speedMultiplier,
            z: balloon.position.z + (Math.random() * 6 - 3) * speedMultiplier,
            duration: (8 + Math.random() * 4) / speedMultiplier, // Faster for harder balloons
            ease: "power1.inOut",
            onComplete: () => {
                // Remove the balloon when it goes offscreen
                removeBalloon(balloon);
            }
        });
    }
    
    /**
     * Create a realistic balloon shape
     * @param {number} size - Base size of the balloon
     * @returns {THREE.SphereGeometry} The balloon geometry
     */
    function createRealisticBalloon(size) {
        // Create slightly teardrop shaped balloon
        const balloonGeometry = new THREE.SphereGeometry(size, 32, 32);
        
        // Modify bottom of sphere to create slight teardrop shape
        const positionAttribute = balloonGeometry.attributes.position;
        
        for (let i = 0; i < positionAttribute.count; i++) {
            const y = positionAttribute.getY(i);
            
            // If this vertex is in the bottom half, make it slightly pointier
            if (y < 0) {
                // Scale Y position to create teardrop effect
                positionAttribute.setY(i, y * (1.0 + Math.abs(y) * 0.4));
            }
        }
        
        balloonGeometry.computeVertexNormals();
        return balloonGeometry;
    }

    /**
     * Pop a balloon - remove it and add particle effects
     * @param {THREE.Mesh} balloon - The balloon mesh
     * @param {number} index - Index of the balloon in the balloons array
     */
    function popBalloon(balloon, index) {
        // Create particle effect at balloon position
        createParticles(balloon.position, balloon.material.color);
        
        // Get points for this balloon type
        const points = balloon.userData.points || 10;
        
        // Remove the balloon
        scene.remove(balloon);
        balloons.splice(index, 1);
        
        // Increment score based on balloon type
        score += points;
        scoreElement.textContent = `Score: ${score}`;
        
        // Show floating score text
        showFloatingScore(points, balloon.position);
    }
    
    /**
     * Show floating score text that fades away
     * @param {number} points - Points to display
     * @param {THREE.Vector3} position - Position to show the text
     */
    function showFloatingScore(points, position) {
        // Create a div for the floating score
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'floating-score';
        scoreDiv.textContent = `+${points}`;
        
        // Position at balloon's 3D position projected to screen
        const vector = position.clone();
        vector.project(camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        
        scoreDiv.style.left = `${x}px`;
        scoreDiv.style.top = `${y}px`;
        
        // Add to DOM
        gameContainer.appendChild(scoreDiv);
        
        // Animate
        gsap.to(scoreDiv, {
            y: '-=50',
            opacity: 0,
            duration: 1,
            onComplete: () => {
                if (scoreDiv.parentNode) {
                    scoreDiv.parentNode.removeChild(scoreDiv);
                }
            }
        });
    }

    /**
     * Remove a balloon from the scene and array without popping effect
     * @param {THREE.Mesh} balloon - The balloon mesh to remove
     */
    function removeBalloon(balloon) {
        const index = balloons.indexOf(balloon);
        if (index !== -1) {
            scene.remove(balloon);
            balloons.splice(index, 1);
        }
    }

    /**
     * Create particle effects when a balloon pops
     * @param {THREE.Vector3} position - Position to create particles
     * @param {THREE.Color} color - Color of the particles
     */
    function createParticles(position, color) {
        const particleCount = 20;
        const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ color: color });
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            
            // Random velocity
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
            
            // Add to scene and particles array
            scene.add(particle);
            particles.push({
                mesh: particle,
                velocity: particle.velocity,
                life: 1.0 // Life decreases over time
            });
        }
    }

    /**
     * Update particle positions and remove dead particles
     * @param {number} delta - Time since last frame in seconds
     */
    function updateParticles(delta) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            
            // Update position based on velocity
            particle.mesh.position.x += particle.velocity.x * delta * 2;
            particle.mesh.position.y += particle.velocity.y * delta * 2;
            particle.mesh.position.z += particle.velocity.z * delta * 2;
            
            // Add gravity effect
            particle.velocity.y -= 3 * delta;
            
            // Decrease life
            particle.life -= delta * 2;
            
            // Scale down as life decreases
            particle.mesh.scale.setScalar(particle.life);
            
            // Remove if dead
            if (particle.life <= 0) {
                scene.remove(particle.mesh);
                particles.splice(i, 1);
            }
        }
    }

    /**
     * Start the game
     */
    function startGame() {
        console.log("Start game function called");
        // Reset game state
        score = 0;
        timeRemaining = 60;
        gameActive = true;
        
        // Update UI
        scoreElement.textContent = `Score: ${score}`;
        timerElement.textContent = `Time: ${timeRemaining}s`;
        startScreen.classList.add('hidden');
        gameOverElement.classList.add('hidden');
        
        // Clear any existing balloons
        clearBalloons();
        
        // Clear any existing game interval
        if (gameInterval) clearInterval(gameInterval);
        
        // Start game loop - create balloons and update timer
        createBalloon(); // Create first balloon immediately
        
        gameInterval = setInterval(() => {
            // Create a new balloon every second
            createBalloon();
            
            // Update timer
            timeRemaining--;
            timerElement.textContent = `Time: ${timeRemaining}s`;
            
            // Check if game is over
            if (timeRemaining <= 0) {
                endGame();
            }
        }, 1000);
    }

    /**
     * End the game
     */
    function endGame() {
        gameActive = false;
        clearInterval(gameInterval);
        
        // Update UI
        finalScoreElement.textContent = `Final Score: ${score}`;
        gameOverElement.classList.remove('hidden');
        
        // Stop balloon movement (optional)
        balloons.forEach(balloon => {
            gsap.killTweensOf(balloon.position);
        });
    }

    /**
     * Restart the game
     */
    function restartGame() {
        startGame();
    }

    /**
     * Clear all balloons from the scene
     */
    function clearBalloons() {
        balloons.forEach(balloon => {
            scene.remove(balloon);
            gsap.killTweensOf(balloon.position);
        });
        balloons = [];
    }

    /**
     * Main animation loop
     * @param {number} time - Current time in milliseconds
     */
    function animate(time) {
        requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        
        // Update particles
        updateParticles(delta);
        
        // Update balloon rotations for floating effect
        balloons.forEach(balloon => {
            if (balloon.userData.rotationSpeed) {
                balloon.rotation.x += balloon.userData.rotationSpeed * Math.sin(time/1000);
                balloon.rotation.z += balloon.userData.rotationSpeed * Math.cos(time/1000);
            }
        });
        
        // Render the scene
        renderer.render(scene, camera);
    }

    // Create a clock for delta time calculation
    const clock = new THREE.Clock();
    
    // Initialize the game
    init();
    
    // Auto-start game after a short delay
    setTimeout(startGame, 1000);
});
/**
 * Subrunner - A 3D endless runner game in Three.js
 */

// Game state variables
const GAME_STATE = {
    LOADING: 0,
    START: 1,
    PLAYING: 2,
    GAME_OVER: 3
};

/**
 * Main game class that manages the game lifecycle
 */
class SubrunnerGame {
    constructor() {
        // Game dimensions
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Game state
        this.state = GAME_STATE.LOADING;
        this.score = 0;
        this.coins = 0;
        this.speed = 5; // Initial game speed
        this.maxSpeed = 20; // Maximum game speed
        this.speedIncrement = 0.0005; // How quickly the game speeds up
        
        // Track configuration
        this.lanes = 3;
        this.laneWidth = 2.5;
        this.trackLength = 300; // How far ahead to render the track
        
        // Player state
        this.playerLane = 1; // Middle lane (0, 1, 2)
        this.playerState = 'running'; // running, jumping, rolling
        this.jumpHeight = 3;
        this.jumpDuration = 0.6; // seconds
        this.jumpProgress = 0;
        this.rollDuration = 0.5; // seconds
        this.rollProgress = 0;
        
        // World objects
        this.obstacles = [];
        this.collectibles = [];
        this.powerups = [];
        this.activePowerup = null;
        this.powerupDuration = 0;
        this.segments = []; // Track segments
        this.segmentLength = 20;
        
        // Object spawning
        this.nextSpawnDistance = 0;
        this.minSpawnInterval = 10; // Minimum distance between objects
        this.maxSpawnInterval = 20; // Maximum distance between objects
        
        // Initialize Three.js
        this.initThree();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.initUI();
        
        // Start the loading process
        this.loadAssets();
    }
    
    /**
     * Initialize Three.js renderer, scene, camera, and lighting
     */
    initThree() {
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x87CEEB); // Sky blue background
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera (perspective for 3D view)
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 100);
        this.camera.position.set(0, 5, 7); // Position higher and closer
        this.camera.lookAt(0, 0, -15); // Look further down the track
        
        // Add lighting
        this.addLighting();
        
        // Add fog for atmosphere and to hide track generation
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 50);
    }
    
    /**
     * Add lighting to the scene
     */
    addLighting() {
        // Main directional light (sunlight)
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        this.scene.add(directionalLight);
        
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
    }
    
    /**
     * Set up event listeners for user input
     */
    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => this.handleResize());
        
        // Touch/mouse events for controls
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Mouse click for desktop
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        
        // Start button
        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        
        // Restart button
        document.getElementById('restart-button').addEventListener('click', () => this.restartGame());
    }
    
    /**
     * Initialize UI elements
     */
    initUI() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.startScreen = document.getElementById('start-screen');
        this.gameUI = document.getElementById('game-ui');
        this.gameOverScreen = document.getElementById('game-over');
        this.scoreElement = document.getElementById('score');
        this.coinCountElement = document.getElementById('coin-count');
        this.finalScoreElement = document.getElementById('final-score');
        this.finalCoinsElement = document.getElementById('final-coins');
        this.powerupIndicator = document.getElementById('powerup-indicator');
    }
    
    /**
     * Load game assets (models, textures, etc.)
     */
    loadAssets() {
        // Create simple geometry for now (will replace with models later)
        this.createSimpleAssets();
        
        // Simulate loading time
        setTimeout(() => {
            this.state = GAME_STATE.START;
            this.loadingScreen.style.display = 'none';
            this.startScreen.style.display = 'flex';
        }, 1500);
    }
    
    /**
     * Create simple geometric assets for the game
     */
    createSimpleAssets() {
        // Player character (temporarily a colored cube)
        const playerGeometry = new THREE.BoxGeometry(0.8, 1.5, 0.5);
        const playerMaterial = new THREE.MeshLambertMaterial({ color: 0xFF4500 });
        this.player = new THREE.Mesh(playerGeometry, playerMaterial);
        this.player.castShadow = true;
        this.player.position.y = 0.75; // Half height above ground
        this.scene.add(this.player);
        
        // Ground (track base)
        const groundGeometry = new THREE.PlaneGeometry(this.laneWidth * this.lanes + 4, this.trackLength);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        this.ground.position.z = -this.trackLength / 2; // Center the track
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // Create lane dividers
        this.createLaneDividers();
        
        // Create skybox/background
        this.createEnvironment();
    }
    
    /**
     * Create lane dividers for the track
     */
    createLaneDividers() {
        const dividerGeometry = new THREE.BoxGeometry(0.1, 0.1, this.trackLength);
        const dividerMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        
        // Left divider
        const leftDivider = new THREE.Mesh(dividerGeometry, dividerMaterial);
        leftDivider.position.x = -this.laneWidth / 2;
        leftDivider.position.z = -this.trackLength / 2;
        leftDivider.position.y = 0.05;
        this.scene.add(leftDivider);
        
        // Right divider
        const rightDivider = new THREE.Mesh(dividerGeometry, dividerMaterial);
        rightDivider.position.x = this.laneWidth / 2;
        rightDivider.position.z = -this.trackLength / 2;
        rightDivider.position.y = 0.05;
        this.scene.add(rightDivider);
    }
    
    /**
     * Create environment elements (buildings, subway tunnels, etc.)
     */
    createEnvironment() {
        // Create basic city skyline on both sides - moved further away
        this.createCityscape(-15, -40); // Left side further away
        this.createCityscape(15, -40);  // Right side further away
        
        // Add ground effects/texture
        const groundTexture = new THREE.TextureLoader().load('');
        const groundMaterial = this.ground.material;
        groundMaterial.color.set(0x666666); // Darker gray for track
        
        // Add some track details (sleepers/ties)
        this.addTrackDetails();
    }
    
    /**
     * Add track details like sleepers/ties
     */
    addTrackDetails() {
        const tieGeometry = new THREE.BoxGeometry(this.laneWidth * this.lanes + 2, 0.1, 0.5);
        const tieMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        
        // Add several ties down the track
        for (let i = 0; i < 20; i++) {
            const tie = new THREE.Mesh(tieGeometry, tieMaterial);
            tie.position.set(0, 0.01, -i * 10); // Just above ground, spaced out
            this.scene.add(tie);
        }
    }
    
    /**
     * Create simple cityscape for the environment
     * @param {number} xOffset - X position offset for the cityscape
     * @param {number} zOffset - Z position offset for the cityscape
     */
    createCityscape(xOffset, zOffset) {
        const cityColors = [0x555555, 0x666666, 0x777777, 0x888888, 0x999999];
        
        for (let i = 0; i < 20; i++) {
            const height = 1 + Math.random() * 5;
            const width = 1 + Math.random() * 2;
            const depth = 1 + Math.random() * 2;
            
            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const buildingMaterial = new THREE.MeshLambertMaterial({ 
                color: cityColors[Math.floor(Math.random() * cityColors.length)]
            });
            
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.set(
                xOffset + (Math.random() * 8 - 4),
                height / 2,
                zOffset - i * 5
            );
            
            this.scene.add(building);
        }
    }
    
    /**
     * Generate obstacles, coins, and powerups
     */
    generateGameObjects() {
        // Calculate the farthest obstacle
        const farthestZ = this.getFarthestObjectZ();
        
        // If there's no object or the farthest one is closer than our threshold, add a new one
        if (farthestZ > -30) {
            // Generate new objects to ensure constant stream
            const rand = Math.random();
            
            if (rand < 0.6) {
                // 60% chance for coins
                this.addCoin();
            } else if (rand < 0.9) {
                // 30% chance for obstacles
                this.addObstacle();
            } else {
                // 10% chance for powerups
                this.addPowerup();
            }
        }
    }
    
    /**
     * Find the Z position of the farthest object (most negative Z)
     * @returns {number} The farthest Z position
     */
    getFarthestObjectZ() {
        let farthestZ = 0;
        
        // Check all object types
        [...this.obstacles, ...this.collectibles, ...this.powerups].forEach(obj => {
            if (obj.position.z < farthestZ) {
                farthestZ = obj.position.z;
            }
        });
        
        return farthestZ;
    }
    
    /**
     * Add a random obstacle to the game at a specific position
     * @param {number} lane - Lane index (0, 1, 2)
     * @param {number} zPosition - Z position on the track
     */
    addObstacleAt(lane, zPosition) {
        const type = Math.random() < 0.5 ? 'barrier' : 'train';
        
        let obstacle;
        
        if (type === 'barrier') {
            // Barrier (jump over) - make more interesting
            obstacle = new THREE.Group();
            
            // Base
            const baseGeometry = new THREE.BoxGeometry(this.laneWidth * 0.8, 0.2, 0.2);
            const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            
            // Poles
            const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
            const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
            
            const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
            leftPole.position.set(-this.laneWidth * 0.3, 0.5, 0);
            
            const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);
            rightPole.position.set(this.laneWidth * 0.3, 0.5, 0);
            
            // Top bar
            const topGeometry = new THREE.BoxGeometry(this.laneWidth * 0.8, 0.1, 0.1);
            const topMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
            const top = new THREE.Mesh(topGeometry, topMaterial);
            top.position.y = 1;
            
            obstacle.add(base, leftPole, rightPole, top);
            obstacle.type = 'barrier';
            obstacle.avoidAction = 'jump';
        } else {
            // Train (jump over only, since we removed roll)
            obstacle = new THREE.Group();
            
            // Train body
            const bodyGeometry = new THREE.BoxGeometry(this.laneWidth * 0.8, 1.8, 3);
            const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x0066CC });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            
            // Train top
            const topGeometry = new THREE.BoxGeometry(this.laneWidth * 0.6, 0.4, 2.5);
            const topMaterial = new THREE.MeshLambertMaterial({ color: 0x0044AA });
            const top = new THREE.Mesh(topGeometry, topMaterial);
            top.position.y = 1.1;
            
            // Windows
            const windowGeometry = new THREE.PlaneGeometry(0.3, 0.3);
            const windowMaterial = new THREE.MeshLambertMaterial({ color: 0xCCFFFF, side: THREE.DoubleSide });
            
            for (let i = -1; i <= 1; i++) {
                const trainWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                trainWindow.position.set(i * 0.35, 0.5, -1.45);
                trainWindow.rotation.x = Math.PI / 2;
                body.add(trainWindow);
            }
            
            obstacle.add(body, top);
            obstacle.type = 'train';
            obstacle.avoidAction = 'jump';
        }
        
        // Position the obstacle
        obstacle.position.x = (lane - 1) * this.laneWidth;
        obstacle.position.z = zPosition;
        obstacle.position.y = obstacle.type === 'barrier' ? 0.5 : 1;
        obstacle.castShadow = true;
        
        // Add to scene and tracking array
        this.scene.add(obstacle);
        this.obstacles.push(obstacle);
    }
    
    /**
     * Add a random obstacle to the game
     */
    addObstacle() {
        const lane = Math.floor(Math.random() * this.lanes);
        this.addObstacleAt(lane, -this.trackLength);
    }
    
    /**
     * Add a coin to the game at a specific position
     * @param {number} lane - Lane index (0, 1, 2)
     * @param {number} zPosition - Z position on the track
     */
    addCoinAt(lane, zPosition) {
        // Create better looking coin with rim and texture
        const coinGroup = new THREE.Group();
        
        // Main coin face
        const faceGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24);
        const faceMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const face = new THREE.Mesh(faceGeometry, faceMaterial);
        
        // Rim
        const rimGeometry = new THREE.TorusGeometry(0.3, 0.05, 8, 24);
        const rimMaterial = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.x = Math.PI / 2;
        
        // Add dollar sign (simple geometry)
        const symbolGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.02);
        const symbolMaterial = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
        const symbol = new THREE.Mesh(symbolGeometry, symbolMaterial);
        symbol.position.z = 0.03;
        
        coinGroup.add(face, rim, symbol);
        
        // Position the coin
        coinGroup.position.x = (lane - 1) * this.laneWidth;
        coinGroup.position.z = zPosition;
        coinGroup.position.y = 1; // Hover at player mid-height
        coinGroup.rotation.x = Math.PI / 2; // Lay flat
        
        // Add to scene and tracking array
        this.scene.add(coinGroup);
        this.collectibles.push(coinGroup);
    }
    
    /**
     * Add a coin to the game
     */
    addCoin() {
        const lane = Math.floor(Math.random() * this.lanes);
        this.addCoinAt(lane, -this.trackLength);
    }
    
    /**
     * Add a powerup to the game at a specific position
     * @param {number} lane - Lane index (0, 1, 2) 
     * @param {number} zPosition - Z position on the track
     */
    addPowerupAt(lane, zPosition) {
        const types = ['magnet', 'multiplier', 'jetpack', 'sneakers'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let color;
        switch (type) {
            case 'magnet': color = 0xAA00FF; break;
            case 'multiplier': color = 0x00FFFF; break;
            case 'jetpack': color = 0xFF5500; break;
            case 'sneakers': color = 0x00FF00; break;
        }
        
        // Create powerup (simple colored sphere for now)
        const geometry = new THREE.SphereGeometry(0.4, 16, 16);
        const material = new THREE.MeshLambertMaterial({ color: color });
        const powerup = new THREE.Mesh(geometry, material);
        powerup.type = type;
        
        // Position the powerup
        powerup.position.x = (lane - 1) * this.laneWidth;
        powerup.position.z = zPosition;
        powerup.position.y = 1.5; // Hover above player height
        
        // Add to scene and tracking array
        this.scene.add(powerup);
        this.powerups.push(powerup);
    }
    
    /**
     * Add a powerup to the game
     */
    addPowerup() {
        const lane = Math.floor(Math.random() * this.lanes);
        this.addPowerupAt(lane, -this.trackLength);
    }
    
    /**
     * Start the game when player clicks start button
     */
    startGame() {
        this.state = GAME_STATE.PLAYING;
        this.startScreen.style.display = 'none';
        this.gameUI.style.display = 'block';
        
        // Reset game variables
        this.score = 0;
        this.coins = 0;
        this.speed = 5;
        this.playerLane = 1;
        
        // Immediately generate some initial objects
        this.generateInitialObjects();
        
        // Start animation loop
        this.lastTime = performance.now();
        this.animate();
    }
    
    /**
     * Generate initial objects at game start
     */
    generateInitialObjects() {
        // Create a sequence of objects from near to far
        for (let distance = 20; distance <= 200; distance += 10) {
            const randomLane = Math.floor(Math.random() * this.lanes);
            
            // Alternate between obstacles, coins and powerups
            if (distance % 3 === 0) {
                this.addObstacleAt(randomLane, -distance);
            } else if (distance % 3 === 1) {
                this.addCoinAt(randomLane, -distance);
            } else {
                this.addPowerupAt(randomLane, -distance);
            }
        }
    }
    
    /**
     * Restart the game after game over
     */
    restartGame() {
        // Reset game state
        this.gameOverScreen.style.display = 'none';
        
        // Clean up old objects
        this.cleanupObjects();
        
        // Start fresh
        this.startGame();
    }
    
    /**
     * Clean up game objects when restarting
     */
    cleanupObjects() {
        // Remove all obstacles, collectibles, and powerups
        [...this.obstacles, ...this.collectibles, ...this.powerups].forEach(obj => {
            this.scene.remove(obj);
        });
        
        this.obstacles = [];
        this.collectibles = [];
        this.powerups = [];
        this.activePowerup = null;
        this.powerupDuration = 0;
    }
    
    /**
     * Main animation/game loop
     */
    animate() {
        // Only continue if game is active
        if (this.state !== GAME_STATE.PLAYING) return;
        
        // Calculate delta time for smooth animation
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = now;
        
        // Increase speed over time (slower acceleration)
        this.speed = Math.min(this.maxSpeed, this.speed + this.speedIncrement * deltaTime * 1000);
        
        // Update score
        this.score += Math.floor(this.speed * deltaTime * 10);
        this.scoreElement.textContent = this.score;
        this.coinCountElement.textContent = this.coins;
        
        // Generate game objects based on player's position
        this.generateGameObjects(this.player.position.z);
        
        // Update player state
        this.updatePlayer(deltaTime);
        
        // Update all game objects
        this.updateGameObjects(deltaTime);
        
        // Check collisions
        this.checkCollisions();
        
        // Handle active powerups
        this.handlePowerups(deltaTime);
        
        // Update camera to follow player's z position slightly
        this.camera.position.z = 7 + this.player.position.z;
        this.camera.lookAt(this.player.position.x, this.player.position.y, this.player.position.z - 15);
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Continue animation loop
        requestAnimationFrame(() => this.animate());
    }
    
    /**
     * Update player position and state
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updatePlayer(deltaTime) {
        // Update player lane position (horizontal) - smoother transition
        const targetX = (this.playerLane - 1) * this.laneWidth;
        this.player.position.x += (targetX - this.player.position.x) * 15 * deltaTime;
        
        // Handle jumping
        if (this.playerState === 'jumping') {
            this.jumpProgress += deltaTime / this.jumpDuration;
            
            if (this.jumpProgress >= 1) {
                // Jump completed
                this.jumpProgress = 0;
                this.playerState = 'running';
                this.player.position.y = 0.25; // Back to ground
            } else {
                // Parabolic jump arc
                const jumpCurve = Math.sin(this.jumpProgress * Math.PI);
                this.player.position.y = 0.25 + this.jumpHeight * jumpCurve;
                
                // Add some rotation for style
                this.player.rotation.z = Math.sin(this.jumpProgress * Math.PI * 2) * 0.2;
            }
        } else {
            // Reset rotation when not jumping
            this.player.rotation.z += (0 - this.player.rotation.z) * 10 * deltaTime;
            
            // Add running animation
            const runBob = Math.sin(performance.now() * 0.01) * 0.05;
            if (this.playerState === 'running') {
                this.player.position.y = 0.25 + runBob;
            }
        }
    }
    
    /**
     * Update all game objects (obstacles, coins, powerups)
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateGameObjects(deltaTime) {
        const moveAmount = this.speed * deltaTime;
        
        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.position.z += moveAmount;
            
            // Remove if past player
            if (obstacle.position.z > 10) {
                this.scene.remove(obstacle);
                this.obstacles.splice(i, 1);
            }
        }
        
        // Update coins
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const coin = this.collectibles[i];
            coin.position.z += moveAmount;
            coin.rotation.z += 2 * deltaTime; // Spin animation
            
            // Remove if past player
            if (coin.position.z > 10) {
                this.scene.remove(coin);
                this.collectibles.splice(i, 1);
            }
        }
        
        // Update powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            powerup.position.z += moveAmount;
            powerup.rotation.y += 3 * deltaTime; // Spin animation
            
            // Remove if past player
            if (powerup.position.z > 10) {
                this.scene.remove(powerup);
                this.powerups.splice(i, 1);
            }
        }
    }
    
    /**
     * Check for collisions between player and game objects
     */
    checkCollisions() {
        const playerBox = new THREE.Box3().setFromObject(this.player);
        
        // Check obstacle collisions
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            if (playerBox.intersectsBox(obstacleBox)) {
                // Check if player is correctly avoiding the obstacle
                if (obstacle.avoidAction === 'jump' && this.playerState === 'jumping') {
                    // Successfully jumped over
                    continue;
                } else if (obstacle.avoidAction === 'roll' && this.playerState === 'rolling') {
                    // Successfully rolled under
                    continue;
                }
                
                // Collision detected - game over!
                this.gameOver();
                return;
            }
        }
        
        // Check coin collisions
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const coin = this.collectibles[i];
            const coinBox = new THREE.Box3().setFromObject(coin);
            
            if (playerBox.intersectsBox(coinBox)) {
                // Collect coin
                this.collectCoin(coin, i);
            }
        }
        
        // Check powerup collisions
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            const powerupBox = new THREE.Box3().setFromObject(powerup);
            
            if (playerBox.intersectsBox(powerupBox)) {
                // Activate powerup
                this.activatePowerup(powerup, i);
            }
        }
    }
    
    /**
     * Handle coin collection
     * @param {THREE.Mesh} coin - The coin object
     * @param {number} index - Index in the collectibles array
     */
    collectCoin(coin, index) {
        // Remove coin from scene and array
        this.scene.remove(coin);
        this.collectibles.splice(index, 1);
        
        // Add to player's coins
        this.coins += this.activePowerup === 'multiplier' ? 2 : 1;
        
        // Update UI
        this.coinCountElement.textContent = this.coins;
    }
    
    /**
     * Activate a powerup
     * @param {THREE.Mesh} powerup - The powerup object
     * @param {number} index - Index in the powerups array
     */
    activatePowerup(powerup, index) {
        // Remove powerup from scene and array
        this.scene.remove(powerup);
        this.powerups.splice(index, 1);
        
        // Set active powerup
        this.activePowerup = powerup.type;
        this.powerupDuration = 8; // 8 seconds duration
        
        // Show powerup indicator
        this.powerupIndicator.textContent = this.getPowerupName(powerup.type);
        this.powerupIndicator.style.display = 'block';
        
        // Apply special effects based on powerup type
        if (powerup.type === 'jetpack') {
            // Jetpack lifts player higher
            this.jumpHeight = 6;
        } else if (powerup.type === 'sneakers') {
            // Super sneakers for higher jumps
            this.jumpHeight = 4.5;
        }
    }
    
    /**
     * Get friendly name for powerup
     * @param {string} type - Powerup type
     * @returns {string} Friendly name
     */
    getPowerupName(type) {
        switch(type) {
            case 'magnet': return '🧲 Coin Magnet!';
            case 'multiplier': return '2️⃣ Score Multiplier!';
            case 'jetpack': return '🚀 Jetpack!';
            case 'sneakers': return '👟 Super Sneakers!';
            default: return '';
        }
    }
    
    /**
     * Handle active powerups and their durations
     * @param {number} deltaTime - Time since last frame in seconds
     */
    handlePowerups(deltaTime) {
        if (!this.activePowerup) return;
        
        // Decrease duration
        this.powerupDuration -= deltaTime;
        
        if (this.powerupDuration <= 0) {
            // Powerup expired
            this.deactivatePowerup();
        }
        
        // Special powerup effects
        if (this.activePowerup === 'magnet') {
            this.applyMagnetEffect();
        }
    }
    
    /**
     * Deactivate current powerup when time expires
     */
    deactivatePowerup() {
        // Reset any powerup-specific changes
        if (this.activePowerup === 'jetpack' || this.activePowerup === 'sneakers') {
            this.jumpHeight = 3; // Reset to default
        }
        
        // Clear powerup state
        this.activePowerup = null;
        this.powerupIndicator.style.display = 'none';
    }
    
    /**
     * Apply magnet powerup effect to attract coins
     */
    applyMagnetEffect() {
        // Find coins within range
        const magnetRange = 10;
        
        this.collectibles.forEach(coin => {
            if (coin.position.z > 0 && coin.position.z < magnetRange) {
                // Calculate direction to player
                const direction = new THREE.Vector3();
                direction.subVectors(this.player.position, coin.position);
                direction.normalize();
                
                // Move coin toward player
                coin.position.x += direction.x * 0.5;
                coin.position.z += direction.z * 0.2;
            }
        });
    }
    
    /**
     * End the game when player collides with obstacle
     */
    gameOver() {
        this.state = GAME_STATE.GAME_OVER;
        
        // Update UI
        this.finalScoreElement.textContent = this.score;
        this.finalCoinsElement.textContent = this.coins;
        this.gameOverScreen.style.display = 'flex';
    }
    
    /**
     * Handle window resize event
     */
    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(this.width, this.height);
    }
    
    // Touch control variables
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    
    /**
     * Handle touch start event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        if (this.state !== GAME_STATE.PLAYING) return;
        
        event.preventDefault();
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
    }
    
    /**
     * Handle touch move event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        if (this.state !== GAME_STATE.PLAYING) return;
        
        event.preventDefault();
    }
    
    /**
     * Handle touch end event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        if (this.state !== GAME_STATE.PLAYING) return;
        
        event.preventDefault();
        this.touchEndX = event.changedTouches[0].clientX;
        this.touchEndY = event.changedTouches[0].clientY;
        
        // Calculate swipe direction
        const xDiff = this.touchStartX - this.touchEndX;
        const yDiff = this.touchStartY - this.touchEndY;
        
        // Check if it's a tap (minimal movement)
        const isTap = Math.abs(xDiff) < 20 && Math.abs(yDiff) < 20;
        
        if (isTap) {
            // Handle as lane tap (like mouse click)
            const laneWidth = window.innerWidth / 3;
            const tappedLane = Math.floor(this.touchEndX / laneWidth);
            
            if (tappedLane < this.playerLane) {
                this.moveLeft();
            } else if (tappedLane > this.playerLane) {
                this.moveRight();
            } else {
                this.jump();
            }
        } else if (Math.abs(yDiff) > 50 && yDiff > 0) {
            // Clear vertical swipe up - jump
            this.jump();
        } else if (Math.abs(xDiff) > 50) {
            // Horizontal swipe
            if (xDiff > 0) {
                this.moveLeft();
            } else {
                this.moveRight();
            }
        }
        // Removed swipe down/roll functionality
    }
    
    /**
     * Handle mouse down event for desktop
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        if (this.state !== GAME_STATE.PLAYING) return;
        
        // Divide screen into 3 vertical sections for lane selection
        const laneWidth = window.innerWidth / 3;
        const clickedLane = Math.floor(event.clientX / laneWidth);
        
        // Move to clicked lane (can only move one lane at a time)
        if (clickedLane < this.playerLane) {
            this.moveLeft();
        } else if (clickedLane > this.playerLane) {
            this.moveRight();
        } else {
            // Clicked in same lane, so jump
            this.jump();
        }
    }
    
    /**
     * Move player to the left lane
     */
    moveLeft() {
        if (this.playerLane > 0) {
            this.playerLane--;
        }
    }
    
    /**
     * Move player to the right lane
     */
    moveRight() {
        if (this.playerLane < this.lanes - 1) {
            this.playerLane++;
        }
    }
    
    /**
     * Make player jump
     */
    jump() {
        if (this.playerState === 'running') {
            this.playerState = 'jumping';
            this.jumpProgress = 0;
        }
    }
    
    // Rolling functionality removed as requested
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new SubrunnerGame();
});
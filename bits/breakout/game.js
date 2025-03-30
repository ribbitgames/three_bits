// Game Configuration - Edit these constants to modify game balance
const GAME_CONFIG = {
    // Ball settings
    INITIAL_BALL_SPEED: 0.1,          // Initial speed of the ball
    BALL_SPEED_INCREMENT: 0.001,       // Speed increase after each paddle hit
    BALL_SPEED_BRICK_BOOST: 0.02,      // Speed boost when hitting a brick
    MAX_BALL_SPEED: 1,               // Maximum ball speed
    BALL_RADIUS: 0.25,                 // Size of the ball

    // Paddle settings
    INITIAL_PADDLE_WIDTH: 2.0,         // Starting width of the paddle
    MIN_PADDLE_WIDTH: 1.2,             // Minimum paddle width after shrinking
    PADDLE_WIDTH_DECREASE: 0.15,       // How much to shrink paddle each level
    PADDLE_HEIGHT: 0.3,                // Height of the paddle
    PADDLE_SPEED: 0.4,                 // Paddle movement smoothing (higher = faster)

    // Brick settings
    INITIAL_BRICK_ROWS: 4,             // Starting number of brick rows
    MAX_BRICK_ROWS: 6,                 // Maximum number of rows
    BRICK_COLUMNS: 8,                  // Number of bricks per row
    BRICK_PADDING: 0.1,                // Space between bricks
    BRICK_HEIGHT: 0.4,                 // Height of each brick
    BRICK_DEPTH: 0.3,                  // Depth of each brick

    // Game mechanics
    STARTING_LIVES: 3,                 // Number of lives at game start
    POINTS_PER_ROW: 10,                // Base points for destroying a brick (multiplied by row)
    BRICK_MOVEMENT_START_LEVEL: 4,     // Level at which bricks start moving
    BRICK_MOVEMENT_SPEED_FACTOR: 0.004, // How fast bricks move side-to-side

    // Colors
    BALL_COLOR: 0xffffff,
    PADDLE_COLOR: 0x4169e1,
    WALL_COLOR: 0x606060,
    BRICK_COLORS: [
        0xff0000, // Red
        0xff7f00, // Orange
        0xffff00, // Yellow
        0x00ff00, // Green
        0x0000ff, // Blue
        0x4b0082, // Indigo
    ]
};

// Breakout game built with Three.js
class BreakoutGame {
    constructor() {
        // Game state
        this.score = 0;
        this.lives = GAME_CONFIG.STARTING_LIVES;
        this.level = 1;
        this.gameStarted = false;
        this.gameOver = false;
        this.paused = false;

        // DOM elements
        this.initDOMElements();

        // Game settings (initialized from config)
        this.paddleSpeed = GAME_CONFIG.PADDLE_SPEED;
        this.ballSpeed = GAME_CONFIG.INITIAL_BALL_SPEED;
        this.ballSpeedIncrement = GAME_CONFIG.BALL_SPEED_INCREMENT;
        this.blockSpeedBoost = GAME_CONFIG.BALL_SPEED_BRICK_BOOST;
        this.maxBallSpeed = GAME_CONFIG.MAX_BALL_SPEED;
        this.brickRows = GAME_CONFIG.INITIAL_BRICK_ROWS;
        this.brickColumns = GAME_CONFIG.BRICK_COLUMNS;
        this.brickPadding = GAME_CONFIG.BRICK_PADDING;
        this.brickColorsByRow = GAME_CONFIG.BRICK_COLORS;

        // Setup
        this.setupThree();
        this.setupLights();
        this.setupEventListeners();
        this.createObjects();
        this.animate = this.animate.bind(this);
    }

    initDOMElements() {
        this.scoreElement = document.getElementById('score');
        this.livesElement = document.getElementById('lives');
        this.levelElement = document.getElementById('level');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.levelCompleteScreen = document.getElementById('level-complete-screen');
        this.finalScoreElement = document.getElementById('final-score');
        this.levelScoreElement = document.getElementById('level-score');
        this.levelNumberElement = document.getElementById('level-number');
        this.startButton = document.getElementById('start-button');
        this.restartButton = document.getElementById('restart-button');
        this.nextLevelButton = document.getElementById('next-level-button');
    }

    setupThree() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Create camera
        this.setupCamera();

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.isPortrait = aspect < 1;

        if (this.isPortrait) {
            // Portrait mode (mobile)
            this.sceneWidth = 10;
            this.sceneHeight = this.sceneWidth / aspect;
        } else {
            // Landscape mode (desktop)
            this.sceneHeight = 10;
            this.sceneWidth = this.sceneHeight * aspect;
        }

        this.camera = new THREE.OrthographicCamera(
            -this.sceneWidth / 2, this.sceneWidth / 2,
            this.sceneHeight / 2, -this.sceneHeight / 2,
            0.1, 1000
        );
        this.camera.position.z = 10;
    }

    handleResize() {
        const newAspect = window.innerWidth / window.innerHeight;
        this.isPortrait = newAspect < 1;

        if (this.isPortrait) {
            this.sceneWidth = 10;
            this.sceneHeight = this.sceneWidth / newAspect;
        } else {
            this.sceneHeight = 10;
            this.sceneWidth = this.sceneHeight * newAspect;
        }

        this.camera.left = -this.sceneWidth / 2;
        this.camera.right = this.sceneWidth / 2;
        this.camera.top = this.sceneHeight / 2;
        this.camera.bottom = -this.sceneHeight / 2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update wall positions
        this.updateWalls();

        // Reset paddle position
        if (this.paddle) {
            this.paddle.position.x = 0;
        }
    }

    setupLights() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 10);
        this.scene.add(directionalLight);

        // Add point lights for more dramatic effect
        const pointLight1 = new THREE.PointLight(0x00ffff, 0.5);
        pointLight1.position.set(-this.sceneWidth / 2, this.sceneHeight / 2, 5);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, 0.5);
        pointLight2.position.set(this.sceneWidth / 2, this.sceneHeight / 2, 5);
        this.scene.add(pointLight2);
    }

    setupEventListeners() {
        // Mouse/touch movement for paddle control
        this.mousePosition = new THREE.Vector2();

        document.addEventListener('mousemove', (event) => {
            if (!this.gameStarted || this.gameOver || this.paused) return;
            this.updateMousePosition(event.clientX);
        });

        document.addEventListener('touchmove', (event) => {
            if (!this.gameStarted || this.gameOver || this.paused) return;
            event.preventDefault();
            this.updateMousePosition(event.touches[0].clientX);
        }, { passive: false });

        // Start and restart buttons
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
        this.nextLevelButton.addEventListener('click', () => this.startNextLevel());

        // Pause game on visibility change
        document.addEventListener('visibilitychange', () => {
            this.paused = document.hidden;
        });
    }

    updateMousePosition(clientX) {
        const normalizedX = (clientX / window.innerWidth) * 2 - 1;
        const paddleX = normalizedX * (this.sceneWidth / 2 - this.paddleWidth / 2);

        // Apply smooth movement
        if (this.paddle) {
            this.paddleTargetX = THREE.MathUtils.clamp(
                paddleX,
                -this.sceneWidth / 2 + this.paddleWidth / 2 + this.wallThickness,
                this.sceneWidth / 2 - this.paddleWidth / 2 - this.wallThickness
            );
        }
    }

    createObjects() {
        this.createPaddle();
        this.createBall();
        this.createWalls();
        this.createBricks();
    }

    createPaddle() {
        this.paddleWidth = GAME_CONFIG.INITIAL_PADDLE_WIDTH;
        this.paddleHeight = GAME_CONFIG.PADDLE_HEIGHT;
        const paddleGeometry = new THREE.BoxGeometry(this.paddleWidth, this.paddleHeight, 0.5);
        const paddleMaterial = new THREE.MeshPhongMaterial({
            color: GAME_CONFIG.PADDLE_COLOR,
            specular: 0x111111,
            shininess: 50
        });
        this.paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
        this.paddle.position.y = -this.sceneHeight / 2 + 1;
        this.paddle.position.z = 0;
        this.paddleTargetX = 0;
        this.scene.add(this.paddle);
    }

    createBall() {
        this.ballRadius = GAME_CONFIG.BALL_RADIUS;
        const ballGeometry = new THREE.SphereGeometry(this.ballRadius, 32, 32);
        const ballMaterial = new THREE.MeshPhongMaterial({
            color: GAME_CONFIG.BALL_COLOR,
            specular: 0xffffff,
            shininess: 100
        });
        this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
        this.resetBall();
        this.scene.add(this.ball);
    }

    createWalls() {
        this.wallThickness = 0.3;
        const wallMaterial = new THREE.MeshPhongMaterial({
            color: GAME_CONFIG.WALL_COLOR,
            specular: 0x111111,
            shininess: 10
        });

        // Left wall
        const leftWallGeometry = new THREE.BoxGeometry(this.wallThickness, this.sceneHeight, 1);
        this.leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
        this.leftWall.position.x = -this.sceneWidth / 2 - this.wallThickness / 2;
        this.scene.add(this.leftWall);

        // Right wall
        const rightWallGeometry = new THREE.BoxGeometry(this.wallThickness, this.sceneHeight, 1);
        this.rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
        this.rightWall.position.x = this.sceneWidth / 2 + this.wallThickness / 2;
        this.scene.add(this.rightWall);

        // Top wall
        const topWallGeometry = new THREE.BoxGeometry(this.sceneWidth + this.wallThickness * 2, this.wallThickness, 1);
        this.topWall = new THREE.Mesh(topWallGeometry, wallMaterial);
        this.topWall.position.y = this.sceneHeight / 2 + this.wallThickness / 2;
        this.scene.add(this.topWall);
    }

    updateWalls() {
        // Update wall positions on window resize
        if (this.leftWall) {
            this.leftWall.position.x = -this.sceneWidth / 2 - this.wallThickness / 2;
            this.leftWall.geometry = new THREE.BoxGeometry(this.wallThickness, this.sceneHeight, 1);
        }

        if (this.rightWall) {
            this.rightWall.position.x = this.sceneWidth / 2 + this.wallThickness / 2;
            this.rightWall.geometry = new THREE.BoxGeometry(this.wallThickness, this.sceneHeight, 1);
        }

        if (this.topWall) {
            this.topWall.geometry = new THREE.BoxGeometry(this.sceneWidth + this.wallThickness * 2, this.wallThickness, 1);
            this.topWall.position.y = this.sceneHeight / 2 + this.wallThickness / 2;
        }
    }

    createBricks() {
        this.bricks = [];

        // Calculate brick dimensions based on screen size
        this.brickWidth = (this.sceneWidth - (this.brickColumns + 1) * this.brickPadding) / this.brickColumns;
        this.brickHeight = GAME_CONFIG.BRICK_HEIGHT;
        this.brickDepth = GAME_CONFIG.BRICK_DEPTH;

        const startX = -this.sceneWidth / 2 + this.brickPadding + this.brickWidth / 2;
        const startY = this.sceneHeight / 2 - this.sceneHeight / 5;

        for (let row = 0; row < this.brickRows; row++) {
            for (let col = 0; col < this.brickColumns; col++) {
                const brickGeometry = new THREE.BoxGeometry(this.brickWidth, this.brickHeight, this.brickDepth);
                // Use modulo to ensure we don't go out of bounds if we have more rows than colors
                const colorIndex = row % this.brickColorsByRow.length;
                const brickMaterial = new THREE.MeshPhongMaterial({
                    color: this.brickColorsByRow[colorIndex],
                    specular: 0xffffff,
                    shininess: 30
                });

                const brick = new THREE.Mesh(brickGeometry, brickMaterial);
                brick.position.x = startX + col * (this.brickWidth + this.brickPadding);
                brick.position.y = startY - row * (this.brickHeight + this.brickPadding);
                brick.position.z = 0;

                // Add to scene
                this.scene.add(brick);

                // Keep track of the brick
                this.bricks.push({
                    mesh: brick,
                    row: row,
                    col: col,
                    active: true
                });
            }
        }
    }

    clearBricks() {
        // Remove all existing bricks from the scene
        for (const brick of this.bricks) {
            this.scene.remove(brick.mesh);
        }
        this.bricks = [];
    }

    resetBall() {
        // Position ball above paddle
        this.ball.position.x = 0;
        this.ball.position.y = -this.sceneHeight / 2 + 1.5;
        this.ball.position.z = 0;

        // Reset ball speed to default
        this.ballSpeed = GAME_CONFIG.INITIAL_BALL_SPEED;

        // Set initial velocity - more predictable angle
        const angle = Math.PI / 4 + (Math.random() * 0.1); // About 45 degrees with slight variation
        this.ballVelocity = new THREE.Vector2(
            Math.cos(angle) * this.ballSpeed * (Math.random() < 0.5 ? 1 : -1),
            Math.sin(angle) * this.ballSpeed
        );
    }

    startGame() {
        this.startScreen.classList.add('hidden');
        this.gameStarted = true;
        this.gameOver = false;
        this.paused = false;
        this.resetGameState();
        requestAnimationFrame(this.animate);
    }

    resetGameState() {
        this.score = 0;
        this.lives = GAME_CONFIG.STARTING_LIVES;
        this.level = 1;

        // Reset to initial difficulty
        this.paddleWidth = GAME_CONFIG.INITIAL_PADDLE_WIDTH;
        if (this.paddle) {
            this.paddle.scale.x = 1;
        }
        this.ballSpeed = GAME_CONFIG.INITIAL_BALL_SPEED;
        this.brickRows = GAME_CONFIG.INITIAL_BRICK_ROWS;
        this.brickMovementSpeed = 0;

        this.updateUI();
        this.resetBall();
        this.clearBricks();
        this.createBricks();
    }

    restartGame() {
        this.gameOverScreen.classList.add('hidden');
        this.gameOver = false;
        this.gameStarted = true;
        this.paused = false;
        this.resetGameState();
        requestAnimationFrame(this.animate);
    }

    updateUI() {
        this.scoreElement.textContent = `Score: ${this.score}`;
        this.livesElement.textContent = `Lives: ${this.lives}`;
        this.levelElement.textContent = `Level: ${this.level}`;
        this.finalScoreElement.textContent = `Final Score: ${this.score}`;
        this.levelScoreElement.textContent = `Score: ${this.score}`;
        this.levelNumberElement.textContent = `Level ${this.level} Completed!`;
    }

    checkCollisions() {
        this.checkPaddleCollision();
        this.checkWallCollisions();
        this.checkBottomCollision();
        this.checkBrickCollisions();
    }

    checkPaddleCollision() {
        // Ball-paddle collision
        if (this.ball.position.y - this.ballRadius <= this.paddle.position.y + this.paddleHeight / 2 &&
            this.ball.position.y + this.ballRadius >= this.paddle.position.y - this.paddleHeight / 2 &&
            this.ball.position.x + this.ballRadius >= this.paddle.position.x - this.paddleWidth / 2 &&
            this.ball.position.x - this.ballRadius <= this.paddle.position.x + this.paddleWidth / 2 &&
            this.ballVelocity.y < 0) {

            // Calculate reflection angle based on where the ball hit the paddle
            const hitPosition = (this.ball.position.x - this.paddle.position.x) / (this.paddleWidth / 2);
            const maxBounceAngle = Math.PI / 3; // 60 degrees
            const bounceAngle = hitPosition * maxBounceAngle;

            // Calculate new velocity - FIXED: removed ball speed increment
            // Use current ball speed without increasing it
            this.ballVelocity.x = Math.sin(bounceAngle) * this.ballSpeed;
            this.ballVelocity.y = Math.cos(bounceAngle) * this.ballSpeed;
        }
    }

    checkWallCollisions() {
        // Ball-wall collisions
        if (this.ball.position.x - this.ballRadius <= -this.sceneWidth / 2 + this.wallThickness) {
            // Left wall collision
            this.ball.position.x = -this.sceneWidth / 2 + this.ballRadius + this.wallThickness;
            this.ballVelocity.x = Math.abs(this.ballVelocity.x);
        } else if (this.ball.position.x + this.ballRadius >= this.sceneWidth / 2 - this.wallThickness) {
            // Right wall collision
            this.ball.position.x = this.sceneWidth / 2 - this.ballRadius - this.wallThickness;
            this.ballVelocity.x = -Math.abs(this.ballVelocity.x);
        }

        if (this.ball.position.y + this.ballRadius >= this.sceneHeight / 2 - this.wallThickness) {
            // Top wall collision
            this.ball.position.y = this.sceneHeight / 2 - this.ballRadius - this.wallThickness;
            this.ballVelocity.y = -Math.abs(this.ballVelocity.y);
        }
    }

    checkBottomCollision() {
        // Ball-bottom screen collision (lose life)
        if (this.ball.position.y - this.ballRadius < -this.sceneHeight / 2) {
            this.lives--;
            this.updateUI();

            if (this.lives <= 0) {
                this.gameOver = true;
                this.gameOverScreen.classList.remove('hidden');
            } else {
                // Explicitly reset the ball speed before calling resetBall
                this.ballSpeed = GAME_CONFIG.INITIAL_BALL_SPEED;
                this.resetBall();
            }
        }
    }

    // Replace the current checkBrickCollisions() method with this improved version

    checkBrickCollisions() {
        // Ball-brick collision detection using ray casting for more accurate collision detection
        const ballPosition = this.ball.position.clone();
        const ballDirection = this.ballVelocity.clone().normalize();

        // Create a ray from the ball's position in the direction of its movement
        const raycaster = new THREE.Raycaster(
            ballPosition,
            ballDirection,
            0,  // Near
            this.ballRadius + this.ballVelocity.length() // Distance = ball radius + velocity magnitude
        );

        // Get all potential brick intersections
        const brickMeshes = this.bricks
            .filter(brick => brick.active)
            .map(brick => brick.mesh);

        if (brickMeshes.length === 0) return;

        const intersects = raycaster.intersectObjects(brickMeshes);

        if (intersects.length > 0) {
            // Find the corresponding brick data
            const hitBrickMesh = intersects[0].object;
            const hitBrick = this.bricks.find(brick => brick.mesh === hitBrickMesh);

            if (hitBrick && hitBrick.active) {
                // Deactivate the brick
                hitBrick.active = false;
                hitBrick.mesh.visible = false;

                // Update score - bricks in higher rows are worth more points
                this.score += (this.brickRows - hitBrick.row) * GAME_CONFIG.POINTS_PER_ROW;
                this.updateUI();

                // Determine collision normal from the intersection face
                const normal = intersects[0].face.normal.clone();
                // Transform the normal from local brick space to world space
                normal.transformDirection(hitBrickMesh.matrixWorld);

                // Reflect the ball velocity based on the collision normal
                // This is more physically accurate than the previous method
                // Convert THREE.Vector3 normal to THREE.Vector2 for our 2D physics
                const normal2D = new THREE.Vector2(normal.x, normal.y);
                const dot = this.ballVelocity.dot(normal2D);
                this.ballVelocity.x -= 2 * dot * normal2D.x;
                this.ballVelocity.y -= 2 * dot * normal2D.y;

                // Increase ball speed slightly when hitting a brick
                this.ballSpeed = Math.min(this.ballSpeed + this.blockSpeedBoost, GAME_CONFIG.MAX_BALL_SPEED);

                // Normalize velocity vector then scale to current ball speed
                const velocityMagnitude = this.ballVelocity.length();
                if (velocityMagnitude > 0) {
                    this.ballVelocity.divideScalar(velocityMagnitude).multiplyScalar(this.ballSpeed);
                }

                // Move ball slightly away from collision point to prevent getting stuck
                const pushDistance = this.ballRadius * 1.1;
                this.ball.position.add(normal.multiplyScalar(pushDistance));

                // Check if all bricks are destroyed
                const remainingBricks = this.bricks.filter(b => b.active).length;
                if (remainingBricks === 0) {
                    this.showLevelComplete();
                }
            }
        } else {
            // Fallback to sphere-box collision for cases where ray might miss
            this.sphereBoxCollisionCheck();
        }
    }

    // Add this new method for the fallback collision detection
    sphereBoxCollisionCheck() {
        const ballSphere = new THREE.Sphere(this.ball.position.clone(), this.ballRadius);

        // Check active bricks only
        for (const brick of this.bricks) {
            if (!brick.active) continue;

            const brickMesh = brick.mesh;
            const brickBox = new THREE.Box3().setFromObject(brickMesh);

            if (brickBox.intersectsSphere(ballSphere)) {
                // Determine which face of the brick was hit
                const brickCenter = brickMesh.position.clone();
                const ballCenter = this.ball.position.clone();
                const direction = new THREE.Vector3().subVectors(ballCenter, brickCenter);

                // Get box half-extents
                const halfWidth = this.brickWidth / 2;
                const halfHeight = this.brickHeight / 2;
                const halfDepth = this.brickDepth / 2;

                // Determine the collision normal
                let normal = new THREE.Vector3();

                // Find the axis with the minimum penetration
                const absX = Math.abs(direction.x);
                const absY = Math.abs(direction.y);
                const penetrationX = halfWidth + this.ballRadius - absX;
                const penetrationY = halfHeight + this.ballRadius - absY;

                if (penetrationX < penetrationY) {
                    // X-axis collision
                    normal.set(Math.sign(direction.x), 0, 0);
                } else {
                    // Y-axis collision
                    normal.set(0, Math.sign(direction.y), 0);
                }

                // Reflect the ball velocity (manually for Vector2)
                const dot = this.ballVelocity.dot(new THREE.Vector2(normal.x, normal.y));
                this.ballVelocity.x -= 2 * dot * normal.x;
                this.ballVelocity.y -= 2 * dot * normal.y;

                // Push the ball out of the brick to prevent sticking
                const pushDistance = this.ballRadius * 1.1;
                this.ball.position.add(normal.multiplyScalar(pushDistance));

                // Deactivate the brick
                brick.active = false;
                brick.mesh.visible = false;

                // Update score
                this.score += (this.brickRows - brick.row) * GAME_CONFIG.POINTS_PER_ROW;
                this.updateUI();

                // Increase ball speed
                this.ballSpeed = Math.min(this.ballSpeed + this.blockSpeedBoost, GAME_CONFIG.MAX_BALL_SPEED);

                // Normalize and scale velocity
                const velocityMagnitude = this.ballVelocity.length();
                if (velocityMagnitude > 0) {
                    this.ballVelocity.divideScalar(velocityMagnitude).multiplyScalar(this.ballSpeed);
                }

                // Check for level completion
                const remainingBricks = this.bricks.filter(b => b.active).length;
                if (remainingBricks === 0) {
                    this.showLevelComplete();
                }

                // Only handle one collision per frame
                return;
            }
        }
    }

    showLevelComplete() {
        this.paused = true;
        this.levelCompleteScreen.classList.remove('hidden');
        this.updateUI();
    }

    startNextLevel() {
        this.level++;
        this.levelCompleteScreen.classList.add('hidden');
        this.updateUI();
        this.resetBall();
        this.clearBricks();
        this.increaseDifficulty();
        this.createBricks();
        this.paused = false;
    }

    increaseDifficulty() {
        // Increase base ball speed (but still keep it manageable)
        this.ballSpeed = Math.min(this.ballSpeed + 0.03, this.maxBallSpeed * 0.8);

        // Adjust difficulty based on level
        if (this.level > 1) {
            // Decrease paddle size after level 1 (but not too aggressively)
            this.paddleWidth = Math.max(
                GAME_CONFIG.INITIAL_PADDLE_WIDTH - (this.level - 1) * GAME_CONFIG.PADDLE_WIDTH_DECREASE,
                GAME_CONFIG.MIN_PADDLE_WIDTH
            );
            this.paddle.scale.x = this.paddleWidth / GAME_CONFIG.INITIAL_PADDLE_WIDTH;

            // Modify brick layout
            if (this.level % 3 === 0) {
                // Every third level, add an extra row of bricks
                this.brickRows = Math.min(this.brickRows + 1, GAME_CONFIG.MAX_BRICK_ROWS);
            }

            // Increase brick movement speed (for advanced levels)
            if (this.level > GAME_CONFIG.BRICK_MOVEMENT_START_LEVEL) {
                // Add side-to-side movement to bricks for higher levels
                this.brickMovementSpeed = (this.level - GAME_CONFIG.BRICK_MOVEMENT_START_LEVEL) * GAME_CONFIG.BRICK_MOVEMENT_SPEED_FACTOR;
            }
        }
    }

    animate(time) {
        if (this.gameOver) return;
        if (!this.gameStarted) {
            requestAnimationFrame(this.animate);
            return;
        }

        if (!this.paused) {
            // Calculate delta time for smoother animation
            const now = Date.now();
            const deltaTime = now - (this.lastTime || now);
            this.lastTime = now;

            // Limit maximum delta time to prevent huge jumps after tab switching
            const limitedDelta = Math.min(deltaTime, 50);

            // Calculate a time factor to ensure consistent speed regardless of frame rate
            const timeFactor = limitedDelta / 16.667; // 16.667ms is roughly 60fps

            // Update paddle position with smooth movement
            if (this.paddle && this.paddleTargetX !== undefined) {
                const currentX = this.paddle.position.x;
                const dx = this.paddleTargetX - currentX;
                this.paddle.position.x += dx * this.paddleSpeed * timeFactor;
            }

            // Use adaptive substeps based on ball speed
            const steps = Math.max(5, Math.ceil(this.ballSpeed / 0.02) * 5);

            // Store original position to calculate actual movement vector
            const originalPosition = this.ball.position.clone();

            for (let i = 0; i < steps; i++) {
                // Update ball position in small increments
                this.ball.position.x += (this.ballVelocity.x * timeFactor) / steps;
                this.ball.position.y += (this.ballVelocity.y * timeFactor) / steps;

                // Check for collisions after each small movement
                this.checkCollisions();
            }

            // Update brick positions (for higher levels with moving bricks)
            if (this.level > GAME_CONFIG.BRICK_MOVEMENT_START_LEVEL && this.brickMovementSpeed) {
                const time = now * 0.001;
                for (const brick of this.bricks) {
                    if (brick.active) {
                        // Add a gentle side-to-side movement
                        const originalX = brick.originalX || brick.mesh.position.x;
                        if (!brick.originalX) {
                            brick.originalX = originalX;
                        }

                        brick.mesh.position.x = originalX + Math.sin(time + brick.col * 0.3) * this.brickMovementSpeed * 2;
                    }
                }
            }
        }

        // Render the scene
        this.renderer.render(this.scene, this.camera);

        // Request next frame
        requestAnimationFrame(this.animate);
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const game = new BreakoutGame();
});
class FlappyBird {
    constructor() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // UI elements
        this.startScreen = document.getElementById('startScreen');
        this.startButton = document.getElementById('startButton');
        this.scoreElement = document.getElementById('scoreValue');

        // Game variables
        this.bird = {
            position: new THREE.Vector3(-5, 0, 0),
            velocity: 0,
            gravity: -0.003,
            jump: 0.2,
            rotation: 0
        };

        this.pipes = [];
        this.pipeWidth = 2;
        this.pipeGap = 5;
        this.pipeSpeed = 0.015;
        this.score = 0;
        this.gameStarted = false;
        this.gameOver = false;

        // Create bird
        const birdGeometry = new THREE.BoxGeometry(1, 1, 1);
        const birdMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.birdMesh = new THREE.Mesh(birdGeometry, birdMaterial);
        this.birdMesh.position.copy(this.bird.position);
        this.scene.add(this.birdMesh);

        // Create poop texture
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        // Draw poop emoji
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💩', 32, 32);
        
        this.poopTexture = new THREE.CanvasTexture(canvas);
        this.poopTexture.needsUpdate = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 10, 10);
        this.scene.add(directionalLight);

        // Camera position
        this.camera.position.set(0, 0, 15);
        this.camera.lookAt(0, 0, 0);

        // Event listeners
        this.startButton.addEventListener('click', () => this.startGame());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (!this.gameStarted) {
                    this.startGame();
                } else if (this.gameOver) {
                    this.startGame();
                } else {
                    this.bird.velocity = this.bird.jump;
                }
            }
        });

        // Start game loop
        this.gameLoop();
    }

    createPipe() {
        const gapY = (Math.random() - 0.5) * 8;
        const pipeGeometry = new THREE.BoxGeometry(this.pipeWidth, 20, 1);
        const pipeMaterial = new THREE.MeshPhongMaterial({ 
            map: this.poopTexture,
            transparent: true,
            opacity: 0.9
        });

        // Upper pipe
        const upperPipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
        upperPipe.position.set(10, gapY + this.pipeGap/2 + 8, 0);
        upperPipe.scale.y = 0.5;

        // Lower pipe
        const lowerPipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
        lowerPipe.position.set(10, gapY - this.pipeGap/2 - 8, 0);
        lowerPipe.scale.y = 0.5;

        this.scene.add(upperPipe);
        this.scene.add(lowerPipe);

        this.pipes.push({
            upper: upperPipe,
            lower: lowerPipe,
            gapY: gapY,
            passed: false
        });
    }

    startGame() {
        this.gameStarted = true;
        this.gameOver = false;
        this.startScreen.style.display = 'none';
        this.score = 0;
        this.scoreElement.textContent = this.score;
        this.bird.position.y = 0;
        this.bird.velocity = 0;
        
        // Remove existing pipes
        this.pipes.forEach(pipe => {
            this.scene.remove(pipe.upper);
            this.scene.remove(pipe.lower);
        });
        this.pipes = [];
        
        this.createPipe();
    }

    update() {
        if (!this.gameStarted || this.gameOver) return;

        // Update bird
        this.bird.velocity += this.bird.gravity;
        this.bird.position.y += this.bird.velocity;
        this.birdMesh.position.copy(this.bird.position);
        this.birdMesh.rotation.z = -this.bird.velocity * 0.5;

        // Check collisions with ground and ceiling
        if (this.bird.position.y > 8 || this.bird.position.y < -8) {
            this.gameOver = true;
        }

        // Update pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.upper.position.x -= this.pipeSpeed;
            pipe.lower.position.x -= this.pipeSpeed;

            // Check collisions
            if (this.bird.position.x + 0.5 > pipe.upper.position.x - this.pipeWidth/2 &&
                this.bird.position.x - 0.5 < pipe.upper.position.x + this.pipeWidth/2) {
                if (this.bird.position.y + 0.5 > pipe.gapY - this.pipeGap/2 &&
                    this.bird.position.y - 0.5 < pipe.gapY + this.pipeGap/2) {
                    // Passed through
                    if (!pipe.passed) {
                        pipe.passed = true;
                        this.score++;
                        this.scoreElement.textContent = this.score;
                    }
                } else {
                    this.gameOver = true;
                }
            }

            // Remove pipes that are off screen
            if (pipe.upper.position.x < -15) {
                this.scene.remove(pipe.upper);
                this.scene.remove(pipe.lower);
                this.pipes.splice(i, 1);
            }
        }

        // Add new pipes
        if (this.pipes.length === 0 || 
            this.pipes[this.pipes.length - 1].upper.position.x < 5) {
            this.createPipe();
        }
    }

    gameLoop() {
        this.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game
window.onload = () => {
    new FlappyBird();
}; 
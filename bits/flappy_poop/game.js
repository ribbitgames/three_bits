class FlappyBird {
    constructor() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Load background image
        const textureLoader = new THREE.TextureLoader();
        const backgroundTexture = textureLoader.load('assets/licorne_toilette.webp');
        const backgroundGeometry = new THREE.PlaneGeometry(40, 30);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ 
            map: backgroundTexture,
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.position.z = -10;
        this.scene.add(background);

        // UI elements
        this.startScreen = document.getElementById('startScreen');
        this.startButton = document.getElementById('startButton');
        this.scoreElement = document.getElementById('scoreValue');

        // Game variables
        this.bird = {
            position: new THREE.Vector3(-5, 0, 0),
            velocity: 0,
            gravity: -0.001,
            jump: 0.1,
            rotation: 0
        };

        this.pipes = [];
        this.pipeWidth = 2;
        this.pipeGap = 5;
        this.pipeSpeed = 0.015;
        this.score = 0;
        this.gameStarted = false;
        this.gameOver = false;

        // Create bird texture (toilet emoji)
        const birdCanvas = document.createElement('canvas');
        const birdCtx = birdCanvas.getContext('2d');
        birdCanvas.width = 64;
        birdCanvas.height = 64;
        birdCtx.font = '48px Arial';
        birdCtx.textAlign = 'center';
        birdCtx.textBaseline = 'middle';
        birdCtx.fillText('🧘', 32, 32);
        
        const birdTexture = new THREE.CanvasTexture(birdCanvas);
        birdTexture.needsUpdate = true;

        // Create bird
        const birdGeometry = new THREE.PlaneGeometry(2, 2);
        const birdMaterial = new THREE.MeshBasicMaterial({ 
            map: birdTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        this.birdMesh = new THREE.Mesh(birdGeometry, birdMaterial);
        this.birdMesh.position.copy(this.bird.position);
        this.scene.add(this.birdMesh);

        // Create poop texture for pipes (with green background)
        const pipePoopCanvas = document.createElement('canvas');
        const pipePoopCtx = pipePoopCanvas.getContext('2d');
        pipePoopCanvas.width = 64;
        pipePoopCanvas.height = 64;
        
        // Draw green background
        pipePoopCtx.fillStyle = '#2ecc71';
        pipePoopCtx.fillRect(0, 0, 64, 64);
        
        // Draw poop emoji
        pipePoopCtx.font = '48px Arial';
        pipePoopCtx.textAlign = 'center';
        pipePoopCtx.textBaseline = 'middle';
        pipePoopCtx.fillText('💩', 32, 32);
        
        this.pipePoopTexture = new THREE.CanvasTexture(pipePoopCanvas);
        this.pipePoopTexture.needsUpdate = true;

        // Create poop texture for falling poops (transparent)
        const fallingPoopCanvas = document.createElement('canvas');
        const fallingPoopCtx = fallingPoopCanvas.getContext('2d');
        fallingPoopCanvas.width = 64;
        fallingPoopCanvas.height = 64;
        
        // Draw poop emoji on transparent background
        fallingPoopCtx.font = '48px Arial';
        fallingPoopCtx.textAlign = 'center';
        fallingPoopCtx.textBaseline = 'middle';
        fallingPoopCtx.fillText('💩', 32, 32);
        
        this.fallingPoopTexture = new THREE.CanvasTexture(fallingPoopCanvas);
        this.fallingPoopTexture.needsUpdate = true;

        // Create fart particles
        const particleCount = 40;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x8B4513,
            size: 0.2,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.particlePositions = positions;
        this.particleVelocities = velocities;
        this.particleGeometry = particleGeometry;
        this.particleCount = particleCount;
        this.particles.visible = false;
        this.scene.add(this.particles);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 10, 10);
        this.scene.add(directionalLight);

        // Camera position
        this.camera.position.set(0, 0, 15);
        this.camera.lookAt(0, 0, 0);

        // Create fart sound
        this.fartSound = new Audio('assets/fart.mp3');
        this.fartSound.volume = 0.3; // Réduit le volume à 30%

        // Event listeners
        this.startButton.addEventListener('click', () => this.startGame());
        
        // Keyboard controls
        let spacePressed = false;
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !spacePressed) {
                spacePressed = true;
                this.handleJump();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spacePressed = false;
            }
        });

        // Mouse controls
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click only
                this.handleJump();
            }
        });

        // Create falling poop emojis array
        this.fallingPoops = [];
        this.poopGeometry = new THREE.PlaneGeometry(2, 2);
        this.poopMaterial = new THREE.MeshBasicMaterial({ 
            map: this.fallingPoopTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Start game loop
        this.gameLoop();
    }

    handleJump() {
        if (!this.gameStarted) {
            this.startGame();
        } else if (this.gameOver) {
            this.startGame();
        } else {
            this.bird.velocity = this.bird.jump;
            this.createFartExplosion();
            // Play fart sound
            this.fartSound.currentTime = 0; // Reset le son pour pouvoir le rejouer immédiatement
            this.fartSound.play().catch(error => console.log("Son non joué:", error));
        }
    }

    createFartExplosion() {
        this.particles.visible = true;
        const centerX = this.bird.position.x;
        const centerY = this.bird.position.y;

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            this.particlePositions[i3] = centerX;
            this.particlePositions[i3 + 1] = centerY;
            this.particlePositions[i3 + 2] = 0;

            const angle = Math.random() * Math.PI * 2;
            const speed = 0.2 + Math.random() * 0.3;
            this.particleVelocities[i3] = Math.cos(angle) * speed;
            this.particleVelocities[i3 + 1] = Math.sin(angle) * speed;
            this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5;
        }

        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
        this.particleGeometry.attributes.position.needsUpdate = true;

        // Create falling poop
        const poop = new THREE.Mesh(this.poopGeometry, this.poopMaterial);
        poop.position.set(centerX, centerY, 0);
        poop.rotation.z = Math.random() * Math.PI * 2;
        this.scene.add(poop);
        this.fallingPoops.push({
            mesh: poop,
            velocity: new THREE.Vector3(0, -0.15, 0),
            rotation: (Math.random() - 0.5) * 0.1
        });

        setTimeout(() => {
            this.particles.visible = false;
        }, 1500);
    }

    createPipe() {
        const gapY = (Math.random() - 0.5) * 8;
        const pipeGeometry = new THREE.BoxGeometry(this.pipeWidth, 20, 1);
        const pipeMaterial = new THREE.MeshPhongMaterial({ 
            map: this.pipePoopTexture,
            transparent: false,
            color: 0x2ecc71
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

        // Update falling poops
        for (let i = this.fallingPoops.length - 1; i >= 0; i--) {
            const poop = this.fallingPoops[i];
            poop.mesh.position.add(poop.velocity);
            poop.mesh.rotation.z += poop.rotation;

            // Remove poops that are off screen
            if (poop.mesh.position.y < -15) {
                this.scene.remove(poop.mesh);
                this.fallingPoops.splice(i, 1);
            }
        }

        // Update particles with fade out effect
        if (this.particles.visible) {
            const time = Date.now() * 0.001;
            for (let i = 0; i < this.particleCount; i++) {
                const i3 = i * 3;
                this.particlePositions[i3] += this.particleVelocities[i3];
                this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1];
                this.particlePositions[i3 + 2] += this.particleVelocities[i3 + 2];
                
                this.particleVelocities[i3] *= 0.99;
                this.particleVelocities[i3 + 1] *= 0.99;
                this.particleVelocities[i3 + 2] *= 0.99;
            }
            this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
            this.particleGeometry.attributes.position.needsUpdate = true;
        }

        // Check collisions with ground and ceiling
        if (this.bird.position.y > 8 || this.bird.position.y < -8) {
            this.gameOver = true;
        }

        // Update pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.upper.position.x -= this.pipeSpeed;
            pipe.lower.position.x -= this.pipeSpeed;

            // Check collisions with adjusted size
            if (this.bird.position.x + 1 > pipe.upper.position.x - this.pipeWidth/2 &&
                this.bird.position.x - 1 < pipe.upper.position.x + this.pipeWidth/2) {
                if (this.bird.position.y + 1 > pipe.gapY - this.pipeGap/2 &&
                    this.bird.position.y - 1 < pipe.gapY + this.pipeGap/2) {
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
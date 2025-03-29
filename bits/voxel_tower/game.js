// Voxel Tower - A Three.js and Cannon.js physics-based stacking game
// Main game class
class VoxelTower {
  constructor() {
      // Game state
      this.score = 0;
      this.gameOver = false;
      this.gameStarted = false;
      this.failureReason = "";
      
      // Block properties
      this.blockWidth = 3;
      this.blockHeight = 1;
      this.blockDepth = 3;
      this.blockSpeed = 2; // Starting speed (slower at first)
      this.direction = 1; // 1 for x-axis, 2 for z-axis
      this.overhangThreshold = 1.0; // Start with more forgiving threshold
      
      // Arrays to track objects
      this.blocks = [];
      this.fallenBlocks = [];
      
      // Initialize UI elements
      this.scoreElement = document.getElementById('score');
      this.finalScoreElement = document.getElementById('final-score');
      this.gameOverScreen = document.getElementById('game-over');
      this.startScreen = document.getElementById('start-screen');
      this.restartButton = document.getElementById('restart-button');
      this.startButton = document.getElementById('start-button');
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize scene
      this.initScene();
      this.initPhysics();
      this.initLights();
      this.initCamera();
      
      // Add base platform
      this.addBasePlatform();
      
      // Start render loop
      this.animate();
  }
  
  setupEventListeners() {
      // Mouse/touch controls
      window.addEventListener('mousedown', this.handleInput.bind(this));
      window.addEventListener('touchstart', this.handleInput.bind(this), { passive: false });
      
      // Prevent scrolling on touch devices
      document.addEventListener('touchmove', function(event) {
          event.preventDefault();
      }, { passive: false });
      
      // Window resize
      window.addEventListener('resize', this.onWindowResize.bind(this));
      
      // UI buttons
      this.restartButton.addEventListener('click', this.restartGame.bind(this));
      this.startButton.addEventListener('click', this.startGame.bind(this));
  }
  
  initScene() {
      // Create Three.js scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
      
      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = true;
      document.getElementById('game-container').prepend(this.renderer.domElement);
      
      // Add fog for distance effect
      this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);
  }
  
  initPhysics() {
      // Initialize Cannon.js physics world
      this.world = new CANNON.World();
      this.world.gravity.set(0, -9.82, 0); // Earth gravity
      this.world.broadphase = new CANNON.NaiveBroadphase();
      this.world.solver.iterations = 10;
      
      // Create ground plane for physics
      const groundShape = new CANNON.Plane();
      const groundBody = new CANNON.Body({
          mass: 0, // Static body
          shape: groundShape
      });
      groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
      groundBody.position.set(0, -10, 0); // Position below the scene
      this.world.addBody(groundBody);
  }
  
  initLights() {
      // Main directional light
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(10, 20, 10);
      directionalLight.castShadow = true;
      
      // Adjust shadow properties
      directionalLight.shadow.camera.left = -20;
      directionalLight.shadow.camera.right = 20;
      directionalLight.shadow.camera.top = 20;
      directionalLight.shadow.camera.bottom = -20;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      
      this.scene.add(directionalLight);
      
      // Ambient light for overall illumination
      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      this.scene.add(ambientLight);
  }
  
  initCamera() {
      // Create and position camera
      this.camera = new THREE.PerspectiveCamera(
          75, 
          window.innerWidth / window.innerHeight, 
          0.1, 
          1000
      );
      this.camera.position.set(10, 10, 10);
      this.camera.lookAt(0, 0, 0);
      
      // Initial camera target position
      this.cameraTargetPosition = new THREE.Vector3(0, 0, 0);
  }
  
  addBasePlatform() {
      // Create the static base platform
      const geometry = new THREE.BoxGeometry(
          this.blockWidth,
          this.blockHeight,
          this.blockDepth
      );
      const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown base
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 0, 0);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
      
      // Add base to blocks array
      this.blocks.push({
          mesh: mesh,
          width: this.blockWidth,
          height: this.blockHeight,
          depth: this.blockDepth,
          position: new THREE.Vector3(0, 0, 0),
          block: null // No physics for base
      });
      
      // Create first moving block ready for placement
      this.createNewBlock();
  }
  
  createNewBlock() {
      // Get properties from previous block
      const prevBlock = this.blocks[this.blocks.length - 1];
      
      // Create geometry for new block
      const geometry = new THREE.BoxGeometry(
          this.blockWidth,
          this.blockHeight,
          this.blockDepth
      );
      
      // Generate a color based on score (cyclical palette)
      const hue = (this.score * 30) % 360;
      const color = new THREE.Color(`hsl(${hue}, 70%, 60%)`);
      const material = new THREE.MeshLambertMaterial({ color });
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Starting position
      let startX = 0;
      let startZ = 0;
      const startY = prevBlock.position.y + this.blockHeight;
      
      // Switch moving axis each level
      this.direction = (this.score % 2 === 0) ? 1 : 2; // 1 for X, 2 for Z
      
      if (this.direction === 1) {
          // Moving along X-axis
          startX = -10;
          startZ = prevBlock.position.z;
      } else {
          // Moving along Z-axis
          startX = prevBlock.position.x;
          startZ = -10;
      }
      
      mesh.position.set(startX, startY, startZ);
      this.scene.add(mesh);
      
      // Store current block info
      this.currentBlock = {
          mesh: mesh,
          width: this.blockWidth,
          height: this.blockHeight,
          depth: this.blockDepth,
          position: new THREE.Vector3(startX, startY, startZ),
          direction: this.direction,
          placed: false
      };
      
      // Update camera target position to follow the tower height
      this.cameraTargetPosition.y = startY;
      
      // Progressive difficulty - increase speed and reduce overhang threshold as score increases
      this.blockSpeed = Math.min(2 + this.score / 4, 8);
      
      // Make overhang threshold more strict as game progresses (harder to succeed with misalignments)
      this.overhangThreshold = Math.max(1.0 - (this.score * 0.02), 0.5);
  }
  
  updateScore(points = 1) {
      console.log(`Adding ${points} points to score`);
      
      // Add points to score
      this.score += points;
      console.log(`New score: ${this.score}`);
      
      // Update score display
      this.scoreElement.textContent = `Score: ${this.score}`;
  }
  
  placeBlock() {
      if (!this.gameStarted || this.gameOver || this.currentBlock.placed) {
          return;
      }
      
      const { mesh, direction } = this.currentBlock;
      const prevBlock = this.blocks[this.blocks.length - 1];
      
      // Calculate overhang
      let overhangX = 0;
      let overhangZ = 0;
      let dropWidth = this.blockWidth;
      let dropDepth = this.blockDepth;
      let alignmentScore = 0;
      
      if (direction === 1) { // Moving along X axis
          overhangX = mesh.position.x - prevBlock.position.x;
          // Calculate cut size
          const overlap = this.blockWidth - Math.abs(overhangX);
          if (overlap <= 0) {
              // No overlap with previous block - game over
              this.failureReason = "Block missed the tower completely!";
              this.endGame();
              return;
          } else if (overlap < this.blockWidth) {
              // Partial overlap - cut block
              dropWidth = overlap;
              
              // Calculate alignment score - perfect center alignment gives bonus points
              const alignmentPercentage = 1 - (Math.abs(overhangX) / this.blockWidth);
              alignmentScore = Math.floor(alignmentPercentage * 3); // 0-3 bonus points
          } else {
              // Perfect overlap
              alignmentScore = 3; // Max bonus
          }
      } else { // Moving along Z axis
          overhangZ = mesh.position.z - prevBlock.position.z;
          // Calculate cut size
          const overlap = this.blockDepth - Math.abs(overhangZ);
          if (overlap <= 0) {
              // No overlap with previous block - game over
              this.failureReason = "Block missed the tower completely!";
              this.endGame();
              return;
          } else if (overlap < this.blockDepth) {
              // Partial overlap - cut block
              dropDepth = overlap;
              
              // Calculate alignment score - perfect center alignment gives bonus points
              const alignmentPercentage = 1 - (Math.abs(overhangZ) / this.blockDepth);
              alignmentScore = Math.floor(alignmentPercentage * 3); // 0-3 bonus points
          } else {
              // Perfect overlap
              alignmentScore = 3; // Max bonus
          }
      }
      
      // Handle overhang part that will fall
      if ((direction === 1 && dropWidth < this.blockWidth) || 
          (direction === 2 && dropDepth < this.blockDepth)) {
          
          this.createOverhangBlock(
              overhangX, overhangZ, 
              this.blockWidth - dropWidth, 
              this.blockDepth - dropDepth, 
              direction
          );
      }
      
      // Update the placed block geometry to reflect the cut
      let newGeometry;
      if (direction === 1) {
          newGeometry = new THREE.BoxGeometry(dropWidth, this.blockHeight, this.blockDepth);
          // Position at correct spot considering the cut
          mesh.position.x = prevBlock.position.x + overhangX / 2;
      } else {
          newGeometry = new THREE.BoxGeometry(this.blockWidth, this.blockHeight, dropDepth);
          // Position at correct spot considering the cut
          mesh.position.z = prevBlock.position.z + overhangZ / 2;
      }
      
      // Update mesh geometry
      mesh.geometry.dispose();
      mesh.geometry = newGeometry;
      
      // Create physics body for the placed block
      const shape = new CANNON.Box(new CANNON.Vec3(
          direction === 1 ? dropWidth / 2 : this.blockWidth / 2,
          this.blockHeight / 2,
          direction === 2 ? dropDepth / 2 : this.blockDepth / 2
      ));
      
      const body = new CANNON.Body({
          mass: 0, // Static body since it's placed
          shape: shape
      });
      
      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      this.world.addBody(body);
      
      // Add to blocks array
      this.blocks.push({
          mesh: mesh,
          width: direction === 1 ? dropWidth : this.blockWidth,
          height: this.blockHeight,
          depth: direction === 2 ? dropDepth : this.blockDepth,
          position: new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z),
          block: body
      });
      
      // Mark current block as placed
      this.currentBlock.placed = true;
      
      // Update score and level
      this.updateScore();
      this.currentLevel++;
      
      // Check if block is too small to continue
      if ((direction === 1 && dropWidth < this.overhangThreshold) || 
          (direction === 2 && dropDepth < this.overhangThreshold)) {
          // End game if block is too small
          this.failureReason = "Block too unstable - not enough overlap!";
          this.endGame();
          return;
      }
      
      // Show difficulty increase message
      if (this.currentLevel > 0 && this.currentLevel % 5 === 0) {
          this.showMessage(`Level ${this.currentLevel}: Speed increased!`);
      }
      
      // Create new block
      this.createNewBlock();
  }
  
  createOverhangBlock(overhangX, overhangZ, cutWidth, cutDepth, direction) {
      // Create a new geometry for the overhang part
      let geometry;
      let position = new THREE.Vector3();
      
      if (direction === 1) { // X axis movement
          geometry = new THREE.BoxGeometry(cutWidth, this.blockHeight, this.blockDepth);
          
          // Position based on which side is hanging over
          if (overhangX > 0) {
              position.set(
                  this.currentBlock.mesh.position.x + (this.blockWidth - cutWidth) / 2,
                  this.currentBlock.mesh.position.y,
                  this.currentBlock.mesh.position.z
              );
          } else {
              position.set(
                  this.currentBlock.mesh.position.x - (this.blockWidth - cutWidth) / 2,
                  this.currentBlock.mesh.position.y,
                  this.currentBlock.mesh.position.z
              );
          }
      } else { // Z axis movement
          geometry = new THREE.BoxGeometry(this.blockWidth, this.blockHeight, cutDepth);
          
          // Position based on which side is hanging over
          if (overhangZ > 0) {
              position.set(
                  this.currentBlock.mesh.position.x,
                  this.currentBlock.mesh.position.y,
                  this.currentBlock.mesh.position.z + (this.blockDepth - cutDepth) / 2
              );
          } else {
              position.set(
                  this.currentBlock.mesh.position.x,
                  this.currentBlock.mesh.position.y,
                  this.currentBlock.mesh.position.z - (this.blockDepth - cutDepth) / 2
              );
          }
      }
      
      // Create material and mesh
      const material = this.currentBlock.mesh.material.clone();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.castShadow = true;
      this.scene.add(mesh);
      
      // Create physics body
      const shape = new CANNON.Box(new CANNON.Vec3(
          direction === 1 ? cutWidth / 2 : this.blockWidth / 2,
          this.blockHeight / 2,
          direction === 2 ? cutDepth / 2 : this.blockDepth / 2
      ));
      
      const body = new CANNON.Body({
          mass: 5, // Give it mass so it falls
          shape: shape
      });
      
      body.position.set(position.x, position.y, position.z);
      this.world.addBody(body);
      
      // Add to fallen blocks
      this.fallenBlocks.push({
          mesh: mesh,
          body: body,
          timeAlive: 0 // Track how long it's been falling
      });
  }
  
  updatePhysics() {
      // Step the physics world
      this.world.step(1/60);
      
      // Update positions of fallen blocks
      for (let i = this.fallenBlocks.length - 1; i >= 0; i--) {
          const block = this.fallenBlocks[i];
          block.mesh.position.copy(block.body.position);
          block.mesh.quaternion.copy(block.body.quaternion);
          
          // Increment time alive
          block.timeAlive += 1/60;
          
          // Remove blocks that fell out of view or have been around too long
          if (block.mesh.position.y < -20 || block.timeAlive > 5) {
              this.scene.remove(block.mesh);
              this.world.removeBody(block.body);
              block.mesh.geometry.dispose();
              block.mesh.material.dispose();
              this.fallenBlocks.splice(i, 1);
          }
      }
  }
  
  updateCamera() {
      // Calculate target height based on highest block
      const targetY = Math.max(5, this.cameraTargetPosition.y + 5);
      
      // Smoothly move camera position
      this.camera.position.y += (targetY - this.camera.position.y) * 0.1;
      
      // Keep camera looking at the center of the tower
      this.camera.lookAt(
          new THREE.Vector3(0, this.cameraTargetPosition.y - 2, 0)
      );
  }
  
  updateMovingBlock() {
      if (!this.gameStarted || this.gameOver || this.currentBlock.placed) {
          return;
      }
      
      const { mesh, direction } = this.currentBlock;
      const amplitude = 10; // How far the block moves from center
      
      if (direction === 1) { // X-axis movement
          // Move back and forth along X
          mesh.position.x += this.blockSpeed * 0.1 * this.direction;
          if (mesh.position.x > amplitude || mesh.position.x < -amplitude) {
              this.direction *= -1; // Reverse direction at boundaries
          }
      } else { // Z-axis movement
          // Move back and forth along Z
          mesh.position.z += this.blockSpeed * 0.1 * this.direction;
          if (mesh.position.z > amplitude || mesh.position.z < -amplitude) {
              this.direction *= -1; // Reverse direction at boundaries
          }
      }
  }
  
  handleInput(event) {
      // Prevent default to avoid scrolling on touch devices
      if (event.type === 'touchstart') {
          event.preventDefault();
      }
      
      if (!this.gameStarted) {
          this.startGame();
          return;
      }
      
      if (!this.gameOver) {
          this.placeBlock();
      }
  }
  
  startGame() {
      this.gameStarted = true;
      this.startScreen.classList.add('hidden');
      
      // Remove any floating score indicators from previous game
      const indicators = document.querySelectorAll('.score-indicator');
      indicators.forEach(el => el.remove());
      
      // Reset game state if restarting
      if (this.score > 0) {
          this.restartGame();
      }
  }
  
  // Show floating score indicator
  showFloatingScore(position, points, isPerfect) {
      // Create floating score indicator
      const scoreIndicator = document.createElement('div');
      scoreIndicator.className = 'score-indicator';
      scoreIndicator.textContent = `+${points}`;
      scoreIndicator.style.position = 'absolute';
      scoreIndicator.style.color = isPerfect ? '#ffcc00' : 'white';
      scoreIndicator.style.fontSize = isPerfect ? '28px' : '20px';
      scoreIndicator.style.fontWeight = 'bold';
      scoreIndicator.style.zIndex = '1000';
      scoreIndicator.style.opacity = '1';
      scoreIndicator.style.pointerEvents = 'none';
      scoreIndicator.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
      
      // Position near where block was placed
      const viewportPosition = new THREE.Vector3(0, position.y, 0);
      viewportPosition.project(this.camera);
      
      scoreIndicator.style.left = `${(viewportPosition.x * 0.5 + 0.5) * window.innerWidth}px`;
      scoreIndicator.style.top = `${(-viewportPosition.y * 0.5 + 0.5) * window.innerHeight - 50}px`;
      document.getElementById('game-container').appendChild(scoreIndicator);
      
      // Animate and remove
      let opacity = 1;
      let posY = parseFloat(scoreIndicator.style.top);
      
      const animateScore = () => {
          opacity -= 0.03;
          posY -= 1;
          scoreIndicator.style.opacity = opacity;
          scoreIndicator.style.top = `${posY}px`;
          
          if (opacity > 0) {
              requestAnimationFrame(animateScore);
          } else {
              if (scoreIndicator.parentNode) {
                  document.getElementById('game-container').removeChild(scoreIndicator);
              }
          }
      };
      
      requestAnimationFrame(animateScore);
  }
  
  endGame() {
      this.gameOver = true;
      this.finalScoreElement.textContent = this.score;
      
      // Set failure reason in game over screen
      const reasonElement = document.getElementById('failure-reason') || document.createElement('p');
      if (!document.getElementById('failure-reason')) {
          reasonElement.id = 'failure-reason';
          reasonElement.style.color = '#ff6b6b';
          reasonElement.style.fontWeight = 'bold';
          reasonElement.style.marginTop = '10px';
          this.gameOverScreen.insertBefore(reasonElement, this.gameOverScreen.querySelector('button'));
      }
      reasonElement.textContent = this.failureReason || "Tower collapsed!";
      
      // Show game over screen
      this.gameOverScreen.classList.remove('hidden');
  }
  
  restartGame() {
      // Hide UI elements
      this.gameOverScreen.classList.add('hidden');
      
      // Reset game state
      this.score = 0;
      this.gameOver = false;
      this.updateScore(0);
      
      // Clear existing blocks
      for (const block of this.blocks) {
          if (block.mesh) {
              this.scene.remove(block.mesh);
              block.mesh.geometry.dispose();
              block.mesh.material.dispose();
              if (block.block) {
                  this.world.removeBody(block.block);
              }
          }
      }
      
      // Clear current moving block if it exists
      if (this.currentBlock && this.currentBlock.mesh) {
          this.scene.remove(this.currentBlock.mesh);
          this.currentBlock.mesh.geometry.dispose();
          this.currentBlock.mesh.material.dispose();
      }
      
      // Clear fallen blocks
      for (const block of this.fallenBlocks) {
          this.scene.remove(block.mesh);
          block.mesh.geometry.dispose();
          block.mesh.material.dispose();
          this.world.removeBody(block.body);
      }
      
      // Reset arrays
      this.blocks = [];
      this.fallenBlocks = [];
      
      // Reset camera position
      this.camera.position.set(10, 10, 10);
      this.camera.lookAt(0, 0, 0);
      this.cameraTargetPosition.set(0, 0, 0);
      
      // Add base platform and start fresh
      this.addBasePlatform();
  }
  
  onWindowResize() {
      // Update camera aspect ratio
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      
      // Update renderer size
      this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
      requestAnimationFrame(this.animate.bind(this));
      
      // Update physics
      this.updatePhysics();
      
      // Update moving block
      this.updateMovingBlock();
      
      // Update camera position
      this.updateCamera();
      
      // Render scene
      this.renderer.render(this.scene, this.camera);
  }
}

// Start game when window loads
window.addEventListener('load', () => {
  new VoxelTower();
});
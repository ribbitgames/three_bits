import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// Game constants
const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 20;
const BALL_SIZE = 20;
const PADDLE_SPEED = 5;
const INITIAL_BALL_SPEED = 5/3;  // One third of original speed
const BALL_SPEED_INCREASE = 1.03;  // 3% increase on each hit
const MAX_SCORE = 5;

// Table dimensions (these will be our reference dimensions)
const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 600;
const TABLE_DEPTH = 20;
const NET_HEIGHT = 40;

// Aspect ratio for scaling
const ASPECT_RATIO = TABLE_WIDTH / TABLE_HEIGHT;

// Game state
let score = { player1: 0, player2: 0 };
let currentBallSpeed = INITIAL_BALL_SPEED;
let ballVelocity = new THREE.Vector3(INITIAL_BALL_SPEED, INITIAL_BALL_SPEED, 0);
let keys = {};
let gameActive = true;
let currentScreenWidth = window.innerWidth;
let currentScreenHeight = window.innerHeight;
let player1ScoreMesh;
let player2ScoreMesh;
let scoreFont; // Store font reference

// Array of emojis
const EMOJIS = ['⚽', '🎾', '🏀', '🏈', '⭐', '🎯', '🌟', '🔮'];
let currentEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

// Add after the game state variables
const raycaster = new THREE.Raycaster();
const ballDirection = new THREE.Vector3();
const tempVector = new THREE.Vector3();

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); // Dark background

// Setup camera
const camera = new THREE.OrthographicCamera(
    TABLE_WIDTH / -2,
    TABLE_WIDTH / 2,
    TABLE_HEIGHT / 2,
    TABLE_HEIGHT / -2,
    1,
    1000
);
camera.position.set(0, 0, 400);
camera.lookAt(0, 0, 0);

// Setup renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
updateGameSize();
renderer.shadowMap.enabled = true;

// Setup game container styles
const container = document.getElementById('game-container');
container.style.position = 'fixed';
container.style.top = '0';
container.style.left = '0';
container.style.width = '100%';
container.style.height = '100%';
container.style.display = 'flex';
container.style.justifyContent = 'center';
container.style.alignItems = 'center';
container.style.overflow = 'hidden';

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';

// Add meta viewport tag if not present
if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);
}

container.appendChild(renderer.domElement);

// Add resize handler
window.addEventListener('resize', updateGameSize);

// Function to update game size
function updateGameSize() {
    currentScreenWidth = window.innerWidth;
    currentScreenHeight = window.innerHeight;
    
    // Get the game container
    const container = document.getElementById('game-container');
    
    // Calculate new dimensions while maintaining aspect ratio
    let newWidth, newHeight;
    
    if (window.innerWidth / window.innerHeight > ASPECT_RATIO) {
        // Window is wider than game aspect ratio
        newHeight = Math.min(window.innerHeight, TABLE_HEIGHT);
        newWidth = newHeight * ASPECT_RATIO;
    } else {
        // Window is taller than game aspect ratio
        newWidth = Math.min(window.innerWidth, TABLE_WIDTH);
        newHeight = newWidth / ASPECT_RATIO;
    }
    
    // Update renderer size
    renderer.setSize(newWidth, newHeight);
    
    // Update camera
    const scale = newHeight / TABLE_HEIGHT;
    camera.left = (TABLE_WIDTH / -2) * scale;
    camera.right = (TABLE_WIDTH / 2) * scale;
    camera.top = (TABLE_HEIGHT / 2) * scale;
    camera.bottom = (TABLE_HEIGHT / -2) * scale;
    camera.updateProjectionMatrix();
    
    // Center the game container
    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;
    container.style.margin = 'auto';
}

// Create table surface
const tableGeometry = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH);
const tableMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x0D4F1C, // Dark green (regulation color)
    specular: 0x111111,
    shininess: 30
});
const table = new THREE.Mesh(tableGeometry, tableMaterial);
table.position.z = -TABLE_DEPTH/2;
table.receiveShadow = true;
scene.add(table);

// Create table border
const borderGeometry = new THREE.BoxGeometry(TABLE_WIDTH + 40, TABLE_HEIGHT + 40, TABLE_DEPTH + 10);
const borderMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x2b1810, // Darker brown
    specular: 0x111111,
    shininess: 30
});
const border = new THREE.Mesh(borderGeometry, borderMaterial);
border.position.z = -TABLE_DEPTH/2 - 5;
scene.add(border);

// Create table lines
const lineWidth = 2;
const lineColor = 0xffffff;
const lineMaterial = new THREE.MeshBasicMaterial({ color: lineColor });

// Center line (along the net)
const centerLineGeometry = new THREE.BoxGeometry(lineWidth, TABLE_HEIGHT - 20, 1);
const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
centerLine.position.set(0, 0, -TABLE_DEPTH/2 + 1);
scene.add(centerLine);

// Outer border lines
const edgeLineGeometry = new THREE.BoxGeometry(TABLE_WIDTH - 20, lineWidth, 1);
const topLine = new THREE.Mesh(edgeLineGeometry, lineMaterial);
const bottomLine = new THREE.Mesh(edgeLineGeometry, lineMaterial);
topLine.position.set(0, TABLE_HEIGHT/2 - 10, -TABLE_DEPTH/2 + 1);
bottomLine.position.set(0, -TABLE_HEIGHT/2 + 10, -TABLE_DEPTH/2 + 1);
scene.add(topLine, bottomLine);

const sideLineGeometry = new THREE.BoxGeometry(lineWidth, TABLE_HEIGHT - 20, 1);
const leftLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
const rightLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
leftLine.position.set(-TABLE_WIDTH/2 + 10, 0, -TABLE_DEPTH/2 + 1);
rightLine.position.set(TABLE_WIDTH/2 - 10, 0, -TABLE_DEPTH/2 + 1);
scene.add(leftLine, rightLine);

// Create net with proper dimensions
const netGeometry = new THREE.BoxGeometry(2, NET_HEIGHT, TABLE_DEPTH + 30);
const netMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
});
const net = new THREE.Mesh(netGeometry, netMaterial);
net.position.z = 0;
net.castShadow = true;
scene.add(net);

// Create net posts with proper height
const postGeometry = new THREE.BoxGeometry(4, NET_HEIGHT + 20, 4);
const postMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x888888,  // Metallic gray
    specular: 0x444444,
    shininess: 100
});
const post1 = new THREE.Mesh(postGeometry, postMaterial);
const post2 = new THREE.Mesh(postGeometry, postMaterial);
post1.position.set(-TABLE_WIDTH/2 + 10, 0, 0);
post2.position.set(TABLE_WIDTH/2 - 10, 0, 0);
post1.castShadow = true;
post2.castShadow = true;
scene.add(post1, post2);

// Create paddles with improved materials
const paddleGeometry = new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, 5);
const paddleMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff0000,
    specular: 0x444444,
    shininess: 100
});
const paddle2Material = new THREE.MeshPhongMaterial({ 
    color: 0x0000ff,
    specular: 0x444444,
    shininess: 100
});

const paddle1 = new THREE.Mesh(paddleGeometry, paddleMaterial);
const paddle2 = new THREE.Mesh(paddleGeometry, paddle2Material);

paddle1.position.set(-350, 0, 0);
paddle2.position.set(350, 0, 0);

paddle1.castShadow = true;
paddle2.castShadow = true;
scene.add(paddle1, paddle2);

// Create ball with improved 3D look
const ballGeometry = new THREE.SphereGeometry(BALL_SIZE/2, 32, 32);
const ballMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffffff,
    specular: 0x444444,
    shininess: 100
});
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
ball.castShadow = true;
ball.receiveShadow = true;
scene.add(ball);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 200, 200);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Event listeners
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);
document.getElementById('play-again').addEventListener('click', resetGame);

// Touch controls state
let touchControls = {
    paddle1Moving: 0,  // -1 for down, 1 for up, 0 for not moving
    paddle2Moving: 0
};

// Add touch event listeners
renderer.domElement.addEventListener('touchstart', handleTouch);
renderer.domElement.addEventListener('touchmove', handleTouch);
renderer.domElement.addEventListener('touchend', () => {
    touchControls.paddle1Moving = 0;
    touchControls.paddle2Moving = 0;
});

function handleTouch(event) {
    event.preventDefault(); // Prevent scrolling while playing
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;

    // Handle all touch points
    for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        // Determine which half of the screen was touched
        if (touchX < centerX) {
            // Left paddle
            touchControls.paddle1Moving = touchY < rect.height / 2 ? 1 : -1;
        } else {
            // Right paddle
            touchControls.paddle2Moving = touchY < rect.height / 2 ? 1 : -1;
        }
    }
}

// Create font loader
const fontLoader = new FontLoader();

// Load font and create score meshes
fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function(font) {
    scoreFont = font; // Store the font for later use
    const textOptions = {
        font: font,
        size: 50,
        height: 5,
        curveSegments: 12,
        bevelEnabled: false
    };

    // Create score meshes with initial "0"
    function createScoreText(text) {
        const textGeometry = new TextGeometry(text, textOptions);
        textGeometry.computeBoundingBox();
        const textMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
        return new THREE.Mesh(textGeometry, textMaterial);
    }

    // Create initial score meshes
    player1ScoreMesh = createScoreText('0');
    player2ScoreMesh = createScoreText('0');

    // Position score meshes
    player1ScoreMesh.position.set(-100, TABLE_HEIGHT/3, 0);
    player2ScoreMesh.position.set(50, TABLE_HEIGHT/3, 0);

    scene.add(player1ScoreMesh);
    scene.add(player2ScoreMesh);
});

// Function to update score display
function updateScore() {
    if (!player1ScoreMesh || !player2ScoreMesh || !scoreFont) return;

    // Create new score meshes with updated scores
    const textOptions = {
        font: scoreFont,
        size: 50,
        height: 5,
        curveSegments: 12,
        bevelEnabled: false
    };

    // Update score geometries
    if (player1ScoreMesh.geometry) {
        player1ScoreMesh.geometry.dispose();
    }
    if (player2ScoreMesh.geometry) {
        player2ScoreMesh.geometry.dispose();
    }
    
    const geometry1 = new TextGeometry(score.player1.toString(), textOptions);
    const geometry2 = new TextGeometry(score.player2.toString(), textOptions);
    
    player1ScoreMesh.geometry = geometry1;
    player2ScoreMesh.geometry = geometry2;

    // Reposition scores
    player1ScoreMesh.position.set(-100, TABLE_HEIGHT/3, 0);
    player2ScoreMesh.position.set(50, TABLE_HEIGHT/3, 0);
}

// Show game over screen
function showGameOver(winner) {
    gameActive = false;
    const gameOverScreen = document.getElementById('game-over');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = `${winner} wins!`;
    gameOverScreen.classList.remove('hidden');
}

// Reset game
function resetGame() {
    score = { player1: 0, player2: 0 };
    gameActive = true;
    document.getElementById('game-over').classList.add('hidden');
    updateScore();
    resetBall();
}

// Reset ball
function resetBall() {
    ball.position.set(0, 0, 0);
    currentBallSpeed = INITIAL_BALL_SPEED;
    
    // Set ball color back to white
    ballMaterial.color.setHex(0xffffff);
    
    // Randomize initial direction but ensure horizontal component is significant
    const angle = (Math.random() - 0.5) * Math.PI / 3; // ±60 degrees
    ballVelocity.set(
        Math.cos(angle) * currentBallSpeed * (Math.random() > 0.5 ? 1 : -1),
        Math.sin(angle) * currentBallSpeed,
        0
    );
}

// Game loop
function animate() {
    requestAnimationFrame(animate);

    if (!gameActive) return;

    // Paddle movement - combine keyboard and touch controls
    // Left paddle (Player 1)
    if ((keys['w'] || touchControls.paddle1Moving > 0) && paddle1.position.y < 250) {
        paddle1.position.y += PADDLE_SPEED;
    }
    if ((keys['s'] || touchControls.paddle1Moving < 0) && paddle1.position.y > -250) {
        paddle1.position.y -= PADDLE_SPEED;
    }
    
    // Right paddle (Player 2)
    if ((keys['ArrowUp'] || touchControls.paddle2Moving > 0) && paddle2.position.y < 250) {
        paddle2.position.y += PADDLE_SPEED;
    }
    if ((keys['ArrowDown'] || touchControls.paddle2Moving < 0) && paddle2.position.y > -250) {
        paddle2.position.y -= PADDLE_SPEED;
    }

    // Update ball position for next frame
    tempVector.copy(ballVelocity).normalize();
    raycaster.set(ball.position, tempVector);
    
    // Get potential collision objects
    const intersects = raycaster.intersectObjects([paddle1, paddle2]);

    // Check for paddle collisions
    if (intersects.length > 0 && intersects[0].distance < BALL_SIZE) {
        const paddle = intersects[0].object;
        
        // Calculate relative impact point (-1 to 1, from paddle bottom to top)
        const relativeImpactY = (ball.position.y - paddle.position.y) / (PADDLE_HEIGHT / 2);
        
        // Determine if this is a valid collision (ball coming from the correct side)
        const isValidCollision = (paddle === paddle1 && ballVelocity.x < 0) || 
                               (paddle === paddle2 && ballVelocity.x > 0);
        
        if (isValidCollision) {
            // Increase speed
            currentBallSpeed *= BALL_SPEED_INCREASE;
            
            // Calculate new angle based on where the ball hits the paddle
            const bounceAngle = relativeImpactY * Math.PI / 4; // Max 45-degree angle
            
            // Set new velocity
            ballVelocity.x = Math.sign(ballVelocity.x) * -currentBallSpeed * Math.cos(bounceAngle);
            ballVelocity.y = currentBallSpeed * Math.sin(bounceAngle);
        }
    }

    // Ball movement
    ball.position.add(ballVelocity);

    // Ball collision with top and bottom
    if (Math.abs(ball.position.y) > 290) {
        ballVelocity.y *= -1;
        ball.position.y = Math.sign(ball.position.y) * 290; // Prevent sticking to walls
    }

    // Score points
    if (ball.position.x < -400) {
        score.player2++;
        updateScore();
        resetBall();
    }
    if (ball.position.x > 400) {
        score.player1++;
        updateScore();
        resetBall();
    }

    // Remove the old score display element if it exists
    const oldScoreElement = document.getElementById('score');
    if (oldScoreElement) {
        oldScoreElement.remove();
    }

    // Check for game over
    if (score.player1 >= MAX_SCORE || score.player2 >= MAX_SCORE) {
        const winner = score.player1 >= MAX_SCORE ? 'Player 1' : 'Player 2';
        showGameOver(winner);
    }

    renderer.render(scene, camera);
}

// Start the game
resetBall();
animate(); 
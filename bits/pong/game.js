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

// Game state
let score = { player1: 0, player2: 0 };
let currentBallSpeed = INITIAL_BALL_SPEED;
let ballVelocity = new THREE.Vector3(INITIAL_BALL_SPEED, INITIAL_BALL_SPEED, 0);
let keys = {};
let gameActive = true;

// Array of emojis
const EMOJIS = ['⚽', '🎾', '🏀', '🏈', '⭐', '🎯', '🌟', '🔮'];
let currentEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

// Setup scene
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    1,
    1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(800, 600);
document.getElementById('game-container').appendChild(renderer.domElement);

// Create paddles
const paddleGeometry = new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, 0);
const paddleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

const paddle1 = new THREE.Mesh(paddleGeometry, paddleMaterial);
const paddle2 = new THREE.Mesh(paddleGeometry, paddleMaterial);

paddle1.position.set(-350, 0, 0);
paddle2.position.set(350, 0, 0);

scene.add(paddle1);
scene.add(paddle2);

// Create ball (emoji sprite)
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 128;
const ctx = canvas.getContext('2d');
ctx.font = '100px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(currentEmoji, 64, 64);

const ballTexture = new THREE.CanvasTexture(canvas);
const ballMaterial = new THREE.SpriteMaterial({ map: ballTexture });
const ball = new THREE.Sprite(ballMaterial);
ball.scale.set(BALL_SIZE * 5, BALL_SIZE * 5, 1);
scene.add(ball);

// Create center line
const lineGeometry = new THREE.BoxGeometry(2, 600, 0);
const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
scene.add(centerLine);

// Position camera
camera.position.z = 100;
camera.lookAt(scene.position);

// Event listeners
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);
document.getElementById('play-again').addEventListener('click', resetGame);

// Update score display
function updateScore() {
    document.getElementById('score').textContent = `Player 1: ${score.player1} | Player 2: ${score.player2}`;
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
    currentEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    currentBallSpeed = INITIAL_BALL_SPEED;  // Reset speed to initial value
    
    // Update emoji texture
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillText(currentEmoji, 64, 64);
    ballTexture.needsUpdate = true;
    
    ballVelocity.set(
        currentBallSpeed * (Math.random() > 0.5 ? 1 : -1),
        currentBallSpeed * (Math.random() > 0.5 ? 1 : -1),
        0
    );
}

// Game loop
function animate() {
    requestAnimationFrame(animate);

    if (!gameActive) return;  // Skip game logic if game is not active

    // Paddle movement
    if (keys['w'] && paddle1.position.y < 250) {
        paddle1.position.y += PADDLE_SPEED;
    }
    if (keys['s'] && paddle1.position.y > -250) {
        paddle1.position.y -= PADDLE_SPEED;
    }
    if (keys['ArrowUp'] && paddle2.position.y < 250) {
        paddle2.position.y += PADDLE_SPEED;
    }
    if (keys['ArrowDown'] && paddle2.position.y > -250) {
        paddle2.position.y -= PADDLE_SPEED;
    }

    // Ball movement
    ball.position.add(ballVelocity);

    // Ball collision with top and bottom
    if (Math.abs(ball.position.y) > 290) {
        ballVelocity.y *= -1;
    }

    // Ball collision with paddles
    if (ball.position.x < -330 && 
        ball.position.y > paddle1.position.y - PADDLE_HEIGHT/2 && 
        ball.position.y < paddle1.position.y + PADDLE_HEIGHT/2) {
        ballVelocity.x *= -1;
        // Increase speed
        currentBallSpeed *= BALL_SPEED_INCREASE;
        // Normalize direction and apply new speed
        ballVelocity.normalize().multiplyScalar(currentBallSpeed);
    }

    if (ball.position.x > 330 && 
        ball.position.y > paddle2.position.y - PADDLE_HEIGHT/2 && 
        ball.position.y < paddle2.position.y + PADDLE_HEIGHT/2) {
        ballVelocity.x *= -1;
        // Increase speed
        currentBallSpeed *= BALL_SPEED_INCREASE;
        // Normalize direction and apply new speed
        ballVelocity.normalize().multiplyScalar(currentBallSpeed);
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
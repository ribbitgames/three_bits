import * as THREE from 'three';

// Game constants
const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 20;
const BALL_SIZE = 20;
const PADDLE_SPEED = 5;
const BALL_SPEED = 5;
const MAX_SCORE = 5;

// Game state
let score = { player1: 0, player2: 0 };
let ballVelocity = new THREE.Vector3(BALL_SPEED, BALL_SPEED, 0);
let keys = {};

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

// Create ball
const ballGeometry = new THREE.BoxGeometry(BALL_SIZE, BALL_SIZE, 0);
const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
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

// Update score display
function updateScore() {
    document.getElementById('score').textContent = `Player 1: ${score.player1} | Player 2: ${score.player2}`;
}

// Reset ball
function resetBall() {
    ball.position.set(0, 0, 0);
    ballVelocity.set(
        BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        0
    );
}

// Game loop
function animate() {
    requestAnimationFrame(animate);

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
    }

    if (ball.position.x > 330 && 
        ball.position.y > paddle2.position.y - PADDLE_HEIGHT/2 && 
        ball.position.y < paddle2.position.y + PADDLE_HEIGHT/2) {
        ballVelocity.x *= -1;
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
        alert(`Game Over! ${score.player1 >= MAX_SCORE ? 'Player 1' : 'Player 2'} wins!`);
        score = { player1: 0, player2: 0 };
        updateScore();
        resetBall();
    }

    renderer.render(scene, camera);
}

// Start the game
resetBall();
animate(); 
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 400;
canvas.height = 600;

// Game state
let gameOver = false;
let score = 0;

// Arrow properties
const arrow = {
    x: 50, // Start from left side
    y: canvas.height / 2, // Start in middle vertically
    width: 20, // Reduced from 40
    height: 20, // Reduced from 40
    speed: 2.5,
    forwardSpeed: 2,
    rotation: 0
};

// Trail system
const trail = {
    points: [],
    maxLength: 15, // How many trail points to keep
    spacing: 5 // How many frames between each trail point
};
let frameCount = 0;

// Obstacles array
let obstacles = [];
let levelOffset = 0; // Track the level's horizontal position

// Define geometric patterns
const PATTERNS = [
    {
        name: 'triangle',
        create: (x, y) => ({
            type: 'polygon',
            points: [
                {x: x, y: y + 60},
                {x: x + 50, y: y},
                {x: x + 100, y: y + 60}
            ],
            width: 100,
            height: 60
        })
    },
    {
        name: 'diamond',
        create: (x, y) => ({
            type: 'polygon',
            points: [
                {x: x, y: y + 30},
                {x: x + 30, y: y},
                {x: x + 60, y: y + 30},
                {x: x + 30, y: y + 60}
            ],
            width: 60,
            height: 60
        })
    },
    {
        name: 'rectangle',
        create: (x, y) => ({
            type: 'polygon',
            points: [
                {x: x, y: y},
                {x: x + 100, y: y},
                {x: x + 100, y: y + 40},
                {x: x, y: y + 40}
            ],
            width: 100,
            height: 40
        })
    }
];

// Initialize game
function init() {
    // Create initial obstacles
    createInitialObstacles();
}

// Create initial set of obstacles
function createInitialObstacles() {
    const minGap = 200;
    const maxGap = 300;
    let x = canvas.width;
    let lastY = canvas.height / 2;
    
    // Create obstacles until we fill the screen and beyond
    while (x < canvas.width * 2) {
        // Create a group of 2-3 obstacles at each x position
        const numObstacles = Math.floor(Math.random() * 2) + 2; // 2 or 3 obstacles
        const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
        
        // Calculate vertical positions to force movement
        const positions = [];
        if (numObstacles === 2) {
            // Create a gap that's possible to pass through
            const gapSize = 150; // Minimum gap size for the arrow to pass
            const topMax = canvas.height - gapSize - pattern.create(0, 0).height;
            const y1 = Math.random() * (topMax / 2); // Top half
            const y2 = Math.random() * (topMax / 2) + canvas.height - topMax / 2; // Bottom half
            positions.push(y1, y2);
        } else {
            // Three obstacles with two gaps
            const gapSize = 120;
            positions.push(
                50, // Top
                canvas.height / 2 - pattern.create(0, 0).height / 2, // Middle
                canvas.height - pattern.create(0, 0).height - 50 // Bottom
            );
        }

        // Create the obstacles
        positions.forEach(y => {
            obstacles.push(pattern.create(x, y));
        });

        x += Math.random() * (maxGap - minGap) + minGap;
    }
}

// Create new obstacle
function createObstacle() {
    const minGap = 200;
    const maxGap = 300;
    const lastObstacle = obstacles[obstacles.length - 1];
    const x = lastObstacle ? 
        lastObstacle.points[0].x + Math.random() * (maxGap - minGap) + minGap : 
        canvas.width;

    // Create a group of 2-3 obstacles
    const numObstacles = Math.floor(Math.random() * 2) + 2; // 2 or 3 obstacles
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];

    // Calculate vertical positions to force movement
    const positions = [];
    if (numObstacles === 2) {
        // Create a gap that's possible to pass through
        const gapSize = 150;
        const topMax = canvas.height - gapSize - pattern.create(0, 0).height;
        const y1 = Math.random() * (topMax / 2); // Top half
        const y2 = Math.random() * (topMax / 2) + canvas.height - topMax / 2; // Bottom half
        positions.push(y1, y2);
    } else {
        // Three obstacles with two gaps
        const gapSize = 120;
        positions.push(
            50, // Top
            canvas.height / 2 - pattern.create(0, 0).height / 2, // Middle
            canvas.height - pattern.create(0, 0).height - 50 // Bottom
        );
    }

    // Create the obstacles
    positions.forEach(y => {
        obstacles.push(pattern.create(x, y));
    });
}

// Add touch device detection
function isTouchDevice() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

// Handle input
function handleInput(e) {
    if (e.type === 'keydown' && e.code === 'Space') {
        e.preventDefault();
        if (gameOver) {
            resetGame();
        } else {
            arrow.rotation = -45; // Point upward
        }
    } else if (e.type === 'keyup' && e.code === 'Space') {
        arrow.rotation = 45; // Point downward at 45 degrees (mirror of up state)
    }
}

// Touch/mouse events
canvas.addEventListener('mousedown', (e) => {
    if (gameOver) {
        resetGame();
    } else {
        arrow.rotation = -45;
    }
});

canvas.addEventListener('mouseup', () => {
    if (!gameOver) {
        arrow.rotation = 45;
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameOver) {
        resetGame();
    } else {
        arrow.rotation = -45;
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!gameOver) {
        arrow.rotation = 45;
    }
});

// Helper function to check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Helper function to get distance from point to line segment
function distanceToLineSegment(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

// Check collision
function checkCollision(arrow, obstacle) {
    if (obstacle.type === 'polygon') {
        // Create arrow hitbox point
        const arrowPoint = {
            x: arrow.x + arrow.width / 2,
            y: arrow.y + arrow.height / 2
        };

        // Adjust obstacle points for level offset
        const adjustedPoints = obstacle.points.map(p => ({
            x: p.x - levelOffset,
            y: p.y
        }));

        // Check if arrow point is inside polygon
        if (isPointInPolygon(arrowPoint, adjustedPoints)) {
            return true;
        }

        // Check distance to polygon edges
        const hitboxRadius = 5; // Smaller collision radius
        for (let i = 0; i < adjustedPoints.length; i++) {
            const start = adjustedPoints[i];
            const end = adjustedPoints[(i + 1) % adjustedPoints.length];
            
            if (distanceToLineSegment(arrowPoint, start, end) < hitboxRadius) {
                return true;
            }
        }
    }
    return false;
}

// Reset game
function resetGame() {
    gameOver = false;
    score = 0;
    arrow.y = canvas.height / 2;
    trail.points = [];
    obstacles = [];
    levelOffset = 0;
    frameCount = 0;
    init();
}

// Update game state
function update() {
    if (gameOver) return;

    // Update level offset
    levelOffset += arrow.forwardSpeed;

    // Move arrow up/down
    if (arrow.rotation === -45) {
        arrow.y -= arrow.speed;
    } else {
        arrow.y += arrow.speed;
    }

    // Update trail
    frameCount++;
    if (frameCount % trail.spacing === 0) {
        trail.points.push({
            x: arrow.x + arrow.width / 2,
            y: arrow.y + arrow.height / 2,
            offset: levelOffset
        });

        // Keep only the most recent points
        if (trail.points.length > trail.maxLength) {
            trail.points.shift();
        }
    }

    // Keep arrow within canvas bounds
    if (arrow.y < 0) {
        arrow.y = 0;
        trail.points = []; // Clear trail when hitting bounds
    }
    if (arrow.y + arrow.height > canvas.height) {
        arrow.y = canvas.height - arrow.height;
        trail.points = []; // Clear trail when hitting bounds
    }

    // Check collisions
    for (let obstacle of obstacles) {
        if (checkCollision(arrow, obstacle)) {
            gameOver = true;
            break;
        }
    }

    // Update score
    score++;

    // Remove obstacles that are off screen
    obstacles = obstacles.filter(obstacle => {
        const maxX = Math.max(...obstacle.points.map(p => p.x));
        return maxX > levelOffset;
    });
    
    // Add new obstacles to maintain a good number ahead
    const lastObstacle = obstacles[obstacles.length - 1];
    const lastX = lastObstacle ? Math.max(...lastObstacle.points.map(p => p.x)) : 0;
    
    if (lastX < levelOffset + canvas.width * 2) {
        createObstacle();
    }
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw trail
    if (trail.points.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 3;

        // Draw lines between trail points
        for (let i = 0; i < trail.points.length - 1; i++) {
            const current = trail.points[i];
            const next = trail.points[i + 1];
            
            // Calculate positions accounting for level scroll
            const x1 = current.x - (levelOffset - current.offset);
            const x2 = next.x - (levelOffset - next.offset);
            
            ctx.beginPath();
            ctx.moveTo(x1, current.y);
            ctx.lineTo(x2, next.y);
            ctx.stroke();
        }
    }

    // Draw obstacles
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    obstacles.forEach(obstacle => {
        if (obstacle.type === 'polygon') {
            // Draw the outline
            ctx.beginPath();
            ctx.moveTo(
                obstacle.points[0].x - levelOffset,
                obstacle.points[0].y
            );
            for (let i = 1; i < obstacle.points.length; i++) {
                ctx.lineTo(
                    obstacle.points[i].x - levelOffset,
                    obstacle.points[i].y
                );
            }
            ctx.closePath();
            ctx.stroke();

            // Draw internal grid lines for diamond
            if (obstacle.points.length === 4) { // Diamond pattern
                ctx.beginPath();
                // Vertical line
                ctx.moveTo(
                    (obstacle.points[0].x + obstacle.points[2].x) / 2 - levelOffset,
                    obstacle.points[0].y
                );
                ctx.lineTo(
                    (obstacle.points[0].x + obstacle.points[2].x) / 2 - levelOffset,
                    obstacle.points[2].y
                );
                // Horizontal line
                ctx.moveTo(
                    obstacle.points[0].x - levelOffset,
                    (obstacle.points[0].y + obstacle.points[2].y) / 2
                );
                ctx.lineTo(
                    obstacle.points[2].x - levelOffset,
                    (obstacle.points[0].y + obstacle.points[2].y) / 2
                );
                ctx.stroke();
            }
        }
    });

    // Draw arrow
    ctx.save();
    ctx.translate(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2);
    ctx.rotate(arrow.rotation * Math.PI / 180);
    ctx.fillStyle = '#fff';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⇨', 0, 0);
    ctx.restore();

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left'; // Reset text align for score
    ctx.textBaseline = 'alphabetic'; // Reset text baseline for score
    ctx.fillText(`Score: ${Math.floor(score / 10)}`, 10, 30);

    // Draw game over
    if (gameOver) {
        ctx.fillStyle = '#fff';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        const restartText = 'Press to Restart';
        ctx.fillText(restartText, canvas.width / 2, canvas.height / 2 + 40);
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
window.addEventListener('keydown', handleInput);
window.addEventListener('keyup', handleInput);
init();
gameLoop(); 
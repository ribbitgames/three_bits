import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 5;
const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1, 1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

// Function to create emoji texture
function createEmojiTexture(emoji, size = 80) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;
    context.font = `${size}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

// Function to create text texture (for timer and legend)
function createTextTexture(text, fontSize = 20, color = 'white') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 64;
    context.font = `${fontSize}px Arial`;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 32);
    return new THREE.CanvasTexture(canvas);
}

// Basket as a sprite with emoji
const basketTexture = createEmojiTexture('🧺');
const basketMaterial = new THREE.SpriteMaterial({ map: basketTexture, transparent: true });
const basket = new THREE.Sprite(basketMaterial);
basket.scale.set(0.8, 0.8, 1);
basket.position.y = -2;
scene.add(basket);

// Timer display (top right)
let gameTime = 30;
const timerTexture = createTextTexture(`Time: ${gameTime}`, 20);
const timerMaterial = new THREE.SpriteMaterial({ map: timerTexture, transparent: true });
const timerSprite = new THREE.Sprite(timerMaterial);
timerSprite.scale.set(1, 0.5, 1);
timerSprite.position.set(frustumSize * aspect / 2 - 0.6, frustumSize / 2 - 0.3, 1);
scene.add(timerSprite);

// Legend display (left side, vertically centered)
const legendItems = [
    { emoji: '🍎', effect: '+1', color: 'white' },
    { emoji: '🍏', effect: '+5', color: 'white' },
    { emoji: '🐞', effect: '-2', color: 'red' }
];
legendItems.forEach((item, index) => {
    const texture = createTextTexture(`${item.emoji} ${item.effect}`, 16, item.color);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.8, 0.4, 1);
    sprite.position.set(-frustumSize * aspect / 2 + 0.6, 1 - index * 0.5, 1);
    scene.add(sprite);
});

// Game state
let objects = [];
let score = 0;
let misses = 0;
let gameOver = false;
let gameStartTime = Date.now();
let lastSpawn = 0;
let floatingScores = [];
let isDragging = false;
let pointerX = basket.position.x;
let lastSpawnX = null;

// Object spawner (fruits and bugs)
function spawnObject() {
    const isBug = Math.random() < 0.2;
    const isGolden = !isBug && Math.random() < 0.1;
    
    const texture = createEmojiTexture(isBug ? '🐞' : (isGolden ? '🍏' : '🍎'), 60);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const object = new THREE.Sprite(material);
    object.scale.set(0.4, 0.4, 1);
    
    // Adjusted spawn range to keep objects fully onscreen
    const spawnRange = (frustumSize * aspect / 2) - 0.4; // Account for object width (0.4)
    let spawnX;
    do {
        spawnX = (Math.random() - 0.5) * 2 * spawnRange; // Adjusted range
    } while (lastSpawnX !== null && Math.abs(spawnX - lastSpawnX) < 0.5);
    lastSpawnX = spawnX;
    
    object.position.set(spawnX, 3, 0);
    
    object.isBug = isBug;
    object.isGolden = isGolden;
    object.fallSpeed = isBug 
        ? (0.03 + Math.random() * 0.04)
        : (isGolden ? (0.06 + Math.random() * 0.02) : (0.02 + Math.random() * 0.02));
    
    objects.push(object);
    scene.add(object);
}

// Floating score creator
function createFloatingScore(text, x, y) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 64;
    context.font = '32px Arial';
    context.fillStyle = text.startsWith('-') ? 'red' : 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.8, 0.4, 1);
    sprite.position.set(x, y, 1);
    scene.add(sprite);
    floatingScores.push({ sprite, time: Date.now() });
}

// Input handling (drag-only)
document.addEventListener('mousedown', (e) => {
    isDragging = true;
    pointerX = camera.left + (e.clientX / window.innerWidth) * (camera.right - camera.left);
});
document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        pointerX = camera.left + (e.clientX / window.innerWidth) * (camera.right - camera.left);
    }
});
document.addEventListener('mouseup', () => {
    isDragging = false;
});

document.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDragging = true;
    pointerX = camera.left + (e.touches[0].clientX / window.innerWidth) * (camera.right - camera.left);
}, { passive: false });
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isDragging) {
        pointerX = camera.left + (e.touches[0].clientX / window.innerWidth) * (camera.right - camera.left);
    }
}, { passive: false });
document.addEventListener('touchend', () => {
    isDragging = false;
});

// Restart game
function restartGame(e) {
    if (gameOver && (e.type === 'click' || e.type === 'touchstart')) {
        objects.forEach(obj => scene.remove(obj));
        floatingScores.forEach(fs => scene.remove(fs.sprite));
        objects = [];
        floatingScores = [];
        score = 0;
        misses = 0;
        gameOver = false;
        gameStartTime = Date.now();
        lastSpawn = 0;
        lastSpawnX = null;
        document.getElementById('game-over').style.display = 'none';
        spawnObject();
    }
}
document.addEventListener('touchstart', restartGame);
document.addEventListener('click', restartGame);

// Game loop
function animate() {
    if (gameOver) return requestAnimationFrame(animate);

    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    // Update timer
    const elapsed = (Date.now() - gameStartTime) / 1000;
    gameTime = Math.max(0, 30 - Math.floor(elapsed));
    timerMaterial.map = createTextTexture(`Time: ${gameTime}`, 20);
    timerMaterial.map.needsUpdate = true;

    if (gameTime <= 0) {
        gameOver = true;
        document.getElementById('game-over').innerText = `Game Over!\nScore: ${score}\nTap to Restart`;
        document.getElementById('game-over').style.display = 'block';
        return;
    }

    if (isDragging) {
        // Adjusted clamp to keep basket fully onscreen
        const basketHalfWidth = 0.4; // Half of basket width (scale is 0.8)
        const clampMin = camera.left + basketHalfWidth;
        const clampMax = camera.right - basketHalfWidth;
        basket.position.x = THREE.MathUtils.clamp(pointerX, clampMin, clampMax);
    }

    if (Date.now() - lastSpawn > 1500) {
        spawnObject();
        lastSpawn = Date.now();
    }

    objects.forEach((obj, index) => {
        obj.position.y -= obj.fallSpeed;

        if (obj.position.y < -2 && Math.abs(obj.position.x - basket.position.x) < 0.4) {
            if (obj.isBug) {
                score -= 2;
                createFloatingScore('-2', obj.position.x, obj.position.y + 0.5);
            } else {
                const points = obj.isGolden ? 5 : 1;
                score += points;
                createFloatingScore(`+${points}`, obj.position.x, obj.position.y + 0.5);
            }
            scene.remove(obj);
            objects.splice(index, 1);
            document.getElementById('score').innerText = `Score: ${score}`;
        }

        if (obj.position.y < -3) {
            if (!obj.isBug) {
                createFloatingScore('-1', obj.position.x, obj.position.y);
                misses++;
            }
            scene.remove(obj);
            objects.splice(index, 1);
        }
    });

    floatingScores.forEach((fs, index) => {
        fs.sprite.position.y += 0.03;
        if (Date.now() - fs.time > 1000) {
            scene.remove(fs.sprite);
            floatingScores.splice(index, 1);
        }
    });
}

// Resize handler
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    timerSprite.position.set(frustumSize * aspect / 2 - 0.6, frustumSize / 2 - 0.3, 1);
    legendItems.forEach((_, index) => {
        const sprite = scene.children.find(child => child.material && child.material.map && child.material.map.image && child.material.map.image.toDataURL().includes(legendItems[index].effect));
        if (sprite) {
            sprite.position.set(-frustumSize * aspect / 2 + 0.6, 1 - index * 0.5, 1);
        }
    });
});

// Start game
spawnObject();
animate();
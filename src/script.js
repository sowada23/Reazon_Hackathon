const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreBoard = document.getElementById('scoreBoard');
const speedBoard = document.getElementById('speedBoard');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const startBtn = document.getElementById('startBtn');

// --- Web Audio API ---
let audioCtx;
let bgmInterval;

const bgmNotes = [261.63, 329.63, 392.00, 493.88, 440.00, 349.23, 392.00, 523.25];
let bgmIndex = 0;

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);

        playGameOverMelody();
    }
}

function playGameOverMelody() {
    const now = audioCtx.currentTime;
    const sadNotes = [311.13, 293.66, 277.18, 246.94];
    
    sadNotes.forEach((note, index) => {
        const sOsc = audioCtx.createOscillator();
        const sGain = audioCtx.createGain();
        sOsc.type = 'triangle';
        sOsc.frequency.setValueAtTime(note, now + index * 0.15);
        sGain.gain.setValueAtTime(0.15, now + index * 0.15);
        sGain.gain.linearRampToValueAtTime(0.001, now + index * 0.15 + 0.2);
        sOsc.connect(sGain);
        sGain.connect(audioCtx.destination);
        sOsc.start(now + index * 0.15);
        sOsc.stop(now + index * 0.15 + 0.2);
    });
}

function startBGM() {
    stopBGM();
    bgmIndex = 0;
    bgmInterval = setInterval(() => {
        if (!audioCtx || isGameOver) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(bgmNotes[bgmIndex], audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.16);
        
        bgmIndex = (bgmIndex + 1) % bgmNotes.length;
    }, 200); 
}

function stopBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
}

// --- ゲームの基本設定 ---
const gridSize = 15; // 常に15x15で固定
let tileSize = canvas.width / gridSize;
let baseMoveInterval = 220;
let moveInterval = baseMoveInterval;

let player, dx, dy, nextDx, nextDy, lastTime, isGameOver, items, popScale;
let isFirstScreen = true; 

const shapes = {
    2:    { type: 'circle',    name: 'サークル',   color: '#60a5fa' },
    4:    { type: 'diamond',   name: 'ダイヤ',     color: '#93c5fd' },
    8:    { type: 'triangle',  name: 'トライアングル', color: '#c084fc' },
    16:   { type: 'invTriangle',name: 'インバートT',   color: '#f472b6' },
    32:   { type: 'square',    name: 'スクエア',   color: '#fb7185' },
    64:   { type: 'cross',     name: 'クロス',     color: '#f87171' },
    128:  { type: 'hexagon',   name: 'ヘキサゴン', color: '#fb923c' },
    256:  { type: 'star',      name: 'スター',     color: '#fbbf24' },
    512:  { type: 'ring',      name: 'ダブルリング', color: '#34d399' },
    1024: { type: 'hourglass', name: 'アワーグラス', color: '#2dd4bf' },
    2048: { type: 'nexus',     name: 'ネクサスコア', color: '#22d3ee' }
};

function initGame() {
    tileSize = canvas.width / gridSize;
    // プレイヤーサイズは常に 1 で固定
    player = { x: 7, y: 7, visualX: 7, visualY: 7, value: 2, size: 1 };
    dx = 1; dy = 0; nextDx = 1; nextDy = 0;
    isGameOver = false;
    isFirstScreen = false;
    popScale = 1.0;
    updateDifficulty();
    spawnItems();
    
    overlay.classList.add('hidden');
    
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    startBGM();
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// --- 変更後のコード案2 ---
function updateDifficulty() {
    const level = Math.log2(player.value);
    
    // 1レベル上がるごとの減少幅を 10 から 4 に小さくする
    moveInterval = Math.max(80, baseMoveInterval - (level - 1) * 4);
    
    // ... その他の処理
}

function getPlayerCells(pX, pY, pSize) {
    let cells = [];
    for (let x = 0; x < pSize; x++) {
        for (let y = 0; y < pSize; y++) {
            cells.push({ x: pX + x, y: pY + y });
        }
    }
    return cells;
}

function spawnItems() {
    items = [];
    let emptyCells = [];
    const currentPCells = getPlayerCells(player.x, player.y, player.size);

    // プレイヤーの周囲2マスを安全地帯（セーフゾーン）にする
    const safeDistance = 2; 

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const isOccupied = currentPCells.some(cell => cell.x === c && cell.y === r);
            
            // プレイヤーからの距離を計測
            const distX = Math.abs(c - player.x);
            const distY = Math.abs(r - player.y);
            const isTooClose = Math.max(distX, distY) <= safeDistance;

            // 自機の上や、すぐ隣・目の前にはスポーンさせない
            if (!isOccupied && !isTooClose) {
                emptyCells.push({ x: c, y: r });
            }
        }
    }

    // 盤面が狭まってセーフゾーンが確保できない場合のセーフティガード
    if (emptyCells.length < 15) {
        emptyCells = [];
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const isOccupied = currentPCells.some(cell => cell.x === c && cell.y === r);
                if (!isOccupied) emptyCells.push({ x: c, y: r });
            }
        }
    }

    function getRandomCell() {
        const index = Math.floor(Math.random() * emptyCells.length);
        return emptyCells.splice(index, 1)[0];
    }

    for (let i = 0; i < 3; i++) {
        if (emptyCells.length > 0) {
            const targetCell = getRandomCell();
            items.push({ x: targetCell.x, y: targetCell.y, value: player.value, type: 'target' });
        }
    }

    const level = Math.log2(player.value);
    const obstacleCount = Math.min(10, 2 + level);
    const possibleValues = [2, 4, 8, 16, 32, 64, 128, 256].filter(v => v !== player.value);
    
    for (let i = 0; i < obstacleCount; i++) {
        if (emptyCells.length > 0) {
            const obsCell = getRandomCell();
            const randomValue = possibleValues[Math.floor(Math.random() * possibleValues.length)];
            items.push({ x: obsCell.x, y: obsCell.y, value: randomValue, type: 'obstacle' });
        }
    }
}

function update() {
    if (isGameOver) return;

    dx = nextDx; dy = nextDy;
    player.x += dx; player.y += dy;

    const pCells = getPlayerCells(player.x, player.y, player.size);

    const hitWall = pCells.some(cell => cell.x < 0 || cell.x >= gridSize || cell.y < 0 || cell.y >= gridSize);
    if (hitWall) {
        gameOver(); return;
    }

    let hitIndex = -1;
    for (let cell of pCells) {
        hitIndex = items.findIndex(item => item.x === cell.x && item.y === cell.y);
        if (hitIndex !== -1) break;
    }

    if (hitIndex !== -1) {
        const hitItem = items[hitIndex];
        if (hitItem.type === 'target') {
            player.value *= 2;
            popScale = 1.4; 
            playSound('eat');
            updateDifficulty(); 
            spawnItems();       
        } else {
            gameOver();
        }
    }
}

function gameOver() {
    isGameOver = true;
    stopBGM();
    playSound('crash'); 
    overlay.classList.remove('hidden');
    overlayTitle.innerHTML = `<span style="color:#ef4444; text-shadow: 0 0 15px rgba(239,68,68,0.7);">SYSTEM FAILURE</span>\n(FINAL SCORE: ${player.value})`;
    startBtn.innerText = "コア再起動";
    startBtn.style.backgroundColor = "#ef4444";
    startBtn.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.4)";
}

function drawShape(ctx, cx, cy, size, shapeType, color) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; 
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const r = size / 2 - 2;
    ctx.beginPath();

    switch (shapeType) {
        case 'circle':
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            break;
        case 'diamond':
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx, cy + r);
            ctx.lineTo(cx - r, cy);
            ctx.closePath();
            break;
        case 'triangle':
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx + r, cy + r * 0.8);
            ctx.lineTo(cx - r, cy + r * 0.8);
            ctx.closePath();
            break;
        case 'invTriangle':
            ctx.moveTo(cx, cy + r);
            ctx.lineTo(cx + r, cy - r * 0.8);
            ctx.lineTo(cx - r, cy - r * 0.8);
            ctx.closePath();
            break;
        case 'square':
            ctx.rect(cx - r, cy - r, r * 2, r * 2);
            break;
        case 'cross':
            const w = r * 0.4;
            ctx.moveTo(cx - w, cy - r);
            ctx.lineTo(cx + w, cy - r); ctx.lineTo(cx + w, cy - w);
            ctx.lineTo(cx + r, cy - w); ctx.lineTo(cx + r, cy + w);
            ctx.lineTo(cx + w, cy + w); ctx.lineTo(cx + w, cy + r);
            ctx.lineTo(cx - w, cy + r); ctx.lineTo(cx - w, cy + w);
            ctx.lineTo(cx - r, cy + w); ctx.lineTo(cx - r, cy - w);
            ctx.lineTo(cx - w, cy - w);
            ctx.closePath();
            break;
        case 'hexagon':
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            }
            ctx.closePath();
            break;
        case 'star':
            for (let i = 0; i < 10; i++) {
                const angle = (Math.PI / 5) * i;
                const currR = i % 2 === 0 ? r : r * 0.4;
                ctx.lineTo(cx + currR * Math.cos(angle), cy + currR * Math.sin(angle));
            }
            ctx.closePath();
            break;
        case 'ring':
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
            break;
        case 'hourglass':
            ctx.moveTo(cx - r, cy - r);
            ctx.lineTo(cx + r, cy - r);
            ctx.lineTo(cx - r, cy + r);
            ctx.lineTo(cx + r, cy + r);
            ctx.closePath();
            break;
        default: 
            ctx.rect(cx - r, cy - r, r * 2, r * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
}

function drawPlayerBlock(x, y, value, size, scale = 1.0) {
    const sh = shapes[value] || { type: 'nexus', color: '#ffffff' };
    const totalWidth = size * tileSize;
    const cx = x * tileSize + totalWidth / 2;
    const cy = y * tileSize + totalWidth / 2;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.shadowBlur = 20;
    ctx.shadowColor = sh.color;

    drawShape(ctx, cx, cy, totalWidth, sh.type, sh.color);
    
    ctx.restore();
}

function drawNormalBlock(x, y, value) {
    const sh = shapes[value] || { type: 'nexus', color: '#ffffff' };
    const cx = x * tileSize + tileSize / 2;
    const cy = y * tileSize + tileSize / 2;
    
    ctx.save();
    if (value === player.value) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = sh.color;
    }

    drawShape(ctx, cx, cy, tileSize, sh.type, sh.color);
    
    if (value === player.value) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.restore();
}

function draw() {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    for (let i = 0; i < gridSize; i++) {
        ctx.beginPath(); ctx.moveTo(i * tileSize, 0); ctx.lineTo(i * tileSize, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * tileSize); ctx.lineTo(canvas.width, i * tileSize); ctx.stroke();
    }

    items.forEach(item => drawNormalBlock(item.x, item.y, item.value));

    player.visualX += (player.x - player.visualX) * 0.35;
    player.visualY += (player.y - player.visualY) * 0.35;

    if (popScale > 1.0) popScale = Math.max(1.0, popScale - 0.08);
    
    drawPlayerBlock(player.visualX, player.visualY, player.value, player.size, popScale);
}

function gameLoop(timestamp) {
    if (isGameOver) return;
    if (timestamp - lastTime >= moveInterval) {
        update();
        lastTime = timestamp;
    }
    draw();
    requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (e) => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    if (e.key === ' ' || e.code === 'Space') {
        if (isFirstScreen || isGameOver) {
            initGame();
            return;
        }
    }

    switch (e.key) {
        case 'ArrowUp':    if (dy !== 1)  { nextDx = 0; nextDy = -1; dx = 0; dy = -1; } break;
        case 'ArrowDown':  if (dy !== -1) { nextDx = 0; nextDy = 1;  dx = 0; dy = 1;  } break;
        case 'ArrowLeft':  if (dx !== 1)  { nextDx = -1; nextDy = 0; dx = -1; dy = 0; } break;
        case 'ArrowRight': if (dx !== -1) { nextDx = 1; nextDy = 0;  dx = 1; dy = 0;  } break;
    }
});

startBtn.addEventListener('click', initGame);
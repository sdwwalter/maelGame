// Configurações Globais e Áudio
let currentHero = localStorage.getItem('aventura_hero') || '🐶';
let highScore = parseInt(localStorage.getItem('aventura_highscore')) || 0;

// Sistema de Áudio (Web Audio API)
const AudioSys = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    playTone(freq, type, duration, vol=0.1) {
        if(this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    jump() { this.playTone(400, 'sine', 0.2, 0.2); setTimeout(()=>this.playTone(600, 'sine', 0.2, 0.2), 100); },
    coin() { this.playTone(800, 'sine', 0.1, 0.1); setTimeout(()=>this.playTone(1200, 'sine', 0.3, 0.1), 100); },
    crash() { this.playTone(100, 'sawtooth', 0.5, 0.3); },
    win() { this.playTone(400, 'sine', 0.1); setTimeout(()=>this.playTone(500, 'sine', 0.1), 150); setTimeout(()=>this.playTone(600, 'sine', 0.3), 300); }
};

// Navegação de Telas
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id !== 'screen-race') raceState.active = false;
    if (id !== 'screen-blocks') clearInterval(blocksInterval);
    if (id !== 'screen-memory') clearInterval(memoryTimer);
}

function setHero(emoji) {
    currentHero = emoji;
    localStorage.setItem('aventura_hero', currentHero);
    document.getElementById('race-hero').textContent = emoji;
    showScreen('screen-menu');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('race-hero').textContent = currentHero;
});

// Vibração
function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ===== LÓGICA DA CORRIDA (SUBWAY STYLE + POOLING) =====
let reqAnimFrame;
let raceState = {
    active: false,
    lane: 1, // 0: Esquerda, 1: Centro, 2: Direita
    jumping: false,
    lives: 3,
    score: 0,
    distance: 0,
    speed: 5,
    lastTime: 0,
    nextObjDist: 20
};

// Object Pool para performance
const MAX_POOL_SIZE = 15;
const objPool = [];

function initPool() {
    const container = document.getElementById('race-container');
    for(let i=0; i<MAX_POOL_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'game-obj';
        container.appendChild(el);
        objPool.push({ el, active: false, type: '', lane: 0, progress: 0, emoji: '' });
    }
}
window.addEventListener('load', initPool);

function getFreeObj() {
    return objPool.find(o => !o.active);
}

function initRace() {
    raceState = {
        active: true,
        lane: 1,
        jumping: false,
        lives: 3,
        score: 0,
        distance: 0,
        speed: 0.8, // Velocidade base do progresso
        lastTime: performance.now(),
        nextObjDist: 5 // Distância para próximo spawn
    };
    updateRaceUI();
    updateHeroPos();
    
    // Limpar ativos do pool
    objPool.forEach(o => { o.active = false; o.el.style.display = 'none'; });
    
    showScreen('screen-race');
    if(reqAnimFrame) cancelAnimationFrame(reqAnimFrame);
    reqAnimFrame = requestAnimationFrame(runRace);
}

function moveLane(dir) {
    if (!raceState.active) return;
    raceState.lane = Math.max(0, Math.min(2, raceState.lane + dir));
    updateHeroPos();
}

function updateHeroPos() {
    const hero = document.getElementById('race-hero');
    const positions = ['20%', '50%', '80%'];
    hero.style.left = positions[raceState.lane];
}

function jump() {
    if (!raceState.active || raceState.jumping) return;
    raceState.jumping = true;
    AudioSys.jump();
    const hero = document.getElementById('race-hero');
    hero.classList.add('jumping');
    setTimeout(() => {
        raceState.jumping = false;
        hero.classList.remove('jumping');
    }, 500);
}

function runRace(timestamp) {
    if (!raceState.active) return;
    
    const dt = (timestamp - raceState.lastTime) / 1000; // delta time em segs
    raceState.lastTime = timestamp;

    raceState.distance += raceState.speed * dt * 10;
    raceState.speed += 0.005 * dt; // Aceleração gradual

    // Spawn
    if (raceState.distance > raceState.nextObjDist) {
        spawnObject();
        raceState.nextObjDist = raceState.distance + (Math.random() * 15 + 10) / raceState.speed;
    }

    // Update Objects
    objPool.forEach((obj) => {
        if(!obj.active) return;

        obj.progress += raceState.speed * dt * 0.8;
        
        // Perspectiva
        const scale = 0.1 + (obj.progress * 1.5);
        const y = 40 + (obj.progress * 410);
        const laneX = [20, 50, 80][obj.lane];
        const centerX = 50;
        const x = centerX + (laneX - centerX) * (0.2 + obj.progress * 0.8);

        obj.el.style.top = y + 'px';
        obj.el.style.left = x + '%';
        obj.el.style.transform = `translate(-50%, -50%) scale(${scale})`;

        // Colisão (sweet spot: progress ~ 0.9)
        if (obj.progress > 0.85 && obj.progress < 0.95) {
            if (obj.lane === raceState.lane) {
                if (obj.type === 'star') {
                    raceState.score += 10;
                    AudioSys.coin();
                    obj.active = false;
                    obj.el.style.display = 'none';
                    updateRaceUI();
                } else if (obj.type === 'obs') {
                    const canJump = obj.emoji === '🪨' || obj.emoji === '📦';
                    if (!(canJump && raceState.jumping)) {
                        hitObstacle();
                        obj.active = false;
                        obj.el.style.display = 'none';
                    }
                }
            }
        }

        // Passou da tela
        if (obj.progress > 1.1) {
            obj.active = false;
            obj.el.style.display = 'none';
        }
    });

    reqAnimFrame = requestAnimationFrame(runRace);
}

function spawnObject() {
    const obj = getFreeObj();
    if(!obj) return; // Pool cheio

    const type = Math.random() > 0.4 ? 'obs' : 'star';
    const lane = Math.floor(Math.random() * 3);
    const emojis = type === 'star' ? ['⭐', '🍎', '🍌'] : ['🪨', '📦', '🚧', '🌵'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    obj.active = true;
    obj.type = type;
    obj.lane = lane;
    obj.progress = 0;
    obj.emoji = emoji;
    obj.el.innerHTML = `<span style="font-size: 3rem;">${emoji}</span>`;
    obj.el.style.display = 'block';
    obj.el.style.opacity = 1;
}

function hitObstacle() {
    raceState.lives--;
    AudioSys.crash();
    vibrate(200);
    updateRaceUI();
    const container = document.getElementById('race-container');
    container.style.filter = 'brightness(2) saturate(2) hue-rotate(90deg)';
    setTimeout(() => container.style.filter = '', 150);

    if (raceState.lives <= 0) {
        endRace();
    }
}

function updateRaceUI() {
    document.getElementById('race-lives').textContent = raceState.lives;
    document.getElementById('race-score').textContent = raceState.score;
}

function endRace() {
    raceState.active = false;
    cancelAnimationFrame(reqAnimFrame);
    
    if(raceState.score > highScore) {
        highScore = raceState.score;
        localStorage.setItem('aventura_highscore', highScore);
    }
    
    document.getElementById('final-stars').textContent = raceState.score;
    document.getElementById('final-dist').textContent = Math.floor(raceState.distance) + 'm';
    showScreen('screen-race-over');
}

// Swipes para Corrida
let touchStartX = 0;
let touchStartY = 0;
const raceContainer = document.getElementById('race-container');

raceContainer.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: true});

raceContainer.addEventListener('touchend', e => {
    if(!raceState.active) return;
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;
    
    if(Math.abs(dx) > Math.abs(dy)) {
        // Horizontal
        if(Math.abs(dx) > 30) {
            if(dx > 0) moveLane(1);
            else moveLane(-1);
        }
    } else {
        // Vertical
        if(dy < -30) jump(); // Swipe Up
    }
}, {passive: true});

// ===== SISTEMA DE MODAL =====
let quitAction = null;
function quitGame() {
    raceState.active = false;
    showModal("Parar a Corrida?", "Quer desistir agora e voltar ao menu?", () => {
        showScreen('screen-menu');
    });
}

function showModal(title, text, action) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    document.getElementById('modal-overlay').style.display = 'flex';
    quitAction = action;
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    if (document.getElementById('screen-race').classList.contains('active')) {
        raceState.lastTime = performance.now(); // Reset delta
        raceState.active = true;
        reqAnimFrame = requestAnimationFrame(runRace);
    }
}

function confirmQuit() {
    document.getElementById('modal-overlay').style.display = 'none';
    if (quitAction) quitAction();
}

// ===== JOGO DA MEMÓRIA =====
let memoryTimer;
let memorySeconds = 0;
let memoryPairs = 0;

function initMemory() {
    const emojis = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'];
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    
    memorySeconds = 0;
    memoryPairs = 0;
    document.getElementById('memory-time').textContent = '0s';
    if(memoryTimer) clearInterval(memoryTimer);
    memoryTimer = setInterval(() => {
        memorySeconds++;
        document.getElementById('memory-time').textContent = memorySeconds + 's';
    }, 1000);

    let flipped = [];
    cards.forEach((emoji, i) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `<span>${emoji}</span>`;
        
        card.onclick = () => {
            if (flipped.length < 2 && !card.classList.contains('flipped') && !card.classList.contains('matched')) {
                card.classList.add('flipped');
                AudioSys.playTone(300, 'sine', 0.1);
                flipped.push({emoji, el: card});
                if (flipped.length === 2) {
                    if (flipped[0].emoji === flipped[1].emoji) {
                        AudioSys.coin();
                        setTimeout(() => {
                            flipped[0].el.classList.add('matched');
                            flipped[1].el.classList.add('matched');
                            flipped = [];
                            memoryPairs++;
                            if(memoryPairs === emojis.length) {
                                clearInterval(memoryTimer);
                                AudioSys.win();
                                setTimeout(() => {
                                    alert(`Parabéns! Você completou em ${memorySeconds} segundos!`);
                                    showScreen('screen-menu');
                                }, 500);
                            }
                        }, 500);
                    } else {
                        setTimeout(() => {
                            flipped.forEach(f => f.el.classList.remove('flipped'));
                            flipped = [];
                        }, 1000);
                    }
                }
            }
        };
        grid.appendChild(card);
    });
    showScreen('screen-memory');
}

// ===== JOGO DE BLOCOS (TETRIS SIMPLIFICADO) =====
const canvas = document.getElementById('blocks-canvas');
const ctx = canvas.getContext('2d');
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24; // 240/10

let board = [];
let piece;
let blocksInterval;

const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,0,0],[1,1,1]], // L
    [[0,0,1],[1,1,1]], // J
    [[0,1,1],[1,1,0]], // S
    [[1,1,0],[0,1,1]]  // Z
];
const COLORS = ['#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

function createBoard() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
}

function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawBoard() {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for(let r=0; r<ROWS; r++){
        for(let c=0; c<COLS; c++){
            if(board[r][c]){
                drawBlock(c, r, board[r][c]);
            }
        }
    }
    
    if(piece) {
        piece.shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if(value) drawBlock(piece.x + c, piece.y + r, piece.color);
            });
        });
    }
}

function newPiece() {
    const idx = Math.floor(Math.random() * SHAPES.length);
    piece = {
        shape: SHAPES[idx],
        color: COLORS[idx],
        x: Math.floor(COLS/2) - 1,
        y: 0
    };
    if(checkCollision()) {
        // Game Over Blocos
        clearInterval(blocksInterval);
        alert('Fim de Jogo!');
        quitBlocks();
    }
}

function checkCollision(dx=0, dy=0, shape=piece.shape) {
    for(let r=0; r<shape.length; r++){
        for(let c=0; c<shape[r].length; c++){
            if(!shape[r][c]) continue;
            let newX = piece.x + c + dx;
            let newY = piece.y + r + dy;
            if(newX < 0 || newX >= COLS || newY >= ROWS) return true;
            if(newY >= 0 && board[newY][newX]) return true;
        }
    }
    return false;
}

function merge() {
    piece.shape.forEach((row, r) => {
        row.forEach((value, c) => {
            if(value) board[piece.y + r][piece.x + c] = piece.color;
        });
    });
}

function clearLines() {
    let linesCleared = 0;
    for(let r=ROWS-1; r>=0; r--){
        if(board[r].every(cell => cell !== 0)){
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            r++; // recheck this row
        }
    }
    if(linesCleared > 0) AudioSys.coin();
}

function moveBlock(dir) {
    if(!piece) return;
    if(!checkCollision(dir, 0)) {
        piece.x += dir;
        drawBoard();
    }
}

function rotateBlock() {
    if(!piece) return;
    const rotated = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
    if(!checkCollision(0, 0, rotated)) {
        piece.shape = rotated;
        drawBoard();
    }
}

function dropBlock() {
    if(!piece) return;
    if(!checkCollision(0, 1)) {
        piece.y++;
    } else {
        merge();
        clearLines();
        newPiece();
        AudioSys.playTone(150, 'square', 0.1);
    }
    drawBoard();
}

function initBlocks() {
    createBoard();
    newPiece();
    showScreen('screen-blocks');
    if(blocksInterval) clearInterval(blocksInterval);
    blocksInterval = setInterval(dropBlock, 800);
    drawBoard();
}

function quitBlocks() { 
    clearInterval(blocksInterval);
    showScreen('screen-menu'); 
}

// Teclado Unificado
window.addEventListener('keydown', e => {
    if (raceState.active) {
        if (e.key === 'ArrowLeft') moveLane(-1);
        if (e.key === 'ArrowRight') moveLane(1);
        if (e.key === ' ' || e.key === 'ArrowUp') jump();
    } else if (document.getElementById('screen-blocks').classList.contains('active')) {
        if (e.key === 'ArrowLeft') moveBlock(-1);
        if (e.key === 'ArrowRight') moveBlock(1);
        if (e.key === 'ArrowUp') rotateBlock();
        if (e.key === 'ArrowDown') dropBlock();
    }
});

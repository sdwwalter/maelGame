// ========== AVENTURA KIDS - VERSÃO ESPETACULAR ==========
// Sistemas: Progressão Global, Moedas, Gemas, Diárias, Loja, Efeitos

// ---- DADOS PERSISTENTES (LocalStorage) ----
const GameData = {
    _data: JSON.parse(localStorage.getItem('ak_data')) || {
        level: 1, xp: 0, coins: 0, gems: 5,
        streak: 0, lastLogin: null,
        missions: {}, missionsDate: null,
        skins: { '🐶': true, '🦁': false, '🦖': false, '🦊': false },
        equippedSkin: '🐶',
        unlocks: { flappy: true, blocks: true, memory: true, piano: true }
    },
    save() { localStorage.setItem('ak_data', JSON.stringify(this._data)); },
    get() { return this._data; },
    addCoins(amount) { this._data.coins += amount; this.save(); },
    addGems(amount) { this._data.gems += amount; this.save(); },
    addXP(amount) {
        this._data.xp += amount;
        const xpNeeded = this.xpForLevel(this._data.level + 1);
        if (this._data.xp >= xpNeeded) {
            this._data.xp -= xpNeeded;
            this._data.level++;
            this._data.gems += 3; // recompensa de nível
            showLevelUp();
            AudioSys.levelUp();
        }
        this.save();
        updateHUD();
    },
    xpForLevel(lv) { return Math.floor(100 * Math.pow(1.5, lv - 1)); }
};

// ---- ÁUDIO APRIMORADO (Web Audio) ----
const AudioSys = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    playTone(freq, type, duration, vol=0.1, detune=0) {
        if(this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.detune.setValueAtTime(detune, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    jump() { this.playTone(400, 'sine', 0.15, 0.2); setTimeout(()=>this.playTone(600, 'sine', 0.15, 0.2), 80); },
    coin() { this.playTone(800, 'sine', 0.1, 0.08); setTimeout(()=>this.playTone(1200, 'sine', 0.2, 0.08), 70); },
    crash() { this.playTone(100, 'sawtooth', 0.6, 0.3); this.playTone(80, 'square', 0.2, 0.4); },
    win() { [400,600,800,1000].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.1,0.2), i*100)); },
    flap() { this.playTone(300, 'triangle', 0.1, 0.1); },
    levelUp() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.15,0.3), i*120)); },
    rareFound() { [880,1100,1320].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.15,0.2), i*80)); }
};

// ---- EFEITOS VISUAIS ----
function showLevelUp() {
    const div = document.createElement('div');
    div.className = 'level-up-toast';
    div.textContent = `🎉 Nível ${GameData.get().level}! +3 Gemas`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
    screenShake();
    spawnEmojiRain('✨');
}

function screenShake() {
    const container = document.querySelector('.game-container');
    container.style.animation = 'shake 0.4s ease';
    setTimeout(() => container.style.animation = '', 400);
}

function spawnEmojiRain(emoji) {
    for(let i=0; i<12; i++) {
        const particle = document.createElement('div');
        particle.className = 'emoji-particle';
        particle.textContent = emoji;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (1 + Math.random() * 1.5) + 's';
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 2000);
    }
}

function showFloatingText(x, y, text, color='#FFD700') {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ---- HUD (Barra Superior Global) ----
function updateHUD() {
    const data = GameData.get();
    const lvEl = document.getElementById('hud-level');
    const xpEl = document.getElementById('hud-xp-bar');
    const coinEl = document.getElementById('hud-coins');
    const gemEl = document.getElementById('hud-gems');
    if(!lvEl) return;
    lvEl.textContent = 'Nv.' + data.level;
    const xpNeed = GameData.xpForLevel(data.level + 1);
    xpEl.style.width = (data.xp / xpNeed * 100) + '%';
    coinEl.textContent = data.coins;
    gemEl.textContent = data.gems;
}

// ---- SISTEMA DIÁRIO (Streak & Diárias) ----
function checkDaily() {
    const data = GameData.get();
    const today = new Date().toDateString();
    if (data.lastLogin !== today) {
        data.streak = (data.lastLogin && new Date(data.lastLogin) > new Date(Date.now() - 48*60*60*1000)) ? data.streak + 1 : 1;
        data.lastLogin = today;
        GameData.save();
        dailyRewardPopup();
        generateDailyMissions();
    }
}

function dailyRewardPopup() {
    const streak = GameData.get().streak;
    const rewards = [0, 50, 75, 100, 150, 200, 300]; // moedas
    const gems = [0, 1, 2, 3, 5, 7, 10];
    const idx = Math.min(streak, 7);
    const coinsEarned = rewards[idx];
    const gemsEarned = gems[idx];
    GameData.addCoins(coinsEarned);
    if(gemsEarned) GameData.addGems(gemsEarned);
    
    document.getElementById('daily-streak').textContent = streak;
    document.getElementById('daily-coins').textContent = coinsEarned;
    document.getElementById('daily-gems').textContent = gemsEarned;
    showScreen('screen-daily');
}

// ---- MISSÕES DIÁRIAS ----
const MISSION_POOL = [
    { id: 'race1', desc: 'Jogue 1 Corrida', target: 1, reward: 30, check: (s) => s.race >= 1 },
    { id: 'race3', desc: 'Corra 3 vezes', target: 3, reward: 80, check: (s) => s.race >= 3 },
    { id: 'flappy1', desc: 'Jogue Flappy 1 vez', target: 1, reward: 40, check: (s) => s.flappy >= 1 },
    { id: 'memory1', desc: 'Complete o Memória', target: 1, reward: 60, check: (s) => s.memory >= 1 },
    { id: 'blocks1', desc: 'Jogue Blocos', target: 1, reward: 50, check: (s) => s.blocks >= 1 },
    { id: 'coins50', desc: 'Consiga 50 moedas', target: 50, reward: 70, check: (s) => s.coinsEarned >= 50 }
];

function generateDailyMissions() {
    const data = GameData.get();
    data.missionsDate = new Date().toDateString();
    const shuffled = MISSION_POOL.sort(()=>Math.random()-0.5);
    data.missions = shuffled.slice(0, 3).map(m => ({...m, progress: 0, completed: false}));
    GameData.save();
    updateMissionDisplay();
}

function updateMissionProgress(id, amount=1) {
    const data = GameData.get();
    if (data.missionsDate !== new Date().toDateString()) return;
    const mission = data.missions?.find(m => m.id === id);
    if (mission && !mission.completed) {
        mission.progress += amount;
        if (mission.progress >= mission.target) {
            mission.completed = true;
            GameData.addCoins(mission.reward);
            showFloatingText(window.innerWidth/2, 100, `+${mission.reward} 🪙`);
        }
        GameData.save();
        updateMissionDisplay();
    }
}

function updateMissionDisplay() {
    const container = document.getElementById('missions-list');
    if (!container) return;
    const missions = GameData.get().missions || [];
    container.innerHTML = missions.map(m => 
        `<div class="mission-item ${m.completed ? 'completed' : ''}">
            <span>${m.desc}</span>
            <span>${m.completed ? '✅' : m.progress+'/'+m.target}</span>
            <span>+${m.reward}🪙</span>
        </div>`
    ).join('');
}

// ---- LOJA (Skins e Upgrades) ----
function openShop() {
    renderShop();
    showScreen('screen-shop');
}

function renderShop() {
    const allSkins = ['🐶','🦁','🦖','🦊'];
    const data = GameData.get();
    const container = document.getElementById('shop-items');
    container.innerHTML = allSkins.map(s => {
        const owned = data.skins[s];
        const equipped = data.equippedSkin === s;
        const cost = s === '🐶' ? 0 : 200;
        return `<div class="shop-skin ${equipped ? 'equipped' : ''}">
            <div class="skin-emoji">${s}</div>
            ${owned ? (equipped ? '<button class="btn btn-small" disabled>Usando</button>' : '<button class="btn btn-small btn-primary" onclick="equipSkin(\''+s+'\')">Usar</button>') : 
            '<button class="btn btn-small btn-success" onclick="buySkin(\''+s+'\')">Comprar 🪙'+cost+'</button>'}
        </div>`;
    }).join('');
}

function buySkin(skin) {
    const data = GameData.get();
    if (data.coins >= 200 && !data.skins[skin]) {
        GameData.addCoins(-200);
        data.skins[skin] = true;
        equipSkin(skin);
        renderShop();
        AudioSys.coin();
    } else {
        alert('Moedas insuficientes!');
    }
}

function equipSkin(skin) {
    GameData.get().equippedSkin = skin;
    GameData.save();
    currentHero = skin;
    // Atualiza todos os heróis visíveis
    document.querySelectorAll('.hero-display').forEach(el => el.textContent = skin);
    document.getElementById('race-hero').textContent = skin;
    document.getElementById('flappy-hero').textContent = skin;
    renderShop();
}

// ---- NAVEGAÇÃO DE TELAS ----
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    updateHUD();
    // Parar loops ativos
    if (id !== 'screen-race') raceState.active = false;
    if (id !== 'screen-flappy') flappyState.active = false;
    clearInterval(blocksInterval);
    clearInterval(memoryTimer);
    if(reqAnimFrame) cancelAnimationFrame(reqAnimFrame);
    if(flappyAnimFrame) cancelAnimationFrame(flappyAnimFrame);
}

// ---- HERÓI GLOBAL ----
let currentHero = GameData.get().equippedSkin || '🐶';
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.hero-display').forEach(el => el.textContent = currentHero);
    document.getElementById('race-hero').textContent = currentHero;
    document.getElementById('flappy-hero').textContent = currentHero;
    checkDaily();
    updateHUD();
});

// ===== CORRIDA (SUBWAY STYLE) =====
let reqAnimFrame;
let raceState = {
    active: false, lane: 1, jumping: false, lives: 3, score: 0, distance: 0, speed: 0.8, lastTime: 0, nextObjDist: 5,
    coinsCollected: 0, powerUp: null
};
const objPool = [];
const MAX_POOL = 20;

function initPool() {
    const container = document.getElementById('race-container');
    for(let i=0; i<MAX_POOL; i++) {
        const el = document.createElement('div');
        el.className = 'game-obj';
        container.appendChild(el);
        objPool.push({ el, active: false, type: '', lane: 0, progress: 0, emoji: '' });
    }
}
window.addEventListener('load', initPool);
function getFreeObj() { return objPool.find(o => !o.active); }

function initRace() {
    raceState = {
        active: true, lane: 1, jumping: false, lives: 3, score: 0, distance: 0, speed: 1.2, lastTime: performance.now(), nextObjDist: 6,
        coinsCollected: 0, powerUp: null
    };
    document.getElementById('race-lives').textContent = '❤️❤️❤️';
    document.getElementById('race-score').textContent = '0';
    updateHeroPos();
    objPool.forEach(o => { o.active = false; o.el.style.display = 'none'; });
    showScreen('screen-race');
    updateHUD();
    reqAnimFrame = requestAnimationFrame(runRace);
}

function moveLane(dir) { if(raceState.active) { raceState.lane = Math.max(0, Math.min(2, raceState.lane + dir)); updateHeroPos(); } }
function updateHeroPos() { document.getElementById('race-hero').style.left = ['20%','50%','80%'][raceState.lane]; }

function jump() {
    if(!raceState.active || raceState.jumping) return;
    raceState.jumping = true;
    AudioSys.jump();
    document.getElementById('race-hero').classList.add('jumping');
    setTimeout(() => { raceState.jumping = false; document.getElementById('race-hero').classList.remove('jumping'); }, 450);
}

function runRace(ts) {
    if(!raceState.active) return;
    const dt = Math.min((ts - raceState.lastTime) / 1000, 0.1);
    raceState.lastTime = ts;
    raceState.distance += raceState.speed * dt * 12;
    raceState.speed += 0.01 * dt;
    if(raceState.powerUp) {
        raceState.powerUp.duration -= dt;
        if(raceState.powerUp.duration <= 0) raceState.powerUp = null;
    }

    if(raceState.distance > raceState.nextObjDist) {
        spawnObject();
        raceState.nextObjDist = raceState.distance + (Math.random() * 14 + 8) / raceState.speed;
    }

    objPool.forEach(obj => {
        if(!obj.active) return;
        obj.progress += raceState.speed * dt * 0.7;
        const y = 35 + (obj.progress * 430);
        const laneX = [20,50,80][obj.lane];
        obj.el.style.top = y + 'px';
        obj.el.style.left = laneX + '%';
        obj.el.style.transform = `translate(-50%, -50%) scale(${0.1 + obj.progress * 1.5})`;

        if(obj.progress > 0.8 && obj.progress < 0.95 && obj.lane === raceState.lane) {
            if(obj.type === 'coin') {
                raceState.coinsCollected++;
                raceState.score += 5;
                GameData.addCoins(1);
                AudioSys.coin();
                document.getElementById('race-score').textContent = raceState.score;
                obj.active = false; obj.el.style.display = 'none';
                showFloatingText(obj.el.offsetLeft, obj.el.offsetTop, '+1🪙');
            } else if(obj.type === 'gem') {
                raceState.coinsCollected += 5;
                raceState.score += 25;
                GameData.addGems(1);
                AudioSys.rareFound();
                document.getElementById('race-score').textContent = raceState.score;
                obj.active = false; obj.el.style.display = 'none';
                showFloatingText(obj.el.offsetLeft, obj.el.offsetTop, '+1💎', '#0ff');
                spawnEmojiRain('💎');
            } else if(obj.type === 'obs' && !raceState.powerUp) {
                const canJump = obj.emoji === '🪨' || obj.emoji === '📦';
                if(!(canJump && raceState.jumping)) {
                    hitObstacle();
                    obj.active = false; obj.el.style.display = 'none';
                }
            } else if(obj.type === 'power') {
                // Power-up: invencibilidade temporária
                raceState.powerUp = { type: obj.emoji, duration: 5 };
                AudioSys.flap();
                obj.active = false; obj.el.style.display = 'none';
                spawnEmojiRain(obj.emoji);
            }
        }
        if(obj.progress > 1.15) { obj.active = false; obj.el.style.display = 'none'; }
    });
    reqAnimFrame = requestAnimationFrame(runRace);
}

function spawnObject() {
    const obj = getFreeObj();
    if(!obj) return;
    const rand = Math.random();
    let type, emoji;
    if(rand < 0.05) { type = 'gem'; emoji = '💎'; }
    else if(rand < 0.15) { type = 'power'; emoji = '⚡'; }
    else if(rand < 0.55) { type = 'coin'; emoji = '🪙'; }
    else { type = 'obs'; emoji = ['🪨','📦','🚧','🌵'][Math.floor(Math.random()*4)]; }
    const lane = Math.floor(Math.random()*3);
    obj.active = true; obj.type = type; obj.lane = lane; obj.progress = 0; obj.emoji = emoji;
    obj.el.innerHTML = `<span style="font-size: 3rem;">${emoji}</span>`;
    obj.el.style.display = 'block';
}

function hitObstacle() {
    raceState.lives--;
    AudioSys.crash(); screenShake();
    document.getElementById('race-lives').textContent = '❤️'.repeat(raceState.lives) + '🖤'.repeat(3-raceState.lives);
    if(raceState.lives <= 0) endRace();
}

function endRace() {
    raceState.active = false;
    cancelAnimationFrame(reqAnimFrame);
    const ds = Math.floor(raceState.distance);
    const coins = raceState.coinsCollected;
    // Recompensas
    const xpEarned = Math.floor(ds / 5) + coins;
    GameData.addXP(xpEarned);
    GameData.addCoins(Math.floor(coins * 0.5));
    updateMissionProgress('race1', 1);
    updateMissionProgress('race3', 1);
    updateMissionProgress('coins50', coins);
    document.getElementById('final-score').textContent = `⭐ ${raceState.score} | 🏃 ${ds}m | 🪙 +${Math.floor(coins*0.5)}`;
    showScreen('screen-race-over');
}

// Swipes Corrida (touch)
const raceContainer = document.getElementById('race-container');
raceContainer.addEventListener('touchstart', e => {
    if(!raceState.active) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: true});
raceContainer.addEventListener('touchend', e => {
    if(!raceState.active) return;
    let dx = e.changedTouches[0].screenX - touchStartX;
    let dy = e.changedTouches[0].screenY - touchStartY;
    if(Math.abs(dx) > Math.abs(dy)) { if(Math.abs(dx) > 30) moveLane(dx > 0 ? 1 : -1); }
    else { if(dy < -30) jump(); }
}, {passive: true});

// ===== FLAPPY PET =====
let flappyState = { active: false, y: 50, vel: 0, gravity: 180, jump: -55, score: 0, pipes: [], lastTime: 0 };
let flappyAnimFrame;

function initFlappy() {
    flappyState = { active: true, y: 50, vel: 0, gravity: 180, jump: -55, score: 0, pipes: [], lastTime: performance.now() };
    document.getElementById('flappy-score').textContent = '0';
    document.getElementById('flappy-hero').style.top = '50%';
    document.querySelectorAll('.flappy-pipe').forEach(p => p.remove());
    showScreen('screen-flappy');
    flappyAnimFrame = requestAnimationFrame(runFlappy);
}

function flap() {
    if(!flappyState.active) return;
    flappyState.vel = flappyState.jump;
    AudioSys.flap();
}

function runFlappy(ts) {
    if(!flappyState.active) return;
    const dt = Math.min((ts - flappyState.lastTime) / 1000, 0.1);
    flappyState.lastTime = ts;
    flappyState.vel += flappyState.gravity * dt;
    flappyState.y += flappyState.vel * dt;
    const heroEl = document.getElementById('flappy-hero');
    heroEl.style.top = flappyState.y + '%';
    heroEl.style.transform = `translateY(-50%) rotate(${Math.min(Math.max(flappyState.vel*0.4, -30), 90)}deg)`;
    if(flappyState.y < 0 || flappyState.y > 100) overFlappy();

    if(flappyState.pipes.length === 0 || flappyState.pipes[flappyState.pipes.length-1].x < 60) {
        let gapY = Math.random()*35 + 25;
        let gapSize = 30;
        let pipeTop = document.createElement('div'); pipeTop.className = 'flappy-pipe top'; pipeTop.style.height = (gapY - gapSize/2) + '%';
        let pipeBottom = document.createElement('div'); pipeBottom.className = 'flappy-pipe bottom'; pipeBottom.style.height = (100 - (gapY + gapSize/2)) + '%';
        document.getElementById('flappy-container').appendChild(pipeTop);
        document.getElementById('flappy-container').appendChild(pipeBottom);
        flappyState.pipes.push({ x: 100, top: pipeTop, bottom: pipeBottom, passed: false });
    }
    flappyState.pipes.forEach((p, i) => {
        p.x -= 25 * dt;
        p.top.style.left = p.x + '%';
        p.bottom.style.left = p.x + '%';
        if(p.x > 12 && p.x < 25) {
            let heroY = flappyState.y;
            let gapTop = parseFloat(p.top.style.height);
            let gapBottom = 100 - parseFloat(p.bottom.style.height);
            if(heroY < gapTop + 5 || heroY > gapBottom - 5) overFlappy();
        }
        if(p.x < 20 && !p.passed) {
            p.passed = true;
            flappyState.score++;
            document.getElementById('flappy-score').textContent = flappyState.score;
            AudioSys.coin();
        }
        if(p.x < -20) { p.top.remove(); p.bottom.remove(); flappyState.pipes.splice(i,1); }
    });
    flappyAnimFrame = requestAnimationFrame(runFlappy);
}

function overFlappy() {
    flappyState.active = false;
    AudioSys.crash(); screenShake();
    cancelAnimationFrame(flappyAnimFrame);
    const coins = flappyState.score * 2;
    GameData.addCoins(coins);
    GameData.addXP(flappyState.score);
    updateMissionProgress('flappy1', 1);
    updateMissionProgress('coins50', coins);
    document.getElementById('final-score').textContent = `✈️ ${flappyState.score} | 🪙 +${coins}`;
    setTimeout(() => showScreen('screen-race-over'), 300);
}

// ===== BLOCOS (TETRIS) =====
let blocksInterval, board, piece, blockSize;
const COLS = 10, ROWS = 20;
const SHAPES = [[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
const COLORS = ['#FF0D72','#0DC2FF','#0DFF72','#F538FF','#FF8E0D','#FFE138','#3877FF'];

function resizeCanvas() {
    const parent = document.getElementById('blocks-canvas').parentElement;
    blockSize = Math.min(Math.floor(parent.clientHeight/ROWS), Math.floor(parent.clientWidth/COLS));
    const canvas = document.getElementById('blocks-canvas');
    canvas.width = blockSize * COLS;
    canvas.height = blockSize * ROWS;
    drawBoard();
}

function createBoard() { board = Array.from({length: ROWS}, () => Array(COLS).fill(0)); }
function drawBlock(x,y,color) {
    const ctx = document.getElementById('blocks-canvas').getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(x*blockSize, y*blockSize, blockSize, blockSize);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x*blockSize, y*blockSize, blockSize, blockSize*0.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x*blockSize, y*blockSize+blockSize*0.8, blockSize, blockSize*0.2);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x*blockSize, y*blockSize, blockSize, blockSize);
}
function drawBoard() {
    const canvas = document.getElementById('blocks-canvas');
    if(!canvas.width) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222'; ctx.fillRect(0,0,canvas.width, canvas.height);
    for(let r=0; r<ROWS; r++) for(let c=0; c<COLS; c++) if(board[r][c]) drawBlock(c,r,board[r][c]);
    if(piece) piece.shape.forEach((row,r)=> row.forEach((v,c)=> { if(v) drawBlock(piece.x+c, piece.y+r, piece.color); }));
}
function newPiece() {
    const idx = Math.floor(Math.random()*SHAPES.length);
    piece = { shape: SHAPES[idx], color: COLORS[idx], x: Math.floor(COLS/2)-1, y:0 };
    if(checkCollision()) { clearInterval(blocksInterval); endBlocks(); }
}
function checkCollision(dx=0, dy=0, shape=piece.shape) {
    for(let r=0; r<shape.length; r++) for(let c=0; c<shape[r].length; c++) {
        if(!shape[r][c]) continue;
        let nx = piece.x + c + dx, ny = piece.y + r + dy;
        if(nx<0 || nx>=COLS || ny>=ROWS) return true;
        if(ny>=0 && board[ny][nx]) return true;
    }
    return false;
}
function merge() { piece.shape.forEach((row,r)=> row.forEach((v,c)=> { if(v) board[piece.y+r][piece.x+c] = piece.color; })); }
function clearLines() {
    let lines=0;
    for(let r=ROWS-1; r>=0; r--) if(board[r].every(cell=>cell)) { board.splice(r,1); board.unshift(Array(COLS).fill(0)); lines++; r++; }
    if(lines) { AudioSys.coin(); updateMissionProgress('blocks1', 1); updateMissionProgress('coins50', lines*10); }
}
function moveBlock(dir) { if(piece && !checkCollision(dir,0)) { piece.x+=dir; drawBoard(); } }
function rotateBlock() {
    if(!piece) return;
    const rot = piece.shape[0].map((_,i)=> piece.shape.map(row=>row[i]).reverse());
    if(!checkCollision(0,0,rot)) { piece.shape = rot; AudioSys.playTone(150,'square',0.05); drawBoard(); }
}
function dropBlock() {
    if(!piece) return;
    if(!checkCollision(0,1)) { piece.y++; }
    else { merge(); clearLines(); newPiece(); AudioSys.playTone(100,'square',0.1); }
    drawBoard();
}
function initBlocks() {
    showScreen('screen-blocks');
    setTimeout(resizeCanvas, 100);
    window.addEventListener('resize', resizeCanvas);
    createBoard(); newPiece();
    blocksInterval = setInterval(dropBlock, 700);
}
function endBlocks() {
    clearInterval(blocksInterval);
    window.removeEventListener('resize', resizeCanvas);
    GameData.addXP(20);
    GameData.addCoins(15);
    showScreen('screen-menu');
}

// ===== MEMÓRIA =====
let memoryTimer, memorySeconds, memoryPairs;
function initMemory() {
    const emojis = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'];
    const cards = [...emojis, ...emojis].sort(()=>Math.random()-0.5);
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    memorySeconds = 0; memoryPairs = 0;
    document.getElementById('memory-time').textContent = '0s';
    clearInterval(memoryTimer);
    memoryTimer = setInterval(() => { memorySeconds++; document.getElementById('memory-time').textContent = memorySeconds + 's'; }, 1000);
    let flipped = [];
    cards.forEach(emoji => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `<span>${emoji}</span>`;
        card.onclick = () => {
            if(flipped.length < 2 && !card.classList.contains('flipped') && !card.classList.contains('matched')) {
                card.classList.add('flipped');
                AudioSys.playTone(300,'sine',0.1);
                flipped.push({emoji, el: card});
                if(flipped.length === 2) {
                    if(flipped[0].emoji === flipped[1].emoji) {
                        AudioSys.coin();
                        setTimeout(() => {
                            flipped[0].el.classList.add('matched'); flipped[1].el.classList.add('matched');
                            flipped = [];
                            memoryPairs++;
                            if(memoryPairs === emojis.length) {
                                clearInterval(memoryTimer);
                                AudioSys.win();
                                const reward = Math.max(30, 100 - memorySeconds*2);
                                GameData.addCoins(reward);
                                GameData.addXP(15);
                                updateMissionProgress('memory1', 1);
                                setTimeout(() => {
                                    alert(`Parabéns! ${memorySeconds}s - Ganhou ${reward} moedas!`);
                                    showScreen('screen-menu');
                                }, 500);
                            }
                        }, 500);
                    } else {
                        setTimeout(() => { flipped.forEach(f=>f.el.classList.remove('flipped')); flipped = []; }, 1000);
                    }
                }
            }
        };
        grid.appendChild(card);
    });
    showScreen('screen-memory');
}

// ===== PIANO =====
function initPiano() { showScreen('screen-piano'); }
document.querySelectorAll('.piano-key').forEach(key => {
    const play = (e) => {
        if(e.cancelable) e.preventDefault();
        AudioSys.piano(parseFloat(key.dataset.note));
        key.classList.add('active');
        screenShake(); // leve
    };
    const stop = () => key.classList.remove('active');
    key.addEventListener('touchstart', play); key.addEventListener('touchend', stop);
    key.addEventListener('mousedown', play); key.addEventListener('mouseup', stop); key.addEventListener('mouseleave', stop);
});

// ===== MODAL CONFIRMAÇÃO (já existente) =====
let quitAction = null;
function quitGame() { raceState.active = false; showModal("Parar?","Perderá progresso!", ()=>showScreen('screen-menu')); }
function showModal(t, txt, act) {
    document.getElementById('modal-title').textContent = t;
    document.getElementById('modal-text').textContent = txt;
    document.getElementById('modal-overlay').style.display = 'flex';
    quitAction = act;
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; if(quitAction) quitAction(); }

// ---- TELA OVER REUTILIZÁVEL ----
// (já existe)

// ---- INICIALIZAÇÃO ----
window.addEventListener('load', () => {
    checkDaily();
    updateHUD();
    // Adiciona listener para botões de navegação (já no HTML)
});

// ============================================================
//  PLAYER DATA SYSTEM
//  Coins, streak, level, highscores, daily missions
// ============================================================
const PlayerData = {
    _d: null,

    load() {
        if (!this._d) {
            const saved = localStorage.getItem('aventura_v2');
            this._d = saved ? JSON.parse(saved) : {
                coins: 0, streak: 0, lastLogin: null,
                level: 1, totalXp: 0,
                highscores: { race: 0, flappy: 0, memory: 9999, blocks: 0 },
                missions: null, missionsDate: null
            };
        }
        return this._d;
    },

    save() { localStorage.setItem('aventura_v2', JSON.stringify(this._d)); },

    addCoins(amount) {
        const d = this.load();
        d.coins += amount;
        d.totalXp = (d.totalXp || 0) + Math.floor(amount / 2);
        const newLevel = Math.floor(d.totalXp / 300) + 1;
        if (newLevel > d.level) { d.level = newLevel; showToast(`⚡ Nível ${newLevel}! Parabéns!`); }
        this.save();
        this.updateUI();
    },

    checkStreak() {
        const d = this.load();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (d.lastLogin === today) {
            if (!d.missions || d.missionsDate !== today) {
                d.missions = this.generateMissions();
                d.missionsDate = today;
                this.save();
            }
            return { isNew: false };
        }
        d.streak = (d.lastLogin === yesterday) ? (d.streak || 0) + 1 : 1;
        d.lastLogin = today;
        d.missions = this.generateMissions();
        d.missionsDate = today;
        const reward = Math.min(20 + (d.streak - 1) * 15, 150);
        this.save();
        return { isNew: true, streak: d.streak, reward };
    },

    claimDailyReward(reward) {
        const d = this.load();
        d.coins += reward;
        d.totalXp = (d.totalXp || 0) + reward;
        d.level = Math.floor(d.totalXp / 300) + 1;
        this.save();
        this.updateUI();
    },

    generateMissions() {
        const all = [
            { id: 'race_200m',  icon: '🏃', text: 'Correr 200m',         target: 200, key: 'raceDistance',   reward: 50 },
            { id: 'stars_20',   icon: '⭐', text: 'Coletar 20 estrelas', target: 20,  key: 'starsCollected',  reward: 40 },
            { id: 'flappy_5',   icon: '✈️', text: 'Passar 5 canos',      target: 5,   key: 'flappyPipes',     reward: 45 },
            { id: 'memory_win', icon: '🧠', text: 'Completar Memória',   target: 1,   key: 'memoryWins',      reward: 60 },
            { id: 'blocks_3',   icon: '🧱', text: 'Completar 3 linhas',  target: 3,   key: 'blocksLines',     reward: 35 },
            { id: 'combo_3',    icon: '🔥', text: 'Combo x3 na Corrida', target: 1,   key: 'raceCombo3',      reward: 55 },
        ];
        const shuffled = all.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3).map(m => ({ ...m, progress: 0, done: false }));
    },

    updateMission(key, amount = 1) {
        const d = this.load();
        if (!d.missions) return;
        d.missions.forEach(m => {
            if (m.key === key && !m.done) {
                m.progress = Math.min(m.progress + amount, m.target);
                if (m.progress >= m.target) {
                    m.done = true;
                    d.coins += m.reward;
                    d.totalXp = (d.totalXp || 0) + m.reward;
                    d.level = Math.floor(d.totalXp / 300) + 1;
                    showToast(`🎯 Missão! ${m.icon} +${m.reward}🪙`);
                }
            }
        });
        this.save();
        this.updateUI();
        this.renderMissions();
    },

    checkHighscore(game, score) {
        const d = this.load();
        if (!d.highscores) d.highscores = {};
        // For memory, lower time is better
        const isNew = game === 'memory'
            ? score < (d.highscores[game] || 9999)
            : score > (d.highscores[game] || 0);
        if (isNew) { d.highscores[game] = score; this.save(); }
        return isNew;
    },

    updateUI() {
        const d = this.load();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('coins-display', d.coins);
        set('streak-display', d.streak || 0);
        set('level-display', d.level || 1);
        // Update best scores in menu
        if (d.highscores) {
            set('best-race', '🏆 ' + (d.highscores.race || 0));
            set('best-flappy', '🏆 ' + (d.highscores.flappy || 0));
            set('best-blocks', '🏆 ' + (d.highscores.blocks || 0));
            const memBest = document.getElementById('best-memory');
            if (memBest) memBest.textContent = d.highscores.memory < 9999 ? `⏱ ${d.highscores.memory}s` : '⏱ --';
        }
    },

    renderMissions() {
        const d = this.load();
        const list = document.getElementById('missions-list');
        if (!list || !d.missions) return;
        list.innerHTML = d.missions.map(m => {
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            return `<div class="mission-card ${m.done ? 'done' : ''}">
                <span class="mission-icon">${m.icon}</span>
                <div class="mission-info">
                    <div class="mission-text">${m.text} (${m.progress}/${m.target})</div>
                    <div class="mission-bar-wrap"><div class="mission-bar" style="width:${pct}%"></div></div>
                </div>
                <span class="mission-reward">${m.done ? '✅' : `+${m.reward}🪙`}</span>
            </div>`;
        }).join('');
    }
};

// ============================================================
//  GLOBALS
// ============================================================
let currentHero = localStorage.getItem('aventura_hero') || '🐶';
let reqAnimFrame, flappyAnimFrame;
let lastGame = null;
let sessionCoins = 0;

// ============================================================
//  AUDIO SYSTEM
// ============================================================
const AudioSys = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    playTone(freq, type, duration, vol = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    },
    jump()  { this.playTone(400, 'sine', 0.2, 0.2); setTimeout(() => this.playTone(600, 'sine', 0.2, 0.2), 100); },
    coin()  { this.playTone(800, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(1200, 'sine', 0.3, 0.1), 100); },
    crash() { this.playTone(100, 'sawtooth', 0.5, 0.3); },
    win()   { [400,500,600,800].forEach((f,i) => setTimeout(() => this.playTone(f,'sine',0.3,0.2), i*150)); },
    flap()  { this.playTone(300, 'triangle', 0.1, 0.1); },
    combo() { this.playTone(900, 'sine', 0.15, 0.15); },
    piano(freq) { this.playTone(freq, 'sine', 0.5, 0.3); }
};

// ============================================================
//  HELPERS
// ============================================================
function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================================
//  NAVIGATION
// ============================================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    raceState.active = false;
    flappyState.active = false;
    clearInterval(blocksInterval);
    clearInterval(memoryTimer);
    if (reqAnimFrame)    cancelAnimationFrame(reqAnimFrame);
    if (flappyAnimFrame) cancelAnimationFrame(flappyAnimFrame);
    // Refresh UI when going to menu
    if (id === 'screen-menu') {
        PlayerData.updateUI();
        PlayerData.renderMissions();
    }
}

function setHero(emoji) {
    currentHero = emoji;
    localStorage.setItem('aventura_hero', currentHero);
    document.getElementById('race-hero').textContent = emoji;
    document.getElementById('flappy-hero').textContent = emoji;
    showScreen('screen-menu');
}

// ============================================================
//  DAILY REWARD SCREEN
// ============================================================
function buildStreakBar(streak) {
    const bar = document.getElementById('streak-days-bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
        const div = document.createElement('div');
        div.className = 'streak-day' + (i < streak ? ' completed' : i === streak ? ' today' : '');
        div.innerHTML = i < streak ? '✅' : (i === streak ? '🔥' : `D${i}`);
        bar.appendChild(div);
    }
}

function claimDailyReward() {
    const amount = parseInt(document.getElementById('reward-coins-amount').textContent) || 20;
    PlayerData.claimDailyReward(amount);
    showToast(`🔥 +${amount} moedas resgatadas!`);
    showScreen('screen-start');
}

// ============================================================
//  GAME OVER SCREEN (shared)
// ============================================================
function showGameOver(game, score, coinsEarned, extra) {
    lastGame = game;
    const isNew = PlayerData.checkHighscore(game, score);
    const d = PlayerData.load();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const show = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis; };

    // Score text per game
    let scoreText = '';
    const emojis = { race: '🏁', flappy: '✈️', blocks: '🧱' };
    document.getElementById('gameover-emoji').textContent = emojis[game] || '🏆';

    if (game === 'race')   scoreText = `⭐ ${score} pts  •  🏃 ${extra}m`;
    else if (game === 'flappy') scoreText = `✈️ ${score} canos`;
    else if (game === 'blocks') scoreText = `🧱 ${score} linhas`;

    set('final-score', scoreText);
    set('final-coins-earned', `+${coinsEarned} 🪙`);
    show('new-record-badge', isNew ? 'block' : 'none');

    // Highscore label
    const hs = d.highscores || {};
    if (game === 'memory') {
        set('highscore-display', hs.memory < 9999 ? hs.memory + 's' : '--');
    } else {
        set('highscore-display', hs[game] || 0);
    }

    showScreen('screen-race-over');
    if (isNew) { AudioSys.win(); vibrate([100, 50, 100, 50, 200]); }
    PlayerData.addCoins(coinsEarned);
    PlayerData.updateUI();
}

function playAgain() {
    if (lastGame === 'race')   initRace();
    else if (lastGame === 'flappy') initFlappy();
    else if (lastGame === 'blocks') initBlocks();
    else showScreen('screen-menu');
}

// ============================================================
//  RACE GAME  (with COMBO system + coins + missions)
// ============================================================
let raceState = {
    active: false, lane: 1, jumping: false, lives: 3,
    score: 0, distance: 0, speed: 0.8, lastTime: 0, nextObjDist: 5,
    combo: 0, coinsEarned: 0, starsCollected: 0
};

const MAX_POOL_SIZE = 15;
const objPool = [];

function initPool() {
    const container = document.getElementById('race-container');
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
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
        active: true, lane: 1, jumping: false, lives: 3,
        score: 0, distance: 0, speed: 0.8,
        lastTime: performance.now(), nextObjDist: 5,
        combo: 0, coinsEarned: 0, starsCollected: 0
    };
    sessionCoins = 0;
    document.getElementById('race-lives').textContent = raceState.lives;
    document.getElementById('race-score').textContent = raceState.score;
    updateComboDisplay();
    updateHeroPos();
    objPool.forEach(o => { o.active = false; o.el.style.display = 'none'; });
    showScreen('screen-race');
    reqAnimFrame = requestAnimationFrame(runRace);
}

function moveLane(dir) {
    if (!raceState.active) return;
    raceState.lane = Math.max(0, Math.min(2, raceState.lane + dir));
    updateHeroPos();
}

function updateHeroPos() {
    const hero = document.getElementById('race-hero');
    hero.style.left = ['20%', '50%', '80%'][raceState.lane];
}

function jump() {
    if (!raceState.active || raceState.jumping) return;
    raceState.jumping = true;
    AudioSys.jump();
    const hero = document.getElementById('race-hero');
    hero.classList.add('jumping');
    setTimeout(() => { raceState.jumping = false; hero.classList.remove('jumping'); }, 500);
}

function updateComboDisplay() {
    const el = document.getElementById('combo-display');
    if (!el) return;
    if (raceState.combo >= 2) {
        el.textContent = `🔥 x${raceState.combo}`;
        el.style.opacity = 1;
    } else {
        el.style.opacity = 0;
    }
}

function runRace(timestamp) {
    if (!raceState.active) return;
    const dt = (timestamp - raceState.lastTime) / 1000;
    raceState.lastTime = timestamp;
    if (dt > 0.5) { reqAnimFrame = requestAnimationFrame(runRace); return; }

    raceState.distance += raceState.speed * dt * 10;
    raceState.speed += 0.005 * dt;

    if (raceState.distance > raceState.nextObjDist) {
        spawnObject();
        raceState.nextObjDist = raceState.distance + (Math.random() * 15 + 10) / raceState.speed;
    }

    objPool.forEach(obj => {
        if (!obj.active) return;
        obj.progress += raceState.speed * dt * 0.8;
        const scale = 0.1 + obj.progress * 1.5;
        const y = 40 + obj.progress * 410;
        const laneX = [20, 50, 80][obj.lane];
        const x = 50 + (laneX - 50) * (0.2 + obj.progress * 0.8);
        obj.el.style.top = y + 'px';
        obj.el.style.left = x + '%';
        obj.el.style.transform = `translate(-50%, -50%) scale(${scale})`;

        if (obj.progress > 0.85 && obj.progress < 0.95) {
            if (obj.lane === raceState.lane) {
                if (obj.type === 'star') {
                    // COMBO SYSTEM
                    raceState.combo++;
                    raceState.starsCollected++;
                    // Variable reward: more coins at higher combos
                    const multiplier = Math.min(raceState.combo, 5);
                    const coinGain = 5 + (multiplier - 1) * 3;  // 5, 8, 11, 14, 17
                    const scoreGain = 10 * multiplier;
                    raceState.score += scoreGain;
                    raceState.coinsEarned += coinGain;
                    AudioSys.coin();
                    if (raceState.combo >= 2) AudioSys.combo();
                    updateComboDisplay();
                    document.getElementById('race-score').textContent = raceState.score;
                    obj.active = false; obj.el.style.display = 'none';
                    // Mission tracking
                    PlayerData.updateMission('starsCollected', 1);
                    if (raceState.combo === 3) PlayerData.updateMission('raceCombo3', 1);
                } else if (obj.type === 'obs') {
                    const canJump = obj.emoji === '🪨' || obj.emoji === '📦';
                    if (!(canJump && raceState.jumping)) {
                        hitObstacle();
                        obj.active = false; obj.el.style.display = 'none';
                    }
                }
            }
        }
        if (obj.progress > 1.1) { obj.active = false; obj.el.style.display = 'none'; }
    });

    // Mission: distance
    PlayerData._d && PlayerData._d.missions && (() => {
        const m = PlayerData._d.missions.find(m => m.key === 'raceDistance' && !m.done);
        if (m && Math.floor(raceState.distance) > m.progress) {
            PlayerData.updateMission('raceDistance', Math.floor(raceState.distance) - m.progress);
        }
    })();

    reqAnimFrame = requestAnimationFrame(runRace);
}

function spawnObject() {
    const obj = getFreeObj();
    if (!obj) return;
    const type = Math.random() > 0.4 ? 'obs' : 'star';
    const lane = Math.floor(Math.random() * 3);
    const emojis = type === 'star' ? ['⭐', '🍎', '🍌'] : ['🪨', '📦', '🚧', '🌵'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    obj.active = true; obj.type = type; obj.lane = lane; obj.progress = 0; obj.emoji = emoji;
    obj.el.innerHTML = `<span style="font-size:3rem; filter:drop-shadow(0 5px 5px rgba(0,0,0,0.5));">${emoji}</span>`;
    obj.el.style.display = 'block';
}

function hitObstacle() {
    raceState.lives--;
    raceState.combo = 0;  // Break combo on hit!
    updateComboDisplay();
    AudioSys.crash();
    vibrate(200);
    document.getElementById('race-lives').textContent = raceState.lives;
    const container = document.getElementById('race-container');
    container.style.filter = 'brightness(2) saturate(2) hue-rotate(90deg)';
    setTimeout(() => container.style.filter = '', 150);
    if (raceState.lives <= 0) endRace();
}

function endRace() {
    raceState.active = false;
    cancelAnimationFrame(reqAnimFrame);
    showGameOver('race', raceState.score, raceState.coinsEarned, Math.floor(raceState.distance));
}

// Swipes para Corrida
let touchStartX = 0, touchStartY = 0;
const raceContainer = document.getElementById('race-container');
raceContainer.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });
raceContainer.addEventListener('touchend', e => {
    if (!raceState.active) return;
    let dx = e.changedTouches[0].screenX - touchStartX;
    let dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) { if (dx > 0) moveLane(1); else moveLane(-1); }
    } else {
        if (dy < -30) jump();
    }
}, { passive: true });

// ============================================================
//  FLAPPY PET  (with coins + missions)
// ============================================================
let flappyState = { active: false, y: 50, vel: 0, gravity: 200, jump: -60, score: 0, pipes: [], lastTime: 0, coinsEarned: 0 };
let flappyAnimFrame;

function initFlappy() {
    flappyState = { active: true, y: 50, vel: 0, gravity: 200, jump: -60, score: 0, pipes: [], lastTime: performance.now(), coinsEarned: 0 };
    document.getElementById('flappy-score').textContent = 0;
    document.getElementById('flappy-hero').textContent = currentHero;
    document.getElementById('flappy-hero').style.top = '50%';
    document.querySelectorAll('.flappy-pipe').forEach(p => p.remove());
    showScreen('screen-flappy');
    flappyAnimFrame = requestAnimationFrame(runFlappy);
}

function flap() {
    if (!flappyState.active) return;
    flappyState.vel = flappyState.jump;
    AudioSys.flap();
}

function runFlappy(timestamp) {
    if (!flappyState.active) return;
    const dt = (timestamp - flappyState.lastTime) / 1000;
    flappyState.lastTime = timestamp;
    if (dt > 0.5) { flappyAnimFrame = requestAnimationFrame(runFlappy); return; }

    flappyState.vel += flappyState.gravity * dt;
    flappyState.y += flappyState.vel * dt;

    const heroEl = document.getElementById('flappy-hero');
    heroEl.style.top = flappyState.y + '%';
    heroEl.style.transform = `translateY(-50%) rotate(${Math.min(Math.max(flappyState.vel * 0.5, -30), 90)}deg)`;

    if (flappyState.y < 0 || flappyState.y > 100) return overFlappy();

    if (flappyState.pipes.length === 0 || flappyState.pipes[flappyState.pipes.length - 1].x < 60) {
        let gapY = Math.random() * 40 + 20;
        let gapSize = 35;
        let pipeTop = document.createElement('div'); pipeTop.className = 'flappy-pipe top';
        pipeTop.style.height = (gapY - gapSize / 2) + '%';
        let pipeBottom = document.createElement('div'); pipeBottom.className = 'flappy-pipe bottom';
        pipeBottom.style.height = (100 - (gapY + gapSize / 2)) + '%';
        document.getElementById('flappy-container').appendChild(pipeTop);
        document.getElementById('flappy-container').appendChild(pipeBottom);
        flappyState.pipes.push({ x: 100, top: pipeTop, bottom: pipeBottom, passed: false });
    }

    flappyState.pipes.forEach((p, i) => {
        p.x -= 30 * dt;
        p.top.style.left = p.x + '%';
        p.bottom.style.left = p.x + '%';

        if (p.x > 15 && p.x < 30) {
            let gapTop = parseFloat(p.top.style.height);
            let gapBottom = 100 - parseFloat(p.bottom.style.height);
            if (flappyState.y < gapTop + 5 || flappyState.y > gapBottom - 5) return overFlappy();
        }

        if (p.x < 20 && !p.passed) {
            p.passed = true;
            flappyState.score++;
            // Variable coin reward (increases with score)
            const coinGain = 5 + Math.floor(flappyState.score / 3);
            flappyState.coinsEarned += coinGain;
            AudioSys.coin();
            document.getElementById('flappy-score').textContent = flappyState.score;
            PlayerData.updateMission('flappyPipes', 1);
        }
        if (p.x < -20) { p.top.remove(); p.bottom.remove(); flappyState.pipes.splice(i, 1); }
    });

    flappyAnimFrame = requestAnimationFrame(runFlappy);
}

function overFlappy() {
    if (!flappyState.active) return;
    flappyState.active = false;
    AudioSys.crash();
    vibrate(300);
    cancelAnimationFrame(flappyAnimFrame);
    setTimeout(() => showGameOver('flappy', flappyState.score, flappyState.coinsEarned), 500);
}

function quitFlappy() {
    flappyState.active = false;
    showScreen('screen-menu');
}

document.getElementById('screen-flappy').addEventListener('touchstart', flap, { passive: true });
document.getElementById('screen-flappy').addEventListener('mousedown', flap);

// ============================================================
//  PIANO KIDS
// ============================================================
function initPiano() { showScreen('screen-piano'); }

document.querySelectorAll('.piano-key').forEach(key => {
    const playNote = e => {
        if (e.cancelable) e.preventDefault();
        AudioSys.piano(parseFloat(key.getAttribute('data-note')));
        key.classList.add('active');
        vibrate(30);
    };
    const stopNote = () => key.classList.remove('active');
    key.addEventListener('touchstart', playNote);
    key.addEventListener('touchend', stopNote);
    key.addEventListener('mousedown', playNote);
    key.addEventListener('mouseup', stopNote);
    key.addEventListener('mouseleave', stopNote);
});

// ============================================================
//  MODAL SYSTEM
// ============================================================
let quitAction = null;
function quitGame() {
    raceState.active = false;
    showModal('Parar a Corrida?', 'Quer desistir agora?', () => showScreen('screen-menu'));
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
        raceState.lastTime = performance.now();
        raceState.active = true;
        reqAnimFrame = requestAnimationFrame(runRace);
    }
}
function confirmQuit() {
    document.getElementById('modal-overlay').style.display = 'none';
    if (quitAction) quitAction();
}

// ============================================================
//  MEMÓRIA  (with coins + missions)
// ============================================================
let memoryTimer, memorySeconds = 0, memoryPairs = 0;

function initMemory() {
    const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    memorySeconds = 0; memoryPairs = 0;
    document.getElementById('memory-time').textContent = '0s';
    if (memoryTimer) clearInterval(memoryTimer);
    memoryTimer = setInterval(() => {
        memorySeconds++;
        document.getElementById('memory-time').textContent = memorySeconds + 's';
    }, 1000);

    let flipped = [];
    cards.forEach(emoji => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `<span>${emoji}</span>`;
        card.onclick = () => {
            if (flipped.length < 2 && !card.classList.contains('flipped') && !card.classList.contains('matched')) {
                card.classList.add('flipped');
                AudioSys.playTone(300, 'sine', 0.1);
                flipped.push({ emoji, el: card });
                if (flipped.length === 2) {
                    if (flipped[0].emoji === flipped[1].emoji) {
                        AudioSys.coin(); vibrate(80);
                        setTimeout(() => {
                            flipped[0].el.classList.add('matched');
                            flipped[1].el.classList.add('matched');
                            flipped = [];
                            memoryPairs++;
                            if (memoryPairs === emojis.length) {
                                clearInterval(memoryTimer);
                                AudioSys.win();
                                // Fast bonus: < 30s = 100 coins, < 60s = 60 coins, else 30 coins
                                const timeBonus = memorySeconds < 30 ? 100 : memorySeconds < 60 ? 60 : 30;
                                PlayerData.updateMission('memoryWins', 1);
                                setTimeout(() => {
                                    // Show result in custom game over style
                                    const isNew = PlayerData.checkHighscore('memory', memorySeconds);
                                    const d = PlayerData.load();
                                    document.getElementById('gameover-emoji').textContent = '🧠';
                                    document.getElementById('final-score').textContent = `⏱ ${memorySeconds}s`;
                                    document.getElementById('final-coins-earned').textContent = `+${timeBonus} 🪙`;
                                    document.getElementById('new-record-badge').style.display = isNew ? 'block' : 'none';
                                    const hs = d.highscores || {};
                                    document.getElementById('highscore-display').textContent = hs.memory < 9999 ? hs.memory + 's' : '--';
                                    lastGame = null; // no play again for memory here, handled in initMemory
                                    document.getElementById('btn-play-again').onclick = initMemory;
                                    showScreen('screen-race-over');
                                    PlayerData.addCoins(timeBonus);
                                    if (isNew) { AudioSys.win(); vibrate([100, 50, 200]); }
                                }, 600);
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

// ============================================================
//  BLOCOS (TETRIS)  (with lines counter + coins + missions)
// ============================================================
const canvas = document.getElementById('blocks-canvas');
const ctx = canvas.getContext('2d');
let COLS = 10, ROWS = 20, BLOCK_SIZE;
let board = [], piece;
let blocksInterval;
let blocksTotalLines = 0;
let blocksCoinsEarned = 0;

const SHAPES = [
    [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]],
    [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
    [[0,1,1],[1,1,0]], [[1,1,0],[0,1,1]]
];
const COLORS = ['#FF0D72','#0DC2FF','#0DFF72','#F538FF','#FF8E0D','#FFE138','#3877FF'];

function resizeCanvas() {
    const parent = canvas.parentElement;
    const h = parent.clientHeight - 20;
    const w = parent.clientWidth - 20;
    BLOCK_SIZE = Math.min(Math.floor(h / ROWS), Math.floor(w / COLS));
    canvas.width = BLOCK_SIZE * COLS;
    canvas.height = BLOCK_SIZE * ROWS;
    drawBoard();
}

function createBoard() { board = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); }

function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE * 0.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE + BLOCK_SIZE * 0.8, BLOCK_SIZE, BLOCK_SIZE * 0.2);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawBoard() {
    if (!canvas.width) return;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (board[r][c]) drawBlock(c, r, board[r][c]);
    if (piece) {
        piece.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) drawBlock(piece.x + c, piece.y + r, piece.color);
        }));
    }
}

function newPiece() {
    const idx = Math.floor(Math.random() * SHAPES.length);
    piece = { shape: SHAPES[idx], color: COLORS[idx], x: Math.floor(COLS / 2) - 1, y: 0 };
    if (checkCollision()) {
        clearInterval(blocksInterval);
        AudioSys.crash();
        setTimeout(() => {
            showGameOver('blocks', blocksTotalLines, blocksCoinsEarned);
        }, 200);
    }
}

function checkCollision(dx = 0, dy = 0, shape = piece.shape) {
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            let nx = piece.x + c + dx, ny = piece.y + r + dy;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && board[ny][nx]) return true;
        }
    return false;
}

function merge() {
    piece.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) board[piece.y + r][piece.x + c] = piece.color;
    }));
}

function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(c => c !== 0)) {
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            cleared++; r++;
        }
    }
    if (cleared > 0) {
        AudioSys.coin(); vibrate(100);
        blocksTotalLines += cleared;
        // Variable reward: more coins for clearing multiple lines at once
        const coinGain = cleared === 1 ? 10 : cleared === 2 ? 25 : cleared === 3 ? 45 : 80;
        blocksCoinsEarned += coinGain;
        document.getElementById('blocks-lines').textContent = blocksTotalLines;
        PlayerData.updateMission('blocksLines', cleared);
        if (cleared >= 2) showToast(`🧱 ${cleared} linhas! +${coinGain}🪙`);
    }
}

function moveBlock(dir)  { if (piece && !checkCollision(dir, 0)) { piece.x += dir; drawBoard(); } }
function rotateBlock() {
    if (!piece) return;
    const rot = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
    if (!checkCollision(0, 0, rot)) { piece.shape = rot; AudioSys.playTone(150, 'square', 0.05); drawBoard(); }
}
function dropBlock() {
    if (!piece) return;
    if (!checkCollision(0, 1)) { piece.y++; }
    else { merge(); clearLines(); newPiece(); AudioSys.playTone(100, 'square', 0.1); vibrate(20); }
    drawBoard();
}

function initBlocks() {
    blocksTotalLines = 0; blocksCoinsEarned = 0;
    document.getElementById('blocks-lines').textContent = 0;
    showScreen('screen-blocks');
    setTimeout(resizeCanvas, 100);
    window.addEventListener('resize', resizeCanvas);
    createBoard(); newPiece();
    if (blocksInterval) clearInterval(blocksInterval);
    blocksInterval = setInterval(dropBlock, 800);
    // Override play again for blocks
    document.getElementById('btn-play-again').onclick = playAgain;
}

function quitBlocks() {
    clearInterval(blocksInterval);
    window.removeEventListener('resize', resizeCanvas);
    showScreen('screen-menu');
}

// Swipes para Blocos
let bStartX, bStartY, bLastMoveTime = 0;
canvas.addEventListener('touchstart', e => {
    bStartX = e.changedTouches[0].screenX;
    bStartY = e.changedTouches[0].screenY;
    bLastMoveTime = performance.now();
    e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
    if (performance.now() - bLastMoveTime < 100) return;
    let dx = e.changedTouches[0].screenX - bStartX;
    let dy = e.changedTouches[0].screenY - bStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx > 0) moveBlock(1); else moveBlock(-1);
        bStartX = e.changedTouches[0].screenX;
        bLastMoveTime = performance.now();
    } else if (dy > 40) {
        dropBlock();
        bStartY = e.changedTouches[0].screenY;
        bLastMoveTime = performance.now();
    }
}, { passive: false });
canvas.addEventListener('touchend', e => {
    let dx = e.changedTouches[0].screenX - bStartX;
    let dy = e.changedTouches[0].screenY - bStartY;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) rotateBlock();
}, { passive: false });

// ============================================================
//  TECLADO
// ============================================================
window.addEventListener('keydown', e => {
    if (raceState.active) {
        if (e.key === 'ArrowLeft') moveLane(-1);
        if (e.key === 'ArrowRight') moveLane(1);
        if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump(); }
    } else if (document.getElementById('screen-blocks').classList.contains('active')) {
        if (e.key === 'ArrowLeft')  moveBlock(-1);
        if (e.key === 'ArrowRight') moveBlock(1);
        if (e.key === 'ArrowUp')    rotateBlock();
        if (e.key === 'ArrowDown')  dropBlock();
    } else if (flappyState.active) {
        if (e.key === ' ') { e.preventDefault(); flap(); }
    }
});

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Sync hero
    document.getElementById('race-hero').textContent = currentHero;
    document.getElementById('flappy-hero').textContent = currentHero;

    // Check daily streak
    const result = PlayerData.checkStreak();

    if (result.isNew) {
        // Show daily reward screen
        const d = PlayerData.load();
        document.getElementById('reward-streak-msg').textContent =
            d.streak === 1 ? 'Bem-vindo de volta!' : `Sequência de ${d.streak} dias! 🔥`;
        document.getElementById('reward-coins-amount').textContent = result.reward;
        buildStreakBar(d.streak);
        showScreen('screen-reward');
    } else {
        // Normal start
        showScreen('screen-start');
    }

    // Initial UI update
    PlayerData.updateUI();
    PlayerData.renderMissions();
});

// ========== AVENTURA KIDS – game.js v4 ==========

// ---------- UTIL ----------
function $(id) { return document.getElementById(id); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- DADOS PERSISTENTES ----------
const GameData = {
  _data: null,
  _load() {
    try {
      const saved = localStorage.getItem('ak_data_v4');
      this._data = saved ? JSON.parse(saved) : this._defaults();
    } catch(e) { this._data = this._defaults(); }
  },
  _defaults() {
    return {
      level: 1, xp: 0, coins: 0,
      streak: 0, lastLoginDate: null,
      missions: [], missionsDate: null,
      currentHero: '🐶',
      records: { race: 0, flappy: 0, blocks: 0, memory: 999, balloons: 0, sequence: 0 }
    };
  },
  save() { try { localStorage.setItem('ak_data_v4', JSON.stringify(this._data)); } catch(e) {} },
  // retorna cópia — nunca referência direta
  get() { return { ...this._data, records: { ...this._data.records }, missions: [...(this._data.missions||[])] }; },
  patch(changes) { Object.assign(this._data, changes); this.save(); },
  addCoins(amount) {
    if (amount <= 0) return;
    this._data.coins += amount;
    this.save();
    updatePlayerStats();
    showFloatingCoins(amount);
  },
  addXP(amount) {
    this._data.xp += amount;
    const xpNeeded = this.xpForLevel(this._data.level + 1);
    if (this._data.xp >= xpNeeded) {
      this._data.xp -= xpNeeded;
      this._data.level++;
      this._data.coins += 15;
      this.save();
      showLevelUpEffect();
    }
    this.save();
    updatePlayerStats();
  },
  xpForLevel(lv) { return Math.floor(80 * Math.pow(1.6, lv - 1)); },
  setHero(h) { this._data.currentHero = h; this.save(); },
  // retorna true se é novo recorde
  setRecord(game, value) {
    const rec = this._data.records;
    const isNew = game === 'memory' ? value < rec.memory : value > rec[game];
    if (isNew) { rec[game] = value; this.save(); updateBestScores(); }
    return isNew;
  }
};

// ---------- ÁUDIO — lazy init (AudioContext só após gesto) ----------
const AudioSys = {
  _ctx: null,
  get ctx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  },
  playTone(freq, type, dur, vol = 0.1) {
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + dur);
    } catch(e) {}
  },
  jump()  { this.playTone(400,'sine',0.15); setTimeout(()=>this.playTone(620,'sine',0.15),80); },
  coin()  { this.playTone(900,'sine',0.08); setTimeout(()=>this.playTone(1320,'sine',0.12),70); },
  crash() { this.playTone(100,'sawtooth',0.5,0.4); this.playTone(70,'square',0.3,0.3); },
  win()   { [500,700,900,1100].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.2),i*100)); },
  flap()  { this.playTone(350,'triangle',0.09); },
  levelUp() { [600,800,1000,1200,1400].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.25),i*110)); },
  pop()   { this.playTone(720,'sine',0.1); setTimeout(()=>this.playTone(500,'sine',0.12),55); },
  tttPlace()  { this.playTone(500,'sine',0.1); },
  tttWin()    { [700,900,1100].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.22),i*120)); },
  seqNote(freq) { this.playTone(freq,'sine',0.3,0.22); },
  seqError()    { this.playTone(150,'sawtooth',0.45); },
  blockPlace() { this.playTone(220,'square',0.08); },
  blockClear() { [300,500,700,900].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.18),i*70)); },
  tap()   { this.playTone(820,'sine',0.04); }
};

// ---------- EFEITOS VISUAIS ----------
function showLevelUpEffect() {
  AudioSys.levelUp();
  spawnParticles('⭐', 20); spawnParticles('🎉', 10);
  const div = document.createElement('div');
  div.className = 'level-up-toast';
  div.innerHTML = `🎉 Nível ${GameData.get().level}! 🎉`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3200);
  screenShake();
}
function screenShake() {
  const el = document.querySelector('.game-container');
  if (!el) return;
  el.style.animation = 'none'; el.offsetHeight;
  el.style.animation = 'shake 0.45s ease';
  setTimeout(() => el.style.animation = '', 450);
}
function spawnParticles(emoji, count = 12) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = emoji;
    p.style.cssText = `
      left:${Math.random()*100}%;
      animation-duration:${0.9+Math.random()*1.4}s;
      animation-delay:${Math.random()*0.35}s;
      font-size:${1.4+Math.random()*1.6}rem;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}
function showFloatingCoins(amount) {
  const el = document.createElement('div');
  el.className = 'floating-coins';
  el.textContent = '+' + amount + ' 🪙';
  el.style.cssText = `left:${25+Math.random()*50}%; top:25%;`;
  const gc = document.querySelector('.game-container');
  if (gc) { gc.appendChild(el); setTimeout(() => el.remove(), 1300); }
}
function showToast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- HUD ----------
function updatePlayerStats() {
  const d = GameData.get();
  const set = (id, v) => { const e=$(id); if(e) e.textContent=v; };
  set('level-display', d.level);
  set('coins-display', d.coins);
  set('streak-display', d.streak);
  const xpBar = $('xp-bar-fill');
  if (xpBar) {
    const pct = (d.xp / GameData.xpForLevel(d.level + 1)) * 100;
    xpBar.style.width = Math.min(pct, 100) + '%';
  }
}
function updateBestScores() {
  const r = GameData.get().records;
  const be = (id, v) => { const e=$(id); if(e) e.textContent=v; };
  be('best-race',     '🏆'+r.race);
  be('best-flappy',   '🏆'+r.flappy);
  be('best-blocks',   '🏆'+r.blocks);
  be('best-memory',   r.memory===999 ? '⏱--' : '⏱'+r.memory+'s');
  be('best-balloons', '🏆'+r.balloons);
  be('best-sequence', '🏆'+r.sequence);
}
function updateHeroDisplay() {
  const hero = GameData.get().currentHero;
  const e = $('menu-hero-display');
  if (e) e.textContent = hero;
}

// ---------- GAME OVER CENTRAL ----------
function showGameOver({ score, coinsEarned, emoji, record, isNewRecord, playAgainFn }) {
  $('final-score').textContent = emoji + ' ' + score;
  $('final-coins-earned').textContent = '+' + coinsEarned + ' 🪙';
  $('highscore-display').textContent = record;
  $('gameover-emoji').textContent = emoji;
  $('btn-play-again').onclick = playAgainFn;
  const badge = $('new-record-badge');
  if (badge) badge.style.display = isNewRecord ? 'block' : 'none';
  if (isNewRecord) { spawnParticles('🏆', 10); AudioSys.win(); }
  showScreen('screen-race-over');
}

// ---------- SISTEMA DIÁRIO ----------
function checkDailyLogin() {
  const data = GameData.get();
  const today = new Date().toDateString();
  if (data.lastLoginDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newStreak = data.lastLoginDate === yesterday ? data.streak + 1 : 1;
    GameData.patch({ streak: newStreak, lastLoginDate: today });
    generateDailyMissions();
    showScreen('screen-reward');
  }
  updatePlayerStats();
}
function renderStreakBar() {
  const bar = $('streak-days-bar');
  if (!bar) return;
  const streak = GameData.get().streak;
  bar.innerHTML = '';
  for (let i = 1; i <= 7; i++) {
    const dot = document.createElement('div');
    dot.className = 'streak-day-dot' + (i <= streak ? ' active' : '');
    dot.textContent = i <= streak ? '✅' : i;
    bar.appendChild(dot);
  }
  $('reward-streak-msg').textContent = `Sequência: ${streak} dia${streak!==1?'s':''}!`;
  const coinsTable = [20, 30, 50, 70, 100, 150, 200];
  $('reward-coins-amount').textContent = coinsTable[Math.min(streak, 7) - 1];
}
function claimDailyReward() {
  const data = GameData.get();
  const coins = [20, 30, 50, 70, 100, 150, 200][Math.min(data.streak, 7) - 1];
  GameData.addCoins(coins);
  spawnParticles('🪙', 14); spawnParticles('✨', 8);
  showToast('Resgatado +' + coins + ' 🪙!');
  setTimeout(() => showScreen('screen-menu'), 500);
}

// ---------- MISSÕES ----------
const MISSION_POOL = [
  { id:'race1',      desc:'Correr 1 vez',          target:1,  reward:30 },
  { id:'race3',      desc:'Correr 3 vezes',         target:3,  reward:70 },
  { id:'flappy1',    desc:'Jogar Flappy',           target:1,  reward:40 },
  { id:'memory1',    desc:'Completar Memória',      target:1,  reward:50 },
  { id:'blocks1',    desc:'Jogar Blocos',           target:1,  reward:40 },
  { id:'balloons20', desc:'Estourar 20 balões',     target:20, reward:60 },
  { id:'tictactoe1', desc:'Vencer Jogo da Velha',   target:1,  reward:50 },
  { id:'sequence3',  desc:'Acertar 3 sequências',   target:3,  reward:60 },
  { id:'coins30',    desc:'Ganhar 30 moedas',       target:30, reward:50 }
];
function generateDailyMissions() {
  const picked = shuffle(MISSION_POOL).slice(0, 3).map(m => ({ ...m, progress: 0, completed: false }));
  GameData.patch({ missions: picked, missionsDate: new Date().toDateString() });
  renderMissions();
}
function updateMissionProgress(id, amount = 1) {
  const data = GameData.get();
  if (data.missionsDate !== new Date().toDateString()) return;
  const m = data.missions?.find(x => x.id === id);
  if (m && !m.completed) {
    m.progress = Math.min(m.progress + amount, m.target);
    if (m.progress >= m.target) {
      m.completed = true;
      GameData.addCoins(m.reward);
      showToast('Missão! +' + m.reward + ' 🪙');
      spawnParticles('🎯', 6);
    }
    GameData.patch({ missions: data.missions });
    renderMissions();
  }
}
function renderMissions() {
  const container = $('missions-list');
  if (!container) return;
  const missions = GameData.get().missions || [];
  if (!missions.length) {
    container.innerHTML = '<div class="mission-empty">Volte amanhã! 🌙</div>';
    return;
  }
  container.innerHTML = missions.map(m => {
    const pct = m.completed ? 100 : Math.round((m.progress / m.target) * 100);
    return `
      <div class="mission-item ${m.completed ? 'completed' : ''}">
        <span class="mission-desc">${m.desc}</span>
        <div class="mission-progress-wrap">
          <div class="mission-progress-bar" style="width:${pct}%"></div>
        </div>
        <span class="mission-count">${m.completed ? '✅' : m.progress+'/'+m.target}</span>
        <span class="mission-reward">+${m.reward}🪙</span>
      </div>`;
  }).join('');
}

// ---------- NAVEGAÇÃO ----------
let _activeCleanup = null;
function showScreen(id) {
  if (_activeCleanup) { try { _activeCleanup(); } catch(e){} _activeCleanup = null; }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $(id);
  if (target) target.classList.add('active');
  if (id === 'screen-menu')   { updatePlayerStats(); updateBestScores(); renderMissions(); updateHeroDisplay(); }
  if (id === 'screen-reward') renderStreakBar();
}

// ---------- HERÓI ----------
function setHero(emoji) {
  GameData.setHero(emoji);
  const h1 = $('flappy-hero'); if (h1) h1.textContent = emoji;
  spawnParticles(emoji, 12);
  AudioSys.win();
  showScreen('screen-menu');
}

// ===================== CORRIDA =====================
const Race = {
  state:      null,
  frameId:    null,
  obstacleEl: null,
  obstacleX:  110,

  init() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.obstacleEl) { this.obstacleEl.remove(); this.obstacleEl = null; }
    const hero = GameData.get().currentHero;
    const screen = $('screen-race');
    screen.innerHTML = `
      <div id="runner-container">
        <div id="runner-sky">
          <div class="cloud c1">☁️</div>
          <div class="cloud c2">☁️</div>
          <div class="cloud c3">⛅</div>
        </div>
        <div id="runner-ground"></div>
        <div id="runner-hero">${hero}</div>
        <div id="runner-score-display">⭐ 0</div>
        <div id="runner-speed-bar"><div id="runner-speed-fill"></div></div>
        <div id="runner-tap-hint">👆 Toque para pular!</div>
      </div>
    `;
    this.state = { active:true, score:0, jumping:false, sliding:false, speed:2.8 };
    this.obstacleEl = null;
    this.obstacleX = 110;
    $('runner-tap-hint').style.transition = 'opacity 0.5s';
    setTimeout(() => { const h=$('runner-tap-hint'); if(h) h.style.opacity='0'; }, 1800);
    setTimeout(() => { const h=$('runner-tap-hint'); if(h) h.remove(); }, 2400);

    const container = $('runner-container');
    container.addEventListener('click',    () => this._jump(),  { passive:true });
    container.addEventListener('touchstart', e => { this._jump(); }, { passive:true });
    let touchY = 0;
    container.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive:true });
    container.addEventListener('touchmove',  e => {
      if (!this.state.active || this.state.sliding || this.state.jumping) return;
      if (e.touches[0].clientY - touchY > 28) this._slide();
    }, { passive:true });

    _activeCleanup = () => { this.state.active = false; cancelAnimationFrame(this.frameId); };
    showScreen('screen-race');
    this.frameId = requestAnimationFrame(() => this._loop());
  },

  _jump() {
    if (!this.state.active || this.state.jumping) return;
    this.state.jumping = true;
    const hero = $('runner-hero');
    if (hero) hero.classList.add('jumping');
    AudioSys.jump();
    setTimeout(() => {
      const h = $('runner-hero'); if (h) h.classList.remove('jumping');
      this.state.jumping = false;
    }, 530);
  },

  _slide() {
    this.state.sliding = true;
    const hero = $('runner-hero'); if (hero) hero.classList.add('sliding');
    AudioSys.flap();
    setTimeout(() => {
      const h = $('runner-hero'); if (h) h.classList.remove('sliding');
      this.state.sliding = false;
    }, 420);
  },

  _loop() {
    if (!this.state.active) return;
    // Spawn obstáculo
    if (!this.obstacleEl) {
      const types = [
        { e:'🪨', kind:'low' },  // ajoelhar
        { e:'📦', kind:'high' }, // pular
        { e:'🌵', kind:'low' },  // ajoelhar
        { e:'🌟', kind:'high' }  // pular
      ];
      const t = types[Math.floor(Math.random() * types.length)];
      const obs = document.createElement('div');
      obs.className = 'runner-obstacle';
      obs.textContent = t.e;
      obs.dataset.kind = t.kind;
      $('runner-container')?.appendChild(obs);
      this.obstacleEl = obs;
      this.obstacleX = 108;
    }

    // Move obstáculo — velocidade cresce com pontuação
    this.state.speed = Math.min(2.8 + this.state.score / 60, 6.0);
    this.obstacleX -= this.state.speed * 0.38;
    this.obstacleEl.style.left = this.obstacleX + '%';

    // Atualiza barra de velocidade
    const fill = $('runner-speed-fill');
    if (fill) fill.style.width = Math.min(((this.state.speed - 2.8) / 3.2) * 100, 100) + '%';

    // Colisão: herói está entre 18-28%
    if (this.obstacleX < 27 && this.obstacleX > 12) {
      const kind = this.obstacleEl.dataset.kind;
      const avoided = kind === 'high' ? this.state.jumping : this.state.sliding;
      if (!avoided) { this._crash(); return; }
    }

    // Ponto marcado
    if (this.obstacleX < 10 && !this.obstacleEl.dataset.scored) {
      this.obstacleEl.dataset.scored = '1';
      this.state.score += 10;
      const disp = $('runner-score-display');
      if (disp) disp.textContent = '⭐ ' + this.state.score;
      AudioSys.coin();
    }
    if (this.obstacleX < -14) { this.obstacleEl.remove(); this.obstacleEl = null; }

    this.frameId = requestAnimationFrame(() => this._loop());
  },

  _crash() {
    this.state.active = false;
    cancelAnimationFrame(this.frameId);
    if (this.obstacleEl) { this.obstacleEl.remove(); this.obstacleEl = null; }
    AudioSys.crash(); screenShake();
    const coins = Math.floor(this.state.score / 2);
    GameData.addCoins(coins);
    GameData.addXP(Math.floor(this.state.score / 3));
    const isNew = GameData.setRecord('race', this.state.score);
    updateMissionProgress('race1', 1);
    updateMissionProgress('race3', 1);
    updateMissionProgress('coins30', coins);
    showGameOver({
      score: this.state.score, coinsEarned: coins,
      emoji: '🏃', record: GameData.get().records.race,
      isNewRecord: isNew, playAgainFn: () => Race.init()
    });
  }
};
function initRace() { Race.init(); }
function quitGame() {
  showModal('Parar a Corrida?', 'Quer desistir agora?', () => showScreen('screen-menu'));
}

// ===================== FLAPPY =====================
const Flappy = {
  state:   null,
  frameId: null,

  init() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    document.querySelectorAll('.flappy-pipe').forEach(p => p.remove());
    this.state = {
      active: true, y: 50, vel: 0,
      gravity: 0.33, jump: -6.2,
      score: 0, pipes: [], lastTime: performance.now()
    };
    const hero = $('flappy-hero');
    if (hero) { hero.style.top = '50%'; hero.textContent = GameData.get().currentHero; }
    $('flappy-score').textContent = '0';
    _activeCleanup = () => { this.state.active = false; cancelAnimationFrame(this.frameId); };
    showScreen('screen-flappy');
    this.frameId = requestAnimationFrame(ts => this._loop(ts));
  },

  flap() {
    if (!this.state?.active) return;
    this.state.vel = this.state.jump;
    AudioSys.flap();
    const hero = $('flappy-hero');
    if (hero) { hero.style.transform = 'translateY(-50%) rotate(-25deg)'; }
  },

  _loop(ts) {
    if (!this.state.active) return;
    const dt = Math.min((ts - this.state.lastTime) / 1000, 0.05);
    this.state.lastTime = ts;
    this.state.vel += this.state.gravity * dt * 60;
    this.state.y  += this.state.vel * dt * 60;

    const hero = $('flappy-hero');
    if (hero) {
      hero.style.top = this.state.y + '%';
      hero.style.transform = `translateY(-50%) rotate(${Math.min(Math.max(this.state.vel * 3, -28), 80)}deg)`;
    }
    if (this.state.y < 2 || this.state.y > 97) { this._over(); return; }

    // Spawn pipes
    const last = this.state.pipes[this.state.pipes.length - 1];
    if (!last || last.x < 52) {
      const gapY = Math.random() * 26 + 33;
      const half = 14;
      const container = $('flappy-container');
      const pTop = document.createElement('div');
      pTop.className = 'flappy-pipe top';
      pTop.style.height = (gapY - half) + '%';
      const pBot = document.createElement('div');
      pBot.className = 'flappy-pipe bottom';
      pBot.style.height = (100 - (gapY + half)) + '%';
      container.appendChild(pTop); container.appendChild(pBot);
      this.state.pipes.push({ x:100, top:pTop, bottom:pBot, gapTop:gapY-half, gapBot:gapY+half, passed:false });
    }

    for (let i = this.state.pipes.length - 1; i >= 0; i--) {
      const p = this.state.pipes[i];
      p.x -= 1.05 * dt * 60;
      p.top.style.left = p.x + '%';
      p.bottom.style.left = p.x + '%';
      // Colisão — herói ~20% horizontal
      if (p.x > 13 && p.x < 27) {
        if (this.state.y < p.gapTop || this.state.y > p.gapBot) { this._over(); return; }
      }
      if (p.x < 16 && !p.passed) {
        p.passed = true;
        this.state.score++;
        $('flappy-score').textContent = this.state.score;
        AudioSys.coin();
      }
      if (p.x < -16) {
        p.top.remove(); p.bottom.remove();
        this.state.pipes.splice(i, 1);
      }
    }
    this.frameId = requestAnimationFrame(ts => this._loop(ts));
  },

  _over() {
    if (!this.state.active) return;
    this.state.active = false;
    cancelAnimationFrame(this.frameId);
    AudioSys.crash(); screenShake();
    const coins = this.state.score * 2;
    GameData.addCoins(coins); GameData.addXP(this.state.score);
    const isNew = GameData.setRecord('flappy', this.state.score);
    updateMissionProgress('flappy1', 1); updateMissionProgress('coins30', coins);
    showGameOver({
      score: this.state.score, coinsEarned: coins,
      emoji: '✈️', record: GameData.get().records.flappy,
      isNewRecord: isNew, playAgainFn: () => Flappy.init()
    });
  }
};
function initFlappy() { Flappy.init(); }
function quitFlappy() {
  if (Flappy.state) Flappy.state.active = false;
  cancelAnimationFrame(Flappy.frameId);
  showScreen('screen-menu');
}

// ===================== BLOCOS =====================
const Blocks = {
  board: null,
  selected: null,
  score: 0,
  SHAPES: [
    [[1,1],[1,1]], [[1,1,1]], [[1],[1],[1]],
    [[0,1],[1,1]], [[1,0],[1,1]], [[1,1,0],[0,1,1]], [[1,0],[1,0],[1,1]]
  ],
  COLORS: ['#FF595E','#FFCA3A','#8AC926','#1982C4','#6A4C93','#FF924C','#06D6A0','#EF476F'],

  init() {
    this.score = 0; this.selected = null;
    const screen = $('screen-blocks');
    screen.innerHTML = `
      <div class="score-bar">
        <span>🧱 BLOCOS</span>
        <span>Pontos: <strong id="puzzle-score">0</strong></span>
        <button class="btn btn-danger btn-small" onclick="Blocks.quit()">Sair</button>
      </div>
      <div id="blocks-puzzle">
        <div id="puzzle-board"></div>
        <div id="puzzle-pieces"></div>
      </div>
    `;
    this.board = Array.from({ length:8 }, () => Array(8).fill(0));
    this._renderBoard();
    this._genPieces();
    _activeCleanup = null;
    showScreen('screen-blocks');
  },

  _renderBoard() {
    const div = $('puzzle-board');
    if (!div) return;
    div.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        cell.className = 'puzzle-cell' + (this.board[r][c] ? ' filled' : '');
        if (this.board[r][c]) cell.style.background = this.board[r][c];
        cell.onclick = () => this._place(r, c);
        div.appendChild(cell);
      }
    }
  },

  _genPieces() {
    const div = $('puzzle-pieces');
    if (!div) return;
    div.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const shape = this.SHAPES[Math.floor(Math.random() * this.SHAPES.length)];
      const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
      const wrap = document.createElement('div');
      wrap.className = 'puzzle-piece-wrap';
      const grid = document.createElement('div');
      grid.className = 'piece-grid';
      grid.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`;
      shape.forEach(row => row.forEach(v => {
        const c = document.createElement('div');
        c.className = 'piece-cell' + (v ? ' on' : '');
        if (v) c.style.background = color;
        grid.appendChild(c);
      }));
      wrap.appendChild(grid);
      wrap.dataset.shape = JSON.stringify(shape);
      wrap.dataset.color = color;
      wrap.onclick = e => {
        e.stopPropagation();
        document.querySelectorAll('.puzzle-piece-wrap').forEach(p => p.classList.remove('selected'));
        wrap.classList.add('selected');
        this.selected = { shape, color, el: wrap };
        AudioSys.tap();
      };
      div.appendChild(wrap);
    }
  },

  _place(r, c) {
    if (!this.selected) return;
    const { shape, color } = this.selected;
    let fits = true;
    for (let i = 0; i < shape.length && fits; i++)
      for (let j = 0; j < shape[i].length && fits; j++)
        if (shape[i][j] && (r+i >= 8 || c+j >= 8 || this.board[r+i][c+j])) fits = false;
    if (!fits) { AudioSys.seqError(); return; }
    for (let i = 0; i < shape.length; i++)
      for (let j = 0; j < shape[i].length; j++)
        if (shape[i][j]) this.board[r+i][c+j] = color;
    this.selected.el.remove();
    this.selected = null;
    AudioSys.blockPlace();
    this._renderBoard();
    let cleared = 0;
    for (let row = 7; row >= 0; row--) {
      if (this.board[row].every(v => v)) {
        this.board.splice(row, 1);
        this.board.unshift(Array(8).fill(0));
        cleared++; row++;
      }
    }
    if (cleared) {
      AudioSys.blockClear();
      this.score += cleared * 10;
      $('puzzle-score').textContent = this.score;
      GameData.addCoins(cleared * 2);
      spawnParticles('💥', 5);
      this._renderBoard();
    }
    if ($('puzzle-pieces').children.length === 0) {
      this._genPieces();
      this.score += 20; $('puzzle-score').textContent = this.score;
      AudioSys.win(); GameData.addXP(10);
      updateMissionProgress('blocks1', 1);
      spawnParticles('🎉', 8);
    }
  },

  quit() { showScreen('screen-menu'); }
};
function initBlocks() { Blocks.init(); }
function quitBlocks() { Blocks.quit(); }

// ===================== MEMÓRIA =====================
const Memory = {
  timer: null, seconds: 0, pairs: 0, flipped: [], locked: false,

  init() {
    clearInterval(this.timer);
    this.seconds = 0; this.pairs = 0; this.flipped = []; this.locked = false;
    const emojis = ['🐶','🐱','🦊','🐻','🦁','🐸','🦋','🌈'];
    const cards = shuffle([...emojis, ...emojis]);
    const grid = $('memory-grid');
    grid.innerHTML = '';
    $('memory-time').textContent = '0s';
    this.timer = setInterval(() => {
      this.seconds++;
      $('memory-time').textContent = this.seconds + 's';
    }, 1000);
    cards.forEach(emoji => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.dataset.emoji = emoji;
      card.innerHTML = `<span class="card-face front">❓</span><span class="card-face back">${emoji}</span>`;
      card.onclick = () => this._flip(card, emoji);
      grid.appendChild(card);
    });
    _activeCleanup = () => clearInterval(this.timer);
    showScreen('screen-memory');
  },

  _flip(card, emoji) {
    if (this.locked || this.flipped.length >= 2) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    card.classList.add('flipped');
    AudioSys.tap();
    this.flipped.push({ emoji, el: card });
    if (this.flipped.length === 2) {
      this.locked = true;
      if (this.flipped[0].emoji === this.flipped[1].emoji) {
        AudioSys.coin();
        setTimeout(() => {
          this.flipped.forEach(f => f.el.classList.add('matched'));
          this.flipped = []; this.locked = false;
          this.pairs++;
          if (this.pairs === 8) this._complete();
        }, 380);
      } else {
        setTimeout(() => {
          this.flipped.forEach(f => f.el.classList.remove('flipped'));
          this.flipped = []; this.locked = false;
        }, 850);
      }
    }
  },

  _complete() {
    clearInterval(this.timer);
    AudioSys.win();
    spawnParticles('⭐', 16); spawnParticles('🎉', 10);
    const coins = Math.max(10, 60 - this.seconds);
    GameData.addCoins(coins); GameData.addXP(15);
    const isNew = GameData.setRecord('memory', this.seconds);
    updateMissionProgress('memory1', 1); updateMissionProgress('coins30', coins);
    const rec = GameData.get().records.memory;
    setTimeout(() => showGameOver({
      score: this.seconds + 's', coinsEarned: coins,
      emoji: '🧠', record: rec === 999 ? '--' : rec + 's',
      isNewRecord: isNew, playAgainFn: () => Memory.init()
    }), 800);
  }
};
function initMemory() { Memory.init(); }

// ===================== PIANO =====================
function initPiano() { showScreen('screen-piano'); }

// ===================== BALÕES =====================
const Balloons = {
  interval: null, score: 0, lives: 5,

  init() {
    clearInterval(this.interval);
    this.score = 0; this.lives = 5;
    const container = $('balloons-container');
    container.innerHTML = '';
    $('balloons-score').textContent = '0';
    $('balloons-lives').textContent = '5';
    _activeCleanup = () => { clearInterval(this.interval); };
    showScreen('screen-balloons');
    this.interval = setInterval(() => {
      if (this.lives <= 0) { clearInterval(this.interval); this._end(); return; }
      this._spawn();
    }, 950);
  },

  _spawn() {
    const container = $('balloons-container');
    if (!container) return;
    const items = [
      {e:'🎈',v:1},{e:'🎈',v:1},{e:'🎈',v:1},
      {e:'🎁',v:3},{e:'💣',v:-1}
    ];
    const item = items[Math.floor(Math.random() * items.length)];
    const b = document.createElement('div');
    b.className = 'balloon';
    b.textContent = item.e;
    b.style.left = Math.random() * 70 + 5 + '%';
    let posY = 108;
    b.style.bottom = posY + '%';
    b.onclick = () => {
      clearInterval(anim); b.remove();
      if (item.v > 0) {
        this.score += item.v;
        AudioSys.pop();
        spawnParticles(item.v > 1 ? '🎁' : '💥', 4);
        updateMissionProgress('balloons20', 1);
      } else {
        this.lives = Math.max(0, this.lives - 1);
        $('balloons-lives').textContent = this.lives;
        AudioSys.crash(); screenShake();
      }
      $('balloons-score').textContent = this.score;
      if (this.lives <= 0) { clearInterval(this.interval); this._end(); }
    };
    container.appendChild(b);
    const anim = setInterval(() => {
      posY -= 0.65;
      b.style.bottom = posY + '%';
      if (posY < -15) {
        clearInterval(anim);
        if (item.v > 0 && b.parentNode) {
          this.lives = Math.max(0, this.lives - 1);
          $('balloons-lives').textContent = this.lives;
          if (this.lives <= 0) { clearInterval(this.interval); this._end(); }
        }
        b.remove();
      }
    }, 30);
  },

  _end() {
    document.querySelectorAll('.balloon').forEach(b => b.remove());
    GameData.addXP(this.score);
    const isNew = GameData.setRecord('balloons', this.score);
    showGameOver({
      score: this.score, coinsEarned: this.score,
      emoji: '🎈', record: GameData.get().records.balloons,
      isNewRecord: isNew, playAgainFn: () => Balloons.init()
    });
  }
};
function initBalloons() { Balloons.init(); }
function quitBalloons() { clearInterval(Balloons.interval); showScreen('screen-menu'); }

// ===================== JOGO DA VELHA =====================
const TTT = {
  board: Array(9).fill(null), turn:'X', over:false, difficulty:'facil',
  WINS: [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],

  init() {
    this.board = Array(9).fill(null); this.turn = 'X'; this.over = false;
    $('ttt-status').textContent = 'Sua vez! ❌';
    document.querySelectorAll('.ttt-cell').forEach(cell => {
      cell.textContent = ''; cell.className = 'ttt-cell';
      cell.onclick = () => this.move(parseInt(cell.dataset.i));
    });
    this._renderDiff();
    _activeCleanup = null;
    showScreen('screen-tictactoe');
  },

  _renderDiff() {
    let div = document.querySelector('.ttt-difficulty');
    if (!div) { div = document.createElement('div'); div.className = 'ttt-difficulty'; $('ttt-board').before(div); }
    div.innerHTML = `
      <button class="btn btn-small ${this.difficulty==='facil'?'btn-primary':''}" onclick="TTT.setDiff('facil')">😊 Fácil</button>
      <button class="btn btn-small ${this.difficulty==='medio'?'btn-primary':''}" onclick="TTT.setDiff('medio')">🧠 Médio</button>`;
  },

  setDiff(d) { this.difficulty = d; this.init(); },

  move(i) {
    if (this.over || this.board[i] || this.turn !== 'X') return;
    this._mark(i, 'X');
    if (this._win('X')) {
      this.over = true;
      $('ttt-status').textContent = 'Você venceu! 🎉';
      AudioSys.tttWin(); spawnParticles('🎉', 12);
      GameData.addCoins(30); GameData.addXP(10);
      updateMissionProgress('tictactoe1', 1);
    } else if (this.board.every(c => c)) {
      this.over = true; $('ttt-status').textContent = 'Empate! 🤝';
    } else {
      this.turn = 'O'; $('ttt-status').textContent = 'Computador... 🤔';
      setTimeout(() => this._cpu(), 480);
    }
  },

  _cpu() {
    if (this.over) return;
    const move = this.difficulty === 'facil'
      ? (() => { const e=this.board.map((v,i)=>v===null?i:null).filter(v=>v!==null); return e[Math.floor(Math.random()*e.length)]; })()
      : this._best();
    this._mark(move, 'O');
    if (this._win('O')) {
      this.over = true; $('ttt-status').textContent = 'Computador venceu! 😅'; AudioSys.crash();
    } else if (this.board.every(c => c)) {
      this.over = true; $('ttt-status').textContent = 'Empate! 🤝';
    } else {
      this.turn = 'X'; $('ttt-status').textContent = 'Sua vez! ❌';
    }
  },

  _mark(i, p) {
    this.board[i] = p;
    const cell = document.querySelector(`.ttt-cell[data-i="${i}"]`);
    if (cell) { cell.textContent = p; cell.classList.add(p.toLowerCase()); }
    AudioSys.tttPlace();
  },

  _best() {
    for (const w of this.WINS) { const v=w.map(i=>this.board[i]); if(v.filter(x=>x==='O').length===2&&v.includes(null)) return w[v.indexOf(null)]; }
    for (const w of this.WINS) { const v=w.map(i=>this.board[i]); if(v.filter(x=>x==='X').length===2&&v.includes(null)) return w[v.indexOf(null)]; }
    if (!this.board[4]) return 4;
    const e=this.board.map((v,i)=>v===null?i:null).filter(v=>v!==null);
    return e[Math.floor(Math.random()*e.length)];
  },

  _win(p) { return this.WINS.some(w => w.every(i => this.board[i] === p)); }
};
function initTicTacToe() { TTT.init(); }
function resetTicTacToe() { TTT.init(); }

// ===================== SEQUÊNCIA =====================
const Seq = {
  seq:[], idx:0, level:1, showing:false, timeout:null,
  NOTES:[523,659,784,1047],

  init() {
    clearTimeout(this.timeout);
    this.seq=[]; this.idx=0; this.level=1; this.showing=false;
    $('seq-level').textContent='1';
    $('seq-status').textContent='Observe a sequência...';
    _activeCleanup = () => clearTimeout(this.timeout);
    showScreen('screen-sequence');
    this.timeout = setTimeout(() => this._next(), 900);
  },

  _next() {
    this.idx=0; this.showing=true;
    $('seq-status').textContent='Observe... 👀';
    this.seq.push(Math.floor(Math.random()*4));
    this._play(0);
  },

  _play(i) {
    if (i >= this.seq.length) { this.showing=false; $('seq-status').textContent='Sua vez! 👆'; return; }
    const btn = document.querySelector(`.seq-btn[data-color="${this.seq[i]}"]`);
    if (btn) btn.classList.add('bright');
    AudioSys.seqNote(this.NOTES[this.seq[i]]);
    setTimeout(() => { if(btn) btn.classList.remove('bright'); }, 400);
    this.timeout = setTimeout(() => this._play(i+1), 720);
  },

  tap(color) {
    if (this.showing) return;
    const btn = document.querySelector(`.seq-btn[data-color="${color}"]`);
    if (btn) { btn.classList.add('bright'); setTimeout(()=>btn.classList.remove('bright'),200); }
    AudioSys.seqNote(this.NOTES[color]);
    if (this.seq[this.idx] !== color) { this._fail(); return; }
    this.idx++;
    if (this.idx >= this.seq.length) {
      this.level++;
      $('seq-level').textContent = this.level;
      $('seq-status').textContent = '✅ Incrível!';
      spawnParticles('⭐', 4); AudioSys.win();
      this.timeout = setTimeout(() => this._next(), 1000);
    }
  },

  _fail() {
    AudioSys.seqError(); screenShake();
    $('seq-status').textContent='Errou! 😅';
    this.showing=true;
    const coins = Math.floor(this.level*2);
    GameData.addCoins(coins); GameData.addXP(this.level);
    const isNew = GameData.setRecord('sequence', this.level);
    updateMissionProgress('sequence3', this.level);
    updateMissionProgress('coins30', coins);
    setTimeout(() => showGameOver({
      score: this.level-1, coinsEarned: coins,
      emoji:'🌈', record: GameData.get().records.sequence,
      isNewRecord: isNew, playAgainFn: () => Seq.init()
    }), 1300);
  }
};
function initSequence() { Seq.init(); }
function resetSequence() { Seq.init(); }

// ===================== MODAL =====================
let _quitAction = null;
function showModal(title, text, action) {
  $('modal-title').textContent = title;
  $('modal-text').textContent = text;
  $('modal-overlay').style.display = 'flex';
  _quitAction = action;
}
function closeModal() { $('modal-overlay').style.display = 'none'; }
function confirmQuit() { closeModal(); _quitAction?.(); }

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', () => {
  GameData._load();

  // Teclas de piano
  document.querySelectorAll('.piano-key').forEach(key => {
    const play = e => {
      if (e.cancelable) e.preventDefault();
      AudioSys.playTone(parseFloat(key.dataset.note), 'sine', 0.42, 0.2);
      key.classList.add('active');
    };
    const stop = () => key.classList.remove('active');
    key.addEventListener('touchstart', play, { passive:false });
    key.addEventListener('touchend', stop);
    key.addEventListener('mousedown', play);
    key.addEventListener('mouseup', stop);
    key.addEventListener('mouseleave', stop);
  });

  // Flappy input
  $('screen-flappy').addEventListener('touchstart', () => Flappy.flap(), { passive:true });
  $('screen-flappy').addEventListener('mousedown',  () => Flappy.flap());

  // Sequência
  document.querySelectorAll('.seq-btn').forEach(btn => {
    btn.addEventListener('click', () => Seq.tap(parseInt(btn.dataset.color)));
  });

  // Teclado
  window.addEventListener('keydown', e => {
    if (Flappy.state?.active && e.key === ' ') { e.preventDefault(); Flappy.flap(); }
  });

  checkDailyLogin();
  updatePlayerStats();
  updateBestScores();
  renderMissions();
});


// ========== AVENTURA KIDS – game.js COMPLETO V3 ==========

// ---------- DADOS PERSISTENTES ----------
const GameData = {
    _data: JSON.parse(localStorage.getItem('ak_data')) || {
        level: 1, xp: 0, coins: 0,
        streak: 0, lastLoginDate: null,
        missions: {}, missionsDate: null,
        currentHero: '🐶',
        records: { race: 0, flappy: 0, blocks: 0, memory: 999, balloons: 0, sequence: 0 }
    },
    save() { localStorage.setItem('ak_data', JSON.stringify(this._data)); },
    get() { return this._data; },
    addCoins(amount) { this._data.coins += amount; this.save(); updatePlayerStats(); },
    addXP(amount) {
        this._data.xp += amount;
        const xpForNext = this.xpForLevel(this._data.level + 1);
        if (this._data.xp >= xpForNext) {
            this._data.xp -= xpForNext;
            this._data.level++;
            this._data.coins += 15;
            this.save();
            showLevelUpEffect();
        }
        this.save();
        updatePlayerStats();
    },
    xpForLevel(lv) { return Math.floor(80 * Math.pow(1.6, lv - 1)); },
    setHero(hero) { this._data.currentHero = hero; this.save(); },
    setRecord(game, value) {
        if (game === 'memory') { if (value < this._data.records.memory) this._data.records.memory = value; }
        else { if (value > this._data.records[game]) this._data.records[game] = value; }
        this.save(); updateBestScores();
    }
};

// ---------- ÁUDIO ----------
const AudioSys = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    playTone(freq, type, dur, vol = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    },
    jump() { this.playTone(400,'sine',0.15); setTimeout(()=>this.playTone(600,'sine',0.15),80); },
    coin() { this.playTone(900,'sine',0.08); setTimeout(()=>this.playTone(1300,'sine',0.12),70); },
    crash() { this.playTone(100,'sawtooth',0.5); this.playTone(70,'square',0.3); },
    win() { [500,700,900,1100].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.15),i*100)); },
    flap() { this.playTone(350,'triangle',0.08); },
    levelUp() { [600,800,1000,1200].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.2),i*120)); },
    pop() { this.playTone(600,'sine',0.1); this.playTone(400,'sine',0.15); },
    tttPlace() { this.playTone(500,'sine',0.1); },
    tttWin() { this.playTone(700,'sine',0.15); setTimeout(()=>this.playTone(900,'sine',0.2),150); },
    sequenceNote(freq) { this.playTone(freq,'sine',0.25,0.2); },
    sequenceError() { this.playTone(150,'sawtooth',0.4); },
    blockPlace() { this.playTone(200,'square',0.1); },
    blockClear() { [300,500,700].forEach((f,i)=>setTimeout(()=>this.playTone(f,'sine',0.15),i*100)); }
};

// ---------- EFEITOS VISUAIS ----------
function showLevelUpEffect() {
    const div = document.createElement('div');
    div.className = 'level-up-toast'; div.textContent = '🎉 Nível ' + GameData.get().level + '!';
    document.body.appendChild(div);
    setTimeout(()=>div.remove(),3000);
    screenShake(); spawnParticles('✨');
}
function screenShake() {
    const el = document.querySelector('.game-container');
    el.style.animation = 'none'; el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
    setTimeout(()=>el.style.animation='',400);
}
function spawnParticles(emoji, count=12) {
    for(let i=0;i<count;i++) {
        const p = document.createElement('div');
        p.className='particle'; p.textContent=emoji;
        p.style.left=Math.random()*100+'%';
        p.style.animationDuration=(1+Math.random()*1.5)+'s';
        document.body.appendChild(p);
        setTimeout(()=>p.remove(),2500);
    }
}
function showFloatingText(x,y,text,color='#FFD700') {
    const el = document.createElement('div');
    el.className='floating-text'; el.textContent=text;
    el.style.left=x+'px'; el.style.top=y+'px'; el.style.color=color;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1500);
}
function showToast(msg) {
    const toast = document.getElementById('toast');
    if(!toast) return;
    toast.textContent=msg; toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),2500);
}

// ---------- ATUALIZAÇÕES DE INTERFACE ----------
function updatePlayerStats() {
    const data = GameData.get();
    const lvEl = document.getElementById('level-display');
    const coinEl = document.getElementById('coins-display');
    const strEl = document.getElementById('streak-display');
    if(lvEl) lvEl.textContent = data.level;
    if(coinEl) coinEl.textContent = data.coins;
    if(strEl) strEl.textContent = data.streak;
}
function updateBestScores() {
    const r = GameData.get().records;
    const be = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    be('best-race', '🏆'+r.race);
    be('best-flappy', '🏆'+r.flappy);
    be('best-blocks', '🏆'+r.blocks);
    be('best-memory', '⏱'+(r.memory===999?'--':r.memory+'s'));
    be('best-balloons', '🏆'+r.balloons);
    be('best-sequence', '🏆'+r.sequence);
}

// ---------- SISTEMA DIÁRIO ----------
function checkDailyLogin() {
    const data = GameData.get();
    const today = new Date().toDateString();
    if(data.lastLoginDate !== today) {
        const yesterday = new Date(Date.now()-86400000).toDateString();
        data.streak = (data.lastLoginDate === yesterday) ? data.streak+1 : 1;
        data.lastLoginDate = today;
        generateDailyMissions();
        GameData.save();
        showScreen('screen-reward');
    }
    updatePlayerStats();
}
function renderStreakBar() {
    const bar = document.getElementById('streak-days-bar');
    if(!bar) return;
    const streak = GameData.get().streak;
    bar.innerHTML='';
    for(let i=1;i<=7;i++) {
        const dot = document.createElement('div');
        dot.className='streak-day-dot'+(i<=streak?' active':'');
        dot.textContent = i<=streak?'✅':i;
        bar.appendChild(dot);
    }
    document.getElementById('reward-streak-msg').textContent = 'Sequência: '+streak+' dia(s)!';
    const coins = [20,30,50,70,100,150,200];
    document.getElementById('reward-coins-amount').textContent = coins[Math.min(streak,7)-1];
}
function claimDailyReward() {
    const data = GameData.get();
    const coins = [20,30,50,70,100,150,200][Math.min(data.streak,7)-1];
    GameData.addCoins(coins);
    showToast('Resgatado +'+coins+' 🪙!');
    spawnParticles('🪙',8);
    showScreen('screen-menu');
}

// ---------- MISSÕES DIÁRIAS ----------
const MISSION_POOL = [
    { id:'race1', desc:'Correr 1 vez', target:1, reward:30, check:s=>s.race>=1 },
    { id:'race3', desc:'Correr 3 vezes', target:3, reward:70, check:s=>s.race>=3 },
    { id:'flappy1', desc:'Jogar Flappy', target:1, reward:40, check:s=>s.flappy>=1 },
    { id:'memory1', desc:'Completar Memória', target:1, reward:50, check:s=>s.memory>=1 },
    { id:'blocks1', desc:'Jogar Blocos', target:1, reward:40, check:s=>s.blocks>=1 },
    { id:'balloons1', desc:'Estourar 20 balões', target:20, reward:60, check:s=>s.balloons>=20 },
    { id:'tictactoe1', desc:'Vencer 1 Jogo da Velha', target:1, reward:50, check:s=>s.tictactoe>=1 },
    { id:'sequence1', desc:'Acertar 3 sequências', target:3, reward:60, check:s=>s.sequence>=3 },
    { id:'coins30', desc:'Ganhar 30 moedas', target:30, reward:50, check:s=>s.coinsEarned>=30 }
];
function generateDailyMissions() {
    const data = GameData.get();
    data.missionsDate = new Date().toDateString();
    const shuffled = MISSION_POOL.sort(()=>Math.random()-0.5);
    data.missions = shuffled.slice(0,3).map(m=>({...m,progress:0,completed:false}));
    GameData.save();
    renderMissions();
}
function updateMissionProgress(id, amount=1) {
    const data = GameData.get();
    if(data.missionsDate !== new Date().toDateString()) return;
    const m = data.missions?.find(x=>x.id===id);
    if(m && !m.completed) {
        m.progress += amount;
        if(m.progress >= m.target) { m.completed=true; GameData.addCoins(m.reward); showToast('Missão concluída: +'+m.reward+' 🪙'); }
        GameData.save(); renderMissions();
    }
}
function renderMissions() {
    const container = document.getElementById('missions-list');
    if(!container) return;
    const missions = GameData.get().missions || [];
    container.innerHTML = missions.map(m=>
        `<div class="mission-item ${m.completed?'completed':''}">
            <span>${m.desc}</span>
            <span>${m.completed?'✅':m.progress+'/'+m.target}</span>
            <span style="color:#FF6B35;">+${m.reward}🪙</span>
        </div>`
    ).join('');
}

// ---------- NAVEGAÇÃO DE TELAS ----------
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    // pausar loops
    if(id!=='screen-race') { if(raceState) raceState.active=false; clearTimeout(raceTimeout); }
    if(id!=='screen-flappy') { if(flappyState) flappyState.active=false; cancelAnimationFrame(flappyAnimFrame); }
    clearInterval(blocksInterval); clearInterval(balloonsInterval);
    clearInterval(memoryTimer); clearTimeout(seqTimeout);
    if(id==='screen-menu'){updatePlayerStats();updateBestScores();renderMissions();}
    if(id==='screen-reward') renderStreakBar();
    if(id==='screen-tictactoe') resetTicTacToe();
    if(id==='screen-sequence') resetSequence();
    if(id==='screen-blocks') initBlocksPuzzle();
}

// ---------- HERÓI ----------
function setHero(emoji) {
    GameData.setHero(emoji);
    document.getElementById('race-hero').textContent = emoji;
    document.getElementById('flappy-hero').textContent = emoji;
    showScreen('screen-menu');
}

// ========== CORRIDA 2D LATERAL ==========
let raceState = null; let raceTimeout = null;
function initRace() {
    const heroEmoji = GameData.get().currentHero;
    // Monta a tela dinamicamente
    const screen = document.getElementById('screen-race');
    screen.innerHTML = `
        <div id="runner-container">
            <div id="runner-ground"></div>
            <div id="runner-hero">${heroEmoji}</div>
            <div id="runner-score-display">⭐ 0</div>
        </div>
    `;
    raceState = {
        active: true, score: 0, jumping: false, sliding: false,
        obstacleActive: false, speed: 2.5, frameId: null
    };
    document.getElementById('runner-score-display').textContent = '⭐ 0';
    screen.onclick = (e) => {
        if(!raceState.active) return;
        if(raceState.jumping) return;
        raceState.jumping = true;
        const hero = document.getElementById('runner-hero');
        hero.classList.add('jumping');
        AudioSys.jump();
        setTimeout(() => {
            hero.classList.remove('jumping');
            raceState.jumping = false;
        }, 500);
    };
    // Deslizar: touch de arrastar para baixo
    let touchY = 0;
    screen.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; });
    screen.addEventListener('touchmove', e => {
        if(!raceState.active) return;
        const dy = e.touches[0].clientY - touchY;
        if(dy > 30 && !raceState.sliding && !raceState.jumping) {
            raceState.sliding = true;
            document.getElementById('runner-hero').classList.add('sliding');
            setTimeout(() => {
                raceState.sliding = false;
                document.getElementById('runner-hero').classList.remove('sliding');
            }, 400);
        }
    });
    showScreen('screen-race');
    raceState.frameId = requestAnimationFrame(runnerLoop);
}
function runnerLoop(ts) {
    if(!raceState || !raceState.active) return;
    if(!raceState.obstacleActive || !document.querySelector('.runner-obstacle')) {
        spawnRunnerObstacle();
    }
    const obs = document.querySelector('.runner-obstacle');
    if(obs) {
        const heroRect = document.getElementById('runner-hero').getBoundingClientRect();
        const obsRect = obs.getBoundingClientRect();
        const containerRect = document.getElementById('runner-container').getBoundingClientRect();
        // Colisão simples
        const heroBottom = heroRect.bottom - containerRect.top;
        const heroTop = heroRect.top - containerRect.top;
        const obsLeft = obsRect.left - containerRect.left;
        const obsRight = obsRect.right - containerRect.left;
        if(obsLeft < heroRect.right - containerRect.left && obsRight > heroRect.left - containerRect.left) {
            if(!raceState.jumping && !raceState.sliding) {
                // Colidiu
                raceState.active = false;
                document.querySelector('.runner-obstacle')?.remove();
                AudioSys.crash(); screenShake();
                endRunner();
                return;
            } else if(raceState.sliding && obs.textContent === '🪨') {
                // Desviou de pedra
            } else if(raceState.jumping && obs.textContent === '📦') {
                // Passou por cima de caixa
            } else {
                // Colidiu mesmo pulando/agachando
                raceState.active = false;
                document.querySelector('.runner-obstacle')?.remove();
                AudioSys.crash(); screenShake();
                endRunner();
                return;
            }
        }
        if(obsRect.right < containerRect.left + 50 && !obs.dataset.scored) {
            raceState.score += 10;
            document.getElementById('runner-score-display').textContent = '⭐ ' + raceState.score;
            obs.dataset.scored = '1';
            AudioSys.coin();
        }
        if(obsRect.right < containerRect.left - 50) obs.remove();
    }
    raceState.frameId = requestAnimationFrame(runnerLoop);
}
function spawnRunnerObstacle() {
    const container = document.getElementById('runner-container');
    if(!container) return;
    const obs = document.createElement('div');
    obs.className = 'runner-obstacle';
    obs.textContent = Math.random()>0.5 ? '🪨' : '📦';
    container.appendChild(obs);
    raceState.obstacleActive = true;
}
function endRunner() {
    cancelAnimationFrame(raceState.frameId);
    const coins = Math.floor(raceState.score/2);
    GameData.addCoins(coins);
    GameData.addXP(Math.floor(raceState.score/3));
    GameData.setRecord('race', raceState.score);
    updateMissionProgress('race1',1); updateMissionProgress('coins30',coins);
    document.getElementById('final-score').textContent = '⭐ '+raceState.score;
    document.getElementById('final-coins-earned').textContent = '+'+coins+' 🪙';
    document.getElementById('highscore-display').textContent = GameData.get().records.race;
    document.getElementById('gameover-emoji').textContent = '🏃';
    document.getElementById('btn-play-again').onclick = initRace;
    showScreen('screen-race-over');
}

// ========== FLAPPY (AJUSTADO) ==========
let flappyState = { active:false, y:50, vel:0, gravity:0.4, jump:-6, score:0, pipes:[], lastTime:0 };
let flappyAnimFrame;
function initFlappy() {
    flappyState = { active:true, y:50, vel:0, gravity:0.4, jump:-6, score:0, pipes:[], lastTime:performance.now() };
    document.getElementById('flappy-score').textContent='0';
    document.getElementById('flappy-hero').style.top='50%';
    document.querySelectorAll('.flappy-pipe').forEach(p=>p.remove());
    showScreen('screen-flappy');
    flappyAnimFrame=requestAnimationFrame(runFlappy);
}
function flap() { if(!flappyState.active) return; flappyState.vel=flappyState.jump; AudioSys.flap(); }
function runFlappy(ts) {
    if(!flappyState.active) return;
    const dt=Math.min((ts-flappyState.lastTime)/1000,0.1); flappyState.lastTime=ts;
    flappyState.vel+=flappyState.gravity*dt*60; // ajuste
    flappyState.y+=flappyState.vel*dt*60;
    const heroEl=document.getElementById('flappy-hero');
    heroEl.style.top=flappyState.y+'%';
    heroEl.style.transform=`translateY(-50%) rotate(${Math.min(Math.max(flappyState.vel*3,-30),90)}deg)`;
    if(flappyState.y<0||flappyState.y>100) return overFlappy();
    if(flappyState.pipes.length===0||flappyState.pipes[flappyState.pipes.length-1].x<55) {
        let gapY=Math.random()*30+30, gapSize=25;
        let pipeTop=document.createElement('div'); pipeTop.className='flappy-pipe top'; pipeTop.style.height=(gapY-gapSize/2)+'%';
        let pipeBottom=document.createElement('div'); pipeBottom.className='flappy-pipe bottom'; pipeBottom.style.height=(100-(gapY+gapSize/2))+'%';
        document.getElementById('flappy-container').appendChild(pipeTop);
        document.getElementById('flappy-container').appendChild(pipeBottom);
        flappyState.pipes.push({x:100,top:pipeTop,bottom:pipeBottom,passed:false});
    }
    flappyState.pipes.forEach((p,i)=>{
        p.x-=1.2*dt*60; // mais lento
        p.top.style.left=p.x+'%'; p.bottom.style.left=p.x+'%';
        let heroTop = flappyState.y - 5;
        let heroBottom = flappyState.y + 5;
        let gapTop = parseFloat(p.top.style.height);
        let gapBottom = 100 - parseFloat(p.bottom.style.height);
        if(p.x>10&&p.x<25) {
            if(heroTop < gapTop || heroBottom > gapBottom) overFlappy();
        }
        if(p.x<20&&!p.passed){p.passed=true;flappyState.score++;document.getElementById('flappy-score').textContent=flappyState.score;AudioSys.coin();}
        if(p.x<-20){p.top.remove();p.bottom.remove();flappyState.pipes.splice(i,1);}
    });
    flappyAnimFrame=requestAnimationFrame(runFlappy);
}
function overFlappy() {
    flappyState.active=false; AudioSys.crash(); screenShake(); cancelAnimationFrame(flappyAnimFrame);
    const coins=flappyState.score*2;
    GameData.addCoins(coins); GameData.addXP(flappyState.score);
    GameData.setRecord('flappy',flappyState.score);
    updateMissionProgress('flappy1',1); updateMissionProgress('coins30',coins);
    document.getElementById('final-score').textContent='✈️ '+flappyState.score;
    document.getElementById('final-coins-earned').textContent='+'+coins+' 🪙';
    document.getElementById('gameover-emoji').textContent='✈️';
    document.getElementById('btn-play-again').onclick=initFlappy;
    showScreen('screen-race-over');
}
function quitFlappy(){flappyState.active=false;cancelAnimationFrame(flappyAnimFrame);showScreen('screen-menu');}
document.getElementById('screen-flappy').addEventListener('touchstart',flap,{passive:true});
document.getElementById('screen-flappy').addEventListener('mousedown',flap);

// ========== BLOCOS (QUEBRA-CABEÇA 8x8) ==========
let blocksInterval, puzzleBoard, puzzlePieces, selectedPiece = null;
const PUZZLE_ROWS=8, PUZZLE_COLS=8;
const PIECE_SHAPES = [
    [[1,1],[1,1]], // 2x2
    [[1,1,1]], // 1x3
    [[1],[1],[1]], // 3x1
    [[0,1],[1,1]], // L
    [[1,0],[1,1]], // L invertido
];
const PIECE_COLORS = ['#FF595E','#FFCA3A','#8AC926','#1982C4','#6A4C93','#FF924C'];
function initBlocksPuzzle() {
    const screen = document.getElementById('screen-blocks');
    screen.innerHTML = `
        <div class="score-bar"><span>🧱 BLOCOS</span><span>Pontos: <strong id="puzzle-score">0</strong></span>
            <button class="btn btn-danger btn-small" onclick="quitBlocks()">Sair</button>
        </div>
        <div id="blocks-puzzle">
            <div id="puzzle-board"></div>
            <div id="puzzle-pieces"></div>
        </div>
    `;
    puzzleBoard = Array.from({length:PUZZLE_ROWS}, ()=>Array(PUZZLE_COLS).fill(0));
    renderPuzzleBoard();
    generatePuzzlePieces();
    showScreen('screen-blocks');
}
function renderPuzzleBoard() {
    const boardDiv = document.getElementById('puzzle-board');
    boardDiv.innerHTML = '';
    for(let r=0;r<PUZZLE_ROWS;r++) {
        for(let c=0;c<PUZZLE_COLS;c++) {
            const cell = document.createElement('div');
            cell.className = 'puzzle-cell';
            if(puzzleBoard[r][c]) {
                cell.style.background = puzzleBoard[r][c];
                cell.style.boxShadow = 'inset 0 0 8px rgba(255,255,255,0.3)';
            }
            cell.onclick = () => placeSelectedPiece(r,c);
            boardDiv.appendChild(cell);
        }
    }
}
function generatePuzzlePieces() {
    const piecesDiv = document.getElementById('puzzle-pieces');
    piecesDiv.innerHTML = '';
    const numPieces = 3;
    for(let i=0;i<numPieces;i++) {
        const shape = PIECE_SHAPES[Math.floor(Math.random()*PIECE_SHAPES.length)];
        const color = PIECE_COLORS[Math.floor(Math.random()*PIECE_COLORS.length)];
        const pieceEl = document.createElement('div');
        pieceEl.className = 'puzzle-piece';
        pieceEl.style.background = color;
        pieceEl.innerHTML = shape.map(row=>row.map(v=>v?'⬛':' ').join('')).join('<br>');
        pieceEl.dataset.shape = JSON.stringify(shape);
        pieceEl.dataset.color = color;
        pieceEl.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.puzzle-piece').forEach(p=>p.style.border='');
            pieceEl.style.border = '3px solid white';
            selectedPiece = {shape, color, el: pieceEl};
            AudioSys.blockPlace();
        };
        piecesDiv.appendChild(pieceEl);
    }
}
function placeSelectedPiece(r,c) {
    if(!selectedPiece) return;
    const {shape, color} = selectedPiece;
    // Verifica se encaixa
    let fits = true;
    for(let i=0;i<shape.length;i++) {
        for(let j=0;j<shape[i].length;j++) {
            if(shape[i][j]) {
                if(r+i>=PUZZLE_ROWS || c+j>=PUZZLE_COLS || puzzleBoard[r+i][c+j]) {
                    fits = false;
                }
            }
        }
    }
    if(!fits) { AudioSys.sequenceError(); return; }
    // Coloca no tabuleiro
    for(let i=0;i<shape.length;i++) {
        for(let j=0;j<shape[i].length;j++) {
            if(shape[i][j]) {
                puzzleBoard[r+i][c+j] = color;
            }
        }
    }
    selectedPiece.el.remove();
    selectedPiece = null;
    document.querySelectorAll('.puzzle-piece').forEach(p=>p.style.border='');
    AudioSys.blockPlace();
    renderPuzzleBoard();
    // Verifica linhas completas
    let cleared = 0;
    for(let r=PUZZLE_ROWS-1;r>=0;r--) {
        if(puzzleBoard[r].every(cell=>cell)) {
            puzzleBoard.splice(r,1);
            puzzleBoard.unshift(Array(PUZZLE_COLS).fill(0));
            cleared++;
            r++;
        }
    }
    if(cleared) {
        AudioSys.blockClear();
        let pts = parseInt(document.getElementById('puzzle-score').textContent) + cleared*10;
        document.getElementById('puzzle-score').textContent = pts;
        GameData.addCoins(cleared*2);
        renderPuzzleBoard();
    }
    if(document.getElementById('puzzle-pieces').children.length===0) {
        // Todos encaixados, nova leva
        generatePuzzlePieces();
        let pts = parseInt(document.getElementById('puzzle-score').textContent) + 20;
        document.getElementById('puzzle-score').textContent = pts;
        AudioSys.win();
        GameData.addXP(10);
        updateMissionProgress('blocks1',1);
    }
}
function quitBlocks() { showScreen('screen-menu'); }

// ========== MEMÓRIA ==========
let memoryTimer, memorySeconds, memoryPairs;
function initMemory(){
    const emojis=['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'];
    const cards=[...emojis,...emojis].sort(()=>Math.random()-0.5);
    const grid=document.getElementById('memory-grid'); grid.innerHTML='';
    memorySeconds=0; memoryPairs=0;
    document.getElementById('memory-time').textContent='0s';
    clearInterval(memoryTimer);
    memoryTimer=setInterval(()=>{memorySeconds++;document.getElementById('memory-time').textContent=memorySeconds+'s';},1000);
    let flipped=[];
    cards.forEach(emoji=>{
        const card=document.createElement('div'); card.className='memory-card'; card.innerHTML=`<span>${emoji}</span>`;
        card.onclick=()=>{
            if(flipped.length<2&&!card.classList.contains('flipped')&&!card.classList.contains('matched')){
                card.classList.add('flipped'); AudioSys.playTone(300,'sine',0.1);
                flipped.push({emoji,el:card});
                if(flipped.length===2){
                    if(flipped[0].emoji===flipped[1].emoji){
                        AudioSys.coin();
                        setTimeout(()=>{flipped[0].el.classList.add('matched');flipped[1].el.classList.add('matched');flipped=[];
                            memoryPairs++;
                            if(memoryPairs===emojis.length){
                                clearInterval(memoryTimer); AudioSys.win();
                                const coinsEarned=Math.max(10,50-memorySeconds);
                                GameData.addCoins(coinsEarned); GameData.addXP(15);
                                GameData.setRecord('memory',memorySeconds);
                                updateMissionProgress('memory1',1); updateMissionProgress('coins30',coinsEarned);
                                setTimeout(()=>{alert(`Parabéns! ${memorySeconds}s - +${coinsEarned} 🪙`);showScreen('screen-menu');},500);
                            }
                        },500);
                    } else setTimeout(()=>{flipped.forEach(f=>f.el.classList.remove('flipped'));flipped=[];},1000);
                }
            }
        };
        grid.appendChild(card);
    });
    showScreen('screen-memory');
}

// ========== PIANO ==========
function initPiano(){showScreen('screen-piano');}
document.querySelectorAll('.piano-key').forEach(key=>{
    const play=(e)=>{if(e.cancelable)e.preventDefault();AudioSys.playTone(parseFloat(key.dataset.note),'sine',0.4);key.classList.add('active');};
    const stop=()=>key.classList.remove('active');
    key.addEventListener('touchstart',play);key.addEventListener('touchend',stop);
    key.addEventListener('mousedown',play);key.addEventListener('mouseup',stop);key.addEventListener('mouseleave',stop);
});

// ========== 🎈 BALÕES ==========
let balloonsInterval, balloonsScore=0, balloonsLives=5;
function initBalloons(){
    const container = document.getElementById('balloons-container');
    container.innerHTML = '';
    balloonsScore=0; balloonsLives=5;
    document.getElementById('balloons-score').textContent='0';
    document.getElementById('balloons-lives').textContent='5';
    showScreen('screen-balloons');
    clearInterval(balloonsInterval);
    balloonsInterval = setInterval(() => {
        if(balloonsLives<=0) { clearInterval(balloonsInterval); endBalloons(); return; }
        const balloon = document.createElement('div');
        balloon.className = 'balloon';
        const emojis = ['🎈','🎈','🎈','🎁','💣'];
        const value = emojis.length===5 ? [1,1,1,3,-1] : [1,-1];
        const idx = Math.floor(Math.random()*emojis.length);
        balloon.textContent = emojis[idx];
        balloon.dataset.value = value[idx];
        balloon.style.left = Math.random()*70 + 5 + '%';
        balloon.style.bottom = '-10%';
        balloon.onclick = () => {
            const v = parseInt(balloon.dataset.value);
            if(v>0) {
                balloonsScore += v;
                AudioSys.pop();
                spawnParticles('💥',3);
            } else {
                balloonsLives--;
                document.getElementById('balloons-lives').textContent = balloonsLives;
                AudioSys.crash();
            }
            balloon.remove();
            document.getElementById('balloons-score').textContent = balloonsScore;
        };
        container.appendChild(balloon);
        let pos = -10;
        const anim = setInterval(() => {
            pos += 0.8;
            balloon.style.bottom = pos + '%';
            if(pos > 100) {
                clearInterval(anim);
                if(balloon.dataset.value > 0) {
                    balloonsLives--;
                    document.getElementById('balloons-lives').textContent = balloonsLives;
                }
                balloon.remove();
                if(balloonsLives<=0) { clearInterval(balloonsInterval); endBalloons(); }
            }
        }, 30);
    }, 1000);
}
function endBalloons(){
    document.querySelectorAll('.balloon').forEach(b=>b.remove());
    GameData.addCoins(balloonsScore);
    GameData.addXP(balloonsScore);
    GameData.setRecord('balloons', balloonsScore);
    updateMissionProgress('balloons1', balloonsScore);
    document.getElementById('final-score').textContent='🎈 '+balloonsScore;
    document.getElementById('final-coins-earned').textContent='+'+balloonsScore+' 🪙';
    document.getElementById('gameover-emoji').textContent='🎈';
    document.getElementById('btn-play-again').onclick=initBalloons;
    showScreen('screen-race-over');
}
function quitBalloons(){clearInterval(balloonsInterval);showScreen('screen-menu');}

// ========== ❌ JOGO DA VELHA ==========
let tttBoard, tttTurn, tttGameOver, tttDifficulty = 'facil';
function initTicTacToe(){
    tttBoard = Array(9).fill(null); tttTurn = 'X'; tttGameOver = false;
    document.getElementById('ttt-status').textContent = 'Sua vez! (X)';
    document.querySelectorAll('.ttt-cell').forEach(cell=>{
        cell.textContent=''; cell.className='ttt-cell';
        cell.onclick = ()=>tttPlayerMove(parseInt(cell.dataset.i));
    });
    showScreen('screen-tictactoe');
    renderTTTDifficulty();
}
function renderTTTDifficulty() {
    const div = document.createElement('div');
    div.className = 'ttt-difficulty';
    div.innerHTML = `
        <button class="btn btn-small ${tttDifficulty==='facil'?'btn-primary':''}" onclick="tttSetDifficulty('facil')">Fácil</button>
        <button class="btn btn-small ${tttDifficulty==='medio'?'btn-primary':''}" onclick="tttSetDifficulty('medio')">Médio</button>
    `;
    const old = document.querySelector('.ttt-difficulty');
    if(old) old.replaceWith(div);
    else document.getElementById('ttt-board').before(div);
}
function tttSetDifficulty(level) { tttDifficulty=level; resetTicTacToe(); }
function tttPlayerMove(i) {
    if(tttGameOver||tttBoard[i]||tttTurn!=='X') return;
    tttBoard[i]='X';
    document.querySelector(`.ttt-cell[data-i="${i}"]`).textContent='X';
    document.querySelector(`.ttt-cell[data-i="${i}"]`).classList.add('x');
    AudioSys.tttPlace();
    if(checkTTTWin('X')){tttGameOver=true;AudioSys.tttWin();document.getElementById('ttt-status').textContent='Você venceu! 🎉';
        GameData.addCoins(30);GameData.addXP(10);updateMissionProgress('tictactoe1',1);}
    else if(tttBoard.every(c=>c)){tttGameOver=true;document.getElementById('ttt-status').textContent='Empate!';}
    else {tttTurn='O';document.getElementById('ttt-status').textContent='Computador...';setTimeout(computerTTT,400);}
}
function computerTTT() {
    if(tttGameOver) return;
    let move;
    if(tttDifficulty==='facil') {
        const empty = tttBoard.map((v,i)=>v===null?i:null).filter(v=>v!==null);
        move = empty[Math.floor(Math.random()*empty.length)];
    } else {
        // Médio: tenta vencer ou bloquear
        move = tttFindBestMove();
    }
    tttBoard[move]='O';
    const cell = document.querySelector(`.ttt-cell[data-i="${move}"]`);
    cell.textContent='O'; cell.classList.add('o');
    AudioSys.tttPlace();
    if(checkTTTWin('O')){tttGameOver=true;AudioSys.crash();document.getElementById('ttt-status').textContent='Computador venceu! 😢';}
    else if(tttBoard.every(c=>c)){tttGameOver=true;document.getElementById('ttt-status').textContent='Empate!';}
    else {tttTurn='X';document.getElementById('ttt-status').textContent='Sua vez! (X)';}
}
function tttFindBestMove() {
    const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(let w of wins) {
        const vals = w.map(i=>tttBoard[i]);
        if(vals.filter(v=>v==='O').length===2 && vals.includes(null)) return w[vals.indexOf(null)];
    }
    for(let w of wins) {
        const vals = w.map(i=>tttBoard[i]);
        if(vals.filter(v=>v==='X').length===2 && vals.includes(null)) return w[vals.indexOf(null)];
    }
    const empty = tttBoard.map((v,i)=>v===null?i:null).filter(v=>v!==null);
    return empty[Math.floor(Math.random()*empty.length)];
}
function checkTTTWin(p){
    const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(w=>w.every(i=>tttBoard[i]===p));
}
function resetTicTacToe(){initTicTacToe();}

// ========== 🌈 SEQUÊNCIA DE CORES ==========
let seqSequence=[], seqPlayerIndex=0, seqLevel=1, seqShowing=false, seqTimeout;
const seqNotes = [523,659,784,1047];
function initSequence(){
    seqSequence=[]; seqPlayerIndex=0; seqLevel=1; seqShowing=false;
    document.getElementById('seq-level').textContent='1';
    document.getElementById('seq-status').textContent='Observe a sequência...';
    showScreen('screen-sequence');
    setTimeout(nextSequenceRound,800);
}
function resetSequence(){initSequence();}
function nextSequenceRound(){
    seqPlayerIndex=0; seqShowing=true;
    document.getElementById('seq-status').textContent='Observe...';
    const next = Math.floor(Math.random()*4);
    seqSequence.push(next);
    playSequence(0);
}
function playSequence(i){
    if(i>=seqSequence.length){seqShowing=false;document.getElementById('seq-status').textContent='Sua vez!';return;}
    const btn = document.querySelector(`.seq-btn[data-color="${seqSequence[i]}"]`);
    btn.classList.add('bright');
    AudioSys.sequenceNote(seqNotes[seqSequence[i]]);
    setTimeout(()=>btn.classList.remove('bright'),400);
    seqTimeout = setTimeout(()=>playSequence(i+1),700);
}
document.querySelectorAll('.seq-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
        if(seqShowing) return;
        const color = parseInt(btn.dataset.color);
        btn.classList.add('bright');
        AudioSys.sequenceNote(seqNotes[color]);
        setTimeout(()=>btn.classList.remove('bright'),200);
        if(seqSequence[seqPlayerIndex]!==color){
            AudioSys.sequenceError();
            document.getElementById('seq-status').textContent='Errou! Fim de jogo.';
            const coins = Math.floor(seqLevel*2);
            GameData.addCoins(coins); GameData.addXP(seqLevel);
            GameData.setRecord('sequence',seqLevel);
            updateMissionProgress('sequence1',seqLevel);
            updateMissionProgress('coins30',coins);
            seqShowing=true;
            setTimeout(()=>showScreen('screen-menu'),2000);
            return;
        }
        seqPlayerIndex++;
        if(seqPlayerIndex>=seqSequence.length){
            seqLevel++;
            document.getElementById('seq-level').textContent=seqLevel;
            document.getElementById('seq-status').textContent='Acertou! Próxima...';
            setTimeout(nextSequenceRound,1000);
        }
    });
});

// ========== MODAL ==========
let quitAction=null;
function quitGame(){raceState.active=false;showModal("Parar a Corrida?","Quer desistir agora?",()=>showScreen('screen-menu'));}
function showModal(title,text,action){
    document.getElementById('modal-title').textContent=title;
    document.getElementById('modal-text').textContent=text;
    document.getElementById('modal-overlay').style.display='flex';
    quitAction=action;
}
function closeModal(){
    document.getElementById('modal-overlay').style.display='none';
}
function confirmQuit(){document.getElementById('modal-overlay').style.display='none';if(quitAction)quitAction();}

// ========== TECLADO ==========
window.addEventListener('keydown',e=>{
    if(flappyState.active && e.key===' ') flap();
    if(document.getElementById('screen-blocks').classList.contains('active') && selectedPiece) {
        // navegação básica
    }
});

// ========== INICIALIZAÇÃO ==========
window.addEventListener('DOMContentLoaded',()=>{
    const hero = GameData.get().currentHero;
    const raceHero = document.getElementById('race-hero');
    const flappyHero = document.getElementById('flappy-hero');
    if(raceHero) raceHero.textContent = hero;
    if(flappyHero) flappyHero.textContent = hero;
    checkDailyLogin();
    updatePlayerStats();
    updateBestScores();
    renderMissions();
});

// ========== AVENTURA KIDS – game.js COMPLETO ==========
// Com Corrida, Flappy, Blocos, Piano, Memória, Balões, Velha e Sequência

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
    sequenceNote(freq) { this.playTone(freq,'sine',0.2,0.15); },
    sequenceError() { this.playTone(150,'sawtooth',0.4); }
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
    document.getElementById('level-display').textContent = data.level;
    document.getElementById('coins-display').textContent = data.coins;
    document.getElementById('streak-display').textContent = data.streak;
}
function updateBestScores() {
    const r = GameData.get().records;
    document.getElementById('best-race').textContent = '🏆'+r.race;
    document.getElementById('best-flappy').textContent = '🏆'+r.flappy;
    document.getElementById('best-blocks').textContent = '🏆'+r.blocks;
    document.getElementById('best-memory').textContent = '⏱'+(r.memory===999?'--':r.memory+'s');
    document.getElementById('best-balloons').textContent = '🏆'+r.balloons;
    document.getElementById('best-sequence').textContent = '🏆'+r.sequence;
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
    document.getElementById(id).classList.add('active');
    // pausar loops
    if(id!=='screen-race') raceState.active=false;
    if(id!=='screen-flappy') flappyState.active=false;
    clearInterval(blocksInterval);
    clearInterval(memoryTimer);
    clearInterval(balloonsInterval);
    clearTimeout(seqTimeout);
    if(reqAnimFrame) cancelAnimationFrame(reqAnimFrame);
    if(flappyAnimFrame) cancelAnimationFrame(flappyAnimFrame);
    if(id==='screen-menu'){updatePlayerStats();updateBestScores();renderMissions();}
    if(id==='screen-reward') renderStreakBar();
    if(id==='screen-tictactoe') resetTicTacToe();
    if(id==='screen-sequence') resetSequence();
}

// ---------- HERÓI ----------
function setHero(emoji) {
    GameData.setHero(emoji);
    document.getElementById('race-hero').textContent = emoji;
    document.getElementById('flappy-hero').textContent = emoji;
    showScreen('screen-menu');
}

// ========== CORRIDA ==========
let reqAnimFrame;
let raceState = { active:false, lane:1, jumping:false, lives:3, score:0, distance:0, speed:1.2, lastTime:0, nextObjDist:6, coinsCollected:0, combo:0, lastPickupTime:0 };
const objPool = []; const MAX_POOL = 20;
function initPool() {
    const container = document.getElementById('race-container');
    for(let i=0;i<MAX_POOL;i++) {
        const el = document.createElement('div'); el.className='game-obj';
        container.appendChild(el);
        objPool.push({el,active:false,type:'',lane:0,progress:0,emoji:''});
    }
}
window.addEventListener('load', initPool);
function getFreeObj(){return objPool.find(o=>!o.active);}
function initRace() {
    raceState = { active:true, lane:1, jumping:false, lives:3, score:0, distance:0, speed:1.2, lastTime:performance.now(), nextObjDist:6, coinsCollected:0, combo:0, lastPickupTime:0 };
    document.getElementById('race-lives').textContent='3';
    document.getElementById('race-score').textContent='0';
    document.getElementById('combo-display').textContent='';
    document.getElementById('race-hero').style.left='50%';
    document.getElementById('race-hero').classList.remove('jumping');
    objPool.forEach(o=>{o.active=false;o.el.style.display='none';});
    showScreen('screen-race');
    reqAnimFrame = requestAnimationFrame(runRace);
}
function moveLane(dir) {
    if(!raceState.active) return;
    raceState.lane = Math.max(0,Math.min(2,raceState.lane+dir));
    document.getElementById('race-hero').style.left=['20%','50%','80%'][raceState.lane];
}
function jump() {
    if(!raceState.active||raceState.jumping) return;
    raceState.jumping=true; AudioSys.jump();
    document.getElementById('race-hero').classList.add('jumping');
    setTimeout(()=>{raceState.jumping=false;document.getElementById('race-hero').classList.remove('jumping');},450);
}
function runRace(ts) {
    if(!raceState.active) return;
    const dt = Math.min((ts-raceState.lastTime)/1000,0.1);
    raceState.lastTime=ts;
    raceState.distance += raceState.speed*dt*12;
    raceState.speed += 0.01*dt;
    if(raceState.distance>raceState.nextObjDist){spawnRaceObject();raceState.nextObjDist=raceState.distance+(Math.random()*12+6)/raceState.speed;}
    if(raceState.combo>0 && ts-raceState.lastPickupTime>1500){raceState.combo=0;document.getElementById('combo-display').textContent='';}
    objPool.forEach(obj=>{
        if(!obj.active) return;
        obj.progress += raceState.speed*dt*0.7;
        const y=35+obj.progress*430;
        const laneX=[20,50,80][obj.lane];
        obj.el.style.top=y+'px'; obj.el.style.left=laneX+'%';
        obj.el.style.transform=`translate(-50%,-50%) scale(${0.1+obj.progress*1.5})`;
        if(obj.progress>0.8&&obj.progress<0.95&&obj.lane===raceState.lane) {
            if(obj.type==='coin') collectCoin(obj,ts);
            else if(obj.type==='gem') collectGem(obj);
            else if(obj.type==='obs') { if((obj.emoji==='🪨'||obj.emoji==='📦')&&raceState.jumping) return; hitObstacle(obj); }
        }
        if(obj.progress>1.15){obj.active=false;obj.el.style.display='none';}
    });
    reqAnimFrame=requestAnimationFrame(runRace);
}
function collectCoin(obj,ts) {
    raceState.coinsCollected++; raceState.combo++; raceState.lastPickupTime=ts;
    raceState.score+=5+Math.floor(raceState.combo/5)*2;
    GameData.addCoins(1); AudioSys.coin();
    document.getElementById('race-score').textContent=raceState.score;
    if(raceState.combo>5) document.getElementById('combo-display').textContent=raceState.combo+'x COMBO!';
    obj.active=false; obj.el.style.display='none';
}
function collectGem(obj) {
    raceState.coinsCollected+=5; raceState.score+=25;
    GameData.addCoins(5); AudioSys.coin();
    document.getElementById('race-score').textContent=raceState.score;
    spawnParticles('💎',6);
    obj.active=false; obj.el.style.display='none';
}
function spawnRaceObject() {
    const obj=getFreeObj(); if(!obj) return;
    const rand=Math.random();
    let type, emoji;
    if(rand<0.05){type='gem';emoji='💎';}
    else if(rand<0.5){type='coin';emoji='🪙';}
    else {type='obs';emoji=['🪨','📦','🚧','🌵'][Math.floor(Math.random()*4)];}
    obj.active=true; obj.type=type; obj.emoji=emoji; obj.lane=Math.floor(Math.random()*3); obj.progress=0;
    obj.el.innerHTML=`<span style="font-size:3rem;">${emoji}</span>`;
    obj.el.style.display='block';
}
function hitObstacle(obj) {
    raceState.lives--; raceState.combo=0; AudioSys.crash(); screenShake();
    document.getElementById('race-lives').textContent=raceState.lives;
    obj.active=false; obj.el.style.display='none';
    if(raceState.lives<=0) endRace();
}
function endRace() {
    raceState.active=false; cancelAnimationFrame(reqAnimFrame);
    const coinsEarned=Math.floor(raceState.coinsCollected*0.6);
    GameData.addCoins(coinsEarned);
    GameData.addXP(Math.floor(raceState.distance/5));
    GameData.setRecord('race',raceState.score);
    updateMissionProgress('race1',1); updateMissionProgress('race3',1); updateMissionProgress('coins30',coinsEarned);
    document.getElementById('final-score').textContent='⭐ '+raceState.score;
    document.getElementById('final-coins-earned').textContent='+'+coinsEarned+' 🪙';
    document.getElementById('highscore-display').textContent=GameData.get().records.race;
    document.getElementById('gameover-emoji').textContent='🏁';
    document.getElementById('new-record-badge').style.display = (raceState.score>GameData.get().records.race)?'block':'none';
    document.getElementById('btn-play-again').onclick=initRace;
    showScreen('screen-race-over');
}

// Swipe corrida
const raceContainer = document.getElementById('race-container');
let touchStartX=0, touchStartY=0;
raceContainer.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].screenX;touchStartY=e.changedTouches[0].screenY;},{passive:true});
raceContainer.addEventListener('touchend',e=>{
    if(!raceState.active) return;
    let dx=e.changedTouches[0].screenX-touchStartX, dy=e.changedTouches[0].screenY-touchStartY;
    if(Math.abs(dx)>Math.abs(dy)){if(Math.abs(dx)>30) moveLane(dx>0?1:-1);}
    else {if(dy<-30) jump();}
},{passive:true});

// ========== FLAPPY ==========
let flappyState = { active:false, y:50, vel:0, gravity:180, jump:-55, score:0, pipes:[], lastTime:0 };
let flappyAnimFrame;
function initFlappy() {
    flappyState = { active:true, y:50, vel:0, gravity:180, jump:-55, score:0, pipes:[], lastTime:performance.now() };
    document.getElementById('flappy-score').textContent='0';
    document.getElementById('flappy-hero').style.top='50%';
    document.querySelectorAll('.flappy-pipe').forEach(p=>p.remove());
    showScreen('screen-flappy');
    flappyAnimFrame=requestAnimationFrame(runFlappy);
}
function flap() {
    if(!flappyState.active) return;
    flappyState.vel=flappyState.jump; AudioSys.flap();
}
function runFlappy(ts) {
    if(!flappyState.active) return;
    const dt=Math.min((ts-flappyState.lastTime)/1000,0.1); flappyState.lastTime=ts;
    flappyState.vel+=flappyState.gravity*dt; flappyState.y+=flappyState.vel*dt;
    const heroEl=document.getElementById('flappy-hero');
    heroEl.style.top=flappyState.y+'%';
    heroEl.style.transform=`translateY(-50%) rotate(${Math.min(Math.max(flappyState.vel*0.4,-30),90)}deg)`;
    if(flappyState.y<0||flappyState.y>100) return overFlappy();
    if(flappyState.pipes.length===0||flappyState.pipes[flappyState.pipes.length-1].x<60) {
        let gapY=Math.random()*35+25, gapSize=30;
        let pipeTop=document.createElement('div'); pipeTop.className='flappy-pipe top'; pipeTop.style.height=(gapY-gapSize/2)+'%';
        let pipeBottom=document.createElement('div'); pipeBottom.className='flappy-pipe bottom'; pipeBottom.style.height=(100-(gapY+gapSize/2))+'%';
        document.getElementById('flappy-container').appendChild(pipeTop);
        document.getElementById('flappy-container').appendChild(pipeBottom);
        flappyState.pipes.push({x:100,top:pipeTop,bottom:pipeBottom,passed:false});
    }
    flappyState.pipes.forEach((p,i)=>{
        p.x-=25*dt;
        p.top.style.left=p.x+'%'; p.bottom.style.left=p.x+'%';
        if(p.x>12&&p.x<25) {
            let heroY=flappyState.y, gapTop=parseFloat(p.top.style.height), gapBottom=100-parseFloat(p.bottom.style.height);
            if(heroY<gapTop+5||heroY>gapBottom-5) overFlappy();
        }
        if(p.x<20&&!p.passed){p.passed=true;flappyState.score++;document.getElementById('flappy-score').textContent=flappyState.score;AudioSys.coin();}
        if(p.x<-20){p.top.remove();p.bottom.remove();flappyState.pipes.splice(i,1);}
    });
    flappyAnimFrame=requestAnimationFrame(runFlappy);
}
function overFlappy() {
    flappyState.active=false; AudioSys.crash(); screenShake(); cancelAnimationFrame(flappyAnimFrame);
    const coinsEarned=flappyState.score*2;
    GameData.addCoins(coinsEarned); GameData.addXP(flappyState.score);
    GameData.setRecord('flappy',flappyState.score);
    updateMissionProgress('flappy1',1); updateMissionProgress('coins30',coinsEarned);
    document.getElementById('final-score').textContent='✈️ '+flappyState.score;
    document.getElementById('final-coins-earned').textContent='+'+coinsEarned+' 🪙';
    document.getElementById('highscore-display').textContent=GameData.get().records.flappy;
    document.getElementById('gameover-emoji').textContent='✈️';
    document.getElementById('new-record-badge').style.display = (flappyState.score>GameData.get().records.flappy)?'block':'none';
    document.getElementById('btn-play-again').onclick=initFlappy;
    showScreen('screen-race-over');
}
function quitFlappy() { flappyState.active=false; showScreen('screen-menu'); }
document.getElementById('screen-flappy').addEventListener('touchstart',flap,{passive:true});
document.getElementById('screen-flappy').addEventListener('mousedown',flap);

// ========== BLOCOS ==========
let blocksInterval, board, piece, blockSize, blocksLinesCleared=0;
const COLS=10, ROWS=20;
const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
const COLORS=['#FF0D72','#0DC2FF','#0DFF72','#F538FF','#FF8E0D','#FFE138','#3877FF'];
function resizeCanvas() {
    const parent=document.getElementById('blocks-canvas').parentElement;
    blockSize=Math.min(Math.floor(parent.clientHeight/ROWS),Math.floor(parent.clientWidth/COLS));
    const canvas=document.getElementById('blocks-canvas');
    canvas.width=blockSize*COLS; canvas.height=blockSize*ROWS;
    drawBoard();
}
function createBoard(){board=Array.from({length:ROWS},()=>Array(COLS).fill(0));}
function drawBlock(x,y,color){
    const ctx=document.getElementById('blocks-canvas').getContext('2d');
    ctx.fillStyle=color; ctx.fillRect(x*blockSize,y*blockSize,blockSize,blockSize);
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(x*blockSize,y*blockSize,blockSize,blockSize*0.3);
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x*blockSize,y*blockSize+blockSize*0.7,blockSize,blockSize*0.3);
    ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(x*blockSize,y*blockSize,blockSize,blockSize);
}
function drawBoard(){
    const canvas=document.getElementById('blocks-canvas'); if(!canvas.width) return;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]) drawBlock(c,r,board[r][c]);
    if(piece) piece.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v) drawBlock(piece.x+c,piece.y+r,piece.color);}));
}
function newPiece(){
    const idx=Math.floor(Math.random()*SHAPES.length);
    piece={shape:SHAPES[idx],color:COLORS[idx],x:Math.floor(COLS/2)-1,y:0};
    if(checkCollision()){clearInterval(blocksInterval);endBlocks();}
}
function checkCollision(dx=0,dy=0,shape=piece.shape){
    for(let r=0;r<shape.length;r++) for(let c=0;c<shape[r].length;c++){
        if(!shape[r][c]) continue;
        let nx=piece.x+c+dx, ny=piece.y+r+dy;
        if(nx<0||nx>=COLS||ny>=ROWS) return true;
        if(ny>=0&&board[ny][nx]) return true;
    }
    return false;
}
function merge(){piece.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v) board[piece.y+r][piece.x+c]=piece.color;}));}
function clearLines(){
    let lines=0;
    for(let r=ROWS-1;r>=0;r--) if(board[r].every(cell=>cell)){board.splice(r,1);board.unshift(Array(COLS).fill(0));lines++;r++;}
    if(lines){blocksLinesCleared+=lines;document.getElementById('blocks-lines').textContent=blocksLinesCleared;AudioSys.coin();
        updateMissionProgress('blocks1',1); updateMissionProgress('coins30',lines*5); GameData.addCoins(lines*3);}
}
function moveBlock(dir){if(piece&&!checkCollision(dir,0)){piece.x+=dir;drawBoard();}}
function rotateBlock(){
    if(!piece) return;
    const rot=piece.shape[0].map((_,i)=>piece.shape.map(row=>row[i]).reverse());
    if(!checkCollision(0,0,rot)){piece.shape=rot;AudioSys.playTone(150,'square',0.05);drawBoard();}
}
function dropBlock(){
    if(!piece) return;
    if(!checkCollision(0,1)) piece.y++; else {merge();clearLines();newPiece();AudioSys.playTone(100,'square',0.1);}
    drawBoard();
}
function initBlocks(){
    showScreen('screen-blocks'); setTimeout(resizeCanvas,100);
    window.addEventListener('resize',resizeCanvas);
    createBoard(); newPiece(); blocksLinesCleared=0;
    document.getElementById('blocks-lines').textContent='0';
    if(blocksInterval) clearInterval(blocksInterval);
    blocksInterval=setInterval(dropBlock,700);
}
function endBlocks(){
    clearInterval(blocksInterval); window.removeEventListener('resize',resizeCanvas);
    GameData.addXP(20); GameData.addCoins(blocksLinesCleared*3);
    GameData.setRecord('blocks',blocksLinesCleared); showScreen('screen-menu');
}
function quitBlocks(){endBlocks();}
// Swipe blocos
let bStartX,bStartY,bLastMoveTime=0;
const canvasEl=document.getElementById('blocks-canvas');
canvasEl.addEventListener('touchstart',e=>{bStartX=e.changedTouches[0].screenX;bStartY=e.changedTouches[0].screenY;bLastMoveTime=performance.now();e.preventDefault();},{passive:false});
canvasEl.addEventListener('touchmove',e=>{
    if(performance.now()-bLastMoveTime<100) return;
    let dx=e.changedTouches[0].screenX-bStartX, dy=e.changedTouches[0].screenY-bStartY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>30){moveBlock(dx>0?1:-1);bStartX=e.changedTouches[0].screenX;bLastMoveTime=performance.now();}
    else if(dy>40){dropBlock();bStartY=e.changedTouches[0].screenY;bLastMoveTime=performance.now();}
},{passive:false});
canvasEl.addEventListener('touchend',e=>{
    let dx=e.changedTouches[0].screenX-bStartX, dy=e.changedTouches[0].screenY-bStartY;
    if(Math.abs(dx)<15&&Math.abs(dy)<15) rotateBlock();
},{passive:false});

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
let balloonsInterval, balloonsScore=0, balloonsLives=5, balloonsActive=false;
function initBalloons(){
    balloonsScore=0; balloonsLives=5; balloonsActive=true;
    document.getElementById('balloons-score').textContent='0';
    document.getElementById('balloons-lives').textContent='5';
    document.querySelectorAll('.balloon').forEach(b=>b.remove());
    showScreen('screen-balloons');
    if(balloonsInterval) clearInterval(balloonsInterval);
    balloonsInterval=setInterval(spawnBalloon, 800);
    document.getElementById('balloons-container').onclick = (e) => {
        if(e.target.classList.contains('balloon')){
            const balloon = e.target;
            const value = parseInt(balloon.dataset.value) || 1;
            balloonsScore += value;
            AudioSys.pop();
            balloon.remove();
            document.getElementById('balloons-score').textContent = balloonsScore;
            spawnParticles('💥',4);
        }
    };
}
function spawnBalloon(){
    if(!balloonsActive) return;
    const container = document.getElementById('balloons-container');
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    const emojis = ['🎈','🎈','🎈','🎈','🎈','🎁','💣'];
    const weights = [1,1,1,1,1,3,-2];
    const idx = Math.floor(Math.random()*emojis.length);
    balloon.textContent = emojis[idx];
    balloon.dataset.value = weights[idx];
    balloon.style.left = Math.random()*80 + 5 + '%';
    balloon.style.fontSize = (2.5 + Math.random()*1.5) + 'rem';
    balloon.style.animationDuration = (3 + Math.random()*3) + 's';
    container.appendChild(balloon);
    balloon.addEventListener('animationend', () => {
        if(balloon.dataset.value > 0) {
            balloonsLives--;
            document.getElementById('balloons-lives').textContent = balloonsLives;
            if(balloonsLives <= 0) endBalloons();
        }
        balloon.remove();
    });
}
function endBalloons(){
    balloonsActive=false; clearInterval(balloonsInterval);
    document.querySelectorAll('.balloon').forEach(b=>b.remove());
    GameData.addCoins(Math.floor(balloonsScore*0.5));
    GameData.addXP(Math.floor(balloonsScore/2));
    GameData.setRecord('balloons', balloonsScore);
    updateMissionProgress('balloons1', balloonsScore);
    updateMissionProgress('coins30', Math.floor(balloonsScore*0.5));
    document.getElementById('final-score').textContent='🎈 '+balloonsScore;
    document.getElementById('final-coins-earned').textContent='+' + Math.floor(balloonsScore*0.5) + ' 🪙';
    document.getElementById('highscore-display').textContent=GameData.get().records.balloons;
    document.getElementById('gameover-emoji').textContent='🎈';
    document.getElementById('new-record-badge').style.display = (balloonsScore>GameData.get().records.balloons)?'block':'none';
    document.getElementById('btn-play-again').onclick=initBalloons;
    showScreen('screen-race-over');
}
function quitBalloons(){balloonsActive=false;clearInterval(balloonsInterval);showScreen('screen-menu');}

// ========== ❌ JOGO DA VELHA ==========
let tttBoard, tttTurn, tttGameOver;
function initTicTacToe(){
    tttBoard = Array(9).fill(null); tttTurn = 'X'; tttGameOver = false;
    document.getElementById('ttt-status').textContent = 'Sua vez! (X)';
    document.querySelectorAll('.ttt-cell').forEach(cell=>{cell.textContent='';cell.className='ttt-cell';});
    showScreen('screen-tictactoe');
}
function resetTicTacToe(){initTicTacToe();}
document.querySelectorAll('.ttt-cell').forEach(cell=>{
    cell.addEventListener('click', ()=>{
        if(tttGameOver || !cell.textContent==='' || tttTurn!=='X') return;
        const i = parseInt(cell.dataset.i);
        tttBoard[i] = 'X'; cell.textContent = 'X'; cell.classList.add('x');
        AudioSys.tttPlace();
        if(checkTTTWin('X')) { tttGameOver=true; AudioSys.tttWin(); document.getElementById('ttt-status').textContent='Você venceu! 🎉';
            GameData.addCoins(30); GameData.addXP(10); updateMissionProgress('tictactoe1',1); }
        else if(tttBoard.every(c=>c)) { tttGameOver=true; document.getElementById('ttt-status').textContent='Empate!'; }
        else { tttTurn='O'; document.getElementById('ttt-status').textContent='Computador...'; setTimeout(computerTTT,500); }
    });
});
function computerTTT(){
    if(tttGameOver) return;
    const empty = tttBoard.map((v,i)=>v===null?i:null).filter(v=>v!==null);
    const move = empty[Math.floor(Math.random()*empty.length)];
    tttBoard[move] = 'O';
    const cell = document.querySelector(`.ttt-cell[data-i="${move}"]`);
    cell.textContent = 'O'; cell.classList.add('o');
    AudioSys.tttPlace();
    if(checkTTTWin('O')){tttGameOver=true;AudioSys.crash();document.getElementById('ttt-status').textContent='Computador venceu! 😢';}
    else if(tttBoard.every(c=>c)){tttGameOver=true;document.getElementById('ttt-status').textContent='Empate!';}
    else {tttTurn='X';document.getElementById('ttt-status').textContent='Sua vez! (X)';}
}
function checkTTTWin(p){
    const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(w=>w.every(i=>tttBoard[i]===p));
}

// ========== 🌈 SEQUÊNCIA DE CORES ==========
let seqSequence=[], seqPlayerIndex=0, seqLevel=1, seqShowing=false, seqTimeout;
const seqNotes=[523,659,784,1047]; // Cores: vermelho, amarelo, verde, azul
function initSequence(){
    seqSequence=[]; seqPlayerIndex=0; seqLevel=1; seqShowing=false;
    document.getElementById('seq-level').textContent='1';
    document.getElementById('seq-status').textContent='Observe a sequência...';
    showScreen('screen-sequence');
    setTimeout(nextSequenceRound,600);
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
    setTimeout(()=>btn.classList.remove('bright'),300);
    seqTimeout = setTimeout(()=>playSequence(i+1),600);
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
            const coinsEarned = Math.floor(seqLevel*2);
            GameData.addCoins(coinsEarned); GameData.addXP(seqLevel);
            GameData.setRecord('sequence',seqLevel);
            updateMissionProgress('sequence1',seqLevel);
            updateMissionProgress('coins30',coinsEarned);
            seqShowing=true; // travar
            setTimeout(()=>showScreen('screen-menu'),2000);
            return;
        }
        seqPlayerIndex++;
        if(seqPlayerIndex>=seqSequence.length){
            seqLevel++;
            document.getElementById('seq-level').textContent=seqLevel;
            document.getElementById('seq-status').textContent='Acertou! Próxima...';
            setTimeout(nextSequenceRound,800);
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
    if(document.getElementById('screen-race').classList.contains('active')){
        raceState.lastTime=performance.now();raceState.active=true;
        reqAnimFrame=requestAnimationFrame(runRace);
    }
}
function confirmQuit(){document.getElementById('modal-overlay').style.display='none';if(quitAction)quitAction();}

// ========== TECLADO ==========
window.addEventListener('keydown',e=>{
    if(raceState.active){
        if(e.key==='ArrowLeft') moveLane(-1); if(e.key==='ArrowRight') moveLane(1);
        if(e.key===' '||e.key==='ArrowUp') jump();
    } else if(document.getElementById('screen-blocks').classList.contains('active')){
        if(e.key==='ArrowLeft') moveBlock(-1); if(e.key==='ArrowRight') moveBlock(1);
        if(e.key==='ArrowUp') rotateBlock(); if(e.key==='ArrowDown') dropBlock();
    } else if(flappyState.active && e.key===' ') flap();
});

// ========== INICIALIZAÇÃO ==========
window.addEventListener('DOMContentLoaded',()=>{
    const hero = GameData.get().currentHero;
    document.getElementById('race-hero').textContent = hero;
    document.getElementById('flappy-hero').textContent = hero;
    initPool();
    checkDailyLogin();
    updatePlayerStats();
    updateBestScores();
    renderMissions();
});

(() => {
  'use strict';

  const W = 720, H = 1280;
  const LEVELS = Array.isArray(window.BOMBARDA_LEVELS) ? window.BOMBARDA_LEVELS : [];
  const STORAGE = {
    settings: 'bombarda_p12_settings_v1',
    stats: 'bombarda_p12_stats_v1',
    save: 'bombarda_p12_save_v1',
    progress: 'bombarda_p12_progress_v1'
  };
  const CFG = {
    playerHP: 100,
    enemyBombDamage: 5,
    reloadMs: 500,
    cannonMinDeg: -42,
    cannonMaxDeg: 42,
    bulletSpeed: 1180,
    smallStartY: 150,
    smallLoseY: 1010,
    smallScaleStart: 0.80,
    smallScaleEnd: 1.20,
    largeWarning: 1.15,
    scoreSmall: 100,
    scoreLarge: 350
  };

  const $ = s => document.querySelector(s);
  const menuScreen=$('#menuScreen'), gameScreen=$('#gameScreen');
  const newGameBtn=$('#newGameBtn'), continueBtn=$('#continueBtn'), settingsBtn=$('#settingsBtn');
  const levelSelect=$('#levelSelect'), levelMeta=$('#levelMeta');
  const settingsOverlay=$('#settingsOverlay'), closeSettingsBtn=$('#closeSettingsBtn');
  const aimLineToggle=$('#aimLineToggle'), vibrationToggle=$('#vibrationToggle'), musicToggle=$('#musicToggle');
  const pauseOverlay=$('#pauseOverlay'), pauseBtn=$('#pauseBtn'), resumeBtn=$('#resumeBtn'), restartBtn=$('#restartBtn'), quitBtn=$('#quitBtn');
  const endOverlay=$('#endOverlay'), endTitle=$('#endTitle'), endMessage=$('#endMessage'), endScore=$('#endScore'), endKills=$('#endKills');
  const playAgainBtn=$('#playAgainBtn'), endMenuBtn=$('#endMenuBtn');
  const timeText=$('#timeText'), levelText=$('#levelText'), hpText=$('#hpText'), hpFill=$('#hpFill'), hpPill=$('#hpPill'), scoreText=$('#scoreText');
  const reloadWrap=$('#reloadWrap'), reloadFill=$('#reloadFill');
  const statGames=$('#statGames'), statWins=$('#statWins'), statBest=$('#statBest');
  const joystick=$('#joystick'), joyKnob=$('#joyKnob'), fireBtn=$('#fireBtn');
  const levelBanner=$('#levelBanner'), levelBannerTitle=$('#levelBannerTitle'), levelBannerSubtitle=$('#levelBannerSubtitle');
  const canvas=$('#gameCanvas'), ctx=canvas.getContext('2d');

  let settings=loadJSON(STORAGE.settings,{aimLine:true,vibration:true,music:true});
  let stats=loadJSON(STORAGE.stats,{games:0,wins:0,best:0});
  let progress=loadJSON(STORAGE.progress,{});
  let state=null, raf=0, lastTs=performance.now(), saveAccumulator=0, bannerTimer=0;
  const keys=new Set();
  const audio = window.BombardaAudio ? new window.BombardaAudio() : null;
  const assets = window.BombardaAssets || null;
  if(audio) audio.setEnabled(settings.music);

  aimLineToggle.checked=settings.aimLine;
  vibrationToggle.checked=settings.vibration;
  musicToggle.checked=settings.music;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function rand(a,b){return a+Math.random()*(b-a);}
  function loadJSON(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch(_){return f;}}
  function saveJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function vibrate(ms=18){if(settings.vibration&&navigator.vibrate)navigator.vibrate(ms);}
  function getLevel(id){return LEVELS.find(l=>l.id===Number(id))||LEVELS[0];}
  function selectedLevel(){return getLevel(levelSelect.value||1);}

  function populateLevels(){
    levelSelect.innerHTML='';
    for(const l of LEVELS){
      const opt=document.createElement('option');
      opt.value=l.id;
      opt.textContent=`${l.id}. ${l.title} - ${l.difficulty}`;
      levelSelect.appendChild(opt);
    }
    levelSelect.value='1';
    updateLevelMeta();
  }
  function updateLevelMeta(){
    const l=selectedLevel(); if(!l)return;
    const p=progress[l.id]||{};
    const flagship=l.flagship?` · Ammiraglia ${l.flagship.hp} colpi`:'';
    const best=p.best?` · Record ${p.best}`:'';
    levelMeta.innerHTML=`${l.location} · ${l.faction} · ${l.duration}s${flagship}${best}`;
  }

  function newState(levelId){
    const level=getLevel(levelId);
    return {
      version:3, levelId:level.id,
      running:true,paused:false,ended:false,
      elapsed:0,timeLeft:level.duration,
      hp:CFG.playerHP,score:0,kills:0,
      cannonDeg:0,bullets:[],ships:[],fx:[],enemyShots:[],
      canFire:true,reloadUntil:0,
      nextSmall:0.5,nextLarge:4.5,nextShipId:1,
      flagshipSpawned:false,
      reason:''
    };
  }

  function startNewGame(levelId=selectedLevel().id){
    state=newState(levelId);
    clearSavedGame(); hideAllOverlays();
    menuScreen.classList.remove('active'); gameScreen.classList.add('active');
    lastTs=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
    const l=getLevel(state.levelId);
    if(audio) audio.playLevelMusic(l);
    showLevelBanner(l);
    updateHud();
  }

  function continueGame(){
    const save=loadJSON(STORAGE.save,null); if(!save)return;
    state=hydrateSave(save); if(!state)return startNewGame();
    levelSelect.value=String(state.levelId);
    hideAllOverlays(); menuScreen.classList.remove('active'); gameScreen.classList.add('active');
    state.paused=true; pauseOverlay.classList.remove('hidden');
    lastTs=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
    if(audio) audio.playLevelMusic(getLevel(state.levelId));
    updateHud();
  }

  function serializeState(){
    if(!state||state.ended)return null;
    return {
      version:3,levelId:state.levelId,elapsed:state.elapsed,timeLeft:state.timeLeft,hp:state.hp,score:state.score,kills:state.kills,
      cannonDeg:state.cannonDeg,canFire:state.canFire,reloadRemaining:Math.max(0,state.reloadUntil-performance.now()),
      nextSmall:state.nextSmall,nextLarge:state.nextLarge,nextShipId:state.nextShipId,flagshipSpawned:state.flagshipSpawned,
      ships:state.ships.map(s=>({...s})),bullets:state.bullets.map(b=>({...b})),enemyShots:state.enemyShots.map(e=>({...e})),savedAt:Date.now()
    };
  }

  function hydrateSave(s){
    try{
      const level=getLevel(s.levelId||1), st=newState(level.id);
      st.elapsed=clamp(Number(s.elapsed)||0,0,level.duration+10);
      st.timeLeft=clamp(Number(s.timeLeft)||level.duration,0,level.duration);
      st.hp=clamp(Number.isFinite(Number(s.hp))?Number(s.hp):CFG.playerHP,0,CFG.playerHP);
      st.score=Math.max(0,Number(s.score)||0); st.kills=Math.max(0,Number(s.kills)||0);
      st.cannonDeg=clamp(Number(s.cannonDeg)||0,CFG.cannonMinDeg,CFG.cannonMaxDeg);
      st.canFire=!!s.canFire; st.reloadUntil=performance.now()+Math.max(0,Number(s.reloadRemaining)||0);
      st.nextSmall=Number(s.nextSmall)||1; st.nextLarge=Number(s.nextLarge)||6; st.nextShipId=Number(s.nextShipId)||1;
      st.flagshipSpawned=!!s.flagshipSpawned;
      st.ships=Array.isArray(s.ships)?s.ships:[]; st.bullets=Array.isArray(s.bullets)?s.bullets:[]; st.enemyShots=Array.isArray(s.enemyShots)?s.enemyShots:[];
      st.paused=true; return st;
    }catch(_){return null;}
  }

  function persistGame(){const s=serializeState();if(s)saveJSON(STORAGE.save,s);refreshContinue();}
  function clearSavedGame(){try{localStorage.removeItem(STORAGE.save);}catch(_){}refreshContinue();}
  function refreshContinue(){continueBtn.disabled=!loadJSON(STORAGE.save,null);}
  function refreshStats(){statGames.textContent=stats.games;statWins.textContent=stats.wins;statBest.textContent=stats.best;}
  function hideAllOverlays(){settingsOverlay.classList.add('hidden');pauseOverlay.classList.add('hidden');endOverlay.classList.add('hidden');}
  function toMenu(){
    cancelAnimationFrame(raf); if(state&&!state.ended)persistGame(); if(audio)audio.stopMusic();
    state=null; gameScreen.classList.remove('active'); menuScreen.classList.add('active'); hideAllOverlays(); refreshContinue(); refreshStats(); updateLevelMeta();
  }

  function spawnSmall(){
    const lane=Math.floor(rand(0,8)), x=125+lane*67+rand(-11,11);
    state.ships.push({id:state.nextShipId++,type:'small',x,y:CFG.smallStartY+rand(-20,20),hp:1,phase:rand(0,Math.PI*2)});
  }
  function spawnLarge(){
    const l=getLevel(state.levelId),x=rand(205,515),y=rand(195,390);
    state.ships.push({id:state.nextShipId++,type:'large',x,y,hp:l.largeHP||4,warn:0,fireIn:rand(l.largeFireMin,l.largeFireMax),phase:rand(0,Math.PI*2)});
  }
  function spawnFlagship(){
    const l=getLevel(state.levelId),f=l.flagship;if(!f)return;
    state.flagshipSpawned=true;
    state.ships.push({id:state.nextShipId++,type:'flagship',x:W/2+rand(-65,65),y:245,hp:f.hp,maxHp:f.hp,warn:0,fireIn:rand(f.fireMin,f.fireMax),phase:rand(0,Math.PI*2)});
    state.fx.push({type:'bannerText',x:W/2,y:480,life:1.2,max:1.2,text:'NAVE AMMIRAGLIA!'});
  }

  function update(dt,now){
    if(!state||state.paused||state.ended)return;
    const l=getLevel(state.levelId);
    state.elapsed+=dt; state.timeLeft=Math.max(0,l.duration-state.elapsed);

    const dir=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
    if(dir)state.cannonDeg=clamp(state.cannonDeg+dir*58*dt,CFG.cannonMinDeg,CFG.cannonMaxDeg);

    state.nextSmall-=dt;state.nextLarge-=dt;
    const smallCount=state.ships.filter(s=>s.type==='small').length;
    const largeCount=state.ships.filter(s=>s.type==='large').length;
    if(state.timeLeft>0&&state.nextSmall<=0&&smallCount<l.maxSmalls){spawnSmall();state.nextSmall=l.spawnSmallEvery*rand(.78,1.18);}
    if(state.timeLeft>0&&state.nextLarge<=0&&largeCount<l.maxLarges){spawnLarge();state.nextLarge=l.spawnLargeEvery*rand(.9,1.2);}
    if(l.flagship&&!state.flagshipSpawned&&state.elapsed>=l.flagship.spawnAt)spawnFlagship();

    for(const s of state.ships){
      s.phase+=dt*1.7;
      if(s.type==='small'){
        s.y+=l.smallSpeed*dt; s.x+=Math.sin(s.phase)*4*dt;
        if(s.y>=CFG.smallLoseY){endGame(false,'Una nave nemica ha raggiunto la batteria.');return;}
      }else{
        const warning=s.type==='flagship'?(l.flagship.warning||1.25):CFG.largeWarning;
        const fireMin=s.type==='flagship'?l.flagship.fireMin:l.largeFireMin;
        const fireMax=s.type==='flagship'?l.flagship.fireMax:l.largeFireMax;
        s.fireIn-=dt;
        if(s.fireIn<=warning&&s.warn===0)s.warn=warning;
        if(s.warn>0){s.warn-=dt;if(s.warn<=0){enemyBomb(s);s.fireIn=rand(fireMin,fireMax);s.warn=0;}}
      }
    }

    for(const b of state.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;}
    for(let i=state.bullets.length-1;i>=0;i--){
      const b=state.bullets[i];let hit=false;
      for(let j=state.ships.length-1;j>=0;j--){
        const s=state.ships[j];
        if(projectileHitsShip(b,s)){
          hit=true;s.hp--;createExplosion(b.x,b.y,false);vibrate(12);
          if(s.type==='flagship')state.fx.push({type:'hpText',x:s.x,y:s.y-110,life:.45,max:.45,text:`${Math.max(0,s.hp)}/${s.maxHp}`});
          if(s.hp<=0){
            const score=s.type==='small'?CFG.scoreSmall:s.type==='large'?CFG.scoreLarge:(l.flagship.score||900);
            state.score+=score;state.kills++;
            if(s.type==='small')createSmallShipExplosion(s.x,s.y,smallScale(s.y));
            else if(s.type==='large')createLargeShipExplosion(s.x,s.y);
            else createExplosion(s.x,s.y,true);
            state.ships.splice(j,1);
          }
          break;
        }
      }
      if(hit||b.x<-30||b.x>W+30||b.y<-30)state.bullets.splice(i,1);
    }

    for(const e of state.enemyShots)e.t+=dt/e.duration;
    for(let i=state.enemyShots.length-1;i>=0;i--){
      const e=state.enemyShots[i];
      if(e.t>=1){
        state.enemyShots.splice(i,1);state.hp=Math.max(0,state.hp-CFG.enemyBombDamage);createExplosion(W/2,1055,true);
        state.fx.push({type:'damageText',x:W/2+rand(-55,55),y:1000,life:.75,max:.75,text:'- '+CFG.enemyBombDamage});vibrate(70);
        if(state.hp<=0){endGame(false,'I bombardamenti hanno distrutto la postazione.');return;}
      }
    }

    for(const f of state.fx)f.life-=dt;state.fx=state.fx.filter(f=>f.life>0);
    if(!state.canFire&&now>=state.reloadUntil)state.canFire=true;

    if(state.timeLeft<=0){
      state.nextSmall=999;state.nextLarge=999;
      if(state.ships.length===0&&state.enemyShots.length===0){endGame(true,'Hai respinto la formazione nemica!');return;}
      if(state.elapsed>=l.duration+9){endGame(true,'La formazione nemica si ritira.');return;}
    }

    if(bannerTimer>0){bannerTimer-=dt;if(bannerTimer<=0)levelBanner.classList.add('hidden');}
    saveAccumulator+=dt;if(saveAccumulator>=1){saveAccumulator=0;persistGame();}
    updateHud(now);
  }

  function projectileHitsShip(b,s){
    if(s.type==='small'){const sc=smallScale(s.y),r=26*sc;return (b.x-s.x)**2+(b.y-s.y)**2<=(r+7)**2;}
    if(s.type==='flagship')return Math.abs(b.x-s.x)<86&&Math.abs(b.y-s.y)<68;
    return Math.abs(b.x-s.x)<58&&Math.abs(b.y-s.y)<44;
  }
  function smallScale(y){const p=clamp((y-CFG.smallStartY)/(CFG.smallLoseY-CFG.smallStartY),0,1),e=p*p*(3-2*p);return lerp(CFG.smallScaleStart,CFG.smallScaleEnd,e);}

  function fire(){
    if(!state||state.paused||state.ended||!state.canFire)return;
    const rad=(state.cannonDeg-90)*Math.PI/180,origin={x:W/2,y:1084};
    state.bullets.push({x:origin.x+Math.cos(rad)*62,y:origin.y+Math.sin(rad)*62,vx:Math.cos(rad)*CFG.bulletSpeed,vy:Math.sin(rad)*CFG.bulletSpeed});
    state.canFire=false;state.reloadUntil=performance.now()+CFG.reloadMs;vibrate(16);createMuzzle(origin.x,origin.y);
  }
  function enemyBomb(ship){state.enemyShots.push({sx:ship.x,sy:ship.y,ex:W/2+rand(-90,90),ey:1050,t:0,duration:rand(.7,1.0),big:ship.type==='flagship'});}
  function createExplosion(x,y,big){state.fx.push({type:'boom',x,y,life:big?.6:.35,max:big?.6:.35,big:!!big});}
  function createSmallShipExplosion(x,y,scale=1){
    state.fx.push({type:'smallShipExplosion',x,y,life:.46,max:.46,scale});
  }
  function createLargeShipExplosion(x,y){
    state.fx.push({type:'largeShipExplosion',x,y,life:.58,max:.58,scale:1});
  }
  function createMuzzle(x,y){state.fx.push({type:'muzzle',x,y,life:.12,max:.12});}

  function endGame(win,msg){
    if(!state||state.ended)return;
    const levelId=state.levelId;state.ended=true;state.running=false;clearSavedGame();if(audio)audio.stopMusic();
    stats.games++;if(win)stats.wins++;stats.best=Math.max(stats.best,state.score);saveJSON(STORAGE.stats,stats);
    const p=progress[levelId]||{plays:0,wins:0,best:0};p.plays++;if(win)p.wins++;p.best=Math.max(p.best||0,state.score);progress[levelId]=p;saveJSON(STORAGE.progress,progress);
    endTitle.textContent=win?'Vittoria!':'Sconfitta';endMessage.textContent=msg;endScore.textContent=state.score;endKills.textContent=state.kills;
    endOverlay.classList.remove('hidden');refreshStats();updateLevelMeta();vibrate(win?[30,40,30]:100);
  }
  function pauseGame(){if(!state||state.ended)return;state.paused=true;persistGame();pauseOverlay.classList.remove('hidden');if(audio)audio.stopMusic();}
  function resumeGame(){if(!state)return;state.paused=false;pauseOverlay.classList.add('hidden');lastTs=performance.now();if(audio)audio.playLevelMusic(getLevel(state.levelId));}

  function updateHud(now=performance.now()){
    if(!state)return;
    timeText.textContent=Math.max(0,state.timeLeft).toFixed(1);levelText.textContent=state.levelId;hpText.textContent=Math.ceil(state.hp);scoreText.textContent=state.score;
    const hpPct=clamp(state.hp/CFG.playerHP,0,1)*100;if(hpFill)hpFill.style.width=hpPct+'%';if(hpPill)hpPill.classList.toggle('critical',hpPct<=25);
    let pct=100;if(!state.canFire)pct=clamp(1-(state.reloadUntil-now)/CFG.reloadMs,0,1)*100;
    reloadFill.style.width=pct+'%';reloadWrap.classList.toggle('ready',state.canFire);reloadWrap.querySelector('.reload-label').textContent=state.canFire?'CARICO':'RICARICA';
  }

  function showLevelBanner(l){
    levelBannerTitle.textContent=`Livello ${l.id} · ${l.title}`;levelBannerSubtitle.textContent=`${l.difficulty} · ${l.faction}`;levelBanner.classList.remove('hidden');bannerTimer=2.2;
  }

  function draw(){drawBackground();if(!state){drawCannon(0);drawFrame();return;}drawAimLine();drawShips();drawEnemyShots();drawBullets();drawFX();drawCannon(state.cannonDeg);drawFrame();}
  function drawBackground(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#173447');g.addColorStop(.68,'#0b2535');g.addColorStop(1,'#07131d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<17;i++){const y=105+i*54;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=W;x+=24)ctx.lineTo(x,y+Math.sin(x*.027+i*1.7+performance.now()*.0008)*7);ctx.strokeStyle=`rgba(168,205,219,${i%2?.11:.07})`;ctx.lineWidth=3;ctx.stroke();}
    ctx.save();ctx.strokeStyle='rgba(210,230,236,.085)';ctx.lineWidth=1;const gx=92,gy=118,gw=536,gh=880;for(let c=0;c<=8;c++){const x=gx+c*gw/8;ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x,gy+gh);ctx.stroke();}for(let r=0;r<=11;r++){const y=gy+r*gh/11;ctx.beginPath();ctx.moveTo(gx,y);ctx.lineTo(gx+gw,y);ctx.stroke();}ctx.restore();
    ctx.fillStyle='#5b4a36';ctx.fillRect(0,1040,W,240);ctx.fillStyle='#7c674c';ctx.fillRect(0,1040,W,26);for(let y=1072;y<H;y+=42){for(let x=(Math.floor(y/42)%2)*-36;x<W;x+=82){ctx.fillStyle='rgba(28,20,13,.32)';ctx.fillRect(x,y,78,36);ctx.strokeStyle='rgba(210,181,130,.16)';ctx.strokeRect(x,y,78,36);}}
  }
  function drawAimLine(){if(!settings.aimLine||!state)return;const rad=(state.cannonDeg-90)*Math.PI/180,x=W/2,y=1084;ctx.save();ctx.setLineDash([12,12]);ctx.lineDashOffset=-(performance.now()*.03)%24;ctx.strokeStyle='rgba(255,233,165,.62)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+Math.cos(rad)*70,y+Math.sin(rad)*70);ctx.lineTo(x+Math.cos(rad)*980,y+Math.sin(rad)*980);ctx.stroke();ctx.restore();}
  function drawShips(){for(const s of [...state.ships].sort((a,b)=>a.y-b.y)){if(s.type==='small')drawSmallShip(s);else if(s.type==='flagship')drawFlagship(s);else drawLargeShip(s);}}
  function drawSmallShip(s){
    const sc=smallScale(s.y);
    const roll=Math.sin(s.phase*1.05)*0.035;
    const bob=Math.sin(s.phase*1.65)*3;
    ctx.save();
    ctx.translate(s.x,s.y+bob);
    ctx.rotate(roll);

    if(assets&&assets.hasSmallBase&&assets.hasSmallBase()){
      const artScale=sc*.32;
      ctx.scale(artScale,artScale);
      // I PNG sono asset indipendenti: non hanno lo stesso ingombro interno
      // nel canvas sorgente. Li componiamo quindi con rettangoli dedicati,
      // invece di sovrapporli tutti nello stesso 220x220.
      const mast=assets.base('mast');
      if(mast)ctx.drawImage(mast,-85,-164,170,170);

      const back=assets.base('sailBack');
      if(back)ctx.drawImage(back,-55,-151,110,72);

      const main=assets.base('sailMain');
      if(main)ctx.drawImage(main,-90,-111,180,118);

      const l=getLevel(state.levelId);
      const flag=assets.flag(l.assetFaction||'rival');
      if(flag)ctx.drawImage(flag,-34,-87,68,68);

      // Lo scafo deve stare davanti alle vele nella vista frontale.
      const hull=assets.base('hull');
      if(hull)ctx.drawImage(hull,-76,-18,152,106);

      const shade=assets.base('shade');
      if(shade)ctx.drawImage(shade,-110,-150,220,220);
    }else{
      ctx.scale(sc,sc);
      ctx.fillStyle='#e2ad53';ctx.strokeStyle='#20150b';ctx.lineWidth=4;
      ctx.beginPath();ctx.ellipse(0,0,31,31,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(-26,10);ctx.lineTo(26,10);ctx.lineTo(22,27);ctx.quadraticCurveTo(0,38,-22,27);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#f2c268';ctx.beginPath();ctx.moveTo(-24,-8);ctx.lineTo(24,-8);ctx.lineTo(17,-28);ctx.lineTo(-15,-28);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-38);ctx.lineTo(0,-18);ctx.stroke();
    }
    ctx.restore();
  }
  function drawLargeShip(s){
    ctx.save();
    ctx.translate(s.x,s.y);
    const pulse=s.warn>0?1+Math.sin(performance.now()*.025)*.035:1;
    const roll=Math.sin(s.phase*0.95)*0.022;
    const bob=Math.sin(s.phase*1.25)*4;
    ctx.translate(0,bob);
    ctx.rotate(roll);
    ctx.scale(pulse,pulse);

    if(s.warn>0){
      ctx.beginPath();
      ctx.arc(0,0,76+Math.sin(performance.now()*.02)*5,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,90,70,.78)';
      ctx.lineWidth=5;
      ctx.stroke();
    }

    if(assets&&assets.hasLargeBase&&assets.hasLargeBase()){
      const artScale=.52;
      ctx.scale(artScale,artScale);

      const mast=assets.largeBase('mast');
      if(mast)ctx.drawImage(mast,-110,-214,220,220);

      const back=assets.largeBase('sailBack');
      if(back)ctx.drawImage(back,-92,-176,184,122);

      const main=assets.largeBase('sailMain');
      if(main)ctx.drawImage(main,-132,-142,264,176);

      const l=getLevel(state.levelId);
      const flag=assets.largeFlag(l.assetFaction||'rival');
      if(flag)ctx.drawImage(flag,-48,-106,96,96);

      const hull=assets.largeBase('hull');
      if(hull)ctx.drawImage(hull,-126,-22,252,176);

      const shade=assets.largeBase('shade');
      if(shade)ctx.drawImage(shade,-160,-160,320,320);
    }else{
      ctx.fillStyle='#c7473e';ctx.strokeStyle='#1e0d0a';ctx.lineWidth=5;
      ctx.beginPath();ctx.ellipse(0,0,66,58,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(-57,8);ctx.lineTo(57,8);ctx.lineTo(48,47);ctx.quadraticCurveTo(0,67,-48,47);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#e26455';ctx.beginPath();ctx.moveTo(-52,-18);ctx.lineTo(52,-18);ctx.lineTo(37,-53);ctx.lineTo(-35,-53);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-72);ctx.lineTo(0,-38);ctx.stroke();
    }

    ctx.restore();
  }
  function drawFlagship(s){ctx.save();ctx.translate(s.x,s.y);const pulse=s.warn>0?1+Math.sin(performance.now()*.022)*.025:1;ctx.scale(pulse,pulse);if(s.warn>0){ctx.beginPath();ctx.arc(0,0,108+Math.sin(performance.now()*.018)*6,0,Math.PI*2);ctx.strokeStyle='rgba(255,185,70,.88)';ctx.lineWidth=7;ctx.stroke();}ctx.fillStyle='#7f2631';ctx.strokeStyle='#19090b';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,92,74,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-82,10);ctx.lineTo(82,10);ctx.lineTo(68,61);ctx.quadraticCurveTo(0,87,-68,61);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#b33f49';ctx.beginPath();ctx.moveTo(-75,-22);ctx.lineTo(75,-22);ctx.lineTo(55,-67);ctx.lineTo(-54,-67);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-28,-77);ctx.lineTo(-28,-112);ctx.moveTo(28,-77);ctx.lineTo(28,-112);ctx.stroke();ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(-64,83,128,10);ctx.fillStyle='#e7c25a';ctx.fillRect(-64,83,128*clamp(s.hp/s.maxHp,0,1),10);ctx.restore();}
  function drawBullets(){for(const b of state.bullets){ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fillStyle='#21150d';ctx.fill();ctx.strokeStyle='#ffc75f';ctx.lineWidth=2;ctx.stroke();}}
  function drawEnemyShots(){for(const e of state.enemyShots){const t=clamp(e.t,0,1),x=lerp(e.sx,e.ex,t),base=lerp(e.sy,e.ey,t),arc=Math.sin(t*Math.PI)*(e.big?-220:-180),y=base+arc;ctx.beginPath();ctx.arc(x,y,e.big?10:8,0,Math.PI*2);ctx.fillStyle=e.big?'#8d1f19':'#d73a2c';ctx.fill();ctx.strokeStyle='#ffcc70';ctx.lineWidth=2;ctx.stroke();}}
  function drawFX(){
    for(const f of state.fx){
      const p=1-f.life/f.max;
      ctx.save();
      ctx.translate(f.x,f.y);
      if(f.type==='smallShipExplosion'){
        const frames=assets&&assets.explosionFrames?assets.explosionFrames():[];
        if(frames.length===8){
          const idx=Math.min(7,Math.floor(p*8));
          const size=256*(f.scale||1)*.44;
          ctx.globalAlpha=Math.min(1,(1-p)*1.8+.18);
          ctx.drawImage(frames[idx],-size/2,-size/2,size,size);
        }else{
          for(let i=0;i<8;i++){
            const a=i/8*Math.PI*2,r=p*44*(f.scale||1);
            ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,12*(1-p*.5)*(f.scale||1),0,Math.PI*2);
            ctx.fillStyle=i%2?'#ff9a3c':'#ffe084';ctx.fill();
          }
        }
      }else if(f.type==='largeShipExplosion'){
        const frames=assets&&assets.largeExplosionFrames?assets.largeExplosionFrames():[];
        if(frames.length===8){
          const idx=Math.min(7,Math.floor(p*8));
          const size=320*(f.scale||1)*.54;
          ctx.globalAlpha=Math.min(1,(1-p)*1.75+.2);
          ctx.drawImage(frames[idx],-size/2,-size/2,size,size);
        }else{
          for(let i=0;i<10;i++){
            const a=i/10*Math.PI*2,r=p*60*(f.scale||1);
            ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,18*(1-p*.45)*(f.scale||1),0,Math.PI*2);
            ctx.fillStyle=i%2?'#ff7b33':'#ffe08d';ctx.fill();
          }
        }
      }else if(f.type==='boom'){
        ctx.globalAlpha=1-p;
        for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=p*(f.big?62:34);ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,(f.big?16:10)*(1-p*.5),0,Math.PI*2);ctx.fillStyle=i%2?'#ff9a3c':'#ffe084';ctx.fill();}
      }else if(f.type==='damageText'||f.type==='hpText'||f.type==='bannerText'){
        ctx.globalAlpha=1-p;ctx.translate(0,-p*(f.type==='bannerText'?35:46));ctx.font=f.type==='bannerText'?'900 34px system-ui':'900 30px system-ui';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle='rgba(35,5,3,.8)';ctx.strokeText(f.text,0,0);ctx.fillStyle=f.type==='bannerText'?'#ffe0a0':'#ffb29d';ctx.fillText(f.text,0,0);
      }else{
        ctx.globalAlpha=1-p;ctx.fillStyle='#fff1a8';ctx.beginPath();ctx.arc(0,-70,p*28,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawCannon(deg){ctx.save();ctx.translate(W/2,1100);ctx.fillStyle='#29251f';ctx.beginPath();ctx.ellipse(0,46,96,48,0,0,Math.PI*2);ctx.fill();ctx.rotate(deg*Math.PI/180);const grd=ctx.createLinearGradient(-20,0,20,0);grd.addColorStop(0,'#59482e');grd.addColorStop(.5,'#b78b48');grd.addColorStop(1,'#4d3d29');ctx.fillStyle=grd;ctx.strokeStyle='#23190e';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(-26,-170,52,190,18);ctx.fill();ctx.stroke();ctx.restore();}
  function drawFrame(){
    ctx.save();const wall='#756b5d',mortar='rgba(34,27,20,.5)',highlight='rgba(255,244,214,.08)';ctx.fillStyle=wall;
    // Maschera piena negli angoli superiori per evitare fessure di mare tra arco e muro.
    ctx.fillRect(0,0,W,92);ctx.fillRect(0,0,80,H);ctx.fillRect(W-80,0,80,H);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(185,0);ctx.quadraticCurveTo(102,76,80,260);ctx.lineTo(0,260);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(W-185,0);ctx.quadraticCurveTo(W-102,76,W-80,260);ctx.lineTo(W,260);ctx.closePath();ctx.fill();
    for(let y=0;y<H;y+=62){for(const x0 of [0,W-80]){ctx.strokeStyle=mortar;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+80,y);ctx.stroke();ctx.strokeStyle=highlight;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y+3);ctx.lineTo(x0+80,y+3);ctx.stroke();}}
    ctx.strokeStyle='#514536';ctx.lineWidth=78;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(51,1050);ctx.lineTo(51,330);ctx.quadraticCurveTo(51,58,W/2,58);ctx.quadraticCurveTo(W-51,58,W-51,330);ctx.lineTo(W-51,1050);ctx.stroke();ctx.strokeStyle='rgba(188,169,136,.35)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(88,1050);ctx.lineTo(88,330);ctx.quadraticCurveTo(88,98,W/2,98);ctx.quadraticCurveTo(W-88,98,W-88,330);ctx.lineTo(W-88,1050);ctx.stroke();ctx.restore();
  }

  function loop(ts){const dt=Math.min(.04,(ts-lastTs)/1000);lastTs=ts;update(dt,ts);draw();raf=requestAnimationFrame(loop);}

  canvas.addEventListener('mousemove',e=>{if(!state||state.paused)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,nx=clamp((x-W/2)/(W*.43),-1,1);state.cannonDeg=nx*CFG.cannonMaxDeg;});
  canvas.addEventListener('mousedown',e=>{if(e.button===0){e.preventDefault();fire();}});
  window.addEventListener('keydown',e=>{keys.add(e.code);if(['Space','Enter'].includes(e.code)){e.preventDefault();fire();}if(e.code==='Escape'&&state&&!state.ended){state.paused?resumeGame():pauseGame();}});
  window.addEventListener('keyup',e=>keys.delete(e.code));

  let joyPointer=null;
  function updateJoy(clientX,clientY){if(!state)return;const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=clientX-cx,dy=clientY-cy;const max=34,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max;}joyKnob.style.transform=`translate(${dx}px,${dy}px)`;state.cannonDeg=clamp(dx/max,-1,1)*CFG.cannonMaxDeg;}
  joystick.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoy(e.clientX,e.clientY);});
  joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoy(e.clientX,e.clientY);});
  function releaseJoy(e){if(e.pointerId!==joyPointer)return;joyPointer=null;joyKnob.style.transform='translate(0,0)';}
  joystick.addEventListener('pointerup',releaseJoy);joystick.addEventListener('pointercancel',releaseJoy);fireBtn.addEventListener('pointerdown',e=>{e.preventDefault();fire();});

  levelSelect.addEventListener('change',updateLevelMeta);
  newGameBtn.addEventListener('click',()=>startNewGame(selectedLevel().id));continueBtn.addEventListener('click',continueGame);
  settingsBtn.addEventListener('click',()=>settingsOverlay.classList.remove('hidden'));closeSettingsBtn.addEventListener('click',()=>settingsOverlay.classList.add('hidden'));
  aimLineToggle.addEventListener('change',()=>{settings.aimLine=aimLineToggle.checked;saveJSON(STORAGE.settings,settings);});
  vibrationToggle.addEventListener('change',()=>{settings.vibration=vibrationToggle.checked;saveJSON(STORAGE.settings,settings);});
  musicToggle.addEventListener('change',()=>{settings.music=musicToggle.checked;saveJSON(STORAGE.settings,settings);if(audio){audio.setEnabled(settings.music);if(settings.music&&state&&!state.paused)audio.playLevelMusic(getLevel(state.levelId));}});
  pauseBtn.addEventListener('click',pauseGame);resumeBtn.addEventListener('click',resumeGame);restartBtn.addEventListener('click',()=>{pauseOverlay.classList.add('hidden');startNewGame(state?state.levelId:selectedLevel().id);});quitBtn.addEventListener('click',()=>{persistGame();toMenu();});
  playAgainBtn.addEventListener('click',()=>startNewGame(state?state.levelId:selectedLevel().id));endMenuBtn.addEventListener('click',toMenu);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state&&!state.ended&&!state.paused)pauseGame();});window.addEventListener('beforeunload',()=>{if(state&&!state.ended)persistGame();});

  populateLevels();refreshStats();refreshContinue();draw();
})();

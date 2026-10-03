(() => {
  'use strict';

  class BombardaAudio {
    constructor(){
      this.music = new Audio();
      this.music.loop = true;
      this.music.preload = 'auto';
      this.musicEnabled = true;
      this.sfxEnabled = true;
      this.volume = 0.45;
      this.sfxVolume = 0.72;
      this.pauseVolumeFactor = 0.30;
      this.pausedMix = false;
      this.fadeRaf = 0;
      this.music.volume = this._targetMusicVolume();
      this.pendingMusic = null;
      this.unlocked = false;
      this.sfxMissing = new Set();
      this.sfx = {
        cannonFire: 'audio/sfx/cannon/cannon_fire.mp3',
        impactSmall: 'audio/sfx/impacts/impact_small.mp3',
        impactLarge: 'audio/sfx/impacts/impact_large.mp3',
        smallExplosion: 'audio/sfx/ships/small_explosion.mp3',
        largeExplosion: 'audio/sfx/ships/large_explosion.mp3',
        uiClick: 'audio/sfx/ui/click.mp3',
        uiPause: 'audio/sfx/ui/pause.mp3'
      };
    }

    // Compatibilita' con versioni precedenti: abilita/disabilita entrambi.
    setEnabled(v){
      this.setMusicEnabled(v);
      this.setSfxEnabled(v);
    }

    setMusicEnabled(v){
      this.musicEnabled = !!v;
      if(!this.musicEnabled){
        this.pendingMusic=null;
        this.music.pause(); // conserva currentTime: se riattivata riprende dallo stesso punto
        if(this.fadeRaf)cancelAnimationFrame(this.fadeRaf);
        this.fadeRaf=0;
      }
    }

    setSfxEnabled(v){
      this.sfxEnabled = !!v;
    }

    setPaused(v,fadeMs=220){
      this.pausedMix=!!v;
      this._fadeMusicTo(this._targetMusicVolume(),fadeMs);
    }

    _targetMusicVolume(){
      return this.volume*(this.pausedMix?this.pauseVolumeFactor:1);
    }

    _fadeMusicTo(target,duration=220){
      target=Math.max(0,Math.min(1,target));
      if(this.fadeRaf)cancelAnimationFrame(this.fadeRaf);
      if(!duration){this.music.volume=target;this.fadeRaf=0;return;}
      const start=this.music.volume;
      const t0=performance.now();
      const step=(now)=>{
        const p=Math.min(1,(now-t0)/duration);
        const eased=p*p*(3-2*p);
        this.music.volume=start+(target-start)*eased;
        if(p<1)this.fadeRaf=requestAnimationFrame(step);
        else this.fadeRaf=0;
      };
      this.fadeRaf=requestAnimationFrame(step);
    }

    setVolume(v){
      this.volume = Math.max(0,Math.min(1,Number(v)||0));
      this.music.volume = this._targetMusicVolume();
    }

    setSfxVolume(v){
      this.sfxVolume = Math.max(0,Math.min(1,Number(v)||0));
    }

    unlock(){
      this.unlocked = true;
      if(this.pendingMusic){
        const pending=this.pendingMusic;
        this.pendingMusic=null;
        this._playMusic(pending);
      }
    }

    _playMusic(path){
      if(!this.musicEnabled || !path) return;
      const current=this.music.getAttribute('src')||'';
      if(current===path && !this.music.paused) return;
      if(current!==path){
        this.music.pause();
        this.music.src=path;
        try{this.music.currentTime=0;}catch(_){}
      }
      this.music.volume=this._targetMusicVolume();
      const promise=this.music.play();
      if(promise&&promise.catch){
        promise.catch(()=>{ this.pendingMusic=path; });
      }
    }

    playMenuMusic(){
      this._playMusic('audio/music/menu/menu_theme.mp3');
    }

    playLevelMusic(level){
      const spec=level&&level.music;
      if(!this.musicEnabled || !spec || !spec.ready || !spec.path){
        this.stopMusic();
        return;
      }
      this._playMusic(spec.path);
    }

    playSfx(name,volume=1){
      if(!this.sfxEnabled) return;
      const path=this.sfx[name];
      if(!path || this.sfxMissing.has(path)) return;
      try{
        const a=new Audio(path);
        a.preload='auto';
        a.volume=Math.max(0,Math.min(1,this.sfxVolume*volume));
        a.addEventListener('error',()=>this.sfxMissing.add(path),{once:true});
        const p=a.play();
        if(p&&p.catch)p.catch(()=>{});
      }catch(_){}
    }

    stopMusic(){
      this.pendingMusic=null;
      this.music.pause();
      try{this.music.currentTime=0;}catch(_){}
    }
  }

  window.BombardaAudio = BombardaAudio;
})();

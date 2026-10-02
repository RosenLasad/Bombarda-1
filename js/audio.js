(() => {
  'use strict';

  class BombardaAudio {
    constructor(){
      this.music = new Audio();
      this.music.loop = true;
      this.music.preload = 'auto';
      this.enabled = true;
      this.volume = 0.45;
      this.music.volume = this.volume;
    }
    setEnabled(v){
      this.enabled = !!v;
      if(!this.enabled) this.stopMusic();
    }
    setVolume(v){
      this.volume = Math.max(0,Math.min(1,Number(v)||0));
      this.music.volume = this.volume;
    }
    playLevelMusic(level){
      const spec = level && level.music;
      // I file musicali sono ancora placeholder: finche' ready=false non vengono caricati.
      if(!this.enabled || !spec || !spec.ready || !spec.path){ this.stopMusic(); return; }
      if(this.music.src.endsWith(spec.path) && !this.music.paused) return;
      this.music.pause();
      this.music.src = spec.path;
      this.music.currentTime = 0;
      this.music.play().catch(()=>{});
    }
    stopMusic(){
      this.music.pause();
      try{ this.music.currentTime = 0; }catch(_){}
    }
  }

  window.BombardaAudio = BombardaAudio;
})();

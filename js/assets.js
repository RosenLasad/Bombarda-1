(() => {
  'use strict';

  // Asset opzionali: il gioco continua a funzionare con la grafica vettoriale
  // provvisoria finche' i PNG definitivi non vengono inseriti nelle cartelle.
  const ROOT = 'images/ships/small/';

  const manifest = {
    small: {
      base: {
        hull: ROOT + 'base/hull.png',
        mast: ROOT + 'base/mast.png',
        sailMain: ROOT + 'base/sail_main.png',
        sailBack: ROOT + 'base/sail_back.png',
        shade: ROOT + 'base/shade_overlay.png'
      },
      flags: {
        pisa: ROOT + 'flags/flag_pisa.png',
        venice: ROOT + 'flags/flag_venice.png',
        rival: ROOT + 'flags/flag_rival.png',
        france: ROOT + 'flags/flag_france.png',
        ottoman: ROOT + 'flags/flag_ottoman.png',
        coalition: ROOT + 'flags/flag_coalition.png',
        genoa: ROOT + 'flags/flag_genoa.png'
      },
      effects: {
        hitFlash: ROOT + 'effects/hit_flash.png',
        impact: [0,1,2].map(i => ROOT + `effects/impact_puff_${String(i).padStart(2,'0')}.png`),
        explosion: Array.from({length:8},(_,i) => `images/sprites/effects/explosions/small_ship/explosion_${String(i+1).padStart(2,'0')}.png`)
      }
    }
  };

  const images = new Map();
  const status = new Map();

  function request(path){
    if(!path || images.has(path)) return images.get(path) || null;
    const img = new Image();
    status.set(path,'loading');
    img.onload = () => status.set(path,'ready');
    img.onerror = () => status.set(path,'missing');
    img.src = path;
    images.set(path,img);
    return img;
  }

  function preload(){
    const b = manifest.small.base;
    Object.values(b).forEach(request);
    Object.values(manifest.small.flags).forEach(request);
    request(manifest.small.effects.hitFlash);
    manifest.small.effects.impact.forEach(request);
    manifest.small.effects.explosion.forEach(request);
  }

  function get(path){
    const img = images.get(path);
    return img && status.get(path)==='ready' ? img : null;
  }

  function base(name){ return get(manifest.small.base[name]); }
  function flag(key){
    const requested = manifest.small.flags[key];
    return (requested && get(requested)) || get(manifest.small.flags.genoa) || get(manifest.small.flags.rival);
  }
  function impactFrames(){ return manifest.small.effects.impact.map(get).filter(Boolean); }
  function explosionFrames(){ return manifest.small.effects.explosion.map(get).filter(Boolean); }
  function hitFlash(){ return get(manifest.small.effects.hitFlash); }
  function hasSmallBase(){ return !!base('hull'); }
  function hasFullSmallExplosion(){ return explosionFrames().length===8; }

  window.BombardaAssets = {
    manifest, preload, base, flag, impactFrames, explosionFrames, hitFlash,
    hasSmallBase, hasFullSmallExplosion,
    status: path => status.get(path) || 'not-requested'
  };

  preload();
})();

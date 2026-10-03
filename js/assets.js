(() => {
  'use strict';

  // Asset opzionali: il gioco continua a funzionare con la grafica vettoriale
  // provvisoria finche' i PNG definitivi non vengono inseriti nelle cartelle.
  const SMALL_ROOT = 'images/ships/small/';
  const LARGE_ROOT = 'images/ships/large/';

  function buildShipManifest(root, explosionDir){
    return {
      base: {
        hull: root + 'base/hull.png',
        mast: root + 'base/mast.png',
        sailMain: root + 'base/sail_main.png',
        sailBack: root + 'base/sail_back.png',
        shade: root + 'base/shade_overlay.png'
      },
      flags: {
        pisa: root + 'flags/flag_pisa.png',
        venice: root + 'flags/flag_venice.png',
        rival: root + 'flags/flag_rival.png',
        france: root + 'flags/flag_france.png',
        ottoman: root + 'flags/flag_ottoman.png',
        coalition: root + 'flags/flag_coalition.png',
        genoa: root + 'flags/flag_genoa.png'
      },
      effects: {
        hitFlash: root + 'effects/hit_flash.png',
        impact: [0,1,2].map(i => root + `effects/impact_puff_${String(i).padStart(2,'0')}.png`),
        explosion: Array.from({length:8},(_,i) => `${explosionDir}/explosion_${String(i+1).padStart(2,'0')}.png`)
      }
    };
  }

  const manifest = {
    small: buildShipManifest(SMALL_ROOT, 'images/sprites/effects/explosions/small_ship'),
    large: buildShipManifest(LARGE_ROOT, 'images/sprites/effects/explosions/large_ship')
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

  function preloadShip(type){
    const ship = manifest[type];
    if(!ship) return;
    Object.values(ship.base).forEach(request);
    Object.values(ship.flags).forEach(request);
    request(ship.effects.hitFlash);
    ship.effects.impact.forEach(request);
    ship.effects.explosion.forEach(request);
  }

  function preload(){
    preloadShip('small');
    preloadShip('large');
  }

  function get(path){
    const img = images.get(path);
    return img && status.get(path)==='ready' ? img : null;
  }

  function baseFor(type,name){ return manifest[type] ? get(manifest[type].base[name]) : null; }
  function flagFor(type,key){
    const ship = manifest[type];
    if(!ship) return null;
    const requested = ship.flags[key];
    return (requested && get(requested)) || get(ship.flags.genoa) || get(ship.flags.rival);
  }
  function impactFramesFor(type){ return manifest[type] ? manifest[type].effects.impact.map(get).filter(Boolean) : []; }
  function explosionFramesFor(type){ return manifest[type] ? manifest[type].effects.explosion.map(get).filter(Boolean) : []; }
  function hitFlashFor(type){ return manifest[type] ? get(manifest[type].effects.hitFlash) : null; }
  function hasBase(type){ return !!baseFor(type,'hull'); }
  function hasFullExplosion(type){ return explosionFramesFor(type).length===8; }

  // Metodi legacy per la nave piccola, mantenuti per compatibilita'.
  function base(name){ return baseFor('small', name); }
  function flag(key){ return flagFor('small', key); }
  function impactFrames(){ return impactFramesFor('small'); }
  function explosionFrames(){ return explosionFramesFor('small'); }
  function hitFlash(){ return hitFlashFor('small'); }
  function hasSmallBase(){ return hasBase('small'); }
  function hasFullSmallExplosion(){ return hasFullExplosion('small'); }

  // Nuovi helper per la nave grande.
  function largeBase(name){ return baseFor('large', name); }
  function largeFlag(key){ return flagFor('large', key); }
  function largeImpactFrames(){ return impactFramesFor('large'); }
  function largeExplosionFrames(){ return explosionFramesFor('large'); }
  function largeHitFlash(){ return hitFlashFor('large'); }
  function hasLargeBase(){ return hasBase('large'); }
  function hasFullLargeExplosion(){ return hasFullExplosion('large'); }

  window.BombardaAssets = {
    manifest, preload,
    base, flag, impactFrames, explosionFrames, hitFlash,
    hasSmallBase, hasFullSmallExplosion,
    baseFor, flagFor, impactFramesFor, explosionFramesFor, hitFlashFor,
    largeBase, largeFlag, largeImpactFrames, largeExplosionFrames, largeHitFlash,
    hasLargeBase, hasFullLargeExplosion,
    status: path => status.get(path) || 'not-requested'
  };

  preload();
})();

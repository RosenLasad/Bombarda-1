BOMBARDA! - STRUTTURA IMMAGINI

backgrounds/
  fort/      sfondi e ambientazioni del forte/livello
  sea/       mare, cielo, foschia, fondali

decorations/
  walls/     texture, archi, conci, feritoie
  banners/   stendardi e bandiere scenografiche
  props/     torce, armi, casse, corde, dettagli

ships/
  small/     nave piccola base
  large/     nave grande base
  flagship/  nave ammiraglia / nave enorme
  factions/  bandiere, colori e dettagli per fazione

sprites/
  crew/
    gunner_left/ e gunner_right/
      idle/ reload/ hit/ victory/ defeat/
  cannon/
      idle/ fire/ recoil/
  effects/
      muzzle/ smoke/ impact/ explosions/ enemy_fire/

ui/
  icons/ hud/ menus/

Naming consigliato per frame sprite:
  reload_000.png, reload_001.png, reload_002.png ...
Tenere i frame della stessa animazione con identiche dimensioni canvas e pivot coerente.


Preparazione Fase 1 - nave grande:
- images/ships/large/base/        asset modulari nave grande
- images/ships/large/flags/       simboli/fazioni sulla vela principale
- images/sprites/effects/explosions/large_ship/   8 frame dell'esplosione della nave grande

Il codice e' gia' predisposto: se i file esistono, il gioco li usa automaticamente; altrimenti resta attivo il fallback vettoriale.

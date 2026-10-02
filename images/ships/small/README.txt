BOMBARDA! - NAVE PICCOLA / ASSET DEFINITIVI

Il motore cerca automaticamente questi PNG. Se un file manca, usa la grafica vettoriale provvisoria e il gioco continua a funzionare.

BASE (canvas consigliato 220x220 px, trasparente, stesso allineamento per tutti i file)
  base/hull.png
  base/mast.png
  base/sail_main.png
  base/sail_back.png
  base/shade_overlay.png       (facoltativo)

BANDIERE / FAZIONI
  flags/flag_pisa.png
  flags/flag_venice.png
  flags/flag_rival.png
  flags/flag_france.png
  flags/flag_ottoman.png
  flags/flag_coalition.png
  flags/flag_genoa.png          (predisposta per usi futuri)

VARIANTI FACOLTATIVE
  variants/                     per stemmi, bordature e dettagli futuri

EFFETTI DI IMPATTO
  effects/hit_flash.png
  effects/impact_puff_00.png
  effects/impact_puff_01.png
  effects/impact_puff_02.png

ESPLOSIONE COMUNE A TUTTE LE NAVI PICCOLE
  explode/explode_00.png
  explode/explode_01.png
  explode/explode_02.png
  explode/explode_03.png
  explode/explode_04.png
  explode/explode_05.png
  explode/explode_06.png
  explode/explode_07.png

Esplosione: canvas consigliato 256x256 px, trasparente, centro dell'effetto sempre nello stesso punto.
Durata nel motore: circa 0,46 secondi per gli 8 frame.

IMPORTANTE
- Non cambiare dimensioni o punto di ancoraggio tra i vari layer della nave.
- Tutti i layer base devono sovrapporsi correttamente nello stesso canvas 220x220.
- Il motore applica gia' movimento verticale, lieve rollio e scala prospettica 0.80 -> 1.20.
- La bandiera viene scelta dal campo assetFaction di ciascun livello in js/data/levels.js.
- Non serve modificare game.js quando si sostituiscono i PNG con quelli definitivi.

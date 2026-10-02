BOMBARDA! - STRUTTURA AUDIO

music/
  menu/
    menu_theme.mp3
  levels/
    level_01.mp3 ... level_06.mp3

sfx/
  cannon/    sparo, rinculo, ricarica
  impacts/   impatto acqua, legno, pietra
  ships/     bombardamento, nave distrutta, nave ammiraglia
  ui/        click, conferma, vittoria, sconfitta

Le musiche non sono incluse in questo prototipo.
In js/data/levels.js ogni traccia ha ready:false: quando il relativo MP3 sara' presente,
impostare ready:true per abilitarne la riproduzione automatica in loop.

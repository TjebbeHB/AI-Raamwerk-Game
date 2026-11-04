// Het Orakel van Dalwijk: boot.
import './core/audio.js';
import {boot, exposeDebug, GAME} from './game/game.js';
import {initMenus, showTitle} from './ui/menus.js';
import {registerContent} from './content/index.js';
import {CHAMBER} from './content/framework.js';
import {$} from './core/util.js';

registerContent();
boot({onReady() {
  initMenus();
  showTitle();
  const btn = document.querySelector('#titleBtns .go');
  if (btn) btn.disabled = false;
  exposeDebug({trial: id => CHAMBER[id].trial, CHAMBER});
  $('buildInfo').textContent = 'Versie 1.0';
}});
void GAME;

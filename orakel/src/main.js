// Het Orakel van Dalwijk: boot. A phone that opens a council link gets the advisor app instead.
import './core/audio.js';
import {boot, exposeDebug} from './game/game.js';
import {initMenus, showTitle} from './ui/menus.js';
import {registerContent} from './content/index.js';
import {CHAMBER} from './content/framework.js';
import {startAdvisor} from './net/council.js';
import {decide} from './ui/decision.js';
import {$} from './core/util.js';

if (/^#raad=/i.test(location.hash)) {
  startAdvisor(location.hash);
} else {
  registerContent();
  boot({onReady() {
    initMenus();
    showTitle();
    exposeDebug({trial: id => CHAMBER[id].trial, CHAMBER, decide});
    $('buildInfo').textContent = 'Versie 1.0.';
  }});
}

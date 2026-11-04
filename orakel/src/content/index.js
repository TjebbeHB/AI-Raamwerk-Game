// Registers all story content with the engine.
import {registerFloor} from '../game/world.js';
import {CAST, ITEMS, UI} from '../game/bus.js';
import {BEASTS} from '../game/combat.js';
import {CAST_DEFS} from './cast.js';
import {itemDefs} from './items.js';
import {BEAST_DEFS, trackLastTool} from './beasts.js';
import {BOSS_DEFS} from './bosses.js';
import {decide} from '../ui/decision.js';
import './objects.js';
import './story/common.js';
import './story/f0.js';
import './story/f1.js';
import './story/f2.js';
import './story/f3.js';
import './story/f4.js';
import F0 from './floors/f0.js';
import F1 from './floors/f1.js';
import F2 from './floors/f2.js';
import F3 from './floors/f3.js';
import F4 from './floors/f4.js';

export const FLOOR_DEFS = [F0, F1, F2, F3, F4];

export function registerContent() {
  for (const f of FLOOR_DEFS) registerFloor(f);
  Object.assign(CAST, CAST_DEFS);
  // the same people turn up on several depths
  const ALIAS = {bakker1: 'bakker', bakker3: 'bakker', bakker4: 'bakker', ilse1: 'ilse', ilse4: 'ilse', glans1: 'glans', glans2: 'glans', glans3: 'glans', glans4: 'glans', glans5: 'glans', joop4: 'joop'};
  for (const [alias, id] of Object.entries(ALIAS)) CAST[alias] = CAST[id];
  Object.assign(ITEMS, itemDefs());
  Object.assign(BEASTS, BEAST_DEFS, BOSS_DEFS);
  trackLastTool();
  UI.decide = decide;
}

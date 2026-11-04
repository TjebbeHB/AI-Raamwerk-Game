// Registers all story content with the engine.
import {registerFloor} from '../game/world.js';
import {CAST, ITEMS, UI} from '../game/bus.js';
import {BEASTS} from '../game/combat.js';
import {CAST_DEFS} from './cast.js';
import {CAST_EXTRA, ALIAS} from './cast_extra.js';
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
import {registerSystems} from './story/systems.js';
import F0 from './floors/f0.js';
import F1 from './floors/f1.js';
import F2 from './floors/f2.js';
import F3 from './floors/f3.js';
import F4 from './floors/f4.js';

export const FLOOR_DEFS = [F0, F1, F2, F3, F4];

export function registerContent() {
  for (const f of FLOOR_DEFS) registerFloor(f);
  Object.assign(CAST, CAST_DEFS, CAST_EXTRA);
  // the same people turn up on several depths (cast_extra.js lists every alias)
  for (const [alias, id] of Object.entries(ALIAS)) CAST[alias] = CAST[id];
  // Ilse sits behind the counter: from the public side you stop 2.81 m away, so give her a longer reach
  if (CAST.ilse) CAST.ilse.reach = Math.max(CAST.ilse.reach ?? 2.8, 3.6);
  Object.assign(ITEMS, itemDefs());
  Object.assign(BEASTS, BEAST_DEFS, BOSS_DEFS);
  trackLastTool();
  UI.decide = decide;
  // after every story file: the systems wrap the epilogue and add their journal tabs
  registerSystems();
}

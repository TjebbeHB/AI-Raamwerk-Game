// Actions and their keys. Everything that reads or shows a key goes through here, so key
// remapping (SETTINGS.keymap), the HUD, the controls card and the tutorial always agree.
//
//   import {actionHit, actionDown, keyLabel} from '../core/keys.js';
//   if (actionHit('ability')) useAbility();
//   UI.prompt(`Druk op ${keyLabel('interact')}`)
//
// Codes are physical keys (KeyboardEvent.code), so WASD sits in the same place on any layout.
import {SETTINGS} from '../game/state.js';
import {down, hit} from './input.js';

export const ACTIONS = {
  forward: {codes: ['KeyW', 'ArrowUp'], label: 'Vooruit lopen'},
  back: {codes: ['KeyS', 'ArrowDown'], label: 'Achteruit lopen'},
  left: {codes: ['KeyA'], label: 'Opzij naar links'},
  right: {codes: ['KeyD'], label: 'Opzij naar rechts'},
  turnLeft: {codes: ['ArrowLeft'], label: 'Draaien naar links'},
  turnRight: {codes: ['ArrowRight'], label: 'Draaien naar rechts'},
  run: {codes: ['ShiftLeft', 'ShiftRight'], label: 'Rennen'},
  dash: {codes: ['Space'], label: 'Wegduiken (ook over een smalle kloof)'},
  interact: {codes: ['KeyE'], label: 'Praten, lezen, oppakken, gebruiken'},
  ability: {codes: ['KeyF'], label: 'Speciale vaardigheid'},
  reveal: {codes: ['KeyR'], label: 'Onthullen wat niet echt is'},
  tool1: {codes: ['Digit1', 'Numpad1'], label: 'Toetslamp kiezen'},
  tool2: {codes: ['Digit2', 'Numpad2'], label: 'Weegschaal kiezen'},
  tool3: {codes: ['Digit3', 'Numpad3'], label: 'Zegel kiezen'},
  cycle: {codes: ['KeyQ'], label: 'Volgend gereedschap, of neerleggen wat je draagt'},
  camera: {codes: ['KeyV'], label: 'Eerste of derde persoon'},
  journal: {codes: ['KeyJ', 'Tab'], label: 'Dossier en opdrachten'},
  map: {codes: ['KeyM'], label: 'Kaart'},
  hint: {codes: ['KeyH'], label: 'Een hint van Pip'},
  menu: {codes: ['Escape'], label: 'Menu en pauze'},
};

// A remap replaces the main key and keeps the alternatives (arrow keys, numpad).
export function codesFor(action) {
  const def = ACTIONS[action]?.codes || [];
  const o = SETTINGS.keymap?.[action];
  return o ? [o, ...def.slice(1).filter(c => c !== o)] : def;
}
export const actionDown = action => codesFor(action).some(down);
export const actionHit = action => codesFor(action).some(hit);

const NAMES = {Space: 'Spatie', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
  Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\'};
export function codeLabel(code) {
  if (!code) return '';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}
export const keyLabel = action => codeLabel(codesFor(action)[0]);

// Scripted playthrough of one floor, with a screenshot after every step.
//   node orakel/test/e2e/run.mjs f2            -> runs s_f2.mjs against orakel/dist/index.html
//   node orakel/test/e2e/run.mjs path/to/steps.mjs shots/prefix
// A steps file exports [{name, js, wait, shot}]; js runs in the page (window.__orakel is the debug API).
// Env: GAME (html file), SHOTS (dir), Q (query, default ?q=low), VIEW (default 960x540), TIMEOUT, BOOT.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {GAME_URL, SHOTS, launch} from './_env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2] || 'f0';
const stepsFile = arg.endsWith('.mjs') ? path.resolve(arg) : path.join(here, `s_${arg}.mjs`);
const prefix = process.argv[3] || SHOTS + path.basename(stepsFile, '.mjs').replace(/^s_/, '');
const steps = (await import(pathToFileURL(stepsFile).href)).default;
const browser = await launch();
const [VW, VH] = (process.env.VIEW || '960x540').split('x').map(Number);
const page = await browser.newPage({viewport: {width: VW, height: VH}, deviceScaleFactor: 1});
page.setDefaultTimeout(+process.env.TIMEOUT || 240000);
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(GAME_URL + (process.env.Q ?? '?q=low'));
await page.waitForTimeout(+process.env.BOOT || 2500);
for (const s of steps) {
  if (s.js) { try { const r = await page.evaluate(s.js); if (r !== undefined) logs.push(`[eval ${s.name}] ${typeof r === 'string' ? r : JSON.stringify(r)}`); } catch (e) { logs.push(`[evalerror ${s.name}] ${e.message}`); } }
  await page.waitForTimeout(s.wait ?? 800);
  if (s.shot !== false) await page.screenshot({path: `${prefix}-${s.name}.png`});
}
fs.writeFileSync(`${prefix}-log.txt`, logs.join('\n'));
console.log(logs.join('\n'));
await browser.close();

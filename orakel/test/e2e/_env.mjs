// Shared setup for the browser checks: where Playwright, the game and the screenshots are.
//   PLAYWRIGHT=/path/to/playwright/index.js   (default: the pre-installed one, else the npm package)
//   GAME=/path/to/index.html                  (default: orakel/dist/index.html of this checkout)
//   SHOTS=/path/to/dir                        (default: orakel/test/e2e/shots)
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const candidates = [process.env.PLAYWRIGHT, '/opt/node-tools/node_modules/playwright/index.js'].filter(Boolean);
let pw = null;
for (const c of candidates) if (fs.existsSync(c)) { pw = require(c); break; }
if (!pw) pw = require('playwright');
export const {chromium, devices} = pw;
export const GAME_PATH = path.resolve(process.env.GAME || path.join(here, '../../dist/index.html'));
export const GAME_URL = pathToFileURL(GAME_PATH).href;
export const SHOTS = path.resolve(process.env.SHOTS || path.join(here, 'shots')) + path.sep;
fs.mkdirSync(SHOTS, {recursive: true});
export const launch = () => chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});

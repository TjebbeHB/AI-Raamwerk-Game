// Builds "Het Orakel van Dalwijk" into one self-contained HTML file.
//   node scripts/build-orakel.mjs            -> docs/index.html (minified, for GitHub Pages)
//   node scripts/build-orakel.mjs --dev      -> orakel/dist/index.html (readable, with source map)
//   node scripts/build-orakel.mjs --serve    -> dev build + rebuild on change + http://localhost:5180
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const serve = args.includes('--serve');
const dev = serve || args.includes('--dev');
const outArg = args.find(a => a.startsWith('--out='));
const out = path.resolve(root, outArg ? outArg.slice(6) : dev ? 'orakel/dist/index.html' : 'docs/index.html');

async function bundle() {
  const t0 = Date.now();
  const result = await build({
    entryPoints: [path.join(root, 'orakel/src/main.js')],
    bundle: true, write: false, format: 'iife', target: ['es2022'],
    minify: !dev, sourcemap: dev ? 'inline' : false, legalComments: 'none',
    define: {__DEV__: String(dev)},
    loader: {'.json': 'json'},
    logLevel: 'warning',
  });
  // The bundle is inlined into the page, so it must never close the script element early.
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const page = fs.readFileSync(path.join(root, 'orakel/index.html'), 'utf8');
  if (!page.includes('<!--BUNDLE-->')) throw new Error('orakel/index.html is missing the <!--BUNDLE--> marker');
  const html = page.replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, html);
  console.log(`built ${path.relative(root, out)} · ${(html.length / 1024).toFixed(0)} KB · ${Date.now() - t0} ms`);
}

await bundle();

if (serve) {
  let timer = null;
  fs.watch(path.join(root, 'orakel'), {recursive: true}, (_, file) => {
    if (!file || file.startsWith('dist')) return;
    clearTimeout(timer);
    timer = setTimeout(() => bundle().catch(e => console.error(e.message)), 120);
  });
  http.createServer((req, res) => {
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    res.end(fs.readFileSync(out));
  }).listen(5180, () => console.log('serving http://localhost:5180'));
}

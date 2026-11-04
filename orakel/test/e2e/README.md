# Browser checks

Scripted playthroughs and layout checks for Het Orakel van Dalwijk, using Playwright with Chromium.
They are not part of `npm test` (they take minutes and need a browser). Build first:

```bash
node scripts/build-orakel.mjs --dev
```

| Script | What it checks |
|---|---|
| `run.mjs f0` … `run.mjs f4` | plays one floor with the debug API (`window.__orakel`), a screenshot per step, results as `[eval step] …` lines |
| `council.mjs` | the online council with two phones, against a local relay (`PORT=8787 node orakel/relay/broker.mjs`) |
| `phone.mjs` | phone and tablet layouts: overlapping HUD elements, touch buttons hidden while talking |
| `layout.mjs` | the boss bar at desktop, tablet and phone sizes |
| `hydra.mjs` | the Lekkende Hydra fight can be won (heads, stumps, body) |

Screenshots land in `orakel/test/e2e/shots/` (ignored by git). Environment variables: `GAME` (the html file),
`SHOTS`, `PLAYWRIGHT` (path to Playwright's `index.js`), `Q` (query string, default `?q=low`), `VIEW` (`960x540`).

// Local council test: the game as host, a phone page as advisor, both on a local relay.
import {chromium, devices, GAME_URL, SHOTS, launch} from './_env.mjs';
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const browser = await launch();
const logs = [];
const host = await browser.newPage({viewport: {width: 960, height: 540}});
host.on('pageerror', e => logs.push('[host error] ' + e.message));
await host.goto(file + '?q=low&broker=ws://localhost:8787');
await host.waitForTimeout(2500);
await host.evaluate(() => document.querySelector('#titleBtns .go').click());
await host.waitForTimeout(1500);
await host.evaluate(async () => { await __orakel.run(2); });
// open the pause menu, then the council panel, and start a council
await host.evaluate(() => document.querySelector('#btnMenu').click());
await host.waitForTimeout(300);
await host.evaluate(() => [...document.querySelectorAll('#menuBody button')].find(b => b.textContent.includes('Adviesraad')).click());
await host.waitForTimeout(300);
await host.evaluate(() => [...document.querySelectorAll('#councilBody button')].find(b => b.textContent.includes('Start')).click());
await host.waitForTimeout(1500);
const link = await host.evaluate(() => document.querySelector('#councilBody input')?.value);
const code = await host.evaluate(() => document.querySelector('#councilBody .code')?.textContent);
console.log('code:', code, '\nlink:', link);
await host.screenshot({path: SH + 'council-host.png'});

// a phone joins with the link
const phone = await browser.newPage({viewport: {width: 390, height: 780}});
phone.on('pageerror', e => logs.push('[phone error] ' + e.message));
await phone.goto(link);
await phone.waitForTimeout(800);
await phone.fill('#advisor input', 'Fatima');
await phone.click('#advisor .go');
await phone.waitForTimeout(1500);
await phone.screenshot({path: SH + 'council-phone1.png'});
console.log('host sees members:', await host.evaluate(() => document.querySelector('#councilBody .members')?.textContent));

// the host opens a decision; the phone votes on it
await host.evaluate(() => { document.getElementById('councilModal').hidden = true; document.getElementById('menu').hidden = true; __orakel.GAME.modal = null; __orakel.autoDecide = null; window.__dec = __orakel.decide('necessity', {who: 'waarom'}); });
await phone.waitForTimeout(1500);
const opts = await phone.$$('#advisor .optb');
console.log('phone sees options:', opts.length);
if (opts.length) { await phone.locator('#advisor .optb').nth(0).click(); await phone.locator('#advisor .optb').nth(2).click(); await phone.click('#advisor .go'); }
console.log('phone picks shown:', await phone.evaluate(() => [...document.querySelectorAll('#advisor .optb')].map(b => b.getAttribute('aria-pressed')).join(',')));
await phone.waitForTimeout(1200);
await phone.screenshot({path: SH + 'council-phone2.png'});
console.log('host tally:', await host.evaluate(() => JSON.stringify(__orakel.NET.tallies)));
console.log('vote counts in panel:', await host.evaluate(() => [...document.querySelectorAll('#decBody .votes')].map(v => v.textContent).join(' ')));
await host.screenshot({path: SH + 'council-host2.png'});
// a second advisor joins while the vote is open, and votes for option 2 only
const phone2 = await browser.newPage({viewport: {width: 390, height: 780}});
phone2.on('pageerror', e => logs.push('[phone2 error] ' + e.message));
await phone2.goto(link);
await phone2.waitForTimeout(800);
await phone2.fill('#advisor input', 'Sem');
await phone2.click('#advisor .go');
await phone2.waitForTimeout(1500);
await phone.evaluate(() => { document.getElementById('advisor').scrollTop = 150; });
const before = await phone.evaluate(() => document.getElementById('advisor').scrollTop);
await phone2.locator('#advisor .optb').nth(2).click();
await phone2.click('#advisor .go');
await phone2.waitForTimeout(1500);
console.log('host tally after 2 voters:', await host.evaluate(() => JSON.stringify(__orakel.NET.tallies)));
console.log('phone 1 scroll kept across an update:', before, '->', await phone.evaluate(() => document.getElementById('advisor').scrollTop));
console.log('phone 1 sees counts:', await phone.evaluate(() => [...document.querySelectorAll('#advisor .optb .votes')].map(v => v.textContent).join(',')));
// the host closes the decision; phones go back to waiting
await host.evaluate(() => { const b = [...document.querySelectorAll('#decision button')].find(b => /besluit|bevestig|kies/i.test(b.textContent)); window.__btn = b?.textContent; });
console.log('decision confirm button:', await host.evaluate(() => window.__btn));
// support from the phone
await phone.click('#advisor .cheer');
await host.waitForTimeout(1200);
console.log('cheers received:', await host.evaluate(() => __orakel.NET.cheers));
// an advisor leaves: the host's member list shrinks
await phone2.close({runBeforeUnload: true});
await host.waitForTimeout(1500);
console.log('members after one leaves:', await host.evaluate(() => JSON.stringify(__orakel.NET.members)));
// the host stops the council: the remaining phone sees that it is closed
await host.evaluate(() => { document.getElementById('decision').hidden = true; __orakel.GAME.modal = null; });
await host.evaluate(() => document.querySelector('#btnMenu').click());
await host.waitForTimeout(300);
await host.evaluate(() => [...document.querySelectorAll('#menuBody button')].find(b => b.textContent.includes('Adviesraad')).click());
await host.waitForTimeout(300);
await host.evaluate(() => [...document.querySelectorAll('#councilBody button')].find(b => b.textContent.includes('Stop')).click());
await phone.waitForTimeout(1500);
console.log('phone after stop:', await phone.evaluate(() => document.querySelector('#advisor h1')?.textContent));
console.log('host council active:', await host.evaluate(() => __orakel.NET.active));
console.log(logs.join('\n') || 'no page errors');
await browser.close();

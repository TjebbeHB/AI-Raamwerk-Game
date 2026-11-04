// A tiny MQTT 3.1.1 broker over WebSockets, with no dependencies.
// Het Orakel van Dalwijk uses it for the online council: the game page and the advisors'
// phones only exchange small messages (the current question, votes, a cheer), so QoS 0,
// retained messages and simple topic filters are all it needs.
//
//   node orakel/relay/broker.mjs            # listens on port 8787 (or $PORT)
//   open the game with ?broker=ws://localhost:8787   (or wss://your-host when behind TLS)
//
// Any standard MQTT broker with WebSocket support (Mosquitto, EMQX, HiveMQ) works too.
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT ? +process.env.PORT : 8787;    // PORT=0 picks a free port
const MAX_PAYLOAD = 32 * 1024, MAX_RETAINED = 2000, MAX_CLIENTS = 2000;
const clients = new Set();
const retained = new Map();      // topic -> {p: Buffer, at: time}

// ---------------------------------------------------------------- MQTT helpers
function encLen(n) { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return Buffer.from(out); }
function str(s) { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); }
function packet(type, flags, body) { return Buffer.concat([Buffer.from([(type << 4) | flags]), encLen(body.length), body]); }
const publishPacket = (topic, payload, retain) => packet(3, retain ? 1 : 0, Buffer.concat([str(topic), payload]));
function matches(filter, topic) {
  const f = filter.split('/'), t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

// ---------------------------------------------------------------- WebSocket framing
function wsSend(c, data) {
  if (c.closed) return;
  const len = data.length;
  const head = len < 126 ? Buffer.from([0x82, len]) : len < 65536 ? Buffer.from([0x82, 126, len >> 8, len & 255]) : Buffer.concat([Buffer.from([0x82, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(len)); return b; })()]);
  c.socket.write(Buffer.concat([head, data]));
}
function wsFrames(c, chunk) {
  c.wsBuf = Buffer.concat([c.wsBuf, chunk]);
  for (;;) {
    const b = c.wsBuf;
    if (b.length < 2) return;
    const op = b[0] & 15, masked = b[1] & 128;
    let len = b[1] & 127, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > MAX_PAYLOAD + 1024) return close(c);
    const mOff = off; if (masked) off += 4;
    if (b.length < off + len) return;
    const data = Buffer.from(b.subarray(off, off + len));
    if (masked) for (let i = 0; i < len; i++) data[i] ^= b[mOff + (i & 3)];
    c.wsBuf = b.subarray(off + len);
    if (op === 8) return close(c);
    if (op === 9) { c.socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
    if (op === 1 || op === 2 || op === 0) mqttBytes(c, data);
  }
}

// ---------------------------------------------------------------- MQTT protocol
function mqttBytes(c, data) {
  c.mqBuf = Buffer.concat([c.mqBuf, data]);
  for (;;) {
    const b = c.mqBuf;
    if (b.length < 2) return;
    let mult = 1, len = 0, i = 1, byte;
    do { if (i >= b.length) return; byte = b[i++]; len += (byte & 127) * mult; mult *= 128; } while (byte & 128);
    if (b.length < i + len) return;
    const type = b[0] >> 4, flags = b[0] & 15, body = b.subarray(i, i + len);
    c.mqBuf = b.subarray(i + len);
    c.seen = Date.now();
    try { handle(c, type, flags, body); } catch (e) { return close(c); }
  }
}
function handle(c, type, flags, body) {
  if (type === 1) { wsSend(c, Buffer.from([0x20, 0x02, 0x00, 0x00])); c.connected = true; return; }
  if (!c.connected) return close(c);
  if (type === 3) {                                  // PUBLISH
    const tl = body.readUInt16BE(0), topic = body.subarray(2, 2 + tl).toString('utf8');
    const qos = (flags >> 1) & 3; let p = 2 + tl;
    if (qos > 0) p += 2;
    const payload = body.subarray(p);
    if (payload.length > MAX_PAYLOAD || topic.length > 256 || topic.includes('#') || topic.includes('+')) return;
    if (flags & 1) { if (payload.length) { if (retained.size < MAX_RETAINED || retained.has(topic)) retained.set(topic, {p: Buffer.from(payload), at: Date.now()}); } else retained.delete(topic); }
    const out = publishPacket(topic, payload, false);
    for (const o of clients) if (o.subs.some(f => matches(f, topic))) wsSend(o, out);
    if (qos === 1) wsSend(c, Buffer.from([0x40, 0x02, body[2 + tl], body[3 + tl]]));
    return;
  }
  if (type === 8) {                                  // SUBSCRIBE
    const pid = body.subarray(0, 2); let p = 2; const codes = [];
    while (p < body.length) {
      const tl = body.readUInt16BE(p), f = body.subarray(p + 2, p + 2 + tl).toString('utf8'); p += 2 + tl + 1;
      if (c.subs.length < 50) c.subs.push(f);
      codes.push(0);
      for (const [t, r] of retained) if (matches(f, t)) wsSend(c, publishPacket(t, r.p, true));
    }
    wsSend(c, packet(9, 0, Buffer.concat([pid, Buffer.from(codes)])));
    return;
  }
  if (type === 10) { const pid = body.subarray(0, 2); let p = 2; while (p < body.length) { const tl = body.readUInt16BE(p), f = body.subarray(p + 2, p + 2 + tl).toString('utf8'); p += 2 + tl; c.subs = c.subs.filter(x => x !== f); } wsSend(c, packet(11, 0, pid)); return; }
  if (type === 12) { wsSend(c, Buffer.from([0xd0, 0x00])); return; }
  if (type === 14) return close(c);
}
function close(c) { if (c.closed) return; c.closed = true; clients.delete(c); try { c.socket.end(); } catch (e) { /* gone */ } }

// ---------------------------------------------------------------- server
const server = http.createServer((req, res) => {
  res.writeHead(200, {'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*'});
  res.end(`Orakel relay: ${clients.size} verbonden, ${retained.size} bewaarde berichten.\n`);
});
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || clients.size >= MAX_CLIENTS) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const proto = (req.headers['sec-websocket-protocol'] || '').split(',').map(s => s.trim()).find(p => p === 'mqtt' || p === 'mqttv3.1');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, proto ? `Sec-WebSocket-Protocol: ${proto}` : null, '', ''].filter(l => l !== null).join('\r\n'));
  const c = {socket, wsBuf: Buffer.alloc(0), mqBuf: Buffer.alloc(0), subs: [], connected: false, closed: false, seen: Date.now()};
  clients.add(c);
  socket.on('data', d => wsFrames(c, d));
  socket.on('close', () => close(c));
  socket.on('error', () => close(c));
});
// drop silent clients, and retained rooms nobody has touched for a day
setInterval(() => {
  const now = Date.now();
  for (const c of clients) if (now - c.seen > 120000) close(c);
  for (const [t, r] of retained) if (now - r.at > 24 * 3600e3) retained.delete(t);
}, 30000).unref();
server.listen(PORT, () => { if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) console.log(`Orakel relay listening on :${server.address().port}`); });
export {server};

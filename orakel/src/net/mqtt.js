// A small MQTT 3.1.1 client over WebSockets (QoS 0), enough for the online council.
const te = new TextEncoder(), td = new TextDecoder();
function encLen(n) { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return out; }
function str(s) { const b = te.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function packet(first, body) { return new Uint8Array([first, ...encLen(body.length), ...body]); }

export class Mqtt {
  constructor(url) { this.url = url; this.subs = new Set(); this.onMessage = null; this.onStatus = null; this.pid = 1; this.buf = new Uint8Array(0); this.closing = false; this.status = 'idle'; this.retry = 0; }
  setStatus(s) { this.status = s; this.onStatus?.(s); }
  connect(timeout = 6000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = e => { if (done) return; done = true; try { this.ws?.close(); } catch (er) { /* ignore */ } reject(e); };
      const timer = setTimeout(() => fail(new Error('timeout')), timeout);
      let ws;
      try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { clearTimeout(timer); fail(e); return; }
      this.ws = ws; ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        const id = 'orakel-' + Math.random().toString(36).slice(2, 10);
        ws.send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 60, ...str(id)]));
      };
      ws.onmessage = ev => this.bytes(new Uint8Array(ev.data), () => { if (!done) { done = true; clearTimeout(timer); this.retry = 0; this.setStatus('open'); resolve(); } });
      ws.onerror = () => { clearTimeout(timer); fail(new Error('error')); };
      ws.onclose = () => {
        clearInterval(this.ping);
        if (!done) { clearTimeout(timer); fail(new Error('closed')); return; }
        if (this.closing) { this.setStatus('closed'); return; }
        this.setStatus('reconnecting');
        setTimeout(() => this.reconnect(), Math.min(15000, 1000 * 2 ** this.retry++));
      };
      this.ping = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0])); }, 25000);
    });
  }
  async reconnect() {
    if (this.closing) return;
    try { await this.connect(); for (const t of this.subs) this.sendSub(t); this.onReconnect?.(); }
    catch (e) { if (!this.closing) setTimeout(() => this.reconnect(), Math.min(15000, 1000 * 2 ** this.retry++)); }
  }
  bytes(chunk, onConnack) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    for (;;) {
      const x = this.buf;
      if (x.length < 2) return;
      let mult = 1, len = 0, i = 1, byte;
      do { if (i >= x.length) return; byte = x[i++]; len += (byte & 127) * mult; mult *= 128; } while (byte & 128);
      if (x.length < i + len) return;
      const type = x[0] >> 4, body = x.subarray(i, i + len);
      this.buf = x.slice(i + len);
      if (type === 2) onConnack();
      else if (type === 3) {
        const tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl)), qos = (x[0] >> 1) & 3;
        const payload = body.subarray(2 + tl + (qos ? 2 : 0));
        if (!payload.length) continue;
        let data = null; try { data = JSON.parse(td.decode(payload)); } catch (e) { continue; }
        this.onMessage?.(topic, data);
      }
    }
  }
  sendSub(topic) { const pid = this.pid++ & 0xffff || 1; this.ws?.readyState === 1 && this.ws.send(packet(0x82, [pid >> 8, pid & 255, ...str(topic), 0])); }
  subscribe(topic) { this.subs.add(topic); this.sendSub(topic); }
  publish(topic, data, retain = false) {
    if (this.ws?.readyState !== 1) return false;
    const payload = data === null ? new Uint8Array(0) : te.encode(JSON.stringify(data));
    this.ws.send(packet(0x30 | (retain ? 1 : 0), [...str(topic), ...payload]));
    return true;
  }
  close() { this.closing = true; clearInterval(this.ping); try { this.ws?.readyState === 1 && this.ws.send(new Uint8Array([0xe0, 0])); this.ws?.close(); } catch (e) { /* ignore */ } }
}

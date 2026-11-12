// Chạy script thật với DOM/canvas/đồng hồ giả; không phải kiểm tra trình duyệt hay chất lượng hình ảnh.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const publicDir = new URL('../../public/', import.meta.url);
const html = readFileSync(new URL('index.html', publicDir), 'utf8');
export function createGame({ search = '?ve&username=alice', eventsBase = 'https://backend.example.com/live' } = {}) {
  let now = 0, frame, timerId = 0;
  const timers = new Map(), sources = [], elements = new Map();
  const ctx = new Proxy({
    measureText: () => ({ width: 80 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const element = () => ({ textContent: '', value: '', style: {}, classList: { add() {} },
    getContext: () => ctx, focus() {}, append() {}, appendChild(child) { return child; }, remove() {} });
  const context = {
    URL, URLSearchParams, console, location: { protocol: 'https:', search },
    history: { replaceState() {} }, navigator: {}, performance: { now: () => now },
    Date: class extends Date { static now() { return now; } },
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }, createElement: element, body: element(), documentElement: element() },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    requestAnimationFrame(callback) { frame = callback; },
    MutationObserver: class { observe() {} },
    Image: class {}, // Không tải tài nguyên; game dùng đường vẽ fallback.
    EventSource: class {
      constructor(url) { this.url = url; this.listeners = new Map(); sources.push(this); }
      addEventListener(type, callback) { this.listeners.set(type, callback); }
      emit(type, data) { this.listeners.get(type)?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
    },
    Path2D: class { moveTo() {} lineTo() {} closePath() {} },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  context.window = context;
  vm.createContext(context);
  for (const match of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    if (!match[1]) context.APP_CONFIG = { eventsBase };
    vm.runInContext(match[1] ? readFileSync(new URL(match[1], publicDir), 'utf8') : match[2], context);
  }
  return {
    sources,
    read: expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context))),
    add: (name, tier, diamonds = 0) => context.addGifter(name, tier, diamonds),
    advance(seconds) {
      const end = now + seconds * 1000;
      while (now < end) {
        now = Math.min(end, now + 100);
        for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); }
        if (!frame) throw new Error('Game không lên lịch frame tiếp theo');
        const callback = frame; frame = null; callback(now);
      }
    },
  };
}

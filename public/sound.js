// Âm thanh: mẫu trong sounds/ (xem sounds/manifest.json) phát bằng Web Audio, có vị trí trái/phải.
// Mở khoá bằng cú chạm đầu tiên, giống giọng đọc. Không có Web Audio hoặc không tải được file thì game vẫn chạy, chỉ im lặng.
const SOUND = (() => {
  const MAX_VOICES = 28; // số âm phát cùng lúc tối đa; âm cũ nhất bị dừng trước
  let ac = null, fx = null, amb = null, manifest = null, manifestP = null, wanted = new Set();
  const buffers = new Map(), pending = new Map(), layers = new Map(), voices = new Set();
  const running = () => !!ac && ac.state === 'running';

  function init() {
    if (ac) return ac;
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    try { ac = new Ctor(); } catch { return null; }
    const out = ac.createGain(); out.gain.value = .9; out.connect(ac.destination);
    fx = ac.createGain(); fx.connect(out);
    amb = ac.createGain(); amb.connect(out);
    return ac;
  }
  function loadManifest() {
    if (!manifestP) manifestP = typeof fetch === 'function'
      ? fetch('sounds/manifest.json').then(r => (r.ok ? r.json() : null)).then(m => (manifest = m)).catch(() => null)
      : Promise.resolve(null);
    return manifestP;
  }
  // Promise<AudioBuffer | null>: mỗi file chỉ tải và giải mã một lần
  function load(file) {
    if (buffers.has(file)) return Promise.resolve(buffers.get(file));
    if (!ac || typeof fetch !== 'function') return Promise.resolve(null);
    if (!pending.has(file)) pending.set(file, fetch('sounds/' + file)
      .then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b))
      .then(buf => { buffers.set(file, buf); return buf; })
      .catch(() => { buffers.set(file, null); return null; }));
    return pending.get(file);
  }
  // Gọi trong thao tác của người dùng: bật ngữ cảnh, tải trước mọi file, bật lại nền nếu chưa có
  function unlock() {
    if (!init()) return;
    initBed();
    Promise.resolve(bedEl?.play?.()).catch(() => {}); // nhạc nền: trình duyệt chưa cho phát thì chạm lần sau sẽ thử lại
    Promise.resolve(ac.resume?.()).then(() => setLayers(wanted.size ? [...wanted] : ['amb_hall'], 3));
    loadManifest().then(m => { if (m) for (const c of Object.values(m)) for (const f of c.files) load(f); });
  }
  // Phát một âm. pan: -1 trái … 1 phải; gain: nhân với âm lượng của âm; delay: giây
  function play(cue, { pan = 0, gain = 1, delay = 0 } = {}) {
    const c = manifest?.[cue];
    if (!c || c.loop || !running()) return;
    load(c.files[Math.random() * c.files.length | 0]).then(buf => {
      if (!buf || !running()) return;
      while (voices.size >= MAX_VOICES) { const old = voices.values().next().value; voices.delete(old); try { old.stop(); } catch {} }
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; src.playbackRate.value = .95 + Math.random() * .1;
      g.gain.value = c.gain * gain * (.85 + Math.random() * .3);
      src.connect(g);
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(fx); }
      else g.connect(fx);
      src.onended = () => voices.delete(src);
      voices.add(src); src.start(ac.currentTime + delay);
    });
  }
  // Đặt các lớp nền đang phát: lớp không còn trong danh sách mờ dần rồi dừng, lớp mới vào dần và lặp vòng
  function setLayers(names, fade = 1.5) {
    wanted = new Set(names);
    if (!running()) return;
    const now = ac.currentTime;
    for (const [name, L] of layers) if (!wanted.has(name)) {
      L.gain.gain.setTargetAtTime(0, now, fade / 3); L.src.stop(now + fade * 2.5); layers.delete(name);
    }
    loadManifest().then(() => {
      for (const name of wanted) {
        const c = manifest?.[name];
        if (!c || c.loop !== true || layers.has(name)) continue;
        load(c.files[0]).then(buf => {
          if (!buf || !running() || !wanted.has(name) || layers.has(name)) return;
          const src = ac.createBufferSource(), g = ac.createGain();
          src.buffer = buf; src.loop = true;
          g.gain.setValueAtTime(0, ac.currentTime); g.gain.setTargetAtTime(c.gain, ac.currentTime, fade / 3);
          src.connect(g).connect(amb); src.start(); layers.set(name, { src, gain: g });
        });
      }
    });
  }
  // Nhạc nền: một file dài, phát từ lúc mở khoá và lặp khi hết. Phát qua thẻ audio nên không giải mã cả file vào bộ nhớ.
  // bed(on): bật/tắt theo nơi của cảnh. Khi tắt, nhạc vẫn chạy để bật lại đúng chỗ đang dở. duck(on): giảm nhạc khi có lời chúc.
  const BED = .4, DUCK = .3; // hệ số âm lượng của nhạc nền, và khi bị giảm
  const bedEl = typeof Audio === 'function' ? Object.assign(new Audio('sounds/nhac_nen.mp3'), { loop: true, preload: 'auto' }) : null;
  let bedOn = true, bedGain = null, duckGain = null;
  function initBed() { // nối thẻ audio vào Web Audio, một lần; lỗi thì chỉ mất nhạc nền, game vẫn chạy
    if (bedGain || !bedEl || !ac) return;
    try {
      bedGain = ac.createGain(); bedGain.gain.value = bedOn ? BED : 0; bedGain.connect(amb);
      duckGain = ac.createGain(); duckGain.connect(bedGain);
      ac.createMediaElementSource(bedEl).connect(duckGain);
    } catch { bedGain = duckGain = null; }
  }
  function bed(on, fade = 1.5) {
    bedOn = on;
    if (bedGain) bedGain.gain.setTargetAtTime(on ? BED : 0, ac.currentTime, fade / 3);
  }
  function duck(on) {
    if (duckGain) duckGain.gain.setTargetAtTime(on ? DUCK : 1, ac.currentTime, .3);
  }
  return { unlock, play, setLayers, running, bed, duck };
})();

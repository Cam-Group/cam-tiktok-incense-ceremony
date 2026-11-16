import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { FILES, TYPES } from '../server.mjs';

const pub = new URL('../public/', import.meta.url);
const read = p => readFileSync(new URL(p, pub), 'utf8');
const flush = () => new Promise(r => setTimeout(r, 5));

// Web Audio giả: ghi lại mọi lệnh phát, dừng, mờ dần và pan để kiểm tra
function engine({ withAudio = true } = {}) {
  const log = [];
  class Node { connect(n) { return n; } }
  class Gain extends Node {
    constructor() { super(); this.gain = { value: 0, setValueAtTime() {}, setTargetAtTime(v) { log.push(['fade', v]); } }; }
  }
  class Panner extends Node {
    constructor() { super(); this.pan = { set value(v) { log.push(['pan', v]); } }; }
  }
  class Source extends Node {
    constructor() { super(); this.playbackRate = { value: 1 }; this.loop = false; }
    start(at = 0) { log.push(['start', this.buffer.name, this.loop, at]); }
    stop(at = 0) { log.push(['stop', this.buffer.name, at]); }
  }
  class Ctx {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = new Node(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return new Gain(); }
    createStereoPanner() { return new Panner(); }
    createBufferSource() { return new Source(); }
    decodeAudioData(b) { return Promise.resolve(b); }
    createMediaElementSource() { return new Node(); }
  }
  const manifest = {
    step_wood: { files: ['step_wood_00.mp3', 'step_wood_01.mp3'], gain: .5, loop: false },
    amb_hall: { files: ['amb_hall.mp3'], gain: .3, loop: true },
    amb_pond: { files: ['amb_pond.mp3'], gain: .3, loop: true },
  };
  class FakeAudio { // thẻ audio của nhạc nền: ghi lại lúc phát và thuộc tính lặp
    constructor(src) { this.src = src; this.loop = false; this.preload = ''; }
    play() { log.push(['play', this.src, this.loop]); return Promise.resolve(); }
  }
  const context = {
    console,
    Audio: FakeAudio,
    window: withAudio ? { AudioContext: Ctx } : {},
    fetch: async url => ({ ok: true, json: async () => manifest, arrayBuffer: async () => ({ name: url.slice('sounds/'.length) }) }),
  };
  vm.createContext(context);
  vm.runInContext(read('sound.js'), context);
  return { log, SOUND: vm.runInContext('SOUND', context) };
}

test('không có Web Audio thì game không lỗi và không phát gì', async () => {
  const { SOUND, log } = engine({ withAudio: false });
  SOUND.unlock(); SOUND.play('step_wood'); SOUND.setLayers(['amb_hall']);
  await flush();
  assert.deepEqual(log, []);
  assert.equal(SOUND.running(), false);
});

test('mở khoá rồi phát: chọn một file của âm, kẹp pan trong [-1, 1], bắt đầu đúng lúc', async () => {
  const { SOUND, log } = engine();
  SOUND.unlock(); await flush();
  log.length = 0;
  SOUND.play('step_wood', { pan: -3, gain: .5, delay: .2 }); await flush();
  const starts = log.filter(e => e[0] === 'start');
  assert.equal(starts.length, 1);
  assert.match(starts[0][1], /^step_wood_0[01]\.mp3$/);
  assert.equal(starts[0][2], false);
  assert.equal(starts[0][3], .2);
  assert.deepEqual(log.find(e => e[0] === 'pan'), ['pan', -1]);
});

test('lớp nền: mở khoá có amb_hall; đổi sang amb_pond thì amb_hall mờ rồi dừng, amb_pond lặp vòng', async () => {
  const { SOUND, log } = engine();
  SOUND.unlock(); await flush();
  assert.ok(log.some(e => e[0] === 'start' && e[1] === 'amb_hall.mp3' && e[2] === true));
  log.length = 0;
  SOUND.setLayers(['amb_pond'], 1.5); await flush();
  assert.ok(log.some(e => e[0] === 'fade' && e[1] === 0));
  assert.ok(log.some(e => e[0] === 'stop' && e[1] === 'amb_hall.mp3'));
  assert.ok(log.some(e => e[0] === 'start' && e[1] === 'amb_pond.mp3' && e[2] === true));
});

test('tối đa 28 âm cùng lúc: âm cũ nhất bị dừng trước', async () => {
  const { SOUND, log } = engine();
  SOUND.unlock(); await flush(); log.length = 0;
  for (let i = 0; i < 40; i++) SOUND.play('step_wood');
  await flush();
  assert.equal(log.filter(e => e[0] === 'start').length, 40);
  assert.equal(log.filter(e => e[0] === 'stop').length, 12);
});

test('mọi âm game gọi đều có trong manifest, mọi file trong manifest đều có trên đĩa', () => {
  const manifest = JSON.parse(read('sounds/manifest.json'));
  const onDisk = new Set(readdirSync(new URL('sounds/', pub)));
  for (const c of Object.values(manifest)) for (const f of c.files) assert.ok(onDisk.has(f), `thiếu file ${f}`);
  const used = new Set(['step_water', 'step_church', 'step_wood', 'scream', 'bell', 'bow', 'incense', 'gift', 'whoosh', 'fog']);
  const cues = read('sound-cues.js');
  for (const m of cues.matchAll(/\[\s*[\d.]+\s*,\s*'([a-z_]+)'/g)) used.add(m[1]);
  for (const m of cues.matchAll(/\[\s*[\d.]+\s*,\s*\[([^\]]*)\]/g)) for (const n of m[1].matchAll(/'([a-z_]+)'/g)) used.add(n[1]);
  for (const f of ['index.html', 'scenes.js']) for (const m of read(f).matchAll(/SOUND\.play\(\s*'([a-z_]+)'/g)) used.add(m[1]);
  for (const name of used) assert.ok(manifest[name], `thiếu âm ${name}`);
});

test('server.mjs phục vụ đủ script, âm thanh và manifest mà trang cần', () => {
  const pages = [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map(m => '/' + m[1]);
  const manifest = JSON.parse(read('sounds/manifest.json'));
  const sounds = Object.values(manifest).flatMap(c => c.files).map(f => '/sounds/' + f);
  for (const p of [...pages, ...sounds, '/sounds/manifest.json']) assert.ok(FILES.test(p), `server không phục vụ ${p}`);
  assert.ok(TYPES['.mp3'] && TYPES['.json']);
});

test('nhạc nền: phát từ lúc mở khoá và lặp; bật/tắt theo cảnh không phát lại; giảm khi có lời chúc', async () => {
  assert.ok(readdirSync(new URL('sounds/', pub)).includes('nhac_nen.mp3'), 'thiếu nhạc nền trên đĩa');
  assert.ok(FILES.test('/sounds/nhac_nen.mp3'), 'server không phục vụ nhạc nền');
  const { SOUND, log } = engine();
  SOUND.bed(false); // trước khi mở khoá: không lỗi, không phát
  assert.deepEqual(log, []);
  SOUND.unlock(); await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(log.filter(e => e[0] === 'play'), [['play', 'sounds/nhac_nen.mp3', true]]);
  log.length = 0;
  SOUND.bed(false, 1.5); SOUND.bed(true, 1.5); SOUND.duck(true); SOUND.duck(false);
  await flush();
  assert.deepEqual(log.filter(e => e[0] === 'fade').map(e => e[1]), [0, .475, .3, 1]);
  assert.equal(log.filter(e => e[0] === 'play').length, 0);
});

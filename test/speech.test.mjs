import { test } from 'node:test';
import assert from 'node:assert/strict';
import createSpeechController from '../public/speech.js';

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [], states = [], listeners = new Map();
  let voices = [], cancellations = 0;
  class Utterance { constructor(text) { this.text = text; this.voice = null; } }
  const synthesis = {
    getVoices: () => voices, speak: u => calls.push(u), cancel: () => cancellations++,
    addEventListener: (type, callback) => listeners.set(type, callback),
  };
  const controller = createSpeechController({ synthesis, Utterance, onState: s => states.push(s) });
  const ready = () => { controller.enable(); calls.at(-1).onstart(); calls.at(-1).onend(); };
  return { controller, synthesis, calls, states, ready,
    state: () => states.at(-1), cancelled: () => cancellations,
    voices: value => { voices = value; listeners.get('voiceschanged')(); } };
}

test('không tự phát trước click; enable gọi speak đồng bộ với lang Việt dù getVoices rỗng', t => {
  const s = setup(t);
  assert.equal(s.calls.length, 0);
  s.controller.enable();
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].lang, 'vi-VN');
  assert.equal(s.calls[0].voice, null);
  assert.equal(s.state().phase, 'testing');
  s.calls[0].onstart(); s.calls[0].onend();
  assert.equal(s.state().phase, 'ready');
});

test('giọng tải chậm qua voiceschanged được dùng ở câu kế tiếp, không phát tự động', t => {
  const s = setup(t);
  const vietnamese = { lang: 'vi_VN', name: 'Vietnamese' };
  s.voices([{ lang: 'en-US' }, vietnamese]);
  assert.equal(s.calls.length, 0);
  s.ready();
  let done = 0;
  s.controller.speak('Xin chào', () => done++);
  assert.equal(s.calls.at(-1).voice, vietnamese);
  s.calls.at(-1).onstart(); s.calls.at(-1).onend();
  assert.equal(done, 1);
});

test('not-allowed hiện lỗi cụ thể, voiceschanged không xóa lỗi; người dùng thử lại được', t => {
  const s = setup(t);
  s.controller.enable();
  const old = s.calls[0];
  old.onerror({ error: 'not-allowed' });
  assert.equal(s.state().phase, 'error');
  assert.match(s.state().message, /chưa cho phép/);
  s.voices([]);
  assert.equal(s.state().phase, 'error');
  s.controller.enable();
  assert.equal(s.calls.length, 2);
  old.onend(); // callback đến muộn không được đánh dấu câu thử mới là thành công
  assert.equal(s.state().phase, 'testing');
  s.calls[1].onstart(); s.calls[1].onend();
  assert.equal(s.state().phase, 'ready');
});

test('thiếu giọng Việt hiện hướng xử lý, không giả vờ đọc thành công', t => {
  const s = setup(t);
  s.controller.enable();
  s.calls[0].onerror({ error: 'language-unavailable' });
  assert.equal(s.state().phase, 'error');
  assert.match(s.state().message, /tiếng Việt/);
});

test('không có onstart thì hết hạn, câu game chờ sau câu thử vẫn hoàn tất một lần', t => {
  const s = setup(t);
  s.controller.enable();
  let done = 0;
  s.controller.speak('Xin chào', () => done++);
  assert.equal(s.calls.length, 1);
  t.mock.timers.tick(5000);
  assert.equal(s.state().phase, 'error');
  assert.match(s.state().message, /chưa bắt đầu/);
  t.mock.timers.tick(5000);
  assert.equal(done, 1);
  s.calls[0].onend();
  assert.equal(done, 1);
});

test('game đến trong lúc câu thử đang đọc: chờ xong rồi mới đọc tên, không cắt câu thử', t => {
  const s = setup(t);
  s.controller.enable();
  s.calls[0].onstart();
  let done = 0;
  s.controller.speak('Kính mời An', () => done++);
  assert.equal(s.calls.length, 1);
  s.calls[0].onend();
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].text, 'Kính mời An');
  s.calls[1].onstart(); s.calls[1].onend(); s.calls[1].onerror({ error: 'interrupted' });
  t.mock.timers.tick(100000);
  assert.equal(done, 1);
  assert.equal(s.state().phase, 'ready');
});

test('có onstart nhưng mất onend: watchdog hủy đọc, báo lỗi và không khóa hàng đợi', t => {
  const s = setup(t); s.ready();
  let done = 0;
  s.controller.speak('Xin chào', () => done++);
  const utterance = s.calls.at(-1);
  utterance.onstart();
  t.mock.timers.tick(8000 + utterance.text.length * 150);
  assert.equal(done, 1);
  assert.equal(s.state().phase, 'error');
  assert.ok(s.cancelled() > 0);
  utterance.onend();
  assert.equal(done, 1);
});

test('trang vào nền: reset hủy câu hiện tại, không tự phát khi quay lại trước click mới', t => {
  const s = setup(t); s.ready();
  let done = 0;
  s.controller.speak('Xin chào', () => done++);
  const old = s.calls.at(-1);
  old.onstart();
  s.controller.reset();
  assert.equal(done, 1);
  assert.equal(s.state().phase, 'idle');
  old.onend(); old.onerror({ error: 'interrupted' });
  assert.equal(s.state().phase, 'idle');
  s.controller.speak('Câu sau', () => done++);
  assert.equal(s.calls.length, 2);
  t.mock.timers.tick(5000);
  assert.equal(done, 2);
});

test('không có Web Speech: báo không hỗ trợ và game vẫn kết thúc lượt', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const states = [];
  const controller = createSpeechController({ onState: s => states.push(s) });
  assert.equal(states.at(-1).phase, 'unavailable');
  controller.enable();
  let done = 0;
  controller.speak('Xin chào', () => done++);
  t.mock.timers.tick(5000);
  assert.equal(done, 1);
});

test('synthesis.speak ném lỗi: hiển thị lỗi, không làm vỡ game hay chặn retry', t => {
  const s = setup(t);
  s.synthesis.speak = () => { throw new Error('engine failed'); };
  assert.doesNotThrow(() => s.controller.enable());
  assert.equal(s.state().phase, 'error');
  let done = 0;
  s.controller.speak('Xin chào', () => done++);
  t.mock.timers.tick(5000);
  assert.equal(done, 1);
});
